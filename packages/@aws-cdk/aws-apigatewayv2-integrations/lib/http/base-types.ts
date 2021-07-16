import { HttpMethod, IVpcLink } from '@aws-cdk/aws-apigatewayv2';
import { Duration } from '@aws-cdk/core';

/**
 * Base options for private integration
 */
export interface HttpPrivateIntegrationOptions {
  /**
   * The vpc link to be used for the private integration
   *
   * @default - a new VpcLink is created
   */
  readonly vpcLink?: IVpcLink;

  /**
   * The HTTP method that must be used to invoke the underlying HTTP proxy.
   * @default HttpMethod.ANY
   */
  readonly method?: HttpMethod;
}

/**
 * Common properties to initialize a new `HttpProxyIntegration`.
 */
export interface CommonIntegrationProps {

  /**
   * The description of the integration
   *
   * @default - undefined
   */
  readonly description?: string;

  /**
   * Custom timeout for HTTP APIs
   *
   * @default - undefined
   */
  readonly timeout?: Duration;
}