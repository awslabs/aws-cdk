import * as codecommit from '@aws-cdk/aws-codecommit';
import * as cp from '@aws-cdk/aws-codepipeline';
import { Artifact } from '@aws-cdk/aws-codepipeline';
import * as cp_actions from '@aws-cdk/aws-codepipeline-actions';
import { Action, CodeCommitTrigger, GitHubTrigger, S3Trigger } from '@aws-cdk/aws-codepipeline-actions';
import * as iam from '@aws-cdk/aws-iam';
import { IBucket } from '@aws-cdk/aws-s3';
import { SecretValue } from '@aws-cdk/core';
import { FileSet, Step } from '../blueprint';
import { CodePipelineActionFactoryResult, ProduceActionOptions, ICodePipelineActionFactory } from './codepipeline-action-factory';

/**
 * CodePipeline source steps
 *
 * This class contains a number of factory methods for the different types
 * of sources that CodePipeline supports.
 */
export abstract class CodePipelineSource extends Step implements ICodePipelineActionFactory {
  /**
   * Returns a GitHub source, using OAuth tokens to authenticate with
   * GitHub and a separate webhook to detect changes. This is no longer
   * the recommended method. Please consider using `connection()`
   * instead.
   *
   * Pass in the owner and repository in a single string, like this:
   *
   * ```ts
   * CodePipelineSource.gitHub('owner/repo', 'main');
   * ```
   *
   * Authentication will be done by a secret called `github-token` in AWS
   * Secrets Manager (unless specified otherwise).
   *
   * The token should have these permissions:
   *
   * * **repo** - to read the repository
   * * **admin:repo_hook** - if you plan to use webhooks (true by default)
   */
  public static gitHub(repoString: string, branch: string, props: GitHubSourceOptions = {}): CodePipelineSource {
    return new GitHubSource(repoString, branch, props);
  }

  /**
   * Returns an S3 source.
   *
   * @param bucket The bucket where the source code is located.
   * @param props The options, which include the key that identifies the source code file and
   * and how the pipeline should be triggered.
   *
   * Example:
   *
   * ```ts
   * const bucket: IBucket = ...
   * CodePipelineSource.s3(bucket, {
   *   key: 'path/to/file.zip',
   * });
   * ```
   */
  public static s3(bucket: IBucket, objectKey: string, props: S3SourceOptions = {}): CodePipelineSource {
    return new S3Source(bucket, objectKey, props);
  }

  /**
   * Returns a CodeStar connection source. A CodeStar connection allows AWS CodePipeline to
   * access external resources, such as repositories in GitHub, GitHub Enterprise or
   * BitBucket.
   *
   * To use this method, you first need to create a CodeStar connection
   * using the AWS console. In the process, you may have to sign in to the external provider
   * -- GitHub, for example -- to authorize AWS to read and modify your repository.
   * Once you have done this, copy the connection ARN and use it to create the source.
   *
   * Example:
   *
   * ```ts
   * CodePipelineSource.connection('owner/repo', 'main', {
   *   connectionArn: 'arn:aws:codestar-connections:us-east-1:222222222222:connection/7d2469ff-514a-4e4f-9003-5ca4a43cdc41', // Created using the AWS console
   * });
   * ```
   *
   * @param repoString A string that encodes owner and repository separated by a slash (e.g. 'owner/repo').
   * @param branch The branch to use.
   * @param props The source properties, including the connection ARN.
   *
   * @see https://docs.aws.amazon.com/dtconsole/latest/userguide/welcome-connections.html
   */
  public static connection(repoString: string, branch: string, props: ConnectionSourceOptions): CodePipelineSource {
    return new CodeStarConnectionSource(repoString, branch, props);
  }

  /**
   * Returns a CodeCommit source.
   *
   * @param repository The CodeCommit repository.
   * @param branch The branch to use.
   * @param props The source properties.
   *
   * Example:
   *
   * ```ts
   * const repository: IRepository = ...
   * CodePipelineSource.codeCommit(repository, 'main');
   * ```
   */
  public static codeCommit(repository: codecommit.IRepository, branch: string, props: CodeCommitSourceOptions = {}): CodePipelineSource {
    return new CodeCommitSource(repository, branch, props);
  }

