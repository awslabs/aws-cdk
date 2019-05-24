import s3 = require('@aws-cdk/aws-s3');
import cdk = require('@aws-cdk/cdk');
import sns = require('../lib');

class MyStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string) {
    super(scope, id);

    const objectCreateTopic = new sns.Topic(this, 'ObjectCreatedTopic');
    const objectRemovedTopic = new sns.Topic(this, 'ObjectDeletedTopic');
    const bucket = new s3.Bucket(this, 'MyBucket', {
        removalPolicy: cdk.RemovalPolicy.Destroy
    });

    bucket.addObjectCreatedNotification(objectCreateTopic);
    bucket.addObjectRemovedNotification(objectRemovedTopic, { prefix: 'foo/', suffix: '.txt' });

  }
}

const app = new cdk.App();

new MyStack(app, 'sns-bucket-notifications');

app.run();
