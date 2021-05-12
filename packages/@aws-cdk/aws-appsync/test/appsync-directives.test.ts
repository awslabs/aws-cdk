import '@aws-cdk/assert-internal/jest';
import * as cognito from '@aws-cdk/aws-cognito';
import * as cdk from '@aws-cdk/core';
import * as appsync from '../lib';
import * as t from './scalar-type-defintions';

const iam = [appsync.Directive.iam()];
const apiKey = [appsync.Directive.apiKey()];
const oidc = [appsync.Directive.oidc()];
const cognito_default = [appsync.Directive.cognito('test', 'test2')];
const cognito_additional = [appsync.Directive.cognito('test', 'test2')];
const custom = [appsync.Directive.custom('custom')];

const generateField = (directives: appsync.Directive[]): appsync.Field => {
  return new appsync.Field({
    returnType: t.string,
    directives,
  });
};

const generateRField = (directives: appsync.Directive[]): appsync.ResolvableField => {
  return new appsync.ResolvableField({
    returnType: t.string,
    directives,
  });
};

let stack: cdk.Stack;

let api_apiKey: appsync.GraphqlApi, api_iam: appsync.GraphqlApi, api_oidc: appsync.GraphqlApi,
  api_auth: appsync.GraphqlApi, api_cognito: appsync.GraphqlApi;
beforeEach(() => {
  // GIVEN
  stack = new cdk.Stack();
  const userPool = new cognito.UserPool(stack, 'userpool');
  api_apiKey = new appsync.GraphqlApi(stack, 'api_apiKey', {
    name: 'api',
  });
  api_iam = new appsync.GraphqlApi(stack, 'api_iam', {
    name: 'api',
    authorizationConfig: {
      defaultAuthorization: {
        authorizationType: appsync.AuthorizationType.IAM,
      },
    },
  });
  api_oidc = new appsync.GraphqlApi(stack, 'api_oidc', {
    name: 'api',
    authorizationConfig: {
      defaultAuthorization: {
        authorizationType: appsync.AuthorizationType.OIDC,
        openIdConnectConfig: { oidcProvider: 'test' },
      },
    },
  });
  api_auth = new appsync.GraphqlApi(stack, 'api_cognito_default', {
    name: 'api',
    authorizationConfig: {
      defaultAuthorization: {
        authorizationType: appsync.AuthorizationType.USER_POOL,
        userPoolConfig: { userPool },
      },
    },
  });
  api_cognito = new appsync.GraphqlApi(stack, 'api_cognito_additional', {
    name: 'api',
    authorizationConfig: {
      additionalAuthorizationModes: [
        {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: { userPool },
        },
      ],
    },
  });

  [api_apiKey, api_iam, api_oidc, api_auth, api_cognito].map((api) =>
    api.addQuery('filler', new appsync.ResolvableField({ returnType: t.string })),
  );
});

const testObjectType = (IApi: appsync.GraphqlApi, directives: appsync.Directive[], tag: string): any => {
  // WHEN
  IApi.addType(new appsync.ObjectType('Test', {
    definition: {
      field: generateField(directives),
      rfield: generateRField(directives),
    },
    directives: directives,
  }));
  const schema = 'schema {\n  query: Query\n}\ntype Query {\n  filler: String\n}\n';
  const out = `type Test ${tag} {\n  field: String\n  ${tag}\n  rfield: String\n  ${tag}\n}\n`;
  // THEN
  expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
    Definition: `${schema}${out}`,
  });
};

const testInterfaceType = (IApi: appsync.GraphqlApi, directives: appsync.Directive[], tag: string): any => {
  // WHEN
  IApi.addType(new appsync.InterfaceType('Test', {
    definition: {
      field: generateField(directives),
      rfield: generateRField(directives),
    },
    directives: directives,
  }));
  const schema = 'schema {\n  query: Query\n}\ntype Query {\n  filler: String\n}\n';
  const out = `interface Test ${tag} {\n  field: String\n  ${tag}\n  rfield: String\n  ${tag}\n}\n`;
  // THEN
  expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
    Definition: `${schema}${out}`,
  });
};

describe('Basic Testing of Directives for Code-First', () => {
  test('Iam directive configures in Object Type', () => { testObjectType(api_iam, iam, '@aws_iam'); });

  test('Iam directive configures in Interface Type', () => { testInterfaceType(api_iam, iam, '@aws_iam'); });

  test('Api Key directive configures in Object Type', () => { testObjectType(api_apiKey, apiKey, '@aws_api_key'); });

  test('Api Key directive configures in Interface Type', () => { testInterfaceType(api_apiKey, apiKey, '@aws_api_key'); });

  test('OIDC directive configures in Object Type', () => { testObjectType(api_oidc, oidc, '@aws_oidc'); });

  test('OIDC directive configures in Interface Type', () => { testInterfaceType(api_oidc, oidc, '@aws_oidc'); });

  test('Cognito as default directive configures in Object Type', () => {
    testObjectType(api_auth, cognito_default, '@aws_auth(cognito_groups: ["test", "test2"])');
  });

  test('Cognito as default directive configures in Interface Type', () => {
    testInterfaceType(api_auth, cognito_default, '@aws_auth(cognito_groups: ["test", "test2"])');
  });

  test('Cognito as additional directive configures in Object Type', () => {
    testObjectType(api_cognito, cognito_additional, '@aws_cognito_user_pools(cognito_groups: ["test", "test2"])');
  });

  test('Custom directive configures in Object Type', () => {
    testObjectType(api_cognito, custom, 'custom');
  });

  test('Custom directive configures in Interface Type', () => {
    testInterfaceType(api_cognito, custom, 'custom');
  });
});