import { expect, haveResource, haveResourceLike } from '@aws-cdk/assert-internal';
import * as autoscaling from '@aws-cdk/aws-autoscaling';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as elb from '@aws-cdk/aws-elasticloadbalancing';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as kms from '@aws-cdk/aws-kms';
import * as logs from '@aws-cdk/aws-logs';
import * as s3 from '@aws-cdk/aws-s3';
import * as cloudmap from '@aws-cdk/aws-servicediscovery';
import * as cdk from '@aws-cdk/core';
import { nodeunitShim, Test } from 'nodeunit-shim';
import * as ecs from '../../lib';
import { DeploymentControllerType, LaunchType, PropagatedTagSource } from '../../lib/base/base-service';
import { PlacementConstraint, PlacementStrategy } from '../../lib/placement';

nodeunitShim({
  'When creating an EC2 Service': {
    'with only required properties set, it correctly sets default properties'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      const service = new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
      });

      // THEN
      expect(stack).to(haveResource('AWS::ECS::Service', {
        TaskDefinition: {
          Ref: 'Ec2TaskDef0226F28C',
        },
        Cluster: {
          Ref: 'EcsCluster97242B84',
        },
        DeploymentConfiguration: {
          MaximumPercent: 200,
          MinimumHealthyPercent: 50,
        },
        LaunchType: LaunchType.EC2,
        SchedulingStrategy: 'REPLICA',
        EnableECSManagedTags: false,
      }));

      test.notEqual(service.node.defaultChild, undefined);

      test.done();
    },

    'allows setting enable execute command'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
        enableExecuteCommand: true,
      });

      // THEN
      expect(stack).to(haveResource('AWS::ECS::Service', {
        TaskDefinition: {
          Ref: 'Ec2TaskDef0226F28C',
        },
        Cluster: {
          Ref: 'EcsCluster97242B84',
        },
        DeploymentConfiguration: {
          MaximumPercent: 200,
          MinimumHealthyPercent: 50,
        },
        LaunchType: LaunchType.EC2,
        SchedulingStrategy: 'REPLICA',
        EnableECSManagedTags: false,
        EnableExecuteCommand: true,
      }));

      expect(stack).to(haveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: [
                'ssmmessages:CreateControlChannel',
                'ssmmessages:CreateDataChannel',
                'ssmmessages:OpenControlChannel',
                'ssmmessages:OpenDataChannel',
              ],
              Effect: 'Allow',
              Resource: '*',
            },
            {
              Action: 'logs:DescribeLogGroups',
              Effect: 'Allow',
              Resource: '*',
            },
            {
              Action: [
                'logs:CreateLogStream',
                'logs:DescribeLogStreams',
                'logs:PutLogEvents',
              ],
              Effect: 'Allow',
              Resource: '*',
            },
          ],
          Version: '2012-10-17',
        },
        PolicyName: 'Ec2TaskDefTaskRoleDefaultPolicyA24FB970',
        Roles: [
          {
            Ref: 'Ec2TaskDefTaskRole400FA349',
          },
        ],
      }));

      test.done();
    },

    'no logging enabled when logging field is set to NONE'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});

      // WHEN
      const cluster = new ecs.Cluster(stack, 'EcsCluster', {
        vpc,
        executeCommandConfiguration: {
          logging: ecs.ExecuteCommandLogging.NONE,
        },
      });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      const logGroup = new logs.LogGroup(stack, 'LogGroup');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        logging: ecs.LogDrivers.awsLogs({
          logGroup,
          streamPrefix: 'log-group',
        }),
        memoryLimitMiB: 512,
      });

      new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
        enableExecuteCommand: true,
      });

      // THEN
      expect(stack).to(haveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: [
                'ssmmessages:CreateControlChannel',
                'ssmmessages:CreateDataChannel',
                'ssmmessages:OpenControlChannel',
                'ssmmessages:OpenDataChannel',
              ],
              Effect: 'Allow',
              Resource: '*',
            },
          ],
          Version: '2012-10-17',
        },
        PolicyName: 'Ec2TaskDefTaskRoleDefaultPolicyA24FB970',
        Roles: [
          {
            Ref: 'Ec2TaskDefTaskRole400FA349',
          },
        ],
      }));

      test.done();
    },

    'enables execute command logging when logging field is set to OVERRIDE'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});

      const logGroup = new logs.LogGroup(stack, 'LogGroup');

      const execBucket = new s3.Bucket(stack, 'ExecBucket');

      // WHEN
      const cluster = new ecs.Cluster(stack, 'EcsCluster', {
        vpc,
        executeCommandConfiguration: {
          logConfiguration: {
            cloudWatchLogGroup: logGroup,
            s3Bucket: execBucket,
            s3KeyPrefix: 'exec-output',
          },
          logging: ecs.ExecuteCommandLogging.OVERRIDE,
        },
      });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
        enableExecuteCommand: true,
      });

      // THEN
      expect(stack).to(haveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: [
                'ssmmessages:CreateControlChannel',
                'ssmmessages:CreateDataChannel',
                'ssmmessages:OpenControlChannel',
                'ssmmessages:OpenDataChannel',
              ],
              Effect: 'Allow',
              Resource: '*',
            },
            {
              Action: 'logs:DescribeLogGroups',
              Effect: 'Allow',
              Resource: '*',
            },
            {
              Action: [
                'logs:CreateLogStream',
                'logs:DescribeLogStreams',
                'logs:PutLogEvents',
              ],
              Effect: 'Allow',
              Resource: {
                'Fn::Join': [
                  '',
                  [
                    'arn:aws:logs:',
                    {
                      Ref: 'AWS::Region',
                    },
                    ':',
                    {
                      Ref: 'AWS::AccountId',
                    },
                    ':log-group:',
                    {
                      Ref: 'LogGroupF5B46931',
                    },
                    ':*',
                  ],
                ],
              },
            },
            {
              Action: 's3:GetBucketLocation',
              Effect: 'Allow',
              Resource: '*',
            },
            {
              Action: 's3:PutObject',
              Effect: 'Allow',
              Resource: {
                'Fn::Join': [
                  '',
                  [
                    'arn:aws:s3:::',
                    {
                      Ref: 'ExecBucket29559356',
                    },
                    '/*',
                  ],
                ],
              },
            },
          ],
          Version: '2012-10-17',
        },
        PolicyName: 'Ec2TaskDefTaskRoleDefaultPolicyA24FB970',
        Roles: [
          {
            Ref: 'Ec2TaskDefTaskRole400FA349',
          },
        ],
      }));

      test.done();
    },

    'enables only execute command session encryption'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});

      const kmsKey = new kms.Key(stack, 'KmsKey');

      const logGroup = new logs.LogGroup(stack, 'LogGroup');

      const execBucket = new s3.Bucket(stack, 'EcsExecBucket');

      // WHEN
      const cluster = new ecs.Cluster(stack, 'EcsCluster', {
        vpc,
        executeCommandConfiguration: {
          kmsKey,
          logConfiguration: {
            cloudWatchLogGroup: logGroup,
            s3Bucket: execBucket,
          },
          logging: ecs.ExecuteCommandLogging.OVERRIDE,
        },
      });

      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
        enableExecuteCommand: true,
      });

      // THEN
      expect(stack).to(haveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: [
                'ssmmessages:CreateControlChannel',
                'ssmmessages:CreateDataChannel',
                'ssmmessages:OpenControlChannel',
                'ssmmessages:OpenDataChannel',
              ],
              Effect: 'Allow',
              Resource: '*',
            },
            {
              Action: [
                'kms:Decrypt',
                'kms:GenerateDataKey',
              ],
              Effect: 'Allow',
              Resource: {
                'Fn::GetAtt': [
                  'KmsKey46693ADD',
                  'Arn',
                ],
              },
            },
            {
              Action: 'logs:DescribeLogGroups',
              Effect: 'Allow',
              Resource: '*',
            },
            {
              Action: [
                'logs:CreateLogStream',
                'logs:DescribeLogStreams',
                'logs:PutLogEvents',
              ],
              Effect: 'Allow',
              Resource: {
                'Fn::Join': [
                  '',
                  [
                    'arn:aws:logs:',
                    {
                      Ref: 'AWS::Region',
                    },
                    ':',
                    {
                      Ref: 'AWS::AccountId',
                    },
                    ':log-group:',
                    {
                      Ref: 'LogGroupF5B46931',
                    },
                    ':*',
                  ],
                ],
              },
            },
            {
              Action: 's3:GetBucketLocation',
              Effect: 'Allow',
              Resource: '*',
            },
            {
              Action: 's3:PutObject',
              Effect: 'Allow',
              Resource: {
                'Fn::Join': [
                  '',
                  [
                    'arn:aws:s3:::',
                    {
                      Ref: 'EcsExecBucket4F468651',
                    },
                    '/*',
                  ],
                ],
              },
            },
          ],
          Version: '2012-10-17',
        },
        PolicyName: 'Ec2TaskDefTaskRoleDefaultPolicyA24FB970',
        Roles: [
          {
            Ref: 'Ec2TaskDefTaskRole400FA349',
          },
        ],
      }));

      expect(stack).to(haveResource('AWS::KMS::Key', {
        KeyPolicy: {
          Statement: [
            {
              Action: [
                'kms:Create*',
                'kms:Describe*',
                'kms:Enable*',
                'kms:List*',
                'kms:Put*',
                'kms:Update*',
                'kms:Revoke*',
                'kms:Disable*',
                'kms:Get*',
                'kms:Delete*',
                'kms:ScheduleKeyDeletion',
                'kms:CancelKeyDeletion',
                'kms:GenerateDataKey',
                'kms:TagResource',
                'kms:UntagResource',
              ],
              Effect: 'Allow',
              Principal: {
                AWS: {
                  'Fn::Join': [
                    '',
                    [
                      'arn:',
                      {
                        Ref: 'AWS::Partition',
                      },
                      ':iam::',
                      {
                        Ref: 'AWS::AccountId',
                      },
                      ':root',
                    ],
                  ],
                },
              },
              Resource: '*',
            },
            {
              Action: 'kms:*',
              Effect: 'Allow',
              Principal: {
                AWS: {
                  'Fn::Join': [
                    '',
                    [
                      'arn:aws:iam::',
                      {
                        Ref: 'AWS::AccountId',
                      },
                      ':root',
                    ],
                  ],
                },
              },
              Resource: '*',
            },
          ],
          Version: '2012-10-17',
        },
      }));

      test.done();
    },

    'enables encryption for execute command logging'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});

      const kmsKey = new kms.Key(stack, 'KmsKey');

      const logGroup = new logs.LogGroup(stack, 'LogGroup', {
        encryptionKey: kmsKey,
      });

      const execBucket = new s3.Bucket(stack, 'EcsExecBucket', {
        encryptionKey: kmsKey,
      });

      // WHEN
      const cluster = new ecs.Cluster(stack, 'EcsCluster', {
        vpc,
        executeCommandConfiguration: {
          kmsKey,
          logConfiguration: {
            cloudWatchLogGroup: logGroup,
            cloudWatchEncryptionEnabled: true,
            s3Bucket: execBucket,
            s3EncryptionEnabled: true,
            s3KeyPrefix: 'exec-output',
          },
          logging: ecs.ExecuteCommandLogging.OVERRIDE,
        },
      });

      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
        enableExecuteCommand: true,
      });

      // THEN
      expect(stack).to(haveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: [
                'ssmmessages:CreateControlChannel',
                'ssmmessages:CreateDataChannel',
                'ssmmessages:OpenControlChannel',
                'ssmmessages:OpenDataChannel',
              ],
              Effect: 'Allow',
              Resource: '*',
            },
            {
              Action: [
                'kms:Decrypt',
                'kms:GenerateDataKey',
              ],
              Effect: 'Allow',
              Resource: {
                'Fn::GetAtt': [
                  'KmsKey46693ADD',
                  'Arn',
                ],
              },
            },
            {
              Action: 'logs:DescribeLogGroups',
              Effect: 'Allow',
              Resource: '*',
            },
            {
              Action: [
                'logs:CreateLogStream',
                'logs:DescribeLogStreams',
                'logs:PutLogEvents',
              ],
              Effect: 'Allow',
              Resource: {
                'Fn::Join': [
                  '',
                  [
                    'arn:aws:logs:',
                    {
                      Ref: 'AWS::Region',
                    },
                    ':',
                    {
                      Ref: 'AWS::AccountId',
                    },
                    ':log-group:',
                    {
                      Ref: 'LogGroupF5B46931',
                    },
                    ':*',
                  ],
                ],
              },
            },
            {
              Action: 's3:GetBucketLocation',
              Effect: 'Allow',
              Resource: '*',
            },
            {
              Action: 's3:PutObject',
              Effect: 'Allow',
              Resource: {
                'Fn::Join': [
                  '',
                  [
                    'arn:aws:s3:::',
                    {
                      Ref: 'EcsExecBucket4F468651',
                    },
                    '/*',
                  ],
                ],
              },
            },
            {
              Action: 's3:GetEncryptionConfiguration',
              Effect: 'Allow',
              Resource: {
                'Fn::Join': [
                  '',
                  [
                    'arn:aws:s3:::',
                    {
                      Ref: 'EcsExecBucket4F468651',
                    },
                  ],
                ],
              },
            },
          ],
          Version: '2012-10-17',
        },
        PolicyName: 'Ec2TaskDefTaskRoleDefaultPolicyA24FB970',
        Roles: [
          {
            Ref: 'Ec2TaskDefTaskRole400FA349',
          },
        ],
      }));

      expect(stack).to(haveResource('AWS::KMS::Key', {
        KeyPolicy: {
          Statement: [
            {
              Action: [
                'kms:Create*',
                'kms:Describe*',
                'kms:Enable*',
                'kms:List*',
                'kms:Put*',
                'kms:Update*',
                'kms:Revoke*',
                'kms:Disable*',
                'kms:Get*',
                'kms:Delete*',
                'kms:ScheduleKeyDeletion',
                'kms:CancelKeyDeletion',
                'kms:GenerateDataKey',
                'kms:TagResource',
                'kms:UntagResource',
              ],
              Effect: 'Allow',
              Principal: {
                AWS: {
                  'Fn::Join': [
                    '',
                    [
                      'arn:',
                      {
                        Ref: 'AWS::Partition',
                      },
                      ':iam::',
                      {
                        Ref: 'AWS::AccountId',
                      },
                      ':root',
                    ],
                  ],
                },
              },
              Resource: '*',
            },
            {
              Action: 'kms:*',
              Effect: 'Allow',
              Principal: {
                AWS: {
                  'Fn::Join': [
                    '',
                    [
                      'arn:aws:iam::',
                      {
                        Ref: 'AWS::AccountId',
                      },
                      ':root',
                    ],
                  ],
                },
              },
              Resource: '*',
            },
            {
              Action: [
                'kms:Encrypt*',
                'kms:Decrypt*',
                'kms:ReEncrypt*',
                'kms:GenerateDataKey*',
                'kms:Describe*',
              ],
              Condition: {
                ArnLike: {
                  'kms:EncryptionContext:aws:logs:arn': {
                    'Fn::Join': [
                      '',
                      [
                        'arn:aws:logs:',
                        {
                          Ref: 'AWS::Region',
                        },
                        ':',
                        {
                          Ref: 'AWS::AccountId',
                        },
                        ':*',
                      ],
                    ],
                  },
                },
              },
              Effect: 'Allow',
              Principal: {
                Service: {
                  'Fn::Join': [
                    '',
                    [
                      'logs.',
                      {
                        Ref: 'AWS::Region',
                      },
                      '.amazonaws.com',
                    ],
                  ],
                },
              },
              Resource: '*',
            },
          ],
          Version: '2012-10-17',
        },
      }));

      test.done();
    },

    'with custom cloudmap namespace'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      const container = taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });
      container.addPortMappings({ containerPort: 8000 });

      const cloudMapNamespace = new cloudmap.PrivateDnsNamespace(stack, 'TestCloudMapNamespace', {
        name: 'scorekeep.com',
        vpc,
      });

      new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
        cloudMapOptions: {
          name: 'myApp',
          failureThreshold: 20,
          cloudMapNamespace,
        },
      });

      // THEN
      expect(stack).to(haveResource('AWS::ServiceDiscovery::Service', {
        DnsConfig: {
          DnsRecords: [
            {
              TTL: 60,
              Type: 'SRV',
            },
          ],
          NamespaceId: {
            'Fn::GetAtt': [
              'TestCloudMapNamespace1FB9B446',
              'Id',
            ],
          },
          RoutingPolicy: 'MULTIVALUE',
        },
        HealthCheckCustomConfig: {
          FailureThreshold: 20,
        },
        Name: 'myApp',
        NamespaceId: {
          'Fn::GetAtt': [
            'TestCloudMapNamespace1FB9B446',
            'Id',
          ],
        },
      }));

      expect(stack).to(haveResource('AWS::ServiceDiscovery::PrivateDnsNamespace', {
        Name: 'scorekeep.com',
        Vpc: {
          Ref: 'MyVpcF9F0CA6F',
        },
      }));

      test.done();
    },

    'with all properties set'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
        networkMode: ecs.NetworkMode.AWS_VPC,
      });

      cluster.addDefaultCloudMapNamespace({
        name: 'foo.com',
        type: cloudmap.NamespaceType.DNS_PRIVATE,
      });

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      // WHEN
      const service = new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
        desiredCount: 2,
        assignPublicIp: true,
        cloudMapOptions: {
          name: 'myapp',
          dnsRecordType: cloudmap.DnsRecordType.A,
          dnsTtl: cdk.Duration.seconds(50),
          failureThreshold: 20,
        },
        daemon: false,
        healthCheckGracePeriod: cdk.Duration.seconds(60),
        maxHealthyPercent: 150,
        minHealthyPercent: 55,
        deploymentController: {
          type: ecs.DeploymentControllerType.CODE_DEPLOY,
        },
        securityGroup: new ec2.SecurityGroup(stack, 'SecurityGroup1', {
          allowAllOutbound: true,
          description: 'Example',
          securityGroupName: 'Bob',
          vpc,
        }),
        serviceName: 'bonjour',
        vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      });

      service.addPlacementConstraints(PlacementConstraint.memberOf('attribute:ecs.instance-type =~ t2.*'));
      service.addPlacementStrategies(PlacementStrategy.spreadAcross(ecs.BuiltInAttributes.AVAILABILITY_ZONE));

      // THEN
      expect(stack).to(haveResource('AWS::ECS::Service', {
        TaskDefinition: {
          Ref: 'Ec2TaskDef0226F28C',
        },
        Cluster: {
          Ref: 'EcsCluster97242B84',
        },
        DeploymentConfiguration: {
          MaximumPercent: 150,
          MinimumHealthyPercent: 55,
        },
        DeploymentController: {
          Type: ecs.DeploymentControllerType.CODE_DEPLOY,
        },
        DesiredCount: 2,
        LaunchType: LaunchType.EC2,
        NetworkConfiguration: {
          AwsvpcConfiguration: {
            AssignPublicIp: 'ENABLED',
            SecurityGroups: [
              {
                'Fn::GetAtt': [
                  'SecurityGroup1F554B36F',
                  'GroupId',
                ],
              },
            ],
            Subnets: [
              {
                Ref: 'MyVpcPublicSubnet1SubnetF6608456',
              },
              {
                Ref: 'MyVpcPublicSubnet2Subnet492B6BFB',
              },
            ],
          },
        },
        PlacementConstraints: [
          {
            Expression: 'attribute:ecs.instance-type =~ t2.*',
            Type: 'memberOf',
          },
        ],
        PlacementStrategies: [
          {
            Field: 'attribute:ecs.availability-zone',
            Type: 'spread',
          },
        ],
        SchedulingStrategy: 'REPLICA',
        ServiceName: 'bonjour',
        ServiceRegistries: [
          {
            RegistryArn: {
              'Fn::GetAtt': [
                'Ec2ServiceCloudmapService45B52C0F',
                'Arn',
              ],
            },
          },
        ],
      }));

      test.done();
    },

    'with autoscaling group capacity provider'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'Vpc');
      const cluster = new ecs.Cluster(stack, 'EcsCluster');

      const autoScalingGroup = new autoscaling.AutoScalingGroup(stack, 'asg', {
        vpc,
        instanceType: new ec2.InstanceType('bogus'),
        machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
      });

      // WHEN
      const capacityProvider = new ecs.AsgCapacityProvider(stack, 'provider', {
        autoScalingGroup,
        enableManagedTerminationProtection: false,
      });
      cluster.addAsgCapacityProvider(capacityProvider);

      const taskDefinition = new ecs.TaskDefinition(stack, 'ServerTask', {
        compatibility: ecs.Compatibility.EC2,
      });
      taskDefinition.addContainer('app', {
        image: new ecs.RepositoryImage('bogus'),
        cpu: 1024,
        memoryReservationMiB: 900,
        portMappings: [{
          containerPort: 80,
        }],
      });
      new ecs.Ec2Service(stack, 'Service', {
        cluster,
        taskDefinition,
        desiredCount: 0,
        capacityProviderStrategies: [{
          capacityProvider: capacityProvider.capacityProviderName,
        }],
      });

      // THEN
      expect(stack).to(haveResource('AWS::ECS::Service', {
        CapacityProviderStrategy: [
          {
            CapacityProvider: {
              Ref: 'providerD3FF4D3A',
            },
          },
        ],
      }));
      test.done();
    },

    'with multiple security groups, it correctly updates the cfn template'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
        networkMode: ecs.NetworkMode.AWS_VPC,
      });
      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });
      const securityGroup1 = new ec2.SecurityGroup(stack, 'SecurityGroup1', {
        allowAllOutbound: true,
        description: 'Example',
        securityGroupName: 'Bingo',
        vpc,
      });
      const securityGroup2 = new ec2.SecurityGroup(stack, 'SecurityGroup2', {
        allowAllOutbound: false,
        description: 'Example',
        securityGroupName: 'Rolly',
        vpc,
      });

      // WHEN
      new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
        desiredCount: 2,
        assignPublicIp: true,
        daemon: false,
        securityGroups: [securityGroup1, securityGroup2],
        serviceName: 'bonjour',
        vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      });

      // THEN
      expect(stack).to(haveResource('AWS::ECS::Service', {
        TaskDefinition: {
          Ref: 'Ec2TaskDef0226F28C',
        },
        Cluster: {
          Ref: 'EcsCluster97242B84',
        },
        DesiredCount: 2,
        LaunchType: LaunchType.EC2,
        NetworkConfiguration: {
          AwsvpcConfiguration: {
            AssignPublicIp: 'ENABLED',
            SecurityGroups: [
              {
                'Fn::GetAtt': [
                  'SecurityGroup1F554B36F',
                  'GroupId',
                ],
              },
              {
                'Fn::GetAtt': [
                  'SecurityGroup23BE86BB7',
                  'GroupId',
                ],
              },
            ],
            Subnets: [
              {
                Ref: 'MyVpcPublicSubnet1SubnetF6608456',
              },
              {
                Ref: 'MyVpcPublicSubnet2Subnet492B6BFB',
              },
            ],
          },
        },
        SchedulingStrategy: 'REPLICA',
        ServiceName: 'bonjour',
      }));

      expect(stack).to(haveResource('AWS::EC2::SecurityGroup', {
        GroupDescription: 'Example',
        GroupName: 'Bingo',
        SecurityGroupEgress: [
          {
            CidrIp: '0.0.0.0/0',
            Description: 'Allow all outbound traffic by default',
            IpProtocol: '-1',
          },
        ],
        VpcId: {
          Ref: 'MyVpcF9F0CA6F',
        },
      }));

      expect(stack).to(haveResource('AWS::EC2::SecurityGroup', {
        GroupDescription: 'Example',
        GroupName: 'Rolly',
        SecurityGroupEgress: [
          {
            CidrIp: '255.255.255.255/32',
            Description: 'Disallow all traffic',
            FromPort: 252,
            IpProtocol: 'icmp',
            ToPort: 86,
          },
        ],
        VpcId: {
          Ref: 'MyVpcF9F0CA6F',
        },
      }));

      test.done();
    },

    'throws when both securityGroup and securityGroups are supplied'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
        networkMode: ecs.NetworkMode.AWS_VPC,
      });
      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });
      const securityGroup1 = new ec2.SecurityGroup(stack, 'SecurityGroup1', {
        allowAllOutbound: true,
        description: 'Example',
        securityGroupName: 'Bingo',
        vpc,
      });
      const securityGroup2 = new ec2.SecurityGroup(stack, 'SecurityGroup2', {
        allowAllOutbound: false,
        description: 'Example',
        securityGroupName: 'Rolly',
        vpc,
      });

      // THEN
      test.throws(() => {
        new ecs.Ec2Service(stack, 'Ec2Service', {
          cluster,
          taskDefinition,
          desiredCount: 2,
          assignPublicIp: true,
          maxHealthyPercent: 150,
          minHealthyPercent: 55,
          securityGroup: securityGroup1,
          securityGroups: [securityGroup2],
          serviceName: 'bonjour',
          vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
        });
      }, /Only one of SecurityGroup or SecurityGroups can be populated./);

      test.done();
    },

    'throws when task definition is not EC2 compatible'(test: Test) {
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      const taskDefinition = new ecs.TaskDefinition(stack, 'FargateTaskDef', {
        compatibility: ecs.Compatibility.FARGATE,
        cpu: '256',
        memoryMiB: '512',
      });
      taskDefinition.addContainer('BaseContainer', {
        image: ecs.ContainerImage.fromRegistry('test'),
        memoryReservationMiB: 10,
      });

      // THEN
      test.throws(() => {
        new ecs.Ec2Service(stack, 'Ec2Service', {
          cluster,
          taskDefinition,
        });
      }, /Supplied TaskDefinition is not configured for compatibility with EC2/);

      test.done();
    },

    'ignore task definition and launch type if deployment controller is set to be EXTERNAL'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      const service = new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
        deploymentController: {
          type: DeploymentControllerType.EXTERNAL,
        },
      });

      // THEN
      test.deepEqual(service.node.metadata[0].data, 'taskDefinition and launchType are blanked out when using external deployment controller.');
      expect(stack).to(haveResource('AWS::ECS::Service', {
        Cluster: {
          Ref: 'EcsCluster97242B84',
        },
        DeploymentConfiguration: {
          MaximumPercent: 200,
          MinimumHealthyPercent: 50,
        },
        SchedulingStrategy: 'REPLICA',
        EnableECSManagedTags: false,
      }));

      test.done();
    },

    'errors if daemon and desiredCount both specified'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');
      taskDefinition.addContainer('BaseContainer', {
        image: ecs.ContainerImage.fromRegistry('test'),
        memoryReservationMiB: 10,
      });

      // THEN
      test.throws(() => {
        new ecs.Ec2Service(stack, 'Ec2Service', {
          cluster,
          taskDefinition,
          daemon: true,
          desiredCount: 2,
        });
      }, /Don't supply desiredCount/);

      test.done();
    },

    'errors if daemon and maximumPercent not 100'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');
      taskDefinition.addContainer('BaseContainer', {
        image: ecs.ContainerImage.fromRegistry('test'),
        memoryReservationMiB: 10,
      });

      // THEN
      test.throws(() => {
        new ecs.Ec2Service(stack, 'Ec2Service', {
          cluster,
          taskDefinition,
          daemon: true,
          maxHealthyPercent: 300,
        });
      }, /Maximum percent must be 100 for daemon mode./);

      test.done();
    },

    'errors if minimum not less than maximum'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');
      taskDefinition.addContainer('BaseContainer', {
        image: ecs.ContainerImage.fromRegistry('test'),
        memoryReservationMiB: 10,
      });

      // THEN
      test.throws(() => {
        new ecs.Ec2Service(stack, 'Ec2Service', {
          cluster,
          taskDefinition,
          daemon: true,
          minHealthyPercent: 100,
          maxHealthyPercent: 100,
        });
      }, /Minimum healthy percent must be less than maximum healthy percent./);

      test.done();
    },

    'errors if no container definitions'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      // Errors on validation, not on construction.
      new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
      });

      // THEN
      test.throws(() => {
        expect(stack);
      }, /one essential container/);

      test.done();
    },

    'allows adding the default container after creating the service'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      new ecs.Ec2Service(stack, 'FargateService', {
        cluster,
        taskDefinition,
      });

      // Add the container *after* creating the service
      taskDefinition.addContainer('main', {
        image: ecs.ContainerImage.fromRegistry('somecontainer'),
        memoryReservationMiB: 10,
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
        ContainerDefinitions: [
          {
            Name: 'main',
          },
        ],
      }));

      test.done();
    },

    'sets daemon scheduling strategy'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
        daemon: true,
      });

      // THEN
      expect(stack).to(haveResource('AWS::ECS::Service', {
        SchedulingStrategy: 'DAEMON',
        DeploymentConfiguration: {
          MaximumPercent: 100,
          MinimumHealthyPercent: 0,
        },
      }));

      test.done();
    },

    'with a TaskDefinition with Bridge network mode': {
      'it errors if vpcSubnets is specified'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();
        const vpc = new ec2.Vpc(stack, 'MyVpc', {});
        const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
        cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
        const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
          networkMode: ecs.NetworkMode.BRIDGE,
        });

        taskDefinition.addContainer('web', {
          image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
          memoryLimitMiB: 512,
        });

        // THEN
        test.throws(() => {
          new ecs.Ec2Service(stack, 'Ec2Service', {
            cluster,
            taskDefinition,
            vpcSubnets: {
              subnetType: ec2.SubnetType.PUBLIC,
            },
          });
        });

        // THEN
        test.done();
      },

      'it errors if assignPublicIp is true'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();
        const vpc = new ec2.Vpc(stack, 'MyVpc', {});
        const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
        cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
        const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
          networkMode: ecs.NetworkMode.BRIDGE,
        });

        taskDefinition.addContainer('web', {
          image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
          memoryLimitMiB: 512,
        });

        // THEN
        test.throws(() => {
          new ecs.Ec2Service(stack, 'Ec2Service', {
            cluster,
            taskDefinition,
            assignPublicIp: true,
          });
        }, /vpcSubnets, securityGroup\(s\) and assignPublicIp can only be used in AwsVpc networking mode/);

        // THEN
        test.done();
      },

      'it errors if vpc subnets is provided'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();
        const vpc = new ec2.Vpc(stack, 'MyVpc', {});
        const subnet = new ec2.Subnet(stack, 'MySubnet', {
          vpcId: vpc.vpcId,
          availabilityZone: 'eu-central-1a',
          cidrBlock: '10.10.0.0/20',
        });
        const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
        cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
        const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
          networkMode: ecs.NetworkMode.BRIDGE,
        });
        taskDefinition.addContainer('web', {
          image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
          memoryLimitMiB: 512,
        });

        // THEN
        test.throws(() => {
          new ecs.Ec2Service(stack, 'Ec2Service', {
            cluster,
            taskDefinition,
            vpcSubnets: {
              subnets: [subnet],
            },
          });
        }, /vpcSubnets, securityGroup\(s\) and assignPublicIp can only be used in AwsVpc networking mode/);

        // THEN
        test.done();
      },

      'it errors if security group is provided'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();
        const vpc = new ec2.Vpc(stack, 'MyVpc', {});
        const securityGroup = new ec2.SecurityGroup(stack, 'MySG', { vpc });
        const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
        cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
        const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
          networkMode: ecs.NetworkMode.BRIDGE,
        });
        taskDefinition.addContainer('web', {
          image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
          memoryLimitMiB: 512,
        });

        // THEN
        test.throws(() => {
          new ecs.Ec2Service(stack, 'Ec2Service', {
            cluster,
            taskDefinition,
            securityGroup,
          });
        }, /vpcSubnets, securityGroup\(s\) and assignPublicIp can only be used in AwsVpc networking mode/);

        // THEN
        test.done();
      },

      'it errors if multiple security groups is provided'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();
        const vpc = new ec2.Vpc(stack, 'MyVpc', {});
        const securityGroups = [
          new ec2.SecurityGroup(stack, 'MyFirstSG', { vpc }),
          new ec2.SecurityGroup(stack, 'MySecondSG', { vpc }),
        ];
        const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
        cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
        const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
          networkMode: ecs.NetworkMode.BRIDGE,
        });
        taskDefinition.addContainer('web', {
          image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
          memoryLimitMiB: 512,
        });

        // THEN
        test.throws(() => {
          new ecs.Ec2Service(stack, 'Ec2Service', {
            cluster,
            taskDefinition,
            securityGroups,
          });
        }, /vpcSubnets, securityGroup\(s\) and assignPublicIp can only be used in AwsVpc networking mode/);

        // THEN
        test.done();
      },
    },

    'with a TaskDefinition with AwsVpc network mode': {
      'it creates a security group for the service'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();
        const vpc = new ec2.Vpc(stack, 'MyVpc', {});
        const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
        cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
        const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
          networkMode: ecs.NetworkMode.AWS_VPC,
        });

        taskDefinition.addContainer('web', {
          image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
          memoryLimitMiB: 512,
        });

        new ecs.Ec2Service(stack, 'Ec2Service', {
          cluster,
          taskDefinition,
        });

        // THEN
        expect(stack).to(haveResource('AWS::ECS::Service', {
          NetworkConfiguration: {
            AwsvpcConfiguration: {
              AssignPublicIp: 'DISABLED',
              SecurityGroups: [
                {
                  'Fn::GetAtt': [
                    'Ec2ServiceSecurityGroupAEC30825',
                    'GroupId',
                  ],
                },
              ],
              Subnets: [
                {
                  Ref: 'MyVpcPrivateSubnet1Subnet5057CF7E',
                },
                {
                  Ref: 'MyVpcPrivateSubnet2Subnet0040C983',
                },
              ],
            },
          },
        }));

        test.done();
      },

      'it allows vpcSubnets'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();
        const vpc = new ec2.Vpc(stack, 'MyVpc', {});
        const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
        cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
        const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
          networkMode: ecs.NetworkMode.AWS_VPC,
        });

        taskDefinition.addContainer('web', {
          image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
          memoryLimitMiB: 512,
        });

        new ecs.Ec2Service(stack, 'Ec2Service', {
          cluster,
          taskDefinition,
          vpcSubnets: {
            subnetType: ec2.SubnetType.PUBLIC,
          },
        });

        // THEN
        test.done();
      },
    },

    'with distinctInstance placement constraint'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
        placementConstraints: [ecs.PlacementConstraint.distinctInstances()],
      });

      // THEN
      expect(stack).to(haveResource('AWS::ECS::Service', {
        PlacementConstraints: [{
          Type: 'distinctInstance',
        }],
      }));

      test.done();
    },

    'with memberOf placement constraints'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      const service = new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
      });

      service.addPlacementConstraints(PlacementConstraint.memberOf('attribute:ecs.instance-type =~ t2.*'));

      // THEN
      expect(stack).to(haveResource('AWS::ECS::Service', {
        PlacementConstraints: [{
          Expression: 'attribute:ecs.instance-type =~ t2.*',
          Type: 'memberOf',
        }],
      }));

      test.done();
    },

    'with spreadAcross container instances strategy'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      const service = new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
      });

      // WHEN
      service.addPlacementStrategies(PlacementStrategy.spreadAcrossInstances());

      // THEN
      expect(stack).to(haveResource('AWS::ECS::Service', {
        PlacementStrategies: [{
          Field: 'instanceId',
          Type: 'spread',
        }],
      }));

      test.done();
    },

    'with spreadAcross placement strategy'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      const service = new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
      });

      service.addPlacementStrategies(PlacementStrategy.spreadAcross(ecs.BuiltInAttributes.AVAILABILITY_ZONE));

      // THEN
      expect(stack).to(haveResource('AWS::ECS::Service', {
        PlacementStrategies: [{
          Field: 'attribute:ecs.availability-zone',
          Type: 'spread',
        }],
      }));

      test.done();
    },

    'can turn PlacementStrategy into json format'(test: Test) {
      // THEN
      test.deepEqual(PlacementStrategy.spreadAcross(ecs.BuiltInAttributes.AVAILABILITY_ZONE).toJson(), [{
        type: 'spread',
        field: 'attribute:ecs.availability-zone',
      }]);

      test.done();
    },

    'can turn PlacementConstraints into json format'(test: Test) {
      // THEN
      test.deepEqual(PlacementConstraint.distinctInstances().toJson(), [{
        type: 'distinctInstance',
      }]);

      test.done();
    },

    'errors when spreadAcross with no input'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      const service = new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
      });

      // THEN
      test.throws(() => {
        service.addPlacementStrategies(PlacementStrategy.spreadAcross());
      }, 'spreadAcross: give at least one field to spread by');

      test.done();
    },

    'errors with spreadAcross placement strategy if daemon specified'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      const service = new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
        daemon: true,
      });

      // THEN
      test.throws(() => {
        service.addPlacementStrategies(PlacementStrategy.spreadAcross(ecs.BuiltInAttributes.AVAILABILITY_ZONE));
      });

      test.done();
    },

    'with no placement constraints'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
      });

      // THEN
      expect(stack).notTo(haveResource('AWS::ECS::Service', {
        PlacementConstraints: undefined,
      }));

      test.done();
    },

    'with both propagateTags and propagateTaskTagsFrom defined'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      test.throws(() => {
        new ecs.Ec2Service(stack, 'Ec2Service', {
          cluster,
          taskDefinition,
          propagateTags: PropagatedTagSource.SERVICE,
          propagateTaskTagsFrom: PropagatedTagSource.SERVICE,
        });
      }, /You can only specify either propagateTags or propagateTaskTagsFrom. Alternatively, you can leave both blank/);
      test.done();
    },

    'with no placement strategy if daemon specified'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
        daemon: true,
      });

      // THEN
      expect(stack).notTo(haveResource('AWS::ECS::Service', {
        PlacementStrategies: undefined,
      }));

      test.done();
    },

    'with random placement strategy'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc');
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      const service = new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
      });

      service.addPlacementStrategies(PlacementStrategy.randomly());

      // THEN
      expect(stack).to(haveResource('AWS::ECS::Service', {
        PlacementStrategies: [{
          Type: 'random',
        }],
      }));

      test.done();
    },

    'errors with random placement strategy if daemon specified'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc');
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      const service = new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
        daemon: true,
      });

      // THEN
      test.throws(() => {
        service.addPlacementStrategies(PlacementStrategy.randomly());
      });

      test.done();
    },

    'with packedbyCpu placement strategy'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      const service = new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
      });

      service.addPlacementStrategies(PlacementStrategy.packedByCpu());

      // THEN
      expect(stack).to(haveResource('AWS::ECS::Service', {
        PlacementStrategies: [{
          Field: 'cpu',
          Type: 'binpack',
        }],
      }));

      test.done();
    },

    'with packedbyMemory placement strategy'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      const service = new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
      });

      service.addPlacementStrategies(PlacementStrategy.packedByMemory());

      // THEN
      expect(stack).to(haveResource('AWS::ECS::Service', {
        PlacementStrategies: [{
          Field: 'memory',
          Type: 'binpack',
        }],
      }));

      test.done();
    },

    'with packedBy placement strategy'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      const service = new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
      });

      service.addPlacementStrategies(PlacementStrategy.packedBy(ecs.BinPackResource.MEMORY));

      // THEN
      expect(stack).to(haveResource('AWS::ECS::Service', {
        PlacementStrategies: [{
          Field: 'memory',
          Type: 'binpack',
        }],
      }));

      test.done();
    },

    'errors with packedBy placement strategy if daemon specified'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');

      taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      const service = new ecs.Ec2Service(stack, 'Ec2Service', {
        cluster,
        taskDefinition,
        daemon: true,
      });

      // THEN
      test.throws(() => {
        service.addPlacementStrategies(PlacementStrategy.packedBy(ecs.BinPackResource.MEMORY));
      });

      test.done();
    },
  },

  'attachToClassicLB': {
    'allows network mode of task definition to be host'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'VPC');
      const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'TD', { networkMode: ecs.NetworkMode.HOST });
      const container = taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('test'),
        memoryLimitMiB: 1024,
      });
      container.addPortMappings({ containerPort: 808 });
      const service = new ecs.Ec2Service(stack, 'Service', {
        cluster,
        taskDefinition,
      });

      // THEN
      const lb = new elb.LoadBalancer(stack, 'LB', { vpc });
      service.attachToClassicLB(lb);

      test.done();
    },

    'allows network mode of task definition to be bridge'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'VPC');
      const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'TD', { networkMode: ecs.NetworkMode.BRIDGE });
      const container = taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('test'),
        memoryLimitMiB: 1024,
      });
      container.addPortMappings({ containerPort: 808 });
      const service = new ecs.Ec2Service(stack, 'Service', {
        cluster,
        taskDefinition,
      });

      // THEN
      const lb = new elb.LoadBalancer(stack, 'LB', { vpc });
      service.attachToClassicLB(lb);

      test.done();
    },

    'throws when network mode of task definition is AwsVpc'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'VPC');
      const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'TD', { networkMode: ecs.NetworkMode.AWS_VPC });
      const container = taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('test'),
        memoryLimitMiB: 1024,
      });
      container.addPortMappings({ containerPort: 808 });
      const service = new ecs.Ec2Service(stack, 'Service', {
        cluster,
        taskDefinition,
      });

      // THEN
      const lb = new elb.LoadBalancer(stack, 'LB', { vpc });
      test.throws(() => {
        service.attachToClassicLB(lb);
      }, /Cannot use a Classic Load Balancer if NetworkMode is AwsVpc. Use Host or Bridge instead./);

      test.done();
    },

    'throws when network mode of task definition is none'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'VPC');
      const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'TD', { networkMode: ecs.NetworkMode.NONE });
      const container = taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('test'),
        memoryLimitMiB: 1024,
      });
      container.addPortMappings({ containerPort: 808 });
      const service = new ecs.Ec2Service(stack, 'Service', {
        cluster,
        taskDefinition,
      });

      // THEN
      const lb = new elb.LoadBalancer(stack, 'LB', { vpc });
      test.throws(() => {
        service.attachToClassicLB(lb);
      }, /Cannot use a Classic Load Balancer if NetworkMode is None. Use Host or Bridge instead./);

      test.done();
    },
  },

  'attachToApplicationTargetGroup': {
    'allows network mode of task definition to be other than none'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', { networkMode: ecs.NetworkMode.AWS_VPC });
      const container = taskDefinition.addContainer('MainContainer', {
        image: ecs.ContainerImage.fromRegistry('hello'),
      });
      container.addPortMappings({ containerPort: 8000 });

      const service = new ecs.Ec2Service(stack, 'Service', {
        cluster,
        taskDefinition,
      });

      const lb = new elbv2.ApplicationLoadBalancer(stack, 'lb', { vpc });
      const listener = lb.addListener('listener', { port: 80 });
      const targetGroup = listener.addTargets('target', {
        port: 80,
      });

      // THEN
      service.attachToApplicationTargetGroup(targetGroup);

      test.done();
    },

    'throws when network mode of task definition is none'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', { networkMode: ecs.NetworkMode.NONE });
      const container = taskDefinition.addContainer('MainContainer', {
        image: ecs.ContainerImage.fromRegistry('hello'),
      });
      container.addPortMappings({ containerPort: 8000 });

      const service = new ecs.Ec2Service(stack, 'Service', {
        cluster,
        taskDefinition,
      });

      const lb = new elbv2.ApplicationLoadBalancer(stack, 'lb', { vpc });
      const listener = lb.addListener('listener', { port: 80 });
      const targetGroup = listener.addTargets('target', {
        port: 80,
      });

      // THEN
      test.throws(() => {
        service.attachToApplicationTargetGroup(targetGroup);
      }, /Cannot use a load balancer if NetworkMode is None. Use Bridge, Host or AwsVpc instead./);

      test.done();
    },

    'correctly setting ingress and egress port': {
      'with bridge/NAT network mode and 0 host port'(test: Test) {
        [ecs.NetworkMode.BRIDGE, ecs.NetworkMode.NAT].forEach((networkMode: ecs.NetworkMode) => {
          // GIVEN
          const stack = new cdk.Stack();
          const vpc = new ec2.Vpc(stack, 'MyVpc', {});
          const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
          cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
          const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', { networkMode });
          const container = taskDefinition.addContainer('MainContainer', {
            image: ecs.ContainerImage.fromRegistry('hello'),
            memoryLimitMiB: 512,
          });
          container.addPortMappings({ containerPort: 8000 });
          container.addPortMappings({ containerPort: 8001 });

          const service = new ecs.Ec2Service(stack, 'Service', {
            cluster,
            taskDefinition,
          });

          // WHEN
          const lb = new elbv2.ApplicationLoadBalancer(stack, 'lb', { vpc });
          const listener = lb.addListener('listener', { port: 80 });
          listener.addTargets('target', {
            port: 80,
            targets: [service.loadBalancerTarget({
              containerName: 'MainContainer',
              containerPort: 8001,
            })],
          });

          // THEN
          expect(stack).to(haveResource('AWS::EC2::SecurityGroupIngress', {
            Description: 'Load balancer to target',
            FromPort: 32768,
            ToPort: 65535,
          }));

          expect(stack).to(haveResource('AWS::EC2::SecurityGroupEgress', {
            Description: 'Load balancer to target',
            FromPort: 32768,
            ToPort: 65535,
          }));
        });

        test.done();
      },

      'with bridge/NAT network mode and host port other than 0'(test: Test) {
        [ecs.NetworkMode.BRIDGE, ecs.NetworkMode.NAT].forEach((networkMode: ecs.NetworkMode) => {
          // GIVEN
          const stack = new cdk.Stack();
          const vpc = new ec2.Vpc(stack, 'MyVpc', {});
          const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
          cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
          const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', { networkMode });
          const container = taskDefinition.addContainer('MainContainer', {
            image: ecs.ContainerImage.fromRegistry('hello'),
            memoryLimitMiB: 512,
          });
          container.addPortMappings({ containerPort: 8000 });
          container.addPortMappings({ containerPort: 8001, hostPort: 80 });

          const service = new ecs.Ec2Service(stack, 'Service', {
            cluster,
            taskDefinition,
          });

          // WHEN
          const lb = new elbv2.ApplicationLoadBalancer(stack, 'lb', { vpc });
          const listener = lb.addListener('listener', { port: 80 });
          listener.addTargets('target', {
            port: 80,
            targets: [service.loadBalancerTarget({
              containerName: 'MainContainer',
              containerPort: 8001,
            })],
          });

          // THEN
          expect(stack).to(haveResource('AWS::EC2::SecurityGroupIngress', {
            Description: 'Load balancer to target',
            FromPort: 80,
            ToPort: 80,
          }));

          expect(stack).to(haveResource('AWS::EC2::SecurityGroupEgress', {
            Description: 'Load balancer to target',
            FromPort: 80,
            ToPort: 80,
          }));
        });

        test.done();
      },

      'with host network mode'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();
        const vpc = new ec2.Vpc(stack, 'MyVpc', {});
        const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
        cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
        const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', { networkMode: ecs.NetworkMode.HOST });
        const container = taskDefinition.addContainer('MainContainer', {
          image: ecs.ContainerImage.fromRegistry('hello'),
          memoryLimitMiB: 512,
        });
        container.addPortMappings({ containerPort: 8000 });
        container.addPortMappings({ containerPort: 8001 });

        const service = new ecs.Ec2Service(stack, 'Service', {
          cluster,
          taskDefinition,
        });

        // WHEN
        const lb = new elbv2.ApplicationLoadBalancer(stack, 'lb', { vpc });
        const listener = lb.addListener('listener', { port: 80 });
        listener.addTargets('target', {
          port: 80,
          targets: [service.loadBalancerTarget({
            containerName: 'MainContainer',
            containerPort: 8001,
          })],
        });

        // THEN
        expect(stack).to(haveResource('AWS::EC2::SecurityGroupIngress', {
          Description: 'Load balancer to target',
          FromPort: 8001,
          ToPort: 8001,
        }));

        expect(stack).to(haveResource('AWS::EC2::SecurityGroupEgress', {
          Description: 'Load balancer to target',
          FromPort: 8001,
          ToPort: 8001,
        }));

        test.done();
      },

      'with aws_vpc network mode'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();
        const vpc = new ec2.Vpc(stack, 'MyVpc', {});
        const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
        cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
        const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', { networkMode: ecs.NetworkMode.AWS_VPC });
        const container = taskDefinition.addContainer('MainContainer', {
          image: ecs.ContainerImage.fromRegistry('hello'),
          memoryLimitMiB: 512,
        });
        container.addPortMappings({ containerPort: 8000 });
        container.addPortMappings({ containerPort: 8001 });

        const service = new ecs.Ec2Service(stack, 'Service', {
          cluster,
          taskDefinition,
        });

        // WHEN
        const lb = new elbv2.ApplicationLoadBalancer(stack, 'lb', { vpc });
        const listener = lb.addListener('listener', { port: 80 });
        listener.addTargets('target', {
          port: 80,
          targets: [service.loadBalancerTarget({
            containerName: 'MainContainer',
            containerPort: 8001,
          })],
        });

        // THEN
        expect(stack).to(haveResource('AWS::EC2::SecurityGroupIngress', {
          Description: 'Load balancer to target',
          FromPort: 8001,
          ToPort: 8001,
        }));

        expect(stack).to(haveResource('AWS::EC2::SecurityGroupEgress', {
          Description: 'Load balancer to target',
          FromPort: 8001,
          ToPort: 8001,
        }));

        test.done();
      },
    },
  },

  'attachToNetworkTargetGroup': {
    'allows network mode of task definition to be other than none'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', { networkMode: ecs.NetworkMode.AWS_VPC });
      const container = taskDefinition.addContainer('MainContainer', {
        image: ecs.ContainerImage.fromRegistry('hello'),
      });
      container.addPortMappings({ containerPort: 8000 });

      const service = new ecs.Ec2Service(stack, 'Service', {
        cluster,
        taskDefinition,
      });

      const lb = new elbv2.NetworkLoadBalancer(stack, 'lb', { vpc });
      const listener = lb.addListener('listener', { port: 80 });
      const targetGroup = listener.addTargets('target', {
        port: 80,
      });

      // THEN
      service.attachToNetworkTargetGroup(targetGroup);

      test.done();
    },

    'throws when network mode of task definition is none'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', { networkMode: ecs.NetworkMode.NONE });
      const container = taskDefinition.addContainer('MainContainer', {
        image: ecs.ContainerImage.fromRegistry('hello'),
      });
      container.addPortMappings({ containerPort: 8000 });

      const service = new ecs.Ec2Service(stack, 'Service', {
        cluster,
        taskDefinition,
      });

      const lb = new elbv2.NetworkLoadBalancer(stack, 'lb', { vpc });
      const listener = lb.addListener('listener', { port: 80 });
      const targetGroup = listener.addTargets('target', {
        port: 80,
      });

      // THEN
      test.throws(() => {
        service.attachToNetworkTargetGroup(targetGroup);
      }, /Cannot use a load balancer if NetworkMode is None. Use Bridge, Host or AwsVpc instead./);

      test.done();
    },
  },

  'classic ELB': {
    'can attach to classic ELB'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'VPC');
      const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'TD', { networkMode: ecs.NetworkMode.HOST });
      const container = taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('test'),
        memoryLimitMiB: 1024,
      });
      container.addPortMappings({ containerPort: 808 });
      const service = new ecs.Ec2Service(stack, 'Service', {
        cluster,
        taskDefinition,
      });

      // WHEN
      const lb = new elb.LoadBalancer(stack, 'LB', { vpc });
      lb.addTarget(service);

      // THEN
      expect(stack).to(haveResource('AWS::ECS::Service', {
        LoadBalancers: [
          {
            ContainerName: 'web',
            ContainerPort: 808,
            LoadBalancerName: { Ref: 'LB8A12904C' },
          },
        ],
      }));

      expect(stack).to(haveResource('AWS::ECS::Service', {
        // if any load balancer is configured and healthCheckGracePeriodSeconds is not
        // set, then it should default to 60 seconds.
        HealthCheckGracePeriodSeconds: 60,
      }));

      test.done();
    },

    'can attach any container and port as a target'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'VPC');
      const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'TD', { networkMode: ecs.NetworkMode.HOST });
      const container = taskDefinition.addContainer('web', {
        image: ecs.ContainerImage.fromRegistry('test'),
        memoryLimitMiB: 1024,
      });
      container.addPortMappings({ containerPort: 808 });
      container.addPortMappings({ containerPort: 8080 });
      const service = new ecs.Ec2Service(stack, 'Service', {
        cluster,
        taskDefinition,
      });

      // WHEN
      const lb = new elb.LoadBalancer(stack, 'LB', { vpc });
      lb.addTarget(service.loadBalancerTarget({
        containerName: 'web',
        containerPort: 8080,
      }));

      // THEN
      expect(stack).to(haveResource('AWS::ECS::Service', {
        LoadBalancers: [
          {
            ContainerName: 'web',
            ContainerPort: 8080,
            LoadBalancerName: { Ref: 'LB8A12904C' },
          },
        ],
      }));

      test.done();
    },
  },

  'When enabling service discovery': {
    'throws if namespace has not been added to cluster'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

      // default network mode is bridge
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');
      const container = taskDefinition.addContainer('MainContainer', {
        image: ecs.ContainerImage.fromRegistry('hello'),
        memoryLimitMiB: 512,
      });
      container.addPortMappings({ containerPort: 8000 });

      // THEN
      test.throws(() => {
        new ecs.Ec2Service(stack, 'Service', {
          cluster,
          taskDefinition,
          cloudMapOptions: {
            name: 'myApp',
          },
        });
      }, /Cannot enable service discovery if a Cloudmap Namespace has not been created in the cluster./);

      test.done();
    },

    'throws if network mode is none'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
        networkMode: ecs.NetworkMode.NONE,
      });
      const container = taskDefinition.addContainer('MainContainer', {
        image: ecs.ContainerImage.fromRegistry('hello'),
        memoryLimitMiB: 512,
      });
      container.addPortMappings({ containerPort: 8000 });

      cluster.addDefaultCloudMapNamespace({ name: 'foo.com' });

      // THEN
      test.throws(() => {
        new ecs.Ec2Service(stack, 'Service', {
          cluster,
          taskDefinition,
          cloudMapOptions: {
            name: 'myApp',
          },
        });
      }, /Cannot use a service discovery if NetworkMode is None. Use Bridge, Host or AwsVpc instead./);

      test.done();
    },

    'creates AWS Cloud Map service for Private DNS namespace with bridge network mode'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

      // default network mode is bridge
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');
      const container = taskDefinition.addContainer('MainContainer', {
        image: ecs.ContainerImage.fromRegistry('hello'),
        memoryLimitMiB: 512,
      });
      container.addPortMappings({ containerPort: 8000 });

      // WHEN
      cluster.addDefaultCloudMapNamespace({
        name: 'foo.com',
        type: cloudmap.NamespaceType.DNS_PRIVATE,
      });

      new ecs.Ec2Service(stack, 'Service', {
        cluster,
        taskDefinition,
        cloudMapOptions: {
          name: 'myApp',
        },
      });

      // THEN
      expect(stack).to(haveResource('AWS::ECS::Service', {
        ServiceRegistries: [
          {
            ContainerName: 'MainContainer',
            ContainerPort: 8000,
            RegistryArn: {
              'Fn::GetAtt': [
                'ServiceCloudmapService046058A4',
                'Arn',
              ],
            },
          },
        ],
      }));

      expect(stack).to(haveResource('AWS::ServiceDiscovery::Service', {
        DnsConfig: {
          DnsRecords: [
            {
              TTL: 60,
              Type: 'SRV',
            },
          ],
          NamespaceId: {
            'Fn::GetAtt': [
              'EcsClusterDefaultServiceDiscoveryNamespaceB0971B2F',
              'Id',
            ],
          },
          RoutingPolicy: 'MULTIVALUE',
        },
        HealthCheckCustomConfig: {
          FailureThreshold: 1,
        },
        Name: 'myApp',
        NamespaceId: {
          'Fn::GetAtt': [
            'EcsClusterDefaultServiceDiscoveryNamespaceB0971B2F',
            'Id',
          ],
        },
      }));

      test.done();
    },

    'creates AWS Cloud Map service for Private DNS namespace with host network mode'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
        networkMode: ecs.NetworkMode.HOST,
      });
      const container = taskDefinition.addContainer('MainContainer', {
        image: ecs.ContainerImage.fromRegistry('hello'),
        memoryLimitMiB: 512,
      });
      container.addPortMappings({ containerPort: 8000 });

      // WHEN
      cluster.addDefaultCloudMapNamespace({
        name: 'foo.com',
        type: cloudmap.NamespaceType.DNS_PRIVATE,
      });

      new ecs.Ec2Service(stack, 'Service', {
        cluster,
        taskDefinition,
        cloudMapOptions: {
          name: 'myApp',
        },
      });

      // THEN
      expect(stack).to(haveResource('AWS::ECS::Service', {
        ServiceRegistries: [
          {
            ContainerName: 'MainContainer',
            ContainerPort: 8000,
            RegistryArn: {
              'Fn::GetAtt': [
                'ServiceCloudmapService046058A4',
                'Arn',
              ],
            },
          },
        ],
      }));

      expect(stack).to(haveResource('AWS::ServiceDiscovery::Service', {
        DnsConfig: {
          DnsRecords: [
            {
              TTL: 60,
              Type: 'SRV',
            },
          ],
          NamespaceId: {
            'Fn::GetAtt': [
              'EcsClusterDefaultServiceDiscoveryNamespaceB0971B2F',
              'Id',
            ],
          },
          RoutingPolicy: 'MULTIVALUE',
        },
        HealthCheckCustomConfig: {
          FailureThreshold: 1,
        },
        Name: 'myApp',
        NamespaceId: {
          'Fn::GetAtt': [
            'EcsClusterDefaultServiceDiscoveryNamespaceB0971B2F',
            'Id',
          ],
        },
      }));

      test.done();
    },

    'throws if wrong DNS record type specified with bridge network mode'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

      // default network mode is bridge
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');
      const container = taskDefinition.addContainer('MainContainer', {
        image: ecs.ContainerImage.fromRegistry('hello'),
        memoryLimitMiB: 512,
      });
      container.addPortMappings({ containerPort: 8000 });

      cluster.addDefaultCloudMapNamespace({
        name: 'foo.com',
      });

      // THEN
      test.throws(() => {
        new ecs.Ec2Service(stack, 'Service', {
          cluster,
          taskDefinition,
          cloudMapOptions: {
            name: 'myApp',
            dnsRecordType: cloudmap.DnsRecordType.A,
          },
        });
      }, /SRV records must be used when network mode is Bridge or Host./);

      test.done();
    },

    'creates AWS Cloud Map service for Private DNS namespace with AwsVpc network mode'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
        networkMode: ecs.NetworkMode.AWS_VPC,
      });
      const container = taskDefinition.addContainer('MainContainer', {
        image: ecs.ContainerImage.fromRegistry('hello'),
        memoryLimitMiB: 512,
      });
      container.addPortMappings({ containerPort: 8000 });

      // WHEN
      cluster.addDefaultCloudMapNamespace({
        name: 'foo.com',
        type: cloudmap.NamespaceType.DNS_PRIVATE,
      });

      new ecs.Ec2Service(stack, 'Service', {
        cluster,
        taskDefinition,
        cloudMapOptions: {
          name: 'myApp',
        },
      });

      // THEN
      expect(stack).to(haveResource('AWS::ECS::Service', {
        ServiceRegistries: [
          {
            RegistryArn: {
              'Fn::GetAtt': [
                'ServiceCloudmapService046058A4',
                'Arn',
              ],
            },
          },
        ],
      }));

      expect(stack).to(haveResource('AWS::ServiceDiscovery::Service', {
        DnsConfig: {
          DnsRecords: [
            {
              TTL: 60,
              Type: 'A',
            },
          ],
          NamespaceId: {
            'Fn::GetAtt': [
              'EcsClusterDefaultServiceDiscoveryNamespaceB0971B2F',
              'Id',
            ],
          },
          RoutingPolicy: 'MULTIVALUE',
        },
        HealthCheckCustomConfig: {
          FailureThreshold: 1,
        },
        Name: 'myApp',
        NamespaceId: {
          'Fn::GetAtt': [
            'EcsClusterDefaultServiceDiscoveryNamespaceB0971B2F',
            'Id',
          ],
        },
      }));

      test.done();
    },

    'creates AWS Cloud Map service for Private DNS namespace with AwsVpc network mode with SRV records'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
        networkMode: ecs.NetworkMode.AWS_VPC,
      });
      const container = taskDefinition.addContainer('MainContainer', {
        image: ecs.ContainerImage.fromRegistry('hello'),
        memoryLimitMiB: 512,
      });
      container.addPortMappings({ containerPort: 8000 });

      // WHEN
      cluster.addDefaultCloudMapNamespace({
        name: 'foo.com',
        type: cloudmap.NamespaceType.DNS_PRIVATE,
      });

      new ecs.Ec2Service(stack, 'Service', {
        cluster,
        taskDefinition,
        cloudMapOptions: {
          name: 'myApp',
          dnsRecordType: cloudmap.DnsRecordType.SRV,
        },
      });

      // THEN
      expect(stack).to(haveResource('AWS::ECS::Service', {
        ServiceRegistries: [
          {
            ContainerName: 'MainContainer',
            ContainerPort: 8000,
            RegistryArn: {
              'Fn::GetAtt': [
                'ServiceCloudmapService046058A4',
                'Arn',
              ],
            },
          },
        ],
      }));

      expect(stack).to(haveResource('AWS::ServiceDiscovery::Service', {
        DnsConfig: {
          DnsRecords: [
            {
              TTL: 60,
              Type: 'SRV',
            },
          ],
          NamespaceId: {
            'Fn::GetAtt': [
              'EcsClusterDefaultServiceDiscoveryNamespaceB0971B2F',
              'Id',
            ],
          },
          RoutingPolicy: 'MULTIVALUE',
        },
        HealthCheckCustomConfig: {
          FailureThreshold: 1,
        },
        Name: 'myApp',
        NamespaceId: {
          'Fn::GetAtt': [
            'EcsClusterDefaultServiceDiscoveryNamespaceB0971B2F',
            'Id',
          ],
        },
      }));

      test.done();
    },

    'user can select any container and port'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      cluster.addDefaultCloudMapNamespace({
        name: 'foo.com',
        type: cloudmap.NamespaceType.DNS_PRIVATE,
      });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'FargateTaskDef', {
        networkMode: ecs.NetworkMode.BRIDGE,
      });

      const mainContainer = taskDefinition.addContainer('MainContainer', {
        image: ecs.ContainerImage.fromRegistry('hello'),
        memoryLimitMiB: 512,
      });
      mainContainer.addPortMappings({ containerPort: 8000 });

      const otherContainer = taskDefinition.addContainer('OtherContainer', {
        image: ecs.ContainerImage.fromRegistry('hello'),
        memoryLimitMiB: 512,
      });
      otherContainer.addPortMappings({ containerPort: 8001 });

      // WHEN
      new ecs.Ec2Service(stack, 'Service', {
        cluster,
        taskDefinition,
        cloudMapOptions: {
          dnsRecordType: cloudmap.DnsRecordType.SRV,
          container: otherContainer,
          containerPort: 8001,
        },
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::ECS::Service', {
        ServiceRegistries: [
          {
            RegistryArn: { 'Fn::GetAtt': ['ServiceCloudmapService046058A4', 'Arn'] },
            ContainerName: 'OtherContainer',
            ContainerPort: 8001,
          },
        ],
      }));

      test.done();
    },

    'By default, the container name is the default'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      cluster.addDefaultCloudMapNamespace({
        name: 'foo.com',
        type: cloudmap.NamespaceType.DNS_PRIVATE,
      });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Task', {
        networkMode: ecs.NetworkMode.BRIDGE,
      });

      taskDefinition.addContainer('main', {
        image: ecs.ContainerImage.fromRegistry('some'),
        memoryLimitMiB: 512,
      }).addPortMappings({ containerPort: 1234 });

      taskDefinition.addContainer('second', {
        image: ecs.ContainerImage.fromRegistry('some'),
        memoryLimitMiB: 512,
      }).addPortMappings({ containerPort: 4321 });

      // WHEN
      new ecs.Ec2Service(stack, 'Service', {
        cluster,
        taskDefinition,
        cloudMapOptions: {},
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::ECS::Service', {
        ServiceRegistries: [{
          ContainerName: 'main',
          ContainerPort: undefined,
        }],
      }));

      test.done();
    },

    'For SRV, by default, container name is default container and port is the default container port'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      cluster.addDefaultCloudMapNamespace({
        name: 'foo.com',
        type: cloudmap.NamespaceType.DNS_PRIVATE,
      });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Task', {
        networkMode: ecs.NetworkMode.BRIDGE,
      });

      taskDefinition.addContainer('main', {
        image: ecs.ContainerImage.fromRegistry('some'),
        memoryLimitMiB: 512,
      }).addPortMappings({ containerPort: 1234 });

      taskDefinition.addContainer('second', {
        image: ecs.ContainerImage.fromRegistry('some'),
        memoryLimitMiB: 512,
      }).addPortMappings({ containerPort: 4321 });

      // WHEN
      new ecs.Ec2Service(stack, 'Service', {
        cluster,
        taskDefinition,
        cloudMapOptions: {
          dnsRecordType: cloudmap.DnsRecordType.SRV,
        },
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::ECS::Service', {
        ServiceRegistries: [{
          ContainerName: 'main',
          ContainerPort: 1234,
        }],
      }));

      test.done();
    },

    'allows SRV service discovery to select the container and port'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      cluster.addDefaultCloudMapNamespace({
        name: 'foo.com',
        type: cloudmap.NamespaceType.DNS_PRIVATE,
      });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Task', {
        networkMode: ecs.NetworkMode.BRIDGE,
      });

      taskDefinition.addContainer('main', {
        image: ecs.ContainerImage.fromRegistry('some'),
        memoryLimitMiB: 512,
      }).addPortMappings({ containerPort: 1234 });

      const secondContainer = taskDefinition.addContainer('second', {
        image: ecs.ContainerImage.fromRegistry('some'),
        memoryLimitMiB: 512,
      });
      secondContainer.addPortMappings({ containerPort: 4321 });

      // WHEN
      new ecs.Ec2Service(stack, 'Service', {
        cluster,
        taskDefinition,
        cloudMapOptions: {
          dnsRecordType: cloudmap.DnsRecordType.SRV,
          container: secondContainer,
          containerPort: 4321,
        },
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::ECS::Service', {
        ServiceRegistries: [{
          ContainerName: 'second',
          ContainerPort: 4321,
        }],
      }));

      test.done();
    },

    'throws if SRV and container is not part of task definition'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      cluster.addDefaultCloudMapNamespace({
        name: 'foo.com',
        type: cloudmap.NamespaceType.DNS_PRIVATE,
      });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Task', {
        networkMode: ecs.NetworkMode.BRIDGE,
      });

      // The right container
      taskDefinition.addContainer('MainContainer', {
        image: ecs.ContainerImage.fromRegistry('hello'),
        memoryLimitMiB: 512,
      });

      const wrongTaskDefinition = new ecs.Ec2TaskDefinition(stack, 'WrongTaskDef');
      // The wrong container
      const wrongContainer = wrongTaskDefinition.addContainer('MainContainer', {
        image: ecs.ContainerImage.fromRegistry('hello'),
        memoryLimitMiB: 512,
      });

      // WHEN
      test.throws(() => {
        new ecs.Ec2Service(stack, 'Service', {
          cluster,
          taskDefinition,
          cloudMapOptions: {
            dnsRecordType: cloudmap.DnsRecordType.SRV,
            container: wrongContainer,
            containerPort: 4321,
          },
        });
      }, /another task definition/i);

      test.done();
    },

    'throws if SRV and the container port is not mapped'(test: Test) {
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
      cluster.addDefaultCloudMapNamespace({
        name: 'foo.com',
        type: cloudmap.NamespaceType.DNS_PRIVATE,
      });
      const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Task', {
        networkMode: ecs.NetworkMode.BRIDGE,
      });

      const container = taskDefinition.addContainer('MainContainer', {
        image: ecs.ContainerImage.fromRegistry('hello'),
        memoryLimitMiB: 512,
      });

      container.addPortMappings({ containerPort: 8000 });

      test.throws(() => {
        new ecs.Ec2Service(stack, 'Service', {
          cluster,
          taskDefinition,
          cloudMapOptions: {
            dnsRecordType: cloudmap.DnsRecordType.SRV,
            container: container,
            containerPort: 4321,
          },
        });
      }, /container port.*not.*mapped/i);

      test.done();
    },
  },

  'Metric'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'MyVpc', {});
    const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
    const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'FargateTaskDef');
    taskDefinition.addContainer('Container', {
      image: ecs.ContainerImage.fromRegistry('hello'),
    });

    // WHEN
    const service = new ecs.Ec2Service(stack, 'Service', {
      cluster,
      taskDefinition,
    });

    // THEN
    test.deepEqual(stack.resolve(service.metricMemoryUtilization()), {
      dimensions: {
        ClusterName: { Ref: 'EcsCluster97242B84' },
        ServiceName: { 'Fn::GetAtt': ['ServiceD69D759B', 'Name'] },
      },
      namespace: 'AWS/ECS',
      metricName: 'MemoryUtilization',
      period: cdk.Duration.minutes(5),
      statistic: 'Average',
    });

    test.deepEqual(stack.resolve(service.metricCpuUtilization()), {
      dimensions: {
        ClusterName: { Ref: 'EcsCluster97242B84' },
        ServiceName: { 'Fn::GetAtt': ['ServiceD69D759B', 'Name'] },
      },
      namespace: 'AWS/ECS',
      metricName: 'CPUUtilization',
      period: cdk.Duration.minutes(5),
      statistic: 'Average',
    });

    test.done();
  },

  'When import an EC2 Service': {
    'with serviceArn'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const cluster = new ecs.Cluster(stack, 'EcsCluster');

      // WHEN
      const service = ecs.Ec2Service.fromEc2ServiceAttributes(stack, 'EcsService', {
        serviceArn: 'arn:aws:ecs:us-west-2:123456789012:service/my-http-service',
        cluster,
      });

      // THEN
      test.equal(service.serviceArn, 'arn:aws:ecs:us-west-2:123456789012:service/my-http-service');
      test.equal(service.serviceName, 'my-http-service');

      test.done();
    },

    'with serviceName'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const pseudo = new cdk.ScopedAws(stack);
      const cluster = new ecs.Cluster(stack, 'EcsCluster');

      // WHEN
      const service = ecs.Ec2Service.fromEc2ServiceAttributes(stack, 'EcsService', {
        serviceName: 'my-http-service',
        cluster,
      });

      // THEN
      test.deepEqual(stack.resolve(service.serviceArn), stack.resolve(`arn:${pseudo.partition}:ecs:${pseudo.region}:${pseudo.accountId}:service/my-http-service`));
      test.equal(service.serviceName, 'my-http-service');

      test.done();
    },

    'throws an exception if both serviceArn and serviceName were provided for fromEc2ServiceAttributes'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const cluster = new ecs.Cluster(stack, 'EcsCluster');

      test.throws(() => {
        ecs.Ec2Service.fromEc2ServiceAttributes(stack, 'EcsService', {
          serviceArn: 'arn:aws:ecs:us-west-2:123456789012:service/my-http-service',
          serviceName: 'my-http-service',
          cluster,
        });
      }, /only specify either serviceArn or serviceName/);

      test.done();
    },

    'throws an exception if neither serviceArn nor serviceName were provided for fromEc2ServiceAttributes'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const cluster = new ecs.Cluster(stack, 'EcsCluster');

      test.throws(() => {
        ecs.Ec2Service.fromEc2ServiceAttributes(stack, 'EcsService', {
          cluster,
        });
      }, /only specify either serviceArn or serviceName/);

      test.done();
    },
  },
});
