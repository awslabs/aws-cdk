import '@aws-cdk/assert/jest';
import * as iot from '@aws-cdk/aws-iot';
import * as lambda from '@aws-cdk/aws-lambda';
import { Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import * as actions from '../../lib';

test('add lambda action', () => {
  const stack = new Stack();
  const rule = new iot.TopicRule(stack, 'TopicRule', {
    sql: 'SELECT * FROM \'topic/subtopic\'',
  });
  const fn = new lambda.Function(stack, 'Function', {
    code: lambda.Code.fromInline('boom'),
    handler: 'index.handler',
    runtime: lambda.Runtime.NODEJS_8_10,
  });

  rule.addAction(new actions.LambdaFunction(fn));

  expect(stack).toHaveResourceLike('AWS::IoT::TopicRule', {
    TopicRulePayload: {
      Actions: [
        {
          Lambda: { FunctionArn: { 'Fn::GetAtt': ['Function76856677', 'Arn'] } },
        },
      ],
      RuleDisabled: false,
      Sql: 'SELECT * FROM \'topic/subtopic\'',
    },
  });

  expect(stack).toHaveResourceLike('AWS::Lambda::Permission', {
    Action: 'lambda:InvokeFunction',
    FunctionName: {
      'Fn::GetAtt': [
        'Function76856677',
        'Arn',
      ],
    },
    Principal: 'iot.amazonaws.com',
    SourceAccount: {
      Ref: 'AWS::AccountId',
    },
  });
});
test('adding different lambda functions as target mutiple times creates multiple permissions', () => {
  // GIVEN
  const stack = new Stack();
  const fn1 = newTestLambda(stack);
  const fn2 = newTestLambda(stack, '2');
  const rule = new iot.TopicRule(stack, 'Rule', {
    sql: 'SELECT',
  });

  // WHEN
  rule.addAction(new actions.LambdaFunction(fn1));
  rule.addAction(new actions.LambdaFunction(fn2));

  // THEN
  expect(stack).toCountResources('AWS::Lambda::Permission', 2);
});
test('adding same lambda function as target mutiple times creates permission only once', () => {
  // GIVEN
  const stack = new Stack();
  const fn = newTestLambda(stack);
  const rule = new iot.TopicRule(stack, 'Rule', {
    sql: 'SELECT',
  });

  // WHEN
  rule.addAction(new actions.LambdaFunction(fn));
  rule.addAction(new actions.LambdaFunction(fn));

  // THEN
  expect(stack).toCountResources('AWS::Lambda::Permission', 1);
});
test('adding same singleton lambda function as target mutiple times creates permission only once', () => {
  // GIVEN
  const stack = new Stack();
  const fn = new lambda.SingletonFunction(stack, 'MyLambda', {
    code: new lambda.InlineCode('foo'),
    handler: 'bar',
    runtime: lambda.Runtime.PYTHON_2_7,
    uuid: 'uuid',
  });

  const rule = new iot.TopicRule(stack, 'Rule', {
    sql: 'SELECT',
  });

  // WHEN
  rule.addAction(new actions.LambdaFunction(fn));
  rule.addAction(new actions.LambdaFunction(fn));

  // THEN
  expect(stack).toCountResources('AWS::Lambda::Permission', 1);
});
function newTestLambda(scope: Construct, suffix = '') {
  return new lambda.Function(scope, `MyLambda${suffix}`, {
    code: new lambda.InlineCode('foo'),
    handler: 'bar',
    runtime: lambda.Runtime.PYTHON_2_7,
  });
}
