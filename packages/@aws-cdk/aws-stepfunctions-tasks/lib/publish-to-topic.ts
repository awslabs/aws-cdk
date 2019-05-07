import cloudwatch = require('@aws-cdk/aws-cloudwatch');
import iam = require('@aws-cdk/aws-iam');
import sns = require('@aws-cdk/aws-sns');
import sfn = require('@aws-cdk/aws-stepfunctions');
import cdk = require('@aws-cdk/cdk');
import { renderString } from './json-path';

/**
 * Properties for PublishTask
 */
export interface PublishToTopicProps {
  /**
   * The text message to send to the queue.
   *
   * Exactly one of `message` and `messageObject` is required.
   */
  readonly message?: string;

  /**
   * Object to be JSON-encoded and used as message
   *
   * Exactly one of `message`, `messageObject` and `messagePath` is required.
   */
  readonly messageObject?: string;

  /**
   * If true, send a different message to every subscription type
   *
   * If this is set to true, message must be a JSON object with a
   * "default" key and a key for every subscription type (such as "sqs",
   * "email", etc.) The values are strings representing the messages
   * being sent to every subscription type.
   *
   * @see https://docs.aws.amazon.com/sns/latest/api/API_Publish.html#API_Publish_RequestParameters
   */
  readonly messagePerSubscriptionType?: boolean;

  /**
   * Message subject
   */
  readonly subject?: string;
}

/**
 * A StepFunctions Task to invoke a Lambda function.
 *
 * A Function can be used directly as a Resource, but this class mirrors
 * integration with other AWS services via a specific class instance.
 */
export class PublishToTopic implements sfn.IStepFunctionsTask {
  public readonly resourceArn: string;
  public readonly policyStatements?: iam.PolicyStatement[] | undefined;
  public readonly metricDimensions?: cloudwatch.DimensionHash | undefined;
  public readonly metricPrefixSingular?: string;
  public readonly metricPrefixPlural?: string;

  public readonly heartbeatSeconds?: number | undefined;
  public readonly parameters?: { [name: string]: any; } | undefined;

  constructor(topic: sns.ITopic, props: PublishToTopicProps) {
    if ((props.message === undefined) === (props.messageObject === undefined)) {
      throw new Error(`Supply exactly one of 'message' or 'messageObject'`);
    }

    this.resourceArn = 'arn:aws:states:::sns:publish';
    this.policyStatements = [new iam.PolicyStatement()
      .addAction('sns:Publish')
      .addResource(topic.topicArn)
    ];
    this.parameters = {
      TopicArn: topic.topicArn,
      ...(props.messageObject
          ? { Message: new cdk.Token(() => topic.node.stringifyJson(props.messageObject)) }
          : renderString('Message', props.message)),
      MessageStructure: props.messagePerSubscriptionType ? "json" : undefined,
      ...renderString('Subject', props.subject),
    };

    // No IAM permissions necessary, execution role implicitly has Activity permissions.
  }
}