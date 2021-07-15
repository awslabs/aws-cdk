import { ABSENT, expect, haveResource, haveResourceLike } from '@aws-cdk/assert-internal';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as sqs from '@aws-cdk/aws-sqs';
import * as cdk from '@aws-cdk/core';
import * as cxapi from '@aws-cdk/cx-api';
import { Test } from 'nodeunit';
import * as ecsPatterns from '../../lib';

export = {
  'test ECS queue worker service construct - with only required props'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

    // WHEN
    new ecsPatterns.QueueProcessingEc2Service(stack, 'Service', {
      cluster,
      memoryLimitMiB: 512,
      image: ecs.ContainerImage.fromRegistry('test'),
    });

    // THEN - QueueWorker is of EC2 launch type, an SQS queue is created and all default properties are set.
    expect(stack).to(haveResource('AWS::ECS::Service', {
      DesiredCount: 1,
      LaunchType: 'EC2',
    }));

    expect(stack).to(haveResource('AWS::SQS::Queue', {
      RedrivePolicy: {
        deadLetterTargetArn: {
          'Fn::GetAtt': [
            'ServiceEcsProcessingDeadLetterQueue4A89196E',
            'Arn',
          ],
        },
        maxReceiveCount: 3,
      },
    }));

    expect(stack).to(haveResource('AWS::SQS::Queue', {
      MessageRetentionPeriod: 1209600,
    }));

    expect(stack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
          Environment: [
            {
              Name: 'QUEUE_NAME',
              Value: {
                'Fn::GetAtt': [
                  'ServiceEcsProcessingQueueC266885C',
                  'QueueName',
                ],
              },
            },
          ],
          LogConfiguration: {
            LogDriver: 'awslogs',
            Options: {
              'awslogs-group': {
                Ref: 'ServiceQueueProcessingTaskDefQueueProcessingContainerLogGroupD52338D1',
              },
              'awslogs-stream-prefix': 'Service',
              'awslogs-region': {
                Ref: 'AWS::Region',
              },
            },
          },
          Essential: true,
          Image: 'test',
          Memory: 512,
        },
      ],
      Family: 'ServiceQueueProcessingTaskDef83DB34F1',
    }));

    test.done();
  },

  'test ECS queue worker service construct - with remove default desiredCount feature flag'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    stack.node.setContext(cxapi.ECS_REMOVE_DEFAULT_DESIRED_COUNT, true);

    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

    // WHEN
    new ecsPatterns.QueueProcessingEc2Service(stack, 'Service', {
      cluster,
      memoryLimitMiB: 512,
      image: ecs.ContainerImage.fromRegistry('test'),
    });

    // THEN - QueueWorker is of EC2 launch type, and desiredCount is not defined on the Ec2Service.
    expect(stack).to(haveResource('AWS::ECS::Service', {
      DesiredCount: ABSENT,
      LaunchType: 'EC2',
    }));

    test.done();
  },

  'test ECS queue worker service construct - with optional props for queues'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

    // WHEN
    new ecsPatterns.QueueProcessingEc2Service(stack, 'Service', {
      cluster,
      memoryLimitMiB: 512,
      image: ecs.ContainerImage.fromRegistry('test'),
      maxReceiveCount: 42,
      retentionPeriod: cdk.Duration.days(7),
      visibilityTimeout: cdk.Duration.minutes(5),
    });

    // THEN - QueueWorker is of EC2 launch type, an SQS queue is created and all default properties are set.
    expect(stack).to(haveResource('AWS::ECS::Service', {
      DesiredCount: 1,
      LaunchType: 'EC2',
    }));

    expect(stack).to(haveResource('AWS::SQS::Queue', {
      RedrivePolicy: {
        deadLetterTargetArn: {
          'Fn::GetAtt': [
            'ServiceEcsProcessingDeadLetterQueue4A89196E',
            'Arn',
          ],
        },
        maxReceiveCount: 42,
      },
      VisibilityTimeout: 300,
    }));

    expect(stack).to(haveResource('AWS::SQS::Queue', {
      MessageRetentionPeriod: 604800,
    }));

    expect(stack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
          Environment: [
            {
              Name: 'QUEUE_NAME',
              Value: {
                'Fn::GetAtt': [
                  'ServiceEcsProcessingQueueC266885C',
                  'QueueName',
                ],
              },
            },
          ],
          LogConfiguration: {
            LogDriver: 'awslogs',
            Options: {
              'awslogs-group': {
                Ref: 'ServiceQueueProcessingTaskDefQueueProcessingContainerLogGroupD52338D1',
              },
              'awslogs-stream-prefix': 'Service',
              'awslogs-region': {
                Ref: 'AWS::Region',
              },
            },
          },
          Essential: true,
          Image: 'test',
          Memory: 512,
        },
      ],
      Family: 'ServiceQueueProcessingTaskDef83DB34F1',
    }));

    test.done();
  },

  'test ECS queue worker service construct - with optional props'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
    const queue = new sqs.Queue(stack, 'ecs-test-queue', {
      queueName: 'ecs-test-sqs-queue',
    });

    // WHEN
    new ecsPatterns.QueueProcessingEc2Service(stack, 'Service', {
      cluster,
      memoryLimitMiB: 1024,
      image: ecs.ContainerImage.fromRegistry('test'),
      command: ['-c', '4', 'amazon.com'],
      enableLogging: false,
      desiredTaskCount: 2,
      environment: {
        TEST_ENVIRONMENT_VARIABLE1: 'test environment variable 1 value',
        TEST_ENVIRONMENT_VARIABLE2: 'test environment variable 2 value',
      },
      queue,
      maxScalingCapacity: 5,
      minHealthyPercent: 60,
      maxHealthyPercent: 150,
      serviceName: 'ecs-test-service',
      family: 'ecs-task-family',
      circuitBreaker: { rollback: true },
      gpuCount: 256,
    });

    // THEN - QueueWorker is of EC2 launch type, an SQS queue is created and all optional properties are set.
    expect(stack).to(haveResource('AWS::ECS::Service', {
      DesiredCount: 2,
      DeploymentConfiguration: {
        MinimumHealthyPercent: 60,
        MaximumPercent: 150,
        DeploymentCircuitBreaker: {
          Enable: true,
          Rollback: true,
        },
      },
      LaunchType: 'EC2',
      ServiceName: 'ecs-test-service',
      DeploymentController: {
        Type: 'ECS',
      },
    }));

    expect(stack).to(haveResource('AWS::SQS::Queue', {
      QueueName: 'ecs-test-sqs-queue',
    }));

    expect(stack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
          Command: [
            '-c',
            '4',
            'amazon.com',
          ],
          Environment: [
            {
              Name: 'TEST_ENVIRONMENT_VARIABLE1',
              Value: 'test environment variable 1 value',
            },
            {
              Name: 'TEST_ENVIRONMENT_VARIABLE2',
              Value: 'test environment variable 2 value',
            },
            {
              Name: 'QUEUE_NAME',
              Value: {
                'Fn::GetAtt': [
                  'ecstestqueueD1FDA34B',
                  'QueueName',
                ],
              },
            },
          ],
          Image: 'test',
          Memory: 1024,
          ResourceRequirements: [
            {
              Type: 'GPU',
              Value: '256',
            },
          ],
        },
      ],
      Family: 'ecs-task-family',
    }));

    test.done();
  },

  'can set desiredTaskCount to 0'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

    // WHEN
    new ecsPatterns.QueueProcessingEc2Service(stack, 'Service', {
      cluster,
      desiredTaskCount: 0,
      maxScalingCapacity: 2,
      memoryLimitMiB: 512,
      image: ecs.ContainerImage.fromRegistry('test'),
    });

    // THEN - QueueWorker is of EC2 launch type, an SQS queue is created and all default properties are set.
    expect(stack).to(haveResource('AWS::ECS::Service', {
      DesiredCount: 0,
      LaunchType: 'EC2',
    }));

    test.done();
  },

  'throws if desiredTaskCount and maxScalingCapacity are 0'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

    // THEN
    test.throws(() =>
      new ecsPatterns.QueueProcessingEc2Service(stack, 'Service', {
        cluster,
        desiredTaskCount: 0,
        memoryLimitMiB: 512,
        image: ecs.ContainerImage.fromRegistry('test'),
      })
    , /maxScalingCapacity must be set and greater than 0 if desiredCount is 0/);

    test.done();
  },

  'can set custom containerName'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

    // WHEN
    new ecsPatterns.QueueProcessingEc2Service(stack, 'Service', {
      cluster,
      memoryLimitMiB: 512,
      image: ecs.ContainerImage.fromRegistry('test'),
      containerName: 'my-container',
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
          Name: 'my-container',
        },
      ],
    }));

    test.done();
  },
};
