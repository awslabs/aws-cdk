import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import { Construct } from 'constructs';
import { Chain } from '../chain';
import { StateGraph } from '../state-graph';
import { CatchProps, IChainable, INextable, RetryProps } from '../types';
import { renderJsonPath, State } from './state';


/**
 * Props that are common to all tasks
 */
export interface TaskStateBaseProps {
  /**
   * An optional description for this state
   *
   * @default - No comment
   */
  readonly comment?: string;

  /**
   * JSONPath expression to select part of the state to be the input to this state.
   *
   * May also be the special value JsonPath.DISCARD, which will cause the effective
   * input to be the empty object {}.
   *
   * @default - The entire task input (JSON path '$')
   */
  readonly inputPath?: string;

  /**
   * JSONPath expression to select select a portion of the state output to pass
   * to the next state.
   *
   * May also be the special value JsonPath.DISCARD, which will cause the effective
   * output to be the empty object {}.
   *
   * @default - The entire JSON node determined by the state input, the task result,
   *   and resultPath is passed to the next state (JSON path '$')
   */
  readonly outputPath?: string;

  /**
   * JSONPath expression to indicate where to inject the state's output
   *
   * May also be the special value JsonPath.DISCARD, which will cause the state's
   * input to become its output.
   *
   * @default - Replaces the entire input with the result (JSON path '$')
   */
  readonly resultPath?: string;

  /**
   * The JSON that will replace the state's raw result and become the effective
   * result before ResultPath is applied.
   *
   * You can use ResultSelector to create a payload with values that are static
   * or selected from the state's raw result.
   *
   * @see
   * https://docs.aws.amazon.com/step-functions/latest/dg/input-output-inputpath-params.html#input-output-resultselector
   *
   * @default - None
   */
  readonly resultSelector?: { [key: string]: any };

  /**
   * Timeout for the state machine
   *
   * @default - None
   */
  readonly timeout?: cdk.Duration;

  /**
   * Timeout for the heartbeat
   *
   * @default - None
   */
  readonly heartbeat?: cdk.Duration;

  /**
   * AWS Step Functions integrates with services directly in the Amazon States Language.
   * You can control these AWS services using service integration patterns
   *
   * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-to-resource.html#connect-wait-token
   *
   * @default IntegrationPattern.REQUEST_RESPONSE
   */
  readonly integrationPattern?: IntegrationPattern;
}

/**
 * Define a Task state in the state machine
 *
 * Reaching a Task state causes some work to be executed, represented by the
 * Task's resource property. Task constructs represent a generic Amazon
 * States Language Task.
 *
 * For some resource types, more specific subclasses of Task may be available
 * which are more convenient to use.
 */
export abstract class TaskStateBase extends State implements INextable {
  public readonly endStates: INextable[];

  protected abstract readonly taskMetrics?: TaskMetricsConfig;
  protected abstract readonly taskPolicies?: iam.PolicyStatement[];

  private readonly timeout?: cdk.Duration;
  private readonly heartbeat?: cdk.Duration;

  constructor(scope: Construct, id: string, props: TaskStateBaseProps) {
    super(scope, id, props);
    this.endStates = [this];
    this.timeout = props.timeout;
    this.heartbeat = props.heartbeat;
  }

  /**
   * Add retry configuration for this state
   *
   * This controls if and how the execution will be retried if a particular
   * error occurs.
   */
  public addRetry(props: RetryProps = {}): TaskStateBase {
    super._addRetry(props);
    return this;
  }

  /**
   * Add a recovery handler for this state
   *
   * When a particular error occurs, execution will continue at the error
   * handler instead of failing the state machine execution.
   */
  public addCatch(handler: IChainable, props: CatchProps = {}): TaskStateBase {
    super._addCatch(handler.startState, props);
    return this;
  }

  /**
   * Continue normal execution with the given state
   */
  public next(next: IChainable): Chain {
    super.makeNext(next.startState);
    return Chain.sequence(this, next);
  }

  /**
   * Return the Amazon States Language object for this state
   */
  public toStateJson(): object {
    return {
      ...this.renderNextEnd(),
      ...this.renderRetryCatch(),
      ...this.renderTaskBase(),
      ...this._renderTask(),
    };
  }

  /**
   * Return the given named metric for this Task
   *
   * @default - sum over 5 minutes
   */
  public metric(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return new cloudwatch.Metric({
      namespace: 'AWS/States',
      metricName,
      dimensions: this.taskMetrics?.metricDimensions,
      statistic: 'sum',
      ...props,
    }).attachTo(this);
  }

