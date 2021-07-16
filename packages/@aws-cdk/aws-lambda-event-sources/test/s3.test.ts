import { TemplateAssertions } from '@aws-cdk/assertions';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import * as sources from '../lib';
import { TestFunction } from './test-function';

/* eslint-disable quote-props */

describe('S3EventSource', () => {
  test('sufficiently complex example', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const bucket = new s3.Bucket(stack, 'B');

    // WHEN
    fn.addEventSource(new sources.S3EventSource(bucket, {
      events: [s3.EventType.OBJECT_CREATED, s3.EventType.OBJECT_REMOVED],
      filters: [
        { prefix: 'prefix/' },
        { suffix: '.png' },
      ],
    }));

    // THEN
    TemplateAssertions.fromStack(stack).hasResourceProperties('Custom::S3BucketNotifications', {
      'NotificationConfiguration': {
        'LambdaFunctionConfigurations': [
          {
            'Events': [
              's3:ObjectCreated:*',
            ],
            'Filter': {
              'Key': {
                'FilterRules': [
                  {
                    'Name': 'prefix',
                    'Value': 'prefix/',
                  },
                  {
                    'Name': 'suffix',
                    'Value': '.png',
                  },
                ],
              },
            },
            'LambdaFunctionArn': {
              'Fn::GetAtt': [
                'Fn9270CBC0',
                'Arn',
              ],
            },
          },
          {
            'Events': [
              's3:ObjectRemoved:*',
            ],
            'Filter': {
              'Key': {
                'FilterRules': [
                  {
                    'Name': 'prefix',
                    'Value': 'prefix/',
                  },
                  {
                    'Name': 'suffix',
                    'Value': '.png',
                  },
                ],
              },
            },
            'LambdaFunctionArn': {
              'Fn::GetAtt': [
                'Fn9270CBC0',
                'Arn',
              ],
            },
          },
        ],
      },
    });
  });
});
