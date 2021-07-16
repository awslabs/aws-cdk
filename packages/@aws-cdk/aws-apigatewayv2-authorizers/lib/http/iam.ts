import { HttpRouteAuthorizerConfig, IHttpRouteAuthorizer } from '@aws-cdk/aws-apigatewayv2';

/**
 * Authorize Http Api routes with IAM using sigv4 to sign request
 */
export class HttpIamAuthorizer implements IHttpRouteAuthorizer {
  public bind(): HttpRouteAuthorizerConfig {
    return {
      authorizationType: 'AWS_IAM',
    };
  }
}
