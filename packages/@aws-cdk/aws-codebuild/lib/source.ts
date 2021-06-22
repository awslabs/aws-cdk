import * as codecommit from '@aws-cdk/aws-codecommit';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import { CfnProject } from './codebuild.generated';
import { IProject } from './project';
import {
  BITBUCKET_SOURCE_TYPE,
  CODECOMMIT_SOURCE_TYPE,
  GITHUB_ENTERPRISE_SOURCE_TYPE,
  GITHUB_SOURCE_TYPE,
  S3_SOURCE_TYPE,
} from './source-types';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';

/**
 * The type returned from {@link ISource#bind}.
 */
export interface SourceConfig {
  readonly sourceProperty: CfnProject.SourceProperty;

  readonly buildTriggers?: CfnProject.ProjectTriggersProperty;

  /**
   * `AWS::CodeBuild::Project.SourceVersion`
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-codebuild-project.html#cfn-codebuild-project-sourceversion
   * @default the latest version
   */
  readonly sourceVersion?: string;
}

/**
 * The abstract interface of a CodeBuild source.
 * Implemented by {@link Source}.
 */
export interface ISource {
  readonly identifier?: string;

  readonly type: string;

  readonly badgeSupported: boolean;

  bind(scope: CoreConstruct, project: IProject): SourceConfig;
}

/**
 * Properties common to all Source classes.
 */
export interface SourceProps {
  /**
   * The source identifier.
   * This property is required on secondary sources.
   */
  readonly identifier?: string;
}

/**
 * Source provider definition for a CodeBuild Project.
 */
export abstract class Source implements ISource {
  public static s3(props: S3SourceProps): ISource {
    return new S3Source(props);
  }

  public static codeCommit(props: CodeCommitSourceProps): ISource {
    return new CodeCommitSource(props);
  }

  public static gitHub(props: GitHubSourceProps): ISource {
    return new GitHubSource(props);
  }

  public static gitHubEnterprise(props: GitHubEnterpriseSourceProps): ISource {
    return new GitHubEnterpriseSource(props);
  }

  public static bitBucket(props: BitBucketSourceProps): ISource {
    return new BitBucketSource(props);
  }

  public readonly identifier?: string;
  public abstract readonly type: string;
  public readonly badgeSupported: boolean = false;

  protected constructor(props: SourceProps) {
    this.identifier = props.identifier;
  }

  /**
   * Called by the project when the source is added so that the source can perform
   * binding operations on the source. For example, it can grant permissions to the
   * code build project to read from the S3 bucket.
   */
  public bind(_scope: CoreConstruct, _project: IProject): SourceConfig {
    return {
      sourceProperty: {
        sourceIdentifier: this.identifier,
        type: this.type,
      },
    };
  }
}

/**
 * The construction properties common to all build sources that are backed by Git.
 */
interface GitSourceProps extends SourceProps {
  /**
   * The depth of history to download. Minimum value is 0.
   * If this value is 0, greater than 25, or not provided,
   * then the full history is downloaded with each build of the project.
   */
  readonly cloneDepth?: number;

  /**
   * The commit ID, pull request ID, branch name, or tag name that corresponds to
   * the version of the source code you want to build
   *
   * @example 'mybranch'
   * @default the default branch's HEAD commit ID is used
   */
  readonly branchOrRef?: string;

  /**
   * Whether to fetch submodules while cloning git repo.
   *
   * @default false
   */
  readonly fetchSubmodules?: boolean;
}

/**
 * A common superclass of all build sources that are backed by Git.
 */
abstract class GitSource extends Source {
  private readonly cloneDepth?: number;
  private readonly branchOrRef?: string;
  private readonly fetchSubmodules?: boolean;

  protected constructor(props: GitSourceProps) {
    super(props);

    this.cloneDepth = props.cloneDepth;
    this.branchOrRef = props.branchOrRef;
    this.fetchSubmodules = props.fetchSubmodules;
  }

  public bind(_scope: CoreConstruct, _project: IProject): SourceConfig {
    const superConfig = super.bind(_scope, _project);
    return {
      sourceVersion: this.branchOrRef,
      sourceProperty: {
        ...superConfig.sourceProperty,
        gitCloneDepth: this.cloneDepth,
        gitSubmodulesConfig: this.fetchSubmodules ? {
          fetchSubmodules: this.fetchSubmodules,
        } : undefined,
      },
    };
  }
}

