import { arrayWith, deepObjectLike, encodedJson, objectLike, Capture } from '@aws-cdk/assert-internal';
import '@aws-cdk/assert-internal/jest';
import * as cbuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecr from '@aws-cdk/aws-ecr';
import * as s3 from '@aws-cdk/aws-s3';
import { Stack } from '@aws-cdk/core';
import * as cdkp from '../lib';
import { PIPELINE_ENV, TestApp, TestGitHubNpmPipeline } from './testutil';

let app: TestApp;
let pipelineStack: Stack;
let sourceArtifact: codepipeline.Artifact;
let cloudAssemblyArtifact: codepipeline.Artifact;

beforeEach(() => {
  app = new TestApp({ outdir: 'testcdk.out' });
  pipelineStack = new Stack(app, 'PipelineStack', { env: PIPELINE_ENV });
  sourceArtifact = new codepipeline.Artifact();
  cloudAssemblyArtifact = new codepipeline.Artifact('CloudAsm');
});

afterEach(() => {
  app.cleanup();
});

test('SimpleSynthAction takes arrays of commands', () => {
  // WHEN
  new TestGitHubNpmPipeline(pipelineStack, 'Cdk', {
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

  // THEN
  expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
    Environment: {
      Image: 'aws/codebuild/standard:5.0',
    },
    Source: {
      BuildSpec: encodedJson(deepObjectLike({
        phases: {
          pre_build: {
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
});

test.each([['npm'], ['yarn']])('%s build automatically determines artifact base-directory', (npmYarn) => {
  // WHEN
  new TestGitHubNpmPipeline(pipelineStack, 'Cdk', {
    sourceArtifact,
    cloudAssemblyArtifact,
    synthAction: npmYarnBuild(npmYarn)({ sourceArtifact, cloudAssemblyArtifact }),
  });

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
});

test.each([['npm'], ['yarn']])('%s build respects subdirectory', (npmYarn) => {
  // WHEN
  new TestGitHubNpmPipeline(pipelineStack, 'Cdk', {
    sourceArtifact,
    cloudAssemblyArtifact,
    synthAction: npmYarnBuild(npmYarn)({
      sourceArtifact,
      cloudAssemblyArtifact,
      subdirectory: 'subdir',
    }),
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
            commands: arrayWith('cd subdir'),
          },
        },
        artifacts: {
          'base-directory': 'subdir/cdk.out',
        },
      })),
    },
  });
});

test.each([['npm'], ['yarn']])('%s build sets UNSAFE_PERM=true', (npmYarn) => {
  // WHEN
  new TestGitHubNpmPipeline(pipelineStack, 'Cdk', {
    sourceArtifact,
    cloudAssemblyArtifact,
    synthAction: npmYarnBuild(npmYarn)({
      sourceArtifact,
      cloudAssemblyArtifact,
    }),
  });

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
});

test.each([['npm'], ['yarn']])('%s assumes no build step by default', (npmYarn) => {
  // WHEN
  new TestGitHubNpmPipeline(pipelineStack, 'Cdk', {
    sourceArtifact,
    cloudAssemblyArtifact,
    synthAction: npmYarnBuild(npmYarn)({ sourceArtifact, cloudAssemblyArtifact }),
  });

  // THEN
  expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
    Environment: {
      Image: 'aws/codebuild/standard:5.0',
    },
    Source: {
      BuildSpec: encodedJson(deepObjectLike({
        phases: {
          build: {
            commands: ['npx cdk synth'],
          },
        },
      })),
    },
  });
});

