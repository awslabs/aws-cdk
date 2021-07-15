import { arrayWith, deepObjectLike, encodedJson, objectLike, Capture, anything } from '@aws-cdk/assert-internal';
import '@aws-cdk/assert-internal/jest';
import * as cbuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecr from '@aws-cdk/aws-ecr';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import { Stack } from '@aws-cdk/core';
import * as cdkp from '../../lib';
import { CodeBuildStep } from '../../lib';
import { behavior, PIPELINE_ENV, TestApp, LegacyTestGitHubNpmPipeline, ModernTestGitHubNpmPipeline, ModernTestGitHubNpmPipelineProps } from '../testhelpers';

let app: TestApp;
let pipelineStack: Stack;
let sourceArtifact: codepipeline.Artifact;
let cloudAssemblyArtifact: codepipeline.Artifact;

// Must be unique across all test files, but preferably also consistent
const OUTDIR = 'testcdk0.out';

// What phase install commands get rendered to
const LEGACY_INSTALLS = 'pre_build';
const MODERN_INSTALLS = 'install';

beforeEach(() => {
  app = new TestApp({ outdir: OUTDIR });
  pipelineStack = new Stack(app, 'PipelineStack', { env: PIPELINE_ENV });
  sourceArtifact = new codepipeline.Artifact();
  cloudAssemblyArtifact = new codepipeline.Artifact('CloudAsm');
});

afterEach(() => {
  app.cleanup();
});

behavior('synth takes arrays of commands', (suite) => {
  suite.legacy(() => {
    // WHEN
    new LegacyTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      sourceArtifact,
      cloudAssemblyArtifact,
      synthAction: new cdkp.SimpleSynthAction({
        sourceArtifact,
        cloudAssemblyArtifact,
        installCommands: ['install1', 'install2'],
        buildCommands: ['build1', 'build2'],
        testCommands: ['test1', 'test2'],
        synthCommand: 'cdk synth',
      }),
    });

    THEN_codePipelineExpectation(LEGACY_INSTALLS);
  });

  suite.modern(() => {
    new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      installCommands: ['install1', 'install2'],
      commands: ['build1', 'build2', 'test1', 'test2', 'cdk synth'],
    });

    THEN_codePipelineExpectation(MODERN_INSTALLS);
  });

  function THEN_codePipelineExpectation(installPhase: string) {
    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
      Environment: {
        Image: 'aws/codebuild/standard:5.0',
      },
      Source: {
        BuildSpec: encodedJson(deepObjectLike({
          phases: {
            [installPhase]: {
              commands: [
                'install1',
                'install2',
              ],
            },
            build: {
              commands: [
                'build1',
                'build2',
                'test1',
                'test2',
                'cdk synth',
              ],
            },
          },
        })),
      },
    });
  }
});

behavior('synth sets artifact base-directory to cdk.out', (suite) => {
  suite.legacy(() => {
    // WHEN
    new LegacyTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      sourceArtifact,
      cloudAssemblyArtifact,
      synthAction: cdkp.SimpleSynthAction.standardNpmSynth({ sourceArtifact, cloudAssemblyArtifact }),
    });
    THEN_codePipelineExpectation();
  });

  suite.modern(() => {
    new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk');

    THEN_codePipelineExpectation();
  });

  function THEN_codePipelineExpectation() {
    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
      Environment: {
        Image: 'aws/codebuild/standard:5.0',
      },
      Source: {
        BuildSpec: encodedJson(deepObjectLike({
          artifacts: {
            'base-directory': 'cdk.out',
          },
        })),
      },
    });
  }
});

behavior('synth supports setting subdirectory', (suite) => {
  suite.legacy(() => {
    // WHEN
    new LegacyTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      sourceArtifact,
      cloudAssemblyArtifact,
      synthAction: cdkp.SimpleSynthAction.standardNpmSynth({
        sourceArtifact,
        cloudAssemblyArtifact,
        subdirectory: 'subdir',
      }),
    });

    THEN_codePipelineExpectation(LEGACY_INSTALLS);
  });

  suite.modern(() => {
    new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      installCommands: ['cd subdir'],
      commands: ['true'],
      primaryOutputDirectory: 'subdir/cdk.out',
    });
    THEN_codePipelineExpectation(MODERN_INSTALLS);
  });

  function THEN_codePipelineExpectation(installPhase: string) {
    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
      Environment: {
        Image: 'aws/codebuild/standard:5.0',
      },
      Source: {
        BuildSpec: encodedJson(deepObjectLike({
          phases: {
            [installPhase]: {
              commands: arrayWith('cd subdir'),
            },
          },
          artifacts: {
            'base-directory': 'subdir/cdk.out',
          },
        })),
      },
    });
  }
});

