import { PolicyDocument } from '@aws-cdk/aws-iam';
import { RemovalPolicy, Resource } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { IBucket } from './bucket';
import { CfnBucketPolicy } from './s3.generated';

export interface BucketPolicyProps {
  /**
   * The Amazon S3 bucket that the policy applies to.
   */
  readonly bucket: IBucket;

  /**
   * Policy to apply when the policy is removed from this stack.
   *
   * @default - RemovalPolicy.DESTROY.
   */
  readonly removalPolicy?: RemovalPolicy;
}

/**
 * Applies an Amazon S3 bucket policy to an Amazon S3 bucket.
 */
export class BucketPolicy extends Resource {
  /**
   * A policy document containing permissions to add to the specified bucket.
   * For more information, see Access Policy Language Overview in the Amazon
   * Simple Storage Service Developer Guide.
   */
  public readonly document = new PolicyDocument();

  private resource: CfnBucketPolicy;

  constructor(scope: Construct, id: string, props: BucketPolicyProps) {
    super(scope, id);

    if (!props.bucket.bucketName) {
      throw new Error('Bucket doesn\'t have a bucketName defined');
    }

    this.resource = new CfnBucketPolicy(this, 'Resource', {
      bucket: props.bucket.bucketName,
      policyDocument: this.document,
    });

    if (props.removalPolicy) {
      this.resource.applyRemovalPolicy(props.removalPolicy);
    }
  }

  /**
   * Sets the removal policy for the BucketPolicy.
   * @param removalPolicy the RemovalPolicy to set.
   */
  public applyRemovalPolicy(removalPolicy: RemovalPolicy) {
    this.resource.applyRemovalPolicy(removalPolicy);
  }
}
