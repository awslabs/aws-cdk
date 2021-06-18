// ----------------------------------------------------
// CROSS REFERENCES
// ----------------------------------------------------

import { CfnElement } from '../cfn-element';
import { CfnOutput } from '../cfn-output';
import { CfnParameter } from '../cfn-parameter';
import { IConstruct } from '../construct-compat';
import { Names } from '../names';
import { Reference } from '../reference';
import { IResolvable } from '../resolvable';
import { Stack } from '../stack';
import { Token, Tokenization } from '../token';
import { CfnReference } from './cfn-reference';
import { Intrinsic } from './intrinsic';
import { findTokens } from './resolve';

/**
 * This is called from the App level to resolve all references defined. Each
 * reference is resolved based on it's consumption context.
 */
export function resolveReferences(scope: IConstruct): void {
  const edges = findAllReferences(scope);

  for (const { source, value } of edges) {
    const consumer = Stack.of(source);

    // resolve the value in the context of the consumer
    if (!value.hasValueForStack(consumer)) {
      const resolved = resolveValue(consumer, value);
      value.assignValueForStack(consumer, resolved);
    }
  }
}

/**
 * Resolves the value for `reference` in the context of `consumer`.
 */
function resolveValue(consumer: Stack, reference: CfnReference): IResolvable {
  const producer = Stack.of(reference.target);

  // produce and consumer stacks are the same, we can just return the value itself.
  if (producer === consumer) {
    return reference;
  }

  // unsupported: stacks from different apps
  if (producer.node.root !== consumer.node.root) {
    throw new Error('Cannot reference across apps. Consuming and producing stacks must be defined within the same CDK app.');
  }

  // unsupported: stacks are not in the same environment
  if (producer.environment !== consumer.environment) {
    throw new Error(
      `Stack "${consumer.node.path}" cannot consume a cross reference from stack "${producer.node.path}". ` +
      'Cross stack references are only supported for stacks deployed to the same environment or between nested stacks and their parent stack');
  }

  // ----------------------------------------------------------------------
  // consumer is nested in the producer (directly or indirectly)
  // ----------------------------------------------------------------------

  // if the consumer is nested within the producer (directly or indirectly),
  // wire through a CloudFormation parameter and then resolve the reference with
  // the parent stack as the consumer.
  if (consumer.nestedStackParent && isNested(consumer, producer)) {
    const parameterValue = resolveValue(consumer.nestedStackParent, reference);
    return createNestedStackParameter(consumer, reference, parameterValue);
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
    return resolveValue(consumer, outputValue);
  }

  // ----------------------------------------------------------------------
  // export/import
  // ----------------------------------------------------------------------

  // export the value through a cloudformation "export name" and use an
  // Fn::ImportValue in the consumption site.

  // add a dependency between the producer and the consumer. dependency logic
  // will take care of applying the dependency at the right level (e.g. the
  // top-level stacks).
  consumer.addDependency(producer,
    `${consumer.node.path} -> ${reference.target.node.path}.${reference.displayName}`);

  return createImportValue(reference);
}

/**
 * Finds all the CloudFormation references in a construct tree.
 */
function findAllReferences(root: IConstruct) {
  const result = new Array<{ source: CfnElement, value: CfnReference }>();
  for (const consumer of root.node.findAll()) {
    // include only CfnElements (i.e. resources)
    if (!CfnElement.isCfnElement(consumer)) {
      continue;
    }

    try {
      const tokens = findTokens(consumer, () => consumer._toCloudFormation());

      // iterate over all the tokens (e.g. intrinsic functions, lazies, etc) that
      // were found in the cloudformation representation of this resource.
      for (const token of tokens) {
        // include only CfnReferences (i.e. "Ref" and "Fn::GetAtt")
        if (!CfnReference.isCfnReference(token)) {
          continue;
        }

        result.push({
          source: consumer,
          value: token,
        });
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
function createImportValue(reference: Reference): Intrinsic {
  const exportingStack = Stack.of(reference.target);

  const importExpr = exportingStack.exportValue(reference);

  // I happen to know this returns a Fn.importValue() which implements Intrinsic.
  return Tokenization.reverseCompleteString(importExpr) as Intrinsic;
}

// ------------------------------------------------------------------------------------------------
// nested stacks
// ------------------------------------------------------------------------------------------------

/**
 * Adds a CloudFormation parameter to a nested stack and assigns it with the
 * value of the reference.
 */
function createNestedStackParameter(nested: Stack, reference: CfnReference, value: IResolvable) {
  // we call "this.resolve" to ensure that tokens do not creep in (for example, if the reference display name includes tokens)
  const paramId = nested.resolve(`reference-to-${ Names.nodeUniqueId(reference.target.node)}.${reference.displayName}`);
  let param = nested.node.tryFindChild(paramId) as CfnParameter;
  if (!param) {
    param = new CfnParameter(nested, paramId, { type: 'String' });

    // Ugly little hack until we move NestedStack to this module.
    if (!('setParameter' in nested)) {
      throw new Error('assertion failed: nested stack should have a "setParameter" method');
    }

    (nested as any).setParameter(param.logicalId, Token.asString(value));
  }

  return param.value as CfnReference;
}

/**
 * Adds a CloudFormation output to a nested stack and returns an "Fn::GetAtt"
 * intrinsic that can be used to reference this output in the parent stack.
 */
function createNestedStackOutput(producer: Stack, reference: Reference): CfnReference {
  const outputId = `${Names.nodeUniqueId(reference.target.node)}${reference.displayName}`;
  let output = producer.node.tryFindChild(outputId) as CfnOutput;
  if (!output) {
    output = new CfnOutput(producer, outputId, { value: Token.asString(reference) });
  }

  if (!producer.nestedStackResource) {
    throw new Error('assertion failed');
  }

  return producer.nestedStackResource.getAtt(`Outputs.${output.logicalId}`) as CfnReference;
}

/**
 * Translate a Reference into a nested stack into a value in the parent stack
 *
 * Will create Outputs along the chain of Nested Stacks, and return the final `{ Fn::GetAtt }`.
 */
export function referenceNestedStackValueInParent(reference: Reference, targetStack: Stack) {
  let currentStack = Stack.of(reference.target);
  if (currentStack !== targetStack && !isNested(currentStack, targetStack)) {
    throw new Error(`Referenced resource must be in stack '${targetStack.node.path}', got '${reference.target.node.path}'`);
  }

  while (currentStack !== targetStack) {
    reference = createNestedStackOutput(Stack.of(reference.target), reference);
    currentStack = Stack.of(reference.target);
  }

  return reference;
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