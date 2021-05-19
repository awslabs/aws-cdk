import { arrayWith, ABSENT, ResourcePart, SynthUtils } from '@aws-cdk/assert-internal';
import '@aws-cdk/assert-internal/jest';
import * as appscaling from '@aws-cdk/aws-applicationautoscaling';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import { App, Aws, CfnDeletionPolicy, ConstructNode, Duration, PhysicalName, RemovalPolicy, Resource, Stack, Tags } from '@aws-cdk/core';
import * as cr from '@aws-cdk/custom-resources';
import { testLegacyBehavior } from 'cdk-build-tools/lib/feature-flag';
import { Construct } from 'constructs';
import {
  Attribute,
  AttributeType,
  BillingMode,
  GlobalSecondaryIndexProps,
  LocalSecondaryIndexProps,
  ProjectionType,
  StreamViewType,
  Table,
  TableEncryption,
  Operation,
  CfnTable,
} from '../lib';

jest.mock('@aws-cdk/custom-resources');

/* eslint-disable quote-props */

// CDK parameters
const CONSTRUCT_NAME = 'MyTable';

// DynamoDB table parameters
const TABLE_NAME = 'MyTable';
const TABLE_PARTITION_KEY: Attribute = { name: 'hashKey', type: AttributeType.STRING };
const TABLE_SORT_KEY: Attribute = { name: 'sortKey', type: AttributeType.NUMBER };

// DynamoDB global secondary index parameters
const GSI_NAME = 'MyGSI';
const GSI_PARTITION_KEY: Attribute = { name: 'gsiHashKey', type: AttributeType.STRING };
const GSI_SORT_KEY: Attribute = { name: 'gsiSortKey', type: AttributeType.BINARY };
const GSI_NON_KEY = 'gsiNonKey';
function* GSI_GENERATOR(): Generator<GlobalSecondaryIndexProps, never> {
  let n = 0;
  while (true) {
    const globalSecondaryIndexProps: GlobalSecondaryIndexProps = {
      indexName: `${GSI_NAME}${n}`,
      partitionKey: { name: `${GSI_PARTITION_KEY.name}${n}`, type: GSI_PARTITION_KEY.type },
    };
    yield globalSecondaryIndexProps;
    n++;
  }
}
function* NON_KEY_ATTRIBUTE_GENERATOR(nonKeyPrefix: string): Generator<string, never> {
  let n = 0;
  while (true) {
    yield `${nonKeyPrefix}${n}`;
    n++;
  }
}

// DynamoDB local secondary index parameters
const LSI_NAME = 'MyLSI';
const LSI_SORT_KEY: Attribute = { name: 'lsiSortKey', type: AttributeType.NUMBER };
const LSI_NON_KEY = 'lsiNonKey';
function* LSI_GENERATOR(): Generator<LocalSecondaryIndexProps, never> {
  let n = 0;
  while (true) {
    const localSecondaryIndexProps: LocalSecondaryIndexProps = {
      indexName: `${LSI_NAME}${n}`,
      sortKey: { name: `${LSI_SORT_KEY.name}${n}`, type: LSI_SORT_KEY.type },
    };
    yield localSecondaryIndexProps;
    n++;
  }
}

