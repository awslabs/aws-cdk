import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import { Names } from '@aws-cdk/core';
import { singletonEventRole } from './util';

/**
 * Customize the EventBridge Api Destinations Target
 * @experimental
 */
export interface ApiDestinationProps {
  /**
   * The event to send
   *
   * @default the entire EventBridge event
   */
  readonly event?: events.RuleTargetInput;

  /**
   * The headers that need to be sent as part of request invoking the API Gateway REST API
   * or EventBridge Api destinations.
   *
   * @default none
   */
  readonly headerParameters?: { [key: string]: string };
    /**
   * The path parameter values to be used to populate API Gateway REST API
   * or EventBridge Api destinations path wildcards ("*")
   *
   * @default none
   */
  readonly pathParameterValues?: string[]
    /**
   * The query string keys/values that need to be sent as part of request invoking the API Gateway REST API
   *  or EventBridge Api destination.
   *
   * @default none
   */
  readonly queryStringParameters?: { [key: string]: string };


}

/**
 * Use an API Destination rule target.
 * @experimental
 */
export class ApiDestination implements events.IRuleTarget {
  constructor(
    private readonly connection: events.Connection,
    private readonly props: ApiDestinationProps = {},
  ) { }

  /**
   * Returns a RuleTarget that can be used to trigger API destinations
   * from an EventBridge event.
   */
  public bind(rule: events.IRule, _id?: string): events.RuleTargetConfig {
    const httpParameters: events.CfnRule.HttpParametersProperty = {
        headerParameters: this.props.headerParameters,
        pathParameterValues: this.props.pathParameterValues,
        queryStringParameters: this.props.queryStringParameters,
    };

    return {
      arn: this.connection.connectionArn,
      input: this.props.event,
      targetResource: this.connection,
      httpParameters,
    };
  }
}
