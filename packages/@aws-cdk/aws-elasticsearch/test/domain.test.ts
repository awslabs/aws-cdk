/* eslint-disable jest/expect-expect */
import '@aws-cdk/assert/jest';
import * as assert from '@aws-cdk/assert';
import * as acm from '@aws-cdk/aws-certificatemanager';
import { Metric, Statistic } from '@aws-cdk/aws-cloudwatch';
import { Vpc, EbsDeviceVolumeType, SecurityGroup } from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import * as logs from '@aws-cdk/aws-logs';
import * as route53 from '@aws-cdk/aws-route53';
import { App, Stack, Duration, SecretValue } from '@aws-cdk/core';
import { Domain, ElasticsearchVersion } from '../lib';

let app: App;
let stack: Stack;

beforeEach(() => {
  app = new App();
  stack = new Stack(app, 'Stack', {
    env: { account: '1234', region: 'testregion' },
  });

  jest.resetAllMocks();
});

const readActions = ['ESHttpGet', 'ESHttpHead'];
const writeActions = ['ESHttpDelete', 'ESHttpPost', 'ESHttpPut', 'ESHttpPatch'];
const readWriteActions = [
  ...readActions,
  ...writeActions,
];

test('connections throws if domain is placed inside a vpc', () => {

  expect(() => {
    new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_1,
    }).connections;
  }).toThrowError("Connections are only available on VPC enabled domains. Use the 'vpc' property to place a domain inside a VPC");
});

test('subnets and security groups can be provided when vpc is used', () => {

  const vpc = new Vpc(stack, 'Vpc');
  const securityGroup = new SecurityGroup(stack, 'CustomSecurityGroup', {
    vpc,
  });
  const domain = new Domain(stack, 'Domain', {
    version: ElasticsearchVersion.V7_9,
    vpc,
    vpcSubnets: [{ subnets: [vpc.privateSubnets[0]] }],
    securityGroups: [securityGroup],
  });

  expect(domain.connections.securityGroups[0].securityGroupId).toEqual(securityGroup.securityGroupId);
  expect(stack).toHaveResource('AWS::Elasticsearch::Domain', {
    VPCOptions: {
      SecurityGroupIds: [
        {
          'Fn::GetAtt': [
            'CustomSecurityGroupE5E500E5',
            'GroupId',
          ],
        },
      ],
      SubnetIds: [
        {
          Ref: 'VpcPrivateSubnet1Subnet536B997A',
        },
      ],
    },
  });

});

test('default subnets and security group when vpc is used', () => {

  const vpc = new Vpc(stack, 'Vpc');
  const domain = new Domain(stack, 'Domain', {
    version: ElasticsearchVersion.V7_9,
    vpc,
  });

  expect(stack.resolve(domain.connections.securityGroups[0].securityGroupId)).toEqual({ 'Fn::GetAtt': ['DomainSecurityGroup48AA5FD6', 'GroupId'] });
  expect(stack).toHaveResource('AWS::Elasticsearch::Domain', {
    VPCOptions: {
      SecurityGroupIds: [
        {
          'Fn::GetAtt': [
            'DomainSecurityGroup48AA5FD6',
            'GroupId',
          ],
        },
      ],
      SubnetIds: [
        {
          Ref: 'VpcPrivateSubnet1Subnet536B997A',
        },
        {
          Ref: 'VpcPrivateSubnet2Subnet3788AAA1',
        },
        {
          Ref: 'VpcPrivateSubnet3SubnetF258B56E',
        },
      ],
    },
  });

});

test('default removalpolicy is retain', () => {
  new Domain(stack, 'Domain', {
    version: ElasticsearchVersion.V7_1,
  });

  expect(stack).toHaveResource('AWS::Elasticsearch::Domain', {
    DeletionPolicy: 'Retain',
  }, assert.ResourcePart.CompleteDefinition);
});

test('grants kms permissions if needed', () => {

  const key = new kms.Key(stack, 'Key');

  new Domain(stack, 'Domain', {
    version: ElasticsearchVersion.V7_1,
    encryptionAtRest: {
      kmsKey: key,
    },
    // so that the access policy custom resource will be used.
    useUnsignedBasicAuth: true,
  });

  const expectedPolicy = {
    Statement: [
      {
        Action: [
          'kms:List*',
          'kms:Describe*',
          'kms:CreateGrant',
        ],
        Effect: 'Allow',
        Resource: {
          'Fn::GetAtt': [
            'Key961B73FD',
            'Arn',
          ],
        },
      },
    ],
    Version: '2012-10-17',
  };

  const resources = assert.expect(stack).value.Resources;
  expect(resources.AWS679f53fac002430cb0da5b7982bd2287ServiceRoleDefaultPolicyD28E1A5E.Properties.PolicyDocument).toStrictEqual(expectedPolicy);

});

test('minimal example renders correctly', () => {
  new Domain(stack, 'Domain', { version: ElasticsearchVersion.V7_1 });

  expect(stack).toHaveResource('AWS::Elasticsearch::Domain', {
    CognitoOptions: {
      Enabled: false,
    },
    EBSOptions: {
      EBSEnabled: true,
      VolumeSize: 10,
      VolumeType: 'gp2',
    },
    ElasticsearchClusterConfig: {
      DedicatedMasterEnabled: false,
      InstanceCount: 1,
      InstanceType: 'r5.large.elasticsearch',
      ZoneAwarenessEnabled: false,
    },
    ElasticsearchVersion: '7.1',
    EncryptionAtRestOptions: {
      Enabled: false,
    },
    LogPublishingOptions: {
      AUDIT_LOGS: assert.ABSENT,
      ES_APPLICATION_LOGS: assert.ABSENT,
      SEARCH_SLOW_LOGS: assert.ABSENT,
      INDEX_SLOW_LOGS: assert.ABSENT,
    },
    NodeToNodeEncryptionOptions: {
      Enabled: false,
    },
  });
});

test('can enable version upgrade update policy', () => {
  new Domain(stack, 'Domain', {
    version: ElasticsearchVersion.V7_1,
    enableVersionUpgrade: true,
  });

  expect(stack).toHaveResource('AWS::Elasticsearch::Domain', {
    UpdatePolicy: {
      EnableVersionUpgrade: true,
    },
  }, assert.ResourcePart.CompleteDefinition);
});

