import * as path from 'path';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import * as cxapi from '@aws-cdk/cx-api';
import { Construct } from 'constructs';
import { toSymlinkFollow } from './compat';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { CopyOptions } from '@aws-cdk/assets';
// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct as CoreConstruct } from '@aws-cdk/core';

export interface AssetOptions extends CopyOptions, cdk.FileCopyOptions, cdk.AssetOptions {
  /**
   * A list of principals that should be able to read this asset from S3.
   * You can use `asset.grantRead(principal)` to grant read permissions later.
   *
   * @default - No principals that can read file asset.
   */
  readonly readers?: iam.IGrantable[];

  /**
   * Custom hash to use when identifying the specific version of the asset. For consistency,
   * this custom hash will be SHA256 hashed and encoded as hex. The resulting hash will be
   * the asset hash.
   *
   * NOTE: the source hash is used in order to identify a specific revision of the asset,
   * and used for optimizing and caching deployment activities related to this asset such as
   * packaging, uploading to Amazon S3, etc. If you chose to customize the source hash,
   * you will need to make sure it is updated every time the source changes, or otherwise
   * it is possible that some deployments will not be invalidated.
   *
   * @default - automatically calculate source hash based on the contents
   * of the source file or directory.
   *
   * @deprecated see `assetHash` and `assetHashType`
   */
  readonly sourceHash?: string;
}

export interface AssetProps extends AssetOptions {
  /**
   * The disk location of the asset.
   *
   * The path should refer to one of the following:
   * - A regular file or a .zip file, in which case the file will be uploaded as-is to S3.
   * - A directory, in which case it will be archived into a .zip file and uploaded to S3.
   */
  readonly path: string;
}

/**
 * An asset represents a local file or directory, which is automatically uploaded to S3
 * and then can be referenced within a CDK application.
 */
export class Asset extends CoreConstruct implements cdk.IAsset {
  /**
   * Attribute that represents the name of the bucket this asset exists in.
   */
  public readonly s3BucketName: string;

  /**
   * Attribute which represents the S3 object key of this asset.
   */
  public readonly s3ObjectKey: string;

  /**
   * Attribute which represents the S3 URL of this asset.
   * @deprecated use `httpUrl`
   */
  public readonly s3Url: string;

  /**
   * Attribute which represents the S3 HTTP URL of this asset.
   * @example https://s3.us-west-1.amazonaws.com/bucket/key
   */
  public readonly httpUrl: string;

  /**
   * Attribute which represents the S3 URL of this asset.
   * @example s3://bucket/key
   */
  public readonly s3ObjectUrl: string;

  /**
   * The path to the asset, relative to the current Cloud Assembly
   *
   * If asset staging is disabled, this will just be the original path.
   * If asset staging is enabled it will be the staged path.
   */
  public readonly assetPath: string;

  /**
   * The S3 bucket in which this asset resides.
   */
  public readonly bucket: s3.IBucket;

  /**
   * Indicates if this asset is a single file. Allows constructs to ensure that the
   * correct file type was used.
   */
  public readonly isFile: boolean;

  /**
   * Indicates if this asset is a zip archive. Allows constructs to ensure that the
   * correct file type was used.
   */
  public readonly isZipArchive: boolean;

  /**
   * A cryptographic hash of the asset.
   *
   * @deprecated see `assetHash`
   */
  public readonly sourceHash: string;

  public readonly assetHash: string;

  constructor(scope: Construct, id: string, props: AssetProps) {
    super(scope, id);

    // stage the asset source (conditionally).
    const staging = new cdk.AssetStaging(this, 'Stage', {
      ...props,
      sourcePath: path.resolve(props.path),
      follow: props.followSymlinks ?? toSymlinkFollow(props.follow),
      assetHash: props.assetHash ?? props.sourceHash,
    });

    this.assetHash = staging.assetHash;
    this.sourceHash = this.assetHash;

    const stack = cdk.Stack.of(this);

    this.assetPath = staging.relativeStagedPath(stack);

    this.isFile = staging.packaging === cdk.FileAssetPackaging.FILE;

    this.isZipArchive = staging.isArchive;

    const location = stack.synthesizer.addFileAsset({
      packaging: staging.packaging,
      sourceHash: this.sourceHash,
      fileName: this.assetPath,
    });

    this.s3BucketName = location.bucketName;
    this.s3ObjectKey = location.objectKey;
    this.s3ObjectUrl = location.s3ObjectUrl;
    this.httpUrl = location.httpUrl;
    this.s3Url = location.httpUrl; // for backwards compatibility

    const kmsKey = location.kmsKeyArn ? kms.Key.fromKeyArn(this, 'Key', location.kmsKeyArn) : undefined;

    this.bucket = s3.Bucket.fromBucketAttributes(this, 'AssetBucket', {
      bucketName: this.s3BucketName,
      encryptionKey: kmsKey,
    });

    for (const reader of (props.readers ?? [])) {
      this.grantRead(reader);
    }
  }

  /**
   * Adds CloudFormation template metadata to the specified resource with
   * information that indicates which resource property is mapped to this local
   * asset. This can be used by tools such as SAM CLI to provide local
   * experience such as local invocation and debugging of Lambda functions.
   *
   * Asset metadata will only be included if the stack is synthesized with the
   * "aws:cdk:enable-asset-metadata" context key defined, which is the default
   * behavior when synthesizing via the CDK Toolkit.
   *
   * @see https://github.com/aws/aws-cdk/issues/1432
   *
   * @param resource The CloudFormation resource which is using this asset [disable-awslint:ref-via-interface]
   * @param resourceProperty The property name where this asset is referenced
   * (e.g. "Code" for AWS::Lambda::Function)
   */
  public addResourceMetadata(resource: cdk.CfnResource, resourceProperty: string) {
    if (!this.node.tryGetContext(cxapi.ASSET_RESOURCE_METADATA_ENABLED_CONTEXT)) {
      return; // not enabled
    }

    // tell tools such as SAM CLI that the "Code" property of this resource
    // points to a local path in order to enable local invocation of this function.
    resource.cfnOptions.metadata = resource.cfnOptions.metadata || { };
    resource.cfnOptions.metadata[cxapi.ASSET_RESOURCE_METADATA_PATH_KEY] = this.assetPath;
    resource.cfnOptions.metadata[cxapi.ASSET_RESOURCE_METADATA_PROPERTY_KEY] = resourceProperty;
  }

  /**
   * Grants read permissions to the principal on the assets bucket.
   */
  public grantRead(grantee: iam.IGrantable) {
    // we give permissions on all files in the bucket since we don't want to
    // accidentally revoke permission on old versions when deploying a new
    // version (for example, when using Lambda traffic shifting).
    this.bucket.grantRead(grantee);
  }
}
