import '@aws-cdk/assert/jest';
import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import * as sqs from '@aws-cdk/aws-sqs';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import * as targets from '../../lib';

test('State machine can be used as Event Rule target', () => {
  // GIVEN
  const stack = new cdk.Stack();
  const rule = new events.Rule(stack, 'Rule', {
    schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
  });
  const stateMachine = new sfn.StateMachine(stack, 'SM', {
    definition: new sfn.Wait(stack, 'Hello', { time: sfn.WaitTime.duration(cdk.Duration.seconds(10)) }),
  });

  // WHEN
  rule.addTarget(new targets.SfnStateMachine(stateMachine, {
    input: events.RuleTargetInput.fromObject({ SomeParam: 'SomeValue' }),
  }));

  // THEN
  expect(stack).toHaveResourceLike('AWS::Events::Rule', {
    Targets: [
      {
        Input: '{"SomeParam":"SomeValue"}',
      },
    ],
  });
  expect(stack).toHaveResourceLike('AWS::IAM::Role', {
    AssumeRolePolicyDocument: {
      Statement: [
        {
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: {
            Service: 'events.amazonaws.com',
          },
        },
      ],
    },
  });
  expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: [
        {
          Action: 'states:StartExecution',
          Effect: 'Allow',
          Resource: {
            Ref: 'SM934E715A',
          },
        },
      ],
    },
  });
});

test('Existing role can be used for State machine Rule target', () => {
  // GIVEN
  const stack = new cdk.Stack();
  const rule = new events.Rule(stack, 'Rule', {
    schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
  });
  const role = new iam.Role(stack, 'Role', {
    assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
  });
  const stateMachine = new sfn.StateMachine(stack, 'SM', {
    definition: new sfn.Wait(stack, 'Hello', { time: sfn.WaitTime.duration(cdk.Duration.seconds(10)) }),
    role,
  });

  // WHEN
  rule.addTarget(new targets.SfnStateMachine(stateMachine, {
    input: events.RuleTargetInput.fromObject({ SomeParam: 'SomeValue' }),
  }));

  // THEN
  expect(stack).toHaveResourceLike('AWS::Events::Rule', {
    Targets: [
      {
        Input: '{"SomeParam":"SomeValue"}',
      },
    ],
  });
  expect(stack).toHaveResourceLike('AWS::IAM::Role', {
    AssumeRolePolicyDocument: {
      Statement: [
        {
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: {
            Service: 'events.amazonaws.com',
          },
        },
      ],
    },
  });
  expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: [
        {
          Action: 'states:StartExecution',
          Effect: 'Allow',
          Resource: {
            Ref: 'SM934E715A',
          },
        },
      ],
    },
  });
});

test('specifying retry policy', () => {
  // GIVEN
  const stack = new cdk.Stack();
  const rule = new events.Rule(stack, 'Rule', {
    schedule: events.Schedule.expression('rate(1 hour)'),
  });

  // WHEN
  const role = new iam.Role(stack, 'Role', {
    assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
  });
  const stateMachine = new sfn.StateMachine(stack, 'SM', {
    definition: new sfn.Wait(stack, 'Hello', { time: sfn.WaitTime.duration(cdk.Duration.seconds(10)) }),
    role,
  });

  rule.addTarget(new targets.SfnStateMachine(stateMachine, {
    input: events.RuleTargetInput.fromObject({ SomeParam: 'SomeValue' }),
    maxEventAge: cdk.Duration.hours(2),
    retryAttempts: 2,
  }));

  // THEN
  expect(stack).toHaveResource('AWS::Events::Rule', {
    ScheduleExpression: 'rate(1 hour)',
    State: 'ENABLED',
    Targets: [
      {
        Arn: {
          Ref: 'SM934E715A',
        },
        Id: 'Target0',
        Input: '{"SomeParam":"SomeValue"}',
        RetryPolicy: {
          MaximumEventAgeInSeconds: 7200,
          MaximumRetryAttempts: 2,
        },
        RoleArn: {
          'Fn::GetAtt': [
            'SMEventsRoleB320A902',
            'Arn',
          ],
        },
      },
    ],
  });
});

test('use a Dead Letter Queue for the rule target', () => {
  // GIVEN
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'Stack');

  const rule = new events.Rule(stack, 'Rule', {
    schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
  });

  const dlq = new sqs.Queue(stack, 'DeadLetterQueue');

  const role = new iam.Role(stack, 'Role', {
    assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
  });
  const stateMachine = new sfn.StateMachine(stack, 'SM', {
    definition: new sfn.Wait(stack, 'Hello', { time: sfn.WaitTime.duration(cdk.Duration.seconds(10)) }),
    role,
  });

  // WHEN
  rule.addTarget(new targets.SfnStateMachine(stateMachine, {
    input: events.RuleTargetInput.fromObject({ SomeParam: 'SomeValue' }),
    deadLetterQueue: dlq,
  }));

  // the Permission resource should be in the event stack
  expect(stack).toHaveResource('AWS::Events::Rule', {
    ScheduleExpression: 'rate(1 minute)',
    State: 'ENABLED',
    Targets: [
      {
        Arn: {
          Ref: 'SM934E715A',
        },
        DeadLetterConfig: {
          Arn: {
            'Fn::GetAtt': [
              'DeadLetterQueue9F481546',
              'Arn',
            ],
          },
        },
        Id: 'Target0',
        Input: '{"SomeParam":"SomeValue"}',
        RoleArn: {
          'Fn::GetAtt': [
            'SMEventsRoleB320A902',
            'Arn',
          ],
        },
      },
    ],
  });

  expect(stack).toHaveResource('AWS::SQS::QueuePolicy', {
    PolicyDocument: {
      Statement: [
        {
          Action: 'sqs:SendMessage',
          Condition: {
            ArnEquals: {
              'aws:SourceArn': {
                'Fn::GetAtt': [
                  'Rule4C995B7F',
                  'Arn',
                ],
              },
            },
          },
          Effect: 'Allow',
          Principal: {
            Service: 'events.amazonaws.com',
          },
          Resource: {
            'Fn::GetAtt': [
              'DeadLetterQueue9F481546',
              'Arn',
            ],
          },
          Sid: 'AllowEventRuleStackRuleF6E31DD0',
        },
      ],
      Version: '2012-10-17',
    },
    Queues: [
      {
        Ref: 'DeadLetterQueue9F481546',
      },
    ],
  });
});
