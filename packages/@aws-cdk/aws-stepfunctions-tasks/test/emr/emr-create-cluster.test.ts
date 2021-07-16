import '@aws-cdk/assert-internal/jest';
import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { EmrCreateCluster } from '../../lib';

let stack: cdk.Stack;
let clusterRole: iam.Role;
let serviceRole: iam.Role;
let autoScalingRole: iam.Role;

beforeEach(() => {
  // GIVEN
  stack = new cdk.Stack();
  clusterRole = new iam.Role(stack, 'ClusterRole', {
    assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
  });
  serviceRole = new iam.Role(stack, 'ServiceRole', {
    assumedBy: new iam.ServicePrincipal('elasticmapreduce.amazonaws.com'),
  });
  autoScalingRole = new iam.Role(stack, 'AutoScalingRole', {
    assumedBy: new iam.ServicePrincipal('elasticmapreduce.amazonaws.com'),
  });
  autoScalingRole.assumeRolePolicy?.addStatements(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [
        new iam.ServicePrincipal('application-autoscaling.amazonaws.com'),
      ],
      actions: [
        'sts:AssumeRole',
      ],
    }),
  );
});

test('Create Cluster with FIRE_AND_FORGET integrationPattern', () => {
  // WHEN
  const task = new EmrCreateCluster(stack, 'Task', {
    instances: {},
    clusterRole,
    name: 'Cluster',
    serviceRole,
    autoScalingRole,
    integrationPattern: sfn.IntegrationPattern.REQUEST_RESPONSE,
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::elasticmapreduce:createCluster',
        ],
      ],
    },
    End: true,
    Parameters: {
      Name: 'Cluster',
      Instances: {
        KeepJobFlowAliveWhenNoSteps: true,
      },
      VisibleToAllUsers: true,
      JobFlowRole: {
        Ref: 'ClusterRoleD9CA7471',
      },
      ServiceRole: {
        Ref: 'ServiceRole4288B192',
      },
      AutoScalingRole: {
        Ref: 'AutoScalingRole015ADA0A',
      },
    },
  });
});

test('Create Cluster with SYNC integrationPattern', () => {
  // WHEN
  const task = new EmrCreateCluster(stack, 'Task', {
    instances: {},
    clusterRole,
    name: 'Cluster',
    serviceRole,
    autoScalingRole,
    integrationPattern: sfn.IntegrationPattern.RUN_JOB,
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::elasticmapreduce:createCluster.sync',
        ],
      ],
    },
    End: true,
    Parameters: {
      Name: 'Cluster',
      Instances: {
        KeepJobFlowAliveWhenNoSteps: true,
      },
      VisibleToAllUsers: true,
      JobFlowRole: {
        Ref: 'ClusterRoleD9CA7471',
      },
      ServiceRole: {
        Ref: 'ServiceRole4288B192',
      },
      AutoScalingRole: {
        Ref: 'AutoScalingRole015ADA0A',
      },
    },
  });
});

test('Create Cluster with clusterConfiguration Name from payload', () => {
  // WHEN
  const task = new EmrCreateCluster(stack, 'Task', {
    instances: {},
    clusterRole,
    name: sfn.TaskInput.fromJsonPathAt('$.ClusterName').value,
    serviceRole,
    autoScalingRole,
    integrationPattern: sfn.IntegrationPattern.REQUEST_RESPONSE,
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::elasticmapreduce:createCluster',
        ],
      ],
    },
    End: true,
    Parameters: {
      'Name.$': '$.ClusterName',
      'Instances': {
        KeepJobFlowAliveWhenNoSteps: true,
      },
      'VisibleToAllUsers': true,
      'JobFlowRole': {
        Ref: 'ClusterRoleD9CA7471',
      },
      'ServiceRole': {
        Ref: 'ServiceRole4288B192',
      },
      'AutoScalingRole': {
        Ref: 'AutoScalingRole015ADA0A',
      },
    },
  });
});

test('Create Cluster with Tags', () => {
  // WHEN
  const task = new EmrCreateCluster(stack, 'Task', {
    instances: {},
    clusterRole,
    name: 'Cluster',
    serviceRole,
    autoScalingRole,
    tags: {
      key: 'value',
    },
    integrationPattern: sfn.IntegrationPattern.REQUEST_RESPONSE,
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::elasticmapreduce:createCluster',
        ],
      ],
    },
    End: true,
    Parameters: {
      Name: 'Cluster',
      Instances: {
        KeepJobFlowAliveWhenNoSteps: true,
      },
      VisibleToAllUsers: true,
      JobFlowRole: {
        Ref: 'ClusterRoleD9CA7471',
      },
      ServiceRole: {
        Ref: 'ServiceRole4288B192',
      },
      AutoScalingRole: {
        Ref: 'AutoScalingRole015ADA0A',
      },
      Tags: [{
        Key: 'key',
        Value: 'value',
      }],
    },
  });
});

