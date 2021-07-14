import * as iam from '@aws-cdk/aws-iam';
import * as firehose from '@aws-cdk/aws-kinesisfirehose';
import { CfnDeliveryStream } from '@aws-cdk/aws-kinesisfirehose';
import * as kms from '@aws-cdk/aws-kms';
import * as s3 from '@aws-cdk/aws-s3';
import { Duration, Size } from '@aws-cdk/core';
import { Construct } from 'constructs';

/**
 * Props for defining an S3 destination of a Kinesis Data Firehose delivery stream.
 */
export interface S3Props extends firehose.DestinationProps {
  /**
     * The length of time that Firehose buffers incoming data before delivering
     * it to the S3 bucket.
     *
     * If bufferingInterval is specified, bufferingSize must also be specified.
     * Minimum: Duration.seconds(60)
     * Maximum: Duration.seconds(900)
     *
     * @default Duration.seconds(300)
     */
  readonly bufferingInterval?: Duration;

  /**
   * The size of the buffer that Kinesis Data Firehose uses for incoming data before
   * delivering it to the S3 bucket.
   *
   * If bufferingSize is specified, bufferingInterval must also be specified.
   * Minimum: Size.mebibytes(1)
   * Maximum: Size.mebibytes(128)
   *
   * @default Size.mebibytes(5)
   */
  readonly bufferingSize?: Size;

  /**
   * The type of compression that Kinesis Data Firehose uses to compress the data
   * that it delivers to the Amazon S3 bucket.
   *
   * The compression formats SNAPPY or ZIP cannot be specified for Amazon Redshift
   * destinations because they are not supported by the Amazon Redshift COPY operation
   * that reads from the S3 bucket.
   *
   * @default - UNCOMPRESSED
   */
  readonly compression?: firehose.Compression;

  /**
   * The AWS KMS key used to encrypt the data that it delivers to your Amazon S3 bucket.
   *
   * @default - Data is not encrypted.
   */
  readonly encryptionKey?: kms.IKey;

  /**
   * A prefix that Kinesis Data Firehose evaluates and adds to failed records before writing them to S3.
   *
   * This prefix appears immediately following the bucket name.
   * @see https://docs.aws.amazon.com/firehose/latest/dev/s3-prefixes.html
   *
   * @default "YYYY/MM/DD/HH"
   */
  readonly errorOutputPrefix?: string;

  /**
   * A prefix that Kinesis Data Firehose evaluates and adds to records before writing them to S3.
   *
   * This prefix appears immediately following the bucket name.
   * @see https://docs.aws.amazon.com/firehose/latest/dev/s3-prefixes.html
   *
   * @default "YYYY/MM/DD/HH"
   */
  readonly prefix?: string;
}

/**
 * An S3 bucket destination for data from a Kinesis Data Firehose delivery stream.
 */
export class S3 extends firehose.DestinationBase {
  constructor(private readonly bucket: s3.IBucket, private readonly s3Props: S3Props = {}) {
    super(s3Props);
  }

  bind(scope: Construct, options: firehose.DestinationBindOptions): firehose.DestinationConfig {
    return {
      properties: {
        extendedS3DestinationConfiguration: this.createExtendedS3DestinationConfiguration(scope, options.deliveryStream),
      },
    };
  }

  private createExtendedS3DestinationConfiguration(
    scope: Construct,
    deliveryStream: firehose.IDeliveryStream,
  ): CfnDeliveryStream.ExtendedS3DestinationConfigurationProperty {
    this.bucket.grantReadWrite(deliveryStream);
    return {
      cloudWatchLoggingOptions: this.createLoggingOptions(scope, deliveryStream, 'S3Destination'),
      roleArn: (deliveryStream.grantPrincipal as iam.IRole).roleArn,
      bufferingHints: this.createBufferingHints(this.s3Props.bufferingInterval, this.s3Props.bufferingSize),
      bucketArn: this.bucket.bucketArn,
      compressionFormat: this.s3Props.compression?.value,
      encryptionConfiguration: this.createEncryptionConfig(deliveryStream, this.s3Props.encryptionKey),
      errorOutputPrefix: this.s3Props.errorOutputPrefix,
      prefix: this.s3Props.prefix,
    };
  }
}
