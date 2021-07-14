import '@aws-cdk/assert-internal/jest';
import * as path from 'path';
import * as lambda from '@aws-cdk/aws-lambda';
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

describe('Lambda Data Source configuration', () => {
  // GIVEN
  let func: lambda.Function;
  beforeEach(() => {
    func = new lambda.Function(stack, 'func', {
      code: lambda.Code.fromAsset('test/verify'),
      handler: 'iam-query.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
    });
  });

  test('default configuration produces name `TableCDKDataSource`', () => {
    // WHEN
    api.addLambdaDataSource('ds', func);

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::DataSource', {
      Type: 'AWS_LAMBDA',
      Name: 'ds',
    });
  });

  test('appsync configures name correctly', () => {
    // WHEN
    api.addLambdaDataSource('ds', func, {
      name: 'custom',
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::DataSource', {
      Type: 'AWS_LAMBDA',
      Name: 'custom',
    });
  });

  test('appsync configures name and description correctly', () => {
    // WHEN
    api.addLambdaDataSource('ds', func, {
      name: 'custom',
      description: 'custom description',
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::DataSource', {
      Type: 'AWS_LAMBDA',
      Name: 'custom',
      Description: 'custom description',
    });
  });

  test('appsync errors when creating multiple lambda data sources with no configuration', () => {
    // THEN
    expect(() => {
      api.addLambdaDataSource('ds', func);
      api.addLambdaDataSource('ds', func);
    }).toThrow("There is already a Construct with name 'ds' in GraphqlApi [baseApi]");
  });

  test('lambda data sources dont require mapping templates', () => {
    // WHEN
    const ds = api.addLambdaDataSource('ds', func, {
      name: 'custom',
      description: 'custom description',
    });

    ds.createResolver({
      typeName: 'test',
      fieldName: 'field',
    });

    // THEN
    expect(stack).toHaveResource('AWS::AppSync::Resolver');
  });
});

describe('adding lambda data source from imported api', () => {
  let func: lambda.Function;
  beforeEach(() => {
    func = new lambda.Function(stack, 'func', {
      code: lambda.Code.fromAsset('test/verify'),
      handler: 'iam-query.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
    });
  });

  test('imported api can add LambdaDbDataSource from id', () => {
    // WHEN
    const importedApi = appsync.GraphqlApi.fromGraphqlApiAttributes(stack, 'importedApi', {
      graphqlApiId: api.apiId,
    });
    importedApi.addLambdaDataSource('ds', func);

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::DataSource', {
      Type: 'AWS_LAMBDA',
      ApiId: { 'Fn::GetAtt': ['baseApiCDA4D43A', 'ApiId'] },
    });
  });

  test('imported api can add LambdaDataSource from attributes', () => {
    // WHEN
    const importedApi = appsync.GraphqlApi.fromGraphqlApiAttributes(stack, 'importedApi', {
      graphqlApiId: api.apiId,
      graphqlApiArn: api.arn,
    });
    importedApi.addLambdaDataSource('ds', func);

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::DataSource', {
      Type: 'AWS_LAMBDA',
      ApiId: { 'Fn::GetAtt': ['baseApiCDA4D43A', 'ApiId'] },
    });
  });
});