import { expect, haveResource } from '@aws-cdk/assert';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import * as sqs from '@aws-cdk/aws-sqs';
import { CfnElement, Duration, Stack } from '@aws-cdk/core';
import * as targets from '../../lib';

describe('CodeBuild event target', () => {
  let stack: Stack;
  let project: codebuild.PipelineProject;
  let projectArn: any;

  beforeEach(() => {
    stack = new Stack();
    project = new codebuild.PipelineProject(stack, 'MyProject');
    projectArn = { 'Fn::GetAtt': ['MyProject39F7B0AE', 'Arn'] };
  });

  test('use codebuild project as an eventrule target', () => {
    // GIVEN
    const rule = new events.Rule(stack, 'Rule', {
      schedule: events.Schedule.expression('rate(1 min)'),
    });

    // WHEN
    rule.addTarget(new targets.CodeBuildProject(project));

    // THEN
    expect(stack).to(haveResource('AWS::Events::Rule', {
      Targets: [
        {
          Arn: projectArn,
          Id: 'Target0',
          RoleArn: { 'Fn::GetAtt': ['MyProjectEventsRole5B7D93F5', 'Arn'] },
        },
      ],
    }));

    expect(stack).to(haveResource('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: { Service: 'events.amazonaws.com' },
          },
        ],
        Version: '2012-10-17',
      },
    }));

    expect(stack).to(haveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'codebuild:StartBuild',
            Effect: 'Allow',
            Resource: projectArn,
          },
        ],
        Version: '2012-10-17',
      },
    }));
  });

  test('specifying event for codebuild project target', () => {
    // GIVEN
    const rule = new events.Rule(stack, 'Rule', {
      schedule: events.Schedule.expression('rate(1 hour)'),
    });

    // WHEN
    const eventInput = {
      buildspecOverride: 'buildspecs/hourly.yml',
    };

    rule.addTarget(
      new targets.CodeBuildProject(project, {
        event: events.RuleTargetInput.fromObject(eventInput),
      }),
    );

    // THEN
    expect(stack).to(haveResource('AWS::Events::Rule', {
      Targets: [
        {
          Arn: projectArn,
          Id: 'Target0',
          Input: JSON.stringify(eventInput),
          RoleArn: {
            'Fn::GetAtt': ['MyProjectEventsRole5B7D93F5', 'Arn'],
          },
        },
      ],
    }));
  });

  test('specifying custom role for codebuild project target', () => {
    // GIVEN
    const rule = new events.Rule(stack, 'Rule', {
      schedule: events.Schedule.expression('rate(1 hour)'),
    });
    const role = new iam.Role(stack, 'MyExampleRole', {
      assumedBy: new iam.AnyPrincipal(),
    });
    const roleResource = role.node.defaultChild as CfnElement;
    roleResource.overrideLogicalId('MyRole'); // to make it deterministic in the assertion below

    // WHEN
    rule.addTarget(new targets.CodeBuildProject(project, { eventRole: role }));

    // THEN
    expect(stack).to(haveResource('AWS::Events::Rule', {
      Targets: [
        {
          Arn: projectArn,
          Id: 'Target0',
          RoleArn: { 'Fn::GetAtt': ['MyRole', 'Arn'] },
        },
      ],
    }));
  });

  test('specifying retry policy', () => {
    // GIVEN
    const rule = new events.Rule(stack, 'Rule', {
      schedule: events.Schedule.expression('rate(1 hour)'),
    });

    // WHEN
    const eventInput = {
      buildspecOverride: 'buildspecs/hourly.yml',
    };

    rule.addTarget(
      new targets.CodeBuildProject(project, {
        event: events.RuleTargetInput.fromObject(eventInput),
        retryAttempts: 2,
        maxEventAge: Duration.hours(2),
      }),
    );

    // THEN
    expect(stack).to(haveResource('AWS::Events::Rule', {
      ScheduleExpression: 'rate(1 hour)',
      State: 'ENABLED',
      Targets: [
        {
          Arn: {
            'Fn::GetAtt': [
              'MyProject39F7B0AE',
              'Arn',
            ],
          },
          Id: 'Target0',
          Input: '{"buildspecOverride":"buildspecs/hourly.yml"}',
          RetryPolicy: {
            MaximumEventAgeInSeconds: 7200,
            MaximumRetryAttempts: 2,
          },
          RoleArn: {
            'Fn::GetAtt': [
              'MyProjectEventsRole5B7D93F5',
              'Arn',
            ],
          },
        },
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

    rule.addTarget(
      new targets.CodeBuildProject(project, {
        event: events.RuleTargetInput.fromObject(eventInput),
        deadLetterQueue: queue,
      }),
    );

    // THEN
    expect(stack).to(haveResource('AWS::Events::Rule', {
      Targets: [
        {
          Arn: projectArn,
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
            'Fn::GetAtt': ['MyProjectEventsRole5B7D93F5', 'Arn'],
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
});
