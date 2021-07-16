import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import { addToDeadLetterQueueResourcePolicy, bindBaseTargetConfig, singletonEventRole, TargetBaseProps } from './util';

/**
 * Customize the EventBridge Api Destinations Target
 */
export interface ApiDestinationProps extends TargetBaseProps {
  /**
   * The event to send
   *
   * @default - the entire EventBridge event
   */
  readonly event?: events.RuleTargetInput;
  /**
   * The role to assume before invoking the target
   *
   * @default - a new role will be created
   */
  readonly eventRole?: iam.IRole;
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
 */
export class ApiDestination implements events.IRuleTarget {
  constructor(
    private readonly apiDestination: events.ApiDestination,
    private readonly props: ApiDestinationProps = {},
  ) { }

  /**
   * Returns a RuleTarget that can be used to trigger API destinations
   * from an EventBridge event.
   */
  public bind(_rule: events.IRule, _id?: string): events.RuleTargetConfig {
    const httpParameters: events.CfnRule.HttpParametersProperty = {
      headerParameters: this.props.headerParameters,
      pathParameterValues: this.props.pathParameterValues,
      queryStringParameters: this.props.queryStringParameters,
    };
    if (this.props?.deadLetterQueue) {
      addToDeadLetterQueueResourcePolicy(_rule, this.props.deadLetterQueue);
    }

    return {
      ...(this.props ? bindBaseTargetConfig(this.props) : {}),
      arn: this.apiDestination.apiDestinationArn,
      role: this.props?.eventRole || singletonEventRole(this.apiDestination, [new iam.PolicyStatement({
        resources: [this.apiDestination.apiDestinationArn],
        actions: [
          'events:InvokeApiDestination',
        ],
      })]),
      input: this.props.event,
      targetResource: this.apiDestination,
      httpParameters,
    };
  }
}
