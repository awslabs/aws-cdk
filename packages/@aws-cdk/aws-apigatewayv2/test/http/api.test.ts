import '@aws-cdk/assert/jest';
import { ABSENT } from '@aws-cdk/assert';
import { Metric } from '@aws-cdk/aws-cloudwatch';
import * as ec2 from '@aws-cdk/aws-ec2';
import { Code, Function, Runtime } from '@aws-cdk/aws-lambda';
import { LogGroup } from '@aws-cdk/aws-logs';
import { Duration, Stack } from '@aws-cdk/core';
import { HttpApi, HttpMethod, LambdaProxyIntegration } from '../../lib';

describe('HttpApi', () => {
  test('default', () => {
    const stack = new Stack();
    const api = new HttpApi(stack, 'api');

    expect(stack).toHaveResource('AWS::ApiGatewayV2::Api', {
      Name: 'api',
      ProtocolType: 'HTTP',
    });

    expect(stack).toHaveResource('AWS::ApiGatewayV2::Stage', {
      ApiId: stack.resolve(api.httpApiId),
      StageName: '$default',
      AutoDeploy: true,
    });

    expect(stack).not.toHaveResource('AWS::ApiGatewayV2::Route');
    expect(stack).not.toHaveResource('AWS::ApiGatewayV2::Integration');

    expect(api.url).toBeDefined();
  });

  test('import', () => {
    const stack = new Stack();
    const api = new HttpApi(stack, 'api', { apiName: 'customName' });
    const imported = HttpApi.fromApiId(stack, 'imported', api.httpApiId );

    expect(imported.httpApiId).toEqual(api.httpApiId);

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
      defaultIntegration: new LambdaProxyIntegration({
        handler: new Function(stack, 'fn', {
          code: Code.fromInline('foo'),
          runtime: Runtime.NODEJS_12_X,
          handler: 'index.handler',
        }),
      }),
    });

    expect(stack).toHaveResourceLike('AWS::ApiGatewayV2::Route', {
      ApiId: stack.resolve(httpApi.httpApiId),
      RouteKey: '$default',
    });

    expect(stack).toHaveResourceLike('AWS::ApiGatewayV2::Integration', {
      ApiId: stack.resolve(httpApi.httpApiId),
    });
  });

  test('addRoutes() configures the correct routes', () => {
    const stack = new Stack();
    const httpApi = new HttpApi(stack, 'api');

    httpApi.addRoutes({
      path: '/pets',
      methods: [HttpMethod.GET, HttpMethod.PATCH],
      integration: new LambdaProxyIntegration({
        handler: new Function(stack, 'fn', {
          code: Code.fromInline('foo'),
          runtime: Runtime.NODEJS_12_X,
          handler: 'index.handler',
        }),
      }),
    });

    expect(stack).toHaveResourceLike('AWS::ApiGatewayV2::Route', {
      ApiId: stack.resolve(httpApi.httpApiId),
      RouteKey: 'GET /pets',
    });

    expect(stack).toHaveResourceLike('AWS::ApiGatewayV2::Route', {
      ApiId: stack.resolve(httpApi.httpApiId),
      RouteKey: 'PATCH /pets',
    });
  });

  test('addRoutes() creates the default method', () => {
    const stack = new Stack();
    const httpApi = new HttpApi(stack, 'api');

    httpApi.addRoutes({
      path: '/pets',
      integration: new LambdaProxyIntegration({
        handler: new Function(stack, 'fn', {
          code: Code.fromInline('foo'),
          runtime: Runtime.NODEJS_12_X,
          handler: 'index.handler',
        }),
      }),
    });

    expect(stack).toHaveResourceLike('AWS::ApiGatewayV2::Route', {
      ApiId: stack.resolve(httpApi.httpApiId),
      RouteKey: 'ANY /pets',
    });
  });

  describe('cors', () => {
    test('cors is correctly configured.', () => {
      const stack = new Stack();
      new HttpApi(stack, 'HttpApi', {
        corsPreflight: {
          allowHeaders: ['Authorization'],
          allowMethods: [HttpMethod.GET, HttpMethod.HEAD, HttpMethod.OPTIONS, HttpMethod.POST],
          allowOrigins: ['*'],
          maxAge: Duration.seconds(36400),
        },
      });

      expect(stack).toHaveResource('AWS::ApiGatewayV2::Api', {
        CorsConfiguration: {
          AllowHeaders: ['Authorization'],
          AllowMethods: ['GET', 'HEAD', 'OPTIONS', 'POST'],
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
      const apiId = api.httpApiId;

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
      const apiId = api.httpApiId;

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
      const api = HttpApi.fromApiId(stack, 'test-api', apiId);
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

  test('can create access logging for default stage', () => {
    const stack = new Stack();
    const logGroup = new LogGroup(stack, 'log-group');

    new HttpApi(stack, 'api', {
      accessLogSettings: {
        destination: logGroup,
        format: '$context.identity.sourceIp - - [$context.requestTime] "$context.httpMethod $context.routeKey $context.protocol" $context.status $context.responseLength $context.requestId',
      },
    });

    expect(stack).toHaveResource('AWS::ApiGatewayV2::Stage', {
      StageName: '$default',
      AccessLogSettings: {
        DestinationArn: stack.resolve(logGroup.logGroupArn),
        Format: '$context.identity.sourceIp - - [$context.requestTime] "$context.httpMethod $context.routeKey $context.protocol" $context.status $context.responseLength $context.requestId',
      },
    });
  });
});