  /**
   * The interval, in milliseconds, between the time the Task starts and the time it closes.
   *
   * @default - average over 5 minutes
   */
  public metricRunTime(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.taskMetric(this.taskMetrics?.metricPrefixSingular, 'RunTime', { statistic: 'avg', ...props });
  }

  /**
   * The interval, in milliseconds, for which the activity stays in the schedule state.
   *
   * @default - average over 5 minutes
   */
  public metricScheduleTime(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.taskMetric(this.taskMetrics?.metricPrefixSingular, 'ScheduleTime', { statistic: 'avg', ...props });
  }

  /**
   * The interval, in milliseconds, between the time the activity is scheduled and the time it closes.
   *
   * @default - average over 5 minutes
   */
  public metricTime(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.taskMetric(this.taskMetrics?.metricPrefixSingular, 'Time', { statistic: 'avg', ...props });
  }

  /**
   * Metric for the number of times this activity is scheduled
   *
   * @default - sum over 5 minutes
   */
  public metricScheduled(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.taskMetric(this.taskMetrics?.metricPrefixPlural, 'Scheduled', props);
  }

  /**
   * Metric for the number of times this activity times out
   *
   * @default - sum over 5 minutes
   */
  public metricTimedOut(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.taskMetric(this.taskMetrics?.metricPrefixPlural, 'TimedOut', props);
  }

  /**
   * Metric for the number of times this activity is started
   *
   * @default - sum over 5 minutes
   */
  public metricStarted(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.taskMetric(this.taskMetrics?.metricPrefixPlural, 'Started', props);
  }

  /**
   * Metric for the number of times this activity succeeds
   *
   * @default - sum over 5 minutes
   */
  public metricSucceeded(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.taskMetric(this.taskMetrics?.metricPrefixPlural, 'Succeeded', props);
  }

  /**
   * Metric for the number of times this activity fails
   *
   * @default - sum over 5 minutes
   */
  public metricFailed(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.taskMetric(this.taskMetrics?.metricPrefixPlural, 'Failed', props);
  }

  /**
   * Metric for the number of times the heartbeat times out for this activity
   *
   * @default - sum over 5 minutes
   */
  public metricHeartbeatTimedOut(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.taskMetric(this.taskMetrics?.metricPrefixPlural, 'HeartbeatTimedOut', props);
  }

  protected whenBoundToGraph(graph: StateGraph) {
    super.whenBoundToGraph(graph);
    for (const policyStatement of this.taskPolicies || []) {
      graph.registerPolicyStatement(policyStatement);
    }
  }

  /**
   * @internal
   */
  protected abstract _renderTask(): any;

  private taskMetric(prefix: string | undefined, suffix: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    if (prefix === undefined) {
      throw new Error('Task does not expose metrics. Use the \'metric()\' function to add metrics.');
    }
    return this.metric(prefix + suffix, props);
  }

  private renderTaskBase() {
    return {
      Type: 'Task',
      Comment: this.comment,
      TimeoutSeconds: this.timeout?.toSeconds(),
      HeartbeatSeconds: this.heartbeat?.toSeconds(),
      InputPath: renderJsonPath(this.inputPath),
      OutputPath: renderJsonPath(this.outputPath),
      ResultPath: renderJsonPath(this.resultPath),
      ...this.renderResultSelector(),
    };
  }
}

/**
 * Task Metrics
 */
export interface TaskMetricsConfig {
  /**
   * Prefix for singular metric names of activity actions
   *
   * @default - No such metrics
   */
  readonly metricPrefixSingular?: string;

  /**
   * Prefix for plural metric names of activity actions
   *
   * @default - No such metrics
   */
  readonly metricPrefixPlural?: string;

  /**
   * The dimensions to attach to metrics
   *
   * @default - No metrics
   */
  readonly metricDimensions?: cloudwatch.DimensionHash;
}

/**
 *
 * AWS Step Functions integrates with services directly in the Amazon States Language.
 * You can control these AWS services using service integration patterns:
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-to-resource.html
 *
 */
export enum IntegrationPattern {
  /**
   * Step Functions will wait for an HTTP response and then progress to the next state.
   *
   * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-to-resource.html#connect-default
   */
  REQUEST_RESPONSE = 'REQUEST_RESPONSE',

  /**
   * Step Functions can wait for a request to complete before progressing to the next state.
   *
   * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-to-resource.html#connect-sync
   */
  RUN_JOB = 'RUN_JOB',

  /**
   * Callback tasks provide a way to pause a workflow until a task token is returned.
   * You must set a task token when using the callback pattern
   *
   * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-to-resource.html#connect-wait-token
   */
  WAIT_FOR_TASK_TOKEN = 'WAIT_FOR_TASK_TOKEN'
}