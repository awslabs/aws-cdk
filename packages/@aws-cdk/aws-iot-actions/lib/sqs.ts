import * as iam from '@aws-cdk/aws-iam';
import * as iot from '@aws-cdk/aws-iot';
import * as sqs from '@aws-cdk/aws-sqs';
import { singletonTopicRuleRole } from './util';

/**
 * Construction properties for a sqs send message action.
 */
export interface SqsQueueProps {
  /**
   * Specifies whether to use Base64 encoding.
   *
   * @default - false
   */
  readonly useBase64?: boolean;
  /**
   * The IAM role that grants access.
   *
   * @default - a role will be created
   */
  readonly role?: iam.IRole;
}

/**
 * Publishes to a Queue
 */
export class SqsQueue implements iot.ITopicRuleAction {
  constructor(private readonly queue: sqs.IQueue, private readonly props: SqsQueueProps = {}) {
  }

  public bind(_rule: iot.ITopicRule): iot.TopicRuleActionConfig {
    // Allow rule to publish to topic
    const grantable = this.props.role ? this.props.role : new iam.ServicePrincipal('iot.amazonaws.com');
    this.queue.grantSendMessages(grantable);

    const role = this.props.role ? this.props.role : singletonTopicRuleRole(_rule, []);

    return {
      sqs: {
        useBase64: this.props.useBase64 || false,
        queueUrl: this.queue.queueUrl,
        roleArn: role.roleArn,
      },
    };
  }
}
