import { expect, haveResourceLike } from '@aws-cdk/assert-internal';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as iam from '@aws-cdk/aws-iam';
import * as sns from '@aws-cdk/aws-sns';
import { SecretValue, Stack } from '@aws-cdk/core';
import { nodeunitShim, Test } from 'nodeunit-shim';
import * as cpactions from '../lib';

/* eslint-disable quote-props */

nodeunitShim({
  'manual approval Action': {
    'allows passing an SNS Topic when constructing it'(test: Test) {
      const stack = new Stack();
      const topic = new sns.Topic(stack, 'Topic');
      const manualApprovalAction = new cpactions.ManualApprovalAction({
        actionName: 'Approve',
        notificationTopic: topic,
      });
      const pipeline = new codepipeline.Pipeline(stack, 'pipeline');
      const stage = pipeline.addStage({ stageName: 'stage' });
      stage.addAction(manualApprovalAction);

      test.equal(manualApprovalAction.notificationTopic, topic);

      test.done();
    },

    'allows granting manual approval permissions to role'(test: Test) {
      const stack = new Stack();
      const role = new iam.Role(stack, 'Human', { assumedBy: new iam.AnyPrincipal() });
      const pipeline = new codepipeline.Pipeline(stack, 'pipeline');
      pipeline.addStage({
        stageName: 'Source',
        actions: [new cpactions.GitHubSourceAction({
          actionName: 'Source',
          output: new codepipeline.Artifact(),
          oauthToken: SecretValue.plainText('secret'),
          owner: 'aws',
          repo: 'aws-cdk',
        })],
      });
      const stage = pipeline.addStage({ stageName: 'stage' });

      const manualApprovalAction = new cpactions.ManualApprovalAction({
        actionName: 'Approve',
      });
      stage.addAction(manualApprovalAction);

      manualApprovalAction.grantManualApproval(role);

      expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
        'PolicyDocument': {
          'Statement': [
            {
              'Action': 'codepipeline:ListPipelines',
              'Effect': 'Allow',
              'Resource': '*',
            },
            {
              'Action': [
                'codepipeline:GetPipeline',
                'codepipeline:GetPipelineState',
                'codepipeline:GetPipelineExecution',
              ],
              'Effect': 'Allow',
              'Resource': {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    { 'Ref': 'AWS::Partition' },
                    ':codepipeline:',
                    { 'Ref': 'AWS::Region' },
                    ':',
                    { 'Ref': 'AWS::AccountId' },
                    ':',
                    { 'Ref': 'pipelineDBECAE49' },
                  ],
                ],
              },
            },
            {
              'Action': 'codepipeline:PutApprovalResult',
              'Effect': 'Allow',
              'Resource': {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    { 'Ref': 'AWS::Partition' },
                    ':codepipeline:',
                    { 'Ref': 'AWS::Region' },
                    ':',
                    { 'Ref': 'AWS::AccountId' },
                    ':',
                    { 'Ref': 'pipelineDBECAE49' },
                    '/stage/Approve',
                  ],
                ],
              },
            },
          ],
          'Version': '2012-10-17',
        },
        'PolicyName': 'HumanDefaultPolicy49346D53',
        'Roles': [
          {
            'Ref': 'HumanD337C84C',
          },
        ],
      }));

      test.done();
    },

    'rejects granting manual approval permissions before binding action to stage'(test: Test) {
      const stack = new Stack();
      const role = new iam.Role(stack, 'Human', { assumedBy: new iam.AnyPrincipal() });
      const manualApprovalAction = new cpactions.ManualApprovalAction({
        actionName: 'Approve',
      });

      test.throws(() => {
        manualApprovalAction.grantManualApproval(role);
      }, 'Cannot grant permissions before binding action to a stage');

      test.done();
    },

    'renders CustomData and ExternalEntityLink even if notificationTopic was not passed'(test: Test) {
      const stack = new Stack();
      new codepipeline.Pipeline(stack, 'pipeline', {
        stages: [
          {
            stageName: 'Source',
            actions: [new cpactions.GitHubSourceAction({
              actionName: 'Source',
              output: new codepipeline.Artifact(),
              oauthToken: SecretValue.plainText('secret'),
              owner: 'aws',
              repo: 'aws-cdk',
            })],
          },
          {
            stageName: 'Approve',
            actions: [
              new cpactions.ManualApprovalAction({
                actionName: 'Approval',
                additionalInformation: 'extra info',
                externalEntityLink: 'external link',
              }),
            ],
          },
        ],
      });

      expect(stack).to(haveResourceLike('AWS::CodePipeline::Pipeline', {
        'Stages': [
          {
            'Name': 'Source',
          },
          {
            'Name': 'Approve',
            'Actions': [
              {
                'Name': 'Approval',
                'Configuration': {
                  'CustomData': 'extra info',
                  'ExternalEntityLink': 'external link',
                },
              },
            ],
          },
        ],
      }));

      test.done();
    },
  },
});
