import '@aws-cdk/assert/jest';
import { Metric } from '@aws-cdk/aws-cloudwatch';
import { LogGroup } from '@aws-cdk/aws-logs';
import { Stack } from '@aws-cdk/core';
import { HttpApi, HttpStage } from '../../lib';


describe('HttpStage', () => {
  test('default', () => {
    const stack = new Stack();
    const api = new HttpApi(stack, 'Api', {
      createDefaultStage: false,
    });

    new HttpStage(stack, 'Stage', {
      httpApi: api,
    });

    expect(stack).toHaveResource('AWS::ApiGatewayV2::Stage', {
      ApiId: stack.resolve(api.httpApiId),
      StageName: '$default',
    });
  });

  test('import', () => {
    const stack = new Stack();
    const api = new HttpApi(stack, 'Api', {
      createDefaultStage: false,
    });

    const stage = new HttpStage(stack, 'Stage', {
      httpApi: api,
    });

    const imported = HttpStage.fromStageName(stack, 'Import', stage.stageName );

    expect(imported.stageName).toEqual(stage.stageName);
  });

  test('url returns the correct path', () => {
    const stack = new Stack();
    const api = new HttpApi(stack, 'Api', {
      createDefaultStage: false,
    });

    const defaultStage = new HttpStage(stack, 'DefaultStage', {
      httpApi: api,
    });

    const betaStage = new HttpStage(stack, 'BetaStage', {
      httpApi: api,
      stageName: 'beta',
    });

    expect(defaultStage.url.endsWith('/')).toBe(true);
    expect(betaStage.url.endsWith('/')).toBe(false);
  });

  test('get metric', () => {
    // GIVEN
    const stack = new Stack();
    const api = new HttpApi(stack, 'test-api', {
      createDefaultStage: false,
    });
    const stage = new HttpStage(stack, 'Stage', {
      httpApi: api,
    });
    const metricName = '4xxError';
    const statistic = 'Sum';
    const apiId = api.httpApiId;

    // WHEN
    const countMetric = stage.metric(metricName, { statistic });

    // THEN
    expect(countMetric.namespace).toEqual('AWS/ApiGateway');
    expect(countMetric.metricName).toEqual(metricName);
    expect(countMetric.dimensions).toEqual({
      ApiId: apiId,
      Stage: '$default',
    });
    expect(countMetric.statistic).toEqual(statistic);
  });

  test('Exercise metrics', () => {
    // GIVEN
    const stack = new Stack();
    const api = new HttpApi(stack, 'test-api', {
      createDefaultStage: false,
    });
    const stage = new HttpStage(stack, 'Stage', {
      httpApi: api,
    });
    const color = '#00ff00';
    const apiId = api.httpApiId;

    // WHEN
    const metrics = new Array<Metric>();
    metrics.push(stage.metricClientError({ color }));
    metrics.push(stage.metricServerError({ color }));
    metrics.push(stage.metricDataProcessed({ color }));
    metrics.push(stage.metricLatency({ color }));
    metrics.push(stage.metricIntegrationLatency({ color }));
    metrics.push(stage.metricCount({ color }));
    // THEN
    for (const metric of metrics) {
      expect(metric.namespace).toEqual('AWS/ApiGateway');
      expect(metric.dimensions).toEqual({
        ApiId: apiId,
        Stage: '$default',
      });
      expect(metric.color).toEqual(color);
    }
  });

  test('Access logging', () => {
    // GIVEN
    const stack = new Stack();
    const api = new HttpApi(stack, 'Api');
    const logGroup = new LogGroup(stack, 'log-group');


    // WHEN
    new HttpStage(stack, 'Stage', {
      httpApi: api,
      accessLogSettings: {
        destination: logGroup,
        format: '$context.identity.sourceIp - - [$context.requestTime] "$context.httpMethod $context.routeKey $context.protocol" $context.status $context.responseLength $context.requestId',
      },
    });

    // EXPECT
    expect(stack).toHaveResource('AWS::ApiGatewayV2::Stage', {
      ApiId: stack.resolve(api.httpApiId),
      AccessLogSettings: {
        DestinationArn: stack.resolve(logGroup.logGroupArn),
        Format: '$context.identity.sourceIp - - [$context.requestTime] "$context.httpMethod $context.routeKey $context.protocol" $context.status $context.responseLength $context.requestId',
      },
    });
  });
});