behavior('npm synth sets, or allows setting, UNSAFE_PERM=true', (suite) => {
  suite.legacy(() => {
    // WHEN
    new LegacyTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      sourceArtifact,
      cloudAssemblyArtifact,
      synthAction: cdkp.SimpleSynthAction.standardNpmSynth({
        sourceArtifact,
        cloudAssemblyArtifact,
      }),
    });

    THEN_codePipelineExpectation();
  });

  suite.modern(() => {
    new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      env: {
        NPM_CONFIG_UNSAFE_PERM: 'true',
      },
    });
  });

  function THEN_codePipelineExpectation() {
    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
      Environment: {
        EnvironmentVariables: [
          {
            Name: 'NPM_CONFIG_UNSAFE_PERM',
            Type: 'PLAINTEXT',
            Value: 'true',
          },
        ],
      },
    });
  }
});

behavior('synth assumes a JavaScript project by default (no build, yes synth)', (suite) => {
  suite.legacy(() => {
    // WHEN
    new LegacyTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      sourceArtifact,
      cloudAssemblyArtifact,
      synthAction: cdkp.SimpleSynthAction.standardNpmSynth({ sourceArtifact, cloudAssemblyArtifact }),
    });

    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
      Environment: {
        Image: 'aws/codebuild/standard:5.0',
      },
      Source: {
        BuildSpec: encodedJson(deepObjectLike({
          phases: {
            pre_build: {
              commands: ['npm ci'],
            },
            build: {
              commands: ['npx cdk synth'],
            },
          },
        })),
      },
    });
  });

  // Modern pipeline does not assume anything anymore
  suite.doesNotApply.modern();
});

behavior('Magic CodePipeline variables passed to synth envvars must be rendered in the action', (suite) => {
  suite.legacy(() => {
    // WHEN
    new LegacyTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      sourceArtifact,
      cloudAssemblyArtifact,
      synthAction: new cdkp.SimpleSynthAction({
        sourceArtifact,
        cloudAssemblyArtifact,
        environmentVariables: {
          VERSION: { value: codepipeline.GlobalVariables.executionId },
        },
        synthCommand: 'synth',
      }),
    });
    THEN_codePipelineExpectation();
  });

  suite.modern(() => {
    new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      env: {
        VERSION: codepipeline.GlobalVariables.executionId,
      },
    });

    THEN_codePipelineExpectation();
  });

  function THEN_codePipelineExpectation() {
    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
      Stages: arrayWith({
        Name: 'Build',
        Actions: [
          objectLike({
            Name: 'Synth',
            Configuration: objectLike({
              EnvironmentVariables: encodedJson(arrayWith(
                {
                  name: 'VERSION',
                  type: 'PLAINTEXT',
                  value: '#{codepipeline.PipelineExecutionId}',
                },
              )),
            }),
          }),
        ],
      }),
    });
  }
});

behavior('CodeBuild: environment variables specified in multiple places are correctly merged', (suite) => {
  // We don't support merging environment variables in this way in the legacy API
  suite.doesNotApply.legacy();

  suite.modern(() => {
    new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      synth: new CodeBuildStep('Synth', {
        env: {
          SOME_ENV_VAR: 'SomeValue',
        },
        installCommands: [
          'install1',
          'install2',
        ],
        commands: ['synth'],
        input: cdkp.CodePipelineSource.gitHub('test/test', 'main'),
        primaryOutputDirectory: 'cdk.out',
        buildEnvironment: {
          environmentVariables: {
            INNER_VAR: { value: 'InnerValue' },
          },
          privileged: true,
        },
      }),
    });
    THEN_codePipelineExpectation(MODERN_INSTALLS);
  });

  suite.additional('modern2, using the specific CodeBuild action', () => {
    new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      synth: new cdkp.CodeBuildStep('Synth', {
        input: cdkp.CodePipelineSource.gitHub('test/test', 'main'),
        primaryOutputDirectory: '.',
        env: {
          SOME_ENV_VAR: 'SomeValue',
        },
        installCommands: [
          'install1',
          'install2',
        ],
        commands: ['synth'],
        buildEnvironment: {
          environmentVariables: {
            INNER_VAR: { value: 'InnerValue' },
          },
          privileged: true,
        },
      }),
    });
    THEN_codePipelineExpectation(MODERN_INSTALLS);
  });

  function THEN_codePipelineExpectation(installPhase: string) {
    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
      Environment: objectLike({
        PrivilegedMode: true,
        EnvironmentVariables: arrayWith(
          {
            Name: 'SOME_ENV_VAR',
            Type: 'PLAINTEXT',
            Value: 'SomeValue',
          },
          {
            Name: 'INNER_VAR',
            Type: 'PLAINTEXT',
            Value: 'InnerValue',
          },
        ),
      }),
      Source: {
        BuildSpec: encodedJson(deepObjectLike({
          phases: {
            [installPhase]: {
              commands: ['install1', 'install2'],
            },
            build: {
              commands: ['synth'],
            },
          },
        })),
      },
    });
  }
});