describe('UltraWarm instances', () => {

  test('can enable UltraWarm instances', () => {
    new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_1,
      capacity: {
        masterNodes: 2,
        warmNodes: 2,
      },
    });

    expect(stack).toHaveResourceLike('AWS::Elasticsearch::Domain', {
      ElasticsearchClusterConfig: {
        DedicatedMasterEnabled: true,
        WarmEnabled: true,
        WarmCount: 2,
        WarmType: 'ultrawarm1.medium.elasticsearch',
      },
    });
  });

  test('can enable UltraWarm instances with specific instance type', () => {
    new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_1,
      capacity: {
        masterNodes: 2,
        warmNodes: 2,
        warmInstanceType: 'ultrawarm1.large.elasticsearch',
      },
    });

    expect(stack).toHaveResourceLike('AWS::Elasticsearch::Domain', {
      ElasticsearchClusterConfig: {
        DedicatedMasterEnabled: true,
        WarmEnabled: true,
        WarmCount: 2,
        WarmType: 'ultrawarm1.large.elasticsearch',
      },
    });
  });

});

describe('log groups', () => {

  test('slowSearchLogEnabled should create a custom log group', () => {
    new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_4,
      logging: {
        slowSearchLogEnabled: true,
      },
    });

    expect(stack).toHaveResourceLike('AWS::Elasticsearch::Domain', {
      LogPublishingOptions: {
        SEARCH_SLOW_LOGS: {
          CloudWatchLogsLogGroupArn: {
            'Fn::GetAtt': [
              'DomainSlowSearchLogs5B35A97A',
              'Arn',
            ],
          },
          Enabled: true,
        },
        AUDIT_LOGS: assert.ABSENT,
        ES_APPLICATION_LOGS: assert.ABSENT,
        INDEX_SLOW_LOGS: assert.ABSENT,
      },
    });
  });

  test('slowIndexLogEnabled should create a custom log group', () => {
    new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_4,
      logging: {
        slowIndexLogEnabled: true,
      },
    });

    expect(stack).toHaveResourceLike('AWS::Elasticsearch::Domain', {
      LogPublishingOptions: {
        INDEX_SLOW_LOGS: {
          CloudWatchLogsLogGroupArn: {
            'Fn::GetAtt': [
              'DomainSlowIndexLogsFE2F1061',
              'Arn',
            ],
          },
          Enabled: true,
        },
        AUDIT_LOGS: assert.ABSENT,
        ES_APPLICATION_LOGS: assert.ABSENT,
        SEARCH_SLOW_LOGS: assert.ABSENT,
      },
    });
  });

  test('appLogEnabled should create a custom log group', () => {
    new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_4,
      logging: {
        appLogEnabled: true,
      },
    });

    expect(stack).toHaveResourceLike('AWS::Elasticsearch::Domain', {
      LogPublishingOptions: {
        ES_APPLICATION_LOGS: {
          CloudWatchLogsLogGroupArn: {
            'Fn::GetAtt': [
              'DomainAppLogs21698C1B',
              'Arn',
            ],
          },
          Enabled: true,
        },
        AUDIT_LOGS: assert.ABSENT,
        SEARCH_SLOW_LOGS: assert.ABSENT,
        INDEX_SLOW_LOGS: assert.ABSENT,
      },
    });
  });

  test('auditLogEnabled should create a custom log group', () => {
    new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_4,
      logging: {
        auditLogEnabled: true,
      },
      fineGrainedAccessControl: {
        masterUserName: 'username',
      },
      nodeToNodeEncryption: true,
      encryptionAtRest: {
        enabled: true,
      },
      enforceHttps: true,
    });

    expect(stack).toHaveResourceLike('AWS::Elasticsearch::Domain', {
      LogPublishingOptions: {
        AUDIT_LOGS: {
          CloudWatchLogsLogGroupArn: {
            'Fn::GetAtt': [
              'DomainAuditLogs608E0FA6',
              'Arn',
            ],
          },
          Enabled: true,
        },
        ES_APPLICATION_LOGS: assert.ABSENT,
        SEARCH_SLOW_LOGS: assert.ABSENT,
        INDEX_SLOW_LOGS: assert.ABSENT,
      },
    });
  });

  test('two domains with logging enabled can be created in same stack', () => {
    new Domain(stack, 'Domain1', {
      version: ElasticsearchVersion.V7_7,
      logging: {
        appLogEnabled: true,
        slowSearchLogEnabled: true,
        slowIndexLogEnabled: true,
      },
    });
    new Domain(stack, 'Domain2', {
      version: ElasticsearchVersion.V7_7,
      logging: {
        appLogEnabled: true,
        slowSearchLogEnabled: true,
        slowIndexLogEnabled: true,
      },
    });
    expect(stack).toHaveResourceLike('AWS::Elasticsearch::Domain', {
      LogPublishingOptions: {
        ES_APPLICATION_LOGS: {
          CloudWatchLogsLogGroupArn: {
            'Fn::GetAtt': [
              'Domain1AppLogs6E8D1D67',
              'Arn',
            ],
          },
          Enabled: true,
        },
        SEARCH_SLOW_LOGS: {
          CloudWatchLogsLogGroupArn: {
            'Fn::GetAtt': [
              'Domain1SlowSearchLogs8F3B0506',
              'Arn',
            ],
          },
          Enabled: true,
        },
        INDEX_SLOW_LOGS: {
          CloudWatchLogsLogGroupArn: {
            'Fn::GetAtt': [
              'Domain1SlowIndexLogs9354D098',
              'Arn',
            ],
          },
          Enabled: true,
        },
        AUDIT_LOGS: assert.ABSENT,
      },
    });
    expect(stack).toHaveResourceLike('AWS::Elasticsearch::Domain', {
      LogPublishingOptions: {
        ES_APPLICATION_LOGS: {
          CloudWatchLogsLogGroupArn: {
            'Fn::GetAtt': [
              'Domain2AppLogs810876E2',
              'Arn',
            ],
          },
          Enabled: true,
        },
        SEARCH_SLOW_LOGS: {
          CloudWatchLogsLogGroupArn: {
            'Fn::GetAtt': [
              'Domain2SlowSearchLogs0C75F64B',
              'Arn',
            ],
          },
          Enabled: true,
        },
        INDEX_SLOW_LOGS: {
          CloudWatchLogsLogGroupArn: {
            'Fn::GetAtt': [
              'Domain2SlowIndexLogs0CB900D0',
              'Arn',
            ],
          },
          Enabled: true,
        },
        AUDIT_LOGS: assert.ABSENT,
      },
    });
  });

  test('log group policy is uniquely named for each domain', () => {
    new Domain(stack, 'Domain1', {
      version: ElasticsearchVersion.V7_4,
      logging: {
        appLogEnabled: true,
      },
    });
    new Domain(stack, 'Domain2', {
      version: ElasticsearchVersion.V7_4,
      logging: {
        appLogEnabled: true,
      },
    });

    // Domain1
    expect(stack).toHaveResourceLike('Custom::CloudwatchLogResourcePolicy', {
      Create: {
        'Fn::Join': [
          '',
          [
            '{"service":"CloudWatchLogs","action":"putResourcePolicy","parameters":{"policyName":"ESLogPolicyc836fd92f07ec41eb70c2f6f08dc4b43cfb7c25391","policyDocument":"{\\"Statement\\":[{\\"Action\\":[\\"logs:PutLogEvents\\",\\"logs:CreateLogStream\\"],\\"Effect\\":\\"Allow\\",\\"Principal\\":{\\"Service\\":\\"es.amazonaws.com\\"},\\"Resource\\":\\"',
            {
              'Fn::GetAtt': [
                'Domain1AppLogs6E8D1D67',
                'Arn',
              ],
            },
            '\\"}],\\"Version\\":\\"2012-10-17\\"}"},"physicalResourceId":{"id":"ESLogGroupPolicyc836fd92f07ec41eb70c2f6f08dc4b43cfb7c25391"}}',
          ],
        ],
      },
    });
    // Domain2
    expect(stack).toHaveResourceLike('Custom::CloudwatchLogResourcePolicy', {
      Create: {
        'Fn::Join': [
          '',
          [
            '{"service":"CloudWatchLogs","action":"putResourcePolicy","parameters":{"policyName":"ESLogPolicyc8f05f015be3baf6ec1ee06cd1ee5cc8706ebbe5b2","policyDocument":"{\\"Statement\\":[{\\"Action\\":[\\"logs:PutLogEvents\\",\\"logs:CreateLogStream\\"],\\"Effect\\":\\"Allow\\",\\"Principal\\":{\\"Service\\":\\"es.amazonaws.com\\"},\\"Resource\\":\\"',
            {
              'Fn::GetAtt': [
                'Domain2AppLogs810876E2',
                'Arn',
              ],
            },
            '\\"}],\\"Version\\":\\"2012-10-17\\"}"},"physicalResourceId":{"id":"ESLogGroupPolicyc8f05f015be3baf6ec1ee06cd1ee5cc8706ebbe5b2"}}',
          ],
        ],
      },
    });
  });

  test('enabling audit logs throws without fine grained access control enabled', () => {
    expect(() => new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V6_7,
      logging: {
        auditLogEnabled: true,
      },
    })).toThrow(/Fine-grained access control is required when audit logs publishing is enabled\./);
  });

  test('slowSearchLogGroup should use a custom log group', () => {
    new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_4,
      logging: {
        slowSearchLogEnabled: true,
        slowSearchLogGroup: new logs.LogGroup(stack, 'SlowSearchLogs', {
          retention: logs.RetentionDays.THREE_MONTHS,
        }),
      },
    });

    expect(stack).toHaveResourceLike('AWS::Elasticsearch::Domain', {
      LogPublishingOptions: {
        SEARCH_SLOW_LOGS: {
          CloudWatchLogsLogGroupArn: {
            'Fn::GetAtt': [
              'SlowSearchLogsE00DC2E7',
              'Arn',
            ],
          },
          Enabled: true,
        },
        AUDIT_LOGS: assert.ABSENT,
        ES_APPLICATION_LOGS: assert.ABSENT,
        INDEX_SLOW_LOGS: assert.ABSENT,
      },
    });
  });

  test('slowIndexLogEnabled should use a custom log group', () => {
    new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_4,
      logging: {
        slowIndexLogEnabled: true,
        slowIndexLogGroup: new logs.LogGroup(stack, 'SlowIndexLogs', {
          retention: logs.RetentionDays.THREE_MONTHS,
        }),
      },
    });

    expect(stack).toHaveResourceLike('AWS::Elasticsearch::Domain', {
      LogPublishingOptions: {
        INDEX_SLOW_LOGS: {
          CloudWatchLogsLogGroupArn: {
            'Fn::GetAtt': [
              'SlowIndexLogsAD49DED0',
              'Arn',
            ],
          },
          Enabled: true,
        },
        AUDIT_LOGS: assert.ABSENT,
        ES_APPLICATION_LOGS: assert.ABSENT,
        SEARCH_SLOW_LOGS: assert.ABSENT,
      },
    });
  });

  test('appLogGroup should use a custom log group', () => {
    new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_4,
      logging: {
        appLogEnabled: true,
        appLogGroup: new logs.LogGroup(stack, 'AppLogs', {
          retention: logs.RetentionDays.THREE_MONTHS,
        }),
      },
    });

    expect(stack).toHaveResourceLike('AWS::Elasticsearch::Domain', {
      LogPublishingOptions: {
        ES_APPLICATION_LOGS: {
          CloudWatchLogsLogGroupArn: {
            'Fn::GetAtt': [
              'AppLogsC5DF83A6',
              'Arn',
            ],
          },
          Enabled: true,
        },
        AUDIT_LOGS: assert.ABSENT,
        SEARCH_SLOW_LOGS: assert.ABSENT,
        INDEX_SLOW_LOGS: assert.ABSENT,
      },
    });
  });

  test('auditLOgGroup should use a custom log group', () => {
    new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_4,
      fineGrainedAccessControl: {
        masterUserName: 'username',
      },
      nodeToNodeEncryption: true,
      encryptionAtRest: {
        enabled: true,
      },
      enforceHttps: true,
      logging: {
        auditLogEnabled: true,
        auditLogGroup: new logs.LogGroup(stack, 'AuditLogs', {
          retention: logs.RetentionDays.THREE_MONTHS,
        }),
      },
    });

    expect(stack).toHaveResourceLike('AWS::Elasticsearch::Domain', {
      LogPublishingOptions: {
        AUDIT_LOGS: {
          CloudWatchLogsLogGroupArn: {
            'Fn::GetAtt': [
              'AuditLogsB945E340',
              'Arn',
            ],
          },
          Enabled: true,
        },
        ES_APPLICATION_LOGS: assert.ABSENT,
        SEARCH_SLOW_LOGS: assert.ABSENT,
        INDEX_SLOW_LOGS: assert.ABSENT,
      },
    });
  });

});