describe('default properties', () => {
  let stack: Stack;
  beforeEach(() => {
    stack = new Stack();
  });

  test('hash key only', () => {
    new Table(stack, CONSTRUCT_NAME, { partitionKey: TABLE_PARTITION_KEY });

    expect(stack).toHaveResource('AWS::DynamoDB::Table', {
      AttributeDefinitions: [{ AttributeName: 'hashKey', AttributeType: 'S' }],
      KeySchema: [{ AttributeName: 'hashKey', KeyType: 'HASH' }],
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    });

    expect(stack).toHaveResource('AWS::DynamoDB::Table', { DeletionPolicy: CfnDeletionPolicy.RETAIN }, ResourcePart.CompleteDefinition);

  });

  test('removalPolicy is DESTROY', () => {
    new Table(stack, CONSTRUCT_NAME, { partitionKey: TABLE_PARTITION_KEY, removalPolicy: RemovalPolicy.DESTROY });

    expect(stack).toHaveResource('AWS::DynamoDB::Table', { DeletionPolicy: CfnDeletionPolicy.DELETE }, ResourcePart.CompleteDefinition);

  });

  test('hash + range key', () => {
    new Table(stack, CONSTRUCT_NAME, {
      partitionKey: TABLE_PARTITION_KEY,
      sortKey: TABLE_SORT_KEY,
    });

    expect(stack).toHaveResource('AWS::DynamoDB::Table', {
      AttributeDefinitions: [
        { AttributeName: 'hashKey', AttributeType: 'S' },
        { AttributeName: 'sortKey', AttributeType: 'N' },
      ],
      KeySchema: [
        { AttributeName: 'hashKey', KeyType: 'HASH' },
        { AttributeName: 'sortKey', KeyType: 'RANGE' },
      ],
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    });
  });

  test('hash + range key can also be specified in props', () => {
    new Table(stack, CONSTRUCT_NAME, {
      partitionKey: TABLE_PARTITION_KEY,
      sortKey: TABLE_SORT_KEY,
    });

    expect(stack).toHaveResource('AWS::DynamoDB::Table',
      {
        AttributeDefinitions: [
          { AttributeName: 'hashKey', AttributeType: 'S' },
          { AttributeName: 'sortKey', AttributeType: 'N' },
        ],
        KeySchema: [
          { AttributeName: 'hashKey', KeyType: 'HASH' },
          { AttributeName: 'sortKey', KeyType: 'RANGE' },
        ],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      });
  });

  test('point-in-time recovery is not enabled', () => {
    new Table(stack, CONSTRUCT_NAME, {
      partitionKey: TABLE_PARTITION_KEY,
      sortKey: TABLE_SORT_KEY,
    });

    expect(stack).toHaveResource('AWS::DynamoDB::Table',
      {
        AttributeDefinitions: [
          { AttributeName: 'hashKey', AttributeType: 'S' },
          { AttributeName: 'sortKey', AttributeType: 'N' },
        ],
        KeySchema: [
          { AttributeName: 'hashKey', KeyType: 'HASH' },
          { AttributeName: 'sortKey', KeyType: 'RANGE' },
        ],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    );
  });

  test('server-side encryption is not enabled', () => {
    new Table(stack, CONSTRUCT_NAME, {
      partitionKey: TABLE_PARTITION_KEY,
      sortKey: TABLE_SORT_KEY,
    });

    expect(stack).toHaveResource('AWS::DynamoDB::Table',
      {
        AttributeDefinitions: [
          { AttributeName: 'hashKey', AttributeType: 'S' },
          { AttributeName: 'sortKey', AttributeType: 'N' },
        ],
        KeySchema: [
          { AttributeName: 'hashKey', KeyType: 'HASH' },
          { AttributeName: 'sortKey', KeyType: 'RANGE' },
        ],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    );
  });

  test('stream is not enabled', () => {
    new Table(stack, CONSTRUCT_NAME, {
      partitionKey: TABLE_PARTITION_KEY,
      sortKey: TABLE_SORT_KEY,
    });

    expect(stack).toHaveResource('AWS::DynamoDB::Table',
      {
        AttributeDefinitions: [
          { AttributeName: 'hashKey', AttributeType: 'S' },
          { AttributeName: 'sortKey', AttributeType: 'N' },
        ],
        KeySchema: [
          { AttributeName: 'hashKey', KeyType: 'HASH' },
          { AttributeName: 'sortKey', KeyType: 'RANGE' },
        ],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    );
  });

  test('ttl is not enabled', () => {
    new Table(stack, CONSTRUCT_NAME, {
      partitionKey: TABLE_PARTITION_KEY,
      sortKey: TABLE_SORT_KEY,
    });

    expect(stack).toHaveResource('AWS::DynamoDB::Table',
      {
        AttributeDefinitions: [
          { AttributeName: 'hashKey', AttributeType: 'S' },
          { AttributeName: 'sortKey', AttributeType: 'N' },
        ],
        KeySchema: [
          { AttributeName: 'hashKey', KeyType: 'HASH' },
          { AttributeName: 'sortKey', KeyType: 'RANGE' },
        ],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    );
  });

  test('can specify new and old images', () => {
    new Table(stack, CONSTRUCT_NAME, {
      tableName: TABLE_NAME,
      readCapacity: 42,
      writeCapacity: 1337,
      stream: StreamViewType.NEW_AND_OLD_IMAGES,
      partitionKey: TABLE_PARTITION_KEY,
      sortKey: TABLE_SORT_KEY,
    });

    expect(stack).toHaveResource('AWS::DynamoDB::Table',
      {
        AttributeDefinitions: [
          { AttributeName: 'hashKey', AttributeType: 'S' },
          { AttributeName: 'sortKey', AttributeType: 'N' },
        ],
        StreamSpecification: { StreamViewType: 'NEW_AND_OLD_IMAGES' },
        KeySchema: [
          { AttributeName: 'hashKey', KeyType: 'HASH' },
          { AttributeName: 'sortKey', KeyType: 'RANGE' },
        ],
        ProvisionedThroughput: { ReadCapacityUnits: 42, WriteCapacityUnits: 1337 },
        TableName: 'MyTable',
      },
    );
  });

  test('can specify new images only', () => {
    new Table(stack, CONSTRUCT_NAME, {
      tableName: TABLE_NAME,
      readCapacity: 42,
      writeCapacity: 1337,
      stream: StreamViewType.NEW_IMAGE,
      partitionKey: TABLE_PARTITION_KEY,
      sortKey: TABLE_SORT_KEY,
    });

    expect(stack).toHaveResource('AWS::DynamoDB::Table',
      {
        KeySchema: [
          { AttributeName: 'hashKey', KeyType: 'HASH' },
          { AttributeName: 'sortKey', KeyType: 'RANGE' },
        ],
        ProvisionedThroughput: { ReadCapacityUnits: 42, WriteCapacityUnits: 1337 },
        AttributeDefinitions: [
          { AttributeName: 'hashKey', AttributeType: 'S' },
          { AttributeName: 'sortKey', AttributeType: 'N' },
        ],
        StreamSpecification: { StreamViewType: 'NEW_IMAGE' },
        TableName: 'MyTable',
      },
    );
  });

  test('can specify old images only', () => {
    new Table(stack, CONSTRUCT_NAME, {
      tableName: TABLE_NAME,
      readCapacity: 42,
      writeCapacity: 1337,
      stream: StreamViewType.OLD_IMAGE,
      partitionKey: TABLE_PARTITION_KEY,
      sortKey: TABLE_SORT_KEY,
    });

    expect(stack).toHaveResource('AWS::DynamoDB::Table',
      {
        KeySchema: [
          { AttributeName: 'hashKey', KeyType: 'HASH' },
          { AttributeName: 'sortKey', KeyType: 'RANGE' },
        ],
        ProvisionedThroughput: { ReadCapacityUnits: 42, WriteCapacityUnits: 1337 },
        AttributeDefinitions: [
          { AttributeName: 'hashKey', AttributeType: 'S' },
          { AttributeName: 'sortKey', AttributeType: 'N' },
        ],
        StreamSpecification: { StreamViewType: 'OLD_IMAGE' },
        TableName: 'MyTable',
      },
    );
  });

  test('can use PhysicalName.GENERATE_IF_NEEDED as the Table name', () => {
    new Table(stack, CONSTRUCT_NAME, {
      tableName: PhysicalName.GENERATE_IF_NEEDED,
      partitionKey: TABLE_PARTITION_KEY,
    });

    // since the resource has not been used in a cross-environment manner,
    // so the name should not be filled
    expect(stack).toHaveResourceLike('AWS::DynamoDB::Table', {
      TableName: ABSENT,
    });
  });
});

test('when specifying every property', () => {
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, {
    tableName: TABLE_NAME,
    readCapacity: 42,
    writeCapacity: 1337,
    pointInTimeRecovery: true,
    serverSideEncryption: true,
    billingMode: BillingMode.PROVISIONED,
    stream: StreamViewType.KEYS_ONLY,
    timeToLiveAttribute: 'timeToLive',
    partitionKey: TABLE_PARTITION_KEY,
    sortKey: TABLE_SORT_KEY,
  });
  Tags.of(table).add('Environment', 'Production');

  expect(stack).toHaveResource('AWS::DynamoDB::Table',
    {
      AttributeDefinitions: [
        { AttributeName: 'hashKey', AttributeType: 'S' },
        { AttributeName: 'sortKey', AttributeType: 'N' },
      ],
      KeySchema: [
        { AttributeName: 'hashKey', KeyType: 'HASH' },
        { AttributeName: 'sortKey', KeyType: 'RANGE' },
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 42,
        WriteCapacityUnits: 1337,
      },
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
      SSESpecification: { SSEEnabled: true },
      StreamSpecification: { StreamViewType: 'KEYS_ONLY' },
      TableName: 'MyTable',
      Tags: [{ Key: 'Environment', Value: 'Production' }],
    },
  );
  expect(stack).toHaveResource('Custom::DynamoDBTimeToLive', {
    TableName: {
      Ref: 'MyTable794EDED1',
    },
    TimeToLiveAttribute: 'timeToLive',
  });
});

test('when specifying sse with customer managed CMK', () => {
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, {
    tableName: TABLE_NAME,
    encryption: TableEncryption.CUSTOMER_MANAGED,
    partitionKey: TABLE_PARTITION_KEY,
  });
  Tags.of(table).add('Environment', 'Production');

  expect(stack).toHaveResource('AWS::DynamoDB::Table', {
    'SSESpecification': {
      'KMSMasterKeyId': {
        'Fn::GetAtt': [
          'MyTableKey8597C7A6',
          'Arn',
        ],
      },
      'SSEEnabled': true,
      'SSEType': 'KMS',
    },
  });
});

test('when specifying only encryptionKey', () => {
  const stack = new Stack();
  const encryptionKey = new kms.Key(stack, 'Key', {
    enableKeyRotation: true,
  });
  const table = new Table(stack, CONSTRUCT_NAME, {
    tableName: TABLE_NAME,
    encryptionKey,
    partitionKey: TABLE_PARTITION_KEY,
  });
  Tags.of(table).add('Environment', 'Production');

  expect(stack).toHaveResource('AWS::DynamoDB::Table', {
    'SSESpecification': {
      'KMSMasterKeyId': {
        'Fn::GetAtt': [
          'Key961B73FD',
          'Arn',
        ],
      },
      'SSEEnabled': true,
      'SSEType': 'KMS',
    },
  });
});

test('when specifying sse with customer managed CMK with encryptionKey provided by user', () => {
  const stack = new Stack();
  const encryptionKey = new kms.Key(stack, 'Key', {
    enableKeyRotation: true,
  });
  const table = new Table(stack, CONSTRUCT_NAME, {
    tableName: TABLE_NAME,
    encryption: TableEncryption.CUSTOMER_MANAGED,
    encryptionKey,
    partitionKey: TABLE_PARTITION_KEY,
  });
  Tags.of(table).add('Environment', 'Production');

  expect(stack).toHaveResource('AWS::DynamoDB::Table', {
    'SSESpecification': {
      'KMSMasterKeyId': {
        'Fn::GetAtt': [
          'Key961B73FD',
          'Arn',
        ],
      },
      'SSEEnabled': true,
      'SSEType': 'KMS',
    },
  });
});

test('fails if encryption key is used with AWS managed CMK', () => {
  const stack = new Stack();
  const encryptionKey = new kms.Key(stack, 'Key', {
    enableKeyRotation: true,
  });
  expect(() => new Table(stack, 'Table A', {
    tableName: TABLE_NAME,
    partitionKey: TABLE_PARTITION_KEY,
    encryption: TableEncryption.AWS_MANAGED,
    encryptionKey,
  })).toThrow('`encryptionKey cannot be specified unless encryption is set to TableEncryption.CUSTOMER_MANAGED (it was set to ${encryptionType})`');
});

test('fails if encryption key is used with default encryption', () => {
  const stack = new Stack();
  const encryptionKey = new kms.Key(stack, 'Key', {
    enableKeyRotation: true,
  });
  expect(() => new Table(stack, 'Table A', {
    tableName: TABLE_NAME,
    partitionKey: TABLE_PARTITION_KEY,
    encryption: TableEncryption.DEFAULT,
    encryptionKey,
  })).toThrow('`encryptionKey cannot be specified unless encryption is set to TableEncryption.CUSTOMER_MANAGED (it was set to ${encryptionType})`');
});

test('fails if encryption key is used with serverSideEncryption', () => {
  const stack = new Stack();
  const encryptionKey = new kms.Key(stack, 'Key', {
    enableKeyRotation: true,
  });
  expect(() => new Table(stack, 'Table A', {
    tableName: TABLE_NAME,
    partitionKey: TABLE_PARTITION_KEY,
    serverSideEncryption: true,
    encryptionKey,
  })).toThrow(/encryptionKey cannot be specified when serverSideEncryption is specified. Use encryption instead/);
});

test('fails if both encryption and serverSideEncryption is specified', () => {
  const stack = new Stack();
  expect(() => new Table(stack, 'Table A', {
    tableName: TABLE_NAME,
    partitionKey: TABLE_PARTITION_KEY,
    encryption: TableEncryption.DEFAULT,
    serverSideEncryption: true,
  })).toThrow(/Only one of encryption and serverSideEncryption can be specified, but both were provided/);
});

test('fails if both replication regions used with customer managed CMK', () => {
  const stack = new Stack();
  expect(() => new Table(stack, 'Table A', {
    tableName: TABLE_NAME,
    partitionKey: TABLE_PARTITION_KEY,
    replicationRegions: ['us-east-1', 'us-east-2', 'us-west-2'],
    encryption: TableEncryption.CUSTOMER_MANAGED,
  })).toThrow('TableEncryption.CUSTOMER_MANAGED is not supported by DynamoDB Global Tables (where replicationRegions was set)');
});

// this behaviour is only applicable without the future flag 'aws-kms:defaultKeyPolicies'
// see subsequent test for the updated behaviour
testLegacyBehavior('if an encryption key is included, encrypt/decrypt permissions are also added both ways', App, (app) => {
  const stack = new Stack(app);
  const table = new Table(stack, 'Table A', {
    tableName: TABLE_NAME,
    partitionKey: TABLE_PARTITION_KEY,
    encryption: TableEncryption.CUSTOMER_MANAGED,
  });
  const user = new iam.User(stack, 'MyUser');
  table.grantReadWriteData(user);
  expect(stack).toMatchTemplate({
    'Resources': {
      'TableAKey07CC09EC': {
        'Type': 'AWS::KMS::Key',
        'Properties': {
          'KeyPolicy': {
            'Statement': [
              {
                'Action': [
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
                'Effect': 'Allow',
                'Principal': {
                  'AWS': {
                    'Fn::Join': [
                      '',
                      [
                        'arn:',
                        {
                          'Ref': 'AWS::Partition',
                        },
                        ':iam::',
                        {
                          'Ref': 'AWS::AccountId',
                        },
                        ':root',
                      ],
                    ],
                  },
                },
                'Resource': '*',
              },
              {
                'Action': [
                  'kms:Decrypt',
                  'kms:DescribeKey',
                  'kms:Encrypt',
                  'kms:ReEncrypt*',
                  'kms:GenerateDataKey*',
                ],
                'Effect': 'Allow',
                'Principal': {
                  'AWS': {
                    'Fn::GetAtt': [
                      'MyUserDC45028B',
                      'Arn',
                    ],
                  },
                },
                'Resource': '*',
              },
            ],
            'Version': '2012-10-17',
          },
          'Description': 'Customer-managed key auto-created for encrypting DynamoDB table at Default/Table A',
          'EnableKeyRotation': true,
        },
        'UpdateReplacePolicy': 'Retain',
        'DeletionPolicy': 'Retain',
      },
      'TableA3D7B5AFA': {
        'Type': 'AWS::DynamoDB::Table',
        'Properties': {
          'KeySchema': [
            {
              'AttributeName': 'hashKey',
              'KeyType': 'HASH',
            },
          ],
          'AttributeDefinitions': [
            {
              'AttributeName': 'hashKey',
              'AttributeType': 'S',
            },
          ],
          'ProvisionedThroughput': {
            'ReadCapacityUnits': 5,
            'WriteCapacityUnits': 5,
          },
          'SSESpecification': {
            'KMSMasterKeyId': {
              'Fn::GetAtt': [
                'TableAKey07CC09EC',
                'Arn',
              ],
            },
            'SSEEnabled': true,
            'SSEType': 'KMS',
          },
          'TableName': 'MyTable',
        },
        'UpdateReplacePolicy': 'Retain',
        'DeletionPolicy': 'Retain',
      },
      'MyUserDC45028B': {
        'Type': 'AWS::IAM::User',
      },
      'MyUserDefaultPolicy7B897426': {
        'Type': 'AWS::IAM::Policy',
        'Properties': {
          'PolicyDocument': {
            'Statement': [
              {
                'Action': [
                  'dynamodb:BatchGetItem',
                  'dynamodb:GetRecords',
                  'dynamodb:GetShardIterator',
                  'dynamodb:Query',
                  'dynamodb:GetItem',
                  'dynamodb:Scan',
                  'dynamodb:ConditionCheckItem',
                  'dynamodb:BatchWriteItem',
                  'dynamodb:PutItem',
                  'dynamodb:UpdateItem',
                  'dynamodb:DeleteItem',
                ],
                'Effect': 'Allow',
                'Resource': [
                  {
                    'Fn::GetAtt': [
                      'TableA3D7B5AFA',
                      'Arn',
                    ],
                  },
                  {
                    'Ref': 'AWS::NoValue',
                  },
                ],
              },
              {
                'Action': [
                  'kms:Decrypt',
                  'kms:DescribeKey',
                  'kms:Encrypt',
                  'kms:ReEncrypt*',
                  'kms:GenerateDataKey*',
                ],
                'Effect': 'Allow',
                'Resource': {
                  'Fn::GetAtt': [
                    'TableAKey07CC09EC',
                    'Arn',
                  ],
                },
              },
            ],
            'Version': '2012-10-17',
          },
          'PolicyName': 'MyUserDefaultPolicy7B897426',
          'Users': [
            {
              'Ref': 'MyUserDC45028B',
            },
          ],
        },
      },
    },
  });
});

test('if an encryption key is included, encrypt/decrypt permissions are added to the principal', () => {
  const stack = new Stack();
  const table = new Table(stack, 'Table A', {
    tableName: TABLE_NAME,
    partitionKey: TABLE_PARTITION_KEY,
    encryption: TableEncryption.CUSTOMER_MANAGED,
  });
  const user = new iam.User(stack, 'MyUser');
  table.grantReadWriteData(user);

  expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
    'PolicyDocument': {
      'Statement': arrayWith({
        'Action': [
          'kms:Decrypt',
          'kms:DescribeKey',
          'kms:Encrypt',
          'kms:ReEncrypt*',
          'kms:GenerateDataKey*',
        ],
        'Effect': 'Allow',
        'Resource': {
          'Fn::GetAtt': [
            'TableAKey07CC09EC',
            'Arn',
          ],
        },
      }),
    },
  });
});

test('when specifying PAY_PER_REQUEST billing mode', () => {
  const stack = new Stack();
  new Table(stack, CONSTRUCT_NAME, {
    tableName: TABLE_NAME,
    billingMode: BillingMode.PAY_PER_REQUEST,
    partitionKey: TABLE_PARTITION_KEY,
  });

  expect(stack).toHaveResource('AWS::DynamoDB::Table',
    {
      KeySchema: [
        { AttributeName: 'hashKey', KeyType: 'HASH' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'hashKey', AttributeType: 'S' },
      ],
      TableName: 'MyTable',
    },
  );
});

describe('when billing mode is PAY_PER_REQUEST', () => {
  let stack: Stack;

  beforeEach(() => {
    stack = new Stack();
  });

  test('creating the Table fails when readCapacity is specified', () => {
    expect(() => new Table(stack, 'Table A', {
      tableName: TABLE_NAME,
      partitionKey: TABLE_PARTITION_KEY,
      billingMode: BillingMode.PAY_PER_REQUEST,
      readCapacity: 1,
    })).toThrow(/PAY_PER_REQUEST/);
  });

  test('creating the Table fails when writeCapacity is specified', () => {
    expect(() => new Table(stack, 'Table B', {
      tableName: TABLE_NAME,
      partitionKey: TABLE_PARTITION_KEY,
      billingMode: BillingMode.PAY_PER_REQUEST,
      writeCapacity: 1,
    })).toThrow(/PAY_PER_REQUEST/);
  });

  test('creating the Table fails when both readCapacity and writeCapacity are specified', () => {
    expect(() => new Table(stack, 'Table C', {
      tableName: TABLE_NAME,
      partitionKey: TABLE_PARTITION_KEY,
      billingMode: BillingMode.PAY_PER_REQUEST,
      readCapacity: 1,
      writeCapacity: 1,
    })).toThrow(/PAY_PER_REQUEST/);
  });
});

test('when adding a global secondary index with hash key only', () => {
  const stack = new Stack();

  const table = new Table(stack, CONSTRUCT_NAME, {
    partitionKey: TABLE_PARTITION_KEY,
    sortKey: TABLE_SORT_KEY,
  });

  table.addGlobalSecondaryIndex({
    indexName: GSI_NAME,
    partitionKey: GSI_PARTITION_KEY,
    readCapacity: 42,
    writeCapacity: 1337,
  });

  expect(stack).toHaveResource('AWS::DynamoDB::Table',
    {
      AttributeDefinitions: [
        { AttributeName: 'hashKey', AttributeType: 'S' },
        { AttributeName: 'sortKey', AttributeType: 'N' },
        { AttributeName: 'gsiHashKey', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'hashKey', KeyType: 'HASH' },
        { AttributeName: 'sortKey', KeyType: 'RANGE' },
      ],
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      GlobalSecondaryIndexes: [
        {
          IndexName: 'MyGSI',
          KeySchema: [
            { AttributeName: 'gsiHashKey', KeyType: 'HASH' },
          ],
          Projection: { ProjectionType: 'ALL' },
          ProvisionedThroughput: { ReadCapacityUnits: 42, WriteCapacityUnits: 1337 },
        },
      ],
    },
  );
});

test('when adding a global secondary index with hash + range key', () => {
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, {
    partitionKey: TABLE_PARTITION_KEY,
    sortKey: TABLE_SORT_KEY,
  });

  table.addGlobalSecondaryIndex({
    indexName: GSI_NAME,
    partitionKey: GSI_PARTITION_KEY,
    sortKey: GSI_SORT_KEY,
    projectionType: ProjectionType.ALL,
    readCapacity: 42,
    writeCapacity: 1337,
  });

  expect(stack).toHaveResource('AWS::DynamoDB::Table',
    {
      AttributeDefinitions: [
        { AttributeName: 'hashKey', AttributeType: 'S' },
        { AttributeName: 'sortKey', AttributeType: 'N' },
        { AttributeName: 'gsiHashKey', AttributeType: 'S' },
        { AttributeName: 'gsiSortKey', AttributeType: 'B' },
      ],
      KeySchema: [
        { AttributeName: 'hashKey', KeyType: 'HASH' },
        { AttributeName: 'sortKey', KeyType: 'RANGE' },
      ],
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      GlobalSecondaryIndexes: [
        {
          IndexName: 'MyGSI',
          KeySchema: [
            { AttributeName: 'gsiHashKey', KeyType: 'HASH' },
            { AttributeName: 'gsiSortKey', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
          ProvisionedThroughput: { ReadCapacityUnits: 42, WriteCapacityUnits: 1337 },
        },
      ],
    },
  );
});

test('when adding a global secondary index with projection type KEYS_ONLY', () => {
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, {
    partitionKey: TABLE_PARTITION_KEY,
    sortKey: TABLE_SORT_KEY,
  });

  table.addGlobalSecondaryIndex({
    indexName: GSI_NAME,
    partitionKey: GSI_PARTITION_KEY,
    sortKey: GSI_SORT_KEY,
    projectionType: ProjectionType.KEYS_ONLY,
  });

  expect(stack).toHaveResource('AWS::DynamoDB::Table',
    {
      AttributeDefinitions: [
        { AttributeName: 'hashKey', AttributeType: 'S' },
        { AttributeName: 'sortKey', AttributeType: 'N' },
        { AttributeName: 'gsiHashKey', AttributeType: 'S' },
        { AttributeName: 'gsiSortKey', AttributeType: 'B' },
      ],
      KeySchema: [
        { AttributeName: 'hashKey', KeyType: 'HASH' },
        { AttributeName: 'sortKey', KeyType: 'RANGE' },
      ],
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      GlobalSecondaryIndexes: [
        {
          IndexName: 'MyGSI',
          KeySchema: [
            { AttributeName: 'gsiHashKey', KeyType: 'HASH' },
            { AttributeName: 'gsiSortKey', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'KEYS_ONLY' },
          ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
        },
      ],
    },
  );
});

test('when adding a global secondary index with projection type INCLUDE', () => {
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, { partitionKey: TABLE_PARTITION_KEY, sortKey: TABLE_SORT_KEY });
  const gsiNonKeyAttributeGenerator = NON_KEY_ATTRIBUTE_GENERATOR(GSI_NON_KEY);
  table.addGlobalSecondaryIndex({
    indexName: GSI_NAME,
    partitionKey: GSI_PARTITION_KEY,
    sortKey: GSI_SORT_KEY,
    projectionType: ProjectionType.INCLUDE,
    nonKeyAttributes: [gsiNonKeyAttributeGenerator.next().value, gsiNonKeyAttributeGenerator.next().value],
    readCapacity: 42,
    writeCapacity: 1337,
  });

  expect(stack).toHaveResource('AWS::DynamoDB::Table',
    {
      AttributeDefinitions: [
        { AttributeName: 'hashKey', AttributeType: 'S' },
        { AttributeName: 'sortKey', AttributeType: 'N' },
        { AttributeName: 'gsiHashKey', AttributeType: 'S' },
        { AttributeName: 'gsiSortKey', AttributeType: 'B' },
      ],
      KeySchema: [
        { AttributeName: 'hashKey', KeyType: 'HASH' },
        { AttributeName: 'sortKey', KeyType: 'RANGE' },
      ],
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      GlobalSecondaryIndexes: [
        {
          IndexName: 'MyGSI',
          KeySchema: [
            { AttributeName: 'gsiHashKey', KeyType: 'HASH' },
            { AttributeName: 'gsiSortKey', KeyType: 'RANGE' },
          ],
          Projection: { NonKeyAttributes: ['gsiNonKey0', 'gsiNonKey1'], ProjectionType: 'INCLUDE' },
          ProvisionedThroughput: { ReadCapacityUnits: 42, WriteCapacityUnits: 1337 },
        },
      ],
    },
  );
});

test('when adding a global secondary index on a table with PAY_PER_REQUEST billing mode', () => {
  const stack = new Stack();
  new Table(stack, CONSTRUCT_NAME, {
    billingMode: BillingMode.PAY_PER_REQUEST,
    partitionKey: TABLE_PARTITION_KEY,
    sortKey: TABLE_SORT_KEY,
  }).addGlobalSecondaryIndex({
    indexName: GSI_NAME,
    partitionKey: GSI_PARTITION_KEY,
  });

  expect(stack).toHaveResource('AWS::DynamoDB::Table',
    {
      AttributeDefinitions: [
        { AttributeName: 'hashKey', AttributeType: 'S' },
        { AttributeName: 'sortKey', AttributeType: 'N' },
        { AttributeName: 'gsiHashKey', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [
        { AttributeName: 'hashKey', KeyType: 'HASH' },
        { AttributeName: 'sortKey', KeyType: 'RANGE' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'MyGSI',
          KeySchema: [
            { AttributeName: 'gsiHashKey', KeyType: 'HASH' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    },
  );
});

test('error when adding a global secondary index with projection type INCLUDE, but without specifying non-key attributes', () => {
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, { partitionKey: TABLE_PARTITION_KEY, sortKey: TABLE_SORT_KEY });
  expect(() => table.addGlobalSecondaryIndex({
    indexName: GSI_NAME,
    partitionKey: GSI_PARTITION_KEY,
    sortKey: GSI_SORT_KEY,
    projectionType: ProjectionType.INCLUDE,
  })).toThrow(/non-key attributes should be specified when using INCLUDE projection type/);
});

test('error when adding a global secondary index with projection type ALL, but with non-key attributes', () => {
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, { partitionKey: TABLE_PARTITION_KEY, sortKey: TABLE_SORT_KEY });
  const gsiNonKeyAttributeGenerator = NON_KEY_ATTRIBUTE_GENERATOR(GSI_NON_KEY);

  expect(() => table.addGlobalSecondaryIndex({
    indexName: GSI_NAME,
    partitionKey: GSI_PARTITION_KEY,
    nonKeyAttributes: [gsiNonKeyAttributeGenerator.next().value],
  })).toThrow(/non-key attributes should not be specified when not using INCLUDE projection type/);
});

test('error when adding a global secondary index with projection type KEYS_ONLY, but with non-key attributes', () => {
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, { partitionKey: TABLE_PARTITION_KEY, sortKey: TABLE_SORT_KEY });
  const gsiNonKeyAttributeGenerator = NON_KEY_ATTRIBUTE_GENERATOR(GSI_NON_KEY);

  expect(() => table.addGlobalSecondaryIndex({
    indexName: GSI_NAME,
    partitionKey: GSI_PARTITION_KEY,
    projectionType: ProjectionType.KEYS_ONLY,
    nonKeyAttributes: [gsiNonKeyAttributeGenerator.next().value],
  })).toThrow(/non-key attributes should not be specified when not using INCLUDE projection type/);
});

test('error when adding a global secondary index with projection type INCLUDE, but with more than 100 non-key attributes', () => {
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, { partitionKey: TABLE_PARTITION_KEY, sortKey: TABLE_SORT_KEY });
  const gsiNonKeyAttributeGenerator = NON_KEY_ATTRIBUTE_GENERATOR(GSI_NON_KEY);
  const gsiNonKeyAttributes: string[] = [];
  for (let i = 0; i < 101; i++) {
    gsiNonKeyAttributes.push(gsiNonKeyAttributeGenerator.next().value);
  }

  expect(() => table.addGlobalSecondaryIndex({
    indexName: GSI_NAME,
    partitionKey: GSI_PARTITION_KEY,
    sortKey: GSI_SORT_KEY,
    projectionType: ProjectionType.INCLUDE,
    nonKeyAttributes: gsiNonKeyAttributes,
  })).toThrow(/a maximum number of nonKeyAttributes across all of secondary indexes is 100/);
});

test('error when adding a global secondary index with read or write capacity on a PAY_PER_REQUEST table', () => {
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, {
    partitionKey: TABLE_PARTITION_KEY,
    billingMode: BillingMode.PAY_PER_REQUEST,
  });

  expect(() => table.addGlobalSecondaryIndex({
    indexName: GSI_NAME,
    partitionKey: GSI_PARTITION_KEY,
    sortKey: GSI_SORT_KEY,
    readCapacity: 1,
  })).toThrow(/PAY_PER_REQUEST/);
  expect(() => table.addGlobalSecondaryIndex({
    indexName: GSI_NAME,
    partitionKey: GSI_PARTITION_KEY,
    sortKey: GSI_SORT_KEY,
    writeCapacity: 1,
  })).toThrow(/PAY_PER_REQUEST/);
  expect(() => table.addGlobalSecondaryIndex({
    indexName: GSI_NAME,
    partitionKey: GSI_PARTITION_KEY,
    sortKey: GSI_SORT_KEY,
    readCapacity: 1,
    writeCapacity: 1,
  })).toThrow(/PAY_PER_REQUEST/);
});

test('when adding multiple global secondary indexes', () => {
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, { partitionKey: TABLE_PARTITION_KEY, sortKey: TABLE_SORT_KEY });
  const gsiGenerator = GSI_GENERATOR();
  for (let i = 0; i < 5; i++) {
    table.addGlobalSecondaryIndex(gsiGenerator.next().value);
  }

  expect(stack).toHaveResource('AWS::DynamoDB::Table',
    {
      AttributeDefinitions: [
        { AttributeName: 'hashKey', AttributeType: 'S' },
        { AttributeName: 'sortKey', AttributeType: 'N' },
        { AttributeName: 'gsiHashKey0', AttributeType: 'S' },
        { AttributeName: 'gsiHashKey1', AttributeType: 'S' },
        { AttributeName: 'gsiHashKey2', AttributeType: 'S' },
        { AttributeName: 'gsiHashKey3', AttributeType: 'S' },
        { AttributeName: 'gsiHashKey4', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'hashKey', KeyType: 'HASH' },
        { AttributeName: 'sortKey', KeyType: 'RANGE' },
      ],
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      GlobalSecondaryIndexes: [
        {
          IndexName: 'MyGSI0',
          KeySchema: [
            { AttributeName: 'gsiHashKey0', KeyType: 'HASH' },
          ],
          Projection: { ProjectionType: 'ALL' },
          ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
        },
        {
          IndexName: 'MyGSI1',
          KeySchema: [
            { AttributeName: 'gsiHashKey1', KeyType: 'HASH' },
          ],
          Projection: { ProjectionType: 'ALL' },
          ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
        },
        {
          IndexName: 'MyGSI2',
          KeySchema: [
            { AttributeName: 'gsiHashKey2', KeyType: 'HASH' },
          ],
          Projection: { ProjectionType: 'ALL' },
          ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
        },
        {
          IndexName: 'MyGSI3',
          KeySchema: [
            { AttributeName: 'gsiHashKey3', KeyType: 'HASH' },
          ],
          Projection: { ProjectionType: 'ALL' },
          ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
        },
        {
          IndexName: 'MyGSI4',
          KeySchema: [
            { AttributeName: 'gsiHashKey4', KeyType: 'HASH' },
          ],
          Projection: { ProjectionType: 'ALL' },
          ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
        },
      ],
    },
  );
});

test('when adding a global secondary index without specifying read and write capacity', () => {
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, { partitionKey: TABLE_PARTITION_KEY, sortKey: TABLE_SORT_KEY });

  table.addGlobalSecondaryIndex({
    indexName: GSI_NAME,
    partitionKey: GSI_PARTITION_KEY,
  });

  expect(stack).toHaveResource('AWS::DynamoDB::Table',
    {
      AttributeDefinitions: [
        { AttributeName: 'hashKey', AttributeType: 'S' },
        { AttributeName: 'sortKey', AttributeType: 'N' },
        { AttributeName: 'gsiHashKey', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'hashKey', KeyType: 'HASH' },
        { AttributeName: 'sortKey', KeyType: 'RANGE' },
      ],
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      GlobalSecondaryIndexes: [
        {
          IndexName: 'MyGSI',
          KeySchema: [
            { AttributeName: 'gsiHashKey', KeyType: 'HASH' },
          ],
          Projection: { ProjectionType: 'ALL' },
          ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
        },
      ],
    },
  );
});

