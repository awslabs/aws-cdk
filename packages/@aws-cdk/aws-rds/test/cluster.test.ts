import '@aws-cdk/assert-internal/jest';
import { ABSENT, ResourcePart, SynthUtils } from '@aws-cdk/assert-internal';
import * as ec2 from '@aws-cdk/aws-ec2';
import { ManagedPolicy, Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import * as logs from '@aws-cdk/aws-logs';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import * as cxapi from '@aws-cdk/cx-api';
import { testFutureBehavior } from 'cdk-build-tools/lib/feature-flag';
import {
  AuroraEngineVersion, AuroraMysqlEngineVersion, AuroraPostgresEngineVersion, CfnDBCluster, Credentials, DatabaseCluster,
  DatabaseClusterEngine, DatabaseClusterFromSnapshot, ParameterGroup, PerformanceInsightRetention, SubnetGroup, DatabaseSecret,
} from '../lib';

describe('cluster', () => {
  test('creating a Cluster also creates 2 DB Instances', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      credentials: {
        username: 'admin',
        password: cdk.SecretValue.plainText('tooshort'),
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
      iamAuthentication: true,
    });

    // THEN
    expect(stack).toHaveResource('AWS::RDS::DBCluster', {
      Properties: {
        Engine: 'aurora',
        DBSubnetGroupName: { Ref: 'DatabaseSubnets56F17B9A' },
        MasterUsername: 'admin',
        MasterUserPassword: 'tooshort',
        VpcSecurityGroupIds: [{ 'Fn::GetAtt': ['DatabaseSecurityGroup5C91FDCB', 'GroupId'] }],
        EnableIAMDatabaseAuthentication: true,
      },
      DeletionPolicy: 'Snapshot',
      UpdateReplacePolicy: 'Snapshot',
    }, ResourcePart.CompleteDefinition);

    expect(stack).toCountResources('AWS::RDS::DBInstance', 2);
    expect(stack).toHaveResource('AWS::RDS::DBInstance', {
      DeletionPolicy: 'Delete',
      UpdateReplacePolicy: 'Delete',
    }, ResourcePart.CompleteDefinition);
  });

  test('validates that the number of instances is not a deploy-time value', () => {
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const parameter = new cdk.CfnParameter(stack, 'Param', { type: 'Number' });

    expect(() => {
      new DatabaseCluster(stack, 'Database', {
        instances: parameter.valueAsNumber,
        engine: DatabaseClusterEngine.AURORA,
        instanceProps: {
          vpc,
        },
      });
    }).toThrow('The number of instances an RDS Cluster consists of cannot be provided as a deploy-time only value!');
  });

  test('can create a cluster with a single instance', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    const cluster = new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      instances: 1,
      credentials: {
        username: 'admin',
        password: cdk.SecretValue.plainText('tooshort'),
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
    });

    // THEN
    expect(stack).toHaveResource('AWS::RDS::DBCluster', {
      Engine: 'aurora',
      DBSubnetGroupName: { Ref: 'DatabaseSubnets56F17B9A' },
      MasterUsername: 'admin',
      MasterUserPassword: 'tooshort',
      VpcSecurityGroupIds: [{ 'Fn::GetAtt': ['DatabaseSecurityGroup5C91FDCB', 'GroupId'] }],
    });

    expect(cluster.instanceIdentifiers).toHaveLength(1);
    expect(stack.resolve(cluster.instanceIdentifiers[0])).toEqual({
      Ref: 'DatabaseInstance1844F58FD',
    });

    expect(cluster.instanceEndpoints).toHaveLength(1);
    expect(stack.resolve(cluster.instanceEndpoints[0])).toEqual({
      hostname: {
        'Fn::GetAtt': ['DatabaseInstance1844F58FD', 'Endpoint.Address'],
      },
      port: {
        'Fn::GetAtt': ['DatabaseB269D8BB', 'Endpoint.Port'],
      },
      socketAddress: {
        'Fn::Join': ['', [
          { 'Fn::GetAtt': ['DatabaseInstance1844F58FD', 'Endpoint.Address'] },
          ':',
          { 'Fn::GetAtt': ['DatabaseB269D8BB', 'Endpoint.Port'] },
        ]],
      },
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
      engine: DatabaseClusterEngine.AURORA,
      instances: 1,
      credentials: {
        username: 'admin',
        password: cdk.SecretValue.plainText('tooshort'),
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
        securityGroups: [sg],
      },
    });

    // THEN
    expect(stack).toHaveResource('AWS::RDS::DBCluster', {
      Engine: 'aurora',
      DBSubnetGroupName: { Ref: 'DatabaseSubnets56F17B9A' },
      MasterUsername: 'admin',
      MasterUserPassword: 'tooshort',
      VpcSecurityGroupIds: ['SecurityGroupId12345'],
    });
  });

  test('cluster with parameter group', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    const group = new ParameterGroup(stack, 'Params', {
      engine: DatabaseClusterEngine.AURORA,
      description: 'bye',
      parameters: {
        param: 'value',
      },
    });
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      credentials: {
        username: 'admin',
        password: cdk.SecretValue.plainText('tooshort'),
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
      parameterGroup: group,
    });

    // THEN
    expect(stack).toHaveResource('AWS::RDS::DBCluster', {
      DBClusterParameterGroupName: { Ref: 'ParamsA8366201' },
    });
  });

  test("sets the retention policy of the SubnetGroup to 'Retain' if the Cluster is created with 'Retain'", () => {
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Vpc');

    new DatabaseCluster(stack, 'Cluster', {
      credentials: { username: 'admin' },
      engine: DatabaseClusterEngine.AURORA,
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.LARGE),
        vpc,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    expect(stack).toHaveResourceLike('AWS::RDS::DBSubnetGroup', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
    }, ResourcePart.CompleteDefinition);
  });

  test('creates a secret when master credentials are not specified', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA_MYSQL,
      credentials: {
        username: 'admin',
        excludeCharacters: '"@/\\',
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
    });

    // THEN
    expect(stack).toHaveResource('AWS::RDS::DBCluster', {
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
    });

    expect(stack).toHaveResource('AWS::SecretsManager::Secret', {
      GenerateSecretString: {
        ExcludeCharacters: '\"@/\\',
        GenerateStringKey: 'password',
        PasswordLength: 30,
        SecretStringTemplate: '{"username":"admin"}',
      },
    });
  });

  test('create an encrypted cluster with custom KMS key', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA_MYSQL,
      credentials: {
        username: 'admin',
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
      storageEncryptionKey: new kms.Key(stack, 'Key'),
    });

    // THEN
    expect(stack).toHaveResource('AWS::RDS::DBCluster', {
      KmsKeyId: {
        'Fn::GetAtt': [
          'Key961B73FD',
          'Arn',
        ],
      },
    });
  });

  test('cluster with instance parameter group', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const parameterGroup = new ParameterGroup(stack, 'ParameterGroup', {
      engine: DatabaseClusterEngine.AURORA,
      parameters: {
        key: 'value',
      },
    });

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      credentials: {
        username: 'admin',
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        parameterGroup,
        vpc,
      },
    });

    expect(stack).toHaveResource('AWS::RDS::DBInstance', {
      DBParameterGroupName: {
        Ref: 'ParameterGroup5E32DECB',
      },
    });
  });

  describe('performance insights', () => {
    test('cluster with all performance insights properties', () => {
      // GIVEN
      const stack = testStack();
      const vpc = new ec2.Vpc(stack, 'VPC');

      // WHEN
      new DatabaseCluster(stack, 'Database', {
        engine: DatabaseClusterEngine.AURORA,
        credentials: {
          username: 'admin',
        },
        instanceProps: {
          vpc,
          enablePerformanceInsights: true,
          performanceInsightRetention: PerformanceInsightRetention.LONG_TERM,
          performanceInsightEncryptionKey: new kms.Key(stack, 'Key'),
        },
      });

      expect(stack).toHaveResource('AWS::RDS::DBInstance', {
        EnablePerformanceInsights: true,
        PerformanceInsightsRetentionPeriod: 731,
        PerformanceInsightsKMSKeyId: { 'Fn::GetAtt': ['Key961B73FD', 'Arn'] },
      });
    });

    test('setting performance insights fields enables performance insights', () => {
      // GIVEN
      const stack = testStack();
      const vpc = new ec2.Vpc(stack, 'VPC');

      // WHEN
      new DatabaseCluster(stack, 'Database', {
        engine: DatabaseClusterEngine.AURORA,
        credentials: {
          username: 'admin',
        },
        instanceProps: {
          vpc,
          performanceInsightRetention: PerformanceInsightRetention.LONG_TERM,
        },
      });

      expect(stack).toHaveResource('AWS::RDS::DBInstance', {
        EnablePerformanceInsights: true,
        PerformanceInsightsRetentionPeriod: 731,
      });
    });

    test('throws if performance insights fields are set but performance insights is disabled', () => {
      // GIVEN
      const stack = testStack();
      const vpc = new ec2.Vpc(stack, 'VPC');

      expect(() => {
        new DatabaseCluster(stack, 'Database', {
          engine: DatabaseClusterEngine.AURORA,
          credentials: {
            username: 'admin',
          },
          instanceProps: {
            vpc,
            enablePerformanceInsights: false,
            performanceInsightRetention: PerformanceInsightRetention.DEFAULT,
          },
        });
      }).toThrow(/`enablePerformanceInsights` disabled, but `performanceInsightRetention` or `performanceInsightEncryptionKey` was set/);
    });
  });

  test('cluster with disable automatic upgrade of minor version', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      instanceProps: {
        autoMinorVersionUpgrade: false,
        vpc,
      },
    });

    expect(stack).toHaveResource('AWS::RDS::DBInstance', {
      AutoMinorVersionUpgrade: false,
    });
  });

  test('cluster with allow upgrade of major version', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      instanceProps: {
        allowMajorVersionUpgrade: true,
        vpc,
      },
    });

    expect(stack).toHaveResourceLike('AWS::RDS::DBInstance', {
      AllowMajorVersionUpgrade: true,
    });
  });

  test('cluster with disallow remove backups', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      instanceProps: {
        deleteAutomatedBackups: false,
        vpc,
      },
    });

    expect(stack).toHaveResourceLike('AWS::RDS::DBInstance', {
      DeleteAutomatedBackups: false,
    });
  });

  test('create a cluster using a specific version of MySQL', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.auroraMysql({
        version: AuroraMysqlEngineVersion.VER_2_04_4,
      }),
      credentials: {
        username: 'admin',
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
    });

    // THEN
    expect(stack).toHaveResource('AWS::RDS::DBCluster', {
      Engine: 'aurora-mysql',
      EngineVersion: '5.7.mysql_aurora.2.04.4',
    });
  });

  test('create a cluster using a specific version of Postgresql', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_10_7,
      }),
      credentials: {
        username: 'admin',
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
    });

    // THEN
    expect(stack).toHaveResource('AWS::RDS::DBCluster', {
      Engine: 'aurora-postgresql',
      EngineVersion: '10.7',
    });
  });

  test('cluster exposes different read and write endpoints', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    const cluster = new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      credentials: {
        username: 'admin',
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
    });

    // THEN
    expect(stack.resolve(cluster.clusterEndpoint)).not.toEqual(stack.resolve(cluster.clusterReadEndpoint));
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
      securityGroups: [ec2.SecurityGroup.fromSecurityGroupId(stack, 'SG', 'sg-123456789', {
        allowAllOutbound: false,
      })],
    });

    // WHEN
    cluster.connections.allowToAnyIpv4(ec2.Port.tcp(443));

    // THEN
    expect(stack).toHaveResource('AWS::EC2::SecurityGroupEgress', {
      GroupId: 'sg-123456789',
    });
  });

  test('can import a cluster with minimal attributes', () => {
    const stack = testStack();

    const cluster = DatabaseCluster.fromDatabaseClusterAttributes(stack, 'Database', {
      clusterIdentifier: 'identifier',
    });

    expect(cluster.clusterIdentifier).toEqual('identifier');
  });

  test('minimal imported cluster throws on accessing attributes for unprovided parameters', () => {
    const stack = testStack();

    const cluster = DatabaseCluster.fromDatabaseClusterAttributes(stack, 'Database', {
      clusterIdentifier: 'identifier',
    });

    expect(() => cluster.clusterEndpoint).toThrow(/Cannot access `clusterEndpoint` of an imported cluster/);
    expect(() => cluster.clusterReadEndpoint).toThrow(/Cannot access `clusterReadEndpoint` of an imported cluster/);
    expect(() => cluster.instanceIdentifiers).toThrow(/Cannot access `instanceIdentifiers` of an imported cluster/);
    expect(() => cluster.instanceEndpoints).toThrow(/Cannot access `instanceEndpoints` of an imported cluster/);
  });

  test('imported cluster can access properties if attributes are provided', () => {
    const stack = testStack();

    const cluster = DatabaseCluster.fromDatabaseClusterAttributes(stack, 'Database', {
      clusterEndpointAddress: 'addr',
      clusterIdentifier: 'identifier',
      instanceEndpointAddresses: ['instance-addr'],
      instanceIdentifiers: ['identifier'],
      port: 3306,
      readerEndpointAddress: 'reader-address',
      securityGroups: [ec2.SecurityGroup.fromSecurityGroupId(stack, 'SG', 'sg-123456789', {
        allowAllOutbound: false,
      })],
    });

    expect(cluster.clusterEndpoint.socketAddress).toEqual('addr:3306');
    expect(cluster.clusterReadEndpoint.socketAddress).toEqual('reader-address:3306');
    expect(cluster.instanceIdentifiers).toEqual(['identifier']);
    expect(cluster.instanceEndpoints.map(endpoint => endpoint.socketAddress)).toEqual(['instance-addr:3306']);
  });

  test('cluster supports metrics', () => {
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    const cluster = new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.auroraMysql({ version: AuroraMysqlEngineVersion.VER_5_7_12 }),
      credentials: {
        username: 'admin',
        password: cdk.SecretValue.plainText('tooshort'),
      },
      instanceProps: {
        vpc,
      },
    });

    expect(stack.resolve(cluster.metricCPUUtilization())).toEqual({
      dimensions: { DBClusterIdentifier: { Ref: 'DatabaseB269D8BB' } },
      namespace: 'AWS/RDS',
      metricName: 'CPUUtilization',
      period: cdk.Duration.minutes(5),
      statistic: 'Average',
      account: '12345',
      region: 'us-test-1',
    });
  });

  test('cluster with enabled monitoring', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      instances: 1,
      credentials: {
        username: 'admin',
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
      monitoringInterval: cdk.Duration.minutes(1),
    });

    // THEN
    expect(stack).toHaveResource('AWS::RDS::DBInstance', {
      MonitoringInterval: 60,
      MonitoringRoleArn: {
        'Fn::GetAtt': ['DatabaseMonitoringRole576991DA', 'Arn'],
      },
    }, ResourcePart.Properties);

    expect(stack).toHaveResource('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'monitoring.rds.amazonaws.com',
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
              ':iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole',
            ],
          ],
        },
      ],
    });
  });

  test('create a cluster with imported monitoring role', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    const monitoringRole = new Role(stack, 'MonitoringRole', {
      assumedBy: new ServicePrincipal('monitoring.rds.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonRDSEnhancedMonitoringRole'),
      ],
    });

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      instances: 1,
      credentials: {
        username: 'admin',
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
      monitoringInterval: cdk.Duration.minutes(1),
      monitoringRole,
    });

    // THEN
    expect(stack).toHaveResource('AWS::RDS::DBInstance', {
      MonitoringInterval: 60,
      MonitoringRoleArn: {
        'Fn::GetAtt': ['MonitoringRole90457BF9', 'Arn'],
      },
    }, ResourcePart.Properties);
  });

  test('throws when trying to add rotation to a cluster without secret', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    const cluster = new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA_MYSQL,
      credentials: {
        username: 'admin',
        password: cdk.SecretValue.plainText('tooshort'),
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
    });

    // THEN
    expect(() => cluster.addRotationSingleUser()).toThrow(/without secret/);
  });

  test('throws when trying to add single user rotation multiple times', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA_MYSQL,
      credentials: { username: 'admin' },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
    });

    // WHEN
    cluster.addRotationSingleUser();

    // THEN
    expect(() => cluster.addRotationSingleUser()).toThrow(/A single user rotation was already added to this cluster/);
  });

  test('create a cluster with s3 import role', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    const associatedRole = new Role(stack, 'AssociatedRole', {
      assumedBy: new ServicePrincipal('rds.amazonaws.com'),
    });

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      instances: 1,
      credentials: {
        username: 'admin',
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
      s3ImportRole: associatedRole,
    });

    // THEN
    expect(stack).toHaveResource('AWS::RDS::DBCluster', {
      AssociatedRoles: [{
        RoleArn: {
          'Fn::GetAtt': [
            'AssociatedRole824CFCD3',
            'Arn',
          ],
        },
      }],
    });

    expect(stack).toHaveResource('AWS::RDS::DBClusterParameterGroup', {
      Family: 'aurora5.6',
      Parameters: {
        aurora_load_from_s3_role: {
          'Fn::GetAtt': [
            'AssociatedRole824CFCD3',
            'Arn',
          ],
        },
      },
    });
  });

  test('create a cluster with s3 import buckets', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    const bucket = new s3.Bucket(stack, 'Bucket');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      instances: 1,
      credentials: {
        username: 'admin',
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
      s3ImportBuckets: [bucket],
    });

    // THEN
    expect(stack).toHaveResource('AWS::RDS::DBCluster', {
      AssociatedRoles: [{
        RoleArn: {
          'Fn::GetAtt': [
            'DatabaseS3ImportRole377BC9C0',
            'Arn',
          ],
        },
      }],
    });

    expect(stack).toHaveResource('AWS::RDS::DBClusterParameterGroup', {
      Family: 'aurora5.6',
      Parameters: {
        aurora_load_from_s3_role: {
          'Fn::GetAtt': [
            'DatabaseS3ImportRole377BC9C0',
            'Arn',
          ],
        },
      },
    });

    expect(stack).toHaveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: [
              's3:GetObject*',
              's3:GetBucket*',
              's3:List*',
            ],
            Effect: 'Allow',
            Resource: [
              {
                'Fn::GetAtt': [
                  'Bucket83908E77',
                  'Arn',
                ],
              },
              {
                'Fn::Join': [
                  '',
                  [
                    {
                      'Fn::GetAtt': [
                        'Bucket83908E77',
                        'Arn',
                      ],
                    },
                    '/*',
                  ],
                ],
              },
            ],
          },
        ],
        Version: '2012-10-17',
      },
    });
  });

  test('cluster with s3 import bucket adds supported feature name to IAM role', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    const bucket = new s3.Bucket(stack, 'Bucket');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_10_12,
      }),
      instances: 1,
      credentials: {
        username: 'admin',
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
      s3ImportBuckets: [bucket],
    });

    // THEN
    expect(stack).toHaveResource('AWS::RDS::DBCluster', {
      AssociatedRoles: [{
        RoleArn: {
          'Fn::GetAtt': [
            'DatabaseS3ImportRole377BC9C0',
            'Arn',
          ],
        },
        FeatureName: 's3Import',
      }],
    });
  });

  test('throws when s3 import bucket or s3 export bucket is supplied for a Postgres version that does not support it', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    const bucket = new s3.Bucket(stack, 'Bucket');

    // WHEN / THEN
    expect(() => {
      new DatabaseCluster(stack, 'Database', {
        engine: DatabaseClusterEngine.auroraPostgres({
          version: AuroraPostgresEngineVersion.VER_10_4,
        }),
        instances: 1,
        credentials: {
          username: 'admin',
        },
        instanceProps: {
          instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
          vpc,
        },
        s3ImportBuckets: [bucket],
      });
    }).toThrow(/s3Import is not supported for Postgres version: 10.4. Use a version that supports the s3Import feature./);

    expect(() => {
      new DatabaseCluster(stack, 'AnotherDatabase', {
        engine: DatabaseClusterEngine.auroraPostgres({
          version: AuroraPostgresEngineVersion.VER_10_4,
        }),
        instances: 1,
        credentials: {
          username: 'admin',
        },
        instanceProps: {
          instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
          vpc,
        },
        s3ExportBuckets: [bucket],
      });
    }).toThrow(/s3Export is not supported for Postgres version: 10.4. Use a version that supports the s3Export feature./);
  });

  test('cluster with s3 export bucket adds supported feature name to IAM role', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    const bucket = new s3.Bucket(stack, 'Bucket');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_10_12,
      }),
      instances: 1,
      credentials: {
        username: 'admin',
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
      s3ExportBuckets: [bucket],
    });

    // THEN
    expect(stack).toHaveResource('AWS::RDS::DBCluster', {
      AssociatedRoles: [{
        RoleArn: {
          'Fn::GetAtt': [
            'DatabaseS3ExportRole9E328562',
            'Arn',
          ],
        },
        FeatureName: 's3Export',
      }],
    });
  });

  test('create a cluster with s3 export role', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    const associatedRole = new Role(stack, 'AssociatedRole', {
      assumedBy: new ServicePrincipal('rds.amazonaws.com'),
    });

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      instances: 1,
      credentials: {
        username: 'admin',
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
      s3ExportRole: associatedRole,
    });

    // THEN
    expect(stack).toHaveResource('AWS::RDS::DBCluster', {
      AssociatedRoles: [{
        RoleArn: {
          'Fn::GetAtt': [
            'AssociatedRole824CFCD3',
            'Arn',
          ],
        },
      }],
    });

    expect(stack).toHaveResource('AWS::RDS::DBClusterParameterGroup', {
      Family: 'aurora5.6',
      Parameters: {
        aurora_select_into_s3_role: {
          'Fn::GetAtt': [
            'AssociatedRole824CFCD3',
            'Arn',
          ],
        },
      },
    });
  });

  testFutureBehavior('create a cluster with s3 export buckets', { [cxapi.S3_GRANT_WRITE_WITHOUT_ACL]: true }, cdk.App, (app) => {
    // GIVEN
    const stack = testStack(app);
    const vpc = new ec2.Vpc(stack, 'VPC');

    const bucket = new s3.Bucket(stack, 'Bucket');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      instances: 1,
      credentials: {
        username: 'admin',
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
      s3ExportBuckets: [bucket],
    });

    // THEN
    expect(stack).toHaveResource('AWS::RDS::DBCluster', {
      AssociatedRoles: [{
        RoleArn: {
          'Fn::GetAtt': [
            'DatabaseS3ExportRole9E328562',
            'Arn',
          ],
        },
      }],
    });

    expect(stack).toHaveResource('AWS::RDS::DBClusterParameterGroup', {
      Family: 'aurora5.6',
      Parameters: {
        aurora_select_into_s3_role: {
          'Fn::GetAtt': [
            'DatabaseS3ExportRole9E328562',
            'Arn',
          ],
        },
      },
    });

    expect(stack).toHaveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: [
              's3:GetObject*',
              's3:GetBucket*',
              's3:List*',
              's3:DeleteObject*',
              's3:PutObject',
              's3:Abort*',
            ],
            Effect: 'Allow',
            Resource: [
              {
                'Fn::GetAtt': [
                  'Bucket83908E77',
                  'Arn',
                ],
              },
              {
                'Fn::Join': [
                  '',
                  [
                    {
                      'Fn::GetAtt': [
                        'Bucket83908E77',
                        'Arn',
                      ],
                    },
                    '/*',
                  ],
                ],
              },
            ],
          },
        ],
        Version: '2012-10-17',
      },
    });
  });

  test('create a cluster with s3 import and export buckets', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    const importBucket = new s3.Bucket(stack, 'ImportBucket');
    const exportBucket = new s3.Bucket(stack, 'ExportBucket');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      instances: 1,
      credentials: {
        username: 'admin',
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
      s3ImportBuckets: [importBucket],
      s3ExportBuckets: [exportBucket],
    });

    // THEN
    expect(stack).toHaveResource('AWS::RDS::DBCluster', {
      AssociatedRoles: [{
        RoleArn: {
          'Fn::GetAtt': [
            'DatabaseS3ImportRole377BC9C0',
            'Arn',
          ],
        },
      },
      {
        RoleArn: {
          'Fn::GetAtt': [
            'DatabaseS3ExportRole9E328562',
            'Arn',
          ],
        },
      }],
    });

    expect(stack).toHaveResource('AWS::RDS::DBClusterParameterGroup', {
      Family: 'aurora5.6',
      Parameters: {
        aurora_load_from_s3_role: {
          'Fn::GetAtt': [
            'DatabaseS3ImportRole377BC9C0',
            'Arn',
          ],
        },
        aurora_select_into_s3_role: {
          'Fn::GetAtt': [
            'DatabaseS3ExportRole9E328562',
            'Arn',
          ],
        },
      },
    });
  });

  test('create a cluster with s3 import and export buckets and custom parameter group', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    const parameterGroup = new ParameterGroup(stack, 'ParameterGroup', {
      engine: DatabaseClusterEngine.AURORA,
      parameters: {
        key: 'value',
      },
    });

    const importBucket = new s3.Bucket(stack, 'ImportBucket');
    const exportBucket = new s3.Bucket(stack, 'ExportBucket');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      instances: 1,
      credentials: {
        username: 'admin',
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
      parameterGroup,
      s3ImportBuckets: [importBucket],
      s3ExportBuckets: [exportBucket],
    });

    // THEN
    expect(stack).toHaveResource('AWS::RDS::DBCluster', {
      AssociatedRoles: [{
        RoleArn: {
          'Fn::GetAtt': [
            'DatabaseS3ImportRole377BC9C0',
            'Arn',
          ],
        },
      },
      {
        RoleArn: {
          'Fn::GetAtt': [
            'DatabaseS3ExportRole9E328562',
            'Arn',
          ],
        },
      }],
    });

    expect(stack).toHaveResource('AWS::RDS::DBClusterParameterGroup', {
      Family: 'aurora5.6',
      Parameters: {
        key: 'value',
        aurora_load_from_s3_role: {
          'Fn::GetAtt': [
            'DatabaseS3ImportRole377BC9C0',
            'Arn',
          ],
        },
        aurora_select_into_s3_role: {
          'Fn::GetAtt': [
            'DatabaseS3ExportRole9E328562',
            'Arn',
          ],
        },
      },
    });
  });

  test('PostgreSQL cluster with s3 export buckets does not generate custom parameter group and specifies the correct port', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    const bucket = new s3.Bucket(stack, 'Bucket');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_11_6,
      }),
      instances: 1,
      credentials: {
        username: 'admin',
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
      s3ExportBuckets: [bucket],
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::RDS::DBCluster', {
      AssociatedRoles: [{
        RoleArn: {
          'Fn::GetAtt': [
            'DatabaseS3ExportRole9E328562',
            'Arn',
          ],
        },
      }],
      DBClusterParameterGroupName: 'default.aurora-postgresql11',
      Port: 5432,
    });

    expect(stack).not.toHaveResource('AWS::RDS::DBClusterParameterGroup');
  });

  test('unversioned PostgreSQL cluster can be used with s3 import and s3 export buckets', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    const bucket = new s3.Bucket(stack, 'Bucket');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA_POSTGRESQL,
      instances: 1,
      credentials: {
        username: 'admin',
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
      parameterGroup: ParameterGroup.fromParameterGroupName(stack, 'ParameterGroup', 'default.aurora-postgresql11'),
      s3ImportBuckets: [bucket],
      s3ExportBuckets: [bucket],
    });

    // THEN
    expect(stack).toHaveResource('AWS::RDS::DBCluster', {
      AssociatedRoles: [
        {
          FeatureName: 's3Import',
          RoleArn: {
            'Fn::GetAtt': [
              'DatabaseS3ImportRole377BC9C0',
              'Arn',
            ],
          },
        },
        {
          FeatureName: 's3Export',
          RoleArn: {
            'Fn::GetAtt': [
              'DatabaseS3ExportRole9E328562',
              'Arn',
            ],
          },
        },
      ],
    });
  });

  test("Aurora PostgreSQL cluster uses a different default master username than 'admin', which is a reserved word", () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_9_6_12,
      }),
      instanceProps: { vpc },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::SecretsManager::Secret', {
      GenerateSecretString: {
        SecretStringTemplate: '{"username":"postgres"}',
      },
    });
  });

  test('MySQL cluster without S3 exports or imports references the correct default ParameterGroup', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA_MYSQL,
      instances: 1,
      credentials: {
        username: 'admin',
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::RDS::DBCluster', {
      DBClusterParameterGroupName: 'default.aurora-mysql5.7',
    });

    expect(stack).not.toHaveResource('AWS::RDS::DBClusterParameterGroup');
  });

  test('throws when s3ExportRole and s3ExportBuckets properties are both specified', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    const exportRole = new Role(stack, 'ExportRole', {
      assumedBy: new ServicePrincipal('rds.amazonaws.com'),
    });
    const exportBucket = new s3.Bucket(stack, 'ExportBucket');

    // THEN
    expect(() => new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      instances: 1,
      credentials: {
        username: 'admin',
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
      s3ExportRole: exportRole,
      s3ExportBuckets: [exportBucket],
    })).toThrow();
  });

  test('throws when s3ImportRole and s3ImportBuckets properties are both specified', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    const importRole = new Role(stack, 'ImportRole', {
      assumedBy: new ServicePrincipal('rds.amazonaws.com'),
    });
    const importBucket = new s3.Bucket(stack, 'ImportBucket');

    // THEN
    expect(() => new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      instances: 1,
      credentials: {
        username: 'admin',
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
      s3ImportRole: importRole,
      s3ImportBuckets: [importBucket],
    })).toThrow();
  });

  test('can set CloudWatch log exports', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      credentials: {
        username: 'admin',
        password: cdk.SecretValue.plainText('tooshort'),
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
      cloudwatchLogsExports: ['error', 'general', 'slowquery', 'audit'],
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::RDS::DBCluster', {
      EnableCloudwatchLogsExports: ['error', 'general', 'slowquery', 'audit'],
    });
  });

  test('can set CloudWatch log retention', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      credentials: {
        username: 'admin',
        password: cdk.SecretValue.plainText('tooshort'),
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
      cloudwatchLogsExports: ['error', 'general'],
      cloudwatchLogsRetention: logs.RetentionDays.THREE_MONTHS,
    });

    // THEN
    expect(stack).toHaveResource('Custom::LogRetention', {
      ServiceToken: {
        'Fn::GetAtt': [
          'LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8aFD4BFC8A',
          'Arn',
        ],
      },
      LogGroupName: { 'Fn::Join': ['', ['/aws/rds/cluster/', { Ref: 'DatabaseB269D8BB' }, '/error']] },
      RetentionInDays: 90,
    });
    expect(stack).toHaveResource('Custom::LogRetention', {
      ServiceToken: {
        'Fn::GetAtt': [
          'LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8aFD4BFC8A',
          'Arn',
        ],
      },
      LogGroupName: { 'Fn::Join': ['', ['/aws/rds/cluster/', { Ref: 'DatabaseB269D8BB' }, '/general']] },
      RetentionInDays: 90,
    });
  });

  test('throws if given unsupported CloudWatch log exports', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    expect(() => {
      new DatabaseCluster(stack, 'Database', {
        engine: DatabaseClusterEngine.AURORA,
        credentials: {
          username: 'admin',
          password: cdk.SecretValue.plainText('tooshort'),
        },
        instanceProps: {
          instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
          vpc,
        },
        cloudwatchLogsExports: ['error', 'general', 'slowquery', 'audit', 'thislogdoesnotexist', 'neitherdoesthisone'],
      });
    }).toThrow(/Unsupported logs for the current engine type: thislogdoesnotexist,neitherdoesthisone/);
  });

  test('can set deletion protection', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      credentials: {
        username: 'admin',
        password: cdk.SecretValue.plainText('tooshort'),
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
      },
      deletionProtection: true,
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::RDS::DBCluster', {
      DeletionProtection: true,
    });
  });

  test('does not throw (but adds a node error) if a (dummy) VPC does not have sufficient subnets', () => {
    // GIVEN
    const stack = testStack();
    const vpc = ec2.Vpc.fromLookup(stack, 'VPC', { isDefault: true });

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      instances: 1,
      credentials: {
        username: 'admin',
      },
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpc,
        vpcSubnets: {
          subnetName: 'DefinitelyDoesNotExist',
        },
      },
    });

    // THEN
    const art = SynthUtils.synthesize(stack);
    const meta = art.findMetadataByType('aws:cdk:error');
    expect(meta[0].data).toEqual('Cluster requires at least 2 subnets, got 0');
  });

  test('create a cluster from a snapshot', () => {
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    const cluster = new DatabaseClusterFromSnapshot(stack, 'Database', {
      engine: DatabaseClusterEngine.aurora({ version: AuroraEngineVersion.VER_1_22_2 }),
      instanceProps: {
        vpc,
      },
      snapshotIdentifier: 'mySnapshot',
      iamAuthentication: true,
    });

    // THEN
    expect(stack).toHaveResource('AWS::RDS::DBCluster', {
      Properties: {
        Engine: 'aurora',
        EngineVersion: '5.6.mysql_aurora.1.22.2',
        DBSubnetGroupName: { Ref: 'DatabaseSubnets56F17B9A' },
        VpcSecurityGroupIds: [{ 'Fn::GetAtt': ['DatabaseSecurityGroup5C91FDCB', 'GroupId'] }],
        SnapshotIdentifier: 'mySnapshot',
        EnableIAMDatabaseAuthentication: true,
      },
      DeletionPolicy: 'Snapshot',
      UpdateReplacePolicy: 'Snapshot',
    }, ResourcePart.CompleteDefinition);

    expect(stack).toCountResources('AWS::RDS::DBInstance', 2);

    expect(cluster.instanceIdentifiers).toHaveLength(2);
    expect(stack.resolve(cluster.instanceIdentifiers[0])).toEqual({
      Ref: 'DatabaseInstance1844F58FD',
    });

    expect(cluster.instanceEndpoints).toHaveLength(2);
    expect(stack.resolve(cluster.instanceEndpoints[0])).toEqual({
      hostname: {
        'Fn::GetAtt': ['DatabaseInstance1844F58FD', 'Endpoint.Address'],
      },
      port: {
        'Fn::GetAtt': ['DatabaseB269D8BB', 'Endpoint.Port'],
      },
      socketAddress: {
        'Fn::Join': ['', [
          { 'Fn::GetAtt': ['DatabaseInstance1844F58FD', 'Endpoint.Address'] },
          ':',
          { 'Fn::GetAtt': ['DatabaseB269D8BB', 'Endpoint.Port'] },
        ]],
      },
    });
  });

  test('reuse an existing subnet group', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.aurora({ version: AuroraEngineVersion.VER_1_22_2 }),
      credentials: {
        username: 'admin',
      },
      instanceProps: {
        vpc,
      },
      subnetGroup: SubnetGroup.fromSubnetGroupName(stack, 'SubnetGroup', 'my-subnet-group'),
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::RDS::DBCluster', {
      DBSubnetGroupName: 'my-subnet-group',
    });
    expect(stack).toCountResources('AWS::RDS::DBSubnetGroup', 0);
  });

  test('defaultChild returns the DB Cluster', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    const cluster = new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.aurora({ version: AuroraEngineVersion.VER_1_22_2 }),
      credentials: {
        username: 'admin',
      },
      instanceProps: {
        vpc,
      },
    });

    // THEN
    expect(cluster.node.defaultChild instanceof CfnDBCluster).toBeTruthy();
  });

  test('fromGeneratedSecret', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.aurora({ version: AuroraEngineVersion.VER_1_22_2 }),
      credentials: Credentials.fromGeneratedSecret('admin'),
      instanceProps: {
        vpc,
      },
    });

    // THEN
    expect(stack).toHaveResource('AWS::RDS::DBCluster', {
      MasterUsername: 'admin', // username is a string
      MasterUserPassword: {
        'Fn::Join': [
          '',
          [
            '{{resolve:secretsmanager:',
            {
              Ref: 'DatabaseSecretC9203AE33fdaad7efa858a3daf9490cf0a702aeb', // logical id is a hash
            },
            ':SecretString:password::}}',
          ],
        ],
      },
    });
  });

  test('can set custom name to database secret by fromSecret', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const secretName = 'custom-secret-name';
    const secret = new DatabaseSecret(stack, 'Secret', {
      username: 'admin',
      secretName,
    } );

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.aurora({ version: AuroraEngineVersion.VER_1_22_2 }),
      credentials: Credentials.fromSecret(secret),
      instanceProps: {
        vpc,
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::SecretsManager::Secret', {
      Name: secretName,
    });
  });

  test('can set custom name to database secret by fromGeneratedSecret', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const secretName = 'custom-secret-name';

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.aurora({ version: AuroraEngineVersion.VER_1_22_2 }),
      credentials: Credentials.fromGeneratedSecret('admin', { secretName }),
      instanceProps: {
        vpc,
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::SecretsManager::Secret', {
      Name: secretName,
    });
  });

  test('can set public accessibility for database cluster with instances in private subnet', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      instanceProps: {
        vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE,
        },
        publiclyAccessible: true,
      },
    });
    // THEN
    expect(stack).toHaveResource('AWS::RDS::DBInstance', {
      Engine: 'aurora',
      PubliclyAccessible: true,
    });
  });

  test('can set public accessibility for database cluster with instances in public subnet', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      instanceProps: {
        vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PUBLIC,
        },
        publiclyAccessible: false,
      },
    });
    // THEN
    expect(stack).toHaveResource('AWS::RDS::DBInstance', {
      Engine: 'aurora',
      PubliclyAccessible: false,
    });
  });

  test('database cluster instances in public subnet should by default have publiclyAccessible set to true', () => {
    // GIVEN
    const stack = testStack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      instanceProps: {
        vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PUBLIC,
        },
      },
    });
    // THEN
    expect(stack).toHaveResource('AWS::RDS::DBInstance', {
      Engine: 'aurora',
      PubliclyAccessible: true,
    });
  });

  test('changes the case of the cluster identifier if the lowercaseDbIdentifier feature flag is enabled', () => {
    // GIVEN
    const app = new cdk.App({
      context: { [cxapi.RDS_LOWERCASE_DB_IDENTIFIER]: true },
    });
    const stack = testStack(app);
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    const clusterIdentifier = 'TestClusterIdentifier';
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      instanceProps: { vpc },
      clusterIdentifier,
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::RDS::DBCluster', {
      DBClusterIdentifier: clusterIdentifier.toLowerCase(),
    });
  });

  test('does not changes the case of the cluster identifier if the lowercaseDbIdentifier feature flag is disabled', () => {
    // GIVEN
    const app = new cdk.App({ context: { '@aws-cdk/aws-rds:lowercaseDbIdentifier': false } });
    const stack = testStack(app);
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    const clusterIdentifier = 'TestClusterIdentifier';
    new DatabaseCluster(stack, 'Database', {
      engine: DatabaseClusterEngine.AURORA,
      instanceProps: { vpc },
      clusterIdentifier,
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::RDS::DBCluster', {
      DBClusterIdentifier: clusterIdentifier,
    });
  });
});

