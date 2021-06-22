import * as constructs from 'constructs';

/**
 * Information about the Codebuild or CodePipeline associated with a notification source.
 */
export interface NotificationRuleSourceConfig {
  /**
   * The Amazon Resource Name (ARN) of the notification source.
   */
  readonly sourceArn: string;
}

/**
 * Represents a notification source
 * The source that allows CodeBuild and CodePipeline to associate with this rule.
 */
export interface INotificationRuleSource {
  /**
   * Returns a source configuration for notification rule.
   */
  bindAsNotificationRuleSource(scope: constructs.Construct): NotificationRuleSourceConfig;
}
