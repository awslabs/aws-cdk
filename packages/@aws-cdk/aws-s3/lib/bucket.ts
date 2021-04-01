import { EOL } from 'os';
import * as path from 'path';
import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import {
  Fn, IResource, Lazy, RemovalPolicy, Resource, Stack, Token,
  CustomResource, CustomResourceProvider, CustomResourceProviderRuntime, FeatureFlags,
} from '@aws-cdk/core';
import * as cxapi from '@aws-cdk/cx-api';
import { Construct } from 'constructs';
import { BucketPolicy } from './bucket-policy';
import { IBucketNotificationDestination } from './destination';
import { BucketNotifications } from './notifications-resource';
import * as perms from './perms';
import { LifecycleRule } from './rule';
import { CfnBucket } from './s3.generated';
import { parseBucketArn, parseBucketName } from './util';

const AUTO_DELETE_OBJECTS_RESOURCE_TYPE = 'Custom::S3AutoDeleteObjects';

export interface IBucket extends IResource {
  /**
   * The ARN of the bucket.
   * @attribute
   */
  readonly bucketArn: string;

  /**
   * The name of the bucket.
   * @attribute
   */
  readonly bucketName: string;

  /**
   * The URL of the static website.
   * @attribute
   */
  readonly bucketWebsiteUrl: string;

  /**
   * The Domain name of the static website.
   * @attribute
   */
  readonly bucketWebsiteDomainName: string;

  /**
   * The IPv4 DNS name of the specified bucket.
   * @attribute
   */
  readonly bucketDomainName: string;

  /**
   * The IPv6 DNS name of the specified bucket.
   * @attribute
   */
  readonly bucketDualStackDomainName: string;

  /**
   * The regional domain name of the specified bucket.
   * @attribute
   */
  readonly bucketRegionalDomainName: string;

  /**
   * If this bucket has been configured for static website hosting.
   */
  readonly isWebsite?: boolean;

  /**
   * Optional KMS encryption key associated with this bucket.
   */
  readonly encryptionKey?: kms.IKey;

  /**
   * The resource policy associated with this bucket.
   *
   * If `autoCreatePolicy` is true, a `BucketPolicy` will be created upon the
   * first call to addToResourcePolicy(s).
   */
  policy?: BucketPolicy;

  /**
   * Adds a statement to the resource policy for a principal (i.e.
   * account/role/service) to perform actions on this bucket and/or it's
   * contents. Use `bucketArn` and `arnForObjects(keys)` to obtain ARNs for
   * this bucket or objects.
   */
  addToResourcePolicy(permission: iam.PolicyStatement): iam.AddToResourcePolicyResult;

  /**
   * The https URL of an S3 object. For example:
   * @example https://s3.us-west-1.amazonaws.com/onlybucket
   * @example https://s3.us-west-1.amazonaws.com/bucket/key
   * @example https://s3.cn-north-1.amazonaws.com.cn/china-bucket/mykey
   * @param key The S3 key of the object. If not specified, the URL of the
   *      bucket is returned.
   * @returns an ObjectS3Url token
   */
  urlForObject(key?: string): string;

  /**
   * The virtual hosted-style URL of an S3 object. Specify `regional: false` at
   * the options for non-regional URL. For example:
   * @example https://only-bucket.s3.us-west-1.amazonaws.com
   * @example https://bucket.s3.us-west-1.amazonaws.com/key
   * @example https://bucket.s3.amazonaws.com/key
   * @example https://china-bucket.s3.cn-north-1.amazonaws.com.cn/mykey
   * @param key The S3 key of the object. If not specified, the URL of the
   *      bucket is returned.
   * @param options Options for generating URL.
   * @returns an ObjectS3Url token
   */
  virtualHostedUrlForObject(key?: string, options?: VirtualHostedStyleUrlOptions): string;

  /**
   * The S3 URL of an S3 object. For example:
   * @example s3://onlybucket
   * @example s3://bucket/key
   * @param key The S3 key of the object. If not specified, the S3 URL of the
   *      bucket is returned.
   * @returns an ObjectS3Url token
   */
  s3UrlForObject(key?: string): string;

  /**
   * Returns an ARN that represents all objects within the bucket that match
   * the key pattern specified. To represent all keys, specify ``"*"``.
   */
  arnForObjects(keyPattern: string): string;

  /**
   * Grant read permissions for this bucket and it's contents to an IAM
   * principal (Role/Group/User).
   *
   * If encryption is used, permission to use the key to decrypt the contents
   * of the bucket will also be granted to the same principal.
   *
   * @param identity The principal
   * @param objectsKeyPattern Restrict the permission to a certain key pattern (default '*')
   */
  grantRead(identity: iam.IGrantable, objectsKeyPattern?: any): iam.Grant;

  /**
   * Grant write permissions to this bucket to an IAM principal.
   *
   * If encryption is used, permission to use the key to encrypt the contents
   * of written files will also be granted to the same principal.
   *
   * Before CDK version 1.85.0, this method granted the `s3:PutObject*` permission that included `s3:PutObjectAcl`,
   * which could be used to grant read/write object access to IAM principals in other accounts.
   * If you want to get rid of that behavior, update your CDK version to 1.85.0 or later,
   * and make sure the `@aws-cdk/aws-s3:grantWriteWithoutAcl` feature flag is set to `true`
   * in the `context` key of your cdk.json file.
   * If you've already updated, but still need the principal to have permissions to modify the ACLs,
   * use the {@link grantPutAcl} method.
   *
   * @param identity The principal
   * @param objectsKeyPattern Restrict the permission to a certain key pattern (default '*')
   */
  grantWrite(identity: iam.IGrantable, objectsKeyPattern?: any): iam.Grant;

  /**
   * Grants s3:PutObject* and s3:Abort* permissions for this bucket to an IAM principal.
   *
   * If encryption is used, permission to use the key to encrypt the contents
   * of written files will also be granted to the same principal.
   * @param identity The principal
   * @param objectsKeyPattern Restrict the permission to a certain key pattern (default '*')
   */
  grantPut(identity: iam.IGrantable, objectsKeyPattern?: any): iam.Grant;

  /**
   * Grant the given IAM identity permissions to modify the ACLs of objects in the given Bucket.
   *
   * If your application has the '@aws-cdk/aws-s3:grantWriteWithoutAcl' feature flag set,
   * calling {@link grantWrite} or {@link grantReadWrite} no longer grants permissions to modify the ACLs of the objects;
   * in this case, if you need to modify object ACLs, call this method explicitly.
   *
   * @param identity The principal
   * @param objectsKeyPattern Restrict the permission to a certain key pattern (default '*')
   */
  grantPutAcl(identity: iam.IGrantable, objectsKeyPattern?: string): iam.Grant;

  /**
   * Grants s3:DeleteObject* permission to an IAM principal for objects
   * in this bucket.
   *
   * @param identity The principal
   * @param objectsKeyPattern Restrict the permission to a certain key pattern (default '*')
   */
  grantDelete(identity: iam.IGrantable, objectsKeyPattern?: any): iam.Grant;

  /**
   * Grants read/write permissions for this bucket and it's contents to an IAM
   * principal (Role/Group/User).
   *
   * If an encryption key is used, permission to use the key for
   * encrypt/decrypt will also be granted.
   *
   * Before CDK version 1.85.0, this method granted the `s3:PutObject*` permission that included `s3:PutObjectAcl`,
   * which could be used to grant read/write object access to IAM principals in other accounts.
   * If you want to get rid of that behavior, update your CDK version to 1.85.0 or later,
   * and make sure the `@aws-cdk/aws-s3:grantWriteWithoutAcl` feature flag is set to `true`
   * in the `context` key of your cdk.json file.
   * If you've already updated, but still need the principal to have permissions to modify the ACLs,
   * use the {@link grantPutAcl} method.
   *
   * @param identity The principal
   * @param objectsKeyPattern Restrict the permission to a certain key pattern (default '*')
   */
  grantReadWrite(identity: iam.IGrantable, objectsKeyPattern?: any): iam.Grant;

  /**
   * Allows unrestricted access to objects from this bucket.
   *
   * IMPORTANT: This permission allows anyone to perform actions on S3 objects
   * in this bucket, which is useful for when you configure your bucket as a
   * website and want everyone to be able to read objects in the bucket without
   * needing to authenticate.
   *
   * Without arguments, this method will grant read ("s3:GetObject") access to
   * all objects ("*") in the bucket.
   *
   * The method returns the `iam.Grant` object, which can then be modified
   * as needed. For example, you can add a condition that will restrict access only
   * to an IPv4 range like this:
   *
   *     const grant = bucket.grantPublicAccess();
   *     grant.resourceStatement!.addCondition(‘IpAddress’, { “aws:SourceIp”: “54.240.143.0/24” });
   *
   *
   * @param keyPrefix the prefix of S3 object keys (e.g. `home/*`). Default is "*".
   * @param allowedActions the set of S3 actions to allow. Default is "s3:GetObject".
   * @returns The `iam.PolicyStatement` object, which can be used to apply e.g. conditions.
   */
  grantPublicAccess(keyPrefix?: string, ...allowedActions: string[]): iam.Grant;

