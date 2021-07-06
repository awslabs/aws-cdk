import { anything, arrayWith, deepObjectLike, encodedJson, objectLike } from '@aws-cdk/assert-internal';
import '@aws-cdk/assert-internal/jest';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import { CfnOutput, Stack, Stage, StageProps } from '@aws-cdk/core';
import { Construct } from 'constructs';
import * as cdkp from '../lib';
import { } from './testmatchers';
import { behavior } from './helpers/compliance';
import { BucketStack, PIPELINE_ENV, stringNoLongerThan, TestApp, TestGitHubNpmPipeline } from './testutil';

let app: TestApp;
let pipelineStack: Stack;
let pipeline: cdkp.CdkPipeline;
let sourceArtifact: codepipeline.Artifact;
let cloudAssemblyArtifact: codepipeline.Artifact;
let integTestArtifact: codepipeline.Artifact;

beforeEach(() => {
  app = new TestApp();
  pipelineStack = new Stack(app, 'PipelineStack', { env: PIPELINE_ENV });
  sourceArtifact = new codepipeline.Artifact();
  cloudAssemblyArtifact = new codepipeline.Artifact('CloudAsm');
  integTestArtifact = new codepipeline.Artifact('IntegTests');
  pipeline = new TestGitHubNpmPipeline(pipelineStack, 'Cdk', {
    sourceArtifact,
    cloudAssemblyArtifact,
    synthAction: cdkp.SimpleSynthAction.standardNpmSynth({
      sourceArtifact,
      cloudAssemblyArtifact,
      additionalArtifacts: [{ directory: 'test', artifact: integTestArtifact }],
    }),
  });
});

afterEach(() => {
  app.cleanup();
});

behavior('stackOutput generates names limited to 100 characters', (suite) => {
  suite.legacy(() => {
    const stage = new AppWithStackOutput(app, 'APreposterouslyLongAndComplicatedNameMadeUpJustToMakeItExceedTheLimitDefinedByCodeBuild');
    const pipeStage = pipeline.addApplicationStage(stage);
    pipeStage.addActions(new cdkp.ShellScriptAction({
      actionName: 'TestOutput',
      useOutputs: {
        BUCKET_NAME: pipeline.stackOutput(stage.output),
      },
      commands: ['echo $BUCKET_NAME'],
    }));

    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
      Stages: arrayWith({
        Name: 'APreposterouslyLongAndComplicatedNameMadeUpJustToMakeItExceedTheLimitDefinedByCodeBuild',
        Actions: arrayWith(
          deepObjectLike({
            Name: 'Stack.Deploy',
            OutputArtifacts: [{ Name: stringNoLongerThan(100) }],
            Configuration: {
              OutputFileName: 'outputs.json',
            },
          }),
          deepObjectLike({
            ActionTypeId: {
              Provider: 'CodeBuild',
            },
            Configuration: {
              ProjectName: anything(),
            },
            InputArtifacts: [{ Name: stringNoLongerThan(100) }],
            Name: 'TestOutput',
          }),
        ),
      }),
    });
  });
});

behavior('can use stack outputs as validation inputs', (suite) => {
  suite.legacy(() => {
    // GIVEN
    const stage = new AppWithStackOutput(app, 'MyApp');

    // WHEN
    const pipeStage = pipeline.addApplicationStage(stage);
    pipeStage.addActions(new cdkp.ShellScriptAction({
      actionName: 'TestOutput',
      useOutputs: {
        BUCKET_NAME: pipeline.stackOutput(stage.output),
      },
      commands: ['echo $BUCKET_NAME'],
    }));

    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
      Stages: arrayWith({
        Name: 'MyApp',
        Actions: arrayWith(
          deepObjectLike({
            Name: 'Stack.Deploy',
            OutputArtifacts: [{ Name: anything() }],
            Configuration: {
              OutputFileName: 'outputs.json',
            },
          }),
          deepObjectLike({
            ActionTypeId: {
              Provider: 'CodeBuild',
            },
            Configuration: {
              ProjectName: anything(),
            },
            InputArtifacts: [{ Name: anything() }],
            Name: 'TestOutput',
          }),
        ),
      }),
    });

    expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
      Environment: {
        Image: 'aws/codebuild/standard:5.0',
      },
      Source: {
        BuildSpec: encodedJson(deepObjectLike({
          phases: {
            build: {
              commands: [
                'set -eu',
                'export BUCKET_NAME="$(node -pe \'require(process.env.CODEBUILD_SRC_DIR + "/outputs.json")["BucketName"]\')"',
                'echo $BUCKET_NAME',
              ],
            },
          },
        })),
        Type: 'CODEPIPELINE',
      },
    });
  });
});