/**
 * The types of webhook event actions.
 */
export enum EventAction {
  /**
   * A push (of a branch, or a tag) to the repository.
   */
  PUSH = 'PUSH',

  /**
   * Creating a Pull Request.
   */
  PULL_REQUEST_CREATED = 'PULL_REQUEST_CREATED',

  /**
   * Updating a Pull Request.
   */
  PULL_REQUEST_UPDATED = 'PULL_REQUEST_UPDATED',

  /**
   * Merging a Pull Request.
   */
  PULL_REQUEST_MERGED = 'PULL_REQUEST_MERGED',

  /**
   * Re-opening a previously closed Pull Request.
   * Note that this event is only supported for GitHub and GitHubEnterprise sources.
   */
  PULL_REQUEST_REOPENED = 'PULL_REQUEST_REOPENED',
}

enum WebhookFilterTypes {
  FILE_PATH = 'FILE_PATH',
  COMMIT_MESSAGE = 'COMMIT_MESSAGE',
  HEAD_REF = 'HEAD_REF',
  ACTOR_ACCOUNT_ID = 'ACTOR_ACCOUNT_ID',
  BASE_REF = 'BASE_REF',
}

/**
 * An object that represents a group of filter conditions for a webhook.
 * Every condition in a given FilterGroup must be true in order for the whole group to be true.
 * You construct instances of it by calling the {@link #inEventOf} static factory method,
 * and then calling various `andXyz` instance methods to create modified instances of it
 * (this class is immutable).
 *
 * You pass instances of this class to the `webhookFilters` property when constructing a source.
 */
export class FilterGroup {
  /**
   * Creates a new event FilterGroup that triggers on any of the provided actions.
   *
   * @param actions the actions to trigger the webhook on
   */
  public static inEventOf(...actions: EventAction[]): FilterGroup {
    return new FilterGroup(new Set(actions), []);
  }

  private readonly actions: Set<EventAction>;
  private readonly filters: CfnProject.WebhookFilterProperty[];

  private constructor(actions: Set<EventAction>, filters: CfnProject.WebhookFilterProperty[]) {
    if (actions.size === 0) {
      throw new Error('A filter group must contain at least one event action');
    }
    this.actions = actions;
    this.filters = filters;
  }

  /**
   * Create a new FilterGroup with an added condition:
   * the event must affect the given branch.
   *
   * @param branchName the name of the branch (can be a regular expression)
   */
  public andBranchIs(branchName: string): FilterGroup {
    return this.addHeadBranchFilter(branchName, true);
  }

  /**
   * Create a new FilterGroup with an added condition:
   * the event must not affect the given branch.
   *
   * @param branchName the name of the branch (can be a regular expression)
   */
  public andBranchIsNot(branchName: string): FilterGroup {
    return this.addHeadBranchFilter(branchName, false);
  }

  /**
   * Create a new FilterGroup with an added condition:
   * the event must affect a head commit with the given message.
   *
   * @param commitMessage the commit message (can be a regular expression)
   */
  public andCommitMessageIs(commitMessage: string): FilterGroup {
    return this.addCommitMessageFilter(commitMessage, true);
  }

  /**
   * Create a new FilterGroup with an added condition:
   * the event must not affect a head commit with the given message.
   *
   * @param commitMessage the commit message (can be a regular expression)
   */
  public andCommitMessageIsNot(commitMessage: string): FilterGroup {
    return this.addCommitMessageFilter(commitMessage, false);
  }

  /**
   * Create a new FilterGroup with an added condition:
   * the event must affect the given tag.
   *
   * @param tagName the name of the tag (can be a regular expression)
   */
  public andTagIs(tagName: string): FilterGroup {
    return this.addHeadTagFilter(tagName, true);
  }

  /**
   * Create a new FilterGroup with an added condition:
   * the event must not affect the given tag.
   *
   * @param tagName the name of the tag (can be a regular expression)
   */
  public andTagIsNot(tagName: string): FilterGroup {
    return this.addHeadTagFilter(tagName, false);
  }

