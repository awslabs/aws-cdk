import { CfnEndpointGroup } from './globalaccelerator.generated';

/**
 * An endpoint for the endpoint group
 *
 * Implementations of `IEndpoint` can be found in the `aws-globalaccelerator-endpoints` package.
 */
export interface IEndpoint {
  /**
   * The region where the endpoint is located
   *
   * If the region cannot be determined, `undefined` is returned
   */
  readonly region?: string;

  /**
   * Render the endpoint to an endpoint configuration
   */
  renderEndpointConfiguration(): any;
}

/**
 * Properties for RawEndpoint
 */
export interface RawEndpointProps {
  /**
   * Identifier of the endpoint
   *
   * Load balancer ARN, instance ID or EIP allocation ID.
   */
  readonly endpointId: string;

  /**
   * Endpoint weight across all endpoints in the group
   *
   * Must be a value between 0 and 255.
   *
   * @default 128
   */
  readonly weight?: number;

  /**
   * Forward the client IP address
   *
   * GlobalAccelerator will create Network Interfaces in your VPC in order
   * to preserve the client IP address.
   *
   * Only applies to Application Load Balancers and EC2 instances.
   *
   * Client IP address preservation is supported only in specific AWS Regions.
   * See the GlobalAccelerator Developer Guide for a list.
   *
   * @default true if possible and available
   */
  readonly preserveClientIp?: boolean;

  /**
   * The region where this endpoint is located
   *
   * @default - Unknown what region this endpoint is located
   */
  readonly region?: string;
}

/**
 * Untyped endpoint implementation
 *
 * Prefer using the classes in the `aws-globalaccelerator-endpoints` package instead,
 * as they accept typed constructs. You can use this class if you want to use an
 * endpoint type that does not have an appropriate class in that package yet.
 */
export class RawEndpoint implements IEndpoint {
  public readonly region?: string;

  constructor(private readonly props: RawEndpointProps) {
    this.region = props.region;
  }

  public renderEndpointConfiguration(): any {
    return {
      endpointId: this.props.endpointId,
      weight: this.props.weight,
      clientIpPreservationEnabled: this.props.preserveClientIp,
    } as CfnEndpointGroup.EndpointConfigurationProperty;
  }
}

