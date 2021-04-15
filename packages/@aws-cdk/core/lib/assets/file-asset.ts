import * as path from 'path';
import * as cxapi from '@aws-cdk/cx-api';
import { Construct } from 'constructs';
import { CfnResource } from '../cfn-resource';
import { FileCopyOptions } from '../fs';
import { Stack } from '../stack';
import { AssetStaging } from './asset-staging';
import { BundlingOptions } from './bundling';
import { IAsset } from './common';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct as CoreConstruct } from '../construct-compat';

/**
 * Asset hash options
 */
export interface AssetOptions {
  /**
   * Specify a custom hash for this asset. If `assetHashType` is set it must
   * be set to `AssetHashType.CUSTOM`. For consistency, this custom hash will
   * be SHA256 hashed and encoded as hex. The resulting hash will be the asset
   * hash.
   *
   * NOTE: the hash is used in order to identify a specific revision of the asset, and
   * used for optimizing and caching deployment activities related to this asset such as
   * packaging, uploading to Amazon S3, etc. If you chose to customize the hash, you will
   * need to make sure it is updated every time the asset changes, or otherwise it is
   * possible that some deployments will not be invalidated.
   *
   * @default - based on `assetHashType`
   */
  readonly assetHash?: string;

  /**
   * Specifies the type of hash to calculate for this asset.
   *
   * If `assetHash` is configured, this option must be `undefined` or
   * `AssetHashType.CUSTOM`.
   *
   * @default - the default is `AssetHashType.SOURCE`, but if `assetHash` is
   * explicitly specified this value defaults to `AssetHashType.CUSTOM`.
   */
  readonly assetHashType?: AssetHashType;

  /**
   * Bundle the asset by executing a command in a Docker container.
   * The asset path will be mounted at `/asset-input`. The Docker
   * container is responsible for putting content at `/asset-output`.
   * The content at `/asset-output` will be zipped and used as the
   * final asset.
   *
   * @default - uploaded as-is to S3 if the asset is a regular file or a .zip file,
   * archived into a .zip file and uploaded to S3 otherwise
   *
   * @experimental
   */
  readonly bundling?: BundlingOptions;
}

/**
 * Options for a file asset.
 */
export interface FileAssetOptions extends AssetOptions, FileCopyOptions {
}

/**
 * Properties for `FileAsset`.
 */
export interface FileAssetProps extends FileAssetOptions {
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
export class FileAsset extends CoreConstruct implements IAsset {
  /**
   * Attribute that represents the name of the bucket this asset exists in.
   */
  public readonly s3BucketName: string;

  /**
   * Attribute which represents the S3 object key of this asset.
   */
  public readonly s3ObjectKey: string;

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
   * Indicates if this asset is a single file. Allows constructs to ensure that the
   * correct file type was used.
   */
  public readonly isFile: boolean;

  /**
   * Indicates if this asset is a zip archive. Allows constructs to ensure that the
   * correct file type was used.
   */
  public readonly isZipArchive: boolean;

  public readonly assetHash: string;

  constructor(scope: Construct, id: string, props: FileAssetProps) {
    super(scope, id);

    // stage the asset source (conditionally).
    const staging = new AssetStaging(this, 'Stage', {
      ...props,
      sourcePath: path.resolve(props.path),
      follow: props.followSymlinks,
      assetHash: props.assetHash,
    });

    this.assetHash = staging.assetHash;

    const stack = Stack.of(this);

    this.assetPath = staging.relativeStagedPath(stack);

    this.isFile = staging.packaging === FileAssetPackaging.FILE;

    this.isZipArchive = staging.isArchive;

    const location = stack.synthesizer.addFileAsset({
      packaging: staging.packaging,
      sourceHash: this.assetHash,
      fileName: this.assetPath,
    });

    this.s3BucketName = location.bucketName;
    this.s3ObjectKey = location.objectKey;
    this.s3ObjectUrl = location.s3ObjectUrl;
    this.httpUrl = location.httpUrl;
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
  public addResourceMetadata(resource: CfnResource, resourceProperty: string) {
    if (!this.node.tryGetContext(cxapi.ASSET_RESOURCE_METADATA_ENABLED_CONTEXT)) {
      return; // not enabled
    }

    // tell tools such as SAM CLI that the "Code" property of this resource
    // points to a local path in order to enable local invocation of this function.
    resource.cfnOptions.metadata = resource.cfnOptions.metadata || { };
    resource.cfnOptions.metadata[cxapi.ASSET_RESOURCE_METADATA_PATH_KEY] = this.assetPath;
    resource.cfnOptions.metadata[cxapi.ASSET_RESOURCE_METADATA_PROPERTY_KEY] = resourceProperty;
  }
}

/**
 * The type of asset hash
 *
 * NOTE: the hash is used in order to identify a specific revision of the asset, and
 * used for optimizing and caching deployment activities related to this asset such as
 * packaging, uploading to Amazon S3, etc.
 */
export enum AssetHashType {
  /**
   * Based on the content of the source path
   *
   * When bundling, use `SOURCE` when the content of the bundling output is not
   * stable across repeated bundling operations.
   */
  SOURCE = 'source',

