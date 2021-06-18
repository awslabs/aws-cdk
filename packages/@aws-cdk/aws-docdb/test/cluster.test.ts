import { expect as expectCDK, haveResource, ResourcePart, arrayWith } from '@aws-cdk/assert-internal';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as kms from '@aws-cdk/aws-kms';
import * as cdk from '@aws-cdk/core';

import { ClusterParameterGroup, DatabaseCluster, DatabaseSecret } from '../lib';

describe('DatabaseCluster', () => {
  test('check that instantiation works', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      masterUser: {
        username: 'admin',
        password: cdk.SecretValue.plainText('tooshort'),
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
      vpc,
    });

    // THEN
    expectCDK(stack).to(haveResource('AWS::DocDB::DBCluster', {
      Properties: {
        DBSubnetGroupName: { Ref: 'DatabaseSubnets56F17B9A' },
        MasterUsername: 'admin',
        MasterUserPassword: 'tooshort',
        VpcSecurityGroupIds: [{ 'Fn::GetAtt': ['DatabaseSecurityGroup5C91FDCB', 'GroupId'] }],
        StorageEncrypted: true,
      },
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
    }, ResourcePart.CompleteDefinition));

    expectCDK(stack).to(haveResource('AWS::DocDB::DBInstance', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
    }, ResourcePart.CompleteDefinition));

    expectCDK(stack).to(haveResource('AWS::DocDB::DBSubnetGroup', {
      SubnetIds: [
        { Ref: 'VPCPrivateSubnet1Subnet8BCA10E0' },
        { Ref: 'VPCPrivateSubnet2SubnetCFCDAA7A' },
        { Ref: 'VPCPrivateSubnet3Subnet3EDCD457' },
      ],
    }));
  });

  test('can create a cluster with a single instance', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      instances: 1,
      masterUser: {
        username: 'admin',
        password: cdk.SecretValue.plainText('tooshort'),
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
      vpc,
    });

    // THEN
    expectCDK(stack).to(haveResource('AWS::DocDB::DBCluster', {
      DBSubnetGroupName: { Ref: 'DatabaseSubnets56F17B9A' },
      MasterUsername: 'admin',
      MasterUserPassword: 'tooshort',
      VpcSecurityGroupIds: [{ 'Fn::GetAtt': ['DatabaseSecurityGroup5C91FDCB', 'GroupId'] }],
    }));
  });

  test('errors when less than one instance is specified', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    expect(() => {
      new DatabaseCluster(stack, 'Database', {
        instances: 0,
        masterUser: {
          username: 'admin',
        },
        vpc,
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.R5, ec2.InstanceSize.LARGE),
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
        masterUser: {
          username: 'admin',
        },
        vpc,
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.R5, ec2.InstanceSize.LARGE),
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE,
        },
      });
    }).toThrowError('Cluster requires at least 2 subnets, got 1');
  });

  test('secret attachment target type is correct', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      instances: 1,
      masterUser: {
        username: 'admin',
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
      vpc,
    });

    // THEN
    expectCDK(stack).to(haveResource('AWS::SecretsManager::SecretTargetAttachment', {
      SecretId: { Ref: 'DatabaseSecret3B817195' },
      TargetId: { Ref: 'DatabaseB269D8BB' },
      TargetType: 'AWS::DocDB::DBCluster',
    }));
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
      masterUser: {
        username: 'admin',
        password: cdk.SecretValue.plainText('tooshort'),
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
      vpc,
      securityGroup: sg,
    });

    // THEN
    expectCDK(stack).to(haveResource('AWS::DocDB::DBCluster', {
      DBSubnetGroupName: { Ref: 'DatabaseSubnets56F17B9A' },
      MasterUsername: 'admin',
      MasterUserPassword: 'tooshort',
      VpcSecurityGroupIds: ['SecurityGroupId12345'],
    }));
  });

  test('cluster with parameter group', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    const group = new ClusterParameterGroup(stack, 'Params', {
      family: 'hello',
      description: 'bye',
      parameters: {
        param: 'value',
      },
    });
    new DatabaseCluster(stack, 'Database', {
      masterUser: {
        username: 'admin',
        password: cdk.SecretValue.plainText('tooshort'),
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
      vpc,
      parameterGroup: group,
    });

    // THEN
    expectCDK(stack).to(haveResource('AWS::DocDB::DBCluster', {
      DBClusterParameterGroupName: { Ref: 'ParamsA8366201' },
    }));
  });

  test('cluster with imported parameter group', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    const group = ClusterParameterGroup.fromParameterGroupName(stack, 'Params', 'ParamGroupName');

    new DatabaseCluster(stack, 'Database', {
      masterUser: {
        username: 'admin',
        password: cdk.SecretValue.plainText('tooshort'),
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
      vpc,
      parameterGroup: group,
    });

    // THEN
    expectCDK(stack).to(haveResource('AWS::DocDB::DBCluster', {
      DBClusterParameterGroupName: 'ParamGroupName',
    }));
  });

  test('creates a secret when master credentials are not specified', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      masterUser: {
        username: 'admin',
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
      vpc,
    });

    // THEN
    expectCDK(stack).to(haveResource('AWS::DocDB::DBCluster', {
      MasterUsername: {
        'Fn::Join': [
          '',
          [
            '{{resolve:secretsmanager:',
            {
              Ref: 'DatabaseSecret3B817195',
            },
            ':SecretString:username::}}',
          ],
        ],
      },
      MasterUserPassword: {
        'Fn::Join': [
          '',
          [
            '{{resolve:secretsmanager:',
            {
              Ref: 'DatabaseSecret3B817195',
            },
            ':SecretString:password::}}',
          ],
        ],
      },
    }));

    expectCDK(stack).to(haveResource('AWS::SecretsManager::Secret', {
      GenerateSecretString: {
        ExcludeCharacters: '\"@/',
        GenerateStringKey: 'password',
        PasswordLength: 41,
        SecretStringTemplate: '{"username":"admin"}',
      },
    }));
  });

  test('create an encrypted cluster with custom KMS key', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      masterUser: {
        username: 'admin',
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
      vpc,
      kmsKey: new kms.Key(stack, 'Key'),
    });

    // THEN
    expectCDK(stack).to(haveResource('AWS::DocDB::DBCluster', {
      KmsKeyId: {
        'Fn::GetAtt': [
          'Key961B73FD',
          'Arn',
        ],
      },
      StorageEncrypted: true,
    }));
  });

  test('creating a cluster defaults to using encryption', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      masterUser: {
        username: 'admin',
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
      vpc,
    });

    // THEN
    expectCDK(stack).to(haveResource('AWS::DocDB::DBCluster', {
      StorageEncrypted: true,
    }));
  });

  test('supplying a KMS key with storageEncryption false throws an error', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    function action() {
      new DatabaseCluster(stack, 'Database', {
        masterUser: {
          username: 'admin',
        },
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
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
      masterUser: {
        username: 'admin',
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
      vpc,
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
      masterUser: {
        username: 'admin',
      },
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.R5, ec2.InstanceSize.SMALL),
      instanceIdentifierBase,
    });

    // THEN
    expectCDK(stack).to(haveResource('AWS::DocDB::DBInstance', {
      DBInstanceIdentifier: `${instanceIdentifierBase}1`,
    }));
  });

  test('cluster identifier used', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    const clusterIdentifier = 'clusteridentifier-';
    new DatabaseCluster(stack, 'Database', {
      masterUser: {
        username: 'admin',
      },
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.R5, ec2.InstanceSize.SMALL),
      dbClusterName: clusterIdentifier,
    });

    // THEN
    expectCDK(stack).to(haveResource('AWS::DocDB::DBInstance', {
      DBInstanceIdentifier: `${clusterIdentifier}instance1`,
    }));
  });

  test('imported cluster has supplied attributes', () => {
    // GIVEN
    const stack = testStack();

    // WHEN
    const cluster = DatabaseCluster.fromDatabaseClusterAttributes(stack, 'Database', {
      clusterEndpointAddress: 'addr',
      clusterIdentifier: 'identifier',
      instanceEndpointAddresses: ['addr'],
      instanceIdentifiers: ['identifier'],
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
    expect(cluster.instanceIdentifiers).toEqual(['identifier']);
    expect(cluster.clusterReadEndpoint.hostname).toEqual('reader-address');
    expect(cluster.securityGroupId).toEqual('sg-123456789');
  });

  test('imported cluster with imported security group honors allowAllOutbound', () => {
    // GIVEN
    const stack = testStack();

    const cluster = DatabaseCluster.fromDatabaseClusterAttributes(stack, 'Database', {
      clusterEndpointAddress: 'addr',
      clusterIdentifier: 'identifier',
      instanceEndpointAddresses: ['addr'],
      instanceIdentifiers: ['identifier'],
      port: 3306,
      readerEndpointAddress: 'reader-address',
      securityGroup: ec2.SecurityGroup.fromSecurityGroupId(stack, 'SG', 'sg-123456789', {
        allowAllOutbound: false,
      }),
    });

    // WHEN
    cluster.connections.allowToAnyIpv4(ec2.Port.tcp(443));

    // THEN
    expectCDK(stack).to(haveResource('AWS::EC2::SecurityGroupEgress', {
      GroupId: 'sg-123456789',
    }));
  });

  test('backup retention period respected', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      masterUser: {
        username: 'admin',
      },
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.R5, ec2.InstanceSize.SMALL),
      backup: {
        retention: cdk.Duration.days(20),
      },
    });

    // THEN
    expectCDK(stack).to(haveResource('AWS::DocDB::DBCluster', {
      BackupRetentionPeriod: 20,
    }));
  });

  test('backup maintenance window respected', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      masterUser: {
        username: 'admin',
      },
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.R5, ec2.InstanceSize.SMALL),
      backup: {
        retention: cdk.Duration.days(20),
        preferredWindow: '07:34-08:04',
      },
    });

    // THEN
    expectCDK(stack).to(haveResource('AWS::DocDB::DBCluster', {
      BackupRetentionPeriod: 20,
      PreferredBackupWindow: '07:34-08:04',
    }));
  });

  test('regular maintenance window respected', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      masterUser: {
        username: 'admin',
      },
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.R5, ec2.InstanceSize.SMALL),
      preferredMaintenanceWindow: '07:34-08:04',
    });

    // THEN
    expectCDK(stack).to(haveResource('AWS::DocDB::DBCluster', {
      PreferredMaintenanceWindow: '07:34-08:04',
    }));
  });

  test('single user rotation', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new DatabaseCluster(stack, 'Database', {
      masterUser: {
        username: 'admin',
      },
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.R5, ec2.InstanceSize.SMALL),
    });

    // WHEN
    cluster.addRotationSingleUser(cdk.Duration.days(5));

    // THEN
    expectCDK(stack).to(haveResource('AWS::Serverless::Application', {
      Location: {
        ApplicationId: { 'Fn::FindInMap': ['DatabaseRotationSingleUserSARMapping9AEB3E55', { Ref: 'AWS::Partition' }, 'applicationId'] },
        SemanticVersion: { 'Fn::FindInMap': ['DatabaseRotationSingleUserSARMapping9AEB3E55', { Ref: 'AWS::Partition' }, 'semanticVersion'] },
      },
      Parameters: {
        endpoint: {
          'Fn::Join': [
            '',
            [
              'https://secretsmanager.us-test-1.',
              { Ref: 'AWS::URLSuffix' },
            ],
          ],
        },
        functionName: 'DatabaseRotationSingleUser458A45BE',
        vpcSubnetIds: {
          'Fn::Join': [
            '',
            [
              { Ref: 'VPCPrivateSubnet1Subnet8BCA10E0' },
              ',',
              { Ref: 'VPCPrivateSubnet2SubnetCFCDAA7A' },
              ',',
              { Ref: 'VPCPrivateSubnet3Subnet3EDCD457' },
            ],
          ],
        },
        vpcSecurityGroupIds: {
          'Fn::GetAtt': ['DatabaseRotationSingleUserSecurityGroupAC6E0E73', 'GroupId'],
        },
      },
    }));
    expectCDK(stack).to(haveResource('AWS::SecretsManager::RotationSchedule', {
      SecretId: { Ref: 'DatabaseSecretAttachmentE5D1B020' },
      RotationLambdaARN: {
        'Fn::GetAtt': ['DatabaseRotationSingleUser65F55654', 'Outputs.RotationLambdaARN'],
      },
      RotationRules: {
        AutomaticallyAfterDays: 5,
      },
    }));
  });

  test('single user rotation requires secret', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new DatabaseCluster(stack, 'Database', {
      masterUser: {
        username: 'admin',
        password: cdk.SecretValue.plainText('secret'),
      },
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.R5, ec2.InstanceSize.SMALL),
    });

    // WHEN
    function addSingleUserRotation() {
      cluster.addRotationSingleUser(cdk.Duration.days(10));
    }

    // THEN
    expect(addSingleUserRotation).toThrow();
  });

  test('no multiple single user rotations', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new DatabaseCluster(stack, 'Database', {
      masterUser: {
        username: 'admin',
      },
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.R5, ec2.InstanceSize.SMALL),
    });

    // WHEN
    cluster.addRotationSingleUser(cdk.Duration.days(5));
    function addSecondRotation() {
      cluster.addRotationSingleUser(cdk.Duration.days(10));
    }

    // THEN
    expect(addSecondRotation).toThrow();
  });

  test('multi user rotation', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new DatabaseCluster(stack, 'Database', {
      masterUser: {
        username: 'admin',
      },
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.R5, ec2.InstanceSize.SMALL),
    });
    const userSecret = new DatabaseSecret(stack, 'UserSecret', {
      username: 'seconduser',
      masterSecret: cluster.secret,
    });
    userSecret.attach(cluster);

    // WHEN
    cluster.addRotationMultiUser('Rotation', {
      secret: userSecret,
      automaticallyAfter: cdk.Duration.days(5),
    });

    // THEN
    expectCDK(stack).to(haveResource('AWS::Serverless::Application', {
      Location: {
        ApplicationId: { 'Fn::FindInMap': ['DatabaseRotationSARMappingE46CFA92', { Ref: 'AWS::Partition' }, 'applicationId'] },
        SemanticVersion: { 'Fn::FindInMap': ['DatabaseRotationSARMappingE46CFA92', { Ref: 'AWS::Partition' }, 'semanticVersion'] },
      },
      Parameters: {
        endpoint: {
          'Fn::Join': [
            '',
            [
              'https://secretsmanager.us-test-1.',
              { Ref: 'AWS::URLSuffix' },
            ],
          ],
        },
        functionName: 'DatabaseRotation0D47EBD2',
        vpcSubnetIds: {
          'Fn::Join': [
            '',
            [
              { Ref: 'VPCPrivateSubnet1Subnet8BCA10E0' },
              ',',
              { Ref: 'VPCPrivateSubnet2SubnetCFCDAA7A' },
              ',',
              { Ref: 'VPCPrivateSubnet3Subnet3EDCD457' },
            ],
          ],
        },
        vpcSecurityGroupIds: {
          'Fn::GetAtt': ['DatabaseRotationSecurityGroup17736B63', 'GroupId'],
        },
        masterSecretArn: { Ref: 'DatabaseSecretAttachmentE5D1B020' },
      },
    }));
    expectCDK(stack).to(haveResource('AWS::SecretsManager::RotationSchedule', {
      SecretId: { Ref: 'UserSecret0463E4F5' },
      RotationLambdaARN: {
        'Fn::GetAtt': ['DatabaseRotation6B6E1D86', 'Outputs.RotationLambdaARN'],
      },
      RotationRules: {
        AutomaticallyAfterDays: 5,
      },
    }));
  });

  test('multi user rotation requires secret', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new DatabaseCluster(stack, 'Database', {
      masterUser: {
        username: 'admin',
        password: cdk.SecretValue.plainText('secret'),
      },
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.R5, ec2.InstanceSize.SMALL),
    });
    const userSecret = new DatabaseSecret(stack, 'UserSecret', {
      username: 'seconduser',
      masterSecret: cluster.secret,
    });
    userSecret.attach(cluster);

    // WHEN
    function addMultiUserRotation() {
      cluster.addRotationMultiUser('Rotation', {
        secret: userSecret,
      });
    }

    // THEN
    expect(addMultiUserRotation).toThrow();
  });

  test('adds security groups', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new DatabaseCluster(stack, 'Database', {
      vpc,
      masterUser: {
        username: 'admin',
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.R5, ec2.InstanceSize.SMALL),
    });
    const securityGroup = new ec2.SecurityGroup(stack, 'SecurityGroup', {
      vpc,
    });

    // WHEN
    cluster.addSecurityGroups(securityGroup);

    // THEN
    expectCDK(stack).to(haveResource('AWS::DocDB::DBCluster', {
      VpcSecurityGroupIds: arrayWith(stack.resolve(securityGroup.securityGroupId)),
    }));
  });
});

function testStack() {
  const stack = new cdk.Stack(undefined, undefined, { env: { account: '12345', region: 'us-test-1' } });
  stack.node.setContext('availability-zones:12345:us-test-1', ['us-test-1a', 'us-test-1b']);
  return stack;
}
