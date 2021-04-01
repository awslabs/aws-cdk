import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as ga from '@aws-cdk/aws-globalaccelerator';
import { validateWeight } from './_util';

/**
 * Properties for a NetworkLoadBalancerEndpoint
 */
export interface NetworkLoadBalancerEndpointProps {
  /**
   * Endpoint weight across all endpoints in the group
   *
   * Must be a value between 0 and 255.
   *
   * @default 128
   */
  readonly weight?: number;
}

/**
 * Use a Network Load Balancer as a Global Accelerator Endpoint
 */
export class NetworkLoadBalancerEndpoint implements ga.IEndpoint {
  public readonly region?: string;

  constructor(private readonly loadBalancer: elbv2.INetworkLoadBalancer, private readonly options: NetworkLoadBalancerEndpointProps = {}) {
    validateWeight(options.weight);
    this.region = loadBalancer.env.region;
  }

  public renderEndpointConfiguration(): any {
    return {
      endpointId: this.loadBalancer.loadBalancerArn,
      weight: this.options.weight,
    } as ga.CfnEndpointGroup.EndpointConfigurationProperty;
  }
}