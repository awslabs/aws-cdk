import * as iam from '@aws-cdk/aws-iam';
import * as iot from '@aws-cdk/aws-iot';
import * as sns from '@aws-cdk/aws-sns';
import { singletonTopicRuleRole } from './util';

/**
 * The allowd message formats
 */
export enum MessageFormats {
  /**
   * JSON topic message format
   */
  JSON = 'JSON',
  /**
   * RAW topic message format
   */
  RAW = 'RAW',
}
/**
 * Construction properties for a sns publish action.
 */
export interface SnsTopicProps {
  /**
   * (Optional) The message format of the message to publish. Accepted values
   * are "JSON" and "RAW". The default value of the attribute is "RAW". SNS uses
   * this setting to determine if the payload should be parsed and relevant
   * platform-specific bits of the payload should be extracted.
   *
   * https://docs.aws.amazon.com/sns/latest/dg/json-formats.html
   *
   * @default - MessageFormats.RAW
   */
  readonly messageFormat?: MessageFormats;
  /**
   * The IAM role that grants access.
   *
   * @default - a role will be created
   */
  readonly role?: iam.IRole;
}

/**
 * Publishes to a Topic
 */
export class SnsTopic implements iot.ITopicRuleAction {
  constructor(private readonly topic: sns.ITopic, private readonly props: SnsTopicProps = {}) {
  }

  public bind(_rule: iot.ITopicRule): iot.TopicRuleActionConfig {
    // Allow rule to publish to topic
    const grantable = this.props.role ? this.props.role : new iam.ServicePrincipal('iot.amazonaws.com');
    this.topic.grantPublish(grantable);

    const role = this.props.role ? this.props.role : singletonTopicRuleRole(_rule, []);

    return {
      sns: {
        messageFormat: this.props.messageFormat || MessageFormats.RAW,
        targetArn: this.topic.topicArn,
        roleArn: role.roleArn,
      },
    };
  }
}
