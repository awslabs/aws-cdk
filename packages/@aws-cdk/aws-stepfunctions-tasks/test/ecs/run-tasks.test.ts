import '@aws-cdk/assert-internal/jest';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Stack } from '@aws-cdk/core';
import * as tasks from '../../lib';

let stack: Stack;
let vpc: ec2.Vpc;
let cluster: ecs.Cluster;

/* eslint-disable quote-props */

beforeEach(() => {
  // GIVEN
  stack = new Stack();
  vpc = new ec2.Vpc(stack, 'Vpc');
  cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
  cluster.addCapacity('Capacity', {
    instanceType: new ec2.InstanceType('t3.medium'),
  });
});

test('Cannot create a Fargate task with a fargate-incompatible task definition', () => {
  const taskDefinition = new ecs.TaskDefinition(stack, 'TD', {
    memoryMiB: '512',
    cpu: '256',
    compatibility: ecs.Compatibility.EC2,
  });
  taskDefinition.addContainer('TheContainer', {
    image: ecs.ContainerImage.fromRegistry('foo/bar'),
    memoryLimitMiB: 256,
  });

  expect(() =>
    new tasks.EcsRunTask(stack, 'task', { cluster, taskDefinition, launchTarget: new tasks.EcsFargateLaunchTarget() }).toStateJson(),
  ).toThrowError(/Supplied TaskDefinition is not compatible with Fargate/);
});

test('Cannot create a Fargate task without a default container', () => {
  const taskDefinition = new ecs.TaskDefinition(stack, 'TD', {
    memoryMiB: '512',
    cpu: '256',
    compatibility: ecs.Compatibility.FARGATE,
  });
  expect(() =>
    new tasks.EcsRunTask(stack, 'task', { cluster, taskDefinition, launchTarget: new tasks.EcsFargateLaunchTarget() }).toStateJson(),
  ).toThrowError(/must have at least one essential container/);
});

test('Running a Fargate Task', () => {
  const taskDefinition = new ecs.TaskDefinition(stack, 'TD', {
    memoryMiB: '512',
    cpu: '256',
    compatibility: ecs.Compatibility.FARGATE,
  });
  const containerDefinition = taskDefinition.addContainer('TheContainer', {
    image: ecs.ContainerImage.fromRegistry('foo/bar'),
    memoryLimitMiB: 256,
  });

  // WHEN
  const runTask = new tasks.EcsRunTask(stack, 'RunFargate', {
    integrationPattern: sfn.IntegrationPattern.RUN_JOB,
    cluster,
    taskDefinition,
    containerOverrides: [
      {
        containerDefinition,
        environment: [{ name: 'SOME_KEY', value: sfn.JsonPath.stringAt('$.SomeKey') }],
      },
    ],
    launchTarget: new tasks.EcsFargateLaunchTarget({
      platformVersion: ecs.FargatePlatformVersion.VERSION1_4,
    }),
  });

  new sfn.StateMachine(stack, 'SM', {
    definition: runTask,
  });

  // THEN
  expect(stack.resolve(runTask.toStateJson())).toEqual({
    End: true,
    Parameters: {
      Cluster: { 'Fn::GetAtt': ['ClusterEB0386A7', 'Arn'] },
      LaunchType: 'FARGATE',
      NetworkConfiguration: {
        AwsvpcConfiguration: {
          SecurityGroups: [{ 'Fn::GetAtt': ['RunFargateSecurityGroup709740F2', 'GroupId'] }],
          Subnets: [{ Ref: 'VpcPrivateSubnet1Subnet536B997A' }, { Ref: 'VpcPrivateSubnet2Subnet3788AAA1' }],
        },
      },
      PlatformVersion: '1.4.0',
      TaskDefinition: 'TD',
      Overrides: {
        ContainerOverrides: [
          {
            Environment: [
              {
                Name: 'SOME_KEY',
                'Value.$': '$.SomeKey',
              },
            ],
            Name: 'TheContainer',
          },
        ],
      },
    },
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::ecs:runTask.sync',
        ],
      ],
    },
    Type: 'Task',
  });

  expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: [
        {
          Action: 'ecs:RunTask',
          Effect: 'Allow',
          Resource: {
            'Fn::Join': [
              '',
              [
                'arn:',
                { 'Fn::Select': [1, { 'Fn::Split': [':', { 'Ref': 'TD49C78F36' }] }] },
                ':',
                { 'Fn::Select': [2, { 'Fn::Split': [':', { 'Ref': 'TD49C78F36' }] }] },
                ':',
                { 'Fn::Select': [3, { 'Fn::Split': [':', { 'Ref': 'TD49C78F36' }] }] },
                ':',
                { 'Fn::Select': [4, { 'Fn::Split': [':', { 'Ref': 'TD49C78F36' }] }] },
                ':',
                { 'Fn::Select': [0, { 'Fn::Split': ['/', { 'Fn::Select': [5, { 'Fn::Split': [':', { 'Ref': 'TD49C78F36' }] }] }] }] },
                '/',
                { 'Fn::Select': [1, { 'Fn::Split': ['/', { 'Fn::Select': [5, { 'Fn::Split': [':', { 'Ref': 'TD49C78F36' }] }] }] }] },
              ],
            ],
          },
        },
        {
          Action: ['ecs:StopTask', 'ecs:DescribeTasks'],
          Effect: 'Allow',
          Resource: '*',
        },
        {
          Action: 'iam:PassRole',
          Effect: 'Allow',
          Resource: { 'Fn::GetAtt': ['TDTaskRoleC497AFFC', 'Arn'] },
        },
        {
          Action: ['events:PutTargets', 'events:PutRule', 'events:DescribeRule'],
          Effect: 'Allow',
          Resource: {
            'Fn::Join': [
              '',
              [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':events:',
                { Ref: 'AWS::Region' },
                ':',
                { Ref: 'AWS::AccountId' },
                ':rule/StepFunctionsGetEventsForECSTaskRule',
              ],
            ],
          },
        },
      ],
    },
  });
});

