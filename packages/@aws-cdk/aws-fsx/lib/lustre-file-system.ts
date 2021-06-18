import { Connections, ISecurityGroup, ISubnet, Port, SecurityGroup } from '@aws-cdk/aws-ec2';
import { Aws, Token } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { FileSystemAttributes, FileSystemBase, FileSystemProps, IFileSystem } from './file-system';
import { CfnFileSystem } from './fsx.generated';
import { LustreMaintenanceTime } from './maintenance-time';

/**
 * The different kinds of file system deployments used by Lustre.
 */
export enum LustreDeploymentType {
  /**
   * Original type for shorter term data processing. Data is not replicated and does not persist on server fail.
   */
  SCRATCH_1 = 'SCRATCH_1',
  /**
   * Newer type for shorter term data processing. Data is not replicated and does not persist on server fail.
   * Provides better support for spiky workloads.
   */
  SCRATCH_2 = 'SCRATCH_2',
  /**
   * Long term storage. Data is replicated and file servers are replaced if they fail.
   */
  PERSISTENT_1 = 'PERSISTENT_1'
}

/**
 * The configuration for the Amazon FSx for Lustre file system.
 *
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-fsx-filesystem-lustreconfiguration.html
 */
export interface LustreConfiguration {
  /**
   * The type of backing file system deployment used by FSx.
   */
  readonly deploymentType: LustreDeploymentType;

  /**
   * The path in Amazon S3 where the root of your Amazon FSx file system is exported. The path must use the same
   * Amazon S3 bucket as specified in ImportPath. If you only specify a bucket name, such as s3://import-bucket, you
   * get a 1:1 mapping of file system objects to S3 bucket objects. This mapping means that the input data in S3 is
   * overwritten on export. If you provide a custom prefix in the export path, such as
   * s3://import-bucket/[custom-optional-prefix], Amazon FSx exports the contents of your file system to that export
   * prefix in the Amazon S3 bucket.
   *
   * @default s3://import-bucket/FSxLustre[creation-timestamp]
   */
  readonly exportPath?: string;

  /**
   * For files imported from a data repository, this value determines the stripe count and maximum amount of data per
   * file (in MiB) stored on a single physical disk. Allowed values are between 1 and 512,000.
   *
   * @default 1024
   */
  readonly importedFileChunkSizeMiB?: number;

  /**
   * The path to the Amazon S3 bucket (including the optional prefix) that you're using as the data repository for
   * your Amazon FSx for Lustre file system. Must be of the format "s3://{bucketName}/optional-prefix" and cannot
   * exceed 900 characters.
   *
   * @default - no bucket is imported
   */
  readonly importPath?: string;

  /**
   * Required for the PERSISTENT_1 deployment type, describes the amount of read and write throughput for each 1
   * tebibyte of storage, in MB/s/TiB. Valid values are 50, 100, 200.
   *
   * @default - no default, conditionally required for PERSISTENT_1 deployment type
   */
  readonly perUnitStorageThroughput?: number;

  /**
   * The preferred day and time to perform weekly maintenance. The first digit is the day of the week, starting at 1
   * for Monday, then the following are hours and minutes in the UTC time zone, 24 hour clock. For example: '2:20:30'
   * is Tuesdays at 20:30.
   *
   * @default - no preference
   */
  readonly weeklyMaintenanceStartTime?: LustreMaintenanceTime;
}

/**
 * Properties specific to the Lustre version of the FSx file system.
 */
export interface LustreFileSystemProps extends FileSystemProps {
  /**
   * Additional configuration for FSx specific to Lustre.
   */
  readonly lustreConfiguration: LustreConfiguration;

  /**
   * The subnet that the file system will be accessible from.
   */
  readonly vpcSubnet: ISubnet;
}

/**
 * The FSx for Lustre File System implementation of IFileSystem.
 *
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-fsx-filesystem.html
 *
 * @resource AWS::FSx::FileSystem
 */
