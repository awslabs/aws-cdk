import { CidrBlock, NetworkUtils } from './network-util';
import { ISubnet } from './vpc';

/**
 * Contains logic which chooses a set of subnets from a larger list, in conjunction
 * with SubnetSelection, to determine where to place AWS resources such as VPC
 * endpoints, EC2 instances, etc.
 */
export abstract class SubnetFilter {
  /**
   * Chooses subnets which are in one of the given availability zones.
  */
  public static availabilityZones(availabilityZones: string[]): SubnetFilter {
    return new AvailabilityZoneSubnetFilter(availabilityZones);
  }

  /**
   * Chooses subnets such that there is at most one per availability zone.
  */
  public static onePerAz(): SubnetFilter {
    return new OnePerAZSubnetFilter();
  }

  /**
   * Chooses subnets which contain any of the specified IP addresses.
  */
  public static containsIpAddresses(ipv4addrs: string[]): SubnetFilter {
    return new ContainsIpAddressesSubnetFilter(ipv4addrs);
  }

  /**
   * Executes the subnet filtering logic, returning a filtered set of subnets.
   */
  public selectSubnets(_subnets: ISubnet[]): ISubnet[] {
    throw new Error('Cannot select subnets with an abstract SubnetFilter. `selectSubnets` needs to be implmemented.');
  }
}

/**
 * Chooses subnets which are in one of the given availability zones.
 */
class AvailabilityZoneSubnetFilter extends SubnetFilter {
  private readonly availabilityZones: string[];

  constructor(availabilityZones: string[]) {
    super();
    this.availabilityZones = availabilityZones;
  }

  /**
   * Executes the subnet filtering logic.
   */
  public selectSubnets(subnets: ISubnet[]): ISubnet[] {
    return subnets.filter(s => this.availabilityZones.includes(s.availabilityZone));
  }
}

/**
 * Chooses subnets such that there is at most one per availability zone.
 */
class OnePerAZSubnetFilter extends SubnetFilter {
  constructor() {
    super();
  }

  /**
   * Executes the subnet filtering logic.
   */
  public selectSubnets(subnets: ISubnet[]): ISubnet[] {
    return this.retainOnePerAz(subnets);
  }

  private retainOnePerAz(subnets: ISubnet[]): ISubnet[] {
    const azsSeen = new Set<string>();
    return subnets.filter(subnet => {
      if (azsSeen.has(subnet.availabilityZone)) { return false; }
      azsSeen.add(subnet.availabilityZone);
      return true;
    });
  }
}

/**
 * Chooses subnets which contain any of the specified IP addresses.
 */
class ContainsIpAddressesSubnetFilter extends SubnetFilter {
  private readonly ipAddresses: string[];

  constructor(ipAddresses: string[]) {
    super();
    this.ipAddresses = ipAddresses;
  }

  /**
   * Executes the subnet filtering logic.
   */
  public selectSubnets(subnets: ISubnet[]): ISubnet[] {
    return this.retainByIp(subnets, this.ipAddresses);
  }

  private retainByIp(subnets: ISubnet[], ips: string[]): ISubnet[] {
    const cidrBlockObjs = ips.map(ip => {
      const ipNum = NetworkUtils.ipToNum(ip);
      return new CidrBlock(ipNum, 32);
    });
    return subnets.filter(s => {
      const subnetCidrBlock = new CidrBlock(s.ipv4CidrBlock);
      return cidrBlockObjs.some(cidr => subnetCidrBlock.containsCidr(cidr));
    });
  }
}