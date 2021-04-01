import * as logs from '@aws-cdk/aws-logs';
import { Construct } from 'constructs';

/**
 * Retry options for all AWS API calls.
 */
export interface LogRetentionRetryOptions extends logs.LogRetentionRetryOptions {
}

/**
 * Construction properties for a LogRetention.
 *
 * @deprecated use `LogRetentionProps` from '@aws-cdk/aws-logs' instead
 */
export interface LogRetentionProps extends logs.LogRetentionProps {
}

/**
 * Creates a custom resource to control the retention policy of a CloudWatch Logs
 * log group. The log group is created if it doesn't already exist. The policy
 * is removed when `retentionDays` is `undefined` or equal to `Infinity`.
 *
 * @deprecated use `LogRetention` from '@aws-cdk/aws-logs' instead
 */
export class LogRetention extends logs.LogRetention {
  constructor(scope: Construct, id: string, props: LogRetentionProps) {
    super(scope, id, { ...props });
  }
}
