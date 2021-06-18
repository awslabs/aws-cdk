import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import * as constructs from 'constructs';
import { Alarm, ComparisonOperator, TreatMissingData } from './alarm';
import { Dimension, IMetric, MetricAlarmConfig, MetricConfig, MetricGraphConfig, Unit } from './metric-types';
import { dispatchMetric, metricKey } from './private/metric-util';
import { normalizeStatistic, parseStatistic } from './private/statistic';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

export type DimensionHash = {[dim: string]: any};

export type DimensionsMap = { [dim: string]: string };

/**
 * Options shared by most methods accepting metric options
 */
export interface CommonMetricOptions {
  /**
   * The period over which the specified statistic is applied.
   *
   * @default Duration.minutes(5)
   */
  readonly period?: cdk.Duration;

  /**
   * What function to use for aggregating.
   *
   * Can be one of the following:
   *
   * - "Minimum" | "min"
   * - "Maximum" | "max"
   * - "Average" | "avg"
   * - "Sum" | "sum"
   * - "SampleCount | "n"
   * - "pNN.NN"
   *
   * @default Average
   */
  readonly statistic?: string;

  /**
   * Dimensions of the metric
   *
   * @default - No dimensions.
   *
   * @deprecated Use 'dimensionsMap' instead.
   */
  readonly dimensions?: DimensionHash;

  /**
   * Dimensions of the metric
   *
   * @default - No dimensions.
   */
  readonly dimensionsMap?: DimensionsMap;

  /**
   * Unit used to filter the metric stream
   *
   * Only refer to datums emitted to the metric stream with the given unit and
   * ignore all others. Only useful when datums are being emitted to the same
   * metric stream under different units.
   *
   * The default is to use all matric datums in the stream, regardless of unit,
   * which is recommended in nearly all cases.
   *
   * CloudWatch does not honor this property for graphs.
   *
   * @default - All metric datums in the given metric stream
   */
  readonly unit?: Unit;

  /**
   * Label for this metric when added to a Graph in a Dashboard
   * @default - No label
   */
  readonly label?: string;

  /**
   * The hex color code, prefixed with '#' (e.g. '#00ff00'), to use when this metric is rendered on a graph.
   * The `Color` class has a set of standard colors that can be used here.
   * @default - Automatic color
   */
  readonly color?: string;

  /**
   * Account which this metric comes from.
   *
   * @default - Deployment account.
   */
  readonly account?: string;

  /**
   * Region which this metric comes from.
   *
   * @default - Deployment region.
   */
  readonly region?: string;
}

/**
 * Properties for a metric
 */
export interface MetricProps extends CommonMetricOptions {
  /**
   * Namespace of the metric.
   */
  readonly namespace: string;

  /**
   * Name of the metric.
   */
  readonly metricName: string;
}

/**
 * Properties of a metric that can be changed
 */
export interface MetricOptions extends CommonMetricOptions {
}

/**
 * Configurable options for MathExpressions
 */
export interface MathExpressionOptions {
  /**
   * Label for this metric when added to a Graph in a Dashboard
   *
   * @default - Expression value is used as label
   */
  readonly label?: string;

  /**
   * Color for this metric when added to a Graph in a Dashboard
   *
   * @default - Automatic color
   */
  readonly color?: string;

  /**
   * The period over which the expression's statistics are applied.
   *
   * This period overrides all periods in the metrics used in this
   * math expression.
   *
   * @default Duration.minutes(5)
   */
  readonly period?: cdk.Duration;
}

/**
 * Properties for a MathExpression
 */
export interface MathExpressionProps extends MathExpressionOptions {
  /**
   * The expression defining the metric.
   */
  readonly expression: string;

  /**
   * The metrics used in the expression, in a map.
   *
   * The key is the identifier that represents the given metric in the
   * expression, and the value is the actual Metric object.
   */
  readonly usingMetrics: Record<string, IMetric>;
}

/**
 * A metric emitted by a service
 *
 * The metric is a combination of a metric identifier (namespace, name and dimensions)
 * and an aggregation function (statistic, period and unit).
 *
 * It also contains metadata which is used only in graphs, such as color and label.
 * It makes sense to embed this in here, so that compound constructs can attach
 * that metadata to metrics they expose.
 *
 * This class does not represent a resource, so hence is not a construct. Instead,
 * Metric is an abstraction that makes it easy to specify metrics for use in both
 * alarms and graphs.
 */
