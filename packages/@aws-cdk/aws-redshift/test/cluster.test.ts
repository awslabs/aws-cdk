import { ABSENT, expect as cdkExpect, haveResource, ResourcePart } from '@aws-cdk/assert-internal';
import '@aws-cdk/assert-internal/jest';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as kms from '@aws-cdk/aws-kms';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import { CfnCluster, Cluster, ClusterParameterGroup, ClusterSubnetGroup, ClusterType } from '../lib';

let stack: cdk.Stack;
let vpc: ec2.IVpc;

beforeEach(() => {
  stack = testStack();
  vpc = new ec2.Vpc(stack, 'VPC');
});

test('check that instantiation works', () => {
  // WHEN
  new Cluster(stack, 'Redshift', {
    masterUser: {
      masterUsername: 'admin',
      masterPassword: cdk.SecretValue.plainText('tooshort'),
    },
    vpc,
  });

  // THEN
  cdkExpect(stack).to(haveResource('AWS::Redshift::Cluster', {
    Properties: {
      AllowVersionUpgrade: true,
      MasterUsername: 'admin',
      MasterUserPassword: 'tooshort',
      ClusterType: 'multi-node',
      AutomatedSnapshotRetentionPeriod: 1,
      Encrypted: true,
      NumberOfNodes: 2,
      NodeType: 'dc2.large',
      DBName: 'default_db',
      PubliclyAccessible: false,
      ClusterSubnetGroupName: { Ref: 'RedshiftSubnetsDFE70E0A' },
      VpcSecurityGroupIds: [{ 'Fn::GetAtt': ['RedshiftSecurityGroup796D74A7', 'GroupId'] }],
    },
    DeletionPolicy: 'Retain',
    UpdateReplacePolicy: 'Retain',
  }, ResourcePart.CompleteDefinition));

  cdkExpect(stack).to(haveResource('AWS::Redshift::ClusterSubnetGroup', {
    Properties: {
      Description: 'Subnets for Redshift Redshift cluster',
      SubnetIds: [
        { Ref: 'VPCPrivateSubnet1Subnet8BCA10E0' },
        { Ref: 'VPCPrivateSubnet2SubnetCFCDAA7A' },
        { Ref: 'VPCPrivateSubnet3Subnet3EDCD457' },
      ],
    },
    DeletionPolicy: 'Retain',
    UpdateReplacePolicy: 'Retain',
  }, ResourcePart.CompleteDefinition));
});

test('can create a cluster with imported vpc and security group', () => {
  // GIVEN
  vpc = ec2.Vpc.fromLookup(stack, 'ImportedVPC', {
    vpcId: 'VPC12345',
  });
  const sg = ec2.SecurityGroup.fromSecurityGroupId(stack, 'SG', 'SecurityGroupId12345');

  // WHEN
  new Cluster(stack, 'Redshift', {
    masterUser: {
      masterUsername: 'admin',
      masterPassword: cdk.SecretValue.plainText('tooshort'),
    },
    vpc,
    securityGroups: [sg],
  });

  // THEN
  cdkExpect(stack).to(haveResource('AWS::Redshift::Cluster', {
    ClusterSubnetGroupName: { Ref: 'RedshiftSubnetsDFE70E0A' },
    MasterUsername: 'admin',
    MasterUserPassword: 'tooshort',
    VpcSecurityGroupIds: ['SecurityGroupId12345'],
  }));
});

test('creates a secret when master credentials are not specified', () => {
  // WHEN
  new Cluster(stack, 'Redshift', {
    masterUser: {
      masterUsername: 'admin',
    },
    vpc,
  });

  // THEN
  cdkExpect(stack).to(haveResource('AWS::Redshift::Cluster', {
    MasterUsername: {
      'Fn::Join': [
        '',
        [
          '{{resolve:secretsmanager:',
          {
            Ref: 'RedshiftSecretA08D42D6',
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
            Ref: 'RedshiftSecretA08D42D6',
          },
          ':SecretString:password::}}',
        ],
      ],
    },
  }));

  cdkExpect(stack).to(haveResource('AWS::SecretsManager::Secret', {
    GenerateSecretString: {
      ExcludeCharacters: '"@/\\\ \'',
      GenerateStringKey: 'password',
      PasswordLength: 30,
      SecretStringTemplate: '{"username":"admin"}',
    },
  }));
});

