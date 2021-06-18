import * as path from 'path';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as logs from '@aws-cdk/aws-logs';
import { Duration } from '@aws-cdk/core';
import { Construct } from 'constructs';
import * as consts from './runtime/consts';
import { calculateRetryPolicy } from './util';
import { WaiterStateMachine } from './waiter-state-machine';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { CustomResourceProviderConfig, ICustomResourceProvider } from '@aws-cdk/aws-cloudformation';
// keep this import separate from other imports to reduce chance for merge conflicts with v2-main",
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';

const RUNTIME_HANDLER_PATH = path.join(__dirname, 'runtime');
const FRAMEWORK_HANDLER_TIMEOUT = Duration.minutes(15); // keep it simple for now

/**
 * Initialization properties for the `Provider` construct.
 */
export interface ProviderProps {

  /**
   * The AWS Lambda function to invoke for all resource lifecycle operations
   * (CREATE/UPDATE/DELETE).
   *
   * This function is responsible to begin the requested resource operation
   * (CREATE/UPDATE/DELETE) and return any additional properties to add to the
   * event, which will later be passed to `isComplete`. The `PhysicalResourceId`
   * property must be included in the response.
   */
  readonly onEventHandler: lambda.IFunction;

  /**
   * The AWS Lambda function to invoke in order to determine if the operation is
   * complete.
   *
   * This function will be called immediately after `onEvent` and then
   * periodically based on the configured query interval as long as it returns
   * `false`. If the function still returns `false` and the alloted timeout has
   * passed, the operation will fail.
   *
   * @default - provider is synchronous. This means that the `onEvent` handler
   * is expected to finish all lifecycle operations within the initial invocation.
   */
  readonly isCompleteHandler?: lambda.IFunction;

  /**
   * Time between calls to the `isComplete` handler which determines if the
   * resource has been stabilized.
   *
   * The first `isComplete` will be called immediately after `handler` and then
   * every `queryInterval` seconds, and until `timeout` has been reached or until
   * `isComplete` returns `true`.
   *
   * @default Duration.seconds(5)
   */
  readonly queryInterval?: Duration;

  /**
   * Total timeout for the entire operation.
   *
   * The maximum timeout is 2 hours (yes, it can exceed the AWS Lambda 15 minutes)
   *
   * @default Duration.minutes(30)
   */
  readonly totalTimeout?: Duration;

  /**
   * The number of days framework log events are kept in CloudWatch Logs. When
   * updating this property, unsetting it doesn't remove the log retention policy.
   * To remove the retention policy, set the value to `INFINITE`.
   *
   * @default logs.RetentionDays.INFINITE
   */
  readonly logRetention?: logs.RetentionDays;

  /**
   * The vpc to provision the lambda functions in.
   *
   * @default - functions are not provisioned inside a vpc.
   */
  readonly vpc?: ec2.IVpc;

  /**
   * Which subnets from the VPC to place the lambda functions in.
   *
   * Only used if 'vpc' is supplied. Note: internet access for Lambdas
   * requires a NAT gateway, so picking Public subnets is not allowed.
   *
   * @default - the Vpc default strategy if not specified
   */
  readonly vpcSubnets?: ec2.SubnetSelection;

  /**
   * Security groups to attach to the provider functions.
   *
   * Only used if 'vpc' is supplied
   *
   * @default - If `vpc` is not supplied, no security groups are attached. Otherwise, a dedicated security
   * group is created for each function.
   */
  readonly securityGroups?: ec2.ISecurityGroup[];

  /**
   * AWS Lambda execution role.
   *
   * The role that will be assumed by the AWS Lambda.
   * Must be assumable by the 'lambda.amazonaws.com' service principal.
   *
   * @default - A default role will be created.
   */
  readonly role?: iam.IRole;
}

/**
 * Defines an AWS CloudFormation custom resource provider.
 */
