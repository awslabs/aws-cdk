import * as fs from 'fs';
import * as path from 'path';
import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import * as cxapi from '@aws-cdk/cx-api';
import { IConstruct, Construct, Node } from 'constructs';
import { Annotations } from './annotations';
import { App } from './app';
import { Arn, ArnComponents } from './arn';
import { DockerImageAssetLocation, DockerImageAssetSource, FileAssetLocation, FileAssetSource } from './assets';
import { CfnElement } from './cfn-element';
import { Fn } from './cfn-fn';
import { Aws, ScopedAws } from './cfn-pseudo';
import { CfnResource, TagType } from './cfn-resource';
import { ISynthesisSession } from './construct-compat';
import { ContextProvider } from './context-provider';
import { Environment } from './environment';
import { FeatureFlags } from './feature-flags';
import { CLOUDFORMATION_TOKEN_RESOLVER, CloudFormationLang } from './private/cloudformation-lang';
import { LogicalIDs } from './private/logical-id';
import { resolve } from './private/resolve';
import { makeUniqueId } from './private/uniqueid';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from './construct-compat';

const STACK_SYMBOL = Symbol.for('@aws-cdk/core.Stack');
const MY_STACK_CACHE = Symbol.for('@aws-cdk/core.Stack.myStack');

export const STACK_RESOURCE_LIMIT_CONTEXT = '@aws-cdk/core:stackResourceLimit';

const VALID_STACK_NAME_REGEX = /^[A-Za-z][A-Za-z0-9-]*$/;

const MAX_RESOURCES = 500;

export interface StackProps {
  /**
   * A description of the stack.
   *
   * @default - No description.
   */
  readonly description?: string;

  /**
   * The AWS environment (account/region) where this stack will be deployed.
   *
   * Set the `region`/`account` fields of `env` to either a concrete value to
   * select the indicated environment (recommended for production stacks), or to
   * the values of environment variables
   * `CDK_DEFAULT_REGION`/`CDK_DEFAULT_ACCOUNT` to let the target environment
   * depend on the AWS credentials/configuration that the CDK CLI is executed
   * under (recommended for development stacks).
   *
   * If the `Stack` is instantiated inside a `Stage`, any undefined
   * `region`/`account` fields from `env` will default to the same field on the
   * encompassing `Stage`, if configured there.
   *
   * If either `region` or `account` are not set nor inherited from `Stage`, the
   * Stack will be considered "*environment-agnostic*"". Environment-agnostic
   * stacks can be deployed to any environment but may not be able to take
   * advantage of all features of the CDK. For example, they will not be able to
   * use environmental context lookups such as `ec2.Vpc.fromLookup` and will not
   * automatically translate Service Principals to the right format based on the
   * environment's AWS partition, and other such enhancements.
   *
   * @example
   *
   * // Use a concrete account and region to deploy this stack to:
   * // `.account` and `.region` will simply return these values.
   * new Stack(app, 'Stack1', {
   *   env: {
   *     account: '123456789012',
   *     region: 'us-east-1'
   *   },
   * });
   *
   * // Use the CLI's current credentials to determine the target environment:
   * // `.account` and `.region` will reflect the account+region the CLI
   * // is configured to use (based on the user CLI credentials)
   * new Stack(app, 'Stack2', {
   *   env: {
   *     account: process.env.CDK_DEFAULT_ACCOUNT,
   *     region: process.env.CDK_DEFAULT_REGION
   *   },
   * });
   *
   * // Define multiple stacks stage associated with an environment
   * const myStage = new Stage(app, 'MyStage', {
   *   env: {
   *     account: '123456789012',
   *     region: 'us-east-1'
   *   }
   * });
   *
   * // both of these stacks will use the stage's account/region:
   * // `.account` and `.region` will resolve to the concrete values as above
   * new MyStack(myStage, 'Stack1');
   * new YourStack(myStage, 'Stack2');
   *
   * // Define an environment-agnostic stack:
   * // `.account` and `.region` will resolve to `{ "Ref": "AWS::AccountId" }` and `{ "Ref": "AWS::Region" }` respectively.
   * // which will only resolve to actual values by CloudFormation during deployment.
   * new MyStack(app, 'Stack1');
   *
   * @default - The environment of the containing `Stage` if available,
   * otherwise create the stack will be environment-agnostic.
   */
  readonly env?: Environment;

  /**
   * Name to deploy the stack with
   *
   * @default - Derived from construct path.
   */
  readonly stackName?: string;

  /**
   * Stack tags that will be applied to all the taggable resources and the stack itself.
   *
   * @default {}
   */
  readonly tags?: { [key: string]: string };

  /**
   * Synthesis method to use while deploying this stack
   *
   * @default - `DefaultStackSynthesizer` if the `@aws-cdk/core:newStyleStackSynthesis` feature flag
   * is set, `LegacyStackSynthesizer` otherwise.
   */
  readonly synthesizer?: IStackSynthesizer;

  /**
   * Whether to enable termination protection for this stack.
   *
   * @default false
   */
  readonly terminationProtection?: boolean;

  /**
   * Include runtime versioning information in this Stack
   *
   * @default `analyticsReporting` setting of containing `App`, or value of
   * 'aws:cdk:version-reporting' context key
   */
  readonly analyticsReporting?: boolean;
}

/**
 * A root construct which represents a single CloudFormation stack.
 */
export class Stack extends CoreConstruct implements ITaggable {
  /**
   * Return whether the given object is a Stack.
   *
   * We do attribute detection since we can't reliably use 'instanceof'.
   */
  public static isStack(x: any): x is Stack {
    return x !== null && typeof(x) === 'object' && STACK_SYMBOL in x;
  }

