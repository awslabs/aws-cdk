import * as ec2 from '@aws-cdk/aws-ec2';
import * as ga from '@aws-cdk/aws-globalaccelerator';
import { Stack } from '@aws-cdk/core';
import { validateWeight } from './_util';

/**
 * Properties for a NetworkLoadBalancerEndpoint
 */
export interface CfnEipEndpointProps {
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
 * Use an EC2 Instance as a Global Accelerator Endpoint
 */
export class CfnEipEndpoint implements ga.IEndpoint {
  public readonly region?: string;

  constructor(private readonly eip: ec2.CfnEIP, private readonly options: CfnEipEndpointProps = {}) {
    validateWeight(options.weight);

    this.region = Stack.of(eip).region;
  }

  public renderEndpointConfiguration(): any {
    return {
      endpointId: this.eip.attrAllocationId,
      weight: this.options.weight,
    } as ga.CfnEndpointGroup.EndpointConfigurationProperty;
  }
}
