import '@aws-cdk/assert-internal/jest';
import * as path from 'path';
import * as cognito from '@aws-cdk/aws-cognito';
import * as cdk from '@aws-cdk/core';
import * as appsync from '../lib';

// GIVEN
let stack: cdk.Stack;
let schema: appsync.Schema;
beforeEach(() => {
  stack = new cdk.Stack();
  schema = appsync.Schema.fromAsset(path.join(__dirname, 'schemas/appsync.test.graphql'));
});

describe('AppSync API Key Authorization', () => {
  test('AppSync creates default api key', () => {
    // WHEN
    new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
      schema,
    });

    // THEN
    expect(stack).toHaveResource('AWS::AppSync::ApiKey');
  });

  test('AppSync creates api key from additionalAuthorizationModes', () => {
    // WHEN
    new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
      schema,
      authorizationConfig: {
        defaultAuthorization: { authorizationType: appsync.AuthorizationType.IAM },
        additionalAuthorizationModes: [
          { authorizationType: appsync.AuthorizationType.API_KEY },
        ],
      },
    });

    // THEN
    expect(stack).toHaveResource('AWS::AppSync::ApiKey');
  });

  test('AppSync does not create unspecified api key from additionalAuthorizationModes', () => {
    // WHEN
    new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
      schema,
      authorizationConfig: {
        defaultAuthorization: { authorizationType: appsync.AuthorizationType.IAM },
      },
    });

    // THEN
    expect(stack).not.toHaveResource('AWS::AppSync::ApiKey');
  });

  test('appsync does not create unspecified api key with empty additionalAuthorizationModes', () => {
    // WHEN
    new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
      schema,
      authorizationConfig: {
        defaultAuthorization: { authorizationType: appsync.AuthorizationType.IAM },
        additionalAuthorizationModes: [],
      },
    });

    // THEN
    expect(stack).not.toHaveResource('AWS::AppSync::ApiKey');
  });

  test('appsync creates configured api key with additionalAuthorizationModes', () => {
    // WHEN
    new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
      schema,
      authorizationConfig: {
        defaultAuthorization: { authorizationType: appsync.AuthorizationType.IAM },
        additionalAuthorizationModes: [{
          authorizationType: appsync.AuthorizationType.API_KEY,
          apiKeyConfig: { description: 'Custom Description' },
        }],
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::ApiKey', {
      Description: 'Custom Description',
    });
  });

  test('apiKeyConfig creates default with valid expiration date', () => {
    const expirationDate: number = cdk.Expiration.after(cdk.Duration.days(10)).toEpoch();

    // WHEN
    new appsync.GraphqlApi(stack, 'API', {
      name: 'apiKeyUnitTest',
      schema,
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
          apiKeyConfig: {
            expires: cdk.Expiration.after(cdk.Duration.days(10)),
          },
        },
      },
    });
    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::ApiKey', {
      ApiId: { 'Fn::GetAtt': ['API62EA1CFF', 'ApiId'] },
      Expires: expirationDate,
    });
  });

  test('apiKeyConfig fails if expire argument less than a day', () => {
    // WHEN
    const when = () => {
      new appsync.GraphqlApi(stack, 'API', {
        name: 'apiKeyUnitTest',
        schema,
        authorizationConfig: {
          defaultAuthorization: {
            authorizationType: appsync.AuthorizationType.API_KEY,
            apiKeyConfig: {
              expires: cdk.Expiration.after(cdk.Duration.hours(1)),
            },
          },
        },
      });
    };

    // THEN
    expect(when).toThrowError('API key expiration must be between 1 and 365 days.');
  });

  test('apiKeyConfig fails if expire argument greater than 365 day', () => {
    // WHEN
    const when = () => {
      new appsync.GraphqlApi(stack, 'API', {
        name: 'apiKeyUnitTest',
        schema,
        authorizationConfig: {
          defaultAuthorization: {
            authorizationType: appsync.AuthorizationType.API_KEY,
            apiKeyConfig: {
              expires: cdk.Expiration.after(cdk.Duration.days(366)),
            },
          },
        },
      });
    };

    // THEN
    expect(when).toThrowError('API key expiration must be between 1 and 365 days.');
  });

  test('appsync creates configured api key with additionalAuthorizationModes (not as first element)', () => {
    // WHEN
    new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
      schema,
      authorizationConfig: {
        defaultAuthorization: { authorizationType: appsync.AuthorizationType.IAM },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.USER_POOL,
            userPoolConfig: { userPool: new cognito.UserPool(stack, 'myPool') },
          },
          {
            authorizationType: appsync.AuthorizationType.API_KEY,
            apiKeyConfig: { description: 'Custom Description' },
          },
        ],
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::ApiKey', {
      Description: 'Custom Description',
    });
  });

  test('appsync fails when empty default and API_KEY in additional', () => {
    // THEN
    expect(() => {
      new appsync.GraphqlApi(stack, 'api', {
        name: 'api',
        schema,
        authorizationConfig: {
          additionalAuthorizationModes: [{
            authorizationType: appsync.AuthorizationType.API_KEY,
          }],
        },
      });
    }).toThrowError('You can\'t duplicate API_KEY configuration. See https://docs.aws.amazon.com/appsync/latest/devguide/security.html');
  });

  test('appsync fails when multiple API_KEY auth modes', () => {
    // THEN
    expect(() => {
      new appsync.GraphqlApi(stack, 'api', {
        name: 'api',
        schema,
        authorizationConfig: {
          defaultAuthorization: { authorizationType: appsync.AuthorizationType.API_KEY },
          additionalAuthorizationModes: [{
            authorizationType: appsync.AuthorizationType.API_KEY,
          }],
        },
      });
    }).toThrowError('You can\'t duplicate API_KEY configuration. See https://docs.aws.amazon.com/appsync/latest/devguide/security.html');
  });

  test('appsync fails when multiple API_KEY auth modes in additionalXxx', () => {
    // THEN
    expect(() => {
      new appsync.GraphqlApi(stack, 'api', {
        name: 'api',
        schema,
        authorizationConfig: {
          defaultAuthorization: { authorizationType: appsync.AuthorizationType.IAM },
          additionalAuthorizationModes: [
            { authorizationType: appsync.AuthorizationType.API_KEY },
            { authorizationType: appsync.AuthorizationType.API_KEY },
          ],
        },
      });
    }).toThrowError('You can\'t duplicate API_KEY configuration. See https://docs.aws.amazon.com/appsync/latest/devguide/security.html');
  });
});