test.each([
  [cdk.RemovalPolicy.RETAIN, 'Retain', 'Retain', 'Retain'],
  [cdk.RemovalPolicy.SNAPSHOT, 'Snapshot', 'Delete', ABSENT],
  [cdk.RemovalPolicy.DESTROY, 'Delete', 'Delete', ABSENT],
])('if Cluster RemovalPolicy is \'%s\', the DBCluster has DeletionPolicy \'%s\', the DBInstance has \'%s\' and the DBSubnetGroup has \'%s\'', (clusterRemovalPolicy, clusterValue, instanceValue, subnetValue) => {
  const stack = new cdk.Stack();

  // WHEN
  new DatabaseCluster(stack, 'Cluster', {
    credentials: { username: 'admin' },
    engine: DatabaseClusterEngine.AURORA,
    instanceProps: {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.LARGE),
      vpc: new ec2.Vpc(stack, 'Vpc'),
    },
    removalPolicy: clusterRemovalPolicy,
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::RDS::DBCluster', {
    DeletionPolicy: clusterValue,
    UpdateReplacePolicy: clusterValue,
  }, ResourcePart.CompleteDefinition);

  expect(stack).toHaveResourceLike('AWS::RDS::DBInstance', {
    DeletionPolicy: instanceValue,
    UpdateReplacePolicy: instanceValue,
  }, ResourcePart.CompleteDefinition);

  expect(stack).toHaveResourceLike('AWS::RDS::DBSubnetGroup', {
    DeletionPolicy: subnetValue,
  }, ResourcePart.CompleteDefinition);
});

