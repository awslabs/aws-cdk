import lambda = require('@aws-cdk/aws-lambda');
import sns = require('@aws-cdk/aws-sns');
import subs = require('@aws-cdk/aws-sns-subscribers');

/**
 * Use an Amazon SNS topic as an event source for AWS Lambda.
 */
export class SnsEventSource implements lambda.IEventSource {
  constructor(readonly topic: sns.ITopic) {
  }

  public bind(target: lambda.IFunction) {
    this.topic.subscribe(new subs.LambdaSubscriber(target));
  }
}