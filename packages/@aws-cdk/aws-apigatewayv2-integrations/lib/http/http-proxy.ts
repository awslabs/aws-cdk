import {
  HttpIntegrationType,
  HttpRouteIntegrationBindOptions,
  HttpRouteIntegrationConfig,
  HttpMethod,
  IHttpRouteIntegration,
  PayloadFormatVersion,
} from '@aws-cdk/aws-apigatewayv2';

/**
 * Properties to initialize a new `HttpProxyIntegration`.
 */
export interface HttpProxyIntegrationProps {
  /**
   * The full-qualified HTTP URL for the HTTP integration
   */
  readonly url: string

  /**
   * The HTTP method that must be used to invoke the underlying HTTP proxy.
   * @default HttpMethod.ANY
   */
  readonly method?: HttpMethod;
}

/**
 * The HTTP Proxy integration resource for HTTP API
 */
export class HttpProxyIntegration implements IHttpRouteIntegration {
  constructor(private readonly props: HttpProxyIntegrationProps) {
  }

  public bind(_: HttpRouteIntegrationBindOptions): HttpRouteIntegrationConfig {
    return {
      method: this.props.method ?? HttpMethod.ANY,
      payloadFormatVersion: PayloadFormatVersion.VERSION_1_0, // 1.0 is required and is the only supported format
      type: HttpIntegrationType.HTTP_PROXY,
      uri: this.props.url,
    };
  }
}
