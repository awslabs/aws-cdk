import * as iam from '@aws-cdk/aws-iam';
import * as sqs from '@aws-cdk/aws-sqs';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { Construct } from 'constructs';
import { integrationResourceArn, validatePatternSupported } from '../private/task-utils';

/**
 * Properties for sending a message to an SQS queue
 */
export interface SqsSendMessageProps extends sfn.TaskStateBaseProps {

  /**
   * The SQS queue that messages will be sent to
   */
  readonly queue: sqs.IQueue

  /**
   * The text message to send to the queue.
   */
  readonly messageBody: sfn.TaskInput;

  /**
   * The length of time, for which to delay a message.
   * Messages that you send to the queue remain invisible to consumers for the duration
   * of the delay period. The maximum allowed delay is 15 minutes.
   *
   * @default - delay set on the queue. If a delay is not set on the queue,
   *   messages are sent immediately (0 seconds).
   */
  readonly delay?: cdk.Duration;

  /**
   * The token used for deduplication of sent messages.
   * Any messages sent with the same deduplication ID are accepted successfully,
   * but aren't delivered during the 5-minute deduplication interval.
   *
   * @default - None
   */
  readonly messageDeduplicationId?: string;

  /**
   * The tag that specifies that a message belongs to a specific message group.
   *
   * Messages that belong to the same message group are processed in a FIFO manner.
   * Messages in different message groups might be processed out of order.
   *
   * @default - None
   */
  readonly messageGroupId?: string;
}

/**
 * A StepFunctions Task to send messages to SQS queue.
 *
 */
export class SqsSendMessage extends sfn.TaskStateBase {
  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] = [
    sfn.IntegrationPattern.REQUEST_RESPONSE,
    sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
  ];

  protected readonly taskMetrics?: sfn.TaskMetricsConfig;
  protected readonly taskPolicies?: iam.PolicyStatement[];

  private readonly integrationPattern: sfn.IntegrationPattern;

  constructor(scope: Construct, id: string, private readonly props: SqsSendMessageProps) {
    super(scope, id, props);
    this.integrationPattern = props.integrationPattern ?? sfn.IntegrationPattern.REQUEST_RESPONSE;

    validatePatternSupported(this.integrationPattern, SqsSendMessage.SUPPORTED_INTEGRATION_PATTERNS);

    if (props.integrationPattern === sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN) {
      if (!sfn.FieldUtils.containsTaskToken(props.messageBody)) {
        throw new Error('Task Token is required in `messageBody` Use JsonPath.taskToken to set the token.');
      }
    }

    this.taskPolicies = [
      new iam.PolicyStatement({
        actions: ['sqs:SendMessage'],
        resources: [this.props.queue.queueArn],
      }),
    ];
  }

  /**
   * Provides the SQS SendMessage service integration task configuration
   */
  /**
   * @internal
   */
  protected _renderTask(): any {
    return {
      Resource: integrationResourceArn('sqs', 'sendMessage', this.integrationPattern),
      Parameters: sfn.FieldUtils.renderObject({
        QueueUrl: this.props.queue.queueUrl,
        MessageBody: this.props.messageBody.value,
        DelaySeconds: this.props.delay?.toSeconds(),
        MessageDeduplicationId: this.props.messageDeduplicationId,
        MessageGroupId: this.props.messageGroupId,
      }),
    };
  }
}