  /**
   * Defines a CloudWatch event that triggers when something happens to this bucket
   *
   * Requires that there exists at least one CloudTrail Trail in your account
   * that captures the event. This method will not create the Trail.
   *
   * @param id The id of the rule
   * @param options Options for adding the rule
   */
  onCloudTrailEvent(id: string, options?: OnCloudTrailBucketEventOptions): events.Rule;

  /**
   * Defines an AWS CloudWatch event that triggers when an object is uploaded
   * to the specified paths (keys) in this bucket using the PutObject API call.
   *
   * Note that some tools like `aws s3 cp` will automatically use either
   * PutObject or the multipart upload API depending on the file size,
   * so using `onCloudTrailWriteObject` may be preferable.
   *
   * Requires that there exists at least one CloudTrail Trail in your account
   * that captures the event. This method will not create the Trail.
   *
   * @param id The id of the rule
   * @param options Options for adding the rule
   */
  onCloudTrailPutObject(id: string, options?: OnCloudTrailBucketEventOptions): events.Rule;

  /**
   * Defines an AWS CloudWatch event that triggers when an object at the
   * specified paths (keys) in this bucket are written to.  This includes
   * the events PutObject, CopyObject, and CompleteMultipartUpload.
   *
   * Note that some tools like `aws s3 cp` will automatically use either
   * PutObject or the multipart upload API depending on the file size,
   * so using this method may be preferable to `onCloudTrailPutObject`.
   *
   * Requires that there exists at least one CloudTrail Trail in your account
   * that captures the event. This method will not create the Trail.
   *
   * @param id The id of the rule
   * @param options Options for adding the rule
   */
  onCloudTrailWriteObject(id: string, options?: OnCloudTrailBucketEventOptions): events.Rule;
}

/**
 * A reference to a bucket. The easiest way to instantiate is to call
 * `bucket.export()`. Then, the consumer can use `Bucket.import(this, ref)` and
 * get a `Bucket`.
 */
export interface BucketAttributes {
  /**
   * The ARN of the bucket. At least one of bucketArn or bucketName must be
   * defined in order to initialize a bucket ref.
   */
  readonly bucketArn?: string;

  /**
   * The name of the bucket. If the underlying value of ARN is a string, the
   * name will be parsed from the ARN. Otherwise, the name is optional, but
   * some features that require the bucket name such as auto-creating a bucket
   * policy, won't work.
   */
  readonly bucketName?: string;

  /**
   * The domain name of the bucket.
   *
   * @default Inferred from bucket name
   */
  readonly bucketDomainName?: string;

  /**
   * The website URL of the bucket (if static web hosting is enabled).
   *
   * @default Inferred from bucket name
   */
  readonly bucketWebsiteUrl?: string;

  /**
   * The regional domain name of the specified bucket.
   */
  readonly bucketRegionalDomainName?: string;

  /**
   * The IPv6 DNS name of the specified bucket.
   */
  readonly bucketDualStackDomainName?: string;

  /**
   * The format of the website URL of the bucket. This should be true for
   * regions launched since 2014.
   *
   * @default false
   */
  readonly bucketWebsiteNewUrlFormat?: boolean;

  readonly encryptionKey?: kms.IKey;

  /**
   * If this bucket has been configured for static website hosting.
   *
   * @default false
   */
  readonly isWebsite?: boolean;

  /**
   * The account this existing bucket belongs to.
   *
   * @default - it's assumed the bucket belongs to the same account as the scope it's being imported into
   */
  readonly account?: string;

  /**
   * The region this existing bucket is in.
   *
   * @default - it's assumed the bucket is in the same region as the scope it's being imported into
   */
  readonly region?: string;
}

/**
 * Represents an S3 Bucket.
 *
 * Buckets can be either defined within this stack:
 *
 *   new Bucket(this, 'MyBucket', { props });
 *
 * Or imported from an existing bucket:
 *
 *   Bucket.import(this, 'MyImportedBucket', { bucketArn: ... });
 *
 * You can also export a bucket and import it into another stack:
 *
 *   const ref = myBucket.export();
 *   Bucket.import(this, 'MyImportedBucket', ref);
 *
 */
abstract class BucketBase extends Resource implements IBucket {
  public abstract readonly bucketArn: string;
  public abstract readonly bucketName: string;
  public abstract readonly bucketDomainName: string;
  public abstract readonly bucketWebsiteUrl: string;
  public abstract readonly bucketWebsiteDomainName: string;
  public abstract readonly bucketRegionalDomainName: string;
  public abstract readonly bucketDualStackDomainName: string;

  /**
   * Optional KMS encryption key associated with this bucket.
   */
  public abstract readonly encryptionKey?: kms.IKey;

  /**
   * If this bucket has been configured for static website hosting.
   */
  public abstract readonly isWebsite?: boolean;

  /**
   * The resource policy associated with this bucket.
   *
   * If `autoCreatePolicy` is true, a `BucketPolicy` will be created upon the
   * first call to addToResourcePolicy(s).
   */
  public abstract policy?: BucketPolicy;

  /**
   * Indicates if a bucket resource policy should automatically created upon
   * the first call to `addToResourcePolicy`.
   */
  protected abstract autoCreatePolicy = false;

  /**
   * Whether to disallow public access
   */
  protected abstract disallowPublicAccess?: boolean;

  /**
   * Define a CloudWatch event that triggers when something happens to this repository
   *
   * Requires that there exists at least one CloudTrail Trail in your account
   * that captures the event. This method will not create the Trail.
   *
   * @param id The id of the rule
   * @param options Options for adding the rule
   */
  public onCloudTrailEvent(id: string, options: OnCloudTrailBucketEventOptions = {}): events.Rule {
    const rule = new events.Rule(this, id, options);
    rule.addTarget(options.target);
    rule.addEventPattern({
      source: ['aws.s3'],
      detailType: ['AWS API Call via CloudTrail'],
      detail: {
        resources: {
          ARN: options.paths?.map(p => this.arnForObjects(p)) ?? [this.bucketArn],
        },
      },
    });
    return rule;
  }

  /**
   * Defines an AWS CloudWatch event that triggers when an object is uploaded
   * to the specified paths (keys) in this bucket using the PutObject API call.
   *
   * Note that some tools like `aws s3 cp` will automatically use either
   * PutObject or the multipart upload API depending on the file size,
   * so using `onCloudTrailWriteObject` may be preferable.
   *
   * Requires that there exists at least one CloudTrail Trail in your account
   * that captures the event. This method will not create the Trail.
   *
   * @param id The id of the rule
   * @param options Options for adding the rule
   */
  public onCloudTrailPutObject(id: string, options: OnCloudTrailBucketEventOptions = {}): events.Rule {
    const rule = this.onCloudTrailEvent(id, options);
    rule.addEventPattern({
      detail: {
        eventName: ['PutObject'],
      },
    });
    return rule;
  }

  /**
   * Defines an AWS CloudWatch event that triggers when an object at the
   * specified paths (keys) in this bucket are written to.  This includes
   * the events PutObject, CopyObject, and CompleteMultipartUpload.
   *
   * Note that some tools like `aws s3 cp` will automatically use either
   * PutObject or the multipart upload API depending on the file size,
   * so using this method may be preferable to `onCloudTrailPutObject`.
   *
   * Requires that there exists at least one CloudTrail Trail in your account
   * that captures the event. This method will not create the Trail.
   *
   * @param id The id of the rule
   * @param options Options for adding the rule
   */
  public onCloudTrailWriteObject(id: string, options: OnCloudTrailBucketEventOptions = {}): events.Rule {
    const rule = this.onCloudTrailEvent(id, options);
    rule.addEventPattern({
      detail: {
        eventName: [
          'CompleteMultipartUpload',
          'CopyObject',
          'PutObject',
        ],
        requestParameters: {
          bucketName: [this.bucketName],
          key: options.paths,
        },
      },
    });
    return rule;
  }

  /**
   * Adds a statement to the resource policy for a principal (i.e.
   * account/role/service) to perform actions on this bucket and/or it's
   * contents. Use `bucketArn` and `arnForObjects(keys)` to obtain ARNs for
   * this bucket or objects.
   */
  public addToResourcePolicy(permission: iam.PolicyStatement): iam.AddToResourcePolicyResult {
    if (!this.policy && this.autoCreatePolicy) {
      this.policy = new BucketPolicy(this, 'Policy', { bucket: this });
    }

    if (this.policy) {
      this.policy.document.addStatements(permission);
      return { statementAdded: true, policyDependable: this.policy };
    }

    return { statementAdded: false };
  }

  protected validate(): string[] {
    const errors = super.validate();
    errors.push(...this.policy?.document.validateForResourcePolicy() || []);
    return errors;
  }

  /**
   * The https URL of an S3 object. Specify `regional: false` at the options
   * for non-regional URLs. For example:
   * @example https://s3.us-west-1.amazonaws.com/onlybucket
   * @example https://s3.us-west-1.amazonaws.com/bucket/key
   * @example https://s3.cn-north-1.amazonaws.com.cn/china-bucket/mykey
   * @param key The S3 key of the object. If not specified, the URL of the
   *      bucket is returned.
   * @returns an ObjectS3Url token
   */
  public urlForObject(key?: string): string {
    const stack = Stack.of(this);
    const prefix = `https://s3.${stack.region}.${stack.urlSuffix}/`;
    if (typeof key !== 'string') {
      return this.urlJoin(prefix, this.bucketName);
    }
    return this.urlJoin(prefix, this.bucketName, key);
  }

