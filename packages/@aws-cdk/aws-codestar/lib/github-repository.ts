import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import { Construct } from 'constructs';
import * as codestar from './codestar.generated';

/**
 * GitHubRepository resource interface
 */
export interface IGitHubRepository extends cdk.IResource {
  /**
   * the repository owner
   */
  readonly owner: string

  /**
   * the repository name
   */
  readonly repo: string
}

/**
 * Construction properties of {@link GitHubRepository}.
 */
export interface GitHubRepositoryProps {
  /**
   * The GitHub user name for the owner of the GitHub repository to be created. If this
   * repository should be owned by a GitHub organization, provide its name
   */
  readonly owner: string;

  /**
   * The name of the repository you want to create in GitHub with AWS CloudFormation stack creation
   */
  readonly repositoryName: string;

  /**
   * The GitHub user's personal access token for the GitHub repository
   */
  readonly accessToken: cdk.SecretValue;

  /**
   * The name of the Amazon S3 bucket that contains the ZIP file with the content to be committed to the new repository
   */
  readonly contentsBucket: s3.IBucket;

  /**
   * The S3 object key or file name for the ZIP file
   */
  readonly contentsKey: string;

  /**
   * The object version of the ZIP file, if versioning is enabled for the Amazon S3 bucket
   *
   * @default - not specified
   */
  readonly contentsS3Version?: string;

  /**
   * Indicates whether to enable issues for the GitHub repository. You can use GitHub issues to track information
   * and bugs for your repository.
   *
   * @default true
   */
  readonly enableIssues?: boolean;

  /**
   * Indicates whether the GitHub repository is a private repository. If so, you choose who can see and commit to
   * this repository.
   *
   * @default RepositoryVisibility.PUBLIC
   */
  readonly visibility?: RepositoryVisibility;

  /**
   * A comment or description about the new repository. This description is displayed in GitHub after the repository
   * is created.
   *
   * @default - no description
   */
  readonly description?: string;
}

/**
 * The GitHubRepository resource
 */
export class GitHubRepository extends cdk.Resource implements IGitHubRepository {
  public readonly owner: string;
  public readonly repo: string;

  constructor(scope: Construct, id: string, props: GitHubRepositoryProps) {
    super(scope, id);

    const resource = new codestar.CfnGitHubRepository(this, 'Resource', {
      repositoryOwner: props.owner,
      repositoryName: props.repositoryName,
      repositoryAccessToken: props.accessToken.toString(),
      code: {
        s3: {
          bucket: props.contentsBucket.bucketName,
          key: props.contentsKey,
          objectVersion: props.contentsS3Version,
        },
      },
      enableIssues: props.enableIssues ?? true,
      isPrivate: props.visibility === RepositoryVisibility.PRIVATE ? true : false,
      repositoryDescription: props.description,
    });

    this.owner = cdk.Fn.select(0, cdk.Fn.split('/', resource.ref));
    this.repo = cdk.Fn.select(1, cdk.Fn.split('/', resource.ref));
  }
}

/**
 * Visibility of the GitHubRepository
 */
export enum RepositoryVisibility {
  /**
   * private repository
   */
  PRIVATE,
  /**
   * public repository
   */
  PUBLIC,
}
