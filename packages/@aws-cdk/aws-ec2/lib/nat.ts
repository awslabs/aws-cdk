import iam = require('@aws-cdk/aws-iam');
import { Instance } from './instance';
import { InstanceType } from './instance-types';
import { IMachineImage, LookupMachineImage } from "./machine-image";
import { Port } from './port';
import { SecurityGroup } from './security-group';
import { PrivateSubnet, PublicSubnet, RouterType, Vpc } from './vpc';

/**
 * NAT providers
 *
 * Determines what type of NAT provider to create, either NAT gateways or NAT
 * instance.
 *
 * @experimental
 */
export abstract class NatProvider {
  /**
   * Use NAT Gateways to provide NAT services for your VPC
   *
   * NAT gateways are managed by AWS.
   *
   * @see https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html
   */
  public static gateway(): NatProvider {
    return new NatGateway();
  }

  /**
   * Use NAT instances to provide NAT services for your VPC
   *
   * NAT instances are managed by you, but in return allow more configuration.
   *
   * Be aware that instances created using this provider will not be
   * automatically replaced if they are stopped for any reason. You should implement
   * your own NatProvider based on AutoScaling groups if you need that.
   *
   * @see https://docs.aws.amazon.com/vpc/latest/userguide/VPC_NAT_Instance.html
   */
  public static instance(props: NatInstanceProps): NatProvider {
    return new NatInstance(props);
  }

  /**
   * Called by the VPC to configure NAT
   */
  public abstract configureNat(options: ConfigureNatOptions): void;
}

/**
 * Options passed by the VPC when NAT needs to be configured
 *
 * @experimental
 */
export interface ConfigureNatOptions {
  /**
   * The VPC we're configuring NAT for
   */
  vpc: Vpc;

  /**
   * The public subnets where the NAT providers need to be placed
   */
  natSubnets: PublicSubnet[];

  /**
   * The private subnets that need to route through the NAT providers.
   *
   * There may be more private subnets than public subnets with NAT providers.
   */
  privateSubnets: PrivateSubnet[];
}

/**
 * Properties for a NAT instance
 *
 * @experimental
 */
export interface NatInstanceProps {
  /**
   * The machine image (AMI) to use
   *
   * By default, will do an AMI lookup for the latest NAT instance image.
   *
   * If you have a specific AMI ID you want to use, pass a `GenericLinuxImage`. For example:
   *
   * ```ts
   * NatProvider.instance({
   *   instanceType: new InstanceType('t3.micro'),
   *   machineImage: new GenericLinuxImage({
   *     'us-east-2': 'ami-0f9c61b5a562a16af'
   *   })
   * })
   * ```
   *
   * @default - Latest NAT instance image
   */
  machineImage?: IMachineImage;

  /**
   * Instance type of the NAT instance
   */
  instanceType: InstanceType;

  /**
   * Name of SSH keypair to grant access to instance
   *
   * @default - No SSH access will be possible.
   */
  readonly keyName?: string;
}

class NatGateway extends NatProvider {
  public configureNat(options: ConfigureNatOptions) {
    // Create the NAT gateways
    const gatewayIds = new PrefSet<string>();
    for (const sub of options.natSubnets) {
      const gateway = sub.addNatGateway();
      gatewayIds.add(sub.availabilityZone, gateway.ref);
    }

    // Add routes to them in the private subnets
    for (const sub of options.privateSubnets) {
      sub.addRoute('DefaultRoute', {
        routerType: RouterType.NAT_GATEWAY,
        routerId: gatewayIds.pick(sub.availabilityZone),
        enablesInternetConnectivity: true,
      });
    }
  }
}

class NatInstance extends NatProvider {
  constructor(private readonly props: NatInstanceProps) {
    super();
  }

  public configureNat(options: ConfigureNatOptions) {
    // Create the NAT instances. They can share a security group and a Role.
    const instances = new PrefSet<Instance>();
    const machineImage = this.props.machineImage || new NatInstanceImage();
    const sg = new SecurityGroup(options.vpc, 'NatSecurityGroup', {
      vpc: options.vpc,
      description: 'Security Group for NAT instances',
    });
    sg.connections.allowFromAnyIpv4(Port.allTcp());

    // FIXME: Ideally, NAT instances don't have a role at all, but
    // 'Instance' does not allow that right now.
    const role = new iam.Role(options.vpc, 'NatRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
    });

    for (const sub of options.natSubnets) {
      const natInstance = new Instance(sub, 'NatInstance', {
        instanceType: this.props.instanceType,
        machineImage,
        sourceDestCheck: false,  // Required for NAT
        vpc: options.vpc,
        vpcSubnets: { subnets: [sub] },
        securityGroup: sg,
        role,
        keyName: this.props.keyName
      });
      // NAT instance routes all traffic, both ways
      instances.add(sub.availabilityZone, natInstance);
    }

    // Add routes to them in the private subnets
    for (const sub of options.privateSubnets) {
      sub.addRoute('DefaultRoute', {
        routerType: RouterType.INSTANCE,
        routerId: instances.pick(sub.availabilityZone).instanceId,
        enablesInternetConnectivity: true,
      });
    }
  }
}

/**
 * Preferential set
 *
 * Picks the value with the given key if available, otherwise distributes
 * evenly among the available options.
 */
class PrefSet<A> {
  private readonly map: Record<string, A> = {};
  private readonly vals = new Array<A>();
  private next: number = 0;

  public add(pref: string, value: A) {
    this.map[pref] = value;
    this.vals.push(value);
  }

  public pick(pref: string): A {
    if (this.vals.length === 0) {
      throw new Error('Cannot pick, set is empty');
    }

    if (pref in this.map) { return this.map[pref]; }
    return this.vals[this.next++ % this.vals.length];
  }
}

/**
 * Machine image representing the latest NAT instance image
 *
 * @experimental
 */
export class NatInstanceImage extends LookupMachineImage {
  constructor() {
    super({
      name: 'amzn-ami-vpc-nat-*',
      owners: ['amazon'],
    });
  }
}