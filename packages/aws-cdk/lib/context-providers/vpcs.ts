import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import * as cxapi from '@aws-cdk/cx-api';
import * as AWS from 'aws-sdk';
import { Mode, SdkProvider } from '../api';
import { debug } from '../logging';
import { ContextProviderPlugin } from './provider';

export class VpcNetworkContextProviderPlugin implements ContextProviderPlugin {
  constructor(private readonly aws: SdkProvider) {
  }

  public async getValue(args: cxschema.VpcContextQuery) {
    const account: string = args.account!;
    const region: string = args.region!;

    const options = { assumeRoleArn: args.lookupRoleArn };
    const ec2 = (await this.aws.forEnvironment(cxapi.EnvironmentUtils.make(account, region), Mode.ForReading, options)).ec2();

    const vpcId = await this.findVpc(ec2, args);

    return this.readVpcProps(ec2, vpcId, args);
  }

  private async findVpc(ec2: AWS.EC2, args: cxschema.VpcContextQuery): Promise<AWS.EC2.Vpc> {
    // Build request filter (map { Name -> Value } to list of [{ Name, Values }])
    const filters: AWS.EC2.Filter[] = Object.entries(args.filter).map(([tag, value]) => ({ Name: tag, Values: [value] }));

    debug(`Listing VPCs in ${args.account}:${args.region}`);
    const response = await ec2.describeVpcs({ Filters: filters }).promise();

    const vpcs = response.Vpcs || [];
    if (vpcs.length === 0) {
      throw new Error(`Could not find any VPCs matching ${JSON.stringify(args)}`);
    }
    if (vpcs.length > 1) {
      throw new Error(`Found ${vpcs.length} VPCs matching ${JSON.stringify(args)}; please narrow the search criteria`);
    }

    return vpcs[0];
  }