  /**
   * Looks up the first stack scope in which `construct` is defined. Fails if there is no stack up the tree.
   * @param construct The construct to start the search from.
   */
  public static of(construct: IConstruct): Stack {
    // we want this to be as cheap as possible. cache this result by mutating
    // the object. anecdotally, at the time of this writing, @aws-cdk/core unit
    // tests hit this cache 1,112 times, @aws-cdk/aws-cloudformation unit tests
    // hit this 2,435 times).
    const cache = (construct as any)[MY_STACK_CACHE] as Stack | undefined;
    if (cache) {
      return cache;
    } else {
      const value = _lookup(construct);
      Object.defineProperty(construct, MY_STACK_CACHE, {
        enumerable: false,
        writable: false,
        configurable: false,
        value,
      });
      return value;
    }

    function _lookup(c: IConstruct): Stack {
      if (Stack.isStack(c)) {
        return c;
      }

      const _scope = Node.of(c).scope;
      if (Stage.isStage(c) || !_scope) {
        throw new Error(`${construct.constructor?.name ?? 'Construct'} at '${Node.of(construct).path}' should be created in the scope of a Stack, but no Stack found`);
      }

      return _lookup(_scope);
    }
  }

  /**
   * Tags to be applied to the stack.
   */
  public readonly tags: TagManager;

  /**
   * Options for CloudFormation template (like version, transform, description).
   */
  public readonly templateOptions: ITemplateOptions;

  /**
   * The AWS region into which this stack will be deployed (e.g. `us-west-2`).
   *
   * This value is resolved according to the following rules:
   *
   * 1. The value provided to `env.region` when the stack is defined. This can
   *    either be a concerete region (e.g. `us-west-2`) or the `Aws.region`
   *    token.
   * 3. `Aws.region`, which is represents the CloudFormation intrinsic reference
   *    `{ "Ref": "AWS::Region" }` encoded as a string token.
   *
   * Preferably, you should use the return value as an opaque string and not
   * attempt to parse it to implement your logic. If you do, you must first
   * check that it is a concerete value an not an unresolved token. If this
   * value is an unresolved token (`Token.isUnresolved(stack.region)` returns
   * `true`), this implies that the user wishes that this stack will synthesize
   * into a **region-agnostic template**. In this case, your code should either
   * fail (throw an error, emit a synth error using `Annotations.of(construct).addError()`) or
   * implement some other region-agnostic behavior.
   */
  public readonly region: string;

  /**
   * The AWS account into which this stack will be deployed.
   *
   * This value is resolved according to the following rules:
   *
   * 1. The value provided to `env.account` when the stack is defined. This can
   *    either be a concerete account (e.g. `585695031111`) or the
   *    `Aws.accountId` token.
   * 3. `Aws.accountId`, which represents the CloudFormation intrinsic reference
   *    `{ "Ref": "AWS::AccountId" }` encoded as a string token.
   *
   * Preferably, you should use the return value as an opaque string and not
   * attempt to parse it to implement your logic. If you do, you must first
   * check that it is a concerete value an not an unresolved token. If this
   * value is an unresolved token (`Token.isUnresolved(stack.account)` returns
   * `true`), this implies that the user wishes that this stack will synthesize
   * into a **account-agnostic template**. In this case, your code should either
   * fail (throw an error, emit a synth error using `Annotations.of(construct).addError()`) or
   * implement some other region-agnostic behavior.
   */
  public readonly account: string;

  /**
   * The environment coordinates in which this stack is deployed. In the form
   * `aws://account/region`. Use `stack.account` and `stack.region` to obtain
   * the specific values, no need to parse.
   *
   * You can use this value to determine if two stacks are targeting the same
   * environment.
   *
   * If either `stack.account` or `stack.region` are not concrete values (e.g.
   * `Aws.account` or `Aws.region`) the special strings `unknown-account` and/or
   * `unknown-region` will be used respectively to indicate this stack is
   * region/account-agnostic.
   */
  public readonly environment: string;

  /**
   * Whether termination protection is enabled for this stack.
   */
  public readonly terminationProtection?: boolean;

  /**
   * If this is a nested stack, this represents its `AWS::CloudFormation::Stack`
   * resource. `undefined` for top-level (non-nested) stacks.
   *
   * @experimental
   */
  public readonly nestedStackResource?: CfnResource;

  /**
   * The name of the CloudFormation template file emitted to the output
   * directory during synthesis.
   *
   * @example 'MyStack.template.json'
   */
  public readonly templateFile: string;

  /**
   * The ID of the cloud assembly artifact for this stack.
   */
  public readonly artifactId: string;

  /**
   * Synthesis method for this stack
   *
   * @experimental
   */
  public readonly synthesizer: IStackSynthesizer;

  /**
   * Whether version reporting is enabled for this stack
   *
   * Controls whether the CDK Metadata resource is injected
   *
   * @internal
   */
  public readonly _versionReportingEnabled: boolean;

  /**
   * Logical ID generation strategy
   */
  private readonly _logicalIds: LogicalIDs;

  /**
   * Other stacks this stack depends on
   */
  private readonly _stackDependencies: { [uniqueId: string]: StackDependency };

  /**
   * Lists all missing contextual information.
   * This is returned when the stack is synthesized under the 'missing' attribute
   * and allows tooling to obtain the context and re-synthesize.
   */
  private readonly _missingContext: cxschema.MissingContext[];

  private readonly _stackName: string;

