import elbv2 = require('@aws-cdk/aws-elasticloadbalancingv2');
import { Construct, PhysicalName, Resource } from '@aws-cdk/cdk';
import { CfnVpcLink } from './apigateway.generated';

/**
 * Properties for a VpcLink
 */
export interface VpcLinkProps {
  /**
   * The name used to label and identify the VPC link.
   * @default automatically generated name
   */
  readonly vpcLinkName?: PhysicalName;

  /**
   * The description of the VPC link.
   * @default no description
   */
  readonly description?: string;

  /**
   * The network load balancers of the VPC targeted by the VPC link.
   * The network load balancers must be owned by the same AWS account of the API owner.
   */
  readonly targets: elbv2.INetworkLoadBalancer[];
}

/**
 * Define a new VPC Link
 * Specifies an API Gateway VPC link for a RestApi to access resources in an Amazon Virtual Private Cloud (VPC).
 */
export class VpcLink extends Resource {
  /**
   * Physical ID of the VpcLink resource
   * @attribute
   */
  public readonly vpcLinkId: string;

  constructor(scope: Construct, id: string, props: VpcLinkProps) {
    super(scope, id, {
      physicalName: props.vpcLinkName,
    });

    const cfnResource = new CfnVpcLink(this, 'Resource', {
      name: this.physicalName.value || this.node.uniqueId,
      description: props.description,
      targetArns: props.targets.map(nlb => nlb.loadBalancerArn)
    });

    this.vpcLinkId = cfnResource.vpcLinkId;
  }
}
