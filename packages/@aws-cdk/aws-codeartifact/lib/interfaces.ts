import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import { IResource } from '@aws-cdk/core';

/**
 * Represents a CodeArtifact repository
 */
export interface IRepository extends IResource, RepositoryAttributes {
  /**
       * Grants the given IAM identity permissions to read from the repository
       */
  grantRead(identity: iam.IGrantable): iam.Grant;
  /**
       * Grants the given IAM identity permissions to write from the repository
       */
  grantWrite(identity: iam.IGrantable): iam.Grant;
  /**
       * Grants the given IAM identity permissions to read/write from the repository
       */
  grantReadWrite(identity: iam.IGrantable): iam.Grant;
  /**
       * Defines a CloudWatch event rule which triggers for repository events. Use
       * `rule.addEventPattern(pattern)` to specify a filter.
       */
  onEvent(id: string, options?: events.OnEventOptions): events.Rule;
  /**
       * Defines a CloudWatch event rule which triggers when a "CodeArtifact Package
       *  Version State Change" event occurs.
       */
  onPackageVersionStateChange(id: string, options?: events.OnEventOptions): events.Rule;

  /**
   * Set the domain for the repository
   * @param domain The domain the repository is apart of
   */
  setDomain(domain: IDomain): void;
}

/**
 * Reference to a repository
 */
export interface RepositoryAttributes {

  /**
     * The ARN of repository resource.
     * Equivalent to doing `{ 'Fn::GetAtt': ['LogicalId', 'Arn' ]}`
     * in CloudFormation if the underlying CloudFormation resource
     * surfaces the ARN as a return value -
     * if not, we usually construct the ARN "by hand" in the construct,
     * using the Fn::Join function.
     *
     * It needs to be annotated with '@attribute' if the underlying CloudFormation resource
     * surfaces the ARN as a return value.
     *
     * @attribute
     */
  readonly repositoryArn?: string;
  /**
       * The physical name of the repository resource.
       * Often, equivalent to doing `{ 'Ref': 'LogicalId' }`
       * (but not always - depends on the particular resource modeled)
       * in CloudFormation.
       * Also needs to be annotated with '@attribute'.
       *
       * @attribute
       */
  readonly repositoryName?: string;
  /**
       * A text description of the repository.
       */
  readonly repositoryDescription?: string;
  /**
       * The domain repository owner
       * Often, equivalent to the account id.
       * @attribute
       */
  readonly repositoryDomainOwner?: string;
  /**
       * The domain the repository belongs to
       * @attribute
       */
  readonly repositoryDomainName?: string;
}

/**
 * Represents a CodeArtifact domain
 */
export interface IDomain extends IResource, DomainAttributes {
  /**
   * Add a repositories to the domain
   */
  addRepositories(...repositories: IRepository[]): IDomain
}

/**
 * Reference to a domain
 */
export interface DomainAttributes {
  /**
 * The ARN of domain resource.
 * Equivalent to doing `{ 'Fn::GetAtt': ['LogicalId', 'Arn' ]}`
 * in CloudFormation if the underlying CloudFormation resource
 * surfaces the ARN as a return value -
 * if not, we usually construct the ARN "by hand" in the construct,
 * using the Fn::Join function.
 *
 * It needs to be annotated with '@attribute' if the underlying CloudFormation resource
 * surfaces the ARN as a return value.
 *
 * @attribute
 */
  readonly domainArn: string;

  /**
   * The physical name of the domain resource.
   * Often, equivalent to doing `{ 'Ref': 'LogicalId' }`
   * (but not always - depends on the particular resource modeled)
   * in CloudFormation.
   * Also needs to be annotated with '@attribute'.
   *
   * @attribute
   */
  readonly domainName?: string;

  /**
   * The domain owner
   * Often, equivalent to the account id.
   * @attribute
   */
  readonly domainOwner?: string;

  /**
   * The KMS encryption key used for the domain resource.
   * @default AWS Managed Key
   * @attribute
   */
  readonly domainEncryptionKey?: kms.IKey;
}