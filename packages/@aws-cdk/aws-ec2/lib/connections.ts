import { IPeer, Peer } from './peer';
import { Port } from './port';
import { ISecurityGroup } from './security-group';

/**
 * The goal of this module is to make possible to write statements like this:
 *
 *  ```ts
 *  database.connections.allowFrom(fleet);
 *  fleet.connections.allowTo(database);
 *  rdgw.connections.allowFromCidrIp('0.3.1.5/86');
 *  rgdw.connections.allowTrafficTo(fleet, new AllPorts());
 *  ```
 *
 * The insight here is that some connecting peers have information on what ports should
 * be involved in the connection, and some don't.
 */

/**
 * An object that has a Connections object
 */
export interface IConnectable {
  /**
   * The network connections associated with this resource.
   */
  readonly connections: Connections;
}

/**
 * Properties to intialize a new Connections object
 */
export interface ConnectionsProps {
  /**
   * Class that represents the rule by which others can connect to this connectable
   *
   * This object is required, but will be derived from securityGroup if that is passed.
   *
   * @default Derived from securityGroup if set.
   */
  readonly peer?: IPeer;

  /**
   * What securityGroup(s) this object is managing connections for
   *
   * @default No security groups
   */
  readonly securityGroups?: ISecurityGroup[];

  /**
   * Default port range for initiating connections to and from this object
   *
   * @default - No default port
   */
  readonly defaultPort?: Port;
}

/**
 * Manage the allowed network connections for constructs with Security Groups.
 *
 * Security Groups can be thought of as a firewall for network-connected
 * devices. This class makes it easy to allow network connections to and
 * from security groups, and between security groups individually. When
 * establishing connectivity between security groups, it will automatically
 * add rules in both security groups
 *
 * This object can manage one or more security groups.
 */
export class Connections implements IConnectable {
  public readonly connections: Connections;

  /**
   * The default port configured for this connection peer, if available
   */
  public readonly defaultPort?: Port;

  /**
   * Underlying securityGroup for this Connections object, if present
   *
   * May be empty if this Connections object is not managing a SecurityGroup,
   * but simply representing a Connectable peer.
   */
  private readonly _securityGroups = new ReactiveList<ISecurityGroup>();

  /**
   * The rule that defines how to represent this peer in a security group
   */
  private readonly _securityGroupRules = new ReactiveList<IPeer>();

  /**
   * When doing bidirectional grants between Connections, make sure we don't recursive infinitely
   */
  private skip: boolean = false;

  /**
   * When doing bidirectional grants between Security Groups in different stacks, put the rule on the other SG
   */
  private remoteRule: boolean = false;

  constructor(props: ConnectionsProps = {}) {
    this.connections = this;
    this._securityGroups.push(...(props.securityGroups || []));

    this._securityGroupRules.push(...this._securityGroups.asArray());
    if (props.peer) {
      this._securityGroupRules.push(props.peer);
    }

    this.defaultPort = props.defaultPort;
  }

  public get securityGroups(): ISecurityGroup[] {
    return this._securityGroups.asArray();
  }

  /**
   * Add a security group to the list of security groups managed by this object
   */
  public addSecurityGroup(...securityGroups: ISecurityGroup[]) {
    for (const securityGroup of securityGroups) {
      this._securityGroups.push(securityGroup);
      this._securityGroupRules.push(securityGroup);
    }
  }

  /**
   * Allow connections to the peer on the given port
   */
  public allowTo(other: IConnectable, portRange: Port, description?: string) {
    if (this.skip) { return; }

    const remoteRule = this.remoteRule; // Capture current value into local for callback to close over
    this._securityGroups.forEachAndForever(securityGroup => {
      other.connections._securityGroupRules.forEachAndForever(rule => {
        securityGroup.addEgressRule(rule, portRange, description, remoteRule);
      });
    });

    this.skip = true;
    other.connections.remoteRule = true;
    try {
      other.connections.allowFrom(this, portRange, description);
    } finally {
      this.skip = false;
      other.connections.remoteRule = false;
    }
  }