describe('node count', () => {
  test('Single Node Clusters do not define node count', () => {
    // WHEN
    new Cluster(stack, 'Redshift', {
      masterUser: {
        masterUsername: 'admin',
      },
      vpc,
      clusterType: ClusterType.SINGLE_NODE,
    });

    // THEN
    cdkExpect(stack).to(haveResource('AWS::Redshift::Cluster', {
      ClusterType: 'single-node',
      NumberOfNodes: ABSENT,
    }));
  });

  test('Single Node Clusters treat 1 node as undefined', () => {
    // WHEN
    new Cluster(stack, 'Redshift', {
      masterUser: {
        masterUsername: 'admin',
      },
      vpc,
      clusterType: ClusterType.SINGLE_NODE,
      numberOfNodes: 1,
    });

    // THEN
    cdkExpect(stack).to(haveResource('AWS::Redshift::Cluster', {
      ClusterType: 'single-node',
      NumberOfNodes: ABSENT,
    }));
  });

  test('Single Node Clusters throw if any other node count is specified', () => {
    expect(() => {
      new Cluster(stack, 'Redshift', {
        masterUser: {
          masterUsername: 'admin',
        },
        vpc,
        clusterType: ClusterType.SINGLE_NODE,
        numberOfNodes: 2,
      });
    }).toThrow(/Number of nodes must be not be supplied or be 1 for cluster type single-node/);
  });

  test('Multi-Node Clusters default to 2 nodes', () => {
    // WHEN
    new Cluster(stack, 'Redshift', {
      masterUser: {
        masterUsername: 'admin',
      },
      vpc,
      clusterType: ClusterType.MULTI_NODE,
    });

    // THEN
    cdkExpect(stack).to(haveResource('AWS::Redshift::Cluster', {
      ClusterType: 'multi-node',
      NumberOfNodes: 2,
    }));
  });

  test.each([0, 1, -1, 101])('Multi-Node Clusters throw with %s nodes', (numberOfNodes: number) => {
    expect(() => {
      new Cluster(stack, 'Redshift', {
        masterUser: {
          masterUsername: 'admin',
        },
        vpc,
        clusterType: ClusterType.MULTI_NODE,
        numberOfNodes,
      });
    }).toThrow(/Number of nodes for cluster type multi-node must be at least 2 and no more than 100/);
  });

  test('Multi-Node Clusters should allow input parameter for number of nodes', () => {
    // WHEN
    const numberOfNodesParam = new cdk.CfnParameter(stack, 'numberOfNodes', {
      type: 'Number',
    });

    new Cluster(stack, 'Redshift', {
      masterUser: {
        masterUsername: 'admin',
      },
      vpc,
      clusterType: ClusterType.MULTI_NODE,
      numberOfNodes: numberOfNodesParam.valueAsNumber,
    });

    // THEN
    cdkExpect(stack).to(haveResource('AWS::Redshift::Cluster', {
      ClusterType: 'multi-node',
      NumberOfNodes: {
        Ref: 'numberOfNodes',
      },
    }));
  });
});

test('create an encrypted cluster with custom KMS key', () => {
  // WHEN
  new Cluster(stack, 'Redshift', {
    masterUser: {
      masterUsername: 'admin',
    },
    encryptionKey: new kms.Key(stack, 'Key'),
    vpc,
  });

  // THEN
  cdkExpect(stack).to(haveResource('AWS::Redshift::Cluster', {
    KmsKeyId: {
      'Fn::GetAtt': [
        'Key961B73FD',
        'Arn',
      ],
    },
  }));
});

test('cluster with parameter group', () => {
  // WHEN
  const group = new ClusterParameterGroup(stack, 'Params', {
    description: 'bye',
    parameters: {
      param: 'value',
    },
  });

  new Cluster(stack, 'Redshift', {
    masterUser: {
      masterUsername: 'admin',
    },
    vpc,
    parameterGroup: group,
  });

  // THEN
  cdkExpect(stack).to(haveResource('AWS::Redshift::Cluster', {
    ClusterParameterGroupName: { Ref: 'ParamsA8366201' },
  }));
});

