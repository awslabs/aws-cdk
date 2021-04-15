import * as ka from '@aws-cdk/aws-kinesisanalytics';
import * as s3 from '@aws-cdk/aws-s3';
import { FileAsset, FileAssetOptions } from '@aws-cdk/core';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/**
 * The return type of {@link ApplicationCode.bind}. This represents
 * CloudFormation configuration and an s3 bucket holding the Flink application
 * JAR file.
 */
export interface ApplicationCodeConfig {
  /**
   * Low-level Cloudformation ApplicationConfigurationProperty
   */
  readonly applicationCodeConfigurationProperty: ka.CfnApplicationV2.ApplicationConfigurationProperty;

  /**
   * S3 Bucket that stores the Flink application code
   */
  readonly bucket: s3.IBucket;
}

/**
 * Code configuration providing the location to a Flink application JAR file.
 */
export abstract class ApplicationCode {
  /**
   * Reference code from an S3 bucket.
   *
   * @param bucket - an s3 bucket
   * @param fileKey - a key pointing to a Flink JAR file
   * @param objectVersion - an optional version string for the provided fileKey
   */
  public static fromBucket(bucket: s3.IBucket, fileKey: string, objectVersion?: string): ApplicationCode {
    return new BucketApplicationCode({
      bucket,
      fileKey,
      objectVersion,
    });
  }

  /**
   * Reference code from a local directory containing a Flink JAR file.
   *
   * @param path - a local directory path
   * @param options - standard s3 AssetOptions
   */
  public static fromAsset(path: string, options?: FileAssetOptions): ApplicationCode {
    return new AssetApplicationCode(path, options);
  }

  /**
   * A method to lazily bind asset resources to the parent FlinkApplication.
   */
  public abstract bind(scope: Construct): ApplicationCodeConfig;
}

interface BucketApplicationCodeProps {
  readonly bucket: s3.IBucket;
  readonly fileKey: string;
  readonly objectVersion?: string;
}

class BucketApplicationCode extends ApplicationCode {
  public readonly bucket?: s3.IBucket;
  public readonly fileKey: string;
  public readonly objectVersion?: string;

  constructor(props: BucketApplicationCodeProps) {
    super();
    this.bucket = props.bucket;
    this.fileKey = props.fileKey;
    this.objectVersion = props.objectVersion;
  }

  public bind(_scope: Construct): ApplicationCodeConfig {
    return {
      applicationCodeConfigurationProperty: {
        applicationCodeConfiguration: {
          codeContent: {
            s3ContentLocation: {
              bucketArn: this.bucket!.bucketArn,
              fileKey: this.fileKey,
              objectVersion: this.objectVersion,
            },
          },
          codeContentType: 'ZIPFILE',
        },
      },
      bucket: this.bucket!,
    };
  }
}

class AssetApplicationCode extends ApplicationCode {
  private readonly path: string;
  private readonly options?: FileAssetOptions;
  private _asset?: FileAsset;

  constructor(path: string, options?: FileAssetOptions) {
    super();
    this.path = path;
    this.options = options;
  }

  public bind(scope: Construct): ApplicationCodeConfig {
    this._asset = new FileAsset(scope, 'Code', {
      path: this.path,
      ...this.options,
    });

    if (!this._asset.isZipArchive) {
      throw new Error(`Asset must be a .zip file or a directory (${this.path})`);
    }

    const bucket = s3.Bucket.fromBucketName(this._asset, 'AssetBucket',
      this._asset.s3BucketName);
    return {
      applicationCodeConfigurationProperty: {
        applicationCodeConfiguration: {
          codeContent: {
            s3ContentLocation: {
              bucketArn: bucket.bucketArn,
              fileKey: this._asset.s3ObjectKey,
            },
          },
          codeContentType: 'ZIPFILE',
        },
      },
      bucket,
    };
  }
}
