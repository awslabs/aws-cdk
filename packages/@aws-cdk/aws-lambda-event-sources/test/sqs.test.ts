import { TemplateAssertions } from '@aws-cdk/assertions';
import * as sqs from '@aws-cdk/aws-sqs';
import * as cdk from '@aws-cdk/core';
import * as sources from '../lib';
import { TestFunction } from './test-function';

/* eslint-disable quote-props */

describe('SQSEventSource', () => {
  test('defaults', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const q = new sqs.Queue(stack, 'Q');

    // WHEN
    fn.addEventSource(new sources.SqsEventSource(q));

    // THEN
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
      'PolicyDocument': {
        'Statement': [
          {
            'Action': [
              'sqs:ReceiveMessage',
              'sqs:ChangeMessageVisibility',
              'sqs:GetQueueUrl',
              'sqs:DeleteMessage',
              'sqs:GetQueueAttributes',
            ],
            'Effect': 'Allow',
            'Resource': {
              'Fn::GetAtt': [
                'Q63C6E3AB',
                'Arn',
              ],
            },
          },
        ],
        'Version': '2012-10-17',
      },
    });

    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      'EventSourceArn': {
        'Fn::GetAtt': [
          'Q63C6E3AB',
          'Arn',
        ],
      },
      'FunctionName': {
        'Ref': 'Fn9270CBC0',
      },
    });


  });

  test('specific batch size', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const q = new sqs.Queue(stack, 'Q');

    // WHEN
    fn.addEventSource(new sources.SqsEventSource(q, {
      batchSize: 5,
    }));

    // THEN
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      'EventSourceArn': {
        'Fn::GetAtt': [
          'Q63C6E3AB',
          'Arn',
        ],
      },
      'FunctionName': {
        'Ref': 'Fn9270CBC0',
      },
      'BatchSize': 5,
    });


  });

  test('unresolved batch size', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const q = new sqs.Queue(stack, 'Q');
    const batchSize : number = 500;

    // WHEN
    fn.addEventSource(new sources.SqsEventSource(q, {
      batchSize: cdk.Lazy.number({
        produce() {
          return batchSize;
        },
      }),
    }));

    // THEN
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      'BatchSize': 500,
    });


  });

  test('fails if batch size is < 1', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const q = new sqs.Queue(stack, 'Q');

    // WHEN/THEN
    expect(() => fn.addEventSource(new sources.SqsEventSource(q, {
      batchSize: 0,
    }))).toThrow(/Maximum batch size must be between 1 and 10 inclusive \(given 0\) when batching window is not specified\./);


  });

  test('fails if batch size is > 10', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const q = new sqs.Queue(stack, 'Q');

    // WHEN/THEN
    expect(() => fn.addEventSource(new sources.SqsEventSource(q, {
      batchSize: 11,
    }))).toThrow(/Maximum batch size must be between 1 and 10 inclusive \(given 11\) when batching window is not specified\./);


  });

  test('batch size is > 10 and batch window is defined', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const q = new sqs.Queue(stack, 'Q');

    // WHEN
    fn.addEventSource(new sources.SqsEventSource(q, {
      batchSize: 1000,
      maxBatchingWindow: cdk.Duration.minutes(5),
    }));

    // THEN
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      'BatchSize': 1000,
      'MaximumBatchingWindowInSeconds': 300,
    });


  });

  test('fails if batch size is > 10000 and batch window is defined', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const q = new sqs.Queue(stack, 'Q');

    // WHEN/THEN
    expect(() => fn.addEventSource(new sources.SqsEventSource(q, {
      batchSize: 11000,
      maxBatchingWindow: cdk.Duration.minutes(5),
    }))).toThrow(/Maximum batch size must be between 1 and 10000 inclusive/i);


  });

  test('specific batch window', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const q = new sqs.Queue(stack, 'Q');

    // WHEN
    fn.addEventSource(new sources.SqsEventSource(q, {
      maxBatchingWindow: cdk.Duration.minutes(5),
    }));

    // THEN
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      'MaximumBatchingWindowInSeconds': 300,
    });


  });

  test('fails if batch window defined for FIFO queue', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const q = new sqs.Queue(stack, 'Q', {
      fifo: true,
    });

    // WHEN/THEN
    expect(() => fn.addEventSource(new sources.SqsEventSource(q, {
      maxBatchingWindow: cdk.Duration.minutes(5),
    }))).toThrow(/Batching window is not supported for FIFO queues/);


  });

  test('fails if batch window is > 5', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const q = new sqs.Queue(stack, 'Q');

    // WHEN/THEN
    expect(() => fn.addEventSource(new sources.SqsEventSource(q, {
      maxBatchingWindow: cdk.Duration.minutes(7),
    }))).toThrow(/Maximum batching window must be 300 seconds or less/i);


  });

  test('contains eventSourceMappingId after lambda binding', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const q = new sqs.Queue(stack, 'Q');
    const eventSource = new sources.SqsEventSource(q);

    // WHEN
    fn.addEventSource(eventSource);

    // THEN
    expect(eventSource.eventSourceMappingId).toBeDefined();

  });

  test('eventSourceMappingId throws error before binding to lambda', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const q = new sqs.Queue(stack, 'Q');
    const eventSource = new sources.SqsEventSource(q);

    // WHEN/THEN
    expect(() => eventSource.eventSourceMappingId).toThrow(/SqsEventSource is not yet bound to an event source mapping/);

  });

  test('event source disabled', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const q = new sqs.Queue(stack, 'Q');

    // WHEN
    fn.addEventSource(new sources.SqsEventSource(q, {
      enabled: false,
    }));

    // THEN
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      'Enabled': false,
    });


  });
});
