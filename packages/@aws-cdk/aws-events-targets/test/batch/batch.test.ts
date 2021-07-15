import { expect, haveResource } from '@aws-cdk/assert-internal';
import * as batch from '@aws-cdk/aws-batch';
import { ContainerImage } from '@aws-cdk/aws-ecs';
import * as events from '@aws-cdk/aws-events';
import * as sqs from '@aws-cdk/aws-sqs';
import { Duration, Stack } from '@aws-cdk/core';
import * as targets from '../../lib';

describe('Batch job event target', () => {
  let stack: Stack;
  let jobQueue: batch.JobQueue;
  let jobDefinition: batch.JobDefinition;


  beforeEach(() => {
    stack = new Stack();
    jobQueue = new batch.JobQueue(stack, 'MyQueue', {
      computeEnvironments: [
        {
          computeEnvironment: new batch.ComputeEnvironment(stack, 'ComputeEnvironment', {
            managed: false,
          }),
          order: 1,
        },
      ],
    });
    jobDefinition = new batch.JobDefinition(stack, 'MyJob', {
      container: {
        image: ContainerImage.fromRegistry('test-repo'),
      },
    });
  });

  test('use aws batch job as an event rule target', () => {
    // GIVEN
    const rule = new events.Rule(stack, 'Rule', {
      schedule: events.Schedule.expression('rate(1 min)'),
    });

    // WHEN
    rule.addTarget(new targets.BatchJob(jobQueue.jobQueueArn, jobQueue, jobDefinition.jobDefinitionArn, jobDefinition));

    // THEN
    expect(stack).to(haveResource('AWS::Events::Rule', {
      ScheduleExpression: 'rate(1 min)',
      State: 'ENABLED',
      Targets: [
        {
          Arn: {
            Ref: 'MyQueueE6CA6235',
          },
          Id: 'Target0',
          RoleArn: {
            'Fn::GetAtt': [
              'MyJobEventsRoleCF43C336',
              'Arn',
            ],
          },
          BatchParameters: {
            JobDefinition: { Ref: 'MyJob8719E923' },
            JobName: 'Rule',
          },
        },
      ],
    }));

    expect(stack).to(haveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'batch:SubmitJob',
            Effect: 'Allow',
            Resource: [
              { Ref: 'MyJob8719E923' },
              { Ref: 'MyQueueE6CA6235' },
            ],
          },
        ],
        Version: '2012-10-17',
      },
      Roles: [
        { Ref: 'MyJobEventsRoleCF43C336' },
      ],
    }));
  });

  test('use a Dead Letter Queue for the rule target', () => {
    // GIVEN
    const rule = new events.Rule(stack, 'Rule', {
      schedule: events.Schedule.expression('rate(1 hour)'),
    });

    const queue = new sqs.Queue(stack, 'Queue');

    // WHEN
    const eventInput = {
      buildspecOverride: 'buildspecs/hourly.yml',
    };

    rule.addTarget(new targets.BatchJob(
      jobQueue.jobQueueArn,
      jobQueue,
      jobDefinition.jobDefinitionArn,
      jobDefinition, {
        deadLetterQueue: queue,
        event: events.RuleTargetInput.fromObject(eventInput),
      },
    ));

    // THEN
    expect(stack).to(haveResource('AWS::Events::Rule', {
      Targets: [
        {
          Arn: {
            Ref: 'MyQueueE6CA6235',
          },
          Id: 'Target0',
          DeadLetterConfig: {
            Arn: {
              'Fn::GetAtt': [
                'Queue4A7E3555',
                'Arn',
              ],
            },
          },
          Input: JSON.stringify(eventInput),
          RoleArn: {
            'Fn::GetAtt': ['MyJobEventsRoleCF43C336', 'Arn'],
          },
          BatchParameters: {
            JobDefinition: { Ref: 'MyJob8719E923' },
            JobName: 'Rule',
          },
        },
      ],
    }));

    expect(stack).to(haveResource('AWS::SQS::QueuePolicy', {
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
                'Queue4A7E3555',
                'Arn',
              ],
            },
            Sid: 'AllowEventRuleRule',
          },
        ],
        Version: '2012-10-17',
      },
      Queues: [
        {
          Ref: 'Queue4A7E3555',
        },
      ],
    }));
  });

  test('specifying retry policy', () => {
    // GIVEN
    const rule = new events.Rule(stack, 'Rule', {
      schedule: events.Schedule.expression('rate(1 hour)'),
    });

    const queue = new sqs.Queue(stack, 'Queue');

    // WHEN
    const eventInput = {
      buildspecOverride: 'buildspecs/hourly.yml',
    };

    rule.addTarget(new targets.BatchJob(
      jobQueue.jobQueueArn,
      jobQueue,
      jobDefinition.jobDefinitionArn,
      jobDefinition, {
        deadLetterQueue: queue,
        event: events.RuleTargetInput.fromObject(eventInput),
        retryAttempts: 2,
        maxEventAge: Duration.hours(2),
      },
    ));

    // THEN
    expect(stack).to(haveResource('AWS::Events::Rule', {
      ScheduleExpression: 'rate(1 hour)',
      State: 'ENABLED',
      Targets: [
        {
          Arn: {
            Ref: 'MyQueueE6CA6235',
          },
          BatchParameters: {
            JobDefinition: {
              Ref: 'MyJob8719E923',
            },
            JobName: 'Rule',
          },
          DeadLetterConfig: {
            Arn: {
              'Fn::GetAtt': [
                'Queue4A7E3555',
                'Arn',
              ],
            },
          },
          Id: 'Target0',
          Input: JSON.stringify(eventInput),
          RetryPolicy: {
            MaximumEventAgeInSeconds: 7200,
            MaximumRetryAttempts: 2,
          },
          RoleArn: {
            'Fn::GetAtt': [
              'MyJobEventsRoleCF43C336',
              'Arn',
            ],
          },
        },
      ],
    }));
  });
});