  /**
   * The virtual hosted-style URL of an S3 object. Specify `regional: false` at
   * the options for non-regional URL. For example:
   * @example https://only-bucket.s3.us-west-1.amazonaws.com
   * @example https://bucket.s3.us-west-1.amazonaws.com/key
   * @example https://bucket.s3.amazonaws.com/key
   * @example https://china-bucket.s3.cn-north-1.amazonaws.com.cn/mykey
   * @param key The S3 key of the object. If not specified, the URL of the
   *      bucket is returned.
   * @param options Options for generating URL.
   * @returns an ObjectS3Url token
   */
  public virtualHostedUrlForObject(key?: string, options?: VirtualHostedStyleUrlOptions): string {
    const domainName = options?.regional ?? true ? this.bucketRegionalDomainName : this.bucketDomainName;
    const prefix = `https://${domainName}`;
    if (typeof key !== 'string') {
      return prefix;
    }
    return this.urlJoin(prefix, key);
  }

  /**
   * The S3 URL of an S3 object. For example:
   * @example s3://onlybucket
   * @example s3://bucket/key
   * @param key The S3 key of the object. If not specified, the S3 URL of the
   *      bucket is returned.
   * @returns an ObjectS3Url token
   */
  public s3UrlForObject(key?: string): string {
    const prefix = 's3://';
    if (typeof key !== 'string') {
      return this.urlJoin(prefix, this.bucketName);
    }
    return this.urlJoin(prefix, this.bucketName, key);
  }

  /**
   * Returns an ARN that represents all objects within the bucket that match
   * the key pattern specified. To represent all keys, specify ``"*"``.
   *
   * If you need to specify a keyPattern with multiple components, concatenate them into a single string, e.g.:
   *
   *   arnForObjects(`home/${team}/${user}/*`)
   *
   */
  public arnForObjects(keyPattern: string): string {
    return `${this.bucketArn}/${keyPattern}`;
  }

  /**
   * Grant read permissions for this bucket and it's contents to an IAM
   * principal (Role/Group/User).
   *
   * If encryption is used, permission to use the key to decrypt the contents
   * of the bucket will also be granted to the same principal.
   *
   * @param identity The principal
   * @param objectsKeyPattern Restrict the permission to a certain key pattern (default '*')
   */
  public grantRead(identity: iam.IGrantable, objectsKeyPattern: any = '*') {
    return this.grant(identity, perms.BUCKET_READ_ACTIONS, perms.KEY_READ_ACTIONS,
      this.bucketArn,
      this.arnForObjects(objectsKeyPattern));
  }

  public grantWrite(identity: iam.IGrantable, objectsKeyPattern: any = '*') {
    return this.grant(identity, this.writeActions, perms.KEY_WRITE_ACTIONS,
      this.bucketArn,
      this.arnForObjects(objectsKeyPattern));
  }

  /**
   * Grants s3:PutObject* and s3:Abort* permissions for this bucket to an IAM principal.
   *
   * If encryption is used, permission to use the key to encrypt the contents
   * of written files will also be granted to the same principal.
   * @param identity The principal
   * @param objectsKeyPattern Restrict the permission to a certain key pattern (default '*')
   */
  public grantPut(identity: iam.IGrantable, objectsKeyPattern: any = '*') {
    return this.grant(identity, this.putActions, perms.KEY_WRITE_ACTIONS,
      this.arnForObjects(objectsKeyPattern));
  }

  public grantPutAcl(identity: iam.IGrantable, objectsKeyPattern: string = '*') {
    return this.grant(identity, perms.BUCKET_PUT_ACL_ACTIONS, [],
      this.arnForObjects(objectsKeyPattern));
  }

  /**
   * Grants s3:DeleteObject* permission to an IAM principal for objects
   * in this bucket.
   *
   * @param identity The principal
   * @param objectsKeyPattern Restrict the permission to a certain key pattern (default '*')
   */
  public grantDelete(identity: iam.IGrantable, objectsKeyPattern: any = '*') {
    return this.grant(identity, perms.BUCKET_DELETE_ACTIONS, [],
      this.arnForObjects(objectsKeyPattern));
  }

  public grantReadWrite(identity: iam.IGrantable, objectsKeyPattern: any = '*') {
    const bucketActions = perms.BUCKET_READ_ACTIONS.concat(this.writeActions);
    // we need unique permissions because some permissions are common between read and write key actions
    const keyActions = [...new Set([...perms.KEY_READ_ACTIONS, ...perms.KEY_WRITE_ACTIONS])];

    return this.grant(identity,
      bucketActions,
      keyActions,
      this.bucketArn,
      this.arnForObjects(objectsKeyPattern));
  }

  /**
   * Allows unrestricted access to objects from this bucket.
   *
   * IMPORTANT: This permission allows anyone to perform actions on S3 objects
   * in this bucket, which is useful for when you configure your bucket as a
   * website and want everyone to be able to read objects in the bucket without
   * needing to authenticate.
   *
   * Without arguments, this method will grant read ("s3:GetObject") access to
   * all objects ("*") in the bucket.
   *
   * The method returns the `iam.Grant` object, which can then be modified
   * as needed. For example, you can add a condition that will restrict access only
   * to an IPv4 range like this:
   *
   *     const grant = bucket.grantPublicAccess();
   *     grant.resourceStatement!.addCondition(‘IpAddress’, { “aws:SourceIp”: “54.240.143.0/24” });
   *
   *
   * @param keyPrefix the prefix of S3 object keys (e.g. `home/*`). Default is "*".
   * @param allowedActions the set of S3 actions to allow. Default is "s3:GetObject".
   */
  public grantPublicAccess(keyPrefix = '*', ...allowedActions: string[]) {
    if (this.disallowPublicAccess) {
      throw new Error("Cannot grant public access when 'blockPublicPolicy' is enabled");
    }

    allowedActions = allowedActions.length > 0 ? allowedActions : ['s3:GetObject'];

    return iam.Grant.addToPrincipalOrResource({
      actions: allowedActions,
      resourceArns: [this.arnForObjects(keyPrefix)],
      grantee: new iam.AnyPrincipal(),
      resource: this,
    });
  }

  private get writeActions(): string[] {
    return [
      ...perms.BUCKET_DELETE_ACTIONS,
      ...this.putActions,
    ];
  }

  private get putActions(): string[] {
    return FeatureFlags.of(this).isEnabled(cxapi.S3_GRANT_WRITE_WITHOUT_ACL)
      ? perms.BUCKET_PUT_ACTIONS
      : perms.LEGACY_BUCKET_PUT_ACTIONS;
  }

  private urlJoin(...components: string[]): string {
    return components.reduce((result, component) => {
      if (result.endsWith('/')) {
        result = result.slice(0, -1);
      }
      if (component.startsWith('/')) {
        component = component.slice(1);
      }
      return `${result}/${component}`;
    });
  }

  private grant(
    grantee: iam.IGrantable,
    bucketActions: string[],
    keyActions: string[],
    resourceArn: string, ...otherResourceArns: string[]) {
    const resources = [resourceArn, ...otherResourceArns];

    const ret = iam.Grant.addToPrincipalOrResource({
      grantee,
      actions: bucketActions,
      resourceArns: resources,
      resource: this,
    });

    if (this.encryptionKey && keyActions && keyActions.length !== 0) {
      this.encryptionKey.grant(grantee, ...keyActions);
    }

    return ret;
  }
}

export interface BlockPublicAccessOptions {
  /**
   * Whether to block public ACLs
   *
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/access-control-block-public-access.html#access-control-block-public-access-options
   */
  readonly blockPublicAcls?: boolean;

  /**
   * Whether to block public policy
   *
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/access-control-block-public-access.html#access-control-block-public-access-options
   */
  readonly blockPublicPolicy?: boolean;

  /**
   * Whether to ignore public ACLs
   *
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/access-control-block-public-access.html#access-control-block-public-access-options
   */
  readonly ignorePublicAcls?: boolean;

  /**
   * Whether to restrict public access
   *
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/access-control-block-public-access.html#access-control-block-public-access-options
   */
  readonly restrictPublicBuckets?: boolean;
}

export class BlockPublicAccess {
  public static readonly BLOCK_ALL = new BlockPublicAccess({
    blockPublicAcls: true,
    blockPublicPolicy: true,
    ignorePublicAcls: true,
    restrictPublicBuckets: true,
  });

  public static readonly BLOCK_ACLS = new BlockPublicAccess({
    blockPublicAcls: true,
    ignorePublicAcls: true,
  });

  public blockPublicAcls: boolean | undefined;
  public blockPublicPolicy: boolean | undefined;
  public ignorePublicAcls: boolean | undefined;
  public restrictPublicBuckets: boolean | undefined;

  constructor(options: BlockPublicAccessOptions) {
    this.blockPublicAcls = options.blockPublicAcls;
    this.blockPublicPolicy = options.blockPublicPolicy;
    this.ignorePublicAcls = options.ignorePublicAcls;
    this.restrictPublicBuckets = options.restrictPublicBuckets;
  }
}

