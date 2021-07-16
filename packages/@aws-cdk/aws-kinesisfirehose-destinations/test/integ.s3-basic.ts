#!/usr/bin/env node
import * as firehose from '@aws-cdk/aws-kinesisfirehose';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import * as destinations from '../lib';

const app = new cdk.App();

const stack = new cdk.Stack(app, 'aws-cdk-firehose-delivery-stream-s3-basic');

const bucket = new s3.Bucket(stack, 'Bucket', {
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  autoDeleteObjects: true,
});

new firehose.DeliveryStream(stack, 'Delivery Stream', {
  destinations: [new destinations.S3Bucket(bucket)],
});

app.synth();