test('publicly accessible cluster', () => {
  // WHEN
  new Cluster(stack, 'Redshift', {
    masterUser: {
      masterUsername: 'admin',
    },
    vpc,
    publiclyAccessible: true,
  });

  // THEN
  cdkExpect(stack).to(haveResource('AWS::Redshift::Cluster', {
    PubliclyAccessible: true,
  }));
});

test('imported cluster with imported security group honors allowAllOutbound', () => {
  // GIVEN
  const cluster = Cluster.fromClusterAttributes(stack, 'Database', {
    clusterEndpointAddress: 'addr',
    clusterName: 'identifier',
    clusterEndpointPort: 3306,
    securityGroups: [
      ec2.SecurityGroup.fromSecurityGroupId(stack, 'SG', 'sg-123456789', {
        allowAllOutbound: false,
      }),
    ],
  });

  // WHEN
  cluster.connections.allowToAnyIpv4(ec2.Port.tcp(443));

  // THEN
  cdkExpect(stack).to(haveResource('AWS::EC2::SecurityGroupEgress', {
    GroupId: 'sg-123456789',
  }));
});

test('can create a cluster with logging enabled', () => {
  // GIVEN
  const bucket = s3.Bucket.fromBucketName(stack, 'bucket', 'logging-bucket');

  // WHEN
  new Cluster(stack, 'Redshift', {
    masterUser: {
      masterUsername: 'admin',
    },
    vpc,
    loggingBucket: bucket,
    loggingKeyPrefix: 'prefix',
  });

  // THEN
  cdkExpect(stack).to(haveResource('AWS::Redshift::Cluster', {
    LoggingProperties: {
      BucketName: 'logging-bucket',
      S3KeyPrefix: 'prefix',
    },
  }));
});

test('throws when trying to add rotation to a cluster without secret', () => {
  // WHEN
  const cluster = new Cluster(stack, 'Redshift', {
    masterUser: {
      masterUsername: 'admin',
      masterPassword: cdk.SecretValue.plainText('tooshort'),
    },
    vpc,
  });

  // THEN
  expect(() => {
    cluster.addRotationSingleUser();
  }).toThrowError();
});

test('throws validation error when trying to set encryptionKey without enabling encryption', () => {
  // GIVEN
  const key = new kms.Key(stack, 'kms-key');

  // WHEN
  const props = {
    encrypted: false,
    encryptionKey: key,
    masterUser: {
      masterUsername: 'admin',
    },
    vpc,
  };

  // THEN
  expect(() => {
    new Cluster(stack, 'Redshift', props );
  }).toThrowError();
});

test('throws when trying to add single user rotation multiple times', () => {
  // GIVEN
  const cluster = new Cluster(stack, 'Redshift', {
    masterUser: {
      masterUsername: 'admin',
    },
    vpc,
  });

  // WHEN
  cluster.addRotationSingleUser();

  // THEN
  expect(() => {
    cluster.addRotationSingleUser();
  }).toThrowError();
});

test('can use existing cluster subnet group', () => {
  // GIVEN
  new Cluster(stack, 'Redshift', {
    masterUser: {
      masterUsername: 'admin',
    },
    vpc,
    subnetGroup: ClusterSubnetGroup.fromClusterSubnetGroupName(stack, 'Group', 'my-existing-cluster-subnet-group'),
  });

  expect(stack).not.toHaveResource('AWS::Redshift::ClusterSubnetGroup');
  expect(stack).toHaveResourceLike('AWS::Redshift::Cluster', {
    ClusterSubnetGroupName: 'my-existing-cluster-subnet-group',
  });
});

test('default child returns a CfnCluster', () => {
  const cluster = new Cluster(stack, 'Redshift', {
    masterUser: {
      masterUsername: 'admin',
    },
    vpc,
  });

  expect(cluster.node.defaultChild).toBeInstanceOf(CfnCluster);
});

function testStack() {
  const newTestStack = new cdk.Stack(undefined, undefined, { env: { account: '12345', region: 'us-test-1' } });
  newTestStack.node.setContext('availability-zones:12345:us-test-1', ['us-test-1a', 'us-test-1b']);
  return newTestStack;
}
