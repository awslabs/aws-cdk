import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as logs from '@aws-cdk/aws-logs';
import { Construct } from '@aws-cdk/core';

/**
 * Options that may be provided to LambdaDestination
 */
export interface LambdaDestinationOptions{
  /** Whether or not to add Lambda Permissions.
   * @default true
   */
  readonly addPermissions?: boolean;
}

/**
 * Use a Lambda Function as the destination for a log subscription
 */
export class LambdaDestination implements logs.ILogSubscriptionDestination {
  /**  LambdaDestinationOptions */
  constructor(private readonly fn: lambda.IFunction, private readonly options: LambdaDestinationOptions = {}) {
  }

  public bind(scope: Construct, logGroup: logs.ILogGroup): logs.LogSubscriptionDestinationConfig {
    const arn = logGroup.logGroupArn;
    if (this.options.addPermissions !== false) {
      this.fn.addPermission('CanInvokeLambda', {
        principal: new iam.ServicePrincipal('logs.amazonaws.com'),
        sourceArn: arn,
        // Using SubScription Filter as scope is okay, since every Subscription Filter has only
        // one destination.
        scope,
      });
    }
    return { arn: this.fn.functionArn };
  }
}
