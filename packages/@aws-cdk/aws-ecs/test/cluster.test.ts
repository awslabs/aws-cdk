import {
  countResources,
  expect,
  haveResource,
  haveResourceLike,
  ResourcePart,
  ABSENT,
} from '@aws-cdk/assert-internal';
import * as autoscaling from '@aws-cdk/aws-autoscaling';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as kms from '@aws-cdk/aws-kms';
import * as logs from '@aws-cdk/aws-logs';
import * as s3 from '@aws-cdk/aws-s3';
import * as cloudmap from '@aws-cdk/aws-servicediscovery';
import * as cdk from '@aws-cdk/core';
import { nodeunitShim, Test } from 'nodeunit-shim';
import * as ecs from '../lib';

nodeunitShim({
  'When creating an ECS Cluster': {
    'with no properties set, it correctly sets default properties'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const cluster = new ecs.Cluster(stack, 'EcsCluster');

      cluster.addCapacity('DefaultAutoScalingGroup', {
        instanceType: new ec2.InstanceType('t2.micro'),
      });

      expect(stack).to(haveResource('AWS::ECS::Cluster'));

      expect(stack).to(haveResource('AWS::EC2::VPC', {
        CidrBlock: '10.0.0.0/16',
        EnableDnsHostnames: true,
        EnableDnsSupport: true,
        InstanceTenancy: ec2.DefaultInstanceTenancy.DEFAULT,
        Tags: [
          {
            Key: 'Name',
            Value: 'Default/EcsCluster/Vpc',
          },
        ],
      }));

      expect(stack).to(haveResource('AWS::AutoScaling::LaunchConfiguration', {
        ImageId: {
          Ref: 'SsmParameterValueawsserviceecsoptimizedamiamazonlinux2recommendedimageidC96584B6F00A464EAD1953AFF4B05118Parameter',
        },
        InstanceType: 't2.micro',
        IamInstanceProfile: {
          Ref: 'EcsClusterDefaultAutoScalingGroupInstanceProfile2CE606B3',
        },
        SecurityGroups: [
          {
            'Fn::GetAtt': [
              'EcsClusterDefaultAutoScalingGroupInstanceSecurityGroup912E1231',
              'GroupId',
            ],
          },
        ],
        UserData: {
          'Fn::Base64': {
            'Fn::Join': [
              '',
              [
                '#!/bin/bash\necho ECS_CLUSTER=',
                {
                  Ref: 'EcsCluster97242B84',
                },
                // eslint-disable-next-line max-len
                ' >> /etc/ecs/ecs.config\nsudo iptables --insert FORWARD 1 --in-interface docker+ --destination 169.254.169.254/32 --jump DROP\nsudo service iptables save\necho ECS_AWSVPC_BLOCK_IMDS=true >> /etc/ecs/ecs.config',
              ],
            ],
          },
        },
      }));

      expect(stack).to(haveResource('AWS::AutoScaling::AutoScalingGroup', {
        MaxSize: '1',
        MinSize: '1',
        LaunchConfigurationName: {
          Ref: 'EcsClusterDefaultAutoScalingGroupLaunchConfigB7E376C1',
        },
        Tags: [
          {
            Key: 'Name',
            PropagateAtLaunch: true,
            Value: 'Default/EcsCluster/DefaultAutoScalingGroup',
          },
        ],
        VPCZoneIdentifier: [
          {
            Ref: 'EcsClusterVpcPrivateSubnet1SubnetFAB0E487',
          },
          {
            Ref: 'EcsClusterVpcPrivateSubnet2SubnetC2B7B1BA',
          },
        ],
      }));

      expect(stack).to(haveResource('AWS::EC2::SecurityGroup', {
        GroupDescription: 'Default/EcsCluster/DefaultAutoScalingGroup/InstanceSecurityGroup',
        SecurityGroupEgress: [
          {
            CidrIp: '0.0.0.0/0',
            Description: 'Allow all outbound traffic by default',
            IpProtocol: '-1',
          },
        ],
        Tags: [
          {
            Key: 'Name',
            Value: 'Default/EcsCluster/DefaultAutoScalingGroup',
          },
        ],
        VpcId: {
          Ref: 'EcsClusterVpc779914AB',
        },
      }));

      expect(stack).to(haveResource('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: { 'Fn::Join': ['', ['ec2.', { Ref: 'AWS::URLSuffix' }]] },
              },
            },
          ],
          Version: '2012-10-17',
        },
      }));

      expect(stack).to(haveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: [
                'ecs:DeregisterContainerInstance',
                'ecs:RegisterContainerInstance',
                'ecs:Submit*',
              ],
              Effect: 'Allow',
              Resource: {
                'Fn::GetAtt': [
                  'EcsCluster97242B84',
                  'Arn',
                ],
              },
            },
            {
              Action: [
                'ecs:Poll',
                'ecs:StartTelemetrySession',
              ],
              Effect: 'Allow',
              Resource: '*',
              Condition: {
                ArnEquals: {
                  'ecs:cluster': {
                    'Fn::GetAtt': [
                      'EcsCluster97242B84',
                      'Arn',
                    ],
                  },
                },
              },
            },
            {
              Action: [
                'ecs:DiscoverPollEndpoint',
                'ecr:GetAuthorizationToken',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              Effect: 'Allow',
              Resource: '*',
            },
          ],
          Version: '2012-10-17',
        },
      }));

      test.done();
    },

    'with only vpc set, it correctly sets default properties'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', {
        vpc,
      });

      cluster.addCapacity('DefaultAutoScalingGroup', {
        instanceType: new ec2.InstanceType('t2.micro'),
      });

      expect(stack).to(haveResource('AWS::ECS::Cluster'));

      expect(stack).to(haveResource('AWS::EC2::VPC', {
        CidrBlock: '10.0.0.0/16',
        EnableDnsHostnames: true,
        EnableDnsSupport: true,
        InstanceTenancy: ec2.DefaultInstanceTenancy.DEFAULT,
        Tags: [
          {
            Key: 'Name',
            Value: 'Default/MyVpc',
          },
        ],
      }));

      expect(stack).to(haveResource('AWS::AutoScaling::LaunchConfiguration', {
        ImageId: {
          Ref: 'SsmParameterValueawsserviceecsoptimizedamiamazonlinux2recommendedimageidC96584B6F00A464EAD1953AFF4B05118Parameter',
        },
        InstanceType: 't2.micro',
        IamInstanceProfile: {
          Ref: 'EcsClusterDefaultAutoScalingGroupInstanceProfile2CE606B3',
        },
        SecurityGroups: [
          {
            'Fn::GetAtt': [
              'EcsClusterDefaultAutoScalingGroupInstanceSecurityGroup912E1231',
              'GroupId',
            ],
          },
        ],
        UserData: {
          'Fn::Base64': {
            'Fn::Join': [
              '',
              [
                '#!/bin/bash\necho ECS_CLUSTER=',
                {
                  Ref: 'EcsCluster97242B84',
                },
                // eslint-disable-next-line max-len
                ' >> /etc/ecs/ecs.config\nsudo iptables --insert FORWARD 1 --in-interface docker+ --destination 169.254.169.254/32 --jump DROP\nsudo service iptables save\necho ECS_AWSVPC_BLOCK_IMDS=true >> /etc/ecs/ecs.config',
              ],
            ],
          },
        },
      }));

      expect(stack).to(haveResource('AWS::AutoScaling::AutoScalingGroup', {
        MaxSize: '1',
        MinSize: '1',
        LaunchConfigurationName: {
          Ref: 'EcsClusterDefaultAutoScalingGroupLaunchConfigB7E376C1',
        },
        Tags: [
          {
            Key: 'Name',
            PropagateAtLaunch: true,
            Value: 'Default/EcsCluster/DefaultAutoScalingGroup',
          },
        ],
        VPCZoneIdentifier: [
          {
            Ref: 'MyVpcPrivateSubnet1Subnet5057CF7E',
          },
          {
            Ref: 'MyVpcPrivateSubnet2Subnet0040C983',
          },
        ],
      }));

      expect(stack).to(haveResource('AWS::EC2::SecurityGroup', {
        GroupDescription: 'Default/EcsCluster/DefaultAutoScalingGroup/InstanceSecurityGroup',
        SecurityGroupEgress: [
          {
            CidrIp: '0.0.0.0/0',
            Description: 'Allow all outbound traffic by default',
            IpProtocol: '-1',
          },
        ],
        Tags: [
          {
            Key: 'Name',
            Value: 'Default/EcsCluster/DefaultAutoScalingGroup',
          },
        ],
        VpcId: {
          Ref: 'MyVpcF9F0CA6F',
        },
      }));

      expect(stack).to(haveResource('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: { 'Fn::Join': ['', ['ec2.', { Ref: 'AWS::URLSuffix' }]] },
              },
            },
          ],
          Version: '2012-10-17',
        },
      }));

      expect(stack).to(haveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: [
                'ecs:DeregisterContainerInstance',
                'ecs:RegisterContainerInstance',
                'ecs:Submit*',
              ],
              Effect: 'Allow',
              Resource: {
                'Fn::GetAtt': [
                  'EcsCluster97242B84',
                  'Arn',
                ],
              },
            },
            {
              Action: [
                'ecs:Poll',
                'ecs:StartTelemetrySession',
              ],
              Effect: 'Allow',
              Resource: '*',
              Condition: {
                ArnEquals: {
                  'ecs:cluster': {
                    'Fn::GetAtt': [
                      'EcsCluster97242B84',
                      'Arn',
                    ],
                  },
                },
              },
            },
            {
              Action: [
                'ecs:DiscoverPollEndpoint',
                'ecr:GetAuthorizationToken',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              Effect: 'Allow',
              Resource: '*',
            },
          ],
          Version: '2012-10-17',
        },
      }));

      test.done();
    },

    'multiple clusters with default capacity'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});

      // WHEN
      for (let i = 0; i < 2; i++) {
        const cluster = new ecs.Cluster(stack, `EcsCluster${i}`, { vpc });
        cluster.addCapacity('MyCapacity', {
          instanceType: new ec2.InstanceType('m3.medium'),
        });
      }

      test.done();
    },

    'lifecycle hook is automatically added'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', {
        vpc,
      });

      // WHEN
      cluster.addCapacity('DefaultAutoScalingGroup', {
        instanceType: new ec2.InstanceType('t2.micro'),
      });

      // THEN
      expect(stack).to(haveResource('AWS::AutoScaling::LifecycleHook', {
        AutoScalingGroupName: { Ref: 'EcsClusterDefaultAutoScalingGroupASGC1A785DB' },
        LifecycleTransition: 'autoscaling:EC2_INSTANCE_TERMINATING',
        DefaultResult: 'CONTINUE',
        HeartbeatTimeout: 300,
        NotificationTargetARN: { Ref: 'EcsClusterDefaultAutoScalingGroupLifecycleHookDrainHookTopicACD2D4A4' },
        RoleARN: { 'Fn::GetAtt': ['EcsClusterDefaultAutoScalingGroupLifecycleHookDrainHookRoleA38EC83B', 'Arn'] },
      }));

      expect(stack).to(haveResource('AWS::Lambda::Function', {
        Timeout: 310,
        Environment: {
          Variables: {
            CLUSTER: {
              Ref: 'EcsCluster97242B84',
            },
          },
        },
        Handler: 'index.lambda_handler',
      }));

      expect(stack).to(haveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: [
                'ec2:DescribeInstances',
                'ec2:DescribeInstanceAttribute',
                'ec2:DescribeInstanceStatus',
                'ec2:DescribeHosts',
              ],
              Effect: 'Allow',
              Resource: '*',
            },
            {
              Action: 'autoscaling:CompleteLifecycleAction',
              Effect: 'Allow',
              Resource: {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    {
                      Ref: 'AWS::Partition',
                    },
                    ':autoscaling:',
                    {
                      Ref: 'AWS::Region',
                    },
                    ':',
                    {
                      Ref: 'AWS::AccountId',
                    },
                    ':autoScalingGroup:*:autoScalingGroupName/',
                    {
                      Ref: 'EcsClusterDefaultAutoScalingGroupASGC1A785DB',
                    },
                  ],
                ],
              },
            },
            {
              Action: [
                'ecs:DescribeContainerInstances',
                'ecs:DescribeTasks',
              ],
              Effect: 'Allow',
              Resource: '*',
              Condition: {
                ArnEquals: {
                  'ecs:cluster': {
                    'Fn::GetAtt': [
                      'EcsCluster97242B84',
                      'Arn',
                    ],
                  },
                },
              },
            },
            {
              Action: [
                'ecs:ListContainerInstances',
                'ecs:SubmitContainerStateChange',
                'ecs:SubmitTaskStateChange',
              ],
              Effect: 'Allow',
              Resource: {
                'Fn::GetAtt': [
                  'EcsCluster97242B84',
                  'Arn',
                ],
              },
            },
            {
              Action: [
                'ecs:UpdateContainerInstancesState',
                'ecs:ListTasks',
              ],
              Condition: {
                ArnEquals: {
                  'ecs:cluster': {
                    'Fn::GetAtt': [
                      'EcsCluster97242B84',
                      'Arn',
                    ],
                  },
                },
              },
              Effect: 'Allow',
              Resource: '*',
            },
          ],
          Version: '2012-10-17',
        },
        PolicyName: 'EcsClusterDefaultAutoScalingGroupDrainECSHookFunctionServiceRoleDefaultPolicyA45BF396',
        Roles: [
          {
            Ref: 'EcsClusterDefaultAutoScalingGroupDrainECSHookFunctionServiceRole94543EDA',
          },
        ],
      }));

      test.done();
    },

    'lifecycle hook with encrypted SNS is added correctly'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      const cluster = new ecs.Cluster(stack, 'EcsCluster', {
        vpc,
      });
      const key = new kms.Key(stack, 'Key');

      // WHEN
      cluster.addCapacity('DefaultAutoScalingGroup', {
        instanceType: new ec2.InstanceType('t2.micro'),
        topicEncryptionKey: key,
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::SNS::Topic', {
        KmsMasterKeyId: {
          'Fn::GetAtt': [
            'Key961B73FD',
            'Arn',
          ],
        },
      }));

      test.done();
    },

    'with capacity and cloudmap namespace properties set'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'MyVpc', {});
      new ecs.Cluster(stack, 'EcsCluster', {
        vpc,
        capacity: {
          instanceType: new ec2.InstanceType('t2.micro'),
        },
        defaultCloudMapNamespace: {
          name: 'foo.com',
        },
      });

      // THEN
      expect(stack).to(haveResource('AWS::ServiceDiscovery::PrivateDnsNamespace', {
        Name: 'foo.com',
        Vpc: {
          Ref: 'MyVpcF9F0CA6F',
        },
      }));

      expect(stack).to(haveResource('AWS::ECS::Cluster'));

      expect(stack).to(haveResource('AWS::EC2::VPC', {
        CidrBlock: '10.0.0.0/16',
        EnableDnsHostnames: true,
        EnableDnsSupport: true,
        InstanceTenancy: ec2.DefaultInstanceTenancy.DEFAULT,
        Tags: [
          {
            Key: 'Name',
            Value: 'Default/MyVpc',
          },
        ],
      }));

      expect(stack).to(haveResource('AWS::AutoScaling::LaunchConfiguration', {
        ImageId: {
          Ref: 'SsmParameterValueawsserviceecsoptimizedamiamazonlinux2recommendedimageidC96584B6F00A464EAD1953AFF4B05118Parameter',
        },
        InstanceType: 't2.micro',
        IamInstanceProfile: {
          Ref: 'EcsClusterDefaultAutoScalingGroupInstanceProfile2CE606B3',
        },
        SecurityGroups: [
          {
            'Fn::GetAtt': [
              'EcsClusterDefaultAutoScalingGroupInstanceSecurityGroup912E1231',
              'GroupId',
            ],
          },
        ],
        UserData: {
          'Fn::Base64': {
            'Fn::Join': [
              '',
              [
                '#!/bin/bash\necho ECS_CLUSTER=',
                {
                  Ref: 'EcsCluster97242B84',
                },
                // eslint-disable-next-line max-len
                ' >> /etc/ecs/ecs.config\nsudo iptables --insert FORWARD 1 --in-interface docker+ --destination 169.254.169.254/32 --jump DROP\nsudo service iptables save\necho ECS_AWSVPC_BLOCK_IMDS=true >> /etc/ecs/ecs.config',
              ],
            ],
          },
        },
      }));

      expect(stack).to(haveResource('AWS::AutoScaling::AutoScalingGroup', {
        MaxSize: '1',
        MinSize: '1',
        LaunchConfigurationName: {
          Ref: 'EcsClusterDefaultAutoScalingGroupLaunchConfigB7E376C1',
        },
        Tags: [
          {
            Key: 'Name',
            PropagateAtLaunch: true,
            Value: 'Default/EcsCluster/DefaultAutoScalingGroup',
          },
        ],
        VPCZoneIdentifier: [
          {
            Ref: 'MyVpcPrivateSubnet1Subnet5057CF7E',
          },
          {
            Ref: 'MyVpcPrivateSubnet2Subnet0040C983',
          },
        ],
      }));

      expect(stack).to(haveResource('AWS::EC2::SecurityGroup', {
        GroupDescription: 'Default/EcsCluster/DefaultAutoScalingGroup/InstanceSecurityGroup',
        SecurityGroupEgress: [
          {
            CidrIp: '0.0.0.0/0',
            Description: 'Allow all outbound traffic by default',
            IpProtocol: '-1',
          },
        ],
        Tags: [
          {
            Key: 'Name',
            Value: 'Default/EcsCluster/DefaultAutoScalingGroup',
          },
        ],
        VpcId: {
          Ref: 'MyVpcF9F0CA6F',
        },
      }));

      expect(stack).to(haveResource('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: { 'Fn::Join': ['', ['ec2.', { Ref: 'AWS::URLSuffix' }]] },
              },
            },
          ],
          Version: '2012-10-17',
        },
      }));

      expect(stack).to(haveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: [
                'ecs:DeregisterContainerInstance',
                'ecs:RegisterContainerInstance',
                'ecs:Submit*',
              ],
              Effect: 'Allow',
              Resource: {
                'Fn::GetAtt': [
                  'EcsCluster97242B84',
                  'Arn',
                ],
              },
            },
            {
              Action: [
                'ecs:Poll',
                'ecs:StartTelemetrySession',
              ],
              Effect: 'Allow',
              Resource: '*',
              Condition: {
                ArnEquals: {
                  'ecs:cluster': {
                    'Fn::GetAtt': [
                      'EcsCluster97242B84',
                      'Arn',
                    ],
                  },
                },
              },
            },
            {
              Action: [
                'ecs:DiscoverPollEndpoint',
                'ecr:GetAuthorizationToken',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              Effect: 'Allow',
              Resource: '*',
            },
          ],
          Version: '2012-10-17',
        },
      }));

      test.done();
    },
  },

  'allows specifying instance type'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'MyVpc', {});

    const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', {
      instanceType: new ec2.InstanceType('m3.large'),
    });

    // THEN
    expect(stack).to(haveResource('AWS::AutoScaling::LaunchConfiguration', {
      InstanceType: 'm3.large',
    }));

    test.done();
  },

  'allows specifying cluster size'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'MyVpc', {});

    const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', {
      instanceType: new ec2.InstanceType('t2.micro'),
      desiredCapacity: 3,
    });

    // THEN
    expect(stack).to(haveResource('AWS::AutoScaling::AutoScalingGroup', {
      MaxSize: '3',
    }));

    test.done();
  },

  'configures userdata with powershell if windows machine image is specified'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'MyVpc', {});

    const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
    cluster.addCapacity('WindowsAutoScalingGroup', {
      instanceType: new ec2.InstanceType('t2.micro'),
      machineImage: new ecs.EcsOptimizedAmi({
        windowsVersion: ecs.WindowsOptimizedVersion.SERVER_2019,
      }),
    });

    // THEN
    expect(stack).to(haveResource('AWS::AutoScaling::LaunchConfiguration', {
      ImageId: {
        Ref: 'SsmParameterValueawsserviceecsoptimizedamiwindowsserver2019englishfullrecommendedimageidC96584B6F00A464EAD1953AFF4B05118Parameter',
      },
      InstanceType: 't2.micro',
      IamInstanceProfile: {
        Ref: 'EcsClusterWindowsAutoScalingGroupInstanceProfile65DFA6BB',
      },
      SecurityGroups: [
        {
          'Fn::GetAtt': [
            'EcsClusterWindowsAutoScalingGroupInstanceSecurityGroupDA468DF1',
            'GroupId',
          ],
        },
      ],
      UserData: {
        'Fn::Base64': {
          'Fn::Join': [
            '',
            [
              '<powershell>Remove-Item -Recurse C:\\ProgramData\\Amazon\\ECS\\Cache\nImport-Module ECSTools\n[Environment]::SetEnvironmentVariable("ECS_CLUSTER", "',
              {
                Ref: 'EcsCluster97242B84',
              },
              "\", \"Machine\")\n[Environment]::SetEnvironmentVariable(\"ECS_ENABLE_AWSLOGS_EXECUTIONROLE_OVERRIDE\", \"true\", \"Machine\")\n[Environment]::SetEnvironmentVariable(\"ECS_AVAILABLE_LOGGING_DRIVERS\", '[\"json-file\",\"awslogs\"]', \"Machine\")\n[Environment]::SetEnvironmentVariable(\"ECS_ENABLE_TASK_IAM_ROLE\", \"true\", \"Machine\")\nInitialize-ECSAgent -Cluster '",
              {
                Ref: 'EcsCluster97242B84',
              },
              "' -EnableTaskIAMRole</powershell>",
            ],
          ],
        },
      },
    }));

    test.done();
  },

  /*
   * TODO:v2.0.0 BEGINNING OF OBSOLETE BLOCK
   */
  'allows specifying special HW AMI Type'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');
    const vpc = new ec2.Vpc(stack, 'MyVpc', {});

    const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
    cluster.addCapacity('GpuAutoScalingGroup', {
      instanceType: new ec2.InstanceType('t2.micro'),
      machineImage: new ecs.EcsOptimizedAmi({
        hardwareType: ecs.AmiHardwareType.GPU,
      }),
    });

    // THEN
    const assembly = app.synth();
    const template = assembly.getStackByName(stack.stackName).template;
    expect(stack).to(haveResource('AWS::AutoScaling::LaunchConfiguration', {
      ImageId: {
        Ref: 'SsmParameterValueawsserviceecsoptimizedamiamazonlinux2gpurecommendedimageidC96584B6F00A464EAD1953AFF4B05118Parameter',
      },
    }));

    test.deepEqual(template.Parameters, {
      SsmParameterValueawsserviceecsoptimizedamiamazonlinux2gpurecommendedimageidC96584B6F00A464EAD1953AFF4B05118Parameter: {
        Type: 'AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>',
        Default: '/aws/service/ecs/optimized-ami/amazon-linux-2/gpu/recommended/image_id',
      },
    });

    test.done();
  },

  'errors if amazon linux given with special HW type'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'MyVpc', {});

    const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });

    // THEN
    test.throws(() => {
      cluster.addCapacity('GpuAutoScalingGroup', {
        instanceType: new ec2.InstanceType('t2.micro'),
        machineImage: new ecs.EcsOptimizedAmi({
          generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX,
          hardwareType: ecs.AmiHardwareType.GPU,
        }),
      });
    }, /Amazon Linux does not support special hardware type/);

    test.done();
  },

  'allows specifying windows image'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');
    const vpc = new ec2.Vpc(stack, 'MyVpc', {});

    const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
    cluster.addCapacity('WindowsAutoScalingGroup', {
      instanceType: new ec2.InstanceType('t2.micro'),
      machineImage: new ecs.EcsOptimizedAmi({
        windowsVersion: ecs.WindowsOptimizedVersion.SERVER_2019,
      }),
    });

    // THEN
    const assembly = app.synth();
    const template = assembly.getStackByName(stack.stackName).template;
    test.deepEqual(template.Parameters, {
      SsmParameterValueawsserviceecsoptimizedamiwindowsserver2019englishfullrecommendedimageidC96584B6F00A464EAD1953AFF4B05118Parameter: {
        Type: 'AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>',
        Default: '/aws/service/ecs/optimized-ami/windows_server/2019/english/full/recommended/image_id',
      },
    });

    test.done();
  },

  'errors if windows given with special HW type'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'MyVpc', {});

    const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });

    // THEN
    test.throws(() => {
      cluster.addCapacity('WindowsGpuAutoScalingGroup', {
        instanceType: new ec2.InstanceType('t2.micro'),
        machineImage: new ecs.EcsOptimizedAmi({
          windowsVersion: ecs.WindowsOptimizedVersion.SERVER_2019,
          hardwareType: ecs.AmiHardwareType.GPU,
        }),
      });
    }, /Windows Server does not support special hardware type/);

    test.done();
  },

  'errors if windowsVersion and linux generation are set'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'MyVpc', {});

    const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });

    // THEN
    test.throws(() => {
      cluster.addCapacity('WindowsScalingGroup', {
        instanceType: new ec2.InstanceType('t2.micro'),
        machineImage: new ecs.EcsOptimizedAmi({
          windowsVersion: ecs.WindowsOptimizedVersion.SERVER_2019,
          generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX,
        }),
      });
    }, /"windowsVersion" and Linux image "generation" cannot be both set/);

    test.done();
  },

  'allows returning the correct image for windows for EcsOptimizedAmi'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const ami = new ecs.EcsOptimizedAmi({
      windowsVersion: ecs.WindowsOptimizedVersion.SERVER_2019,
    });

    test.equal(ami.getImage(stack).osType, ec2.OperatingSystemType.WINDOWS);

    test.done();
  },

  'allows returning the correct image for linux for EcsOptimizedAmi'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const ami = new ecs.EcsOptimizedAmi({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX,
    });

    test.equal(ami.getImage(stack).osType, ec2.OperatingSystemType.LINUX);

    test.done();
  },

  'allows returning the correct image for linux 2 for EcsOptimizedAmi'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const ami = new ecs.EcsOptimizedAmi({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
    });

    test.equal(ami.getImage(stack).osType, ec2.OperatingSystemType.LINUX);

    test.done();
  },

  'allows returning the correct image for linux for EcsOptimizedImage'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    test.equal(ecs.EcsOptimizedImage.amazonLinux().getImage(stack).osType,
      ec2.OperatingSystemType.LINUX);

    test.done();
  },

  'allows returning the correct image for linux 2 for EcsOptimizedImage'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    test.equal(ecs.EcsOptimizedImage.amazonLinux2().getImage(stack).osType,
      ec2.OperatingSystemType.LINUX);

    test.done();
  },

  'allows returning the correct image for linux 2 for EcsOptimizedImage with ARM hardware'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    test.equal(ecs.EcsOptimizedImage.amazonLinux2(ecs.AmiHardwareType.ARM).getImage(stack).osType,
      ec2.OperatingSystemType.LINUX);

    test.done();
  },


  'allows returning the correct image for windows for EcsOptimizedImage'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    test.equal(ecs.EcsOptimizedImage.windows(ecs.WindowsOptimizedVersion.SERVER_2019).getImage(stack).osType,
      ec2.OperatingSystemType.WINDOWS);

    test.done();
  },

  /*
   * TODO:v2.0.0 END OF OBSOLETE BLOCK
   */

  'allows specifying special HW AMI Type v2'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');
    const vpc = new ec2.Vpc(stack, 'MyVpc', {});

    const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
    cluster.addCapacity('GpuAutoScalingGroup', {
      instanceType: new ec2.InstanceType('t2.micro'),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(ecs.AmiHardwareType.GPU),
    });

    // THEN
    const assembly = app.synth();
    const template = assembly.getStackByName(stack.stackName).template;
    expect(stack).to(haveResource('AWS::AutoScaling::LaunchConfiguration', {
      ImageId: {
        Ref: 'SsmParameterValueawsserviceecsoptimizedamiamazonlinux2gpurecommendedimageidC96584B6F00A464EAD1953AFF4B05118Parameter',
      },
    }));

    test.deepEqual(template.Parameters, {
      SsmParameterValueawsserviceecsoptimizedamiamazonlinux2gpurecommendedimageidC96584B6F00A464EAD1953AFF4B05118Parameter: {
        Type: 'AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>',
        Default: '/aws/service/ecs/optimized-ami/amazon-linux-2/gpu/recommended/image_id',
      },
    });

    test.done();
  },

  'allows specifying Amazon Linux v1 AMI'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');
    const vpc = new ec2.Vpc(stack, 'MyVpc', {});

    const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
    cluster.addCapacity('GpuAutoScalingGroup', {
      instanceType: new ec2.InstanceType('t2.micro'),
      machineImage: ecs.EcsOptimizedImage.amazonLinux(),
    });

    // THEN
    const assembly = app.synth();
    const template = assembly.getStackByName(stack.stackName).template;
    expect(stack).to(haveResource('AWS::AutoScaling::LaunchConfiguration', {
      ImageId: {
        Ref: 'SsmParameterValueawsserviceecsoptimizedamiamazonlinuxrecommendedimageidC96584B6F00A464EAD1953AFF4B05118Parameter',
      },
    }));

    test.deepEqual(template.Parameters, {
      SsmParameterValueawsserviceecsoptimizedamiamazonlinuxrecommendedimageidC96584B6F00A464EAD1953AFF4B05118Parameter: {
        Type: 'AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>',
        Default: '/aws/service/ecs/optimized-ami/amazon-linux/recommended/image_id',
      },
    });

    test.done();
  },

  'allows specifying windows image v2'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');
    const vpc = new ec2.Vpc(stack, 'MyVpc', {});

    const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
    cluster.addCapacity('WindowsAutoScalingGroup', {
      instanceType: new ec2.InstanceType('t2.micro'),
      machineImage: ecs.EcsOptimizedImage.windows(ecs.WindowsOptimizedVersion.SERVER_2019),
    });

    // THEN
    const assembly = app.synth();
    const template = assembly.getStackByName(stack.stackName).template;
    test.deepEqual(template.Parameters, {
      SsmParameterValueawsserviceecsoptimizedamiwindowsserver2019englishfullrecommendedimageidC96584B6F00A464EAD1953AFF4B05118Parameter: {
        Type: 'AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>',
        Default: '/aws/service/ecs/optimized-ami/windows_server/2019/english/full/recommended/image_id',
      },
    });

    test.done();
  },

  'allows specifying spot fleet'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'MyVpc', {});

    const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', {
      instanceType: new ec2.InstanceType('t2.micro'),
      spotPrice: '0.31',
    });

    // THEN
    expect(stack).to(haveResource('AWS::AutoScaling::LaunchConfiguration', {
      SpotPrice: '0.31',
    }));

    test.done();
  },

  'allows specifying drain time'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'MyVpc', {});

    const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', {
      instanceType: new ec2.InstanceType('t2.micro'),
      taskDrainTime: cdk.Duration.minutes(1),
    });

    // THEN
    expect(stack).to(haveResource('AWS::AutoScaling::LifecycleHook', {
      HeartbeatTimeout: 60,
    }));

    test.done();
  },

  'allows specifying automated spot draining'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'MyVpc', {});

    const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', {
      instanceType: new ec2.InstanceType('c5.xlarge'),
      spotPrice: '0.0735',
      spotInstanceDraining: true,
    });

    // THEN
    expect(stack).to(haveResource('AWS::AutoScaling::LaunchConfiguration', {
      UserData: {
        'Fn::Base64': {
          'Fn::Join': [
            '',
            [
              '#!/bin/bash\necho ECS_CLUSTER=',
              {
                Ref: 'EcsCluster97242B84',
              },
              ' >> /etc/ecs/ecs.config\nsudo iptables --insert FORWARD 1 --in-interface docker+ --destination 169.254.169.254/32 --jump DROP\nsudo service iptables save\necho ECS_AWSVPC_BLOCK_IMDS=true >> /etc/ecs/ecs.config\necho ECS_ENABLE_SPOT_INSTANCE_DRAINING=true >> /etc/ecs/ecs.config',
            ],
          ],
        },
      },
    }));

    test.done();
  },

  'allows containers access to instance metadata service'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'MyVpc', {});

    const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', {
      instanceType: new ec2.InstanceType('t2.micro'),
      canContainersAccessInstanceRole: true,
    });

    // THEN
    expect(stack).to(haveResource('AWS::AutoScaling::LaunchConfiguration', {
      UserData: {
        'Fn::Base64': {
          'Fn::Join': [
            '',
            [
              '#!/bin/bash\necho ECS_CLUSTER=',
              {
                Ref: 'EcsCluster97242B84',
              },
              ' >> /etc/ecs/ecs.config',
            ],
          ],
        },
      },
    }));

    test.done();
  },

  'allows adding default service discovery namespace'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'MyVpc', {});

    const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', {
      instanceType: new ec2.InstanceType('t2.micro'),
    });

    // WHEN
    cluster.addDefaultCloudMapNamespace({
      name: 'foo.com',
    });

    // THEN
    expect(stack).to(haveResource('AWS::ServiceDiscovery::PrivateDnsNamespace', {
      Name: 'foo.com',
      Vpc: {
        Ref: 'MyVpcF9F0CA6F',
      },
    }));

    test.done();
  },

  'allows adding public service discovery namespace'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'MyVpc', {});

    const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', {
      instanceType: new ec2.InstanceType('t2.micro'),
    });

    // WHEN
    cluster.addDefaultCloudMapNamespace({
      name: 'foo.com',
      type: cloudmap.NamespaceType.DNS_PUBLIC,
    });

    // THEN
    expect(stack).to(haveResource('AWS::ServiceDiscovery::PublicDnsNamespace', {
      Name: 'foo.com',
    }));

    test.equal(cluster.defaultCloudMapNamespace!.type, cloudmap.NamespaceType.DNS_PUBLIC);

    test.done();
  },

  'throws if default service discovery namespace added more than once'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'MyVpc', {});

    const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', {
      instanceType: new ec2.InstanceType('t2.micro'),
    });

    // WHEN
    cluster.addDefaultCloudMapNamespace({
      name: 'foo.com',
    });

    // THEN
    test.throws(() => {
      cluster.addDefaultCloudMapNamespace({
        name: 'foo.com',
      });
    }, /Can only add default namespace once./);

    test.done();
  },

  'export/import of a cluster with a namespace'(test: Test) {
    // GIVEN
    const stack1 = new cdk.Stack();
    const vpc1 = new ec2.Vpc(stack1, 'Vpc');
    const cluster1 = new ecs.Cluster(stack1, 'Cluster', { vpc: vpc1 });
    cluster1.addDefaultCloudMapNamespace({
      name: 'hello.com',
    });

    const stack2 = new cdk.Stack();

    // WHEN
    const cluster2 = ecs.Cluster.fromClusterAttributes(stack2, 'Cluster', {
      vpc: vpc1,
      securityGroups: cluster1.connections.securityGroups,
      defaultCloudMapNamespace: cloudmap.PrivateDnsNamespace.fromPrivateDnsNamespaceAttributes(stack2, 'ns', {
        namespaceId: 'import-namespace-id',
        namespaceArn: 'import-namespace-arn',
        namespaceName: 'import-namespace-name',
      }),
      clusterName: 'cluster-name',
    });

    // THEN
    test.equal(cluster2.defaultCloudMapNamespace!.type, cloudmap.NamespaceType.DNS_PRIVATE);
    test.deepEqual(stack2.resolve(cluster2.defaultCloudMapNamespace!.namespaceId), 'import-namespace-id');

    // Can retrieve subnets from VPC - will throw 'There are no 'Private' subnets in this VPC. Use a different VPC subnet selection.' if broken.
    cluster2.vpc.selectSubnets();

    test.done();
  },

  'imported cluster with imported security groups honors allowAllOutbound'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Vpc');

    const importedSg1 = ec2.SecurityGroup.fromSecurityGroupId(stack, 'SG1', 'sg-1', { allowAllOutbound: false });
    const importedSg2 = ec2.SecurityGroup.fromSecurityGroupId(stack, 'SG2', 'sg-2');

    const cluster = ecs.Cluster.fromClusterAttributes(stack, 'Cluster', {
      clusterName: 'cluster-name',
      securityGroups: [importedSg1, importedSg2],
      vpc,
    });

    // WHEN
    cluster.connections.allowToAnyIpv4(ec2.Port.tcp(443));

    // THEN
    expect(stack).to(haveResource('AWS::EC2::SecurityGroupEgress', {
      GroupId: 'sg-1',
    }));

    expect(stack).to(countResources('AWS::EC2::SecurityGroupEgress', 1));

    test.done();
  },

  'Metric'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'MyVpc', {});

    const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });

    // THEN
    test.deepEqual(stack.resolve(cluster.metricCpuReservation()), {
      dimensions: {
        ClusterName: { Ref: 'EcsCluster97242B84' },
      },
      namespace: 'AWS/ECS',
      metricName: 'CPUReservation',
      period: cdk.Duration.minutes(5),
      statistic: 'Average',
    });

    test.deepEqual(stack.resolve(cluster.metricMemoryReservation()), {
      dimensions: {
        ClusterName: { Ref: 'EcsCluster97242B84' },
      },
      namespace: 'AWS/ECS',
      metricName: 'MemoryReservation',
      period: cdk.Duration.minutes(5),
      statistic: 'Average',
    });

    test.deepEqual(stack.resolve(cluster.metric('myMetric')), {
      dimensions: {
        ClusterName: { Ref: 'EcsCluster97242B84' },
      },
      namespace: 'AWS/ECS',
      metricName: 'myMetric',
      period: cdk.Duration.minutes(5),
      statistic: 'Average',
    });

    test.done();
  },

  'ASG with a public VPC without NAT Gateways'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'MyPublicVpc', {
      natGateways: 0,
      subnetConfiguration: [
        { cidrMask: 24, name: 'ingress', subnetType: ec2.SubnetType.PUBLIC },
      ],
    });

    const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });

    // WHEN
    cluster.addCapacity('DefaultAutoScalingGroup', {
      instanceType: new ec2.InstanceType('t2.micro'),
      associatePublicIpAddress: true,
      vpcSubnets: {
        onePerAz: true,
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    expect(stack).to(haveResource('AWS::ECS::Cluster'));

    expect(stack).to(haveResource('AWS::EC2::VPC', {
      CidrBlock: '10.0.0.0/16',
      EnableDnsHostnames: true,
      EnableDnsSupport: true,
      InstanceTenancy: ec2.DefaultInstanceTenancy.DEFAULT,
      Tags: [
        {
          Key: 'Name',
          Value: 'Default/MyPublicVpc',
        },
      ],
    }));

    expect(stack).to(haveResource('AWS::AutoScaling::LaunchConfiguration', {
      ImageId: {
        Ref: 'SsmParameterValueawsserviceecsoptimizedamiamazonlinux2recommendedimageidC96584B6F00A464EAD1953AFF4B05118Parameter',
      },
      InstanceType: 't2.micro',
      AssociatePublicIpAddress: true,
      IamInstanceProfile: {
        Ref: 'EcsClusterDefaultAutoScalingGroupInstanceProfile2CE606B3',
      },
      SecurityGroups: [
        {
          'Fn::GetAtt': [
            'EcsClusterDefaultAutoScalingGroupInstanceSecurityGroup912E1231',
            'GroupId',
          ],
        },
      ],
      UserData: {
        'Fn::Base64': {
          'Fn::Join': [
            '',
            [
              '#!/bin/bash\necho ECS_CLUSTER=',
              {
                Ref: 'EcsCluster97242B84',
              },
              // eslint-disable-next-line max-len
              ' >> /etc/ecs/ecs.config\nsudo iptables --insert FORWARD 1 --in-interface docker+ --destination 169.254.169.254/32 --jump DROP\nsudo service iptables save\necho ECS_AWSVPC_BLOCK_IMDS=true >> /etc/ecs/ecs.config',
            ],
          ],
        },
      },
    }));

    expect(stack).to(haveResource('AWS::AutoScaling::AutoScalingGroup', {
      MaxSize: '1',
      MinSize: '1',
      LaunchConfigurationName: {
        Ref: 'EcsClusterDefaultAutoScalingGroupLaunchConfigB7E376C1',
      },
      Tags: [
        {
          Key: 'Name',
          PropagateAtLaunch: true,
          Value: 'Default/EcsCluster/DefaultAutoScalingGroup',
        },
      ],
      VPCZoneIdentifier: [
        {
          Ref: 'MyPublicVpcingressSubnet1Subnet9191044C',
        },
        {
          Ref: 'MyPublicVpcingressSubnet2SubnetD2F2E034',
        },
      ],
    }));

    expect(stack).to(haveResource('AWS::EC2::SecurityGroup', {
      GroupDescription: 'Default/EcsCluster/DefaultAutoScalingGroup/InstanceSecurityGroup',
      SecurityGroupEgress: [
        {
          CidrIp: '0.0.0.0/0',
          Description: 'Allow all outbound traffic by default',
          IpProtocol: '-1',
        },
      ],
      Tags: [
        {
          Key: 'Name',
          Value: 'Default/EcsCluster/DefaultAutoScalingGroup',
        },
      ],
      VpcId: {
        Ref: 'MyPublicVpcA2BF6CDA',
      },
    }));

    // THEN
    test.done();
  },

  'enable container insights'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');

    new ecs.Cluster(stack, 'EcsCluster', { containerInsights: true });

    // THEN
    expect(stack).to(haveResource('AWS::ECS::Cluster', {
      ClusterSettings: [
        {
          Name: 'containerInsights',
          Value: 'enabled',
        },
      ],
    }, ResourcePart.Properties));

    test.done();
  },

  'disable container insights'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');

    new ecs.Cluster(stack, 'EcsCluster', { containerInsights: false });

    // THEN
    expect(stack).to(haveResource('AWS::ECS::Cluster', {
      ClusterSettings: [
        {
          Name: 'containerInsights',
          Value: 'disabled',
        },
      ],
    }, ResourcePart.Properties));

    test.done();
  },

  'default container insights is undefined'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');

    new ecs.Cluster(stack, 'EcsCluster');

    // THEN
    const assembly = app.synth();
    const stackAssembly = assembly.getStackByName(stack.stackName);
    const template = stackAssembly.template;

    test.equal(
      template.Resources.EcsCluster97242B84.Properties === undefined ||
      template.Resources.EcsCluster97242B84.Properties.ClusterSettings === undefined,
      true,
      'ClusterSettings should not be defined',
    );

    test.done();
  },

  'BottleRocketImage() returns correct AMI'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');

    // WHEN
    new ecs.BottleRocketImage().getImage(stack);

    // THEN
    const assembly = app.synth();
    const parameters = assembly.getStackByName(stack.stackName).template.Parameters;
    test.ok(Object.entries(parameters).some(
      ([k, v]) => k.startsWith('SsmParameterValueawsservicebottlerocketawsecs') &&
        (v as any).Default.includes('/bottlerocket/'),
    ), 'Bottlerocket AMI should be in ssm parameters');
    test.ok(Object.entries(parameters).some(
      ([k, v]) => k.startsWith('SsmParameterValueawsservicebottlerocketawsecs') &&
        (v as any).Default.includes('/aws-ecs-1/'),
    ), 'ecs variant should be in ssm parameters');
    test.done();
  },

  'cluster capacity with bottlerocket AMI'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');

    const cluster = new ecs.Cluster(stack, 'EcsCluster');
    cluster.addCapacity('bottlerocket-asg', {
      instanceType: new ec2.InstanceType('c5.large'),
      machineImageType: ecs.MachineImageType.BOTTLEROCKET,
    });

    // THEN
    expect(stack).to(haveResource('AWS::ECS::Cluster'));
    expect(stack).to(haveResource('AWS::AutoScaling::AutoScalingGroup'));
    expect(stack).to(haveResource('AWS::AutoScaling::LaunchConfiguration', {
      ImageId: {
        Ref: 'SsmParameterValueawsservicebottlerocketawsecs1x8664latestimageidC96584B6F00A464EAD1953AFF4B05118Parameter',
      },
      UserData: {
        'Fn::Base64': {
          'Fn::Join': [
            '',
            [
              '\n[settings.ecs]\ncluster = "',
              {
                Ref: 'EcsCluster97242B84',
              },
              '"',
            ],
          ],
        },
      },
    }));
    expect(stack).to(haveResourceLike('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: {
                'Fn::Join': [
                  '',
                  [
                    'ec2.',
                    {
                      Ref: 'AWS::URLSuffix',
                    },
                  ],
                ],
              },
            },
          },
        ],
        Version: '2012-10-17',
      },
      ManagedPolicyArns: [
        {
          'Fn::Join': [
            '',
            [
              'arn:',
              {
                Ref: 'AWS::Partition',
              },
              ':iam::aws:policy/AmazonSSMManagedInstanceCore',
            ],
          ],
        },
        {
          'Fn::Join': [
            '',
            [
              'arn:',
              {
                Ref: 'AWS::Partition',
              },
              ':iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role',
            ],
          ],
        },
      ],
      Tags: [
        {
          Key: 'Name',
          Value: 'test/EcsCluster/bottlerocket-asg',
        },
      ],
    }),
    );
    test.done();
  },

  'correct bottlerocket AMI for ARM64 architecture'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');

    const cluster = new ecs.Cluster(stack, 'EcsCluster');
    cluster.addCapacity('bottlerocket-asg', {
      instanceType: new ec2.InstanceType('m6g.large'),
      machineImageType: ecs.MachineImageType.BOTTLEROCKET,
    });

    // THEN
    expect(stack).to(haveResource('AWS::AutoScaling::LaunchConfiguration', {
      ImageId: {
        Ref: 'SsmParameterValueawsservicebottlerocketawsecs1arm64latestimageidC96584B6F00A464EAD1953AFF4B05118Parameter',
      },
    }));

    const assembly = app.synth();
    const template = assembly.getStackByName(stack.stackName).template;
    test.deepEqual(template.Parameters, {
      SsmParameterValueawsservicebottlerocketawsecs1arm64latestimageidC96584B6F00A464EAD1953AFF4B05118Parameter: {
        Type: 'AWS::SSM::Parameter::Value<String>',
        Default: '/aws/service/bottlerocket/aws-ecs-1/arm64/latest/image_id',
      },
    });
    test.done();
  },

  'throws when machineImage and machineImageType both specified'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');
    const cluster = new ecs.Cluster(stack, 'EcsCluster');

    // THEN
    test.throws(() => {
      cluster.addCapacity('bottlerocket-asg', {
        instanceType: new ec2.InstanceType('c5.large'),
        machineImageType: ecs.MachineImageType.BOTTLEROCKET,
        machineImage: new ecs.EcsOptimizedAmi(),
      });
    }, /You can only specify either machineImage or machineImageType, not both./);
    test.done();
  },

  'allows specifying capacityProviders (deprecated)'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');

    // WHEN
    new ecs.Cluster(stack, 'EcsCluster', { capacityProviders: ['FARGATE_SPOT'] });

    // THEN
    expect(stack).to(haveResource('AWS::ECS::Cluster', {
      CapacityProviders: ABSENT,
    }));

    expect(stack).to(haveResource('AWS::ECS::ClusterCapacityProviderAssociations', {
      CapacityProviders: ['FARGATE_SPOT'],
    }));

    test.done();
  },

  'allows specifying Fargate capacityProviders'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');

    // WHEN
    new ecs.Cluster(stack, 'EcsCluster', {
      enableFargateCapacityProviders: true,
    });

    // THEN
    expect(stack).to(haveResource('AWS::ECS::Cluster', {
      CapacityProviders: ABSENT,
    }));

    expect(stack).to(haveResource('AWS::ECS::ClusterCapacityProviderAssociations', {
      CapacityProviders: ['FARGATE', 'FARGATE_SPOT'],
    }));

    test.done();
  },

  'allows specifying capacityProviders (alternate method)'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');

    // WHEN
    const cluster = new ecs.Cluster(stack, 'EcsCluster');
    cluster.enableFargateCapacityProviders();

    // THEN
    expect(stack).to(haveResource('AWS::ECS::Cluster', {
      CapacityProviders: ABSENT,
    }));

    expect(stack).to(haveResource('AWS::ECS::ClusterCapacityProviderAssociations', {
      CapacityProviders: ['FARGATE', 'FARGATE_SPOT'],
    }));

    test.done();
  },

  'allows adding capacityProviders post-construction (deprecated)'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');
    const cluster = new ecs.Cluster(stack, 'EcsCluster');

    // WHEN
    cluster.addCapacityProvider('FARGATE');
    cluster.addCapacityProvider('FARGATE'); // does not add twice

    // THEN
    expect(stack).to(haveResource('AWS::ECS::Cluster', {
      CapacityProviders: ABSENT,
    }));

    expect(stack).to(haveResource('AWS::ECS::ClusterCapacityProviderAssociations', {
      CapacityProviders: ['FARGATE'],
    }));

    test.done();
  },

  'allows adding capacityProviders post-construction'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');
    const cluster = new ecs.Cluster(stack, 'EcsCluster');

    // WHEN
    cluster.addCapacityProvider('FARGATE');
    cluster.addCapacityProvider('FARGATE'); // does not add twice

    // THEN
    expect(stack).to(haveResource('AWS::ECS::Cluster', {
      CapacityProviders: ABSENT,
    }));

    expect(stack).to(haveResource('AWS::ECS::ClusterCapacityProviderAssociations', {
      CapacityProviders: ['FARGATE'],
    }));

    test.done();
  },

  'throws for unsupported capacity providers'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');
    const cluster = new ecs.Cluster(stack, 'EcsCluster');

    // THEN
    test.throws(() => {
      cluster.addCapacityProvider('HONK');
    }, /CapacityProvider not supported/);

    test.done();
  },

  'creates ASG capacity providers with expected defaults'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');
    const vpc = new ec2.Vpc(stack, 'Vpc');
    const autoScalingGroup = new autoscaling.AutoScalingGroup(stack, 'asg', {
      vpc,
      instanceType: new ec2.InstanceType('bogus'),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
    });

    // WHEN
    new ecs.AsgCapacityProvider(stack, 'provider', {
      autoScalingGroup,
    });

    // THEN
    expect(stack).to(haveResource('AWS::ECS::CapacityProvider', {
      AutoScalingGroupProvider: {
        AutoScalingGroupArn: {
          Ref: 'asgASG4D014670',
        },
        ManagedScaling: {
          Status: 'ENABLED',
          TargetCapacity: 100,
        },
        ManagedTerminationProtection: 'ENABLED',
      },
    }));
    test.done();
  },

  'can disable managed scaling for ASG capacity provider'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');
    const vpc = new ec2.Vpc(stack, 'Vpc');
    const autoScalingGroup = new autoscaling.AutoScalingGroup(stack, 'asg', {
      vpc,
      instanceType: new ec2.InstanceType('bogus'),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
    });

    // WHEN
    new ecs.AsgCapacityProvider(stack, 'provider', {
      autoScalingGroup,
      enableManagedScaling: false,
    });

    // THEN
    expect(stack).to(haveResource('AWS::ECS::CapacityProvider', {
      AutoScalingGroupProvider: {
        AutoScalingGroupArn: {
          Ref: 'asgASG4D014670',
        },
        ManagedScaling: ABSENT,
        ManagedTerminationProtection: 'ENABLED',
      },
    }));
    test.done();
  },

  'capacity provider enables ASG new instance scale-in protection by default'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');
    const vpc = new ec2.Vpc(stack, 'Vpc');
    const autoScalingGroup = new autoscaling.AutoScalingGroup(stack, 'asg', {
      vpc,
      instanceType: new ec2.InstanceType('bogus'),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
    });

    // WHEN
    new ecs.AsgCapacityProvider(stack, 'provider', {
      autoScalingGroup,
    });

    // THEN
    expect(stack).to(haveResource('AWS::AutoScaling::AutoScalingGroup', {
      NewInstancesProtectedFromScaleIn: true,
    }));
    test.done();
  },

  'capacity provider disables ASG new instance scale-in protection'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');
    const vpc = new ec2.Vpc(stack, 'Vpc');
    const autoScalingGroup = new autoscaling.AutoScalingGroup(stack, 'asg', {
      vpc,
      instanceType: new ec2.InstanceType('bogus'),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
    });

    // WHEN
    new ecs.AsgCapacityProvider(stack, 'provider', {
      autoScalingGroup,
      enableManagedTerminationProtection: false,
    });

    // THEN
    expect(stack).notTo(haveResource('AWS::AutoScaling::AutoScalingGroup', {
      NewInstancesProtectedFromScaleIn: true,
    }));
    test.done();
  },

  'can add ASG capacity via Capacity Provider'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');
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

    cluster.enableFargateCapacityProviders();

    // Ensure not added twice
    cluster.addAsgCapacityProvider(capacityProvider);
    cluster.addAsgCapacityProvider(capacityProvider);

    // THEN
    expect(stack).to(haveResource('AWS::ECS::ClusterCapacityProviderAssociations', {
      Cluster: {
        Ref: 'EcsCluster97242B84',
      },
      CapacityProviders: [
        'FARGATE',
        'FARGATE_SPOT',
        {
          Ref: 'providerD3FF4D3A',
        },
      ],
      DefaultCapacityProviderStrategy: [],
    }));
    test.done();
  },

  'correctly sets log configuration for execute command'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');

    const kmsKey = new kms.Key(stack, 'KmsKey');

    const logGroup = new logs.LogGroup(stack, 'LogGroup', {
      encryptionKey: kmsKey,
    });

    const execBucket = new s3.Bucket(stack, 'EcsExecBucket', {
      encryptionKey: kmsKey,
    });

    // WHEN
    new ecs.Cluster(stack, 'EcsCluster', {
      executeCommandConfiguration: {
        kmsKey: kmsKey,
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

    // THEN
    expect(stack).to(haveResource('AWS::ECS::Cluster', {
      Configuration: {
        ExecuteCommandConfiguration: {
          KmsKeyId: {
            'Fn::GetAtt': [
              'KmsKey46693ADD',
              'Arn',
            ],
          },
          LogConfiguration: {
            CloudWatchEncryptionEnabled: true,
            CloudWatchLogGroupName: {
              Ref: 'LogGroupF5B46931',
            },
            S3BucketName: {
              Ref: 'EcsExecBucket4F468651',
            },
            S3EncryptionEnabled: true,
            S3KeyPrefix: 'exec-output',
          },
          Logging: 'OVERRIDE',
        },
      },
    }));

    test.done();
  },

  'throws when no log configuration is provided when logging is set to OVERRIDE'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');

    // THEN
    test.throws(() => {
      new ecs.Cluster(stack, 'EcsCluster', {
        executeCommandConfiguration: {
          logging: ecs.ExecuteCommandLogging.OVERRIDE,
        },
      });
    }, /Execute command log configuration must only be specified when logging is OVERRIDE./);

    test.done();
  },

  'throws when log configuration provided but logging is set to DEFAULT'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');

    const logGroup = new logs.LogGroup(stack, 'LogGroup');

    // THEN
    test.throws(() => {
      new ecs.Cluster(stack, 'EcsCluster', {
        executeCommandConfiguration: {
          logConfiguration: {
            cloudWatchLogGroup: logGroup,
          },
          logging: ecs.ExecuteCommandLogging.DEFAULT,
        },
      });
    }, /Execute command log configuration must only be specified when logging is OVERRIDE./);

    test.done();
  },

  'throws when CloudWatchEncryptionEnabled without providing CloudWatch Logs log group name'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');

    // THEN
    test.throws(() => {
      new ecs.Cluster(stack, 'EcsCluster', {
        executeCommandConfiguration: {
          logConfiguration: {
            cloudWatchEncryptionEnabled: true,
          },
          logging: ecs.ExecuteCommandLogging.OVERRIDE,
        },
      });
    }, /You must specify a CloudWatch log group in the execute command log configuration to enable CloudWatch encryption./);

    test.done();
  },

  'throws when S3EncryptionEnabled without providing S3 Bucket name'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'test');

    // THEN
    test.throws(() => {
      new ecs.Cluster(stack, 'EcsCluster', {
        executeCommandConfiguration: {
          logConfiguration: {
            s3EncryptionEnabled: true,
          },
          logging: ecs.ExecuteCommandLogging.OVERRIDE,
        },
      });
    }, /You must specify an S3 bucket name in the execute command log configuration to enable S3 encryption./);

    test.done();
  },
});
