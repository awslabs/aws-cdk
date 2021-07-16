import { expect, haveResourceLike } from '@aws-cdk/assert-internal';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import { nodeunitShim, Test } from 'nodeunit-shim';
import * as ecs from '../../lib';

nodeunitShim({
  'When creating a Fargate TaskDefinition': {
    'with only required properties set, it correctly sets default properties'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      new ecs.FargateTaskDefinition(stack, 'FargateTaskDef');

      // THEN
      expect(stack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
        Family: 'FargateTaskDef',
        NetworkMode: ecs.NetworkMode.AWS_VPC,
        RequiresCompatibilities: ['FARGATE'],
        Cpu: '256',
        Memory: '512',
      }));

      test.done();
    },

    'support lazy cpu and memory values'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      new ecs.FargateTaskDefinition(stack, 'FargateTaskDef', {
        cpu: cdk.Lazy.number({ produce: () => 128 }),
        memoryLimitMiB: cdk.Lazy.number({ produce: () => 1024 }),
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
        Cpu: '128',
        Memory: '1024',
      }));

      test.done();
    },

    'with all properties set'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const taskDefinition = new ecs.FargateTaskDefinition(stack, 'FargateTaskDef', {
        cpu: 128,
        executionRole: new iam.Role(stack, 'ExecutionRole', {
          path: '/',
          assumedBy: new iam.CompositePrincipal(
            new iam.ServicePrincipal('ecs.amazonaws.com'),
            new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
          ),
        }),
        family: 'myApp',
        memoryLimitMiB: 1024,
        taskRole: new iam.Role(stack, 'TaskRole', {
          assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        }),
        ephemeralStorageGiB: 21,
      });

      taskDefinition.addVolume({
        host: {
          sourcePath: '/tmp/cache',
        },
        name: 'scratch',
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
        Cpu: '128',
        ExecutionRoleArn: {
          'Fn::GetAtt': [
            'ExecutionRole605A040B',
            'Arn',
          ],
        },
        EphemeralStorage: {
          SizeInGiB: 21,
        },
        Family: 'myApp',
        Memory: '1024',
        NetworkMode: 'awsvpc',
        RequiresCompatibilities: [
          ecs.LaunchType.FARGATE,
        ],
        TaskRoleArn: {
          'Fn::GetAtt': [
            'TaskRole30FC0FBB',
            'Arn',
          ],
        },
        Volumes: [
          {
            Host: {
              SourcePath: '/tmp/cache',
            },
            Name: 'scratch',
          },
        ],
      }));

      test.done();
    },

    'throws when adding placement constraint'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const taskDefinition = new ecs.FargateTaskDefinition(stack, 'FargateTaskDef');

      // THEN
      test.throws(() => {
        taskDefinition.addPlacementConstraint(ecs.PlacementConstraint.memberOf('attribute:ecs.instance-type =~ t2.*'));
      }, /Cannot set placement constraints on tasks that run on Fargate/);

      test.done();
    },

    'throws when adding inference accelerators'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const taskDefinition = new ecs.FargateTaskDefinition(stack, 'FargateTaskDef');

      const inferenceAccelerator = {
        deviceName: 'device1',
        deviceType: 'eia2.medium',
      };

      // THEN
      test.throws(() => {
        taskDefinition.addInferenceAccelerator(inferenceAccelerator);
      }, /Cannot use inference accelerators on tasks that run on Fargate/);

      test.done();
    },

    'throws when ephemeral storage request is too high'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      test.throws(() => {
        new ecs.FargateTaskDefinition(stack, 'FargateTaskDef', {
          ephemeralStorageGiB: 201,
        });
      }, /Ephemeral storage size must be between 21GiB and 200GiB/);

      // THEN
      test.done();
    },

    'throws when ephemeral storage request is too low'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      test.throws(() => {
        new ecs.FargateTaskDefinition(stack, 'FargateTaskDef', {
          ephemeralStorageGiB: 19,
        });
      }, /Ephemeral storage size must be between 21GiB and 200GiB/);

      // THEN
      test.done();
    },
  },

  'When importing from an existing Fargate TaskDefinition': {
    'can succeed using TaskDefinition Arn'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const expectTaskDefinitionArn = 'TD_ARN';

      // WHEN
      const taskDefinition = ecs.FargateTaskDefinition.fromFargateTaskDefinitionArn(stack, 'FARGATE_TD_ID', expectTaskDefinitionArn);

      // THEN
      test.equal(taskDefinition.taskDefinitionArn, expectTaskDefinitionArn);
      test.done();
    },

    'can succeed using attributes'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const expectTaskDefinitionArn = 'TD_ARN';
      const expectNetworkMode = ecs.NetworkMode.AWS_VPC;
      const expectTaskRole = new iam.Role(stack, 'TaskRole', {
        assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      });

      // WHEN
      const taskDefinition = ecs.FargateTaskDefinition.fromFargateTaskDefinitionAttributes(stack, 'TD_ID', {
        taskDefinitionArn: expectTaskDefinitionArn,
        networkMode: expectNetworkMode,
        taskRole: expectTaskRole,
      });

      // THEN
      test.equal(taskDefinition.taskDefinitionArn, expectTaskDefinitionArn);
      test.equal(taskDefinition.compatibility, ecs.Compatibility.FARGATE);
      test.ok(taskDefinition.isFargateCompatible);
      test.equal(taskDefinition.isEc2Compatible, false);
      test.equal(taskDefinition.networkMode, expectNetworkMode);
      test.equal(taskDefinition.taskRole, expectTaskRole);

      test.done();
    },

    'returns a Fargate TaskDefinition that will throw an error when trying to access its networkMode but its networkMode is undefined'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const expectTaskDefinitionArn = 'TD_ARN';
      const expectTaskRole = new iam.Role(stack, 'TaskRole', {
        assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      });

      // WHEN
      const taskDefinition = ecs.FargateTaskDefinition.fromFargateTaskDefinitionAttributes(stack, 'TD_ID', {
        taskDefinitionArn: expectTaskDefinitionArn,
        taskRole: expectTaskRole,
      });

      // THEN
      test.throws(() => {
        taskDefinition.networkMode;
      }, 'This operation requires the networkMode in ImportedTaskDefinition to be defined. ' +
        'Add the \'networkMode\' in ImportedTaskDefinitionProps to instantiate ImportedTaskDefinition');

      test.done();
    },

    'returns a Fargate TaskDefinition that will throw an error when trying to access its taskRole but its taskRole is undefined'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const expectTaskDefinitionArn = 'TD_ARN';
      const expectNetworkMode = ecs.NetworkMode.AWS_VPC;

      // WHEN
      const taskDefinition = ecs.FargateTaskDefinition.fromFargateTaskDefinitionAttributes(stack, 'TD_ID', {
        taskDefinitionArn: expectTaskDefinitionArn,
        networkMode: expectNetworkMode,
      });

      // THEN
      test.throws(() => {
        taskDefinition.taskRole;
      }, 'This operation requires the taskRole in ImportedTaskDefinition to be defined. ' +
        'Add the \'taskRole\' in ImportedTaskDefinitionProps to instantiate ImportedTaskDefinition');

      test.done();
    },
  },
});
