import '@aws-cdk/assert-internal/jest';
import * as kms from '@aws-cdk/aws-kms';
import * as lambda from '@aws-cdk/aws-lambda';
import * as sns from '@aws-cdk/aws-sns';
import * as sqs from '@aws-cdk/aws-sqs';
import { CfnParameter, Duration, RemovalPolicy, Stack, Token } from '@aws-cdk/core';
import * as subs from '../lib';

/* eslint-disable quote-props */

let stack: Stack;
let topic: sns.Topic;

beforeEach(() => {
  stack = new Stack();
  topic = new sns.Topic(stack, 'MyTopic', {
    topicName: 'topicName',
    displayName: 'displayName',
  });
});

test('url subscription', () => {
  topic.addSubscription(new subs.UrlSubscription('https://foobar.com/'));

  expect(stack).toMatchTemplate({
    'Resources': {
      'MyTopic86869434': {
        'Type': 'AWS::SNS::Topic',
        'Properties': {
          'DisplayName': 'displayName',
          'TopicName': 'topicName',
        },
      },
      'MyTopichttpsfoobarcomDEA92AB5': {
        'Type': 'AWS::SNS::Subscription',
        'Properties': {
          'Endpoint': 'https://foobar.com/',
          'Protocol': 'https',
          'TopicArn': {
            'Ref': 'MyTopic86869434',
          },
        },
      },
    },
  });
});

test('url subscription with user provided dlq', () => {
  const dlQueue = new sqs.Queue(stack, 'DeadLetterQueue', {
    queueName: 'MySubscription_DLQ',
    retentionPeriod: Duration.days(14),
  });
  topic.addSubscription(new subs.UrlSubscription('https://foobar.com/', {
    deadLetterQueue: dlQueue,
  }));

  expect(stack).toMatchTemplate({
    'Resources': {
      'MyTopic86869434': {
        'Type': 'AWS::SNS::Topic',
        'Properties': {
          'DisplayName': 'displayName',
          'TopicName': 'topicName',
        },
      },
      'MyTopichttpsfoobarcomDEA92AB5': {
        'Type': 'AWS::SNS::Subscription',
        'Properties': {
          'Endpoint': 'https://foobar.com/',
          'Protocol': 'https',
          'TopicArn': {
            'Ref': 'MyTopic86869434',
          },
          'RedrivePolicy': {
            'deadLetterTargetArn': {
              'Fn::GetAtt': [
                'DeadLetterQueue9F481546',
                'Arn',
              ],
            },
          },
        },
      },
      'DeadLetterQueue9F481546': {
        'Type': 'AWS::SQS::Queue',
        'DeletionPolicy': 'Delete',
        'UpdateReplacePolicy': 'Delete',
        'Properties': {
          'MessageRetentionPeriod': 1209600,
          'QueueName': 'MySubscription_DLQ',
        },
      },
      'DeadLetterQueuePolicyB1FB890C': {
        'Type': 'AWS::SQS::QueuePolicy',
        'Properties': {
          'PolicyDocument': {
            'Statement': [
              {
                'Action': 'sqs:SendMessage',
                'Condition': {
                  'ArnEquals': {
                    'aws:SourceArn': {
                      'Ref': 'MyTopic86869434',
                    },
                  },
                },
                'Effect': 'Allow',
                'Principal': {
                  'Service': 'sns.amazonaws.com',
                },
                'Resource': {
                  'Fn::GetAtt': [
                    'DeadLetterQueue9F481546',
                    'Arn',
                  ],
                },
              },
            ],
            'Version': '2012-10-17',
          },
          'Queues': [
            {
              'Ref': 'DeadLetterQueue9F481546',
            },
          ],
        },
      },
    },
  });
});

test('url subscription (with raw delivery)', () => {
  topic.addSubscription(new subs.UrlSubscription('https://foobar.com/', {
    rawMessageDelivery: true,
  }));

  expect(stack).toMatchTemplate({
    'Resources': {
      'MyTopic86869434': {
        'Type': 'AWS::SNS::Topic',
        'Properties': {
          'DisplayName': 'displayName',
          'TopicName': 'topicName',
        },
      },
      'MyTopichttpsfoobarcomDEA92AB5': {
        'Type': 'AWS::SNS::Subscription',
        'Properties': {
          'Endpoint': 'https://foobar.com/',
          'Protocol': 'https',
          'TopicArn': { 'Ref': 'MyTopic86869434' },
          'RawMessageDelivery': true,
        },
      },
    },
  });
});