export class LustreFileSystem extends FileSystemBase {
  /**
   * Import an existing FSx for Lustre file system from the given properties.
   */
  public static fromLustreFileSystemAttributes(scope: Construct, id: string, attrs: FileSystemAttributes): IFileSystem {
    class Import extends FileSystemBase {
      public readonly dnsName = attrs.dnsName;
      public readonly fileSystemId = attrs.fileSystemId;
      public readonly connections = LustreFileSystem.configureConnections(attrs.securityGroup);
    }

    return new Import(scope, id);
  }

  /**
   * The default FSx file system type used by FSx for Lustre.
   */
  private static readonly DEFAULT_FILE_SYSTEM_TYPE: string = 'LUSTRE';

  /**
   * The default ports the file system listens on. Actual port list is: [988, 1021, 1022, 1023]
   */
  private static readonly DEFAULT_PORT_RANGE = { startPort: 988, endPort: 1023 };

  /**
   * Configures a Connections object with all the ports required by FSx for Lustre
   */
  private static configureConnections(securityGroup: ISecurityGroup): Connections {
    const connections = new Connections({
      securityGroups: [securityGroup],
      defaultPort: Port.tcpRange(
        LustreFileSystem.DEFAULT_PORT_RANGE.startPort,
        LustreFileSystem.DEFAULT_PORT_RANGE.endPort),
    });

    return connections;
  }

  /**
   * The security groups/rules used to allow network connections to the file system.
   */
  public readonly connections: Connections;

  /**
   * The DNS name assigned to this file system.
   */
  public readonly dnsName: string;

  /**
   * The ID that AWS assigns to the file system.
   */
  public readonly fileSystemId: string;

  /**
   * The mount name of the file system, generated by FSx
   *
   * @attribute LustreMountName
   */
  public readonly mountName: string;

  /**
   * The encapsulated L1 file system.
   */
  private readonly fileSystem: CfnFileSystem;

  constructor(scope: Construct, id: string, props: LustreFileSystemProps) {
    super(scope, id);

    this.validateProps(props);

    const updatedLustureProps = {
      importedFileChunkSize: props.lustreConfiguration.importedFileChunkSizeMiB,
      weeklyMaintenanceStartTime: props.lustreConfiguration.weeklyMaintenanceStartTime?.toTimestamp(),
    };
    const lustreConfiguration = Object.assign({}, props.lustreConfiguration, updatedLustureProps);

    const securityGroup = (props.securityGroup || new SecurityGroup(this, 'FsxLustreSecurityGroup', {
      vpc: props.vpc,
    }));
    securityGroup.addIngressRule(
      securityGroup,
      Port.tcpRange(LustreFileSystem.DEFAULT_PORT_RANGE.startPort, LustreFileSystem.DEFAULT_PORT_RANGE.endPort));
    this.connections = LustreFileSystem.configureConnections(securityGroup);

    this.fileSystem = new CfnFileSystem(this, 'Resource', {
      fileSystemType: LustreFileSystem.DEFAULT_FILE_SYSTEM_TYPE,
      subnetIds: [props.vpcSubnet.subnetId],
      backupId: props.backupId,
      kmsKeyId: (props.kmsKey ? props.kmsKey.keyId : undefined),
      lustreConfiguration,
      securityGroupIds: [securityGroup.securityGroupId],
      storageCapacity: props.storageCapacityGiB,
    });
    this.fileSystem.applyRemovalPolicy(props.removalPolicy);

    this.fileSystemId = this.fileSystem.ref;
    this.dnsName = `${this.fileSystemId}.fsx.${this.stack.region}.${Aws.URL_SUFFIX}`;
    this.mountName = this.fileSystem.attrLustreMountName;
  }

