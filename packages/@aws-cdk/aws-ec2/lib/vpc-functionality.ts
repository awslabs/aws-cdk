import { Token } from '@aws-cdk/core';
import { CfnVPC, CfnVPCCidrBlock } from './ec2.generated';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';

/**
 * Encapsulates the creation of a low-level VPC resource
 */
export interface IVpcResourceCreator {

  /**
   * The primary CIDR block for the VPC
   */
  readonly primaryCidrBlock: string;

  /**
   * Any secondary CIDR blocks for the VPC
   */
  readonly secondaryCidrBlocks: string[],

  /**
   * Indicates if instances launched in this VPC will have public DNS hostnames.
   */
  readonly dnsHostnamesEnabled: boolean;

  /**
   * Indicates if DNS support is enabled for this VPC.
   */
  readonly dnsSupportEnabled: boolean;

  /**
   * Create the VPC resource using the provided properties
   */
  create(scope: CoreConstruct): CfnVPC;
}

/**
 * The input parameters for the default strategy for creating a low-level VPC resource
 */
export interface DefaultVpcResourceCreatorProps {

  /**
   * The primary CIDR block for the VPC
   * @default - 10.0.0.0/16
   */
  readonly primaryCidrBlock?: string,

  /**
   * Any secondary CIDR blocks for the VPC
   * @default - no secondary blocks
   */
  readonly secondaryCidrBlocks?: string[],

  /**
   * Whether to enable DNS hostnames
   * @default - true
   */
  readonly enableDnsHostnames?: boolean,

  /**
   * Whether to enable DNS in the VPC
   * @default - true
   */
  readonly enableDnsSupport?: boolean,

  /**
   * Default instance tenancy for the VPC
   * @default - shared tenancy
   */
  readonly defaultInstanceTenancy?: string
}

/**
 * The default strategy for creating a low-level VPC resource
 */
export class DefaultVpcResourceCreator implements IVpcResourceCreator {

  private static readonly DEFAULT_CIDR_RANGE: string = '10.0.0.0/16';
  private readonly props: DefaultVpcResourceCreatorProps;

  /**
   * The primary CIDR block for the VPC
   */
  public readonly primaryCidrBlock: string;

  /**
   * Any secondary CIDR blocks for the VPC
   */
  public readonly secondaryCidrBlocks: string[];

  /**
   * Indicates if instances launched in this VPC will have public DNS hostnames.
   */
  public readonly dnsHostnamesEnabled: boolean;

  /**
   * Indicates if DNS support is enabled for this VPC.
   */
  public readonly dnsSupportEnabled: boolean;

  constructor(props: DefaultVpcResourceCreatorProps) {
    this.props = this.reifyDefaults(props);
    this.primaryCidrBlock = this.props.primaryCidrBlock!;
    this.secondaryCidrBlocks = this.props.secondaryCidrBlocks!;
    this.dnsHostnamesEnabled = this.props.enableDnsHostnames!;
    this.dnsSupportEnabled = this.props.enableDnsSupport!;
  }

  /**
   * Do sanity checking and implement default values
   */
  protected reifyDefaults(props: DefaultVpcResourceCreatorProps): DefaultVpcResourceCreatorProps {
    const newProps = { ...props };

    // Can't have enableDnsHostnames without enableDnsSupport
    if (props.enableDnsHostnames && !props.enableDnsSupport) {
      throw new Error('To use DNS Hostnames, DNS Support must be enabled, however, it was explicitly disabled.');
    }
    // Resources for the CfnVPC
    newProps.primaryCidrBlock = props.primaryCidrBlock ?? DefaultVpcResourceCreator.DEFAULT_CIDR_RANGE; // Default CIDR block is 10.0.0.0/16
    newProps.enableDnsSupport = props.enableDnsSupport ?? true; // DNS support enabled by default
    newProps.enableDnsHostnames = props.enableDnsHostnames ?? true ; // DNS hostnames supported by default
    newProps.defaultInstanceTenancy = props.defaultInstanceTenancy ?? 'default'; // Default instance tenancy is shared

    // To create secondary CIDR blocks
    newProps.secondaryCidrBlocks = props.secondaryCidrBlocks ?? []; // No secondary CIDR blocks by default

    // Can't use a token for a CIDR block.
    if (Token.isUnresolved(newProps.primaryCidrBlock)) {
      throw new Error('\'cidr\' property must be a concrete CIDR string, got a Token (we need to parse it for automatic subdivision)');
    }

    return newProps;
  }

  /**
   * Create any secondary CIDR blocks provided
   */
  protected createSecondaryCidrBlocks(scope: CoreConstruct, vpc: CfnVPC, cidrBlocks: string[]): CfnVPCCidrBlock[] {
    let blocks: CfnVPCCidrBlock[] = [];
    cidrBlocks.forEach((cidr) => {
      const suffix = cidr.replace('.', '_').replace('/', '__');
      const name = `SecondaryCidrBlock_${suffix}`; // Name is e.g. SecondaryCidrBlock_10_1_0_0__16
      const block = new CfnVPCCidrBlock(scope, name, {
        vpcId: vpc.ref,
        cidrBlock: cidr,
      });
      blocks.push(block);
    });
    return blocks;
  }

  /**
   * Create the VPC resource using the provided properties
   */
  public create(scope: CoreConstruct): CfnVPC {
    const vpc = new CfnVPC(scope, 'Resource', {
      cidrBlock: this.props.primaryCidrBlock!,
      enableDnsHostnames: this.props.enableDnsHostnames!,
      enableDnsSupport: this.props.enableDnsSupport!,
      instanceTenancy: this.props.defaultInstanceTenancy!,
    });
    this.createSecondaryCidrBlocks(scope, vpc, this.props.secondaryCidrBlocks!);
    return vpc;
  }
}