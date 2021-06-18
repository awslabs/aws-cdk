import * as sns from '@aws-cdk/aws-sns';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { SnsPublish } from '../../lib/sns/publish';

describe('Publish', () => {
  test('default settings', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const topic = new sns.Topic(stack, 'Topic');

    // WHEN
    const task = new SnsPublish(stack, 'Publish', {
      topic,
      message: sfn.TaskInput.fromText('Publish this message'),
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
            ':states:::sns:publish',
          ],
        ],
      },
      End: true,
      Parameters: {
        TopicArn: { Ref: 'TopicBFC7AF6E' },
        Message: 'Publish this message',
      },
    });
  });

  test('publish SNS message and wait for task token', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const topic = new sns.Topic(stack, 'Topic');

    // WHEN
    const task = new SnsPublish(stack, 'Publish', {
      topic,
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      message: sfn.TaskInput.fromObject({
        Input: 'Publish this message',
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
            ':states:::sns:publish.waitForTaskToken',
          ],
        ],
      },
      End: true,
      Parameters: {
        TopicArn: { Ref: 'TopicBFC7AF6E' },
        Message: {
          'Input': 'Publish this message',
          'Token.$': '$$.Task.Token',
        },
      },
    });
  });

  test('publish different message per subscription type', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const topic = new sns.Topic(stack, 'Topic');

    // WHEN
    const task = new SnsPublish(stack, 'Publish', {
      topic,
      integrationPattern: sfn.IntegrationPattern.REQUEST_RESPONSE,
      message: sfn.TaskInput.fromObject({
        default: 'A message',
        sqs: 'A message for Amazon SQS',
        email: 'A message for email',
      }),
      messagePerSubscriptionType: true,
    });

    // THEN
    expect(stack.resolve(task.toStateJson())).toEqual({
      End: true,
      Type: 'Task',
      Resource: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':states:::sns:publish',
          ],
        ],
      },
      Parameters: {
        TopicArn: { Ref: 'TopicBFC7AF6E' },
        Message: {
          default: 'A message',
          sqs: 'A message for Amazon SQS',
          email: 'A message for email',
        },
        MessageStructure: 'json',
      },
    });
  });

  test('topic ARN supplied through the task input', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const topic = sns.Topic.fromTopicArn(stack, 'Topic', sfn.JsonPath.stringAt('$.topicArn'));

    // WHEN
    const task = new SnsPublish(stack, 'Publish', {
      topic,
      message: sfn.TaskInput.fromText('Publish this message'),
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
            ':states:::sns:publish',
          ],
        ],
      },
      End: true,
      Parameters: {
        'TopicArn.$': '$.topicArn',
        'Message': 'Publish this message',
      },
    });
  });

  test('fails when WAIT_FOR_TASK_TOKEN integration pattern is used without supplying a task token in message', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const topic = new sns.Topic(stack, 'Topic');

    expect(() => {
      // WHEN
      new SnsPublish(stack, 'Publish', {
        topic,
        integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
        message: sfn.TaskInput.fromText('Publish this message'),
      });
      // THEN
    }).toThrow(/Task Token is required in `message` Use JsonPath.taskToken to set the token./);
  });

  test('fails when RUN_JOB integration pattern is used', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const topic = new sns.Topic(stack, 'Topic');

    expect(() => {
      new SnsPublish(stack, 'Publish', {
        topic,
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
        message: sfn.TaskInput.fromText('Publish this message'),
      });
    }).toThrow(/Unsupported service integration pattern. Supported Patterns: REQUEST_RESPONSE,WAIT_FOR_TASK_TOKEN. Received: RUN_JOB/);
  });
});