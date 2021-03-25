import * as iam from '@aws-cdk/aws-iam';
import * as iot from '@aws-cdk/aws-iot';
import { singletonTopicRuleRole } from './util';

/**
 * Construction properties for a Republish action.
 */
export interface RepublishProps {
  /**
   * The name of the MQTT topic
   */
  readonly topic: string;
  /**
   * The Quality of Service (Qos) level to use when republishing messages.
   *
   * @default - 0
   */
  readonly qos?: number;
  /**
   * The IAM role that grants access.
   *
   * @default - a role will be created
   */
  readonly role?: iam.IRole;
}

/**
 * Publishes to a IoT Topic
 */
export class RepublishTopic implements iot.ITopicRuleAction {
  constructor(private readonly topic: iot.ITopicRule, private readonly props: RepublishProps) {
  }

  public bind(rule: iot.ITopicRule): iot.TopicRuleActionConfig {
    // Allow rule to publish to topic
    const role = this.props.role || singletonTopicRuleRole(rule, []);
    this.topic.grantPublish(role, this.props.topic);

    return {
      republish: {
        qos: this.props.qos || 0,
        topic: this.props.topic,
        roleArn: role.roleArn,
      },
    };
  }
}
