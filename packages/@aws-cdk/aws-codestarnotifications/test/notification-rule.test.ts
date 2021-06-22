import '@aws-cdk/assert-internal/jest';
import * as cdk from '@aws-cdk/core';
import * as notifications from '../lib';
import {
  FakeCodeBuild,
  FakeCodePipeline,
  FakeSlackTarget,
  FakeSnsTopicTarget,
} from './helpers';

describe('NotificationRule', () => {
  let stack: cdk.Stack;

  beforeEach(() => {
    stack = new cdk.Stack();
  });

  test('created new notification rule with source', () => {
    const project = new FakeCodeBuild();

    new notifications.NotificationRule(stack, 'MyNotificationRule', {
      source: project,
      events: ['codebuild-project-build-state-succeeded'],
    });

    expect(stack).toHaveResourceLike('AWS::CodeStarNotifications::NotificationRule', {
      Resource: project.projectArn,
      EventTypeIds: ['codebuild-project-build-state-succeeded'],
    });
  });

  test('created new notification rule with all parameters in constructor props', () => {
    const project = new FakeCodeBuild();
    const slack = new FakeSlackTarget();

    new notifications.NotificationRule(stack, 'MyNotificationRule', {
      notificationRuleName: 'MyNotificationRule',
      detailType: notifications.DetailType.FULL,
      events: [
        'codebuild-project-build-state-succeeded',
        'codebuild-project-build-state-failed',
      ],
      source: project,
      targets: [slack],
    });

    expect(stack).toHaveResourceLike('AWS::CodeStarNotifications::NotificationRule', {
      Name: 'MyNotificationRule',
      DetailType: 'FULL',
      EventTypeIds: [
        'codebuild-project-build-state-succeeded',
        'codebuild-project-build-state-failed',
      ],
      Resource: project.projectArn,
      Targets: [
        {
          TargetAddress: slack.slackChannelConfigurationArn,
          TargetType: 'AWSChatbotSlack',
        },
      ],
    });
  });

  test('created new notification rule without name and will generate from the `id`', () => {
    const project = new FakeCodeBuild();

    new notifications.NotificationRule(stack, 'MyNotificationRuleGeneratedFromId', {
      source: project,
      events: ['codebuild-project-build-state-succeeded'],
    });

    expect(stack).toHaveResourceLike('AWS::CodeStarNotifications::NotificationRule', {
      Name: 'MyNotificationRuleGeneratedFromId',
      Resource: project.projectArn,
      EventTypeIds: ['codebuild-project-build-state-succeeded'],
    });
  });

  test('generating name will cut if id length is over than 64 charts', () => {
    const project = new FakeCodeBuild();

    new notifications.NotificationRule(stack, 'MyNotificationRuleGeneratedFromIdIsToooooooooooooooooooooooooooooLong', {
      source: project,
      events: ['codebuild-project-build-state-succeeded'],
    });

    expect(stack).toHaveResourceLike('AWS::CodeStarNotifications::NotificationRule', {
      Name: 'ificationRuleGeneratedFromIdIsToooooooooooooooooooooooooooooLong',
      Resource: project.projectArn,
      EventTypeIds: ['codebuild-project-build-state-succeeded'],
    });
  });

  test('created new notification rule without detailType', () => {
    const project = new FakeCodeBuild();

    new notifications.NotificationRule(stack, 'MyNotificationRule', {
      notificationRuleName: 'MyNotificationRule',
      source: project,
      events: ['codebuild-project-build-state-succeeded'],
    });

    expect(stack).toHaveResourceLike('AWS::CodeStarNotifications::NotificationRule', {
      Name: 'MyNotificationRule',
      Resource: project.projectArn,
      EventTypeIds: ['codebuild-project-build-state-succeeded'],
      DetailType: 'FULL',
    });
  });

  test('created new notification rule with status DISABLED', () => {
    const project = new FakeCodeBuild();

    new notifications.NotificationRule(stack, 'MyNotificationRule', {
      source: project,
      events: ['codebuild-project-build-state-succeeded'],
      enabled: false,
    });

    expect(stack).toHaveResourceLike('AWS::CodeStarNotifications::NotificationRule', {
      Name: 'MyNotificationRule',
      Resource: project.projectArn,
      EventTypeIds: ['codebuild-project-build-state-succeeded'],
      Status: 'DISABLED',
    });
  });

  test('created new notification rule with status ENABLED', () => {
    const project = new FakeCodeBuild();

    new notifications.NotificationRule(stack, 'MyNotificationRule', {
      source: project,
      events: ['codebuild-project-build-state-succeeded'],
      enabled: true,
    });

    expect(stack).toHaveResourceLike('AWS::CodeStarNotifications::NotificationRule', {
      Name: 'MyNotificationRule',
      Resource: project.projectArn,
      EventTypeIds: ['codebuild-project-build-state-succeeded'],
      Status: 'ENABLED',
    });
  });

  test('notification added targets', () => {
    const project = new FakeCodeBuild();
    const topic = new FakeSnsTopicTarget();
    const slack = new FakeSlackTarget();

    const rule = new notifications.NotificationRule(stack, 'MyNotificationRule', {
      source: project,
      events: ['codebuild-project-build-state-succeeded'],
    });

    rule.addTarget(slack);

    expect(rule.addTarget(topic)).toEqual(true);

    expect(stack).toHaveResourceLike('AWS::CodeStarNotifications::NotificationRule', {
      Resource: project.projectArn,
      EventTypeIds: ['codebuild-project-build-state-succeeded'],
      Targets: [
        {
          TargetAddress: slack.slackChannelConfigurationArn,
          TargetType: 'AWSChatbotSlack',
        },
        {
          TargetAddress: topic.topicArn,
          TargetType: 'SNS',
        },
      ],
    });
  });

  test('will not add if notification added duplicating event', () => {
    const pipeline = new FakeCodePipeline();

    new notifications.NotificationRule(stack, 'MyNotificationRule', {
      source: pipeline,
      events: [
        'codepipeline-pipeline-pipeline-execution-succeeded',
        'codepipeline-pipeline-pipeline-execution-failed',
        'codepipeline-pipeline-pipeline-execution-succeeded',
        'codepipeline-pipeline-pipeline-execution-canceled',
      ],
    });

    expect(stack).toHaveResourceLike('AWS::CodeStarNotifications::NotificationRule', {
      Resource: pipeline.pipelineArn,
      EventTypeIds: [
        'codepipeline-pipeline-pipeline-execution-succeeded',
        'codepipeline-pipeline-pipeline-execution-failed',
        'codepipeline-pipeline-pipeline-execution-canceled',
      ],
    });
  });
});

describe('NotificationRule from imported', () => {
  let stack: cdk.Stack;

  beforeEach(() => {
    stack = new cdk.Stack();
  });

  test('from notification rule ARN', () => {
    const imported = notifications.NotificationRule.fromNotificationRuleArn(stack, 'MyNotificationRule',
      'arn:aws:codestar-notifications::1234567890:notificationrule/1234567890abcdef');
    expect(imported.notificationRuleArn).toEqual('arn:aws:codestar-notifications::1234567890:notificationrule/1234567890abcdef');
  });

  test('will not effect and return false when added targets if notification from imported', () => {
    const imported = notifications.NotificationRule.fromNotificationRuleArn(stack, 'MyNotificationRule',
      'arn:aws:codestar-notifications::1234567890:notificationrule/1234567890abcdef');
    const slack = new FakeSlackTarget();
    expect(imported.addTarget(slack)).toEqual(false);
  });
});