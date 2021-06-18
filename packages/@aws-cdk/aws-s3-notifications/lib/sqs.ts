import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import * as sqs from '@aws-cdk/aws-sqs';
import { Construct } from '@aws-cdk/core';

/**
 * Use an SQS queue as a bucket notification destination
 */
export class SqsDestination implements s3.IBucketNotificationDestination {
  constructor(private readonly queue: sqs.IQueue) {
  }

  /**
   * Allows using SQS queues as destinations for bucket notifications.
   * Use `bucket.onEvent(event, queue)` to subscribe.
   */
  public bind(_scope: Construct, bucket: s3.IBucket): s3.BucketNotificationDestinationConfig {
    this.queue.grantSendMessages(new iam.ServicePrincipal('s3.amazonaws.com', {
      conditions: {
        ArnLike: { 'aws:SourceArn': bucket.bucketArn },
      },
    }));

    // if this queue is encrypted, we need to allow S3 to read messages since that's how
    // it verifies that the notification destination configuration is valid.
    if (this.queue.encryptionMasterKey) {
      this.queue.encryptionMasterKey.addToResourcePolicy(new iam.PolicyStatement({
        principals: [new iam.ServicePrincipal('s3.amazonaws.com')],
        actions: ['kms:GenerateDataKey*', 'kms:Decrypt'],
        resources: ['*'],
      }), /* allowNoOp */ false);
    }

    return {
      arn: this.queue.queueArn,
      type: s3.BucketNotificationDestinationType.QUEUE,
      dependencies: [this.queue],
    };
  }
}
