import * as net from 'net';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import { IResource, Resource, Token } from '@aws-cdk/core';
import { Construct } from 'constructs';
import {
  CfnCustomerGateway,
  CfnVPNConnection,
  CfnVPNConnectionRoute,
  CfnVPNGateway,
} from './ec2.generated';
import { IVpc, SubnetSelection } from './vpc';

export interface IVpnConnection extends IResource {
  /**
   * The id of the VPN connection.
   */
  readonly vpnId: string;

  /**
   * The id of the customer gateway.
   */
  readonly customerGatewayId: string;

  /**
   * The ip address of the customer gateway.
   */
  readonly customerGatewayIp: string;

  /**
   * The ASN of the customer gateway.
   */
  readonly customerGatewayAsn: number;
}

/**
 * The virtual private gateway interface
 */
export interface IVpnGateway extends IResource {

  /**
   * The virtual private gateway Id
   */
  readonly gatewayId: string
}

export interface VpnTunnelOption {
  /**
   * The pre-shared key (PSK) to establish initial authentication between the virtual
   * private gateway and customer gateway. Allowed characters are alphanumeric characters
   * and ._. Must be between 8 and 64 characters in length and cannot start with zero (0).
   *
   * @default an Amazon generated pre-shared key
   */
  readonly preSharedKey?: string;

  /**
   * The range of inside IP addresses for the tunnel. Any specified CIDR blocks must be
   * unique across all VPN connections that use the same virtual private gateway.
   * A size /30 CIDR block from the 169.254.0.0/16 range.
   *
   * @default an Amazon generated inside IP CIDR
   */
  readonly tunnelInsideCidr?: string;
}

export interface VpnConnectionOptions {
  /**
   * The ip address of the customer gateway.
   */
  readonly ip: string;

  /**
   * The ASN of the customer gateway.
   *
   * @default 65000
   */
  readonly asn?: number;

  /**
   * The static routes to be routed from the VPN gateway to the customer gateway.
   *
   * @default Dynamic routing (BGP)
   */
  readonly staticRoutes?: string[];

  /**
   * The tunnel options for the VPN connection. At most two elements (one per tunnel).
   * Duplicates not allowed.
   *
   * @default Amazon generated tunnel options
   */
  readonly tunnelOptions?: VpnTunnelOption[];
}

/**
 * The VpnGateway Properties
 */
export interface VpnGatewayProps {

  /**
   * Default type ipsec.1
   */
  readonly type: string;

  /**
   * Explicitly specify an Asn or let aws pick an Asn for you.
   * @default 65000
   */
  readonly amazonSideAsn?: number;
}

/**
 * Options for the Vpc.enableVpnGateway() method
 */
export interface EnableVpnGatewayOptions extends VpnGatewayProps {
  /**
   * Provide an array of subnets where the route propagation should be added.
   * @default noPropagation
   */
  readonly vpnRoutePropagation?: SubnetSelection[]
}

export interface VpnConnectionProps extends VpnConnectionOptions {
  /**
   * The VPC to connect to.
   */
  readonly vpc: IVpc;
}

/**
 * The VPN connection type.
 */
export enum VpnConnectionType {
  /**
   * The IPsec 1 VPN connection type.
   */
  IPSEC_1 = 'ipsec.1',

  /**
   * Dummy member
   * TODO: remove once https://github.com/aws/jsii/issues/231 is fixed
   */
  DUMMY = 'dummy'
}

/**
 * The VPN Gateway that shall be added to the VPC
 *
 * @resource AWS::EC2::VPNGateway
 */
export class VpnGateway extends Resource implements IVpnGateway {
  /**
   * The virtual private gateway Id
   */
  public readonly gatewayId: string;

  constructor(scope: Construct, id: string, props: VpnGatewayProps) {
    super(scope, id);

    // This is 'Default' instead of 'Resource', because using 'Default' will generate
    // a logical ID for a VpnGateway which is exactly the same as the logical ID that used
    // to be created for the CfnVPNGateway (and 'Resource' would not do that).
    const vpnGW = new CfnVPNGateway(this, 'Default', props);
    this.gatewayId = vpnGW.ref;
  }
}
/**
 * Define a VPN Connection
 *
 * @resource AWS::EC2::VPNConnection
 */
export class VpnConnection extends Resource implements IVpnConnection {
  /**
   * Return the given named metric for all VPN connections in the account/region.
   */
  public static metricAll(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return new cloudwatch.Metric({
      namespace: 'AWS/VPN',
      metricName,
      ...props,
    });
  }

