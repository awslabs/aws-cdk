import { Resource } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { IClientVpnEndpoint } from './client-vpn-endpoint-types';
import { CfnClientVpnAuthorizationRule } from './ec2.generated';

/**
 * Options for a ClientVpnAuthorizationRule
 */
export interface ClientVpnAuthorizationRuleOptions {
  /**
   * The IPv4 address range, in CIDR notation, of the network for which access
   * is being authorized.
   */
  readonly cidr: string;

  /**
   * The ID of the group to grant access to, for example, the Active Directory
   * group or identity provider (IdP) group.
   *
   * @default - authorize all groups
   */
  readonly groupId?: string;

  /**
   * A brief description of the authorization rule.
   *
   * @default - no description
   */
  readonly description?: string;
}

/**
 * Properties for a ClientVpnAuthorizationRule
 */
export interface ClientVpnAuthorizationRuleProps extends ClientVpnAuthorizationRuleOptions {
  /**
   * The client VPN endpoint to which to add the rule.
   */
  readonly clientVpnEndoint: IClientVpnEndpoint;
}

/**
 * A client VPN authorization rule
 */
export class ClientVpnAuthorizationRule extends Resource {
  constructor(scope: Construct, id: string, props: ClientVpnAuthorizationRuleProps) {
    super(scope, id);

    new CfnClientVpnAuthorizationRule(this, 'Resource', {
      clientVpnEndpointId: props.clientVpnEndoint.endpointId,
      targetNetworkCidr: props.cidr,
      accessGroupId: props.groupId,
      authorizeAllGroups: !props.groupId,
      description: props.description,
    });
  }
}
