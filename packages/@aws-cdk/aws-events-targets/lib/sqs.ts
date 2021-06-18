import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import * as sqs from '@aws-cdk/aws-sqs';

/**
 * Customize the SQS Queue Event Target
 */
export interface SqsQueueProps {

  /**
   * Message Group ID for messages sent to this queue
   *
   * Required for FIFO queues, leave empty for regular queues.
   *
   * @default - no message group ID (regular queue)
   */
  readonly messageGroupId?: string;

  /**
   * The message to send to the queue.
   *
   * Must be a valid JSON text passed to the target queue.
   *
   * @default the entire EventBridge event
   */
  readonly message?: events.RuleTargetInput;

}

/**
 * Use an SQS Queue as a target for Amazon EventBridge rules.
 *
 * @example
 *
 *    // publish to an SQS queue every time code is committed
 *    // to a CodeCommit repository
 *    repository.onCommit(new targets.SqsQueue(queue));
 *
 */
export class SqsQueue implements events.IRuleTarget {
  constructor(public readonly queue: sqs.IQueue, private readonly props: SqsQueueProps = {}) {
    if (props.messageGroupId !== undefined && !queue.fifo) {
      throw new Error('messageGroupId cannot be specified for non-FIFO queues');
    }
  }

  /**
   * Returns a RuleTarget that can be used to trigger this SQS queue as a
   * result from an EventBridge event.
   *
   * @see https://docs.aws.amazon.com/eventbridge/latest/userguide/resource-based-policies-eventbridge.html#sqs-permissions
   */
  public bind(rule: events.IRule, _id?: string): events.RuleTargetConfig {
    // Only add the rule as a condition if the queue is not encrypted, to avoid circular dependency. See issue #11158.
    const principalOpts = this.queue.encryptionMasterKey ? {} : {
      conditions: {
        ArnEquals: { 'aws:SourceArn': rule.ruleArn },
      },
    };

    // deduplicated automatically
    this.queue.grantSendMessages(new iam.ServicePrincipal('events.amazonaws.com', principalOpts));

    return {
      arn: this.queue.queueArn,
      input: this.props.message,
      targetResource: this.queue,
      sqsParameters: this.props.messageGroupId ? { messageGroupId: this.props.messageGroupId } : undefined,
    };
  }
}
