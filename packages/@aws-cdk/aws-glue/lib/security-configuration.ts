import * as kms from '@aws-cdk/aws-kms';
import * as cdk from '@aws-cdk/core';
import * as constructs from 'constructs';
import { CfnSecurityConfiguration } from './glue.generated';

/**
 * Interface representing a created or an imported {@link SecurityConfiguration}.
 */
export interface ISecurityConfiguration extends cdk.IResource {
  /**
   * The name of the security configuration.
   * @attribute
   */
  readonly securityConfigurationName: string;
}

/**
 * Encryption mode for S3.
 * @see https://docs.aws.amazon.com/glue/latest/webapi/API_S3Encryption.html#Glue-Type-S3Encryption-S3EncryptionMode
 */
export enum S3EncryptionMode {
  /**
   * Server side encryption (SSE) with an Amazon S3-managed key.
   *
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingServerSideEncryption.html
   */
  S3_MANAGED = 'SSE-S3',

  /**
   * Server-side encryption (SSE) with an AWS KMS key managed by the account owner.
   *
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingKMSEncryption.html
   */
  KMS = 'SSE-KMS',
}

/**
 * Encryption mode for CloudWatch Logs.
 * @see https://docs.aws.amazon.com/glue/latest/webapi/API_CloudWatchEncryption.html#Glue-Type-CloudWatchEncryption-CloudWatchEncryptionMode
 */
export enum CloudWatchEncryptionMode {
  /**
   * Server-side encryption (SSE) with an AWS KMS key managed by the account owner.
   *
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingKMSEncryption.html
   */
  KMS = 'SSE-KMS',
}

/**
 * Encryption mode for Job Bookmarks.
 * @see https://docs.aws.amazon.com/glue/latest/webapi/API_JobBookmarksEncryption.html#Glue-Type-JobBookmarksEncryption-JobBookmarksEncryptionMode
 */
export enum JobBookmarksEncryptionMode {
  /**
   * Client-side encryption (CSE) with an AWS KMS key managed by the account owner.
   *
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingClientSideEncryption.html
   */
  CLIENT_SIDE_KMS = 'CSE-KMS',
}

/**
 * S3 encryption configuration.
 */
export interface S3Encryption {
  /**
   * Encryption mode.
   */
  readonly mode: S3EncryptionMode,

  /**
   * The KMS key to be used to encrypt the data.
   * @default no kms key if mode = S3_MANAGED. A key will be created if one is not provided and mode = KMS.
   */
  readonly kmsKey?: kms.IKey,
}

/**
 * CloudWatch Logs encryption configuration.
 */
export interface CloudWatchEncryption {
  /**
   * Encryption mode
   */
  readonly mode: CloudWatchEncryptionMode;

  /**
   * The KMS key to be used to encrypt the data.
   * @default A key will be created if one is not provided.
   */
  readonly kmsKey?: kms.IKey,
}

/**
 * Job bookmarks encryption configuration.
 */
export interface JobBookmarksEncryption {
  /**
   * Encryption mode.
   */
  readonly mode: JobBookmarksEncryptionMode;

  /**
   * The KMS key to be used to encrypt the data.
   * @default A key will be created if one is not provided.
   */
  readonly kmsKey?: kms.IKey,
}

/**
 * Constructions properties of {@link SecurityConfiguration}.
 */
export interface SecurityConfigurationProps {
  /**
   * The name of the security configuration.
   */
  readonly securityConfigurationName: string;

  /**
   * The encryption configuration for Amazon CloudWatch Logs.
   * @default no cloudwatch logs encryption.
   */
  readonly cloudWatchEncryption?: CloudWatchEncryption,

  /**
   * The encryption configuration for Glue Job Bookmarks.
   * @default no job bookmarks encryption.
   */
  readonly jobBookmarksEncryption?: JobBookmarksEncryption,

  /**
   * The encryption configuration for Amazon Simple Storage Service (Amazon S3) data.
   * @default no s3 encryption.
   */
  readonly s3Encryption?: S3Encryption,
}

