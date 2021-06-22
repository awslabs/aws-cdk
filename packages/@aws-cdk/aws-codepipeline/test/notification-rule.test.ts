import '@aws-cdk/assert-internal/jest';
import * as cdk from '@aws-cdk/core';
import * as codepipeline from '../lib';
import { FakeBuildAction } from './fake-build-action';
import { FakeSourceAction } from './fake-source-action';

describe('pipeline with codestar notification integration', () => {
  let stack: cdk.Stack;
  let pipeline: codepipeline.Pipeline;
  let sourceArtifact: codepipeline.Artifact;
  beforeEach(() => {
    stack = new cdk.Stack();
    sourceArtifact = new codepipeline.Artifact();
    pipeline = new codepipeline.Pipeline(stack, 'Pipeline', {
      stages: [
        {
          stageName: 'Source',
          actions: [new FakeSourceAction({ actionName: 'Fetch', output: sourceArtifact })],
        },
        {
          stageName: 'Build',
          actions: [new FakeBuildAction({ actionName: 'Gcc', input: sourceArtifact })],
        },
      ],
    });
  });

  test('On "Pipeline" execution events emitted notification rule', () => {
    const target = {
      bindAsNotificationRuleTarget: () => ({
        targetType: 'AWSChatbotSlack',
        targetAddress: 'SlackID',
      }),
    };

    pipeline.notifyOnExecutionStateChange('NotifyOnExecutionStateChange', target);

    expect(stack).toHaveResourceLike('AWS::CodeStarNotifications::NotificationRule', {
      Name: 'PipelineNotifyOnExecutionStateChange9FE60973',
      DetailType: 'FULL',
      EventTypeIds: [
        'codepipeline-pipeline-pipeline-execution-failed',
        'codepipeline-pipeline-pipeline-execution-canceled',
        'codepipeline-pipeline-pipeline-execution-started',
        'codepipeline-pipeline-pipeline-execution-resumed',
        'codepipeline-pipeline-pipeline-execution-succeeded',
        'codepipeline-pipeline-pipeline-execution-superseded',
      ],
      Resource: {
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
      },
      Targets: [
        {
          TargetAddress: 'SlackID',
          TargetType: 'AWSChatbotSlack',
        },
      ],
    });
  });

  test('On any "Stage" execution events emitted notification rule in pipeline', () => {
    const target = {
      bindAsNotificationRuleTarget: () => ({
        targetType: 'AWSChatbotSlack',
        targetAddress: 'SlackID',
      }),
    };

    pipeline.notifyOnAnyStageStateChange('NotifyOnAnyStageStateChange', target);

    expect(stack).toHaveResourceLike('AWS::CodeStarNotifications::NotificationRule', {
      Name: 'PipelineNotifyOnAnyStageStateChange05355CCD',
      DetailType: 'FULL',
      EventTypeIds: [
        'codepipeline-pipeline-stage-execution-canceled',
        'codepipeline-pipeline-stage-execution-failed',
        'codepipeline-pipeline-stage-execution-resumed',
        'codepipeline-pipeline-stage-execution-started',
        'codepipeline-pipeline-stage-execution-succeeded',
      ],
      Resource: {
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
      },
      Targets: [
        {
          TargetAddress: 'SlackID',
          TargetType: 'AWSChatbotSlack',
        },
      ],
    });
  });

  test('On any "Action" execution events emitted notification rule in pipeline', () => {
    const target = {
      bindAsNotificationRuleTarget: () => ({
        targetType: 'AWSChatbotSlack',
        targetAddress: 'SlackID',
      }),
    };

    pipeline.notifyOnAnyActionStateChange('NotifyOnAnyActionStateChange', target);

    expect(stack).toHaveResourceLike('AWS::CodeStarNotifications::NotificationRule', {
      Name: 'PipelineNotifyOnAnyActionStateChange64D5B2AA',
      DetailType: 'FULL',
      EventTypeIds: [
        'codepipeline-pipeline-action-execution-canceled',
        'codepipeline-pipeline-action-execution-failed',
        'codepipeline-pipeline-action-execution-started',
        'codepipeline-pipeline-action-execution-succeeded',
      ],
      Resource: {
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
      },
      Targets: [
        {
          TargetAddress: 'SlackID',
          TargetType: 'AWSChatbotSlack',
        },
      ],
    });
  });

  test('On any "Manual approval" execution events emitted notification rule in pipeline', () => {
    const target = {
      bindAsNotificationRuleTarget: () => ({
        targetType: 'AWSChatbotSlack',
        targetAddress: 'SlackID',
      }),
    };

    pipeline.notifyOnAnyManualApprovalStateChange('NotifyOnAnyManualApprovalStateChange', target);

    expect(stack).toHaveResourceLike('AWS::CodeStarNotifications::NotificationRule', {
      Name: 'PipelineNotifyOnAnyManualApprovalStateChangeE60778F7',
      DetailType: 'FULL',
      EventTypeIds: [
        'codepipeline-pipeline-manual-approval-failed',
        'codepipeline-pipeline-manual-approval-needed',
        'codepipeline-pipeline-manual-approval-succeeded',
      ],
      Resource: {
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
      },
      Targets: [
        {
          TargetAddress: 'SlackID',
          TargetType: 'AWSChatbotSlack',
        },
      ],
    });
  });
});