/**
 * Specifies a metrics configuration for the CloudWatch request metrics from an Amazon S3 bucket.
 */
export interface BucketMetrics {
  /**
   * The ID used to identify the metrics configuration.
   */
  readonly id: string;
  /**
   * The prefix that an object must have to be included in the metrics results.
   */
  readonly prefix?: string;
  /**
   * Specifies a list of tag filters to use as a metrics configuration filter.
   * The metrics configuration includes only objects that meet the filter's criteria.
   */
  readonly tagFilters?: {[tag: string]: any};
}

/**
 * All http request methods
 */
export enum HttpMethods {
  /**
   * The GET method requests a representation of the specified resource.
   */
  GET = 'GET',
  /**
   * The PUT method replaces all current representations of the target resource with the request payload.
   */
  PUT = 'PUT',
  /**
   * The HEAD method asks for a response identical to that of a GET request, but without the response body.
   */
  HEAD = 'HEAD',
  /**
   * The POST method is used to submit an entity to the specified resource, often causing a change in state or side effects on the server.
   */
  POST = 'POST',
  /**
   * The DELETE method deletes the specified resource.
   */
  DELETE = 'DELETE',
}

/**
 * Specifies a cross-origin access rule for an Amazon S3 bucket.
 */
export interface CorsRule {
  /**
   * A unique identifier for this rule.
   *
   * @default - No id specified.
   */
  readonly id?: string;
  /**
   * The time in seconds that your browser is to cache the preflight response for the specified resource.
   *
   * @default - No caching.
   */
  readonly maxAge?: number;
  /**
   * Headers that are specified in the Access-Control-Request-Headers header.
   *
   * @default - No headers allowed.
   */
  readonly allowedHeaders?: string[];
  /**
   * An HTTP method that you allow the origin to execute.
   */
  readonly allowedMethods: HttpMethods[];
  /**
   * One or more origins you want customers to be able to access the bucket from.
   */
  readonly allowedOrigins: string[];
  /**
   * One or more headers in the response that you want customers to be able to access from their applications.
   *
   * @default - No headers exposed.
   */
  readonly exposedHeaders?: string[];
}

/**
 * All http request methods
 */
export enum RedirectProtocol {
  HTTP = 'http',
  HTTPS = 'https',
}

/**
 * Specifies a redirect behavior of all requests to a website endpoint of a bucket.
 */
export interface RedirectTarget {
  /**
   * Name of the host where requests are redirected
   */
  readonly hostName: string;

  /**
   * Protocol to use when redirecting requests
   *
   * @default - The protocol used in the original request.
   */
  readonly protocol?: RedirectProtocol;
}

/**
 * All supported inventory list formats.
 */
export enum InventoryFormat {
  /**
   * Generate the inventory list as CSV.
   */
  CSV = 'CSV',
  /**
   * Generate the inventory list as Parquet.
   */
  PARQUET = 'Parquet',
  /**
   * Generate the inventory list as Parquet.
   */
  ORC = 'ORC',
}

/**
 * All supported inventory frequencies.
 */
export enum InventoryFrequency {
  /**
   * A report is generated every day.
   */
  DAILY = 'Daily',
  /**
   * A report is generated every Sunday (UTC timezone) after the initial report.
   */
  WEEKLY = 'Weekly'
}

/**
 * Inventory version support.
 */
export enum InventoryObjectVersion {
  /**
   * Includes all versions of each object in the report.
   */
  ALL = 'All',
  /**
   * Includes only the current version of each object in the report.
   */
  CURRENT = 'Current',
}

/**
 * The destination of the inventory.
 */
export interface InventoryDestination {
  /**
   * Bucket where all inventories will be saved in.
   */
  readonly bucket: IBucket;
  /**
   * The prefix to be used when saving the inventory.
   *
   * @default - No prefix.
   */
  readonly prefix?: string;
  /**
   * The account ID that owns the destination S3 bucket.
   * If no account ID is provided, the owner is not validated before exporting data.
   * It's recommended to set an account ID to prevent problems if the destination bucket ownership changes.
   *
   * @default - No account ID.
   */
  readonly bucketOwner?: string;
}

/**
 * Specifies the inventory configuration of an S3 Bucket.
 *
 * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/storage-inventory.html
 */
export interface Inventory {
  /**
   * The destination of the inventory.
   */
  readonly destination: InventoryDestination;
  /**
   * The inventory will only include objects that meet the prefix filter criteria.
   *
   * @default - No objects prefix
   */
  readonly objectsPrefix?: string;
  /**
   * The format of the inventory.
   *
   * @default InventoryFormat.CSV
   */
  readonly format?: InventoryFormat;
  /**
   * Whether the inventory is enabled or disabled.
   *
   * @default true
   */
  readonly enabled?: boolean;
  /**
   * The inventory configuration ID.
   *
   * @default - generated ID.
   */
  readonly inventoryId?: string;
  /**
   * Frequency at which the inventory should be generated.
   *
   * @default InventoryFrequency.WEEKLY
   */
  readonly frequency?: InventoryFrequency;
  /**
   * If the inventory should contain all the object versions or only the current one.
   *
   * @default InventoryObjectVersion.ALL
   */
  readonly includeObjectVersions?: InventoryObjectVersion;
  /**
   * A list of optional fields to be included in the inventory result.
   *
   * @default - No optional fields.
   */
  readonly optionalFields?: string[];
}
/**
   * The ObjectOwnership of the bucket.
   *
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/about-object-ownership.html
   *
   */
export enum ObjectOwnership {
  /**
   * Objects uploaded to the bucket change ownership to the bucket owner .
   */
  BUCKET_OWNER_PREFERRED = 'BucketOwnerPreferred',
  /**
   * The uploading account will own the object.
   */
  OBJECT_WRITER = 'ObjectWriter',
}
export interface BucketProps {
  /**
   * The kind of server-side encryption to apply to this bucket.
   *
   * If you choose KMS, you can specify a KMS key via `encryptionKey`. If
   * encryption key is not specified, a key will automatically be created.
   *
   * @default - `Kms` if `encryptionKey` is specified, or `Unencrypted` otherwise.
   */
  readonly encryption?: BucketEncryption;

  /**
   * External KMS key to use for bucket encryption.
   *
   * The 'encryption' property must be either not specified or set to "Kms".
   * An error will be emitted if encryption is set to "Unencrypted" or
   * "Managed".
   *
   * @default - If encryption is set to "Kms" and this property is undefined,
   * a new KMS key will be created and associated with this bucket.
   */
  readonly encryptionKey?: kms.IKey;

  /**
  * Enforces SSL for requests. S3.5 of the AWS Foundational Security Best Practices Regarding S3.
  * @see https://docs.aws.amazon.com/config/latest/developerguide/s3-bucket-ssl-requests-only.html
  *
  * @default false
  */
  readonly enforceSSL?: boolean;

  /**
   * Specifies whether Amazon S3 should use an S3 Bucket Key with server-side
   * encryption using KMS (SSE-KMS) for new objects in the bucket.
   *
   * Only relevant, when Encryption is set to {@link BucketEncryption.KMS}
   *
   * @default - false
   */
  readonly bucketKeyEnabled?: boolean;

  /**
   * Physical name of this bucket.
   *
   * @default - Assigned by CloudFormation (recommended).
   */
  readonly bucketName?: string;

  /**
   * Policy to apply when the bucket is removed from this stack.
   *
   * @default - The bucket will be orphaned.
   */
  readonly removalPolicy?: RemovalPolicy;

  /**
   * Whether all objects should be automatically deleted when the bucket is
   * removed from the stack or when the stack is deleted.
   *
   * Requires the `removalPolicy` to be set to `RemovalPolicy.DESTROY`.
   *
   * @default false
   */
  readonly autoDeleteObjects?: boolean;

  /**
   * Whether this bucket should have versioning turned on or not.
   *
   * @default false
   */
  readonly versioned?: boolean;

  /**
   * Rules that define how Amazon S3 manages objects during their lifetime.
   *
   * @default - No lifecycle rules.
   */
  readonly lifecycleRules?: LifecycleRule[];

  /**
   * The name of the index document (e.g. "index.html") for the website. Enables static website
   * hosting for this bucket.
   *
   * @default - No index document.
   */
  readonly websiteIndexDocument?: string;

  /**
   * The name of the error document (e.g. "404.html") for the website.
   * `websiteIndexDocument` must also be set if this is set.
   *
   * @default - No error document.
   */
  readonly websiteErrorDocument?: string;

  /**
   * Specifies the redirect behavior of all requests to a website endpoint of a bucket.
   *
   * If you specify this property, you can't specify "websiteIndexDocument", "websiteErrorDocument" nor , "websiteRoutingRules".
   *
   * @default - No redirection.
   */
  readonly websiteRedirect?: RedirectTarget;

  /**
   * Rules that define when a redirect is applied and the redirect behavior
   *
   * @default - No redirection rules.
   */
  readonly websiteRoutingRules?: RoutingRule[];

  /**
   * Specifies a canned ACL that grants predefined permissions to the bucket.
   *
   * @default BucketAccessControl.PRIVATE
   */
  readonly accessControl?: BucketAccessControl;