  /**
   * Creates a new stack.
   *
   * @param scope Parent of this stack, usually an `App` or a `Stage`, but could be any construct.
   * @param id The construct ID of this stack. If `stackName` is not explicitly
   * defined, this id (and any parent IDs) will be used to determine the
   * physical ID of the stack.
   * @param props Stack properties.
   */
  public constructor(scope?: Construct, id?: string, props: StackProps = {}) {
    // For unit test scope and id are optional for stacks, but we still want an App
    // as the parent because apps implement much of the synthesis logic.
    scope = scope ?? new App({
      autoSynth: false,
      outdir: FileSystem.mkdtemp('cdk-test-app-'),
    });

    // "Default" is a "hidden id" from a `node.uniqueId` perspective
    id = id ?? 'Default';

    super(scope, id);

    this._missingContext = new Array<cxschema.MissingContext>();
    this._stackDependencies = { };
    this.templateOptions = { };

    Object.defineProperty(this, STACK_SYMBOL, { value: true });

    this._logicalIds = new LogicalIDs();

    const { account, region, environment } = this.parseEnvironment(props.env);

    this.account = account;
    this.region = region;
    this.environment = environment;
    this.terminationProtection = props.terminationProtection;

    if (props.description !== undefined) {
      // Max length 1024 bytes
      // Typically 2 bytes per character, may be more for more exotic characters
      if (props.description.length > 512) {
        throw new Error(`Stack description must be <= 1024 bytes. Received description: '${props.description}'`);
      }
      this.templateOptions.description = props.description;
    }

    this._stackName = props.stackName ?? this.generateStackName();
    this.tags = new TagManager(TagType.KEY_VALUE, 'aws:cdk:stack', props.tags);

    if (!VALID_STACK_NAME_REGEX.test(this.stackName)) {
      throw new Error(`Stack name must match the regular expression: ${VALID_STACK_NAME_REGEX.toString()}, got '${this.stackName}'`);
    }

    // the preferred behavior is to generate a unique id for this stack and use
    // it as the artifact ID in the assembly. this allows multiple stacks to use
    // the same name. however, this behavior is breaking for 1.x so it's only
    // applied under a feature flag which is applied automatically for new
    // projects created using `cdk init`.
    //
    // Also use the new behavior if we are using the new CI/CD-ready synthesizer; that way
    // people only have to flip one flag.
    const featureFlags = FeatureFlags.of(this);
    const stackNameDupeContext = featureFlags.isEnabled(cxapi.ENABLE_STACK_NAME_DUPLICATES_CONTEXT);
    const newStyleSynthesisContext = featureFlags.isEnabled(cxapi.NEW_STYLE_STACK_SYNTHESIS_CONTEXT);
    this.artifactId = (stackNameDupeContext || newStyleSynthesisContext)
      ? this.generateStackArtifactId()
      : this.stackName;

    this.templateFile = `${this.artifactId}.template.json`;

    // Not for nested stacks
    this._versionReportingEnabled = (props.analyticsReporting ?? this.node.tryGetContext(cxapi.ANALYTICS_REPORTING_ENABLED_CONTEXT))
      && !this.nestedStackParent;

    this.synthesizer = props.synthesizer ?? (newStyleSynthesisContext
      ? new DefaultStackSynthesizer()
      : new LegacyStackSynthesizer());
    this.synthesizer.bind(this);
  }

  /**
   * Resolve a tokenized value in the context of the current stack.
   */
  public resolve(obj: any): any {
    return resolve(obj, {
      scope: this,
      prefix: [],
      resolver: CLOUDFORMATION_TOKEN_RESOLVER,
      preparing: false,
    });
  }

  /**
   * Convert an object, potentially containing tokens, to a JSON string
   */
  public toJsonString(obj: any, space?: number): string {
    return CloudFormationLang.toJSON(obj, space).toString();
  }

  /**
   * DEPRECATED
   * @deprecated use `reportMissingContextKey()`
   */
  public reportMissingContext(report: cxapi.MissingContext) {
    if (!Object.values(cxschema.ContextProvider).includes(report.provider as cxschema.ContextProvider)) {
      throw new Error(`Unknown context provider requested in: ${JSON.stringify(report)}`);
    }
    this.reportMissingContextKey(report as cxschema.MissingContext);
  }

  /**
   * Indicate that a context key was expected
   *
   * Contains instructions which will be emitted into the cloud assembly on how
   * the key should be supplied.
   *
   * @param report The set of parameters needed to obtain the context
   */
  public reportMissingContextKey(report: cxschema.MissingContext) {
    this._missingContext.push(report);
  }

  /**
   * Rename a generated logical identities
   *
   * To modify the naming scheme strategy, extend the `Stack` class and
   * override the `allocateLogicalId` method.
   */
  public renameLogicalId(oldId: string, newId: string) {
    this._logicalIds.addRename(oldId, newId);
  }

  /**
   * Allocates a stack-unique CloudFormation-compatible logical identity for a
   * specific resource.
   *
   * This method is called when a `CfnElement` is created and used to render the
   * initial logical identity of resources. Logical ID renames are applied at
   * this stage.
   *
   * This method uses the protected method `allocateLogicalId` to render the
   * logical ID for an element. To modify the naming scheme, extend the `Stack`
   * class and override this method.
   *
   * @param element The CloudFormation element for which a logical identity is
   * needed.
   */
  public getLogicalId(element: CfnElement): string {
    const logicalId = this.allocateLogicalId(element);
    return this._logicalIds.applyRename(logicalId);
  }

  /**
   * Add a dependency between this stack and another stack.
   *
   * This can be used to define dependencies between any two stacks within an
   * app, and also supports nested stacks.
   */
  public addDependency(target: Stack, reason?: string) {
    addDependency(this, target, reason);
  }

