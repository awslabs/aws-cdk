import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import * as kinesis from '@aws-cdk/aws-kinesis';
import { singletonEventRole } from './util';

/**
 * Customize the Kinesis Stream Event Target
 */
export interface KinesisStreamProps {
  /**
   * Partition Key Path for records sent to this stream
   *
   * @default - eventId as the partition key
   */
  readonly partitionKeyPath?: string;

  /**
   * The message to send to the stream.
   *
   * Must be a valid JSON text passed to the target stream.
   *
   * @default - the entire CloudWatch event
   */
  readonly message?: events.RuleTargetInput;

}

/**
 * Use a Kinesis Stream as a target for AWS CloudWatch event rules.
 *
 * @example
 *
 *    // put to a Kinesis stream every time code is committed
 *    // to a CodeCommit repository
 *    repository.onCommit(new targets.KinesisStream(stream));
 *
 */
export class KinesisStream implements events.IRuleTarget {
  constructor(private readonly stream: kinesis.IStream, private readonly props: KinesisStreamProps = {}) {
  }

  /**
   * Returns a RuleTarget that can be used to trigger this Kinesis Stream as a
   * result from a CloudWatch event.
   */
  public bind(_rule: events.IRule, _id?: string): events.RuleTargetConfig {
    const policyStatements = [new iam.PolicyStatement({
      actions: ['kinesis:PutRecord', 'kinesis:PutRecords'],
      resources: [this.stream.streamArn],
    })];

    return {
      arn: this.stream.streamArn,
      role: singletonEventRole(this.stream, policyStatements),
      input: this.props.message,
      targetResource: this.stream,
      kinesisParameters: this.props.partitionKeyPath ? { partitionKeyPath: this.props.partitionKeyPath } : undefined,
    };
  }
}