  /**
   * Grants public read access to all objects in the bucket.
   * Similar to calling `bucket.grantPublicAccess()`
   *
   * @default false
   */
  readonly publicReadAccess?: boolean;

  /**
   * The block public access configuration of this bucket.
   *
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/access-control-block-public-access.html
   *
   *
   * @default - CloudFormation defaults will apply. New buckets and objects don't allow public access, but users can modify bucket policies or object permissions to allow public access
   */
  readonly blockPublicAccess?: BlockPublicAccess;

  /**
   * The metrics configuration of this bucket.
   *
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-s3-bucket-metricsconfiguration.html
   *
   * @default - No metrics configuration.
   */
  readonly metrics?: BucketMetrics[];

  /**
   * The CORS configuration of this bucket.
   *
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-s3-bucket-cors.html
   *
   * @default - No CORS configuration.
   */
  readonly cors?: CorsRule[];

  /**
   * Destination bucket for the server access logs.
   * @default - If "serverAccessLogsPrefix" undefined - access logs disabled, otherwise - log to current bucket.
   */
  readonly serverAccessLogsBucket?: IBucket;

  /**
   * Optional log file prefix to use for the bucket's access logs.
   * If defined without "serverAccessLogsBucket", enables access logs to current bucket with this prefix.
   * @default - No log file prefix
   */
  readonly serverAccessLogsPrefix?: string;

  /**
   * The inventory configuration of the bucket.
   *
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/storage-inventory.html
   *
   * @default - No inventory configuration
   */
  readonly inventories?: Inventory[];
  /**
   * The objectOwnership of the bucket.
   *
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/about-object-ownership.html
   *
   * @default - No ObjectOwnership configuration, uploading account will own the object.
   *
   */
  readonly objectOwnership?: ObjectOwnership;
}

/**
 * An S3 bucket with associated policy objects
 *
 * This bucket does not yet have all features that exposed by the underlying
 * BucketResource.
 */
export class Bucket extends BucketBase {

  public static fromBucketArn(scope: Construct, id: string, bucketArn: string): IBucket {
    return Bucket.fromBucketAttributes(scope, id, { bucketArn });
  }

  public static fromBucketName(scope: Construct, id: string, bucketName: string): IBucket {
    return Bucket.fromBucketAttributes(scope, id, { bucketName });
  }

  /**
   * Creates a Bucket construct that represents an external bucket.
   *
   * @param scope The parent creating construct (usually `this`).
   * @param id The construct's name.
   * @param attrs A `BucketAttributes` object. Can be obtained from a call to
   * `bucket.export()` or manually created.
   */
  public static fromBucketAttributes(scope: Construct, id: string, attrs: BucketAttributes): IBucket {
    const stack = Stack.of(scope);
    const region = attrs.region ?? stack.region;
    const urlSuffix = stack.urlSuffix;

    const bucketName = parseBucketName(scope, attrs);
    if (!bucketName) {
      throw new Error('Bucket name is required');
    }

    const newUrlFormat = attrs.bucketWebsiteNewUrlFormat === undefined
      ? false
      : attrs.bucketWebsiteNewUrlFormat;

    const websiteDomain = newUrlFormat
      ? `${bucketName}.s3-website.${region}.${urlSuffix}`
      : `${bucketName}.s3-website-${region}.${urlSuffix}`;

    class Import extends BucketBase {
      public readonly bucketName = bucketName!;
      public readonly bucketArn = parseBucketArn(scope, attrs);
      public readonly bucketDomainName = attrs.bucketDomainName || `${bucketName}.s3.${urlSuffix}`;
      public readonly bucketWebsiteUrl = attrs.bucketWebsiteUrl || `http://${websiteDomain}`;
      public readonly bucketWebsiteDomainName = attrs.bucketWebsiteUrl ? Fn.select(2, Fn.split('/', attrs.bucketWebsiteUrl)) : websiteDomain;
      public readonly bucketRegionalDomainName = attrs.bucketRegionalDomainName || `${bucketName}.s3.${region}.${urlSuffix}`;
      public readonly bucketDualStackDomainName = attrs.bucketDualStackDomainName || `${bucketName}.s3.dualstack.${region}.${urlSuffix}`;
      public readonly bucketWebsiteNewUrlFormat = newUrlFormat;
      public readonly encryptionKey = attrs.encryptionKey;
      public readonly isWebsite = attrs.isWebsite ?? false;
      public policy?: BucketPolicy = undefined;
      protected autoCreatePolicy = false;
      protected disallowPublicAccess = false;

      /**
       * Exports this bucket from the stack.
       */
      public export() {
        return attrs;
      }
    }

    return new Import(scope, id, {
      account: attrs.account,
      region: attrs.region,
    });
  }

  public readonly bucketArn: string;
  public readonly bucketName: string;
  public readonly bucketDomainName: string;
  public readonly bucketWebsiteUrl: string;
  public readonly bucketWebsiteDomainName: string;
  public readonly bucketDualStackDomainName: string;
  public readonly bucketRegionalDomainName: string;

  public readonly encryptionKey?: kms.IKey;
  public readonly isWebsite?: boolean;
  public policy?: BucketPolicy;
  protected autoCreatePolicy = true;
  protected disallowPublicAccess?: boolean;
  private accessControl?: BucketAccessControl;
  private readonly lifecycleRules: LifecycleRule[] = [];
  private readonly versioned?: boolean;
  private readonly notifications: BucketNotifications;
  private readonly metrics: BucketMetrics[] = [];
  private readonly cors: CorsRule[] = [];
  private readonly inventories: Inventory[] = [];

  constructor(scope: Construct, id: string, props: BucketProps = {}) {
    super(scope, id, {
      physicalName: props.bucketName,
    });

    const { bucketEncryption, encryptionKey } = this.parseEncryption(props);

    this.validateBucketName(this.physicalName);

    const websiteConfiguration = this.renderWebsiteConfiguration(props);
    this.isWebsite = (websiteConfiguration !== undefined);

    const resource = new CfnBucket(this, 'Resource', {
      bucketName: this.physicalName,
      bucketEncryption,
      versioningConfiguration: props.versioned ? { status: 'Enabled' } : undefined,
      lifecycleConfiguration: Lazy.any({ produce: () => this.parseLifecycleConfiguration() }),
      websiteConfiguration,
      publicAccessBlockConfiguration: props.blockPublicAccess,
      metricsConfigurations: Lazy.any({ produce: () => this.parseMetricConfiguration() }),
      corsConfiguration: Lazy.any({ produce: () => this.parseCorsConfiguration() }),
      accessControl: Lazy.string({ produce: () => this.accessControl }),
      loggingConfiguration: this.parseServerAccessLogs(props),
      inventoryConfigurations: Lazy.any({ produce: () => this.parseInventoryConfiguration() }),
      ownershipControls: this.parseOwnershipControls(props),
    });

    resource.applyRemovalPolicy(props.removalPolicy);

    this.versioned = props.versioned;
    this.encryptionKey = encryptionKey;

    this.bucketName = this.getResourceNameAttribute(resource.ref);
    this.bucketArn = this.getResourceArnAttribute(resource.attrArn, {
      region: '',
      account: '',
      service: 's3',
      resource: this.physicalName,
    });

    this.bucketDomainName = resource.attrDomainName;
    this.bucketWebsiteUrl = resource.attrWebsiteUrl;
    this.bucketWebsiteDomainName = Fn.select(2, Fn.split('/', this.bucketWebsiteUrl));
    this.bucketDualStackDomainName = resource.attrDualStackDomainName;
    this.bucketRegionalDomainName = resource.attrRegionalDomainName;

    this.disallowPublicAccess = props.blockPublicAccess && props.blockPublicAccess.blockPublicPolicy;
    this.accessControl = props.accessControl;

    // Enforce AWS Foundational Security Best Practice
    if (props.enforceSSL) {
      this.enforceSSLStatement();
    }

    if (props.serverAccessLogsBucket instanceof Bucket) {
      props.serverAccessLogsBucket.allowLogDelivery();
    }

    for (const inventory of props.inventories ?? []) {
      this.addInventory(inventory);
    }

    // Add all bucket metric configurations rules
    (props.metrics || []).forEach(this.addMetric.bind(this));
    // Add all cors configuration rules
    (props.cors || []).forEach(this.addCorsRule.bind(this));

    // Add all lifecycle rules
    (props.lifecycleRules || []).forEach(this.addLifecycleRule.bind(this));

    // defines a BucketNotifications construct. Notice that an actual resource will only
    // be added if there are notifications added, so we don't need to condition this.
    this.notifications = new BucketNotifications(this, 'Notifications', { bucket: this });

    if (props.publicReadAccess) {
      this.grantPublicAccess();
    }

    if (props.autoDeleteObjects) {
      if (props.removalPolicy !== RemovalPolicy.DESTROY) {
        throw new Error('Cannot use \'autoDeleteObjects\' property on a bucket without setting removal policy to \'DESTROY\'.');
      }

      this.enableAutoDeleteObjects();
    }
  }

  /**
   * Add a lifecycle rule to the bucket
   *
   * @param rule The rule to add
   */
  public addLifecycleRule(rule: LifecycleRule) {
    if ((rule.noncurrentVersionExpiration !== undefined
      || (rule.noncurrentVersionTransitions && rule.noncurrentVersionTransitions.length > 0))
      && !this.versioned) {
      throw new Error("Cannot use 'noncurrent' rules on a nonversioned bucket");
    }

    this.lifecycleRules.push(rule);
  }