  private async readVpcProps(ec2: AWS.EC2, vpc: AWS.EC2.Vpc, args: cxschema.VpcContextQuery): Promise<cxapi.VpcContextResponse> {
    const vpcId = vpc.VpcId!;

    debug(`Describing VPC ${vpcId}`);

    const filters = { Filters: [{ Name: 'vpc-id', Values: [vpcId] }] };

    const subnetsResponse = await ec2.describeSubnets(filters).promise();
    const listedSubnets = subnetsResponse.Subnets || [];

    const routeTablesResponse = await ec2.describeRouteTables(filters).promise();
    const routeTables = new RouteTables(routeTablesResponse.RouteTables || []);

    // Now comes our job to separate these subnets out into AZs and subnet groups (Public, Private, Isolated)
    // We have the following attributes to go on:
    // - Type tag, we tag subnets with their type. In absence of this tag, we
    //   fall back to MapPublicIpOnLaunch => must be a Public subnet, anything
    //   else is considered Priate.
    // - Name tag, we tag subnets with their subnet group name. In absence of this tag,
    //   we use the type as the name.

    const azs = Array.from(new Set<string>(listedSubnets.map(s => s.AvailabilityZone!)));
    azs.sort();

    const subnets: Subnet[] = listedSubnets.map(subnet => {
      let type = getTag('aws-cdk:subnet-type', subnet.Tags);
      if (type === undefined && subnet.MapPublicIpOnLaunch) { type = SubnetType.Public; }
      if (type === undefined && routeTables.hasRouteToIgw(subnet.SubnetId)) { type = SubnetType.Public; }
      if (type === undefined) { type = SubnetType.Private; }

      if (!isValidSubnetType(type)) {
        // eslint-disable-next-line max-len
        throw new Error(`Subnet ${subnet.SubnetArn} has invalid subnet type ${type} (must be ${SubnetType.Public}, ${SubnetType.Private} or ${SubnetType.Isolated})`);
      }

      const name = getTag(args.subnetGroupNameTag || 'aws-cdk:subnet-name', subnet.Tags) || type;
      const routeTableId = routeTables.routeTableIdForSubnetId(subnet.SubnetId);

      if (!routeTableId) {
        throw new Error(`Subnet ${subnet.SubnetArn} does not have an associated route table (and there is no "main" table)`);
      }

      return {
        az: subnet.AvailabilityZone!,
        cidr: subnet.CidrBlock!,
        type,
        name,
        subnetId: subnet.SubnetId!,
        routeTableId,
      };
    });

    let grouped: SubnetGroups;
    let assymetricSubnetGroups: cxapi.VpcSubnetGroup[] | undefined;
    if (args.returnAsymmetricSubnets) {
      grouped = { azs: [], groups: [] };
      assymetricSubnetGroups = groupAsymmetricSubnets(subnets);
    } else {
      grouped = groupSubnets(subnets);
      assymetricSubnetGroups = undefined;
    }

    // Find attached+available VPN gateway for this VPC
    const vpnGatewayResponse = await ec2.describeVpnGateways({
      Filters: [
        {
          Name: 'attachment.vpc-id',
          Values: [vpcId],
        },
        {
          Name: 'attachment.state',
          Values: ['attached'],
        },
        {
          Name: 'state',
          Values: ['available'],
        },
      ],
    }).promise();
    const vpnGatewayId = vpnGatewayResponse.VpnGateways && vpnGatewayResponse.VpnGateways.length === 1
      ? vpnGatewayResponse.VpnGateways[0].VpnGatewayId
      : undefined;

    return {
      vpcId,
      vpcCidrBlock: vpc.CidrBlock!,
      availabilityZones: grouped.azs,
      isolatedSubnetIds: collapse(flatMap(findGroups(SubnetType.Isolated, grouped), group => group.subnets.map(s => s.subnetId))),
      isolatedSubnetNames: collapse(flatMap(findGroups(SubnetType.Isolated, grouped), group => group.name ? [group.name] : [])),
      isolatedSubnetRouteTableIds: collapse(flatMap(findGroups(SubnetType.Isolated, grouped), group => group.subnets.map(s => s.routeTableId))),
      privateSubnetIds: collapse(flatMap(findGroups(SubnetType.Private, grouped), group => group.subnets.map(s => s.subnetId))),
      privateSubnetNames: collapse(flatMap(findGroups(SubnetType.Private, grouped), group => group.name ? [group.name] : [])),
      privateSubnetRouteTableIds: collapse(flatMap(findGroups(SubnetType.Private, grouped), group => group.subnets.map(s => s.routeTableId))),
      publicSubnetIds: collapse(flatMap(findGroups(SubnetType.Public, grouped), group => group.subnets.map(s => s.subnetId))),
      publicSubnetNames: collapse(flatMap(findGroups(SubnetType.Public, grouped), group => group.name ? [group.name] : [])),
      publicSubnetRouteTableIds: collapse(flatMap(findGroups(SubnetType.Public, grouped), group => group.subnets.map(s => s.routeTableId))),
      vpnGatewayId,
      subnetGroups: assymetricSubnetGroups,
    };
  }
}

class RouteTables {
  public readonly mainRouteTable?: AWS.EC2.RouteTable;

  constructor(private readonly tables: AWS.EC2.RouteTable[]) {
    this.mainRouteTable = this.tables.find(table => !!table.Associations && table.Associations.some(assoc => !!assoc.Main));
  }

  public routeTableIdForSubnetId(subnetId: string | undefined): string | undefined {
    const table = this.tableForSubnet(subnetId);
    return (table && table.RouteTableId) || (this.mainRouteTable && this.mainRouteTable.RouteTableId);
  }

  /**
   * Whether the given subnet has a route to an IGW
   */
  public hasRouteToIgw(subnetId: string | undefined): boolean {
    const table = this.tableForSubnet(subnetId);

    return !!table && !!table.Routes && table.Routes.some(route => !!route.GatewayId && route.GatewayId.startsWith('igw-'));
  }

  public tableForSubnet(subnetId: string | undefined) {
    return this.tables.find(table => !!table.Associations && table.Associations.some(assoc => assoc.SubnetId === subnetId));
  }
}

