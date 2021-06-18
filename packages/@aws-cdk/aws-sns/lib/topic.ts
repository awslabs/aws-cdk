import { IKey } from '@aws-cdk/aws-kms';
import { Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnTopic } from './sns.generated';
import { ITopic, TopicBase } from './topic-base';

/**
 * Properties for a new SNS topic
 */
export interface TopicProps {
  /**
   * A developer-defined string that can be used to identify this SNS topic.
   *
   * @default None
   */
  readonly displayName?: string;

  /**
   * A name for the topic.
   *
   * If you don't specify a name, AWS CloudFormation generates a unique
   * physical ID and uses that ID for the topic name. For more information,
   * see Name Type.
   *
   * @default Generated name
   */
  readonly topicName?: string;

  /**
   * A KMS Key, either managed by this CDK app, or imported.
   *
   * @default None
   */
  readonly masterKey?: IKey;

  /**
   * Enables content-based deduplication for FIFO topics.
   *
   * @default None
   */
  readonly contentBasedDeduplication?: boolean;

  /**
   * Set to true to create a FIFO topic.
   *
   * @default None
   */
  readonly fifo?: boolean;
}

/**
 * A new SNS topic
 */
export class Topic extends TopicBase {
  /**
   * Import an existing SNS topic provided an ARN
   *
   * @param scope The parent creating construct
   * @param id The construct's name
   * @param topicArn topic ARN (i.e. arn:aws:sns:us-east-2:444455556666:MyTopic)
   */
  public static fromTopicArn(scope: Construct, id: string, topicArn: string): ITopic {
    class Import extends TopicBase {
      public readonly topicArn = topicArn;
      public readonly topicName = Stack.of(scope).parseArn(topicArn).resource;
      protected autoCreatePolicy: boolean = false;
    }

    return new Import(scope, id);
  }

  public readonly topicArn: string;
  public readonly topicName: string;

  protected readonly autoCreatePolicy: boolean = true;

  constructor(scope: Construct, id: string, props: TopicProps = {}) {
    super(scope, id, {
      physicalName: props.topicName,
    });

    if (props.fifo && !props.topicName) {
      // NOTE: Workaround for CloudFormation problem reported in CDK issue 12386
      // see https://github.com/aws/aws-cdk/issues/12386
      throw new Error('FIFO SNS topics must be given a topic name.');
    }

    if (props.contentBasedDeduplication && !props.fifo) {
      throw new Error('Content based deduplication can only be enabled for FIFO SNS topics.');
    }

    let cfnTopicName: string;
    if (props.fifo && props.topicName && !props.topicName.endsWith('.fifo')) {
      cfnTopicName = this.physicalName + '.fifo';
    } else {
      cfnTopicName = this.physicalName;
    }

    const resource = new CfnTopic(this, 'Resource', {
      displayName: props.displayName,
      topicName: cfnTopicName,
      kmsMasterKeyId: props.masterKey && props.masterKey.keyArn,
      contentBasedDeduplication: props.contentBasedDeduplication,
      fifoTopic: props.fifo,
    });

    this.topicArn = this.getResourceArnAttribute(resource.ref, {
      service: 'sns',
      resource: this.physicalName,
    });
    this.topicName = this.getResourceNameAttribute(resource.attrTopicName);
  }
}
