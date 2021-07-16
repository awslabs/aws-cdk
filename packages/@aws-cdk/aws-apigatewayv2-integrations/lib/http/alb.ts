import { HttpRouteIntegrationBindOptions, HttpRouteIntegrationConfig } from '@aws-cdk/aws-apigatewayv2';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import { HttpPrivateIntegrationOptions } from './base-types';
import { HttpPrivateIntegration } from './private/integration';

/**
 * Properties to initialize `HttpAlbIntegration`.
 */
export interface HttpAlbIntegrationProps extends HttpPrivateIntegrationOptions {
  /**
   * The listener to the application load balancer used for the integration
   */
  readonly listener: elbv2.IApplicationListener;
}

/**
 * The Application Load Balancer integration resource for HTTP API
 */
export class HttpAlbIntegration extends HttpPrivateIntegration {
  constructor(private readonly props: HttpAlbIntegrationProps) {
    super();
  }

  public bind(options: HttpRouteIntegrationBindOptions): HttpRouteIntegrationConfig {
    let vpc: ec2.IVpc | undefined = this.props.vpcLink?.vpc;
    if (!vpc && (this.props.listener instanceof elbv2.ApplicationListener)) {
      vpc = this.props.listener.loadBalancer.vpc;
    }
    if (!vpc) {
      throw new Error('The vpcLink property must be specified when using an imported Application Listener.');
    }

    const vpcLink = this._configureVpcLink(options, {
      vpcLink: this.props.vpcLink,
      vpc,
    });

    return {
      method: this.props.method ?? this.httpMethod,
      payloadFormatVersion: this.payloadFormatVersion,
      type: this.integrationType,
      connectionType: this.connectionType,
      connectionId: vpcLink.vpcLinkId,
      uri: this.props.listener.listenerArn,
      secureServerName: this.props.secureServerName,
    };
  }
}
