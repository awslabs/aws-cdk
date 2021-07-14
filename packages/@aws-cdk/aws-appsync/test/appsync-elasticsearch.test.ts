import '@aws-cdk/assert-internal/jest';
import * as path from 'path';
import * as es from '@aws-cdk/aws-elasticsearch';
import * as cdk from '@aws-cdk/core';
import * as appsync from '../lib';

// GLOBAL GIVEN
let stack: cdk.Stack;
let api: appsync.GraphqlApi;
let domain: es.Domain;
beforeEach(() => {
  stack = new cdk.Stack();
  api = new appsync.GraphqlApi(stack, 'baseApi', {
    name: 'api',
    schema: appsync.Schema.fromAsset(path.join(__dirname, 'schemas/appsync.test.graphql')),
  });
  domain = new es.Domain(stack, 'EsDomain', {
    version: es.ElasticsearchVersion.V7_10,
  });
});

describe('Elasticsearch Data Source Configuration', () => {
  test('Elasticsearch configure properly', () => {
    // WHEN
    api.addElasticsearchDataSource('ds', domain);

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [{
          Action: [
            'es:ESHttpGet',
            'es:ESHttpHead',
            'es:ESHttpDelete',
            'es:ESHttpPost',
            'es:ESHttpPut',
            'es:ESHttpPatch',
          ],
          Effect: 'Allow',
          Resource: [{
            'Fn::GetAtt': ['EsDomain1213C634', 'Arn'],
          },
          {
            'Fn::Join': ['', [{
              'Fn::GetAtt': ['EsDomain1213C634', 'Arn'],
            }, '/*']],
          }],
        }],
      },
    });
  });

  test('Elastic search configuration contains fully qualified url', () => {
    // WHEN
    api.addElasticsearchDataSource('ds', domain);

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::DataSource', {
      ElasticsearchConfig: {
        Endpoint: {
          'Fn::Join': ['', ['https://', {
            'Fn::GetAtt': ['EsDomain1213C634', 'DomainEndpoint'],
          }]],
        },
      },
    });
  });

  test('default configuration produces name identical to the id', () => {
    // WHEN
    api.addElasticsearchDataSource('ds', domain);

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::DataSource', {
      Type: 'AMAZON_ELASTICSEARCH',
      Name: 'ds',
    });
  });

  test('appsync configures name correctly', () => {
    // WHEN
    api.addElasticsearchDataSource('ds', domain, {
      name: 'custom',
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::DataSource', {
      Type: 'AMAZON_ELASTICSEARCH',
      Name: 'custom',
    });
  });

  test('appsync configures name and description correctly', () => {
    // WHEN
    api.addElasticsearchDataSource('ds', domain, {
      name: 'custom',
      description: 'custom description',
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::DataSource', {
      Type: 'AMAZON_ELASTICSEARCH',
      Name: 'custom',
      Description: 'custom description',
    });
  });

  test('appsync errors when creating multiple elasticsearch data sources with no configuration', () => {
    // WHEN
    const when = () => {
      api.addElasticsearchDataSource('ds', domain);
      api.addElasticsearchDataSource('ds', domain);
    };

    // THEN
    expect(when).toThrow('There is already a Construct with name \'ds\' in GraphqlApi [baseApi]');
  });
});

describe('adding elasticsearch data source from imported api', () => {
  test('imported api can add ElasticsearchDataSource from id', () => {
    // WHEN
    const importedApi = appsync.GraphqlApi.fromGraphqlApiAttributes(stack, 'importedApi', {
      graphqlApiId: api.apiId,
    });
    importedApi.addElasticsearchDataSource('ds', domain);

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::DataSource', {
      Type: 'AMAZON_ELASTICSEARCH',
      ApiId: { 'Fn::GetAtt': ['baseApiCDA4D43A', 'ApiId'] },
    });
  });

  test('imported api can add ElasticsearchDataSource from attributes', () => {
    // WHEN
    const importedApi = appsync.GraphqlApi.fromGraphqlApiAttributes(stack, 'importedApi', {
      graphqlApiId: api.apiId,
      graphqlApiArn: api.arn,
    });
    importedApi.addElasticsearchDataSource('ds', domain);

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::DataSource', {
      Type: 'AMAZON_ELASTICSEARCH',
      ApiId: { 'Fn::GetAtt': ['baseApiCDA4D43A', 'ApiId'] },
    });
  });
});