behavior('can use additional files from source', (suite) => {
  suite.legacy(() => {
    // WHEN
    pipeline.addStage('Test').addActions(new cdkp.ShellScriptAction({
      actionName: 'UseSources',
      additionalArtifacts: [sourceArtifact],
      commands: ['true'],
    }));

    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
      Stages: arrayWith({
        Name: 'Test',
        Actions: [
          deepObjectLike({
            Name: 'UseSources',
            InputArtifacts: [{ Name: 'Artifact_Source_GitHub' }],
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
            build: {
              commands: [
                'set -eu',
                'true',
              ],
            },
          },
        })),
      },
    });
  });
});

behavior('can use additional files from build', (suite) => {
  suite.legacy(() => {
    // WHEN
    pipeline.addStage('Test').addActions(new cdkp.ShellScriptAction({
      actionName: 'UseBuildArtifact',
      additionalArtifacts: [integTestArtifact],
      commands: ['true'],
    }));

    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
      Stages: arrayWith({
        Name: 'Test',
        Actions: [
          deepObjectLike({
            Name: 'UseBuildArtifact',
            InputArtifacts: [{ Name: 'IntegTests' }],
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
            build: {
              commands: [
                'set -eu',
                'true',
              ],
            },
          },
        })),
      },
    });
  });
});

behavior('add policy statements to ShellScriptAction', (suite) => {
  suite.legacy(() => {
    // WHEN
    pipeline.addStage('Test').addActions(new cdkp.ShellScriptAction({
      actionName: 'Boop',
      additionalArtifacts: [integTestArtifact],
      commands: ['true'],
      rolePolicyStatements: [
        new iam.PolicyStatement({
          actions: ['s3:Banana'],
          resources: ['*'],
        }),
      ],
    }));

    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: arrayWith(deepObjectLike({
          Action: 's3:Banana',
          Resource: '*',
        })),
      },
    });
  });
});

behavior('ShellScriptAction is IGrantable', (suite) => {
  suite.legacy(() => {
    // GIVEN
    const action = new cdkp.ShellScriptAction({
      actionName: 'Boop',
      additionalArtifacts: [integTestArtifact],
      commands: ['true'],
    });
    pipeline.addStage('Test').addActions(action);
    const bucket = new s3.Bucket(pipelineStack, 'Bucket');

    // WHEN
    bucket.grantRead(action);

    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: arrayWith(deepObjectLike({
          Action: ['s3:GetObject*', 's3:GetBucket*', 's3:List*'],
        })),
      },
    });
  });
});

behavior('run ShellScriptAction in a VPC', (suite) => {
  suite.legacy(() => {
    // WHEN
    const vpc = new ec2.Vpc(pipelineStack, 'VPC');
    pipeline.addStage('Test').addActions(new cdkp.ShellScriptAction({
      vpc,
      actionName: 'VpcAction',
      additionalArtifacts: [integTestArtifact],
      commands: ['true'],
    }));

    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
      Stages: arrayWith({
        Name: 'Test',
        Actions: [
          deepObjectLike({
            Name: 'VpcAction',
            InputArtifacts: [{ Name: 'IntegTests' }],
          }),
        ],
      }),
    });
    expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
      Environment: {
        Image: 'aws/codebuild/standard:5.0',
      },
      VpcConfig: {
        SecurityGroupIds: [
          {
            'Fn::GetAtt': [
              'CdkPipelineTestVpcActionProjectSecurityGroupBA94D315',
              'GroupId',
            ],
          },
        ],
        Subnets: [
          {
            Ref: 'VPCPrivateSubnet1Subnet8BCA10E0',
          },
          {
            Ref: 'VPCPrivateSubnet2SubnetCFCDAA7A',
          },
          {
            Ref: 'VPCPrivateSubnet3Subnet3EDCD457',
          },
        ],
        VpcId: {
          Ref: 'VPCB9E5F0B4',
        },
      },
      Source: {
        BuildSpec: encodedJson(deepObjectLike({
          phases: {
            build: {
              commands: [
                'set -eu',
                'true',
              ],
            },
          },
        })),
      },
    });
  });
});

