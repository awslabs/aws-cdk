import { arrayWith, objectLike } from '@aws-cdk/assert-internal';
import '@aws-cdk/assert-internal/jest';
import * as cp from '@aws-cdk/aws-codepipeline';
import * as cpa from '@aws-cdk/aws-codepipeline-actions';
import { SecretValue, Stack } from '@aws-cdk/core';
import * as cdkp from '../../lib';
import { CodePipelineFileSet } from '../../lib';
import { behavior, FileAssetApp, LegacyTestGitHubNpmPipeline, ModernTestGitHubNpmPipeline, PIPELINE_ENV, TestApp, TestGitHubAction } from '../testhelpers';

let app: TestApp;
let pipelineStack: Stack;
let sourceArtifact: cp.Artifact;
let cloudAssemblyArtifact: cp.Artifact;
let codePipeline: cp.Pipeline;

beforeEach(() => {
  app = new TestApp();
  pipelineStack = new Stack(app, 'PipelineStack', { env: PIPELINE_ENV });
  sourceArtifact = new cp.Artifact();
  cloudAssemblyArtifact = new cp.Artifact();
});

afterEach(() => {
  app.cleanup();
});

describe('with empty existing CodePipeline', () => {
  beforeEach(() => {
    codePipeline = new cp.Pipeline(pipelineStack, 'CodePipeline');
  });

  behavior('both actions are required', (suite) => {
    suite.legacy(() => {
      // WHEN
      expect(() => {
        new cdkp.CdkPipeline(pipelineStack, 'Cdk', { cloudAssemblyArtifact, codePipeline });
      }).toThrow(/You must pass a 'sourceAction'/);
    });

    // 'synth' is not optional so this doesn't apply
    suite.doesNotApply.modern();
  });

  behavior('can give both actions', (suite) => {
    suite.legacy(() => {
      // WHEN
      new cdkp.CdkPipeline(pipelineStack, 'Cdk', {
        cloudAssemblyArtifact,
        codePipeline,
        sourceAction: new TestGitHubAction(sourceArtifact),
        synthAction: cdkp.SimpleSynthAction.standardNpmSynth({ sourceArtifact, cloudAssemblyArtifact }),
      });

      THEN_codePipelineExpectation();
    });

    suite.modern(() => {
      // WHEN
      new cdkp.CodePipeline(pipelineStack, 'Cdk', {
        codePipeline,
        synth: new cdkp.ShellStep('Synth', {
          input: cdkp.CodePipelineSource.gitHub('test/test', 'main'),
          commands: ['true'],
        }),
      });

      THEN_codePipelineExpectation();
    });

    function THEN_codePipelineExpectation() {
      // THEN
      expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
        Stages: [
          objectLike({ Name: 'Source' }),
          objectLike({ Name: 'Build' }),
          objectLike({ Name: 'UpdatePipeline' }),
        ],
      });
    }
  });
});

describe('with custom Source stage in existing Pipeline', () => {
  beforeEach(() => {
    codePipeline = new cp.Pipeline(pipelineStack, 'CodePipeline', {
      stages: [
        {
          stageName: 'CustomSource',
          actions: [new TestGitHubAction(sourceArtifact)],
        },
      ],
    });
  });

  behavior('Work with synthAction', (suite) => {
    suite.legacy(() => {
      // WHEN
      new cdkp.CdkPipeline(pipelineStack, 'Cdk', {
        codePipeline,
        cloudAssemblyArtifact,
        synthAction: cdkp.SimpleSynthAction.standardNpmSynth({ sourceArtifact, cloudAssemblyArtifact }),
      });

      THEN_codePipelineExpectation();
    });

    suite.modern(() => {
      new cdkp.CodePipeline(pipelineStack, 'Cdk', {
        codePipeline,
        synth: new cdkp.ShellStep('Synth', {
          input: cdkp.CodePipelineFileSet.fromArtifact(sourceArtifact),
          commands: ['true'],
        }),
      });
    });

    function THEN_codePipelineExpectation() {
      // THEN
      expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
        Stages: [
          objectLike({ Name: 'CustomSource' }),
          objectLike({ Name: 'Build' }),
          objectLike({ Name: 'UpdatePipeline' }),
        ],
      });
    }
  });
});