test('url subscription (unresolved url with protocol)', () => {
  const urlToken = Token.asString({ Ref: 'my-url-1' });
  topic.addSubscription(new subs.UrlSubscription(urlToken, { protocol: sns.SubscriptionProtocol.HTTPS }));

  expect(stack).toMatchTemplate({
    'Resources': {
      'MyTopic86869434': {
        'Type': 'AWS::SNS::Topic',
        'Properties': {
          'DisplayName': 'displayName',
          'TopicName': 'topicName',
        },
      },
      'MyTopicTokenSubscription141DD1BE2': {
        'Type': 'AWS::SNS::Subscription',
        'Properties': {
          'Endpoint': {
            'Ref': 'my-url-1',
          },
          'Protocol': 'https',
          'TopicArn': { 'Ref': 'MyTopic86869434' },
        },
      },
    },
  });
});

test('url subscription (double unresolved url with protocol)', () => {
  const urlToken1 = Token.asString({ Ref: 'my-url-1' });
  const urlToken2 = Token.asString({ Ref: 'my-url-2' });

  topic.addSubscription(new subs.UrlSubscription(urlToken1, { protocol: sns.SubscriptionProtocol.HTTPS }));
  topic.addSubscription(new subs.UrlSubscription(urlToken2, { protocol: sns.SubscriptionProtocol.HTTPS }));

  expect(stack).toMatchTemplate({
    'Resources': {
      'MyTopic86869434': {
        'Type': 'AWS::SNS::Topic',
        'Properties': {
          'DisplayName': 'displayName',
          'TopicName': 'topicName',
        },
      },
      'MyTopicTokenSubscription141DD1BE2': {
        'Type': 'AWS::SNS::Subscription',
        'Properties': {
          'Endpoint': {
            'Ref': 'my-url-1',
          },
          'Protocol': 'https',
          'TopicArn': { 'Ref': 'MyTopic86869434' },
        },
      },
      'MyTopicTokenSubscription293BFE3F9': {
        'Type': 'AWS::SNS::Subscription',
        'Properties': {
          'Endpoint': {
            'Ref': 'my-url-2',
          },
          'Protocol': 'https',
          'TopicArn': { 'Ref': 'MyTopic86869434' },
        },
      },
    },
  });
});

