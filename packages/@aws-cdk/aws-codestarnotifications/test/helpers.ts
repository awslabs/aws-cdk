import * as notifications from '../lib';

export class FakeCodeBuild implements notifications.INotificationRuleSource {
  readonly projectArn = 'arn:aws:codebuild::1234567890:project/MyCodebuildProject';
  readonly projectName = 'test-project';

  bindAsNotificationRuleSource(): notifications.NotificationRuleSourceConfig {
    return {
      sourceArn: this.projectArn,
    };
  }
}

export class FakeCodePipeline implements notifications.INotificationRuleSource {
  readonly pipelineArn = 'arn:aws:codepipeline::1234567890:MyCodepipelineProject';
  readonly pipelineName = 'test-pipeline';

  bindAsNotificationRuleSource(): notifications.NotificationRuleSourceConfig {
    return {
      sourceArn: this.pipelineArn,
    };
  }
}

export class FakeSnsTopicTarget implements notifications.INotificationRuleTarget {
  readonly topicArn = 'arn:aws:sns::1234567890:MyTopic';

  bindAsNotificationRuleTarget(): notifications.NotificationRuleTargetConfig {
    return {
      targetType: 'SNS',
      targetAddress: this.topicArn,
    };
  }
}

export class FakeSlackTarget implements notifications.INotificationRuleTarget {
  readonly slackChannelConfigurationArn = 'arn:aws:chatbot::1234567890:chat-configuration/slack-channel/MySlackChannel';

  bindAsNotificationRuleTarget(): notifications.NotificationRuleTargetConfig {
    return {
      targetType: 'AWSChatbotSlack',
      targetAddress: this.slackChannelConfigurationArn,
    };
  }
}