test('Create Cluster with Applications', () => {
  // WHEN
  const task = new EmrCreateCluster(stack, 'Task', {
    instances: {},
    clusterRole,
    name: 'Cluster',
    serviceRole,
    autoScalingRole,
    applications: [
      { name: 'Hive', version: '0.0' },
      { name: 'Spark', version: '0.0' },
    ],
    integrationPattern: sfn.IntegrationPattern.REQUEST_RESPONSE,
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::elasticmapreduce:createCluster',
        ],
      ],
    },
    End: true,
    Parameters: {
      Name: 'Cluster',
      Instances: {
        KeepJobFlowAliveWhenNoSteps: true,
      },
      VisibleToAllUsers: true,
      JobFlowRole: {
        Ref: 'ClusterRoleD9CA7471',
      },
      ServiceRole: {
        Ref: 'ServiceRole4288B192',
      },
      AutoScalingRole: {
        Ref: 'AutoScalingRole015ADA0A',
      },
      Applications: [
        { Name: 'Hive', Version: '0.0' },
        { Name: 'Spark', Version: '0.0' },
      ],
    },
  });
});

test('Create Cluster with Bootstrap Actions', () => {
  // WHEN
  const task = new EmrCreateCluster(stack, 'Task', {
    instances: {},
    clusterRole,
    name: 'Cluster',
    serviceRole,
    autoScalingRole,
    bootstrapActions: [{
      name: 'Bootstrap',
      scriptBootstrapAction: {
        path: 's3://null',
        args: ['Arg'],
      },
    }],
    integrationPattern: sfn.IntegrationPattern.REQUEST_RESPONSE,
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::elasticmapreduce:createCluster',
        ],
      ],
    },
    End: true,
    Parameters: {
      Name: 'Cluster',
      Instances: {
        KeepJobFlowAliveWhenNoSteps: true,
      },
      VisibleToAllUsers: true,
      JobFlowRole: {
        Ref: 'ClusterRoleD9CA7471',
      },
      ServiceRole: {
        Ref: 'ServiceRole4288B192',
      },
      AutoScalingRole: {
        Ref: 'AutoScalingRole015ADA0A',
      },
      BootstrapActions: [{
        Name: 'Bootstrap',
        ScriptBootstrapAction: {
          Path: 's3://null',
          Args: ['Arg'],
        },
      }],
    },
  });
});

test('Create Cluster with Configurations', () => {
  // WHEN
  const task = new EmrCreateCluster(stack, 'Task', {
    instances: {},
    clusterRole,
    name: 'Cluster',
    serviceRole,
    autoScalingRole,
    configurations: [{
      classification: 'classification',
      properties: {
        Key: 'Value',
      },
    }],
    integrationPattern: sfn.IntegrationPattern.REQUEST_RESPONSE,
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::elasticmapreduce:createCluster',
        ],
      ],
    },
    End: true,
    Parameters: {
      Name: 'Cluster',
      Instances: {
        KeepJobFlowAliveWhenNoSteps: true,
      },
      VisibleToAllUsers: true,
      JobFlowRole: {
        Ref: 'ClusterRoleD9CA7471',
      },
      ServiceRole: {
        Ref: 'ServiceRole4288B192',
      },
      AutoScalingRole: {
        Ref: 'AutoScalingRole015ADA0A',
      },
      Configurations: [{
        Classification: 'classification',
        Properties: {
          Key: 'Value',
        },
      }],
    },
  });
});

