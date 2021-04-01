import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as ga from '@aws-cdk/aws-globalaccelerator';
import { validateWeight } from './_util';

/**
 * Properties for a ApplicationLoadBalancerEndpoint
 */
export interface ApplicationLoadBalancerEndpointOptions {
  /**
   * Endpoint weight across all endpoints in the group
   *
   * Must be a value between 0 and 255.
   *
   * @default 128
   */
  readonly weight?: number;

  /**
   * Forward the client IP address in an `X-Forwarded-For` header
   *
   * GlobalAccelerator will create Network Interfaces in your VPC in order
   * to preserve the client IP address.
   *
   * Client IP address preservation is supported only in specific AWS Regions.
   * See the GlobalAccelerator Developer Guide for a list.
   *
   * @default true if available
   */
  readonly preserveClientIp?: boolean;
}

/**
 * Use an Application Load Balancer as a Global Accelerator Endpoint
 */
export class ApplicationLoadBalancerEndpoint implements ga.IEndpoint {
  public readonly region?: string;

  constructor(private readonly loadBalancer: elbv2.IApplicationLoadBalancer, private readonly options: ApplicationLoadBalancerEndpointOptions = {}) {
    validateWeight(options.weight);
    this.region = loadBalancer.env.region;
  }

  public renderEndpointConfiguration(): any {
    return {
      endpointId: this.loadBalancer.loadBalancerArn,
      weight: this.options.weight,
      clientIpPreservationEnabled: this.options.preserveClientIp,
    } as ga.CfnEndpointGroup.EndpointConfigurationProperty;
  }
}