test('Running an EC2 Task with bridge network', () => {
  const taskDefinition = new ecs.TaskDefinition(stack, 'TD', {
    compatibility: ecs.Compatibility.EC2,
  });
  const containerDefinition = taskDefinition.addContainer('TheContainer', {
    image: ecs.ContainerImage.fromRegistry('foo/bar'),
    memoryLimitMiB: 256,
  });

  // WHEN
  const runTask = new tasks.EcsRunTask(stack, 'Run', {
    integrationPattern: sfn.IntegrationPattern.RUN_JOB,
    cluster,
    taskDefinition,
    containerOverrides: [
      {
        containerDefinition,
        environment: [{ name: 'SOME_KEY', value: sfn.JsonPath.stringAt('$.SomeKey') }],
      },
    ],
    launchTarget: new tasks.EcsEc2LaunchTarget(),
  });

  new sfn.StateMachine(stack, 'SM', {
    definition: runTask,
  });

  // THEN
  expect(stack.resolve(runTask.toStateJson())).toEqual({
    End: true,
    Parameters: {
      Cluster: { 'Fn::GetAtt': ['ClusterEB0386A7', 'Arn'] },
      LaunchType: 'EC2',
      TaskDefinition: 'TD',
      Overrides: {
        ContainerOverrides: [
          {
            Environment: [
              {
                Name: 'SOME_KEY',
                'Value.$': '$.SomeKey',
              },
            ],
            Name: 'TheContainer',
          },
        ],
      },
    },
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::ecs:runTask.sync',
        ],
      ],
    },
    Type: 'Task',
  });

  expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: [
        {
          Action: 'ecs:RunTask',
          Effect: 'Allow',
          Resource: {
            'Fn::Join': [
              '',
              [
                'arn:',
                { 'Fn::Select': [1, { 'Fn::Split': [':', { 'Ref': 'TD49C78F36' }] }] },
                ':',
                { 'Fn::Select': [2, { 'Fn::Split': [':', { 'Ref': 'TD49C78F36' }] }] },
                ':',
                { 'Fn::Select': [3, { 'Fn::Split': [':', { 'Ref': 'TD49C78F36' }] }] },
                ':',
                { 'Fn::Select': [4, { 'Fn::Split': [':', { 'Ref': 'TD49C78F36' }] }] },
                ':',
                { 'Fn::Select': [0, { 'Fn::Split': ['/', { 'Fn::Select': [5, { 'Fn::Split': [':', { 'Ref': 'TD49C78F36' }] }] }] }] },
                '/',
                { 'Fn::Select': [1, { 'Fn::Split': ['/', { 'Fn::Select': [5, { 'Fn::Split': [':', { 'Ref': 'TD49C78F36' }] }] }] }] },
              ],
            ],
          },
        },
        {
          Action: ['ecs:StopTask', 'ecs:DescribeTasks'],
          Effect: 'Allow',
          Resource: '*',
        },
        {
          Action: 'iam:PassRole',
          Effect: 'Allow',
          Resource: { 'Fn::GetAtt': ['TDTaskRoleC497AFFC', 'Arn'] },
        },
        {
          Action: ['events:PutTargets', 'events:PutRule', 'events:DescribeRule'],
          Effect: 'Allow',
          Resource: {
            'Fn::Join': [
              '',
              [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':events:',
                { Ref: 'AWS::Region' },
                ':',
                { Ref: 'AWS::AccountId' },
                ':rule/StepFunctionsGetEventsForECSTaskRule',
              ],
            ],
          },
        },
      ],
    },
  });
});

