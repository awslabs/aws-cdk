import * as s3 from '@aws-cdk/aws-s3';
import * as sns from '@aws-cdk/aws-sns';
import * as cdk from '@aws-cdk/core';
import * as s3n from '../lib';

const app = new cdk.App();

const stack = new cdk.Stack(app, 'test-3');

const bucket = new s3.Bucket(stack, 'Bucket', {
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});
const topic = new sns.Topic(stack, 'Topic');
const topic3 = new sns.Topic(stack, 'Topic3');

bucket.addEventNotification(s3.EventType.OBJECT_CREATED_PUT, new s3n.SnsDestination(topic));
bucket.addEventNotification(s3.EventType.OBJECT_REMOVED, new s3n.SnsDestination(topic3), { prefix: 'home/myusername/' });

const bucket2 = new s3.Bucket(stack, 'Bucket2', {
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});
bucket2.addObjectRemovedNotification(new s3n.SnsDestination(topic3), { prefix: 'foo' }, { suffix: 'foo/bar' });

const bucket3 = s3.Bucket.fromBucketName(stack, 'Bucket3', bucket2.bucketName);
bucket3.addEventNotification(s3.EventType.OBJECT_CREATED_COPY, new s3n.SnsDestination(topic3));

app.synth();