test('url subscription (unknown protocol)', () => {
  expect(() => topic.addSubscription(new subs.UrlSubscription('some-protocol://foobar.com/')))
    .toThrowError(/URL must start with either http:\/\/ or https:\/\//);
});

test('url subscription (unresolved url without protocol)', () => {
  const urlToken = Token.asString({ Ref: 'my-url-1' });

  expect(() => topic.addSubscription(new subs.UrlSubscription(urlToken)))
    .toThrowError(/Must provide protocol if url is unresolved/);
});

test('queue subscription', () => {
  const queue = new sqs.Queue(stack, 'MyQueue');

  topic.addSubscription(new subs.SqsSubscription(queue));

  expect(stack).toMatchTemplate({
    'Resources': {
      'MyTopic86869434': {
        'Type': 'AWS::SNS::Topic',
        'Properties': {
          'DisplayName': 'displayName',
          'TopicName': 'topicName',
        },
      },
      'MyQueueE6CA6235': {
        'Type': 'AWS::SQS::Queue',
        'DeletionPolicy': 'Delete',
        'UpdateReplacePolicy': 'Delete',
      },
      'MyQueuePolicy6BBEDDAC': {
        'Type': 'AWS::SQS::QueuePolicy',
        'Properties': {
          'PolicyDocument': {
            'Statement': [
              {
                'Action': 'sqs:SendMessage',
                'Condition': {
                  'ArnEquals': {
                    'aws:SourceArn': {
                      'Ref': 'MyTopic86869434',
                    },
                  },
                },
                'Effect': 'Allow',
                'Principal': {
                  'Service': 'sns.amazonaws.com',
                },
                'Resource': {
                  'Fn::GetAtt': [
                    'MyQueueE6CA6235',
                    'Arn',
                  ],
                },
              },
            ],
            'Version': '2012-10-17',
          },
          'Queues': [
            {
              'Ref': 'MyQueueE6CA6235',
            },
          ],
        },
      },
      'MyQueueMyTopic9B00631B': {
        'Type': 'AWS::SNS::Subscription',
        'Properties': {
          'Protocol': 'sqs',
          'TopicArn': {
            'Ref': 'MyTopic86869434',
          },
          'Endpoint': {
            'Fn::GetAtt': [
              'MyQueueE6CA6235',
              'Arn',
            ],
          },
        },
      },
    },
  });
});

test('queue subscription with user provided dlq', () => {
  const queue = new sqs.Queue(stack, 'MyQueue');
  const dlQueue = new sqs.Queue(stack, 'DeadLetterQueue', {
    queueName: 'MySubscription_DLQ',
    retentionPeriod: Duration.days(14),
  });

  topic.addSubscription(new subs.SqsSubscription(queue, {
    deadLetterQueue: dlQueue,
  }));

  expect(stack).toMatchTemplate({
    'Resources': {
      'MyTopic86869434': {
        'Type': 'AWS::SNS::Topic',
        'Properties': {
          'DisplayName': 'displayName',
          'TopicName': 'topicName',
        },
      },
      'MyQueueE6CA6235': {
        'Type': 'AWS::SQS::Queue',
        'DeletionPolicy': 'Delete',
        'UpdateReplacePolicy': 'Delete',
      },
      'MyQueuePolicy6BBEDDAC': {
        'Type': 'AWS::SQS::QueuePolicy',
        'Properties': {
          'PolicyDocument': {
            'Statement': [
              {
                'Action': 'sqs:SendMessage',
                'Condition': {
                  'ArnEquals': {
                    'aws:SourceArn': {
                      'Ref': 'MyTopic86869434',
                    },
                  },
                },
                'Effect': 'Allow',
                'Principal': {
                  'Service': 'sns.amazonaws.com',
                },
                'Resource': {
                  'Fn::GetAtt': [
                    'MyQueueE6CA6235',
                    'Arn',
                  ],
                },
              },
            ],
            'Version': '2012-10-17',
          },
          'Queues': [
            {
              'Ref': 'MyQueueE6CA6235',
            },
          ],
        },
      },
      'MyQueueMyTopic9B00631B': {
        'Type': 'AWS::SNS::Subscription',
        'Properties': {
          'Protocol': 'sqs',
          'TopicArn': {
            'Ref': 'MyTopic86869434',
          },
          'Endpoint': {
            'Fn::GetAtt': [
              'MyQueueE6CA6235',
              'Arn',
            ],
          },
          'RedrivePolicy': {
            'deadLetterTargetArn': {
              'Fn::GetAtt': [
                'DeadLetterQueue9F481546',
                'Arn',
              ],
            },
          },
        },
      },
      'DeadLetterQueue9F481546': {
        'Type': 'AWS::SQS::Queue',
        'DeletionPolicy': 'Delete',
        'UpdateReplacePolicy': 'Delete',
        'Properties': {
          'MessageRetentionPeriod': 1209600,
          'QueueName': 'MySubscription_DLQ',
        },
      },
      'DeadLetterQueuePolicyB1FB890C': {
        'Type': 'AWS::SQS::QueuePolicy',
        'Properties': {
          'PolicyDocument': {
            'Statement': [
              {
                'Action': 'sqs:SendMessage',
                'Condition': {
                  'ArnEquals': {
                    'aws:SourceArn': {
                      'Ref': 'MyTopic86869434',
                    },
                  },
                },
                'Effect': 'Allow',
                'Principal': {
                  'Service': 'sns.amazonaws.com',
                },
                'Resource': {
                  'Fn::GetAtt': [
                    'DeadLetterQueue9F481546',
                    'Arn',
                  ],
                },
              },
            ],
            'Version': '2012-10-17',
          },
          'Queues': [
            {
              'Ref': 'DeadLetterQueue9F481546',
            },
          ],
        },
      },
    },
  });
});

test('queue subscription (with raw delivery)', () => {
  const queue = new sqs.Queue(stack, 'MyQueue');

  topic.addSubscription(new subs.SqsSubscription(queue, { rawMessageDelivery: true }));

  expect(stack).toHaveResource('AWS::SNS::Subscription', {
    'Endpoint': {
      'Fn::GetAtt': [
        'MyQueueE6CA6235',
        'Arn',
      ],
    },
    'Protocol': 'sqs',
    'TopicArn': {
      'Ref': 'MyTopic86869434',
    },
    'RawMessageDelivery': true,
  });
});

test('encrypted queue subscription', () => {
  const key = new kms.Key(stack, 'MyKey', {
    removalPolicy: RemovalPolicy.DESTROY,
  });

  const queue = new sqs.Queue(stack, 'MyQueue', {
    encryption: sqs.QueueEncryption.KMS,
    encryptionMasterKey: key,
  });

  topic.addSubscription(new subs.SqsSubscription(queue));

  expect(stack).toMatchTemplate({
    'Resources': {
      'MyTopic86869434': {
        'Type': 'AWS::SNS::Topic',
        'Properties': {
          'DisplayName': 'displayName',
          'TopicName': 'topicName',
        },
      },
      'MyKey6AB29FA6': {
        'Type': 'AWS::KMS::Key',
        'Properties': {
          'KeyPolicy': {
            'Statement': [
              {
                'Action': [
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
                'Effect': 'Allow',
                'Principal': {
                  'AWS': {
                    'Fn::Join': [
                      '',
                      [
                        'arn:',
                        {
                          'Ref': 'AWS::Partition',
                        },
                        ':iam::',
                        {
                          'Ref': 'AWS::AccountId',
                        },
                        ':root',
                      ],
                    ],
                  },
                },
                'Resource': '*',
              },
              {
                'Action': [
                  'kms:Decrypt',
                  'kms:GenerateDataKey',
                ],
                'Effect': 'Allow',
                'Principal': {
                  'Service': 'sns.amazonaws.com',
                },
                'Resource': '*',
              },
            ],
            'Version': '2012-10-17',
          },
        },
        'UpdateReplacePolicy': 'Delete',
        'DeletionPolicy': 'Delete',
      },
      'MyQueueE6CA6235': {
        'Type': 'AWS::SQS::Queue',
        'Properties': {
          'KmsMasterKeyId': {
            'Fn::GetAtt': [
              'MyKey6AB29FA6',
              'Arn',
            ],
          },
        },
        'DeletionPolicy': 'Delete',
        'UpdateReplacePolicy': 'Delete',
      },
      'MyQueuePolicy6BBEDDAC': {
        'Type': 'AWS::SQS::QueuePolicy',
        'Properties': {
          'PolicyDocument': {
            'Statement': [
              {
                'Action': 'sqs:SendMessage',
                'Condition': {
                  'ArnEquals': {
                    'aws:SourceArn': {
                      'Ref': 'MyTopic86869434',
                    },
                  },
                },
                'Effect': 'Allow',
                'Principal': {
                  'Service': 'sns.amazonaws.com',
                },
                'Resource': {
                  'Fn::GetAtt': [
                    'MyQueueE6CA6235',
                    'Arn',
                  ],
                },
              },
            ],
            'Version': '2012-10-17',
          },
          'Queues': [
            {
              'Ref': 'MyQueueE6CA6235',
            },
          ],
        },
      },
      'MyQueueMyTopic9B00631B': {
        'Type': 'AWS::SNS::Subscription',
        'Properties': {
          'Protocol': 'sqs',
          'TopicArn': {
            'Ref': 'MyTopic86869434',
          },
          'Endpoint': {
            'Fn::GetAtt': [
              'MyQueueE6CA6235',
              'Arn',
            ],
          },
        },
      },
    },
  });
});

test('lambda subscription', () => {
  const fction = new lambda.Function(stack, 'MyFunc', {
    runtime: lambda.Runtime.NODEJS_10_X,
    handler: 'index.handler',
    code: lambda.Code.fromInline('exports.handler = function(e, c, cb) { return cb() }'),
  });

  topic.addSubscription(new subs.LambdaSubscription(fction));

  expect(stack).toMatchTemplate({
    'Resources': {
      'MyTopic86869434': {
        'Type': 'AWS::SNS::Topic',
        'Properties': {
          'DisplayName': 'displayName',
          'TopicName': 'topicName',
        },
      },
      'MyFuncServiceRole54065130': {
        'Type': 'AWS::IAM::Role',
        'Properties': {
          'AssumeRolePolicyDocument': {
            'Statement': [
              {
                'Action': 'sts:AssumeRole',
                'Effect': 'Allow',
                'Principal': {
                  'Service': 'lambda.amazonaws.com',
                },
              },
            ],
            'Version': '2012-10-17',
          },
          'ManagedPolicyArns': [
            {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  {
                    'Ref': 'AWS::Partition',
                  },
                  ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
                ],
              ],
            },
          ],
        },
      },
      'MyFunc8A243A2C': {
        'Type': 'AWS::Lambda::Function',
        'Properties': {
          'Code': {
            'ZipFile': 'exports.handler = function(e, c, cb) { return cb() }',
          },
          'Handler': 'index.handler',
          'Role': {
            'Fn::GetAtt': [
              'MyFuncServiceRole54065130',
              'Arn',
            ],
          },
          'Runtime': 'nodejs10.x',
        },
        'DependsOn': [
          'MyFuncServiceRole54065130',
        ],
      },
      'MyFuncAllowInvokeMyTopicDD0A15B8': {
        'Type': 'AWS::Lambda::Permission',
        'Properties': {
          'Action': 'lambda:InvokeFunction',
          'FunctionName': {
            'Fn::GetAtt': [
              'MyFunc8A243A2C',
              'Arn',
            ],
          },
          'Principal': 'sns.amazonaws.com',
          'SourceArn': {
            'Ref': 'MyTopic86869434',
          },
        },
      },
      'MyFuncMyTopic93B6FB00': {
        'Type': 'AWS::SNS::Subscription',
        'Properties': {
          'Protocol': 'lambda',
          'TopicArn': {
            'Ref': 'MyTopic86869434',
          },
          'Endpoint': {
            'Fn::GetAtt': [
              'MyFunc8A243A2C',
              'Arn',
            ],
          },
        },
      },
    },
  });
});

