import { Lazy, Stack, Token } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { IAlarmAction } from './alarm-action';
import { AlarmBase, IAlarm } from './alarm-base';
import { CfnAlarm, CfnAlarmProps } from './cloudwatch.generated';
import { HorizontalAnnotation } from './graph';
import { CreateAlarmOptions } from './metric';
import { IMetric, MetricExpressionConfig, MetricStatConfig } from './metric-types';
import { dispatchMetric, metricPeriod } from './private/metric-util';
import { dropUndefined } from './private/object';
import { MetricSet } from './private/rendering';
import { parseStatistic } from './private/statistic';

/**
 * Properties for Alarms
 */
export interface AlarmProps extends CreateAlarmOptions {
  /**
   * The metric to add the alarm on
   *
   * Metric objects can be obtained from most resources, or you can construct
   * custom Metric objects by instantiating one.
   */
  readonly metric: IMetric;
}

/**
 * Comparison operator for evaluating alarms
 */
export enum ComparisonOperator {
  /**
   * Specified statistic is greater than or equal to the threshold
   */
  GREATER_THAN_OR_EQUAL_TO_THRESHOLD = 'GreaterThanOrEqualToThreshold',

  /**
   * Specified statistic is strictly greater than the threshold
   */
  GREATER_THAN_THRESHOLD = 'GreaterThanThreshold',

  /**
   * Specified statistic is strictly less than the threshold
   */
  LESS_THAN_THRESHOLD = 'LessThanThreshold',

  /**
   * Specified statistic is less than or equal to the threshold.
   */
  LESS_THAN_OR_EQUAL_TO_THRESHOLD = 'LessThanOrEqualToThreshold',

  /**
   * Specified statistic is lower than or greater than the anomaly model band.
   * Used only for alarms based on anomaly detection models
   */
  LESS_THAN_LOWER_OR_GREATER_THAN_UPPER_THRESHOLD = 'LessThanLowerOrGreaterThanUpperThreshold',

  /**
   * Specified statistic is greater than the anomaly model band.
   * Used only for alarms based on anomaly detection models
   */
  GREATER_THAN_UPPER_THRESHOLD = 'GreaterThanUpperThreshold',

  /**
   * Specified statistic is lower than the anomaly model band.
   * Used only for alarms based on anomaly detection models
   */
  LESS_THAN_LOWER_THRESHOLD = 'LessThanLowerThreshold',
}

const OPERATOR_SYMBOLS: {[key: string]: string} = {
  GreaterThanOrEqualToThreshold: '>=',
  GreaterThanThreshold: '>',
  LessThanThreshold: '<',
  LessThanOrEqualToThreshold: '<=',
};

/**
 * Specify how missing data points are treated during alarm evaluation
 */
export enum TreatMissingData {
  /**
   * Missing data points are treated as breaching the threshold
   */
  BREACHING = 'breaching',

  /**
   * Missing data points are treated as being within the threshold
   */
  NOT_BREACHING = 'notBreaching',

  /**
   * The current alarm state is maintained
   */
  IGNORE = 'ignore',

  /**
   * The alarm does not consider missing data points when evaluating whether to change state
   */
  MISSING = 'missing'
}

/**
 * An alarm on a CloudWatch metric
 */
export class Alarm extends AlarmBase {
  /**
   * Import an existing CloudWatch alarm provided an ARN
   *
   * @param scope The parent creating construct (usually `this`).
   * @param id The construct's name
   * @param alarmArn Alarm ARN (i.e. arn:aws:cloudwatch:<region>:<account-id>:alarm:Foo)
   */
  public static fromAlarmArn(scope: Construct, id: string, alarmArn: string): IAlarm {
    class Import extends AlarmBase implements IAlarm {
      public readonly alarmArn = alarmArn;
      public readonly alarmName = Stack.of(scope).parseArn(alarmArn, ':').resourceName!;
    }
    return new Import(scope, id);
  }

  /**
   * ARN of this alarm
   *
   * @attribute
   */
  public readonly alarmArn: string;

  /**
   * Name of this alarm.
   *
   * @attribute
   */
  public readonly alarmName: string;

  /**
   * The metric object this alarm was based on
   */
  public readonly metric: IMetric;

  /**
   * This metric as an annotation
   */
  private readonly annotation: HorizontalAnnotation;

