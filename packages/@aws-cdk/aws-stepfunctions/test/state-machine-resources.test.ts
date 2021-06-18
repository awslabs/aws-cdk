import { arrayWith, objectLike, ResourcePart } from '@aws-cdk/assert-internal';
import '@aws-cdk/assert-internal/jest';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import * as stepfunctions from '../lib';

describe('State Machine Resources', () => {
  test('Tasks can add permissions to the execution role', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const task = new stepfunctions.Task(stack, 'Task', {
      task: {
        bind: () => ({
          resourceArn: 'resource',
          policyStatements: [new iam.PolicyStatement({
            actions: ['resource:Everything'],
            resources: ['resource'],
          })],
        }),
      },
    });

    // WHEN
    new stepfunctions.StateMachine(stack, 'SM', {
      definition: task,
    });

    // THEN
    expect(stack).toHaveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'resource:Everything',
            Effect: 'Allow',
            Resource: 'resource',
          },
        ],
      },
    });
  }),

  test('Tasks hidden inside a Parallel state are also included', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const task = new stepfunctions.Task(stack, 'Task', {
      task: {
        bind: () => ({
          resourceArn: 'resource',
          policyStatements: [
            new iam.PolicyStatement({
              actions: ['resource:Everything'],
              resources: ['resource'],
            }),
          ],
        }),
      },
    });

    const para = new stepfunctions.Parallel(stack, 'Para');
    para.branch(task);

    // WHEN
    new stepfunctions.StateMachine(stack, 'SM', {
      definition: para,
    });

    // THEN
    expect(stack).toHaveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'resource:Everything',
            Effect: 'Allow',
            Resource: 'resource',
          },
        ],
      },
    });
  }),

  test('Task should render InputPath / Parameters / OutputPath correctly', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const task = new stepfunctions.Task(stack, 'Task', {
      inputPath: '$',
      outputPath: '$.state',
      task: {
        bind: () => ({
          resourceArn: 'resource',
          parameters: {
            'input.$': '$',
            'stringArgument': 'inital-task',
            'numberArgument': 123,
            'booleanArgument': true,
            'arrayArgument': ['a', 'b', 'c'],
          },
        }),
      },
    });

    // WHEN
    const taskState = task.toStateJson();

    // THEN
    expect(taskState).toStrictEqual({
      End: true,
      Retry: undefined,
      Catch: undefined,
      InputPath: '$',
      Parameters:
             {
               'input.$': '$',
               'stringArgument': 'inital-task',
               'numberArgument': 123,
               'booleanArgument': true,
               'arrayArgument': ['a', 'b', 'c'],
             },
      OutputPath: '$.state',
      Type: 'Task',
      Comment: undefined,
      Resource: 'resource',
      ResultPath: undefined,
      TimeoutSeconds: undefined,
      HeartbeatSeconds: undefined,
    });
  }),

  test('Task combines taskobject parameters with direct parameters', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const task = new stepfunctions.Task(stack, 'Task', {
      inputPath: '$',
      outputPath: '$.state',
      task: {
        bind: () => ({
          resourceArn: 'resource',
          parameters: {
            a: 'aa',
          },
        }),
      },
      parameters: {
        b: 'bb',
      },
    });

    // WHEN
    const taskState = task.toStateJson();

    // THEN
    expect(taskState).toStrictEqual({
      End: true,
      Retry: undefined,
      Catch: undefined,
      InputPath: '$',
      Parameters:
             {
               a: 'aa',
               b: 'bb',
             },
      OutputPath: '$.state',
      Type: 'Task',
      Comment: undefined,
      Resource: 'resource',
      ResultPath: undefined,
      TimeoutSeconds: undefined,
      HeartbeatSeconds: undefined,
    });
  }),

  test('Created state machine can grant start execution to a role', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const task = new stepfunctions.Task(stack, 'Task', {
      task: {
        bind: () => ({ resourceArn: 'resource' }),
      },
    });
    const stateMachine = new stepfunctions.StateMachine(stack, 'StateMachine', {
      definition: task,
    });
    const role = new iam.Role(stack, 'Role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    // WHEN
    stateMachine.grantStartExecution(role);

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: arrayWith(objectLike({
          Action: 'states:StartExecution',
          Effect: 'Allow',
          Resource: {
            Ref: 'StateMachine2E01A3A5',
          },
        })),
      },
    });
  }),

  test('Created state machine can grant read access to a role', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const task = new stepfunctions.Task(stack, 'Task', {
      task: {
        bind: () => ({ resourceArn: 'resource' }),
      },
    });
    const stateMachine = new stepfunctions.StateMachine(stack, 'StateMachine', {
      definition: task,
    });
    const role = new iam.Role(stack, 'Role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    // WHEN
    stateMachine.grantRead(role);

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: [
              'states:ListExecutions',
              'states:ListStateMachines',
            ],
            Effect: 'Allow',
            Resource: {
              Ref: 'StateMachine2E01A3A5',
            },
          },
          {
            Action: [
              'states:DescribeExecution',
              'states:DescribeStateMachineForExecution',
              'states:GetExecutionHistory',
            ],
            Effect: 'Allow',
            Resource: {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  {
                    Ref: 'AWS::Partition',
                  },
                  ':states:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':execution:',
                  {
                    'Fn::Select': [
                      6,
                      {
                        'Fn::Split': [
                          ':',
                          {
                            Ref: 'StateMachine2E01A3A5',
                          },
                        ],
                      },
                    ],
                  },
                  ':*',
                ],
              ],
            },
          },
          {
            Action: [
              'states:ListActivities',
              'states:DescribeStateMachine',
              'states:DescribeActivity',
            ],
            Effect: 'Allow',
            Resource: '*',
          },
        ],
      },
    },
    );
  }),

  test('Created state machine can grant task response actions to the state machine', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const task = new stepfunctions.Task(stack, 'Task', {
      task: {
        bind: () => ({ resourceArn: 'resource' }),
      },
    });
    const stateMachine = new stepfunctions.StateMachine(stack, 'StateMachine', {
      definition: task,
    });
    const role = new iam.Role(stack, 'Role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    // WHEN
    stateMachine.grantTaskResponse(role);

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: [
              'states:SendTaskSuccess',
              'states:SendTaskFailure',
              'states:SendTaskHeartbeat',
            ],
            Effect: 'Allow',
            Resource: {
              Ref: 'StateMachine2E01A3A5',
            },
          },
        ],
      },
    });
  }),

  test('Created state machine can grant actions to the executions', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const task = new stepfunctions.Task(stack, 'Task', {
      task: {
        bind: () => ({ resourceArn: 'resource' }),
      },
    });
    const stateMachine = new stepfunctions.StateMachine(stack, 'StateMachine', {
      definition: task,
    });
    const role = new iam.Role(stack, 'Role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    // WHEN
    stateMachine.grantExecution(role, 'states:GetExecutionHistory');

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'states:GetExecutionHistory',
            Effect: 'Allow',
            Resource: {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  {
                    Ref: 'AWS::Partition',
                  },
                  ':states:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':execution:',
                  {
                    'Fn::Select': [
                      6,
                      {
                        'Fn::Split': [
                          ':',
                          {
                            Ref: 'StateMachine2E01A3A5',
                          },
                        ],
                      },
                    ],
                  },
                  ':*',
                ],
              ],
            },
          },
        ],
      },
    });
  }),

  test('Created state machine can grant actions to a role', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const task = new stepfunctions.Task(stack, 'Task', {
      task: {
        bind: () => ({ resourceArn: 'resource' }),
      },
    });
    const stateMachine = new stepfunctions.StateMachine(stack, 'StateMachine', {
      definition: task,
    });
    const role = new iam.Role(stack, 'Role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    // WHEN
    stateMachine.grant(role, 'states:ListExecution');

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'states:ListExecution',
            Effect: 'Allow',
            Resource: {
              Ref: 'StateMachine2E01A3A5',
            },
          },
        ],
      },
    });
  }),

  test('Imported state machine can grant start execution to a role', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const stateMachineArn = 'arn:aws:states:::my-state-machine';
    const stateMachine = stepfunctions.StateMachine.fromStateMachineArn(stack, 'StateMachine', stateMachineArn);
    const role = new iam.Role(stack, 'Role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    // WHEN
    stateMachine.grantStartExecution(role);

    // THEN
    expect(stack).toHaveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'states:StartExecution',
            Effect: 'Allow',
            Resource: stateMachineArn,
          },
        ],
        Version: '2012-10-17',
      },
      PolicyName: 'RoleDefaultPolicy5FFB7DAB',
      Roles: [
        {
          Ref: 'Role1ABCC5F0',
        },
      ],
    });
  }),

  test('Imported state machine can grant read access to a role', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const stateMachineArn = 'arn:aws:states:::my-state-machine';
    const stateMachine = stepfunctions.StateMachine.fromStateMachineArn(stack, 'StateMachine', stateMachineArn);
    const role = new iam.Role(stack, 'Role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    // WHEN
    stateMachine.grantRead(role);

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: [
              'states:ListExecutions',
              'states:ListStateMachines',
            ],
            Effect: 'Allow',
            Resource: stateMachineArn,
          },
          {
            Action: [
              'states:DescribeExecution',
              'states:DescribeStateMachineForExecution',
              'states:GetExecutionHistory',
            ],
            Effect: 'Allow',
            Resource: {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  {
                    Ref: 'AWS::Partition',
                  },
                  ':states:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':execution:*',
                ],
              ],
            },
          },
          {
            Action: [
              'states:ListActivities',
              'states:DescribeStateMachine',
              'states:DescribeActivity',
            ],
            Effect: 'Allow',
            Resource: '*',
          },
        ],
      },
    },
    );
  }),

  test('Imported state machine can task response permissions to the state machine', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const stateMachineArn = 'arn:aws:states:::my-state-machine';
    const stateMachine = stepfunctions.StateMachine.fromStateMachineArn(stack, 'StateMachine', stateMachineArn);
    const role = new iam.Role(stack, 'Role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    // WHEN
    stateMachine.grantTaskResponse(role);

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: [
              'states:SendTaskSuccess',
              'states:SendTaskFailure',
              'states:SendTaskHeartbeat',
            ],
            Effect: 'Allow',
            Resource: stateMachineArn,
          },
        ],
      },
    });
  }),

  test('Imported state machine can grant access to a role', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const stateMachineArn = 'arn:aws:states:::my-state-machine';
    const stateMachine = stepfunctions.StateMachine.fromStateMachineArn(stack, 'StateMachine', stateMachineArn);
    const role = new iam.Role(stack, 'Role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    // WHEN
    stateMachine.grant(role, 'states:ListExecution');

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'states:ListExecution',
            Effect: 'Allow',
            Resource: stateMachine.stateMachineArn,
          },
        ],
      },
    });
  }),

  test('Imported state machine can provide metrics', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const stateMachineArn = 'arn:aws:states:us-east-1:123456789012:stateMachine:my-state-machine';
    const stateMachine = stepfunctions.StateMachine.fromStateMachineArn(stack, 'StateMachine', stateMachineArn);
    const color = '#00ff00';

    // WHEN
    const metrics = new Array<cloudwatch.Metric>();
    metrics.push(stateMachine.metricAborted({ color }));
    metrics.push(stateMachine.metricFailed({ color }));
    metrics.push(stateMachine.metricStarted({ color }));
    metrics.push(stateMachine.metricSucceeded({ color }));
    metrics.push(stateMachine.metricThrottled({ color }));
    metrics.push(stateMachine.metricTime({ color }));
    metrics.push(stateMachine.metricTimedOut({ color }));

    // THEN
    for (const metric of metrics) {
      expect(metric.namespace).toEqual('AWS/States');
      expect(metric.dimensions).toEqual({ StateMachineArn: stateMachineArn });
      expect(metric.color).toEqual(color);
    }
  }),

  test('Pass should render InputPath / Parameters / OutputPath correctly', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const task = new stepfunctions.Pass(stack, 'Pass', {
      inputPath: '$',
      outputPath: '$.state',
      parameters: {
        'input.$': '$',
        'stringArgument': 'inital-task',
        'numberArgument': 123,
        'booleanArgument': true,
        'arrayArgument': ['a', 'b', 'c'],
      },
    });

    // WHEN
    const taskState = task.toStateJson();

    // THEN
    expect(taskState).toStrictEqual({
      End: true,
      InputPath: '$',
      OutputPath: '$.state',
      Parameters:
             {
               'input.$': '$',
               'stringArgument': 'inital-task',
               'numberArgument': 123,
               'booleanArgument': true,
               'arrayArgument': ['a', 'b', 'c'],
             },
      Type: 'Pass',
      Comment: undefined,
      Result: undefined,
      ResultPath: undefined,
    });
  }),

  test('parameters can be selected from the input with a path', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const task = new stepfunctions.Pass(stack, 'Pass', {
      parameters: {
        input: stepfunctions.JsonPath.stringAt('$.myField'),
      },
    });

    // WHEN
    const taskState = task.toStateJson();

    // THEN
    expect(taskState).toEqual({
      End: true,
      Parameters:
      { 'input.$': '$.myField' },
      Type: 'Pass',
    });
  }),

  test('State machines must depend on their roles', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const task = new stepfunctions.Task(stack, 'Task', {
      task: {
        bind: () => ({
          resourceArn: 'resource',
          policyStatements: [
            new iam.PolicyStatement({
              resources: ['resource'],
              actions: ['lambda:InvokeFunction'],
            }),
          ],
        }),
      },
    });
    new stepfunctions.StateMachine(stack, 'StateMachine', {
      definition: task,
    });

    // THEN
    expect(stack).toHaveResource('AWS::StepFunctions::StateMachine', {
      DependsOn: [
        'StateMachineRoleDefaultPolicyDF1E6607',
        'StateMachineRoleB840431D',
      ],
    }, ResourcePart.CompleteDefinition);
  });
});
