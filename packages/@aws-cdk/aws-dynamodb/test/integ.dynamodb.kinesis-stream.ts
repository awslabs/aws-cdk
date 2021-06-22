import * as kinesis from '@aws-cdk/aws-kinesis';
import * as cdk from '@aws-cdk/core';
import * as dynamodb from '../lib';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'aws-cdk-dynamodb-kinesis-stream');

const stream = new kinesis.Stream(stack, 'Stream');

new dynamodb.Table(stack, 'Table', {
  partitionKey: { name: 'hashKey', type: dynamodb.AttributeType.STRING },
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  kinesisStream: stream,
});

app.synth();
