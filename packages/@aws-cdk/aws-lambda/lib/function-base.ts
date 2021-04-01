import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import { ConstructNode, IResource, Resource, Token } from '@aws-cdk/core';
import { AliasOptions } from './alias';
import { EventInvokeConfig, EventInvokeConfigOptions } from './event-invoke-config';
import { IEventSource } from './event-source';
import { EventSourceMapping, EventSourceMappingOptions } from './event-source-mapping';
import { IVersion } from './lambda-version';
import { CfnPermission } from './lambda.generated';
import { Permission } from './permission';
import { addAlias } from './util';

export interface IFunction extends IResource, ec2.IConnectable, iam.IGrantable {

  /**
   * The name of the function.
   *
   * @attribute
   */
  readonly functionName: string;

  /**
   * The ARN fo the function.
   *
   * @attribute
   */
  readonly functionArn: string;

  /**
   * The IAM role associated with this function.
   */
  readonly role?: iam.IRole;

  /**
   * Whether or not this Lambda function was bound to a VPC
   *
   * If this is is `false`, trying to access the `connections` object will fail.
   */
  readonly isBoundToVpc: boolean;

  /**
   * The `$LATEST` version of this function.
   *
   * Note that this is reference to a non-specific AWS Lambda version, which
   * means the function this version refers to can return different results in
   * different invocations.
   *
   * To obtain a reference to an explicit version which references the current
   * function configuration, use `lambdaFunction.currentVersion` instead.
   */
  readonly latestVersion: IVersion;

  /**
   * The construct node where permissions are attached.
   */
  readonly permissionsNode: ConstructNode;

  /**
   * Adds an event source that maps to this AWS Lambda function.
   * @param id construct ID
   * @param options mapping options
   */
  addEventSourceMapping(id: string, options: EventSourceMappingOptions): EventSourceMapping;

  /**
   * Adds a permission to the Lambda resource policy.
   * @param id The id ƒor the permission construct
   * @param permission The permission to grant to this Lambda function. @see Permission for details.
   */
  addPermission(id: string, permission: Permission): void;

  /**
   * Adds a statement to the IAM role assumed by the instance.
   */
  addToRolePolicy(statement: iam.PolicyStatement): void;

  /**
   * Grant the given identity permissions to invoke this Lambda
   */
  grantInvoke(identity: iam.IGrantable): iam.Grant;

