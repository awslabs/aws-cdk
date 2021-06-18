import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as iam from '@aws-cdk/aws-iam';
import * as sns from '@aws-cdk/aws-sns';
import * as subs from '@aws-cdk/aws-sns-subscriptions';
import { Action } from './action';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/**
 * Construction properties of the {@link ManualApprovalAction}.
 */
export interface ManualApprovalActionProps extends codepipeline.CommonAwsActionProps {
  /**
   * Optional SNS topic to send notifications to when an approval is pending.
   */
  readonly notificationTopic?: sns.ITopic;

  /**
   * A list of email addresses to subscribe to notifications when this Action is pending approval.
   * If this has been provided, but not `notificationTopic`,
   * a new Topic will be created.
   */
  readonly notifyEmails?: string[];

  /**
   * Any additional information that you want to include in the notification email message.
   */
  readonly additionalInformation?: string;

  /**
   * URL you want to provide to the reviewer as part of the approval request.
   *
   * @default - the approval request will not have an external link
   */
  readonly externalEntityLink?: string;
}

/**
 * Manual approval action.
 */
export class ManualApprovalAction extends Action {
  /**
   * The SNS Topic passed when constructing the Action.
   * If no Topic was passed, but `notifyEmails` were provided,
   * a new Topic will be created.
   */
  private _notificationTopic?: sns.ITopic;
  private readonly props: ManualApprovalActionProps;
  private stage?: codepipeline.IStage;

  constructor(props: ManualApprovalActionProps) {
    super({
      ...props,
      category: codepipeline.ActionCategory.APPROVAL,
      provider: 'Manual',
      artifactBounds: { minInputs: 0, maxInputs: 0, minOutputs: 0, maxOutputs: 0 },
    });

    this.props = props;
  }

  public get notificationTopic(): sns.ITopic | undefined {
    return this._notificationTopic;
  }

  /**
   * grant the provided principal the permissions to approve or reject this manual approval action
   *
   * For more info see:
   * https://docs.aws.amazon.com/codepipeline/latest/userguide/approvals-iam-permissions.html
   *
   * @param grantable the grantable to attach the permissions to
   */
  public grantManualApproval(grantable: iam.IGrantable): void {
    if (!this.stage) {
      throw new Error('Cannot grant permissions before binding action to a stage');
    }
    grantable.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['codepipeline:ListPipelines'],
      resources: ['*'],
    }));
    grantable.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['codepipeline:GetPipeline', 'codepipeline:GetPipelineState', 'codepipeline:GetPipelineExecution'],
      resources: [this.stage.pipeline.pipelineArn],
    }));
    grantable.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['codepipeline:PutApprovalResult'],
      resources: [`${this.stage.pipeline.pipelineArn}/${this.stage.stageName}/${this.props.actionName}`],
    }));
  }

  protected bound(scope: Construct, stage: codepipeline.IStage, options: codepipeline.ActionBindOptions): codepipeline.ActionConfig {
    if (this.props.notificationTopic) {
      this._notificationTopic = this.props.notificationTopic;
    } else if ((this.props.notifyEmails || []).length > 0) {
      this._notificationTopic = new sns.Topic(scope, 'TopicResource');
    }

    if (this._notificationTopic) {
      this._notificationTopic.grantPublish(options.role);
      for (const notifyEmail of this.props.notifyEmails || []) {
        this._notificationTopic.addSubscription(new subs.EmailSubscription(notifyEmail));
      }
    }

    this.stage = stage;

    return {
      configuration: undefinedIfAllValuesAreEmpty({
        NotificationArn: this._notificationTopic?.topicArn,
        CustomData: this.props.additionalInformation,
        ExternalEntityLink: this.props.externalEntityLink,
      }),
    };
  }
}

function undefinedIfAllValuesAreEmpty(object: object): object | undefined {
  return Object.values(object).some(v => v !== undefined) ? object : undefined;
}