test('email subscription', () => {
  topic.addSubscription(new subs.EmailSubscription('foo@bar.com'));

  expect(stack).toMatchTemplate({
    'Resources': {
      'MyTopic86869434': {
        'Type': 'AWS::SNS::Topic',
        'Properties': {
          'DisplayName': 'displayName',
          'TopicName': 'topicName',
        },
      },
      'MyTopicfoobarcomA344CADA': {
        'Type': 'AWS::SNS::Subscription',
        'Properties': {
          'Endpoint': 'foo@bar.com',
          'Protocol': 'email',
          'TopicArn': {
            'Ref': 'MyTopic86869434',
          },
        },
      },
    },
  });
});

test('email subscription with unresolved', () => {
  const emailToken = Token.asString({ Ref: 'my-email-1' });
  topic.addSubscription(new subs.EmailSubscription(emailToken));

  expect(stack).toMatchTemplate({
    'Resources': {
      'MyTopic86869434': {
        'Type': 'AWS::SNS::Topic',
        'Properties': {
          'DisplayName': 'displayName',
          'TopicName': 'topicName',
        },
      },
      'MyTopicTokenSubscription141DD1BE2': {
        'Type': 'AWS::SNS::Subscription',
        'Properties': {
          'Endpoint': {
            'Ref': 'my-email-1',
          },
          'Protocol': 'email',
          'TopicArn': {
            'Ref': 'MyTopic86869434',
          },
        },
      },
    },
  });
});

