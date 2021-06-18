import * as ec2 from '@aws-cdk/aws-ec2';
import { IResource, RemovalPolicy, Resource } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnDBSubnetGroup } from './neptune.generated';

/**
 * Interface for a subnet group.
 */
export interface ISubnetGroup extends IResource {
  /**
   * The name of the subnet group.
   * @attribute
   */
  readonly subnetGroupName: string;
}

/**
 * Properties for creating a SubnetGroup.
 */
export interface SubnetGroupProps {
  /**
   * Description of the subnet group.
   *
   * @default - a name is generated
   */
  readonly description?: string;

  /**
   * The VPC to place the subnet group in.
   */
  readonly vpc: ec2.IVpc;

  /**
   * The name of the subnet group.
   *
   * @default - a name is generated
   */
  readonly subnetGroupName?: string;

  /**
   * Which subnets within the VPC to associate with this group.
   *
   * @default - private subnets
   */
  readonly vpcSubnets?: ec2.SubnetSelection;

  /**
   * The removal policy to apply when the subnet group are removed
   * from the stack or replaced during an update.
   *
   * @default RemovalPolicy.DESTROY
   */
  readonly removalPolicy?: RemovalPolicy
}

/**
 * Class for creating a RDS DB subnet group
 *
 * @resource AWS::Neptune::DBSubnetGroup
 */
export class SubnetGroup extends Resource implements ISubnetGroup {
  /**
   * Imports an existing subnet group by name.
   */
  public static fromSubnetGroupName(scope: Construct, id: string, subnetGroupName: string): ISubnetGroup {
    return new class extends Resource implements ISubnetGroup {
      public readonly subnetGroupName = subnetGroupName;
    }(scope, id);
  }

  public readonly subnetGroupName: string;

  constructor(scope: Construct, id: string, props: SubnetGroupProps) {
    super(scope, id);

    const { subnetIds } = props.vpc.selectSubnets(props.vpcSubnets ?? { subnetType: ec2.SubnetType.PRIVATE });

    const subnetGroup = new CfnDBSubnetGroup(this, 'Resource', {
      dbSubnetGroupDescription: props.description || 'Subnet group for Neptune',
      dbSubnetGroupName: props.subnetGroupName,
      subnetIds,
    });

    if (props.removalPolicy) {
      subnetGroup.applyRemovalPolicy(props.removalPolicy);
    }

    this.subnetGroupName = subnetGroup.ref;
  }
}
