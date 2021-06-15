#!/usr/bin/env node
import * as iam from '@aws-cdk/aws-iam';
import * as firehose from '@aws-cdk/aws-kinesisfirehose';
import * as logs from '@aws-cdk/aws-logs';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import { Construct } from 'constructs';
import * as dests from '../lib';

/*
 * Stack verification steps:
 * 1. `aws logs create-log-stream --log-group-name <log-group-name> --log-stream-name MyIntegTestLogStream`
 * 2. `aws logs put-log-events --log-group-name <log-group-name> --log-stream-name MyIntegTestLogStream --log-events timestamp=$(date +%s000),message=hello`
 * 3. Wait a few minutes for Kinesis to deliver log to S3
 * 4. `aws s3 ls s3://<bucket-name> --recursive` should list one object
 */

class TestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create Firehose Stream that will deliver to S3 bucket
    const bucket = new s3.Bucket(this, 'Bucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Following example from https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/SubscriptionFilters.html#FirehoseExample
    const firehoseRole = new iam.Role(this, 'FirehoseRole', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
      inlinePolicies: {
        allowToDeliverToS3Bucket: new iam.PolicyDocument({
          statements: [new iam.PolicyStatement({
            actions: [
              's3:AbortMultipartUpload',
              's3:GetBucketLocation',
              's3:GetObject',
              's3:ListBucket',
              's3:ListBucketMultipartUploads',
              's3:PutObject',
            ],
            resources: [
              bucket.bucketArn,
              `${bucket.bucketArn}/*`,
            ],
          })],
        }),
      },
    });

    const deliveryStream = new firehose.CfnDeliveryStream(this, 'MyFirehose', {
      extendedS3DestinationConfiguration: {
        bucketArn: bucket.bucketArn,
        roleArn: firehoseRole.roleArn,
      },
    });
    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new logs.SubscriptionFilter(this, 'Subscription', {
      logGroup,
      destination: new dests.KinesisFirehoseDestination(deliveryStream),
      filterPattern: logs.FilterPattern.allEvents(),
    });
  }
}

const app = new cdk.App();
new TestStack(app, 'cdk-logs-destinations-firehose-to-s3');
app.synth();