test('email and url subscriptions with unresolved', () => {
  const emailToken = Token.asString({ Ref: 'my-email-1' });
  const urlToken = Token.asString({ Ref: 'my-url-1' });
  topic.addSubscription(new subs.EmailSubscription(emailToken));
  topic.addSubscription(new subs.UrlSubscription(urlToken, { protocol: sns.SubscriptionProtocol.HTTPS }));

  expect(stack).toMatchTemplate({
    'Resources': {
      'MyTopic86869434': {
        'Type': 'AWS::SNS::Topic',
        'Properties': {
          'DisplayName': 'displayName',
          'TopicName': 'topicName',
        },
      },
      'MyTopicTokenSubscription141DD1BE2': {
        'Type': 'AWS::SNS::Subscription',
        'Properties': {
          'Endpoint': {
            'Ref': 'my-email-1',
          },
          'Protocol': 'email',
          'TopicArn': {
            'Ref': 'MyTopic86869434',
          },
        },
      },
      'MyTopicTokenSubscription293BFE3F9': {
        'Type': 'AWS::SNS::Subscription',
        'Properties': {
          'Endpoint': {
            'Ref': 'my-url-1',
          },
          'Protocol': 'https',
          'TopicArn': {
            'Ref': 'MyTopic86869434',
          },
        },
      },
    },
  });
});