describe('AppSync IAM Authorization', () => {
  test('Iam authorization configurable in default authorization', () => {
    // WHEN
    new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
      schema,
      authorizationConfig: {
        defaultAuthorization: { authorizationType: appsync.AuthorizationType.IAM },
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLApi', {
      AuthenticationType: 'AWS_IAM',
    });
  });

  test('Iam authorization configurable in additional authorization', () => {
    // WHEN
    new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
      schema,
      authorizationConfig: {
        additionalAuthorizationModes: [{ authorizationType: appsync.AuthorizationType.IAM }],
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLApi', {
      AdditionalAuthenticationProviders: [{ AuthenticationType: 'AWS_IAM' }],
    });
  });

  test('appsync fails when multiple iam auth modes', () => {
    // THEN
    expect(() => {
      new appsync.GraphqlApi(stack, 'api', {
        name: 'api',
        schema,
        authorizationConfig: {
          defaultAuthorization: { authorizationType: appsync.AuthorizationType.IAM },
          additionalAuthorizationModes: [{ authorizationType: appsync.AuthorizationType.IAM }],
        },
      });
    }).toThrowError('You can\'t duplicate IAM configuration. See https://docs.aws.amazon.com/appsync/latest/devguide/security.html');
  });

  test('appsync fails when multiple IAM auth modes in additionalXxx', () => {
    // THEN
    expect(() => {
      new appsync.GraphqlApi(stack, 'api', {
        name: 'api',
        schema,
        authorizationConfig: {
          additionalAuthorizationModes: [
            { authorizationType: appsync.AuthorizationType.IAM },
            { authorizationType: appsync.AuthorizationType.IAM },
          ],
        },
      });
    }).toThrowError('You can\'t duplicate IAM configuration. See https://docs.aws.amazon.com/appsync/latest/devguide/security.html');
  });
});

