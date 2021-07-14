import '@aws-cdk/assert-internal/jest';
import * as path from 'path';
import { Vpc, SecurityGroup, SubnetType } from '@aws-cdk/aws-ec2';
import { DatabaseSecret, DatabaseClusterEngine, AuroraMysqlEngineVersion, ServerlessCluster } from '@aws-cdk/aws-rds';
import * as cdk from '@aws-cdk/core';
import * as appsync from '../lib';

// GLOBAL GIVEN
let stack: cdk.Stack;
let api: appsync.GraphqlApi;
beforeEach(() => {
  stack = new cdk.Stack();
  api = new appsync.GraphqlApi(stack, 'baseApi', {
    name: 'api',
    schema: appsync.Schema.fromAsset(path.join(__dirname, 'schemas/appsync.test.graphql')),
  });
});

describe('Rds Data Source configuration', () => {
  // GIVEN
  let secret: DatabaseSecret;
  let cluster: ServerlessCluster;
  beforeEach(() => {
    const vpc = new Vpc(stack, 'Vpc', { maxAzs: 2 });
    const securityGroup = new SecurityGroup(stack, 'AuroraSecurityGroup', {
      vpc,
      allowAllOutbound: true,
    });
    secret = new DatabaseSecret(stack, 'AuroraSecret', {
      username: 'clusteradmin',
    });
    cluster = new ServerlessCluster(stack, 'AuroraCluster', {
      engine: DatabaseClusterEngine.auroraMysql({ version: AuroraMysqlEngineVersion.VER_2_07_1 }),
      credentials: { username: 'clusteradmin' },
      clusterIdentifier: 'db-endpoint-test',
      vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE },
      securityGroups: [securityGroup],
      defaultDatabaseName: 'Animals',
    });
  });

  test('appsync creates correct policy', () => {
    // WHEN
    api.addRdsDataSource('ds', cluster, secret);

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [{
          Action: [
            'secretsmanager:GetSecretValue',
            'secretsmanager:DescribeSecret',
          ],
          Effect: 'Allow',
          Resource: { Ref: 'AuroraSecret41E6E877' },
        },
        {
          Action: [
            'rds-data:BatchExecuteStatement',
            'rds-data:BeginTransaction',
            'rds-data:CommitTransaction',
            'rds-data:ExecuteStatement',
            'rds-data:RollbackTransaction',
          ],
          Effect: 'Allow',
          Resource: '*',
        },
        {
          Action: [
            'secretsmanager:GetSecretValue',
            'secretsmanager:DescribeSecret',
          ],
          Effect: 'Allow',
          Resource: { Ref: 'AuroraClusterSecretAttachmentDB8032DA' },
        },
        {
          Action: [
            'rds-data:DeleteItems',
            'rds-data:ExecuteSql',
            'rds-data:GetItems',
            'rds-data:InsertItems',
            'rds-data:UpdateItems',
          ],
          Effect: 'Allow',
          Resource: [{
            'Fn::Join': ['', ['arn:',
              { Ref: 'AWS::Partition' },
              ':rds:',
              { Ref: 'AWS::Region' },
              ':',
              { Ref: 'AWS::AccountId' },
              ':cluster:',
              { Ref: 'AuroraCluster23D869C0' }]],
          },
          {
            'Fn::Join': ['', ['arn:',
              { Ref: 'AWS::Partition' },
              ':rds:',
              { Ref: 'AWS::Region' },
              ':',
              { Ref: 'AWS::AccountId' },
              ':cluster:',
              { Ref: 'AuroraCluster23D869C0' },
              ':*']],
          }],
        }],
      },
    });
  });

  test('rds cluster arn saved to RdsHttpEndpointConfig', () => {
    // WHEN
    api.addRdsDataSource('ds', cluster, secret);

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::DataSource', {
      Type: 'RELATIONAL_DATABASE',
      RelationalDatabaseConfig: {
        RdsHttpEndpointConfig: {
          AwsRegion: { Ref: 'AWS::Region' },
          AwsSecretStoreArn: { Ref: 'AuroraSecret41E6E877' },
          DbClusterIdentifier: {
            'Fn::Join': ['', ['arn:',
              { Ref: 'AWS::Partition' },
              ':rds:',
              { Ref: 'AWS::Region' },
              ':',
              { Ref: 'AWS::AccountId' },
              ':cluster:',
              { Ref: 'AuroraCluster23D869C0' }]],
          },
        },
      },
    });
  });

  test('databaseName saved to RdsHttpEndpointConfig', () => {
    // WHEN
    const testDatabaseName = 'testDatabaseName';
    api.addRdsDataSource('ds', cluster, secret, testDatabaseName);

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::DataSource', {
      Type: 'RELATIONAL_DATABASE',
      RelationalDatabaseConfig: {
        RdsHttpEndpointConfig: {
          AwsRegion: { Ref: 'AWS::Region' },
          AwsSecretStoreArn: { Ref: 'AuroraSecret41E6E877' },
          DbClusterIdentifier: {
            'Fn::Join': ['', ['arn:',
              { Ref: 'AWS::Partition' },
              ':rds:',
              { Ref: 'AWS::Region' },
              ':',
              { Ref: 'AWS::AccountId' },
              ':cluster:',
              { Ref: 'AuroraCluster23D869C0' }]],
          },
          DatabaseName: testDatabaseName,
        },
      },
    });
  });

  test('default configuration produces name identical to the id', () => {
    // WHEN
    api.addRdsDataSource('ds', cluster, secret);

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::DataSource', {
      Type: 'RELATIONAL_DATABASE',
      Name: 'ds',
    });
  });

  test('appsync configures name correctly', () => {
    // WHEN
    api.addRdsDataSource('ds', cluster, secret, undefined, {
      name: 'custom',
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::DataSource', {
      Type: 'RELATIONAL_DATABASE',
      Name: 'custom',
    });
  });

  test('appsync configures name and description correctly', () => {
    // WHEN
    api.addRdsDataSource('ds', cluster, secret, undefined, {
      name: 'custom',
      description: 'custom description',
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::DataSource', {
      Type: 'RELATIONAL_DATABASE',
      Name: 'custom',
      Description: 'custom description',
    });
  });

  test('appsync errors when creating multiple rds data sources with no configuration', () => {
    // WHEN
    const when = () => {
      api.addRdsDataSource('ds', cluster, secret);
      api.addRdsDataSource('ds', cluster, secret);
    };

    // THEN
    expect(when).toThrow('There is already a Construct with name \'ds\' in GraphqlApi [baseApi]');
  });
});

