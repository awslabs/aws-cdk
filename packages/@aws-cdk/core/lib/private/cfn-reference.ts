import { Reference } from '../reference';

const CFN_REFERENCE_SYMBOL = Symbol.for('@aws-cdk/core.CfnReference');

/**
 * An enum that allows controlling how will the created reference
 * be rendered in the resulting CloudFormation template.
 */
export enum ReferenceRendering {
  /**
   * Used for rendering a reference inside Fn::Sub expressions,
   * which mean these must resolve to "${Sth}" instead of { Ref: "Sth" }.
   */
  FN_SUB,

  /**
   * Used for rendering Fn::GetAtt with its arguments in string form
   * (as opposed to the more common arguments in array form, which we render by default).
   */
  GET_ATT_STRING,
}

/**
 * A Token that represents a CloudFormation reference to another resource
 *
 * If these references are used in a different stack from where they are
 * defined, appropriate CloudFormation `Export`s and `Fn::ImportValue`s will be
 * synthesized automatically instead of the regular CloudFormation references.
 *
 * Additionally, the dependency between the stacks will be recorded, and the toolkit
 * will make sure to deploy producing stack before the consuming stack.
 *
 * This magic happens in the prepare() phase, where consuming stacks will call
 * `consumeFromStack` on these Tokens and if they happen to be exported by a different
 * Stack, we'll register the dependency.
 */
export class CfnReference extends Reference {
  /**
   * Check whether this is actually a Reference
   */
  public static isCfnReference(x: IResolvable): x is CfnReference {
    return CFN_REFERENCE_SYMBOL in x;
  }

  /**
   * Return the CfnReference for the indicated target
   *
   * Will make sure that multiple invocations for the same target and intrinsic
   * return the same CfnReference. Because CfnReferences accumulate state in
   * the prepare() phase (for the purpose of cross-stack references), it's
   * important that the state isn't lost if it's lazily created, like so:
   *
   *     Lazy.stringValue({ produce: () => new CfnReference(...) })
   *
   */
  public static for(target: CfnElement, attribute: string, refRender?: ReferenceRendering) {
    return CfnReference.singletonReference(target, attribute, refRender, () => {
      let cfnIntrinsic: any;
      switch (refRender) {
        // The first 2 are only used by cfn-parse, so it's fine if they're round-tripped exactly.
        // They could never reference a cross-stack construct anyway.
        case ReferenceRendering.FN_SUB:
          cfnIntrinsic = '${' + target.logicalId + (attribute === 'Ref' ? '' : `.${attribute}`) + '}';
          break;
        case ReferenceRendering.GET_ATT_STRING:
          cfnIntrinsic = { 'Fn::GetAtt': `${target.logicalId}.${attribute}` };
          break;
        default:
          cfnIntrinsic = { '$Cdk::Ref': [target.node.path, attribute] };
          break;
      }
      return new CfnReference(cfnIntrinsic, attribute, target);
    });
  }

  /**
   * Return a CfnReference that references a scoped pseudo
   */
  public static forPseudo(pseudoName: string, scope: Construct) {
    return CfnReference.singletonReference(scope, `Pseudo:${pseudoName}`, undefined, () => {
      const cfnIntrinsic = { '$Cdk::Ref': [scope.node.path, pseudoName] };
      return new CfnReference(cfnIntrinsic, pseudoName, scope);
    });
  }

  /**
   * Static table where we keep singleton CfnReference instances
   */
  private static referenceTable = new Map<Construct, Map<string, CfnReference>>();

  /**
   * Get or create the table.
   * Passing fnSub = true allows cloudformation-include to correctly handle Fn::Sub.
   */
  private static singletonReference(target: Construct, attribKey: string, refRender: ReferenceRendering | undefined, fresh: () => CfnReference) {
    let attribs = CfnReference.referenceTable.get(target);
    if (!attribs) {
      attribs = new Map();
      CfnReference.referenceTable.set(target, attribs);
    }
    let cacheKey = attribKey;
    switch (refRender) {
      case ReferenceRendering.FN_SUB:
        cacheKey += 'Fn::Sub';
        break;
      case ReferenceRendering.GET_ATT_STRING:
        cacheKey += 'Fn::GetAtt::String';
        break;
    }
    let ref = attribs.get(cacheKey);
    if (!ref) {
      ref = fresh();
      attribs.set(cacheKey, ref);
    }
    return ref;
  }

  protected constructor(value: any, displayName: string, target: IConstruct) {
    // prepend scope path to display name
    super(value, target, displayName);

    Object.defineProperty(this, CFN_REFERENCE_SYMBOL, { value: true });
  }

  /**
   * Implementation of toString() that will use the display name
   */
  public toString(): string {
    return Token.asString(this, {
      displayHint: `${this.target.node.id}.${this.displayName}`,
    });
  }
}

import { CfnElement } from '../cfn-element';
import { Construct, IConstruct } from '../construct-compat';
import { IResolvable } from '../resolvable';
import { Token } from '../token';
