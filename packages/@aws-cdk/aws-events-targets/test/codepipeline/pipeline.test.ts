import { expect, haveResource, haveResourceLike } from '@aws-cdk/assert';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import * as sqs from '@aws-cdk/aws-sqs';
import { CfnElement, Duration, Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import * as targets from '../../lib';

describe('CodePipeline event target', () => {
  let stack: Stack;
  let pipeline: codepipeline.Pipeline;
  let pipelineArn: any;

  beforeEach(() => {
    stack = new Stack();
    pipeline = new codepipeline.Pipeline(stack, 'Pipeline');
    const srcArtifact = new codepipeline.Artifact('Src');
    const buildArtifact = new codepipeline.Artifact('Bld');
    pipeline.addStage({
      stageName: 'Source',
      actions: [new TestAction({
        actionName: 'Hello',
        category: codepipeline.ActionCategory.SOURCE,
        provider: 'x',
        artifactBounds: { minInputs: 0, maxInputs: 0, minOutputs: 1, maxOutputs: 1 },
        outputs: [srcArtifact],
      })],
    });
    pipeline.addStage({
      stageName: 'Build',
      actions: [new TestAction({
        actionName: 'Hello',
        category: codepipeline.ActionCategory.BUILD,
        provider: 'y',
        inputs: [srcArtifact],
        outputs: [buildArtifact],
        artifactBounds: { minInputs: 1, maxInputs: 1, minOutputs: 1, maxOutputs: 1 },
      })],
    });
    pipelineArn = {
      'Fn::Join': ['', [
        'arn:',
        { Ref: 'AWS::Partition' },
        ':codepipeline:',
        { Ref: 'AWS::Region' },
        ':',
        { Ref: 'AWS::AccountId' },
        ':',
        { Ref: 'PipelineC660917D' },
      ]],
    };
  });

  describe('when added to an event rule as a target', () => {
    let rule: events.Rule;

    beforeEach(() => {
      rule = new events.Rule(stack, 'rule', {
        schedule: events.Schedule.expression('rate(1 minute)'),
      });
    });

    describe('with default settings', () => {
      beforeEach(() => {
        rule.addTarget(new targets.CodePipeline(pipeline));
      });

      test("adds the pipeline's ARN and role to the targets of the rule", () => {
        expect(stack).to(haveResource('AWS::Events::Rule', {
          Targets: [
            {
              Arn: pipelineArn,
              Id: 'Target0',
              RoleArn: { 'Fn::GetAtt': ['PipelineEventsRole46BEEA7C', 'Arn'] },
            },
          ],
        }));
      });

      test("creates a policy that has StartPipeline permissions on the pipeline's ARN", () => {
        expect(stack).to(haveResource('AWS::IAM::Policy', {
          PolicyDocument: {
            Statement: [
              {
                Action: 'codepipeline:StartPipelineExecution',
                Effect: 'Allow',
                Resource: pipelineArn,
              },
            ],
            Version: '2012-10-17',
          },
        }));
      });
    });

    describe('with retry policy and dead letter queue', () => {
      test('adds retry attempts and maxEventAge to the target configuration', () => {
        // WHEN
        let queue = new sqs.Queue(stack, 'dlq');

        rule.addTarget(new targets.CodePipeline(pipeline, {
          retryAttempts: 2,
          maxEventAge: Duration.hours(2),
          deadLetterQueue: queue,
        }));

        // THEN
        expect(stack).to(haveResource('AWS::Events::Rule', {
          ScheduleExpression: 'rate(1 minute)',
          State: 'ENABLED',
          Targets: [
            {
              Arn: {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    {
                      Ref: 'AWS::Partition',
                    },
                    ':codepipeline:',
                    {
                      Ref: 'AWS::Region',
                    },
                    ':',
                    {
                      Ref: 'AWS::AccountId',
                    },
                    ':',
                    {
                      Ref: 'PipelineC660917D',
                    },
                  ],
                ],
              },
              DeadLetterConfig: {
                Arn: {
                  'Fn::GetAtt': [
                    'dlq09C78ACC',
                    'Arn',
                  ],
                },
              },
              Id: 'Target0',
              RetryPolicy: {
                MaximumEventAgeInSeconds: 7200,
                MaximumRetryAttempts: 2,
              },
              RoleArn: {
                'Fn::GetAtt': [
                  'PipelineEventsRole46BEEA7C',
                  'Arn',
                ],
              },
            },
          ],
        }));
      });
    });

    describe('with an explicit event role', () => {
      beforeEach(() => {
        const role = new iam.Role(stack, 'MyExampleRole', {
          assumedBy: new iam.AnyPrincipal(),
        });
        const roleResource = role.node.defaultChild as CfnElement;
        roleResource.overrideLogicalId('MyRole'); // to make it deterministic in the assertion below

        rule.addTarget(new targets.CodePipeline(pipeline, {
          eventRole: role,
        }));
      });

      test("points at the given event role in the rule's targets", () => {
        expect(stack).to(haveResourceLike('AWS::Events::Rule', {
          Targets: [
            {
              Arn: pipelineArn,
              RoleArn: { 'Fn::GetAtt': ['MyRole', 'Arn'] },
            },
          ],
        }));
      });
    });
  });
});

class TestAction implements codepipeline.IAction {
  constructor(public readonly actionProperties: codepipeline.ActionProperties) {
    // nothing to do
  }

  public bind(_scope: Construct, _stage: codepipeline.IStage, _options: codepipeline.ActionBindOptions):
  codepipeline.ActionConfig {
    return {};
  }

  public onStateChange(_name: string, _target?: events.IRuleTarget, _options?: events.RuleProps): events.Rule {
    throw new Error('onStateChange() is not available on MockAction');
  }
}