  /**
   * Create a new FilterGroup with an added condition:
   * the event must affect a Git reference (ie., a branch or a tag)
   * that matches the given pattern.
   *
   * @param pattern a regular expression
   */
  public andHeadRefIs(pattern: string) {
    return this.addHeadRefFilter(pattern, true);
  }

  /**
   * Create a new FilterGroup with an added condition:
   * the event must not affect a Git reference (ie., a branch or a tag)
   * that matches the given pattern.
   *
   * @param pattern a regular expression
   */
  public andHeadRefIsNot(pattern: string) {
    return this.addHeadRefFilter(pattern, false);
  }

  /**
   * Create a new FilterGroup with an added condition:
   * the account ID of the actor initiating the event must match the given pattern.
   *
   * @param pattern a regular expression
   */
  public andActorAccountIs(pattern: string): FilterGroup {
    return this.addActorAccountId(pattern, true);
  }

  /**
   * Create a new FilterGroup with an added condition:
   * the account ID of the actor initiating the event must not match the given pattern.
   *
   * @param pattern a regular expression
   */
  public andActorAccountIsNot(pattern: string): FilterGroup {
    return this.addActorAccountId(pattern, false);
  }

  /**
   * Create a new FilterGroup with an added condition:
   * the Pull Request that is the source of the event must target the given base branch.
   * Note that you cannot use this method if this Group contains the `PUSH` event action.
   *
   * @param branchName the name of the branch (can be a regular expression)
   */
  public andBaseBranchIs(branchName: string): FilterGroup {
    return this.addBaseBranchFilter(branchName, true);
  }

  /**
   * Create a new FilterGroup with an added condition:
   * the Pull Request that is the source of the event must not target the given base branch.
   * Note that you cannot use this method if this Group contains the `PUSH` event action.
   *
   * @param branchName the name of the branch (can be a regular expression)
   */
  public andBaseBranchIsNot(branchName: string): FilterGroup {
    return this.addBaseBranchFilter(branchName, false);
  }

  /**
   * Create a new FilterGroup with an added condition:
   * the Pull Request that is the source of the event must target the given Git reference.
   * Note that you cannot use this method if this Group contains the `PUSH` event action.
   *
   * @param pattern a regular expression
   */
  public andBaseRefIs(pattern: string): FilterGroup {
    return this.addBaseRefFilter(pattern, true);
  }

  /**
   * Create a new FilterGroup with an added condition:
   * the Pull Request that is the source of the event must not target the given Git reference.
   * Note that you cannot use this method if this Group contains the `PUSH` event action.
   *
   * @param pattern a regular expression
   */
  public andBaseRefIsNot(pattern: string): FilterGroup {
    return this.addBaseRefFilter(pattern, false);
  }

  /**
   * Create a new FilterGroup with an added condition:
   * the push that is the source of the event must affect a file that matches the given pattern.
   * Note that you can only use this method if this Group contains only the `PUSH` event action,
   * and only for GitHub, Bitbucket and GitHubEnterprise sources.
   *
   * @param pattern a regular expression
   */
  public andFilePathIs(pattern: string): FilterGroup {
    return this.addFilePathFilter(pattern, true);
  }

  /**
   * Create a new FilterGroup with an added condition:
   * the push that is the source of the event must not affect a file that matches the given pattern.
   * Note that you can only use this method if this Group contains only the `PUSH` event action,
   * and only for GitHub, Bitbucket and GitHubEnterprise sources.
   *
   * @param pattern a regular expression
   */
  public andFilePathIsNot(pattern: string): FilterGroup {
    return this.addFilePathFilter(pattern, false);
  }

  /** @internal */
  public get _actions(): EventAction[] {
    return set2Array(this.actions);
  }

  /** @internal */
  public get _filters(): CfnProject.WebhookFilterProperty[] {
    return this.filters.slice();
  }

  /** @internal */
  public _toJson(): CfnProject.WebhookFilterProperty[] {
    const eventFilter: CfnProject.WebhookFilterProperty = {
      type: 'EVENT',
      pattern: set2Array(this.actions).join(', '),
    };
    return [eventFilter].concat(this.filters);
  }