  constructor(scope: Construct, id: string, props: AlarmProps) {
    super(scope, id, {
      physicalName: props.alarmName,
    });

    const comparisonOperator = props.comparisonOperator || ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD;

    // Render metric, process potential overrides from the alarm
    // (It would be preferable if the statistic etc. was worked into the metric,
    // but hey we're allowing overrides...)
    const metricProps: Writeable<Partial<CfnAlarmProps>> = this.renderMetric(props.metric);
    if (props.period) {
      metricProps.period = props.period.toSeconds();
    }
    if (props.statistic) {
      // Will overwrite both fields if present
      Object.assign(metricProps, {
        statistic: renderIfSimpleStatistic(props.statistic),
        extendedStatistic: renderIfExtendedStatistic(props.statistic),
      });
    }

    const alarm = new CfnAlarm(this, 'Resource', {
      // Meta
      alarmDescription: props.alarmDescription,
      alarmName: this.physicalName,

      // Evaluation
      comparisonOperator,
      threshold: props.threshold,
      datapointsToAlarm: props.datapointsToAlarm,
      evaluateLowSampleCountPercentile: props.evaluateLowSampleCountPercentile,
      evaluationPeriods: props.evaluationPeriods,
      treatMissingData: props.treatMissingData,

      // Actions
      actionsEnabled: props.actionsEnabled,
      alarmActions: Lazy.list({ produce: () => this.alarmActionArns }),
      insufficientDataActions: Lazy.list({ produce: (() => this.insufficientDataActionArns) }),
      okActions: Lazy.list({ produce: () => this.okActionArns }),

      // Metric
      ...metricProps,
    });

    this.alarmArn = this.getResourceArnAttribute(alarm.attrArn, {
      service: 'cloudwatch',
      resource: 'alarm',
      resourceName: this.physicalName,
      sep: ':',
    });
    this.alarmName = this.getResourceNameAttribute(alarm.ref);

    this.metric = props.metric;
    const datapoints = props.datapointsToAlarm || props.evaluationPeriods;
    this.annotation = {
      // eslint-disable-next-line max-len
      label: `${this.metric} ${OPERATOR_SYMBOLS[comparisonOperator]} ${props.threshold} for ${datapoints} datapoints within ${describePeriod(props.evaluationPeriods * metricPeriod(props.metric).toSeconds())}`,
      value: props.threshold,
    };
  }

  /**
   * Turn this alarm into a horizontal annotation
   *
   * This is useful if you want to represent an Alarm in a non-AlarmWidget.
   * An `AlarmWidget` can directly show an alarm, but it can only show a
   * single alarm and no other metrics. Instead, you can convert the alarm to
   * a HorizontalAnnotation and add it as an annotation to another graph.
   *
   * This might be useful if:
   *
   * - You want to show multiple alarms inside a single graph, for example if
   *   you have both a "small margin/long period" alarm as well as a
   *   "large margin/short period" alarm.
   *
   * - You want to show an Alarm line in a graph with multiple metrics in it.
   */
  public toAnnotation(): HorizontalAnnotation {
    return this.annotation;
  }

  /**
   * Trigger this action if the alarm fires
   *
   * Typically the ARN of an SNS topic or ARN of an AutoScaling policy.
   */
  public addAlarmAction(...actions: IAlarmAction[]) {
    if (this.alarmActionArns === undefined) {
      this.alarmActionArns = [];
    }

    this.alarmActionArns.push(...actions.map(a =>
      this.validateActionArn(a.bind(this, this).alarmActionArn),
    ));
  }

  private validateActionArn(actionArn: string): string {
    const ec2ActionsRegexp: RegExp = /arn:aws:automate:[a-z|\d|-]+:ec2:[a-z]+/;
    if (ec2ActionsRegexp.test(actionArn)) {
      // Check per-instance metric
      const metricConfig = this.metric.toMetricConfig();
      if (metricConfig.metricStat?.dimensions?.length != 1 || metricConfig.metricStat?.dimensions![0].name != 'InstanceId') {
        throw new Error(`EC2 alarm actions requires an EC2 Per-Instance Metric. (${JSON.stringify(metricConfig)} does not have an 'InstanceId' dimension)`);
      }
    }
    return actionArn;
  }

