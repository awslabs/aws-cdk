import * as codebuild from '@aws-cdk/aws-codebuild';
import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import { addToDeadLetterQueueResourcePolicy, bindBaseTargetConfig, singletonEventRole, TargetBaseProps } from './util';

/**
 * Customize the CodeBuild Event Target
 */
export interface CodeBuildProjectProps extends TargetBaseProps {

  /**
   * The role to assume before invoking the target
   * (i.e., the codebuild) when the given rule is triggered.
   *
   * @default - a new role will be created
   */
  readonly eventRole?: iam.IRole;

  /**
   * The event to send to CodeBuild
   *
   * This will be the payload for the StartBuild API.
   *
   * @default - the entire EventBridge event
   */
  readonly event?: events.RuleTargetInput;
}

/**
 * Start a CodeBuild build when an Amazon EventBridge rule is triggered.
 */
export class CodeBuildProject implements events.IRuleTarget {
  constructor(
    private readonly project: codebuild.IProject,
    private readonly props: CodeBuildProjectProps = {},
  ) {}

  /**
   * Allows using build projects as event rule targets.
   */
  public bind(_rule: events.IRule, _id?: string): events.RuleTargetConfig {

    if (this.props.deadLetterQueue) {
      addToDeadLetterQueueResourcePolicy(_rule, this.props.deadLetterQueue);
    }

    return {
      ...bindBaseTargetConfig(this.props),
      arn: this.project.projectArn,
      role: this.props.eventRole || singletonEventRole(this.project, [
        new iam.PolicyStatement({
          actions: ['codebuild:StartBuild'],
          resources: [this.project.projectArn],
        }),
      ]),
      input: this.props.event,
      targetResource: this.project,
    };
  }
}
