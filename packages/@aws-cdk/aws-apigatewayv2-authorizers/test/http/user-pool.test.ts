import '@aws-cdk/assert-internal/jest';
import { HttpApi, HttpIntegrationType, HttpRouteIntegrationBindOptions, IHttpRouteIntegration, PayloadFormatVersion } from '@aws-cdk/aws-apigatewayv2';
import { UserPool } from '@aws-cdk/aws-cognito';
import { Stack } from '@aws-cdk/core';
import { HttpUserPoolAuthorizer } from '../../lib';

describe('HttpUserPoolAuthorizer', () => {
  test('default', () => {
    // GIVEN
    const stack = new Stack();
    const api = new HttpApi(stack, 'HttpApi');
    const userPool = new UserPool(stack, 'UserPool');
    const userPoolClient = userPool.addClient('UserPoolClient');
    const authorizerName = 'UserPoolAuthorizer';
    const authorizer = new HttpUserPoolAuthorizer({
      userPool,
      userPoolClient,
      authorizerName,
    });

    // WHEN
    api.addRoutes({
      integration: new DummyRouteIntegration(),
      path: '/books',
      authorizer,
    });

    // THEN
    expect(stack).toHaveResource('AWS::ApiGatewayV2::Authorizer', {
      AuthorizerType: 'JWT',
      IdentitySource: ['$request.header.Authorization'],
      JwtConfiguration: {
        Audience: [stack.resolve(userPoolClient.userPoolClientId)],
        Issuer: {
          'Fn::Join': [
            '',
            [
              'https://cognito-idp.',
              { Ref: 'AWS::Region' },
              '.amazonaws.com/',
              stack.resolve(userPool.userPoolId),
            ],
          ],
        },
      },
    });
  });

  test('same authorizer is used when bound to multiple routes', () => {
    // GIVEN
    const stack = new Stack();
    const api = new HttpApi(stack, 'HttpApi');
    const userPool = new UserPool(stack, 'UserPool');
    const userPoolClient = userPool.addClient('UserPoolClient');
    const authorizerName = 'UserPoolAuthorizer';
    const authorizer = new HttpUserPoolAuthorizer({
      userPool,
      userPoolClient,
      authorizerName,
    });

    // WHEN
    api.addRoutes({
      integration: new DummyRouteIntegration(),
      path: '/books',
      authorizer,
    });
    api.addRoutes({
      integration: new DummyRouteIntegration(),
      path: '/pets',
      authorizer,
    });

    // THEN
    expect(stack).toCountResources('AWS::ApiGatewayV2::Authorizer', 1);
  });
});

class DummyRouteIntegration implements IHttpRouteIntegration {
  public bind(_: HttpRouteIntegrationBindOptions) {
    return {
      payloadFormatVersion: PayloadFormatVersion.VERSION_2_0,
      type: HttpIntegrationType.HTTP_PROXY,
      uri: 'some-uri',
    };
  }
}
