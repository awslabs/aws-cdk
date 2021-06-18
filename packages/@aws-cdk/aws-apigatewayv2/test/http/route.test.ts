import '@aws-cdk/assert-internal/jest';
import { Stack, App } from '@aws-cdk/core';
import {
  HttpApi, HttpAuthorizer, HttpAuthorizerType, HttpConnectionType, HttpIntegrationType, HttpMethod, HttpRoute, HttpRouteAuthorizerBindOptions,
  HttpRouteAuthorizerConfig, HttpRouteIntegrationConfig, HttpRouteKey, IHttpRouteAuthorizer, IHttpRouteIntegration, PayloadFormatVersion,
} from '../../lib';

describe('HttpRoute', () => {
  test('default', () => {
    const stack = new Stack();
    const httpApi = new HttpApi(stack, 'HttpApi');

    new HttpRoute(stack, 'HttpRoute', {
      httpApi,
      integration: new DummyIntegration(),
      routeKey: HttpRouteKey.with('/books', HttpMethod.GET),
    });

    expect(stack).toHaveResource('AWS::ApiGatewayV2::Route', {
      ApiId: stack.resolve(httpApi.apiId),
      RouteKey: 'GET /books',
      Target: {
        'Fn::Join': [
          '',
          [
            'integrations/',
            {
              Ref: 'HttpRouteHttpIntegrationcff2618c192d3bd8581dd2a4093464f6FB1097D0',
            },
          ],
        ],
      },
      AuthorizationType: 'NONE',
    });

    expect(stack).toHaveResource('AWS::ApiGatewayV2::Integration', {
      ApiId: stack.resolve(httpApi.apiId),
    });
  });

  test('integration is configured correctly', () => {
    const stack = new Stack();
    const httpApi = new HttpApi(stack, 'HttpApi');

    new HttpRoute(stack, 'HttpRoute', {
      httpApi,
      integration: new DummyIntegration(),
      routeKey: HttpRouteKey.with('/books', HttpMethod.GET),
    });

    expect(stack).toHaveResource('AWS::ApiGatewayV2::Integration', {
      ApiId: stack.resolve(httpApi.apiId),
      IntegrationType: 'HTTP_PROXY',
      PayloadFormatVersion: '2.0',
      IntegrationUri: 'some-uri',
    });
  });

  test('integration is only configured once if multiple routes are configured with it', () => {
    // GIVEN
    const stack = new Stack();
    const httpApi = new HttpApi(stack, 'HttpApi');
    const integration = new DummyIntegration();

    // WHEN
    new HttpRoute(stack, 'HttpRoute1', {
      httpApi,
      integration,
      routeKey: HttpRouteKey.with('/books', HttpMethod.GET),
    });
    new HttpRoute(stack, 'HttpRoute2', {
      httpApi,
      integration,
      routeKey: HttpRouteKey.with('/books', HttpMethod.POST),
    });

    // THEN
    expect(stack).toCountResources('AWS::ApiGatewayV2::Integration', 1);
  });

  test('integration can be used across HttpApis', () => {
    // GIVEN
    const integration = new DummyIntegration();

    // WHEN
    const stack1 = new Stack();
    const httpApi1 = new HttpApi(stack1, 'HttpApi1');

    new HttpRoute(stack1, 'HttpRoute1', {
      httpApi: httpApi1,
      integration,
      routeKey: HttpRouteKey.with('/books', HttpMethod.GET),
    });
    new HttpRoute(stack1, 'HttpRoute2', {
      httpApi: httpApi1,
      integration,
      routeKey: HttpRouteKey.with('/books', HttpMethod.POST),
    });

    const stack2 = new Stack();
    const httpApi2 = new HttpApi(stack2, 'HttpApi2');

    new HttpRoute(stack2, 'HttpRoute1', {
      httpApi: httpApi2,
      integration,
      routeKey: HttpRouteKey.with('/books', HttpMethod.GET),
    });
    new HttpRoute(stack2, 'HttpRoute2', {
      httpApi: httpApi2,
      integration,
      routeKey: HttpRouteKey.with('/books', HttpMethod.POST),
    });

    // THEN
    expect(stack1).toCountResources('AWS::ApiGatewayV2::Integration', 1);
    expect(stack2).toCountResources('AWS::ApiGatewayV2::Integration', 1);
  });

  test('route defined in a separate stack does not create cycles', () => {
    // GIVEN
    const integration = new DummyIntegration();

    // WHEN
    const app = new App();
    const stack1 = new Stack(app, 'ApiStack');
    const httpApi = new HttpApi(stack1, 'HttpApi');

    const stack2 = new Stack(app, 'RouteStack');
    new HttpRoute(stack2, 'HttpRoute1', {
      httpApi,
      integration,
      routeKey: HttpRouteKey.with('/books', HttpMethod.GET),
    });

    // THEN
    expect(stack1).toCountResources('AWS::ApiGatewayV2::Integration', 0);
    expect(stack2).toCountResources('AWS::ApiGatewayV2::Integration', 1);
  });

  test('throws when path not start with /', () => {
    const stack = new Stack();
    const httpApi = new HttpApi(stack, 'HttpApi');

    expect(() => new HttpRoute(stack, 'HttpRoute', {
      httpApi,
      integration: new DummyIntegration(),
      routeKey: HttpRouteKey.with('books', HttpMethod.GET),
    })).toThrowError(/A route path must always start with a "\/" and not end with a "\/"/);
  });

  test('throws when path ends with /', () => {
    const stack = new Stack();
    const httpApi = new HttpApi(stack, 'HttpApi');

    expect(() => new HttpRoute(stack, 'HttpRoute', {
      httpApi,
      integration: new DummyIntegration(),
      routeKey: HttpRouteKey.with('/books/', HttpMethod.GET),
    })).toThrowError(/A route path must always start with a "\/" and not end with a "\/"/);
  });

  test('configures private integration correctly when all props are passed', () => {
    // GIVEN
    const stack = new Stack();
    const httpApi = new HttpApi(stack, 'HttpApi');

    class PrivateIntegration implements IHttpRouteIntegration {
      public bind(): HttpRouteIntegrationConfig {
        return {
          method: HttpMethod.ANY,
          payloadFormatVersion: PayloadFormatVersion.VERSION_1_0,
          type: HttpIntegrationType.HTTP_PROXY,
          connectionId: 'some-connection-id',
          connectionType: HttpConnectionType.VPC_LINK,
          uri: 'some-target-arn',
        };
      }
    }

    // WHEN
    new HttpRoute(stack, 'HttpRoute', {
      httpApi,
      integration: new PrivateIntegration(),
      routeKey: HttpRouteKey.with('/books', HttpMethod.GET),
    });

    // THEN
    expect(stack).toHaveResource('AWS::ApiGatewayV2::Integration', {
      IntegrationType: 'HTTP_PROXY',
      ConnectionId: 'some-connection-id',
      ConnectionType: 'VPC_LINK',
      IntegrationMethod: 'ANY',
      IntegrationUri: 'some-target-arn',
      PayloadFormatVersion: '1.0',
    });
    expect(stack).not.toHaveResource('AWS::ApiGatewayV2::VpcLink');
  });

  test('can create route with an authorizer attached', () => {
    const stack = new Stack();
    const httpApi = new HttpApi(stack, 'HttpApi');

    const authorizer = new DummyAuthorizer();

    const route = new HttpRoute(stack, 'HttpRoute', {
      httpApi,
      integration: new DummyIntegration(),
      routeKey: HttpRouteKey.with('/books', HttpMethod.GET),
      authorizer,
    });

    expect(stack).toHaveResource('AWS::ApiGatewayV2::Integration', {
      ApiId: stack.resolve(httpApi.apiId),
      IntegrationType: 'HTTP_PROXY',
      PayloadFormatVersion: '2.0',
      IntegrationUri: 'some-uri',
    });

    expect(stack).toHaveResource('AWS::ApiGatewayV2::Authorizer');

    expect(stack).toHaveResource('AWS::ApiGatewayV2::Route', {
      AuthorizerId: stack.resolve(authorizer.bind({ scope: stack, route: route }).authorizerId),
      AuthorizationType: 'JWT',
    });
  });

  test('can attach additional scopes to a route with an authorizer attached', () => {
    const stack = new Stack();
    const httpApi = new HttpApi(stack, 'HttpApi');

    const authorizer = new DummyAuthorizer();

    new HttpRoute(stack, 'HttpRoute', {
      httpApi,
      integration: new DummyIntegration(),
      routeKey: HttpRouteKey.with('/books', HttpMethod.GET),
      authorizer,
      authorizationScopes: ['read:books'],
    });

    expect(stack).toHaveResource('AWS::ApiGatewayV2::Route', {
      AuthorizationScopes: ['read:books'],
    });
  });

  test('should fail when unsupported authorization type is used', () => {
    const stack = new Stack();
    const httpApi = new HttpApi(stack, 'HttpApi');

    const authorizer = new InvalidTypeAuthorizer();

    expect(() => new HttpRoute(stack, 'HttpRoute', {
      httpApi,
      integration: new DummyIntegration(),
      routeKey: HttpRouteKey.with('/books', HttpMethod.GET),
      authorizer,
    })).toThrowError('authorizationType should either be JWT, CUSTOM, or NONE');
  });
});

