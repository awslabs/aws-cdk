import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as logs from '@aws-cdk/aws-logs';
import { Construct } from '@aws-cdk/core';

/**
 * Use a Lambda Function as the destination for a log subscription
 */
export class LambdaDestination implements logs.ILogSubscriptionDestination {
  constructor(private readonly fn: lambda.IFunction) {
  }

  public bind(scope: Construct, logGroup: logs.ILogGroup): logs.LogSubscriptionDestinationConfig {
    const arn = logGroup.logGroupArn;

    this.fn.addPermission('CanInvokeLambda', {
      principal: new iam.ServicePrincipal('logs.amazonaws.com'),
      sourceArn: arn,
      // Using SubScription Filter as scope is okay, since every Subscription Filter has only
      // one destination.
      scope,
    });
    return { arn: this.fn.functionArn };
  }
}
