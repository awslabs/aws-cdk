import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as iam from '@aws-cdk/aws-iam';
import * as logs from '@aws-cdk/aws-logs';
import { Arn, Duration, IResource, Resource, Stack, Token } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { StateGraph } from './state-graph';
import { StatesMetrics } from './stepfunctions-canned-metrics.generated';
import { CfnStateMachine } from './stepfunctions.generated';
import { IChainable } from './types';

/**
 * Two types of state machines are available in AWS Step Functions: EXPRESS AND STANDARD.
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/concepts-standard-vs-express.html
 *
 * @default STANDARD
 */
export enum StateMachineType {
  /**
   * Express Workflows are ideal for high-volume, event processing workloads.
   */
  EXPRESS = 'EXPRESS',

  /**
   * Standard Workflows are ideal for long-running, durable, and auditable workflows.
   */
  STANDARD = 'STANDARD'
}

/**
 * Defines which category of execution history events are logged.
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/cloudwatch-log-level.html
 *
 * @default ERROR
 */
export enum LogLevel {
  /**
   * No Logging
   */
  OFF = 'OFF',
  /**
   * Log everything
   */
  ALL = 'ALL',
  /**
   * Log all errors
   */
  ERROR = 'ERROR',
  /**
   * Log fatal errors
   */
  FATAL = 'FATAL'
}

/**
 * Defines what execution history events are logged and where they are logged.
 */
export interface LogOptions {
  /**
   * The log group where the execution history events will be logged.
   */
  readonly destination: logs.ILogGroup;

  /**
   * Determines whether execution data is included in your log.
   *
   * @default true
   */
  readonly includeExecutionData?: boolean;

  /**
   * Defines which category of execution history events are logged.
   *
   * @default ERROR
   */
  readonly level?: LogLevel;
}

/**
 * Properties for defining a State Machine
 */
export interface StateMachineProps {
  /**
   * A name for the state machine
   *
   * @default A name is automatically generated
   */
  readonly stateMachineName?: string;

  /**
   * Definition for this state machine
   */
  readonly definition: IChainable;

  /**
   * The execution role for the state machine service
   *
   * @default A role is automatically created
   */
  readonly role?: iam.IRole;

  /**
   * Maximum run time for this state machine
   *
   * @default No timeout
   */
  readonly timeout?: Duration;

  /**
   * Type of the state machine
   *
   * @default StateMachineType.STANDARD
   */
  readonly stateMachineType?: StateMachineType;

  /**
   * Defines what execution history events are logged and where they are logged.
   *
   * @default No logging
   */
  readonly logs?: LogOptions;

  /**
   * Specifies whether Amazon X-Ray tracing is enabled for this state machine.
   *
   * @default false
   */
  readonly tracingEnabled?: boolean;
}

/**
 * A new or imported state machine.
 */
abstract class StateMachineBase extends Resource implements IStateMachine {
  /**
   * Import a state machine
   */
  public static fromStateMachineArn(scope: Construct, id: string, stateMachineArn: string): IStateMachine {
    class Import extends StateMachineBase {
      public readonly stateMachineArn = stateMachineArn;
      public readonly grantPrincipal = new iam.UnknownPrincipal({ resource: this });
    }
    return new Import(scope, id);
  }

  public abstract readonly stateMachineArn: string;

  /**
   * The principal this state machine is running as
   */
  public abstract readonly grantPrincipal: iam.IPrincipal;

  /**
   * Grant the given identity permissions to start an execution of this state
   * machine.
   */
  public grantStartExecution(identity: iam.IGrantable): iam.Grant {
    return iam.Grant.addToPrincipal({
      grantee: identity,
      actions: ['states:StartExecution'],
      resourceArns: [this.stateMachineArn],
    });
  }

  /**
   * Grant the given identity permissions to read results from state
   * machine.
   */
  public grantRead(identity: iam.IGrantable): iam.Grant {
    iam.Grant.addToPrincipal({
      grantee: identity,
      actions: [
        'states:ListExecutions',
        'states:ListStateMachines',
      ],
      resourceArns: [this.stateMachineArn],
    });
    iam.Grant.addToPrincipal({
      grantee: identity,
      actions: [
        'states:DescribeExecution',
        'states:DescribeStateMachineForExecution',
        'states:GetExecutionHistory',
      ],
      resourceArns: [`${this.executionArn()}:*`],
    });
    return iam.Grant.addToPrincipal({
      grantee: identity,
      actions: [
        'states:ListActivities',
        'states:DescribeStateMachine',
        'states:DescribeActivity',
      ],
      resourceArns: ['*'],
    });
  }

  /**
   * Grant the given identity task response permissions on a state machine
   */
  public grantTaskResponse(identity: iam.IGrantable): iam.Grant {
    return iam.Grant.addToPrincipal({
      grantee: identity,
      actions: [
        'states:SendTaskSuccess',
        'states:SendTaskFailure',
        'states:SendTaskHeartbeat',
      ],
      resourceArns: [this.stateMachineArn],
    });
  }