describe('grants', () => {

  test('"grantRead" allows read actions associated with this domain resource', () => {
    testGrant(readActions, (p, d) => d.grantRead(p));
  });

  test('"grantWrite" allows write actions associated with this domain resource', () => {
    testGrant(writeActions, (p, d) => d.grantWrite(p));
  });

  test('"grantReadWrite" allows read and write actions associated with this domain resource', () => {
    testGrant(readWriteActions, (p, d) => d.grantReadWrite(p));
  });

  test('"grantIndexRead" allows read actions associated with an index in this domain resource', () => {
    testGrant(
      readActions,
      (p, d) => d.grantIndexRead('my-index', p),
      false,
      ['/my-index', '/my-index/*'],
    );
  });

  test('"grantIndexWrite" allows write actions associated with an index in this domain resource', () => {
    testGrant(
      writeActions,
      (p, d) => d.grantIndexWrite('my-index', p),
      false,
      ['/my-index', '/my-index/*'],
    );
  });

  test('"grantIndexReadWrite" allows read and write actions associated with an index in this domain resource', () => {
    testGrant(
      readWriteActions,
      (p, d) => d.grantIndexReadWrite('my-index', p),
      false,
      ['/my-index', '/my-index/*'],
    );
  });

  test('"grantPathRead" allows read actions associated with a given path in this domain resource', () => {
    testGrant(
      readActions,
      (p, d) => d.grantPathRead('my-index/my-path', p),
      false,
      ['/my-index/my-path'],
    );
  });

  test('"grantPathWrite" allows write actions associated with a given path in this domain resource', () => {
    testGrant(
      writeActions,
      (p, d) => d.grantPathWrite('my-index/my-path', p),
      false,
      ['/my-index/my-path'],
    );
  });

  test('"grantPathReadWrite" allows read and write actions associated with a given path in this domain resource', () => {
    testGrant(
      readWriteActions,
      (p, d) => d.grantPathReadWrite('my-index/my-path', p),
      false,
      ['/my-index/my-path'],
    );
  });

  test('"grant" for an imported domain', () => {
    const domainEndpoint = 'https://test-domain-2w2x2u3tifly-jcjotrt6f7otem4sqcwbch3c4u.testregion.es.amazonaws.com';
    const domain = Domain.fromDomainEndpoint(stack, 'Domain', domainEndpoint);
    const user = new iam.User(stack, 'user');

    domain.grantReadWrite(user);

    expect(stack).toHaveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: [
              'es:ESHttpGet',
              'es:ESHttpHead',
              'es:ESHttpDelete',
              'es:ESHttpPost',
              'es:ESHttpPut',
              'es:ESHttpPatch',
            ],
            Effect: 'Allow',
            Resource: [
              {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    {
                      Ref: 'AWS::Partition',
                    },
                    ':es:testregion:1234:domain/test-domain-2w2x2u3tifly',
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
                    ':es:testregion:1234:domain/test-domain-2w2x2u3tifly/*',
                  ],
                ],
              },
            ],
          },
        ],
        Version: '2012-10-17',
      },
      PolicyName: 'userDefaultPolicy083DF682',
      Users: [
        {
          Ref: 'user2C2B57AE',
        },
      ],
    });
  });

});