export class Metric implements IMetric {
  /**
   * Grant permissions to the given identity to write metrics.
   *
   * @param grantee The IAM identity to give permissions to.
   */
  public static grantPutMetricData(grantee: iam.IGrantable): iam.Grant {
    return iam.Grant.addToPrincipal({
      grantee,
      actions: ['cloudwatch:PutMetricData'],
      resourceArns: ['*'],
    });
  }

  /** Dimensions of this metric */
  public readonly dimensions?: DimensionHash;
  /** Namespace of this metric */
  public readonly namespace: string;
  /** Name of this metric */
  public readonly metricName: string;
  /** Period of this metric */
  public readonly period: cdk.Duration;
  /** Statistic of this metric */
  public readonly statistic: string;
  /** Label for this metric when added to a Graph in a Dashboard */
  public readonly label?: string;
  /** The hex color code used when this metric is rendered on a graph. */
  public readonly color?: string;

  /** Unit of the metric. */
  public readonly unit?: Unit;

  /** Account which this metric comes from */
  public readonly account?: string;

  /** Region which this metric comes from. */
  public readonly region?: string;

  constructor(props: MetricProps) {
    this.period = props.period || cdk.Duration.minutes(5);
    const periodSec = this.period.toSeconds();
    if (periodSec !== 1 && periodSec !== 5 && periodSec !== 10 && periodSec !== 30 && periodSec % 60 !== 0) {
      throw new Error(`'period' must be 1, 5, 10, 30, or a multiple of 60 seconds, received ${periodSec}`);
    }
    this.dimensions = this.validateDimensions(props.dimensionsMap ?? props.dimensions);
    this.namespace = props.namespace;
    this.metricName = props.metricName;
    // Try parsing, this will throw if it's not a valid stat
    this.statistic = normalizeStatistic(props.statistic || 'Average');
    this.label = props.label;
    this.color = props.color;
    this.unit = props.unit;
    this.account = props.account;
    this.region = props.region;
  }

  /**
   * Return a copy of Metric `with` properties changed.
   *
   * All properties except namespace and metricName can be changed.
   *
   * @param props The set of properties to change.
   */
  public with(props: MetricOptions): Metric {
    // Short-circuit creating a new object if there would be no effective change
    if ((props.label === undefined || props.label === this.label)
      && (props.color === undefined || props.color === this.color)
      && (props.statistic === undefined || props.statistic === this.statistic)
      && (props.unit === undefined || props.unit === this.unit)
      && (props.account === undefined || props.account === this.account)
      && (props.region === undefined || props.region === this.region)
      // For these we're not going to do deep equality, misses some opportunity for optimization
      // but that's okay.
      && (props.dimensions === undefined)
      && (props.dimensionsMap === undefined)
      && (props.period === undefined || props.period.toSeconds() === this.period.toSeconds())) {
      return this;
    }

    return new Metric({
      dimensions: ifUndefined(props.dimensions, this.dimensions),
      dimensionsMap: props.dimensionsMap,
      namespace: this.namespace,
      metricName: this.metricName,
      period: ifUndefined(props.period, this.period),
      statistic: ifUndefined(props.statistic, this.statistic),
      unit: ifUndefined(props.unit, this.unit),
      label: ifUndefined(props.label, this.label),
      color: ifUndefined(props.color, this.color),
      account: ifUndefined(props.account, this.account),
      region: ifUndefined(props.region, this.region),
    });
  }

  /**
   * Attach the metric object to the given construct scope
   *
   * Returns a Metric object that uses the account and region from the Stack
   * the given construct is defined in. If the metric is subsequently used
   * in a Dashboard or Alarm in a different Stack defined in a different
   * account or region, the appropriate 'region' and 'account' fields
   * will be added to it.
   *
   * If the scope we attach to is in an environment-agnostic stack,
   * nothing is done and the same Metric object is returned.
   */
  public attachTo(scope: constructs.IConstruct): Metric {
    const stack = cdk.Stack.of(scope);

    return this.with({
      region: cdk.Token.isUnresolved(stack.region) ? undefined : stack.region,
      account: cdk.Token.isUnresolved(stack.account) ? undefined : stack.account,
    });
  }

  public toMetricConfig(): MetricConfig {
    const dims = this.dimensionsAsList();
    return {
      metricStat: {
        dimensions: dims.length > 0 ? dims : undefined,
        namespace: this.namespace,
        metricName: this.metricName,
        period: this.period,
        statistic: this.statistic,
        unitFilter: this.unit,
        account: this.account,
        region: this.region,
      },
      renderingProperties: {
        color: this.color,
        label: this.label,
      },
    };
  }

