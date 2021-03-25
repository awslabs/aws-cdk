import { CfnTopicRule } from './iot.generated';
import { ITopicRule } from './topic-rule';

/**
 * An abstract action for a topic rule.
 */
export interface ITopicRuleAction {
  /**
   * Returns the topic rule action specification
   */
  bind(topicRule: ITopicRule): TopicRuleActionConfig;
}

/**
 * Properties for a topic rule action.
 */
export interface TopicRuleActionConfig {
  /**
   * Describes an action that updates a CloudWatch alarm.
   */
  readonly cloudwatchAlarm?: CfnTopicRule.CloudwatchAlarmActionProperty;
  /**
   * Describes an action that captures a CloudWatch metric.
   */
  readonly cloudwatchAlarmMetric?: CfnTopicRule.CloudwatchMetricActionProperty;
  /**
   * Describes an action to write to a DynamoDB table.
   *
   * The tableName, hashKeyField, and rangeKeyField values must match the values
   * used when you created the table.
   *
   * The hashKeyValue and rangeKeyvalue fields use a substitution template
   * syntax.
   * These templates provide data at runtime. The syntax is as follows:
   * ${sql-expression}.
   *
   * You can specify any valid expression in a WHERE or SELECT clause, including JSON
   * properties, comparisons, calculations, and functions. For example, the following
   * field uses the third level of the topic:
   *
   * "hashKeyValue": "${topic(3)}"
   *
   * The following field uses the timestamp:
   *
   * "rangeKeyValue": "${timestamp()}"
   */
  readonly dynamoDB?: CfnTopicRule.DynamoDBActionProperty;
  /**
   * Describes an action to write to a DynamoDB table.
   *
   * This DynamoDB action writes each attribute in the message payload into it's
   * own column in the DynamoDB table.
   */
  readonly dynamoDBv2?: CfnTopicRule.DynamoDBv2ActionProperty;
  /**
   * Describes an action that writes data to an Amazon Elasticsearch Service domain.
   */
  readonly elasticsearch?: CfnTopicRule.ElasticsearchActionProperty;
  /**
   * Describes an action that writes data to an Amazon Kinesis Firehose stream.
   */
  readonly firehose?: CfnTopicRule.FirehoseActionProperty;
  /**
   * Send data to an HTTPS endpoint.
   */
  readonly http?: CfnTopicRule.HttpActionProperty;
  /**
   * Sends message data to an AWS IoT Analytics channel.
   */
  readonly iotAnalytics?: CfnTopicRule.IotAnalyticsActionProperty;
  /**
   * Describes an action to send data from an MQTT message that triggered the
   * rule to AWS IoT SiteWise asset properties.
   */
  readonly iotSiteWise?: CfnTopicRule.IotSiteWiseActionProperty;
  /**
   * Describes an action to write data to an Amazon Kinesis stream.
   */
  readonly kinesis?: CfnTopicRule.KinesisActionProperty;
  /**
   * Describes an action to invoke a Lambda function.
   */
  readonly lambda?: CfnTopicRule.LambdaActionProperty;
  /**
   * Describes an action to republish to another topic.
   */
  readonly republish?: CfnTopicRule.RepublishActionProperty;
  /**
   * Describes an action to write data to an Amazon S3 bucket.
   */
  readonly s3?: CfnTopicRule.S3ActionProperty;
  /**
   * Describes an action to publish to an Amazon SNS topic.
   */
  readonly sns?: CfnTopicRule.SnsActionProperty;
  /**
   * Describes an action to publish data to an Amazon SQS queue.
   */
  readonly sqs?: CfnTopicRule.SqsActionProperty;
  /**
   * Starts execution of a Step Functions state machine.
   */
  readonly stepFunctions?: CfnTopicRule.StepFunctionsActionProperty;
}