  /**
   * Return the stacks this stack depends on
   */
  public get dependencies(): Stack[] {
    return Object.values(this._stackDependencies).map(x => x.stack);
  }

  /**
   * The concrete CloudFormation physical stack name.
   *
   * This is either the name defined explicitly in the `stackName` prop or
   * allocated based on the stack's location in the construct tree. Stacks that
   * are directly defined under the app use their construct `id` as their stack
   * name. Stacks that are defined deeper within the tree will use a hashed naming
   * scheme based on the construct path to ensure uniqueness.
   *
   * If you wish to obtain the deploy-time AWS::StackName intrinsic,
   * you can use `Aws.stackName` directly.
   */
  public get stackName(): string {
    return this._stackName;
  }

  /**
   * The partition in which this stack is defined
   */
  public get partition(): string {
    // Always return a non-scoped partition intrinsic. These will usually
    // be used to construct an ARN, but there are no cross-partition
    // calls anyway.
    return Aws.PARTITION;
  }

  /**
   * The Amazon domain suffix for the region in which this stack is defined
   */
  public get urlSuffix(): string {
    // Since URL Suffix always follows partition, it is unscoped like partition is.
    return Aws.URL_SUFFIX;
  }

  /**
   * The ID of the stack
   *
   * @example
   * // After resolving, looks like
   * 'arn:aws:cloudformation:us-west-2:123456789012:stack/teststack/51af3dc0-da77-11e4-872e-1234567db123'
   */
  public get stackId(): string {
    return new ScopedAws(this).stackId;
  }

  /**
   * Returns the list of notification Amazon Resource Names (ARNs) for the current stack.
   */
  public get notificationArns(): string[] {
    return new ScopedAws(this).notificationArns;
  }

  /**
   * Indicates if this is a nested stack, in which case `parentStack` will include a reference to it's parent.
   */
  public get nested(): boolean {
    return this.nestedStackResource !== undefined;
  }

  /**
   * Creates an ARN from components.
   *
   * If `partition`, `region` or `account` are not specified, the stack's
   * partition, region and account will be used.
   *
   * If any component is the empty string, an empty string will be inserted
   * into the generated ARN at the location that component corresponds to.
   *
   * The ARN will be formatted as follows:
   *
   *   arn:{partition}:{service}:{region}:{account}:{resource}{sep}}{resource-name}
   *
   * The required ARN pieces that are omitted will be taken from the stack that
   * the 'scope' is attached to. If all ARN pieces are supplied, the supplied scope
   * can be 'undefined'.
   */
  public formatArn(components: ArnComponents): string {
    return Arn.format(components, this);
  }

  /**
   * Given an ARN, parses it and returns components.
   *
   * IF THE ARN IS A CONCRETE STRING...
   *
   * ...it will be parsed and validated. The separator (`sep`) will be set to '/'
   * if the 6th component includes a '/', in which case, `resource` will be set
   * to the value before the '/' and `resourceName` will be the rest. In case
   * there is no '/', `resource` will be set to the 6th components and
   * `resourceName` will be set to the rest of the string.
   *
   * IF THE ARN IS A TOKEN...
   *
   * ...it cannot be validated, since we don't have the actual value yet at the
   * time of this function call. You will have to supply `sepIfToken` and
   * whether or not ARNs of the expected format usually have resource names
   * in order to parse it properly. The resulting `ArnComponents` object will
   * contain tokens for the subexpressions of the ARN, not string literals.
   *
   * If the resource name could possibly contain the separator char, the actual
   * resource name cannot be properly parsed. This only occurs if the separator
   * char is '/', and happens for example for S3 object ARNs, IAM Role ARNs,
   * IAM OIDC Provider ARNs, etc. To properly extract the resource name from a
   * Tokenized ARN, you must know the resource type and call
   * `Arn.extractResourceName`.
   *
   * @param arn The ARN string to parse
   * @param sepIfToken The separator used to separate resource from resourceName
   * @param hasName Whether there is a name component in the ARN at all. For
   * example, SNS Topics ARNs have the 'resource' component contain the topic
   * name, and no 'resourceName' component.
   *
   * @returns an ArnComponents object which allows access to the various
   * components of the ARN.
   *
   * @returns an ArnComponents object which allows access to the various
   *      components of the ARN.
   */
  public parseArn(arn: string, sepIfToken: string = '/', hasName: boolean = true): ArnComponents {
    return Arn.parse(arn, sepIfToken, hasName);
  }

  /**
   * Returns the list of AZs that are available in the AWS environment
   * (account/region) associated with this stack.
   *
   * If the stack is environment-agnostic (either account and/or region are
   * tokens), this property will return an array with 2 tokens that will resolve
   * at deploy-time to the first two availability zones returned from CloudFormation's
   * `Fn::GetAZs` intrinsic function.
   *
   * If they are not available in the context, returns a set of dummy values and
   * reports them as missing, and let the CLI resolve them by calling EC2
   * `DescribeAvailabilityZones` on the target environment.
   *
   * To specify a different strategy for selecting availability zones override this method.
   */
  public get availabilityZones(): string[] {
    // if account/region are tokens, we can't obtain AZs through the context
    // provider, so we fallback to use Fn::GetAZs. the current lowest common
    // denominator is 2 AZs across all AWS regions.
    const agnostic = Token.isUnresolved(this.account) || Token.isUnresolved(this.region);
    if (agnostic) {
      return this.node.tryGetContext(cxapi.AVAILABILITY_ZONE_FALLBACK_CONTEXT_KEY) || [
        Fn.select(0, Fn.getAzs()),
        Fn.select(1, Fn.getAzs()),
      ];
    }

    const value = ContextProvider.getValue(this, {
      provider: cxschema.ContextProvider.AVAILABILITY_ZONE_PROVIDER,
      dummyValue: ['dummy1a', 'dummy1b', 'dummy1c'],
    }).value;

    if (!Array.isArray(value)) {
      throw new Error(`Provider ${cxschema.ContextProvider.AVAILABILITY_ZONE_PROVIDER} expects a list`);
    }

    return value;
  }