test('email and url subscriptions with unresolved - four subscriptions', () => {
  const emailToken1 = Token.asString({ Ref: 'my-email-1' });
  const emailToken2 = Token.asString({ Ref: 'my-email-2' });
  const emailToken3 = Token.asString({ Ref: 'my-email-3' });
  const emailToken4 = Token.asString({ Ref: 'my-email-4' });

  topic.addSubscription(new subs.EmailSubscription(emailToken1));
  topic.addSubscription(new subs.EmailSubscription(emailToken2));
  topic.addSubscription(new subs.EmailSubscription(emailToken3));
  topic.addSubscription(new subs.EmailSubscription(emailToken4));

  expect(stack).toMatchTemplate({
    'Resources': {
      'MyTopic86869434': {
        'Type': 'AWS::SNS::Topic',
        'Properties': {
          'DisplayName': 'displayName',
          'TopicName': 'topicName',
        },
      },
      'MyTopicTokenSubscription141DD1BE2': {
        'Type': 'AWS::SNS::Subscription',
        'Properties': {
          'Endpoint': {
            'Ref': 'my-email-1',
          },
          'Protocol': 'email',
          'TopicArn': {
            'Ref': 'MyTopic86869434',
          },
        },
      },
      'MyTopicTokenSubscription293BFE3F9': {
        'Type': 'AWS::SNS::Subscription',
        'Properties': {
          'Endpoint': {
            'Ref': 'my-email-2',
          },
          'Protocol': 'email',
          'TopicArn': {
            'Ref': 'MyTopic86869434',
          },
        },
      },
      'MyTopicTokenSubscription335C2B4CA': {
        'Type': 'AWS::SNS::Subscription',
        'Properties': {
          'Endpoint': {
            'Ref': 'my-email-3',
          },
          'Protocol': 'email',
          'TopicArn': {
            'Ref': 'MyTopic86869434',
          },
        },
      },
      'MyTopicTokenSubscription4DBE52A3F': {
        'Type': 'AWS::SNS::Subscription',
        'Properties': {
          'Endpoint': {
            'Ref': 'my-email-4',
          },
          'Protocol': 'email',
          'TopicArn': {
            'Ref': 'MyTopic86869434',
          },
        },
      },
    },
  });
});