describe('metrics', () => {

  test('Can use metricClusterStatusRed on an Elasticsearch Domain', () => {
    testMetric(
      (domain) => domain.metricClusterStatusRed(),
      'ClusterStatus.red',
      Statistic.MAXIMUM,
    );
  });

  test('Can use metricClusterStatusYellow on an Elasticsearch Domain', () => {
    testMetric(
      (domain) => domain.metricClusterStatusYellow(),
      'ClusterStatus.yellow',
      Statistic.MAXIMUM,
    );
  });

  test('Can use metricFreeStorageSpace on an Elasticsearch Domain', () => {
    testMetric(
      (domain) => domain.metricFreeStorageSpace(),
      'FreeStorageSpace',
      Statistic.MINIMUM,
    );
  });

  test('Can use metricClusterIndexWriteBlocked on an Elasticsearch Domain', () => {
    testMetric(
      (domain) => domain.metricClusterIndexWritesBlocked(),
      'ClusterIndexWritesBlocked',
      Statistic.MAXIMUM,
      Duration.minutes(1),
    );
  });

  test('Can use metricNodes on an Elasticsearch Domain', () => {
    testMetric(
      (domain) => domain.metricNodes(),
      'Nodes',
      Statistic.MINIMUM,
      Duration.hours(1),
    );
  });

  test('Can use metricAutomatedSnapshotFailure on an Elasticsearch Domain', () => {
    testMetric(
      (domain) => domain.metricAutomatedSnapshotFailure(),
      'AutomatedSnapshotFailure',
      Statistic.MAXIMUM,
    );
  });

  test('Can use metricCPUUtilization on an Elasticsearch Domain', () => {
    testMetric(
      (domain) => domain.metricCPUUtilization(),
      'CPUUtilization',
      Statistic.MAXIMUM,
    );
  });

  test('Can use metricJVMMemoryPressure on an Elasticsearch Domain', () => {
    testMetric(
      (domain) => domain.metricJVMMemoryPressure(),
      'JVMMemoryPressure',
      Statistic.MAXIMUM,
    );
  });

  test('Can use metricMasterCPUUtilization on an Elasticsearch Domain', () => {
    testMetric(
      (domain) => domain.metricMasterCPUUtilization(),
      'MasterCPUUtilization',
      Statistic.MAXIMUM,
    );
  });

  test('Can use metricMasterJVMMemoryPressure on an Elasticsearch Domain', () => {
    testMetric(
      (domain) => domain.metricMasterJVMMemoryPressure(),
      'MasterJVMMemoryPressure',
      Statistic.MAXIMUM,
    );
  });

  test('Can use metricKMSKeyError on an Elasticsearch Domain', () => {
    testMetric(
      (domain) => domain.metricKMSKeyError(),
      'KMSKeyError',
      Statistic.MAXIMUM,
    );
  });

  test('Can use metricKMSKeyInaccessible on an Elasticsearch Domain', () => {
    testMetric(
      (domain) => domain.metricKMSKeyInaccessible(),
      'KMSKeyInaccessible',
      Statistic.MAXIMUM,
    );
  });

  test('Can use metricSearchableDocuments on an Elasticsearch Domain', () => {
    testMetric(
      (domain) => domain.metricSearchableDocuments(),
      'SearchableDocuments',
      Statistic.MAXIMUM,
    );
  });

  test('Can use metricSearchLatency on an Elasticsearch Domain', () => {
    testMetric(
      (domain) => domain.metricSearchLatency(),
      'SearchLatency',
      'p99',
    );
  });

  test('Can use metricIndexingLatency on an Elasticsearch Domain', () => {
    testMetric(
      (domain) => domain.metricIndexingLatency(),
      'IndexingLatency',
      'p99',
    );
  });

});

