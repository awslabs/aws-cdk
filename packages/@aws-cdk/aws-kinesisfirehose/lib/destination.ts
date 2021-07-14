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
 * Possible compression options Kinesis Data Firehose can use to compress data on delivery.
 */
export class Compression {
  /**
   * gzip
   */
  public static readonly GZIP = new Compression('GZIP');

  /**
   * Hadoop-compatible Snappy
   */
  public static readonly HADOOP_SNAPPY = new Compression('HADOOP_SNAPPY');

  /**
   * Snappy
   */
  public static readonly SNAPPY = new Compression('Snappy');

  /**
   * Uncompressed
   */
  public static readonly UNCOMPRESSED = new Compression('UNCOMPRESSED');

  /**
   * ZIP
   */
  public static readonly ZIP = new Compression('ZIP');

  constructor(
    /**
     * String value of the Compression.
     */
    public readonly value: string,
  ) { }
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
  private logGroups: { [logGroupId: string]: logs.ILogGroup } = {};

  constructor(protected readonly props: DestinationProps = {}) { }

  abstract bind(scope: Construct, options: DestinationBindOptions): DestinationConfig;

  protected createLoggingOptions(
    scope: Construct,
    deliveryStream: IDeliveryStream,
    streamId: string,
  ): CfnDeliveryStream.CloudWatchLoggingOptionsProperty | undefined {
    return this._createLoggingOptions(scope, deliveryStream, streamId, 'LogGroup', this.props.logging, this.props.logGroup);
  }

  private _createLoggingOptions(
    scope: Construct,
    deliveryStream: IDeliveryStream,
    streamId: string,
    logGroupId: string,
    logging?: boolean,
    propsLogGroup?: logs.ILogGroup,
  ): CfnDeliveryStream.CloudWatchLoggingOptionsProperty | undefined {
    if (logging === false && propsLogGroup) {
      throw new Error('logging cannot be set to false when logGroup is provided');
    }
    if (logging !== false || propsLogGroup) {
      this.logGroups[logGroupId] = this.logGroups[logGroupId] ?? propsLogGroup ?? new logs.LogGroup(scope, logGroupId);
      this.logGroups[logGroupId].grantWrite(deliveryStream);
      return {
        enabled: true,
        logGroupName: this.logGroups[logGroupId].logGroupName,
        logStreamName: this.logGroups[logGroupId].addStream(streamId).logStreamName,
      };
    }
    return undefined;
  }
}