test('Create Cluster with KerberosAttributes', () => {
  // WHEN
  const task = new EmrCreateCluster(stack, 'Task', {
    instances: {},
    clusterRole,
    name: 'Cluster',
    serviceRole,
    autoScalingRole,
    kerberosAttributes: {
      realm: 'realm',
      adDomainJoinPassword: 'password1',
      adDomainJoinUser: 'user',
      crossRealmTrustPrincipalPassword: 'password2',
      kdcAdminPassword: 'password3',
    },
    integrationPattern: sfn.IntegrationPattern.REQUEST_RESPONSE,
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::elasticmapreduce:createCluster',
        ],
      ],
    },
    End: true,
    Parameters: {
      Name: 'Cluster',
      Instances: {
        KeepJobFlowAliveWhenNoSteps: true,
      },
      VisibleToAllUsers: true,
      JobFlowRole: {
        Ref: 'ClusterRoleD9CA7471',
      },
      ServiceRole: {
        Ref: 'ServiceRole4288B192',
      },
      AutoScalingRole: {
        Ref: 'AutoScalingRole015ADA0A',
      },
      KerberosAttributes: {
        Realm: 'realm',
        ADDomainJoinPassword: 'password1',
        ADDomainJoinUser: 'user',
        CrossRealmTrustPrincipalPassword: 'password2',
        KdcAdminPassword: 'password3',
      },
    },
  });
});

test('Create Cluster without Roles', () => {
  // WHEN
  const task = new EmrCreateCluster(stack, 'Task', {
    instances: {},
    name: 'Cluster',
    integrationPattern: sfn.IntegrationPattern.RUN_JOB,
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::elasticmapreduce:createCluster.sync',
        ],
      ],
    },
    End: true,
    Parameters: {
      Name: 'Cluster',
      Instances: {
        KeepJobFlowAliveWhenNoSteps: true,
      },
      VisibleToAllUsers: true,
      JobFlowRole: {
        Ref: 'TaskInstanceRoleB72072BF',
      },
      ServiceRole: {
        Ref: 'TaskServiceRoleBF55F61E',
      },
      AutoScalingRole: {
        Ref: 'TaskAutoScalingRoleD06F8423',
      },
    },
  });

  expect(stack).toHaveResourceLike('AWS::IAM::Role', {
    AssumeRolePolicyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Principal: { Service: 'elasticmapreduce.amazonaws.com' },
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
        },
      ],
    },
  });

  // The stack renders the ec2.amazonaws.com Service principal id with a
  // Join to the URLSuffix
  expect(stack).toHaveResourceLike('AWS::IAM::Role', {
    AssumeRolePolicyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Principal: {
            Service:
            {
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
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
        },
      ],
    },
  });

  expect(stack).toHaveResourceLike('AWS::IAM::Role', {
    AssumeRolePolicyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Principal: { Service: 'elasticmapreduce.amazonaws.com' },
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
        },
        {
          Principal: { Service: 'application-autoscaling.amazonaws.com' },
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
        },
      ],
    },
  });

});

test('Create Cluster with Instances configuration', () => {
  // WHEN
  const task = new EmrCreateCluster(stack, 'Task', {
    instances: {
      additionalMasterSecurityGroups: ['MasterGroup'],
      additionalSlaveSecurityGroups: ['SlaveGroup'],
      ec2KeyName: 'Ec2KeyName',
      ec2SubnetId: 'Ec2SubnetId',
      ec2SubnetIds: ['Ec2SubnetId'],
      emrManagedMasterSecurityGroup: 'MasterGroup',
      emrManagedSlaveSecurityGroup: 'SlaveGroup',
      hadoopVersion: 'HadoopVersion',
      instanceCount: 1,
      masterInstanceType: 'MasterInstanceType',
      placement: {
        availabilityZone: 'AvailabilityZone',
        availabilityZones: ['AvailabilityZone'],
      },
      serviceAccessSecurityGroup: 'ServiceAccessGroup',
      slaveInstanceType: 'SlaveInstanceType',
      terminationProtected: true,
    },
    clusterRole,
    name: 'Cluster',
    serviceRole,
    autoScalingRole,
    integrationPattern: sfn.IntegrationPattern.REQUEST_RESPONSE,
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::elasticmapreduce:createCluster',
        ],
      ],
    },
    End: true,
    Parameters: {
      Name: 'Cluster',
      Instances: {
        AdditionalMasterSecurityGroups: ['MasterGroup'],
        AdditionalSlaveSecurityGroups: ['SlaveGroup'],
        Ec2KeyName: 'Ec2KeyName',
        Ec2SubnetId: 'Ec2SubnetId',
        Ec2SubnetIds: ['Ec2SubnetId'],
        EmrManagedMasterSecurityGroup: 'MasterGroup',
        EmrManagedSlaveSecurityGroup: 'SlaveGroup',
        HadoopVersion: 'HadoopVersion',
        InstanceCount: 1,
        KeepJobFlowAliveWhenNoSteps: true,
        MasterInstanceType: 'MasterInstanceType',
        Placement: {
          AvailabilityZone: 'AvailabilityZone',
          AvailabilityZones: ['AvailabilityZone'],
        },
        ServiceAccessSecurityGroup: 'ServiceAccessGroup',
        SlaveInstanceType: 'SlaveInstanceType',
        TerminationProtected: true,
      },
      VisibleToAllUsers: true,
      JobFlowRole: {
        Ref: 'ClusterRoleD9CA7471',
      },
      ServiceRole: {
        Ref: 'ServiceRole4288B192',
      },
      AutoScalingRole: {
        Ref: 'AutoScalingRole015ADA0A',
      },
    },
  });
});

