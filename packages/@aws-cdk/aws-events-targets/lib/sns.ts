import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import * as sns from '@aws-cdk/aws-sns';

/**
 * Customize the SNS Topic Event Target
 */
export interface SnsTopicProps {
  /**
   * The message to send to the topic
   *
   * @default the entire EventBridge event
   */
  readonly message?: events.RuleTargetInput;
}

/**
 * Use an SNS topic as a target for Amazon EventBridge rules.
 *
 * @example
 *   /// fixture=withRepoAndTopic
 *   // publish to an SNS topic every time code is committed
 *   // to a CodeCommit repository
 *   repository.onCommit('onCommit', { target: new targets.SnsTopic(topic) });
 *
 */
export class SnsTopic implements events.IRuleTarget {
  constructor(public readonly topic: sns.ITopic, private readonly props: SnsTopicProps = {}) {
  }

  /**
   * Returns a RuleTarget that can be used to trigger this SNS topic as a
   * result from an EventBridge event.
   *
   * @see https://docs.aws.amazon.com/eventbridge/latest/userguide/resource-based-policies-eventbridge.html#sns-permissions
   */
  public bind(_rule: events.IRule, _id?: string): events.RuleTargetConfig {
    // deduplicated automatically
    this.topic.grantPublish(new iam.ServicePrincipal('events.amazonaws.com'));

    return {
      arn: this.topic.topicArn,
      input: this.props.message,
      targetResource: this.topic,
    };
  }
}