  /**
   * Adds a metrics configuration for the CloudWatch request metrics from the bucket.
   *
   * @param metric The metric configuration to add
   */
  public addMetric(metric: BucketMetrics) {
    this.metrics.push(metric);
  }

  /**
   * Adds a cross-origin access configuration for objects in an Amazon S3 bucket
   *
   * @param rule The CORS configuration rule to add
   */
  public addCorsRule(rule: CorsRule) {
    this.cors.push(rule);
  }

  /**
   * Adds a bucket notification event destination.
   * @param event The event to trigger the notification
   * @param dest The notification destination (Lambda, SNS Topic or SQS Queue)
   *
   * @param filters S3 object key filter rules to determine which objects
   * trigger this event. Each filter must include a `prefix` and/or `suffix`
   * that will be matched against the s3 object key. Refer to the S3 Developer Guide
   * for details about allowed filter rules.
   *
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/NotificationHowTo.html#notification-how-to-filtering
   *
   * @example
   *
   *    bucket.addEventNotification(EventType.OnObjectCreated, myLambda, 'home/myusername/*')
   *
   * @see
   * https://docs.aws.amazon.com/AmazonS3/latest/dev/NotificationHowTo.html
   */
  public addEventNotification(event: EventType, dest: IBucketNotificationDestination, ...filters: NotificationKeyFilter[]) {
    this.notifications.addNotification(event, dest, ...filters);
  }

  /**
   * Subscribes a destination to receive notifications when an object is
   * created in the bucket. This is identical to calling
   * `onEvent(EventType.ObjectCreated)`.
   *
   * @param dest The notification destination (see onEvent)
   * @param filters Filters (see onEvent)
   */
  public addObjectCreatedNotification(dest: IBucketNotificationDestination, ...filters: NotificationKeyFilter[]) {
    return this.addEventNotification(EventType.OBJECT_CREATED, dest, ...filters);
  }

  /**
   * Subscribes a destination to receive notifications when an object is
   * removed from the bucket. This is identical to calling
   * `onEvent(EventType.ObjectRemoved)`.
   *
   * @param dest The notification destination (see onEvent)
   * @param filters Filters (see onEvent)
   */
  public addObjectRemovedNotification(dest: IBucketNotificationDestination, ...filters: NotificationKeyFilter[]) {
    return this.addEventNotification(EventType.OBJECT_REMOVED, dest, ...filters);
  }

  /**
   * Add an inventory configuration.
   *
   * @param inventory configuration to add
   */
  public addInventory(inventory: Inventory): void {
    this.inventories.push(inventory);
  }

  /**
   * Adds an iam statement to enforce SSL requests only.
   */
  private enforceSSLStatement() {
    const statement = new iam.PolicyStatement({
      actions: ['s3:*'],
      conditions: {
        Bool: { 'aws:SecureTransport': 'false' },
      },
      effect: iam.Effect.DENY,
      resources: [this.arnForObjects('*')],
      principals: [new iam.AnyPrincipal()],
    });
    this.addToResourcePolicy(statement);
  }

  private validateBucketName(physicalName: string): void {
    const bucketName = physicalName;
    if (!bucketName || Token.isUnresolved(bucketName)) {
      // the name is a late-bound value, not a defined string,
      // so skip validation
      return;
    }

    const errors: string[] = [];

    // Rules codified from https://docs.aws.amazon.com/AmazonS3/latest/dev/BucketRestrictions.html
    if (bucketName.length < 3 || bucketName.length > 63) {
      errors.push('Bucket name must be at least 3 and no more than 63 characters');
    }
    const charsetMatch = bucketName.match(/[^a-z0-9.-]/);
    if (charsetMatch) {
      errors.push('Bucket name must only contain lowercase characters and the symbols, period (.) and dash (-) '
        + `(offset: ${charsetMatch.index})`);
    }
    if (!/[a-z0-9]/.test(bucketName.charAt(0))) {
      errors.push('Bucket name must start and end with a lowercase character or number '
        + '(offset: 0)');
    }
    if (!/[a-z0-9]/.test(bucketName.charAt(bucketName.length - 1))) {
      errors.push('Bucket name must start and end with a lowercase character or number '
        + `(offset: ${bucketName.length - 1})`);
    }
    const consecSymbolMatch = bucketName.match(/\.-|-\.|\.\./);
    if (consecSymbolMatch) {
      errors.push('Bucket name must not have dash next to period, or period next to dash, or consecutive periods '
        + `(offset: ${consecSymbolMatch.index})`);
    }
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(bucketName)) {
      errors.push('Bucket name must not resemble an IP address');
    }

