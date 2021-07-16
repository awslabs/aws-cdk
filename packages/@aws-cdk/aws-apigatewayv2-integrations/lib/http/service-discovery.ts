import { HttpRouteIntegrationBindOptions, HttpRouteIntegrationConfig } from '@aws-cdk/aws-apigatewayv2';
import * as servicediscovery from '@aws-cdk/aws-servicediscovery';
import { HttpPrivateIntegrationOptions } from './base-types';
import { HttpPrivateIntegration } from './private/integration';

/**
 * Properties to initialize `HttpServiceDiscoveryIntegration`.
 */
export interface HttpServiceDiscoveryIntegrationProps extends HttpPrivateIntegrationOptions {
  /**
   * The discovery service used for the integration
   */
  readonly service: servicediscovery.IService;
}

/**
 * The Service Discovery integration resource for HTTP API
 */
export class HttpServiceDiscoveryIntegration extends HttpPrivateIntegration {
  constructor(private readonly props: HttpServiceDiscoveryIntegrationProps) {
    super();
  }

  public bind(_: HttpRouteIntegrationBindOptions): HttpRouteIntegrationConfig {
    if (!this.props.vpcLink) {
      throw new Error('The vpcLink property is mandatory');
    }

    return {
      method: this.props.method ?? this.httpMethod,
      payloadFormatVersion: this.payloadFormatVersion,
      type: this.integrationType,
      connectionType: this.connectionType,
      connectionId: this.props.vpcLink.vpcLinkId,
      uri: this.props.service.serviceArn,
      secureServerName: this.props.secureServerName,
    };
  }
}
