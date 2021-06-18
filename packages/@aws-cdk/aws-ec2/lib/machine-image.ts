import * as ssm from '@aws-cdk/aws-ssm';
import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import { ContextProvider, CfnMapping, Aws, Stack, Token } from '@aws-cdk/core';
import * as cxapi from '@aws-cdk/cx-api';
import { UserData } from './user-data';
import { WindowsVersion } from './windows-versions';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/**
 * Interface for classes that can select an appropriate machine image to use
 */
export interface IMachineImage {
  /**
   * Return the image to use in the given context
   */
  getImage(scope: Construct): MachineImageConfig;
}

/**
 * Factory functions for standard Amazon Machine Image objects.
 */
export abstract class MachineImage {
  /**
   * A Windows image that is automatically kept up-to-date
   *
   * This Machine Image automatically updates to the latest version on every
   * deployment. Be aware this will cause your instances to be replaced when a
   * new version of the image becomes available. Do not store stateful information
   * on the instance if you are using this image.
   */
  public static latestWindows(version: WindowsVersion, props?: WindowsImageProps): IMachineImage {
    return new WindowsImage(version, props);
  }

  /**
   * An Amazon Linux image that is automatically kept up-to-date
   *
   * This Machine Image automatically updates to the latest version on every
   * deployment. Be aware this will cause your instances to be replaced when a
   * new version of the image becomes available. Do not store stateful information
   * on the instance if you are using this image.
   */
  public static latestAmazonLinux(props?: AmazonLinuxImageProps): IMachineImage {
    return new AmazonLinuxImage(props);
  }

  /**
   * A Linux image where you specify the AMI ID for every region
   *
   * @param amiMap For every region where you are deploying the stack,
   * specify the AMI ID for that region.
   * @param props Customize the image by supplying additional props
   */
  public static genericLinux(amiMap: Record<string, string>, props?: GenericLinuxImageProps): IMachineImage {
    return new GenericLinuxImage(amiMap, props);
  }

  /**
   * A Windows image where you specify the AMI ID for every region
   *
   * @param amiMap For every region where you are deploying the stack,
   * specify the AMI ID for that region.
   * @param props Customize the image by supplying additional props
   */
  public static genericWindows(amiMap: Record<string, string>, props?: GenericWindowsImageProps): IMachineImage {
    return new GenericWindowsImage(amiMap, props);
  }

  /**
   * An image specified in SSM parameter store that is automatically kept up-to-date
   *
   * This Machine Image automatically updates to the latest version on every
   * deployment. Be aware this will cause your instances to be replaced when a
   * new version of the image becomes available. Do not store stateful information
   * on the instance if you are using this image.
   *
   * @param parameterName The name of SSM parameter containing the AMi id
   * @param os The operating system type of the AMI
   * @param userData optional user data for the given image
   */
  public static fromSSMParameter(parameterName: string, os: OperatingSystemType, userData?: UserData): IMachineImage {
    return new GenericSSMParameterImage(parameterName, os, userData);
  }

  /**
   * Look up a shared Machine Image using DescribeImages
   *
   * The most recent, available, launchable image matching the given filter
   * criteria will be used. Looking up AMIs may take a long time; specify
   * as many filter criteria as possible to narrow down the search.
   *
   * The AMI selected will be cached in `cdk.context.json` and the same value
   * will be used on future runs. To refresh the AMI lookup, you will have to
   * evict the value from the cache using the `cdk context` command. See
   * https://docs.aws.amazon.com/cdk/latest/guide/context.html for more information.
   */
  public static lookup(props: LookupMachineImageProps): IMachineImage {
    return new LookupMachineImage(props);
  }
}

/**
 * Configuration for a machine image
 */
export interface MachineImageConfig {
  /**
   * The AMI ID of the image to use
   */
  readonly imageId: string;

  /**
   * Operating system type for this image
   */
  readonly osType: OperatingSystemType;

  /**
   * Initial UserData for this image
   */
  readonly userData: UserData;
}

/**
 * Select the image based on a given SSM parameter
 *
 * This Machine Image automatically updates to the latest version on every
 * deployment. Be aware this will cause your instances to be replaced when a
 * new version of the image becomes available. Do not store stateful information
 * on the instance if you are using this image.
 *
 * The AMI ID is selected using the values published to the SSM parameter store.
 */
export class GenericSSMParameterImage implements IMachineImage {
  constructor(private readonly parameterName: string, private readonly os: OperatingSystemType, private readonly userData?: UserData) {
  }

  /**
   * Return the image to use in the given context
   */
  public getImage(scope: Construct): MachineImageConfig {
    const ami = ssm.StringParameter.valueForTypedStringParameter(scope, this.parameterName, ssm.ParameterType.AWS_EC2_IMAGE_ID);
    return {
      imageId: ami,
      osType: this.os,
      userData: this.userData ?? (this.os === OperatingSystemType.WINDOWS ? UserData.forWindows() : UserData.forLinux()),
    };
  }
}

/**
 * Configuration options for WindowsImage
 */
