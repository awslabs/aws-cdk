import { expect, haveResourceLike } from '@aws-cdk/assert';
import iam = require('@aws-cdk/aws-iam');
import cdk = require('@aws-cdk/core');
import { Test } from 'nodeunit';
import ecs = require('../../lib');

export = {
  "When creating an Fargate TaskDefinition": {
    "with only required properties set, it correctly sets default properties"(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      new ecs.FargateTaskDefinition(stack, 'FargateTaskDef');

      // THEN
      expect(stack).to(haveResourceLike("AWS::ECS::TaskDefinition", {
        Family: "FargateTaskDef",
        NetworkMode: ecs.NetworkMode.AWS_VPC,
        RequiresCompatibilities: ["FARGATE"],
        Cpu: "256",
        Memory: "512",
      }));

      test.done();
    },

    "support lazy cpu and memory values"(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      new ecs.FargateTaskDefinition(stack, 'FargateTaskDef', {
        cpu: cdk.Lazy.numberValue({produce: () => 128}),
        memoryLimitMiB: cdk.Lazy.numberValue({produce: () => 1024})
      });

      // THEN
      expect(stack).to(haveResourceLike("AWS::ECS::TaskDefinition", {
        Cpu: "128",
        Memory: "1024"
      }));

      test.done();
    },

    "with all properties set"(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const taskDefinition = new ecs.FargateTaskDefinition(stack, 'FargateTaskDef', {
        cpu: 128,
        executionRole: new iam.Role(stack, 'ExecutionRole', {
          path: '/',
          assumedBy: new iam.CompositePrincipal(
            new iam.ServicePrincipal("ecs.amazonaws.com"),
            new iam.ServicePrincipal("ecs-tasks.amazonaws.com")
          )
        }),
        family: "myApp",
        memoryLimitMiB: 1024,
        taskRole: new iam.Role(stack, 'TaskRole', {
          assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        })
      });

      taskDefinition.addVolume({
        host: {
          sourcePath: "/tmp/cache",
        },
        name: "scratch"
      });

      // THEN
      expect(stack).to(haveResourceLike("AWS::ECS::TaskDefinition", {
        Cpu: "128",
        ExecutionRoleArn: {
          "Fn::GetAtt": [
            "ExecutionRole605A040B",
            "Arn"
          ]
        },
        Family: "myApp",
        Memory: "1024",
        NetworkMode: "awsvpc",
        RequiresCompatibilities: [
          ecs.LaunchType.FARGATE
        ],
        TaskRoleArn: {
          "Fn::GetAtt": [
            "TaskRole30FC0FBB",
            "Arn"
          ]
        },
        Volumes: [
          {
            Host: {
              SourcePath: "/tmp/cache"
            },
            Name: "scratch"
          }
        ]
      }));

      test.done();
    },

    'throws when adding placement constraint'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const taskDefinition = new ecs.FargateTaskDefinition(stack, 'FargateTaskDef');

      // THEN
      test.throws(() => {
        taskDefinition.addPlacementConstraint(ecs.PlacementConstraint.memberOf("attribute:ecs.instance-type =~ t2.*"));
      }, /Cannot set placement constraints on tasks that run on Fargate/);

      test.done();
    },

    'throws when setting proxyConfiguration without networkMode AWS_VPC'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      const proxyConfiguration = ecs.ProxyConfigurations.appMeshProxyConfiguration({
        containerName: 'envoy',
        properties: {
          ignoredUID: 1337,
          proxyIngressPort: 15000,
          proxyEgressPort: 15001,
          appPorts: [9080, 9081],
          egressIgnoredIPs: ["169.254.170.2", "169.254.169.254"]
        }
      });

      // THEN
      test.throws(() => {
        new ecs.Ec2TaskDefinition(stack, 'TaskDef', { networkMode: ecs.NetworkMode.BRIDGE, proxyConfiguration });
      }, /"proxyConfiguration" requires AwsVpc network mode, got: bridge/);

      test.done();
    }
  }
};
