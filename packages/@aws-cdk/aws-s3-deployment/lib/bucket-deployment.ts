import * as path from 'path';
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as efs from '@aws-cdk/aws-efs';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import { AwsCliLayer } from '@aws-cdk/lambda-layer-awscli';
import { Construct } from 'constructs';
import { ISource, SourceConfig } from './source';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct as CoreConstruct } from '@aws-cdk/core';

/**
 * Properties for `BucketDeployment`.
 */
export interface BucketDeploymentProps {
  /**
   * The sources from which to deploy the contents of this bucket.
   */
  readonly sources: ISource[];

  /**
   * The S3 bucket to sync the contents of the zip file to.
   */
  readonly destinationBucket: s3.IBucket;

  /**
   * Key prefix in the destination bucket.
   *
   * @default "/" (unzip to root of the destination bucket)
   */
  readonly destinationKeyPrefix?: string;

  /**
   * If this is set to false, files in the destination bucket that
   * do not exist in the asset, will NOT be deleted during deployment (create/update).
   *
   * @see https://docs.aws.amazon.com/cli/latest/reference/s3/sync.html
   *
   * @default true
   */
  readonly prune?: boolean

  /**
   * If this is set to "false", the destination files will be deleted when the
   * resource is deleted or the destination is updated.
   *
   * NOTICE: Configuring this to "false" might have operational implications. Please
   * visit to the package documentation referred below to make sure you fully understand those implications.
   *
   * @see https://github.com/aws/aws-cdk/tree/master/packages/%40aws-cdk/aws-s3-deployment#retain-on-delete
   * @default true - when resource is deleted/updated, files are retained
   */
  readonly retainOnDelete?: boolean;

  /**
   * The CloudFront distribution using the destination bucket as an origin.
   * Files in the distribution's edge caches will be invalidated after
   * files are uploaded to the destination bucket.
   *
   * @default - No invalidation occurs
   */
  readonly distribution?: cloudfront.IDistribution;

  /**
   * The file paths to invalidate in the CloudFront distribution.
   *
   * @default - All files under the destination bucket key prefix will be invalidated.
   */
  readonly distributionPaths?: string[];

  /**
   * The amount of memory (in MiB) to allocate to the AWS Lambda function which
   * replicates the files from the CDK bucket to the destination bucket.
   *
   * If you are deploying large files, you will need to increase this number
   * accordingly.
   *
   * @default 128
   */
  readonly memoryLimit?: number;

  /**
   *  Mount an EFS file system. Enable this if your assets are large and you encounter disk space errors.
   *
   * @default - No EFS. Lambda has access only to 512MB of disk space.
   */
  readonly useEfs?: boolean

  /**
   * Execution role associated with this function
   *
   * @default - A role is automatically created
   */
  readonly role?: iam.IRole;

  /**
   * User-defined object metadata to be set on all objects in the deployment
   * @default - No user metadata is set
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingMetadata.html#UserMetadata
   */
  readonly metadata?: UserDefinedObjectMetadata;

