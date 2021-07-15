/* eslint-disable import/no-extraneous-dependencies */
import { arrayWith, objectLike, stringLike } from '@aws-cdk/assert-internal';
import '@aws-cdk/assert-internal/jest';
import { Stack } from '@aws-cdk/core';
import { behavior, LegacyTestGitHubNpmPipeline, OneStackApp, PIPELINE_ENV, TestApp, ModernTestGitHubNpmPipeline } from '../testhelpers';

let app: TestApp;
let pipelineStack: Stack;

beforeEach(() => {
  app = new TestApp();
  pipelineStack = new Stack(app, 'PipelineStack', { env: PIPELINE_ENV });
});

afterEach(() => {
  app.cleanup();
});

behavior('action has right settings for same-env deployment', (suite) => {
  suite.legacy(() => {
    const pipeline = new LegacyTestGitHubNpmPipeline(pipelineStack, 'Cdk');
    pipeline.addApplicationStage(new OneStackApp(app, 'Same'));

    THEN_codePipelineExpection(agnosticRole);
  });

  suite.additional('legacy: even if env is specified but the same as the pipeline', () => {
    const pipeline = new LegacyTestGitHubNpmPipeline(pipelineStack, 'Cdk');
    pipeline.addApplicationStage(new OneStackApp(app, 'Same', {
      env: PIPELINE_ENV,
    }));

    THEN_codePipelineExpection(pipelineEnvRole);
  });

  suite.modern(() => {
    const pipeline = new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk');
    pipeline.addStage(new OneStackApp(app, 'Same'));

    THEN_codePipelineExpection(agnosticRole);
  });

  suite.additional('modern: even if env is specified but the same as the pipeline', () => {
    const pipeline = new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk');
    pipeline.addStage(new OneStackApp(app, 'Same', {
      env: PIPELINE_ENV,
    }));

    THEN_codePipelineExpection(pipelineEnvRole);
  });

  function THEN_codePipelineExpection(roleArn: (x: string) => any) {
    // THEN: pipeline structure is correct
    expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
      Stages: arrayWith({
        Name: 'Same',
        Actions: [
          objectLike({
            Name: stringLike('*Prepare'),
            RoleArn: roleArn('deploy-role'),
            Configuration: objectLike({
              StackName: 'Same-Stack',
              RoleArn: roleArn('cfn-exec-role'),
            }),
          }),
          objectLike({
            Name: stringLike('*Deploy'),
            RoleArn: roleArn('deploy-role'),
            Configuration: objectLike({
              StackName: 'Same-Stack',
            }),
          }),
        ],
      }),
    });

    // THEN: artifact bucket can be read by deploy role
    expect(pipelineStack).toHaveResourceLike('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: arrayWith(objectLike({
          Action: ['s3:GetObject*', 's3:GetBucket*', 's3:List*'],
          Principal: {
            AWS: roleArn('deploy-role'),
          },
        })),
      },
    });
  }
});

behavior('action has right settings for cross-account deployment', (suite) => {
  suite.legacy(() => {
    // WHEN
    const pipeline = new LegacyTestGitHubNpmPipeline(pipelineStack, 'Cdk');
    pipeline.addApplicationStage(new OneStackApp(app, 'CrossAccount', { env: { account: 'you' } }));

    THEN_codePipelineExpectation();
  });

  suite.modern(() => {
    // WHEN
    const pipeline = new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      crossAccountKeys: true,
    });
    pipeline.addStage(new OneStackApp(app, 'CrossAccount', { env: { account: 'you' } }));

    THEN_codePipelineExpectation();
  });

  function THEN_codePipelineExpectation() {
    // THEN: Pipelien structure is correct
    expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
      Stages: arrayWith({
        Name: 'CrossAccount',
        Actions: [
          objectLike({
            Name: stringLike('*Prepare'),
            RoleArn: {
              'Fn::Join': ['', [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':iam::you:role/cdk-hnb659fds-deploy-role-you-',
                { Ref: 'AWS::Region' },
              ]],
            },
            Configuration: objectLike({
              StackName: 'CrossAccount-Stack',
              RoleArn: {
                'Fn::Join': ['', [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':iam::you:role/cdk-hnb659fds-cfn-exec-role-you-',
                  { Ref: 'AWS::Region' },
                ]],
              },
            }),
          }),
          objectLike({
            Name: stringLike('*Deploy'),
            RoleArn: {
              'Fn::Join': ['', [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':iam::you:role/cdk-hnb659fds-deploy-role-you-',
                { Ref: 'AWS::Region' },
              ]],
            },
            Configuration: objectLike({
              StackName: 'CrossAccount-Stack',
            }),
          }),
        ],
      }),
    });

    // THEN: Artifact bucket can be read by deploy role
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
                { Ref: 'AWS::Region' },
              ]],
            },
          },
        })),
      },
    });
  }
});