test('multiple subscriptions', () => {
  const queue = new sqs.Queue(stack, 'MyQueue');
  const func = new lambda.Function(stack, 'MyFunc', {
    runtime: lambda.Runtime.NODEJS_10_X,
    handler: 'index.handler',
    code: lambda.Code.fromInline('exports.handler = function(e, c, cb) { return cb() }'),
  });

  topic.addSubscription(new subs.SqsSubscription(queue));
  topic.addSubscription(new subs.LambdaSubscription(func));

  expect(stack).toMatchTemplate({
    'Resources': {
      'MyTopic86869434': {
        'Type': 'AWS::SNS::Topic',
        'Properties': {
          'DisplayName': 'displayName',
          'TopicName': 'topicName',
        },
      },
      'MyQueueE6CA6235': {
        'Type': 'AWS::SQS::Queue',
        'DeletionPolicy': 'Delete',
        'UpdateReplacePolicy': 'Delete',
      },
      'MyQueuePolicy6BBEDDAC': {
        'Type': 'AWS::SQS::QueuePolicy',
        'Properties': {
          'PolicyDocument': {
            'Statement': [
              {
                'Action': 'sqs:SendMessage',
                'Condition': {
                  'ArnEquals': {
                    'aws:SourceArn': {
                      'Ref': 'MyTopic86869434',
                    },
                  },
                },
                'Effect': 'Allow',
                'Principal': {
                  'Service': 'sns.amazonaws.com',
                },
                'Resource': {
                  'Fn::GetAtt': [
                    'MyQueueE6CA6235',
                    'Arn',
                  ],
                },
              },
            ],
            'Version': '2012-10-17',
          },
          'Queues': [
            {
              'Ref': 'MyQueueE6CA6235',
            },
          ],
        },
      },
      'MyQueueMyTopic9B00631B': {
        'Type': 'AWS::SNS::Subscription',
        'Properties': {
          'Protocol': 'sqs',
          'TopicArn': {
            'Ref': 'MyTopic86869434',
          },
          'Endpoint': {
            'Fn::GetAtt': [
              'MyQueueE6CA6235',
              'Arn',
            ],
          },
        },
      },
      'MyFuncServiceRole54065130': {
        'Type': 'AWS::IAM::Role',
        'Properties': {
          'AssumeRolePolicyDocument': {
            'Statement': [
              {
                'Action': 'sts:AssumeRole',
                'Effect': 'Allow',
                'Principal': {
                  'Service': 'lambda.amazonaws.com',
                },
              },
            ],
            'Version': '2012-10-17',
          },
          'ManagedPolicyArns': [
            {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  {
                    'Ref': 'AWS::Partition',
                  },
                  ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
                ],
              ],
            },
          ],
        },
      },
      'MyFunc8A243A2C': {
        'Type': 'AWS::Lambda::Function',
        'Properties': {
          'Code': {
            'ZipFile': 'exports.handler = function(e, c, cb) { return cb() }',
          },
          'Handler': 'index.handler',
          'Role': {
            'Fn::GetAtt': [
              'MyFuncServiceRole54065130',
              'Arn',
            ],
          },
          'Runtime': 'nodejs10.x',
        },
        'DependsOn': [
          'MyFuncServiceRole54065130',
        ],
      },
      'MyFuncAllowInvokeMyTopicDD0A15B8': {
        'Type': 'AWS::Lambda::Permission',
        'Properties': {
          'Action': 'lambda:InvokeFunction',
          'FunctionName': {
            'Fn::GetAtt': [
              'MyFunc8A243A2C',
              'Arn',
            ],
          },
          'Principal': 'sns.amazonaws.com',
          'SourceArn': {
            'Ref': 'MyTopic86869434',
          },
        },
      },
      'MyFuncMyTopic93B6FB00': {
        'Type': 'AWS::SNS::Subscription',
        'Properties': {
          'Protocol': 'lambda',
          'TopicArn': {
            'Ref': 'MyTopic86869434',
          },
          'Endpoint': {
            'Fn::GetAtt': [
              'MyFunc8A243A2C',
              'Arn',
            ],
          },
        },
      },
    },
  });
});

