import * as s3 from '@aws-cdk/aws-s3';
import * as sns from '@aws-cdk/aws-sns';
import * as cdk from '@aws-cdk/core';
import * as s3n from '../../lib';

class MyStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string) {
    super(scope, id);

    const objectCreateTopic = new sns.Topic(this, 'ObjectCreatedTopic');
    const objectRemovedTopic = new sns.Topic(this, 'ObjectDeletedTopic');
    const bucket = new s3.Bucket(this, 'MyBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    bucket.addObjectCreatedNotification(new s3n.SnsDestination(objectCreateTopic));
    bucket.addObjectRemovedNotification(new s3n.SnsDestination(objectRemovedTopic), { prefix: 'foo/', suffix: '.txt' });
  }
}

const app = new cdk.App();

new MyStack(app, 'sns-bucket-notifications');

app.synth();
