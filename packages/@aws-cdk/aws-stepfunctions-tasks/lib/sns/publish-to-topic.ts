import * as iam from '@aws-cdk/aws-iam';
import * as sns from '@aws-cdk/aws-sns';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { getResourceArn } from '../resource-arn-suffix';

/**
 * Properties for PublishTask
 *
 * @deprecated Use `SnsPublish`
 */
export interface PublishToTopicProps {
  /**
   * The text message to send to the topic.
   */
  readonly message: sfn.TaskInput;

  /**
   * If true, send a different message to every subscription type
   *
   * If this is set to true, message must be a JSON object with a
   * "default" key and a key for every subscription type (such as "sqs",
   * "email", etc.) The values are strings representing the messages
   * being sent to every subscription type.
   *
   * @see https://docs.aws.amazon.com/sns/latest/api/API_Publish.html#API_Publish_RequestParameters
   * @default false
   */
  readonly messagePerSubscriptionType?: boolean;

  /**
   * Used as the "Subject" line when the message is delivered to email endpoints.
   * Also included, if present, in the standard JSON messages delivered to other endpoints.
   *
   * @default - No subject
   */
  readonly subject?: string;

  /**
   * The service integration pattern indicates different ways to call Publish to SNS.
   *
   * The valid value is either FIRE_AND_FORGET or WAIT_FOR_TASK_TOKEN.
   *
   * @default FIRE_AND_FORGET
   */
  readonly integrationPattern?: sfn.ServiceIntegrationPattern;
}

/**
 * A Step Functions Task to publish messages to SNS topic.
 *
 * A Function can be used directly as a Resource, but this class mirrors
 * integration with other AWS services via a specific class instance.
 *
 * @deprecated Use `SnsPublish`
 */
export class PublishToTopic implements sfn.IStepFunctionsTask {
  private readonly integrationPattern: sfn.ServiceIntegrationPattern;

  constructor(private readonly topic: sns.ITopic, private readonly props: PublishToTopicProps) {
    this.integrationPattern = props.integrationPattern || sfn.ServiceIntegrationPattern.FIRE_AND_FORGET;

    const supportedPatterns = [
      sfn.ServiceIntegrationPattern.FIRE_AND_FORGET,
      sfn.ServiceIntegrationPattern.WAIT_FOR_TASK_TOKEN,
    ];

    if (!supportedPatterns.includes(this.integrationPattern)) {
      throw new Error(`Invalid Service Integration Pattern: ${this.integrationPattern} is not supported to call SNS.`);
    }

    if (this.integrationPattern === sfn.ServiceIntegrationPattern.WAIT_FOR_TASK_TOKEN) {
      if (!sfn.FieldUtils.containsTaskToken(props.message)) {
        throw new Error('Task Token is missing in message (pass JsonPath.taskToken somewhere in message)');
      }
    }
  }

  public bind(_task: sfn.Task): sfn.StepFunctionsTaskConfig {
    return {
      resourceArn: getResourceArn('sns', 'publish', this.integrationPattern),
      policyStatements: [new iam.PolicyStatement({
        actions: ['sns:Publish'],
        resources: [this.topic.topicArn],
      })],
      parameters: {
        TopicArn: this.topic.topicArn,
        Message: this.props.message.value,
        MessageStructure: this.props.messagePerSubscriptionType ? 'json' : undefined,
        Subject: this.props.subject,
      },
    };
  }
}