  /**
   * Register a file asset on this Stack
   *
   * @deprecated Use `stack.synthesizer.addFileAsset()` if you are calling,
   * and a different IStackSynthesizer class if you are implementing.
   */
  public addFileAsset(asset: FileAssetSource): FileAssetLocation {
    return this.synthesizer.addFileAsset(asset);
  }

  /**
   * Register a docker image asset on this Stack
   *
   * @deprecated Use `stack.synthesizer.addDockerImageAsset()` if you are calling,
   * and a different `IStackSynthesizer` class if you are implementing.
   */
  public addDockerImageAsset(asset: DockerImageAssetSource): DockerImageAssetLocation {
    return this.synthesizer.addDockerImageAsset(asset);
  }

  /**
   * If this is a nested stack, returns it's parent stack.
   */
  public get nestedStackParent() {
    return this.nestedStackResource && Stack.of(this.nestedStackResource);
  }

  /**
   * Returns the parent of a nested stack.
   *
   * @deprecated use `nestedStackParent`
   */
  public get parentStack() {
    return this.nestedStackParent;
  }

  /**
   * Add a Transform to this stack. A Transform is a macro that AWS
   * CloudFormation uses to process your template.
   *
   * Duplicate values are removed when stack is synthesized.
   *
   * @example stack.addTransform('AWS::Serverless-2016-10-31')
   *
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/transform-section-structure.html
   *
   * @param transform The transform to add
   */
  public addTransform(transform: string) {
    if (!this.templateOptions.transforms) {
      this.templateOptions.transforms = [];
    }
    this.templateOptions.transforms.push(transform);
  }

  /**
   * Called implicitly by the `addDependency` helper function in order to
   * realize a dependency between two top-level stacks at the assembly level.
   *
   * Use `stack.addDependency` to define the dependency between any two stacks,
   * and take into account nested stack relationships.
   *
   * @internal
   */
  public _addAssemblyDependency(target: Stack, reason?: string) {
    // defensive: we should never get here for nested stacks
    if (this.nested || target.nested) {
      throw new Error('Cannot add assembly-level dependencies for nested stacks');
    }

    reason = reason || 'dependency added using stack.addDependency()';
    const cycle = target.stackDependencyReasons(this);
    if (cycle !== undefined) {
      // eslint-disable-next-line max-len
      throw new Error(`'${target.node.path}' depends on '${this.node.path}' (${cycle.join(', ')}). Adding this dependency (${reason}) would create a cyclic reference.`);
    }

    let dep = this._stackDependencies[Names.uniqueId(target)];
    if (!dep) {
      dep = this._stackDependencies[Names.uniqueId(target)] = {
        stack: target,
        reasons: [],
      };
    }

    dep.reasons.push(reason);

    if (process.env.CDK_DEBUG_DEPS) {
      // eslint-disable-next-line no-console
      console.error(`[CDK_DEBUG_DEPS] stack "${this.node.path}" depends on "${target.node.path}" because: ${reason}`);
    }
  }

  /**
   * Synthesizes the cloudformation template into a cloud assembly.
   * @internal
   */
  public _synthesizeTemplate(session: ISynthesisSession): void {
    // In principle, stack synthesis is delegated to the
    // StackSynthesis object.
    //
    // However, some parts of synthesis currently use some private
    // methods on Stack, and I don't really see the value in refactoring
    // this right now, so some parts still happen here.
    const builder = session.assembly;

    const template = this._toCloudFormation();

    // write the CloudFormation template as a JSON file
    const outPath = path.join(builder.outdir, this.templateFile);

    if (this.maxResources > 0) {
      const resources = template.Resources || {};
      const numberOfResources = Object.keys(resources).length;

      if (numberOfResources > this.maxResources) {
        throw new Error(`Number of resources: ${numberOfResources} is greater than allowed maximum of ${this.maxResources}`);
      } else if (numberOfResources >= (this.maxResources * 0.8)) {
        Annotations.of(this).addInfo(`Number of resources: ${numberOfResources} is approaching allowed maximum of ${this.maxResources}`);
      }
    }
    fs.writeFileSync(outPath, JSON.stringify(template, undefined, 2));

    for (const ctx of this._missingContext) {
      builder.addMissing(ctx);
    }
  }

