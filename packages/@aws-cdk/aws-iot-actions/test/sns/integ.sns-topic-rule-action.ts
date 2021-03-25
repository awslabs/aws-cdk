import * as iot from '@aws-cdk/aws-iot';
import * as sns from '@aws-cdk/aws-sns';

import * as cdk from '@aws-cdk/core';
import * as actions from '../../lib';

const app = new cdk.App();

const stack = new cdk.Stack(app, 'aws-cdk-topic-rule-sns-action');

const topic = new sns.Topic(stack, 'MyTopic');

const rule = new iot.TopicRule(stack, 'My', {
  sql: 'SELECT * FROM \'topic/subtopic\'',
});

rule.addAction(new actions.SnsTopic(topic));

app.synth();