  /**
   * Based on the content of the bundled path
   *
   * @deprecated use `OUTPUT` instead
   */
  BUNDLE = 'bundle',

  /**
   * Based on the content of the bundling output
   *
   * Use `OUTPUT` when the source of the asset is a top level folder containing
   * code and/or dependencies that are not directly linked to the asset.
   */
  OUTPUT = 'output',

  /**
   * Use a custom hash
   */
  CUSTOM = 'custom',
}

/**
 * Represents the source for a file asset.
 */
export interface FileAssetSource {
  /**
   * A hash on the content source. This hash is used to uniquely identify this
   * asset throughout the system. If this value doesn't change, the asset will
   * not be rebuilt or republished.
   */
  readonly sourceHash: string;

  /**
   * An external command that will produce the packaged asset.
   *
   * The command should produce the location of a ZIP file on `stdout`.
   *
   * @default - Exactly one of `directory` and `executable` is required
   */
  readonly executable?: string[];

  /**
   * The path, relative to the root of the cloud assembly, in which this asset
   * source resides. This can be a path to a file or a directory, dependning on the
   * packaging type.
   *
   * @default - Exactly one of `directory` and `executable` is required
   */
  readonly fileName?: string;

  /**
   * Which type of packaging to perform.
   *
   * @default - Required if `fileName` is specified.
   */
  readonly packaging?: FileAssetPackaging;
}

/**
 * Packaging modes for file assets.
 */
export enum FileAssetPackaging {
  /**
   * The asset source path points to a directory, which should be archived using
   * zip and and then uploaded to Amazon S3.
   */
  ZIP_DIRECTORY = 'zip',

  /**
   * The asset source path points to a single file, which should be uploaded
   * to Amazon S3.
   */
  FILE = 'file'
}

/**
 * The location of the published file asset. This is where the asset
 * can be consumed at runtime.
 */
export interface FileAssetLocation {
  /**
   * The name of the Amazon S3 bucket.
   */
  readonly bucketName: string;

  /**
   * The Amazon S3 object key.
   */
  readonly objectKey: string;

  /**
   * The HTTP URL of this asset on Amazon S3.
   * @default - value specified in `httpUrl` is used.
   * @deprecated use `httpUrl`
   */
  readonly s3Url?: string;

  /**
   * The HTTP URL of this asset on Amazon S3.
   *
   * @example https://s3-us-east-1.amazonaws.com/mybucket/myobject
   */
  readonly httpUrl: string;

  /**
   * The S3 URL of this asset on Amazon S3.
   *
   * @example s3://mybucket/myobject
   */
  readonly s3ObjectUrl: string;

  /**
   * The ARN of the KMS key used to encrypt the file asset bucket, if any
   *
   * If so, the consuming role should be given "kms:Decrypt" permissions in its
   * identity policy.
   *
   * It's the responsibility of they key's creator to make sure that all
   * consumers that the key's key policy is configured such that the key can be used
   * by all consumers that need it.
   *
   * The default bootstrap stack provisioned by the CDK CLI ensures this, and
   * can be used as an example for how to configure the key properly.
   *
   * @default - Asset bucket is not encrypted
   * @deprecated Since bootstrap bucket v4, the key policy properly allows use of the
   * key via the bucket and no additional parameters have to be granted anymore.
   */
  readonly kmsKeyArn?: string;
}