  /**
   * Return the given named metric for this Lambda
   */
  metric(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric;

  /**
   * Metric for the Duration of this Lambda
   *
   * @default average over 5 minutes
   */
  metricDuration(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

  /**
   * Metric for the number of invocations of this Lambda
   *
   * @default sum over 5 minutes
   */
  metricInvocations(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

  /**
   * Metric for the number of throttled invocations of this Lambda
   *
   * @default sum over 5 minutes
   */
  metricThrottles(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

  /**
   * Adds an event source to this function.
   *
   * Event sources are implemented in the @aws-cdk/aws-lambda-event-sources module.
   *
   * The following example adds an SQS Queue as an event source:
   * ```
   * import { SqsEventSource } from '@aws-cdk/aws-lambda-event-sources';
   * myFunction.addEventSource(new SqsEventSource(myQueue));
   * ```
   */
  addEventSource(source: IEventSource): void;

  /**
   * Configures options for asynchronous invocation.
   */
  configureAsyncInvoke(options: EventInvokeConfigOptions): void;
}

/**
 * Represents a Lambda function defined outside of this stack.
 */
export interface FunctionAttributes {
  /**
   * The ARN of the Lambda function.
   *
   * Format: arn:<partition>:lambda:<region>:<account-id>:function:<function-name>
   */
  readonly functionArn: string;

  /**
   * The IAM execution role associated with this function.
   *
   * If the role is not specified, any role-related operations will no-op.
   */
  readonly role?: iam.IRole;

  /**
   * Id of the security group of this Lambda, if in a VPC.
   *
   * This needs to be given in order to support allowing connections
   * to this Lambda.
   *
   * @deprecated use `securityGroup` instead
   */
  readonly securityGroupId?: string;

  /**
   * The security group of this Lambda, if in a VPC.
   *
   * This needs to be given in order to support allowing connections
   * to this Lambda.
   */
  readonly securityGroup?: ec2.ISecurityGroup;

  /**
   * Setting this property informs the CDK that the imported function is in the same environment as the stack.
   * This affects certain behaviours such as, whether this function's permission can be modified.
   * When not configured, the CDK attempts to auto-determine this. For environment agnostic stacks, i.e., stacks
   * where the account is not specified with the `env` property, this is determined to be false.
   *
   * Set this to property *ONLY IF* the imported function is in the same account as the stack
   * it's imported in.
   * @default - depends: true, if the Stack is configured with an explicit `env` (account and region) and the account is the same as this function.
   * For environment-agnostic stacks this will default to `false`.
   */
  readonly sameEnvironment?: boolean;
}

export abstract class FunctionBase extends Resource implements IFunction, ec2.IClientVpnConnectionHandler {
  /**
   * The principal this Lambda Function is running as
   */
  public abstract readonly grantPrincipal: iam.IPrincipal;

  /**
   * The name of the function.
   */
  public abstract readonly functionName: string;

  /**
   * The ARN fo the function.
   */
  public abstract readonly functionArn: string;

  /**
   * The IAM role associated with this function.
   *
   * Undefined if the function was imported without a role.
   */
  public abstract readonly role?: iam.IRole;

  /**
   * The construct node where permissions are attached.
   */
  public abstract readonly permissionsNode: ConstructNode;

  /**
   * Whether the addPermission() call adds any permissions
   *
   * True for new Lambdas, false for version $LATEST and imported Lambdas
   * from different accounts.
   */
  protected abstract readonly canCreatePermissions: boolean;

  /**
   * Actual connections object for this Lambda
   *
   * May be unset, in which case this Lambda is not configured use in a VPC.
   * @internal
   */
  protected _connections?: ec2.Connections;

  private _latestVersion?: LatestVersion;

  /**
   * Mapping of invocation principals to grants. Used to de-dupe `grantInvoke()` calls.
   * @internal
   */
  protected _invocationGrants: Record<string, iam.Grant> = {};

  /**
   * Adds a permission to the Lambda resource policy.
   * @param id The id ƒor the permission construct
   * @param permission The permission to grant to this Lambda function. @see Permission for details.
   */
  public addPermission(id: string, permission: Permission) {
    if (!this.canCreatePermissions) {
      // FIXME: @deprecated(v2) - throw an error if calling `addPermission` on a resource that doesn't support it.
      return;
    }

    const principal = this.parsePermissionPrincipal(permission.principal);
    const action = permission.action || 'lambda:InvokeFunction';
    const scope = permission.scope || this;

    new CfnPermission(scope, id, {
      action,
      principal,
      functionName: this.functionArn,
      eventSourceToken: permission.eventSourceToken,
      sourceAccount: permission.sourceAccount,
      sourceArn: permission.sourceArn,
    });
  }

  /**
   * Adds a statement to the IAM role assumed by the instance.
   */
  public addToRolePolicy(statement: iam.PolicyStatement) {
    if (!this.role) {
      return;
    }

    this.role.addToPrincipalPolicy(statement);
  }

  /**
   * Access the Connections object
   *
   * Will fail if not a VPC-enabled Lambda Function
   */
  public get connections(): ec2.Connections {
    if (!this._connections) {
      // eslint-disable-next-line max-len
      throw new Error('Only VPC-associated Lambda Functions have security groups to manage. Supply the "vpc" parameter when creating the Lambda, or "securityGroupId" when importing it.');
    }
    return this._connections;
  }

  public get latestVersion(): IVersion {
    if (!this._latestVersion) {
      this._latestVersion = new LatestVersion(this);
    }
    return this._latestVersion;
  }

  /**
   * Whether or not this Lambda function was bound to a VPC
   *
   * If this is is `false`, trying to access the `connections` object will fail.
   */
  public get isBoundToVpc(): boolean {
    return !!this._connections;
  }

  public addEventSourceMapping(id: string, options: EventSourceMappingOptions): EventSourceMapping {
    return new EventSourceMapping(this, id, {
      target: this,
      ...options,
    });
  }

  /**
   * Grant the given identity permissions to invoke this Lambda
   */
  public grantInvoke(grantee: iam.IGrantable): iam.Grant {
    const identifier = `Invoke${grantee.grantPrincipal}`; // calls the .toString() of the principal

    // Memoize the result so subsequent grantInvoke() calls are idempotent
    let grant = this._invocationGrants[identifier];
    if (!grant) {
      grant = iam.Grant.addToPrincipalOrResource({
        grantee,
        actions: ['lambda:InvokeFunction'],
        resourceArns: [this.functionArn],

        // Fake resource-like object on which to call addToResourcePolicy(), which actually
        // calls addPermission()
        resource: {
          addToResourcePolicy: (_statement) => {
            // Couldn't add permissions to the principal, so add them locally.
            this.addPermission(identifier, {
              principal: grantee.grantPrincipal!,
              action: 'lambda:InvokeFunction',
            });

            const permissionNode = this._functionNode().tryFindChild(identifier);
            if (!permissionNode) {
              throw new Error('Cannot modify permission to lambda function. Function is either imported or $LATEST version. '
                + 'If the function is imported from the same account use `fromFunctionAttributes()` API with the `sameEnvironment` flag.');
            }
            return { statementAdded: true, policyDependable: permissionNode };
          },
          node: this.node,
          stack: this.stack,
          env: this.env,
        },
      });
      this._invocationGrants[identifier] = grant;
    }
    return grant;
  }

  public addEventSource(source: IEventSource) {
    source.bind(this);
  }

  public configureAsyncInvoke(options: EventInvokeConfigOptions): void {
    if (this.node.tryFindChild('EventInvokeConfig') !== undefined) {
      throw new Error(`An EventInvokeConfig has already been configured for the function at ${this.node.path}`);
    }

    new EventInvokeConfig(this, 'EventInvokeConfig', {
      function: this,
      ...options,
    });
  }

  /**
   * Returns the construct tree node that corresponds to the lambda function.
   * For use internally for constructs, when the tree is set up in non-standard ways. Ex: SingletonFunction.
   * @internal
   */
  protected _functionNode(): ConstructNode {
    return this.node;
  }

  /**
   * Given the function arn, check if the account id matches this account
   *
   * Function ARNs look like this:
   *
   *   arn:aws:lambda:region:account-id:function:function-name
   *
   * ..which means that in order to extract the `account-id` component from the ARN, we can
   * split the ARN using ":" and select the component in index 4.
   *
   * @returns true if account id of function matches the account specified on the stack, false otherwise.
   *
   * @internal
   */
  protected _isStackAccount(): boolean {
    if (Token.isUnresolved(this.stack.account) || Token.isUnresolved(this.functionArn)) {
      return false;
    }
    return this.stack.parseArn(this.functionArn).account === this.stack.account;
  }

  /**
   * Translate IPrincipal to something we can pass to AWS::Lambda::Permissions
   *
   * Do some nasty things because `Permission` supports a subset of what the
   * full IAM principal language supports, and we may not be able to parse strings
   * outright because they may be tokens.
   *
   * Try to recognize some specific Principal classes first, then try a generic
   * fallback.
   */
  private parsePermissionPrincipal(principal?: iam.IPrincipal) {
    if (!principal) {
      return undefined;
    }

    // Try some specific common classes first.
    // use duck-typing, not instance of
    // @deprecated: after v2, we can change these to 'instanceof'
    if ('accountId' in principal) {
      return (principal as iam.AccountPrincipal).accountId;
    }

    if ('service' in principal) {
      return (principal as iam.ServicePrincipal).service;
    }

    if ('arn' in principal) {
      return (principal as iam.ArnPrincipal).arn;
    }

    // Try a best-effort approach to support simple principals that are not any of the predefined
    // classes, but are simple enough that they will fit into the Permission model. Main target
    // here: imported Roles, Users, Groups.
    //
    // The principal cannot have conditions and must have a single { AWS: [arn] } entry.
    const json = principal.policyFragment.principalJson;
    if (Object.keys(principal.policyFragment.conditions).length === 0 && json.AWS) {
      if (typeof json.AWS === 'string') { return json.AWS; }
      if (Array.isArray(json.AWS) && json.AWS.length === 1 && typeof json.AWS[0] === 'string') {
        return json.AWS[0];
      }
    }

    throw new Error(`Invalid principal type for Lambda permission statement: ${principal.constructor.name}. ` +
      'Supported: AccountPrincipal, ArnPrincipal, ServicePrincipal');
  }
}

export abstract class QualifiedFunctionBase extends FunctionBase {
  public abstract readonly lambda: IFunction;

  public readonly permissionsNode = this.node;

  /**
   * The qualifier of the version or alias of this function.
   * A qualifier is the identifier that's appended to a version or alias ARN.
   * @see https://docs.aws.amazon.com/lambda/latest/dg/API_GetFunctionConfiguration.html#API_GetFunctionConfiguration_RequestParameters
   */
  protected abstract readonly qualifier: string;

  public get latestVersion() {
    return this.lambda.latestVersion;
  }

  public configureAsyncInvoke(options: EventInvokeConfigOptions): void {
    if (this.node.tryFindChild('EventInvokeConfig') !== undefined) {
      throw new Error(`An EventInvokeConfig has already been configured for the qualified function at ${this.node.path}`);
    }

    new EventInvokeConfig(this, 'EventInvokeConfig', {
      function: this.lambda,
      qualifier: this.qualifier,
      ...options,
    });
  }
}

/**
 * The $LATEST version of a function, useful when attempting to create aliases.
 */
class LatestVersion extends FunctionBase implements IVersion {
  public readonly lambda: IFunction;
  public readonly version = '$LATEST';
  public readonly permissionsNode = this.node;

  protected readonly canCreatePermissions = false;

  constructor(lambda: FunctionBase) {
    super(lambda, '$LATEST');
    this.lambda = lambda;
  }

  public get functionArn() {
    return `${this.lambda.functionArn}:${this.version}`;
  }

  public get functionName() {
    return `${this.lambda.functionName}:${this.version}`;
  }

  public get grantPrincipal() {
    return this.lambda.grantPrincipal;
  }

  public get latestVersion() {
    return this;
  }

  public get role() {
    return this.lambda.role;
  }

  public addAlias(aliasName: string, options: AliasOptions = {}) {
    return addAlias(this, this, aliasName, options);
  }

  public get edgeArn(): never {
    throw new Error('$LATEST function version cannot be used for Lambda@Edge');
  }
}
