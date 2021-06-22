import * as sqs from '@aws-cdk/aws-sqs';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import * as tasks from '../../lib';

let stack: cdk.Stack;
let queue: sqs.Queue;

beforeEach(() => {
  // GIVEN
  stack = new cdk.Stack();
  queue = new sqs.Queue(stack, 'Queue');
});

test('Send message to queue', () => {
  // WHEN
  const task = new sfn.Task(stack, 'Send', {
    task: new tasks.SendToQueue(queue, {
      messageBody: sfn.TaskInput.fromText('Send this message'),
      messageDeduplicationId: sfn.JsonPath.stringAt('$.deduping'),
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
      'QueueUrl': { Ref: 'Queue4A7E3555' },
      'MessageBody': 'Send this message',
      'MessageDeduplicationId.$': '$.deduping',
    },
  });
});

test('Send message to SQS queue with task token', () => {
  // WHEN
  const task = new sfn.Task(stack, 'Send', {
    task: new tasks.SendToQueue(queue, {
      integrationPattern: sfn.ServiceIntegrationPattern.WAIT_FOR_TASK_TOKEN,
      messageBody: sfn.TaskInput.fromObject({
        Input: 'Send this message',
        Token: sfn.JsonPath.taskToken,
      }),
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

test('Task throws if WAIT_FOR_TASK_TOKEN is supplied but task token is not included in messageBody', () => {
  expect(() => {
    // WHEN
    new sfn.Task(stack, 'Send', {
      task: new tasks.SendToQueue(queue, {
        integrationPattern: sfn.ServiceIntegrationPattern.WAIT_FOR_TASK_TOKEN,
        messageBody: sfn.TaskInput.fromText('Send this message'),
      }),
    });
    // THEN
  }).toThrow(/Task Token is missing in messageBody/i);
});

test('Message body can come from state', () => {
  // WHEN
  const task = new sfn.Task(stack, 'Send', {
    task: new tasks.SendToQueue(queue, {
      messageBody: sfn.TaskInput.fromJsonPathAt('$.theMessage'),
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
      'QueueUrl': { Ref: 'Queue4A7E3555' },
      'MessageBody.$': '$.theMessage',
    },
  });
});

test('Message body can be an object', () => {
  // WHEN
  const task = new sfn.Task(stack, 'Send', {
    task: new tasks.SendToQueue(queue, {
      messageBody: sfn.TaskInput.fromObject({
        literal: 'literal',
        SomeInput: sfn.JsonPath.stringAt('$.theMessage'),
      }),
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

test('Message body object can contain references', () => {
  // WHEN
  const task = new sfn.Task(stack, 'Send', {
    task: new tasks.SendToQueue(queue, {
      messageBody: sfn.TaskInput.fromObject({
        queueArn: queue.queueArn,
      }),
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

test('Task throws if SYNC is supplied as service integration pattern', () => {
  expect(() => {
    new sfn.Task(stack, 'Send', {
      task: new tasks.SendToQueue(queue, {
        integrationPattern: sfn.ServiceIntegrationPattern.SYNC,
        messageBody: sfn.TaskInput.fromText('Send this message'),
      }),
    });
  }).toThrow(/Invalid Service Integration Pattern: SYNC is not supported to call SQS./i);
});
