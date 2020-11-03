// ----------------------------------------------------
// CROSS REFERENCES
// ----------------------------------------------------
import * as cxapi from '@aws-cdk/cx-api';

import { CfnElement } from '../cfn-element';
import { CfnOutput } from '../cfn-output';
import { CfnParameter } from '../cfn-parameter';
import { Construct, IConstruct } from '../construct-compat';
import { FeatureFlags } from '../feature-flags';
import { Stack } from '../stack';
import { Token } from '../token';
import { CLOUDFORMATION_TOKEN_RESOLVER } from './cloudformation-lang';
import { Intrinsic } from './intrinsic';
import { resolve } from './resolve';
import { makeUniqueId } from './uniqueid';

/**
 * This is called from the App level to prepare all references
 */
export function resolveReferences(root: IConstruct): void {
  const edges = findAllReferences(root);

  for (const edge of edges) {
    resolveCfnRef(edge);
  }
}

/**
 * This is called from the App level to replace all references in a template.
 *
 * FIXME: Should error out if new references are detected at this point.
 */
export function replaceReferences(stack: Stack, template: any): any {
  if (Array.isArray(template)) {
    return template.map(x => replaceReferences(stack, x));
  }
  if (template instanceof Date) { return template; }
  if (typeof template === 'object' && template !== null) {
    const keys = Object.keys(template);

    if (keys.length === 1 && keys[0] === '$Cdk::Ref') {
      return resolveCfnRef(cdkReferenceFromIntrinsic(stack, template));
    }

    const ret: any = {};
    for (const [key, value] of Object.entries(template)) {
      ret[key] = replaceReferences(stack, value);
    }
    return ret;
  }
  return template;
}

/**
 * Resolves the value for `reference` in the context of `consumer`.
 */
function resolveCfnRef(reference: CfnElementRef): any {
  const producer = Stack.of(reference.target);

  // produce and consumer stacks are the same, we can just return the value itself.
  if (producer === reference.consumingStack) {
    return renderRefGetAtt(logicalIdOf(reference.target), reference.attribute);
  }

  // unsupported: stacks from different apps
  if (producer.node.root !== reference.consumingStack.node.root) {
    throw new Error('Cannot reference across apps. Consuming and producing stacks must be defined within the same CDK app.');
  }

  // unsupported: stacks are not in the same environment
  if (producer.environment !== reference.consumingStack.environment) {
    throw new Error(
      `Stack "${reference.consumingStack.node.path}" cannot consume a cross reference from stack "${producer.node.path}". ` +
      'Cross stack references are only supported for stacks deployed to the same environment or between nested stacks and their parent stack');
  }

  // ----------------------------------------------------------------------
  // consumer is nested in the producer (directly or indirectly)
  // ----------------------------------------------------------------------

  // if the consumer is nested within the producer (directly or indirectly),
  // wire through a CloudFormation parameter and then resolve the reference with
  // the parent stack as the consumer.
  if (reference.consumingStack.nestedStackParent && isNested(reference.consumingStack, producer)) {
    const parameterValue = resolveCfnRef({ ...reference, consumingStack: reference.consumingStack.nestedStackParent });
    return createNestedStackParameter(reference.consumingStack, reference, parameterValue);
  }

  // ----------------------------------------------------------------------
  // producer is a nested stack
  // ----------------------------------------------------------------------

  // if the producer is nested, always publish the value through a
  // cloudformation output and resolve recursively with the Fn::GetAtt
  // of the output in the parent stack.

  // one might ask, if the consumer is not a parent of the producer,
  // why not just use export/import? the reason is that we cannot
  // generate an "export name" from a nested stack because the export
  // name must contain the stack name to ensure uniqueness, and we
  // don't know the stack name of a nested stack before we deploy it.
  // therefore, we can only export from a top-level stack.
  if (producer.nested) {
    const outputValue = createNestedStackOutput(producer, reference);
    return resolveCfnRef({ ...outputValue, consumingStack: reference.consumingStack });
  }

  // ----------------------------------------------------------------------
  // export/import
  // ----------------------------------------------------------------------

  // export the value through a cloudformation "export name" and use an
  // Fn::ImportValue in the consumption site.

  // add a dependency between the producer and the consumer. dependency logic
  // will take care of applying the dependency at the right level (e.g. the
  // top-level stacks).
  reference.consumingStack.addDependency(producer,
    `${reference.consumingStack.node.path} -> ${reference.target.node.path}.${reference.attribute}`);

  return createImportValue(reference);
}

