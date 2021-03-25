import * as iot from '@aws-cdk/aws-iot';
import * as lambda from '@aws-cdk/aws-lambda';
import * as sns from '@aws-cdk/aws-sns';
import { App, Stack } from '@aws-cdk/core';
import * as actions from '../lib';

const app = new App();
const stack = new Stack(app, 'MyTopicRule');

const rule = new iot.TopicRule(stack, 'MyNotifierTopic', {
  sql: 'SELECT teapots FROM \'coffee/shop\'',
  errorAction: new actions.SnsTopic(new sns.Topic(stack, 'ErrorTopic')),
});

const func = new lambda.Function(stack, 'Function', {
  code: lambda.Code.fromInline('boom'),
  handler: 'index.handler',
  runtime: lambda.Runtime.NODEJS_12_X,
});

rule.addAction(new actions.LambdaFunction(func));

new iot.TopicRule(stack, 'MyWorkTopic', {
  sql: 'SELECT * FROM \'inventory\'',
  actions: [new actions.RepublishTopic(rule, { topic: 'coffee/shop' })],
});

