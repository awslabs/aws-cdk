import { Metric, MetricOptions } from '@aws-cdk/aws-cloudwatch';
import { Resource } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { ILogGroup, MetricFilterOptions } from './log-group';
import { CfnMetricFilter } from './logs.generated';

/**
 * Properties for a MetricFilter
 */
export interface MetricFilterProps extends MetricFilterOptions {
  /**
   * The log group to create the filter on.
   */
  readonly logGroup: ILogGroup;
}

/**
 * A filter that extracts information from CloudWatch Logs and emits to CloudWatch Metrics
 */
export class MetricFilter extends Resource {
  private readonly metricName: string;
  private readonly metricNamespace: string;

  constructor(scope: Construct, id: string, props: MetricFilterProps) {
    super(scope, id);

    this.metricName = props.metricName;
    this.metricNamespace = props.metricNamespace;

    // It looks odd to map this object to a singleton list, but that's how
    // we're supposed to do it according to the docs.
    //
    // > Currently, you can specify only one metric transformation for
    // > each metric filter. If you want to specify multiple metric
    // > transformations, you must specify multiple metric filters.
    //
    // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-logs-metricfilter.html
    new CfnMetricFilter(this, 'Resource', {
      logGroupName: props.logGroup.logGroupName,
      filterPattern: props.filterPattern.logPatternString,
      metricTransformations: [{
        metricNamespace: props.metricNamespace,
        metricName: props.metricName,
        metricValue: props.metricValue ?? '1',
        defaultValue: props.defaultValue,
      }],
    });
  }

  /**
   * Return the given named metric for this Metric Filter
   *
   * @default avg over 5 minutes
   */
  public metric(props?: MetricOptions): Metric {
    return new Metric({
      metricName: this.metricName,
      namespace: this.metricNamespace,
      statistic: 'avg',
      ...props,
    }).attachTo(this);
  }
}
