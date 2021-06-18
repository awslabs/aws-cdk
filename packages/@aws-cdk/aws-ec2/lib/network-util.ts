/**
 * InvalidCidrRangeError is thrown when attempting to perform operations on a CIDR
 * range that is either not valid, or outside of the VPC size limits.
 */
export class InvalidCidrRangeError extends Error {
  constructor(cidr: string) {
    super(cidr + ' is not a valid VPC CIDR range (must be between /16 and /28)');
    // The following line is required for type checking of custom errors, and must be called right after super()
    // https://stackoverflow.com/questions/31626231/custom-error-class-in-typescript
    Object.setPrototypeOf(this, InvalidCidrRangeError.prototype);
  }
}

/**
 * NetworkUtils contains helpers to work with network constructs (subnets/ranges)
 */
export class NetworkUtils {
  /**
   * Validates an IPv4 string
   *
   * returns true of the string contains 4 numbers between 0-255 delimited by
   * a `.` character
   */
  public static validIp(ipAddress: string): boolean {
    const octets = ipAddress.split('.');
    if (octets.length !== 4) {
      return false;
    }
    return octets.map((octet: string) => parseInt(octet, 10)).
      filter((octet: number) => octet >= 0 && octet <= 255).length === 4;
  }

  /**
   * Converts a string IPv4 to a number
   *
   * takes an IP Address (e.g. 174.66.173.168) and converts to a number
   * (e.g 2923605416); currently only supports IPv4
   *
   * Uses the formula:
   * (first octet * 256³) + (second octet * 256²) + (third octet * 256) +
   * (fourth octet)
   *
   * @param  {string} the IP address (e.g. 174.66.173.168)
   * @returns {number} the integer value of the IP address (e.g 2923605416)
   */
  public static ipToNum(ipAddress: string): number {
    if (!this.validIp(ipAddress)) {
      throw new Error(`${ipAddress} is not valid`);
    }

    return ipAddress
      .split('.')
      .reduce(
        (p: number, c: string, i: number) => p + parseInt(c, 10) * 256 ** (3 - i),
        0,
      );
  }

  /**
   * Takes number and converts it to IPv4 address string
   *
   * Takes a number (e.g 2923605416) and converts it to an IPv4 address string
   * currently only supports IPv4
   *
   * @param  {number} the integer value of the IP address (e.g 2923605416)
   * @returns {string} the IPv4 address (e.g. 174.66.173.168)
   */
  public static numToIp(ipNum: number): string {
    // this all because bitwise math is signed
    let remaining = ipNum;
    const address = new Array<number>();
    for (let i = 0; i < 4; i++) {
      if (remaining !== 0) {
        address.push(Math.floor(remaining / 256 ** (3 - i)));
        remaining = remaining % 256 ** (3 - i);
      } else {
        address.push(0);
      }
    }
    const ipAddress: string = address.join('.');
    if ( !this.validIp(ipAddress) ) {
      throw new Error(`${ipAddress} is not a valid IP Address`);
    }
    return ipAddress;
  }
}

/**
 * Creates a network based on a CIDR Block to build contained subnets
 */
export class NetworkBuilder {
  /**
   * The CIDR range used when creating the network
   */
  public readonly networkCidr: CidrBlock;

  /**
   * The list of CIDR blocks for subnets within this network
   */
  private readonly subnetCidrs: CidrBlock[] = [];

  /**
   * The next available IP address as a number
   */
  private nextAvailableIp: number;

  /**
   * Create a network using the provided CIDR block
   *
   * No subnets are allocated in the constructor, the maxIpConsumed is set one
   * less than the first IP in the network
   *
   */
  constructor(cidr: string) {
    this.networkCidr = new CidrBlock(cidr);
    this.subnetCidrs = [];
    this.nextAvailableIp = this.networkCidr.minAddress();
  }

  /**
   * Add a subnet to the network and update the maxIpConsumed
   */
  public addSubnet(mask: number): string {
    return this.addSubnets(mask, 1)[0];
  }

  /**
   * Add {count} number of subnets to the network and update the maxIpConsumed
   */
  public addSubnets(mask: number, count: number = 1): string[] {
    if (mask < 16 || mask > 28 ) {
      throw new InvalidCidrRangeError(`x.x.x.x/${mask}`);
    }
    const maxIp = this.nextAvailableIp + (CidrBlock.calculateNetsize(mask) * count);
    if (this.networkCidr.maxAddress() < maxIp - 1) {
      throw new Error(`${count} of /${mask} exceeds remaining space of ${this.networkCidr.cidr}`);
    }
    const subnets: CidrBlock[] = [];
    for (let i = 0; i < count; i ++) {
      const subnet: CidrBlock = new CidrBlock(this.nextAvailableIp, mask);
      this.nextAvailableIp = subnet.nextBlock().minAddress();
      this.subnetCidrs.push(subnet);
      subnets.push(subnet);
    }
    return subnets.map((subnet) => (subnet.cidr));
  }

