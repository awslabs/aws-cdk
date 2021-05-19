import * as path from 'path';
import * as lambda from '@aws-cdk/aws-lambda';
import { Duration, Stack } from '@aws-cdk/core';
import * as cr from '@aws-cdk/custom-resources';
import { Construct } from 'constructs';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct as CoreConstruct } from '@aws-cdk/core';

export class TimeToLiveProvider extends CoreConstruct {
  /**
   * Creates a stack-singleton resource provider.
   */
  public static getOrCreate(scope: Construct): TimeToLiveProvider {
    const stack = Stack.of(scope);
    const logicalId = '@aws-cdk/aws-dynamodb.TimeToLiveProvider';
    return stack.node.tryFindChild(logicalId) as TimeToLiveProvider ?? new TimeToLiveProvider(stack, logicalId);
  }

  /**
   * The custom resource provider.
   */
  public readonly provider: cr.Provider;

  /**
   * The onEvent handler
   */
  public readonly onEventHandler: lambda.Function;

  /**
   * The isComplete handler
   */
  public readonly isCompleteHandler: lambda.Function;

  private constructor(scope: Construct, id: string) {
    super(scope as CoreConstruct, id);

    const code = lambda.Code.fromAsset(path.join(__dirname, 'table-time-to-live-handler'));

    // Issues UpdateTable API calls
    this.onEventHandler = new lambda.Function(this, 'OnEventHandler', {
      code,
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'index.onEventHandler',
      timeout: Duration.seconds(30),
    });

    // Checks if table is back to `ACTIVE` state
    this.isCompleteHandler = new lambda.Function(this, 'IsCompleteHandler', {
      code,
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'index.isCompleteHandler',
      timeout: Duration.seconds(30),
    });

    this.provider = new cr.Provider(this, 'Provider', {
      onEventHandler: this.onEventHandler,
      isCompleteHandler: this.isCompleteHandler,
      // Using a total timeout of 75 minutes as disabling can take up to 1 hour.
      // Additionally an enabling afterwards can be necessary.
      totalTimeout: Duration.minutes(75),
      // As a tradeoff the query interval is set to 1 minute to reduce the number of lambda calls.
      queryInterval: Duration.minutes(1),
    });
  }
}