test('when adding a local secondary index with hash + range key', () => {
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, { partitionKey: TABLE_PARTITION_KEY, sortKey: TABLE_SORT_KEY });

  table.addLocalSecondaryIndex({
    indexName: LSI_NAME,
    sortKey: LSI_SORT_KEY,
  });

  expect(stack).toHaveResource('AWS::DynamoDB::Table',
    {
      AttributeDefinitions: [
        { AttributeName: 'hashKey', AttributeType: 'S' },
        { AttributeName: 'sortKey', AttributeType: 'N' },
        { AttributeName: 'lsiSortKey', AttributeType: 'N' },
      ],
      KeySchema: [
        { AttributeName: 'hashKey', KeyType: 'HASH' },
        { AttributeName: 'sortKey', KeyType: 'RANGE' },
      ],
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      LocalSecondaryIndexes: [
        {
          IndexName: 'MyLSI',
          KeySchema: [
            { AttributeName: 'hashKey', KeyType: 'HASH' },
            { AttributeName: 'lsiSortKey', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    },
  );
});

test('when adding a local secondary index with projection type KEYS_ONLY', () => {
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, { partitionKey: TABLE_PARTITION_KEY, sortKey: TABLE_SORT_KEY });
  table.addLocalSecondaryIndex({
    indexName: LSI_NAME,
    sortKey: LSI_SORT_KEY,
    projectionType: ProjectionType.KEYS_ONLY,
  });

  expect(stack).toHaveResource('AWS::DynamoDB::Table',
    {
      AttributeDefinitions: [
        { AttributeName: 'hashKey', AttributeType: 'S' },
        { AttributeName: 'sortKey', AttributeType: 'N' },
        { AttributeName: 'lsiSortKey', AttributeType: 'N' },
      ],
      KeySchema: [
        { AttributeName: 'hashKey', KeyType: 'HASH' },
        { AttributeName: 'sortKey', KeyType: 'RANGE' },
      ],
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      LocalSecondaryIndexes: [
        {
          IndexName: 'MyLSI',
          KeySchema: [
            { AttributeName: 'hashKey', KeyType: 'HASH' },
            { AttributeName: 'lsiSortKey', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'KEYS_ONLY' },
        },
      ],
    },
  );
});

test('when adding a local secondary index with projection type INCLUDE', () => {
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, { partitionKey: TABLE_PARTITION_KEY, sortKey: TABLE_SORT_KEY });
  const lsiNonKeyAttributeGenerator = NON_KEY_ATTRIBUTE_GENERATOR(LSI_NON_KEY);
  table.addLocalSecondaryIndex({
    indexName: LSI_NAME,
    sortKey: LSI_SORT_KEY,
    projectionType: ProjectionType.INCLUDE,
    nonKeyAttributes: [lsiNonKeyAttributeGenerator.next().value, lsiNonKeyAttributeGenerator.next().value],
  });

  expect(stack).toHaveResource('AWS::DynamoDB::Table',
    {
      AttributeDefinitions: [
        { AttributeName: 'hashKey', AttributeType: 'S' },
        { AttributeName: 'sortKey', AttributeType: 'N' },
        { AttributeName: 'lsiSortKey', AttributeType: 'N' },
      ],
      KeySchema: [
        { AttributeName: 'hashKey', KeyType: 'HASH' },
        { AttributeName: 'sortKey', KeyType: 'RANGE' },
      ],
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      LocalSecondaryIndexes: [
        {
          IndexName: 'MyLSI',
          KeySchema: [
            { AttributeName: 'hashKey', KeyType: 'HASH' },
            { AttributeName: 'lsiSortKey', KeyType: 'RANGE' },
          ],
          Projection: { NonKeyAttributes: ['lsiNonKey0', 'lsiNonKey1'], ProjectionType: 'INCLUDE' },
        },
      ],
    },
  );
});

test('error when adding more than 5 local secondary indexes', () => {
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, { partitionKey: TABLE_PARTITION_KEY, sortKey: TABLE_SORT_KEY });
  const lsiGenerator = LSI_GENERATOR();
  for (let i = 0; i < 5; i++) {
    table.addLocalSecondaryIndex(lsiGenerator.next().value);
  }

  expect(() => table.addLocalSecondaryIndex(lsiGenerator.next().value))
    .toThrow(/a maximum number of local secondary index per table is 5/);

});

test('error when adding a local secondary index with the name of a global secondary index', () => {
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, { partitionKey: TABLE_PARTITION_KEY, sortKey: TABLE_SORT_KEY });
  table.addGlobalSecondaryIndex({
    indexName: 'SecondaryIndex',
    partitionKey: GSI_PARTITION_KEY,
  });

  expect(() => table.addLocalSecondaryIndex({
    indexName: 'SecondaryIndex',
    sortKey: LSI_SORT_KEY,
  })).toThrow(/a duplicate index name, SecondaryIndex, is not allowed/);
});

