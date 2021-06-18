import * as ec2 from '@aws-cdk/aws-ec2';

import { CfnResource } from '@aws-cdk/core';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from '@aws-cdk/custom-resources';
import { Construct } from 'constructs';
import { EndpointGroup } from '../lib';

/**
 * The security group used by a Global Accelerator to send traffic to resources in a VPC.
 */
export class AcceleratorSecurityGroupPeer implements ec2.IPeer {
  /**
   * Lookup the Global Accelerator security group at CloudFormation deployment time.
   *
   * As of this writing, Global Accelerators (AGA) create a single security group per VPC. AGA security groups are shared
   * by all AGAs in an account. Additionally, there is no CloudFormation mechanism to reference the AGA security groups.
   *
   * This makes creating security group rules which allow traffic from an AGA complicated in CDK. This lookup will identify
   * the AGA security group for a given VPC at CloudFormation deployment time, and lets you create rules for traffic from AGA
   * to other resources created by CDK.
   */
  public static fromVpc(scope: Construct, id: string, vpc: ec2.IVpc, endpointGroup: EndpointGroup) {
    // The security group name is always 'GlobalAccelerator'
    const globalAcceleratorSGName = 'GlobalAccelerator';

    // How to reference the security group name in the response from EC2
    const ec2ResponseSGIdField = 'SecurityGroups.0.GroupId';

    // The AWS Custom Resource that make a call to EC2 to get the security group ID, for the given VPC
    const lookupAcceleratorSGCustomResource = new AwsCustomResource(scope, id + 'CustomResource', {
      onCreate: {
        service: 'EC2',
        action: 'describeSecurityGroups',
        parameters: {
          Filters: [
            {
              Name: 'group-name',
              Values: [
                globalAcceleratorSGName,
              ],
            },
            {
              Name: 'vpc-id',
              Values: [
                vpc.vpcId,
              ],
            },
          ],
        },
        // We get back a list of responses, but the list should be of length 0 or 1
        // Getting no response means no resources have been linked to the AGA
        physicalResourceId: PhysicalResourceId.fromResponse(ec2ResponseSGIdField),
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    // We add a dependency on the endpoint group, guaranteeing that CloudFormation won't
    // try and look up the SG before AGA creates it. The SG is created when a VPC resource
    // is associated with an AGA
    lookupAcceleratorSGCustomResource.node.addDependency(endpointGroup.node.defaultChild as CfnResource);

    // Look up the security group ID
    return new AcceleratorSecurityGroupPeer(lookupAcceleratorSGCustomResource.getResponseField(ec2ResponseSGIdField));
  }

  public readonly canInlineRule = false;
  public readonly connections: ec2.Connections = new ec2.Connections({ peer: this });
  public readonly uniqueId: string = 'GlobalAcceleratorGroup';

  private constructor(private readonly securityGroupId: string) {
  }

  public toIngressRuleConfig(): any {
    return { sourceSecurityGroupId: this.securityGroupId };
  }

  public toEgressRuleConfig(): any {
    return { destinationSecurityGroupId: this.securityGroupId };
  }
}