/**
 * Finds all the CloudFormation references in a construct tree.
 */
function findAllReferences(root: IConstruct) {
  const result = new Array<CfnElementRef>();
  for (const source of root.node.findAll()) {

    // include only CfnElements (i.e. resources)
    if (!CfnElement.isCfnElement(source)) {
      continue;
    }

    try {
      const cfnOutput = resolve(source._toCloudFormation(), {
        scope: source,
        prefix: [],
        resolver: CLOUDFORMATION_TOKEN_RESOLVER,
        preparing: true,
      });

      for (const intrinsic of findCdkRefIntrinsics(cfnOutput)) {
        result.push(cdkReferenceFromIntrinsic(Stack.of(source), intrinsic));
      }
    } catch (e) {
      // Note: it might be that the properties of the CFN object aren't valid.
      // This will usually be preventatively caught in a construct's validate()
      // and turned into a nicely descriptive error, but we're running prepare()
      // before validate(). Swallow errors that occur because the CFN layer
      // doesn't validate completely.
      //
      // This does make the assumption that the error will not be rectified,
      // but the error will be thrown later on anyway. If the error doesn't
      // get thrown down the line, we may miss references.
      if (e.type === 'CfnSynthesisError') {
        continue;
      }

      throw e;
    }
  }

  return result;
}

// ------------------------------------------------------------------------------------------------
// export/import
// ------------------------------------------------------------------------------------------------

/**
 * Imports a value from another stack by creating an "Output" with an "ExportName"
 * and returning an "Fn::ImportValue" token.
 */
function createImportValue(reference: CfnElementRef): Intrinsic {
  const exportingStack = Stack.of(reference.target);

  // Ensure a singleton "Exports" scoping Construct
  // This mostly exists to trigger LogicalID munging, which would be
  // disabled if we parented constructs directly under Stack.
  // Also it nicely prevents likely construct name clashes
  const exportsScope = getCreateExportsScope(exportingStack);

  // Ensure a singleton CfnOutput for this value
  const resolved = resolveCfnRef({ ...reference, consumingStack: exportingStack });
  if ('Ref' in resolved && resolved.Ref === undefined) {
    throw new Error('oh no');
  }
  const id = 'Output' + JSON.stringify(resolved);
  const exportName = generateExportName(exportsScope, id);

  if (Token.isUnresolved(exportName)) {
    throw new Error(`unresolved token in generated export name: ${JSON.stringify(exportingStack.resolve(exportName))}`);
  }

  const output = exportsScope.node.tryFindChild(id) as CfnOutput;
  if (!output) {
    new CfnOutput(exportsScope, id, { value: Token.asString(resolved), exportName });
  }

  // We want to return an actual FnImportValue Token here, but Fn.importValue() returns a 'string',
  // so construct one in-place.
  return new Intrinsic({ 'Fn::ImportValue': exportName });
}

function getCreateExportsScope(stack: Stack) {
  const exportsName = 'Exports';
  let stackExports = stack.node.tryFindChild(exportsName) as Construct;
  if (stackExports === undefined) {
    stackExports = new Construct(stack, exportsName);
  }

  return stackExports;
}

function generateExportName(stackExports: Construct, id: string) {
  const stackRelativeExports = FeatureFlags.of(stackExports).isEnabled(cxapi.STACK_RELATIVE_EXPORTS_CONTEXT);
  const stack = Stack.of(stackExports);

  const components = [
    ...stackExports.node.scopes
      .slice(stackRelativeExports ? stack.node.scopes.length : 2)
      .map(c => c.node.id),
    id,
  ];
  const prefix = stack.stackName ? stack.stackName + ':' : '';
  const exportName = prefix + makeUniqueId(components);
  return exportName;
}

// ------------------------------------------------------------------------------------------------
// nested stacks
// ------------------------------------------------------------------------------------------------

/**
 * Adds a CloudFormation parameter to a nested stack and assigns it with the
 * value of the reference.
 */