/**
 * Return the value of a tag from a set of tags
 */
function getTag(name: string, tags?: AWS.EC2.Tag[]): string | undefined {
  for (const tag of tags || []) {
    if (tag.Key === name) {
      return tag.Value;
    }
  }
  return undefined;
}

/**
 * Group subnets of the same type together, and order by AZ
 */
function groupSubnets(subnets: Subnet[]): SubnetGroups {
  const grouping: {[key: string]: Subnet[]} = {};
  for (const subnet of subnets) {
    const key = [subnet.type, subnet.name].toString();
    if (!(key in grouping)) { grouping[key] = []; }
    grouping[key].push(subnet);
  }

  const groups = Object.values(grouping).map(sns => {
    sns.sort((a: Subnet, b: Subnet) => a.az.localeCompare(b.az));
    return {
      type: sns[0].type,
      name: sns[0].name,
      subnets: sns,
    };
  });

  const azs = groups[0].subnets.map(s => s.az);

  for (const group of groups) {
    const groupAZs = group.subnets.map(s => s.az);
    if (!arraysEqual(groupAZs, azs)) {
      throw new Error(`Not all subnets in VPC have the same AZs: ${groupAZs} vs ${azs}`);
    }
  }

  return { azs, groups };
}

function groupAsymmetricSubnets(subnets: Subnet[]): cxapi.VpcSubnetGroup[] {
  const grouping: { [key: string]: Subnet[] } = {};
  for (const subnet of subnets) {
    const key = [subnet.type, subnet.name].toString();
    if (!(key in grouping)) {
      grouping[key] = [];
    }
    grouping[key].push(subnet);
  }

  return Object.values(grouping).map(subnetArray => {
    subnetArray.sort((subnet1: Subnet, subnet2: Subnet) => subnet1.az.localeCompare(subnet2.az));

    return {
      name: subnetArray[0].name,
      type: subnetTypeToVpcSubnetType(subnetArray[0].type),
      subnets: subnetArray.map(subnet => ({
        subnetId: subnet.subnetId,
        cidr: subnet.cidr,
        availabilityZone: subnet.az,
        routeTableId: subnet.routeTableId,
      })),
    };
  });
}

function subnetTypeToVpcSubnetType(type: SubnetType): cxapi.VpcSubnetGroupType {
  switch (type) {
    case SubnetType.Isolated: return cxapi.VpcSubnetGroupType.ISOLATED;
    case SubnetType.Private: return cxapi.VpcSubnetGroupType.PRIVATE;
    case SubnetType.Public: return cxapi.VpcSubnetGroupType.PUBLIC;
  }
}

enum SubnetType {
  Public = 'Public',
  Private = 'Private',
  Isolated = 'Isolated'
}

function isValidSubnetType(val: string): val is SubnetType {
  return val === SubnetType.Public
    || val === SubnetType.Private
    || val === SubnetType.Isolated;
}

interface Subnet {
  az: string;
  cidr: string;
  type: SubnetType;
  name: string;
  routeTableId: string;
  subnetId: string;
}

interface SubnetGroup {
  type: SubnetType;
  name: string;
  subnets: Subnet[];
}

interface SubnetGroups {
  azs: string[];
  groups: SubnetGroup[];
}

function arraysEqual(as: string[], bs: string[]): boolean {
  if (as.length !== bs.length) { return false; }

  for (let i = 0; i < as.length; i++) {
    if (as[i] !== bs[i]) {
      return false;
    }
  }

  return true;
}

function findGroups(type: SubnetType, groups: SubnetGroups): SubnetGroup[] {
  return groups.groups.filter(g => g.type === type);
}

function flatMap<T, U>(xs: T[], fn: (x: T) => U[]): U[] {
  const ret = new Array<U>();
  for (const x of xs) {
    ret.push(...fn(x));
  }
  return ret;
}

function collapse<T>(xs: T[]): T[] | undefined {
  if (xs.length > 0) { return xs; }
  return undefined;
}
