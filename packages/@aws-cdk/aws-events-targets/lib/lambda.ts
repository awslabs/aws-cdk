import * as events from '@aws-cdk/aws-events';
import * as lambda from '@aws-cdk/aws-lambda';
import { addLambdaPermission, addToDeadLetterQueueResourcePolicy, TargetBaseProps, bindBaseTargetConfig } from './util';

/**
 * Customize the Lambda Event Target
 */
export interface LambdaFunctionProps extends TargetBaseProps {
  /**
   * The event to send to the Lambda
   *
   * This will be the payload sent to the Lambda Function.
   *
   * @default the entire EventBridge event
   */
  readonly event?: events.RuleTargetInput;
}

/**
 * Use an AWS Lambda function as an event rule target.
 */
export class LambdaFunction implements events.IRuleTarget {
  constructor(private readonly handler: lambda.IFunction, private readonly props: LambdaFunctionProps = {}) {

  }

  /**
   * Returns a RuleTarget that can be used to trigger this Lambda as a
   * result from an EventBridge event.
   */
  public bind(rule: events.IRule, _id?: string): events.RuleTargetConfig {
    // Allow handler to be called from rule
    addLambdaPermission(rule, this.handler);

    if (this.props.deadLetterQueue) {
      addToDeadLetterQueueResourcePolicy(rule, this.props.deadLetterQueue);
    }

    return {
      ...bindBaseTargetConfig(this.props),
      arn: this.handler.functionArn,
      input: this.props.event,
      targetResource: this.handler,
    };
  }
}
