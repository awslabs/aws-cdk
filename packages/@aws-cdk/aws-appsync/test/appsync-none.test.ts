import '@aws-cdk/assert-internal/jest';
import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as appsync from '../lib';

// GLOBAL GIVEN
let stack: cdk.Stack;
let api: appsync.GraphqlApi;
beforeEach(() => {
  stack = new cdk.Stack();
  api = new appsync.GraphqlApi(stack, 'baseApi', {
    name: 'api',
    schema: appsync.Schema.fromAsset(path.join(__dirname, 'appsync.test.graphql')),
  });
});

describe('None Data Source configuration', () => {
  test('default configuration produces name `NoneCDKDataSource`', () => {
    // WHEN
    api.addNoneDataSource('ds');

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::DataSource', {
      Type: 'NONE',
      Name: 'ds',
    });
  });

  test('appsync configures name correctly', () => {
    // WHEN
    api.addNoneDataSource('ds', {
      name: 'custom',
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::DataSource', {
      Type: 'NONE',
      Name: 'custom',
    });
  });

  test('appsync configures name and description correctly', () => {
    // WHEN
    api.addNoneDataSource('ds', {
      name: 'custom',
      description: 'custom description',
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::DataSource', {
      Type: 'NONE',
      Name: 'custom',
      Description: 'custom description',
    });
  });

  test('appsync errors when creating multiple none data sources with no configuration', () => {
    // THEN
    expect(() => {
      api.addNoneDataSource('ds');
      api.addNoneDataSource('ds');
    }).toThrow("There is already a Construct with name 'ds' in GraphqlApi [baseApi]");
  });

  test('appsync errors when creating multiple none data sources with same name configuration', () => {
    // THEN
    expect(() => {
      api.addNoneDataSource('ds1', { name: 'custom' });
      api.addNoneDataSource('ds2', { name: 'custom' });
    }).not.toThrowError();
  });
});

describe('adding none data source from imported api', () => {
  test('imported api can add NoneDataSource from id', () => {
    // WHEN
    const importedApi = appsync.GraphqlApi.fromGraphqlApiAttributes(stack, 'importedApi', {
      graphqlApiId: api.apiId,
    });
    importedApi.addNoneDataSource('none');

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::DataSource', {
      Type: 'NONE',
      ApiId: { 'Fn::GetAtt': ['baseApiCDA4D43A', 'ApiId'] },
    });
  });

  test('imported api can add NoneDataSource from attributes', () => {
    // WHEN
    const importedApi = appsync.GraphqlApi.fromGraphqlApiAttributes(stack, 'importedApi', {
      graphqlApiId: api.apiId,
      graphqlApiArn: api.arn,
    });
    importedApi.addNoneDataSource('none');

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::DataSource', {
      Type: 'NONE',
      ApiId: { 'Fn::GetAtt': ['baseApiCDA4D43A', 'ApiId'] },
    });
  });
});


