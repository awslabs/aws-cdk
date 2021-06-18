import * as crypto from 'crypto';
import { Construct, Node } from 'constructs';
import { FileAssetPackaging } from './assets';
import { Fn } from './cfn-fn';
import { Aws } from './cfn-pseudo';
import { CfnResource } from './cfn-resource';
import { CfnStack } from './cloudformation.generated';
import { Duration } from './duration';
import { Lazy } from './lazy';
import { Names } from './names';
import { RemovalPolicy } from './removal-policy';
import { IResolveContext } from './resolvable';
import { Stack } from './stack';
import { NestedStackSynthesizer } from './stack-synthesizers';
import { Token } from './token';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from './construct-compat';

const NESTED_STACK_SYMBOL = Symbol.for('@aws-cdk/core.NestedStack');

/**
 * Initialization props for the `NestedStack` construct.
 *
 */
export interface NestedStackProps {
  /**
   * The set value pairs that represent the parameters passed to CloudFormation
   * when this nested stack is created. Each parameter has a name corresponding
   * to a parameter defined in the embedded template and a value representing
   * the value that you want to set for the parameter.
   *
   * The nested stack construct will automatically synthesize parameters in order
   * to bind references from the parent stack(s) into the nested stack.
   *
   * @default - no user-defined parameters are passed to the nested stack
   */
  readonly parameters?: { [key: string]: string };

  /**
   * The length of time that CloudFormation waits for the nested stack to reach
   * the CREATE_COMPLETE state.
   *
   * When CloudFormation detects that the nested stack has reached the
   * CREATE_COMPLETE state, it marks the nested stack resource as
   * CREATE_COMPLETE in the parent stack and resumes creating the parent stack.
   * If the timeout period expires before the nested stack reaches
   * CREATE_COMPLETE, CloudFormation marks the nested stack as failed and rolls
   * back both the nested stack and parent stack.
   *
   * @default - no timeout
   */
  readonly timeout?: Duration;

  /**
   * The Simple Notification Service (SNS) topics to publish stack related
   * events.
   *
   * @default - notifications are not sent for this stack.
   */
  readonly notificationArns?: string[];

  /**
   * Policy to apply when the nested stack is removed
   *
   * The default is `Destroy`, because all Removal Policies of resources inside the
   * Nested Stack should already have been set correctly. You normally should
   * not need to set this value.
   *
   * @default RemovalPolicy.DESTROY
   */
  readonly removalPolicy?: RemovalPolicy;
}

/**
 * A CloudFormation nested stack.
 *
 * When you apply template changes to update a top-level stack, CloudFormation
 * updates the top-level stack and initiates an update to its nested stacks.
 * CloudFormation updates the resources of modified nested stacks, but does not
 * update the resources of unmodified nested stacks.
 *
 * Furthermore, this stack will not be treated as an independent deployment
 * artifact (won't be listed in "cdk list" or deployable through "cdk deploy"),
 * but rather only synthesized as a template and uploaded as an asset to S3.
 *
 * Cross references of resource attributes between the parent stack and the
 * nested stack will automatically be translated to stack parameters and
 * outputs.
 *
 */
export class NestedStack extends Stack {
  /**
   * Checks if `x` is an object of type `NestedStack`.
   */
  public static isNestedStack(x: any): x is NestedStack {
    return x != null && typeof(x) === 'object' && NESTED_STACK_SYMBOL in x;
  }

  public readonly templateFile: string;
  public readonly nestedStackResource?: CfnResource;

  private readonly parameters: { [name: string]: string };
  private readonly resource: CfnStack;
  private readonly _contextualStackId: string;
  private readonly _contextualStackName: string;
  private _templateUrl?: string;
  private _parentStack: Stack;