test('Create Cluster with InstanceFleet', () => {
  // WHEN
  const task = new EmrCreateCluster(stack, 'Task', {
    instances: {
      instanceFleets: [{
        instanceFleetType: EmrCreateCluster.InstanceRoleType.MASTER,
        instanceTypeConfigs: [{
          bidPrice: '1',
          bidPriceAsPercentageOfOnDemandPrice: 1,
          configurations: [{
            classification: 'Classification',
            properties: {
              Key: 'Value',
            },
          }],
          ebsConfiguration: {
            ebsBlockDeviceConfigs: [{
              volumeSpecification: {
                iops: 1,
                volumeSize: cdk.Size.gibibytes(1),
                volumeType: EmrCreateCluster.EbsBlockDeviceVolumeType.STANDARD,
              },
              volumesPerInstance: 1,
            }],
            ebsOptimized: true,
          },
          instanceType: 'm5.xlarge',
          weightedCapacity: 1,
        }],
        launchSpecifications: {
          spotSpecification: {
            blockDurationMinutes: 1,
            timeoutAction: EmrCreateCluster.SpotTimeoutAction.TERMINATE_CLUSTER,
            timeoutDurationMinutes: 1,
          },
        },
        name: 'Master',
        targetOnDemandCapacity: 1,
        targetSpotCapacity: 1,
      }],
    },
    clusterRole,
    name: 'Cluster',
    serviceRole,
    integrationPattern: sfn.IntegrationPattern.REQUEST_RESPONSE,
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::elasticmapreduce:createCluster',
        ],
      ],
    },
    End: true,
    Parameters: {
      Name: 'Cluster',
      Instances: {
        KeepJobFlowAliveWhenNoSteps: true,
        InstanceFleets: [{
          InstanceFleetType: 'MASTER',
          InstanceTypeConfigs: [{
            BidPrice: '1',
            BidPriceAsPercentageOfOnDemandPrice: 1,
            Configurations: [{
              Classification: 'Classification',
              Properties: {
                Key: 'Value',
              },
            }],
            EbsConfiguration: {
              EbsBlockDeviceConfigs: [{
                VolumeSpecification: {
                  Iops: 1,
                  SizeInGB: 1,
                  VolumeType: 'standard',
                },
                VolumesPerInstance: 1,
              }],
              EbsOptimized: true,
            },
            InstanceType: 'm5.xlarge',
            WeightedCapacity: 1,
          }],
          LaunchSpecifications: {
            SpotSpecification: {
              BlockDurationMinutes: 1,
              TimeoutAction: 'TERMINATE_CLUSTER',
              TimeoutDurationMinutes: 1,
            },
          },
          Name: 'Master',
          TargetOnDemandCapacity: 1,
          TargetSpotCapacity: 1,
        }],
      },
      VisibleToAllUsers: true,
      JobFlowRole: {
        Ref: 'ClusterRoleD9CA7471',
      },
      ServiceRole: {
        Ref: 'ServiceRole4288B192',
      },
    },
  });
});

