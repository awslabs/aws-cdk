import { Duration, IResource, Lazy, Resource } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { IFirewallDomainList } from './firewall-domain-list';
import { FirewallRuleGroupAssociation, FirewallRuleGroupAssociationOptions } from './firewall-rule-group-association';
import { CfnFirewallRuleGroup } from './route53resolver.generated';

/**
 * A Firewall Rule Group
 */
export interface IFirewallRuleGroup extends IResource {
  /**
   * The ID of the rule group
   *
   * @attribute
   */
  readonly firewallRuleGroupId: string;
}

/**
 * Properties for a Firewall Rule Group
 */
export interface FirewallRuleGroupProps {
  /**
   * The name of the rule group.
   *
   * @default - a CloudFormation generated name
   */
  readonly name?: string;

  /**
   * A list of rules for this group
   *
   * @default - no rules
   */
  readonly rules?: FirewallRule[];
}

/**
 * A Firewall Rule
 */
export interface FirewallRule {
  /**
   * The action for this rule
   */
  readonly action: FirewallRuleAction;

  /**
   * The domain list for this rule
   */
  readonly firewallDomainList: IFirewallDomainList;

  /**
   * The priority of the rule in the rule group. This value must be unique within
   * the rule group.
   */
  readonly priority: number;
}

/**
 * A Firewall Rule
 */
export abstract class FirewallRuleAction {
  /**
   * Permit the request to go through
   */
  public static allow(): FirewallRuleAction {
    return { action: 'ALLOW' };
  }

  /**
   * Permit the request to go through but send an alert to the logs
   */
  public static alert(): FirewallRuleAction {
    return { action: 'ALERT' };
  }

  /**
   * Disallow the request
   *
   * @param [response=DnsBlockResponse.noData()] The way that you want DNS Firewall to block the request
   */
  public static block(response?: DnsBlockResponse): FirewallRuleAction {
    return {
      action: 'BLOCK',
      blockResponse: response ?? DnsBlockResponse.noData(),
    };
  }

  /**
   * The action that DNS Firewall should take on a DNS query when it matches
   * one of the domains in the rule's domain list
   */
  public abstract readonly action: string;

  /**
   * The way that you want DNS Firewall to block the request
   */
  public abstract readonly blockResponse?: DnsBlockResponse;
}

/**
 * The way that you want DNS Firewall to block the request
 */
export abstract class DnsBlockResponse {
  /**
   * Respond indicating that the query was successful, but no
   * response is available for it.
   */
  public static noData(): DnsBlockResponse {
    return { blockResponse: 'NODATA' };
  }

  /**
   * Respond indicating that the domain name that's in the query
   * doesn't exist.
   */
  public static nxDomain(): DnsBlockResponse {
    return { blockResponse: 'NXDOMAIN' };
  }

  /**
   * Provides a custom override response to the query
   *
   * @param domain The custom DNS record to send back in response to the query
   * @param [ttl=0] The recommended amount of time for the DNS resolver or
   *   web browser to cache the provided override record
   */
  public static override(domain: string, ttl?: Duration): DnsBlockResponse {
    return {
      blockResponse: 'OVERRIDE',
      blockOverrideDnsType: 'CNAME',
      blockOverrideDomain: domain,
      blockOverrideTtl: ttl ?? Duration.seconds(0),
    };
  }

  /** The DNS record's type */
  public abstract readonly blockOverrideDnsType?: string;

  /** The custom DNS record to send back in response to the query */
  public abstract readonly blockOverrideDomain?: string;

  /**
   * The recommended amount of time for the DNS resolver or
   * web browser to cache the provided override record
   */
  public abstract readonly blockOverrideTtl?: Duration;

  /** The way that you want DNS Firewall to block the request */
  public abstract readonly blockResponse?: string;
}

/**
 * A Firewall Rule Group
 */