    if (errors.length > 0) {
      throw new Error(`Invalid S3 bucket name (value: ${bucketName})${EOL}${errors.join(EOL)}`);
    }
  }

  /**
   * Set up key properties and return the Bucket encryption property from the
   * user's configuration.
   */
  private parseEncryption(props: BucketProps): {
    bucketEncryption?: CfnBucket.BucketEncryptionProperty,
    encryptionKey?: kms.IKey
  } {

    // default based on whether encryptionKey is specified
    let encryptionType = props.encryption;
    if (encryptionType === undefined) {
      encryptionType = props.encryptionKey ? BucketEncryption.KMS : BucketEncryption.UNENCRYPTED;
    }

    // if encryption key is set, encryption must be set to KMS.
    if (encryptionType !== BucketEncryption.KMS && props.encryptionKey) {
      throw new Error(`encryptionKey is specified, so 'encryption' must be set to KMS (value: ${encryptionType})`);
    }

    // if bucketKeyEnabled is set, encryption must be set to KMS.
    if (props.bucketKeyEnabled && encryptionType !== BucketEncryption.KMS) {
      throw new Error(`bucketKeyEnabled is specified, so 'encryption' must be set to KMS (value: ${encryptionType})`);
    }

    if (encryptionType === BucketEncryption.UNENCRYPTED) {
      return { bucketEncryption: undefined, encryptionKey: undefined };
    }

    if (encryptionType === BucketEncryption.KMS) {
      const encryptionKey = props.encryptionKey || new kms.Key(this, 'Key', {
        description: `Created by ${this.node.path}`,
      });

      const bucketEncryption = {
        serverSideEncryptionConfiguration: [
          {
            bucketKeyEnabled: props.bucketKeyEnabled,
            serverSideEncryptionByDefault: {
              sseAlgorithm: 'aws:kms',
              kmsMasterKeyId: encryptionKey.keyArn,
            },
          },
        ],
      };
      return { encryptionKey, bucketEncryption };
    }

    if (encryptionType === BucketEncryption.S3_MANAGED) {
      const bucketEncryption = {
        serverSideEncryptionConfiguration: [
          { serverSideEncryptionByDefault: { sseAlgorithm: 'AES256' } },
        ],
      };

      return { bucketEncryption };
    }

    if (encryptionType === BucketEncryption.KMS_MANAGED) {
      const bucketEncryption = {
        serverSideEncryptionConfiguration: [
          { serverSideEncryptionByDefault: { sseAlgorithm: 'aws:kms' } },
        ],
      };
      return { bucketEncryption };
    }

    throw new Error(`Unexpected 'encryptionType': ${encryptionType}`);
  }

  /**
   * Parse the lifecycle configuration out of the bucket props
   * @param props Par
   */
  private parseLifecycleConfiguration(): CfnBucket.LifecycleConfigurationProperty | undefined {
    if (!this.lifecycleRules || this.lifecycleRules.length === 0) {
      return undefined;
    }

    const self = this;

    return { rules: this.lifecycleRules.map(parseLifecycleRule) };

    function parseLifecycleRule(rule: LifecycleRule): CfnBucket.RuleProperty {
      const enabled = rule.enabled ?? true;

      const x: CfnBucket.RuleProperty = {
        // eslint-disable-next-line max-len
        abortIncompleteMultipartUpload: rule.abortIncompleteMultipartUploadAfter !== undefined ? { daysAfterInitiation: rule.abortIncompleteMultipartUploadAfter.toDays() } : undefined,
        expirationDate: rule.expirationDate,
        expirationInDays: rule.expiration?.toDays(),
        id: rule.id,
        noncurrentVersionExpirationInDays: rule.noncurrentVersionExpiration && rule.noncurrentVersionExpiration.toDays(),
        noncurrentVersionTransitions: mapOrUndefined(rule.noncurrentVersionTransitions, t => ({
          storageClass: t.storageClass.value,
          transitionInDays: t.transitionAfter.toDays(),
        })),
        prefix: rule.prefix,
        status: enabled ? 'Enabled' : 'Disabled',
        transitions: mapOrUndefined(rule.transitions, t => ({
          storageClass: t.storageClass.value,
          transitionDate: t.transitionDate,
          transitionInDays: t.transitionAfter && t.transitionAfter.toDays(),
        })),
        tagFilters: self.parseTagFilters(rule.tagFilters),
      };

      return x;
    }
  }

  private parseServerAccessLogs(props: BucketProps): CfnBucket.LoggingConfigurationProperty | undefined {
    if (!props.serverAccessLogsBucket && !props.serverAccessLogsPrefix) {
      return undefined;
    }

    return {
      destinationBucketName: props.serverAccessLogsBucket?.bucketName,
      logFilePrefix: props.serverAccessLogsPrefix,
    };
  }

  private parseMetricConfiguration(): CfnBucket.MetricsConfigurationProperty[] | undefined {
    if (!this.metrics || this.metrics.length === 0) {
      return undefined;
    }

    const self = this;

    return this.metrics.map(parseMetric);

    function parseMetric(metric: BucketMetrics): CfnBucket.MetricsConfigurationProperty {
      return {
        id: metric.id,
        prefix: metric.prefix,
        tagFilters: self.parseTagFilters(metric.tagFilters),
      };
    }
  }

  private parseCorsConfiguration(): CfnBucket.CorsConfigurationProperty | undefined {
    if (!this.cors || this.cors.length === 0) {
      return undefined;
    }

    return { corsRules: this.cors.map(parseCors) };

    function parseCors(rule: CorsRule): CfnBucket.CorsRuleProperty {
      return {
        id: rule.id,
        maxAge: rule.maxAge,
        allowedHeaders: rule.allowedHeaders,
        allowedMethods: rule.allowedMethods,
        allowedOrigins: rule.allowedOrigins,
        exposedHeaders: rule.exposedHeaders,
      };
    }
  }

  private parseTagFilters(tagFilters?: {[tag: string]: any}) {
    if (!tagFilters || tagFilters.length === 0) {
      return undefined;
    }

    return Object.keys(tagFilters).map(tag => ({
      key: tag,
      value: tagFilters[tag],
    }));
  }

  private parseOwnershipControls({ objectOwnership }: BucketProps): CfnBucket.OwnershipControlsProperty | undefined {
    if (!objectOwnership) {
      return undefined;
    }
    return {
      rules: [{
        objectOwnership,
      }],
    };
  }

  private renderWebsiteConfiguration(props: BucketProps): CfnBucket.WebsiteConfigurationProperty | undefined {
    if (!props.websiteErrorDocument && !props.websiteIndexDocument && !props.websiteRedirect && !props.websiteRoutingRules) {
      return undefined;
    }

    if (props.websiteErrorDocument && !props.websiteIndexDocument) {
      throw new Error('"websiteIndexDocument" is required if "websiteErrorDocument" is set');
    }

    if (props.websiteRedirect && (props.websiteErrorDocument || props.websiteIndexDocument || props.websiteRoutingRules)) {
      throw new Error('"websiteIndexDocument", "websiteErrorDocument" and, "websiteRoutingRules" cannot be set if "websiteRedirect" is used');
    }

    const routingRules = props.websiteRoutingRules ? props.websiteRoutingRules.map<CfnBucket.RoutingRuleProperty>((rule) => {
      if (rule.condition && !rule.condition.httpErrorCodeReturnedEquals && !rule.condition.keyPrefixEquals) {
        throw new Error('The condition property cannot be an empty object');
      }

      return {
        redirectRule: {
          hostName: rule.hostName,
          httpRedirectCode: rule.httpRedirectCode,
          protocol: rule.protocol,
          replaceKeyWith: rule.replaceKey && rule.replaceKey.withKey,
          replaceKeyPrefixWith: rule.replaceKey && rule.replaceKey.prefixWithKey,
        },
        routingRuleCondition: rule.condition,
      };
    }) : undefined;

    return {
      indexDocument: props.websiteIndexDocument,
      errorDocument: props.websiteErrorDocument,
      redirectAllRequestsTo: props.websiteRedirect,
      routingRules,
    };
  }

  /**
   * Allows the LogDelivery group to write, fails if ACL was set differently.
   *
   * @see
   * https://docs.aws.amazon.com/AmazonS3/latest/dev/acl-overview.html#canned-acl
   */
  private allowLogDelivery() {
    if (this.accessControl && this.accessControl !== BucketAccessControl.LOG_DELIVERY_WRITE) {
      throw new Error("Cannot enable log delivery to this bucket because the bucket's ACL has been set and can't be changed");
    }

    this.accessControl = BucketAccessControl.LOG_DELIVERY_WRITE;
  }

  private parseInventoryConfiguration(): CfnBucket.InventoryConfigurationProperty[] | undefined {
    if (!this.inventories || this.inventories.length === 0) {
      return undefined;
    }

    return this.inventories.map((inventory, index) => {
      const format = inventory.format ?? InventoryFormat.CSV;
      const frequency = inventory.frequency ?? InventoryFrequency.WEEKLY;
      const id = inventory.inventoryId ?? `${this.node.id}Inventory${index}`;

      if (inventory.destination.bucket instanceof Bucket) {
        inventory.destination.bucket.addToResourcePolicy(new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['s3:PutObject'],
          resources: [
            inventory.destination.bucket.bucketArn,
            inventory.destination.bucket.arnForObjects(`${inventory.destination.prefix ?? ''}*`),
          ],
          principals: [new iam.ServicePrincipal('s3.amazonaws.com')],
          conditions: {
            ArnLike: {
              'aws:SourceArn': this.bucketArn,
            },
          },
        }));
      }

      return {
        id,
        destination: {
          bucketArn: inventory.destination.bucket.bucketArn,
          bucketAccountId: inventory.destination.bucketOwner,
          prefix: inventory.destination.prefix,
          format,
        },
        enabled: inventory.enabled ?? true,
        includedObjectVersions: inventory.includeObjectVersions ?? InventoryObjectVersion.ALL,
        scheduleFrequency: frequency,
        optionalFields: inventory.optionalFields,
        prefix: inventory.objectsPrefix,
      };
    });
  }

  private enableAutoDeleteObjects() {
    const provider = CustomResourceProvider.getOrCreateProvider(this, AUTO_DELETE_OBJECTS_RESOURCE_TYPE, {
      codeDirectory: path.join(__dirname, 'auto-delete-objects-handler'),
      runtime: CustomResourceProviderRuntime.NODEJS_12_X,
      description: `Lambda function for auto-deleting objects in ${this.bucketName} S3 bucket.`,
    });

    // Use a bucket policy to allow the custom resource to delete
    // objects in the bucket
    this.addToResourcePolicy(new iam.PolicyStatement({
      actions: [
        ...perms.BUCKET_READ_ACTIONS, // list objects
        ...perms.BUCKET_DELETE_ACTIONS, // and then delete them
      ],
      resources: [
        this.bucketArn,
        this.arnForObjects('*'),
      ],
      principals: [new iam.ArnPrincipal(provider.roleArn)],
    }));

    const customResource = new CustomResource(this, 'AutoDeleteObjectsCustomResource', {
      resourceType: AUTO_DELETE_OBJECTS_RESOURCE_TYPE,
      serviceToken: provider.serviceToken,
      properties: {
        BucketName: this.bucketName,
      },
    });

    // Ensure bucket policy is deleted AFTER the custom resource otherwise
    // we don't have permissions to list and delete in the bucket.
    // (add a `if` to make TS happy)
    if (this.policy) {
      customResource.node.addDependency(this.policy);
    }
  }
}

/**
 * What kind of server-side encryption to apply to this bucket
 */
export enum BucketEncryption {
  /**
   * Objects in the bucket are not encrypted.
   */
  UNENCRYPTED = 'NONE',

  /**
   * Server-side KMS encryption with a master key managed by KMS.
   */
  KMS_MANAGED = 'MANAGED',

  /**
   * Server-side encryption with a master key managed by S3.
   */
  S3_MANAGED = 'S3MANAGED',

  /**
   * Server-side encryption with a KMS key managed by the user.
   * If `encryptionKey` is specified, this key will be used, otherwise, one will be defined.
   */
  KMS = 'KMS',
}

/**
 * Notification event types.
 */
export enum EventType {
  /**
   * Amazon S3 APIs such as PUT, POST, and COPY can create an object. Using
   * these event types, you can enable notification when an object is created
   * using a specific API, or you can use the s3:ObjectCreated:* event type to
   * request notification regardless of the API that was used to create an
   * object.
   */
  OBJECT_CREATED = 's3:ObjectCreated:*',

  /**
   * Amazon S3 APIs such as PUT, POST, and COPY can create an object. Using
   * these event types, you can enable notification when an object is created
   * using a specific API, or you can use the s3:ObjectCreated:* event type to
   * request notification regardless of the API that was used to create an
   * object.
   */
  OBJECT_CREATED_PUT = 's3:ObjectCreated:Put',

  /**
   * Amazon S3 APIs such as PUT, POST, and COPY can create an object. Using
   * these event types, you can enable notification when an object is created
   * using a specific API, or you can use the s3:ObjectCreated:* event type to
   * request notification regardless of the API that was used to create an
   * object.
   */
  OBJECT_CREATED_POST = 's3:ObjectCreated:Post',

  /**
   * Amazon S3 APIs such as PUT, POST, and COPY can create an object. Using
   * these event types, you can enable notification when an object is created
   * using a specific API, or you can use the s3:ObjectCreated:* event type to
   * request notification regardless of the API that was used to create an
   * object.
   */
  OBJECT_CREATED_COPY = 's3:ObjectCreated:Copy',

