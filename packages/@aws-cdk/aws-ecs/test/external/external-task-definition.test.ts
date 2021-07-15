import '@aws-cdk/assert-internal/jest';
import * as path from 'path';
import { Protocol } from '@aws-cdk/aws-ec2';
import { Repository } from '@aws-cdk/aws-ecr';
import * as iam from '@aws-cdk/aws-iam';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import * as ssm from '@aws-cdk/aws-ssm';
import * as cdk from '@aws-cdk/core';
import { nodeunitShim, Test } from 'nodeunit-shim';
import * as ecs from '../../lib';

nodeunitShim({
  'When creating an External TaskDefinition': {
    'with only required properties set, it correctly sets default properties'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      new ecs.ExternalTaskDefinition(stack, 'ExternalTaskDef');

      // THEN
      expect(stack).toHaveResource('AWS::ECS::TaskDefinition', {
        Family: 'ExternalTaskDef',
        NetworkMode: ecs.NetworkMode.BRIDGE,
        RequiresCompatibilities: ['EXTERNAL'],
      });

      test.done();
    },

    'with all properties set'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      new ecs.ExternalTaskDefinition(stack, 'ExternalTaskDef', {
        executionRole: new iam.Role(stack, 'ExecutionRole', {
          path: '/',
          assumedBy: new iam.CompositePrincipal(
            new iam.ServicePrincipal('ecs.amazonaws.com'),
            new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
          ),
        }),
        family: 'ecs-tasks',
        taskRole: new iam.Role(stack, 'TaskRole', {
          assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        }),
      });

      // THEN
      expect(stack).toHaveResource('AWS::ECS::TaskDefinition', {
        ExecutionRoleArn: {
          'Fn::GetAtt': [
            'ExecutionRole605A040B',
            'Arn',
          ],
        },
        Family: 'ecs-tasks',
        NetworkMode: ecs.NetworkMode.BRIDGE,
        RequiresCompatibilities: [
          'EXTERNAL',
        ],
        TaskRoleArn: {
          'Fn::GetAtt': [
            'TaskRole30FC0FBB',
            'Arn',
          ],
        },
      });

      test.done();
    },

    'correctly sets containers'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      const taskDefinition = new ecs.ExternalTaskDefinition(stack, 'ExternalTaskDef');

      const container = taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512, // add validation?
      });

      container.addPortMappings({
        containerPort: 3000,
      });

      container.addUlimits({
        hardLimit: 128,
        name: ecs.UlimitName.RSS,
        softLimit: 128,
      });

      container.addToExecutionPolicy(new iam.PolicyStatement({
        resources: ['*'],
        actions: ['ecs:*'],
      }));

      // THEN
      expect(stack).toHaveResource('AWS::ECS::TaskDefinition', {
        Family: 'ExternalTaskDef',
        NetworkMode: ecs.NetworkMode.BRIDGE,
        RequiresCompatibilities: ['EXTERNAL'],
        ContainerDefinitions: [{
          Essential: true,
          Memory: 512,
          Image: 'amazon/amazon-ecs-sample',
          Name: 'web',
          PortMappings: [{
            ContainerPort: 3000,
            HostPort: 0,
            Protocol: Protocol.TCP,
          }],
          Ulimits: [
            {
              HardLimit: 128,
              Name: 'rss',
              SoftLimit: 128,
            },
          ],
        }],
      });

      expect(stack).toHaveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Action: 'ecs:*',
              Effect: 'Allow',
              Resource: '*',
            },
          ],
        },
      });

      test.done();
    },

    'all container definition options defined'(test: Test) {
      const stack = new cdk.Stack();

      const taskDefinition = new ecs.ExternalTaskDefinition(stack, 'ExternalTaskDef');
      const secret = new secretsmanager.Secret(stack, 'Secret');
      const parameter = ssm.StringParameter.fromSecureStringParameterAttributes(stack, 'Parameter', {
        parameterName: '/name',
        version: 1,
      });

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 2048,
        cpu: 256,
        disableNetworking: true,
        command: ['CMD env'],
        dnsSearchDomains: ['0.0.0.0'],
        dnsServers: ['1.1.1.1'],
        dockerLabels: { LABEL: 'label' },
        dockerSecurityOptions: ['ECS_SELINUX_CAPABLE=true'],
        entryPoint: ['/app/node_modules/.bin/cdk'],
        environment: { TEST_ENVIRONMENT_VARIABLE: 'test environment variable value' },
        environmentFiles: [ecs.EnvironmentFile.fromAsset(path.join(__dirname, '../demo-envfiles/test-envfile.env'))],
        essential: true,
        extraHosts: { EXTRAHOST: 'extra host' },
        healthCheck: {
          command: ['curl localhost:8000'],
          interval: cdk.Duration.seconds(20),
          retries: 5,
          startPeriod: cdk.Duration.seconds(10),
        },
        hostname: 'webHost',
        linuxParameters: new ecs.LinuxParameters(stack, 'LinuxParameters', {
          initProcessEnabled: true,
          sharedMemorySize: 1024,
        }),
        logging: new ecs.AwsLogDriver({ streamPrefix: 'prefix' }),
        memoryReservationMiB: 1024,
        secrets: {
          SECRET: ecs.Secret.fromSecretsManager(secret),
          PARAMETER: ecs.Secret.fromSsmParameter(parameter),
        },
        user: 'amazon',
        workingDirectory: 'app/',
      });

      // THEN
      expect(stack).toHaveResource('AWS::ECS::TaskDefinition', {
        Family: 'ExternalTaskDef',
        NetworkMode: ecs.NetworkMode.BRIDGE,
        RequiresCompatibilities: ['EXTERNAL'],
        ContainerDefinitions: [
          {
            Command: [
              'CMD env',
            ],
            Cpu: 256,
            DisableNetworking: true,
            DnsSearchDomains: [
              '0.0.0.0',
            ],
            DnsServers: [
              '1.1.1.1',
            ],
            DockerLabels: {
              LABEL: 'label',
            },
            DockerSecurityOptions: [
              'ECS_SELINUX_CAPABLE=true',
            ],
            EntryPoint: [
              '/app/node_modules/.bin/cdk',
            ],
            Environment: [
              {
                Name: 'TEST_ENVIRONMENT_VARIABLE',
                Value: 'test environment variable value',
              },
            ],
            EnvironmentFiles: [{
              Type: 's3',
              Value: {
                'Fn::Join': [
                  '',
                  [
                    'arn:aws:s3:::',
                    {
                      Ref: 'AssetParameters872561bf078edd1685d50c9ff821cdd60d2b2ddfb0013c4087e79bf2bb50724dS3Bucket7B2069B7',
                    },
                    '/',
                    {
                      'Fn::Select': [
                        0,
                        {
                          'Fn::Split': [
                            '||',
                            {
                              Ref: 'AssetParameters872561bf078edd1685d50c9ff821cdd60d2b2ddfb0013c4087e79bf2bb50724dS3VersionKey40E12C15',
                            },
                          ],
                        },
                      ],
                    },
                    {
                      'Fn::Select': [
                        1,
                        {
                          'Fn::Split': [
                            '||',
                            {
                              Ref: 'AssetParameters872561bf078edd1685d50c9ff821cdd60d2b2ddfb0013c4087e79bf2bb50724dS3VersionKey40E12C15',
                            },
                          ],
                        },
                      ],
                    },
                  ],
                ],
              },
            }],
            Essential: true,
            ExtraHosts: [
              {
                Hostname: 'EXTRAHOST',
                IpAddress: 'extra host',
              },
            ],
            HealthCheck: {
              Command: [
                'CMD-SHELL',
                'curl localhost:8000',
              ],
              Interval: 20,
              Retries: 5,
              StartPeriod: 10,
              Timeout: 5,
            },
            Hostname: 'webHost',
            Image: 'amazon/amazon-ecs-sample',
            LinuxParameters: {
              Capabilities: {},
              InitProcessEnabled: true,
              SharedMemorySize: 1024,
            },
            LogConfiguration: {
              LogDriver: 'awslogs',
              Options: {
                'awslogs-group': {
                  Ref: 'ExternalTaskDefwebLogGroup827719D6',
                },
                'awslogs-stream-prefix': 'prefix',
                'awslogs-region': {
                  Ref: 'AWS::Region',
                },
              },
            },
            Memory: 2048,
            MemoryReservation: 1024,
            Name: 'web',
            Secrets: [
              {
                Name: 'SECRET',
                ValueFrom: {
                  Ref: 'SecretA720EF05',
                },
              },
              {
                Name: 'PARAMETER',
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
                      ':parameter/name',
                    ],
                  ],
                },
              },
            ],
            User: 'amazon',
            WorkingDirectory: 'app/',
          },
        ],
      });

      test.done();
    },

    'correctly sets containers from ECR repository using all props'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      const taskDefinition = new ecs.ExternalTaskDefinition(stack, 'ExternalTaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromEcrRepository(new Repository(stack, 'myECRImage', {
          lifecycleRegistryId: '123456789101',
          lifecycleRules: [{
            rulePriority: 10,
            tagPrefixList: ['abc'],
            maxImageCount: 1,
          }],
          removalPolicy: cdk.RemovalPolicy.DESTROY,
          repositoryName: 'project-a/amazon-ecs-sample',
        })),
        memoryLimitMiB: 512,
      });

      // THEN
      expect(stack).toHaveResource('AWS::ECR::Repository', {
        LifecyclePolicy: {
          // eslint-disable-next-line max-len
          LifecyclePolicyText: '{"rules":[{"rulePriority":10,"selection":{"tagStatus":"tagged","tagPrefixList":["abc"],"countType":"imageCountMoreThan","countNumber":1},"action":{"type":"expire"}}]}',
          RegistryId: '123456789101',
        },
        RepositoryName: 'project-a/amazon-ecs-sample',
      });

      expect(stack).toHaveResource('AWS::ECS::TaskDefinition', {
        Family: 'ExternalTaskDef',
        NetworkMode: ecs.NetworkMode.BRIDGE,
        RequiresCompatibilities: ['EXTERNAL'],
        ContainerDefinitions: [{
          Essential: true,
          Memory: 512,
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
                            'myECRImage7DEAE474',
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
                            'myECRImage7DEAE474',
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
                  Ref: 'myECRImage7DEAE474',
                },
                ':latest',
              ],
            ],
          },
          Name: 'web',
        }],
      });

      test.done();
    },
  },

  'correctly sets containers from ECR repository using an image tag'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    const taskDefinition = new ecs.ExternalTaskDefinition(stack, 'ExternalTaskDef');
    taskDefinition.addContainer('web', {
      image: ecs.ContainerImage.fromEcrRepository(new Repository(stack, 'myECRImage'), 'myTag'),
      memoryLimitMiB: 512,
    });

    // THEN
    expect(stack).toHaveResource('AWS::ECS::TaskDefinition', {
      Family: 'ExternalTaskDef',
      NetworkMode: ecs.NetworkMode.BRIDGE,
      RequiresCompatibilities: ['EXTERNAL'],
      ContainerDefinitions: [{
        Essential: true,
        Memory: 512,
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
                          'myECRImage7DEAE474',
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
                          'myECRImage7DEAE474',
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
                Ref: 'myECRImage7DEAE474',
              },
              ':myTag',
            ],
          ],
        },
        Name: 'web',
      }],
    });

    test.done();
  },

  'correctly sets containers from ECR repository using an image digest'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const taskDefinition = new ecs.ExternalTaskDefinition(stack, 'ExternalTaskDef');
    taskDefinition.addContainer('web', {
      image: ecs.ContainerImage.fromEcrRepository(new Repository(stack, 'myECRImage'), 'sha256:94afd1f2e64d908bc90dbca0035a5b567EXAMPLE'),
      memoryLimitMiB: 512,
    });

    // THEN
    expect(stack).toHaveResource('AWS::ECS::TaskDefinition', {
      Family: 'ExternalTaskDef',
      NetworkMode: ecs.NetworkMode.BRIDGE,
      RequiresCompatibilities: ['EXTERNAL'],
      ContainerDefinitions: [{
        Essential: true,
        Memory: 512,
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
                          'myECRImage7DEAE474',
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
                          'myECRImage7DEAE474',
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
                Ref: 'myECRImage7DEAE474',
              },
              '@sha256:94afd1f2e64d908bc90dbca0035a5b567EXAMPLE',
            ],
          ],
        },
        Name: 'web',
      }],
    });

    test.done();
  },

  'correctly sets containers from ECR repository using default props'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const taskDefinition = new ecs.ExternalTaskDefinition(stack, 'ExternalTaskDef');

    // WHEN
    taskDefinition.addContainer('web', {
      image: ecs.ContainerImage.fromEcrRepository(new Repository(stack, 'myECRImage')),
      memoryLimitMiB: 512,
    });

    // THEN
    expect(stack).toHaveResource('AWS::ECR::Repository', {});

    test.done();
  },

  'warns when setting containers from ECR repository using fromRegistry method'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    const taskDefinition = new ecs.ExternalTaskDefinition(stack, 'ExternalTaskDef');
    // WHEN
    const container = taskDefinition.addContainer('web', {
      image: ecs.ContainerImage.fromRegistry('ACCOUNT.dkr.ecr.REGION.amazonaws.com/REPOSITORY'),
      memoryLimitMiB: 512,
    });

    // THEN
    expect(container.node.metadata[0].data).toEqual("Proper policies need to be attached before pulling from ECR repository, or use 'fromEcrRepository'.");

    test.done();
  },

  'correctly sets volumes from'(test: Test) {
    const stack = new cdk.Stack();
    const taskDefinition = new ecs.ExternalTaskDefinition(stack, 'ExternalTaskDef', {});

    // THEN
    expect(() => taskDefinition.addVolume({
      host: {
        sourcePath: '/tmp/cache',
      },
      name: 'scratch',
    })).toThrow('External task definitions doesnt support volumes' );

    test.done();
  },

  'error when interferenceAccelerators set'(test: Test) {
    const stack = new cdk.Stack();
    const taskDefinition = new ecs.ExternalTaskDefinition(stack, 'ExternalTaskDef', {});

    // THEN
    expect(() => taskDefinition.addInferenceAccelerator({
      deviceName: 'device1',
      deviceType: 'eia2.medium',
    })).toThrow('Cannot use inference accelerators on tasks that run on External service');

    test.done();
  },
});