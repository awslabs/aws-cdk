import { expect, haveResource } from '@aws-cdk/assert-internal';
import * as sns from '@aws-cdk/aws-sns';
import * as cdk from '@aws-cdk/core';
import { Test } from 'nodeunit';
import * as codebuild from '../lib';

export = {
  'notifications rule'(test: Test) {
    const stack = new cdk.Stack();
    const project = new codebuild.Project(stack, 'MyCodebuildProject', {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          build: {
            commands: [
              'echo "Hello, CodeBuild!"',
            ],
          },
        },
      }),
    });

    const target = new sns.Topic(stack, 'MyTopic');

    project.notifyOnBuildSucceeded('NotifyOnBuildSucceeded', target);

    project.notifyOnBuildFailed('NotifyOnBuildFailed', target);

    expect(stack).to(haveResource('AWS::CodeStarNotifications::NotificationRule', {
      Name: 'MyCodebuildProjectNotifyOnBuildSucceeded77719592',
      DetailType: 'FULL',
      EventTypeIds: [
        'codebuild-project-build-state-succeeded',
      ],
      Resource: {
        'Fn::GetAtt': [
          'MyCodebuildProjectB0479580',
          'Arn',
        ],
      },
      Targets: [
        {
          TargetAddress: {
            Ref: 'MyTopic86869434',
          },
          TargetType: 'SNS',
        },
      ],
    }));

    expect(stack).to(haveResource('AWS::CodeStarNotifications::NotificationRule', {
      Name: 'MyCodebuildProjectNotifyOnBuildFailedF680E310',
      DetailType: 'FULL',
      EventTypeIds: [
        'codebuild-project-build-state-failed',
      ],
      Resource: {
        'Fn::GetAtt': [
          'MyCodebuildProjectB0479580',
          'Arn',
        ],
      },
      Targets: [
        {
          TargetAddress: {
            Ref: 'MyTopic86869434',
          },
          TargetType: 'SNS',
        },
      ],
    }));

    test.done();
  },
};