  private addCommitMessageFilter(commitMessage: string, include: boolean): FilterGroup {
    return this.addFilter(WebhookFilterTypes.COMMIT_MESSAGE, commitMessage, include);
  }

  private addHeadBranchFilter(branchName: string, include: boolean): FilterGroup {
    return this.addHeadRefFilter(`refs/heads/${branchName}`, include);
  }

  private addHeadTagFilter(tagName: string, include: boolean): FilterGroup {
    return this.addHeadRefFilter(`refs/tags/${tagName}`, include);
  }

  private addHeadRefFilter(refName: string, include: boolean) {
    return this.addFilter(WebhookFilterTypes.HEAD_REF, refName, include);
  }

  private addActorAccountId(accountId: string, include: boolean) {
    return this.addFilter(WebhookFilterTypes.ACTOR_ACCOUNT_ID, accountId, include);
  }

  private addBaseBranchFilter(branchName: string, include: boolean): FilterGroup {
    return this.addBaseRefFilter(`refs/heads/${branchName}`, include);
  }

  private addBaseRefFilter(refName: string, include: boolean) {
    if (this.actions.has(EventAction.PUSH)) {
      throw new Error('A base reference condition cannot be added if a Group contains a PUSH event action');
    }
    return this.addFilter(WebhookFilterTypes.BASE_REF, refName, include);
  }

  private addFilePathFilter(pattern: string, include: boolean): FilterGroup {
    return this.addFilter(WebhookFilterTypes.FILE_PATH, pattern, include);
  }

  private addFilter(type: WebhookFilterTypes, pattern: string, include: boolean) {
    return new FilterGroup(this.actions, this.filters.concat([{
      type,
      pattern,
      excludeMatchedPattern: include ? undefined : true,
    }]));
  }
}

/**
 * The construction properties common to all third-party build sources that are backed by Git.
 */
interface ThirdPartyGitSourceProps extends GitSourceProps {
  /**
   * Whether to send notifications on your build's start and end.
   *
   * @default true
   */
  readonly reportBuildStatus?: boolean;

  /**
   * Whether to create a webhook that will trigger a build every time an event happens in the repository.
   *
   * @default true if any `webhookFilters` were provided, false otherwise
   */
  readonly webhook?: boolean;

  /**
   * Trigger a batch build from a webhook instead of a standard one.
   *
   * Enabling this will enable batch builds on the CodeBuild project.
   *
   * @default false
   */
  readonly webhookTriggersBatchBuild?: boolean;

  /**
   * A list of webhook filters that can constraint what events in the repository will trigger a build.
   * A build is triggered if any of the provided filter groups match.
   * Only valid if `webhook` was not provided as false.
   *
   * @default every push and every Pull Request (create or update) triggers a build
   */
  readonly webhookFilters?: FilterGroup[];
}

/**
 * A common superclass of all third-party build sources that are backed by Git.
 */
abstract class ThirdPartyGitSource extends GitSource {
  public readonly badgeSupported: boolean = true;
  protected readonly webhookFilters: FilterGroup[];
  private readonly reportBuildStatus: boolean;
  private readonly webhook?: boolean;
  private readonly webhookTriggersBatchBuild?: boolean;

  protected constructor(props: ThirdPartyGitSourceProps) {
    super(props);

    this.webhook = props.webhook;
    this.reportBuildStatus = props.reportBuildStatus ?? true;
    this.webhookFilters = props.webhookFilters || [];
    this.webhookTriggersBatchBuild = props.webhookTriggersBatchBuild;
  }

  public bind(_scope: CoreConstruct, project: IProject): SourceConfig {
    const anyFilterGroupsProvided = this.webhookFilters.length > 0;
    const webhook = this.webhook ?? (anyFilterGroupsProvided ? true : undefined);

    if (!webhook && anyFilterGroupsProvided) {
      throw new Error('`webhookFilters` cannot be used when `webhook` is `false`');
    }

    if (!webhook && this.webhookTriggersBatchBuild) {
      throw new Error('`webhookTriggersBatchBuild` cannot be used when `webhook` is `false`');
    }

    const superConfig = super.bind(_scope, project);

    if (this.webhookTriggersBatchBuild) {
      project.enableBatchBuilds();
    }

    return {
      sourceProperty: {
        ...superConfig.sourceProperty,
        reportBuildStatus: this.reportBuildStatus,
      },
      sourceVersion: superConfig.sourceVersion,
      buildTriggers: webhook === undefined ? undefined : {
        webhook,
        buildType: this.webhookTriggersBatchBuild ? 'BUILD_BATCH' : undefined,
        filterGroups: anyFilterGroupsProvided ? this.webhookFilters.map(fg => fg._toJson()) : undefined,
      },
    };
  }
}