  /**
   * System-defined cache-control metadata to be set on all objects in the deployment.
   * @default - Not set.
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingMetadata.html#SysMetadata
   */
  readonly cacheControl?: CacheControl[];
  /**
   * System-defined cache-disposition metadata to be set on all objects in the deployment.
   * @default - Not set.
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingMetadata.html#SysMetadata
   */
  readonly contentDisposition?: string;
  /**
   * System-defined content-encoding metadata to be set on all objects in the deployment.
   * @default - Not set.
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingMetadata.html#SysMetadata
   */
  readonly contentEncoding?: string;
  /**
   * System-defined content-language metadata to be set on all objects in the deployment.
   * @default - Not set.
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingMetadata.html#SysMetadata
   */
  readonly contentLanguage?: string;
  /**
   * System-defined content-type metadata to be set on all objects in the deployment.
   * @default - Not set.
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingMetadata.html#SysMetadata
   */
  readonly contentType?: string;
  /**
   * System-defined expires metadata to be set on all objects in the deployment.
   * @default - The objects in the distribution will not expire.
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingMetadata.html#SysMetadata
   */
  readonly expires?: cdk.Expiration;
  /**
   * System-defined x-amz-server-side-encryption metadata to be set on all objects in the deployment.
   * @default - Server side encryption is not used.
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingMetadata.html#SysMetadata
   */
  readonly serverSideEncryption?: ServerSideEncryption;
  /**
   * System-defined x-amz-storage-class metadata to be set on all objects in the deployment.
   * @default - Default storage-class for the bucket is used.
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingMetadata.html#SysMetadata
   */
  readonly storageClass?: StorageClass;
  /**
   * System-defined x-amz-website-redirect-location metadata to be set on all objects in the deployment.
   * @default - No website redirection.
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingMetadata.html#SysMetadata
   */
  readonly websiteRedirectLocation?: string;
  /**
   * System-defined x-amz-server-side-encryption-aws-kms-key-id metadata to be set on all objects in the deployment.
   * @default - Not set.
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingMetadata.html#SysMetadata
   */
  readonly serverSideEncryptionAwsKmsKeyId?: string;
  /**
   * System-defined x-amz-server-side-encryption-customer-algorithm metadata to be set on all objects in the deployment.
   * Warning: This is not a useful parameter until this bug is fixed: https://github.com/aws/aws-cdk/issues/6080
   * @default - Not set.
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/ServerSideEncryptionCustomerKeys.html#sse-c-how-to-programmatically-intro
   */
  readonly serverSideEncryptionCustomerAlgorithm?: string;

  /**
   * The VPC network to place the deployment lambda handler in.
   * This is required if `useEfs` is set.
   *
   * @default None
   */
  readonly vpc?: ec2.IVpc;

  /**
   * Where in the VPC to place the deployment lambda handler.
   * Only used if 'vpc' is supplied.
   *
   * @default - the Vpc default strategy if not specified
   */
  readonly vpcSubnets?: ec2.SubnetSelection;
}

/**
 * `BucketDeployment` populates an S3 bucket with the contents of .zip files from
 * other S3 buckets or from local disk
 */
export class BucketDeployment extends CoreConstruct {
  constructor(scope: Construct, id: string, props: BucketDeploymentProps) {
    super(scope, id);

    if (props.distributionPaths && !props.distribution) {
      throw new Error('Distribution must be specified if distribution paths are specified');
    }

    if (props.useEfs && !props.vpc) {
      throw new Error('Vpc must be specified if useEfs is set');
    }

    const accessPointPath = '/lambda';
    let accessPoint;
    if (props.useEfs && props.vpc) {
      const accessMode = '0777';
      const fileSystem = this.getOrCreateEfsFileSystem(scope, {
        vpc: props.vpc,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
      accessPoint = fileSystem.addAccessPoint('AccessPoint', {
        path: accessPointPath,
        createAcl: {
          ownerUid: '1001',
          ownerGid: '1001',
          permissions: accessMode,
        },
        posixUser: {
          uid: '1001',
          gid: '1001',
        },
      });
    }

    const mountPath = `/mnt${accessPointPath}`;
    const handler = new lambda.SingletonFunction(this, 'CustomResourceHandler', {
      uuid: this.renderSingletonUuid(props.memoryLimit, props.vpc),
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda')),
      layers: [new AwsCliLayer(this, 'AwsCliLayer')],
      runtime: lambda.Runtime.PYTHON_3_6,
      environment: props.useEfs ? {
        MOUNT_PATH: mountPath,
      } : undefined,
      handler: 'index.handler',
      lambdaPurpose: 'Custom::CDKBucketDeployment',
      timeout: cdk.Duration.minutes(15),
      role: props.role,
      memorySize: props.memoryLimit,
      vpc: props.vpc,
      vpcSubnets: props.vpcSubnets,
      filesystem: accessPoint ? lambda.FileSystem.fromEfsAccessPoint(
        accessPoint,
        mountPath,
      ): undefined,
    });

    const handlerRole = handler.role;
    if (!handlerRole) { throw new Error('lambda.SingletonFunction should have created a Role'); }

    const sources: SourceConfig[] = props.sources.map((source: ISource) => source.bind(this, { handlerRole }));

    props.destinationBucket.grantReadWrite(handler);
    if (props.distribution) {
      handler.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cloudfront:GetInvalidation', 'cloudfront:CreateInvalidation'],
        resources: ['*'],
      }));
    }

