import { SynthUtils } from '@aws-cdk/assert-internal';
import '@aws-cdk/assert-internal/jest';
import * as s3 from '@aws-cdk/aws-s3';
import * as sns from '@aws-cdk/aws-sns';
import * as cdk from '@aws-cdk/core';
import * as s3n from '../lib';

/* eslint-disable max-len */
/* eslint-disable quote-props */

test('bucket without notifications', () => {
  const stack = new cdk.Stack();

  new s3.Bucket(stack, 'MyBucket');

  expect(stack).toMatchTemplate({
    'Resources': {
      'MyBucketF68F3FF0': {
        'Type': 'AWS::S3::Bucket',
        'DeletionPolicy': 'Retain',
        'UpdateReplacePolicy': 'Retain',
      },
    },
  });
});

test('notifications can be added to imported buckets', () => {
  const stack = new cdk.Stack();

  const bucket = s3.Bucket.fromBucketName(stack, 'MyBucket', 'mybucket');
  const topic = new sns.Topic(stack, 'MyTopic');

  bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.SnsDestination(topic));

  expect(stack).toHaveResource('Custom::S3BucketNotifications', {
    ServiceToken: { 'Fn::GetAtt': ['BucketNotificationsHandler050a0587b7544547bf325f094a3db8347ECC3691', 'Arn'] },
    BucketName: 'mybucket',
    Managed: false,
    NotificationConfiguration: {
      'TopicConfigurations': [
        {
          'Events': [
            's3:ObjectCreated:*',
          ],
          'TopicArn': {
            'Ref': 'MyTopic86869434',
          },
        },
      ],
    },
  });
});

test('when notification are added, a custom resource is provisioned + a lambda handler for it', () => {
  const stack = new cdk.Stack();

  const bucket = new s3.Bucket(stack, 'MyBucket');
  const topic = new sns.Topic(stack, 'MyTopic');

  bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.SnsDestination(topic));

  expect(stack).toHaveResource('AWS::S3::Bucket');
  expect(stack).toHaveResource('AWS::Lambda::Function', { Description: 'AWS CloudFormation handler for "Custom::S3BucketNotifications" resources (@aws-cdk/aws-s3)' });
  expect(stack).toHaveResource('Custom::S3BucketNotifications');
});

test('when notification are added, you can tag the lambda', () => {
  const stack = new cdk.Stack();
  cdk.Tags.of(stack).add('Lambda', 'AreTagged');

  const bucket = new s3.Bucket(stack, 'MyBucket');

  const topic = new sns.Topic(stack, 'MyTopic');

  bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.SnsDestination(topic));

  expect(stack).toHaveResource('AWS::S3::Bucket');
  expect(stack).toHaveResource('AWS::Lambda::Function', {
    Tags: [{ Key: 'Lambda', Value: 'AreTagged' }],
    Description: 'AWS CloudFormation handler for "Custom::S3BucketNotifications" resources (@aws-cdk/aws-s3)',
  });
  expect(stack).toHaveResource('Custom::S3BucketNotifications');
});

test('bucketNotificationTarget is not called during synthesis', () => {
  const stack = new cdk.Stack();

  // notice the order here - topic is defined before bucket
  // but this shouldn't impact the fact that the topic policy includes
  // the bucket information
  const topic = new sns.Topic(stack, 'Topic');
  const bucket = new s3.Bucket(stack, 'MyBucket');

  bucket.addObjectCreatedNotification(new s3n.SnsDestination(topic));

  expect(stack).toHaveResourceLike('AWS::SNS::TopicPolicy', {
    'Topics': [
      {
        'Ref': 'TopicBFC7AF6E',
      },
    ],
    'PolicyDocument': {
      'Statement': [
        {
          'Action': 'sns:Publish',
          'Condition': {
            'ArnLike': {
              'aws:SourceArn': {
                'Fn::GetAtt': [
                  'MyBucketF68F3FF0',
                  'Arn',
                ],
              },
            },
          },
          'Effect': 'Allow',
          'Principal': {
            'Service': 's3.amazonaws.com',
          },
          'Resource': {
            'Ref': 'TopicBFC7AF6E',
          },
        },
      ],
      'Version': '2012-10-17',
    },
  });
});

