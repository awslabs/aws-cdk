import cdk = require('@aws-cdk/cdk');
import cxapi = require('@aws-cdk/cx-api');
import { HostedZoneRef, HostedZoneRefProps } from './hosted-zone-ref';

/**
 * Zone properties for looking up the Hosted Zone
 */
export interface HostedZoneProviderProps {
  /**
   * The zone domain e.g. example.com
   */
  domainName: string;

  /**
   * Is this a private zone
   */
  privateZone?: boolean;

  /**
   * If this is a private zone which VPC is assocaitated
   */
  vpcId?: string;
}

const DEFAULT_HOSTED_ZONE: cxapi.HostedZoneContextResponse = {
  Id: '/hostedzone/DUMMY',
  Name: 'example.com',
};

/**
 * Context provider that will lookup the Hosted Zone ID for the given arguments
 */
export class HostedZoneProvider {
  private provider: cdk.ContextProvider;
  constructor(context: cdk.Construct, props: HostedZoneProviderProps) {
    this.provider = new cdk.ContextProvider(context, cxapi.HOSTED_ZONE_PROVIDER, props);
  }

  /**
   * This method calls `findHostedZone` and returns the imported `HostedZoneRef`
   */
  public findAndImport(parent: cdk.Construct, id: string): HostedZoneRef {
    return HostedZoneRef.import(parent, id, this.findHostedZone());
  }
  /**
   * Return the hosted zone meeting the filter
   */
  public findHostedZone(): HostedZoneRefProps {
    const zone = this.provider.getValue(DEFAULT_HOSTED_ZONE) as cxapi.HostedZoneContextResponse;
    // CDK handles the '.' at the end, so remove it here
    if (zone.Name.endsWith('.')) {
      zone.Name = zone.Name.substring(0, zone.Name.length - 1);
    }
    return {
      hostedZoneId: zone.Id,
      zoneName: zone.Name,
    };
  }
}