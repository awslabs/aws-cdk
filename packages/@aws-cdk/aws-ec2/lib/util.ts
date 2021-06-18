import { Construct } from 'constructs';
import { ISubnet, Subnet, SubnetType } from './vpc';

/**
 * Turn an arbitrary string into one that can be used as a CloudFormation identifier by stripping special characters
 *
 * (At the moment, no efforts are taken to prevent collisions, but we can add that later when it becomes necessary).
 */
export function slugify(x: string): string {
  return x.replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * The default names for every subnet type
 */
export function defaultSubnetName(type: SubnetType) {
  switch (type) {
    case SubnetType.PUBLIC: return 'Public';
    case SubnetType.PRIVATE: return 'Private';
    case SubnetType.ISOLATED: return 'Isolated';
  }
}

/**
 * Return a subnet name from its construct ID
 *
 * All subnet names look like NAME <> "Subnet" <> INDEX
 */
export function subnetGroupNameFromConstructId(subnet: ISubnet) {
  return subnet.node.id.replace(/Subnet\d+$/, '');
}

/**
 * Make the subnet construct ID from a name and number
 */
export function subnetId(name: string, i: number) {
  return `${name}Subnet${i + 1}`;
}

export class ImportSubnetGroup {
  private readonly subnetIds: string[];
  private readonly names: string[];
  private readonly routeTableIds: string[];
  private readonly groups: number;

  constructor(
    subnetIds: string[] | undefined,
    names: string[] | undefined,
    routeTableIds: string[] | undefined,
    type: SubnetType,
    private readonly availabilityZones: string[],
    idField: string,
    nameField: string,
    routeTableIdField: string) {
    this.subnetIds = subnetIds || [];
    this.routeTableIds = routeTableIds || [];
    this.groups = this.subnetIds.length / this.availabilityZones.length;

    if (Math.floor(this.groups) !== this.groups) {
      // eslint-disable-next-line max-len
      throw new Error(`Number of ${idField} (${this.subnetIds.length}) must be a multiple of availability zones (${this.availabilityZones.length}).`);
    }
    if (this.routeTableIds.length !== this.subnetIds.length && routeTableIds != null) {
      // We don't err if no routeTableIds were provided to maintain backwards-compatibility. See https://github.com/aws/aws-cdk/pull/3171
      /* eslint-disable max-len */
      throw new Error(`Number of ${routeTableIdField} (${this.routeTableIds.length}) must be equal to the amount of ${idField} (${this.subnetIds.length}).`);
    }

    this.names = this.normalizeNames(names, defaultSubnetName(type), nameField);
  }

  public import(scope: Construct): ISubnet[] {
    return range(this.subnetIds.length).map(i => {
      const k = Math.floor(i / this.availabilityZones.length);
      return Subnet.fromSubnetAttributes(scope, subnetId(this.names[k], i), {
        availabilityZone: this.pickAZ(i),
        subnetId: this.subnetIds[i],
        routeTableId: this.routeTableIds[i],
      });
    });
  }

  /**
   * Return a list with a name for every subnet
   */
  private normalizeNames(names: string[] | undefined, defaultName: string, fieldName: string) {
    // If not given, return default
    if (names === undefined || names.length === 0) {
      return [defaultName];
    }

    // If given, must match given subnets
    if (names.length !== this.groups) {
      throw new Error(`${fieldName} must have an entry for every corresponding subnet group, got: ${JSON.stringify(names)}`);
    }

    return names;
  }

  /**
   * Return the i'th AZ
   */
  private pickAZ(i: number) {
    return this.availabilityZones[i % this.availabilityZones.length];
  }
}

/**
 * Generate the list of numbers of [0..n)
 */
export function range(n: number): number[] {
  const ret: number[] = [];
  for (let i = 0; i < n; i++) {
    ret.push(i);
  }
  return ret;
}

/**
 * Return the union of table IDs from all selected subnets
 */
export function allRouteTableIds(subnets: ISubnet[]): string[] {
  const ret = new Set<string>();
  for (const subnet of subnets) {
    if (subnet.routeTable && subnet.routeTable.routeTableId) {
      ret.add(subnet.routeTable.routeTableId);
    }
  }
  return Array.from(ret);
}

export function flatten<A>(xs: A[][]): A[] {
  return Array.prototype.concat.apply([], xs);
}