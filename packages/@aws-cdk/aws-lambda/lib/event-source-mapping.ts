import * as cdk from '@aws-cdk/core';
import { Construct } from 'constructs';
import { IEventSourceDlq } from './dlq';
import { IFunction } from './function-base';
import { CfnEventSourceMapping } from './lambda.generated';

/**
 * The type of authentication protocol or the VPC components for your event source's SourceAccessConfiguration
 * @see https://docs.aws.amazon.com/lambda/latest/dg/API_SourceAccessConfiguration.html#SSS-Type-SourceAccessConfiguration-Type
 */
export class SourceAccessConfigurationType {
  /**
   * (MQ) The Secrets Manager secret that stores your broker credentials.
   */
  public static readonly BASIC_AUTH = new SourceAccessConfigurationType('BASIC_AUTH');

  /**
   * The subnets associated with your VPC. Lambda connects to these subnets to fetch data from your Self-Managed Apache Kafka cluster.
   */
  public static readonly VPC_SUBNET = new SourceAccessConfigurationType('VPC_SUBNET');

  /**
   * The VPC security group used to manage access to your Self-Managed Apache Kafka brokers.
   */
  public static readonly VPC_SECURITY_GROUP = new SourceAccessConfigurationType('VPC_SECURITY_GROUP');

  /**
   * The Secrets Manager ARN of your secret key used for SASL SCRAM-256 authentication of your Self-Managed Apache Kafka brokers.
   */
  public static readonly SASL_SCRAM_256_AUTH = new SourceAccessConfigurationType('SASL_SCRAM_256_AUTH');

  /**
   * The Secrets Manager ARN of your secret key used for SASL SCRAM-512 authentication of your Self-Managed Apache Kafka brokers.
   */
  public static readonly SASL_SCRAM_512_AUTH = new SourceAccessConfigurationType('SASL_SCRAM_512_AUTH');

  /** A custom source access configuration property */
  public static of(name: string): SourceAccessConfigurationType {
    return new SourceAccessConfigurationType(name);
  }

  /**
   * The key to use in `SourceAccessConfigurationProperty.Type` property in CloudFormation
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-lambda-eventsourcemapping-sourceaccessconfiguration.html#cfn-lambda-eventsourcemapping-sourceaccessconfiguration-type
   */
  public readonly type: string;

  private constructor(type: string) {
    this.type = type;
  }
}

/**
 * Specific settings like the authentication protocol or the VPC components to secure access to your event source.
 */
export interface SourceAccessConfiguration {
  /**
   * The type of authentication protocol or the VPC components for your event source. For example: "SASL_SCRAM_512_AUTH".
   */
  readonly type: SourceAccessConfigurationType,
  /**
   * The value for your chosen configuration in type.
   * For example: "URI": "arn:aws:secretsmanager:us-east-1:01234567890:secret:MyBrokerSecretName".
   * The exact string depends on the type.
   * @see SourceAccessConfigurationType
   */
  readonly uri: string
}

export interface EventSourceMappingOptions {
  /**
   * The Amazon Resource Name (ARN) of the event source. Any record added to
   * this stream can invoke the Lambda function.
   *
   * @default - not set if using a self managed Kafka cluster, throws an error otherwise
   */
  readonly eventSourceArn?: string;

  /**
   * The largest number of records that AWS Lambda will retrieve from your event
   * source at the time of invoking your function. Your function receives an
   * event with all the retrieved records.
   *
   * Valid Range: Minimum value of 1. Maximum value of 10000.
   *
   * @default - Amazon Kinesis, Amazon DynamoDB, and Amazon MSK is 100 records.
   * Both the default and maximum for Amazon SQS are 10 messages.
   */
  readonly batchSize?: number;

  /**
   * If the function returns an error, split the batch in two and retry.
   *
   * @default false
   */
  readonly bisectBatchOnError?: boolean;

  /**
   * An Amazon SQS queue or Amazon SNS topic destination for discarded records.
   *
   * @default discarded records are ignored
   */
  readonly onFailure?: IEventSourceDlq;

  /**
   * Set to false to disable the event source upon creation.
   *
   * @default true
   */
  readonly enabled?: boolean;