test('error when validating construct if a local secondary index exists without a sort key of the table', () => {
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, { partitionKey: TABLE_PARTITION_KEY });

  table.addLocalSecondaryIndex({
    indexName: LSI_NAME,
    sortKey: LSI_SORT_KEY,
  });

  const errors = ConstructNode.validate(table.node);

  expect(errors.length).toBe(1);
  expect(errors[0]?.message).toBe('a sort key of the table must be specified to add local secondary indexes');
});

test('can enable Read AutoScaling', () => {
  // GIVEN
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, { readCapacity: 42, writeCapacity: 1337, partitionKey: TABLE_PARTITION_KEY });

  // WHEN
  table.autoScaleReadCapacity({ minCapacity: 50, maxCapacity: 500 }).scaleOnUtilization({ targetUtilizationPercent: 75 });

  // THEN
  expect(stack).toHaveResource('AWS::ApplicationAutoScaling::ScalableTarget', {
    MaxCapacity: 500,
    MinCapacity: 50,
    ScalableDimension: 'dynamodb:table:ReadCapacityUnits',
    ServiceNamespace: 'dynamodb',
  });
  expect(stack).toHaveResource('AWS::ApplicationAutoScaling::ScalingPolicy', {
    PolicyType: 'TargetTrackingScaling',
    TargetTrackingScalingPolicyConfiguration: {
      PredefinedMetricSpecification: { PredefinedMetricType: 'DynamoDBReadCapacityUtilization' },
      TargetValue: 75,
    },
  });
});