    new cdk.CustomResource(this, 'CustomResource', {
      serviceToken: handler.functionArn,
      resourceType: 'Custom::CDKBucketDeployment',
      properties: {
        SourceBucketNames: sources.map(source => source.bucket.bucketName),
        SourceObjectKeys: sources.map(source => source.zipObjectKey),
        DestinationBucketName: props.destinationBucket.bucketName,
        DestinationBucketKeyPrefix: props.destinationKeyPrefix,
        RetainOnDelete: props.retainOnDelete,
        Prune: props.prune ?? true,
        UserMetadata: props.metadata ? mapUserMetadata(props.metadata) : undefined,
        SystemMetadata: mapSystemMetadata(props),
        DistributionId: props.distribution?.distributionId,
        DistributionPaths: props.distributionPaths,
      },
    });

  }

  private renderSingletonUuid(memoryLimit?: number, vpc?: ec2.IVpc) {
    let uuid = '8693BB64-9689-44B6-9AAF-B0CC9EB8756C';

    // if user specify a custom memory limit, define another singleton handler
    // with this configuration. otherwise, it won't be possible to use multiple
    // configurations since we have a singleton.
    if (memoryLimit) {
      if (cdk.Token.isUnresolved(memoryLimit)) {
        throw new Error('Can\'t use tokens when specifying "memoryLimit" since we use it to identify the singleton custom resource handler');
      }

      uuid += `-${memoryLimit.toString()}MiB`;
    }

    // if user specify to use VPC, define another singleton handler
    // with this configuration. otherwise, it won't be possible to use multiple
    // configurations since we have a singleton.
    // A VPC is a must if EFS storage is used and that's why we are only using VPC in uuid.
    if (vpc) {
      uuid += `-${vpc.node.addr.toUpperCase()}`;
    }

    return uuid;
  }

  /**
   * Function to get/create a stack singleton instance of EFS FileSystem per vpc.
   *
   * @param scope Construct
   * @param fileSystemProps EFS FileSystemProps
   */
  private getOrCreateEfsFileSystem(scope: Construct, fileSystemProps: efs.FileSystemProps): efs.FileSystem {
    const stack = cdk.Stack.of(scope);
    const uuid = `Efs-${fileSystemProps.vpc.node.addr.toUpperCase()}`;
    return stack.node.tryFindChild(uuid) as efs.FileSystem ?? new efs.FileSystem(scope, uuid, fileSystemProps);
  }
}

/**
 * Metadata
 */

function mapUserMetadata(metadata: UserDefinedObjectMetadata) {
  const mapKey = (key: string) => key.toLowerCase();

  return Object.keys(metadata).reduce((o, key) => ({ ...o, [mapKey(key)]: metadata[key] }), {});
}

function mapSystemMetadata(metadata: BucketDeploymentProps) {
  const res: { [key: string]: string } = {};

  if (metadata.cacheControl) { res['cache-control'] = metadata.cacheControl.map(c => c.value).join(', '); }
  if (metadata.expires) { res.expires = metadata.expires.date.toUTCString(); }
  if (metadata.contentDisposition) { res['content-disposition'] = metadata.contentDisposition; }
  if (metadata.contentEncoding) { res['content-encoding'] = metadata.contentEncoding; }
  if (metadata.contentLanguage) { res['content-language'] = metadata.contentLanguage; }
  if (metadata.contentType) { res['content-type'] = metadata.contentType; }
  if (metadata.serverSideEncryption) { res.sse = metadata.serverSideEncryption; }
  if (metadata.storageClass) { res['storage-class'] = metadata.storageClass; }
  if (metadata.websiteRedirectLocation) { res['website-redirect'] = metadata.websiteRedirectLocation; }
  if (metadata.serverSideEncryptionAwsKmsKeyId) { res['sse-kms-key-id'] = metadata.serverSideEncryptionAwsKmsKeyId; }
  if (metadata.serverSideEncryptionCustomerAlgorithm) { res['sse-c-copy-source'] = metadata.serverSideEncryptionCustomerAlgorithm; }

  return Object.keys(res).length === 0 ? undefined : res;
}

