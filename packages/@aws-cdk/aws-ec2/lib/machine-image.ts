import ssm = require('@aws-cdk/aws-ssm');
import { Construct, Stack, Token } from '@aws-cdk/cdk';

/**
 * Interface for classes that can select an appropriate machine image to use
 */
export interface IMachineImageSource {
  /**
   * Return the image to use in the given context
   */
  getImage(scope: Construct): MachineImage;
}

/**
 * Select the latest version of the indicated Windows version
 *
 * The AMI ID is selected using the values published to the SSM parameter store.
 *
 * https://aws.amazon.com/blogs/mt/query-for-the-latest-windows-ami-using-systems-manager-parameter-store/
 */
export class WindowsImage implements IMachineImageSource  {
  constructor(private readonly version: WindowsVersion) {
  }

  /**
   * Return the image to use in the given context
   */
  public getImage(scope: Construct): MachineImage {
    const parameterName = this.imageParameterName(this.version);
    const ami = ssm.StringParameter.valueForStringParameter(scope, parameterName);
    return new MachineImage(ami, new WindowsOS());
  }

  /**
   * Construct the SSM parameter name for the given Windows image
   */
  private imageParameterName(version: WindowsVersion): string {
    return '/aws/service/ami-windows-latest/' + version;
  }
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
}

/**
 * Selects the latest version of Amazon Linux
 *
 * The AMI ID is selected using the values published to the SSM parameter store.
 */
export class AmazonLinuxImage implements IMachineImageSource {
  private readonly generation: AmazonLinuxGeneration;
  private readonly edition: AmazonLinuxEdition;
  private readonly virtualization: AmazonLinuxVirt;
  private readonly storage: AmazonLinuxStorage;

  constructor(props?: AmazonLinuxImageProps) {
    this.generation = (props && props.generation) || AmazonLinuxGeneration.AMAZON_LINUX;
    this.edition = (props && props.edition) || AmazonLinuxEdition.STANDARD;
    this.virtualization = (props && props.virtualization) || AmazonLinuxVirt.HVM;
    this.storage = (props && props.storage) || AmazonLinuxStorage.GENERAL_PURPOSE;
  }

