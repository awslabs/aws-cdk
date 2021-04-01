import { expect, haveResource } from '@aws-cdk/assert';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as lambda from '@aws-cdk/aws-lambda';
import * as sqs from '@aws-cdk/aws-sqs';
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
    const table = new dynamodb.Table(stack, 'T', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    // WHEN
    fn.addEventSource(new sources.DynamoEventSource(table, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
    }));

    // THEN
    expect(stack).to(haveResource('AWS::IAM::Policy', {
      'PolicyDocument': {
        'Statement': [
          {
            'Action': 'dynamodb:ListStreams',
            'Effect': 'Allow',
            'Resource': '*',
          },
          {
            'Action': [
              'dynamodb:DescribeStream',
              'dynamodb:GetRecords',
              'dynamodb:GetShardIterator',
            ],
            'Effect': 'Allow',
            'Resource': {
              'Fn::GetAtt': [
                'TD925BC7E',
                'StreamArn',
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
          'TD925BC7E',
          'StreamArn',
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

  'specific tumblingWindow'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const table = new dynamodb.Table(stack, 'T', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    // WHEN
    fn.addEventSource(new sources.DynamoEventSource(table, {
      batchSize: 50,
      startingPosition: lambda.StartingPosition.LATEST,
      tumblingWindow: cdk.Duration.seconds(60),
    }));

    // THEN
    expect(stack).to(haveResource('AWS::Lambda::EventSourceMapping', {
      TumblingWindowInSeconds: 60,
    }));

    test.done();
  },

  'specific batch size'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const table = new dynamodb.Table(stack, 'T', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    // WHEN
    fn.addEventSource(new sources.DynamoEventSource(table, {
      batchSize: 50,
      startingPosition: lambda.StartingPosition.LATEST,
    }));

    // THEN
    expect(stack).to(haveResource('AWS::Lambda::EventSourceMapping', {
      'EventSourceArn': {
        'Fn::GetAtt': [
          'TD925BC7E',
          'StreamArn',
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

  'fails if streaming not enabled on table'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const table = new dynamodb.Table(stack, 'T', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // WHEN
    test.throws(() => fn.addEventSource(new sources.DynamoEventSource(table, {
      batchSize: 50,
      startingPosition: lambda.StartingPosition.LATEST,
    })), /DynamoDB Streams must be enabled on the table Default\/T/);

    test.done();
  },

  'fails if batch size < 1'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const table = new dynamodb.Table(stack, 'T', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    // WHEN
    test.throws(() => fn.addEventSource(new sources.DynamoEventSource(table, {
      batchSize: 0,
      startingPosition: lambda.StartingPosition.LATEST,
    })), /Maximum batch size must be between 1 and 1000 inclusive \(given 0\)/);

    test.done();
  },

  'fails if batch size > 1000'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const table = new dynamodb.Table(stack, 'T', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    // WHEN
    test.throws(() => fn.addEventSource(new sources.DynamoEventSource(table, {
      batchSize: 1001,
      startingPosition: lambda.StartingPosition.LATEST,
    })), /Maximum batch size must be between 1 and 1000 inclusive \(given 1001\)/);

    test.done();
  },

  'specific maxBatchingWindow'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const table = new dynamodb.Table(stack, 'T', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    // WHEN
    fn.addEventSource(new sources.DynamoEventSource(table, {
      maxBatchingWindow: cdk.Duration.minutes(2),
      startingPosition: lambda.StartingPosition.LATEST,
    }));

    // THEN
    expect(stack).to(haveResource('AWS::Lambda::EventSourceMapping', {
      'EventSourceArn': {
        'Fn::GetAtt': [
          'TD925BC7E',
          'StreamArn',
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

  'throws if maxBatchingWindow > 300 seconds'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const table = new dynamodb.Table(stack, 'T', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    // THEN
    test.throws(() =>
      fn.addEventSource(new sources.DynamoEventSource(table, {
        maxBatchingWindow: cdk.Duration.seconds(301),
        startingPosition: lambda.StartingPosition.LATEST,
      })), /maxBatchingWindow cannot be over 300 seconds/);

    test.done();
  },

  'contains eventSourceMappingId after lambda binding'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const table = new dynamodb.Table(stack, 'T', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });
    const eventSource = new sources.DynamoEventSource(table, {
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
    const table = new dynamodb.Table(stack, 'T', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });
    const eventSource = new sources.DynamoEventSource(table, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
    });

    // WHEN/THEN
    test.throws(() => eventSource.eventSourceMappingId, /DynamoEventSource is not yet bound to an event source mapping/);
    test.done();
  },

  'specific retryAttempts'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const table = new dynamodb.Table(stack, 'T', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    // WHEN
    fn.addEventSource(new sources.DynamoEventSource(table, {
      retryAttempts: 10,
      startingPosition: lambda.StartingPosition.LATEST,
    }));

    // THEN
    expect(stack).to(haveResource('AWS::Lambda::EventSourceMapping', {
      'EventSourceArn': {
        'Fn::GetAtt': [
          'TD925BC7E',
          'StreamArn',
        ],
      },
      'FunctionName': {
        'Ref': 'Fn9270CBC0',
      },
      'MaximumRetryAttempts': 10,
      'StartingPosition': 'LATEST',
    }));

    test.done();
  },

  'fails if retryAttempts < 0'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const table = new dynamodb.Table(stack, 'T', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    // THEN
    test.throws(() =>
      fn.addEventSource(new sources.DynamoEventSource(table, {
        retryAttempts: -1,
        startingPosition: lambda.StartingPosition.LATEST,
      })), /retryAttempts must be between 0 and 10000 inclusive, got -1/);

    test.done();
  },

  'fails if retryAttempts > 10000'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const table = new dynamodb.Table(stack, 'T', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    // THEN
    test.throws(() =>
      fn.addEventSource(new sources.DynamoEventSource(table, {
        retryAttempts: 10001,
        startingPosition: lambda.StartingPosition.LATEST,
      })), /retryAttempts must be between 0 and 10000 inclusive, got 10001/);

    test.done();
  },

  'specific bisectBatchOnFunctionError'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const table = new dynamodb.Table(stack, 'T', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    // WHEN
    fn.addEventSource(new sources.DynamoEventSource(table, {
      bisectBatchOnError: true,
      startingPosition: lambda.StartingPosition.LATEST,
    }));

    // THEN
    expect(stack).to(haveResource('AWS::Lambda::EventSourceMapping', {
      'EventSourceArn': {
        'Fn::GetAtt': [
          'TD925BC7E',
          'StreamArn',
        ],
      },
      'FunctionName': {
        'Ref': 'Fn9270CBC0',
      },
      'BisectBatchOnFunctionError': true,
      'StartingPosition': 'LATEST',
    }));

    test.done();
  },

  'specific parallelizationFactor'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const table = new dynamodb.Table(stack, 'T', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    // WHEN
    fn.addEventSource(new sources.DynamoEventSource(table, {
      parallelizationFactor: 5,
      startingPosition: lambda.StartingPosition.LATEST,
    }));

    // THEN
    expect(stack).to(haveResource('AWS::Lambda::EventSourceMapping', {
      'EventSourceArn': {
        'Fn::GetAtt': [
          'TD925BC7E',
          'StreamArn',
        ],
      },
      'FunctionName': {
        'Ref': 'Fn9270CBC0',
      },
      'ParallelizationFactor': 5,
      'StartingPosition': 'LATEST',
    }));

    test.done();
  },

  'fails if parallelizationFactor < 1'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const table = new dynamodb.Table(stack, 'T', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    // THEN
    test.throws(() =>
      fn.addEventSource(new sources.DynamoEventSource(table, {
        parallelizationFactor: 0,
        startingPosition: lambda.StartingPosition.LATEST,
      })), /parallelizationFactor must be between 1 and 10 inclusive, got 0/);

    test.done();
  },

  'fails if parallelizationFactor > 10'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const table = new dynamodb.Table(stack, 'T', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    // THEN
    test.throws(() =>
      fn.addEventSource(new sources.DynamoEventSource(table, {
        parallelizationFactor: 11,
        startingPosition: lambda.StartingPosition.LATEST,
      })), /parallelizationFactor must be between 1 and 10 inclusive, got 11/);

    test.done();
  },

  'specific maxRecordAge'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const table = new dynamodb.Table(stack, 'T', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    // WHEN
    fn.addEventSource(new sources.DynamoEventSource(table, {
      maxRecordAge: cdk.Duration.seconds(100),
      startingPosition: lambda.StartingPosition.LATEST,
    }));

    // THEN
    expect(stack).to(haveResource('AWS::Lambda::EventSourceMapping', {
      'EventSourceArn': {
        'Fn::GetAtt': [
          'TD925BC7E',
          'StreamArn',
        ],
      },
      'FunctionName': {
        'Ref': 'Fn9270CBC0',
      },
      'MaximumRecordAgeInSeconds': 100,
      'StartingPosition': 'LATEST',
    }));

    test.done();
  },

  'fails if maxRecordAge < 60 seconds'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const table = new dynamodb.Table(stack, 'T', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    // THEN
    test.throws(() =>
      fn.addEventSource(new sources.DynamoEventSource(table, {
        maxRecordAge: cdk.Duration.seconds(59),
        startingPosition: lambda.StartingPosition.LATEST,
      })), /maxRecordAge must be between 60 seconds and 7 days inclusive/);

    test.done();
  },

  'fails if maxRecordAge > 7 days'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const table = new dynamodb.Table(stack, 'T', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    // THEN
    test.throws(() =>
      fn.addEventSource(new sources.DynamoEventSource(table, {
        maxRecordAge: cdk.Duration.seconds(604801),
        startingPosition: lambda.StartingPosition.LATEST,
      })), /maxRecordAge must be between 60 seconds and 7 days inclusive/);

    test.done();
  },

  'specific destinationConfig'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const queue = new sqs.Queue(stack, 'Queue');
    const table = new dynamodb.Table(stack, 'T', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    // WHEN
    fn.addEventSource(new sources.DynamoEventSource(table, {
      onFailure: new sources.SqsDlq(queue),
      startingPosition: lambda.StartingPosition.LATEST,
    }));

    // THEN
    expect(stack).to(haveResource('AWS::Lambda::EventSourceMapping', {
      'EventSourceArn': {
        'Fn::GetAtt': [
          'TD925BC7E',
          'StreamArn',
        ],
      },
      'FunctionName': {
        'Ref': 'Fn9270CBC0',
      },
      'DestinationConfig': {
        'OnFailure': {
          'Destination': {
            'Fn::GetAtt': [
              'Queue4A7E3555',
              'Arn',
            ],
          },

        },
      },
      'StartingPosition': 'LATEST',
    }));

    test.done();
  },

  'event source disabled'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const table = new dynamodb.Table(stack, 'T', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    // WHEN
    fn.addEventSource(new sources.DynamoEventSource(table, {
      startingPosition: lambda.StartingPosition.LATEST,
      enabled: false,
    }));

    //THEN
    expect(stack).to(haveResource('AWS::Lambda::EventSourceMapping', {
      'Enabled': false,
    }));

    test.done();
  },
};
