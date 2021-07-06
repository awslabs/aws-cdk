import { arrayWith, objectLike, stringLike } from '@aws-cdk/assert-internal';
import '@aws-cdk/assert-internal/jest';
import { Stack, Stage, StageProps } from '@aws-cdk/core';
import { Construct } from 'constructs';
import * as cdkp from '../lib';
import { behavior } from './helpers/compliance';
import { BucketStack, PIPELINE_ENV, TestApp, TestGitHubNpmPipeline } from './testutil';

let app: TestApp;
let pipelineStack: Stack;
let pipeline: cdkp.CdkPipeline;

beforeEach(() => {
  app = new TestApp();
  pipelineStack = new Stack(app, 'PipelineStack', { env: PIPELINE_ENV });
  pipeline = new TestGitHubNpmPipeline(pipelineStack, 'Cdk');
});

afterEach(() => {
  app.cleanup();
});

behavior('in a cross-account/cross-region setup, artifact bucket can be read by deploy role', (suite) => {
  suite.legacy(() => {
    // WHEN
    pipeline.addApplicationStage(new TestApplication(app, 'MyApp', {
      env: { account: '321elsewhere', region: 'us-elsewhere' },
    }));

    // THEN
    app.synth();
    const supportStack = app.node.findAll().filter(Stack.isStack).find(s => s.stackName === 'PipelineStack-support-us-elsewhere');
    expect(supportStack).not.toBeUndefined();

    expect(supportStack).toHaveResourceLike('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: arrayWith(objectLike({
          Action: arrayWith('s3:GetObject*', 's3:GetBucket*', 's3:List*'),
          Principal: {
            AWS: {
              'Fn::Join': ['', [
                'arn:',
                { Ref: 'AWS::Partition' },
                stringLike('*-deploy-role-*'),
              ]],
            },
          },
        })),
      },
    });

    // And the key to go along with it
    expect(supportStack).toHaveResourceLike('AWS::KMS::Key', {
      KeyPolicy: {
        Statement: arrayWith(objectLike({
          Action: arrayWith('kms:Decrypt', 'kms:DescribeKey'),
          Principal: {
            AWS: {
              'Fn::Join': ['', [
                'arn:',
                { Ref: 'AWS::Partition' },
                stringLike('*-deploy-role-*'),
              ]],
            },
          },
        })),
      },
    });
  });
});

behavior('in a cross-account/same-region setup, artifact bucket can be read by deploy role', (suite) => {
  suite.legacy(() => {
    // WHEN
    pipeline.addApplicationStage(new TestApplication(app, 'MyApp', {
      env: { account: '321elsewhere', region: PIPELINE_ENV.region },
    }));

    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: arrayWith(objectLike({
          Action: ['s3:GetObject*', 's3:GetBucket*', 's3:List*'],
          Principal: {
            AWS: {
              'Fn::Join': ['', [
                'arn:',
                { Ref: 'AWS::Partition' },
                stringLike('*-deploy-role-*'),
              ]],
            },
          },
        })),
      },
    });
  });
});

behavior('in an unspecified-account setup, artifact bucket can be read by deploy role', (suite) => {
  suite.legacy(() => {
    // WHEN
    pipeline.addApplicationStage(new TestApplication(app, 'MyApp', {}));

    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: arrayWith(objectLike({
          Action: ['s3:GetObject*', 's3:GetBucket*', 's3:List*'],
          Principal: {
            AWS: {
              'Fn::Join': ['', arrayWith(
                'arn:',
                { Ref: 'AWS::Partition' },
                ':iam::',
                { Ref: 'AWS::AccountId' },
                stringLike('*-deploy-role-*'),
              )],
            },
          },
        })),
      },
    });
  });
});

behavior('in a same-account setup, artifact bucket can be read by deploy role', (suite) => {
  suite.legacy(() => {
    // WHEN
    pipeline.addApplicationStage(new TestApplication(app, 'MyApp', {
      env: PIPELINE_ENV,
    }));

    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: arrayWith(objectLike({
          Action: ['s3:GetObject*', 's3:GetBucket*', 's3:List*'],
          Principal: {
            AWS: {
              'Fn::Join': ['', [
                'arn:',
                { Ref: 'AWS::Partition' },
                stringLike('*-deploy-role-*'),
              ]],
            },
          },
        })),
      },
    });
  });
});

/**
 * Our application
 */
class TestApplication extends Stage {
  constructor(scope: Construct, id: string, props: StageProps) {
    super(scope, id, props);
    new BucketStack(this, 'Stack');
  }
}
