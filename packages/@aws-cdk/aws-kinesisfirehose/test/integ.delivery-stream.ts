#!/usr/bin/env node
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import * as constructs from 'constructs';
import * as firehose from '../lib';

const app = new cdk.App();

const stack = new cdk.Stack(app, 'aws-cdk-firehose-delivery-stream');

const bucket = new s3.Bucket(stack, 'Bucket', {
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});

const role = new iam.Role(stack, 'Role', {
  assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
});

const mockS3Destination: firehose.IDestination = {
  bind(_scope: constructs.Construct, _options: firehose.DestinationBindOptions): firehose.DestinationConfig {
    return {
      properties: {
        s3DestinationConfiguration: {
          bucketArn: bucket.bucketArn,
          roleArn: role.roleArn,
        },
      },
    };
  },
};

new firehose.DeliveryStream(stack, 'Delivery Stream', {
  destinations: [mockS3Destination],
});

app.synth();