/**
 * Construction properties for {@link CodeCommitSource}.
 */
export interface CodeCommitSourceProps extends GitSourceProps {
  readonly repository: codecommit.IRepository;
}

/**
 * CodeCommit Source definition for a CodeBuild project.
 */
class CodeCommitSource extends GitSource {
  public readonly badgeSupported = true;
  public readonly type = CODECOMMIT_SOURCE_TYPE;
  private readonly repo: codecommit.IRepository;

  constructor(props: CodeCommitSourceProps) {
    super(props);
    this.repo = props.repository;
  }

  public bind(_scope: CoreConstruct, project: IProject): SourceConfig {
    // https://docs.aws.amazon.com/codebuild/latest/userguide/setting-up.html
    project.addToRolePolicy(new iam.PolicyStatement({
      actions: ['codecommit:GitPull'],
      resources: [this.repo.repositoryArn],
    }));

    const superConfig = super.bind(_scope, project);
    return {
      sourceProperty: {
        ...superConfig.sourceProperty,
        location: this.repo.repositoryCloneUrlHttp,
      },
      sourceVersion: superConfig.sourceVersion,
    };
  }
}

/**
 * Construction properties for {@link S3Source}.
 */
export interface S3SourceProps extends SourceProps {
  readonly bucket: s3.IBucket;
  readonly path: string;

  /**
   *  The version ID of the object that represents the build input ZIP file to use.
   *
   * @default latest
   */
  readonly version?: string;
}

/**
 * S3 bucket definition for a CodeBuild project.
 */
class S3Source extends Source {
  public readonly type = S3_SOURCE_TYPE;
  private readonly bucket: s3.IBucket;
  private readonly path: string;
  private readonly version?: string;

  constructor(props: S3SourceProps) {
    super(props);
    this.bucket = props.bucket;
    this.path = props.path;
    this.version = props.version;
  }

  public bind(_scope: CoreConstruct, project: IProject): SourceConfig {
    this.bucket.grantRead(project, this.path);

    const superConfig = super.bind(_scope, project);
    return {
      sourceProperty: {
        ...superConfig.sourceProperty,
        location: `${this.bucket.bucketName}/${this.path}`,
      },
      sourceVersion: this.version,
    };
  }
}

/**
 * Construction properties for {@link GitHubSource} and {@link GitHubEnterpriseSource}.
 */
export interface GitHubSourceProps extends ThirdPartyGitSourceProps {
  /**
   * The GitHub account/user that owns the repo.
   *
   * @example 'awslabs'
   */
  readonly owner: string;

  /**
   * The name of the repo (without the username).
   *
   * @example 'aws-cdk'
   */
  readonly repo: string;
}

/**
 * GitHub Source definition for a CodeBuild project.
 */
class GitHubSource extends ThirdPartyGitSource {
  public readonly type = GITHUB_SOURCE_TYPE;
  private readonly httpsCloneUrl: string;

  constructor(props: GitHubSourceProps) {
    super(props);
    this.httpsCloneUrl = `https://github.com/${props.owner}/${props.repo}.git`;
  }

  public bind(_scope: CoreConstruct, project: IProject): SourceConfig {
    const superConfig = super.bind(_scope, project);
    return {
      sourceProperty: {
        ...superConfig.sourceProperty,
        location: this.httpsCloneUrl,
      },
      sourceVersion: superConfig.sourceVersion,
      buildTriggers: superConfig.buildTriggers,
    };
  }
}

/**
 * Construction properties for {@link GitHubEnterpriseSource}.
 */
export interface GitHubEnterpriseSourceProps extends ThirdPartyGitSourceProps {
  /**
   * The HTTPS URL of the repository in your GitHub Enterprise installation.
   */
  readonly httpsCloneUrl: string;