describe('import', () => {

  test('static fromDomainEndpoint(endpoint) allows importing an external/existing domain', () => {
    const domainName = 'test-domain-2w2x2u3tifly';
    const domainEndpoint = `https://${domainName}-jcjotrt6f7otem4sqcwbch3c4u.testregion.es.amazonaws.com`;
    const imported = Domain.fromDomainEndpoint(stack, 'Domain', domainEndpoint);

    expect(imported.domainName).toEqual(domainName);
    expect(imported.domainArn).toMatch(RegExp(`es:testregion:1234:domain/${domainName}$`));

    expect(stack).not.toHaveResource('AWS::Elasticsearch::Domain');
  });

  test('static fromDomainAttributes(attributes) allows importing an external/existing domain', () => {
    const domainName = 'test-domain-2w2x2u3tifly';
    const domainArn = `es:testregion:1234:domain/${domainName}`;
    const domainEndpoint = `https://${domainName}-jcjotrt6f7otem4sqcwbch3c4u.testregion.es.amazonaws.com`;
    const imported = Domain.fromDomainAttributes(stack, 'Domain', {
      domainArn,
      domainEndpoint,
    });

    expect(imported.domainName).toEqual(domainName);
    expect(imported.domainArn).toEqual(domainArn);

    expect(stack).not.toHaveResource('AWS::Elasticsearch::Domain');
  });

});

describe('advanced security options', () => {
  const masterUserArn = 'arn:aws:iam::123456789012:user/JohnDoe';
  const masterUserName = 'JohnDoe';
  const password = 'password';
  const masterUserPassword = SecretValue.plainText(password);

  test('enable fine-grained access control with a master user ARN', () => {
    new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_1,
      fineGrainedAccessControl: {
        masterUserArn,
      },
      encryptionAtRest: {
        enabled: true,
      },
      nodeToNodeEncryption: true,
      enforceHttps: true,
    });

    expect(stack).toHaveResourceLike('AWS::Elasticsearch::Domain', {
      AdvancedSecurityOptions: {
        Enabled: true,
        InternalUserDatabaseEnabled: false,
        MasterUserOptions: {
          MasterUserARN: masterUserArn,
        },
      },
      EncryptionAtRestOptions: {
        Enabled: true,
      },
      NodeToNodeEncryptionOptions: {
        Enabled: true,
      },
      DomainEndpointOptions: {
        EnforceHTTPS: true,
      },
    });
  });

  test('enable fine-grained access control with a master user name and password', () => {
    new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_1,
      fineGrainedAccessControl: {
        masterUserName,
        masterUserPassword,
      },
      encryptionAtRest: {
        enabled: true,
      },
      nodeToNodeEncryption: true,
      enforceHttps: true,
    });

    expect(stack).toHaveResourceLike('AWS::Elasticsearch::Domain', {
      AdvancedSecurityOptions: {
        Enabled: true,
        InternalUserDatabaseEnabled: true,
        MasterUserOptions: {
          MasterUserName: masterUserName,
          MasterUserPassword: password,
        },
      },
      EncryptionAtRestOptions: {
        Enabled: true,
      },
      NodeToNodeEncryptionOptions: {
        Enabled: true,
      },
      DomainEndpointOptions: {
        EnforceHTTPS: true,
      },
    });
  });

  test('enable fine-grained access control with a master user name and dynamically generated password', () => {
    new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_1,
      fineGrainedAccessControl: {
        masterUserName,
      },
      encryptionAtRest: {
        enabled: true,
      },
      nodeToNodeEncryption: true,
      enforceHttps: true,
    });

    expect(stack).toHaveResourceLike('AWS::Elasticsearch::Domain', {
      AdvancedSecurityOptions: {
        Enabled: true,
        InternalUserDatabaseEnabled: true,
        MasterUserOptions: {
          MasterUserName: masterUserName,
          MasterUserPassword: {
            'Fn::Join': [
              '',
              [
                '{{resolve:secretsmanager:',
                {
                  Ref: 'DomainMasterUserBFAFA7D9',
                },
                ':SecretString:password::}}',
              ],
            ],
          },
        },
      },
      EncryptionAtRestOptions: {
        Enabled: true,
      },
      NodeToNodeEncryptionOptions: {
        Enabled: true,
      },
      DomainEndpointOptions: {
        EnforceHTTPS: true,
      },
    });

    expect(stack).toHaveResourceLike('AWS::SecretsManager::Secret', {
      GenerateSecretString: {
        GenerateStringKey: 'password',
      },
    });
  });

  test('enabling fine-grained access control throws with Elasticsearch < 6.7', () => {
    expect(() => new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V6_5,
      fineGrainedAccessControl: {
        masterUserArn,
      },
      encryptionAtRest: {
        enabled: true,
      },
      nodeToNodeEncryption: true,
      enforceHttps: true,
    })).toThrow(/Fine-grained access control requires Elasticsearch version 6\.7 or later/);
  });

  test('enabling fine-grained access control throws without node-to-node encryption enabled', () => {
    expect(() => new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_7,
      fineGrainedAccessControl: {
        masterUserArn,
      },
      encryptionAtRest: {
        enabled: true,
      },
      nodeToNodeEncryption: false,
      enforceHttps: true,
    })).toThrow(/Node-to-node encryption is required when fine-grained access control is enabled/);
  });

  test('enabling fine-grained access control throws without encryption-at-rest enabled', () => {
    expect(() => new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_7,
      fineGrainedAccessControl: {
        masterUserArn,
      },
      encryptionAtRest: {
        enabled: false,
      },
      nodeToNodeEncryption: true,
      enforceHttps: true,
    })).toThrow(/Encryption-at-rest is required when fine-grained access control is enabled/);
  });

  test('enabling fine-grained access control throws without enforceHttps enabled', () => {
    expect(() => new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_7,
      fineGrainedAccessControl: {
        masterUserArn,
      },
      encryptionAtRest: {
        enabled: true,
      },
      nodeToNodeEncryption: true,
      enforceHttps: false,
    })).toThrow(/Enforce HTTPS is required when fine-grained access control is enabled/);
  });
});

