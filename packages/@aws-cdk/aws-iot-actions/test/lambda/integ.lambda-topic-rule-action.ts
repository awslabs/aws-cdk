import * as iot from '@aws-cdk/aws-iot';
import * as lambda from '@aws-cdk/aws-lambda';

import * as cdk from '@aws-cdk/core';
import * as actions from '../../lib';

/**
 * Define a rule that triggers a Lambda function when data is received.
 *
 * Automatically creates invoke permission
 */
const app = new cdk.App();

const stack = new cdk.Stack(app, 'aws-cdk-lambda-topic-rule-action');

const func = new lambda.Function(stack, 'Function', {
  code: lambda.Code.fromInline('boom'),
  handler: 'index.handler',
  runtime: lambda.Runtime.NODEJS_12_X,
});

const rule = new iot.TopicRule(stack, 'MyIotTopicRule', {
  sql: 'SELECT * FROM \'topic/subtopic\'',
});

rule.addAction(new actions.LambdaFunction(func));

app.synth();
