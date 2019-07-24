import cdk = require('@aws-cdk/core');
import { ISubnet, SelectedSubnets, Subnet, SubnetType } from './vpc';

/**
 * Turn an arbitrary string into one that can be used as a CloudFormation identifier by stripping special characters
 *
 * (At the moment, no efforts are taken to prevent collissions, but we can add that later when it becomes necessary).
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
    case SubnetType.ISOLATED: return  'Isolated';
  }
}

/**
 * Return a subnet name from its construct ID
 *
 * All subnet names look like NAME <> "Subnet" <> INDEX
 */
export function subnetName(subnet: ISubnet) {
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

  private readonly warning?: string;

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
      // tslint:disable-next-line:max-line-length
      throw new Error(`Amount of ${idField} (${this.subnetIds.length}) must be a multiple of availability zones (${this.availabilityZones.length}).`);
    }
    if (this.routeTableIds.length !== this.subnetIds.length) {
      if (routeTableIds == null) {
        // Maintaining backwards-compatibility - this used to not be provided by the VPC Context Provider!
        // tslint:disable-next-line: max-line-length
        this.warning = `No routeTableIds were provided for subnets ${this.subnetIds.join(', ')}! Calling .routeTableId on these subnets will return undefined/null!`;
      } else {
        // tslint:disable-next-line: max-line-length
        throw new Error(`Amount of ${routeTableIdField} (${this.routeTableIds.length}) must be equal to the amount of ${idField} (${this.subnetIds.length}).`);
      }
    }

    this.names = this.normalizeNames(names, defaultSubnetName(type), nameField);
  }

  public import(scope: cdk.Construct): ISubnet[] {
    if (this.warning && this.subnetIds.length > 0) {
      scope.node.addWarning(this.warning);
    }
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
export function allRouteTableIds(...ssns: SelectedSubnets[]): string[] {
  const ret = new Set<string>();
  for (const ssn of ssns) {
    for (const subnet of ssn.subnets) {
      if (subnet.routeTable) {
        ret.add(subnet.routeTable.routeTableId);
      }
    }
  }
  return Array.from(ret);
}