  /**
   * Return the image to use in the given context
   */
  public getImage(scope: Construct): MachineImage {
    const parts: Array<string|undefined> = [
      this.generation,
      'ami',
      this.edition !== AmazonLinuxEdition.STANDARD ? this.edition : undefined,
      this.virtualization,
      'x86_64', // No 32-bits images vended through this
      this.storage
    ].filter(x => x !== undefined); // Get rid of undefineds

    const parameterName = '/aws/service/ami-amazon-linux-latest/' + parts.join('-');
    const ami = ssm.StringParameter.valueForStringParameter(scope, parameterName);
    return new MachineImage(ami, new LinuxOS());
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
 * Construct a Linux machine image from an AMI map
 *
 * Linux images IDs are not published to SSM parameter store yet, so you'll have to
 * manually specify an AMI map.
 */
export class GenericLinuxImage implements IMachineImageSource  {
  constructor(private readonly amiMap: {[region: string]: string}) {
  }

  public getImage(scope: Construct): MachineImage {
    const region = Stack.of(scope).region;
    if (Token.isUnresolved(region)) {
      throw new Error(`Unable to determine AMI from AMI map since stack is region-agnostic`);
    }

    const ami = region !== 'test-region' ? this.amiMap[region] : 'ami-12345';
    if (!ami) {
      throw new Error(`Unable to find AMI in AMI map: no AMI specified for region '${region}'`);
    }

    return new MachineImage(ami, new LinuxOS());
  }
}

/**
 * The Windows version to use for the WindowsImage
 */
export enum WindowsVersion {
  WINDOWS_SERVER_2008_SP2_ENGLISH_64BIT_SQL_2008_SP4_EXPRESS = 'Windows_Server-2008-SP2-English-64Bit-SQL_2008_SP4_Express',
  WINDOWS_SERVER_2012_R2_RTM_CHINESE_SIMPLIFIED_64BIT_BASE = 'Windows_Server-2012-R2_RTM-Chinese_Simplified-64Bit-Base',
  WINDOWS_SERVER_2012_R2_RTM_CHINESE_TRADITIONAL_64BIT_BASE = 'Windows_Server-2012-R2_RTM-Chinese_Traditional-64Bit-Base',
  WINDOWS_SERVER_2012_R2_RTM_DUTCH_64BIT_BASE = 'Windows_Server-2012-R2_RTM-Dutch-64Bit-Base',
  WINDOWS_SERVER_2012_R2_RTM_ENGLISH_64BIT_SQL_2014_SP2_ENTERPRISE = 'Windows_Server-2012-R2_RTM-English-64Bit-SQL_2014_SP2_Enterprise',
  WINDOWS_SERVER_2012_R2_RTM_HUNGARIAN_64BIT_BASE = 'Windows_Server-2012-R2_RTM-Hungarian-64Bit-Base',
  WINDOWS_SERVER_2012_R2_RTM_JAPANESE_64BIT_BASE = 'Windows_Server-2012-R2_RTM-Japanese-64Bit-Base',
  WINDOWS_SERVER_2016_ENGLISH_CORE_CONTAINERS = 'Windows_Server-2016-English-Core-Containers',
  WINDOWS_SERVER_2016_ENGLISH_CORE_SQL_2016_SP1_WEB = 'Windows_Server-2016-English-Core-SQL_2016_SP1_Web',
  WINDOWS_SERVER_2016_GERMAL_FULL_BASE = 'Windows_Server-2016-German-Full-Base',
  WINDOWS_SERVER_2003_R2_SP2_LANGUAGE_PACKS_32BIT_BASE = 'Windows_Server-2003-R2_SP2-Language_Packs-32Bit-Base',
  WINDOWS_SERVER_2008_R2_SP1_ENGLISH_64BIT_SQL_2008_R2_SP3_WEB = 'Windows_Server-2008-R2_SP1-English-64Bit-SQL_2008_R2_SP3_Web',
  WINDOWS_SERVER_2008_R2_SP1_ENGLISH_64BIT_SQL_2012_SP4_EXPRESS = 'Windows_Server-2008-R2_SP1-English-64Bit-SQL_2012_SP4_Express',
  WINDOWS_SERVER_2012_R2_SP1_PORTUGESE_BRAZIL_64BIT_CORE = 'Windows_Server-2008-R2_SP1-Portuguese_Brazil-64Bit-Core',
  WINDOWS_SERVER_2012_R2_RTM_ENGLISH_64BIT_SQL_2016_SP2_STANDARD = 'Windows_Server-2012-R2_RTM-English-64Bit-SQL_2016_SP2_Standard',
  WINDOWS_SERVER_2012_RTM_ENGLISH_64BIT_SQL_2014_SP2_EXPRESS = 'Windows_Server-2012-RTM-English-64Bit-SQL_2014_SP2_Express',
  WINDOWS_SERVER_2012_RTM_ITALIAN_64BIT_BASE = 'Windows_Server-2012-RTM-Italian-64Bit-Base',
  WINDOWS_SERVER_2016_ENGLISH_CORE_SQL_2016_SP1_EXPRESS = 'Windows_Server-2016-English-Core-SQL_2016_SP1_Express',
  WINDOWS_SERVER_2016_ENGLISH_DEEP_LEARNING = 'Windows_Server-2016-English-Deep-Learning',
  WINDOWS_SERVER_2019_ITALIAN_FULL_BASE = 'Windows_Server-2019-Italian-Full-Base',
  WINDOWS_SERVER_2008_R2_SP1_KOREAN_64BIT_BASE = 'Windows_Server-2008-R2_SP1-Korean-64Bit-Base',
  WINDOWS_SERVER_2012_R2_RTM_ENGLISH_64BIT_SQL_2016_SP1_EXPRESS = 'Windows_Server-2012-R2_RTM-English-64Bit-SQL_2016_SP1_Express',
  WINDOWS_SERVER_2012_R2_RTM_JAPANESE_64BIT_SQL_2016_SP2_WEB = 'Windows_Server-2012-R2_RTM-Japanese-64Bit-SQL_2016_SP2_Web',
  WINDOWS_SERVER_2016_JAPANESE_FULL_FQL_2016_SP2_WEB = 'Windows_Server-2016-Japanese-Full-SQL_2016_SP2_Web',
  WINDOWS_SERVER_2016_KOREAN_FULL_BASE = 'Windows_Server-2016-Korean-Full-Base',
  WINDOWS_SERVER_2016_KOREAN_FULL_SQL_2016_SP2_STANDARD = 'Windows_Server-2016-Korean-Full-SQL_2016_SP2_Standard',
  WINDOWS_SERVER_2016_PORTUGESE_PORTUGAL_FULL_BASE = 'Windows_Server-2016-Portuguese_Portugal-Full-Base',
  WINDOWS_SERVER_2019_ENGLISH_FULL_SQL_2017_WEB = 'Windows_Server-2019-English-Full-SQL_2017_Web',
  WINDOWS_SERVER_2019_FRENCH_FULL_BASE = 'Windows_Server-2019-French-Full-Base',
  WINDOWS_SERVER_2019_KOREAN_FULL_BASE = 'Windows_Server-2019-Korean-Full-Base',
  WINDOWS_SERVER_2008_R2_SP1_CHINESE_HONG_KONG_SAR_64BIT_BASE = 'Windows_Server-2008-R2_SP1-Chinese_Hong_Kong_SAR-64Bit-Base',
  WINDOWS_SERVER_2008_R2_SP1_CHINESE_PRC_64BIT_BASE = 'Windows_Server-2008-R2_SP1-Chinese_PRC-64Bit-Base',
  WINDOWS_SERVER_2012_RTM_FRENCH_64BIT_BASE = 'Windows_Server-2012-RTM-French-64Bit-Base',
  WINDOWS_SERVER_2016_ENGLISH_FULL_CONTAINERS = 'Windows_Server-2016-English-Full-Containers',
  WINDOWS_SERVER_2016_ENGLISH_FULL_SQL_2016_SP1_STANDARD = 'Windows_Server-2016-English-Full-SQL_2016_SP1_Standard',
  WINDOWS_SERVER_2016_RUSSIAN_FULL_BASE = 'Windows_Server-2016-Russian-Full-Base',
  WINDOWS_SERVER_2019_CHINESE_SIMPLIFIED_FULL_BASE = 'Windows_Server-2019-Chinese_Simplified-Full-Base',
  WINDOWS_SERVER_2019_ENGLISH_FULL_SQL_2016_SP2_STANDARD = 'Windows_Server-2019-English-Full-SQL_2016_SP2_Standard',
  WINDOWS_SERVER_2019_HUNGARIAN_FULL_BASE = 'Windows_Server-2019-Hungarian-Full-Base',
  WINDOWS_SERVER_2008_R2_SP1_ENGLISH_64BIT_SQL_2008_R2_SP3_EXPRESS = 'Windows_Server-2008-R2_SP1-English-64Bit-SQL_2008_R2_SP3_Express',
  WINDOWS_SERVER_2007_R2_SP1_LANGUAGE_PACKS_64BIT_BASE = 'Windows_Server-2008-R2_SP1-Language_Packs-64Bit-Base',
  WINDOWS_SERVER_2008_SP2_ENGLISH_32BIT_BASE = 'Windows_Server-2008-SP2-English-32Bit-Base',
  WINDOWS_SERVER_2012_R2_RTM_ENGLISH_64BIT_SQL_2012_SP4_ENTERPRISE = 'Windows_Server-2012-R2_RTM-English-64Bit-SQL_2012_SP4_Enterprise',
  WINDOWS_SERVER_2012_RTM_CHINESE_TRADITIONAL_64BIT_BASE = 'Windows_Server-2012-RTM-Chinese_Traditional-64Bit-Base',
  WINDOWS_SERVER_2012_RTM_ENGLISH_64BIT_SQL_2008_R2_SP3_EXPRESS = 'Windows_Server-2012-RTM-English-64Bit-SQL_2008_R2_SP3_Express',
  WINDOWS_SERVER_2012_RTM_ENGLISH_64BIT_SQL_2014_SP2_STANDARD = 'Windows_Server-2012-RTM-English-64Bit-SQL_2014_SP2_Standard',
  WINDOWS_SERVER_2012_RTM_JAPANESE_64BIT_SQL_2014_SP2_EXPRESS = 'Windows_Server-2012-RTM-Japanese-64Bit-SQL_2014_SP2_Express',
  WINDOWS_SERVER_2016_POLISH_FULL_BASE = 'Windows_Server-2016-Polish-Full-Base',
  WINDOWS_SERVER_2019_ENGLISH_FULL_SQL_2016_SP2_WEB = 'Windows_Server-2019-English-Full-SQL_2016_SP2_Web',
  WINDOWS_SERVER_2012_R2_RTM_ENGLISH_64BIT_SQL_2014_SP3_STANDARD = 'Windows_Server-2012-R2_RTM-English-64Bit-SQL_2014_SP3_Standard',
  WINDOWS_SERVER_2012_R2_RTM_ENGLISH_64BIT_SQL_2016_SP2_EXPRESS = 'Windows_Server-2012-R2_RTM-English-64Bit-SQL_2016_SP2_Express',
  WINDOWS_SERVER_2012_R2_RTM_ENGLISH_DEEP_LEARNING = 'Windows_Server-2012-R2_RTM-English-Deep-Learning',
  WINDOWS_SERVER_2012_R2_RTM_GERMAN_64BIT_BASE = 'Windows_Server-2012-R2_RTM-German-64Bit-Base',
  WINDOWS_SERVER_2012_R2_RTM_JAPANESE_64BIT_SQL_2016_SP1_EXPRESS = 'Windows_Server-2012-R2_RTM-Japanese-64Bit-SQL_2016_SP1_Express',
  WINDOWS_SERVER_2012_R2_RTM_RUSSIAN_64BIT_BASE = 'Windows_Server-2012-R2_RTM-Russian-64Bit-Base',
  WINDOWS_SERVER_2012_RTM_CHINESE_TRADITIONAL_HONG_KONG_SAR_64BIT_BASE = 'Windows_Server-2012-RTM-Chinese_Traditional_Hong_Kong_SAR-64Bit-Base',
  WINDOWS_SERVER_2012_RTM_HUNGARIAN_64BIT_BASE = 'Windows_Server-2012-RTM-Hungarian-64Bit-Base',
  WINDOWS_SERVER_2012_RTM_JAPANESE_64BIT_SQL_2014_SP3_STANDARD = 'Windows_Server-2012-RTM-Japanese-64Bit-SQL_2014_SP3_Standard',
  WINDOWS_SERVER_2019_ENGLISH_FULL_HYPERV = 'Windows_Server-2019-English-Full-HyperV',
  WINDOWS_SERVER_2003_R2_SP2_ENGLISH_64BIT_SQL_2005_SP4_EXPRESS = 'Windows_Server-2003-R2_SP2-English-64Bit-SQL_2005_SP4_Express',
  WINDOWS_SERVER_2008_R2_SP1_JAPANESE_64BIT_SQL_2012_SP4_EXPRESS = 'Windows_Server-2008-R2_SP1-Japanese-64Bit-SQL_2012_SP4_Express',
  WINDOWS_SERVER_2012_RTM_GERMAN_64BIT_BASE = 'Windows_Server-2012-RTM-German-64Bit-Base',
  WINDOWS_SERVER_2012_RTM_JAPANESE_64BIT_SQL_2008_R2_SP3_STANDARD = 'Windows_Server-2012-RTM-Japanese-64Bit-SQL_2008_R2_SP3_Standard',
  WINDOWS_SERVER_2016_ENGLISH_FULL_SQL_2016_SP2_STANDARD = 'Windows_Server-2016-English-Full-SQL_2016_SP2_Standard',
  WINDOWS_SERVER_2019_ENGLISH_FULL_SQL_2017_EXPRESS = 'Windows_Server-2019-English-Full-SQL_2017_Express',
  WINDOWS_SERVER_2019_JAPANESE_FULL_BASE = 'Windows_Server-2019-Japanese-Full-Base',
  WINDOWS_SERVER_2019_RUSSIAN_FULL_BASE = 'Windows_Server-2019-Russian-Full-Base',
  WINDOWS_SERVER_2012_R2_RTM_ENGLISH_64BIT_SQL_2014_SP2_STANDARD = 'Windows_Server-2012-R2_RTM-English-64Bit-SQL_2014_SP2_Standard',
  WINDOWS_SERVER_2012_R2_RTM_ITALIAN_64BIT_BASE = 'Windows_Server-2012-R2_RTM-Italian-64Bit-Base',
  WINDOWS_SERVER_2012_RTM_ENGLISH_64BIT_BASE = 'Windows_Server-2012-RTM-English-64Bit-Base',
  WINDOWS_SERVER_2012_RTM_ENGLISH_64BIT_SQL_2008_R2_SP3_STANDARD = 'Windows_Server-2012-RTM-English-64Bit-SQL_2008_R2_SP3_Standard',
  WINDOWS_SERVER_2016_ENGLISH_FULL_HYPERV = 'Windows_Server-2016-English-Full-HyperV',
  WINDOWS_SERVER_2016_ENGLISH_FULL_SQL_2016_SP2_ENTERPRISE = 'Windows_Server-2016-English-Full-SQL_2016_SP2_Enterprise',
  WINDOWS_SERVER_2019_CHINESE_TRADITIONAL_FULL_BASE = 'Windows_Server-2019-Chinese_Traditional-Full-Base',
  WINDOWS_SERVER_2019_ENGLISH_CORE_BASE = 'Windows_Server-2019-English-Core-Base',
  WINDOWS_SERVER_2019_ENGLISH_CORE_CONTAINERSLATEST = 'Windows_Server-2019-English-Core-ContainersLatest',
  WINDOWS_SERVER_2008_SP2_ENGLISH_64BIT_BASE = 'Windows_Server-2008-SP2-English-64Bit-Base',
  WINDOWS_SERVER_2012_R2_RTM_FRENCH_64BIT_BASE = 'Windows_Server-2012-R2_RTM-French-64Bit-Base',
  WINDOWS_SERVER_2012_R2_RTM_POLISH_64BIT_BASE = 'Windows_Server-2012-R2_RTM-Polish-64Bit-Base',
  WINDOWS_SERVER_2012_RTM_ENGLISH_64BIT_SQL_2012_SP4_EXPRESS = 'Windows_Server-2012-RTM-English-64Bit-SQL_2012_SP4_Express',
  WINDOWS_SERVER_2012_RTM_ENGLISH_64BIT_SQL_2014_SP3_STANDARD = 'Windows_Server-2012-RTM-English-64Bit-SQL_2014_SP3_Standard',
  WINDOWS_SERVER_2012_RTM_JAPANESE_64BIT_2012_SP4_STANDARD = 'Windows_Server-2012-RTM-Japanese-64Bit-SQL_2012_SP4_Standard',
  WINDOWS_SERVER_2016_ENGLISH_CORE_CONTAINERSLATEST = 'Windows_Server-2016-English-Core-ContainersLatest',
  WINDOWS_SERVER_2019_ENGLISH_FULL_SQL_2016_SP2_EXPRESS = 'Windows_Server-2019-English-Full-SQL_2016_SP2_Express',
  WINDOWS_SERVER_2019_TURKISH_FULL_BASE = 'Windows_Server-2019-Turkish-Full-Base',
  WINDOWS_SERVER_2012_R2_RTM_ENGLISH_64BIT_SQL_2014_SP2_EXPRESS = 'Windows_Server-2012-R2_RTM-English-64Bit-SQL_2014_SP2_Express',
  WINDOWS_SERVER_2012_R2_RTM_ENGLISH_64BIT_SQL_2014_SP3_WEB = 'Windows_Server-2012-R2_RTM-English-64Bit-SQL_2014_SP3_Web',
  WINDOWS_SERVER_2012_R2_RTM_JAPANESE_64BIT_SQL_2016_SP1_WEB = 'Windows_Server-2012-R2_RTM-Japanese-64Bit-SQL_2016_SP1_Web',
  WINDOWS_SERVER_2012_R2_RTM_PORTUGESE_BRAZIL_64BIT_BASE = 'Windows_Server-2012-R2_RTM-Portuguese_Brazil-64Bit-Base',
  WINDOWS_SERVER_2012_R2_RTM_PORTUGESE_PORTUGAL_64BIT_BASE = 'Windows_Server-2012-R2_RTM-Portuguese_Portugal-64Bit-Base',
  WINDOWS_SERVER_2012_R2_RTM_SWEDISH_64BIT_BASE = 'Windows_Server-2012-R2_RTM-Swedish-64Bit-Base',
  WINDOWS_SERVER_2016_ENGLISH_FULL_SQL_2016_SP1_EXPRESS = 'Windows_Server-2016-English-Full-SQL_2016_SP1_Express',
  WINDOWS_SERVER_2016_ITALIAN_FULL_BASE = 'Windows_Server-2016-Italian-Full-Base',
  WINDOWS_SERVER_2016_SPANISH_FULL_BASE = 'Windows_Server-2016-Spanish-Full-Base',
  WINDOWS_SERVER_2019_ENGLISH_FULL_SQL_2017_STANDARD = 'Windows_Server-2019-English-Full-SQL_2017_Standard',
  WINDOWS_SERVER_2003_R2_SP2_LANGUAGE_PACKS_64BIT_SQL_2005_SP4_STANDARD = 'Windows_Server-2003-R2_SP2-Language_Packs-64Bit-SQL_2005_SP4_Standard',
  WINDOWS_SERVER_2008_R2_SP1_JAPANESE_64BIT_SQL_2008_R2_SP3_STANDARD = 'Windows_Server-2008-R2_SP1-Japanese-64Bit-SQL_2008_R2_SP3_Standard',
  WINDOWS_SERVER_2012_R2_RTM_JAPANESE_64BIT_SQL_2016_SP1_STANDARD = 'Windows_Server-2012-R2_RTM-Japanese-64Bit-SQL_2016_SP1_Standard',
  WINDOWS_SERVER_2012_RTM_ENGLISH_64BIT_SQL_2007_R2_SP3_WEB = 'Windows_Server-2012-RTM-English-64Bit-SQL_2008_R2_SP3_Web',
  WINDOWS_SERVER_2012_RTM_JAPANESE_64BIT_SQL_2014_SP2_WEB = 'Windows_Server-2012-RTM-Japanese-64Bit-SQL_2014_SP2_Web',
  WINDOWS_SERVER_2016_ENGLISH_CORE_SQL_2016_SP2_ENTERPRISE = 'Windows_Server-2016-English-Core-SQL_2016_SP2_Enterprise',
  WINDOWS_SERVER_2016_PORTUGESE_BRAZIL_FULL_BASE = 'Windows_Server-2016-Portuguese_Brazil-Full-Base',
  WINDOWS_SERVER_2019_ENGLISH_FULL_BASE = 'Windows_Server-2019-English-Full-Base',
  WINDOWS_SERVER_2003_R2_SP2_ENGLISH_32BIT_BASE = 'Windows_Server-2003-R2_SP2-English-32Bit-Base',
  WINDOWS_SERVER_2012_R2_RTM_CZECH_64BIT_BASE = 'Windows_Server-2012-R2_RTM-Czech-64Bit-Base',
  WINDOWS_SERVER_2012_R2_RTM_ENGLISH_64BIT_SQL_2016_SP1_STANDARD = 'Windows_Server-2012-R2_RTM-English-64Bit-SQL_2016_SP1_Standard',
  WINDOWS_SERVER_2012_R2_RTM_JAPANESE_64BIT_SQL_2014_SP2_EXPRESS = 'Windows_Server-2012-R2_RTM-Japanese-64Bit-SQL_2014_SP2_Express',
  WINDOWS_SERVER_2012_RTM_ENGLISH_64BIT_SQL_2012_SP4_STANDARD = 'Windows_Server-2012-RTM-English-64Bit-SQL_2012_SP4_Standard',
  WINDOWS_SERVER_2016_ENGLISH_CORE_SQL_2016_SP1_ENTERPRISE = 'Windows_Server-2016-English-Core-SQL_2016_SP1_Enterprise',
  WINDOWS_SERVER_2016_JAPANESE_FULL_SQL_2016_SP1_WEB = 'Windows_Server-2016-Japanese-Full-SQL_2016_SP1_Web',
  WINDOWS_SERVER_2016_SWEDISH_FULL_BASE = 'Windows_Server-2016-Swedish-Full-Base',
  WINDOWS_SERVER_2016_TURKISH_FULL_BASE = 'Windows_Server-2016-Turkish-Full-Base',
  WINDOWS_SERVER_2008_R2_SP1_ENGLISH_64BIT_CORE_SQL_2012_SP4_STANDARD = 'Windows_Server-2008-R2_SP1-English-64Bit-Core_SQL_2012_SP4_Standard',
// tslint:disable-next-line: max-line-length
  WINDOWS_SERVER_2008_R2_SP1_LANGUAGE_PACKS_64BIT_SQL_2008_R2_SP3_STANDARD = 'Windows_Server-2008-R2_SP1-Language_Packs-64Bit-SQL_2008_R2_SP3_Standard',
  WINDOWS_SERVER_2012_RTM_CZECH_64BIT_BASE = 'Windows_Server-2012-RTM-Czech-64Bit-Base',
  WINDOWS_SERVER_2012_RTM_TURKISH_64BIT_BASE = 'Windows_Server-2012-RTM-Turkish-64Bit-Base',
  WINDOWS_SERVER_2016_DUTCH_FULL_BASE = 'Windows_Server-2016-Dutch-Full-Base',
  WINDOWS_SERVER_2016_ENGLISH_FULL_SQL_2016_SP2_EXPRESS = 'Windows_Server-2016-English-Full-SQL_2016_SP2_Express',
  WINDOWS_SERVER_2016_ENGLISH_FULL_SQL_2017_ENTERPRISE = 'Windows_Server-2016-English-Full-SQL_2017_Enterprise',
  WINDOWS_SERVER_2016_HUNGARIAN_FULL_BASE = 'Windows_Server-2016-Hungarian-Full-Base',
  WINDOWS_SERVER_2016_KOREAN_FULL_SQL_2016_SP1_STANDARD = 'Windows_Server-2016-Korean-Full-SQL_2016_SP1_Standard',
  WINDOWS_SERVER_2019_SPANISH_FULL_BASE = 'Windows_Server-2019-Spanish-Full-Base',
  WINDOWS_SERVER_2003_R2_SP2_ENGLISH_64BIT_BASE = 'Windows_Server-2003-R2_SP2-English-64Bit-Base',
  WINDOWS_SERVER_2008_R2_SP1_ENGLISH_64BIT_BASE = 'Windows_Server-2008-R2_SP1-English-64Bit-Base',
  WINDOWS_SERVER_2008_R2_SP1_LANGUAGE_PACKS_64BIT_SQL_2008_R2_SP3_EXPRESS = 'Windows_Server-2008-R2_SP1-Language_Packs-64Bit-SQL_2008_R2_SP3_Express',
  WINDOWS_SERVER_2012_SP2_PORTUGESE_BRAZIL_64BIT_BASE = 'Windows_Server-2008-SP2-Portuguese_Brazil-64Bit-Base',
  WINDOWS_SERVER_2012_R2_RTM_ENGLISH_64BIT_SQL_2016_SP1_WEB = 'Windows_Server-2012-R2_RTM-English-64Bit-SQL_2016_SP1_Web',
  WINDOWS_SERVER_2012_R2_RTM_JAPANESE_64BIT_SQL_2014_SP3_EXPRESS = 'Windows_Server-2012-R2_RTM-Japanese-64Bit-SQL_2014_SP3_Express',
  WINDOWS_SERVER_2012_R2_RTM_JAPANESE_64BIT_SQL_2016_SP2_ENTERPRISE = 'Windows_Server-2012-R2_RTM-Japanese-64Bit-SQL_2016_SP2_Enterprise',
  WINDOWS_SERVER_2012_RTM_JAPANESE_64BIT_BASE = 'Windows_Server-2012-RTM-Japanese-64Bit-Base',
  WINDOWS_SERVER_2019_ENGLISH_FULL_CONTAINERSLATEST = 'Windows_Server-2019-English-Full-ContainersLatest',
  WINDOWS_SERVER_2019_ENGLISH_FULL_SQL_2017_ENTERPRISE = 'Windows_Server-2019-English-Full-SQL_2017_Enterprise',
  WINDOWS_SERVER_1709_ENGLISH_CORE_CONTAINERSLATEST = 'Windows_Server-1709-English-Core-ContainersLatest',
  WINDOWS_SERVER_1803_ENGLISH_CORE_BASE = 'Windows_Server-1803-English-Core-Base',
  WINDOWS_SERVER_2008_R2_SP1_ENGLISH_64BIT_SQL_2012_SP4_WEB = 'Windows_Server-2008-R2_SP1-English-64Bit-SQL_2012_SP4_Web',
  WINDOWS_SERVER_2008_R2_SP1_JAPANESE_64BIT_BASE = 'Windows_Server-2008-R2_SP1-Japanese-64Bit-Base',
  WINDOWS_SERVER_2008_SP2_ENGLISH_64BIT_SQL_2008_SP4_STANDARD = 'Windows_Server-2008-SP2-English-64Bit-SQL_2008_SP4_Standard',
  WINDOWS_SERVER_2012_R2_RTM_ENGLISH_64BIT_BASE = 'Windows_Server-2012-R2_RTM-English-64Bit-Base',
  WINDOWS_SERVER_2012_RTM_PORTUGESE_BRAZIL_64BIT_BASE = 'Windows_Server-2012-RTM-Portuguese_Brazil-64Bit-Base',
  WINDOWS_SERVER_2016_ENGLISH_FULL_SQL_2016_SP1_WEB = 'Windows_Server-2016-English-Full-SQL_2016_SP1_Web',
  WINDOWS_SERVER_2016_ENGLISH_P3 = 'Windows_Server-2016-English-P3',
  WINDOWS_SERVER_2016_JAPANESE_FULL_SQL_2016_SP1_ENTERPRISE = 'Windows_Server-2016-Japanese-Full-SQL_2016_SP1_Enterprise',
  WINDOWS_SERVER_2003_R2_SP2_LANGUAGE_PACKS_64BIT_BASE = 'Windows_Server-2003-R2_SP2-Language_Packs-64Bit-Base',
  WINDOWS_SERVER_2012_R2_RTM_CHINESE_TRADITIONAL_HONG_KONG_64BIT_BASE = 'Windows_Server-2012-R2_RTM-Chinese_Traditional_Hong_Kong-64Bit-Base',
  WINDOWS_SERVER_2012_R2_RTM_ENGLISH_64BIT_SQL_2014_SP3_EXPRESS = 'Windows_Server-2012-R2_RTM-English-64Bit-SQL_2014_SP3_Express',
  WINDOWS_SERVER_2012_R2_RTM_ENGLISH_64BIT_SQL_2016_SP2_ENTERPRISE = 'Windows_Server-2012-R2_RTM-English-64Bit-SQL_2016_SP2_Enterprise',
  WINDOWS_SERVER_2012_RTM_CHINESE_SIMPLIFIED_64BIT_BASE = 'Windows_Server-2012-RTM-Chinese_Simplified-64Bit-Base',
  WINDOWS_SERVER_2012_RTM_ENGLISH_64BIT_SQL_2012_SP4_WEB = 'Windows_Server-2012-RTM-English-64Bit-SQL_2012_SP4_Web',
  WINDOWS_SERVER_2012_RTM_JAPANESE_64BIT_SQL_2014_SP3_WEB = 'Windows_Server-2012-RTM-Japanese-64Bit-SQL_2014_SP3_Web',
  WINDOWS_SERVER_2016_JAPANESE_FULL_BASE = 'Windows_Server-2016-Japanese-Full-Base',
  WINDOWS_SERVER_2016_JAPANESE_FULL_SQL_2016_SP1_EXPRESS = 'Windows_Server-2016-Japanese-Full-SQL_2016_SP1_Express',
  WINDOWS_SERVER_1803_ENGLISH_CORE_CONTAINERSLATEST = 'Windows_Server-1803-English-Core-ContainersLatest',
  WINDOWS_SERVER_2008_R2_SP1_JAPANESE_64BIT_SQL_2012_SP4_STANDARD = 'Windows_Server-2008-R2_SP1-Japanese-64Bit-SQL_2012_SP4_Standard',
  WINDOWS_SERVER_2012_R2_RTM_ENGLISH_64BIT_CORE = 'Windows_Server-2012-R2_RTM-English-64Bit-Core',
  WINDOWS_SERVER_2012_R2_RTM_ENGLISH_64BIT_SQL_2014_SP2_WEB = 'Windows_Server-2012-R2_RTM-English-64Bit-SQL_2014_SP2_Web',
  WINDOWS_SERVER_2012_R2_RTM_ENGLISH_64BIT_SQL_2014_SP3_ENTERPRISE = 'Windows_Server-2012-R2_RTM-English-64Bit-SQL_2014_SP3_Enterprise',
  WINDOWS_SERVER_2012_R2_RTM_JAPANESE_64BIT_SQL_2016_SP2_STANDARD = 'Windows_Server-2012-R2_RTM-Japanese-64Bit-SQL_2016_SP2_Standard',
  WINDOWS_SERVER_2012_RTM_ENGLISH_64BIT_2014_SP3_WEB = 'Windows_Server-2012-RTM-English-64Bit-SQL_2014_SP3_Web',
  WINDOWS_SERVER_2012_RTM_SWEDISH_64BIT_BASE = 'Windows_Server-2012-RTM-Swedish-64Bit-Base',
  WINDOWS_SERVER_2016_CHINESE_SIMPLIFIED_FULL_BASE = 'Windows_Server-2016-Chinese_Simplified-Full-Base',
  WINDOWS_SERVER_2019_POLISH_FULL_BASE = 'Windows_Server-2019-Polish-Full-Base',
  WINDOWS_SERVER_2008_R2_SP1_JAPANESE_64BIT_SQL_2008_R2_SP3_WEB = 'Windows_Server-2008-R2_SP1-Japanese-64Bit-SQL_2008_R2_SP3_Web',
  WINDOWS_SERVER_2008_R2_SP1_PORTUGESE_BRAZIL_64BIT_BASE = 'Windows_Server-2008-R2_SP1-Portuguese_Brazil-64Bit-Base',
  WINDOWS_SERVER_2012_R2_RTM_JAPANESE_64BIT_SQL_2016_SP1_ENTERPRISE = 'Windows_Server-2012-R2_RTM-Japanese-64Bit-SQL_2016_SP1_Enterprise',
  WINDOWS_SERVER_2012_RTM_JAPANESE_64BIT_SQL_2016_SP2_EXPRESS = 'Windows_Server-2012-R2_RTM-Japanese-64Bit-SQL_2016_SP2_Express',
  WINDOWS_SERVER_2012_RTM_ENGLISH_64BIT_SQL_2014_SP3_EXPRESS = 'Windows_Server-2012-RTM-English-64Bit-SQL_2014_SP3_Express',
  WINDOWS_SERVER_2012_RTM_JAPANESE_64BIT_SQL_2014_SP2_STANDARD = 'Windows_Server-2012-RTM-Japanese-64Bit-SQL_2014_SP2_Standard',
  WINDOWS_SERVER_2016_ENGLISH_CORE_BASE = 'Windows_Server-2016-English-Core-Base',
  WINDOWS_SERVER_2016_ENGLISH_FULL_BASE = 'Windows_Server-2016-English-Full-Base',
  WINDOWS_SERVER_2016_ENGLISH_FULL_SQL_2017_WEB = 'Windows_Server-2016-English-Full-SQL_2017_Web',
  WINDOWS_SERVER_2019_GERMAN_FULL_BASE = 'Windows_Server-2019-German-Full-Base',
  WINDOWS_SERVER_2003_R2_SP2_ENGLISH_64BIT_SQL_2005_SP4_STANDARD = 'Windows_Server-2003-R2_SP2-English-64Bit-SQL_2005_SP4_Standard',
  WINDOWS_SERVER_2008_R2_SP1_ENGLISH_64BIT_SQL_2012_SP4_ENTERPRISE = 'Windows_Server-2008-R2_SP1-English-64Bit-SQL_2012_SP4_Enterprise',
  WINDOWS_SERVER_2008_R2_SP1_JAPANESE_64BIT_SQL_2008_R2_SP3_EXPRESS = 'Windows_Server-2008-R2_SP1-Japanese-64Bit-SQL_2008_R2_SP3_Express',
  WINDOWS_SERVER_2012_R2_RTM_ENGLISH_64BIT_SQL_2016_SP1_ENTERPRISE = 'Windows_Server-2012-R2_RTM-English-64Bit-SQL_2016_SP1_Enterprise',
  WINDOWS_SERVER_2012_RTM_ENGLISH_64BIT_SQL_2014_SP2_WEB = 'Windows_Server-2012-RTM-English-64Bit-SQL_2014_SP2_Web',
  WINDOWS_SERVER_2012_RTM_JAPANESE_64BIT_SQL_2008_R2_SP3_EXPRESS = 'Windows_Server-2012-RTM-Japanese-64Bit-SQL_2008_R2_SP3_Express',
  WINDOWS_SERVER_2016_FRENCH_FULL_BASE = 'Windows_Server-2016-French-Full-Base',
  WINDOWS_SERVER_2016_JAPANESE_FULL_SQL_2016_SP2_ENTERPRISE = 'Windows_Server-2016-Japanese-Full-SQL_2016_SP2_Enterprise',
  WINDOWS_SERVER_2019_CZECH_FULL_BASE = 'Windows_Server-2019-Czech-Full-Base',
  WINDOWS_SERVER_1809_ENGLISH_CORE_BASE = 'Windows_Server-1809-English-Core-Base',
  WINDOWS_SERVER_1809_ENGLISH_CORE_CONTAINERSLATEST = 'Windows_Server-1809-English-Core-ContainersLatest',
  WINDOWS_SERVER_2003_R2_SP2_LANGUAGE_PACKS_64BIT_SQL_2005_SP4_EXPRESS = 'Windows_Server-2003-R2_SP2-Language_Packs-64Bit-SQL_2005_SP4_Express',
  WINDOWS_SERVER_2012_R2_RTM_TURKISH_64BIT_BASE = 'Windows_Server-2012-R2_RTM-Turkish-64Bit-Base',
  WINDOWS_SERVER_2012_RTM_JAPANESE_64BIT_SQL_2012_SP4_WEB = 'Windows_Server-2012-RTM-Japanese-64Bit-SQL_2012_SP4_Web',
  WINDOWS_SERVER_2012_RTM_POLISH_64BIT_BASE = 'Windows_Server-2012-RTM-Polish-64Bit-Base',
  WINDOWS_SERVER_2012_RTM_SPANISH_64BIT_BASE = 'Windows_Server-2012-RTM-Spanish-64Bit-Base',
  WINDOWS_SERVER_2016_ENGLISH_FULL_SQL_2016_SP1_ENTERPRISE = 'Windows_Server-2016-English-Full-SQL_2016_SP1_Enterprise',
  WINDOWS_SERVER_2016_JAPANESE_FULL_SQL_2016_SP2_EXPRESS = 'Windows_Server-2016-Japanese-Full-SQL_2016_SP2_Express',
  WINDOWS_SERVER_2019_ENGLISH_FULL_SQL_2016_SP2_ENTERPRISE = 'Windows_Server-2019-English-Full-SQL_2016_SP2_Enterprise',
  WINDOWS_SERVER_1709_ENGLISH_CORE_BASE = 'Windows_Server-1709-English-Core-Base',
  WINDOWS_SERVER_2008_R2_SP1_ENGLISH_61BIT_SQL_2012_RTM_SP2_ENTERPRISE = 'Windows_Server-2008-R2_SP1-English-64Bit-SQL_2012_RTM_SP2_Enterprise',
  WINDOWS_SERVER_2008_R2_SP1_ENGLISH_64BIT_SQL_2012_SP4_STANDARD = 'Windows_Server-2008-R2_SP1-English-64Bit-SQL_2012_SP4_Standard',
  WINDOWS_SERVER_2008_SP2_PORTUGESE_BRAZIL_32BIT_BASE = 'Windows_Server-2008-SP2-Portuguese_Brazil-32Bit-Base',
  WINDOWS_SERVER_2012_R2_RTM_JAPANESE_64BIT_SQL_2014_SP2_STANDARD = 'Windows_Server-2012-R2_RTM-Japanese-64Bit-SQL_2014_SP2_Standard',
  WINDOWS_SERVER_2012_RTM_JAPANESE_64BIT_SQL_2012_SP4_EXPRESS = 'Windows_Server-2012-RTM-Japanese-64Bit-SQL_2012_SP4_Express',
  WINDOWS_SERVER_2012_RTM_PORTUGESE_PORTUGAL_64BIT_BASE = 'Windows_Server-2012-RTM-Portuguese_Portugal-64Bit-Base',
  WINDOWS_SERVER_2016_CZECH_FULL_BASE = 'Windows_Server-2016-Czech-Full-Base',
  WINDOWS_SERVER_2016_JAPANESE_FULL_SQL_2016_SP1_STANDARD = 'Windows_Server-2016-Japanese-Full-SQL_2016_SP1_Standard',
  WINDOWS_SERVER_2019_DUTCH_FULL_BASE = 'Windows_Server-2019-Dutch-Full-Base',
  WINDOWS_SERVER_2008_R2_SP1_ENGLISH_64BIT_CORE = 'Windows_Server-2008-R2_SP1-English-64Bit-Core',
  WINDOWS_SERVER_2012_R2_RTM_ENGLISH_64BIT_SQL_2016_SP2_WEB = 'Windows_Server-2012-R2_RTM-English-64Bit-SQL_2016_SP2_Web',
  WINDOWS_SERVER_2012_R2_RTM_KOREAN_64BIT_BASE = 'Windows_Server-2012-R2_RTM-Korean-64Bit-Base',
  WINDOWS_SERVER_2012_RTM_DUTCH_64BIT_BASE = 'Windows_Server-2012-RTM-Dutch-64Bit-Base',
  WINDOWS_SERVER_2016_ENGLISH_64BIT_SQL_2012_SP4_ENTERPRISE = 'Windows_Server-2016-English-64Bit-SQL_2012_SP4_Enterprise',
  WINDOWS_SERVER_2016_ENGLISH_CORE_SQL_2016_SP1_STANDARD = 'Windows_Server-2016-English-Core-SQL_2016_SP1_Standard',
  WINDOWS_SERVER_2016_ENGLISH_CORE_SQL_2016_SP2_EXPRESS = 'Windows_Server-2016-English-Core-SQL_2016_SP2_Express',
  WINDOWS_SERVER_2016_ENGLISH_CORE_SQL_2016_SP2_WEB = 'Windows_Server-2016-English-Core-SQL_2016_SP2_Web',
  WINDOWS_SERVER_2016_ENGLISH_FULL_SQL_2017_STANDARD = 'Windows_Server-2016-English-Full-SQL_2017_Standard',
  WINDOWS_SERVER_2019_PORTUGESE_BRAZIL_FULL_BASE = 'Windows_Server-2019-Portuguese_Brazil-Full-Base',
  WINDOWS_SERVER_2008_R2_SP1_ENGLISH_64BIT_SQL_2008_R2_SP3_STANDARD = 'Windows_Server-2008-R2_SP1-English-64Bit-SQL_2008_R2_SP3_Standard',
  WINDOWS_SERVER_2008_R2_SP1_ENGLISH_64BIT_SHAREPOINT_2010_SP2_FOUNDATION = 'Windows_Server-2008-R2_SP1-English-64Bit-SharePoint_2010_SP2_Foundation',
  WINDOWS_SERVER_2012_R2_RTM_ENGLISH_P3 = 'Windows_Server-2012-R2_RTM-English-P3',
  WINDOWS_SERVER_2012_R2_RTM_JAPANESE_64BIT_SQL_2014_SP3_STANDARD = 'Windows_Server-2012-R2_RTM-Japanese-64Bit-SQL_2014_SP3_Standard',
  WINDOWS_SERVER_2012_R2_RTM_SPANISH_64BIT_BASE = 'Windows_Server-2012-R2_RTM-Spanish-64Bit-Base',
  WINDOWS_SERVER_2012_RTM_JAPANESE_64BIT_SQL_2014_SP3_EXPRESS = 'Windows_Server-2012-RTM-Japanese-64Bit-SQL_2014_SP3_Express',
  WINDOWS_SERVER_2016_ENGLISH_CORE_SQL_2016_SP2_STANDARD = 'Windows_Server-2016-English-Core-SQL_2016_SP2_Standard',
  WINDOWS_SERVER_2016_JAPANESE_FULL_SQL_2016_SP2_STANDARD = 'Windows_Server-2016-Japanese-Full-SQL_2016_SP2_Standard',
  WINDOWS_SERVER_2019_PORTUGESE_PORTUGAL_FULL_BASE = 'Windows_Server-2019-Portuguese_Portugal-Full-Base',
  WINDOWS_SERVER_2019_SWEDISH_FULL_BASE = 'Windows_Server-2019-Swedish-Full-Base',
  WINDOWS_SERVER_2012_R2_RTM_ENGLISH_64BIT_HYPERV = 'Windows_Server-2012-R2_RTM-English-64Bit-HyperV',
  WINDOWS_SERVER_2012_RTM_KOREAN_64BIT_BASE = 'Windows_Server-2012-RTM-Korean-64Bit-Base',
  WINDOWS_SERVER_2012_RTM_RUSSIAN_64BIT_BASE = 'Windows_Server-2012-RTM-Russian-64Bit-Base',
  WINDOWS_SERVER_2016_CHINESE_TRADITIONAL_FULL_BASE = 'Windows_Server-2016-Chinese_Traditional-Full-Base',
  WINDOWS_SERVER_2016_ENGLISH_FULL_SQL_2016_SP2_WEB = 'Windows_Server-2016-English-Full-SQL_2016_SP2_Web',
  WINDOWS_SERVER_2016_ENGLISH_FULL_SQL_2017_EXPRESS = 'Windows_Server-2016-English-Full-SQL_2017_Express',
}

/**
 * Representation of a machine to be launched
 *
 * Combines an AMI ID with an OS.
 */
export class MachineImage {
  constructor(public readonly imageId: string, public readonly os: OperatingSystem) {
  }
}

/**
 * The OS type of a particular image
 */
export enum OperatingSystemType {
  LINUX,
  WINDOWS,
}

/**
 * Abstraction of OS features we need to be aware of
 */
export abstract class OperatingSystem {
  public abstract createUserData(scripts: string[]): string;
  abstract get type(): OperatingSystemType;
}

/**
 * OS features specialized for Windows
 */
export class WindowsOS extends OperatingSystem {
  public createUserData(scripts: string[]): string {
    return `<powershell>${scripts.join('\n')}</powershell>`;
  }

  get type(): OperatingSystemType {
    return OperatingSystemType.WINDOWS;
  }
}

/**
 * OS features specialized for Linux
 */
export class LinuxOS extends OperatingSystem {
  public createUserData(scripts: string[]): string {
    return '#!/bin/bash\n' + scripts.join('\n');
  }

  get type(): OperatingSystemType {
    return OperatingSystemType.LINUX;
  }
}