test.each([
  [cdk.RemovalPolicy.RETAIN, 'Retain', 'Retain', 'Retain'],
  [cdk.RemovalPolicy.SNAPSHOT, 'Snapshot', 'Delete', ABSENT],
  [cdk.RemovalPolicy.DESTROY, 'Delete', 'Delete', ABSENT],
])('if Cluster RemovalPolicy is \'%s\', the DBCluster has DeletionPolicy \'%s\', the DBInstance has \'%s\' and the DBSubnetGroup has \'%s\'', (clusterRemovalPolicy, clusterValue, instanceValue, subnetValue) => {
  const stack = new cdk.Stack();

  // WHEN
  new DatabaseCluster(stack, 'Cluster', {
    credentials: { username: 'admin' },
    engine: DatabaseClusterEngine.AURORA,
    instanceProps: {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.LARGE),
      vpc: new ec2.Vpc(stack, 'Vpc'),
    },
    removalPolicy: clusterRemovalPolicy,
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::RDS::DBCluster', {
    DeletionPolicy: clusterValue,
    UpdateReplacePolicy: clusterValue,
  }, ResourcePart.CompleteDefinition);

  expect(stack).toHaveResourceLike('AWS::RDS::DBInstance', {
    DeletionPolicy: instanceValue,
    UpdateReplacePolicy: instanceValue,
  }, ResourcePart.CompleteDefinition);

  expect(stack).toHaveResourceLike('AWS::RDS::DBSubnetGroup', {
    DeletionPolicy: subnetValue,
    UpdateReplacePolicy: subnetValue,
  }, ResourcePart.CompleteDefinition);
});


function testStack(app?: cdk.App) {
  const stack = new cdk.Stack(app, undefined, { env: { account: '12345', region: 'us-test-1' } });
  stack.node.setContext('availability-zones:12345:us-test-1', ['us-test-1a', 'us-test-1b']);
  return stack;
}
