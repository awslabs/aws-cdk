import * as kms from '@aws-cdk/aws-kms';
import { Duration, RemovalPolicy, Stack, Token } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { IQueue, QueueAttributes, QueueBase } from './queue-base';
import { CfnQueue } from './sqs.generated';
import { validateProps } from './validate-props';

/**
 * Properties for creating a new Queue
 */
export interface QueueProps {
  /**
   * A name for the queue.
   *
   * If specified and this is a FIFO queue, must end in the string '.fifo'.
   *
   * @default CloudFormation-generated name
   */
  readonly queueName?: string;

  /**
   * The number of seconds that Amazon SQS retains a message.
   *
   * You can specify an integer value from 60 seconds (1 minute) to 1209600
   * seconds (14 days). The default value is 345600 seconds (4 days).
   *
   * @default Duration.days(4)
   */
  readonly retentionPeriod?: Duration;

  /**
   * The time in seconds that the delivery of all messages in the queue is delayed.
   *
   * You can specify an integer value of 0 to 900 (15 minutes). The default
   * value is 0.
   *
   * @default 0
   */
  readonly deliveryDelay?: Duration;

  /**
   * The limit of how many bytes that a message can contain before Amazon SQS rejects it.
   *
   * You can specify an integer value from 1024 bytes (1 KiB) to 262144 bytes
   * (256 KiB). The default value is 262144 (256 KiB).
   *
   * @default 256KiB
   */
  readonly maxMessageSizeBytes?: number;

  /**
   * Default wait time for ReceiveMessage calls.
   *
   * Does not wait if set to 0, otherwise waits this amount of seconds
   * by default for messages to arrive.
   *
   * For more information, see Amazon SQS Long Poll.
   *
   *  @default 0
   */
  readonly receiveMessageWaitTime?: Duration;

  /**
   * Timeout of processing a single message.
   *
   * After dequeuing, the processor has this much time to handle the message
   * and delete it from the queue before it becomes visible again for dequeueing
   * by another processor.
   *
   * Values must be from 0 to 43200 seconds (12 hours). If you don't specify
   * a value, AWS CloudFormation uses the default value of 30 seconds.
   *
   * @default Duration.seconds(30)
   */
  readonly visibilityTimeout?: Duration;

  /**
   * Send messages to this queue if they were unsuccessfully dequeued a number of times.
   *
   * @default no dead-letter queue
   */
  readonly deadLetterQueue?: DeadLetterQueue;

  /**
   * Whether the contents of the queue are encrypted, and by what type of key.
   *
   * Be aware that encryption is not available in all regions, please see the docs
   * for current availability details.
   *
   * @default Unencrypted
   */
  readonly encryption?: QueueEncryption;

  /**
   * External KMS master key to use for queue encryption.
   *
   * Individual messages will be encrypted using data keys. The data keys in
   * turn will be encrypted using this key, and reused for a maximum of
   * `dataKeyReuseSecs` seconds.
   *
   * If the 'encryptionMasterKey' property is set, 'encryption' type will be
   * implicitly set to "KMS".
   *
   * @default If encryption is set to KMS and not specified, a key will be created.
   */
  readonly encryptionMasterKey?: kms.IKey;

  /**
   * The length of time that Amazon SQS reuses a data key before calling KMS again.
   *
   * The value must be an integer between 60 (1 minute) and 86,400 (24
   * hours). The default is 300 (5 minutes).
   *
   * @default Duration.minutes(5)
   */
  readonly dataKeyReuse?: Duration;

  /**
   * Whether this a first-in-first-out (FIFO) queue.
   *
   * @default false, unless queueName ends in '.fifo' or 'contentBasedDeduplication' is true.
   */
  readonly fifo?: boolean;

  /**
   * Specifies whether to enable content-based deduplication.
   *
   * During the deduplication interval (5 minutes), Amazon SQS treats
   * messages that are sent with identical content (excluding attributes) as
   * duplicates and delivers only one copy of the message.
   *
   * If you don't enable content-based deduplication and you want to deduplicate
   * messages, provide an explicit deduplication ID in your SendMessage() call.
   *
   * (Only applies to FIFO queues.)
   *
   * @default false
   */
  readonly contentBasedDeduplication?: boolean;