function createNestedStackParameter(nested: Stack, reference: CfnElementRef, value: any) {
  // we call "this.resolve" to ensure that tokens do not creep in (for example, if the reference display name includes tokens)
  const paramId = nested.resolve(`reference-to-${reference.target.node.uniqueId}.${reference.attribute}`);
  let param = nested.node.tryFindChild(paramId) as CfnParameter;
  if (!param) {
    param = new CfnParameter(nested, paramId, { type: 'String' });

    // Ugly little hack until we move NestedStack to this module.
    if (!('setParameter' in nested)) {
      throw new Error('assertion failed: nested stack should have a "setParameter" method');
    }

    (nested as any).setParameter(param.logicalId, Token.asString(value));
  }

  return { Ref: logicalIdOf(param) };
}

/**
 * Adds a CloudFormation output to a nested stack and returns an "Fn::GetAtt"
 * intrinsic that can be used to reference this output in the parent stack.
 */
function createNestedStackOutput(producer: Stack, reference: CfnElementRef) {
  const outputId = `${reference.target.node.uniqueId}${reference.attribute}`;
  let output = producer.node.tryFindChild(outputId) as CfnOutput;
  if (!output) {
    output = new CfnOutput(producer, outputId, { value: Token.asString({ '$Cdk::Ref': [reference.target.node.path, reference.attribute] }) });
  }

  if (!producer.nestedStackResource) {
    throw new Error('assertion failed');
  }

  return {
    target: producer.nestedStackResource,
    attribute: `Outputs.${logicalIdOf(output)}`,
  };
}

/**
 * @returns true if this stack is a direct or indirect parent of the nested
 * stack `nested`.
 *
 * If `child` is not a nested stack, always returns `false` because it can't
 * have a parent, dah.
 */
function isNested(nested: Stack, parent: Stack): boolean {
  // if the parent is a direct parent
  if (nested.nestedStackParent === parent) {
    return true;
  }

  // we reached a top-level (non-nested) stack without finding the parent
  if (!nested.nestedStackParent) {
    return false;
  }

  // recurse with the child's direct parent
  return isNested(nested.nestedStackParent, parent);
}

interface CdkReferenceIntrinsic {
  readonly ['$Cdk::Ref']: [string, string];
}

interface CfnElementRef {
  readonly consumingStack: Stack;
  readonly target: CfnElement;
  readonly attribute: string;
}

function cdkReferenceFromIntrinsic(consumingStack: Stack, ref: CdkReferenceIntrinsic) {
  const [path, attribute] = ref['$Cdk::Ref'];
  if (typeof path !== 'string' || typeof path !== 'string') {
    throw new Error(`Invalid $Cdk::Reference: ${JSON.stringify(ref)}`);
  }

  const target = childByPath(consumingStack.node.root, path) as CfnElement;
  return { consumingStack, target, attribute };
}

function findCdkRefIntrinsics(template: any): CdkReferenceIntrinsic[] {
  const ret: CdkReferenceIntrinsic[] = [];
  recurse(template);
  return ret;

  function recurse(obj: any) {
    if (Array.isArray(obj)) {
      obj.forEach(recurse);
      return;
    }
    if (typeof obj === 'object' && obj !== null) {
      const keys = Object.keys(obj);

      if (keys.length === 1 && keys[0] === '$Cdk::Ref') {
        // Found one!
        ret.push(obj);
        return;
      }

      for (const key of keys) {
        recurse(obj[key]);
      }
      return;
    }
  }
}

function childByPath(root: IConstruct, path: string): IConstruct {
  const parts = (path.startsWith('/') ? path.substr(1) : path).split('/');

  let next = parts.shift();
  while (next !== undefined) {
    const child = root.node.tryFindChild(next);
    if (!child) {
      throw new Error(`Cannot find node with path: '${path}'`);
    }
    next = parts.shift();
    root = child;
  }

  return root;
}

function renderRefGetAtt(logicalId: string, attribute: string) {
  if (attribute.startsWith('AWS::')) {
    // Pseudo
    return { Ref: attribute };
  } else if (attribute === 'Ref') {
    return { Ref: logicalId };
  } else {
    return { 'Fn::GetAtt': [logicalId, attribute] };
  }
}

/**
 * We need to do additional resolving to get the logical ID, because by default it will return a Token
 */
function logicalIdOf(el: CfnElement) {
  return resolve(el.logicalId, {
    preparing: false,
    scope: el,
    resolver: CLOUDFORMATION_TOKEN_RESOLVER,
  });
}