test('environmentVariables must be rendered in the action', () => {
  // WHEN
  new TestGitHubNpmPipeline(pipelineStack, 'Cdk', {
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

  // THEN
  const theHash = Capture.aString();
  expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
    Stages: arrayWith({
      Name: 'Build',
      Actions: [
        objectLike({
          Name: 'Synth',
          Configuration: objectLike({
            EnvironmentVariables: encodedJson([
              {
                name: 'VERSION',
                type: 'PLAINTEXT',
                value: '#{codepipeline.PipelineExecutionId}',
              },
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
});

test('complex setup with environment variables still renders correct project', () => {
  // WHEN
  new TestGitHubNpmPipeline(pipelineStack, 'Cdk', {
    sourceArtifact,
    cloudAssemblyArtifact,
    synthAction: new cdkp.SimpleSynthAction({
      sourceArtifact,
      cloudAssemblyArtifact,
      environmentVariables: {
        SOME_ENV_VAR: { value: 'SomeValue' },
      },
      environment: {
        environmentVariables: {
          INNER_VAR: { value: 'InnerValue' },
        },
        privileged: true,
      },
      installCommands: [
        'install1',
        'install2',
      ],
      synthCommand: 'synth',
    }),
  });

  // THEN
  expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
    Environment: objectLike({
      PrivilegedMode: true,
      EnvironmentVariables: [
        {
          Name: 'INNER_VAR',
          Type: 'PLAINTEXT',
          Value: 'InnerValue',
        },
      ],
    }),
    Source: {
      BuildSpec: encodedJson(deepObjectLike({
        phases: {
          pre_build: {
            commands: ['install1', 'install2'],
          },
          build: {
            commands: ['synth'],
          },
        },
      })),
    },
  });
});

test.each([['npm'], ['yarn']])('%s can have its install command overridden', (npmYarn) => {
  // WHEN
  new TestGitHubNpmPipeline(pipelineStack, 'Cdk', {
    sourceArtifact,
    cloudAssemblyArtifact,
    synthAction: npmYarnBuild(npmYarn)({
      sourceArtifact,
      cloudAssemblyArtifact,
      installCommand: '/bin/true',
    }),
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
            commands: ['/bin/true'],
          },
        },
      })),
    },
  });
});

test.each([['npm'], ['yarn']])('%s can have its test commands set', (npmYarn) => {
  // WHEN
  new TestGitHubNpmPipeline(pipelineStack, 'Cdk', {
    sourceArtifact,
    cloudAssemblyArtifact,
    synthAction: npmYarnBuild(npmYarn)({
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

test('Standard (NPM) synth can output additional artifacts', () => {
  // WHEN
  const addlArtifact = new codepipeline.Artifact('IntegTest');
  new TestGitHubNpmPipeline(pipelineStack, 'Cdk', {
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

  // THEN
  expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
    Environment: {
      Image: 'aws/codebuild/standard:5.0',
    },
    Source: {
      BuildSpec: encodedJson(deepObjectLike({
        artifacts: {
          'secondary-artifacts': {
            CloudAsm: {
              'base-directory': 'cdk.out',
              'files': '**/*',
            },
            IntegTest: {
              'base-directory': 'test',
              'files': '**/*',
            },
          },
        },
      })),
    },
  });
});

test('Standard (NPM) synth can run in a VPC', () => {
  // WHEN
  new TestGitHubNpmPipeline(pipelineStack, 'Cdk', {
    sourceArtifact,
    cloudAssemblyArtifact,
    synthAction: cdkp.SimpleSynthAction.standardNpmSynth({
      vpc: new ec2.Vpc(pipelineStack, 'NpmSynthTestVpc'),
      sourceArtifact,
      cloudAssemblyArtifact,
    }),
  });

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
});

test('Standard (Yarn) synth can run in a VPC', () => {
  // WHEN
  new TestGitHubNpmPipeline(pipelineStack, 'Cdk', {
    sourceArtifact,
    cloudAssemblyArtifact,
    synthAction: cdkp.SimpleSynthAction.standardYarnSynth({
      vpc: new ec2.Vpc(pipelineStack, 'YarnSynthTestVpc'),
      sourceArtifact,
      cloudAssemblyArtifact,
    }),
  });

  // THEN
  expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
    VpcConfig: {
      SecurityGroupIds: [
        {
          'Fn::GetAtt': [
            'CdkPipelineBuildSynthCdkBuildProjectSecurityGroupEA44D7C2',
            'GroupId',
          ],
        },
      ],
      Subnets: [
        {
          Ref: 'YarnSynthTestVpcPrivateSubnet1Subnet2805334B',
        },
        {
          Ref: 'YarnSynthTestVpcPrivateSubnet2SubnetDCFBF596',
        },
        {
          Ref: 'YarnSynthTestVpcPrivateSubnet3SubnetE11E0C86',
        },
      ],
      VpcId: {
        Ref: 'YarnSynthTestVpc5F654735',
      },
    },
  });
});

test('Pipeline action contains a hash that changes as the buildspec changes', () => {
  const hash1 = synthWithAction((sa, cxa) => cdkp.SimpleSynthAction.standardNpmSynth({
    sourceArtifact: sa,
    cloudAssemblyArtifact: cxa,
  }));

  // To make sure the hash is not just random :)
  const hash1prime = synthWithAction((sa, cxa) => cdkp.SimpleSynthAction.standardNpmSynth({
    sourceArtifact: sa,
    cloudAssemblyArtifact: cxa,
  }));

  const hash2 = synthWithAction((sa, cxa) => cdkp.SimpleSynthAction.standardNpmSynth({
    sourceArtifact: sa,
    cloudAssemblyArtifact: cxa,
    installCommand: 'do install',
  }));
  const hash3 = synthWithAction((sa, cxa) => cdkp.SimpleSynthAction.standardNpmSynth({
    sourceArtifact: sa,
    cloudAssemblyArtifact: cxa,
    environment: {
      computeType: cbuild.ComputeType.LARGE,
    },
  }));
  const hash4 = synthWithAction((sa, cxa) => cdkp.SimpleSynthAction.standardNpmSynth({
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

  function synthWithAction(cb: (sourceArtifact: codepipeline.Artifact, cloudAssemblyArtifact: codepipeline.Artifact) => codepipeline.IAction) {
    const _app = new TestApp({ outdir: 'testcdk.out' });
    const _pipelineStack = new Stack(_app, 'PipelineStack', { env: PIPELINE_ENV });
    const _sourceArtifact = new codepipeline.Artifact();
    const _cloudAssemblyArtifact = new codepipeline.Artifact('CloudAsm');

    new TestGitHubNpmPipeline(_pipelineStack, 'Cdk', {
      sourceArtifact: _sourceArtifact,
      cloudAssemblyArtifact: _cloudAssemblyArtifact,
      synthAction: cb(_sourceArtifact, _cloudAssemblyArtifact),
    });

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

test('SimpleSynthAction is IGrantable', () => {
  // GIVEN
  const synthAction = cdkp.SimpleSynthAction.standardNpmSynth({
    sourceArtifact,
    cloudAssemblyArtifact,
  });
  new TestGitHubNpmPipeline(pipelineStack, 'Cdk', {
    sourceArtifact,
    cloudAssemblyArtifact,
    synthAction,
  });
  const bucket = new s3.Bucket(pipelineStack, 'Bucket');

  // WHEN
  bucket.grantRead(synthAction);

  // THEN
  expect(pipelineStack).toHaveResourceLike('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: arrayWith(deepObjectLike({
        Action: ['s3:GetObject*', 's3:GetBucket*', 's3:List*'],
      })),
    },
  });
});

test('SimpleSynthAction can reference an imported ECR repo', () => {
  // Repro from https://github.com/aws/aws-cdk/issues/10535

  // WHEN
  new TestGitHubNpmPipeline(pipelineStack, 'Cdk', {
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

function npmYarnBuild(npmYarn: string) {
  if (npmYarn === 'npm') { return cdkp.SimpleSynthAction.standardNpmSynth; }
  if (npmYarn === 'yarn') { return cdkp.SimpleSynthAction.standardYarnSynth; }
  throw new Error(`Expecting npm|yarn: ${npmYarn}`);
}