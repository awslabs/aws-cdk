import * as iam from '@aws-cdk/aws-iam';
import * as firehose from '@aws-cdk/aws-kinesisfirehose';
import * as logs from '@aws-cdk/aws-logs';
import { Stack } from '@aws-cdk/core';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/**
 * Use a Kinesis Firehose as the destination for a log subscription
 */
export class KinesisFirehoseDestination implements logs.ILogSubscriptionDestination {
  constructor(private readonly deliveryStream: firehose.CfnDeliveryStream) {
  }

  public bind(scope: Construct, _sourceLogGroup: logs.ILogGroup): logs.LogSubscriptionDestinationConfig {
    const { region } = Stack.of(scope);

    // Following example from https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/SubscriptionFilters.html#FirehoseExample
    // Create a role to be assumed by CWL that can write to this Firehose.
    const roleId = 'CloudWatchLogsCanPutRecordsIntoKinesisFirehose';
    const role = scope.node.tryFindChild(roleId) as iam.IRole ?? new iam.Role(scope, roleId, {
      assumedBy: new iam.ServicePrincipal(`logs.${region}.amazonaws.com`),
    });

    iam.Grant.addToPrincipal({
      scope,
      grantee: role,
      actions: [
        'firehose:PutRecord',
        'firehose:PutRecordBatch',
      ],
      resourceArns: [
        this.deliveryStream.attrArn,
      ],
    });

    return {
      arn: this.deliveryStream.attrArn,
      role,
    };
  }
}