export interface WindowsImageProps {
  /**
   * Initial user data
   *
   * @default - Empty UserData for Windows machines
   */
  readonly userData?: UserData;
}

/**
 * Select the latest version of the indicated Windows version
 *
 * This Machine Image automatically updates to the latest version on every
 * deployment. Be aware this will cause your instances to be replaced when a
 * new version of the image becomes available. Do not store stateful information
 * on the instance if you are using this image.
 *
 * The AMI ID is selected using the values published to the SSM parameter store.
 *
 * https://aws.amazon.com/blogs/mt/query-for-the-latest-windows-ami-using-systems-manager-parameter-store/
 */
export class WindowsImage extends GenericSSMParameterImage {
  constructor(version: WindowsVersion, props: WindowsImageProps = {}) {
    super('/aws/service/ami-windows-latest/' + version, OperatingSystemType.WINDOWS, props.userData);
  }
}

/**
 * CPU type
 */
export enum AmazonLinuxCpuType {
  /**
   * arm64 CPU type
   */
  ARM_64 = 'arm64',

  /**
   * x86_64 CPU type
   */
  X86_64 = 'x86_64',
}

/**
 * Amazon Linux image properties
 */
export interface AmazonLinuxImageProps {
  /**
   * What generation of Amazon Linux to use
   *
   * @default AmazonLinux
   */
  readonly generation?: AmazonLinuxGeneration;

  /**
   * What edition of Amazon Linux to use
   *
   * @default Standard
   */
  readonly edition?: AmazonLinuxEdition;

  /**
   * Virtualization type
   *
   * @default HVM
   */
  readonly virtualization?: AmazonLinuxVirt;

  /**
   * What storage backed image to use
   *
   * @default GeneralPurpose
   */
  readonly storage?: AmazonLinuxStorage;

  /**
   * Initial user data
   *
   * @default - Empty UserData for Linux machines
   */
  readonly userData?: UserData;

  /**
   * CPU Type
   *
   * @default X86_64
   */
  readonly cpuType?: AmazonLinuxCpuType;
}

/**
 * Selects the latest version of Amazon Linux
 *
 * This Machine Image automatically updates to the latest version on every
 * deployment. Be aware this will cause your instances to be replaced when a
 * new version of the image becomes available. Do not store stateful information
 * on the instance if you are using this image.
 *
 * The AMI ID is selected using the values published to the SSM parameter store.
 */
export class AmazonLinuxImage extends GenericSSMParameterImage {
  constructor(props: AmazonLinuxImageProps = {}) {
    const generation = (props && props.generation) || AmazonLinuxGeneration.AMAZON_LINUX;
    const edition = (props && props.edition) || AmazonLinuxEdition.STANDARD;
    const virtualization = (props && props.virtualization) || AmazonLinuxVirt.HVM;
    const storage = (props && props.storage) || AmazonLinuxStorage.GENERAL_PURPOSE;
    const cpu = (props && props.cpuType) || AmazonLinuxCpuType.X86_64;
    const parts: Array<string|undefined> = [
      generation,
      'ami',
      edition !== AmazonLinuxEdition.STANDARD ? edition : undefined,
      virtualization,
      cpu,
      storage,
    ].filter(x => x !== undefined); // Get rid of undefineds

    const parameterName = '/aws/service/ami-amazon-linux-latest/' + parts.join('-');
    super(parameterName, OperatingSystemType.LINUX, props.userData);
  }
}

/**
 * What generation of Amazon Linux to use
 */
export enum AmazonLinuxGeneration {
  /**
   * Amazon Linux
   */
  AMAZON_LINUX = 'amzn',

  /**
   * Amazon Linux 2
   */
  AMAZON_LINUX_2 = 'amzn2',
}

/**
 * Amazon Linux edition
 */
export enum AmazonLinuxEdition {
  /**
   * Standard edition
   */
  STANDARD = 'standard',

  /**
   * Minimal edition
   */
  MINIMAL = 'minimal'
}

/**
 * Virtualization type for Amazon Linux
 */
export enum AmazonLinuxVirt {
  /**
   * HVM virtualization (recommended)
   */
  HVM = 'hvm',

  /**
   * PV virtualization
   */
  PV = 'pv'
}

export enum AmazonLinuxStorage {
  /**
   * EBS-backed storage
   */
  EBS = 'ebs',

  /**
   * S3-backed storage
   */
  S3 = 'ebs',

  /**
   * General Purpose-based storage (recommended)
   */
  GENERAL_PURPOSE = 'gp2',
}

/**
 * Configuration options for GenericLinuxImage
 */
export interface GenericLinuxImageProps {
  /**
   * Initial user data
   *
   * @default - Empty UserData for Linux machines
   */
  readonly userData?: UserData;
}

/**
 * Configuration options for GenericWindowsImage
 */
export interface GenericWindowsImageProps {
  /**
   * Initial user data
   *
   * @default - Empty UserData for Windows machines
   */
  readonly userData?: UserData;
}

/**
 * Construct a Linux machine image from an AMI map
 *
 * Linux images IDs are not published to SSM parameter store yet, so you'll have to
 * manually specify an AMI map.
 */