  /** @deprecated use toMetricConfig() */
  public toAlarmConfig(): MetricAlarmConfig {
    const metricConfig = this.toMetricConfig();
    if (metricConfig.metricStat === undefined) {
      throw new Error('Using a math expression is not supported here. Pass a \'Metric\' object instead');
    }

    const stat = parseStatistic(metricConfig.metricStat.statistic);
    return {
      dimensions: metricConfig.metricStat.dimensions,
      namespace: metricConfig.metricStat.namespace,
      metricName: metricConfig.metricStat.metricName,
      period: metricConfig.metricStat.period.toSeconds(),
      statistic: stat.type === 'simple' ? stat.statistic : undefined,
      extendedStatistic: stat.type === 'percentile' ? 'p' + stat.percentile : undefined,
      unit: this.unit,
    };
  }

  /**
   * @deprecated use toMetricConfig()
   */
  public toGraphConfig(): MetricGraphConfig {
    const metricConfig = this.toMetricConfig();
    if (metricConfig.metricStat === undefined) {
      throw new Error('Using a math expression is not supported here. Pass a \'Metric\' object instead');
    }

    return {
      dimensions: metricConfig.metricStat.dimensions,
      namespace: metricConfig.metricStat.namespace,
      metricName: metricConfig.metricStat.metricName,
      renderingProperties: {
        period: metricConfig.metricStat.period.toSeconds(),
        stat: metricConfig.metricStat.statistic,
        color: asString(metricConfig.renderingProperties?.color),
        label: asString(metricConfig.renderingProperties?.label),
      },
      // deprecated properties for backwards compatibility
      period: metricConfig.metricStat.period.toSeconds(),
      statistic: metricConfig.metricStat.statistic,
      color: asString(metricConfig.renderingProperties?.color),
      label: asString(metricConfig.renderingProperties?.label),
      unit: this.unit,
    };
  }

  /**
   * Make a new Alarm for this metric
   *
   * Combines both properties that may adjust the metric (aggregation) as well
   * as alarm properties.
   */
  public createAlarm(scope: Construct, id: string, props: CreateAlarmOptions): Alarm {
    return new Alarm(scope, id, {
      metric: this.with({
        statistic: props.statistic,
        period: props.period,
      }),
      alarmName: props.alarmName,
      alarmDescription: props.alarmDescription,
      comparisonOperator: props.comparisonOperator,
      datapointsToAlarm: props.datapointsToAlarm,
      threshold: props.threshold,
      evaluationPeriods: props.evaluationPeriods,
      evaluateLowSampleCountPercentile: props.evaluateLowSampleCountPercentile,
      treatMissingData: props.treatMissingData,
      actionsEnabled: props.actionsEnabled,
    });
  }

  public toString() {
    return this.label || this.metricName;
  }

  /**
   * Return the dimensions of this Metric as a list of Dimension.
   */
  private dimensionsAsList(): Dimension[] {
    const dims = this.dimensions;

    if (dims === undefined) {
      return [];
    }

    const list = Object.keys(dims).sort().map(key => ({ name: key, value: dims[key] }));

    return list;
  }

  private validateDimensions(dims?: DimensionHash): DimensionHash | undefined {
    if (!dims) {
      return dims;
    }

    var dimsArray = Object.keys(dims);
    if (dimsArray?.length > 10) {
      throw new Error(`The maximum number of dimensions is 10, received ${dimsArray.length}`);
    }

    dimsArray.map(key => {
      if (dims[key] === undefined || dims[key] === null) {
        throw new Error(`Dimension value of '${dims[key]}' is invalid`);
      };
      if (key.length < 1 || key.length > 255) {
        throw new Error(`Dimension name must be at least 1 and no more than 255 characters; received ${key}`);
      };

      if (dims[key].length < 1 || dims[key].length > 255) {
        throw new Error(`Dimension value must be at least 1 and no more than 255 characters; received ${dims[key]}`);
      };
    });

    return dims;
  }
}

function asString(x?: unknown): string | undefined {
  if (x === undefined) { return undefined; }
  if (typeof x !== 'string') {
    throw new Error(`Expected string, got ${x}`);
  }
  return x;
}

/**
 * A math expression built with metric(s) emitted by a service
 *
 * The math expression is a combination of an expression (x+y) and metrics to apply expression on.
 * It also contains metadata which is used only in graphs, such as color and label.
 * It makes sense to embed this in here, so that compound constructs can attach
 * that metadata to metrics they expose.
 *
 * This class does not represent a resource, so hence is not a construct. Instead,
 * MathExpression is an abstraction that makes it easy to specify metrics for use in both
 * alarms and graphs.
 */
