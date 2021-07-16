import '@aws-cdk/assert-internal/jest';
import { ABSENT } from '@aws-cdk/assert-internal';
import { HttpApi, IHttpRouteIntegration, HttpRouteIntegrationBindOptions, PayloadFormatVersion, HttpIntegrationType } from '@aws-cdk/aws-apigatewayv2';
import { Stack } from '@aws-cdk/core';
import { HttpIamAuthorizer } from '../../lib/http/iam';

describe('HttpIamAuthorizer', () => {
  test('default', () => {
    // GIVEN
    const stack = new Stack();
    const api = new HttpApi(stack, 'HttpApi');

    const authorizer = new HttpIamAuthorizer();

    // WHEN
    api.addRoutes({
      integration: new DummyRouteIntegration(),
      path: '/books',
      authorizer,
    });

    // THEN
    expect(stack).toHaveResource('AWS::ApiGatewayV2::Route', {
      AuthorizationType: 'AWS_IAM',
      AuthorizerId: ABSENT,
    });
  });

  test('default integration', () => {
    // GIVEN
    const stack = new Stack();
    const authorizer = new HttpIamAuthorizer();

    // WHEN
    new HttpApi(stack, 'HttpApi', {
      defaultAuthorizer: authorizer,
      defaultIntegration: new DummyRouteIntegration(),
    });

    // THEN
    expect(stack).toHaveResource('AWS::ApiGatewayV2::Route', {
      AuthorizationType: 'AWS_IAM',
      AuthorizerId: ABSENT,
    });
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