test('throws with mutliple subscriptions of the same subscriber', () => {
  const queue = new sqs.Queue(stack, 'MyQueue');

  topic.addSubscription(new subs.SqsSubscription(queue));

  expect(() => topic.addSubscription(new subs.SqsSubscription(queue)))
    .toThrowError(/A subscription with id \"MyTopic\" already exists under the scope Default\/MyQueue/);
});

test('with filter policy', () => {
  const fction = new lambda.Function(stack, 'MyFunc', {
    runtime: lambda.Runtime.NODEJS_10_X,
    handler: 'index.handler',
    code: lambda.Code.fromInline('exports.handler = function(e, c, cb) { return cb() }'),
  });

  topic.addSubscription(new subs.LambdaSubscription(fction, {
    filterPolicy: {
      color: sns.SubscriptionFilter.stringFilter({
        allowlist: ['red'],
        matchPrefixes: ['bl', 'ye'],
      }),
      size: sns.SubscriptionFilter.stringFilter({
        denylist: ['small', 'medium'],
      }),
      price: sns.SubscriptionFilter.numericFilter({
        between: { start: 100, stop: 200 },
      }),
    },
  }));

  expect(stack).toHaveResource('AWS::SNS::Subscription', {
    'FilterPolicy': {
      'color': [
        'red',
        {
          'prefix': 'bl',
        },
        {
          'prefix': 'ye',
        },
      ],
      'size': [
        {
          'anything-but': [
            'small',
            'medium',
          ],
        },
      ],
      'price': [
        {
          'numeric': [
            '>=',
            100,
            '<=',
            200,
          ],
        },
      ],
    },
  });
});

test('region property is present on an imported topic - sqs', () => {
  const imported = sns.Topic.fromTopicArn(stack, 'mytopic', 'arn:aws:sns:us-east-1:1234567890:mytopic');
  const queue = new sqs.Queue(stack, 'myqueue');
  imported.addSubscription(new subs.SqsSubscription(queue));

  expect(stack).toHaveResource('AWS::SNS::Subscription', {
    Region: 'us-east-1',
  });
});

test('region property on an imported topic as a parameter - sqs', () => {
  const topicArn = new CfnParameter(stack, 'topicArn');
  const imported = sns.Topic.fromTopicArn(stack, 'mytopic', topicArn.valueAsString);
  const queue = new sqs.Queue(stack, 'myqueue');
  imported.addSubscription(new subs.SqsSubscription(queue));

  expect(stack).toHaveResource('AWS::SNS::Subscription', {
    Region: {
      'Fn::Select': [3, { 'Fn::Split': [':', { 'Ref': 'topicArn' }] }],
    },
  });
});

test('region property is present on an imported topic - lambda', () => {
  const imported = sns.Topic.fromTopicArn(stack, 'mytopic', 'arn:aws:sns:us-east-1:1234567890:mytopic');
  const func = new lambda.Function(stack, 'MyFunc', {
    runtime: lambda.Runtime.NODEJS_10_X,
    handler: 'index.handler',
    code: lambda.Code.fromInline('exports.handler = function(e, c, cb) { return cb() }'),
  });
  imported.addSubscription(new subs.LambdaSubscription(func));

  expect(stack).toHaveResource('AWS::SNS::Subscription', {
    Region: 'us-east-1',
  });
});

test('region property on an imported topic as a parameter - lambda', () => {
  const topicArn = new CfnParameter(stack, 'topicArn');
  const imported = sns.Topic.fromTopicArn(stack, 'mytopic', topicArn.valueAsString);
  const func = new lambda.Function(stack, 'MyFunc', {
    runtime: lambda.Runtime.NODEJS_10_X,
    handler: 'index.handler',
    code: lambda.Code.fromInline('exports.handler = function(e, c, cb) { return cb() }'),
  });
  imported.addSubscription(new subs.LambdaSubscription(func));

  expect(stack).toHaveResource('AWS::SNS::Subscription', {
    Region: {
      'Fn::Select': [3, { 'Fn::Split': [':', { 'Ref': 'topicArn' }] }],
    },
  });
});

test('sms subscription', () => {
  topic.addSubscription(new subs.SmsSubscription('+15551231234'));

  expect(stack).toMatchTemplate({
    'Resources': {
      'MyTopic86869434': {
        'Type': 'AWS::SNS::Topic',
        'Properties': {
          'DisplayName': 'displayName',
          'TopicName': 'topicName',
        },
      },
      'MyTopic155512312349C8DEEEE': {
        'Type': 'AWS::SNS::Subscription',
        'Properties': {
          'Protocol': 'sms',
          'TopicArn': {
            'Ref': 'MyTopic86869434',
          },
          'Endpoint': '+15551231234',
        },
      },
    },
  });
});

test('sms subscription with unresolved', () => {
  const smsToken = Token.asString({ Ref: 'my-sms-1' });
  topic.addSubscription(new subs.SmsSubscription(smsToken));

  expect(stack).toMatchTemplate({
    'Resources': {
      'MyTopic86869434': {
        'Type': 'AWS::SNS::Topic',
        'Properties': {
          'DisplayName': 'displayName',
          'TopicName': 'topicName',
        },
      },
      'MyTopicTokenSubscription141DD1BE2': {
        'Type': 'AWS::SNS::Subscription',
        'Properties': {
          'Endpoint': {
            'Ref': 'my-sms-1',
          },
          'Protocol': 'sms',
          'TopicArn': {
            'Ref': 'MyTopic86869434',
          },
        },
      },
    },
  });
});
