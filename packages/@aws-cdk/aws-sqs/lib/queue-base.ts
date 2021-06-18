import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import { IResource, Resource } from '@aws-cdk/core';
import { QueuePolicy } from './policy';

/**
 * Represents an SQS queue
 */
export interface IQueue extends IResource {
  /**
   * The ARN of this queue
   * @attribute
   */
  readonly queueArn: string;

  /**
   * The URL of this queue
   * @attribute
   */
  readonly queueUrl: string;

  /**
   * The name of this queue
   * @attribute
   */
  readonly queueName: string;

  /**
   * If this queue is server-side encrypted, this is the KMS encryption key.
   */
  readonly encryptionMasterKey?: kms.IKey;

  /**
   * Whether this queue is an Amazon SQS FIFO queue. If false, this is a standard queue.
   */
  readonly fifo: boolean;

  /**
   * Adds a statement to the IAM resource policy associated with this queue.
   *
   * If this queue was created in this stack (`new Queue`), a queue policy
   * will be automatically created upon the first call to `addToPolicy`. If
   * the queue is imported (`Queue.import`), then this is a no-op.
   */
  addToResourcePolicy(statement: iam.PolicyStatement): iam.AddToResourcePolicyResult;

  /**
   * Grant permissions to consume messages from a queue
   *
   * This will grant the following permissions:
   *
   *   - sqs:ChangeMessageVisibility
   *   - sqs:DeleteMessage
   *   - sqs:ReceiveMessage
   *   - sqs:GetQueueAttributes
   *   - sqs:GetQueueUrl
   *
   * @param grantee Principal to grant consume rights to
   */
  grantConsumeMessages(grantee: iam.IGrantable): iam.Grant;

  /**
   * Grant access to send messages to a queue to the given identity.
   *
   * This will grant the following permissions:
   *
   *  - sqs:SendMessage
   *  - sqs:GetQueueAttributes
   *  - sqs:GetQueueUrl
   *
   * @param grantee Principal to grant send rights to
   */
  grantSendMessages(grantee: iam.IGrantable): iam.Grant;

  /**
   * Grant an IAM principal permissions to purge all messages from the queue.
   *
   * This will grant the following permissions:
   *
   *  - sqs:PurgeQueue
   *  - sqs:GetQueueAttributes
   *  - sqs:GetQueueUrl
   *
   * @param grantee Principal to grant send rights to
   */
  grantPurge(grantee: iam.IGrantable): iam.Grant;

  /**
   * Grant the actions defined in queueActions to the identity Principal given
   * on this SQS queue resource.
   *
   * @param grantee Principal to grant right to
   * @param queueActions The actions to grant
   */
  grant(grantee: iam.IGrantable, ...queueActions: string[]): iam.Grant;
}

/**
 * Reference to a new or existing Amazon SQS queue
 */
export abstract class QueueBase extends Resource implements IQueue {
  /**
   * The ARN of this queue
   */
  public abstract readonly queueArn: string;

  /**
   * The URL of this queue
   */
  public abstract readonly queueUrl: string;

  /**
   * The name of this queue
   */
  public abstract readonly queueName: string;

  /**
   * If this queue is server-side encrypted, this is the KMS encryption key.
   */
  public abstract readonly encryptionMasterKey?: kms.IKey;

  /**
   * Whether this queue is an Amazon SQS FIFO queue. If false, this is a standard queue.
   */
  public abstract readonly fifo: boolean;

  /**
   * Controls automatic creation of policy objects.
   *
   * Set by subclasses.
   */
  protected abstract readonly autoCreatePolicy: boolean;

  private policy?: QueuePolicy;

