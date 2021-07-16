import { TemplateAssertions } from '@aws-cdk/assertions';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as lambda from '@aws-cdk/aws-lambda';
import * as sqs from '@aws-cdk/aws-sqs';
import * as cdk from '@aws-cdk/core';
import * as sources from '../lib';
import { TestFunction } from './test-function';

/* eslint-disable quote-props */

describe('DynamoEventSource', () => {
  test('sufficiently complex example', () => {
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
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
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
    });

    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Lambda::EventSourceMapping', {
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
    });


  });

  test('specific tumblingWindow', () => {
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
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      TumblingWindowInSeconds: 60,
    });


  });

  test('specific batch size', () => {
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
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Lambda::EventSourceMapping', {
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
    });


  });

  test('fails if streaming not enabled on table', () => {
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
    expect(() => fn.addEventSource(new sources.DynamoEventSource(table, {
      batchSize: 50,
      startingPosition: lambda.StartingPosition.LATEST,
    }))).toThrow(/DynamoDB Streams must be enabled on the table Default\/T/);


  });

  test('fails if batch size < 1', () => {
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
    expect(() => fn.addEventSource(new sources.DynamoEventSource(table, {
      batchSize: 0,
      startingPosition: lambda.StartingPosition.LATEST,
    }))).toThrow(/Maximum batch size must be between 1 and 1000 inclusive \(given 0\)/);


  });

  test('fails if batch size > 1000', () => {
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
    expect(() => fn.addEventSource(new sources.DynamoEventSource(table, {
      batchSize: 1001,
      startingPosition: lambda.StartingPosition.LATEST,
    }))).toThrow(/Maximum batch size must be between 1 and 1000 inclusive \(given 1001\)/);


  });

  test('specific maxBatchingWindow', () => {
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
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Lambda::EventSourceMapping', {
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
    });


  });

  test('throws if maxBatchingWindow > 300 seconds', () => {
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
    expect(() =>
      fn.addEventSource(new sources.DynamoEventSource(table, {
        maxBatchingWindow: cdk.Duration.seconds(301),
        startingPosition: lambda.StartingPosition.LATEST,
      }))).toThrow(/maxBatchingWindow cannot be over 300 seconds/);


  });

  test('contains eventSourceMappingId after lambda binding', () => {
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
    expect(eventSource.eventSourceMappingId).toBeDefined();

  });

  test('eventSourceMappingId throws error before binding to lambda', () => {
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
    expect(() => eventSource.eventSourceMappingId).toThrow(/DynamoEventSource is not yet bound to an event source mapping/);

  });

  test('specific retryAttempts', () => {
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
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Lambda::EventSourceMapping', {
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
    });


  });

  test('fails if retryAttempts < 0', () => {
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
    expect(() =>
      fn.addEventSource(new sources.DynamoEventSource(table, {
        retryAttempts: -1,
        startingPosition: lambda.StartingPosition.LATEST,
      }))).toThrow(/retryAttempts must be between 0 and 10000 inclusive, got -1/);


  });

  test('fails if retryAttempts > 10000', () => {
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
    expect(() =>
      fn.addEventSource(new sources.DynamoEventSource(table, {
        retryAttempts: 10001,
        startingPosition: lambda.StartingPosition.LATEST,
      }))).toThrow(/retryAttempts must be between 0 and 10000 inclusive, got 10001/);


  });

  test('specific bisectBatchOnFunctionError', () => {
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
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Lambda::EventSourceMapping', {
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
    });


  });

  test('specific parallelizationFactor', () => {
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
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Lambda::EventSourceMapping', {
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
    });


  });

  test('fails if parallelizationFactor < 1', () => {
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
    expect(() =>
      fn.addEventSource(new sources.DynamoEventSource(table, {
        parallelizationFactor: 0,
        startingPosition: lambda.StartingPosition.LATEST,
      }))).toThrow(/parallelizationFactor must be between 1 and 10 inclusive, got 0/);


  });

  test('fails if parallelizationFactor > 10', () => {
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
    expect(() =>
      fn.addEventSource(new sources.DynamoEventSource(table, {
        parallelizationFactor: 11,
        startingPosition: lambda.StartingPosition.LATEST,
      }))).toThrow(/parallelizationFactor must be between 1 and 10 inclusive, got 11/);


  });

  test('specific maxRecordAge', () => {
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
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Lambda::EventSourceMapping', {
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
    });


  });

  test('fails if maxRecordAge < 60 seconds', () => {
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
    expect(() =>
      fn.addEventSource(new sources.DynamoEventSource(table, {
        maxRecordAge: cdk.Duration.seconds(59),
        startingPosition: lambda.StartingPosition.LATEST,
      }))).toThrow(/maxRecordAge must be between 60 seconds and 7 days inclusive/);


  });

  test('fails if maxRecordAge > 7 days', () => {
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
    expect(() =>
      fn.addEventSource(new sources.DynamoEventSource(table, {
        maxRecordAge: cdk.Duration.seconds(604801),
        startingPosition: lambda.StartingPosition.LATEST,
      }))).toThrow(/maxRecordAge must be between 60 seconds and 7 days inclusive/);


  });

  test('specific destinationConfig', () => {
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
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Lambda::EventSourceMapping', {
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
    });


  });

  test('specific functionResponseTypes', () => {
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
      reportBatchItemFailures: true,
    }));

    // THEN
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      'EventSourceArn': {
        'Fn::GetAtt': [
          'TD925BC7E',
          'StreamArn',
        ],
      },
      'FunctionName': {
        'Ref': 'Fn9270CBC0',
      },
      'StartingPosition': 'LATEST',
      'FunctionResponseTypes': ['ReportBatchItemFailures'],
    });


  });

  test('event source disabled', () => {
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
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      'Enabled': false,
    });


  });
});