  /**
   * Policy to apply when the user pool is removed from the stack
   *
   * Even though queues are technically stateful, their contents are transient and it
   * is common to add and remove Queues while rearchitecting your application. The
   * default is therefore `DESTROY`. Change it to `RETAIN` if the messages are so
   * valuable that accidentally losing them would be unacceptable.
   *
   * @default RemovalPolicy.DESTROY
   */
  readonly removalPolicy?: RemovalPolicy;
}

/**
 * Dead letter queue settings
 */
export interface DeadLetterQueue {
  /**
   * The dead-letter queue to which Amazon SQS moves messages after the value of maxReceiveCount is exceeded.
   */
  readonly queue: IQueue;

  /**
   * The number of times a message can be unsuccesfully dequeued before being moved to the dead-letter queue.
   */
  readonly maxReceiveCount: number;
}

/**
 * What kind of encryption to apply to this queue
 */
export enum QueueEncryption {
  /**
   * Messages in the queue are not encrypted
   */
  UNENCRYPTED = 'NONE',

  /**
   * Server-side KMS encryption with a master key managed by SQS.
   */
  KMS_MANAGED = 'MANAGED',

  /**
   * Server-side encryption with a KMS key managed by the user.
   *
   * If `encryptionKey` is specified, this key will be used, otherwise, one will be defined.
   */
  KMS = 'KMS',
}

/**
 * A new Amazon SQS queue
 */
export class Queue extends QueueBase {
  /**
   * Import an existing SQS queue provided an ARN
   *
   * @param scope The parent creating construct
   * @param id The construct's name
   * @param queueArn queue ARN (i.e. arn:aws:sqs:us-east-2:444455556666:queue1)
   */
  public static fromQueueArn(scope: Construct, id: string, queueArn: string): IQueue {
    return Queue.fromQueueAttributes(scope, id, { queueArn });
  }

  /**
   * Import an existing queue
   */
  public static fromQueueAttributes(scope: Construct, id: string, attrs: QueueAttributes): IQueue {
    const stack = Stack.of(scope);
    const parsedArn = stack.parseArn(attrs.queueArn);
    const queueName = attrs.queueName || parsedArn.resource;
    const queueUrl = attrs.queueUrl || `https://sqs.${parsedArn.region}.${stack.urlSuffix}/${parsedArn.account}/${queueName}`;

    class Import extends QueueBase {
      public readonly queueArn = attrs.queueArn; // arn:aws:sqs:us-east-1:123456789012:queue1
      public readonly queueUrl = queueUrl;
      public readonly queueName = queueName;
      public readonly encryptionMasterKey = attrs.keyArn
        ? kms.Key.fromKeyArn(this, 'Key', attrs.keyArn)
        : undefined;
      public readonly fifo = queueName.endsWith('.fifo') ? true : false;

      protected readonly autoCreatePolicy = false;
    }

    return new Import(scope, id);
  }

  /**
   * The ARN of this queue
   */
  public readonly queueArn: string;

  /**
   * The name of this queue
   */
  public readonly queueName: string;

  /**
   * The URL of this queue
   */
  public readonly queueUrl: string;

  /**
   * If this queue is encrypted, this is the KMS key.
   */
  public readonly encryptionMasterKey?: kms.IKey;

  /**
   * Whether this queue is an Amazon SQS FIFO queue. If false, this is a standard queue.
   */
  public readonly fifo: boolean;

  protected readonly autoCreatePolicy = true;