export class Provider extends CoreConstruct implements ICustomResourceProvider {
  /**
   * The user-defined AWS Lambda function which is invoked for all resource
   * lifecycle operations (CREATE/UPDATE/DELETE).
   */
  public readonly onEventHandler: lambda.IFunction;

  /**
   * The user-defined AWS Lambda function which is invoked asynchronously in
   * order to determine if the operation is complete.
   */
  public readonly isCompleteHandler?: lambda.IFunction;

  /**
   * The service token to use in order to define custom resources that are
   * backed by this provider.
   */
  public readonly serviceToken: string;

  private readonly entrypoint: lambda.Function;
  private readonly logRetention?: logs.RetentionDays;
  private readonly vpc?: ec2.IVpc;
  private readonly vpcSubnets?: ec2.SubnetSelection;
  private readonly securityGroups?: ec2.ISecurityGroup[];
  private readonly role?: iam.IRole;

  constructor(scope: Construct, id: string, props: ProviderProps) {
    super(scope, id);

    if (!props.isCompleteHandler && (props.queryInterval || props.totalTimeout)) {
      throw new Error('"queryInterval" and "totalTimeout" can only be configured if "isCompleteHandler" is specified. '
        + 'Otherwise, they have no meaning');
    }

    this.onEventHandler = props.onEventHandler;
    this.isCompleteHandler = props.isCompleteHandler;

    this.logRetention = props.logRetention;
    this.vpc = props.vpc;
    this.vpcSubnets = props.vpcSubnets;
    this.securityGroups = props.securityGroups;

    this.role = props.role;

    const onEventFunction = this.createFunction(consts.FRAMEWORK_ON_EVENT_HANDLER_NAME);

    if (this.isCompleteHandler) {
      const isCompleteFunction = this.createFunction(consts.FRAMEWORK_IS_COMPLETE_HANDLER_NAME);
      const timeoutFunction = this.createFunction(consts.FRAMEWORK_ON_TIMEOUT_HANDLER_NAME);

      const retry = calculateRetryPolicy(props);
      const waiterStateMachine = new WaiterStateMachine(this, 'waiter-state-machine', {
        isCompleteHandler: isCompleteFunction,
        timeoutHandler: timeoutFunction,
        backoffRate: retry.backoffRate,
        interval: retry.interval,
        maxAttempts: retry.maxAttempts,
      });
      // the on-event entrypoint is going to start the execution of the waiter
      onEventFunction.addEnvironment(consts.WAITER_STATE_MACHINE_ARN_ENV, waiterStateMachine.stateMachineArn);
      waiterStateMachine.grantStartExecution(onEventFunction);
    }

    this.entrypoint = onEventFunction;
    this.serviceToken = this.entrypoint.functionArn;
  }

  /**
   * Called by `CustomResource` which uses this provider.
   * @deprecated use `provider.serviceToken` instead
   */
  public bind(_scope: CoreConstruct): CustomResourceProviderConfig {
    return {
      serviceToken: this.entrypoint.functionArn,
    };
  }

  private createFunction(entrypoint: string) {
    const fn = new lambda.Function(this, `framework-${entrypoint}`, {
      code: lambda.Code.fromAsset(RUNTIME_HANDLER_PATH),
      description: `AWS CDK resource provider framework - ${entrypoint} (${this.node.path})`.slice(0, 256),
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: `framework.${entrypoint}`,
      timeout: FRAMEWORK_HANDLER_TIMEOUT,
      logRetention: this.logRetention,
      vpc: this.vpc,
      vpcSubnets: this.vpcSubnets,
      securityGroups: this.securityGroups,
      role: this.role,
    });

    fn.addEnvironment(consts.USER_ON_EVENT_FUNCTION_ARN_ENV, this.onEventHandler.functionArn);
    this.onEventHandler.grantInvoke(fn);

    if (this.isCompleteHandler) {
      fn.addEnvironment(consts.USER_IS_COMPLETE_FUNCTION_ARN_ENV, this.isCompleteHandler.functionArn);
      this.isCompleteHandler.grantInvoke(fn);
    }

    return fn;
  }
}
