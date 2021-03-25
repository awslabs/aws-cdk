import * as iot from '@aws-cdk/aws-iot';
import * as sqs from '@aws-cdk/aws-sqs';

import * as cdk from '@aws-cdk/core';
import * as actions from '../../lib';

const app = new cdk.App();

const stack = new cdk.Stack(app, 'aws-cdk-topic-rule-sns-action');

const queue = new sqs.Queue(stack, 'MyQueue');

const rule = new iot.TopicRule(stack, 'My', {
  sql: 'SELECT * FROM \'topic/subtopic\'',
});

rule.addAction(new actions.SqsQueue(queue));

app.synth();