behavior('install command can be overridden/specified', (suite) => {
  suite.legacy(() => {
    // WHEN
    new LegacyTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      sourceArtifact,
      cloudAssemblyArtifact,
      synthAction: cdkp.SimpleSynthAction.standardNpmSynth({
        sourceArtifact,
        cloudAssemblyArtifact,
        installCommand: '/bin/true',
      }),
    });

    THEN_codePipelineExpectation(LEGACY_INSTALLS);
  });

  suite.modern(() => {
    // WHEN
    new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      installCommands: ['/bin/true'],
    });

    THEN_codePipelineExpectation(MODERN_INSTALLS);
  });

  function THEN_codePipelineExpectation(installPhase: string) {
    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
      Environment: {
        Image: 'aws/codebuild/standard:5.0',
      },
      Source: {
        BuildSpec: encodedJson(deepObjectLike({
          phases: {
            [installPhase]: {
              commands: ['/bin/true'],
            },
          },
        })),
      },
    });
  }
});

behavior('synth can have its test commands set', (suite) => {
  suite.legacy(() => {
    // WHEN
    new LegacyTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      sourceArtifact,
      cloudAssemblyArtifact,
      synthAction: cdkp.SimpleSynthAction.standardNpmSynth({
        sourceArtifact,
        cloudAssemblyArtifact,
        installCommand: '/bin/true',
        testCommands: ['echo "Running tests"'],
      }),
    });

    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
      Environment: {
        Image: 'aws/codebuild/standard:5.0',
      },
      Source: {
        BuildSpec: encodedJson(objectLike({
          phases: {
            pre_build: {
              commands: ['/bin/true'],
            },
            build: {
              commands: ['echo "Running tests"', 'npx cdk synth'],
            },
          },
        })),
      },
    });
  });

  // There are no implicit commands in modern synth
  suite.doesNotApply.modern();
});

behavior('Synth can output additional artifacts', (suite) => {
  suite.legacy(() => {
    // WHEN
    const addlArtifact = new codepipeline.Artifact('IntegTest');
    new LegacyTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      sourceArtifact,
      cloudAssemblyArtifact,
      synthAction: cdkp.SimpleSynthAction.standardNpmSynth({
        sourceArtifact,
        cloudAssemblyArtifact,
        additionalArtifacts: [
          {
            artifact: addlArtifact,
            directory: 'test',
          },
        ],
      }),
    });

    THEN_codePipelineExpectation('CloudAsm', 'IntegTest');
  });

  suite.modern(() => {
    // WHEN
    const synth = new cdkp.ShellStep('Synth', {
      input: cdkp.CodePipelineSource.gitHub('test/test', 'main'),
      commands: ['cdk synth'],
    });
    synth.addOutputDirectory('test');
    new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      synth: synth,
    });

    THEN_codePipelineExpectation('Synth_Output', 'Synth_test');
  });

  function THEN_codePipelineExpectation(asmArtifact: string, testArtifact: string) {
    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
      Environment: {
        Image: 'aws/codebuild/standard:5.0',
      },
      Source: {
        BuildSpec: encodedJson(deepObjectLike({
          artifacts: {
            'secondary-artifacts': {
              [asmArtifact]: {
                'base-directory': 'cdk.out',
                'files': '**/*',
              },
              [testArtifact]: {
                'base-directory': 'test',
                'files': '**/*',
              },
            },
          },
        })),
      },
    });
  }
});

