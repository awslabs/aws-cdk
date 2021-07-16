import { IVpc } from '@aws-cdk/aws-ec2';
import { Resource, Token } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { IFirewallRuleGroup } from './firewall-rule-group';
import { CfnFirewallRuleGroupAssociation } from './route53resolver.generated';

/**
 * Options for a Firewall Rule Group Association
 */
export interface FirewallRuleGroupAssociationOptions {
  /**
   * If enabled, this setting disallows modification or removal of the
   * association, to help prevent against accidentally altering DNS firewall
   * protections.
   *
   * @default true
   */
  readonly mutationProtection?: boolean;

  /**
   * The name of the association
   *
   * @default - a CloudFormation generated name
   */
  readonly name?: string;

  /**
   * The setting that determines the processing order of the rule group among
   * the rule groups that are associated with a single VPC. DNS Firewall filters VPC
   * traffic starting from rule group with the lowest numeric priority setting.
   *
   * This value must be greater than 100 and less than 9,000
   */
  readonly priority: number;

  /**
   * The VPC that to associate with the rule group.
   */
  readonly vpc: IVpc;
}

/**
 * Properties for a Firewall Rule Group Association
 */
export interface FirewallRuleGroupAssociationProps extends FirewallRuleGroupAssociationOptions {
  /**
   * The firewall rule group which must be associated
   */
  readonly firewallRuleGroup: IFirewallRuleGroup;
}

/**
 * A Firewall Rule Group Association
 */
export class FirewallRuleGroupAssociation extends Resource {
  /**
   * The ARN (Amazon Resource Name) of the association
   * @attribute
   */
  public readonly firewallRuleGroupAssociationArn: string;

  /**
    * The date and time that the association was created
    * @attribute
    */
  public readonly firewallRuleGroupAssociationCreationTime: string;

  /**
    * The creator request ID
    * @attribute
    */
  public readonly firewallRuleGroupAssociationCreatorRequestId: string;

  /**
   * The ID of the association
   *
   * @attribute
   */
  public readonly firewallRuleGroupAssociationId: string;

  /**
    * The owner of the association, used only for lists that are not managed by you.
    * If you use AWS Firewall Manager to manage your firewallls from DNS Firewall,
    * then this reports Firewall Manager as the managed owner.
    * @attribute
    */
  public readonly firewallRuleGroupAssociationManagedOwnerName: string;

  /**
    * The date and time that the association was last modified
    * @attribute
    */
  public readonly firewallRuleGroupAssociationModificationTime: string;

  /**
    * The status of the association
    * @attribute
    */
  public readonly firewallRuleGroupAssociationStatus: string;

  /**
    * Additional information about the status of the association
    * @attribute
    */
  public readonly firewallRuleGroupAssociationStatusMessage: string;

  constructor(scope: Construct, id: string, props: FirewallRuleGroupAssociationProps) {
    super(scope, id);

    if (!Token.isUnresolved(props.priority) && (props.priority <= 100 || props.priority >= 9000)) {
      throw new Error(`Priority must be greater than 100 and less than 9000, got ${props.priority}`);
    }

    const association = new CfnFirewallRuleGroupAssociation(this, 'Resource', {
      firewallRuleGroupId: props.firewallRuleGroup.firewallRuleGroupId,
      priority: props.priority,
      vpcId: props.vpc.vpcId,
    });

    this.firewallRuleGroupAssociationArn = association.attrArn;
    this.firewallRuleGroupAssociationCreationTime = association.attrCreationTime;
    this.firewallRuleGroupAssociationCreatorRequestId = association.attrCreatorRequestId;
    this.firewallRuleGroupAssociationId = association.attrId;
    this.firewallRuleGroupAssociationManagedOwnerName = association.attrManagedOwnerName;
    this.firewallRuleGroupAssociationModificationTime = association.attrModificationTime;
    this.firewallRuleGroupAssociationStatus = association.attrStatus;
    this.firewallRuleGroupAssociationStatusMessage = association.attrStatusMessage;
  }
}