export class MathExpression implements IMetric {
  /**
   * The expression defining the metric.
   */
  public readonly expression: string;

  /**
   * The metrics used in the expression as KeyValuePair <id, metric>.
   */
  public readonly usingMetrics: Record<string, IMetric>;

  /**
   * Label for this metric when added to a Graph.
   */
  public readonly label?: string;

  /**
   * The hex color code, prefixed with '#' (e.g. '#00ff00'), to use when this metric is rendered on a graph.
   * The `Color` class has a set of standard colors that can be used here.
   */
  public readonly color?: string;

  /**
   * Aggregation period of this metric
   */
  public readonly period: cdk.Duration;

  constructor(props: MathExpressionProps) {
    this.period = props.period || cdk.Duration.minutes(5);
    this.expression = props.expression;
    this.usingMetrics = changeAllPeriods(props.usingMetrics, this.period);
    this.label = props.label;
    this.color = props.color;

    const invalidVariableNames = Object.keys(props.usingMetrics).filter(x => !validVariableName(x));
    if (invalidVariableNames.length > 0) {
      throw new Error(`Invalid variable names in expression: ${invalidVariableNames}. Must start with lowercase letter and only contain alphanumerics.`);
    }

    this.validateNoIdConflicts();
  }

  /**
   * Return a copy of Metric with properties changed.
   *
   * All properties except namespace and metricName can be changed.
   *
   * @param props The set of properties to change.
   */
  public with(props: MathExpressionOptions): MathExpression {
    // Short-circuit creating a new object if there would be no effective change
    if ((props.label === undefined || props.label === this.label)
      && (props.color === undefined || props.color === this.color)
      && (props.period === undefined || props.period.toSeconds() === this.period.toSeconds())) {
      return this;
    }

    return new MathExpression({
      expression: this.expression,
      usingMetrics: this.usingMetrics,
      label: ifUndefined(props.label, this.label),
      color: ifUndefined(props.color, this.color),
      period: ifUndefined(props.period, this.period),
    });
  }

  /**
   * @deprecated use toMetricConfig()
   */
  public toAlarmConfig(): MetricAlarmConfig {
    throw new Error('Using a math expression is not supported here. Pass a \'Metric\' object instead');
  }

  /**
   * @deprecated use toMetricConfig()
   */
  public toGraphConfig(): MetricGraphConfig {
    throw new Error('Using a math expression is not supported here. Pass a \'Metric\' object instead');
  }

  public toMetricConfig(): MetricConfig {
    return {
      mathExpression: {
        period: this.period.toSeconds(),
        expression: this.expression,
        usingMetrics: this.usingMetrics,
      },
      renderingProperties: {
        label: this.label,
        color: this.color,
      },
    };
  }

  /**
   * Make a new Alarm for this metric
   *
   * Combines both properties that may adjust the metric (aggregation) as well
   * as alarm properties.
   */
  public createAlarm(scope: Construct, id: string, props: CreateAlarmOptions): Alarm {
    return new Alarm(scope, id, {
      metric: this.with({
        period: props.period,
      }),
      alarmName: props.alarmName,
      alarmDescription: props.alarmDescription,
      comparisonOperator: props.comparisonOperator,
      datapointsToAlarm: props.datapointsToAlarm,
      threshold: props.threshold,
      evaluationPeriods: props.evaluationPeriods,
      evaluateLowSampleCountPercentile: props.evaluateLowSampleCountPercentile,
      treatMissingData: props.treatMissingData,
      actionsEnabled: props.actionsEnabled,
    });
  }

  public toString() {
    return this.label || this.expression;
  }

  private validateNoIdConflicts() {
    const seen = new Map<string, IMetric>();
    visit(this);

    function visit(metric: IMetric) {
      dispatchMetric(metric, {
        withStat() {
          // Nothing
        },
        withExpression(expr) {
          for (const [id, subMetric] of Object.entries(expr.usingMetrics)) {
            const existing = seen.get(id);
            if (existing && metricKey(existing) !== metricKey(subMetric)) {
              throw new Error(`The ID '${id}' used for two metrics in the expression: '${subMetric}' and '${existing}'. Rename one.`);
            }
            seen.set(id, subMetric);
            visit(subMetric);
          }
        },
      });
    }
  }
}

const VALID_VARIABLE = new RegExp('^[a-z][a-zA-Z0-9_]*$');