behavior('Synth can be made to run in a VPC', (suite) => {
  let vpc: ec2.Vpc;
  beforeEach(() => {
    vpc = new ec2.Vpc(pipelineStack, 'NpmSynthTestVpc');
  });

  suite.legacy(() => {
    // WHEN
    new LegacyTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      sourceArtifact,
      cloudAssemblyArtifact,
      synthAction: cdkp.SimpleSynthAction.standardNpmSynth({
        vpc,
        sourceArtifact,
        cloudAssemblyArtifact,
      }),
    });

    THEN_codePipelineExpectation();
  });

  suite.modern(() => {
    new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      codeBuildDefaults: { vpc },
    });
  });

  suite.additional('Modern, using CodeBuildStep', () => {
    new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      synth: new CodeBuildStep('Synth', {
        commands: ['asdf'],
        input: cdkp.CodePipelineSource.gitHub('test/test', 'main'),
        primaryOutputDirectory: 'cdk.out',
        buildEnvironment: {
          computeType: cbuild.ComputeType.LARGE,
        },
      }),
      codeBuildDefaults: { vpc },
    });
  });

  function THEN_codePipelineExpectation() {
    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
      VpcConfig: {
        SecurityGroupIds: [
          { 'Fn::GetAtt': ['CdkPipelineBuildSynthCdkBuildProjectSecurityGroupEA44D7C2', 'GroupId'] },
        ],
        Subnets: [
          { Ref: 'NpmSynthTestVpcPrivateSubnet1Subnet81E3AA56' },
          { Ref: 'NpmSynthTestVpcPrivateSubnet2SubnetC1CA3EF0' },
          { Ref: 'NpmSynthTestVpcPrivateSubnet3SubnetA04163EE' },
        ],
        VpcId: { Ref: 'NpmSynthTestVpc5E703F25' },
      },
    });

    expect(pipelineStack).toHaveResourceLike('AWS::IAM::Policy', {
      Roles: [
        { Ref: 'CdkPipelineBuildSynthCdkBuildProjectRole5E173C62' },
      ],
      PolicyDocument: {
        Statement: arrayWith({
          Action: arrayWith('ec2:DescribeSecurityGroups'),
          Effect: 'Allow',
          Resource: '*',
        }),
      },
    });
  }
});

behavior('Pipeline action contains a hash that changes as the buildspec changes', (suite) => {
  suite.legacy(() => {
    const hash1 = legacySynthWithAction((sa, cxa) => cdkp.SimpleSynthAction.standardNpmSynth({
      sourceArtifact: sa,
      cloudAssemblyArtifact: cxa,
    }));

    // To make sure the hash is not just random :)
    const hash1prime = legacySynthWithAction((sa, cxa) => cdkp.SimpleSynthAction.standardNpmSynth({
      sourceArtifact: sa,
      cloudAssemblyArtifact: cxa,
    }));

    const hash2 = legacySynthWithAction((sa, cxa) => cdkp.SimpleSynthAction.standardNpmSynth({
      sourceArtifact: sa,
      cloudAssemblyArtifact: cxa,
      installCommand: 'do install',
    }));
    const hash3 = legacySynthWithAction((sa, cxa) => cdkp.SimpleSynthAction.standardNpmSynth({
      sourceArtifact: sa,
      cloudAssemblyArtifact: cxa,
      environment: {
        computeType: cbuild.ComputeType.LARGE,
      },
    }));
    const hash4 = legacySynthWithAction((sa, cxa) => cdkp.SimpleSynthAction.standardNpmSynth({
      sourceArtifact: sa,
      cloudAssemblyArtifact: cxa,
      environment: {
        environmentVariables: {
          xyz: { value: 'SOME-VALUE' },
        },
      },
    }));

    expect(hash1).toEqual(hash1prime);

    expect(hash1).not.toEqual(hash2);
    expect(hash1).not.toEqual(hash3);
    expect(hash1).not.toEqual(hash4);
    expect(hash2).not.toEqual(hash3);
    expect(hash2).not.toEqual(hash4);
    expect(hash3).not.toEqual(hash4);
  });

  suite.modern(() => {
    const hash1 = modernSynthWithAction(() => ({ commands: ['asdf'] }));

    // To make sure the hash is not just random :)
    const hash1prime = modernSynthWithAction(() => ({ commands: ['asdf'] }));

    const hash2 = modernSynthWithAction(() => ({
      installCommands: ['do install'],
    }));
    const hash3 = modernSynthWithAction(() => ({
      synth: new CodeBuildStep('Synth', {
        commands: ['asdf'],
        input: cdkp.CodePipelineSource.gitHub('test/test', 'main'),
        primaryOutputDirectory: 'cdk.out',
        buildEnvironment: {
          computeType: cbuild.ComputeType.LARGE,
        },
      }),
    }));

    const hash4 = modernSynthWithAction(() => ({
      env: {
        xyz: 'SOME-VALUE',
      },
    }));

    expect(hash1).toEqual(hash1prime);

    expect(hash1).not.toEqual(hash2);
    expect(hash1).not.toEqual(hash3);
    expect(hash1).not.toEqual(hash4);
    expect(hash2).not.toEqual(hash3);
    expect(hash2).not.toEqual(hash4);
    expect(hash3).not.toEqual(hash4);
  });

  // eslint-disable-next-line max-len
  function legacySynthWithAction(cb: (sourceArtifact: codepipeline.Artifact, cloudAssemblyArtifact: codepipeline.Artifact) => codepipeline.IAction) {
    const _app = new TestApp({ outdir: OUTDIR });
    const _pipelineStack = new Stack(_app, 'PipelineStack', { env: PIPELINE_ENV });
    const _sourceArtifact = new codepipeline.Artifact();
    const _cloudAssemblyArtifact = new codepipeline.Artifact('CloudAsm');

    new LegacyTestGitHubNpmPipeline(_pipelineStack, 'Cdk', {
      sourceArtifact: _sourceArtifact,
      cloudAssemblyArtifact: _cloudAssemblyArtifact,
      synthAction: cb(_sourceArtifact, _cloudAssemblyArtifact),
    });

    return captureProjectConfigHash(_pipelineStack);
  }

  function modernSynthWithAction(cb: () => ModernTestGitHubNpmPipelineProps) {
    const _app = new TestApp({ outdir: OUTDIR });
    const _pipelineStack = new Stack(_app, 'PipelineStack', { env: PIPELINE_ENV });

    new ModernTestGitHubNpmPipeline(_pipelineStack, 'Cdk', cb());

    return captureProjectConfigHash(_pipelineStack);
  }

  function captureProjectConfigHash(_pipelineStack: Stack) {
    const theHash = Capture.aString();
    expect(_pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
      Stages: arrayWith({
        Name: 'Build',
        Actions: [
          objectLike({
            Name: 'Synth',
            Configuration: objectLike({
              EnvironmentVariables: encodedJson([
                {
                  name: '_PROJECT_CONFIG_HASH',
                  type: 'PLAINTEXT',
                  value: theHash.capture(),
                },
              ]),
            }),
          }),
        ],
      }),
    });

    return theHash.capturedValue;
  }
});