  /**
   * Grant the given identity permissions on all executions of the state machine
   */
  public grantExecution(identity: iam.IGrantable, ...actions: string[]) {
    return iam.Grant.addToPrincipal({
      grantee: identity,
      actions,
      resourceArns: [`${this.executionArn()}:*`],
    });
  }

  /**
   * Grant the given identity custom permissions
   */
  public grant(identity: iam.IGrantable, ...actions: string[]): iam.Grant {
    return iam.Grant.addToPrincipal({
      grantee: identity,
      actions,
      resourceArns: [this.stateMachineArn],
    });
  }


  /**
   * Return the given named metric for this State Machine's executions
   *
   * @default - sum over 5 minutes
   */
  public metric(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return new cloudwatch.Metric({
      namespace: 'AWS/States',
      metricName,
      dimensions: { StateMachineArn: this.stateMachineArn },
      statistic: 'sum',
      ...props,
    }).attachTo(this);
  }

  /**
   * Metric for the number of executions that failed
   *
   * @default - sum over 5 minutes
   */
  public metricFailed(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.cannedMetric(StatesMetrics.executionsFailedAverage, {
      statistic: 'sum',
      ...props,
    });
  }

  /**
   * Metric for the number of executions that were throttled
   *
   * @default - sum over 5 minutes
   */
  public metricThrottled(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    // There's a typo in the "canned" version of this
    return this.metric('ExecutionThrottled', props);
  }

  /**
   * Metric for the number of executions that were aborted
   *
   * @default - sum over 5 minutes
   */
  public metricAborted(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.cannedMetric(StatesMetrics.executionsAbortedAverage, {
      statistic: 'sum',
      ...props,
    });
  }

  /**
   * Metric for the number of executions that succeeded
   *
   * @default - sum over 5 minutes
   */
  public metricSucceeded(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.cannedMetric(StatesMetrics.executionsSucceededAverage, {
      statistic: 'sum',
      ...props,
    });
  }

  /**
   * Metric for the number of executions that timed out
   *
   * @default - sum over 5 minutes
   */
  public metricTimedOut(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.cannedMetric(StatesMetrics.executionsTimedOutAverage, {
      statistic: 'sum',
      ...props,
    });
  }

  /**
   * Metric for the number of executions that were started
   *
   * @default - sum over 5 minutes
   */
  public metricStarted(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.metric('ExecutionsStarted', props);
  }

  /**
   * Metric for the interval, in milliseconds, between the time the execution starts and the time it closes
   *
   * @default - average over 5 minutes
   */
  public metricTime(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.cannedMetric(StatesMetrics.executionTimeAverage, props);
  }

  /**
   * Returns the pattern for the execution ARN's of the state machine
   */
  private executionArn(): string {
    return Stack.of(this).formatArn({
      resource: 'execution',
      service: 'states',
      resourceName: Arn.parse(this.stateMachineArn, ':').resourceName,
      sep: ':',
    });
  }

  private cannedMetric(
    fn: (dims: { StateMachineArn: string }) => cloudwatch.MetricProps,
    props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return new cloudwatch.Metric({
      ...fn({ StateMachineArn: this.stateMachineArn }),
      ...props,
    }).attachTo(this);
  }
}

/**
 * Define a StepFunctions State Machine
 */
export class StateMachine extends StateMachineBase {
  /**
   * Execution role of this state machine
   */
  public readonly role: iam.IRole;

  /**
   * The name of the state machine
   * @attribute
   */
  public readonly stateMachineName: string;

  /**
   * The ARN of the state machine
   */
  public readonly stateMachineArn: string;

  /**
   * Type of the state machine
   * @attribute
   */
  public readonly stateMachineType: StateMachineType;