  /**
   * Metric for the tunnel state of all VPN connections in the account/region.
   *
   * @default average over 5 minutes
   */
  public static metricAllTunnelState(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.metricAll('TunnelState', { statistic: 'avg', ...props });
  }

  /**
   * Metric for the tunnel data in of all VPN connections in the account/region.
   *
   * @default sum over 5 minutes
   */
  public static metricAllTunnelDataIn(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.metricAll('TunnelDataIn', { statistic: 'sum', ...props });
  }

  /**
   * Metric for the tunnel data out of all VPN connections.
   *
   * @default sum over 5 minutes
   */
  public static metricAllTunnelDataOut(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.metricAll('TunnelDataOut', { statistic: 'sum', ...props });
  }

  public readonly vpnId: string;
  public readonly customerGatewayId: string;
  public readonly customerGatewayIp: string;
  public readonly customerGatewayAsn: number;

  constructor(scope: Construct, id: string, props: VpnConnectionProps) {
    super(scope, id);

    if (!props.vpc.vpnGatewayId) {
      props.vpc.enableVpnGateway({
        type: 'ipsec.1',
        amazonSideAsn: props.asn,
      });
    }

    if (!Token.isUnresolved(props.ip) && !net.isIPv4(props.ip)) {
      throw new Error(`The \`ip\` ${props.ip} is not a valid IPv4 address.`);
    }

    const type = VpnConnectionType.IPSEC_1;
    const bgpAsn = props.asn || 65000;

    const customerGateway = new CfnCustomerGateway(this, 'CustomerGateway', {
      bgpAsn,
      ipAddress: props.ip,
      type,
    });

    this.customerGatewayId = customerGateway.ref;
    this.customerGatewayAsn = bgpAsn;
    this.customerGatewayIp = props.ip;

    // Validate tunnel options
    if (props.tunnelOptions) {
      if (props.tunnelOptions.length > 2) {
        throw new Error('Cannot specify more than two `tunnelOptions`');
      }

      if (props.tunnelOptions.length === 2 && props.tunnelOptions[0].tunnelInsideCidr === props.tunnelOptions[1].tunnelInsideCidr) {
        throw new Error(`Same ${props.tunnelOptions[0].tunnelInsideCidr} \`tunnelInsideCidr\` cannot be used for both tunnels.`);
      }

      props.tunnelOptions.forEach((options, index) => {
        if (options.preSharedKey && !Token.isUnresolved(options.preSharedKey) && !/^[a-zA-Z1-9._][a-zA-Z\d._]{7,63}$/.test(options.preSharedKey)) {
          /* eslint-disable max-len */
          throw new Error(`The \`preSharedKey\` ${options.preSharedKey} for tunnel ${index + 1} is invalid. Allowed characters are alphanumeric characters and ._. Must be between 8 and 64 characters in length and cannot start with zero (0).`);
          /* eslint-enable max-len */
        }

        if (options.tunnelInsideCidr) {
          if (RESERVED_TUNNEL_INSIDE_CIDR.includes(options.tunnelInsideCidr)) {
            throw new Error(`The \`tunnelInsideCidr\` ${options.tunnelInsideCidr} for tunnel ${index + 1} is a reserved inside CIDR.`);
          }

          if (!/^169\.254\.\d{1,3}\.\d{1,3}\/30$/.test(options.tunnelInsideCidr)) {
            /* eslint-disable-next-line max-len */
            throw new Error(`The \`tunnelInsideCidr\` ${options.tunnelInsideCidr} for tunnel ${index + 1} is not a size /30 CIDR block from the 169.254.0.0/16 range.`);
          }
        }
      });
    }

    const vpnConnection = new CfnVPNConnection(this, 'Resource', {
      type,
      customerGatewayId: customerGateway.ref,
      staticRoutesOnly: props.staticRoutes ? true : false,
      vpnGatewayId: props.vpc.vpnGatewayId,
      vpnTunnelOptionsSpecifications: props.tunnelOptions,
    });

    this.vpnId = vpnConnection.ref;

    if (props.staticRoutes) {
      props.staticRoutes.forEach(route => {
        new CfnVPNConnectionRoute(this, `Route${route.replace(/[^\d]/g, '')}`, {
          destinationCidrBlock: route,
          vpnConnectionId: this.vpnId,
        });
      });
    }
  }
}

export const RESERVED_TUNNEL_INSIDE_CIDR = [
  '169.254.0.0/30',
  '169.254.1.0/30',
  '169.254.2.0/30',
  '169.254.3.0/30',
  '169.254.4.0/30',
  '169.254.5.0/30',
  '169.254.169.252/30',
];