test('can enable Write AutoScaling', () => {
  // GIVEN
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, { readCapacity: 42, writeCapacity: 1337, partitionKey: TABLE_PARTITION_KEY });

  // WHEN
  table.autoScaleWriteCapacity({ minCapacity: 50, maxCapacity: 500 }).scaleOnUtilization({ targetUtilizationPercent: 75 });

  // THEN
  expect(stack).toHaveResource('AWS::ApplicationAutoScaling::ScalableTarget', {
    MaxCapacity: 500,
    MinCapacity: 50,
    ScalableDimension: 'dynamodb:table:WriteCapacityUnits',
    ServiceNamespace: 'dynamodb',
  });
  expect(stack).toHaveResource('AWS::ApplicationAutoScaling::ScalingPolicy', {
    PolicyType: 'TargetTrackingScaling',
    TargetTrackingScalingPolicyConfiguration: {
      PredefinedMetricSpecification: { PredefinedMetricType: 'DynamoDBWriteCapacityUtilization' },
      TargetValue: 75,
    },
  });
});

test('cannot enable AutoScaling twice on the same property', () => {
  // GIVEN
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, { readCapacity: 42, writeCapacity: 1337, partitionKey: TABLE_PARTITION_KEY });
  table.autoScaleReadCapacity({ minCapacity: 50, maxCapacity: 500 }).scaleOnUtilization({ targetUtilizationPercent: 75 });

  // WHEN
  expect(() => {
    table.autoScaleReadCapacity({ minCapacity: 50, maxCapacity: 500 });
  }).toThrow(/Read AutoScaling already enabled for this table/);
});

test('error when enabling AutoScaling on the PAY_PER_REQUEST table', () => {
  // GIVEN
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, { billingMode: BillingMode.PAY_PER_REQUEST, partitionKey: TABLE_PARTITION_KEY });
  table.addGlobalSecondaryIndex({
    indexName: GSI_NAME,
    partitionKey: GSI_PARTITION_KEY,
  });

  // WHEN
  expect(() => {
    table.autoScaleReadCapacity({ minCapacity: 50, maxCapacity: 500 });
  }).toThrow(/PAY_PER_REQUEST/);
  expect(() => {
    table.autoScaleWriteCapacity({ minCapacity: 50, maxCapacity: 500 });
  }).toThrow(/PAY_PER_REQUEST/);
  expect(() => table.autoScaleGlobalSecondaryIndexReadCapacity(GSI_NAME, {
    minCapacity: 1,
    maxCapacity: 5,
  })).toThrow(/PAY_PER_REQUEST/);
});

test('error when specifying Read Auto Scaling with invalid scalingTargetValue < 10', () => {
  // GIVEN
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, { readCapacity: 42, writeCapacity: 1337, partitionKey: TABLE_PARTITION_KEY });

  // THEN
  expect(() => {
    table.autoScaleReadCapacity({ minCapacity: 50, maxCapacity: 500 }).scaleOnUtilization({ targetUtilizationPercent: 5 });
  }).toThrow(/targetUtilizationPercent for DynamoDB scaling must be between 10 and 90 percent, got: 5/);
});

test('error when specifying Read Auto Scaling with invalid minimumCapacity', () => {
  // GIVEN
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, { readCapacity: 42, writeCapacity: 1337, partitionKey: TABLE_PARTITION_KEY });

  // THEN
  expect(() => table.autoScaleReadCapacity({ minCapacity: 10, maxCapacity: 5 }))
    .toThrow(/minCapacity \(10\) should be lower than maxCapacity \(5\)/);
});

test('can autoscale on a schedule', () => {
  // GIVEN
  const stack = new Stack();
  const table = new Table(stack, CONSTRUCT_NAME, {
    readCapacity: 42,
    writeCapacity: 1337,
    partitionKey: { name: 'Hash', type: AttributeType.STRING },
  });

  // WHEN
  const scaling = table.autoScaleReadCapacity({ minCapacity: 1, maxCapacity: 100 });
  scaling.scaleOnSchedule('SaveMoneyByNotScalingUp', {
    schedule: appscaling.Schedule.cron({}),
    maxCapacity: 10,
  });

  // THEN
  expect(stack).toHaveResource('AWS::ApplicationAutoScaling::ScalableTarget', {
    ScheduledActions: [
      {
        ScalableTargetAction: { 'MaxCapacity': 10 },
        Schedule: 'cron(* * * * ? *)',
        ScheduledActionName: 'SaveMoneyByNotScalingUp',
      },
    ],
  });
});

