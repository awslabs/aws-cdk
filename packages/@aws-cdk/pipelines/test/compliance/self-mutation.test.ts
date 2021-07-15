/* eslint-disable import/no-extraneous-dependencies */
import { anything, arrayWith, deepObjectLike, encodedJson, notMatching, objectLike } from '@aws-cdk/assert-internal';
import '@aws-cdk/assert-internal/jest';
import * as cp from '@aws-cdk/aws-codepipeline';
import { Stack, Stage } from '@aws-cdk/core';
import { behavior, LegacyTestGitHubNpmPipeline, PIPELINE_ENV, stackTemplate, TestApp, ModernTestGitHubNpmPipeline } from '../testhelpers';

let app: TestApp;
let pipelineStack: Stack;

beforeEach(() => {
  app = new TestApp();
  pipelineStack = new Stack(app, 'PipelineStack', { env: PIPELINE_ENV });
});

afterEach(() => {
  app.cleanup();
});

behavior('CodePipeline has self-mutation stage', (suite) => {
  suite.legacy(() => {
    new LegacyTestGitHubNpmPipeline(pipelineStack, 'Cdk');
    THEN_codePipelineExpectation();
  });

  suite.modern(() => {
    new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk');
    THEN_codePipelineExpectation();
  });

  function THEN_codePipelineExpectation() {
    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
      Stages: arrayWith({
        Name: 'UpdatePipeline',
        Actions: [
          objectLike({
            Name: 'SelfMutate',
            Configuration: objectLike({
              ProjectName: { Ref: anything() },
            }),
          }),
        ],
      }),
    });

    expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
      Environment: {
        Image: 'aws/codebuild/standard:5.0',
      },
      Source: {
        BuildSpec: encodedJson(deepObjectLike({
          phases: {
            install: {
              commands: ['npm install -g aws-cdk'],
            },
            build: {
              commands: arrayWith('cdk -a . deploy PipelineStack --require-approval=never --verbose'),
            },
          },
        })),
        Type: 'CODEPIPELINE',
      },
    });
  }
});

behavior('selfmutation stage correctly identifies nested assembly of pipeline stack', (suite) => {
  suite.legacy(() => {
    const pipelineStage = new Stage(app, 'PipelineStage');
    const nestedPipelineStack = new Stack(pipelineStage, 'PipelineStack', { env: PIPELINE_ENV });
    new LegacyTestGitHubNpmPipeline(nestedPipelineStack, 'Cdk');

    THEN_codePipelineExpectation(nestedPipelineStack);
  });

  suite.modern(() => {
    const pipelineStage = new Stage(app, 'PipelineStage');
    const nestedPipelineStack = new Stack(pipelineStage, 'PipelineStack', { env: PIPELINE_ENV });
    new ModernTestGitHubNpmPipeline(nestedPipelineStack, 'Cdk');

    THEN_codePipelineExpectation(nestedPipelineStack);
  });

  function THEN_codePipelineExpectation(nestedPipelineStack: Stack) {
    expect(stackTemplate(nestedPipelineStack)).toHaveResourceLike('AWS::CodeBuild::Project', {
      Environment: {
        Image: 'aws/codebuild/standard:5.0',
      },
      Source: {
        BuildSpec: encodedJson(deepObjectLike({
          phases: {
            build: {
              commands: arrayWith('cdk -a assembly-PipelineStage deploy PipelineStage/PipelineStack --require-approval=never --verbose'),
            },
          },
        })),
      },
    });
  }
});

behavior('selfmutation feature can be turned off', (suite) => {
  suite.legacy(() => {
    const cloudAssemblyArtifact = new cp.Artifact();
    // WHEN
    new LegacyTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      cloudAssemblyArtifact,
      selfMutating: false,
    });

    THEN_codePipelineExpectation();
  });

  suite.modern(() => {
    // WHEN
    new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      selfMutation: false,
    });

    THEN_codePipelineExpectation();
  });

  function THEN_codePipelineExpectation() {
    expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
      Stages: notMatching(arrayWith({
        Name: 'UpdatePipeline',
        Actions: anything(),
      })),
    });
  }
});

behavior('can control fix/CLI version used in pipeline selfupdate', (suite) => {
  suite.legacy(() => {
    // WHEN
    new LegacyTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      pipelineName: 'vpipe',
      cdkCliVersion: '1.2.3',
    });

    THEN_codePipelineExpectation();
  });

  suite.modern(() => {
    new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      pipelineName: 'vpipe',
      cliVersion: '1.2.3',
    });

    THEN_codePipelineExpectation();
  });

  function THEN_codePipelineExpectation() {
    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
      Name: 'vpipe-selfupdate',
      Source: {
        BuildSpec: encodedJson(deepObjectLike({
          phases: {
            install: {
              commands: ['npm install -g aws-cdk@1.2.3'],
            },
          },
        })),
      },
    });
  }
});

behavior('Pipeline stack itself can use assets (has implications for selfupdate)', (suite) => {
  suite.legacy(() => {
    // WHEN
    new LegacyTestGitHubNpmPipeline(pipelineStack, 'PrivilegedPipeline', {
      supportDockerAssets: true,
    });

    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
      Environment: {
        PrivilegedMode: true,
      },
    });
  });

  suite.modern(() => {
    // WHEN
    new ModernTestGitHubNpmPipeline(pipelineStack, 'PrivilegedPipeline', {
      dockerEnabledForSelfMutation: true,
    });

    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
      Environment: {
        PrivilegedMode: true,
      },
    });
  });
});

behavior('self-update project role uses tagged bootstrap-role permissions', (suite) => {
  suite.legacy(() => {
    new LegacyTestGitHubNpmPipeline(pipelineStack, 'Cdk');

    THEN_codePipelineExpectations();
  });

  suite.modern(() => {
    new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk');
    THEN_codePipelineExpectations();
  });

  function THEN_codePipelineExpectations() {
    expect(pipelineStack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: arrayWith(
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Resource: 'arn:*:iam::123pipeline:role/*',
            Condition: {
              'ForAnyValue:StringEquals': {
                'iam:ResourceTag/aws-cdk:bootstrap-role': ['image-publishing', 'file-publishing', 'deploy'],
              },
            },
          },
          {
            Action: 'cloudformation:DescribeStacks',
            Effect: 'Allow',
            Resource: '*',
          },
          {
            Action: 's3:ListBucket',
            Effect: 'Allow',
            Resource: '*',
          },
        ),
      },
    });
  }
});