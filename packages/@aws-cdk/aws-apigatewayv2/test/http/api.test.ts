import '@aws-cdk/assert/jest';
import { ABSENT } from '@aws-cdk/assert';
import { Metric } from '@aws-cdk/aws-cloudwatch';
import * as ec2 from '@aws-cdk/aws-ec2';
import { Duration, Stack } from '@aws-cdk/core';
import {
  CorsHttpMethod,
  HttpApi, HttpAuthorizer, HttpAuthorizerType, HttpIntegrationType, HttpMethod, HttpRouteAuthorizerBindOptions, HttpRouteAuthorizerConfig,
  HttpRouteIntegrationBindOptions, HttpRouteIntegrationConfig, IHttpRouteAuthorizer, IHttpRouteIntegration, HttpNoneAuthorizer, PayloadFormatVersion,
} from '../../lib';

describe('HttpApi', () => {
  test('default', () => {
    const stack = new Stack();
    const api = new HttpApi(stack, 'api');

    expect(stack).toHaveResource('AWS::ApiGatewayV2::Api', {
      Name: 'api',
      ProtocolType: 'HTTP',
    });

    expect(stack).toHaveResource('AWS::ApiGatewayV2::Stage', {
      ApiId: stack.resolve(api.apiId),
      StageName: '$default',
      AutoDeploy: true,
    });

    expect(stack).not.toHaveResource('AWS::ApiGatewayV2::Route');
    expect(stack).not.toHaveResource('AWS::ApiGatewayV2::Integration');

    expect(api.url).toBeDefined();
  });

  test('import', () => {
    const stack = new Stack();
    const imported = HttpApi.fromHttpApiAttributes(stack, 'imported', { httpApiId: 'http-1234', apiEndpoint: 'api-endpoint' });

    expect(imported.apiId).toEqual('http-1234');
    expect(imported.apiEndpoint).toEqual('api-endpoint');
  });

  test('unsetting createDefaultStage', () => {
    const stack = new Stack();
    const api = new HttpApi(stack, 'api', {
      createDefaultStage: false,
    });

    expect(stack).not.toHaveResource('AWS::ApiGatewayV2::Stage');
    expect(api.url).toBeUndefined();
  });

  test('default integration', () => {
    const stack = new Stack();
    const httpApi = new HttpApi(stack, 'api', {
      defaultIntegration: new DummyRouteIntegration(),
    });

    expect(stack).toHaveResourceLike('AWS::ApiGatewayV2::Route', {
      ApiId: stack.resolve(httpApi.apiId),
      RouteKey: '$default',
    });

    expect(stack).toHaveResourceLike('AWS::ApiGatewayV2::Integration', {
      ApiId: stack.resolve(httpApi.apiId),
    });
  });

  test('addRoutes() configures the correct routes', () => {
    const stack = new Stack();
    const httpApi = new HttpApi(stack, 'api');

    httpApi.addRoutes({
      path: '/pets',
      methods: [HttpMethod.GET, HttpMethod.PATCH],
      integration: new DummyRouteIntegration(),
    });

    expect(stack).toHaveResourceLike('AWS::ApiGatewayV2::Route', {
      ApiId: stack.resolve(httpApi.apiId),
      RouteKey: 'GET /pets',
    });

    expect(stack).toHaveResourceLike('AWS::ApiGatewayV2::Route', {
      ApiId: stack.resolve(httpApi.apiId),
      RouteKey: 'PATCH /pets',
    });
  });

  test('addRoutes() creates the default method', () => {
    const stack = new Stack();
    const httpApi = new HttpApi(stack, 'api');

    httpApi.addRoutes({
      path: '/pets',
      integration: new DummyRouteIntegration(),
    });

    expect(stack).toHaveResourceLike('AWS::ApiGatewayV2::Route', {
      ApiId: stack.resolve(httpApi.apiId),
      RouteKey: 'ANY /pets',
    });
  });

  describe('cors', () => {
    test('cors is correctly configured.', () => {
      const stack = new Stack();
      new HttpApi(stack, 'HttpApi', {
        corsPreflight: {
          allowHeaders: ['Authorization'],
          allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.HEAD, CorsHttpMethod.OPTIONS, CorsHttpMethod.POST, CorsHttpMethod.ANY],
          allowOrigins: ['*'],
          maxAge: Duration.seconds(36400),
        },
      });

      expect(stack).toHaveResource('AWS::ApiGatewayV2::Api', {
        CorsConfiguration: {
          AllowHeaders: ['Authorization'],
          AllowMethods: ['GET', 'HEAD', 'OPTIONS', 'POST', '*'],
          AllowOrigins: ['*'],
          MaxAge: 36400,
        },
      });
    });

    test('cors is absent when not specified.', () => {
      const stack = new Stack();
      new HttpApi(stack, 'HttpApi');

      expect(stack).toHaveResource('AWS::ApiGatewayV2::Api', {
        CorsConfiguration: ABSENT,
      });
    });

    test('errors when allowConfiguration is specified along with origin "*"', () => {
      const stack = new Stack();
      expect(() => new HttpApi(stack, 'HttpApi', {
        corsPreflight: {
          allowCredentials: true,
          allowOrigins: ['*'],
        },
      })).toThrowError(/allowCredentials is not supported/);
    });

    test('get metric', () => {
      // GIVEN
      const stack = new Stack();
      const api = new HttpApi(stack, 'test-api', {
        createDefaultStage: false,
      });
      const metricName = '4xxError';
      const statistic = 'Sum';
      const apiId = api.apiId;

      // WHEN
      const countMetric = api.metric(metricName, { statistic });

      // THEN
      expect(countMetric.namespace).toEqual('AWS/ApiGateway');
      expect(countMetric.metricName).toEqual(metricName);
      expect(countMetric.dimensions).toEqual({ ApiId: apiId });
      expect(countMetric.statistic).toEqual(statistic);
    });

    test('Exercise metrics', () => {
      // GIVEN
      const stack = new Stack();
      const api = new HttpApi(stack, 'test-api', {
        createDefaultStage: false,
      });
      const color = '#00ff00';
      const apiId = api.apiId;

      // WHEN
      const metrics = new Array<Metric>();
      metrics.push(api.metricClientError({ color }));
      metrics.push(api.metricServerError({ color }));
      metrics.push(api.metricDataProcessed({ color }));
      metrics.push(api.metricLatency({ color }));
      metrics.push(api.metricIntegrationLatency({ color }));
      metrics.push(api.metricCount({ color }));
      // THEN
      for (const metric of metrics) {
        expect(metric.namespace).toEqual('AWS/ApiGateway');
        expect(metric.dimensions).toEqual({ ApiId: apiId });
        expect(metric.color).toEqual(color);
      }
    });

    test('Metrics from imported resource', () => {
      // GIVEN
      const stack = new Stack();
      const apiId = 'importedId';
      const api = HttpApi.fromHttpApiAttributes(stack, 'test-api', { httpApiId: apiId });
      const metricName = '4xxError';
      const statistic = 'Sum';

      // WHEN
      const countMetric = api.metric(metricName, { statistic });

      // THEN
      expect(countMetric.namespace).toEqual('AWS/ApiGateway');
      expect(countMetric.metricName).toEqual(metricName);
      expect(countMetric.dimensions).toEqual({ ApiId: apiId });
      expect(countMetric.statistic).toEqual(statistic);
    });
  });

  test('description is set', () => {
    const stack = new Stack();
    new HttpApi(stack, 'api', {
      description: 'My Api',
    });

    expect(stack).toHaveResource('AWS::ApiGatewayV2::Api', {
      Name: 'api',
      ProtocolType: 'HTTP',
      Description: 'My Api',
    });
  });

  test('disableExecuteApiEndpoint is enabled', () => {
    const stack = new Stack();
    new HttpApi(stack, 'api', {
      disableExecuteApiEndpoint: true,
    });

    expect(stack).toHaveResource('AWS::ApiGatewayV2::Api', {
      Name: 'api',
      ProtocolType: 'HTTP',
      DisableExecuteApiEndpoint: true,
    });
  });

  test('can add a vpc links', () => {
    // GIVEN
    const stack = new Stack();
    const api = new HttpApi(stack, 'api');
    const vpc1 = new ec2.Vpc(stack, 'VPC-1');
    const vpc2 = new ec2.Vpc(stack, 'VPC-2');

    // WHEN
    api.addVpcLink({ vpc: vpc1, vpcLinkName: 'Link-1' });
    api.addVpcLink({ vpc: vpc2, vpcLinkName: 'Link-2' });

    // THEN
    expect(stack).toHaveResource('AWS::ApiGatewayV2::VpcLink', {
      Name: 'Link-1',
    });
    expect(stack).toHaveResource('AWS::ApiGatewayV2::VpcLink', {
      Name: 'Link-2',
    });
  });

  test('should add only one vpc link per vpc', () => {
    // GIVEN
    const stack = new Stack();
    const api = new HttpApi(stack, 'api');
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    api.addVpcLink({ vpc, vpcLinkName: 'Link-1' });
    api.addVpcLink({ vpc, vpcLinkName: 'Link-2' });

    // THEN
    expect(stack).toHaveResource('AWS::ApiGatewayV2::VpcLink', {
      Name: 'Link-1',
    });
    expect(stack).not.toHaveResource('AWS::ApiGatewayV2::VpcLink', {
      Name: 'Link-2',
    });
  });

  test('apiEndpoint is exported', () => {
    const stack = new Stack();
    const api = new HttpApi(stack, 'api');

    expect(api.apiEndpoint).toBeDefined();
  });

  test('can attach authorizer to route', () => {
    const stack = new Stack();
    const httpApi = new HttpApi(stack, 'api');

    const authorizer = new DummyAuthorizer();

    httpApi.addRoutes({
      path: '/pets',
      integration: new DummyRouteIntegration(),
      authorizer,
    });

    expect(stack).toHaveResource('AWS::ApiGatewayV2::Api', {
      Name: 'api',
      ProtocolType: 'HTTP',
    });

    expect(stack).toHaveResource('AWS::ApiGatewayV2::Route', {
      AuthorizerId: 'auth-1234',
      AuthorizationType: 'JWT',
    });
  });

  test('can import existing authorizer and attach to route', () => {
    // GIVEN
    const stack = new Stack();
    const api = new HttpApi(stack, 'HttpApi');

    const authorizer = HttpAuthorizer.fromHttpAuthorizerAttributes(stack, 'auth', {
      authorizerId: '12345',
      authorizerType: HttpAuthorizerType.JWT,
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
    expect(stack).toHaveResource('AWS::ApiGatewayV2::Route', {
      AuthorizerId: '12345',
    });
  });

  test('can attach custom scopes to authorizer route', () => {
    const stack = new Stack();
    const httpApi = new HttpApi(stack, 'api');

    const authorizer = new DummyAuthorizer();

    httpApi.addRoutes({
      path: '/pets',
      integration: new DummyRouteIntegration(),
      authorizer,
      authorizationScopes: ['read:scopes'],
    });

    expect(stack).toHaveResource('AWS::ApiGatewayV2::Api', {
      Name: 'api',
      ProtocolType: 'HTTP',
    });

    expect(stack).toHaveResource('AWS::ApiGatewayV2::Route', {
      AuthorizerId: 'auth-1234',
      AuthorizationType: 'JWT',
      AuthorizationScopes: ['read:scopes'],
    });
  });

  test('throws when accessing apiEndpoint and disableExecuteApiEndpoint is true', () => {
    const stack = new Stack();
    const api = new HttpApi(stack, 'api', {
      disableExecuteApiEndpoint: true,
    });

    expect(() => api.apiEndpoint).toThrow(
      /apiEndpoint is not accessible when disableExecuteApiEndpoint is set to true./,
    );
  });

  test('apiEndpoint for imported', () => {
    const stack = new Stack();
    const api = HttpApi.fromHttpApiAttributes(stack, 'imported', { httpApiId: 'api-1234' });

    expect(() => api.apiEndpoint).toThrow(/apiEndpoint is not configured/);
  });


  describe('default authorization settings', () => {
    test('can add default authorizer', () => {
      const stack = new Stack();

      const authorizer = new DummyAuthorizer();

      const httpApi = new HttpApi(stack, 'api', {
        defaultAuthorizer: authorizer,
        defaultAuthorizationScopes: ['read:pets'],
      });

      httpApi.addRoutes({
        path: '/pets',
        methods: [HttpMethod.GET],
        integration: new DummyRouteIntegration(),
      });

      expect(stack).toHaveResource('AWS::ApiGatewayV2::Route', {
        AuthorizerId: 'auth-1234',
        AuthorizationType: 'JWT',
        AuthorizationScopes: ['read:pets'],
      });
    });

    test('can add default authorizer, but remove it for a route', () => {
      const stack = new Stack();
      const authorizer = new DummyAuthorizer();

      const httpApi = new HttpApi(stack, 'api', {
        defaultAuthorizer: authorizer,
        defaultAuthorizationScopes: ['read:pets'],
      });

      httpApi.addRoutes({
        path: '/pets',
        methods: [HttpMethod.GET],
        integration: new DummyRouteIntegration(),
      });

      httpApi.addRoutes({
        path: '/chickens',
        methods: [HttpMethod.GET],
        integration: new DummyRouteIntegration(),
        authorizer: new HttpNoneAuthorizer(),
      });

      expect(stack).toHaveResource('AWS::ApiGatewayV2::Route', {
        RouteKey: 'GET /pets',
        AuthorizerId: 'auth-1234',
      });

      expect(stack).toHaveResource('AWS::ApiGatewayV2::Route', {
        RouteKey: 'GET /chickens',
        AuthorizerId: ABSENT,
      });
    });

    test('can remove default scopes for a route', () => {
      const stack = new Stack();

      const authorizer = new DummyAuthorizer();

      const httpApi = new HttpApi(stack, 'api', {
        defaultAuthorizer: authorizer,
        defaultAuthorizationScopes: ['read:books'],
      });

      httpApi.addRoutes({
        path: '/pets',
        methods: [HttpMethod.GET, HttpMethod.PATCH],
        integration: new DummyRouteIntegration(),
        authorizationScopes: [],
      });

      expect(stack).toHaveResource('AWS::ApiGatewayV2::Route', {
        AuthorizationScopes: ABSENT,
      });
    });

    test('can override scopes for a route', () => {
      const stack = new Stack();

      const authorizer = new DummyAuthorizer();

      const httpApi = new HttpApi(stack, 'api', {
        defaultAuthorizer: authorizer,
        defaultAuthorizationScopes: ['read:pets'],
      });

      httpApi.addRoutes({
        path: '/pets',
        methods: [HttpMethod.GET, HttpMethod.PATCH],
        integration: new DummyRouteIntegration(),
      });

      httpApi.addRoutes({
        path: '/chickens',
        methods: [HttpMethod.GET, HttpMethod.PATCH],
        integration: new DummyRouteIntegration(),
        authorizationScopes: ['read:chickens'],
      });

      expect(stack).toHaveResource('AWS::ApiGatewayV2::Route', {
        RouteKey: 'GET /pets',
        AuthorizationScopes: ['read:pets'],
      });

      expect(stack).toHaveResource('AWS::ApiGatewayV2::Route', {
        RouteKey: 'GET /chickens',
        AuthorizationScopes: ['read:chickens'],
      });
    });
  });
});

class DummyRouteIntegration implements IHttpRouteIntegration {
  public bind(_: HttpRouteIntegrationBindOptions): HttpRouteIntegrationConfig {
    return {
      payloadFormatVersion: PayloadFormatVersion.VERSION_2_0,
      type: HttpIntegrationType.HTTP_PROXY,
      uri: 'some-uri',
    };
  }
}

class DummyAuthorizer implements IHttpRouteAuthorizer {
  public bind(_: HttpRouteAuthorizerBindOptions): HttpRouteAuthorizerConfig {
    return {
      authorizerId: 'auth-1234',
      authorizationType: HttpAuthorizerType.JWT,
    };
  }
}