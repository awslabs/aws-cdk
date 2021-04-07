import * as iam from '@aws-cdk/aws-iam';
import * as kinesis from '@aws-cdk/aws-kinesis';
import * as logs from '@aws-cdk/aws-logs';
import { Construct } from '@aws-cdk/core';

/**
 * Use a Kinesis stream as the destination for a log subscription
 */
export class KinesisDestination implements logs.ILogSubscriptionDestination {
  constructor(private readonly stream: kinesis.IStream) {
  }

  public bind(scope: Construct, _sourceLogGroup: logs.ILogGroup): logs.LogSubscriptionDestinationConfig {
    // Following example from https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/SubscriptionFilters.html#DestinationKinesisExample
    // Create a role to be assumed by CWL that can write to this stream and pass itself.
    const id = 'CloudWatchLogsCanPutRecords';
    const role = _sourceLogGroup.role || scope.node.tryFindChild(id) as iam.IRole || new iam.Role(scope, id, {
      assumedBy: new iam.ServicePrincipal('logs.amazonaws.com'),
    });
    this.stream.grantWrite(role);
    role.grantPassRole(role);
    return { arn: this.stream.streamArn, role };
  }
}
