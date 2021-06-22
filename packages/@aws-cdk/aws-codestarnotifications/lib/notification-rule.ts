import { IResource, Resource, Names } from '@aws-cdk/core';
import * as constructs from 'constructs';
import { CfnNotificationRule } from './codestarnotifications.generated';
import { INotificationRuleSource } from './notification-rule-source';
import { INotificationRuleTarget, NotificationRuleTargetConfig } from './notification-rule-target';

/**
 * The level of detail to include in the notifications for this resource.
 */
export enum DetailType {
  /**
   * BASIC will include only the contents of the event as it would appear in AWS CloudWatch
   */
  BASIC = 'BASIC',

  /**
   * FULL will include any supplemental information provided by AWS CodeStar Notifications and/or the service for the resource for which the notification is created.
   */
  FULL = 'FULL',
}

/**
 * Standard set of options for `notifyOnXxx` codestar notification handler on construct
 */
export interface NotificationRuleOptions {
  /**
   * The name for the notification rule.
   * Notification rule names must be unique in your AWS account.
   *
   * @default - generated from the `id`
   */
  readonly notificationRuleName?: string;

  /**
   * The status of the notification rule.
   * If the enabled is set to DISABLED, notifications aren't sent for the notification rule.
   *
   * @default true
   */
  readonly enabled?: boolean;

  /**
   * The level of detail to include in the notifications for this resource.
   * BASIC will include only the contents of the event as it would appear in AWS CloudWatch.
   * FULL will include any supplemental information provided by AWS CodeStar Notifications and/or the service for the resource for which the notification is created.
   *
   * @default DetailType.FULL
   */
  readonly detailType?: DetailType;
}

/**
 * Properties for a new notification rule
 */
export interface NotificationRuleProps extends NotificationRuleOptions {
  /**
   * A list of event types associated with this notification rule.
   * For a complete list of event types and IDs, see Notification concepts in the Developer Tools Console User Guide.
   * @see https://docs.aws.amazon.com/dtconsole/latest/userguide/concepts.html#concepts-api
   */
  readonly events: string[];

  /**
   * The Amazon Resource Name (ARN) of the resource to associate with the notification rule.
   * Currently, Supported sources include pipelines in AWS CodePipeline and build projects in AWS CodeBuild in this L2 constructor.
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-codestarnotifications-notificationrule.html#cfn-codestarnotifications-notificationrule-resource
   */
  readonly source: INotificationRuleSource;

  /**
   * The targets to register for the notification destination.
   *
   * @default - No targets are added to the rule. Use `addTarget()` to add a target.
   */
  readonly targets?: INotificationRuleTarget[];
}

/**
 * Represents a notification rule
 */
export interface INotificationRule extends IResource {

  /**
   * The ARN of the notification rule (i.e. arn:aws:codestar-notifications:::notificationrule/01234abcde)
   *
   * @attribute
   */
  readonly notificationRuleArn: string;

  /**
   * Adds target to notification rule
   *
   * @param target The SNS topic or AWS Chatbot Slack target
   * @returns boolean - return true if it had any effect
   */
  addTarget(target: INotificationRuleTarget): boolean;
}

/**
 * A new notification rule
 *
 * @resource AWS::CodeStarNotifications::NotificationRule
 */
export class NotificationRule extends Resource implements INotificationRule {
  /**
   * Import an existing notification rule provided an ARN
   * @param scope The parent creating construct
   * @param id The construct's name
   * @param notificationRuleArn Notification rule ARN (i.e. arn:aws:codestar-notifications:::notificationrule/01234abcde)
   */
  public static fromNotificationRuleArn(scope: constructs.Construct, id: string, notificationRuleArn: string): INotificationRule {
    class Import extends Resource implements INotificationRule {
      readonly notificationRuleArn = notificationRuleArn;

      public addTarget(_target: INotificationRuleTarget): boolean {
        return false;
      }
    }

    return new Import(scope, id, {
      environmentFromArn: notificationRuleArn,
    });
  }

  /**
   * @attribute
   */
  public readonly notificationRuleArn: string;

  private readonly targets: NotificationRuleTargetConfig[] = [];

  private readonly events: string[] = [];

  constructor(scope: constructs.Construct, id: string, props: NotificationRuleProps) {
    super(scope, id);

    const source = props.source.bindAsNotificationRuleSource(this);

    this.addEvents(props.events);

    const resource = new CfnNotificationRule(this, 'Resource', {
      // It has a 64 characters limit for the name
      name: props.notificationRuleName || Names.uniqueId(this).slice(-64),
      detailType: props.detailType || DetailType.FULL,
      targets: this.targets,
      eventTypeIds: this.events,
      resource: source.sourceArn,
      status: props.enabled !== undefined
        ? (props.enabled ? 'ENABLED' : 'DISABLED')
        : undefined,
    });

    this.notificationRuleArn = resource.ref;

    props.targets?.forEach((target) => {
      this.addTarget(target);
    });
  }

  /**
   * Adds target to notification rule
   * @param target The SNS topic or AWS Chatbot Slack target
   */
  public addTarget(target: INotificationRuleTarget): boolean {
    this.targets.push(target.bindAsNotificationRuleTarget(this));
    return true;
  }

  /**
   * Adds events to notification rule
   *
   * @see https://docs.aws.amazon.com/dtconsole/latest/userguide/concepts.html#events-ref-pipeline
   * @see https://docs.aws.amazon.com/dtconsole/latest/userguide/concepts.html#events-ref-buildproject
   * @param events The list of event types for AWS Codebuild and AWS CodePipeline
   */
  private addEvents(events: string[]): void {
    events.forEach((event) => {
      if (this.events.includes(event)) {
        return;
      }

      this.events.push(event);
    });
  }
}