export class GenericLinuxImage implements IMachineImage {
  constructor(private readonly amiMap: { [region: string]: string }, private readonly props: GenericLinuxImageProps = {}) {
  }

  public getImage(scope: Construct): MachineImageConfig {
    const userData = this.props.userData ?? UserData.forLinux();
    const osType = OperatingSystemType.LINUX;
    const region = Stack.of(scope).region;
    if (Token.isUnresolved(region)) {
      const mapping: { [k1: string]: { [k2: string]: any } } = {};
      for (const [rgn, ami] of Object.entries(this.amiMap)) {
        mapping[rgn] = { ami };
      }
      const amiMap = new CfnMapping(scope, 'AmiMap', { mapping });
      return {
        imageId: amiMap.findInMap(Aws.REGION, 'ami'),
        userData,
        osType,
      };
    }
    const imageId = region !== 'test-region' ? this.amiMap[region] : 'ami-12345';
    if (!imageId) {
      throw new Error(`Unable to find AMI in AMI map: no AMI specified for region '${region}'`);
    }
    return {
      imageId,
      userData,
      osType,
    };
  }
}

/**
 * Construct a Windows machine image from an AMI map
 *
 * Allows you to create a generic Windows EC2 , manually specify an AMI map.
 */
export class GenericWindowsImage implements IMachineImage {
  constructor(private readonly amiMap: {[region: string]: string}, private readonly props: GenericWindowsImageProps = {}) {
  }

  public getImage(scope: Construct): MachineImageConfig {
    const userData = this.props.userData ?? UserData.forWindows();
    const osType = OperatingSystemType.WINDOWS;
    const region = Stack.of(scope).region;
    if (Token.isUnresolved(region)) {
      const mapping: { [k1: string]: { [k2: string]: any } } = {};
      for (const [rgn, ami] of Object.entries(this.amiMap)) {
        mapping[rgn] = { ami };
      }
      const amiMap = new CfnMapping(scope, 'AmiMap', { mapping });
      return {
        imageId: amiMap.findInMap(Aws.REGION, 'ami'),
        userData,
        osType,
      };
    }
    const imageId = region !== 'test-region' ? this.amiMap[region] : 'ami-12345';
    if (!imageId) {
      throw new Error(`Unable to find AMI in AMI map: no AMI specified for region '${region}'`);
    }
    return {
      imageId,
      userData,
      osType,
    };
  }
}

/**
 * The OS type of a particular image
 */
export enum OperatingSystemType {
  LINUX,
  WINDOWS,
  /**
   * Used when the type of the operating system is not known
   * (for example, for imported Auto-Scaling Groups).
   */
  UNKNOWN,
}

/**
 * A machine image whose AMI ID will be searched using DescribeImages.
 *
 * The most recent, available, launchable image matching the given filter
 * criteria will be used. Looking up AMIs may take a long time; specify
 * as many filter criteria as possible to narrow down the search.
 *
 * The AMI selected will be cached in `cdk.context.json` and the same value
 * will be used on future runs. To refresh the AMI lookup, you will have to
 * evict the value from the cache using the `cdk context` command. See
 * https://docs.aws.amazon.com/cdk/latest/guide/context.html for more information.
 */
export class LookupMachineImage implements IMachineImage {
  constructor(private readonly props: LookupMachineImageProps) {
  }

  public getImage(scope: Construct): MachineImageConfig {
    // Need to know 'windows' or not before doing the query to return the right
    // osType for the dummy value, so might as well add it to the filter.
    const filters: Record<string, string[] | undefined> = {
      'name': [this.props.name],
      'state': ['available'],
      'image-type': ['machine'],
      'platform': this.props.windows ? ['windows'] : undefined,
    };
    Object.assign(filters, this.props.filters);

    const value = ContextProvider.getValue(scope, {
      provider: cxschema.ContextProvider.AMI_PROVIDER,
      props: {
        owners: this.props.owners,
        filters,
      } as cxschema.AmiContextQuery,
      dummyValue: 'ami-1234',
    }).value as cxapi.AmiContextResponse;

    if (typeof value !== 'string') {
      throw new Error(`Response to AMI lookup invalid, got: ${value}`);
    }

    const osType = this.props.windows ? OperatingSystemType.WINDOWS : OperatingSystemType.LINUX;

    return {
      imageId: value,
      osType,
      userData: this.props.userData ?? UserData.forOperatingSystem(osType),
    };
  }
}

/**
 * Properties for looking up an image
 */
export interface LookupMachineImageProps {
  /**
   * Name of the image (may contain wildcards)
   */
  readonly name: string;

  /**
   * Owner account IDs or aliases
   *
   * @default - All owners
   */
  readonly owners?: string[];

  /**
   * Additional filters on the AMI
   *
   * @see https://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_DescribeImages.html
   * @default - No additional filters
   */
  readonly filters?: {[key: string]: string[]};

  /**
   * Look for Windows images
   *
   * @default false
   */
  readonly windows?: boolean;

  /**
   * Custom userdata for this image
   *
   * @default - Empty user data appropriate for the platform type
   */
  readonly userData?: UserData;
}
