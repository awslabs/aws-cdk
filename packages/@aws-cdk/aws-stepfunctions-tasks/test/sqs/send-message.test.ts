import * as sqs from '@aws-cdk/aws-sqs';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { SqsSendMessage } from '../../lib/sqs/send-message';

describe('SqsSendMessage', () => {
  let stack: cdk.Stack;
  let queue: sqs.Queue;

  beforeEach(() => {
    // GIVEN
    stack = new cdk.Stack();
    queue = new sqs.Queue(stack, 'Queue');
  });

  test('default settings', () => {
    // WHEN
    const task = new SqsSendMessage(stack, 'SendMessage', {
      queue,
      messageBody: sfn.TaskInput.fromText('a simple message'),
    });

    // THEN
    expect(stack.resolve(task.toStateJson())).toEqual({
      Type: 'Task',
      Resource: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':states:::sqs:sendMessage',
          ],
        ],
      },
      End: true,
      Parameters: {
        QueueUrl: { Ref: 'Queue4A7E3555' },
        MessageBody: 'a simple message',
      },
    });
  });

  test('send message with deduplication and delay', () => {
    // WHEN
    const task = new SqsSendMessage(stack, 'Send', {
      queue,
      messageBody: sfn.TaskInput.fromText('Send this message'),
      messageDeduplicationId: sfn.JsonPath.stringAt('$.deduping'),
      comment: 'sending a message to my SQS queue',
      delay: cdk.Duration.seconds(30),
    });

    // THEN
    expect(stack.resolve(task.toStateJson())).toEqual({
      Type: 'Task',
      Resource: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':states:::sqs:sendMessage',
          ],
        ],
      },
      End: true,
      Parameters: {
        'QueueUrl': { Ref: 'Queue4A7E3555' },
        'MessageBody': 'Send this message',
        'MessageDeduplicationId.$': '$.deduping',
        'DelaySeconds': 30,
      },
      Comment: 'sending a message to my SQS queue',
    });
  });

  test('send message to SQS and wait for task token', () => {
    // WHEN
    const task = new SqsSendMessage(stack, 'Send', {
      queue,
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      messageBody: sfn.TaskInput.fromObject({
        Input: 'Send this message',
        Token: sfn.JsonPath.taskToken,
      }),
    });

    // THEN
    expect(stack.resolve(task.toStateJson())).toEqual({
      Type: 'Task',
      Resource: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':states:::sqs:sendMessage.waitForTaskToken',
          ],
        ],
      },
      End: true,
      Parameters: {
        QueueUrl: { Ref: 'Queue4A7E3555' },
        MessageBody: {
          'Input': 'Send this message',
          'Token.$': '$$.Task.Token',
        },
      },
    });
  });

  test('Message body can come from state', () => {
    // WHEN
    const task = new SqsSendMessage(stack, 'Send', {
      queue,
      messageBody: sfn.TaskInput.fromJsonPathAt('$.theMessage'),
    });

    // THEN
    expect(stack.resolve(task.toStateJson())).toEqual({
      Type: 'Task',
      Resource: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':states:::sqs:sendMessage',
          ],
        ],
      },
      End: true,
      Parameters: {
        'QueueUrl': { Ref: 'Queue4A7E3555' },
        'MessageBody.$': '$.theMessage',
      },
    });
  });

  test('send message with message body defined as an object', () => {
    // WHEN
    const task = new SqsSendMessage(stack, 'Send', {
      queue,
      messageBody: sfn.TaskInput.fromObject({
        literal: 'literal',
        SomeInput: sfn.JsonPath.stringAt('$.theMessage'),
      }),
    });

    // THEN
    expect(stack.resolve(task.toStateJson())).toEqual({
      Type: 'Task',
      Resource: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':states:::sqs:sendMessage',
          ],
        ],
      },
      End: true,
      Parameters: {
        QueueUrl: { Ref: 'Queue4A7E3555' },
        MessageBody: {
          'literal': 'literal',
          'SomeInput.$': '$.theMessage',
        },
      },
    });
  });

  test('message body can use references', () => {
    // WHEN
    const task = new SqsSendMessage(stack, 'Send', {
      queue,
      messageBody: sfn.TaskInput.fromObject({
        queueArn: queue.queueArn,
      }),
    });

    // THEN
    expect(stack.resolve(task.toStateJson())).toEqual({
      Type: 'Task',
      Resource: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':states:::sqs:sendMessage',
          ],
        ],
      },
      End: true,
      Parameters: {
        QueueUrl: { Ref: 'Queue4A7E3555' },
        MessageBody: {
          queueArn: { 'Fn::GetAtt': ['Queue4A7E3555', 'Arn'] },
        },
      },
    });
  });

  test('fails when WAIT_FOR_TASK_TOKEN integration pattern is used without supplying a task token in message body', () => {
    expect(() => {
      new SqsSendMessage(stack, 'Send', {
        queue,
        integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
        messageBody: sfn.TaskInput.fromText('Send this message'),
      });
    }).toThrow(/Task Token is required in `messageBody` Use JsonPath.taskToken to set the token./);
  });

  test('fails when RUN_JOB integration pattern is used', () => {
    expect(() => {
      new SqsSendMessage(stack, 'Send', {
        queue,
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
        messageBody: sfn.TaskInput.fromText('Send this message'),
      });
    }).toThrow(/Unsupported service integration pattern. Supported Patterns: REQUEST_RESPONSE,WAIT_FOR_TASK_TOKEN. Received: RUN_JOB/);
  });

});
