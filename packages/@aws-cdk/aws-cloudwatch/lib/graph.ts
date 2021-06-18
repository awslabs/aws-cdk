import * as cdk from '@aws-cdk/core';
import { IAlarm } from './alarm-base';
import { IMetric } from './metric-types';
import { allMetricsGraphJson } from './private/rendering';
import { ConcreteWidget } from './widget';

/**
 * Basic properties for widgets that display metrics
 */
export interface MetricWidgetProps {
  /**
   * Title for the graph
   *
   * @default - None
   */
  readonly title?: string;

  /**
   * The region the metrics of this graph should be taken from
   *
   * @default - Current region
   */
  readonly region?: string;

  /**
   * Width of the widget, in a grid of 24 units wide
   *
   * @default 6
   */
  readonly width?: number;

  /**
   * Height of the widget
   *
   * @default - 6 for Alarm and Graph widgets.
   *   3 for single value widgets where most recent value of a metric is displayed.
   */
  readonly height?: number;
}

/**
 * Properties for a Y-Axis
 */
export interface YAxisProps {
  /**
   * The min value
   *
   * @default 0
   */
  readonly min?: number;

  /**
   * The max value
   *
   * @default - No maximum value
   */
  readonly max?: number;

  /**
   * The label
   *
   * @default - No label
   */
  readonly label?: string;

  /**
   * Whether to show units
   *
   * @default true
   */
  readonly showUnits?: boolean;
}

/**
 * Properties for an AlarmWidget
 */
export interface AlarmWidgetProps extends MetricWidgetProps {
  /**
   * The alarm to show
   */
  readonly alarm: IAlarm;

  /**
   * Left Y axis
   *
   * @default - No minimum or maximum values for the left Y-axis
   */
  readonly leftYAxis?: YAxisProps;
}

/**
 * Display the metric associated with an alarm, including the alarm line
 */
export class AlarmWidget extends ConcreteWidget {
  private readonly props: AlarmWidgetProps;

  constructor(props: AlarmWidgetProps) {
    super(props.width || 6, props.height || 6);
    this.props = props;
  }

  public toJson(): any[] {
    return [{
      type: 'metric',
      width: this.width,
      height: this.height,
      x: this.x,
      y: this.y,
      properties: {
        view: 'timeSeries',
        title: this.props.title,
        region: this.props.region || cdk.Aws.REGION,
        annotations: {
          alarms: [this.props.alarm.alarmArn],
        },
        yAxis: {
          left: this.props.leftYAxis ?? undefined,
        },
      },
    }];
  }
}

/**
 * Types of view
 */
export enum GraphWidgetView {
  /**
   * Display as a line graph.
   */
  TIME_SERIES = 'timeSeries',
  /**
   * Display as a bar graph.
   */
  BAR = 'bar',
  /**
   * Display as a pie graph.
   */
  PIE = 'pie',
}

/**
 * Properties for a GraphWidget
 */
export interface GraphWidgetProps extends MetricWidgetProps {
  /**
   * Metrics to display on left Y axis
   *
   * @default - No metrics
   */
  readonly left?: IMetric[];

  /**
   * Metrics to display on right Y axis
   *
   * @default - No metrics
   */
  readonly right?: IMetric[];

  /**
   * Annotations for the left Y axis
   *
   * @default - No annotations
   */
  readonly leftAnnotations?: HorizontalAnnotation[];

  /**
   * Annotations for the right Y axis
   *
   * @default - No annotations
   */
  readonly rightAnnotations?: HorizontalAnnotation[];

  /**
   * Whether the graph should be shown as stacked lines
   *
   * @default false
   */
  readonly stacked?: boolean;

  /**
   * Left Y axis
   *
   * @default - None
   */
  readonly leftYAxis?: YAxisProps;

  /**
   * Right Y axis
   *
   * @default - None
   */
  readonly rightYAxis?: YAxisProps;

  /**
   * Position of the legend
   *
   * @default - bottom
   */
  readonly legendPosition?: LegendPosition;

  /**
   * Whether the graph should show live data
   *
   * @default false
   */
  readonly liveData?: boolean;

  /**
   * Display this metric
   *
   * @default TimeSeries
   */
  readonly view?: GraphWidgetView;

  /**
   * Whether to show the value from the entire time range. Only applicable for Bar and Pie charts.
   *
   * If false, values will be from the most recent period of your chosen time range;
   * if true, shows the value from the entire time range.
   *
   * @default false
   */
  readonly setPeriodToTimeRange?: boolean;

  /**
   * The default period for all metrics in this widget.
   * The period is the length of time represented by one data point on the graph.
   * This default can be overridden within each metric definition.
   *
   * @default cdk.Duration.seconds(300)
   */
  readonly period?: cdk.Duration;

  /**
   * The default statistic to be displayed for each metric.
   * This default can be overridden within the definition of each individual metric
   *
   * @default - The statistic for each metric is used
   */
  readonly statistic?: string;
}

/**
 * A dashboard widget that displays metrics
 */
export class GraphWidget extends ConcreteWidget {
  private readonly props: GraphWidgetProps;

  private readonly leftMetrics: IMetric[];
  private readonly rightMetrics: IMetric[];

  constructor(props: GraphWidgetProps) {
    super(props.width || 6, props.height || 6);
    this.props = props;
    this.leftMetrics = props.left ?? [];
    this.rightMetrics = props.right ?? [];
  }

