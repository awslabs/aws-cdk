import { expect, haveResource, countResources } from '@aws-cdk/assert';
import * as iam from '@aws-cdk/aws-iam';
import * as iot from '@aws-cdk/aws-iot';
import * as sqs from '@aws-cdk/aws-sqs';
import { Stack } from '@aws-cdk/core';
import * as actions from '../../lib';

test('sns topic as a rule action', () => {
  // GIVEN
  const stack = new Stack();
  const queue = new sqs.Queue(stack, 'MyQueue');
  const rule = new iot.TopicRule(stack, 'MyRule', {
    sql: 'SELECT',
  });

  // WHEN
  rule.addAction(new actions.SqsQueue(queue));

  // THEN
  expect(stack).to(haveResource('AWS::SQS::QueuePolicy', {
    PolicyDocument: {
      Statement: [
        {
          Action: [
            'sqs:SendMessage',
            'sqs:GetQueueAttributes',
            'sqs:GetQueueUrl',
          ],
          Effect: 'Allow',
          Principal: { Service: 'iot.amazonaws.com' },
          Resource: {
            'Fn::GetAtt': ['MyQueueE6CA6235', 'Arn'],
          },
        },
      ],
      Version: '2012-10-17',
    },
    Queues: [{ Ref: 'MyQueueE6CA6235' }],
  }));
  expect(stack).to(haveResource('AWS::IoT::TopicRule', {
    TopicRulePayload: {
      Actions: [
        {
          Sqs: {
            QueueUrl: { Ref: 'MyQueueE6CA6235' },
            RoleArn: {
              'Fn::GetAtt': ['MyRuleAllowIot33481905', 'Arn'],
            },
            UseBase64: false,
          },
        },
      ],
      AwsIotSqlVersion: '2015-10-08',
      RuleDisabled: false,
      Sql: 'SELECT',
    },
  }));
});

test('sqs topic with role as a rule action', () => {
  // GIVEN
  const stack = new Stack();
  const queue = new sqs.Queue(stack, 'MyQueue');
  const role = new iam.Role(stack, 'MyCustomRole', {
    assumedBy: new iam.ServicePrincipal('iot.amazonaws.com'),
  });
  const rule = new iot.TopicRule(stack, 'MyRule', {
    sql: 'SELECT',
  });

  // WHEN
  rule.addAction(new actions.SqsQueue(queue, { role: role }));

  expect(stack).to(haveResource('AWS::IoT::TopicRule', {
    TopicRulePayload: {
      Actions: [
        {
          Sqs: {
            QueueUrl: { Ref: 'MyQueueE6CA6235' },
            RoleArn: {
              'Fn::GetAtt': ['MyCustomRoleC8C89DCB', 'Arn'],
            },
            UseBase64: false,
          },
        },
      ],
      AwsIotSqlVersion: '2015-10-08',
      RuleDisabled: false,
      Sql: 'SELECT',
    },
  }));
});
test('multiple uses of a queue as an action results in a single policy statement', () => {
  // GIVEN
  const stack = new Stack();
  const queue = new sqs.Queue(stack, 'MyQueue');

  //WHEN
  for (let i = 0; i < 5; ++i) {
    const rule = new iot.TopicRule(stack, `Rule${i}`, {
      sql: 'SELECT',
    });
    rule.addAction(new actions.SqsQueue(queue));
  }

  // THEN
  expect(stack).to(countResources('AWS::SQS::QueuePolicy', 1));
  expect(stack).to(haveResource('AWS::SQS::QueuePolicy', {
    PolicyDocument: {
      Statement: [
        {
          Action: [
            'sqs:SendMessage',
            'sqs:GetQueueAttributes',
            'sqs:GetQueueUrl',
          ],
          Effect: 'Allow',
          Principal: { Service: 'iot.amazonaws.com' },
          Resource: {
            'Fn::GetAtt': ['MyQueueE6CA6235', 'Arn'],
          },
        },
      ],
      Version: '2012-10-17',
    },
    Queues: [{ Ref: 'MyQueueE6CA6235' }],
  }));
});