test('Create Cluster with InstanceFleet OnDemand AllocationStrategy', () => {
  // WHEN
  const task = new EmrCreateCluster(stack, 'Task', {
    instances: {
      instanceFleets: [{
        instanceFleetType: EmrCreateCluster.InstanceRoleType.MASTER,
        instanceTypeConfigs: [{
          bidPrice: '1',
          bidPriceAsPercentageOfOnDemandPrice: 1,
          configurations: [{
            classification: 'Classification',
            properties: {
              Key: 'Value',
            },
          }],
          ebsConfiguration: {
            ebsBlockDeviceConfigs: [{
              volumeSpecification: {
                iops: 1,
                volumeSize: cdk.Size.gibibytes(1),
                volumeType: EmrCreateCluster.EbsBlockDeviceVolumeType.STANDARD,
              },
              volumesPerInstance: 1,
            }],
            ebsOptimized: true,
          },
          instanceType: 'm5.xlarge',
          weightedCapacity: 1,
        }],
        launchSpecifications: {
          onDemandSpecification: {
            allocationStrategy: EmrCreateCluster.AllocationStrategy.LOWEST_PRICE,
          },
        },
        name: 'Master',
        targetOnDemandCapacity: 1,
        targetSpotCapacity: 1,
      }],
    },
    clusterRole,
    name: 'Cluster',
    serviceRole,
    integrationPattern: sfn.IntegrationPattern.REQUEST_RESPONSE,
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::elasticmapreduce:createCluster',
        ],
      ],
    },
    End: true,
    Parameters: {
      Name: 'Cluster',
      Instances: {
        KeepJobFlowAliveWhenNoSteps: true,
        InstanceFleets: [{
          InstanceFleetType: 'MASTER',
          InstanceTypeConfigs: [{
            BidPrice: '1',
            BidPriceAsPercentageOfOnDemandPrice: 1,
            Configurations: [{
              Classification: 'Classification',
              Properties: {
                Key: 'Value',
              },
            }],
            EbsConfiguration: {
              EbsBlockDeviceConfigs: [{
                VolumeSpecification: {
                  Iops: 1,
                  SizeInGB: 1,
                  VolumeType: 'standard',
                },
                VolumesPerInstance: 1,
              }],
              EbsOptimized: true,
            },
            InstanceType: 'm5.xlarge',
            WeightedCapacity: 1,
          }],
          LaunchSpecifications: {
            OnDemandSpecification: {
              AllocationStrategy: 'lowest-price',
            },
          },
          Name: 'Master',
          TargetOnDemandCapacity: 1,
          TargetSpotCapacity: 1,
        }],
      },
      VisibleToAllUsers: true,
      JobFlowRole: {
        Ref: 'ClusterRoleD9CA7471',
      },
      ServiceRole: {
        Ref: 'ServiceRole4288B192',
      },
    },
  });
});

