import '@aws-cdk/assert-internal/jest';
import * as path from 'path';
import { Protocol } from '@aws-cdk/aws-ec2';
import { Repository } from '@aws-cdk/aws-ecr';
import * as iam from '@aws-cdk/aws-iam';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import * as ssm from '@aws-cdk/aws-ssm';
import * as cdk from '@aws-cdk/core';
import * as cxapi from '@aws-cdk/cx-api';
import { testFutureBehavior } from 'cdk-build-tools/lib/feature-flag';
import * as ecs from '../../lib';

describe('ec2 task definition', () => {
  describe('When creating an ECS TaskDefinition', () => {
    test('with only required properties set, it correctly sets default properties', () => {
      // GIVEN
      const stack = new cdk.Stack();
      new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      // THEN
      expect(stack).toHaveResource('AWS::ECS::TaskDefinition', {
        Family: 'Ec2TaskDef',
        NetworkMode: ecs.NetworkMode.BRIDGE,
        RequiresCompatibilities: ['EC2'],
      });

      // test error if no container defs?
    });

    test('with all properties set', () => {
      // GIVEN
      const stack = new cdk.Stack();
      new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
        executionRole: new iam.Role(stack, 'ExecutionRole', {
          path: '/',
          assumedBy: new iam.CompositePrincipal(
            new iam.ServicePrincipal('ecs.amazonaws.com'),
            new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
          ),
        }),
        family: 'ecs-tasks',
        networkMode: ecs.NetworkMode.AWS_VPC,
        ipcMode: ecs.IpcMode.HOST,
        pidMode: ecs.PidMode.TASK,
        placementConstraints: [ecs.PlacementConstraint.memberOf('attribute:ecs.instance-type =~ t2.*')],
        taskRole: new iam.Role(stack, 'TaskRole', {
          assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        }),
        volumes: [{
          host: {
            sourcePath: '/tmp/cache',
          },
          name: 'scratch',
        }],
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
        NetworkMode: 'awsvpc',
        IpcMode: 'host',
        PidMode: 'task',
        PlacementConstraints: [
          {
            Expression: 'attribute:ecs.instance-type =~ t2.*',
            Type: 'memberOf',
          },
        ],
        RequiresCompatibilities: [
          'EC2',
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
      });
    });

    test('correctly sets placement constraint', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      // WHEN
      taskDefinition.addPlacementConstraint(ecs.PlacementConstraint.memberOf('attribute:ecs.instance-type =~ t2.*'));

      // THEN
      expect(stack).toHaveResource('AWS::ECS::TaskDefinition', {
        PlacementConstraints: [
          {
            Expression: 'attribute:ecs.instance-type =~ t2.*',
            Type: 'memberOf',
          },
        ],

      });
    });

    test('correctly sets network mode', () => {
      // GIVEN
      const stack = new cdk.Stack();
      new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
        networkMode: ecs.NetworkMode.AWS_VPC,
      });

      // THEN
      expect(stack).toHaveResource('AWS::ECS::TaskDefinition', {
        NetworkMode: ecs.NetworkMode.AWS_VPC,
      });
    });

    test('correctly sets ipc mode', () => {
      // GIVEN
      const stack = new cdk.Stack();
      new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
        ipcMode: ecs.IpcMode.TASK,
      });

      // THEN
      expect(stack).toHaveResource('AWS::ECS::TaskDefinition', {
        IpcMode: ecs.IpcMode.TASK,
      });
    });

    test('correctly sets pid mode', () => {
      // GIVEN
      const stack = new cdk.Stack();
      new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
        pidMode: ecs.PidMode.HOST,
      });

      // THEN
      expect(stack).toHaveResource('AWS::ECS::TaskDefinition', {
        PidMode: ecs.PidMode.HOST,
      });
    });

    test('correctly sets containers', () => {
      // GIVEN
      const stack = new cdk.Stack();

      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

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

      container.addVolumesFrom({
        sourceContainer: 'foo',
        readOnly: true,
      });

      container.addToExecutionPolicy(new iam.PolicyStatement({
        resources: ['*'],
        actions: ['ecs:*'],
      }));

      // THEN
      expect(stack).toHaveResource('AWS::ECS::TaskDefinition', {
        Family: 'Ec2TaskDef',
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
          VolumesFrom: [
            {
              ReadOnly: true,
              SourceContainer: 'foo',
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
    });

    test('all container definition options defined', () => {
      // GIVEN
      const stack = new cdk.Stack();

      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');
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
        privileged: true,
        readonlyRootFilesystem: true,
        secrets: {
          SECRET: ecs.Secret.fromSecretsManager(secret),
          PARAMETER: ecs.Secret.fromSsmParameter(parameter),
        },
        user: 'amazon',
        workingDirectory: 'app/',
      });

      // THEN
      expect(stack).toHaveResource('AWS::ECS::TaskDefinition', {
        Family: 'Ec2TaskDef',
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
                  Ref: 'Ec2TaskDefwebLogGroup7F786C6B',
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
            Privileged: true,
            ReadonlyRootFilesystem: true,
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
    });

    test('correctly sets containers from ECR repository using all props', () => {
      // GIVEN
      const stack = new cdk.Stack();

      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

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
        Family: 'Ec2TaskDef',
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
    });

    test('correctly sets containers from ECR repository using an image tag', () => {
      // GIVEN
      const stack = new cdk.Stack();

      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromEcrRepository(new Repository(stack, 'myECRImage'), 'myTag'),
        memoryLimitMiB: 512,
      });

      // THEN
      expect(stack).toHaveResource('AWS::ECS::TaskDefinition', {
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
    });

    test('correctly sets containers from ECR repository using an image digest', () => {
      // GIVEN
      const stack = new cdk.Stack();

      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromEcrRepository(new Repository(stack, 'myECRImage'), 'sha256:94afd1f2e64d908bc90dbca0035a5b567EXAMPLE'),
        memoryLimitMiB: 512,
      });

      // THEN
      expect(stack).toHaveResource('AWS::ECS::TaskDefinition', {
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
    });

    test('correctly sets containers from ECR repository using default props', () => {
      // GIVEN
      const stack = new cdk.Stack();

      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      // WHEN
      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromEcrRepository(new Repository(stack, 'myECRImage')),
        memoryLimitMiB: 512,
      });

      // THEN
      expect(stack).toHaveResource('AWS::ECR::Repository', {});
    });

    test('warns when setting containers from ECR repository using fromRegistry method', () => {
      // GIVEN
      const stack = new cdk.Stack();

      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      // WHEN
      const container = taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('ACCOUNT.dkr.ecr.REGION.amazonaws.com/REPOSITORY'),
        memoryLimitMiB: 512,
      });

      // THEN
      expect(container.node.metadata[0].data).toEqual("Proper policies need to be attached before pulling from ECR repository, or use 'fromEcrRepository'.");
    });

    test('warns when setting containers from ECR repository by creating a RepositoryImage class', () => {
      // GIVEN
      const stack = new cdk.Stack();

      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      const repo = new ecs.RepositoryImage('ACCOUNT.dkr.ecr.REGION.amazonaws.com/REPOSITORY');

      // WHEN
      const container = taskDefinition.addContainer('web', {
        image: repo,
        memoryLimitMiB: 512,
      });

      // THEN
      expect(container.node.metadata[0].data).toEqual("Proper policies need to be attached before pulling from ECR repository, or use 'fromEcrRepository'.");
    });

    testFutureBehavior('correctly sets containers from asset using default props', { [cxapi.DOCKER_IGNORE_SUPPORT]: true }, cdk.App, (app) => {
      // GIVEN
      const stack = new cdk.Stack(app, 'Stack');

      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      // WHEN
      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromAsset(path.join(__dirname, '..', 'demo-image')),
        memoryLimitMiB: 512,
      });

      // THEN
      expect(stack).toHaveResource('AWS::ECS::TaskDefinition', {
        Family: 'StackEc2TaskDefF03698CF',
        ContainerDefinitions: [
          {
            Essential: true,
            Image: {
              'Fn::Join': [
                '',
                [
                  {
                    Ref: 'AWS::AccountId',
                  },
                  '.dkr.ecr.',
                  {
                    Ref: 'AWS::Region',
                  },
                  '.',
                  {
                    Ref: 'AWS::URLSuffix',
                  },
                  '/aws-cdk/assets:b2c69bfbfe983b634456574587443159b3b7258849856a118ad3d2772238f1a5',
                ],
              ],
            },
            Memory: 512,
            Name: 'web',
          },
        ],
      });
    });

    test('correctly sets containers from asset using all props', () => {
      // GIVEN
      const stack = new cdk.Stack();

      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromAsset(path.join(__dirname, '..', 'demo-image'), {
          buildArgs: { HTTP_PROXY: 'http://10.20.30.2:1234' },
        }),
        memoryLimitMiB: 512,
      });
    });

    test('correctly sets scratch space', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      const container = taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      container.addScratch({
        containerPath: './cache',
        readOnly: true,
        sourcePath: '/tmp/cache',
        name: 'scratch',
      });

      // THEN
      expect(stack).toHaveResourceLike('AWS::ECS::TaskDefinition', {
        Family: 'Ec2TaskDef',
        ContainerDefinitions: [{
          MountPoints: [
            {
              ContainerPath: './cache',
              ReadOnly: true,
              SourceVolume: 'scratch',
            },
          ],
        }],
        Volumes: [{
          Host: {
            SourcePath: '/tmp/cache',
          },
          Name: 'scratch',
        }],
      });
    });
    test('correctly sets container dependenices', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      const dependency1 = taskDefinition.addContainer('dependency1', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      const dependency2 = taskDefinition.addContainer('dependency2', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      const container = taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      container.addContainerDependencies({
        container: dependency1,
      },
      {
        container: dependency2,
        condition: ecs.ContainerDependencyCondition.SUCCESS,
      },
      );

      // THEN
      expect(stack).toHaveResourceLike('AWS::ECS::TaskDefinition', {
        Family: 'Ec2TaskDef',
        ContainerDefinitions: [{
          Name: 'dependency1',
        },
        {
          Name: 'dependency2',
        },
        {
          Name: 'web',
          DependsOn: [{
            Condition: 'HEALTHY',
            ContainerName: 'dependency1',
          },
          {
            Condition: 'SUCCESS',
            ContainerName: 'dependency2',
          }],
        }],
      });
    });
    test('correctly sets links', () => {
      const stack = new cdk.Stack();

      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
        networkMode: ecs.NetworkMode.BRIDGE,
      });

      const container = taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      const linkedContainer1 = taskDefinition.addContainer('linked1', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      const linkedContainer2 = taskDefinition.addContainer('linked2', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      container.addLink(linkedContainer1, 'linked');
      container.addLink(linkedContainer2);

      // THEN
      expect(stack).toHaveResourceLike('AWS::ECS::TaskDefinition', {
        ContainerDefinitions: [
          {
            Links: [
              'linked1:linked',
              'linked2',
            ],
            Name: 'web',
          },
          {
            Name: 'linked1',
          },
          {
            Name: 'linked2',
          },
        ],
      });
    });

    test('correctly set policy statement to the task IAM role', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      // WHEN
      taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
        actions: ['test:SpecialName'],
        resources: ['*'],
      }));

      // THEN
      expect(stack).toHaveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Action: 'test:SpecialName',
              Effect: 'Allow',
              Resource: '*',
            },
          ],
        },
      });
    });
    test('correctly sets volumes from', () => {
      const stack = new cdk.Stack();

      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {});

      const container = taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      container.addVolumesFrom({
        sourceContainer: 'SourceContainer',
        readOnly: true,
      });

      // THEN
      expect(stack).toHaveResourceLike('AWS::ECS::TaskDefinition', {
        ContainerDefinitions: [{
          VolumesFrom: [
            {
              SourceContainer: 'SourceContainer',
              ReadOnly: true,
            },
          ],
        }],
      });
    });

    test('correctly set policy statement to the task execution IAM role', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      // WHEN
      taskDefinition.addToExecutionRolePolicy(new iam.PolicyStatement({
        actions: ['test:SpecialName'],
        resources: ['*'],
      }));

      // THEN
      expect(stack).toHaveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Action: 'test:SpecialName',
              Effect: 'Allow',
              Resource: '*',
            },
          ],
        },
      });
    });

    test('correctly sets volumes', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const volume = {
        host: {
          sourcePath: '/tmp/cache',
        },
        name: 'scratch',
      };

      // Adding volumes via props is a bit clunky
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
        volumes: [volume],
      });

      const container = taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      // this needs to be a better API -- should auto-add volumes
      container.addMountPoints({
        containerPath: './cache',
        readOnly: true,
        sourceVolume: 'scratch',
      });

      // THEN
      expect(stack).toHaveResourceLike('AWS::ECS::TaskDefinition', {
        Family: 'Ec2TaskDef',
        ContainerDefinitions: [{
          MountPoints: [
            {
              ContainerPath: './cache',
              ReadOnly: true,
              SourceVolume: 'scratch',
            },
          ],
        }],
        Volumes: [{
          Host: {
            SourcePath: '/tmp/cache',
          },
          Name: 'scratch',
        }],
      });
    });

    test('correctly sets placement constraints', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
        placementConstraints: [
          ecs.PlacementConstraint.memberOf('attribute:ecs.instance-type =~ t2.*'),
        ],
      });

      taskDefinition.addContainer('web', {
        memoryLimitMiB: 1024,
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      });

      // THEN
      expect(stack).toHaveResource('AWS::ECS::TaskDefinition', {
        PlacementConstraints: [
          {
            Expression: 'attribute:ecs.instance-type =~ t2.*',
            Type: 'memberOf',
          },
        ],
      });
    });

    test('correctly sets taskRole', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
        taskRole: new iam.Role(stack, 'TaskRole', {
          assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        }),
      });

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      // THEN
      expect(stack).toHaveResourceLike('AWS::ECS::TaskDefinition', {
        TaskRoleArn: stack.resolve(taskDefinition.taskRole.roleArn),
      });
    });

    test('automatically sets taskRole by default', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      // THEN
      expect(stack).toHaveResourceLike('AWS::ECS::TaskDefinition', {
        TaskRoleArn: stack.resolve(taskDefinition.taskRole.roleArn),
      });
    });

    test('correctly sets dockerVolumeConfiguration', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const volume = {
        name: 'scratch',
        dockerVolumeConfiguration: {
          driver: 'local',
          scope: ecs.Scope.TASK,
          driverOpts: {
            key1: 'value',
          },
        },
      };

      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
        volumes: [volume],
      });

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      // THEN
      expect(stack).toHaveResourceLike('AWS::ECS::TaskDefinition', {
        Family: 'Ec2TaskDef',
        Volumes: [{
          Name: 'scratch',
          DockerVolumeConfiguration: {
            Driver: 'local',
            Scope: 'task',
            DriverOpts: {
              key1: 'value',
            },
          },
        }],
      });
    });

    test('correctly sets efsVolumeConfiguration', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const volume = {
        name: 'scratch',
        efsVolumeConfiguration: {
          fileSystemId: 'local',
        },
      };

      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
        volumes: [volume],
      });

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      // THEN
      expect(stack).toHaveResourceLike('AWS::ECS::TaskDefinition', {
        Family: 'Ec2TaskDef',
        Volumes: [{
          Name: 'scratch',
          EfsVolumeConfiguration: {
            FileSystemId: 'local',
          },
        }],
      });
    });
  });

  describe('setting inferenceAccelerators', () => {
    test('correctly sets inferenceAccelerators using props', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const inferenceAccelerators = [{
        deviceName: 'device1',
        deviceType: 'eia2.medium',
      }];

      // WHEN
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
        inferenceAccelerators,
      });

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      // THEN
      expect(stack).toHaveResourceLike('AWS::ECS::TaskDefinition', {
        Family: 'Ec2TaskDef',
        InferenceAccelerators: [{
          DeviceName: 'device1',
          DeviceType: 'eia2.medium',
        }],
      });
    });
    test('correctly sets inferenceAccelerators using props and addInferenceAccelerator method', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const inferenceAccelerators = [{
        deviceName: 'device1',
        deviceType: 'eia2.medium',
      }];

      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
        inferenceAccelerators,
      });

      // WHEN
      taskDefinition.addInferenceAccelerator({
        deviceName: 'device2',
        deviceType: 'eia2.large',
      });

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      // THEN
      expect(stack).toHaveResourceLike('AWS::ECS::TaskDefinition', {
        Family: 'Ec2TaskDef',
        InferenceAccelerators: [{
          DeviceName: 'device1',
          DeviceType: 'eia2.medium',
        }, {
          DeviceName: 'device2',
          DeviceType: 'eia2.large',
        }],
      });
    });
  });

  describe('When importing from an existing Ec2 TaskDefinition', () => {
    test('can succeed using TaskDefinition Arn', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const expectTaskDefinitionArn = 'TD_ARN';

      // WHEN
      const taskDefinition = ecs.Ec2TaskDefinition.fromEc2TaskDefinitionArn(stack, 'EC2_TD_ID', expectTaskDefinitionArn);

      // THEN
      expect(taskDefinition.taskDefinitionArn).toBe(expectTaskDefinitionArn);
    });
  });

  describe('When importing from an existing Ec2 TaskDefinition using attributes', () => {
    test('can set the imported task attribuets successfully', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const expectTaskDefinitionArn = 'TD_ARN';
      const expectNetworkMode = ecs.NetworkMode.AWS_VPC;
      const expectTaskRole = new iam.Role(stack, 'TaskRole', {
        assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      });

      // WHEN
      const taskDefinition = ecs.Ec2TaskDefinition.fromEc2TaskDefinitionAttributes(stack, 'TD_ID', {
        taskDefinitionArn: expectTaskDefinitionArn,
        networkMode: expectNetworkMode,
        taskRole: expectTaskRole,
      });

      // THEN
      expect(taskDefinition.taskDefinitionArn).toBe(expectTaskDefinitionArn);
      expect(taskDefinition.compatibility).toBe(ecs.Compatibility.EC2);
      expect(taskDefinition.isEc2Compatible).toBeTruthy();
      expect(taskDefinition.isFargateCompatible).toBeFalsy();
      expect(taskDefinition.networkMode).toBe(expectNetworkMode);
      expect(taskDefinition.taskRole).toBe(expectTaskRole);
    });

    test('returns an Ec2 TaskDefinition that will throw an error when trying to access its yet to defined networkMode', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const expectTaskDefinitionArn = 'TD_ARN';
      const expectTaskRole = new iam.Role(stack, 'TaskRole', {
        assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      });

      // WHEN
      const taskDefinition = ecs.Ec2TaskDefinition.fromEc2TaskDefinitionAttributes(stack, 'TD_ID', {
        taskDefinitionArn: expectTaskDefinitionArn,
        taskRole: expectTaskRole,
      });

      // THEN
      expect(() => taskDefinition.networkMode).toThrow(
        'This operation requires the networkMode in ImportedTaskDefinition to be defined. ' +
        'Add the \'networkMode\' in ImportedTaskDefinitionProps to instantiate ImportedTaskDefinition');
    });

    test('returns an Ec2 TaskDefinition that will throw an error when trying to access its yet to defined taskRole', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const expectTaskDefinitionArn = 'TD_ARN';
      const expectNetworkMode = ecs.NetworkMode.AWS_VPC;

      // WHEN
      const taskDefinition = ecs.Ec2TaskDefinition.fromEc2TaskDefinitionAttributes(stack, 'TD_ID', {
        taskDefinitionArn: expectTaskDefinitionArn,
        networkMode: expectNetworkMode,
      });

      // THEN
      expect(() => { taskDefinition.taskRole; }).toThrow(
        'This operation requires the taskRole in ImportedTaskDefinition to be defined. ' +
        'Add the \'taskRole\' in ImportedTaskDefinitionProps to instantiate ImportedTaskDefinition');
    });
  });

  test('throws when setting proxyConfiguration without networkMode AWS_VPC', () => {
    // GIVEN
    const stack = new cdk.Stack();

    const proxyConfiguration = ecs.ProxyConfigurations.appMeshProxyConfiguration({
      containerName: 'envoy',
      properties: {
        ignoredUID: 1337,
        proxyIngressPort: 15000,
        proxyEgressPort: 15001,
        appPorts: [9080, 9081],
        egressIgnoredIPs: ['169.254.170.2', '169.254.169.254'],
      },
    });

    // THEN
    expect(() => {
      new ecs.Ec2TaskDefinition(stack, 'TaskDef', { networkMode: ecs.NetworkMode.BRIDGE, proxyConfiguration });
    }).toThrow(/ProxyConfiguration can only be used with AwsVpc network mode, got: bridge/);
  });
});