describe('custom endpoints', () => {
  const customDomainName = 'search.example.com';

  test('custom domain without hosted zone and default cert', () => {
    new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_1,
      nodeToNodeEncryption: true,
      enforceHttps: true,
      customEndpoint: {
        domainName: customDomainName,
      },
    });

    expect(stack).toHaveResourceLike('AWS::Elasticsearch::Domain', {
      DomainEndpointOptions: {
        EnforceHTTPS: true,
        CustomEndpointEnabled: true,
        CustomEndpoint: customDomainName,
        CustomEndpointCertificateArn: {
          Ref: 'DomainCustomEndpointCertificateD080A69E', // Auto-generated certificate
        },
      },
    });
    expect(stack).toHaveResourceLike('AWS::CertificateManager::Certificate', {
      DomainName: customDomainName,
      ValidationMethod: 'EMAIL',
    });
  });

  test('custom domain with hosted zone and default cert', () => {
    const zone = new route53.HostedZone(stack, 'DummyZone', { zoneName: 'example.com' });
    new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_1,
      nodeToNodeEncryption: true,
      enforceHttps: true,
      customEndpoint: {
        domainName: customDomainName,
        hostedZone: zone,
      },
    });

    expect(stack).toHaveResourceLike('AWS::Elasticsearch::Domain', {
      DomainEndpointOptions: {
        EnforceHTTPS: true,
        CustomEndpointEnabled: true,
        CustomEndpoint: customDomainName,
        CustomEndpointCertificateArn: {
          Ref: 'DomainCustomEndpointCertificateD080A69E', // Auto-generated certificate
        },
      },
    });
    expect(stack).toHaveResourceLike('AWS::CertificateManager::Certificate', {
      DomainName: customDomainName,
      DomainValidationOptions: [
        {
          DomainName: customDomainName,
          HostedZoneId: {
            Ref: 'DummyZone03E0FE81',
          },
        },
      ],
      ValidationMethod: 'DNS',
    });
    expect(stack).toHaveResourceLike('AWS::Route53::RecordSet', {
      Name: 'search.example.com.',
      Type: 'CNAME',
      HostedZoneId: {
        Ref: 'DummyZone03E0FE81',
      },
      ResourceRecords: [
        {
          'Fn::GetAtt': [
            'Domain66AC69E0',
            'DomainEndpoint',
          ],
        },
      ],
    });
  });

  test('custom domain with hosted zone and given cert', () => {
    const zone = new route53.HostedZone(stack, 'DummyZone', {
      zoneName: 'example.com',
    });
    const certificate = new acm.Certificate(stack, 'DummyCert', {
      domainName: customDomainName,
    });

    new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_1,
      nodeToNodeEncryption: true,
      enforceHttps: true,
      customEndpoint: {
        domainName: customDomainName,
        hostedZone: zone,
        certificate,
      },
    });

    expect(stack).toHaveResourceLike('AWS::Elasticsearch::Domain', {
      DomainEndpointOptions: {
        EnforceHTTPS: true,
        CustomEndpointEnabled: true,
        CustomEndpoint: customDomainName,
        CustomEndpointCertificateArn: {
          Ref: 'DummyCertFA37670B',
        },
      },
    });
    expect(stack).toHaveResourceLike('AWS::Route53::RecordSet', {
      Name: 'search.example.com.',
      Type: 'CNAME',
      HostedZoneId: {
        Ref: 'DummyZone03E0FE81',
      },
      ResourceRecords: [
        {
          'Fn::GetAtt': [
            'Domain66AC69E0',
            'DomainEndpoint',
          ],
        },
      ],
    });
  });

});