describe('metrics', () => {
  test('Can use metricConsumedReadCapacityUnits on a Dynamodb Table', () => {
    // GIVEN
    const stack = new Stack();
    const table = new Table(stack, 'Table', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
    });

    // THEN
    expect(stack.resolve(table.metricConsumedReadCapacityUnits())).toEqual({
      period: Duration.minutes(5),
      dimensions: { TableName: { Ref: 'TableCD117FA1' } },
      namespace: 'AWS/DynamoDB',
      metricName: 'ConsumedReadCapacityUnits',
      statistic: 'Sum',
    });
  });

  test('Can use metricConsumedWriteCapacityUnits on a Dynamodb Table', () => {
    // GIVEN
    const stack = new Stack();
    const table = new Table(stack, 'Table', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
    });

    // THEN
    expect(stack.resolve(table.metricConsumedWriteCapacityUnits())).toEqual({
      period: Duration.minutes(5),
      dimensions: { TableName: { Ref: 'TableCD117FA1' } },
      namespace: 'AWS/DynamoDB',
      metricName: 'ConsumedWriteCapacityUnits',
      statistic: 'Sum',
    });
  });

  test('Using metricSystemErrorsForOperations with no operations will default to all', () => {

    const stack = new Stack();
    const table = new Table(stack, 'Table', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
    });

    expect(Object.keys(table.metricSystemErrorsForOperations().toMetricConfig().mathExpression!.usingMetrics)).toEqual([
      'getitem',
      'batchgetitem',
      'scan',
      'query',
      'getrecords',
      'putitem',
      'deleteitem',
      'updateitem',
      'batchwriteitem',
    ]);

  });

  test('Can use metricSystemErrors without the TableName dimension', () => {

    const stack = new Stack();
    const table = new Table(stack, 'Table', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
    });

    expect(table.metricSystemErrors({ dimensions: { Operation: 'GetItem' } }).dimensions).toEqual({
      TableName: table.tableName,
      Operation: 'GetItem',
    });

  });

  test('Using metricSystemErrors without the Operation dimension will fail', () => {

    const stack = new Stack();
    const table = new Table(stack, 'Table', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
    });

    expect(() => table.metricSystemErrors({ dimensions: { TableName: table.tableName } }))
      .toThrow(/'Operation' dimension must be passed for the 'SystemErrors' metric./);

  });

  test('Can use metricSystemErrorsForOperations on a Dynamodb Table', () => {

    // GIVEN
    const stack = new Stack();
    const table = new Table(stack, 'Table', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
    });

    // THEN
    expect(stack.resolve(table.metricSystemErrorsForOperations({ operations: [Operation.GET_ITEM, Operation.PUT_ITEM] }))).toEqual({
      expression: 'getitem + putitem',
      label: 'Sum of errors across all operations',
      period: Duration.minutes(5),
      usingMetrics: {
        getitem: {
          dimensions: {
            Operation: 'GetItem',
            TableName: {
              Ref: 'TableCD117FA1',
            },
          },
          metricName: 'SystemErrors',
          namespace: 'AWS/DynamoDB',
          period: Duration.minutes(5),
          statistic: 'Sum',
        },
        putitem: {
          dimensions: {
            Operation: 'PutItem',
            TableName: {
              Ref: 'TableCD117FA1',
            },
          },
          metricName: 'SystemErrors',
          namespace: 'AWS/DynamoDB',
          period: Duration.minutes(5),
          statistic: 'Sum',
        },
      },
    });

  });

  test('Can use metricSystemErrors on a Dynamodb Table', () => {
    // GIVEN
    const stack = new Stack();
    const table = new Table(stack, 'Table', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
    });

    // THEN
    expect(stack.resolve(table.metricSystemErrors({ dimensions: { TableName: table.tableName, Operation: 'GetItem' } }))).toEqual({
      period: Duration.minutes(5),
      dimensions: { TableName: { Ref: 'TableCD117FA1' }, Operation: 'GetItem' },
      namespace: 'AWS/DynamoDB',
      metricName: 'SystemErrors',
      statistic: 'Sum',
    });
  });

  test('Using metricUserErrors with dimensions will fail', () => {
    // GIVEN
    const stack = new Stack();
    const table = new Table(stack, 'Table', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
    });

    expect(() => table.metricUserErrors({ dimensions: { TableName: table.tableName } })).toThrow(/'dimensions' is not supported for the 'UserErrors' metric/);

  });

  test('Can use metricUserErrors on a Dynamodb Table', () => {
    // GIVEN
    const stack = new Stack();
    const table = new Table(stack, 'Table', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
    });

    // THEN
    expect(stack.resolve(table.metricUserErrors())).toEqual({
      period: Duration.minutes(5),
      dimensions: {},
      namespace: 'AWS/DynamoDB',
      metricName: 'UserErrors',
      statistic: 'Sum',
    });
  });

  test('Can use metricConditionalCheckFailedRequests on a Dynamodb Table', () => {
    // GIVEN
    const stack = new Stack();
    const table = new Table(stack, 'Table', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
    });

    // THEN
    expect(stack.resolve(table.metricConditionalCheckFailedRequests())).toEqual({
      period: Duration.minutes(5),
      dimensions: { TableName: { Ref: 'TableCD117FA1' } },
      namespace: 'AWS/DynamoDB',
      metricName: 'ConditionalCheckFailedRequests',
      statistic: 'Sum',
    });
  });

  test('Can use metricSuccessfulRequestLatency without the TableName dimension', () => {

    const stack = new Stack();
    const table = new Table(stack, 'Table', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
    });

    expect(table.metricSuccessfulRequestLatency({ dimensions: { Operation: 'GetItem' } }).dimensions).toEqual({
      TableName: table.tableName,
      Operation: 'GetItem',
    });

  });

  test('Using metricSuccessfulRequestLatency without the Operation dimension will fail', () => {

    const stack = new Stack();
    const table = new Table(stack, 'Table', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
    });

    expect(() => table.metricSuccessfulRequestLatency({ dimensions: { TableName: table.tableName } }))
      .toThrow(/'Operation' dimension must be passed for the 'SuccessfulRequestLatency' metric./);

  });

  test('Can use metricSuccessfulRequestLatency on a Dynamodb Table', () => {
    // GIVEN
    const stack = new Stack();
    const table = new Table(stack, 'Table', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
    });

    // THEN
    expect(stack.resolve(table.metricSuccessfulRequestLatency({
      dimensions: {
        TableName: table.tableName,
        Operation: 'GetItem',
      },
    }))).toEqual({
      period: Duration.minutes(5),
      dimensions: { TableName: { Ref: 'TableCD117FA1' }, Operation: 'GetItem' },
      namespace: 'AWS/DynamoDB',
      metricName: 'SuccessfulRequestLatency',
      statistic: 'Average',
    });
  });
});

describe('grants', () => {

  test('"grant" allows adding arbitrary actions associated with this table resource', () => {
    // GIVEN
    const stack = new Stack();
    const table = new Table(stack, 'my-table', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
    });
    const user = new iam.User(stack, 'user');

    // WHEN
    table.grant(user, 'dynamodb:action1', 'dynamodb:action2');

    // THEN
    expect(stack).toHaveResource('AWS::IAM::Policy', {
      'PolicyDocument': {
        'Statement': [
          {
            'Action': [
              'dynamodb:action1',
              'dynamodb:action2',
            ],
            'Effect': 'Allow',
            'Resource': [
              {
                'Fn::GetAtt': [
                  'mytable0324D45C',
                  'Arn',
                ],
              },
              {
                'Ref': 'AWS::NoValue',
              },
            ],
          },
        ],
        'Version': '2012-10-17',
      },
      'PolicyName': 'userDefaultPolicy083DF682',
      'Users': [
        {
          'Ref': 'user2C2B57AE',
        },
      ],
    });
  });

  test('"grant" allows adding arbitrary actions associated with this table resource (via testGrant)', () => {
    testGrant(
      ['action1', 'action2'], (p, t) => t.grant(p, 'dynamodb:action1', 'dynamodb:action2'));
  });

  test('"grantReadData" allows the principal to read data from the table', () => {
    testGrant(
      ['BatchGetItem', 'GetRecords', 'GetShardIterator', 'Query', 'GetItem', 'Scan', 'ConditionCheckItem'], (p, t) => t.grantReadData(p));
  });

  test('"grantWriteData" allows the principal to write data to the table', () => {
    testGrant(
      ['BatchWriteItem', 'PutItem', 'UpdateItem', 'DeleteItem'], (p, t) => t.grantWriteData(p));
  });

  test('"grantReadWriteData" allows the principal to read/write data', () => {
    testGrant([
      'BatchGetItem', 'GetRecords', 'GetShardIterator', 'Query', 'GetItem', 'Scan',
      'ConditionCheckItem', 'BatchWriteItem', 'PutItem', 'UpdateItem', 'DeleteItem',
    ], (p, t) => t.grantReadWriteData(p));
  });

  test('"grantFullAccess" allows the principal to perform any action on the table ("*")', () => {
    testGrant(['*'], (p, t) => t.grantFullAccess(p));
  });

  test('"Table.grantListStreams" allows principal to list all streams', () => {
    // GIVEN
    const stack = new Stack();
    const user = new iam.User(stack, 'user');

    // WHEN
    Table.grantListStreams(user);

    // THEN
    expect(stack).toHaveResource('AWS::IAM::Policy', {
      'PolicyDocument': {
        'Statement': [
          {
            'Action': 'dynamodb:ListStreams',
            'Effect': 'Allow',
            'Resource': '*',
          },
        ],
        'Version': '2012-10-17',
      },
      'Users': [{ 'Ref': 'user2C2B57AE' }],
    });
  });

  test('"grantTableListStreams" should fail if streaming is not enabled on table"', () => {
    // GIVEN
    const stack = new Stack();
    const table = new Table(stack, 'my-table', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
    });
    const user = new iam.User(stack, 'user');

    // WHEN
    expect(() => table.grantTableListStreams(user)).toThrow(/DynamoDB Streams must be enabled on the table Default\/my-table/);
  });

  test('"grantTableListStreams" allows principal to list all streams for this table', () => {
    // GIVEN
    const stack = new Stack();
    const table = new Table(stack, 'my-table', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      stream: StreamViewType.NEW_IMAGE,
    });
    const user = new iam.User(stack, 'user');

    // WHEN
    table.grantTableListStreams(user);

    // THEN
    expect(stack).toHaveResource('AWS::IAM::Policy', {
      'PolicyDocument': {
        'Statement': [
          {
            'Action': 'dynamodb:ListStreams',
            'Effect': 'Allow',
            'Resource': '*',
          },
        ],
        'Version': '2012-10-17',
      },
      'Users': [{ 'Ref': 'user2C2B57AE' }],
    });
  });

  test('"grantStreamRead" should fail if streaming is not enabled on table"', () => {
    // GIVEN
    const stack = new Stack();
    const table = new Table(stack, 'my-table', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
    });
    const user = new iam.User(stack, 'user');

    // WHEN
    expect(() => table.grantStreamRead(user)).toThrow(/DynamoDB Streams must be enabled on the table Default\/my-table/);
  });

  test('"grantStreamRead" allows principal to read and describe the table stream"', () => {
    // GIVEN
    const stack = new Stack();
    const table = new Table(stack, 'my-table', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      stream: StreamViewType.NEW_IMAGE,
    });
    const user = new iam.User(stack, 'user');

    // WHEN
    table.grantStreamRead(user);

    // THEN
    expect(stack).toHaveResource('AWS::IAM::Policy', {
      'PolicyDocument': {
        'Statement': [
          {
            'Action': 'dynamodb:ListStreams',
            'Effect': 'Allow',
            'Resource': '*',
          },
          {
            'Action': [
              'dynamodb:DescribeStream',
              'dynamodb:GetRecords',
              'dynamodb:GetShardIterator',
            ],
            'Effect': 'Allow',
            'Resource': {
              'Fn::GetAtt': [
                'mytable0324D45C',
                'StreamArn',
              ],
            },
          },
        ],
        'Version': '2012-10-17',
      },
      'Users': [{ 'Ref': 'user2C2B57AE' }],
    });
  });

  test('if table has an index grant gives access to the index', () => {
    // GIVEN
    const stack = new Stack();

    const table = new Table(stack, 'my-table', { partitionKey: { name: 'ID', type: AttributeType.STRING } });
    table.addGlobalSecondaryIndex({ indexName: 'MyIndex', partitionKey: { name: 'Age', type: AttributeType.NUMBER } });
    const user = new iam.User(stack, 'user');

    // WHEN
    table.grantReadData(user);

    // THEN
    expect(stack).toHaveResource('AWS::IAM::Policy', {
      'PolicyDocument': {
        'Statement': [
          {
            'Action': [
              'dynamodb:BatchGetItem',
              'dynamodb:GetRecords',
              'dynamodb:GetShardIterator',
              'dynamodb:Query',
              'dynamodb:GetItem',
              'dynamodb:Scan',
              'dynamodb:ConditionCheckItem',
            ],
            'Effect': 'Allow',
            'Resource': [
              {
                'Fn::GetAtt': [
                  'mytable0324D45C',
                  'Arn',
                ],
              },
              {
                'Fn::Join': [
                  '',
                  [
                    {
                      'Fn::GetAtt': [
                        'mytable0324D45C',
                        'Arn',
                      ],
                    },
                    '/index/*',
                  ],
                ],
              },
            ],
          },
        ],
        'Version': '2012-10-17',
      },
      'PolicyName': 'userDefaultPolicy083DF682',
      'Users': [
        {
          'Ref': 'user2C2B57AE',
        },
      ],
    });
  });

  test('grant for an imported table', () => {
    // GIVEN
    const stack = new Stack();
    const table = Table.fromTableName(stack, 'MyTable', 'my-table');
    const user = new iam.User(stack, 'user');

    // WHEN
    table.grant(user, 'dynamodb:*');

    // THEN
    expect(stack).toHaveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'dynamodb:*',
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
                    ':dynamodb:',
                    {
                      Ref: 'AWS::Region',
                    },
                    ':',
                    {
                      Ref: 'AWS::AccountId',
                    },
                    ':table/my-table',
                  ],
                ],
              },
              {
                Ref: 'AWS::NoValue',
              },
            ],
          },
        ],
        Version: '2012-10-17',
      },
      Users: [
        {
          Ref: 'user2C2B57AE',
        },
      ],
    });
  });
});

