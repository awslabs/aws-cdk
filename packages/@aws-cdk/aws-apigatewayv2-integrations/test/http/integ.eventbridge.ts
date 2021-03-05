import { HttpApi } from '@aws-cdk/aws-apigatewayv2';
import { App, CfnOutput, Stack } from '@aws-cdk/core';
import { EventBus } from '../../../aws-events';
import { EventBridgeIntegration } from '../../lib';

const app = new App();

const stack = new Stack(app, 'integ-eventbridge-proxy');

const eventBus = new EventBus(stack, 'EventBus');

const endpoint = new HttpApi(stack, 'EventBridgeProxyApi', {
  defaultIntegration: new EventBridgeIntegration({
    eventBus,
    requestParameters: {
      source: 'test',
      detail: '$request.body.result',
      detailType: '$request.body.description',
      time: '$context.requestTimeEpoch',
    },
  }),
});

new CfnOutput(stack, 'Endpoint', {
  value: endpoint.url!,
});
