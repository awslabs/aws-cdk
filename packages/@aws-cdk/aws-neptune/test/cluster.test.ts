import '@aws-cdk/assert-internal/jest';
import { ABSENT, ResourcePart } from '@aws-cdk/assert-internal';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import * as cdk from '@aws-cdk/core';

import { ClusterParameterGroup, DatabaseCluster, EngineVersion, InstanceType } from '../lib';

describe('DatabaseCluster', () => {
  test('check that instantiation works', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      vpc,
      instanceType: InstanceType.R5_LARGE,
    });

    // THEN
    expect(stack).toHaveResource('AWS::Neptune::DBCluster', {
      Properties: {
        DBSubnetGroupName: { Ref: 'DatabaseSubnets3C9252C9' },
        VpcSecurityGroupIds: [{ 'Fn::GetAtt': ['DatabaseSecurityGroup5C91FDCB', 'GroupId'] }],
        StorageEncrypted: true,
      },
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
    }, ResourcePart.CompleteDefinition);

    expect(stack).toHaveResource('AWS::Neptune::DBInstance', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
    }, ResourcePart.CompleteDefinition);

    expect(stack).toHaveResource('AWS::Neptune::DBSubnetGroup', {
      SubnetIds: [
        { Ref: 'VPCPrivateSubnet1Subnet8BCA10E0' },
        { Ref: 'VPCPrivateSubnet2SubnetCFCDAA7A' },
        { Ref: 'VPCPrivateSubnet3Subnet3EDCD457' },
      ],
    });
  });

  test('can create a cluster with a single instance', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      instances: 1,
      vpc,
      instanceType: InstanceType.R5_LARGE,
    });

    // THEN
    expect(stack).toHaveResource('AWS::Neptune::DBCluster', {
      DBSubnetGroupName: { Ref: 'DatabaseSubnets3C9252C9' },
      VpcSecurityGroupIds: [{ 'Fn::GetAtt': ['DatabaseSecurityGroup5C91FDCB', 'GroupId'] }],
    });
  });

  test('errors when less than one instance is specified', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    expect(() => {
      new DatabaseCluster(stack, 'Database', {
        instances: 0,
        vpc,
        instanceType: InstanceType.R5_LARGE,
      });
    }).toThrowError('At least one instance is required');
  });

  test('errors when only one subnet is specified', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC', {
      maxAzs: 1,
    });

    // WHEN
    expect(() => {
      new DatabaseCluster(stack, 'Database', {
        instances: 1,
        vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE,
        },
        instanceType: InstanceType.R5_LARGE,
      });
    }).toThrowError('Cluster requires at least 2 subnets, got 1');
  });

  test('can create a cluster with custom engine version', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      vpc,
      instanceType: InstanceType.R5_LARGE,
      engineVersion: EngineVersion.V1_0_4_1,
    });

    // THEN
    expect(stack).toHaveResource('AWS::Neptune::DBCluster', {
      EngineVersion: '1.0.4.1',
      DBSubnetGroupName: { Ref: 'DatabaseSubnets3C9252C9' },
      VpcSecurityGroupIds: [{ 'Fn::GetAtt': ['DatabaseSecurityGroup5C91FDCB', 'GroupId'] }],
    });
  });

  test('can create a cluster with imported vpc and security group', () => {
    // GIVEN
    const stack = testStack();
    const vpc = ec2.Vpc.fromLookup(stack, 'VPC', {
      vpcId: 'VPC12345',
    });
    const sg = ec2.SecurityGroup.fromSecurityGroupId(stack, 'SG', 'SecurityGroupId12345');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      instances: 1,
      vpc,
      securityGroups: [sg],
      instanceType: InstanceType.R5_LARGE,
    });

    // THEN
    expect(stack).toHaveResource('AWS::Neptune::DBCluster', {
      DBSubnetGroupName: { Ref: 'DatabaseSubnets3C9252C9' },
      VpcSecurityGroupIds: ['SecurityGroupId12345'],
    });
  });

  test('cluster with parameter group', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    const group = new ClusterParameterGroup(stack, 'Params', {
      description: 'bye',
      parameters: {
        param: 'value',
      },
    });
    new DatabaseCluster(stack, 'Database', {
      vpc,
      instanceType: InstanceType.R5_LARGE,
      clusterParameterGroup: group,
    });

    // THEN
    expect(stack).toHaveResource('AWS::Neptune::DBCluster', {
      DBClusterParameterGroupName: { Ref: 'ParamsA8366201' },
    });
  });

  test('cluster with associated role', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    const role = new iam.Role(stack, 'Role', {
      assumedBy: new iam.ServicePrincipal('rds.amazonaws.com'),
    });
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'));

    new DatabaseCluster(stack, 'Database', {
      vpc,
      associatedRoles: [role],
      instanceType: InstanceType.R5_LARGE,
    });

    // THEN
    expect(stack).toHaveResource('AWS::Neptune::DBCluster', {
      AssociatedRoles: [
        {
          RoleArn: {
            'Fn::GetAtt': [
              'Role1ABCC5F0',
              'Arn',
            ],
          },
        },
      ],
    });
  });

  test('cluster with imported parameter group', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    const group = ClusterParameterGroup.fromClusterParameterGroupName(stack, 'Params', 'ParamGroupName');

    new DatabaseCluster(stack, 'Database', {
      vpc,
      instanceType: InstanceType.R5_LARGE,
      clusterParameterGroup: group,
    });

    // THEN
    expect(stack).toHaveResource('AWS::Neptune::DBCluster', {
      DBClusterParameterGroupName: 'ParamGroupName',
    });
  });

  test('create an encrypted cluster with custom KMS key', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      vpc,
      instanceType: InstanceType.R5_LARGE,
      kmsKey: new kms.Key(stack, 'Key'),
    });

    // THEN
    expect(stack).toHaveResource('AWS::Neptune::DBCluster', {
      KmsKeyId: {
        'Fn::GetAtt': [
          'Key961B73FD',
          'Arn',
        ],
      },
      StorageEncrypted: true,
    });
  });

  test('creating a cluster defaults to using encryption', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      vpc,
      instanceType: InstanceType.R5_LARGE,
    });

    // THEN
    expect(stack).toHaveResource('AWS::Neptune::DBCluster', {
      StorageEncrypted: true,
    });
  });

  test('supplying a KMS key with storageEncryption false throws an error', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    function action() {
      new DatabaseCluster(stack, 'Database', {
        vpc,
        instanceType: InstanceType.R5_LARGE,
        kmsKey: new kms.Key(stack, 'Key'),
        storageEncrypted: false,
      });
    }

    // THEN
    expect(action).toThrow();
  });

  test('cluster exposes different read and write endpoints', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    const cluster = new DatabaseCluster(stack, 'Database', {
      vpc,
      instanceType: InstanceType.R5_LARGE,
    });

    // THEN
    expect(stack.resolve(cluster.clusterEndpoint)).not.toBe(stack.resolve(cluster.clusterReadEndpoint));
  });

  test('instance identifier used when present', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    const instanceIdentifierBase = 'instanceidentifierbase-';
    new DatabaseCluster(stack, 'Database', {
      vpc,
      instanceType: InstanceType.R5_LARGE,
      instanceIdentifierBase,
    });

    // THEN
    expect(stack).toHaveResource('AWS::Neptune::DBInstance', {
      DBInstanceIdentifier: `${instanceIdentifierBase}1`,
    });
  });

  test('cluster identifier used', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    const clusterIdentifier = 'clusteridentifier-';
    new DatabaseCluster(stack, 'Database', {
      vpc,
      instanceType: InstanceType.R5_LARGE,
      dbClusterName: clusterIdentifier,
    });

    // THEN
    expect(stack).toHaveResource('AWS::Neptune::DBInstance', {
      DBInstanceIdentifier: `${clusterIdentifier}instance1`,
    });
  });

  test('imported cluster has supplied attributes', () => {
    // GIVEN
    const stack = testStack();

    // WHEN
    const cluster = DatabaseCluster.fromDatabaseClusterAttributes(stack, 'Database', {
      clusterEndpointAddress: 'addr',
      clusterIdentifier: 'identifier',
      clusterResourceIdentifier: 'resourceIdentifier',
      port: 3306,
      readerEndpointAddress: 'reader-address',
      securityGroup: ec2.SecurityGroup.fromSecurityGroupId(stack, 'SG', 'sg-123456789', {
        allowAllOutbound: false,
      }),
    });

    // THEN
    expect(cluster.clusterEndpoint.hostname).toEqual('addr');
    expect(cluster.clusterEndpoint.port).toEqual(3306);
    expect(cluster.clusterIdentifier).toEqual('identifier');
    expect(cluster.clusterReadEndpoint.hostname).toEqual('reader-address');
  });

  test('imported cluster with imported security group honors allowAllOutbound', () => {
    // GIVEN
    const stack = testStack();

    const cluster = DatabaseCluster.fromDatabaseClusterAttributes(stack, 'Database', {
      clusterEndpointAddress: 'addr',
      clusterIdentifier: 'identifier',
      clusterResourceIdentifier: 'resourceIdentifier',
      port: 3306,
      readerEndpointAddress: 'reader-address',
      securityGroup: ec2.SecurityGroup.fromSecurityGroupId(stack, 'SG', 'sg-123456789', {
        allowAllOutbound: false,
      }),
    });

    // WHEN
    cluster.connections.allowToAnyIpv4(ec2.Port.tcp(443));

    // THEN
    expect(stack).toHaveResource('AWS::EC2::SecurityGroupEgress', {
      GroupId: 'sg-123456789',
    });
  });

  test('backup retention period respected', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      vpc,
      instanceType: InstanceType.R5_LARGE,
      backupRetention: cdk.Duration.days(20),
    });

    // THEN
    expect(stack).toHaveResource('AWS::Neptune::DBCluster', {
      BackupRetentionPeriod: 20,
    });
  });

  test('backup maintenance window respected', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      vpc,
      instanceType: InstanceType.R5_LARGE,
      backupRetention: cdk.Duration.days(20),
      preferredBackupWindow: '07:34-08:04',
    });

    // THEN
    expect(stack).toHaveResource('AWS::Neptune::DBCluster', {
      BackupRetentionPeriod: 20,
      PreferredBackupWindow: '07:34-08:04',
    });
  });

  test('regular maintenance window respected', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      vpc,
      instanceType: InstanceType.R5_LARGE,
      preferredMaintenanceWindow: '07:34-08:04',
    });

    // THEN
    expect(stack).toHaveResource('AWS::Neptune::DBCluster', {
      PreferredMaintenanceWindow: '07:34-08:04',
    });
  });

  test('iam authentication - off by default', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Cluster', {
      vpc,
      instanceType: InstanceType.R5_LARGE,
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Neptune::DBCluster', {
      IamAuthEnabled: ABSENT,
    });
  });

  test('createGrant - creates IAM policy and enables IAM auth', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    const cluster = new DatabaseCluster(stack, 'Cluster', {
      vpc,
      instanceType: InstanceType.R5_LARGE,
    });
    const role = new iam.Role(stack, 'DBRole', {
      assumedBy: new iam.AccountPrincipal(stack.account),
    });
    cluster.grantConnect(role);

    // THEN
    expect(stack).toHaveResourceLike('AWS::Neptune::DBCluster', {
      IamAuthEnabled: true,
    });
    expect(stack).toHaveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [{
          Effect: 'Allow',
          Action: 'neptune-db:*',
          Resource: {
            'Fn::Join': [
              '', [
                'arn:', {
                  Ref: 'AWS::Partition',
                },
                ':neptune-db:',
                {
                  Ref: 'AWS::Region',
                },
                ':',
                {
                  Ref: 'AWS::AccountId',
                },
                ':',
                {
                  'Fn::GetAtt': [
                    'ClusterEB0386A7',
                    'ClusterResourceId',
                  ],
                },
                '/*',
              ],
            ],
          },
        }],
        Version: '2012-10-17',
      },
    });
  });

  test('createGrant - throws if IAM auth disabled', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    const cluster = new DatabaseCluster(stack, 'Cluster', {
      vpc,
      instanceType: InstanceType.R5_LARGE,
      iamAuthentication: false,
    });
    const role = new iam.Role(stack, 'DBRole', {
      assumedBy: new iam.AccountPrincipal(stack.account),
    });

    // THEN
    expect(() => { cluster.grantConnect(role); }).toThrow(/Cannot grant connect when IAM authentication is disabled/);
  });
});

function testStack() {
  const stack = new cdk.Stack(undefined, undefined, { env: { account: '12345', region: 'us-test-1' } });
  stack.node.setContext('availability-zones:12345:us-test-1', ['us-test-1a', 'us-test-1b']);
  return stack;
}