describe('secondary indexes', () => {
  // See https://github.com/aws/aws-cdk/issues/4398
  test('attribute can be used as key attribute in one index, and non-key in another', () => {
    // GIVEN
    const stack = new Stack();
    const table = new Table(stack, 'Table', {
      partitionKey: { name: 'pkey', type: AttributeType.NUMBER },
    });

    // WHEN
    table.addGlobalSecondaryIndex({
      indexName: 'IndexA',
      partitionKey: { name: 'foo', type: AttributeType.STRING },
      projectionType: ProjectionType.INCLUDE,
      nonKeyAttributes: ['bar'],
    });

    // THEN
    expect(() => table.addGlobalSecondaryIndex({
      indexName: 'IndexB',
      partitionKey: { name: 'baz', type: AttributeType.STRING },
      sortKey: { name: 'bar', type: AttributeType.STRING },
      projectionType: ProjectionType.INCLUDE,
      nonKeyAttributes: ['blah'],
    })).not.toThrow();
  });
});

describe('import', () => {
  test('report error when importing an external/existing table from invalid arn missing resource name', () => {
    const stack = new Stack();

    const tableArn = 'arn:aws:dynamodb:us-east-1::table/';
    // WHEN
    expect(() => Table.fromTableArn(stack, 'ImportedTable', tableArn)).toThrow(/ARN for DynamoDB table must be in the form: .../);
  });

  test('static fromTableArn(arn) allows importing an external/existing table from arn', () => {
    const stack = new Stack();

    const tableArn = 'arn:aws:dynamodb:us-east-1:11111111:table/MyTable';
    const table = Table.fromTableArn(stack, 'ImportedTable', tableArn);

    const role = new iam.Role(stack, 'NewRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });
    table.grantReadData(role);

    // it is possible to obtain a permission statement for a ref
    expect(stack).toHaveResource('AWS::IAM::Policy', {
      'PolicyDocument': {
        'Statement': [
          {
            'Action': [
              'dynamodb:BatchGetItem',
              'dynamodb:GetRecords',
              'dynamodb:GetShardIterator',
              'dynamodb:Query',
              'dynamodb:GetItem',
              'dynamodb:Scan',
              'dynamodb:ConditionCheckItem',
            ],
            'Effect': 'Allow',
            'Resource': [
              tableArn,
              { 'Ref': 'AWS::NoValue' },
            ],
          },
        ],
        'Version': '2012-10-17',
      },
      'PolicyName': 'NewRoleDefaultPolicy90E8F49D',
      'Roles': [{ 'Ref': 'NewRole99763075' }],
    });

    expect(table.tableArn).toBe(tableArn);
    expect(stack.resolve(table.tableName)).toBe('MyTable');
  });

  test('static fromTableName(name) allows importing an external/existing table from table name', () => {
    const stack = new Stack();

    const tableName = 'MyTable';
    const table = Table.fromTableName(stack, 'ImportedTable', tableName);

    const role = new iam.Role(stack, 'NewRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });
    table.grantReadWriteData(role);

    // it is possible to obtain a permission statement for a ref
    expect(stack).toHaveResource('AWS::IAM::Policy', {
      'PolicyDocument': {
        'Statement': [
          {
            'Action': [
              'dynamodb:BatchGetItem',
              'dynamodb:GetRecords',
              'dynamodb:GetShardIterator',
              'dynamodb:Query',
              'dynamodb:GetItem',
              'dynamodb:Scan',
              'dynamodb:ConditionCheckItem',
              'dynamodb:BatchWriteItem',
              'dynamodb:PutItem',
              'dynamodb:UpdateItem',
              'dynamodb:DeleteItem',
            ],
            'Effect': 'Allow',
            'Resource': [
              {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    {
                      'Ref': 'AWS::Partition',
                    },
                    ':dynamodb:',
                    {
                      'Ref': 'AWS::Region',
                    },
                    ':',
                    {
                      'Ref': 'AWS::AccountId',
                    },
                    ':table/MyTable',
                  ],
                ],
              },
              {
                'Ref': 'AWS::NoValue',
              },
            ],
          },
        ],
        'Version': '2012-10-17',
      },
      'PolicyName': 'NewRoleDefaultPolicy90E8F49D',
      'Roles': [{ 'Ref': 'NewRole99763075' }],
    });

    expect(table.tableArn).toBe(`arn:${Aws.PARTITION}:dynamodb:${Aws.REGION}:${Aws.ACCOUNT_ID}:table/MyTable`);
    expect(stack.resolve(table.tableName)).toBe(tableName);
  });

  describe('stream permissions on imported tables', () => {
    test('throw if no tableStreamArn is specified', () => {
      const stack = new Stack();

      const tableName = 'MyTable';
      const table = Table.fromTableAttributes(stack, 'ImportedTable', { tableName });

      const role = new iam.Role(stack, 'NewRole', {
        assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      });

      expect(() => table.grantTableListStreams(role)).toThrow(/DynamoDB Streams must be enabled on the table/);
      expect(() => table.grantStreamRead(role)).toThrow(/DynamoDB Streams must be enabled on the table/);
    });

    test('creates the correct list streams grant', () => {
      const stack = new Stack();

      const tableName = 'MyTable';
      const tableStreamArn = 'arn:foo:bar:baz:TrustMeThisIsATableStream';
      const table = Table.fromTableAttributes(stack, 'ImportedTable', { tableName, tableStreamArn });

      const role = new iam.Role(stack, 'NewRole', {
        assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      });

      expect(table.grantTableListStreams(role)).toBeDefined();

      expect(stack).toHaveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: 'dynamodb:ListStreams',
              Effect: 'Allow',
              Resource: '*',
            },
          ],
          Version: '2012-10-17',
        },
        Roles: [stack.resolve(role.roleName)],
      });
    });

    test('creates the correct stream read grant', () => {
      const stack = new Stack();

      const tableName = 'MyTable';
      const tableStreamArn = 'arn:foo:bar:baz:TrustMeThisIsATableStream';
      const table = Table.fromTableAttributes(stack, 'ImportedTable', { tableName, tableStreamArn });

      const role = new iam.Role(stack, 'NewRole', {
        assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      });

      expect(table.grantStreamRead(role)).toBeDefined();

      expect(stack).toHaveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: 'dynamodb:ListStreams',
              Effect: 'Allow',
              Resource: '*',
            },
            {
              Action: ['dynamodb:DescribeStream', 'dynamodb:GetRecords', 'dynamodb:GetShardIterator'],
              Effect: 'Allow',
              Resource: tableStreamArn,
            },
          ],
          Version: '2012-10-17',
        },
        Roles: [stack.resolve(role.roleName)],
      });
    });

    test('creates the correct index grant if indexes have been provided when importing', () => {
      const stack = new Stack();

      const table = Table.fromTableAttributes(stack, 'ImportedTable', {
        tableName: 'MyTableName',
        globalIndexes: ['global'],
        localIndexes: ['local'],
      });

      const role = new iam.Role(stack, 'Role', {
        assumedBy: new iam.AnyPrincipal(),
      });

      table.grantReadData(role);

      expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: [
                'dynamodb:BatchGetItem',
                'dynamodb:GetRecords',
                'dynamodb:GetShardIterator',
                'dynamodb:Query',
                'dynamodb:GetItem',
                'dynamodb:Scan',
                'dynamodb:ConditionCheckItem',
              ],
              Resource: [
                {
                  'Fn::Join': ['', [
                    'arn:',
                    { Ref: 'AWS::Partition' },
                    ':dynamodb:',
                    { Ref: 'AWS::Region' },
                    ':',
                    { Ref: 'AWS::AccountId' },
                    ':table/MyTableName',
                  ]],
                },
                {
                  'Fn::Join': ['', [
                    'arn:',
                    { Ref: 'AWS::Partition' },
                    ':dynamodb:',
                    { Ref: 'AWS::Region' },
                    ':',
                    { Ref: 'AWS::AccountId' },
                    ':table/MyTableName/index/*',
                  ]],
                },
              ],
            },
          ],
        },
      });
    });
  });
});