test('subscription types', () => {
  const stack = new cdk.Stack();

  const bucket = new s3.Bucket(stack, 'TestBucket');

  const queueTarget: s3.IBucketNotificationDestination = {
    bind: _ => ({
      type: s3.BucketNotificationDestinationType.QUEUE,
      arn: 'arn:aws:sqs:...',
    }),
  };

  const lambdaTarget: s3.IBucketNotificationDestination = {
    bind: _ => ({
      type: s3.BucketNotificationDestinationType.LAMBDA,
      arn: 'arn:aws:lambda:...',
    }),
  };

  const topicTarget: s3.IBucketNotificationDestination = {
    bind: _ => ({
      type: s3.BucketNotificationDestinationType.TOPIC,
      arn: 'arn:aws:sns:...',
    }),
  };

  bucket.addEventNotification(s3.EventType.OBJECT_CREATED, queueTarget);
  bucket.addEventNotification(s3.EventType.OBJECT_CREATED, lambdaTarget);
  bucket.addObjectRemovedNotification(topicTarget, { prefix: 'prefix' });

  expect(stack).toHaveResource('Custom::S3BucketNotifications', {
    'ServiceToken': {
      'Fn::GetAtt': [
        'BucketNotificationsHandler050a0587b7544547bf325f094a3db8347ECC3691',
        'Arn',
      ],
    },
    'BucketName': {
      'Ref': 'TestBucket560B80BC',
    },
    'NotificationConfiguration': {
      'LambdaFunctionConfigurations': [
        {
          'Events': [
            's3:ObjectCreated:*',
          ],
          'LambdaFunctionArn': 'arn:aws:lambda:...',
        },
      ],
      'QueueConfigurations': [
        {
          'Events': [
            's3:ObjectCreated:*',
          ],
          'QueueArn': 'arn:aws:sqs:...',
        },
      ],
      'TopicConfigurations': [
        {
          'Events': [
            's3:ObjectRemoved:*',
          ],
          'TopicArn': 'arn:aws:sns:...',
          'Filter': {
            'Key': {
              'FilterRules': [
                {
                  'Name': 'prefix',
                  'Value': 'prefix',
                },
              ],
            },
          },
        },
      ],
    },
  });
});

test('multiple subscriptions of the same type', () => {
  const stack = new cdk.Stack();

  const bucket = new s3.Bucket(stack, 'TestBucket');

  bucket.addEventNotification(s3.EventType.OBJECT_REMOVED_DELETE, {
    bind: _ => ({
      type: s3.BucketNotificationDestinationType.QUEUE,
      arn: 'arn:aws:sqs:...:queue1',
    }),
  });

  bucket.addEventNotification(s3.EventType.OBJECT_REMOVED_DELETE, {
    bind: _ => ({
      type: s3.BucketNotificationDestinationType.QUEUE,
      arn: 'arn:aws:sqs:...:queue2',
    }),
  });

  expect(stack).toHaveResource('Custom::S3BucketNotifications', {
    'ServiceToken': {
      'Fn::GetAtt': [
        'BucketNotificationsHandler050a0587b7544547bf325f094a3db8347ECC3691',
        'Arn',
      ],
    },
    'BucketName': {
      'Ref': 'TestBucket560B80BC',
    },
    'NotificationConfiguration': {
      'QueueConfigurations': [
        {
          'Events': [
            's3:ObjectRemoved:Delete',
          ],
          'QueueArn': 'arn:aws:sqs:...:queue1',
        },
        {
          'Events': [
            's3:ObjectRemoved:Delete',
          ],
          'QueueArn': 'arn:aws:sqs:...:queue2',
        },
      ],
    },
  });
});

test('prefix/suffix filters', () => {
  const stack = new cdk.Stack();

  const bucket = new s3.Bucket(stack, 'TestBucket');

  const bucketNotificationTarget = {
    type: s3.BucketNotificationDestinationType.QUEUE,
    arn: 'arn:aws:sqs:...',
  };

  bucket.addEventNotification(s3.EventType.OBJECT_REMOVED_DELETE, { bind: _ => bucketNotificationTarget }, { prefix: 'images/', suffix: '.jpg' });

  expect(stack).toHaveResource('Custom::S3BucketNotifications', {
    'ServiceToken': {
      'Fn::GetAtt': [
        'BucketNotificationsHandler050a0587b7544547bf325f094a3db8347ECC3691',
        'Arn',
      ],
    },
    'BucketName': {
      'Ref': 'TestBucket560B80BC',
    },
    'NotificationConfiguration': {
      'QueueConfigurations': [
        {
          'Events': [
            's3:ObjectRemoved:Delete',
          ],
          'Filter': {
            'Key': {
              'FilterRules': [
                {
                  'Name': 'suffix',
                  'Value': '.jpg',
                },
                {
                  'Name': 'prefix',
                  'Value': 'images/',
                },
              ],
            },
          },
          'QueueArn': 'arn:aws:sqs:...',
        },
      ],
    },
  });
});