function validVariableName(x: string) {
  return VALID_VARIABLE.test(x);
}

/**
 * Properties needed to make an alarm from a metric
 */
export interface CreateAlarmOptions {
  /**
   * The period over which the specified statistic is applied.
   *
   * Cannot be used with `MathExpression` objects.
   *
   * @default - The period from the metric
   * @deprecated Use `metric.with({ period: ... })` to encode the period into the Metric object
   */
  readonly period?: cdk.Duration;

  /**
   * What function to use for aggregating.
   *
   * Can be one of the following:
   *
   * - "Minimum" | "min"
   * - "Maximum" | "max"
   * - "Average" | "avg"
   * - "Sum" | "sum"
   * - "SampleCount | "n"
   * - "pNN.NN"
   *
   * Cannot be used with `MathExpression` objects.
   *
   * @default - The statistic from the metric
   * @deprecated Use `metric.with({ statistic: ... })` to encode the period into the Metric object
   */
  readonly statistic?: string;

  /**
   * Name of the alarm
   *
   * @default Automatically generated name
   */
  readonly alarmName?: string;

  /**
   * Description for the alarm
   *
   * @default No description
   */
  readonly alarmDescription?: string;

  /**
   * Comparison to use to check if metric is breaching
   *
   * @default GreaterThanOrEqualToThreshold
   */
  readonly comparisonOperator?: ComparisonOperator;

  /**
   * The value against which the specified statistic is compared.
   */
  readonly threshold: number;

  /**
   * The number of periods over which data is compared to the specified threshold.
   */
  readonly evaluationPeriods: number;

  /**
   * Specifies whether to evaluate the data and potentially change the alarm state if there are too few data points to be statistically significant.
   *
   * Used only for alarms that are based on percentiles.
   *
   * @default - Not configured.
   */
  readonly evaluateLowSampleCountPercentile?: string;

  /**
   * Sets how this alarm is to handle missing data points.
   *
   * @default TreatMissingData.Missing
   */
  readonly treatMissingData?: TreatMissingData;

  /**
   * Whether the actions for this alarm are enabled
   *
   * @default true
   */
  readonly actionsEnabled?: boolean;

  /**
   * The number of datapoints that must be breaching to trigger the alarm. This is used only if you are setting an "M
   * out of N" alarm. In that case, this value is the M. For more information, see Evaluating an Alarm in the Amazon
   * CloudWatch User Guide.
   *
   * @default ``evaluationPeriods``
   *
   * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html#alarm-evaluation
   */
  readonly datapointsToAlarm?: number;
}

function ifUndefined<T>(x: T | undefined, def: T | undefined): T | undefined {
  if (x !== undefined) {
    return x;
  }
  return def;
}

/**
 * Change periods of all metrics in the map
 */
function changeAllPeriods(metrics: Record<string, IMetric>, period: cdk.Duration): Record<string, IMetric> {
  const ret: Record<string, IMetric> = {};
  for (const [id, metric] of Object.entries(metrics)) {
    ret[id] = changePeriod(metric, period);
  }
  return ret;
}

/**
 * Return a new metric object which is the same type as the input object, but with the period changed
 *
 * Relies on the fact that implementations of `IMetric` are also supposed to have
 * an implementation of `with` that accepts an argument called `period`. See `IModifiableMetric`.
 */
function changePeriod(metric: IMetric, period: cdk.Duration): IMetric {
  if (isModifiableMetric(metric)) {
    return metric.with({ period });
  }

  throw new Error(`Metric object should also implement 'with': ${metric}`);
}

/**
 * Private protocol for metrics
 *
 * Metric types used in a MathExpression need to implement at least this:
 * a `with` method that takes at least a `period` and returns a modified copy
 * of the metric object.
 *
 * We put it here instead of on `IMetric` because there is no way to type
 * it in jsii in a way that concrete implementations `Metric` and `MathExpression`
 * can be statically typable about the fields that are changeable: all
 * `with` methods would need to take the same argument type, but not all
 * classes have the same `with`-able properties.
 *
 * This class exists to prevent having to use `instanceof` in the `changePeriod`
 * function, so that we have a system where in principle new implementations
 * of `IMetric` can be added. Because it will be rare, the mechanism doesn't have
 * to be exposed very well, just has to be possible.
 */
interface IModifiableMetric {
  with(options: { period?: cdk.Duration }): IMetric;
}

function isModifiableMetric(m: any): m is IModifiableMetric {
  return typeof m === 'object' && m !== null && !!m.with;
}
