import * as cdk from '@aws-cdk/core';
import { LegendPosition } from './graph';
import { ConcreteWidget } from './widget';
/**
 * The number of top contributors to show.
 */
export enum TopContributors {
  /**
   * The top 10 contributors
   */
  TOP10 = 10,
  /**
   * The top 25 contributors
   */
  TOP25 = 25,
  /**
   * The top 50 contributors
   */
  TOP50 = 50,
  /**
   * The top 100 contributors
   */
  TOP100 = 100,
}

/**
 * Statistic to use over the aggregation period
 */
export enum OrderStatistic {
  /**
   * All values submitted for the matching metric added together.
   * This statistic can be useful for determining the total volume of a metric.
   */
  SUM = 'Sum',
  /**
   * The highest value observed during the specified period.
   * You can use this value to determine high volumes of activity for your application.
   */
  MAXIMUM = 'Maximum'
}

/**
 * Properties for a Contributor Insights widget
 */
export interface ContributorInsightsWidgetProps {
  /**
   * Title for the widget
   *
   * @default No title
   */
  readonly title?: string;

  /**
   * Insights rule to display
   */
  readonly ruleName: string;

  /**
   * The selection of contributors to display
   *
   * @default Top 10
   */
  readonly contributorSelection?: TopContributors;

  /**
   * Position of the legend
   *
   * @default - bottom
   */
  readonly legendPosition?: LegendPosition;

  /**
   * The region the metrics of this widget should be taken from
   *
   * @default Current region
   */
  readonly region?: string;

  /**
   * Whether the graph should be shown as stacked lines
   *
   * @default false
   */
  readonly stacked?: boolean;

  /**
   * What function to use for aggregating.
   *
   * @default Statistic.SUM
   */
  readonly statistic?: OrderStatistic;

  /**
   * The period over which the statistics are applied.
   *
   * @default Duration.minutes(5)
   */
  readonly period?: cdk.Duration;

  /**
   * Width of the widget, in a grid of 24 units wide
   *
   * @default 6
   */
  readonly width?: number;

  /**
   * Height of the widget
   *
   * @default 6
   */
  readonly height?: number;

  /**
   * Account the contributor insights data comes from
   *
   * @default Deployment account
   */
  readonly account?: string;
}

/**
 * Display contributor insights
 */
export class ContributorInsightsWidget extends ConcreteWidget {
  private readonly props: ContributorInsightsWidgetProps;
  private period: number;

  constructor(props: ContributorInsightsWidgetProps) {
    super(props.width || 6, props.height || 6);

    this.period = (props.period || cdk.Duration.minutes(5)).toSeconds();
    if (![60, 300, 900, 3600, 21600, 86400].includes(this.period)) {
      throw new Error(
        `'period' must be 60s, 300s, 900s, 3600s, 21600s, or 86400s, received ${this.period}`,
      );
    }
    this.props = props;
  }

  public toJson(): any[] {
    return [
      {
        type: 'metric',
        width: this.width,
        height: this.height,
        x: this.x,
        y: this.y,
        stacked: this.props.stacked || false,
        properties: {
          accountId: this.props.account,
          period: this.period,
          view: 'timeSeries',
          title: this.props.title,
          region: this.props.region || cdk.Aws.REGION,
          insightRule: {
            maxContributorCount:
              this.props.contributorSelection || TopContributors.TOP10,
            orderBy: this.props.statistic || OrderStatistic.SUM,
            ruleName: this.props.ruleName,
          },
          legend:
            this.props.legendPosition !== undefined
              ? { position: this.props.legendPosition }
              : undefined,
        },
      },
    ];
  }
}