behavior('Synth CodeBuild project role can be granted permissions', (suite) => {
  let bucket: s3.IBucket;
  beforeEach(() => {
    bucket = s3.Bucket.fromBucketArn(pipelineStack, 'Bucket', 'arn:aws:s3:::ThisParticularBucket');
  });


  suite.legacy(() => {
    // GIVEN
    const synthAction = cdkp.SimpleSynthAction.standardNpmSynth({
      sourceArtifact,
      cloudAssemblyArtifact,
    });
    new LegacyTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      sourceArtifact,
      cloudAssemblyArtifact,
      synthAction,
    });

    // WHEN
    bucket.grantRead(synthAction);

    THEN_codePipelineExpectation();
  });

  suite.modern(() => {
    // GIVEN
    const pipe = new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk');
    pipe.buildPipeline();

    // WHEN
    bucket.grantRead(pipe.synthProject);

    THEN_codePipelineExpectation();
  });

  function THEN_codePipelineExpectation() {
    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: arrayWith(deepObjectLike({
          Action: ['s3:GetObject*', 's3:GetBucket*', 's3:List*'],
          Resource: ['arn:aws:s3:::ThisParticularBucket', 'arn:aws:s3:::ThisParticularBucket/*'],
        })),
      },
    });
  }
});

behavior('Synth can reference an imported ECR repo', (suite) => {
  // Repro from https://github.com/aws/aws-cdk/issues/10535

  suite.legacy(() => {
    // WHEN
    new LegacyTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      sourceArtifact,
      cloudAssemblyArtifact,
      synthAction: cdkp.SimpleSynthAction.standardNpmSynth({
        sourceArtifact,
        cloudAssemblyArtifact,
        environment: {
          buildImage: cbuild.LinuxBuildImage.fromEcrRepository(
            ecr.Repository.fromRepositoryName(pipelineStack, 'ECRImage', 'my-repo-name'),
          ),
        },
      }),
    });

    // THEN -- no exception (necessary for linter)
    expect(true).toBeTruthy();
  });

  suite.modern(() => {
    new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      synth: new cdkp.CodeBuildStep('Synth', {
        commands: ['build'],
        input: cdkp.CodePipelineSource.gitHub('test/test', 'main'),
        primaryOutputDirectory: 'cdk.out',
        buildEnvironment: {
          buildImage: cbuild.LinuxBuildImage.fromEcrRepository(
            ecr.Repository.fromRepositoryName(pipelineStack, 'ECRImage', 'my-repo-name'),
          ),
        },
      }),
    });

    // THEN -- no exception (necessary for linter)
    expect(true).toBeTruthy();
  });
});