test('a notification destination can specify a set of dependencies that must be resolved before the notifications resource is created', () => {
  const stack = new cdk.Stack();

  const bucket = new s3.Bucket(stack, 'Bucket');
  const dependent = new cdk.CfnResource(stack, 'Dependent', { type: 'DependOnMe' });
  const dest: s3.IBucketNotificationDestination = {
    bind: () => ({
      arn: 'arn',
      type: s3.BucketNotificationDestinationType.QUEUE,
      dependencies: [dependent],
    }),
  };

  bucket.addObjectCreatedNotification(dest);

  expect(SynthUtils.synthesize(stack).template.Resources.BucketNotifications8F2E257D).toEqual({
    Type: 'Custom::S3BucketNotifications',
    Properties: {
      ServiceToken: { 'Fn::GetAtt': ['BucketNotificationsHandler050a0587b7544547bf325f094a3db8347ECC3691', 'Arn'] },
      BucketName: { Ref: 'Bucket83908E77' },
      Managed: true,
      NotificationConfiguration: { QueueConfigurations: [{ Events: ['s3:ObjectCreated:*'], QueueArn: 'arn' }] },
    },
    DependsOn: ['Dependent'],
  });
});

describe('CloudWatch Events', () => {
  test('onCloudTrailPutObject contains the Bucket ARN itself when path is undefined', () => {
    const stack = new cdk.Stack();
    const bucket = s3.Bucket.fromBucketAttributes(stack, 'Bucket', {
      bucketName: 'MyBucket',
    });
    bucket.onCloudTrailPutObject('PutRule', {
      target: {
        bind: () => ({ arn: 'ARN', id: '' }),
      },
    });

    expect(stack).toHaveResourceLike('AWS::Events::Rule', {
      'EventPattern': {
        'source': [
          'aws.s3',
        ],
        'detail': {
          'eventName': [
            'PutObject',
          ],
          'resources': {
            'ARN': [
              {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    {
                      'Ref': 'AWS::Partition',
                    },
                    ':s3:::MyBucket',
                  ],
                ],
              },
            ],
          },
        },
      },
      'State': 'ENABLED',
    });
  });

  test("onCloudTrailPutObject contains the path when it's provided", () => {
    const stack = new cdk.Stack();
    const bucket = s3.Bucket.fromBucketAttributes(stack, 'Bucket', {
      bucketName: 'MyBucket',
    });
    bucket.onCloudTrailPutObject('PutRule', {
      target: {
        bind: () => ({ arn: 'ARN', id: '' }),
      },
      paths: ['my/path.zip'],
    });

    expect(stack).toHaveResourceLike('AWS::Events::Rule', {
      'EventPattern': {
        'source': [
          'aws.s3',
        ],
        'detail': {
          'eventName': [
            'PutObject',
          ],
          'resources': {
            'ARN': [
              {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    {
                      'Ref': 'AWS::Partition',
                    },
                    ':s3:::MyBucket/my/path.zip',
                  ],
                ],
              },
            ],
          },
        },
      },
      'State': 'ENABLED',
    });
  });

  test('onCloudTrailWriteObject matches on events CompleteMultipartUpload, CopyObject, and PutObject', () => {
    const stack = new cdk.Stack();
    const bucket = s3.Bucket.fromBucketAttributes(stack, 'Bucket', {
      bucketName: 'MyBucket',
    });
    bucket.onCloudTrailWriteObject('OnCloudTrailWriteObjectRule', {
      target: {
        bind: () => ({ arn: 'ARN', id: '' }),
      },
    });

    expect(stack).toHaveResourceLike('AWS::Events::Rule', {
      'EventPattern': {
        'source': [
          'aws.s3',
        ],
        'detail': {
          'eventName': [
            'CompleteMultipartUpload',
            'CopyObject',
            'PutObject',
          ],
        },
      },
      'State': 'ENABLED',
    });
  });

  test('onCloudTrailWriteObject matches on the requestParameter bucketName when the path is not provided', () => {
    const stack = new cdk.Stack();
    const bucket = s3.Bucket.fromBucketAttributes(stack, 'Bucket', {
      bucketName: 'MyBucket',
    });
    bucket.onCloudTrailWriteObject('OnCloudTrailWriteObjectRule', {
      target: {
        bind: () => ({ arn: 'ARN', id: '' }),
      },
    });

    expect(stack).toHaveResourceLike('AWS::Events::Rule', {
      'EventPattern': {
        'source': [
          'aws.s3',
        ],
        'detail': {
          'requestParameters': {
            'bucketName': [
              bucket.bucketName,
            ],
          },
        },
      },
    });
  });

  test('onCloudTrailWriteObject matches on the requestParameters bucketName and key when the path is provided', () => {
    const stack = new cdk.Stack();
    const bucket = s3.Bucket.fromBucketAttributes(stack, 'Bucket', {
      bucketName: 'MyBucket',
    });
    bucket.onCloudTrailWriteObject('OnCloudTrailWriteObjectRule', {
      target: {
        bind: () => ({ arn: 'ARN', id: '' }),
      },
      paths: ['my/path.zip'],
    });

    expect(stack).toHaveResourceLike('AWS::Events::Rule', {
      'EventPattern': {
        'source': [
          'aws.s3',
        ],
        'detail': {
          'requestParameters': {
            'bucketName': [
              bucket.bucketName,
            ],
            'key': [
              'my/path.zip',
            ],
          },
        },
      },
    });
  });
});