  // tells `PipelineGraph` to hoist a "Source" step
  public readonly isSource = true;

  public produceAction(stage: cp.IStage, options: ProduceActionOptions): CodePipelineActionFactoryResult {
    const output = options.artifacts.toCodePipeline(this.primaryOutput!);
    const action = this.getAction(output, options.actionName, options.runOrder);
    stage.addAction(action);
    return { runOrdersConsumed: 1 };
  }

  protected abstract getAction(output: Artifact, actionName: string, runOrder: number): Action;
}

/**
 * Options for GitHub sources
 */
export interface GitHubSourceOptions {
  /**
   * A GitHub OAuth token to use for authentication.
   *
   * It is recommended to use a Secrets Manager `Secret` to obtain the token:
   *
   * ```ts
   * const oauth = cdk.SecretValue.secretsManager('my-github-token');
   * new GitHubSource(this, 'GitHubSource', { oauthToken: oauth, ... });
   * ```
   *
   * The GitHub Personal Access Token should have these scopes:
   *
   * * **repo** - to read the repository
   * * **admin:repo_hook** - if you plan to use webhooks (true by default)
   *
   * @see https://docs.aws.amazon.com/codepipeline/latest/userguide/GitHub-create-personal-token-CLI.html
   *
   * @default - SecretValue.secretsManager('github-token')
   */
  readonly authentication?: SecretValue;

  /**
   * How AWS CodePipeline should be triggered
   *
   * With the default value "WEBHOOK", a webhook is created in GitHub that triggers the action.
   * With "POLL", CodePipeline periodically checks the source for changes.
   * With "None", the action is not triggered through changes in the source.
   *
   * To use `WEBHOOK`, your GitHub Personal Access Token should have
   * **admin:repo_hook** scope (in addition to the regular **repo** scope).
   *
   * @default GitHubTrigger.WEBHOOK
   */
  readonly trigger?: GitHubTrigger;

}

/**
 * Extend CodePipelineSource so we can type-test in the CodePipelineEngine.
 */
class GitHubSource extends CodePipelineSource {
  private readonly owner: string;
  private readonly repo: string;
  private readonly authentication: SecretValue;

  constructor(repoString: string, readonly branch: string, readonly props: GitHubSourceOptions) {
    super(repoString);

    const parts = repoString.split('/');
    if (parts.length !== 2) {
      throw new Error(`GitHub repository name should look like '<owner>/<repo>', got '${repoString}'`);
    }
    this.owner = parts[0];
    this.repo = parts[1];
    this.authentication = props.authentication ?? SecretValue.secretsManager('github-token');
    this.configurePrimaryOutput(new FileSet('Source', this));
  }

  protected getAction(output: Artifact, actionName: string, runOrder: number) {
    return new cp_actions.GitHubSourceAction({
      output,
      actionName,
      runOrder,
      oauthToken: this.authentication,
      owner: this.owner,
      repo: this.repo,
      branch: this.branch,
      trigger: this.props.trigger,
    });
  }
}

/**
 * Options for S3 sources
 */
export interface S3SourceOptions {
  /**
   * How should CodePipeline detect source changes for this Action.
   * Note that if this is S3Trigger.EVENTS, you need to make sure to include the source Bucket in a CloudTrail Trail,
   * as otherwise the CloudWatch Events will not be emitted.
   *
   * @default S3Trigger.POLL
   * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/log-s3-data-events.html
   */
  readonly trigger?: S3Trigger;
}

class S3Source extends CodePipelineSource {
  constructor(readonly bucket: IBucket, private readonly objectKey: string, readonly props: S3SourceOptions) {
    super(bucket.bucketName);

    this.configurePrimaryOutput(new FileSet('Source', this));
  }

  protected getAction(output: Artifact, actionName: string, runOrder: number) {
    return new cp_actions.S3SourceAction({
      output,
      actionName,
      runOrder,
      bucketKey: this.objectKey,
      trigger: this.props.trigger,
      bucket: this.bucket,
    });
  }
}

