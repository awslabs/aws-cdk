import * as iam from '@aws-cdk/aws-iam';
import * as sns from '@aws-cdk/aws-sns';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Construct } from 'constructs';
import { integrationResourceArn, validatePatternSupported } from '../private/task-utils';


/**
 * Properties for publishing a message to an SNS topic
 */
export interface SnsPublishProps extends sfn.TaskStateBaseProps {

  /**
   * The SNS topic that the task will publish to.
   */
  readonly topic: sns.ITopic;

  /**
   * The message you want to send.
   *
   * With the exception of SMS, messages must be UTF-8 encoded strings and
   * at most 256 KB in size.
   * For SMS, each message can contain up to 140 characters.
   */
  readonly message: sfn.TaskInput;

  /**
   * Add message attributes when publishing.
   *
   * For example, these attributes can carry additional metadata and may be used
   * for SNS Filter Subscriptions.
   *
   * @see https://docs.aws.amazon.com/sns/latest/api/API_Publish.html#API_Publish_RequestParameters
   * @default []
   */
  readonly messageAttributes?: { [key: string]: any };

  /**
   * Send different messages for each transport protocol.
   *
   * For example, you might want to send a shorter message to SMS subscribers
   * and a more verbose message to email and SQS subscribers.
   *
   * Your message must be a JSON object with a top-level JSON key of
   * "default" with a value that is a string
   * You can define other top-level keys that define the message you want to
   * send to a specific transport protocol (i.e. "sqs", "email", "http", etc)
   *
   * @see https://docs.aws.amazon.com/sns/latest/api/API_Publish.html#API_Publish_RequestParameters
   * @default false
   */
  readonly messagePerSubscriptionType?: boolean;

  /**
   * Used as the "Subject" line when the message is delivered to email endpoints.
   * This field will also be included, if present, in the standard JSON messages
   * delivered to other endpoints.
   *
   * @default - No subject
   */
  readonly subject?: string;
}

/**
 * A Step Functions Task to publish messages to SNS topic.
 *
 */
export class SnsPublish extends sfn.TaskStateBase {

  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] = [
    sfn.IntegrationPattern.REQUEST_RESPONSE,
    sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
  ];

  protected readonly taskMetrics: sfn.TaskMetricsConfig | undefined;
  protected readonly taskPolicies: iam.PolicyStatement[] | undefined;

  private readonly integrationPattern: sfn.IntegrationPattern;

  constructor(scope: Construct, id: string, private readonly props: SnsPublishProps) {
    super(scope, id, props);
    this.integrationPattern = props.integrationPattern ?? sfn.IntegrationPattern.REQUEST_RESPONSE;

    validatePatternSupported(this.integrationPattern, SnsPublish.SUPPORTED_INTEGRATION_PATTERNS);

    if (this.integrationPattern === sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN) {
      if (!sfn.FieldUtils.containsTaskToken(props.message)) {
        throw new Error('Task Token is required in `message` Use JsonPath.taskToken to set the token.');
      }
    }

    this.taskPolicies = [
      new iam.PolicyStatement({
        actions: ['sns:Publish'],
        resources: [this.props.topic.topicArn],
      }),
    ];
  }

  /**
   * Provides the SNS Publish service integration task configuration
   */
  /**
   * @internal
   */
  protected _renderTask(): any {

    return {
      Resource: integrationResourceArn('sns', 'publish', this.integrationPattern),
      Parameters: sfn.FieldUtils.renderObject({
        TopicArn: this.props.topic.topicArn,
        Message: this.props.message.value,
        MessageStructure: this.props.messagePerSubscriptionType ? 'json' : undefined,
        MessageAttributes: renderMessageAttributes(this.props.messageAttributes),
        Subject: this.props.subject,
      }),
    };
  }
}

function renderMessageAttributes(attributes?: { [key: string]: any }): any {
  if (attributes === undefined) { return undefined; }
  const attrs: { [key: string]: messageAttributeValue } = {};
  for (const name of Object.keys(attributes)) {
    const value = handleMessageAttributeValue(attributes[name]);
    attrs[name] = value;
  };
  return sfn.TaskInput.fromObject(attrs).value;
}

interface messageAttributeValue {
  DataType: string;
  StringValue?: string;
  BinaryValue?: string;
};

const STRING = 'String';
const STRING_ARRAY = 'String.Array';
const NUMBER = 'Number';
const BINARY = 'Binary';

function handleMessageAttributeValue(attributeValue: any): messageAttributeValue {
  if (attributeValue instanceof sfn.TaskInput) {
    return { DataType: STRING, StringValue: attributeValue.value };
  }
  if (isByteArray(attributeValue)) {
    return { DataType: BINARY, BinaryValue: '' };
  }
  if (Array.isArray(attributeValue)) {
    // validates the primitives
    attributeValue.forEach(v => handlePrimitiveValues(v));
    return { DataType: STRING_ARRAY, StringValue: JSON.stringify(attributeValue) };
  }
  return handlePrimitiveValues(attributeValue);
}

function handlePrimitiveValues(attributeValue: any): messageAttributeValue {
  if (attributeValue === null) {
    return { DataType: STRING, StringValue: attributeValue.value };
  }
  switch (typeof attributeValue) {
    case 'string':
      return { DataType: STRING, StringValue: attributeValue };
    case 'number':
      return { DataType: NUMBER, StringValue: attributeValue.toString() };
    case 'boolean':
      return { DataType: STRING, StringValue: attributeValue.toString() };
    default:
      throw new Error(`sns message attributes does not support this type: ${attributeValue}`);
  }
}

function isByteArray(array: any): array is ArrayBuffer {
  return array.BYTES_PER_ELEMENT;
}