describe('AppSync User Pool Authorization', () => {
  let userPool: cognito.UserPool;
  beforeEach(() => {
    userPool = new cognito.UserPool(stack, 'pool');
  });
  test('User Pool authorization configurable in default authorization has default configuration', () => {
    // WHEN
    new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
      schema,
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: { userPool },
        },
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLApi', {
      AuthenticationType: 'AMAZON_COGNITO_USER_POOLS',
      UserPoolConfig: {
        AwsRegion: { Ref: 'AWS::Region' },
        DefaultAction: 'ALLOW',
        UserPoolId: { Ref: 'pool056F3F7E' },
      },
    });
  });

  test('User Pool authorization configurable in default authorization', () => {
    // WHEN
    new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
      schema,
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool,
            appIdClientRegex: 'test',
            defaultAction: appsync.UserPoolDefaultAction.DENY,
          },
        },
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLApi', {
      AuthenticationType: 'AMAZON_COGNITO_USER_POOLS',
      UserPoolConfig: {
        AwsRegion: { Ref: 'AWS::Region' },
        DefaultAction: 'DENY',
        AppIdClientRegex: 'test',
        UserPoolId: { Ref: 'pool056F3F7E' },
      },
    });
  });

  test('User Pool authorization configurable in additional authorization has default configuration', () => {
    // WHEN
    new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
      schema,
      authorizationConfig: {
        additionalAuthorizationModes: [{
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: { userPool },
        }],
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLApi', {
      AdditionalAuthenticationProviders: [{
        AuthenticationType: 'AMAZON_COGNITO_USER_POOLS',
        UserPoolConfig: {
          AwsRegion: { Ref: 'AWS::Region' },
          UserPoolId: { Ref: 'pool056F3F7E' },
        },
      }],
    });
  });

  test('User Pool property defaultAction does not configure when in additional auth', () => {
    // WHEN
    new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
      schema,
      authorizationConfig: {
        additionalAuthorizationModes: [{
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool,
            appIdClientRegex: 'test',
            defaultAction: appsync.UserPoolDefaultAction.DENY,
          },
        }],
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLApi', {
      AdditionalAuthenticationProviders: [{
        AuthenticationType: 'AMAZON_COGNITO_USER_POOLS',
        UserPoolConfig: {
          AwsRegion: { Ref: 'AWS::Region' },
          AppIdClientRegex: 'test',
          UserPoolId: { Ref: 'pool056F3F7E' },
        },
      }],
    });
  });

  test('User Pool property defaultAction does not configure when in additional auth (complex)', () => {
    // WHEN
    new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
      schema,
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: { userPool },
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.USER_POOL,
            userPoolConfig: { userPool },
          },
          {
            authorizationType: appsync.AuthorizationType.USER_POOL,
            userPoolConfig: {
              userPool,
              appIdClientRegex: 'test',
              defaultAction: appsync.UserPoolDefaultAction.DENY,
            },
          },
        ],
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLApi', {
      AuthenticationType: 'AMAZON_COGNITO_USER_POOLS',
      UserPoolConfig: {
        AwsRegion: { Ref: 'AWS::Region' },
        DefaultAction: 'ALLOW',
        UserPoolId: { Ref: 'pool056F3F7E' },
      },
      AdditionalAuthenticationProviders: [
        {
          AuthenticationType: 'AMAZON_COGNITO_USER_POOLS',
          UserPoolConfig: {
            AwsRegion: { Ref: 'AWS::Region' },
            UserPoolId: { Ref: 'pool056F3F7E' },
          },
        },
        {
          AuthenticationType: 'AMAZON_COGNITO_USER_POOLS',
          UserPoolConfig: {
            AwsRegion: { Ref: 'AWS::Region' },
            AppIdClientRegex: 'test',
            UserPoolId: { Ref: 'pool056F3F7E' },
          },
        },
      ],
    });
  });
});