  /**
   * return the CIDR notation strings for all subnets in the network
   */
  public get cidrStrings(): string[] {
    return this.subnetCidrs.map((subnet) => (subnet.cidr));
  }

  /**
   * Calculates the largest subnet to create of the given count from the
   * remaining IP space
   */
  public maskForRemainingSubnets(subnetCount: number): number {
    const remaining: number = this.networkCidr.maxAddress() - this.nextAvailableIp + 1;
    const ipsPerSubnet: number = Math.floor(remaining / subnetCount);
    return 32 - Math.floor(Math.log2(ipsPerSubnet));
  }
}

/**
 * A block of IP address space with a given bit prefix
 */
export class CidrBlock {
  /**
   * Calculates the netmask for a given CIDR mask
   *
   * For example:
   * CidrBlock.calculateNetmask(24) returns '255.255.255.0'
   */
  public static calculateNetmask(mask: number): string {
    return NetworkUtils.numToIp(2 ** 32 - 2 ** (32 - mask));
  }

  /**
   * Calculates the number IP addresses in a CIDR Mask
   *
   * For example:
   * CidrBlock.calculateNetsize(24) returns 256
   */
  public static calculateNetsize(mask: number): number {
    return 2 ** (32 - mask);
  }

  /*
   * The CIDR Block represented as a string e.g. '10.0.0.0/21'
   */
  public readonly cidr: string;

  /*
   * The CIDR mask e.g. for CIDR '10.0.0.0/21' returns 21
   */
  public readonly mask: number;

  /*
   * The total number of IP addresses in the CIDR
   */
  public readonly networkSize: number;

  /*
   * The network address provided in CIDR creation offset by the Netsize -1
   */
  private readonly networkAddress: number;

  /*
   * Parses either CIDR notation String or two numbers representing the IP
   * space
   *
   * cidr expects a string '10.0.0.0/16'
   * ipAddress expects a number
   * mask expects a number
   *
   * If the given `cidr` or `ipAddress` is not the beginning of the block,
   * then the next available block will be returned. For example, if
   * `10.0.3.1/28` is given the returned block will represent `10.0.3.16/28`.
   */
  constructor(cidr: string)
  constructor(ipAddress: number, mask: number)
  constructor(ipAddressOrCidr: string | number, mask?: number) {
    if (typeof ipAddressOrCidr === 'string') {
      this.mask = parseInt(ipAddressOrCidr.split('/')[1], 10);
      this.networkAddress = NetworkUtils.ipToNum(ipAddressOrCidr.split('/')[0]) +
        CidrBlock.calculateNetsize(this.mask) - 1;
    } else {
      if (typeof mask === 'number') {
        this.mask = mask;
      } else {
        // this should be impossible
        this.mask = 16;
      }
      this.networkAddress = ipAddressOrCidr + CidrBlock.calculateNetsize(this.mask) - 1;
      this.networkSize = 2 ** (32 - this.mask);
    }
    this.networkSize = 2 ** (32 - this.mask);
    this.cidr = `${this.minIp()}/${this.mask}`;
  }

  /*
   * The maximum IP in the CIDR Block e.g. '10.0.8.255'
   */
  public maxIp(): string {
    // min + (2^(32-mask)) - 1 [zero needs to count]
    return NetworkUtils.numToIp(this.maxAddress());
  }

  /*
   * The minimum IP in the CIDR Block e.g. '10.0.0.0'
   */
  public minIp(): string {
    return NetworkUtils.numToIp(this.minAddress());
  }

  /*
   * Returns the number representation for the minimum IPv4 address
   */
  public minAddress(): number {
    const div = this.networkAddress % this.networkSize;
    return this.networkAddress - div;
  }

  /*
   * Returns the number representation for the maximum IPv4 address
   */
  public maxAddress(): number {
    // min + (2^(32-mask)) - 1 [zero needs to count]
    return this.minAddress() + this.networkSize - 1;
  }

  /*
   * Returns the next CIDR Block of the same mask size
   */
  public nextBlock(): CidrBlock {
    return new CidrBlock(this.maxAddress() + 1, this.mask);
  }

  /*
   * Returns true if this CidrBlock fully contains the provided CidrBlock
   */
  public containsCidr(other: CidrBlock): boolean {
    return (this.maxAddress() >= other.maxAddress()) &&
      (this.minAddress() <= other.minAddress());
  }
}