/**
 * Configuration options for CodeStar source
 */
export interface ConnectionSourceOptions {
  /**
   * The ARN of the CodeStar Connection created in the AWS console
   * that has permissions to access this GitHub or BitBucket repository.
   *
   * @example 'arn:aws:codestar-connections:us-east-1:123456789012:connection/12345678-abcd-12ab-34cdef5678gh'
   * @see https://docs.aws.amazon.com/codepipeline/latest/userguide/connections-create.html
   */
  readonly connectionArn: string;


  // long URL in @see
  /**
   * Whether the output should be the contents of the repository
   * (which is the default),
   * or a link that allows CodeBuild to clone the repository before building.
   *
   * **Note**: if this option is true,
   * then only CodeBuild actions can use the resulting {@link output}.
   *
   * @default false
   * @see https://docs.aws.amazon.com/codepipeline/latest/userguide/action-reference-CodestarConnectionSource.html#action-reference-CodestarConnectionSource-config
   */
  readonly codeBuildCloneOutput?: boolean;

  /**
   * Controls automatically starting your pipeline when a new commit
   * is made on the configured repository and branch. If unspecified,
   * the default value is true, and the field does not display by default.
   *
   * @default true
   * @see https://docs.aws.amazon.com/codepipeline/latest/userguide/action-reference-CodestarConnectionSource.html
   */
  readonly triggerOnPush?: boolean;
}

class CodeStarConnectionSource extends CodePipelineSource {
  private readonly owner: string;
  private readonly repo: string;

  constructor(repoString: string, readonly branch: string, readonly props: ConnectionSourceOptions) {
    super(repoString);

    const parts = repoString.split('/');
    if (parts.length !== 2) {
      throw new Error(`CodeStar repository name should look like '<owner>/<repo>', got '${repoString}'`);
    }
    this.owner = parts[0];
    this.repo = parts[1];
    this.configurePrimaryOutput(new FileSet('Source', this));
  }

  protected getAction(output: Artifact, actionName: string, runOrder: number) {
    return new cp_actions.CodeStarConnectionsSourceAction({
      output,
      actionName,
      runOrder,
      connectionArn: this.props.connectionArn,
      owner: this.owner,
      repo: this.repo,
      branch: this.branch,
      codeBuildCloneOutput: this.props.codeBuildCloneOutput,
      triggerOnPush: this.props.triggerOnPush,
    });
  }
}

/**
 * Configuration options for a CodeCommit source
 */
export interface CodeCommitSourceOptions {
  /**
   * How should CodePipeline detect source changes for this Action.
   *
   * @default CodeCommitTrigger.EVENTS
   */
  readonly trigger?: CodeCommitTrigger;

  /**
   * Role to be used by on commit event rule.
   * Used only when trigger value is CodeCommitTrigger.EVENTS.
   *
   * @default a new role will be created.
   */
  readonly eventRole?: iam.IRole;

  /**
   * Whether the output should be the contents of the repository
   * (which is the default),
   * or a link that allows CodeBuild to clone the repository before building.
   *
   * **Note**: if this option is true,
   * then only CodeBuild actions can use the resulting {@link output}.
   *
   * @default false
   * @see https://docs.aws.amazon.com/codepipeline/latest/userguide/action-reference-CodeCommit.html
   */
  readonly codeBuildCloneOutput?: boolean;
}

class CodeCommitSource extends CodePipelineSource {
  constructor(readonly repository: codecommit.IRepository, readonly branch: string, readonly props: CodeCommitSourceOptions) {
    super(repository.repositoryName);

    this.configurePrimaryOutput(new FileSet('Source', this));
  }

  protected getAction(output: Artifact, actionName: string, runOrder: number) {
    return new cp_actions.CodeCommitSourceAction({
      output,
      actionName,
      runOrder,
      branch: this.branch,
      trigger: this.props.trigger,
      repository: this.repository,
      eventRole: this.props.eventRole,
      codeBuildCloneOutput: this.props.codeBuildCloneOutput,
    });
  }
}