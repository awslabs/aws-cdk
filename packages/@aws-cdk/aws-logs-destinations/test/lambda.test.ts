import '@aws-cdk/assert-internal/jest';
import * as lambda from '@aws-cdk/aws-lambda';
import * as logs from '@aws-cdk/aws-logs';
import * as cdk from '@aws-cdk/core';
import * as dests from '../lib';

let stack: cdk.Stack;
let fn: lambda.Function;
let logGroup: logs.LogGroup;

beforeEach(() => {
  // GIVEN
  stack = new cdk.Stack();
  fn = new lambda.Function(stack, 'MyLambda', {
    code: new lambda.InlineCode('foo'),
    handler: 'index.handler',
    runtime: lambda.Runtime.NODEJS_10_X,
  });
  logGroup = new logs.LogGroup(stack, 'LogGroup');
});

test('lambda can be used as metric subscription destination', () => {
  // WHEN
  new logs.SubscriptionFilter(stack, 'Subscription', {
    logGroup,
    destination: new dests.LambdaDestination(fn),
    filterPattern: logs.FilterPattern.allEvents(),
  });

  // THEN: subscription target is Lambda
  expect(stack).toHaveResource('AWS::Logs::SubscriptionFilter', {
    DestinationArn: { 'Fn::GetAtt': ['MyLambdaCCE802FB', 'Arn'] },
  });

  // THEN: Lambda has permissions to be invoked by CWL
  expect(stack).toHaveResource('AWS::Lambda::Permission', {
    Action: 'lambda:InvokeFunction',
    FunctionName: { 'Fn::GetAtt': ['MyLambdaCCE802FB', 'Arn'] },
    Principal: 'logs.amazonaws.com',
  });
});

test('can have multiple subscriptions use the same Lambda', () => {
  // WHEN
  new logs.SubscriptionFilter(stack, 'Subscription', {
    logGroup,
    destination: new dests.LambdaDestination(fn),
    filterPattern: logs.FilterPattern.allEvents(),
  });

  new logs.SubscriptionFilter(stack, 'Subscription2', {
    logGroup: new logs.LogGroup(stack, 'LG2'),
    destination: new dests.LambdaDestination(fn),
    filterPattern: logs.FilterPattern.allEvents(),
  });

  // THEN: Lambda has permissions to be invoked by CWL from both Source Arns
  expect(stack).toHaveResource('AWS::Lambda::Permission', {
    Action: 'lambda:InvokeFunction',
    FunctionName: { 'Fn::GetAtt': ['MyLambdaCCE802FB', 'Arn'] },
    SourceArn: { 'Fn::GetAtt': ['LogGroupF5B46931', 'Arn'] },
    Principal: 'logs.amazonaws.com',
  });

  expect(stack).toHaveResource('AWS::Lambda::Permission', {
    Action: 'lambda:InvokeFunction',
    FunctionName: { 'Fn::GetAtt': ['MyLambdaCCE802FB', 'Arn'] },
    SourceArn: { 'Fn::GetAtt': ['LG224A94C8F', 'Arn'] },
    Principal: 'logs.amazonaws.com',
  });
});

test('lambda permissions are not added when addPermissions is false', () => {
  // WHEN
  new logs.SubscriptionFilter(stack, 'Subscription', {
    logGroup,
    destination: new dests.LambdaDestination(fn, { addPermissions: false }),
    filterPattern: logs.FilterPattern.allEvents(),
  });

  // THEN: subscription target is Lambda
  expect(stack).toHaveResource('AWS::Logs::SubscriptionFilter', {
    DestinationArn: { 'Fn::GetAtt': ['MyLambdaCCE802FB', 'Arn'] },
  });

  // THEN: Lambda does not have permissions to be invoked by CWL
  expect(stack).not.toHaveResource('AWS::Lambda::Permission', {
    Action: 'lambda:InvokeFunction',
    FunctionName: { 'Fn::GetAtt': ['MyLambdaCCE802FB', 'Arn'] },
    Principal: 'logs.amazonaws.com',
  });
});