  /**
   * Amazon S3 APIs such as PUT, POST, and COPY can create an object. Using
   * these event types, you can enable notification when an object is created
   * using a specific API, or you can use the s3:ObjectCreated:* event type to
   * request notification regardless of the API that was used to create an
   * object.
   */
  OBJECT_CREATED_COMPLETE_MULTIPART_UPLOAD = 's3:ObjectCreated:CompleteMultipartUpload',

  /**
   * By using the ObjectRemoved event types, you can enable notification when
   * an object or a batch of objects is removed from a bucket.
   *
   * You can request notification when an object is deleted or a versioned
   * object is permanently deleted by using the s3:ObjectRemoved:Delete event
   * type. Or you can request notification when a delete marker is created for
   * a versioned object by using s3:ObjectRemoved:DeleteMarkerCreated. For
   * information about deleting versioned objects, see Deleting Object
   * Versions. You can also use a wildcard s3:ObjectRemoved:* to request
   * notification anytime an object is deleted.
   *
   * You will not receive event notifications from automatic deletes from
   * lifecycle policies or from failed operations.
   */
  OBJECT_REMOVED = 's3:ObjectRemoved:*',

  /**
   * By using the ObjectRemoved event types, you can enable notification when
   * an object or a batch of objects is removed from a bucket.
   *
   * You can request notification when an object is deleted or a versioned
   * object is permanently deleted by using the s3:ObjectRemoved:Delete event
   * type. Or you can request notification when a delete marker is created for
   * a versioned object by using s3:ObjectRemoved:DeleteMarkerCreated. For
   * information about deleting versioned objects, see Deleting Object
   * Versions. You can also use a wildcard s3:ObjectRemoved:* to request
   * notification anytime an object is deleted.
   *
   * You will not receive event notifications from automatic deletes from
   * lifecycle policies or from failed operations.
   */
  OBJECT_REMOVED_DELETE = 's3:ObjectRemoved:Delete',

  /**
   * By using the ObjectRemoved event types, you can enable notification when
   * an object or a batch of objects is removed from a bucket.
   *
   * You can request notification when an object is deleted or a versioned
   * object is permanently deleted by using the s3:ObjectRemoved:Delete event
   * type. Or you can request notification when a delete marker is created for
   * a versioned object by using s3:ObjectRemoved:DeleteMarkerCreated. For
   * information about deleting versioned objects, see Deleting Object
   * Versions. You can also use a wildcard s3:ObjectRemoved:* to request
   * notification anytime an object is deleted.
   *
   * You will not receive event notifications from automatic deletes from
   * lifecycle policies or from failed operations.
   */
  OBJECT_REMOVED_DELETE_MARKER_CREATED = 's3:ObjectRemoved:DeleteMarkerCreated',

  /**
   * Using restore object event types you can receive notifications for
   * initiation and completion when restoring objects from the S3 Glacier
   * storage class.
   *
   * You use s3:ObjectRestore:Post to request notification of object restoration
   * initiation.
   */
  OBJECT_RESTORE_POST = 's3:ObjectRestore:Post',

  /**
   * Using restore object event types you can receive notifications for
   * initiation and completion when restoring objects from the S3 Glacier
   * storage class.
   *
   * You use s3:ObjectRestore:Completed to request notification of
   * restoration completion.
   */
  OBJECT_RESTORE_COMPLETED = 's3:ObjectRestore:Completed',

  /**
   * You can use this event type to request Amazon S3 to send a notification
   * message when Amazon S3 detects that an object of the RRS storage class is
   * lost.
   */
  REDUCED_REDUNDANCY_LOST_OBJECT = 's3:ReducedRedundancyLostObject',

  /**
   * You receive this notification event when an object that was eligible for
   * replication using Amazon S3 Replication Time Control failed to replicate.
   */
  REPLICATION_OPERATION_FAILED_REPLICATION = 's3:Replication:OperationFailedReplication',

  /**
   * You receive this notification event when an object that was eligible for
   * replication using Amazon S3 Replication Time Control exceeded the 15-minute
   * threshold for replication.
   */
  REPLICATION_OPERATION_MISSED_THRESHOLD = 's3:Replication:OperationMissedThreshold',

  /**
   * You receive this notification event for an object that was eligible for
   * replication using the Amazon S3 Replication Time Control feature replicated
   * after the 15-minute threshold.
   */
  REPLICATION_OPERATION_REPLICATED_AFTER_THRESHOLD = 's3:Replication:OperationReplicatedAfterThreshold',

  /**
   * You receive this notification event for an object that was eligible for
   * replication using Amazon S3 Replication Time Control but is no longer tracked
   * by replication metrics.
   */
  REPLICATION_OPERATION_NOT_TRACKED = 's3:Replication:OperationNotTracked',
}

export interface NotificationKeyFilter {
  /**
   * S3 keys must have the specified prefix.
   */
  readonly prefix?: string;

  /**
   * S3 keys must have the specified suffix.
   */
  readonly suffix?: string;
}

/**
 * Options for the onCloudTrailPutObject method
 */
export interface OnCloudTrailBucketEventOptions extends events.OnEventOptions {
  /**
   * Only watch changes to these object paths
   *
   * @default - Watch changes to all objects
   */
  readonly paths?: string[];
}

/**
 * Default bucket access control types.
 *
 * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/acl-overview.html
 */
export enum BucketAccessControl {
  /**
   * Owner gets FULL_CONTROL. No one else has access rights.
   */
  PRIVATE = 'Private',

  /**
   * Owner gets FULL_CONTROL. The AllUsers group gets READ access.
   */
  PUBLIC_READ = 'PublicRead',

  /**
   * Owner gets FULL_CONTROL. The AllUsers group gets READ and WRITE access.
   * Granting this on a bucket is generally not recommended.
   */
  PUBLIC_READ_WRITE = 'PublicReadWrite',

  /**
   * Owner gets FULL_CONTROL. The AuthenticatedUsers group gets READ access.
   */
  AUTHENTICATED_READ = 'AuthenticatedRead',

  /**
   * The LogDelivery group gets WRITE and READ_ACP permissions on the bucket.
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/ServerLogs.html
   */
  LOG_DELIVERY_WRITE = 'LogDeliveryWrite',

  /**
   * Object owner gets FULL_CONTROL. Bucket owner gets READ access.
   * If you specify this canned ACL when creating a bucket, Amazon S3 ignores it.
   */
  BUCKET_OWNER_READ = 'BucketOwnerRead',

  /**
   * Both the object owner and the bucket owner get FULL_CONTROL over the object.
   * If you specify this canned ACL when creating a bucket, Amazon S3 ignores it.
   */
  BUCKET_OWNER_FULL_CONTROL = 'BucketOwnerFullControl',

  /**
   * Owner gets FULL_CONTROL. Amazon EC2 gets READ access to GET an Amazon Machine Image (AMI) bundle from Amazon S3.
   */
  AWS_EXEC_READ = 'AwsExecRead',
}

export interface RoutingRuleCondition {
  /**
   * The HTTP error code when the redirect is applied
   *
   * In the event of an error, if the error code equals this value, then the specified redirect is applied.
   *
   * If both condition properties are specified, both must be true for the redirect to be applied.
   *
   * @default - The HTTP error code will not be verified
   */
  readonly httpErrorCodeReturnedEquals?: string;

  /**
   * The object key name prefix when the redirect is applied
   *
   * If both condition properties are specified, both must be true for the redirect to be applied.
   *
   * @default - The object key name will not be verified
   */
  readonly keyPrefixEquals?: string;
}

export class ReplaceKey {
  /**
   * The specific object key to use in the redirect request
   */
  public static with(keyReplacement: string) {
    return new this(keyReplacement);
  }

  /**
   * The object key prefix to use in the redirect request
   */
  public static prefixWith(keyReplacement: string) {
    return new this(undefined, keyReplacement);
  }

  private constructor(public readonly withKey?: string, public readonly prefixWithKey?: string) {
  }
}

/**
 * Rule that define when a redirect is applied and the redirect behavior.
 *
 * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/how-to-page-redirect.html
 */
export interface RoutingRule {
  /**
   * The host name to use in the redirect request
   *
   * @default - The host name used in the original request.
   */
  readonly hostName?: string;

  /**
   * The HTTP redirect code to use on the response
   *
   * @default "301" - Moved Permanently
   */
  readonly httpRedirectCode?: string;

  /**
   * Protocol to use when redirecting requests
   *
   * @default - The protocol used in the original request.
   */
  readonly protocol?: RedirectProtocol;

  /**
   * Specifies the object key prefix to use in the redirect request
   *
   * @default - The key will not be replaced
   */
  readonly replaceKey?: ReplaceKey;

  /**
   * Specifies a condition that must be met for the specified redirect to apply.
   *
   * @default - No condition
   */
  readonly condition?: RoutingRuleCondition;
}

/**
 * Options for creating Virtual-Hosted style URL.
 */
export interface VirtualHostedStyleUrlOptions {
  /**
   * Specifies the URL includes the region.
   *
   * @default - true
   */
  readonly regional?: boolean;
}

function mapOrUndefined<T, U>(list: T[] | undefined, callback: (element: T) => U): U[] | undefined {
  if (!list || list.length === 0) {
    return undefined;
  }

  return list.map(callback);
}
