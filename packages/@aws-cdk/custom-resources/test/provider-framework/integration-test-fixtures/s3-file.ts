import * as path from 'path';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as s3 from '@aws-cdk/aws-s3';
import { CustomResource, Stack } from '@aws-cdk/core';
import { Construct, Node } from 'constructs';
import * as cr from '../../../lib';
import * as api from './s3-file-handler/api';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';

interface S3FileProps {
  /**
   * The bucket in which the file will be created.
   */
  readonly bucket: s3.IBucket;

  /**
   * The object key.
   *
   * @default - automatically-generated
   */
  readonly objectKey?: string;

  /**
   * The contents of the file.
   */
  readonly contents: string;

  /**
   * Indicates if this file should have public-read permissions.
   *
   * @default false
   */
  readonly public?: boolean;
}

export class S3File extends CoreConstruct {
  public readonly objectKey: string;
  public readonly url: string;
  public readonly etag: string;

  constructor(scope: Construct, id: string, props: S3FileProps) {
    super(scope, id);

    const resource = new CustomResource(this, 'Resource', {
      serviceToken: S3FileProvider.getOrCreate(this),
      resourceType: 'Custom::S3File',
      properties: {
        [api.PROP_BUCKET_NAME]: props.bucket.bucketName,
        [api.PROP_CONTENTS]: props.contents,
        [api.PROP_OBJECT_KEY]: props.objectKey,
        [api.PROP_PUBLIC]: props.public,
      },
    });

    this.objectKey = resource.getAttString(api.ATTR_OBJECT_KEY);
    this.url = resource.getAttString(api.ATTR_URL);
    this.etag = resource.getAttString(api.ATTR_ETAG);
  }
}

class S3FileProvider extends CoreConstruct {
  /**
   * Returns the singleton provider.
   */
  public static getOrCreate(scope: Construct) {
    const stack = Stack.of(scope);
    const id = 'com.amazonaws.cdk.custom-resources.s3file-provider';
    const x = Node.of(stack).tryFindChild(id) as S3FileProvider || new S3FileProvider(stack, id);
    return x.provider.serviceToken;
  }

  private readonly provider: cr.Provider;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.provider = new cr.Provider(this, 's3file-provider', {
      onEventHandler: new lambda.Function(this, 's3file-on-event', {
        code: lambda.Code.fromAsset(path.join(__dirname, 's3-file-handler')),
        runtime: lambda.Runtime.NODEJS_10_X,
        handler: 'index.onEvent',
        initialPolicy: [
          new iam.PolicyStatement({
            resources: ['*'],
            actions: [
              's3:GetObject*',
              's3:GetBucket*',
              's3:List*',
              's3:DeleteObject*',
              's3:PutObject*',
              's3:Abort*',
            ],
          }),
        ],
      }),
    });
  }
}