behavior('CodeBuild: Can specify additional policy statements', (suite) => {
  suite.legacy(() => {
    // WHEN
    new LegacyTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      sourceArtifact,
      cloudAssemblyArtifact,
      synthAction: cdkp.SimpleSynthAction.standardNpmSynth({
        sourceArtifact,
        cloudAssemblyArtifact,
        rolePolicyStatements: [
          new iam.PolicyStatement({
            actions: ['codeartifact:*', 'sts:GetServiceBearerToken'],
            resources: ['arn:my:arn'],
          }),
        ],
      }),
    });

    THEN_codePipelineExpectation();
  });

  suite.modern(() => {
    // WHEN
    new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      synth: new cdkp.CodeBuildStep('Synth', {
        input: cdkp.CodePipelineSource.gitHub('test/test', 'main'),
        primaryOutputDirectory: '.',
        commands: ['synth'],
        rolePolicyStatements: [
          new iam.PolicyStatement({
            actions: ['codeartifact:*', 'sts:GetServiceBearerToken'],
            resources: ['arn:my:arn'],
          }),
        ],
      }),
    });

    THEN_codePipelineExpectation();
  });

  function THEN_codePipelineExpectation() {
    expect(pipelineStack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: arrayWith(deepObjectLike({
          Action: [
            'codeartifact:*',
            'sts:GetServiceBearerToken',
          ],
          Resource: 'arn:my:arn',
        })),
      },
    });
  }
});

behavior('Multiple input sources in side-by-side directories', (suite) => {
  // Legacy API does not support this
  suite.doesNotApply.legacy();

  suite.modern(() => {
    // WHEN
    new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      synth: new cdkp.ShellStep('Synth', {
        input: cdkp.CodePipelineSource.gitHub('test/test', 'main'),
        commands: ['false'],
        additionalInputs: {
          '../sibling': cdkp.CodePipelineSource.gitHub('foo/bar', 'main'),
          'sub': new cdkp.ShellStep('Prebuild', {
            input: cdkp.CodePipelineSource.gitHub('pre/build', 'main'),
            commands: ['true'],
            primaryOutputDirectory: 'built',
          }),
        },
      }),
    });

    expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
      Stages: arrayWith(
        {
          Name: 'Source',
          Actions: [
            objectLike({ Configuration: objectLike({ Repo: 'bar' }) }),
            objectLike({ Configuration: objectLike({ Repo: 'build' }) }),
            objectLike({ Configuration: objectLike({ Repo: 'test' }) }),
          ],
        },
        {
          Name: 'Build',
          Actions: [
            objectLike({ Name: 'Prebuild', RunOrder: 1 }),
            objectLike({
              Name: 'Synth',
              RunOrder: 2,
              InputArtifacts: [
                // 3 input artifacts
                anything(),
                anything(),
                anything(),
              ],
            }),
          ],
        },
      ),
    });

    expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
      Source: {
        BuildSpec: encodedJson(deepObjectLike({
          phases: {
            install: {
              commands: [
                'ln -s "$CODEBUILD_SRC_DIR_foo_bar_Source" "../sibling"',
                'ln -s "$CODEBUILD_SRC_DIR_Prebuild_Output" "sub"',
              ],
            },
            build: {
              commands: [
                'false',
              ],
            },
          },
        })),
      },
    });
  });
});

behavior('Can easily switch on privileged mode for synth', (suite) => {
  // Legacy API does not support this
  suite.doesNotApply.legacy();

  suite.modern(() => {
    // WHEN
    new ModernTestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      dockerEnabledForSynth: true,
      commands: ['LookAtMe'],
    });

    expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
      Environment: objectLike({
        PrivilegedMode: true,
      }),
      Source: {
        BuildSpec: encodedJson(deepObjectLike({
          phases: {
            build: {
              commands: [
                'LookAtMe',
              ],
            },
          },
        })),
      },
    });
  });
});