test('Running an EC2 Task with placement strategies', () => {
  const taskDefinition = new ecs.TaskDefinition(stack, 'TD', {
    compatibility: ecs.Compatibility.EC2,
  });
  taskDefinition.addContainer('TheContainer', {
    image: ecs.ContainerImage.fromRegistry('foo/bar'),
    memoryLimitMiB: 256,
  });

  // WHEN
  const runTask = new tasks.EcsRunTask(stack, 'Run', {
    integrationPattern: sfn.IntegrationPattern.RUN_JOB,
    cluster,
    taskDefinition,
    launchTarget: new tasks.EcsEc2LaunchTarget({
      placementStrategies: [ecs.PlacementStrategy.spreadAcrossInstances(), ecs.PlacementStrategy.packedByCpu(), ecs.PlacementStrategy.randomly()],
      placementConstraints: [ecs.PlacementConstraint.memberOf('blieptuut')],
    }),
  });

  new sfn.StateMachine(stack, 'SM', {
    definition: runTask,
  });

  // THEN
  expect(stack.resolve(runTask.toStateJson())).toEqual({
    End: true,
    Parameters: {
      Cluster: { 'Fn::GetAtt': ['ClusterEB0386A7', 'Arn'] },
      LaunchType: 'EC2',
      TaskDefinition: 'TD',
      PlacementConstraints: [{ Type: 'memberOf', Expression: 'blieptuut' }],
      PlacementStrategy: [{ Field: 'instanceId', Type: 'spread' }, { Field: 'cpu', Type: 'binpack' }, { Type: 'random' }],
    },
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::ecs:runTask.sync',
        ],
      ],
    },
    Type: 'Task',
  });
});

test('Running an EC2 Task with overridden number values', () => {
  const taskDefinition = new ecs.TaskDefinition(stack, 'TD', {
    compatibility: ecs.Compatibility.EC2,
  });
  const containerDefinition = taskDefinition.addContainer('TheContainer', {
    image: ecs.ContainerImage.fromRegistry('foo/bar'),
    memoryLimitMiB: 256,
  });

  // WHEN
  const runTask = new tasks.EcsRunTask(stack, 'Run', {
    integrationPattern: sfn.IntegrationPattern.RUN_JOB,
    cluster,
    taskDefinition,
    containerOverrides: [
      {
        containerDefinition,
        command: sfn.JsonPath.listAt('$.TheCommand'),
        cpu: 5,
        memoryLimit: sfn.JsonPath.numberAt('$.MemoryLimit'),
      },
    ],
    launchTarget: new tasks.EcsEc2LaunchTarget(),
  });

  // THEN
  expect(stack.resolve(runTask.toStateJson())).toEqual({
    End: true,
    Parameters: {
      Cluster: { 'Fn::GetAtt': ['ClusterEB0386A7', 'Arn'] },
      LaunchType: 'EC2',
      TaskDefinition: 'TD',
      Overrides: {
        ContainerOverrides: [
          {
            'Command.$': '$.TheCommand',
            Cpu: 5,
            'Memory.$': '$.MemoryLimit',
            Name: 'TheContainer',
          },
        ],
      },
    },
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::ecs:runTask.sync',
        ],
      ],
    },
    Type: 'Task',
  });
});

test('Cannot create a task with WAIT_FOR_TASK_TOKEN if no TaskToken provided', () => {
  const taskDefinition = new ecs.TaskDefinition(stack, 'TaskDefinition', {
    compatibility: ecs.Compatibility.EC2,
  });

  const containerDefinition = taskDefinition.addContainer('ContainerDefinition', {
    image: ecs.ContainerImage.fromRegistry('foo/bar'),
  });

  expect(() =>
    new tasks.EcsRunTask(stack, 'RunTask', {
      cluster,
      containerOverrides: [
        {
          containerDefinition,
          environment: [
            {
              name: 'Foo',
              value: 'Bar',
            },
          ],
        },
      ],
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      launchTarget: new tasks.EcsEc2LaunchTarget(),
      taskDefinition,
    }),
  ).toThrowError(/Task Token is required in at least one `containerOverrides.environment`/);
});

test('Running a task with WAIT_FOR_TASK_TOKEN and task token in environment', () => {
  const taskDefinition = new ecs.TaskDefinition(stack, 'TaskDefinition', {
    compatibility: ecs.Compatibility.EC2,
  });

  const primaryContainerDef = taskDefinition.addContainer('PrimaryContainerDef', {
    image: ecs.ContainerImage.fromRegistry('foo/primary'),
    essential: true,
  });

  const sidecarContainerDef = taskDefinition.addContainer('SideCarContainerDef', {
    image: ecs.ContainerImage.fromRegistry('foo/sidecar'),
    essential: false,
  });

  expect(() => new tasks.EcsRunTask(stack, 'RunTask', {
    cluster,
    containerOverrides: [
      {
        containerDefinition: primaryContainerDef,
        environment: [
          {
            name: 'Foo',
            value: 'Bar',
          },
        ],
      },
      {
        containerDefinition: sidecarContainerDef,
        environment: [
          {
            name: 'TaskToken.$',
            value: sfn.JsonPath.taskToken,
          },
        ],
      },
    ],
    integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
    launchTarget: new tasks.EcsEc2LaunchTarget(),
    taskDefinition,
  })).not.toThrow();
});
