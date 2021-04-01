import { expect, haveResource } from '@aws-cdk/assert';
import * as kinesis from '@aws-cdk/aws-kinesis';
import * as lambda from '@aws-cdk/aws-lambda';
import * as cdk from '@aws-cdk/core';
import { Test } from 'nodeunit';
import * as sources from '../lib';
import { TestFunction } from './test-function';

/* eslint-disable quote-props */

export = {
  'sufficiently complex example'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const stream = new kinesis.Stream(stack, 'S');

    // WHEN
    fn.addEventSource(new sources.KinesisEventSource(stream, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
    }));

    // THEN
    expect(stack).to(haveResource('AWS::IAM::Policy', {
      'PolicyDocument': {
        'Statement': [
          {
            'Action': [
              'kinesis:DescribeStreamSummary',
              'kinesis:GetRecords',
              'kinesis:GetShardIterator',
              'kinesis:ListShards',
              'kinesis:SubscribeToShard',
            ],
            'Effect': 'Allow',
            'Resource': {
              'Fn::GetAtt': [
                'S509448A1',
                'Arn',
              ],
            },
          },
          {
            'Action': 'kinesis:DescribeStream',
            'Effect': 'Allow',
            'Resource': {
              'Fn::GetAtt': [
                'S509448A1',
                'Arn',
              ],
            },
          },
        ],
        'Version': '2012-10-17',
      },
      'PolicyName': 'FnServiceRoleDefaultPolicyC6A839BF',
      'Roles': [{
        'Ref': 'FnServiceRoleB9001A96',
      }],
    }));

    expect(stack).to(haveResource('AWS::Lambda::EventSourceMapping', {
      'EventSourceArn': {
        'Fn::GetAtt': [
          'S509448A1',
          'Arn',
        ],
      },
      'FunctionName': {
        'Ref': 'Fn9270CBC0',
      },
      'BatchSize': 100,
      'StartingPosition': 'TRIM_HORIZON',
    }));

    test.done();
  },

  'specific tumblingWindowInSeconds'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const stream = new kinesis.Stream(stack, 'S');

    // WHEN
    fn.addEventSource(new sources.KinesisEventSource(stream, {
      batchSize: 50,
      startingPosition: lambda.StartingPosition.LATEST,
      tumblingWindow: cdk.Duration.seconds(60),
    }));

    // THEN
    expect(stack).to(haveResource('AWS::Lambda::EventSourceMapping', {
      'EventSourceArn': {
        'Fn::GetAtt': [
          'S509448A1',
          'Arn',
        ],
      },
      'FunctionName': {
        'Ref': 'Fn9270CBC0',
      },
      'BatchSize': 50,
      'StartingPosition': 'LATEST',
      'TumblingWindowInSeconds': 60,
    }));

    test.done();
  },

  'specific batch size'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const stream = new kinesis.Stream(stack, 'S');

    // WHEN
    fn.addEventSource(new sources.KinesisEventSource(stream, {
      batchSize: 50,
      startingPosition: lambda.StartingPosition.LATEST,
    }));

    // THEN
    expect(stack).to(haveResource('AWS::Lambda::EventSourceMapping', {
      'EventSourceArn': {
        'Fn::GetAtt': [
          'S509448A1',
          'Arn',
        ],
      },
      'FunctionName': {
        'Ref': 'Fn9270CBC0',
      },
      'BatchSize': 50,
      'StartingPosition': 'LATEST',
    }));

    test.done();
  },

  'fails if batch size < 1'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const stream = new kinesis.Stream(stack, 'S');

    // WHEN
    test.throws(() => fn.addEventSource(new sources.KinesisEventSource(stream, {
      batchSize: 0,
      startingPosition: lambda.StartingPosition.LATEST,
    })), /Maximum batch size must be between 1 and 10000 inclusive \(given 0\)/);

    test.done();
  },

  'fails if batch size > 10000'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const stream = new kinesis.Stream(stack, 'S');

    // WHEN
    test.throws(() => fn.addEventSource(new sources.KinesisEventSource(stream, {
      batchSize: 10001,
      startingPosition: lambda.StartingPosition.LATEST,
    })), /Maximum batch size must be between 1 and 10000 inclusive \(given 10001\)/);

    test.done();
  },

  'accepts if batch size is a token'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const stream = new kinesis.Stream(stack, 'S');

    // WHEN
    fn.addEventSource(new sources.KinesisEventSource(stream, {
      batchSize: cdk.Lazy.number({ produce: () => 10 }),
      startingPosition: lambda.StartingPosition.LATEST,
    }));

    test.done();
  },

  'specific maxBatchingWindow'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const stream = new kinesis.Stream(stack, 'S');

    // WHEN
    fn.addEventSource(new sources.KinesisEventSource(stream, {
      maxBatchingWindow: cdk.Duration.minutes(2),
      startingPosition: lambda.StartingPosition.LATEST,
    }));

    // THEN
    expect(stack).to(haveResource('AWS::Lambda::EventSourceMapping', {
      'EventSourceArn': {
        'Fn::GetAtt': [
          'S509448A1',
          'Arn',
        ],
      },
      'FunctionName': {
        'Ref': 'Fn9270CBC0',
      },
      'MaximumBatchingWindowInSeconds': 120,
      'StartingPosition': 'LATEST',
    }));

    test.done();
  },

  'contains eventSourceMappingId after lambda binding'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const stream = new kinesis.Stream(stack, 'S');
    const eventSource = new sources.KinesisEventSource(stream, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
    });

    // WHEN
    fn.addEventSource(eventSource);

    // THEN
    test.ok(eventSource.eventSourceMappingId);
    test.done();
  },

  'eventSourceMappingId throws error before binding to lambda'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const stream = new kinesis.Stream(stack, 'S');
    const eventSource = new sources.KinesisEventSource(stream, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
    });

    // WHEN/THEN
    test.throws(() => eventSource.eventSourceMappingId, /KinesisEventSource is not yet bound to an event source mapping/);
    test.done();
  },

  'event source disabled'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const stream = new kinesis.Stream(stack, 'S');
    const eventSource = new sources.KinesisEventSource(stream, {
      startingPosition: lambda.StartingPosition.LATEST,
      enabled: false,
    });

    // WHEN
    fn.addEventSource(eventSource);

    // THEN
    expect(stack).to(haveResource('AWS::Lambda::EventSourceMapping', {
      'Enabled': false,
    }));
    test.done();
  },
};