  /**
   * Adds a statement to the IAM resource policy associated with this queue.
   *
   * If this queue was created in this stack (`new Queue`), a queue policy
   * will be automatically created upon the first call to `addToPolicy`. If
   * the queue is imported (`Queue.import`), then this is a no-op.
   */
  public addToResourcePolicy(statement: iam.PolicyStatement): iam.AddToResourcePolicyResult {
    if (!this.policy && this.autoCreatePolicy) {
      this.policy = new QueuePolicy(this, 'Policy', { queues: [this] });
    }

    if (this.policy) {
      this.policy.document.addStatements(statement);
      return { statementAdded: true, policyDependable: this.policy };
    }

    return { statementAdded: false };
  }

  protected validate(): string[] {
    const errors = super.validate();
    errors.push(...this.policy?.document.validateForResourcePolicy() || []);
    return errors;
  }

  /**
   * Grant permissions to consume messages from a queue
   *
   * This will grant the following permissions:
   *
   *   - sqs:ChangeMessageVisibility
   *   - sqs:DeleteMessage
   *   - sqs:ReceiveMessage
   *   - sqs:GetQueueAttributes
   *   - sqs:GetQueueUrl
   *
   * @param grantee Principal to grant consume rights to
   */
  public grantConsumeMessages(grantee: iam.IGrantable) {
    const ret = this.grant(grantee,
      'sqs:ReceiveMessage',
      'sqs:ChangeMessageVisibility',
      'sqs:GetQueueUrl',
      'sqs:DeleteMessage',
      'sqs:GetQueueAttributes');

    if (this.encryptionMasterKey) {
      this.encryptionMasterKey.grantDecrypt(grantee);
    }

    return ret;
  }

  /**
   * Grant access to send messages to a queue to the given identity.
   *
   * This will grant the following permissions:
   *
   *  - sqs:SendMessage
   *  - sqs:GetQueueAttributes
   *  - sqs:GetQueueUrl
   *
   * @param grantee Principal to grant send rights to
   */
  public grantSendMessages(grantee: iam.IGrantable) {
    const ret = this.grant(grantee,
      'sqs:SendMessage',
      'sqs:GetQueueAttributes',
      'sqs:GetQueueUrl');

    if (this.encryptionMasterKey) {
      // kms:Decrypt necessary to execute grantsendMessages to an SSE enabled SQS queue
      this.encryptionMasterKey.grantEncryptDecrypt(grantee);
    }
    return ret;
  }

  /**
   * Grant an IAM principal permissions to purge all messages from the queue.
   *
   * This will grant the following permissions:
   *
   *  - sqs:PurgeQueue
   *  - sqs:GetQueueAttributes
   *  - sqs:GetQueueUrl
   *
   * @param grantee Principal to grant send rights to
   */
  public grantPurge(grantee: iam.IGrantable) {
    return this.grant(grantee,
      'sqs:PurgeQueue',
      'sqs:GetQueueAttributes',
      'sqs:GetQueueUrl');
  }

  /**
   * Grant the actions defined in queueActions to the identity Principal given
   * on this SQS queue resource.
   *
   * @param grantee Principal to grant right to
   * @param actions The actions to grant
   */
  public grant(grantee: iam.IGrantable, ...actions: string[]) {
    return iam.Grant.addToPrincipalOrResource({
      grantee,
      actions,
      resourceArns: [this.queueArn],
      resource: this,
    });
  }
}
/**
 * Reference to a queue
 */
export interface QueueAttributes {
  /**
   * The ARN of the queue.
   */
  readonly queueArn: string;

  /**
   * The URL of the queue.
   * @see https://docs.aws.amazon.com/sdk-for-net/v2/developer-guide/QueueURL.html
   *
   * @default - 'https://sqs.<region-endpoint>/<account-ID>/<queue-name>'
   */
  readonly queueUrl?: string;

  /**
   * The name of the queue.
   * @default if queue name is not specified, the name will be derived from the queue ARN
   */
  readonly queueName?: string;

  /**
   * KMS encryption key, if this queue is server-side encrypted by a KMS key.
   *
   * @default - None
   */
  readonly keyArn?: string;
}