  /**
   * Whether to ignore SSL errors when connecting to the repository.
   *
   * @default false
   */
  readonly ignoreSslErrors?: boolean;
}

/**
 * GitHub Enterprise Source definition for a CodeBuild project.
 */
class GitHubEnterpriseSource extends ThirdPartyGitSource {
  public readonly type = GITHUB_ENTERPRISE_SOURCE_TYPE;
  private readonly httpsCloneUrl: string;
  private readonly ignoreSslErrors?: boolean;

  constructor(props: GitHubEnterpriseSourceProps) {
    super(props);
    this.httpsCloneUrl = props.httpsCloneUrl;
    this.ignoreSslErrors = props.ignoreSslErrors;
  }

  public bind(_scope: CoreConstruct, _project: IProject): SourceConfig {
    if (this.hasCommitMessageFilterAndPrEvent()) {
      throw new Error('COMMIT_MESSAGE filters cannot be used with GitHub Enterprise Server pull request events');
    }

    if (this.hasFilePathFilterAndPrEvent()) {
      throw new Error('FILE_PATH filters cannot be used with GitHub Enterprise Server pull request events');
    }

    const superConfig = super.bind(_scope, _project);
    return {
      sourceProperty: {
        ...superConfig.sourceProperty,
        location: this.httpsCloneUrl,
        insecureSsl: this.ignoreSslErrors,
      },
      sourceVersion: superConfig.sourceVersion,
      buildTriggers: superConfig.buildTriggers,
    };
  }

  private hasCommitMessageFilterAndPrEvent() {
    return this.webhookFilters.some(fg => (
      fg._filters.some(fp => fp.type === WebhookFilterTypes.COMMIT_MESSAGE) &&
      this.hasPrEvent(fg._actions)));
  }
  private hasFilePathFilterAndPrEvent() {
    return this.webhookFilters.some(fg => (
      fg._filters.some(fp => fp.type === WebhookFilterTypes.FILE_PATH) &&
      this.hasPrEvent(fg._actions)));
  }
  private hasPrEvent(actions: EventAction[]) {
    return actions.includes(
      EventAction.PULL_REQUEST_CREATED ||
      EventAction.PULL_REQUEST_MERGED ||
      EventAction.PULL_REQUEST_REOPENED ||
      EventAction.PULL_REQUEST_UPDATED);
  }
}

/**
 * Construction properties for {@link BitBucketSource}.
 */
export interface BitBucketSourceProps extends ThirdPartyGitSourceProps {
  /**
   * The BitBucket account/user that owns the repo.
   *
   * @example 'awslabs'
   */
  readonly owner: string;

  /**
   * The name of the repo (without the username).
   *
   * @example 'aws-cdk'
   */
  readonly repo: string;
}

/**
 * BitBucket Source definition for a CodeBuild project.
 */
class BitBucketSource extends ThirdPartyGitSource {
  public readonly type = BITBUCKET_SOURCE_TYPE;
  private readonly httpsCloneUrl: any;

  constructor(props: BitBucketSourceProps) {
    super(props);
    this.httpsCloneUrl = `https://bitbucket.org/${props.owner}/${props.repo}.git`;
  }

  public bind(_scope: CoreConstruct, _project: IProject): SourceConfig {
    // BitBucket sources don't support the PULL_REQUEST_REOPENED event action
    if (this.anyWebhookFilterContainsPrReopenedEventAction()) {
      throw new Error('BitBucket sources do not support the PULL_REQUEST_REOPENED webhook event action');
    }

    const superConfig = super.bind(_scope, _project);
    return {
      sourceProperty: {
        ...superConfig.sourceProperty,
        location: this.httpsCloneUrl,
      },
      sourceVersion: superConfig.sourceVersion,
      buildTriggers: superConfig.buildTriggers,
    };
  }

  private anyWebhookFilterContainsPrReopenedEventAction() {
    return this.webhookFilters.findIndex(fg => {
      return fg._actions.findIndex(a => a === EventAction.PULL_REQUEST_REOPENED) !== -1;
    }) !== -1;
  }
}

function set2Array<T>(set: Set<T>): T[] {
  const ret: T[] = [];
  set.forEach(el => ret.push(el));
  return ret;
}
