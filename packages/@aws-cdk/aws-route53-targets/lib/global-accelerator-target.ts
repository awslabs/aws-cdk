import * as globalaccelerator from '@aws-cdk/aws-globalaccelerator';
import * as route53 from '@aws-cdk/aws-route53';


/**
 * Use a Global Accelerator domain name as an alias record target.
 */
export class GlobalAcceleratorDomainTarget implements route53.IAliasRecordTarget {
  /**
   * The hosted zone Id if using an alias record in Route53.
   * This value never changes.
   * Ref: https://docs.aws.amazon.com/general/latest/gr/global_accelerator.html
   */
  public static readonly GLOBAL_ACCELERATOR_ZONE_ID = 'Z2BJ6XQ5FK7U4H';

  /**
   * Create an Alias Target for a Global Accelerator domain name.
   */
  constructor(private readonly acceleratorDomainName: string) {
  }

  bind(_record: route53.IRecordSet, _zone?: route53.IHostedZone): route53.AliasRecordTargetConfig {
    return {
      hostedZoneId: GlobalAcceleratorTarget.GLOBAL_ACCELERATOR_ZONE_ID,
      dnsName: this.acceleratorDomainName,
    };
  }
}

/**
 * Use a Global Accelerator instance domain name as an alias record target.
 */
export class GlobalAcceleratorTarget extends GlobalAcceleratorDomainTarget {
  /**
   * Create an Alias Target for a Global Accelerator instance.
   */
  constructor(accelerator: globalaccelerator.IAccelerator) {
    super(accelerator.dnsName);
  }
}