describe('adding rds data source from imported api', () => {
  // GIVEN
  let secret: DatabaseSecret;
  let cluster: ServerlessCluster;
  beforeEach(() => {
    const vpc = new Vpc(stack, 'Vpc', { maxAzs: 2 });
    const securityGroup = new SecurityGroup(stack, 'AuroraSecurityGroup', {
      vpc,
      allowAllOutbound: true,
    });
    secret = new DatabaseSecret(stack, 'AuroraSecret', {
      username: 'clusteradmin',
    });
    cluster = new ServerlessCluster(stack, 'AuroraCluster', {
      engine: DatabaseClusterEngine.auroraMysql({ version: AuroraMysqlEngineVersion.VER_2_07_1 }),
      credentials: { username: 'clusteradmin' },
      clusterIdentifier: 'db-endpoint-test',
      vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE },
      securityGroups: [securityGroup],
      defaultDatabaseName: 'Animals',
    });
  });

  test('imported api can add RdsDbDataSource from id', () => {
    // WHEN
    const importedApi = appsync.GraphqlApi.fromGraphqlApiAttributes(stack, 'importedApi', {
      graphqlApiId: api.apiId,
    });
    importedApi.addRdsDataSource('ds', cluster, secret);

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::DataSource', {
      Type: 'RELATIONAL_DATABASE',
      ApiId: { 'Fn::GetAtt': ['baseApiCDA4D43A', 'ApiId'] },
    });
  });

  test('imported api can add RdsDataSource from attributes', () => {
    // WHEN
    const importedApi = appsync.GraphqlApi.fromGraphqlApiAttributes(stack, 'importedApi', {
      graphqlApiId: api.apiId,
      graphqlApiArn: api.arn,
    });
    importedApi.addRdsDataSource('ds', cluster, secret);

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::DataSource', {
      Type: 'RELATIONAL_DATABASE',
      ApiId: { 'Fn::GetAtt': ['baseApiCDA4D43A', 'ApiId'] },
    });
  });
});