import * as path from 'path';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as s3 from '@aws-cdk/aws-s3';
import { CustomResource, Duration, Stack } from '@aws-cdk/core';
import { Construct, Node } from 'constructs';
import * as cr from '../../../lib';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';

export interface S3AssertProps {
  /**
   * The s3 bucket to query.
   */
  readonly bucket: s3.IBucket;

  /**
   * The object key.
   */
  readonly objectKey: string;

  /**
   * The expected contents.
   */
  readonly expectedContent: string;
}

/**
 * A custom resource that asserts that a file on s3 has the specified contents.
 * This resource will wait 10 minutes before, allowing for eventual consistency
 * to stabilize (and also exercises the idea of asynchronous custom resources).
 *
 * Code is written in Python because why not.
 */
export class S3Assert extends CoreConstruct {
  constructor(scope: Construct, id: string, props: S3AssertProps) {
    super(scope, id);

    new CustomResource(this, 'Resource', {
      serviceToken: S3AssertProvider.getOrCreate(this),
      resourceType: 'Custom::S3Assert',
      properties: {
        BucketName: props.bucket.bucketName,
        ObjectKey: props.objectKey,
        ExpectedContent: props.expectedContent,
      },
    });
  }
}

class S3AssertProvider extends CoreConstruct {
  /**
   * Returns the singleton provider.
   */
  public static getOrCreate(scope: Construct) {
    const providerId = 'com.amazonaws.cdk.custom-resources.s3assert-provider';
    const stack = Stack.of(scope);
    const group = Node.of(stack).tryFindChild(providerId) as S3AssertProvider || new S3AssertProvider(stack, providerId);
    return group.provider.serviceToken;
  }

  private readonly provider: cr.Provider;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const onEvent = new lambda.Function(this, 's3assert-on-event', {
      code: lambda.Code.fromAsset(path.join(__dirname, 's3-assert-handler')),
      runtime: lambda.Runtime.PYTHON_3_7,
      handler: 'index.on_event',
    });

    const isComplete = new lambda.Function(this, 's3assert-is-complete', {
      code: lambda.Code.fromAsset(path.join(__dirname, 's3-assert-handler')),
      runtime: lambda.Runtime.PYTHON_3_7,
      handler: 'index.is_complete',
      initialPolicy: [
        new iam.PolicyStatement({
          resources: ['*'],
          actions: [
            's3:GetObject*',
            's3:GetBucket*',
            's3:List*',
          ],
        }),
      ],
    });

    this.provider = new cr.Provider(this, 's3assert-provider', {
      onEventHandler: onEvent,
      isCompleteHandler: isComplete,
      totalTimeout: Duration.minutes(5),
    });
  }
}