behavior('run ShellScriptAction with Security Group', (suite) => {
  suite.legacy(() => {
    // WHEN
    const vpc = new ec2.Vpc(pipelineStack, 'VPC');
    const sg = new ec2.SecurityGroup(pipelineStack, 'SG', { vpc });
    pipeline.addStage('Test').addActions(new cdkp.ShellScriptAction({
      vpc,
      securityGroups: [sg],
      actionName: 'sgAction',
      additionalArtifacts: [integTestArtifact],
      commands: ['true'],
    }));

    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
      Stages: arrayWith({
        Name: 'Test',
        Actions: [
          deepObjectLike({
            Name: 'sgAction',
          }),
        ],
      }),
    });
    expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
      VpcConfig: {
        SecurityGroupIds: [
          {
            'Fn::GetAtt': [
              'SGADB53937',
              'GroupId',
            ],
          },
        ],
        VpcId: {
          Ref: 'VPCB9E5F0B4',
        },
      },
    });
  });
});

behavior('run ShellScriptAction with specified codebuild image', (suite) => {
  suite.legacy(() => {
    // WHEN
    pipeline.addStage('Test').addActions(new cdkp.ShellScriptAction({
      actionName: 'imageAction',
      additionalArtifacts: [integTestArtifact],
      commands: ['true'],
      environment: { buildImage: codebuild.LinuxBuildImage.STANDARD_2_0 },
    }));

    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
      Stages: arrayWith({
        Name: 'Test',
        Actions: [
          deepObjectLike({
            Name: 'imageAction',
          }),
        ],
      }),
    });
    expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
      Environment: {
        Image: 'aws/codebuild/standard:2.0',
      },
    });
  });
});

behavior('run ShellScriptAction with specified BuildEnvironment', (suite) => {
  suite.legacy(() => {
    // WHEN
    pipeline.addStage('Test').addActions(new cdkp.ShellScriptAction({
      actionName: 'imageAction',
      additionalArtifacts: [integTestArtifact],
      commands: ['true'],
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_2_0,
        computeType: codebuild.ComputeType.LARGE,
        environmentVariables: { FOO: { value: 'BAR', type: codebuild.BuildEnvironmentVariableType.PLAINTEXT } },
        privileged: true,
      },
    }));

    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
      Environment: {
        Image: 'aws/codebuild/standard:2.0',
        PrivilegedMode: true,
        ComputeType: 'BUILD_GENERAL1_LARGE',
        EnvironmentVariables: [
          {
            Type: 'PLAINTEXT',
            Value: 'BAR',
            Name: 'FOO',
          },
        ],
      },
    });
  });
});

behavior('run ShellScriptAction with specified environment variables', (suite) => {
  suite.legacy(() => {
    // WHEN
    pipeline.addStage('Test').addActions(new cdkp.ShellScriptAction({
      actionName: 'imageAction',
      additionalArtifacts: [integTestArtifact],
      commands: ['true'],
      environmentVariables: {
        VERSION: { value: codepipeline.GlobalVariables.executionId },
      },
    }));

    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
      Stages: arrayWith({
        Name: 'Test',
        Actions: [
          objectLike({
            Name: 'imageAction',
            Configuration: objectLike({
              EnvironmentVariables: encodedJson([
                {
                  name: 'VERSION',
                  type: 'PLAINTEXT',
                  value: '#{codepipeline.PipelineExecutionId}',
                },
              ]),
            }),
          }),
        ],
      }),
    });
  });
});

class AppWithStackOutput extends Stage {
  public readonly output: CfnOutput;

  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);
    const stack = new BucketStack(this, 'Stack');

    this.output = new CfnOutput(stack, 'BucketName', {
      value: stack.bucket.bucketName,
    });
  }
}