/**
 * Used for HTTP cache-control header, which influences downstream caches.
 * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingMetadata.html#SysMetadata
 */
export class CacheControl {

  /**
   * Sets 'must-revalidate'.
   */
  public static mustRevalidate() { return new CacheControl('must-revalidate'); }

  /**
   * Sets 'no-cache'.
   */
  public static noCache() { return new CacheControl('no-cache'); }

  /**
   * Sets 'no-transform'.
   */
  public static noTransform() { return new CacheControl('no-transform'); }

  /**
   * Sets 'public'.
   */
  public static setPublic() { return new CacheControl('public'); }

  /**
   * Sets 'private'.
   */
  public static setPrivate() { return new CacheControl('private'); }

  /**
   * Sets 'proxy-revalidate'.
   */
  public static proxyRevalidate() { return new CacheControl('proxy-revalidate'); }

  /**
   * Sets 'max-age=<duration-in-seconds>'.
   */
  public static maxAge(t: cdk.Duration) { return new CacheControl(`max-age=${t.toSeconds()}`); }

  /**
   * Sets 's-maxage=<duration-in-seconds>'.
   */
  public static sMaxAge(t: cdk.Duration) { return new CacheControl(`s-maxage=${t.toSeconds()}`); }

  /**
   * Constructs a custom cache control key from the literal value.
   */
  public static fromString(s: string) { return new CacheControl(s); }

  private constructor(
    /**
     * The raw cache control setting.
     */
    public readonly value: any,
  ) {}
}

/**
 * Indicates whether server-side encryption is enabled for the object, and whether that encryption is
 * from the AWS Key Management Service (AWS KMS) or from Amazon S3 managed encryption (SSE-S3).
 * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingMetadata.html#SysMetadata
 */
export enum ServerSideEncryption {

  /**
   * 'AES256'
   */
  AES_256 = 'AES256',

  /**
   * 'aws:kms'
   */
  AWS_KMS = 'aws:kms'
}

/**
 * Storage class used for storing the object.
 * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingMetadata.html#SysMetadata
 */
export enum StorageClass {

  /**
   * 'STANDARD'
   */
  STANDARD = 'STANDARD',

  /**
   * 'REDUCED_REDUNDANCY'
   */
  REDUCED_REDUNDANCY = 'REDUCED_REDUNDANCY',

  /**
   * 'STANDARD_IA'
   */
  STANDARD_IA = 'STANDARD_IA',

  /**
   * 'ONEZONE_IA'
   */
  ONEZONE_IA = 'ONEZONE_IA',

  /**
   * 'INTELLIGENT_TIERING'
   */
  INTELLIGENT_TIERING = 'INTELLIGENT_TIERING',

  /**
   * 'GLACIER'
   */
  GLACIER = 'GLACIER',

  /**
   * 'DEEP_ARCHIVE'
   */
  DEEP_ARCHIVE = 'DEEP_ARCHIVE'
}

/**
 * Used for HTTP expires header, which influences downstream caches. Does NOT influence deletion of the object.
 * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingMetadata.html#SysMetadata
 *
 * @deprecated use core.Expiration
 */
export class Expires {
  /**
   * Expire at the specified date
   * @param d date to expire at
   */
  public static atDate(d: Date) { return new Expires(d.toUTCString()); }

  /**
   * Expire at the specified timestamp
   * @param t timestamp in unix milliseconds
   */
  public static atTimestamp(t: number) { return Expires.atDate(new Date(t)); }

  /**
   * Expire once the specified duration has passed since deployment time
   * @param t the duration to wait before expiring
   */
  public static after(t: cdk.Duration) { return Expires.atDate(new Date(Date.now() + t.toMilliseconds())); }

  /**
   * Create an expiration date from a raw date string.
   */
  public static fromString(s: string) { return new Expires(s); }

  private constructor(
    /**
     * The raw expiration date expression.
     */
    public readonly value: any,
  ) {}
}

/**
 * Custom user defined metadata.
 */
export interface UserDefinedObjectMetadata {
  /**
   * Arbitrary metadata key-values
   * The `x-amz-meta-` prefix will automatically be added to keys.
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingMetadata.html#UserMetadata
   */
  readonly [key: string]: string;
}