  /**
   * The position in the DynamoDB, Kinesis or MSK stream where AWS Lambda should
   * start reading.
   *
   * @see https://docs.aws.amazon.com/kinesis/latest/APIReference/API_GetShardIterator.html#Kinesis-GetShardIterator-request-ShardIteratorType
   *
   * @default - Required for Amazon Kinesis, Amazon DynamoDB, and Amazon MSK Streams sources.
   */
  readonly startingPosition?: StartingPosition;

  /**
   * Allow functions to return partially successful responses for a batch of records.
   *
   * @see https://docs.aws.amazon.com/lambda/latest/dg/with-ddb.html#services-ddb-batchfailurereporting
   *
   * @default false
   */
  readonly reportBatchItemFailures?: boolean;

  /**
   * The maximum amount of time to gather records before invoking the function.
   * Maximum of Duration.minutes(5)
   *
   * @default Duration.seconds(0)
   */
  readonly maxBatchingWindow?: cdk.Duration;

  /**
   * The maximum age of a record that Lambda sends to a function for processing.
   * Valid Range:
   * * Minimum value of 60 seconds
   * * Maximum value of 7 days
   *
   * @default - infinite or until the record expires.
   */
  readonly maxRecordAge?: cdk.Duration;

  /**
   * The maximum number of times to retry when the function returns an error.
   * Set to `undefined` if you want lambda to keep retrying infinitely or until
   * the record expires.
   *
   * Valid Range:
   * * Minimum value of 0
   * * Maximum value of 10000
   *
   * @default - infinite or until the record expires.
   */
  readonly retryAttempts?: number;

  /**
   * The number of batches to process from each shard concurrently.
   * Valid Range:
   * * Minimum value of 1
   * * Maximum value of 10
   *
   * @default 1
   */
  readonly parallelizationFactor?: number;

  /**
   * The name of the Kafka topic.
   *
   * @default - no topic
   */
  readonly kafkaTopic?: string;

  /**
   * The size of the tumbling windows to group records sent to DynamoDB or Kinesis
   *
   * @see https://docs.aws.amazon.com/lambda/latest/dg/with-ddb.html#services-ddb-windows
   *
   * Valid Range: 0 - 15 minutes
   *
   * @default - None
   */
  readonly tumblingWindow?: cdk.Duration;

  /**
   * A list of host and port pairs that are the addresses of the Kafka brokers in a self managed "bootstrap" Kafka cluster
   * that a Kafka client connects to initially to bootstrap itself.
   * They are in the format `abc.example.com:9096`.
   *
   * @default - none
   */
  readonly kafkaBootstrapServers?: string[]

  /**
   * Specific settings like the authentication protocol or the VPC components to secure access to your event source.
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-lambda-eventsourcemapping-sourceaccessconfiguration.html
   *
   * @default - none
   */
  readonly sourceAccessConfigurations?: SourceAccessConfiguration[]
}

/**
 * Properties for declaring a new event source mapping.
 */
export interface EventSourceMappingProps extends EventSourceMappingOptions {
  /**
   * The target AWS Lambda function.
   */
  readonly target: IFunction;
}

/**
 * Represents an event source mapping for a lambda function.
 * @see https://docs.aws.amazon.com/lambda/latest/dg/invocation-eventsourcemapping.html
 */
export interface IEventSourceMapping extends cdk.IResource {
  /**
   * The identifier for this EventSourceMapping
   * @attribute
   */
  readonly eventSourceMappingId: string;
}

/**
 * Defines a Lambda EventSourceMapping resource.
 *
 * Usually, you won't need to define the mapping yourself. This will usually be done by
 * event sources. For example, to add an SQS event source to a function:
 *
 *    import { SqsEventSource } from '@aws-cdk/aws-lambda-event-sources';
 *    lambda.addEventSource(new SqsEventSource(sqs));
 *
 * The `SqsEventSource` class will automatically create the mapping, and will also
 * modify the Lambda's execution role so it can consume messages from the queue.
 */
export class EventSourceMapping extends cdk.Resource implements IEventSourceMapping {
  /**
   * Import an event source into this stack from its event source id.
   */
  public static fromEventSourceMappingId(scope: Construct, id: string, eventSourceMappingId: string): IEventSourceMapping {
    class Import extends cdk.Resource implements IEventSourceMapping {
      public readonly eventSourceMappingId = eventSourceMappingId;
    }
    return new Import(scope, id);
  }