  /**
   * Validates the props provided for a new FSx for Lustre file system.
   */
  private validateProps(props: LustreFileSystemProps) {
    const lustreConfiguration = props.lustreConfiguration;
    const deploymentType = lustreConfiguration.deploymentType;

    // Make sure the import path is valid before validating the export path
    this.validateImportPath(lustreConfiguration.importPath);
    this.validateExportPath(lustreConfiguration.exportPath, lustreConfiguration.importPath);

    this.validateImportedFileChunkSize(lustreConfiguration.importedFileChunkSizeMiB);
    this.validatePerUnitStorageThroughput(deploymentType, lustreConfiguration.perUnitStorageThroughput);
    this.validateStorageCapacity(deploymentType, props.storageCapacityGiB);
  }

  /**
   * Validates the export path is in the correct format and matches the import path.
   */
  private validateExportPath(exportPath?: string, importPath?: string): void {
    if (exportPath === undefined) { return; }
    if (importPath === undefined) {
      throw new Error('Cannot define an export path without also defining an import path');
    }

    if (Token.isUnresolved(exportPath) && Token.isUnresolved(importPath)) { return; }

    if (Token.isUnresolved(importPath) !== Token.isUnresolved(exportPath)) {
      throw new Error('The importPath and exportPath must each be Tokens or not Tokens, you cannot use a mix');
    }
    if (!exportPath.startsWith(importPath)) {
      throw new Error(`The export path "${exportPath}" is invalid. Expecting the format: s3://{IMPORT_PATH}/optional-prefix`);
    }
    if (exportPath.length > 900) {
      throw new Error(`The export path "${exportPath}" exceeds the maximum length of 900 characters`);
    }
  }

  /**
   * Validates the importedFileChunkSize is in the correct range.
   */
  private validateImportedFileChunkSize(importedFileChunkSize?: number): void {
    if (importedFileChunkSize === undefined) { return; }

    if (importedFileChunkSize < 1 || importedFileChunkSize > 512000) {
      throw new Error(`importedFileChunkSize cannot be ${importedFileChunkSize} MiB. It must be a value from 1 to 512,000 MiB`);
    }
  }

  /**
   * Validates the import path is the correct format.
   */
  private validateImportPath(importPath?: string): void {
    if (importPath === undefined || Token.isUnresolved(importPath)) { return; }

    const regexp = /^s3:\/\//;

    if (importPath.search(regexp) === -1) {
      throw new Error(`The import path "${importPath}" is invalid. Expecting the format: s3://{BUCKET_NAME}/optional-prefix`);
    }
    if (importPath.length > 900) {
      throw new Error(`The import path "${importPath}" exceeds the maximum length of 900 characters`);
    }
  }

  /**
   * Validates the perUnitStorageThroughput is defined correctly for the given deploymentType.
   */
  private validatePerUnitStorageThroughput(deploymentType: LustreDeploymentType, perUnitStorageThroughput?: number) {
    if (perUnitStorageThroughput === undefined) { return; }

    if (deploymentType !== LustreDeploymentType.PERSISTENT_1) {
      throw new Error('perUnitStorageThroughput can only be set for the PERSISTENT_1 deployment type');
    }

    if (![50, 100, 200].includes(perUnitStorageThroughput)) {
      throw new Error('perUnitStorageThroughput must be 50, 100, or 200 MB/s/TiB');
    }
  }

  /**
   * Validates the storage capacity is an acceptable value for the deployment type.
   */
  private validateStorageCapacity(deploymentType: LustreDeploymentType, storageCapacity: number): void {
    if (deploymentType === LustreDeploymentType.SCRATCH_1) {
      if (![1200, 2400, 3600].includes(storageCapacity) && storageCapacity % 3600 !== 0) {
        throw new Error('storageCapacity must be 1,200, 2,400, 3,600, or a multiple of 3,600');
      }
    } else {
      if (![1200, 2400].includes(storageCapacity) && storageCapacity % 2400 !== 0) {
        throw new Error('storageCapacity must be 1,200, 2,400, or a multiple of 2,400');
      }
    }
  }
}