/**
 * A security configuration is a set of security properties that can be used by AWS Glue to encrypt data at rest.
 *
 * The following scenarios show some of the ways that you can use a security configuration.
 * - Attach a security configuration to an AWS Glue crawler to write encrypted Amazon CloudWatch Logs.
 * - Attach a security configuration to an extract, transform, and load (ETL) job to write encrypted Amazon Simple Storage Service (Amazon S3) targets and encrypted CloudWatch Logs.
 * - Attach a security configuration to an ETL job to write its jobs bookmarks as encrypted Amazon S3 data.
 * - Attach a security configuration to a development endpoint to write encrypted Amazon S3 targets.
 */
export class SecurityConfiguration extends cdk.Resource implements ISecurityConfiguration {
  /**
   * Creates a Connection construct that represents an external security configuration.
   *
   * @param scope The scope creating construct (usually `this`).
   * @param id The construct's id.
   * @param securityConfigurationName name of external security configuration.
   */
  public static fromSecurityConfigurationName(scope: constructs.Construct, id: string,
    securityConfigurationName: string): ISecurityConfiguration {
    class Import extends cdk.Resource implements ISecurityConfiguration {
      public readonly securityConfigurationName = securityConfigurationName;
    }
    return new Import(scope, id);
  }

  /**
   * The name of the security configuration.
   * @attribute
   */
  public readonly securityConfigurationName: string;

  /**
   * The KMS key used in CloudWatch encryption if it requires a kms key.
   */
  public readonly cloudWatchEncryptionKey?: kms.IKey;

  /**
   * The KMS key used in job bookmarks encryption if it requires a kms key.
   */
  public readonly jobBookmarksEncryptionKey?: kms.IKey;

  /**
   * The KMS key used in S3 encryption if it requires a kms key.
   */
  public readonly s3EncryptionKey?: kms.IKey;

  constructor(scope: constructs.Construct, id: string, props: SecurityConfigurationProps) {
    super(scope, id, {
      physicalName: props.securityConfigurationName,
    });

    if (!props.s3Encryption && !props.cloudWatchEncryption && !props.jobBookmarksEncryption) {
      throw new Error('One of cloudWatchEncryption, jobBookmarksEncryption or s3Encryption must be defined');
    }

    const kmsKeyCreationRequired =
      (props.s3Encryption && props.s3Encryption.mode === S3EncryptionMode.KMS && !props.s3Encryption.kmsKey) ||
      (props.cloudWatchEncryption && !props.cloudWatchEncryption.kmsKey) ||
      (props.jobBookmarksEncryption && !props.jobBookmarksEncryption.kmsKey);
    const autoCreatedKmsKey = kmsKeyCreationRequired ? new kms.Key(this, 'Key') : undefined;

    let cloudWatchEncryption;
    if (props.cloudWatchEncryption) {
      this.cloudWatchEncryptionKey = props.cloudWatchEncryption.kmsKey || autoCreatedKmsKey;
      cloudWatchEncryption = {
        cloudWatchEncryptionMode: props.cloudWatchEncryption.mode,
        kmsKeyArn: this.cloudWatchEncryptionKey?.keyArn,
      };
    }

    let jobBookmarksEncryption;
    if (props.jobBookmarksEncryption) {
      this.jobBookmarksEncryptionKey = props.jobBookmarksEncryption.kmsKey || autoCreatedKmsKey;
      jobBookmarksEncryption = {
        jobBookmarksEncryptionMode: props.jobBookmarksEncryption.mode,
        kmsKeyArn: this.jobBookmarksEncryptionKey?.keyArn,
      };
    }

    let s3Encryptions;
    if (props.s3Encryption) {
      if (props.s3Encryption.mode === S3EncryptionMode.KMS) {
        this.s3EncryptionKey = props.s3Encryption.kmsKey || autoCreatedKmsKey;
      }
      // NOTE: CloudFormations errors out if array is of length > 1. That's why the props don't expose an array
      s3Encryptions = [{
        s3EncryptionMode: props.s3Encryption.mode,
        kmsKeyArn: this.s3EncryptionKey?.keyArn,
      }];
    }

    const resource = new CfnSecurityConfiguration(this, 'Resource', {
      name: props.securityConfigurationName,
      encryptionConfiguration: {
        cloudWatchEncryption,
        jobBookmarksEncryption,
        s3Encryptions,
      },
    });

    this.securityConfigurationName = this.getResourceNameAttribute(resource.ref);
  }
}