  constructor(scope: Construct, id: string, props: QueueProps = {}) {
    super(scope, id, {
      physicalName: props.queueName,
    });

    validateProps(props);

    const redrivePolicy = props.deadLetterQueue
      ? {
        deadLetterTargetArn: props.deadLetterQueue.queue.queueArn,
        maxReceiveCount: props.deadLetterQueue.maxReceiveCount,
      }
      : undefined;

    const { encryptionMasterKey, encryptionProps } = _determineEncryptionProps.call(this);

    const fifoProps = this.determineFifoProps(props);
    this.fifo = fifoProps.fifoQueue || false;

    const queue = new CfnQueue(this, 'Resource', {
      queueName: this.physicalName,
      ...fifoProps,
      ...encryptionProps,
      redrivePolicy,
      delaySeconds: props.deliveryDelay && props.deliveryDelay.toSeconds(),
      maximumMessageSize: props.maxMessageSizeBytes,
      messageRetentionPeriod: props.retentionPeriod && props.retentionPeriod.toSeconds(),
      receiveMessageWaitTimeSeconds: props.receiveMessageWaitTime && props.receiveMessageWaitTime.toSeconds(),
      visibilityTimeout: props.visibilityTimeout && props.visibilityTimeout.toSeconds(),
    });
    queue.applyRemovalPolicy(props.removalPolicy ?? RemovalPolicy.DESTROY);

    this.queueArn = this.getResourceArnAttribute(queue.attrArn, {
      service: 'sqs',
      resource: this.physicalName,
    });
    this.queueName = this.getResourceNameAttribute(queue.attrQueueName);
    this.encryptionMasterKey = encryptionMasterKey;
    this.queueUrl = queue.ref;

    function _determineEncryptionProps(this: Queue): { encryptionProps: EncryptionProps, encryptionMasterKey?: kms.IKey } {
      let encryption = props.encryption || QueueEncryption.UNENCRYPTED;

      if (encryption !== QueueEncryption.KMS && props.encryptionMasterKey) {
        encryption = QueueEncryption.KMS; // KMS is implied by specifying an encryption key
      }

      if (encryption === QueueEncryption.UNENCRYPTED) {
        return { encryptionProps: {} };
      }

      if (encryption === QueueEncryption.KMS_MANAGED) {
        return {
          encryptionProps: {
            kmsMasterKeyId: 'alias/aws/sqs',
            kmsDataKeyReusePeriodSeconds: props.dataKeyReuse && props.dataKeyReuse.toSeconds(),
          },
        };
      }

      if (encryption === QueueEncryption.KMS) {
        const masterKey = props.encryptionMasterKey || new kms.Key(this, 'Key', {
          description: `Created by ${this.node.path}`,
        });

        return {
          encryptionMasterKey: masterKey,
          encryptionProps: {
            kmsMasterKeyId: masterKey.keyArn,
            kmsDataKeyReusePeriodSeconds: props.dataKeyReuse && props.dataKeyReuse.toSeconds(),
          },
        };
      }

      throw new Error(`Unexpected 'encryptionType': ${encryption}`);
    }
  }

  /**
   * Look at the props, see if the FIFO props agree, and return the correct subset of props
   */
  private determineFifoProps(props: QueueProps): FifoProps {
    // Check if any of the signals that we have say that this is a FIFO queue.
    let fifoQueue = props.fifo;
    const queueName = props.queueName;
    if (typeof fifoQueue === 'undefined' && queueName && !Token.isUnresolved(queueName) && queueName.endsWith('.fifo')) { fifoQueue = true; }
    if (typeof fifoQueue === 'undefined' && props.contentBasedDeduplication) { fifoQueue = true; }

    // If we have a name, see that it agrees with the FIFO setting
    if (typeof queueName === 'string') {
      if (fifoQueue && !queueName.endsWith('.fifo')) {
        throw new Error("FIFO queue names must end in '.fifo'");
      }
      if (!fifoQueue && queueName.endsWith('.fifo')) {
        throw new Error("Non-FIFO queue name may not end in '.fifo'");
      }
    }

    if (props.contentBasedDeduplication && !fifoQueue) {
      throw new Error('Content-based deduplication can only be defined for FIFO queues');
    }

    return {
      contentBasedDeduplication: props.contentBasedDeduplication,
      fifoQueue,
    };
  }
}

interface FifoProps {
  readonly fifoQueue?: boolean;
  readonly contentBasedDeduplication?: boolean;
}

interface EncryptionProps {
  readonly kmsMasterKeyId?: string;
  readonly kmsDataKeyReusePeriodSeconds?: number;
}