describe('AppSync OIDC Authorization', () => {
  test('OIDC authorization configurable in default authorization has default configuration', () => {
    // WHEN
    new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
      schema,
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.OIDC,
          openIdConnectConfig: { oidcProvider: 'test' },
        },
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLApi', {
      AuthenticationType: 'OPENID_CONNECT',
      OpenIDConnectConfig: {
        Issuer: 'test',
      },
    });
  });

  test('User Pool authorization configurable in default authorization', () => {
    // WHEN
    new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
      schema,
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.OIDC,
          openIdConnectConfig: {
            oidcProvider: 'test',
            clientId: 'id',
            tokenExpiryFromAuth: 1,
            tokenExpiryFromIssue: 1,
          },
        },
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLApi', {
      AuthenticationType: 'OPENID_CONNECT',
      OpenIDConnectConfig: {
        AuthTTL: 1,
        ClientId: 'id',
        IatTTL: 1,
        Issuer: 'test',
      },
    });
  });

  test('OIDC authorization configurable in additional authorization has default configuration', () => {
    // WHEN
    new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
      schema,
      authorizationConfig: {
        additionalAuthorizationModes: [{
          authorizationType: appsync.AuthorizationType.OIDC,
          openIdConnectConfig: { oidcProvider: 'test' },
        }],
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLApi', {
      AdditionalAuthenticationProviders: [{
        AuthenticationType: 'OPENID_CONNECT',
        OpenIDConnectConfig: {
          Issuer: 'test',
        },
      }],
    });
  });

  test('User Pool authorization configurable in additional authorization', () => {
    // WHEN
    new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
      schema,
      authorizationConfig: {
        additionalAuthorizationModes: [{
          authorizationType: appsync.AuthorizationType.OIDC,
          openIdConnectConfig: {
            oidcProvider: 'test',
            clientId: 'id',
            tokenExpiryFromAuth: 1,
            tokenExpiryFromIssue: 1,
          },
        }],
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLApi', {
      AdditionalAuthenticationProviders: [{
        AuthenticationType: 'OPENID_CONNECT',
        OpenIDConnectConfig: {
          AuthTTL: 1,
          ClientId: 'id',
          IatTTL: 1,
          Issuer: 'test',
        },
      }],
    });
  });

  test('User Pool authorization configurable in with multiple authorization', () => {
    // WHEN
    new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
      schema,
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.OIDC,
          openIdConnectConfig: { oidcProvider: 'test' },
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.OIDC,
            openIdConnectConfig: {
              oidcProvider: 'test1',
              clientId: 'id',
              tokenExpiryFromAuth: 1,
              tokenExpiryFromIssue: 1,
            },
          },
          {
            authorizationType: appsync.AuthorizationType.OIDC,
            openIdConnectConfig: {
              oidcProvider: 'test2',
              clientId: 'id',
              tokenExpiryFromAuth: 1,
              tokenExpiryFromIssue: 1,
            },
          },
        ],
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLApi', {
      AuthenticationType: 'OPENID_CONNECT',
      OpenIDConnectConfig: { Issuer: 'test' },
      AdditionalAuthenticationProviders: [
        {
          AuthenticationType: 'OPENID_CONNECT',
          OpenIDConnectConfig: {
            AuthTTL: 1,
            ClientId: 'id',
            IatTTL: 1,
            Issuer: 'test1',
          },
        },
        {
          AuthenticationType: 'OPENID_CONNECT',
          OpenIDConnectConfig: {
            AuthTTL: 1,
            ClientId: 'id',
            IatTTL: 1,
            Issuer: 'test2',
          },
        },
      ],
    });
  });
});
