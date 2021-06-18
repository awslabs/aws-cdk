import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnCloudFrontOriginAccessIdentity } from './cloudfront.generated';

/**
 * Properties of CloudFront OriginAccessIdentity
 */
export interface OriginAccessIdentityProps {
  /**
   * Any comments you want to include about the origin access identity.
   *
   * @default "Allows CloudFront to reach the bucket"
   */
  readonly comment?: string;
}

/**
 * Interface for CloudFront OriginAccessIdentity
 */
export interface IOriginAccessIdentity extends cdk.IResource, iam.IGrantable {
  /**
   * The Origin Access Identity Name
   */
  readonly originAccessIdentityName: string;
}

abstract class OriginAccessIdentityBase extends cdk.Resource {
  /**
   * The Origin Access Identity Name (physical id)
   */
  public abstract readonly originAccessIdentityName: string;
  /**
   * Derived principal value for bucket access
   */
  public abstract readonly grantPrincipal: iam.IPrincipal;

  /**
   * The ARN to include in S3 bucket policy to allow CloudFront access
   */
  protected arn(): string {
    return cdk.Stack.of(this).formatArn(
      {
        service: 'iam',
        region: '', // global
        account: 'cloudfront',
        resource: 'user',
        resourceName: `CloudFront Origin Access Identity ${this.originAccessIdentityName}`,
      },
    );
  }
}

/**
 * An origin access identity is a special CloudFront user that you can
 * associate with Amazon S3 origins, so that you can secure all or just some of
 * your Amazon S3 content.
 *
 * @resource AWS::CloudFront::CloudFrontOriginAccessIdentity
 */
export class OriginAccessIdentity extends OriginAccessIdentityBase implements IOriginAccessIdentity {
  /**
   * Creates a OriginAccessIdentity by providing the OriginAccessIdentityName
   */
  public static fromOriginAccessIdentityName(
    scope: Construct,
    id: string,
    originAccessIdentityName: string): IOriginAccessIdentity {
    class Import extends OriginAccessIdentityBase {
      public readonly originAccessIdentityName = originAccessIdentityName;
      public readonly grantPrincipal = new iam.ArnPrincipal(this.arn());
      constructor(s: Construct, i: string) {
        super(s, i, { physicalName: originAccessIdentityName });
      }
    }

    return new Import(scope, id);
  }

  /**
   * The Amazon S3 canonical user ID for the origin access identity, used when
   * giving the origin access identity read permission to an object in Amazon
   * S3.
   *
   * @attribute
   */
  public readonly cloudFrontOriginAccessIdentityS3CanonicalUserId: string;

  /**
   * Derived principal value for bucket access
   */
  public readonly grantPrincipal: iam.IPrincipal;

  /**
   * The Origin Access Identity Name (physical id)
   *
   * @attribute
   */
  public readonly originAccessIdentityName: string;

  /**
   * CDK L1 resource
   */
  private readonly resource: CfnCloudFrontOriginAccessIdentity;

  constructor(scope: Construct, id: string, props?: OriginAccessIdentityProps) {
    super(scope, id);

    // Comment has a max length of 128.
    const comment = (props?.comment ?? 'Allows CloudFront to reach the bucket').substr(0, 128);
    this.resource = new CfnCloudFrontOriginAccessIdentity(this, 'Resource', {
      cloudFrontOriginAccessIdentityConfig: { comment },
    });
    // physical id - OAI name
    this.originAccessIdentityName = this.getResourceNameAttribute(this.resource.ref);

    // Canonical user to grant access to in the S3 Bucket Policy
    this.cloudFrontOriginAccessIdentityS3CanonicalUserId = this.resource.attrS3CanonicalUserId;
    // The principal for must be either the canonical user or a special ARN
    // with the CloudFront Origin Access Id (see `arn()` method). For
    // import/export the OAI is anyway required so the principal is constructed
    // with it. But for the normal case the S3 Canonical User as a nicer
    // interface and does not require constructing the ARN.
    this.grantPrincipal = new iam.CanonicalUserPrincipal(this.cloudFrontOriginAccessIdentityS3CanonicalUserId);
  }
}
