import { IReceiptRule } from './receipt-rule';

/**
 * An abstract action for a receipt rule.
 */
export interface IReceiptRuleAction {
  /**
   * Returns the receipt rule action specification
   */
  bind(receiptRule: IReceiptRule): ReceiptRuleActionConfig;
}

/**
 * AddHeaderAction configuration.
 */
export interface AddHeaderActionConfig {
  /**
   * The name of the header that you want to add to the incoming message
   *
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ses-receiptrule-addheaderaction.html#cfn-ses-receiptrule-addheaderaction-headername
   */
  readonly headerName: string;
  /**
   * The content that you want to include in the header.
   *
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ses-receiptrule-addheaderaction.html#cfn-ses-receiptrule-addheaderaction-headervalue
   */
  readonly headerValue: string;
}

/**
 * BoundAction configuration.
 */
export interface BounceActionConfig {
  /**
   * Human-readable text to include in the bounce message.
   *
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ses-receiptrule-bounceaction.html#cfn-ses-receiptrule-bounceaction-message
   */
  readonly message: string;
  /**
   * The email address of the sender of the bounced email.
   * This is the address that the bounce message is sent from.
   *
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ses-receiptrule-bounceaction.html#cfn-ses-receiptrule-bounceaction-sender
   */
  readonly sender: string;
  /**
   * The SMTP reply code, as defined by RFC 5321
   *
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ses-receiptrule-bounceaction.html#cfn-ses-receiptrule-bounceaction-smtpreplycode
   */
  readonly smtpReplyCode: string;
  /**
   * The SMTP enhanced status code, as defined by RFC 3463
   *
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ses-receiptrule-bounceaction.html#cfn-ses-receiptrule-bounceaction-statuscode
   *
   * @default - No status code.
   */
  readonly statusCode?: string;
  /**
   * The Amazon Resource Name (ARN) of the Amazon SNS topic to
   * notify when the bounce action is taken.
   *
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ses-receiptrule-bounceaction.html#cfn-ses-receiptrule-bounceaction-topicarn
   *
   * @default - No notification is sent to SNS.
   */
  readonly topicArn?: string;
}

/**
 * LambdaAction configuration.
 */
export interface LambdaActionConfig {
  /**
   * The Amazon Resource Name (ARN) of the AWS Lambda function.
   *
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ses-receiptrule-lambdaaction.html#cfn-ses-receiptrule-lambdaaction-functionarn
   */
  readonly functionArn: string;
  /**
   * The invocation type of the AWS Lambda function
   *
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ses-receiptrule-lambdaaction.html#cfn-ses-receiptrule-lambdaaction-invocationtype
   *
   * @default 'Event'
   */
  readonly invocationType?: string;
  /**
   * The Amazon Resource Name (ARN) of the Amazon SNS topic to
   * notify when the Lambda action is executed.
   *
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ses-receiptrule-lambdaaction.html#cfn-ses-receiptrule-lambdaaction-topicarn
   *
   * @default - No notification is sent to SNS.
   */
  readonly topicArn?: string;
}

/**
 * S3Action configuration.
 */
export interface S3ActionConfig {
  /**
   * The name of the Amazon S3 bucket that you want to send incoming mail to.
   *
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ses-receiptrule-s3action.html#cfn-ses-receiptrule-s3action-bucketname
   */
  readonly bucketName: string;
  /**
   * The customer master key that Amazon SES should use to encrypt your emails before saving
   * them to the Amazon S3 bucket.
   *
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ses-receiptrule-s3action.html#cfn-ses-receiptrule-s3action-kmskeyarn
   *
   * @default - Emails are not encrypted.
   */
  readonly kmsKeyArn?: string;
  /**
   * The key prefix of the Amazon S3 bucket.
   *
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ses-receiptrule-s3action.html#cfn-ses-receiptrule-s3action-objectkeyprefix
   *
   * @default - No prefix.
   */
  readonly objectKeyPrefix?: string;
  /**
   * The ARN of the Amazon SNS topic to notify when the message is saved to the Amazon S3 bucket.
   *
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ses-receiptrule-s3action.html#cfn-ses-receiptrule-s3action-topicarn
   *
   * @default - No notification is sent to SNS.
   */
  readonly topicArn?: string;
}

/**
 * SNSAction configuration.
 */
export interface SNSActionConfig {
  /**
   * The encoding to use for the email within the Amazon SNS notification.
   *
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ses-receiptrule-snsaction.html#cfn-ses-receiptrule-snsaction-encoding
   *
   * @default 'UTF-8'
   */
  readonly encoding?: string;
  /**
   * The Amazon Resource Name (ARN) of the Amazon SNS topic to notify.
   *
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ses-receiptrule-snsaction.html#cfn-ses-receiptrule-snsaction-topicarn
   *
   * @default - No notification is sent to SNS.
   */
  readonly topicArn?: string;
}

/**
 * StopAction configuration.
 */
export interface StopActionConfig {
  /**
   * The scope of the StopAction. The only acceptable value is RuleSet.
   *
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ses-receiptrule-stopaction.html#cfn-ses-receiptrule-stopaction-scope
   */
  readonly scope: string;
  /**
   * The Amazon Resource Name (ARN) of the Amazon SNS topic to notify when the stop action is taken.
   *
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ses-receiptrule-stopaction.html#cfn-ses-receiptrule-stopaction-topicarn
   *
   * @default - No notification is sent to SNS.
   */
  readonly topicArn?: string;
}

/**
 * WorkmailAction configuration.
 */
export interface WorkmailActionConfig {
  /**
   * The Amazon Resource Name (ARN) of the Amazon WorkMail organization.
   *
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ses-receiptrule-workmailaction.html#cfn-ses-receiptrule-workmailaction-organizationarn
   */
  readonly organizationArn: string;
  /**
   * The Amazon Resource Name (ARN) of the Amazon SNS topic to notify when the WorkMail action is called.
   *
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ses-receiptrule-workmailaction.html#cfn-ses-receiptrule-workmailaction-topicarn
   *
   * @default - No notification is sent to SNS.
   */
  readonly topicArn?: string;
}

/**
 * Properties for a receipt rule action.
 */
export interface ReceiptRuleActionConfig {
  /**
   * Adds a header to the received email.
   */
  readonly addHeaderAction?: AddHeaderActionConfig

  /**
   * Rejects the received email by returning a bounce response to the sender and,
   * optionally, publishes a notification to Amazon SNS.
   */
  readonly bounceAction?: BounceActionConfig;

  /**
   * Calls an AWS Lambda function, and optionally, publishes a notification to
   * Amazon SNS.
   */
  readonly lambdaAction?: LambdaActionConfig;

  /**
   * Saves the received message to an Amazon S3 bucket and, optionally, publishes
   * a notification to Amazon SNS.
   */
  readonly s3Action?: S3ActionConfig;

  /**
   * Publishes the email content within a notification to Amazon SNS.
   */
  readonly snsAction?: SNSActionConfig;

  /**
   * Terminates the evaluation of the receipt rule set and optionally publishes a
   * notification to Amazon SNS.
   */
  readonly stopAction?: StopActionConfig;

  /**
   * Calls Amazon WorkMail and, optionally, publishes a notification to Amazon SNS.
   */
  readonly workmailAction?: WorkmailActionConfig;
}