  constructor(scope: Construct, id: string, props: StateMachineProps) {
    super(scope, id, {
      physicalName: props.stateMachineName,
    });

    if (props.stateMachineName !== undefined) {
      this.validateStateMachineName(props.stateMachineName);
    }

    this.role = props.role || new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
    });

    const graph = new StateGraph(props.definition.startState, `State Machine ${id} definition`);
    graph.timeout = props.timeout;

    this.stateMachineType = props.stateMachineType ?? StateMachineType.STANDARD;

    const resource = new CfnStateMachine(this, 'Resource', {
      stateMachineName: this.physicalName,
      stateMachineType: props.stateMachineType ?? undefined,
      roleArn: this.role.roleArn,
      definitionString: Stack.of(this).toJsonString(graph.toGraphJson()),
      loggingConfiguration: props.logs ? this.buildLoggingConfiguration(props.logs) : undefined,
      tracingConfiguration: props.tracingEnabled ? this.buildTracingConfiguration() : undefined,
    });

    resource.node.addDependency(this.role);

    for (const statement of graph.policyStatements) {
      this.addToRolePolicy(statement);
    }

    this.stateMachineName = this.getResourceNameAttribute(resource.attrName);
    this.stateMachineArn = this.getResourceArnAttribute(resource.ref, {
      service: 'states',
      resource: 'stateMachine',
      resourceName: this.physicalName,
      sep: ':',
    });
  }

  /**
   * The principal this state machine is running as
   */
  public get grantPrincipal() {
    return this.role.grantPrincipal;
  }

  /**
   * Add the given statement to the role's policy
   */
  public addToRolePolicy(statement: iam.PolicyStatement) {
    this.role.addToPrincipalPolicy(statement);
  }

  private validateStateMachineName(stateMachineName: string) {
    if (!Token.isUnresolved(stateMachineName)) {
      if (stateMachineName.length < 1 || stateMachineName.length > 80) {
        throw new Error(`State Machine name must be between 1 and 80 characters. Received: ${stateMachineName}`);
      }

      if (!stateMachineName.match(/^[a-z0-9\+\!\@\.\(\)\-\=\_\']+$/i)) {
        throw new Error(`State Machine name must match "^[a-z0-9+!@.()-=_']+$/i". Received: ${stateMachineName}`);
      }
    }
  }

  private buildLoggingConfiguration(logOptions: LogOptions): CfnStateMachine.LoggingConfigurationProperty {
    // https://docs.aws.amazon.com/step-functions/latest/dg/cw-logs.html#cloudwatch-iam-policy
    this.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogDelivery',
        'logs:GetLogDelivery',
        'logs:UpdateLogDelivery',
        'logs:DeleteLogDelivery',
        'logs:ListLogDeliveries',
        'logs:PutResourcePolicy',
        'logs:DescribeResourcePolicies',
        'logs:DescribeLogGroups',
      ],
      resources: ['*'],
    }));

    return {
      destinations: [{
        cloudWatchLogsLogGroup: { logGroupArn: logOptions.destination.logGroupArn },
      }],
      includeExecutionData: logOptions.includeExecutionData,
      level: logOptions.level || 'ERROR',
    };
  }

  private buildTracingConfiguration(): CfnStateMachine.TracingConfigurationProperty {
    this.addToRolePolicy(new iam.PolicyStatement({
      // https://docs.aws.amazon.com/xray/latest/devguide/security_iam_id-based-policy-examples.html#xray-permissions-resources
      // https://docs.aws.amazon.com/step-functions/latest/dg/xray-iam.html
      actions: [
        'xray:PutTraceSegments',
        'xray:PutTelemetryRecords',
        'xray:GetSamplingRules',
        'xray:GetSamplingTargets',
      ],
      resources: ['*'],
    }));

    return {
      enabled: true,
    };
  }
}

/**
 * A State Machine
 */
export interface IStateMachine extends IResource, iam.IGrantable {
  /**
   * The ARN of the state machine
   * @attribute
   */
  readonly stateMachineArn: string;

  /**
   * Grant the given identity permissions to start an execution of this state
   * machine.
   *
   * @param identity The principal
   */
  grantStartExecution(identity: iam.IGrantable): iam.Grant;

  /**
   * Grant the given identity read permissions for this state machine
   *
   * @param identity The principal
   */
  grantRead(identity: iam.IGrantable): iam.Grant;

  /**
   * Grant the given identity read permissions for this state machine
   *
   * @param identity The principal
   */
  grantTaskResponse(identity: iam.IGrantable): iam.Grant;

  /**
   * Grant the given identity permissions for all executions of a state machine
   *
   * @param identity The principal
   * @param actions The list of desired actions
   */
  grantExecution(identity: iam.IGrantable, ...actions: string[]): iam.Grant;

  /**
   * Grant the given identity custom permissions
   *
   * @param identity The principal
   * @param actions The list of desired actions
   */
  grant(identity: iam.IGrantable, ...actions: string[]): iam.Grant;

  /**
   * Return the given named metric for this State Machine's executions
   *
   * @default - sum over 5 minutes
   */
  metric(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric;

  /**
   * Metric for the number of executions that failed
   *
   * @default - sum over 5 minutes
   */
  metricFailed(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

  /**
   * Metric for the number of executions that were throttled
   *
   * @default sum over 5 minutes
   */
  metricThrottled(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

  /**
   * Metric for the number of executions that were aborted
   *
   * @default - sum over 5 minutes
   */
  metricAborted(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

  /**
   * Metric for the number of executions that succeeded
   *
   * @default - sum over 5 minutes
   */
  metricSucceeded(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

  /**
   * Metric for the number of executions that timed out
   *
   * @default - sum over 5 minutes
   */
  metricTimedOut(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

  /**
   * Metric for the number of executions that were started
   *
   * @default - sum over 5 minutes
   */
  metricStarted(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

  /**
   * Metric for the interval, in milliseconds, between the time the execution starts and the time it closes
   *
   * @default - sum over 5 minutes
   */
  metricTime(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
}
