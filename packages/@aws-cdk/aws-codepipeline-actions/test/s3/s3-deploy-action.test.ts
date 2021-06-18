import '@aws-cdk/assert-internal/jest';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as s3 from '@aws-cdk/aws-s3';
import { App, Duration, SecretValue, Stack } from '@aws-cdk/core';
import * as cxapi from '@aws-cdk/cx-api';
import { testFutureBehavior } from 'cdk-build-tools/lib/feature-flag';
import * as cpactions from '../../lib';

/* eslint-disable quote-props */

describe('', () => {
  describe('S3 Deploy Action', () => {
    test('by default extract artifacts', () => {
      const stack = new Stack();
      minimalPipeline(stack);

      expect(stack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
        'Stages': [
          {
            'Name': 'Source',
            'Actions': [
              {
                'Name': 'Source',
                'ActionTypeId': {
                  'Category': 'Source',
                  'Owner': 'ThirdParty',
                },
              },
            ],
          },
          {
            'Name': 'Deploy',
            'Actions': [
              {
                'ActionTypeId': {
                  'Category': 'Deploy',
                  'Provider': 'S3',
                },
                'Configuration': {
                  'Extract': 'true',
                },
                'Name': 'CopyFiles',
              },
            ],
          },
        ],
      });
    });

    testFutureBehavior('grant the pipeline correct access to the target bucket', { [cxapi.S3_GRANT_WRITE_WITHOUT_ACL]: true }, App, (app) => {
      const stack = new Stack(app);
      minimalPipeline(stack);

      expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
        'PolicyDocument': {
          'Statement': [
            {
              'Effect': 'Allow',
              'Action': [
                's3:GetObject*',
                's3:GetBucket*',
                's3:List*',
                's3:DeleteObject*',
                's3:PutObject',
                's3:Abort*',
              ],
            },
            {},
            {
              'Effect': 'Allow',
              'Action': 'sts:AssumeRole',
            },
          ],
        },
      });
    });

    test('kebab-case CannedACL value', () => {
      const stack = new Stack();
      minimalPipeline(stack, {
        accessControl: s3.BucketAccessControl.PUBLIC_READ_WRITE,
      });

      expect(stack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
        'Stages': [
          {},
          {
            'Actions': [
              {
                'Configuration': {
                  'CannedACL': 'public-read-write',
                },
              },
            ],
          },
        ],
      });
    });

    test('allow customizing cache-control', () => {
      const stack = new Stack();
      minimalPipeline(stack, {
        cacheControl: [
          cpactions.CacheControl.setPublic(),
          cpactions.CacheControl.maxAge(Duration.hours(12)),
          cpactions.CacheControl.sMaxAge(Duration.hours(12)),
        ],
      });

      expect(stack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
        'Stages': [
          {},
          {
            'Actions': [
              {
                'Configuration': {
                  'CacheControl': 'public, max-age=43200, s-maxage=43200',
                },
              },
            ],
          },
        ],
      });
    });

    test('allow customizing objectKey (deployment path on S3)', () => {
      const stack = new Stack();
      minimalPipeline(stack, {
        objectKey: '/a/b/c',
      });

      expect(stack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
        'Stages': [
          {},
          {
            'Actions': [
              {
                'Configuration': {
                  'ObjectKey': '/a/b/c',
                },
              },
            ],
          },
        ],
      });
    });

    test('correctly makes the action cross-region for a Bucket imported with a different region', () => {
      const app = new App();
      const stack = new Stack(app, 'PipelineStack', {
        env: { account: '123456789012', region: 'us-west-2' },
      });
      const deployBucket = s3.Bucket.fromBucketAttributes(stack, 'DeployBucket', {
        bucketName: 'my-deploy-bucket',
        region: 'ap-southeast-1',
      });

      minimalPipeline(stack, {
        bucket: deployBucket,
      });

      expect(stack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
        Stages: [
          {},
          {
            Name: 'Deploy',
            Actions: [
              {
                Name: 'CopyFiles',
                Region: 'ap-southeast-1',
              },
            ],
          },
        ],
      });
    });
  });
});

interface MinimalPipelineOptions {
  readonly accessControl?: s3.BucketAccessControl;
  readonly bucket?: s3.IBucket;
  readonly cacheControl?: cpactions.CacheControl[];
  readonly extract?: boolean;
  readonly objectKey?: string;
}

function minimalPipeline(stack: Stack, options: MinimalPipelineOptions = {}): codepipeline.IStage {
  const sourceOutput = new codepipeline.Artifact();
  const sourceAction = new cpactions.GitHubSourceAction({
    actionName: 'Source',
    owner: 'aws',
    repo: 'aws-cdk',
    output: sourceOutput,
    oauthToken: SecretValue.plainText('secret'),
  });

  const pipeline = new codepipeline.Pipeline(stack, 'MyPipeline', {
    stages: [
      {
        stageName: 'Source',
        actions: [sourceAction],
      },
    ],
  });

  const deploymentStage = pipeline.addStage({
    stageName: 'Deploy',
    actions: [
      new cpactions.S3DeployAction({
        accessControl: options.accessControl,
        actionName: 'CopyFiles',
        bucket: options.bucket || new s3.Bucket(stack, 'MyBucket'),
        cacheControl: options.cacheControl,
        extract: options.extract,
        input: sourceOutput,
        objectKey: options.objectKey,
      }),
    ],
  });

  return deploymentStage;
}
