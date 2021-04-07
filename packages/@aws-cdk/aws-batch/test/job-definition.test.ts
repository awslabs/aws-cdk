import '@aws-cdk/assert/jest';
import { throws } from 'assert';
import { ResourcePart } from '@aws-cdk/assert/lib/assertions/have-resource';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecr from '@aws-cdk/aws-ecr';
import * as ecs from '@aws-cdk/aws-ecs';
import * as iam from '@aws-cdk/aws-iam';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import * as ssm from '@aws-cdk/aws-ssm';
import * as cdk from '@aws-cdk/core';
import * as batch from '../lib';

describe('Batch Job Definition', () => {
  let stack: cdk.Stack;
  let jobDefProps: batch.JobDefinitionProps;

  beforeEach(() => {
    stack = new cdk.Stack();

    const role = new iam.Role(stack, 'job-role', {
      assumedBy: new iam.ServicePrincipal('batch.amazonaws.com'),
    });

    const linuxParams = new ecs.LinuxParameters(stack, 'job-linux-params', {
      initProcessEnabled: true,
      sharedMemorySize: 1,
    });

    const logConfiguration: batch.LogConfiguration = {
      logDriver: batch.LogDriver.AWSLOGS,
      options: { 'awslogs-region': 'us-east-1' },
    };

    jobDefProps = {
      jobDefinitionName: 'test-job',
      container: {
        command: ['echo "Hello World"'],
        environment: {
          foo: 'bar',
        },
        jobRole: role,
        gpuCount: 1,
        image: ecs.EcrImage.fromRegistry('docker/whalesay'),
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
        linuxParams,
        logConfiguration,
        memoryLimitMiB: 1,
        mountPoints: new Array<ecs.MountPoint>(),
        privileged: true,
        readOnly: true,
        ulimits: new Array<ecs.Ulimit>(),
        user: 'root',
        vcpus: 2,
        volumes: new Array<ecs.Volume>(),
      },
      nodeProps: {
        count: 2,
        mainNode: 1,
        rangeProps: new Array<batch.INodeRangeProps>(),
      },
      parameters: {
        foo: 'bar',
      },
      retryAttempts: 2,
      timeout: cdk.Duration.seconds(30),
      platformCapabilities: [batch.PlatformCapabilities.EC2],
    };
  });

  test('renders the correct cloudformation properties', () => {
    // WHEN
    new batch.JobDefinition(stack, 'job-def', jobDefProps);

    // THEN
    expect(stack).toHaveResourceLike('AWS::Batch::JobDefinition', {
      JobDefinitionName: jobDefProps.jobDefinitionName,
      ContainerProperties: jobDefProps.container ? {
        Command: jobDefProps.container.command,
        Environment: [
          {
            Name: 'foo',
            Value: 'bar',
          },
        ],
        InstanceType: jobDefProps.container.instanceType ? jobDefProps.container.instanceType.toString() : '',
        LinuxParameters: {},
        LogConfiguration: {
          LogDriver: 'awslogs',
          Options: {
            'awslogs-region': 'us-east-1',
          },
        },
        Memory: jobDefProps.container.memoryLimitMiB,
        MountPoints: [],
        Privileged: jobDefProps.container.privileged,
        ReadonlyRootFilesystem: jobDefProps.container.readOnly,
        ResourceRequirements: [{ Type: 'GPU', Value: String(jobDefProps.container.gpuCount) }],
        Ulimits: [],
        User: jobDefProps.container.user,
        Vcpus: jobDefProps.container.vcpus,
        Volumes: [],
      } : undefined,
      NodeProperties: jobDefProps.nodeProps ? {
        MainNode: jobDefProps.nodeProps.mainNode,
        NodeRangeProperties: [],
        NumNodes: jobDefProps.nodeProps.count,
      } : undefined,
      Parameters: {
        foo: 'bar',
      },
      RetryStrategy: {
        Attempts: jobDefProps.retryAttempts,
      },
      Timeout: {
        AttemptDurationSeconds: jobDefProps.timeout ? jobDefProps.timeout.toSeconds() : -1,
      },
      Type: 'container',
      PlatformCapabilities: ['EC2'],
    }, ResourcePart.Properties);
  });
  test('can use an ecr image', () => {
    // WHEN
    const repo = new ecr.Repository(stack, 'image-repo');

    new batch.JobDefinition(stack, 'job-def', {
      container: {
        image: ecs.ContainerImage.fromEcrRepository(repo),
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Batch::JobDefinition', {
      ContainerProperties: {
        Image: {
          'Fn::Join': [
            '',
            [
              {
                'Fn::Select': [
                  4,
                  {
                    'Fn::Split': [
                      ':',
                      {
                        'Fn::GetAtt': [
                          'imagerepoD116FAF0',
                          'Arn',
                        ],
                      },
                    ],
                  },
                ],
              },
              '.dkr.ecr.',
              {
                'Fn::Select': [
                  3,
                  {
                    'Fn::Split': [
                      ':',
                      {
                        'Fn::GetAtt': [
                          'imagerepoD116FAF0',
                          'Arn',
                        ],
                      },
                    ],
                  },
                ],
              },
              '.',
              {
                Ref: 'AWS::URLSuffix',
              },
              '/',
              {
                Ref: 'imagerepoD116FAF0',
              },
              ':latest',
            ],
          ],
        },
        Memory: 4,
        Privileged: false,
        ReadonlyRootFilesystem: false,
        Vcpus: 1,
      },
    }, ResourcePart.Properties);
  });

  test('can use a registry image', () => {
    // WHEN
    new batch.JobDefinition(stack, 'job-def', {
      container: {
        image: ecs.ContainerImage.fromRegistry('docker/whalesay'),
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Batch::JobDefinition', {
      ContainerProperties: {
        Image: 'docker/whalesay',
        Memory: 4,
        Privileged: false,
        ReadonlyRootFilesystem: false,
        Vcpus: 1,
      },
    }, ResourcePart.Properties);
  });

  test('can be imported from an ARN', () => {
    // WHEN
    const importedJob = batch.JobDefinition.fromJobDefinitionArn(stack, 'job-def-clone',
      'arn:aws:batch:us-east-1:123456789012:job-definition/job-def-name:1');

    // THEN
    expect(importedJob.jobDefinitionName).toEqual('job-def-name:1');
    expect(importedJob.jobDefinitionArn).toEqual('arn:aws:batch:us-east-1:123456789012:job-definition/job-def-name:1');
  });

  test('can be imported from a name', () => {
    // WHEN
    const importedJob = batch.JobDefinition.fromJobDefinitionName(stack, 'job-def-clone', 'job-def-name');

    // THEN
    expect(importedJob.jobDefinitionName).toEqual('job-def-name');
    expect(importedJob.jobDefinitionArn)
      .toEqual(`arn:${cdk.Aws.PARTITION}:batch:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:job-definition/job-def-name`);
  });

  test('can configure log configuration secrets properly', () => {
    // GIVEN
    const secretArn = 'arn:aws:secretsmanager:eu-west-1:111111111111:secret:MySecret-f3gDy9';

    const logConfiguration: batch.LogConfiguration = {
      logDriver: batch.LogDriver.AWSLOGS,
      options: { 'awslogs-region': 'us-east-1' },
      secretOptions: [
        batch.ExposedSecret.fromSecretsManager('abc', secretsmanager.Secret.fromSecretCompleteArn(stack, 'secret', secretArn)),
        batch.ExposedSecret.fromParametersStore('xyz', ssm.StringParameter.fromStringParameterName(stack, 'parameter', 'xyz')),
      ],
    };

    // WHEN
    new batch.JobDefinition(stack, 'job-def', {
      container: {
        image: ecs.EcrImage.fromRegistry('docker/whalesay'),
        logConfiguration,
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Batch::JobDefinition', {
      ContainerProperties: {
        LogConfiguration: {
          LogDriver: 'awslogs',
          Options: {
            'awslogs-region': 'us-east-1',
          },
          SecretOptions: [
            {
              Name: 'abc',
              ValueFrom: secretArn,
            },
            {
              Name: 'xyz',
              ValueFrom: {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    {
                      Ref: 'AWS::Partition',
                    },
                    ':ssm:',
                    {
                      Ref: 'AWS::Region',
                    },
                    ':',
                    {
                      Ref: 'AWS::AccountId',
                    },
                    ':parameter/xyz',
                  ],
                ],
              },
            },
          ],
        },
      },
    }, ResourcePart.Properties);
  });
  describe('using fargate job definition', () => {
    test('can configure platform configuration properly', () => {
      // GIVEN
      const platformConfiguration: batch.FargatePlatformConfiguration = {
        platformVersion: ecs.FargatePlatformVersion.LATEST,
      };
      const executionRole = new iam.Role(stack, 'execution-role', {
        assumedBy: new iam.ServicePrincipal('batch.amazonaws.com'),
      });
      // WHEN
      new batch.JobDefinition(stack, 'job-def', {
        platformCapabilities: [batch.PlatformCapabilities.FARGATE],
        container: {
          image: ecs.EcrImage.fromRegistry('docker/whalesay'),
          fargatePlatformConfiguration: platformConfiguration,
          executionRole: executionRole,
        },
      });
      // THEN
      expect(stack).toHaveResourceLike('AWS::Batch::JobDefinition', {
        ContainerProperties: {
          FargatePlatformConfiguration: {
            PlatformVersion: 'LATEST',
          },
        },
      }, ResourcePart.Properties);
    });
    test('must require executionRole', () => {
      throws(() => {
        // WHEN
        new batch.JobDefinition(stack, 'job-def', {
          platformCapabilities: [batch.PlatformCapabilities.FARGATE],
          container: {
            image: ecs.EcrImage.fromRegistry('docker/whalesay'),
          },
        });
      });
    });
  });
});
