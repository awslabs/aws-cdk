import { TemplateAssertions } from '@aws-cdk/assertions';
import { Queue } from '@aws-cdk/aws-sqs';
import * as cdk from '@aws-cdk/core';
import * as sns from '../lib';

describe('Subscription', () => {
  test('create a subscription', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const topic = new sns.Topic(stack, 'Topic');

    // WHEN
    new sns.Subscription(stack, 'Subscription', {
      endpoint: 'endpoint',
      protocol: sns.SubscriptionProtocol.LAMBDA,
      topic,
    });

    // THEN
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::SNS::Subscription', {
      Endpoint: 'endpoint',
      Protocol: 'lambda',
      TopicArn: {
        Ref: 'TopicBFC7AF6E',
      },
    });

  });

  test('create a subscription with DLQ when client provides DLQ', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const topic = new sns.Topic(stack, 'Topic');
    const dlQueue = new Queue(stack, 'DeadLetterQueue', {
      queueName: 'MySubscription_DLQ',
      retentionPeriod: cdk.Duration.days(14),
    });

    // WHEN
    new sns.Subscription(stack, 'Subscription', {
      endpoint: 'endpoint',
      protocol: sns.SubscriptionProtocol.LAMBDA,
      topic,
      deadLetterQueue: dlQueue,
    });

    // THEN
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::SNS::Subscription', {
      Endpoint: 'endpoint',
      Protocol: 'lambda',
      TopicArn: {
        Ref: 'TopicBFC7AF6E',
      },
      RedrivePolicy: {
        deadLetterTargetArn: {
          'Fn::GetAtt': [
            'DeadLetterQueue9F481546',
            'Arn',
          ],
        },
      },
    });
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'MySubscription_DLQ',
      MessageRetentionPeriod: 1209600,
    });
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::SQS::QueuePolicy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'sqs:SendMessage',
            Condition: {
              ArnEquals: {
                'aws:SourceArn': {
                  Ref: 'TopicBFC7AF6E',
                },
              },
            },
            Effect: 'Allow',
            Principal: {
              Service: 'sns.amazonaws.com',
            },
            Resource: {
              'Fn::GetAtt': [
                'DeadLetterQueue9F481546',
                'Arn',
              ],
            },
          },
        ],
        Version: '2012-10-17',
      },
      Queues: [
        {
          Ref: 'DeadLetterQueue9F481546',
        },
      ],
    });

  });

  test('with filter policy', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const topic = new sns.Topic(stack, 'Topic');

    // WHEN
    new sns.Subscription(stack, 'Subscription', {
      endpoint: 'endpoint',
      filterPolicy: {
        color: sns.SubscriptionFilter.stringFilter({
          allowlist: ['red', 'green'],
          denylist: ['white', 'orange'],
          matchPrefixes: ['bl', 'ye'],
        }),
        price: sns.SubscriptionFilter.numericFilter({
          allowlist: [100, 200],
          between: { start: 300, stop: 350 },
          greaterThan: 500,
          lessThan: 1000,
          betweenStrict: { start: 2000, stop: 3000 },
          greaterThanOrEqualTo: 1000,
          lessThanOrEqualTo: -2,
        }),
      },
      protocol: sns.SubscriptionProtocol.LAMBDA,
      topic,
    });

    // THEN
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::SNS::Subscription', {
      FilterPolicy: {
        color: [
          'red',
          'green',
          { 'anything-but': ['white', 'orange'] },
          { prefix: 'bl' },
          { prefix: 'ye' },
        ],
        price: [
          { numeric: ['=', 100] },
          { numeric: ['=', 200] },
          { numeric: ['>', 500] },
          { numeric: ['>=', 1000] },
          { numeric: ['<', 1000] },
          { numeric: ['<=', -2] },
          { numeric: ['>=', 300, '<=', 350] },
          { numeric: ['>', 2000, '<', 3000] },
        ],
      },
    });

  });

  test('with existsFilter', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const topic = new sns.Topic(stack, 'Topic');

    // WHEN
    new sns.Subscription(stack, 'Subscription', {
      endpoint: 'endpoint',
      filterPolicy: {
        size: sns.SubscriptionFilter.existsFilter(),
      },
      protocol: sns.SubscriptionProtocol.LAMBDA,
      topic,
    });

    // THEN
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::SNS::Subscription', {
      FilterPolicy: {
        size: [{ exists: true }],
      },
    });

  });

  test('throws with raw delivery for protocol other than http, https or sqs', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const topic = new sns.Topic(stack, 'Topic');

    // THEN
    expect(() => new sns.Subscription(stack, 'Subscription', {
      endpoint: 'endpoint',
      protocol: sns.SubscriptionProtocol.LAMBDA,
      topic,
      rawMessageDelivery: true,
    })).toThrow(/Raw message delivery/);

  });

  test('throws with more than 5 attributes in a filter policy', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const topic = new sns.Topic(stack, 'Topic');
    const cond = { conditions: [] };

    // THEN
    expect(() => new sns.Subscription(stack, 'Subscription', {
      endpoint: 'endpoint',
      protocol: sns.SubscriptionProtocol.LAMBDA,
      topic,
      filterPolicy: {
        a: cond,
        b: cond,
        c: cond,
        d: cond,
        e: cond,
        f: cond,
      },
    })).toThrow(/5 attribute names/);

  });

  test('throws with more than 100 conditions in a filter policy', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const topic = new sns.Topic(stack, 'Topic');

    // THEN
    expect(() => new sns.Subscription(stack, 'Subscription', {
      endpoint: 'endpoint',
      protocol: sns.SubscriptionProtocol.LAMBDA,
      topic,
      filterPolicy: {
        a: { conditions: [...Array.from(Array(2).keys())] },
        b: { conditions: [...Array.from(Array(10).keys())] },
        c: { conditions: [...Array.from(Array(6).keys())] },
      },
    })).toThrow(/\(120\) must not exceed 100/);

  });
});
