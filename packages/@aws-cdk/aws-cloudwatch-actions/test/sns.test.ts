import '@aws-cdk/assert/jest';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as kms from '@aws-cdk/aws-kms';
import * as sns from '@aws-cdk/aws-sns';
import { Stack } from '@aws-cdk/core';
import * as actions from '../lib';

test('can use topic as alarm action', () => {
  // GIVEN
  const stack = new Stack();
  const topic = new sns.Topic(stack, 'Topic');
  const alarm = new cloudwatch.Alarm(stack, 'Alarm', {
    metric: new cloudwatch.Metric({ namespace: 'AWS', metricName: 'Henk' }),
    evaluationPeriods: 3,
    threshold: 100,
  });

  // WHEN
  alarm.addAlarmAction(new actions.SnsAction(topic));

  // THEN
  expect(stack).toHaveResource('AWS::CloudWatch::Alarm', {
    AlarmActions: [
      { Ref: 'TopicBFC7AF6E' },
    ],
    EvaluationPeriods: 3,
    Threshold: 100,
  });
});

test('can use encrypted topic as alarm action', () => {
  // GIVEN
  const stack = new Stack();
  const key = new kms.Key(stack, 'CustomKey');
  const topic = new sns.Topic(stack, 'Topic', {
    masterKey: key,
  });
  const alarm = new cloudwatch.Alarm(stack, 'Alarm', {
    metric: new cloudwatch.Metric({ namespace: 'AWS', metricName: 'Henk' }),
    evaluationPeriods: 3,
    threshold: 100,
  });

  // WHEN
  alarm.addAlarmAction(new actions.SnsAction(topic));

  // THEN
  expect(stack).toHaveResource('AWS::KMS::Key');
  expect(stack).toHaveResource('AWS::CloudWatch::Alarm', {
    AlarmActions: [
      { Ref: 'TopicBFC7AF6E' },
    ],
    EvaluationPeriods: 3,
    Threshold: 100,
  });
  expect(stack).toHaveResource('AWS::KMS::Key', {
    KeyPolicy: {
      Statement: [
        {
          Action: [
            'kms:Create*',
            'kms:Describe*',
            'kms:Enable*',
            'kms:List*',
            'kms:Put*',
            'kms:Update*',
            'kms:Revoke*',
            'kms:Disable*',
            'kms:Get*',
            'kms:Delete*',
            'kms:ScheduleKeyDeletion',
            'kms:CancelKeyDeletion',
            'kms:GenerateDataKey',
            'kms:TagResource',
            'kms:UntagResource',
          ],
          Effect: 'Allow',
          Principal: {
            AWS: {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  {
                    Ref: 'AWS::Partition',
                  },
                  ':iam::',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':root',
                ],
              ],
            },
          },
          Resource: '*',
        },
        {
          Action: [
            'kms:Decrypt',
            'kms:Encrypt',
            'kms:ReEncrypt*',
            'kms:GenerateDataKey*',
          ],
          Effect: 'Allow',
          Principal: {
            Service: 'cloudwatch.amazonaws.com',
          },
          Resource: '*',
        },
      ],
      Version: '2012-10-17',
    },
  });
});