  /**
   * Create a CloudFormation Export for a value
   *
   * Returns a string representing the corresponding `Fn.importValue()`
   * expression for this Export. You can control the name for the export by
   * passing the `name` option.
   *
   * If you don't supply a value for `name`, the value you're exporting must be
   * a Resource attribute (for example: `bucket.bucketName`) and it will be
   * given the same name as the automatic cross-stack reference that would be created
   * if you used the attribute in another Stack.
   *
   * One of the uses for this method is to *remove* the relationship between
   * two Stacks established by automatic cross-stack references. It will
   * temporarily ensure that the CloudFormation Export still exists while you
   * remove the reference from the consuming stack. After that, you can remove
   * the resource and the manual export.
   *
   * ## Example
   *
   * Here is how the process works. Let's say there are two stacks,
   * `producerStack` and `consumerStack`, and `producerStack` has a bucket
   * called `bucket`, which is referenced by `consumerStack` (perhaps because
   * an AWS Lambda Function writes into it, or something like that).
   *
   * It is not safe to remove `producerStack.bucket` because as the bucket is being
   * deleted, `consumerStack` might still be using it.
   *
   * Instead, the process takes two deployments:
   *
   * ### Deployment 1: break the relationship
   *
   * - Make sure `consumerStack` no longer references `bucket.bucketName` (maybe the consumer
   *   stack now uses its own bucket, or it writes to an AWS DynamoDB table, or maybe you just
   *   remove the Lambda Function altogether).
   * - In the `ProducerStack` class, call `this.exportValue(this.bucket.bucketName)`. This
   *   will make sure the CloudFormation Export continues to exist while the relationship
   *   between the two stacks is being broken.
   * - Deploy (this will effectively only change the `consumerStack`, but it's safe to deploy both).
   *
   * ### Deployment 2: remove the bucket resource
   *
   * - You are now free to remove the `bucket` resource from `producerStack`.
   * - Don't forget to remove the `exportValue()` call as well.
   * - Deploy again (this time only the `producerStack` will be changed -- the bucket will be deleted).
   */
  public exportValue(exportedValue: any, options: ExportValueOptions = {}) {
    if (options.name) {
      new CfnOutput(this, `Export${options.name}`, {
        value: exportedValue,
        exportName: options.name,
      });
      return Fn.importValue(options.name);
    }

    const resolvable = Tokenization.reverse(exportedValue);
    if (!resolvable || !Reference.isReference(resolvable)) {
      throw new Error('exportValue: either supply \'name\' or make sure to export a resource attribute (like \'bucket.bucketName\')');
    }

    // "teleport" the value here, in case it comes from a nested stack. This will also
    // ensure the value is from our own scope.
    const exportable = referenceNestedStackValueInParent(resolvable, this);

    // Ensure a singleton "Exports" scoping Construct
    // This mostly exists to trigger LogicalID munging, which would be
    // disabled if we parented constructs directly under Stack.
    // Also it nicely prevents likely construct name clashes
    const exportsScope = getCreateExportsScope(this);

    // Ensure a singleton CfnOutput for this value
    const resolved = this.resolve(exportable);
    const id = 'Output' + JSON.stringify(resolved);
    const exportName = generateExportName(exportsScope, id);

    if (Token.isUnresolved(exportName)) {
      throw new Error(`unresolved token in generated export name: ${JSON.stringify(this.resolve(exportName))}`);
    }

    const output = exportsScope.node.tryFindChild(id) as CfnOutput;
    if (!output) {
      new CfnOutput(exportsScope, id, { value: Token.asString(exportable), exportName });
    }

    return Fn.importValue(exportName);
  }

  /**
   * Returns the naming scheme used to allocate logical IDs. By default, uses
   * the `HashedAddressingScheme` but this method can be overridden to customize
   * this behavior.
   *
   * In order to make sure logical IDs are unique and stable, we hash the resource
   * construct tree path (i.e. toplevel/secondlevel/.../myresource) and add it as
   * a suffix to the path components joined without a separator (CloudFormation
   * IDs only allow alphanumeric characters).
   *
   * The result will be:
   *
   *   <path.join('')><md5(path.join('/')>
   *     "human"      "hash"
   *
   * If the "human" part of the ID exceeds 240 characters, we simply trim it so
   * the total ID doesn't exceed CloudFormation's 255 character limit.
   *
   * We only take 8 characters from the md5 hash (0.000005 chance of collision).
   *
   * Special cases:
   *
   * - If the path only contains a single component (i.e. it's a top-level
   *   resource), we won't add the hash to it. The hash is not needed for
   *   disamiguation and also, it allows for a more straightforward migration an
   *   existing CloudFormation template to a CDK stack without logical ID changes
   *   (or renames).
   * - For aesthetic reasons, if the last components of the path are the same
   *   (i.e. `L1/L2/Pipeline/Pipeline`), they will be de-duplicated to make the
   *   resulting human portion of the ID more pleasing: `L1L2Pipeline<HASH>`
   *   instead of `L1L2PipelinePipeline<HASH>`
   * - If a component is named "Default" it will be omitted from the path. This
   *   allows refactoring higher level abstractions around constructs without affecting
   *   the IDs of already deployed resources.
   * - If a component is named "Resource" it will be omitted from the user-visible
   *   path, but included in the hash. This reduces visual noise in the human readable
   *   part of the identifier.
   *
   * @param cfnElement The element for which the logical ID is allocated.
   */
  protected allocateLogicalId(cfnElement: CfnElement): string {
    const scopes = cfnElement.node.scopes;
    const stackIndex = scopes.indexOf(cfnElement.stack);
    const pathComponents = scopes.slice(stackIndex + 1).map(x => x.node.id);
    return makeUniqueId(pathComponents);
  }

  /**
   * Validate stack name
   *
   * CloudFormation stack names can include dashes in addition to the regular identifier
   * character classes, and we don't allow one of the magic markers.
   *
   * @internal
   */
  protected _validateId(name: string) {
    if (name && !VALID_STACK_NAME_REGEX.test(name)) {
      throw new Error(`Stack name must match the regular expression: ${VALID_STACK_NAME_REGEX.toString()}, got '${name}'`);
    }
  }