describe('custom error responses', () => {

  test('error when availabilityZoneCount does not match vpcOptions.subnets length', () => {
    const vpc = new Vpc(stack, 'Vpc', {
      maxAzs: 1,
    });

    expect(() => new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_4,
      zoneAwareness: {
        enabled: true,
        availabilityZoneCount: 2,
      },
      vpc,
    })).toThrow(/you need to provide a subnet for each AZ you are using/);
  });

  test('error when master, data or Ultra Warm instance types do not end with .elasticsearch', () => {
    const error = /instance types must end with ".elasticsearch"/;
    expect(() => new Domain(stack, 'Domain1', {
      version: ElasticsearchVersion.V7_4,
      capacity: {
        masterNodeInstanceType: 'c5.large',
      },
    })).toThrow(error);
    expect(() => new Domain(stack, 'Domain2', {
      version: ElasticsearchVersion.V7_4,
      capacity: {
        dataNodeInstanceType: 'c5.2xlarge',
      },
    })).toThrow(error);
    expect(() => new Domain(stack, 'Domain3', {
      version: ElasticsearchVersion.V7_4,
      capacity: {
        warmInstanceType: 'ultrawarm1.medium',
      },
    })).toThrow(error);
  });

  test('error when Ultra Warm instance types do not start with ultrawarm', () => {
    const error = /UltraWarm node instance type must start with "ultrawarm"./;
    expect(() => new Domain(stack, 'Domain1', {
      version: ElasticsearchVersion.V7_4,
      capacity: {
        warmInstanceType: 't3.small.elasticsearch',
      },
    })).toThrow(error);
  });

  test('error when elasticsearchVersion is unsupported/unknown', () => {
    expect(() => new Domain(stack, 'Domain1', {
      version: ElasticsearchVersion.of('5.4'),
    })).toThrow(/Unknown Elasticsearch version: 5\.4/);
  });

  test('error when log publishing is enabled for elasticsearch version < 5.1', () => {
    const error = /logs publishing requires Elasticsearch version 5.1 or later/;
    expect(() => new Domain(stack, 'Domain1', {
      version: ElasticsearchVersion.V2_3,
      logging: {
        appLogEnabled: true,
      },
    })).toThrow(error);
    expect(() => new Domain(stack, 'Domain2', {
      version: ElasticsearchVersion.V1_5,
      logging: {
        slowSearchLogEnabled: true,
      },
    })).toThrow(error);
    expect(() => new Domain(stack, 'Domain3', {
      version: ElasticsearchVersion.V1_5,
      logging: {
        slowIndexLogEnabled: true,
      },
    })).toThrow(error);
  });

  test('error when encryption at rest is enabled for elasticsearch version < 5.1', () => {
    expect(() => new Domain(stack, 'Domain1', {
      version: ElasticsearchVersion.V2_3,
      encryptionAtRest: {
        enabled: true,
      },
    })).toThrow(/Encryption of data at rest requires Elasticsearch version 5.1 or later/);
  });

  test('error when cognito for kibana is enabled for elasticsearch version < 5.1', () => {
    const user = new iam.User(stack, 'user');
    expect(() => new Domain(stack, 'Domain1', {
      version: ElasticsearchVersion.V2_3,
      cognitoKibanaAuth: {
        identityPoolId: 'test-identity-pool-id',
        role: new iam.Role(stack, 'Role', { assumedBy: user }),
        userPoolId: 'test-user-pool-id',
      },
    })).toThrow(/Cognito authentication for Kibana requires Elasticsearch version 5.1 or later/);
  });

  test('error when C5, I3, M5, or R5 instance types are specified for elasticsearch version < 5.1', () => {
    const error = /C5, I3, M5, and R5 instance types require Elasticsearch version 5.1 or later/;
    expect(() => new Domain(stack, 'Domain1', {
      version: ElasticsearchVersion.V2_3,
      capacity: {
        masterNodeInstanceType: 'c5.medium.elasticsearch',
      },
    })).toThrow(error);
    expect(() => new Domain(stack, 'Domain2', {
      version: ElasticsearchVersion.V1_5,
      capacity: {
        dataNodeInstanceType: 'i3.2xlarge.elasticsearch',
      },
    })).toThrow(error);
    expect(() => new Domain(stack, 'Domain3', {
      version: ElasticsearchVersion.V1_5,
      capacity: {
        dataNodeInstanceType: 'm5.2xlarge.elasticsearch',
      },
    })).toThrow(error);
    expect(() => new Domain(stack, 'Domain4', {
      version: ElasticsearchVersion.V1_5,
      capacity: {
        masterNodeInstanceType: 'r5.2xlarge.elasticsearch',
      },
    })).toThrow(error);
  });

  test('error when node to node encryption is enabled for elasticsearch version < 6.0', () => {
    expect(() => new Domain(stack, 'Domain1', {
      version: ElasticsearchVersion.V5_6,
      nodeToNodeEncryption: true,
    })).toThrow(/Node-to-node encryption requires Elasticsearch version 6.0 or later/);
  });

  test('error when i3 instance types are specified with EBS enabled', () => {
    expect(() => new Domain(stack, 'Domain1', {
      version: ElasticsearchVersion.V7_4,
      capacity: {
        dataNodeInstanceType: 'i3.2xlarge.elasticsearch',
      },
      ebs: {
        volumeSize: 100,
        volumeType: EbsDeviceVolumeType.GENERAL_PURPOSE_SSD,
      },
    })).toThrow(/I3 instance types do not support EBS storage volumes/);
  });

  test('error when m3, r3, or t2 instance types are specified with encryption at rest enabled', () => {
    const error = /M3, R3, and T2 instance types do not support encryption of data at rest/;
    expect(() => new Domain(stack, 'Domain1', {
      version: ElasticsearchVersion.V7_4,
      capacity: {
        masterNodeInstanceType: 'm3.2xlarge.elasticsearch',
      },
      encryptionAtRest: {
        enabled: true,
      },
    })).toThrow(error);
    expect(() => new Domain(stack, 'Domain2', {
      version: ElasticsearchVersion.V7_4,
      capacity: {
        dataNodeInstanceType: 'r3.2xlarge.elasticsearch',
      },
      encryptionAtRest: {
        enabled: true,
      },
    })).toThrow(error);
    expect(() => new Domain(stack, 'Domain3', {
      version: ElasticsearchVersion.V7_4,
      capacity: {
        masterNodeInstanceType: 't2.2xlarge.elasticsearch',
      },
      encryptionAtRest: {
        enabled: true,
      },
    })).toThrow(error);
  });

  test('error when t2.micro is specified with elasticsearch version > 2.3', () => {
    expect(() => new Domain(stack, 'Domain1', {
      version: ElasticsearchVersion.V6_7,
      capacity: {
        masterNodeInstanceType: 't2.micro.elasticsearch',
      },
    })).toThrow(/t2.micro.elasticsearch instance type supports only Elasticsearch 1.5 and 2.3/);
  });

  test('error when any instance type other than R3 and I3 are specified without EBS enabled', () => {
    expect(() => new Domain(stack, 'Domain1', {
      version: ElasticsearchVersion.V7_4,
      ebs: {
        enabled: false,
      },
      capacity: {
        masterNodeInstanceType: 'm5.large.elasticsearch',
      },
    })).toThrow(/EBS volumes are required when using instance types other than r3 or i3/);
  });

  test('error when availabilityZoneCount is not 2 or 3', () => {
    const vpc = new Vpc(stack, 'Vpc');

    expect(() => new Domain(stack, 'Domain1', {
      version: ElasticsearchVersion.V7_4,
      vpc,
      zoneAwareness: {
        availabilityZoneCount: 4,
      },
    })).toThrow(/Invalid zone awareness configuration; availabilityZoneCount must be 2 or 3/);
  });

  test('error when UltraWarm instance is used and not supported by elasticsearchVersion', () => {
    expect(() => new Domain(stack, 'Domain1', {
      version: ElasticsearchVersion.V6_7,
      capacity: {
        masterNodes: 1,
        warmNodes: 1,
      },
    })).toThrow(/UltraWarm requires Elasticsearch 6\.8 or later/);
  });

  test('error when t2 or t3 instance types are specified with UltramWarm enabled', () => {
    const error = /T2 and T3 instance types do not support UltraWarm storage/;
    expect(() => new Domain(stack, 'Domain1', {
      version: ElasticsearchVersion.V7_4,
      capacity: {
        masterNodeInstanceType: 't2.2xlarge.elasticsearch',
        warmNodes: 1,
      },
    })).toThrow(error);
    expect(() => new Domain(stack, 'Domain2', {
      version: ElasticsearchVersion.V7_4,
      capacity: {
        masterNodeInstanceType: 't3.2xlarge.elasticsearch',
        warmNodes: 1,
      },
    })).toThrow(error);
  });

  test('error when UltraWarm instance is used and no dedicated master instance specified', () => {
    expect(() => new Domain(stack, 'Domain1', {
      version: ElasticsearchVersion.V7_4,
      capacity: {
        warmNodes: 1,
        masterNodes: 0,
      },
    })).toThrow(/Dedicated master node is required when UltraWarm storage is enabled/);
  });

});

