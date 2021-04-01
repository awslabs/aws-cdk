import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as iam from '@aws-cdk/aws-iam';

import { Action } from '../action';
import { sourceArtifactBounds } from '../common';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/**
 * Construction properties for {@link BitBucketSourceAction}.
 *
 * @experimental
 */
export interface BitBucketSourceActionProps extends codepipeline.CommonAwsActionProps {
  /**
   * The output artifact that this action produces.
   * Can be used as input for further pipeline actions.
   */
  readonly output: codepipeline.Artifact;

  /**
   * The ARN of the CodeStar Connection created in the AWS console
   * that has permissions to access this BitBucket repository.
   *
   * @example 'arn:aws:codestar-connections:us-east-1:123456789012:connection/12345678-abcd-12ab-34cdef5678gh'
   * @see https://docs.aws.amazon.com/codepipeline/latest/userguide/connections-create.html
   */
  readonly connectionArn: string;

  /**
   * The owning user or organization of the repository.
   *
   * @example 'aws'
   */
  readonly owner: string;

  /**
   * The name of the repository.
   *
   * @example 'aws-cdk'
   */
  readonly repo: string;

  /**
   * The branch to build.
   *
   * @default 'master'
   */
  readonly branch?: string;

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

/**
 * A CodePipeline source action for BitBucket.
 *
 * @experimental
 */
export class BitBucketSourceAction extends Action {
  /**
   * The name of the property that holds the ARN of the CodeStar Connection
   * inside of the CodePipeline Artifact's metadata.
   *
   * @internal
   */
  public static readonly _CONNECTION_ARN_PROPERTY = 'CodeStarConnectionArnProperty';

  private readonly props: BitBucketSourceActionProps;

  constructor(props: BitBucketSourceActionProps) {
    super({
      ...props,
      category: codepipeline.ActionCategory.SOURCE,
      owner: 'AWS', // because props also has a (different!) owner property!
      provider: 'CodeStarSourceConnection',
      artifactBounds: sourceArtifactBounds(),
      outputs: [props.output],
    });

    this.props = props;
  }

  protected bound(_scope: Construct, _stage: codepipeline.IStage, options: codepipeline.ActionBindOptions): codepipeline.ActionConfig {
    // https://docs.aws.amazon.com/codepipeline/latest/userguide/security-iam.html#how-to-update-role-new-services
    options.role.addToPolicy(new iam.PolicyStatement({
      actions: [
        'codestar-connections:UseConnection',
      ],
      resources: [
        this.props.connectionArn,
      ],
    }));

    // the action needs to write the output to the pipeline bucket
    options.bucket.grantReadWrite(options.role);
    options.bucket.grantPutAcl(options.role);

    // if codeBuildCloneOutput is true,
    // save the connectionArn in the Artifact instance
    // to be read by the CodeBuildAction later
    if (this.props.codeBuildCloneOutput === true) {
      this.props.output.setMetadata(BitBucketSourceAction._CONNECTION_ARN_PROPERTY,
        this.props.connectionArn);
    }

    return {
      configuration: {
        ConnectionArn: this.props.connectionArn,
        FullRepositoryId: `${this.props.owner}/${this.props.repo}`,
        BranchName: this.props.branch ?? 'master',
        OutputArtifactFormat: this.props.codeBuildCloneOutput === true
          ? 'CODEBUILD_CLONE_REF'
          : undefined,
        DetectChanges: this.props.triggerOnPush,
      },
    };
  }
}