  /**
   * Returns the CloudFormation template for this stack by traversing
   * the tree and invoking _toCloudFormation() on all Entity objects.
   *
   * @internal
   */
  protected _toCloudFormation() {
    let transform: string | string[] | undefined;

    if (this.templateOptions.transform) {
      // eslint-disable-next-line max-len
      Annotations.of(this).addWarning('This stack is using the deprecated `templateOptions.transform` property. Consider switching to `addTransform()`.');
      this.addTransform(this.templateOptions.transform);
    }

    if (this.templateOptions.transforms) {
      if (this.templateOptions.transforms.length === 1) { // Extract single value
        transform = this.templateOptions.transforms[0];
      } else { // Remove duplicate values
        transform = Array.from(new Set(this.templateOptions.transforms));
      }
    }

    const template: any = {
      Description: this.templateOptions.description,
      Transform: transform,
      AWSTemplateFormatVersion: this.templateOptions.templateFormatVersion,
      Metadata: this.templateOptions.metadata,
    };

    const elements = cfnElements(this);
    const fragments = elements.map(e => this.resolve(e._toCloudFormation()));

    // merge in all CloudFormation fragments collected from the tree
    for (const fragment of fragments) {
      merge(template, fragment);
    }

    // resolve all tokens and remove all empties
    const ret = this.resolve(template) || {};

    this._logicalIds.assertAllRenamesApplied();

    return ret;
  }

  /**
   * Deprecated.
   *
   * @see https://github.com/aws/aws-cdk/pull/7187
   * @returns reference itself without any change
   * @deprecated cross reference handling has been moved to `App.prepare()`.
   */
  protected prepareCrossReference(_sourceStack: Stack, reference: Reference): IResolvable {
    return reference;
  }

  /**
   * Determine the various stack environment attributes.
   *
   */
  private parseEnvironment(env: Environment = {}) {
    // if an environment property is explicitly specified when the stack is
    // created, it will be used. if not, use tokens for account and region.
    //
    // (They do not need to be anchored to any construct like resource attributes
    // are, because we'll never Export/Fn::ImportValue them -- the only situation
    // in which Export/Fn::ImportValue would work is if the value are the same
    // between producer and consumer anyway, so we can just assume that they are).
    const containingAssembly = Stage.of(this);
    const account = env.account ?? containingAssembly?.account ?? Aws.ACCOUNT_ID;
    const region = env.region ?? containingAssembly?.region ?? Aws.REGION;

    // this is the "aws://" env specification that will be written to the cloud assembly
    // manifest. it will use "unknown-account" and "unknown-region" to indicate
    // environment-agnosticness.
    const envAccount = !Token.isUnresolved(account) ? account : cxapi.UNKNOWN_ACCOUNT;
    const envRegion = !Token.isUnresolved(region) ? region : cxapi.UNKNOWN_REGION;

    return {
      account,
      region,
      environment: cxapi.EnvironmentUtils.format(envAccount, envRegion),
    };
  }

  /**
   * Maximum number of resources in the stack
   *
   * Set to 0 to mean "unlimited".
   */
  private get maxResources(): number {
    const contextLimit = this.node.tryGetContext(STACK_RESOURCE_LIMIT_CONTEXT);
    return contextLimit !== undefined ? parseInt(contextLimit, 10) : MAX_RESOURCES;
  }

  /**
   * Check whether this stack has a (transitive) dependency on another stack
   *
   * Returns the list of reasons on the dependency path, or undefined
   * if there is no dependency.
   */
  private stackDependencyReasons(other: Stack): string[] | undefined {
    if (this === other) { return []; }
    for (const dep of Object.values(this._stackDependencies)) {
      const ret = dep.stack.stackDependencyReasons(other);
      if (ret !== undefined) {
        return [...dep.reasons, ...ret];
      }
    }
    return undefined;
  }

  /**
   * Calculate the stack name based on the construct path
   *
   * The stack name is the name under which we'll deploy the stack,
   * and incorporates containing Stage names by default.
   *
   * Generally this looks a lot like how logical IDs are calculated.
   * The stack name is calculated based on the construct root path,
   * as follows:
   *
   * - Path is calculated with respect to containing App or Stage (if any)
   * - If the path is one component long just use that component, otherwise
   *   combine them with a hash.
   *
   * Since the hash is quite ugly and we'd like to avoid it if possible -- but
   * we can't anymore in the general case since it has been written into legacy
   * stacks. The introduction of Stages makes it possible to make this nicer however.
   * When a Stack is nested inside a Stage, we use the path components below the
   * Stage, and prefix the path components of the Stage before it.
   */
  private generateStackName() {
    const assembly = Stage.of(this);
    const prefix = (assembly && assembly.stageName) ? `${assembly.stageName}-` : '';
    return `${prefix}${this.generateStackId(assembly)}`;
  }

  /**
   * The artifact ID for this stack
   *
   * Stack artifact ID is unique within the App's Cloud Assembly.
   */
  private generateStackArtifactId() {
    return this.generateStackId(this.node.root);
  }

  /**
   * Generate an ID with respect to the given container construct.
   */
  private generateStackId(container: IConstruct | undefined) {
    const rootPath = rootPathTo(this, container);
    const ids = rootPath.map(c => Node.of(c).id);

    // In unit tests our Stack (which is the only component) may not have an
    // id, so in that case just pretend it's "Stack".
    if (ids.length === 1 && !ids[0]) {
      throw new Error('unexpected: stack id must always be defined');
    }

    return makeStackName(ids);
  }
}

function merge(template: any, fragment: any): void {
  for (const section of Object.keys(fragment)) {
    const src = fragment[section];

    // create top-level section if it doesn't exist
    const dest = template[section];
    if (!dest) {
      template[section] = src;
    } else {
      template[section] = mergeSection(section, dest, src);
    }
  }
}