describe('global', () => {
  test('create replicas', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new Table(stack, 'Table', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      replicationRegions: [
        'eu-west-2',
        'eu-central-1',
      ],
    });

    // THEN
    expect(stack).toHaveResource('Custom::DynamoDBReplica', {
      Properties: {
        TableName: {
          Ref: 'TableCD117FA1',
        },
        Region: 'eu-west-2',
      },
      Condition: 'TableStackRegionNotEqualseuwest2A03859E7',
    }, ResourcePart.CompleteDefinition);

    expect(stack).toHaveResource('Custom::DynamoDBReplica', {
      Properties: {
        TableName: {
          Ref: 'TableCD117FA1',
        },
        Region: 'eu-central-1',
      },
      Condition: 'TableStackRegionNotEqualseucentral199D46FC0',
    }, ResourcePart.CompleteDefinition);

    expect(SynthUtils.toCloudFormation(stack).Conditions).toEqual({
      TableStackRegionNotEqualseuwest2A03859E7: {
        'Fn::Not': [
          { 'Fn::Equals': ['eu-west-2', { Ref: 'AWS::Region' }] },
        ],
      },
      TableStackRegionNotEqualseucentral199D46FC0: {
        'Fn::Not': [
          { 'Fn::Equals': ['eu-central-1', { Ref: 'AWS::Region' }] },
        ],
      },
    });
  });

  test('grantReadData', () => {
    const stack = new Stack();
    const table = new Table(stack, 'Table', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      replicationRegions: [
        'eu-west-2',
        'eu-central-1',
      ],
    });
    table.addGlobalSecondaryIndex({
      indexName: 'my-index',
      partitionKey: {
        name: 'key',
        type: AttributeType.STRING,
      },
    });
    const user = new iam.User(stack, 'User');

    // WHEN
    table.grantReadData(user);

    // THEN
    expect(stack).toHaveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: [
              'dynamodb:BatchGetItem',
              'dynamodb:GetRecords',
              'dynamodb:GetShardIterator',
              'dynamodb:Query',
              'dynamodb:GetItem',
              'dynamodb:Scan',
              'dynamodb:ConditionCheckItem',
            ],
            Effect: 'Allow',
            Resource: [
              {
                'Fn::GetAtt': [
                  'TableCD117FA1',
                  'Arn',
                ],
              },
              {
                'Fn::Join': [
                  '',
                  [
                    {
                      'Fn::GetAtt': [
                        'TableCD117FA1',
                        'Arn',
                      ],
                    },
                    '/index/*',
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
                    ':dynamodb:eu-west-2:',
                    {
                      Ref: 'AWS::AccountId',
                    },
                    ':table/',
                    {
                      Ref: 'TableCD117FA1',
                    },
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
                    ':dynamodb:eu-central-1:',
                    {
                      Ref: 'AWS::AccountId',
                    },
                    ':table/',
                    {
                      Ref: 'TableCD117FA1',
                    },
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
                    ':dynamodb:eu-west-2:',
                    {
                      Ref: 'AWS::AccountId',
                    },
                    ':table/',
                    {
                      Ref: 'TableCD117FA1',
                    },
                    '/index/*',
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
                    ':dynamodb:eu-central-1:',
                    {
                      Ref: 'AWS::AccountId',
                    },
                    ':table/',
                    {
                      Ref: 'TableCD117FA1',
                    },
                    '/index/*',
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

  test('grantReadData across regions', () => {
    // GIVEN
    const app = new App();
    const stack1 = new Stack(app, 'Stack1', {
      env: { region: 'us-east-1' },
    });
    const table = new Table(stack1, 'Table', {
      tableName: 'my-table',
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      replicationRegions: [
        'eu-west-2',
        'eu-central-1',
      ],
    });
    table.addGlobalSecondaryIndex({
      indexName: 'my-index',
      partitionKey: {
        name: 'key',
        type: AttributeType.STRING,
      },
    });
    const stack2 = new Stack(app, 'Stack2', {
      env: { region: 'eu-west-2' },
    });
    const user = new iam.User(stack2, 'User');

    // WHEN
    table.grantReadData(user);

    // THEN
    expect(stack2).toHaveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: [
              'dynamodb:BatchGetItem',
              'dynamodb:GetRecords',
              'dynamodb:GetShardIterator',
              'dynamodb:Query',
              'dynamodb:GetItem',
              'dynamodb:Scan',
              'dynamodb:ConditionCheckItem',
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
                    ':dynamodb:us-east-1:',
                    {
                      Ref: 'AWS::AccountId',
                    },
                    ':table/my-table',
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
                    ':dynamodb:us-east-1:',
                    {
                      Ref: 'AWS::AccountId',
                    },
                    ':table/my-table/index/*',
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
                    ':dynamodb:eu-west-2:',
                    {
                      Ref: 'AWS::AccountId',
                    },
                    ':table/my-table',
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
                    ':dynamodb:eu-central-1:',
                    {
                      Ref: 'AWS::AccountId',
                    },
                    ':table/my-table',
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
                    ':dynamodb:eu-west-2:',
                    {
                      Ref: 'AWS::AccountId',
                    },
                    ':table/my-table/index/*',
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
                    ':dynamodb:eu-central-1:',
                    {
                      Ref: 'AWS::AccountId',
                    },
                    ':table/my-table/index/*',
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

  test('grantTableListStreams across regions', () => {
    // GIVEN
    const app = new App();
    const stack1 = new Stack(app, 'Stack1', {
      env: { region: 'us-east-1' },
    });
    const table = new Table(stack1, 'Table', {
      tableName: 'my-table',
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      replicationRegions: [
        'eu-west-2',
        'eu-central-1',
      ],
    });
    const stack2 = new Stack(app, 'Stack2', {
      env: { region: 'eu-west-2' },
    });
    const user = new iam.User(stack2, 'User');

    // WHEN
    table.grantTableListStreams(user);

    // THEN
    expect(stack2).toHaveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'dynamodb:ListStreams',
            Effect: 'Allow',
            Resource: '*',
          },
        ],
        Version: '2012-10-17',
      },
    });
  });

  test('throws when PROVISIONED billing mode is used without auto-scaled writes', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new Table(stack, 'Table', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      replicationRegions: [
        'eu-west-2',
        'eu-central-1',
      ],
      billingMode: BillingMode.PROVISIONED,
    });

    // THEN
    expect(() => {
      SynthUtils.synthesize(stack);
    }).toThrow(/A global Table that uses PROVISIONED as the billing mode needs auto-scaled write capacity/);
  });

  test('throws when PROVISIONED billing mode is used with auto-scaled writes, but without a policy', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const table = new Table(stack, 'Table', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      replicationRegions: [
        'eu-west-2',
        'eu-central-1',
      ],
      billingMode: BillingMode.PROVISIONED,
    });
    table.autoScaleWriteCapacity({
      minCapacity: 1,
      maxCapacity: 10,
    });

    // THEN
    expect(() => {
      SynthUtils.synthesize(stack);
    }).toThrow(/A global Table that uses PROVISIONED as the billing mode needs auto-scaled write capacity with a policy/);
  });

  test('allows PROVISIONED billing mode when auto-scaled writes with a policy are specified', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const table = new Table(stack, 'Table', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      replicationRegions: [
        'eu-west-2',
        'eu-central-1',
      ],
      billingMode: BillingMode.PROVISIONED,
    });
    table.autoScaleWriteCapacity({
      minCapacity: 1,
      maxCapacity: 10,
    }).scaleOnUtilization({ targetUtilizationPercent: 75 });

    expect(stack).toHaveResourceLike('AWS::DynamoDB::Table', {
      BillingMode: ABSENT, // PROVISIONED is the default
    });
  });

  test('throws when stream is set and not set to NEW_AND_OLD_IMAGES', () => {
    // GIVEN
    const stack = new Stack();

    // THEN
    expect(() => new Table(stack, 'Table', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      replicationRegions: [
        'eu-west-2',
        'eu-central-1',
      ],
      stream: StreamViewType.OLD_IMAGE,
    })).toThrow(/`NEW_AND_OLD_IMAGES`/);
  });

  test('throws with replica in same region as stack', () => {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'Stack', {
      env: { region: 'us-east-1' },
    });

    // THEN
    expect(() => new Table(stack, 'Table', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      replicationRegions: [
        'eu-west-1',
        'us-east-1',
        'eu-west-2',
      ],
    })).toThrow(/`replicationRegions` cannot include the region where this stack is deployed/);
  });

  test('no conditions when region is known', () => {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'Stack', {
      env: { region: 'eu-west-1' },
    });

    // WHEN
    new Table(stack, 'Table', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      replicationRegions: [
        'eu-west-2',
        'eu-central-1',
      ],
    });

    // THEN
    expect(SynthUtils.toCloudFormation(stack).Conditions).toBeUndefined();
  });

  test('can configure timeout', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new Table(stack, 'Table', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      replicationRegions: ['eu-central-1'],
      replicationTimeout: Duration.hours(1),
    });

    // THEN
    expect(cr.Provider).toHaveBeenCalledWith(expect.anything(), expect.any(String), expect.objectContaining({
      totalTimeout: Duration.hours(1),
    }));
  });
});

test('L1 inside L2 expects removalpolicy to have been set', () => {
  // Check that the "stateful L1 validation generation" works. Do it here
  // because we know DDB tables are stateful.
  const app = new App();
  const stack = new Stack(app, 'Stack');

  class FakeTableL2 extends Resource {
    constructor(scope: Construct, id: string) {
      super(scope, id);

      new CfnTable(this, 'Resource', {
        keySchema: [{ attributeName: 'hash', keyType: 'S' }],
      });
    }
  }

  new FakeTableL2(stack, 'Table');

  expect(() => {
    SynthUtils.toCloudFormation(stack);
  }).toThrow(/is a stateful resource type/);
});

function testGrant(expectedActions: string[], invocation: (user: iam.IPrincipal, table: Table) => void) {
  // GIVEN
  const stack = new Stack();
  const table = new Table(stack, 'my-table', { partitionKey: { name: 'ID', type: AttributeType.STRING } });
  const user = new iam.User(stack, 'user');

  // WHEN
  invocation(user, table);

  // THEN
  const action = expectedActions.length > 1 ? expectedActions.map(a => `dynamodb:${a}`) : `dynamodb:${expectedActions[0]}`;
  expect(stack).toHaveResource('AWS::IAM::Policy', {
    'PolicyDocument': {
      'Statement': [
        {
          'Action': action,
          'Effect': 'Allow',
          'Resource': [
            {
              'Fn::GetAtt': [
                'mytable0324D45C',
                'Arn',
              ],
            },
            {
              'Ref': 'AWS::NoValue',
            },
          ],
        },
      ],
      'Version': '2012-10-17',
    },
    'PolicyName': 'userDefaultPolicy083DF682',
    'Users': [
      {
        'Ref': 'user2C2B57AE',
      },
    ],
  });
}
