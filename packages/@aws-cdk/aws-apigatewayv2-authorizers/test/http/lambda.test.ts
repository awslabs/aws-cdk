import '@aws-cdk/assert-internal/jest';
import { ABSENT } from '@aws-cdk/assert-internal';
import { HttpApi, HttpIntegrationType, HttpRouteIntegrationBindOptions, IHttpRouteIntegration, PayloadFormatVersion } from '@aws-cdk/aws-apigatewayv2';
import { Code, Function, Runtime } from '@aws-cdk/aws-lambda';
import { Duration, Stack } from '@aws-cdk/core';
import { HttpLambdaAuthorizer, HttpLambdaResponseType } from '../../lib';

describe('HttpLambdaAuthorizer', () => {
  test('default', () => {
    // GIVEN
    const stack = new Stack();
    const api = new HttpApi(stack, 'HttpApi');

    const handler = new Function(stack, 'auth-function', {
      runtime: Runtime.NODEJS_12_X,
      code: Code.fromInline('exports.handler = () => {return true}'),
      handler: 'index.handler',
    });

    const authorizer = new HttpLambdaAuthorizer({
      authorizerName: 'default-authorizer',
      handler,
    });

    // WHEN
    api.addRoutes({
      integration: new DummyRouteIntegration(),
      path: '/books',
      authorizer,
    });

    // THEN
    expect(stack).toHaveResource('AWS::ApiGatewayV2::Authorizer', {
      Name: 'default-authorizer',
      AuthorizerType: 'REQUEST',
      AuthorizerResultTtlInSeconds: 300,
      AuthorizerPayloadFormatVersion: '1.0',
      IdentitySource: [
        '$request.header.Authorization',
      ],
    });

    expect(stack).toHaveResource('AWS::ApiGatewayV2::Route', {
      AuthorizationType: 'CUSTOM',
    });
  });

  test('should use format 2.0 and simple responses when simple response type is requested', () => {
    // GIVEN
    const stack = new Stack();
    const api = new HttpApi(stack, 'HttpApi');

    const handler = new Function(stack, 'auth-function', {
      runtime: Runtime.NODEJS_12_X,
      code: Code.fromInline('exports.handler = () => {return true}'),
      handler: 'index.handler',
    });

    const authorizer = new HttpLambdaAuthorizer({
      authorizerName: 'my-simple-authorizer',
      responseTypes: [HttpLambdaResponseType.SIMPLE],
      handler,
    });

    // WHEN
    api.addRoutes({
      integration: new DummyRouteIntegration(),
      path: '/books',
      authorizer,
    });

    // THEN
    expect(stack).toHaveResource('AWS::ApiGatewayV2::Authorizer', {
      AuthorizerPayloadFormatVersion: '2.0',
      EnableSimpleResponses: true,
    });
  });

  test('should use format 1.0 when only IAM response type is requested', () => {
    // GIVEN
    const stack = new Stack();
    const api = new HttpApi(stack, 'HttpApi');

    const handler = new Function(stack, 'auth-function', {
      runtime: Runtime.NODEJS_12_X,
      code: Code.fromInline('exports.handler = () => {return true}'),
      handler: 'index.handler',
    });

    const authorizer = new HttpLambdaAuthorizer({
      authorizerName: 'my-iam-authorizer',
      responseTypes: [HttpLambdaResponseType.IAM],
      handler,
    });

    // WHEN
    api.addRoutes({
      integration: new DummyRouteIntegration(),
      path: '/books',
      authorizer,
    });

    // THEN
    expect(stack).toHaveResource('AWS::ApiGatewayV2::Authorizer', {
      AuthorizerPayloadFormatVersion: '1.0',
      EnableSimpleResponses: ABSENT,
    });
  });

  test('should use format 2.0 and simple responses when both response types are requested', () => {
    // GIVEN
    const stack = new Stack();
    const api = new HttpApi(stack, 'HttpApi');

    const handler = new Function(stack, 'auth-function', {
      runtime: Runtime.NODEJS_12_X,
      code: Code.fromInline('exports.handler = () => {return true}'),
      handler: 'index.handler',
    });

    const authorizer = new HttpLambdaAuthorizer({
      authorizerName: 'my-simple-iam-authorizer',
      responseTypes: [HttpLambdaResponseType.IAM, HttpLambdaResponseType.SIMPLE],
      handler,
    });

    // WHEN
    api.addRoutes({
      integration: new DummyRouteIntegration(),
      path: '/books',
      authorizer,
    });

    // THEN
    expect(stack).toHaveResource('AWS::ApiGatewayV2::Authorizer', {
      AuthorizerPayloadFormatVersion: '2.0',
      EnableSimpleResponses: true,
    });
  });

  test('can override cache ttl', () => {
    // GIVEN
    const stack = new Stack();
    const api = new HttpApi(stack, 'HttpApi');

    const handler = new Function(stack, 'auth-functon', {
      runtime: Runtime.NODEJS_12_X,
      code: Code.fromInline('exports.handler = () => {return true}'),
      handler: 'index.handler',
    });

    const authorizer = new HttpLambdaAuthorizer({
      authorizerName: 'my-simple-authorizer',
      responseTypes: [HttpLambdaResponseType.SIMPLE],
      handler,
      resultsCacheTtl: Duration.minutes(10),
    });

    // WHEN
    api.addRoutes({
      integration: new DummyRouteIntegration(),
      path: '/books',
      authorizer,
    });

    // THEN
    expect(stack).toHaveResource('AWS::ApiGatewayV2::Authorizer', {
      AuthorizerResultTtlInSeconds: 600,
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
