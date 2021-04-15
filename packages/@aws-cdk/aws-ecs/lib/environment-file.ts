import { IBucket, Location } from '@aws-cdk/aws-s3';
import * as s3_assets from '@aws-cdk/aws-s3-assets';
import { FileAsset, FileAssetOptions } from '@aws-cdk/core';
import { toSymlinkFollow } from './private/follow';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/**
 * Constructs for types of environment files
 */
export abstract class EnvironmentFile {
  /**
   * Loads the environment file from a local disk path.
   *
   * @param path Local disk path
   * @param options
   *
   * @deprecated use fromFileAsset instead
   */
  public static fromAsset(path: string, options?: s3_assets.AssetOptions): AssetEnvironmentFile {
    return new AssetEnvironmentFile(path, options);
  }

  /**
   * Loads the environment file from a local disk path.
   *
   * @param path Local disk path
   * @param options
   */
  public static fromFileAsset(path: string, options?: FileAssetOptions): EnvironmentFile {
    return new FileAssetEnvironmentFile(path, options);
  }

  /**
   * Loads the environment file from an S3 bucket.
   *
   * @returns `S3EnvironmentFile` associated with the specified S3 object.
   * @param bucket The S3 bucket
   * @param key The object key
   * @param objectVersion Optional S3 object version
   */
  public static fromBucket(bucket: IBucket, key: string, objectVersion?: string): S3EnvironmentFile {
    return new S3EnvironmentFile(bucket, key, objectVersion);
  }

  /**
   * Called when the container is initialized to allow this object to bind
   * to the stack.
   *
   * @param scope The binding scope
   */
  public abstract bind(scope: Construct): EnvironmentFileConfig;
}

/**
 * Environment file from a local directory.
 *
 * @deprecated use EnvironmentFile.fromFileAsset instead
 */
export class AssetEnvironmentFile extends EnvironmentFile {
  private readonly fileAssetEnvrionmentFile: FileAssetEnvironmentFile;

  /**
   * @param path The path to the asset file or directory.
   * @param options
   */
  constructor(path: string, options: s3_assets.AssetOptions = { }) {
    super();

    this.fileAssetEnvrionmentFile = new FileAssetEnvironmentFile(path, {
      ...options,
      followSymlinks: options.followSymlinks ?? toSymlinkFollow(options.follow),
    });
  }

  public bind(scope: Construct): EnvironmentFileConfig {
    return this.fileAssetEnvrionmentFile.bind(scope);
  }
}

class FileAssetEnvironmentFile extends EnvironmentFile {
  private asset?: FileAsset;

  /**
   * @param path The path to the asset file or directory.
   * @param options
   */
  constructor(public readonly path: string, private readonly options: FileAssetOptions = { }) {
    super();
  }

  public bind(scope: Construct): EnvironmentFileConfig {
    // If the same AssetCode is used multiple times, retain only the first instantiation.
    if (!this.asset) {
      this.asset = new FileAsset(scope, 'EnvironmentFile', {
        path: this.path,
        ...this.options,
      });
    }

    if (!this.asset.isFile) {
      throw new Error(`Asset must be a single file (${this.path})`);
    }

    return {
      fileType: EnvironmentFileType.S3,
      s3Location: {
        bucketName: this.asset.s3BucketName,
        objectKey: this.asset.s3ObjectKey,
      },
    };
  }
}

/**
 * Environment file from S3.
 */
export class S3EnvironmentFile extends EnvironmentFile {
  private readonly bucketName: string;

  constructor(bucket: IBucket, private key: string, private objectVersion?: string) {
    super();

    if (!bucket.bucketName) {
      throw new Error('bucketName is undefined for the provided bucket');
    }

    this.bucketName = bucket.bucketName;
  }

  public bind(_scope: Construct): EnvironmentFileConfig {
    return {
      fileType: EnvironmentFileType.S3,
      s3Location: {
        bucketName: this.bucketName,
        objectKey: this.key,
        objectVersion: this.objectVersion,
      },
    };
  }
}

/**
 * Configuration for the environment file
 */
export interface EnvironmentFileConfig {
  /**
   * The type of environment file
   */
  readonly fileType: EnvironmentFileType;

  /**
   * The location of the environment file in S3
   */
  readonly s3Location: Location;
}

/**
 * Type of environment file to be included in the container definition
 */
export enum EnvironmentFileType {
  /**
   * Environment file hosted on S3, referenced by object ARN
   */
  S3 = 's3',
}