class DummyIntegration implements IHttpRouteIntegration {
  public bind(): HttpRouteIntegrationConfig {
    return {
      type: HttpIntegrationType.HTTP_PROXY,
      payloadFormatVersion: PayloadFormatVersion.VERSION_2_0,
      uri: 'some-uri',
      method: HttpMethod.DELETE,
    };
  }
}

class DummyAuthorizer implements IHttpRouteAuthorizer {
  private authorizer?: HttpAuthorizer;

  public bind(options: HttpRouteAuthorizerBindOptions): HttpRouteAuthorizerConfig {
    if (!this.authorizer) {
      this.authorizer = new HttpAuthorizer(options.scope, 'auth-1234', {
        httpApi: options.route.httpApi,
        identitySource: ['identitysource.1', 'identitysource.2'],
        type: HttpAuthorizerType.JWT,
        jwtAudience: ['audience.1', 'audience.2'],
        jwtIssuer: 'issuer',
      });
    }

    return {
      authorizerId: this.authorizer.authorizerId,
      authorizationType: 'JWT',
    };
  }
}

class InvalidTypeAuthorizer implements IHttpRouteAuthorizer {
  private authorizer?: HttpAuthorizer;

  public bind(options: HttpRouteAuthorizerBindOptions): HttpRouteAuthorizerConfig {
    if (!this.authorizer) {
      this.authorizer = new HttpAuthorizer(options.scope, 'auth-1234', {
        httpApi: options.route.httpApi,
        identitySource: ['identitysource.1', 'identitysource.2'],
        type: HttpAuthorizerType.JWT,
        jwtAudience: ['audience.1', 'audience.2'],
        jwtIssuer: 'issuer',
      });
    }

    return {
      authorizerId: this.authorizer.authorizerId,
      authorizationType: 'Random',
    };
  }
}