import * as codebuild from '@aws-cdk/aws-codebuild';
import * as notifications from '@aws-cdk/aws-codestarnotifications';
import * as sns from '@aws-cdk/aws-sns';
import * as cdk from '@aws-cdk/core';
import * as targets from '../lib';
import { FakeCodeBuildSource } from './helpers';
import '@aws-cdk/assert/jest';

describe('SnsTopicNotificationTarget', () => {
  let stack: cdk.Stack;

  beforeEach(() => {
    stack = new cdk.Stack();
  });

  test('notification target to sns', () => {
    const project = codebuild.Project.fromProjectArn(stack, 'MyCodebuildProject', 'arn:aws:codebuild::1234567890:project/MyCodebuildProject');

    const dummySource = new FakeCodeBuildSource(project);

    const topic = new sns.Topic(stack, 'MyTopic', {});

    new notifications.NotificationRule(stack, 'MyNotificationRule', {
      notificationRuleName: 'MyNotificationRule',
      events: [
        notifications.ProjectEvent.BUILD_STATE_SUCCEEDED,
        notifications.ProjectEvent.BUILD_STATE_FAILED,
      ],
      targets: [
        new targets.SnsTopicNotificationTarget(topic),
      ],
      source: dummySource,
    });

    expect(stack).toHaveResourceLike('AWS::CodeStarNotifications::NotificationRule', {
      DetailType: 'FULL',
      EventTypeIds: [
        'codebuild-project-build-state-succeeded',
        'codebuild-project-build-state-failed',
      ],
      Name: 'MyNotificationRule',
      Resource: 'arn:aws:codebuild::1234567890:project/MyCodebuildProject',
      Targets: [
        {
          TargetAddress: {
            Ref: 'MyTopic86869434',
          },
          TargetType: 'SNS',
        },
      ],
    });
  });
});