  public readonly eventSourceMappingId: string;

  constructor(scope: Construct, id: string, props: EventSourceMappingProps) {
    super(scope, id);

    if (props.eventSourceArn == undefined && props.kafkaBootstrapServers == undefined) {
      throw new Error('Either eventSourceArn or kafkaBootstrapServers must be set');
    }

    if (props.eventSourceArn !== undefined && props.kafkaBootstrapServers !== undefined) {
      throw new Error('eventSourceArn and kafkaBootstrapServers are mutually exclusive');
    }

    if (props.kafkaBootstrapServers && (props.kafkaBootstrapServers?.length < 1)) {
      throw new Error('kafkaBootStrapServers must not be empty if set');
    }

    if (props.maxBatchingWindow && props.maxBatchingWindow.toSeconds() > 300) {
      throw new Error(`maxBatchingWindow cannot be over 300 seconds, got ${props.maxBatchingWindow.toSeconds()}`);
    }

    if (props.maxRecordAge && (props.maxRecordAge.toSeconds() < 60 || props.maxRecordAge.toDays({ integral: false }) > 7)) {
      throw new Error('maxRecordAge must be between 60 seconds and 7 days inclusive');
    }

    props.retryAttempts !== undefined && cdk.withResolved(props.retryAttempts, (attempts) => {
      if (attempts < 0 || attempts > 10000) {
        throw new Error(`retryAttempts must be between 0 and 10000 inclusive, got ${attempts}`);
      }
    });

    props.parallelizationFactor !== undefined && cdk.withResolved(props.parallelizationFactor, (factor) => {
      if (factor < 1 || factor > 10) {
        throw new Error(`parallelizationFactor must be between 1 and 10 inclusive, got ${factor}`);
      }
    });

    if (props.tumblingWindow && !cdk.Token.isUnresolved(props.tumblingWindow) && props.tumblingWindow.toSeconds() > 900) {
      throw new Error(`tumblingWindow cannot be over 900 seconds, got ${props.tumblingWindow.toSeconds()}`);
    }


    let destinationConfig;

    if (props.onFailure) {
      destinationConfig = {
        onFailure: props.onFailure.bind(this, props.target),
      };
    }

    let selfManagedEventSource;
    if (props.kafkaBootstrapServers) {
      selfManagedEventSource = { endpoints: { kafkaBootstrapServers: props.kafkaBootstrapServers } };
    }

    const cfnEventSourceMapping = new CfnEventSourceMapping(this, 'Resource', {
      batchSize: props.batchSize,
      bisectBatchOnFunctionError: props.bisectBatchOnError,
      destinationConfig,
      enabled: props.enabled,
      eventSourceArn: props.eventSourceArn,
      functionName: props.target.functionName,
      startingPosition: props.startingPosition,
      functionResponseTypes: props.reportBatchItemFailures ? ['ReportBatchItemFailures'] : undefined,
      maximumBatchingWindowInSeconds: props.maxBatchingWindow?.toSeconds(),
      maximumRecordAgeInSeconds: props.maxRecordAge?.toSeconds(),
      maximumRetryAttempts: props.retryAttempts,
      parallelizationFactor: props.parallelizationFactor,
      topics: props.kafkaTopic !== undefined ? [props.kafkaTopic] : undefined,
      tumblingWindowInSeconds: props.tumblingWindow?.toSeconds(),
      sourceAccessConfigurations: props.sourceAccessConfigurations?.map((o) => {return { type: o.type.type, uri: o.uri };}),
      selfManagedEventSource,
    });
    this.eventSourceMappingId = cfnEventSourceMapping.ref;
  }
}

/**
 * The position in the DynamoDB, Kinesis or MSK stream where AWS Lambda should start
 * reading.
 */
export enum StartingPosition {
  /**
   * Start reading at the last untrimmed record in the shard in the system,
   * which is the oldest data record in the shard.
   */
  TRIM_HORIZON = 'TRIM_HORIZON',

  /**
   * Start reading just after the most recent record in the shard, so that you
   * always read the most recent data in the shard
   */
  LATEST = 'LATEST',
}