test('Create Cluster with InstanceGroup', () => {
  // WHEN
  const task = new EmrCreateCluster(stack, 'Task', {
    instances: {
      instanceGroups: [{
        autoScalingPolicy: {
          constraints: {
            maxCapacity: 2,
            minCapacity: 1,
          },
          rules: [{
            action: {
              market: EmrCreateCluster.InstanceMarket.ON_DEMAND,
              simpleScalingPolicyConfiguration: {
                adjustmentType: EmrCreateCluster.ScalingAdjustmentType.CHANGE_IN_CAPACITY,
                coolDown: 1,
                scalingAdjustment: 1,
              },
            },
            description: 'Description',
            name: 'Name',
            trigger: {
              cloudWatchAlarmDefinition: {
                comparisonOperator: EmrCreateCluster.CloudWatchAlarmComparisonOperator.GREATER_THAN,
                dimensions: [{
                  key: 'Key',
                  value: 'Value',
                }],
                evaluationPeriods: 1,
                metricName: 'Name',
                namespace: 'Namespace',
                period: cdk.Duration.seconds(300),
                statistic: EmrCreateCluster.CloudWatchAlarmStatistic.AVERAGE,
                threshold: 1,
                unit: EmrCreateCluster.CloudWatchAlarmUnit.NONE,
              },
            },
          }, {
            action: {
              market: EmrCreateCluster.InstanceMarket.ON_DEMAND,
              simpleScalingPolicyConfiguration: {
                adjustmentType: EmrCreateCluster.ScalingAdjustmentType.CHANGE_IN_CAPACITY,
                coolDown: 1,
                scalingAdjustment: 1,
              },
            },
            description: 'Description',
            name: 'Name',
            trigger: {
              cloudWatchAlarmDefinition: {
                comparisonOperator: EmrCreateCluster.CloudWatchAlarmComparisonOperator.GREATER_THAN,
                dimensions: [{
                  key: 'Key',
                  value: 'Value',
                }],
                evaluationPeriods: 1,
                metricName: 'Name',
                namespace: 'Namespace',
                period: cdk.Duration.seconds(sfn.JsonPath.numberAt('$.CloudWatchPeriod')),
                statistic: EmrCreateCluster.CloudWatchAlarmStatistic.AVERAGE,
                threshold: 1,
                unit: EmrCreateCluster.CloudWatchAlarmUnit.NONE,
              },
            },
          }],
        },
        bidPrice: '1',
        configurations: [{
          classification: 'Classification',
          properties: {
            Key: 'Value',
          },
        }],
        ebsConfiguration: {
          ebsBlockDeviceConfigs: [{
            volumeSpecification: {
              iops: 1,
              volumeSize: cdk.Size.gibibytes(1),
              volumeType: EmrCreateCluster.EbsBlockDeviceVolumeType.STANDARD,
            },
            volumesPerInstance: 1,
          }],
          ebsOptimized: true,
        },
        instanceCount: 1,
        instanceRole: EmrCreateCluster.InstanceRoleType.MASTER,
        instanceType: 'm5.xlarge',
        market: EmrCreateCluster.InstanceMarket.ON_DEMAND,
        name: 'Name',
      }],
    },
    clusterRole,
    name: 'Cluster',
    serviceRole,
    autoScalingRole,
    integrationPattern: sfn.IntegrationPattern.REQUEST_RESPONSE,
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::elasticmapreduce:createCluster',
        ],
      ],
    },
    End: true,
    Parameters: {
      Name: 'Cluster',
      Instances: {
        KeepJobFlowAliveWhenNoSteps: true,
        InstanceGroups: [{
          AutoScalingPolicy: {
            Constraints: {
              MaxCapacity: 2,
              MinCapacity: 1,
            },
            Rules: [{
              Action: {
                Market: 'ON_DEMAND',
                SimpleScalingPolicyConfiguration: {
                  AdjustmentType: 'CHANGE_IN_CAPACITY',
                  CoolDown: 1,
                  ScalingAdjustment: 1,
                },
              },
              Description: 'Description',
              Name: 'Name',
              Trigger: {
                CloudWatchAlarmDefinition: {
                  ComparisonOperator: 'GREATER_THAN',
                  Dimensions: [{
                    Key: 'Key',
                    Value: 'Value',
                  }],
                  EvaluationPeriods: 1,
                  MetricName: 'Name',
                  Namespace: 'Namespace',
                  Period: 300,
                  Statistic: 'AVERAGE',
                  Threshold: 1,
                  Unit: 'NONE',
                },
              },
            }, {
              Action: {
                Market: 'ON_DEMAND',
                SimpleScalingPolicyConfiguration: {
                  AdjustmentType: 'CHANGE_IN_CAPACITY',
                  CoolDown: 1,
                  ScalingAdjustment: 1,
                },
              },
              Description: 'Description',
              Name: 'Name',
              Trigger: {
                CloudWatchAlarmDefinition: {
                  'ComparisonOperator': 'GREATER_THAN',
                  'Dimensions': [{
                    Key: 'Key',
                    Value: 'Value',
                  }],
                  'EvaluationPeriods': 1,
                  'MetricName': 'Name',
                  'Namespace': 'Namespace',
                  'Period.$': '$.CloudWatchPeriod',
                  'Statistic': 'AVERAGE',
                  'Threshold': 1,
                  'Unit': 'NONE',
                },
              },
            }],
          },
          BidPrice: '1',
          Configurations: [{
            Classification: 'Classification',
            Properties: {
              Key: 'Value',
            },
          }],
          EbsConfiguration: {
            EbsBlockDeviceConfigs: [{
              VolumeSpecification: {
                Iops: 1,
                SizeInGB: 1,
                VolumeType: 'standard',
              },
              VolumesPerInstance: 1,
            }],
            EbsOptimized: true,
          },
          InstanceCount: 1,
          InstanceRole: 'MASTER',
          InstanceType: 'm5.xlarge',
          Market: 'ON_DEMAND',
          Name: 'Name',
        }],
      },
      VisibleToAllUsers: true,
      JobFlowRole: {
        Ref: 'ClusterRoleD9CA7471',
      },
      ServiceRole: {
        Ref: 'ServiceRole4288B192',
      },
      AutoScalingRole: {
        Ref: 'AutoScalingRole015ADA0A',
      },
    },
  });
});

test('Task throws if WAIT_FOR_TASK_TOKEN is supplied as service integration pattern', () => {
  expect(() => {
    new EmrCreateCluster(stack, 'Task', {
      instances: {},
      clusterRole,
      name: 'Cluster',
      serviceRole,
      autoScalingRole,
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
    });
  }).toThrow(/Unsupported service integration pattern. Supported Patterns: REQUEST_RESPONSE,RUN_JOB. Received: WAIT_FOR_TASK_TOKEN/);
});
