import '@aws-cdk/assert-internal/jest';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import * as tasks from '../../lib';

let stack: cdk.Stack;

beforeEach(() => {
  // GIVEN
  stack = new cdk.Stack();
});

test('Cancel a Step with static ClusterId and StepId', () => {
  // WHEN
  const task = new tasks.EmrCancelStep(stack, 'Task', {
    clusterId: 'ClusterId',
    stepId: 'StepId',
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
          ':states:::elasticmapreduce:cancelStep',
        ],
      ],
    },
    End: true,
    Parameters: {
      ClusterId: 'ClusterId',
      StepId: 'StepId',
    },
  });
});

test('task policies are generated', () => {
  // WHEN
  const task = new tasks.EmrCancelStep(stack, 'Task', {
    clusterId: 'ClusterId',
    stepId: 'StepId',
  });
  new sfn.StateMachine(stack, 'SM', {
    definition: task,
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: [
        {
          Action: 'elasticmapreduce:CancelSteps',
          Effect: 'Allow',
          Resource: {
            'Fn::Join': [
              '',
              [
                'arn:',
                {
                  Ref: 'AWS::Partition',
                },
                ':elasticmapreduce:',
                {
                  Ref: 'AWS::Region',
                },
                ':',
                {
                  Ref: 'AWS::AccountId',
                },
                ':cluster/*',
              ],
            ],
          },
        },
      ],
    },
  });
});

test('Cancel a Step with static ClusterId and StepId from payload', () => {
  // WHEN
  const task = new tasks.EmrCancelStep(stack, 'Task', {
    clusterId: 'ClusterId',
    stepId: sfn.TaskInput.fromJsonPathAt('$.StepId').value,
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
          ':states:::elasticmapreduce:cancelStep',
        ],
      ],
    },
    End: true,
    Parameters: {
      'ClusterId': 'ClusterId',
      'StepId.$': '$.StepId',
    },
  });
});

test('Cancel a Step with ClusterId from payload and static StepId', () => {
  // WHEN
  const task = new tasks.EmrCancelStep(stack, 'Task', {
    clusterId: sfn.TaskInput.fromJsonPathAt('$.ClusterId').value,
    stepId: 'StepId',
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
          ':states:::elasticmapreduce:cancelStep',
        ],
      ],
    },
    End: true,
    Parameters: {
      'ClusterId.$': '$.ClusterId',
      'StepId': 'StepId',
    },
  });
});