function mergeSection(section: string, val1: any, val2: any): any {
  switch (section) {
    case 'Description':
      return `${val1}\n${val2}`;
    case 'AWSTemplateFormatVersion':
      if (val1 != null && val2 != null && val1 !== val2) {
        throw new Error(`Conflicting CloudFormation template versions provided: '${val1}' and '${val2}`);
      }
      return val1 ?? val2;
    case 'Transform':
      return mergeSets(val1, val2);
    default:
      return mergeObjectsWithoutDuplicates(section, val1, val2);
  }
}

function mergeSets(val1: any, val2: any): any {
  const array1 = val1 == null ? [] : (Array.isArray(val1) ? val1 : [val1]);
  const array2 = val2 == null ? [] : (Array.isArray(val2) ? val2 : [val2]);
  for (const value of array2) {
    if (!array1.includes(value)) {
      array1.push(value);
    }
  }
  return array1.length === 1 ? array1[0] : array1;
}

function mergeObjectsWithoutDuplicates(section: string, dest: any, src: any): any {
  if (typeof dest !== 'object') {
    throw new Error(`Expecting ${JSON.stringify(dest)} to be an object`);
  }
  if (typeof src !== 'object') {
    throw new Error(`Expecting ${JSON.stringify(src)} to be an object`);
  }

  // add all entities from source section to destination section
  for (const id of Object.keys(src)) {
    if (id in dest) {
      throw new Error(`section '${section}' already contains '${id}'`);
    }
    dest[id] = src[id];
  }

  return dest;
}

/**
 * CloudFormation template options for a stack.
 */
export interface ITemplateOptions {
  /**
   * Gets or sets the description of this stack.
   * If provided, it will be included in the CloudFormation template's "Description" attribute.
   */
  description?: string;

  /**
   * Gets or sets the AWSTemplateFormatVersion field of the CloudFormation template.
   */
  templateFormatVersion?: string;

  /**
   * Gets or sets the top-level template transform for this stack (e.g. "AWS::Serverless-2016-10-31").
   *
   * @deprecated use `transforms` instead.
   */
  transform?: string;

  /**
   * Gets or sets the top-level template transform(s) for this stack (e.g. `["AWS::Serverless-2016-10-31"]`).
   */
  transforms?: string[];

  /**
   * Metadata associated with the CloudFormation template.
   */
  metadata?: { [key: string]: any };
}

/**
 * Collect all CfnElements from a Stack.
 *
 * @param node Root node to collect all CfnElements from
 * @param into Array to append CfnElements to
 * @returns The same array as is being collected into
 */
function cfnElements(node: IConstruct, into: CfnElement[] = []): CfnElement[] {
  if (CfnElement.isCfnElement(node)) {
    into.push(node);
  }

  for (const child of Node.of(node).children) {
    // Don't recurse into a substack
    if (Stack.isStack(child)) { continue; }

    cfnElements(child, into);
  }

  return into;
}

/**
 * Return the construct root path of the given construct relative to the given ancestor
 *
 * If no ancestor is given or the ancestor is not found, return the entire root path.
 */
export function rootPathTo(construct: IConstruct, ancestor?: IConstruct): IConstruct[] {
  const scopes = Node.of(construct).scopes;
  for (let i = scopes.length - 2; i >= 0; i--) {
    if (scopes[i] === ancestor) {
      return scopes.slice(i + 1);
    }
  }
  return scopes;
}

/**
 * makeUniqueId, specialized for Stack names
 *
 * Stack names may contain '-', so we allow that character if the stack name
 * has only one component. Otherwise we fall back to the regular "makeUniqueId"
 * behavior.
 */
function makeStackName(components: string[]) {
  if (components.length === 1) { return components[0]; }
  return makeUniqueId(components);
}

function getCreateExportsScope(stack: Stack) {
  const exportsName = 'Exports';
  let stackExports = stack.node.tryFindChild(exportsName) as CoreConstruct;
  if (stackExports === undefined) {
    stackExports = new CoreConstruct(stack, exportsName);
  }

  return stackExports;
}

function generateExportName(stackExports: CoreConstruct, id: string) {
  const stackRelativeExports = FeatureFlags.of(stackExports).isEnabled(cxapi.STACK_RELATIVE_EXPORTS_CONTEXT);
  const stack = Stack.of(stackExports);

  const components = [
    ...stackExports.node.scopes
      .slice(stackRelativeExports ? stack.node.scopes.length : 2)
      .map(c => c.node.id),
    id,
  ];
  const prefix = stack.stackName ? stack.stackName + ':' : '';
  const localPart = makeUniqueId(components);
  const maxLength = 255;
  return prefix + localPart.slice(Math.max(0, localPart.length - maxLength + prefix.length));
}

interface StackDependency {
  stack: Stack;
  reasons: string[];
}

/**
 * Options for the `stack.exportValue()` method
 */
export interface ExportValueOptions {
  /**
   * The name of the export to create
   *
   * @default - A name is automatically chosen
   */
  readonly name?: string;
}

// These imports have to be at the end to prevent circular imports
import { CfnOutput } from './cfn-output';
import { addDependency } from './deps';
import { FileSystem } from './fs';
import { Names } from './names';
import { Reference } from './reference';
import { IResolvable } from './resolvable';
import { DefaultStackSynthesizer, IStackSynthesizer, LegacyStackSynthesizer } from './stack-synthesizers';
import { Stage } from './stage';
import { ITaggable, TagManager } from './tag-manager';
import { Token, Tokenization } from './token';
import { referenceNestedStackValueInParent } from './private/refs';