describe('with Source and Build stages in existing Pipeline', () => {
  beforeEach(() => {
    codePipeline = new cp.Pipeline(pipelineStack, 'CodePipeline', {
      stages: [
        {
          stageName: 'CustomSource',
          actions: [new TestGitHubAction(sourceArtifact)],
        },
        {
          stageName: 'CustomBuild',
          actions: [cdkp.SimpleSynthAction.standardNpmSynth({ sourceArtifact, cloudAssemblyArtifact })],
        },
      ],
    });
  });

  behavior('can supply no actions', (suite) => {
    suite.legacy(() => {
      // WHEN
      new cdkp.CdkPipeline(pipelineStack, 'Cdk', {
        codePipeline,
        cloudAssemblyArtifact,
      });

      THEN_codePipelineExpectation();
    });

    suite.modern(() => {
      new cdkp.CodePipeline(pipelineStack, 'Cdk', {
        codePipeline,
        synth: cdkp.CodePipelineFileSet.fromArtifact(cloudAssemblyArtifact),
      });

      THEN_codePipelineExpectation();
    });

    function THEN_codePipelineExpectation() {
      // THEN
      expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
        Stages: [
          objectLike({ Name: 'CustomSource' }),
          objectLike({ Name: 'CustomBuild' }),
          objectLike({ Name: 'UpdatePipeline' }),
        ],
      });
    }
  });
});

behavior('can add another action to an existing stage', (suite) => {
  suite.legacy(() => {
    // WHEN
    const pipeline = new LegacyTestGitHubNpmPipeline(pipelineStack, 'Cdk');
    pipeline.stage('Source').addAction(new cpa.GitHubSourceAction({
      actionName: 'GitHub2',
      oauthToken: SecretValue.plainText('oops'),
      output: new cp.Artifact(),
      owner: 'OWNER',
      repo: 'REPO',
    }));

    THEN_codePipelineExpectation();
  });

  suite.modern(() => {
    const pipeline = new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk');
    pipeline.buildPipeline();

    pipeline.pipeline.stages[0].addAction(new cpa.GitHubSourceAction({
      actionName: 'GitHub2',
      oauthToken: SecretValue.plainText('oops'),
      output: new cp.Artifact(),
      owner: 'OWNER',
      repo: 'REPO',
    }));

    THEN_codePipelineExpectation();
  });

  function THEN_codePipelineExpectation() {
    expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
      Stages: arrayWith({
        Name: 'Source',
        Actions: [
          objectLike({ ActionTypeId: objectLike({ Provider: 'GitHub' }) }),
          objectLike({ ActionTypeId: objectLike({ Provider: 'GitHub' }), Name: 'GitHub2' }),
        ],
      }),
    });
  }
});


behavior('assets stage inserted after existing pipeline actions', (suite) => {
  let existingCodePipeline: cp.Pipeline;
  beforeEach(() => {
    existingCodePipeline = new cp.Pipeline(pipelineStack, 'CodePipeline', {
      stages: [
        {
          stageName: 'CustomSource',
          actions: [new TestGitHubAction(sourceArtifact)],
        },
        {
          stageName: 'CustomBuild',
          actions: [cdkp.SimpleSynthAction.standardNpmSynth({ sourceArtifact, cloudAssemblyArtifact })],
        },
      ],
    });
  });

  suite.legacy(() => {
    const pipeline = new cdkp.CdkPipeline(pipelineStack, 'CdkEmptyPipeline', {
      cloudAssemblyArtifact: cloudAssemblyArtifact,
      selfMutating: false,
      codePipeline: existingCodePipeline,
      // No source/build actions
    });
    pipeline.addApplicationStage(new FileAssetApp(app, 'App'));

    THEN_codePipelineExpectation();
  });

  suite.modern(() => {
    const pipeline = new cdkp.CodePipeline(pipelineStack, 'CdkEmptyPipeline', {
      codePipeline: existingCodePipeline,
      selfMutation: false,
      synth: CodePipelineFileSet.fromArtifact(cloudAssemblyArtifact),
      // No source/build actions
    });
    pipeline.addStage(new FileAssetApp(app, 'App'));

    THEN_codePipelineExpectation();
  });

  function THEN_codePipelineExpectation() {
    expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
      Stages: [
        objectLike({ Name: 'CustomSource' }),
        objectLike({ Name: 'CustomBuild' }),
        objectLike({ Name: 'Assets' }),
        objectLike({ Name: 'App' }),
      ],
    });
  }
});