  constructor(scope: Construct, id: string, props: NestedStackProps = { }) {
    const parentStack = findParentStack(scope);

    super(scope, id, {
      env: { account: parentStack.account, region: parentStack.region },
      synthesizer: new NestedStackSynthesizer(parentStack.synthesizer),
    });

    this._parentStack = parentStack;

    // @deprecate: remove this in v2.0 (redundent)
    const parentScope = new CoreConstruct(scope, id + '.NestedStack');

    Object.defineProperty(this, NESTED_STACK_SYMBOL, { value: true });

    // this is the file name of the synthesized template file within the cloud assembly
    this.templateFile = `${Names.uniqueId(this)}.nested.template.json`;

    this.parameters = props.parameters || {};

    this.resource = new CfnStack(parentScope, `${id}.NestedStackResource`, {
      // This value cannot be cached since it changes during the synthesis phase
      templateUrl: Lazy.uncachedString({ produce: () => this._templateUrl || '<unresolved>' }),
      parameters: Lazy.any({ produce: () => Object.keys(this.parameters).length > 0 ? this.parameters : undefined }),
      notificationArns: props.notificationArns,
      timeoutInMinutes: props.timeout ? props.timeout.toMinutes() : undefined,
    });
    this.resource.applyRemovalPolicy(props.removalPolicy ?? RemovalPolicy.DESTROY);

    this.nestedStackResource = this.resource;

    // context-aware stack name: if resolved from within this stack, return AWS::StackName
    // if resolved from the outer stack, use the { Ref } of the AWS::CloudFormation::Stack resource
    // which resolves the ARN of the stack. We need to extract the stack name, which is the second
    // component after splitting by "/"
    this._contextualStackName = this.contextualAttribute(Aws.STACK_NAME, Fn.select(1, Fn.split('/', this.resource.ref)));
    this._contextualStackId = this.contextualAttribute(Aws.STACK_ID, this.resource.ref);
  }

  /**
   * An attribute that represents the name of the nested stack.
   *
   * This is a context aware attribute:
   * - If this is referenced from the parent stack, it will return a token that parses the name from the stack ID.
   * - If this is referenced from the context of the nested stack, it will return `{ "Ref": "AWS::StackName" }`
   *
   * @attribute
   * @example mystack-mynestedstack-sggfrhxhum7w
   */
  public get stackName() {
    return this._contextualStackName;
  }

  /**
   * An attribute that represents the ID of the stack.
   *
   * This is a context aware attribute:
   * - If this is referenced from the parent stack, it will return `{ "Ref": "LogicalIdOfNestedStackResource" }`.
   * - If this is referenced from the context of the nested stack, it will return `{ "Ref": "AWS::StackId" }`
   *
   * @attribute
   * @example "arn:aws:cloudformation:us-east-2:123456789012:stack/mystack-mynestedstack-sggfrhxhum7w/f449b250-b969-11e0-a185-5081d0136786"
   */
  public get stackId() {
    return this._contextualStackId;
  }

  /**
   * Assign a value to one of the nested stack parameters.
   * @param name The parameter name (ID)
   * @param value The value to assign
   */
  public setParameter(name: string, value: string) {
    this.parameters[name] = value;
  }

  /**
   * Defines an asset at the parent stack which represents the template of this
   * nested stack.
   *
   * This private API is used by `App.prepare()` within a loop that rectifies
   * references every time an asset is added. This is because (at the moment)
   * assets are addressed using CloudFormation parameters.
   *
   * @returns `true` if a new asset was added or `false` if an asset was
   * previously added. When this returns `true`, App will do another reference
   * rectification cycle.
   *
   * @internal
   */
  public _prepareTemplateAsset() {
    if (this._templateUrl) {
      return false;
    }

    const cfn = JSON.stringify(this._toCloudFormation());
    const templateHash = crypto.createHash('sha256').update(cfn).digest('hex');

    const templateLocation = this._parentStack.addFileAsset({
      packaging: FileAssetPackaging.FILE,
      sourceHash: templateHash,
      fileName: this.templateFile,
    });

    // if bucketName/objectKey are cfn parameters from a stack other than the parent stack, they will
    // be resolved as cross-stack references like any other (see "multi" tests).
    this._templateUrl = `https://s3.${this._parentStack.region}.${this._parentStack.urlSuffix}/${templateLocation.bucketName}/${templateLocation.objectKey}`;
    return true;
  }

  private contextualAttribute(innerValue: string, outerValue: string) {
    return Token.asString({
      resolve: (context: IResolveContext) => {
        if (Stack.of(context.scope) === this) {
          return innerValue;
        } else {
          return outerValue;
        }
      },
    });
  }
}

/**
 * Validates the scope for a nested stack. Nested stacks must be defined within the scope of another `Stack`.
 */
function findParentStack(scope: Construct): Stack {
  if (!scope) {
    throw new Error('Nested stacks cannot be defined as a root construct');
  }

  const parentStack = Node.of(scope).scopes.reverse().find(p => Stack.isStack(p));
  if (!parentStack) {
    throw new Error('Nested stacks must be defined within scope of another non-nested stack');
  }

  return parentStack as Stack;
}