test('can specify future version', () => {
  new Domain(stack, 'Domain', { version: ElasticsearchVersion.of('8.2') });

  expect(stack).toHaveResourceLike('AWS::Elasticsearch::Domain', {
    ElasticsearchVersion: '8.2',
  });
});

describe('unsigned basic auth', () => {
  test('can create a domain with unsigned basic auth', () => {
    new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_7,
      useUnsignedBasicAuth: true,
    });

    expect(stack).toHaveResourceLike('AWS::Elasticsearch::Domain', {
      AdvancedSecurityOptions: {
        Enabled: true,
        InternalUserDatabaseEnabled: true,
        MasterUserOptions: {
          MasterUserName: 'admin',
        },
      },
      EncryptionAtRestOptions: {
        Enabled: true,
      },
      NodeToNodeEncryptionOptions: {
        Enabled: true,
      },
      DomainEndpointOptions: {
        EnforceHTTPS: true,
      },
    });
  });

  test('does not overwrite master user ARN configuration', () => {
    const masterUserArn = 'arn:aws:iam::123456789012:user/JohnDoe';

    new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_7,
      fineGrainedAccessControl: {
        masterUserArn,
      },
      useUnsignedBasicAuth: true,
    });

    expect(stack).toHaveResourceLike('AWS::Elasticsearch::Domain', {
      AdvancedSecurityOptions: {
        Enabled: true,
        InternalUserDatabaseEnabled: false,
        MasterUserOptions: {
          MasterUserARN: masterUserArn,
        },
      },
      EncryptionAtRestOptions: {
        Enabled: true,
      },
      NodeToNodeEncryptionOptions: {
        Enabled: true,
      },
      DomainEndpointOptions: {
        EnforceHTTPS: true,
      },
    });
  });

  test('does not overwrite master user name and password', () => {
    const masterUserName = 'JohnDoe';
    const password = 'password';
    const masterUserPassword = SecretValue.plainText(password);

    new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_1,
      fineGrainedAccessControl: {
        masterUserName,
        masterUserPassword,
      },
      useUnsignedBasicAuth: true,
    });

    expect(stack).toHaveResourceLike('AWS::Elasticsearch::Domain', {
      AdvancedSecurityOptions: {
        Enabled: true,
        InternalUserDatabaseEnabled: true,
        MasterUserOptions: {
          MasterUserName: masterUserName,
          MasterUserPassword: password,
        },
      },
      EncryptionAtRestOptions: {
        Enabled: true,
      },
      NodeToNodeEncryptionOptions: {
        Enabled: true,
      },
      DomainEndpointOptions: {
        EnforceHTTPS: true,
      },
    });
  });

  test('fails to create a domain with unsigned basic auth when enforce HTTPS is disabled', () => {
    expect(() => new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_7,
      useUnsignedBasicAuth: true,
      enforceHttps: false,
    })).toThrow(/You cannot disable HTTPS and use unsigned basic auth/);
  });

  test('fails to create a domain with unsigned basic auth when node to node encryption is disabled', () => {
    expect(() => new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_7,
      useUnsignedBasicAuth: true,
      nodeToNodeEncryption: false,
    })).toThrow(/You cannot disable node to node encryption and use unsigned basic auth/);
  });

  test('fails to create a domain with unsigned basic auth when encryption at rest is disabled', () => {
    expect(() => new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V7_7,
      useUnsignedBasicAuth: true,
      encryptionAtRest: { enabled: false },
    })).toThrow(/You cannot disable encryption at rest and use unsigned basic auth/);
  });

  test('using unsigned basic auth throws with Elasticsearch < 6.7', () => {
    expect(() => new Domain(stack, 'Domain', {
      version: ElasticsearchVersion.V6_5,
      useUnsignedBasicAuth: true,
    })).toThrow(/Using unsigned basic auth requires Elasticsearch version 6\.7 or later./);
  });
});


function testGrant(
  expectedActions: string[],
  invocation: (user: iam.IPrincipal, domain: Domain) => void,
  appliesToDomainRoot: Boolean = true,
  paths: string[] = ['/*'],
) {
  const domain = new Domain(stack, 'Domain', { version: ElasticsearchVersion.V7_4 });
  const user = new iam.User(stack, 'user');

  invocation(user, domain);

  const action = expectedActions.length > 1 ? expectedActions.map(a => `es:${a}`) : `es:${expectedActions[0]}`;
  const domainArn = {
    'Fn::GetAtt': [
      'Domain66AC69E0',
      'Arn',
    ],
  };
  const resolvedPaths = paths.map(path => {
    return {
      'Fn::Join': [
        '',
        [
          domainArn,
          path,
        ],
      ],
    };
  });
  const resource = appliesToDomainRoot
    ? [domainArn, ...resolvedPaths]
    : resolvedPaths.length > 1
      ? resolvedPaths
      : resolvedPaths[0];

  expect(stack).toHaveResource('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: [
        {
          Action: action,
          Effect: 'Allow',
          Resource: resource,
        },
      ],
      Version: '2012-10-17',
    },
    PolicyName: 'userDefaultPolicy083DF682',
    Users: [
      {
        Ref: 'user2C2B57AE',
      },
    ],
  });
}

function testMetric(
  invocation: (domain: Domain) => Metric,
  metricName: string,
  statistic: string = Statistic.SUM,
  period: Duration = Duration.minutes(5),
) {
  const domain = new Domain(stack, 'Domain', { version: ElasticsearchVersion.V7_4 });

  const metric = invocation(domain);

  expect(metric).toMatchObject({
    metricName,
    namespace: 'AWS/ES',
    period,
    statistic,
    dimensions: {
      ClientId: '1234',
    },
  });
  expect(metric.dimensions).toHaveProperty('DomainName');
}
