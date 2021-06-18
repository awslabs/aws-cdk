import {
  HttpIntegrationType,
  HttpRouteIntegrationBindOptions,
  HttpRouteIntegrationConfig,
  IHttpRouteIntegration,
  PayloadFormatVersion,
} from '@aws-cdk/aws-apigatewayv2';
import { ServicePrincipal } from '@aws-cdk/aws-iam';
import { IFunction } from '@aws-cdk/aws-lambda';
import { Names, Stack } from '@aws-cdk/core';

/**
 * Lambda Proxy integration properties
 */
export interface LambdaProxyIntegrationProps {
  /**
   * The handler for this integration.
   */
  readonly handler: IFunction

  /**
   * Version of the payload sent to the lambda handler.
   * @see https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
   * @default PayloadFormatVersion.VERSION_2_0
   */
  readonly payloadFormatVersion?: PayloadFormatVersion;
}

/**
 * The Lambda Proxy integration resource for HTTP API
 */
export class LambdaProxyIntegration implements IHttpRouteIntegration {
  constructor(private readonly props: LambdaProxyIntegrationProps) {
  }

  public bind(options: HttpRouteIntegrationBindOptions): HttpRouteIntegrationConfig {
    const route = options.route;
    this.props.handler.addPermission(`${Names.nodeUniqueId(route.node)}-Permission`, {
      scope: options.scope,
      principal: new ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: Stack.of(route).formatArn({
        service: 'execute-api',
        resource: route.httpApi.apiId,
        resourceName: `*/*${route.path ?? ''}`, // empty string in the case of the catch-all route $default
      }),
    });

    return {
      type: HttpIntegrationType.LAMBDA_PROXY,
      uri: this.props.handler.functionArn,
      payloadFormatVersion: this.props.payloadFormatVersion ?? PayloadFormatVersion.VERSION_2_0,
    };
  }
}