export class FirewallRuleGroup extends Resource implements IFirewallRuleGroup {
  /**
   * Import an existing Firewall Rule Group
   */
  public static fromFirewallRuleGroupId(scope: Construct, id: string, firewallRuleGroupId: string): IFirewallRuleGroup {
    class Import extends Resource implements IFirewallRuleGroup {
      public readonly firewallRuleGroupId = firewallRuleGroupId;
    }
    return new Import(scope, id);
  }

  public readonly firewallRuleGroupId: string;

  /**
   * The ARN (Amazon Resource Name) of the rule group
   * @attribute
   */
  public readonly firewallRuleGroupArn: string;

  /**
   * The date and time that the rule group was created
   * @attribute
   */
  public readonly firewallRuleGroupCreationTime: string;

  /**
   * The creator request ID
   * @attribute
   */
  public readonly firewallRuleGroupCreatorRequestId: string;

  /**
   * The date and time that the rule group was last modified
   * @attribute
   */
  public readonly firewallRuleGroupModificationTime: string;

  /**
   * The AWS account ID for the account that created the rule group
   * @attribute
   */
  public readonly firewallRuleGroupOwnerId: string;

  /**
   * The number of rules in the rule group
   * @attribute
   */
  public readonly firewallRuleGroupRuleCount: number;

  /**
   * Whether the rule group is shared with other AWS accounts,
   * or was shared with the current account by another AWS account
   * @attribute
   */
  public readonly firewallRuleGroupShareStatus: string;

  /**
   * The status of the rule group
   * @attribute
   */
  public readonly firewallRuleGroupStatus: string;

  /**
   * Additional information about the status of the rule group
   * @attribute
   */
  public readonly firewallRuleGroupStatusMessage: string;

  private readonly rules: FirewallRule[];

  constructor(scope: Construct, id: string, props: FirewallRuleGroupProps = {}) {
    super(scope, id);

    this.rules = props.rules ?? [];

    const ruleGroup = new CfnFirewallRuleGroup(this, 'Resource', {
      name: props.name,
      firewallRules: Lazy.any({ produce: () => this.rules.map(renderRule) }),
    });

    this.firewallRuleGroupId = ruleGroup.attrId;
    this.firewallRuleGroupArn = ruleGroup.attrArn;
    this.firewallRuleGroupCreationTime = ruleGroup.attrCreationTime;
    this.firewallRuleGroupCreatorRequestId = ruleGroup.attrCreatorRequestId;
    this.firewallRuleGroupModificationTime = ruleGroup.attrModificationTime;
    this.firewallRuleGroupOwnerId = ruleGroup.attrOwnerId;
    this.firewallRuleGroupRuleCount = ruleGroup.attrRuleCount;
    this.firewallRuleGroupShareStatus = ruleGroup.attrShareStatus;
    this.firewallRuleGroupStatus = ruleGroup.attrStatus;
    this.firewallRuleGroupStatusMessage = ruleGroup.attrStatusMessage;
  }

  /**
   * Adds a rule to this group
   */
  public addRule(rule: FirewallRule): FirewallRuleGroup {
    this.rules.push(rule);
    return this;
  }

  /**
   * Associates this Firewall Rule Group with a VPC
   */
  public associate(id: string, props: FirewallRuleGroupAssociationOptions): FirewallRuleGroupAssociation {
    return new FirewallRuleGroupAssociation(this, id, {
      ...props,
      firewallRuleGroup: this,
    });
  }
}

function renderRule(rule: FirewallRule): CfnFirewallRuleGroup.FirewallRuleProperty {
  return {
    action: rule.action.action,
    firewallDomainListId: rule.firewallDomainList.firewallDomainListId,
    priority: rule.priority,
    blockOverrideDnsType: rule.action.blockResponse?.blockOverrideDnsType,
    blockOverrideDomain: rule.action.blockResponse?.blockOverrideDomain,
    blockOverrideTtl: rule.action.blockResponse?.blockOverrideTtl?.toSeconds(),
    blockResponse: rule.action.blockResponse?.blockResponse,
  };
}
