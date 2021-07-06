import '@aws-cdk/assert-internal/jest';
import * as events from '@aws-cdk/aws-events';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { EventBridgePutEvents } from '../../lib/eventbridge/put-events';

describe('Put Events', () => {
  let stack: cdk.Stack;

  beforeEach(() => {
    // GIVEN
    stack = new cdk.Stack();
  });

  test('provided all parameters', () => {
    // WHEN
    const task = new EventBridgePutEvents(stack, 'PutEvents', {
      entries: [{
        detail: sfn.TaskInput.fromText('MyDetail'),
        detailType: 'MyDetailType',
        source: 'my.source',
      }],
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
            ':states:::events:putEvents',
          ],
        ],
      },
      End: true,
      Parameters: {
        Entries: [{
          Detail: 'MyDetail',
          DetailType: 'MyDetailType',
          Source: 'my.source',
        }],
      },
    });
  });

  test('provided detail as object', () => {
    // WHEN
    const task = new EventBridgePutEvents(stack, 'PutEvents', {
      entries: [{
        detail: sfn.TaskInput.fromObject({
          Message: 'MyDetailMessage',
        }),
        detailType: 'MyDetailType',
        source: 'my.source',
      }],
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
            ':states:::events:putEvents',
          ],
        ],
      },
      End: true,
      Parameters: {
        Entries: [{
          Detail: {
            Message: 'MyDetailMessage',
          },
          DetailType: 'MyDetailType',
          Source: 'my.source',
        }],
      },
    });
  });

  test('wait for task token', () => {
    // WHEN
    const task = new EventBridgePutEvents(stack, 'PutEvents', {
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      entries: [{
        detail: sfn.TaskInput.fromObject({
          Message: 'MyDetailMessage',
          Token: sfn.JsonPath.taskToken,
        }),
        detailType: 'MyDetailType',
        source: 'my.source',
      }],
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
            ':states:::events:putEvents.waitForTaskToken',
          ],
        ],
      },
      End: true,
      Parameters: {
        Entries: [{
          Detail: {
            'Message': 'MyDetailMessage',
            'Token.$': '$$.Task.Token',
          },
          DetailType: 'MyDetailType',
          Source: 'my.source',
        }],
      },
    });
  });

  test('fails when WAIT_FOR_TASK_TOKEN integration pattern is used without supplying a task token in entries', () => {
    expect(() => {
      // WHEN
      new EventBridgePutEvents(stack, 'PutEvents', {
        integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
        entries: [{
          detail: sfn.TaskInput.fromText('MyDetail'),
          detailType: 'MyDetailType',
          source: 'my.source',
        }],
      });
    // THEN
    }).toThrowError('Task Token is required in `entries`. Use JsonPath.taskToken to set the token.');
  });

  test('fails when RUN_JOB integration pattern is used', () => {
    expect(() => {
      // WHEN
      new EventBridgePutEvents(stack, 'PutEvents', {
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
        entries: [{
          detail: sfn.TaskInput.fromText('MyDetail'),
          detailType: 'MyDetailType',
          source: 'my.source',
        }],
      });
    // THEN
    }).toThrowError('Unsupported service integration pattern');
  });

  test('provided EventBus', () => {
    // GIVEN
    const eventBus = new events.EventBus(stack, 'EventBus');

    // WHEN
    const task = new EventBridgePutEvents(stack, 'PutEvents', {
      entries: [{
        eventBus,
        detail: sfn.TaskInput.fromText('MyDetail'),
        detailType: 'MyDetailType',
        source: 'my.source',
      }],
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
            ':states:::events:putEvents',
          ],
        ],
      },
      End: true,
      Parameters: {
        Entries: [{
          EventBusName: {
            'Fn::GetAtt': [
              'EventBus7B8748AA',
              'Arn',
            ],
          },
          Detail: 'MyDetail',
          DetailType: 'MyDetailType',
          Source: 'my.source',
        }],
      },
    });
  });

  test('fails when provided an empty array for entries', () => {
    expect(() => {
      // WHEN
      new EventBridgePutEvents(stack, 'PutEvents', {
        entries: [],
      });
    })
      // THEN
      .toThrowError('Value for property `entries` must be a non-empty array.');
  });

  test('Validate task policy', () => {
    // GIVEN
    const bus = new events.EventBus(stack, 'EventBus');

    // WHEN
    const task = new EventBridgePutEvents(stack, 'PutEvents', {
      entries: [{
        detail: sfn.TaskInput.fromText('MyDetail'),
        detailType: 'MyDetailType',
        source: 'my.source',
        eventBus: bus,
      }, {
        detail: sfn.TaskInput.fromText('MyDetail2'),
        detailType: 'MyDetailType',
        source: 'my.source',
      }],
    });
    new sfn.StateMachine(stack, 'State Machine', { definition: task });

    // THEN
    expect(stack).toHaveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'events:PutEvents',
            Effect: 'Allow',
            Resource: [
              {
                'Fn::GetAtt': [
                  'EventBus7B8748AA',
                  'Arn',
                ],
              },
              {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    { Ref: 'AWS::Partition' },
                    ':events:',
                    { Ref: 'AWS::Region' },
                    ':',
                    { Ref: 'AWS::AccountId' },
                    ':event-bus/default',
                  ],
                ],
              },
            ],
          },
        ],
        Version: '2012-10-17',
      },
      Roles: [
        {
          Ref: 'StateMachineRole543B9670',
        },
      ],
    });
  });
});