  /**
   * Add another metric to the left Y axis of the GraphWidget
   *
   * @param metric the metric to add
   */
  public addLeftMetric(metric: IMetric) {
    this.leftMetrics.push(metric);
  }

  /**
   * Add another metric to the right Y axis of the GraphWidget
   *
   * @param metric the metric to add
   */
  public addRightMetric(metric: IMetric) {
    this.rightMetrics.push(metric);
  }

  public toJson(): any[] {
    const horizontalAnnotations = [
      ...(this.props.leftAnnotations || []).map(mapAnnotation('left')),
      ...(this.props.rightAnnotations || []).map(mapAnnotation('right')),
    ];

    const metrics = allMetricsGraphJson(this.leftMetrics, this.rightMetrics);
    return [{
      type: 'metric',
      width: this.width,
      height: this.height,
      x: this.x,
      y: this.y,
      properties: {
        view: this.props.view ?? GraphWidgetView.TIME_SERIES,
        title: this.props.title,
        region: this.props.region || cdk.Aws.REGION,
        stacked: this.props.stacked,
        metrics: metrics.length > 0 ? metrics : undefined,
        annotations: horizontalAnnotations.length > 0 ? { horizontal: horizontalAnnotations } : undefined,
        yAxis: {
          left: this.props.leftYAxis ?? undefined,
          right: this.props.rightYAxis ?? undefined,
        },
        legend: this.props.legendPosition !== undefined ? { position: this.props.legendPosition } : undefined,
        liveData: this.props.liveData,
        setPeriodToTimeRange: this.props.setPeriodToTimeRange,
        period: this.props.period?.toSeconds(),
        stat: this.props.statistic,
      },
    }];
  }
}

/**
 * Properties for a SingleValueWidget
 */
export interface SingleValueWidgetProps extends MetricWidgetProps {
  /**
   * Metrics to display
   */
  readonly metrics: IMetric[];

  /**
   * Whether to show the value from the entire time range.
   *
   * @default false
   */
  readonly setPeriodToTimeRange?: boolean;

  /**
   * Whether to show as many digits as can fit, before rounding.
   *
   * @default false
   */
  readonly fullPrecision?: boolean;
}

/**
 * A dashboard widget that displays the most recent value for every metric
 */
export class SingleValueWidget extends ConcreteWidget {
  private readonly props: SingleValueWidgetProps;

  constructor(props: SingleValueWidgetProps) {
    super(props.width || 6, props.height || 3);
    this.props = props;
  }

  public toJson(): any[] {
    return [{
      type: 'metric',
      width: this.width,
      height: this.height,
      x: this.x,
      y: this.y,
      properties: {
        view: 'singleValue',
        title: this.props.title,
        region: this.props.region || cdk.Aws.REGION,
        metrics: allMetricsGraphJson(this.props.metrics, []),
        setPeriodToTimeRange: this.props.setPeriodToTimeRange,
        singleValueFullPrecision: this.props.fullPrecision,
      },
    }];
  }
}

/**
 * Horizontal annotation to be added to a graph
 */
export interface HorizontalAnnotation {
  /**
   * The value of the annotation
   */
  readonly value: number;

  /**
   * Label for the annotation
   *
   * @default - No label
   */
  readonly label?: string;

  /**
   * The hex color code, prefixed with '#' (e.g. '#00ff00'), to be used for the annotation.
   * The `Color` class has a set of standard colors that can be used here.
   *
   * @default - Automatic color
   */
  readonly color?: string;

  /**
   * Add shading above or below the annotation
   *
   * @default No shading
   */
  readonly fill?: Shading;

  /**
   * Whether the annotation is visible
   *
   * @default true
   */
  readonly visible?: boolean;
}

/**
 * Fill shading options that will be used with an annotation
 */
export enum Shading {
  /**
   * Don't add shading
   */
  NONE = 'none',

  /**
   * Add shading above the annotation
   */
  ABOVE = 'above',

  /**
   * Add shading below the annotation
   */
  BELOW = 'below'
}

/**
 * A set of standard colours that can be used in annotations in a GraphWidget.
 */
export class Color {
  /** blue - hex #1f77b4 */
  public static readonly BLUE = '#1f77b4';

  /** brown - hex #8c564b */
  public static readonly BROWN = '#8c564b';

  /** green - hex #2ca02c */
  public static readonly GREEN = '#2ca02c';

  /** grey - hex #7f7f7f */
  public static readonly GREY = '#7f7f7f';

  /** orange - hex #ff7f0e */
  public static readonly ORANGE = '#ff7f0e';

  /** pink - hex #e377c2 */
  public static readonly PINK = '#e377c2';

  /** purple - hex #9467bd */
  public static readonly PURPLE = '#9467bd';

  /** red - hex #d62728 */
  public static readonly RED = '#d62728';
}

/**
 * The position of the legend on a GraphWidget.
 */
export enum LegendPosition {
  /**
   * Legend appears below the graph (default).
   */
  BOTTOM = 'bottom',

  /**
   * Add shading above the annotation
   */
  RIGHT = 'right',

  /**
   * Add shading below the annotation
   */
  HIDDEN = 'hidden'
}

function mapAnnotation(yAxis: string): ((x: HorizontalAnnotation) => any) {
  return (a: HorizontalAnnotation) => {
    return { ...a, yAxis };
  };
}