behavior('action has right settings for cross-region deployment', (suite) => {
  suite.legacy(() => {
    // WHEN
    const pipeline = new LegacyTestGitHubNpmPipeline(pipelineStack, 'Cdk');
    pipeline.addApplicationStage(new OneStackApp(app, 'CrossRegion', { env: { region: 'elsewhere' } }));

    THEN_codePipelineExpectation();
  });

  suite.modern(() => {
    const pipeline = new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      crossAccountKeys: true,
    });
    pipeline.addStage(new OneStackApp(app, 'CrossRegion', { env: { region: 'elsewhere' } }));

    THEN_codePipelineExpectation();
  });

  function THEN_codePipelineExpectation() {
    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
      Stages: arrayWith({
        Name: 'CrossRegion',
        Actions: [
          objectLike({
            Name: stringLike('*Prepare'),
            RoleArn: {
              'Fn::Join': ['', [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':iam::',
                { Ref: 'AWS::AccountId' },
                ':role/cdk-hnb659fds-deploy-role-',
                { Ref: 'AWS::AccountId' },
                '-elsewhere',
              ]],
            },
            Region: 'elsewhere',
            Configuration: objectLike({
              StackName: 'CrossRegion-Stack',
              RoleArn: {
                'Fn::Join': ['', [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':iam::',
                  { Ref: 'AWS::AccountId' },
                  ':role/cdk-hnb659fds-cfn-exec-role-',
                  { Ref: 'AWS::AccountId' },
                  '-elsewhere',
                ]],
              },
            }),
          }),
          objectLike({
            Name: stringLike('*Deploy'),
            RoleArn: {
              'Fn::Join': ['', [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':iam::',
                { Ref: 'AWS::AccountId' },
                ':role/cdk-hnb659fds-deploy-role-',
                { Ref: 'AWS::AccountId' },
                '-elsewhere',
              ]],
            },
            Region: 'elsewhere',
            Configuration: objectLike({
              StackName: 'CrossRegion-Stack',
            }),
          }),
        ],
      }),
    });
  }
});

behavior('action has right settings for cross-account/cross-region deployment', (suite) => {
  suite.legacy(() => {
    // WHEN
    const pipeline = new LegacyTestGitHubNpmPipeline(pipelineStack, 'Cdk');
    pipeline.addApplicationStage(new OneStackApp(app, 'CrossBoth', {
      env: {
        account: 'you',
        region: 'elsewhere',
      },
    }));

    THEN_codePipelineExpectations();
  });

  suite.modern(() => {
    // WHEN
    const pipeline = new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      crossAccountKeys: true,
    });
    pipeline.addStage(new OneStackApp(app, 'CrossBoth', {
      env: {
        account: 'you',
        region: 'elsewhere',
      },
    }));

    THEN_codePipelineExpectations();
  });

  function THEN_codePipelineExpectations() {
    // THEN: pipeline structure must be correct
    expect(app.stackArtifact(pipelineStack)).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
      Stages: arrayWith({
        Name: 'CrossBoth',
        Actions: [
          objectLike({
            Name: stringLike('*Prepare'),
            RoleArn: {
              'Fn::Join': ['', [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':iam::you:role/cdk-hnb659fds-deploy-role-you-elsewhere',
              ]],
            },
            Region: 'elsewhere',
            Configuration: objectLike({
              StackName: 'CrossBoth-Stack',
              RoleArn: {
                'Fn::Join': ['', [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':iam::you:role/cdk-hnb659fds-cfn-exec-role-you-elsewhere',
                ]],
              },
            }),
          }),
          objectLike({
            Name: stringLike('*Deploy'),
            RoleArn: {
              'Fn::Join': ['', [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':iam::you:role/cdk-hnb659fds-deploy-role-you-elsewhere',
              ]],
            },
            Region: 'elsewhere',
            Configuration: objectLike({
              StackName: 'CrossBoth-Stack',
            }),
          }),
        ],
      }),
    });

    // THEN: artifact bucket can be read by deploy role
    const supportStack = 'PipelineStack-support-elsewhere';
    expect(app.stackArtifact(supportStack)).toHaveResourceLike('AWS::S3::BucketPolicy', {
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
    expect(app.stackArtifact(supportStack)).toHaveResourceLike('AWS::KMS::Key', {
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
  }
});


function agnosticRole(roleName: string) {
  return {
    'Fn::Join': ['', [
      'arn:',
      { Ref: 'AWS::Partition' },
      ':iam::',
      { Ref: 'AWS::AccountId' },
      `:role/cdk-hnb659fds-${roleName}-`,
      { Ref: 'AWS::AccountId' },
      '-',
      { Ref: 'AWS::Region' },
    ]],
  };
}

function pipelineEnvRole(roleName: string) {
  return {
    'Fn::Join': ['', [
      'arn:',
      { Ref: 'AWS::Partition' },
      `:iam::${PIPELINE_ENV.account}:role/cdk-hnb659fds-${roleName}-${PIPELINE_ENV.account}-${PIPELINE_ENV.region}`,
    ]],
  };
}