  private renderMetric(metric: IMetric) {
    const self = this;
    return dispatchMetric(metric, {
      withStat(stat, conf) {
        self.validateMetricStat(stat, metric);
        if (conf.renderingProperties?.label == undefined) {
          return dropUndefined({
            dimensions: stat.dimensions,
            namespace: stat.namespace,
            metricName: stat.metricName,
            period: stat.period?.toSeconds(),
            statistic: renderIfSimpleStatistic(stat.statistic),
            extendedStatistic: renderIfExtendedStatistic(stat.statistic),
            unit: stat.unitFilter,
          });
        }

        return {
          metrics: [
            {
              metricStat: {
                metric: {
                  metricName: stat.metricName,
                  namespace: stat.namespace,
                  dimensions: stat.dimensions,
                },
                period: stat.period.toSeconds(),
                stat: stat.statistic,
                unit: stat.unitFilter,
              },
              id: 'm1',
              label: conf.renderingProperties?.label,
              returnData: true,
            } as CfnAlarm.MetricDataQueryProperty,
          ],
        };
      },

      withExpression() {
        // Expand the math expression metric into a set
        const mset = new MetricSet<boolean>();
        mset.addTopLevel(true, metric);

        let eid = 0;
        function uniqueMetricId() {
          return `expr_${++eid}`;
        }

        return {
          metrics: mset.entries.map(entry => dispatchMetric(entry.metric, {
            withStat(stat, conf) {
              self.validateMetricStat(stat, entry.metric);

              return {
                metricStat: {
                  metric: {
                    metricName: stat.metricName,
                    namespace: stat.namespace,
                    dimensions: stat.dimensions,
                  },
                  period: stat.period.toSeconds(),
                  stat: stat.statistic,
                  unit: stat.unitFilter,
                },
                id: entry.id || uniqueMetricId(),
                label: conf.renderingProperties?.label,
                returnData: entry.tag ? undefined : false, // Tag stores "primary" attribute, default is "true"
              };
            },
            withExpression(expr, conf) {
              const hasSubmetrics = mathExprHasSubmetrics(expr);

              if (hasSubmetrics) {
                assertSubmetricsCount(expr);
              }

              return {
                expression: expr.expression,
                id: entry.id || uniqueMetricId(),
                label: conf.renderingProperties?.label,
                period: hasSubmetrics ? undefined : expr.period,
                returnData: entry.tag ? undefined : false, // Tag stores "primary" attribute, default is "true"
              };
            },
          }) as CfnAlarm.MetricDataQueryProperty),
        };
      },
    });
  }

  /**
   * Validate that if a region and account are in the given stat config, they match the Alarm
   */
  private validateMetricStat(stat: MetricStatConfig, metric: IMetric) {
    const stack = Stack.of(this);

    if (definitelyDifferent(stat.region, stack.region)) {
      throw new Error(`Cannot create an Alarm in region '${stack.region}' based on metric '${metric}' in '${stat.region}'`);
    }
    if (definitelyDifferent(stat.account, stack.account)) {
      throw new Error(`Cannot create an Alarm in account '${stack.account}' based on metric '${metric}' in '${stat.account}'`);
    }
  }
}

function definitelyDifferent(x: string | undefined, y: string) {
  return x && !Token.isUnresolved(y) && x !== y;
}

/**
 * Return a human readable string for this period
 *
 * We know the seconds are always one of a handful of allowed values.
 */
function describePeriod(seconds: number) {
  if (seconds === 60) { return '1 minute'; }
  if (seconds === 1) { return '1 second'; }
  if (seconds > 60) { return (seconds / 60) + ' minutes'; }
  return seconds + ' seconds';
}

function renderIfSimpleStatistic(statistic?: string): string | undefined {
  if (statistic === undefined) { return undefined; }

  const parsed = parseStatistic(statistic);
  if (parsed.type === 'simple') {
    return parsed.statistic;
  }
  return undefined;
}

function renderIfExtendedStatistic(statistic?: string): string | undefined {
  if (statistic === undefined) { return undefined; }

  const parsed = parseStatistic(statistic);
  if (parsed.type === 'percentile') {
    // Already percentile. Avoid parsing because we might get into
    // floating point rounding issues, return as-is but lowercase the p.
    return statistic.toLowerCase();
  }
  return undefined;
}

function mathExprHasSubmetrics(expr: MetricExpressionConfig) {
  return Object.keys(expr.usingMetrics).length > 0;
}

function assertSubmetricsCount(expr: MetricExpressionConfig) {
  if (Object.keys(expr.usingMetrics).length > 10) {
    // https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html#alarms-on-metric-math-expressions
    throw new Error('Alarms on math expressions cannot contain more than 10 individual metrics');
  };
}

type Writeable<T> = { -readonly [P in keyof T]: T[P] };
