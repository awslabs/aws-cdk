import * as iam from '@aws-cdk/aws-iam';
import * as firehose from '@aws-cdk/aws-kinesisfirehose';
import { CfnDeliveryStream } from '@aws-cdk/aws-kinesisfirehose';
import * as s3 from '@aws-cdk/aws-s3';
import { Construct } from 'constructs';

/**
 * Props for defining an S3 destination of a Kinesis Data Firehose delivery stream.
 */
export interface S3Props extends firehose.DestinationProps {
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
      bucketArn: this.bucket.bucketArn,
      compressionFormat: this.s3Props.compression?.value,
      errorOutputPrefix: this.s3Props.errorOutputPrefix,
      prefix: this.s3Props.prefix,
    };
  }
}