  /**
   * Allow connections from the peer on the given port
   */
  public allowFrom(other: IConnectable, portRange: Port, description?: string) {
    if (this.skip) { return; }

    const remoteRule = this.remoteRule; // Capture current value into local for callback to close over
    this._securityGroups.forEachAndForever(securityGroup => {
      other.connections._securityGroupRules.forEachAndForever(rule => {
        securityGroup.addIngressRule(rule, portRange, description, remoteRule);
      });
    });

    this.skip = true;
    other.connections.remoteRule = true;
    try {
      other.connections.allowTo(this, portRange, description);
    } finally {
      this.skip = false;
      other.connections.remoteRule = false;
    }
  }

  /**
   * Allow hosts inside the security group to connect to each other on the given port
   */
  public allowInternally(portRange: Port, description?: string) {
    this._securityGroups.forEachAndForever(securityGroup => {
      this._securityGroupRules.forEachAndForever(rule => {
        securityGroup.addIngressRule(rule, portRange, description);
        securityGroup.addEgressRule(rule, portRange, description);
      });
    });
  }

  /**
   * Allow to all IPv4 ranges
   */
  public allowToAnyIpv4(portRange: Port, description?: string) {
    this.allowTo(Peer.anyIpv4(), portRange, description);
  }

  /**
   * Allow from any IPv4 ranges
   */
  public allowFromAnyIpv4(portRange: Port, description?: string) {
    this.allowFrom(Peer.anyIpv4(), portRange, description);
  }

  /**
   * Allow connections from the peer on our default port
   *
   * Even if the peer has a default port, we will always use our default port.
   */
  public allowDefaultPortFrom(other: IConnectable, description?: string) {
    if (!this.defaultPort) {
      throw new Error('Cannot call allowDefaultPortFrom(): this resource has no default port');
    }
    this.allowFrom(other, this.defaultPort, description);
  }

  /**
   * Allow hosts inside the security group to connect to each other
   */
  public allowDefaultPortInternally(description?: string) {
    if (!this.defaultPort) {
      throw new Error('Cannot call allowDefaultPortInternally(): this resource has no default port');
    }
    this.allowInternally(this.defaultPort, description);
  }

  /**
   * Allow default connections from all IPv4 ranges
   */
  public allowDefaultPortFromAnyIpv4(description?: string) {
    if (!this.defaultPort) {
      throw new Error('Cannot call allowDefaultPortFromAnyIpv4(): this resource has no default port');
    }
    this.allowFromAnyIpv4(this.defaultPort, description);
  }

  /**
   * Allow connections to the security group on their default port
   */
  public allowToDefaultPort(other: IConnectable, description?: string) {
    if (other.connections.defaultPort === undefined) {
      throw new Error('Cannot call allowToDefaultPort(): other resource has no default port');
    }

    this.allowTo(other, other.connections.defaultPort, description);
  }

  /**
   * Allow connections from the peer on our default port
   *
   * Even if the peer has a default port, we will always use our default port.
   */
  public allowDefaultPortTo(other: IConnectable, description?: string) {
    if (!this.defaultPort) {
      throw new Error('Cannot call allowDefaultPortTo(): this resource has no default port');
    }
    this.allowTo(other, this.defaultPort, description);
  }
}

type Action<T> = (x: T) => void;

class ReactiveList<T> {
  private readonly elements = new Array<T>();
  private readonly listeners = new Array<Action<T>>();

  public push(...xs: T[]) {
    this.elements.push(...xs);
    for (const listener of this.listeners) {
      for (const x of xs) {
        listener(x);
      }
    }
  }

  public forEachAndForever(listener: Action<T>) {
    for (const element of this.elements) {
      listener(element);
    }
    this.listeners.push(listener);
  }

  public asArray(): T[] {
    return this.elements.slice();
  }

  public get length(): number {
    return this.elements.length;
  }
}
