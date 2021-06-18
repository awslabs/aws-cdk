import * as iam from '@aws-cdk/aws-iam';
import * as sqs from '@aws-cdk/aws-sqs';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Duration } from '@aws-cdk/core';
import { getResourceArn } from '../resource-arn-suffix';

/**
 * Properties for SendMessageTask
 *
 * @deprecated Use `SqsSendMessage`
 */
export interface SendToQueueProps {
  /**
   * The text message to send to the queue.
   */
  readonly messageBody: sfn.TaskInput;

  /**
   * The length of time, in seconds, for which to delay a specific message.
   *
   * Valid values are 0-900 seconds.
   *
   * @default Default value of the queue is used
   */
  readonly delay?: Duration;

  /**
   * The token used for deduplication of sent messages.
   *
   * @default Use content-based deduplication
   */
  readonly messageDeduplicationId?: string;

  /**
   * The tag that specifies that a message belongs to a specific message group.
   *
   * Required for FIFO queues. FIFO ordering applies to messages in the same message
   * group.
   *
   * @default No group ID
   */
  readonly messageGroupId?: string;

  /**
   * The service integration pattern indicates different ways to call SendMessage to SQS.
   *
   * The valid value is either FIRE_AND_FORGET or WAIT_FOR_TASK_TOKEN.
   *
   * @default FIRE_AND_FORGET
   */
  readonly integrationPattern?: sfn.ServiceIntegrationPattern;
}

/**
 * A StepFunctions Task to send messages to SQS queue.
 *
 * A Function can be used directly as a Resource, but this class mirrors
 * integration with other AWS services via a specific class instance.
 *
 * @deprecated Use `SqsSendMessage`
 */
export class SendToQueue implements sfn.IStepFunctionsTask {
  private readonly integrationPattern: sfn.ServiceIntegrationPattern;

  constructor(private readonly queue: sqs.IQueue, private readonly props: SendToQueueProps) {
    this.integrationPattern = props.integrationPattern || sfn.ServiceIntegrationPattern.FIRE_AND_FORGET;

    const supportedPatterns = [
      sfn.ServiceIntegrationPattern.FIRE_AND_FORGET,
      sfn.ServiceIntegrationPattern.WAIT_FOR_TASK_TOKEN,
    ];

    if (!supportedPatterns.includes(this.integrationPattern)) {
      throw new Error(`Invalid Service Integration Pattern: ${this.integrationPattern} is not supported to call SQS.`);
    }

    if (props.integrationPattern === sfn.ServiceIntegrationPattern.WAIT_FOR_TASK_TOKEN) {
      if (!sfn.FieldUtils.containsTaskToken(props.messageBody)) {
        throw new Error('Task Token is missing in messageBody (pass JsonPath.taskToken somewhere in messageBody)');
      }
    }
  }

  public bind(_task: sfn.Task): sfn.StepFunctionsTaskConfig {
    return {
      resourceArn: getResourceArn('sqs', 'sendMessage', this.integrationPattern),
      policyStatements: [new iam.PolicyStatement({
        actions: ['sqs:SendMessage'],
        resources: [this.queue.queueArn],
      })],
      parameters: {
        QueueUrl: this.queue.queueUrl,
        MessageBody: this.props.messageBody.value,
        DelaySeconds: this.props.delay && this.props.delay.toSeconds(),
        MessageDeduplicationId: this.props.messageDeduplicationId,
        MessageGroupId: this.props.messageGroupId,
      },
    };
  }
}
