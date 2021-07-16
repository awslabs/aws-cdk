import * as iam from '@aws-cdk/aws-iam';
import * as logs from '@aws-cdk/aws-logs';
import { Construct } from 'constructs';
import { IDeliveryStream } from './delivery-stream';
import { CfnDeliveryStream } from './kinesisfirehose.generated';

/**
 * A Kinesis Data Firehose delivery stream destination configuration.
 */
export interface DestinationConfig {
  /**
   * Schema-less properties that will be injected directly into `CfnDeliveryStream`.
   */
  readonly properties: object;
}

/**
 * Options when binding a destination to a delivery stream.
 */
export interface DestinationBindOptions {
  /**
   * The delivery stream.
   */
  readonly deliveryStream: IDeliveryStream;

  /**
   * The IAM service Role of the delivery stream.
   */
  readonly role: iam.IRole;
}

/**
 * A Kinesis Data Firehose delivery stream destination.
 */
export interface IDestination {
  /**
   * Binds this destination to the Kinesis Data Firehose delivery stream.
   *
   * Implementers should use this method to bind resources to the stack and initialize values using the provided stream.
   */
  bind(scope: Construct, options: DestinationBindOptions): DestinationConfig;
}

/**
 * Generic properties for defining a delivery stream destination.
 */
export interface DestinationProps {
  /**
   * If true, log errors when data transformation or data delivery fails.
   *
   * If `logGroup` is provided, this will be implicitly set to `true`.
   *
   * @default true - errors are logged.
   */
  readonly logging?: boolean;

  /**
   * The CloudWatch log group where log streams will be created to hold error logs.
   *
   * @default - if `logging` is set to `true`, a log group will be created for you.
   */
  readonly logGroup?: logs.ILogGroup;
}

/**
 * Abstract base class that destination types can extend to benefit from methods that create generic configuration.
 */
export abstract class DestinationBase implements IDestination {
  private logGroup?: logs.ILogGroup;

  constructor(protected readonly props: DestinationProps = {}) { }

  abstract bind(scope: Construct, options: DestinationBindOptions): DestinationConfig;

  protected createLoggingOptions(
    scope: Construct,
    deliveryStream: IDeliveryStream,
    streamId: string,
  ): CfnDeliveryStream.CloudWatchLoggingOptionsProperty | undefined {
    if (this.props.logging === false && this.props.logGroup) {
      throw new Error('logging cannot be set to false when logGroup is provided');
    }
    if (this.props.logging !== false || this.props.logGroup) {
      this.logGroup = this.logGroup ?? this.props.logGroup ?? new logs.LogGroup(scope, 'LogGroup');
      this.logGroup.grantWrite(deliveryStream);
      return {
        enabled: true,
        logGroupName: this.logGroup.logGroupName,
        logStreamName: this.logGroup.addStream(streamId).logStreamName,
      };
    }
    return undefined;
  }
}
