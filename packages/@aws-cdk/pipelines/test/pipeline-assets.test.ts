import * as fs from 'fs';
import * as path from 'path';
import { arrayWith, deepObjectLike, encodedJson, notMatching, objectLike, ResourcePart, stringLike, SynthUtils } from '@aws-cdk/assert-internal';
import '@aws-cdk/assert-internal/jest';
import * as cb from '@aws-cdk/aws-codebuild';
import * as cp from '@aws-cdk/aws-codepipeline';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecr_assets from '@aws-cdk/aws-ecr-assets';
import * as s3_assets from '@aws-cdk/aws-s3-assets';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import { Stack, Stage, StageProps } from '@aws-cdk/core';
import { Construct } from 'constructs';
import * as cdkp from '../lib';
import { behavior } from './helpers/compliance';
import { BucketStack, PIPELINE_ENV, TestApp, TestGitHubAction, TestGitHubNpmPipeline } from './testutil';

const FILE_ASSET_SOURCE_HASH = '8289faf53c7da377bb2b90615999171adef5e1d8f6b88810e5fef75e6ca09ba5';
const FILE_ASSET_SOURCE_HASH2 = 'ac76997971c3f6ddf37120660003f1ced72b4fc58c498dfd99c78fa77e721e0e';

const FILE_PUBLISHING_ROLE = 'arn:${AWS::Partition}:iam::${AWS::AccountId}:role/cdk-hnb659fds-file-publishing-role-${AWS::AccountId}-${AWS::Region}';
const IMAGE_PUBLISHING_ROLE = 'arn:${AWS::Partition}:iam::${AWS::AccountId}:role/cdk-hnb659fds-image-publishing-role-${AWS::AccountId}-${AWS::Region}';

let app: TestApp;
let pipelineStack: Stack;
let pipeline: cdkp.CdkPipeline;

afterEach(() => {
  app.cleanup();
});

describe('basic pipeline', () => {
  beforeEach(() => {
    app = new TestApp();
    pipelineStack = new Stack(app, 'PipelineStack', { env: PIPELINE_ENV });
    pipeline = new TestGitHubNpmPipeline(pipelineStack, 'Cdk');
  });

  behavior('no assets stage if the application has no assets', (suite) => {
    suite.legacy(() => {
      // WHEN
      pipeline.addApplicationStage(new PlainStackApp(app, 'App'));

      // THEN
      expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
        Stages: notMatching(arrayWith(objectLike({
          Name: 'Assets',
        }))),
      });
    });
  });

  describe('asset stage placement', () => {
    behavior('assets stage comes before any user-defined stages', (suite) => {
      suite.legacy(() => {
        // WHEN
        pipeline.addApplicationStage(new FileAssetApp(app, 'App'));

        // THEN
        expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
          Stages: [
            objectLike({ Name: 'Source' }),
            objectLike({ Name: 'Build' }),
            objectLike({ Name: 'UpdatePipeline' }),
            objectLike({ Name: 'Assets' }),
            objectLike({ Name: 'App' }),
          ],
        });
      });
    });

    behavior('assets stage inserted after existing pipeline actions', (suite) => {
      suite.legacy(() => {
        // WHEN
        const sourceArtifact = new cp.Artifact();
        const cloudAssemblyArtifact = new cp.Artifact();
        const existingCodePipeline = new cp.Pipeline(pipelineStack, 'CodePipeline', {
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
        pipeline = new cdkp.CdkPipeline(pipelineStack, 'CdkEmptyPipeline', {
          cloudAssemblyArtifact: cloudAssemblyArtifact,
          selfMutating: false,
          codePipeline: existingCodePipeline,
          // No source/build actions
        });
        pipeline.addApplicationStage(new FileAssetApp(app, 'App'));

        // THEN
        expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
          Stages: [
            objectLike({ Name: 'CustomSource' }),
            objectLike({ Name: 'CustomBuild' }),
            objectLike({ Name: 'Assets' }),
            objectLike({ Name: 'App' }),
          ],
        });
      });
    });

    behavior('up to 50 assets fit in a single stage', (suite) => {
      suite.legacy(() => {
        // WHEN
        pipeline.addApplicationStage(new MegaAssetsApp(app, 'App', { numAssets: 50 }));

        // THEN
        expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
          Stages: [
            objectLike({ Name: 'Source' }),
            objectLike({ Name: 'Build' }),
            objectLike({ Name: 'UpdatePipeline' }),
            objectLike({ Name: 'Assets' }),
            objectLike({ Name: 'App' }),
          ],
        });
      });
    });

    behavior('51 assets triggers a second stage', (suite) => {
      suite.legacy(() => {
        // WHEN
        pipeline.addApplicationStage(new MegaAssetsApp(app, 'App', { numAssets: 51 }));

        // THEN
        expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
          Stages: [
            objectLike({ Name: 'Source' }),
            objectLike({ Name: 'Build' }),
            objectLike({ Name: 'UpdatePipeline' }),
            objectLike({ Name: 'Assets' }),
            objectLike({ Name: 'Assets2' }),
            objectLike({ Name: 'App' }),
          ],
        });
      });
    });

    behavior('101 assets triggers a third stage', (suite) => {
      suite.legacy(() => {
        // WHEN
        pipeline.addApplicationStage(new MegaAssetsApp(app, 'App', { numAssets: 101 }));

        // THEN
        expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
          Stages: [
            objectLike({ Name: 'Source' }),
            objectLike({ Name: 'Build' }),
            objectLike({ Name: 'UpdatePipeline' }),
            objectLike({ Name: 'Assets' }),
            objectLike({ Name: 'Assets2' }),
            objectLike({ Name: 'Assets3' }),
            objectLike({ Name: 'App' }),
          ],
        });
      });
    });
  });

  behavior('command line properly locates assets in subassembly', (suite) => {
    suite.legacy(() => {
      // WHEN
      pipeline.addApplicationStage(new FileAssetApp(app, 'FileAssetApp'));

      // THEN
      expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
        Environment: {
          Image: 'aws/codebuild/standard:5.0',
        },
        Source: {
          BuildSpec: encodedJson(deepObjectLike({
            phases: {
              build: {
                commands: arrayWith(`cdk-assets --path "assembly-FileAssetApp/FileAssetAppStackEADD68C5.assets.json" --verbose publish "${FILE_ASSET_SOURCE_HASH}:current_account-current_region"`),
              },
            },
          })),
        },
      });
    });
  });

  behavior('multiple assets are published in parallel', (suite) => {
    suite.legacy(() => {
      // WHEN
      pipeline.addApplicationStage(new TwoFileAssetsApp(app, 'FileAssetApp'));

      // THEN
      expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
        Stages: arrayWith({
          Name: 'Assets',
          Actions: [
            objectLike({ RunOrder: 1 }),
            objectLike({ RunOrder: 1 }),
          ],
        }),
      });
    });
  });

  behavior('assets are also published when using the lower-level addStackArtifactDeployment', (suite) => {
    suite.legacy(() => {
      // GIVEN
      const asm = new FileAssetApp(app, 'FileAssetApp').synth();

      // WHEN
      pipeline.addStage('SomeStage').addStackArtifactDeployment(asm.getStackByName('FileAssetApp-Stack'));

      // THEN
      expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
        Stages: arrayWith({
          Name: 'Assets',
          Actions: [
            objectLike({
              Name: 'FileAsset1',
              RunOrder: 1,
            }),
          ],
        }),
      });
    });
  });

  behavior('file image asset publishers do not use privilegedmode', (suite) => {
    suite.legacy(() => {
      // WHEN
      pipeline.addApplicationStage(new FileAssetApp(app, 'FileAssetApp'));

      // THEN
      expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
        Source: {
          BuildSpec: encodedJson(deepObjectLike({
            phases: {
              build: {
                commands: arrayWith(stringLike('cdk-assets *')),
              },
            },
          })),
        },
        Environment: objectLike({
          PrivilegedMode: false,
          Image: 'aws/codebuild/standard:5.0',
        }),
      });
    });
  });

  behavior('docker image asset publishers use privilegedmode', (suite) => {
    suite.legacy(() => {
      // WHEN
      pipeline.addApplicationStage(new DockerAssetApp(app, 'DockerAssetApp'));

      // THEN
      expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
        Source: {
          BuildSpec: encodedJson(deepObjectLike({
            phases: {
              build: {
                commands: arrayWith(stringLike('cdk-assets *')),
              },
            },
          })),
        },
        Environment: objectLike({
          Image: 'aws/codebuild/standard:5.0',
          PrivilegedMode: true,
        }),
      });
    });
  });

  behavior('can control fix/CLI version used in pipeline selfupdate', (suite) => {
    suite.legacy(() => {
      // WHEN
      const stack2 = new Stack(app, 'Stack2', { env: PIPELINE_ENV });
      const pipeline2 = new TestGitHubNpmPipeline(stack2, 'Cdk2', {
        cdkCliVersion: '1.2.3',
      });
      pipeline2.addApplicationStage(new FileAssetApp(stack2, 'FileAssetApp'));

      // THEN
      expect(stack2).toHaveResourceLike('AWS::CodeBuild::Project', {
        Environment: {
          Image: 'aws/codebuild/standard:5.0',
        },
        Source: {
          BuildSpec: encodedJson(deepObjectLike({
            phases: {
              install: {
                commands: ['npm install -g cdk-assets@1.2.3'],
              },
            },
          })),
        },
      });
    });
  });

  describe('asset roles and policies', () => {
    behavior('includes file publishing assets role for apps with file assets', (suite) => {
      suite.legacy(() => {
        pipeline.addApplicationStage(new FileAssetApp(app, 'App1'));

        expect(pipelineStack).toHaveResourceLike('AWS::IAM::Role', {
          AssumeRolePolicyDocument: {
            Statement: [{
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: 'codebuild.amazonaws.com',
                AWS: {
                  'Fn::Join': ['', [
                    'arn:', { Ref: 'AWS::Partition' }, `:iam::${PIPELINE_ENV.account}:root`,
                  ]],
                },
              },
            }],
          },
        });
        expect(pipelineStack).toHaveResourceLike('AWS::IAM::Policy',
          expectedAssetRolePolicy(FILE_PUBLISHING_ROLE, 'CdkAssetsFileRole6BE17A07'));
      });
    });

    behavior('publishing assets role may assume roles from multiple environments', (suite) => {
      suite.legacy(() => {
        pipeline.addApplicationStage(new FileAssetApp(app, 'App1'));
        pipeline.addApplicationStage(new FileAssetApp(app, 'App2', {
          env: {
            account: '0123456789012',
            region: 'eu-west-1',
          },
        }));

        expect(pipelineStack).toHaveResourceLike('AWS::IAM::Policy',
          expectedAssetRolePolicy([FILE_PUBLISHING_ROLE, 'arn:${AWS::Partition}:iam::0123456789012:role/cdk-hnb659fds-file-publishing-role-0123456789012-eu-west-1'],
            'CdkAssetsFileRole6BE17A07'));
      });
    });

    behavior('publishing assets role de-dupes assumed roles', (suite) => {
      suite.legacy(() => {
        pipeline.addApplicationStage(new FileAssetApp(app, 'App1'));
        pipeline.addApplicationStage(new FileAssetApp(app, 'App2'));
        pipeline.addApplicationStage(new FileAssetApp(app, 'App3'));

        expect(pipelineStack).toHaveResourceLike('AWS::IAM::Policy',
          expectedAssetRolePolicy(FILE_PUBLISHING_ROLE, 'CdkAssetsFileRole6BE17A07'));
      });
    });

    behavior('includes image publishing assets role for apps with Docker assets', (suite) => {
      suite.legacy(() => {
        pipeline.addApplicationStage(new DockerAssetApp(app, 'App1'));

        expect(pipelineStack).toHaveResourceLike('AWS::IAM::Role', {
          AssumeRolePolicyDocument: {
            Statement: [{
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: 'codebuild.amazonaws.com',
                AWS: {
                  'Fn::Join': ['', [
                    'arn:', { Ref: 'AWS::Partition' }, `:iam::${PIPELINE_ENV.account}:root`,
                  ]],
                },
              },
            }],
          },
        });
        expect(pipelineStack).toHaveResourceLike('AWS::IAM::Policy',
          expectedAssetRolePolicy(IMAGE_PUBLISHING_ROLE, 'CdkAssetsDockerRole484B6DD3'));
      });
    });

    behavior('includes both roles for apps with both file and Docker assets', (suite) => {
      suite.legacy(() => {
        pipeline.addApplicationStage(new FileAssetApp(app, 'App1'));
        pipeline.addApplicationStage(new DockerAssetApp(app, 'App2'));

        expect(pipelineStack).toHaveResourceLike('AWS::IAM::Policy',
          expectedAssetRolePolicy(FILE_PUBLISHING_ROLE, 'CdkAssetsFileRole6BE17A07'));
        expect(pipelineStack).toHaveResourceLike('AWS::IAM::Policy',
          expectedAssetRolePolicy(IMAGE_PUBLISHING_ROLE, 'CdkAssetsDockerRole484B6DD3'));
      });
    });
  });
});


behavior('can supply pre-install scripts to asset upload', (suite) => {
  suite.legacy(() => {
    // WHEN
    app = new TestApp();
    pipelineStack = new Stack(app, 'PipelineStack', { env: PIPELINE_ENV });
    pipeline = new TestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      assetPreInstallCommands: [
        'npm config set registry https://registry.com',
      ],
    });
    pipeline.addApplicationStage(new FileAssetApp(app, 'FileAssetApp'));

    // THEN
    expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
      Environment: {
        Image: 'aws/codebuild/standard:5.0',
      },
      Source: {
        BuildSpec: encodedJson(deepObjectLike({
          phases: {
            install: {
              commands: ['npm config set registry https://registry.com', 'npm install -g cdk-assets'],
            },
          },
        })),
      },
    });

    app.cleanup();
  });
});

describe('pipeline with VPC', () => {
  let vpc: ec2.Vpc;
  beforeEach(() => {
    app = new TestApp();
    pipelineStack = new Stack(app, 'PipelineStack', { env: PIPELINE_ENV });
    vpc = new ec2.Vpc(pipelineStack, 'Vpc');
    pipeline = new TestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      vpc,
    });
  });

  behavior('asset CodeBuild Project uses VPC subnets', (suite) => {
    suite.legacy(() => {
      // WHEN
      pipeline.addApplicationStage(new DockerAssetApp(app, 'DockerAssetApp'));

      // THEN
      expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
        VpcConfig: objectLike({
          SecurityGroupIds: [
            { 'Fn::GetAtt': ['CdkAssetsDockerAsset1SecurityGroup078F5C66', 'GroupId'] },
          ],
          Subnets: [
            { Ref: 'VpcPrivateSubnet1Subnet536B997A' },
            { Ref: 'VpcPrivateSubnet2Subnet3788AAA1' },
            { Ref: 'VpcPrivateSubnet3SubnetF258B56E' },
          ],
          VpcId: { Ref: 'Vpc8378EB38' },
        }),
      });
    });
  });

  behavior('Pipeline-generated CodeBuild Projects have appropriate execution role permissions', (suite) => {
    suite.legacy(() => {
      // WHEN
      pipeline.addApplicationStage(new DockerAssetApp(app, 'DockerAssetApp'));

      // THEN

      // Assets Project
      expect(pipelineStack).toHaveResourceLike('AWS::IAM::Policy', {
        Roles: [
          { Ref: 'CdkAssetsDockerRole484B6DD3' },
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
  });

  behavior('Asset publishing CodeBuild Projects have a dependency on attached policies to the role', (suite) => {
    suite.legacy(() => {
      pipeline.addApplicationStage(new DockerAssetApp(app, 'DockerAssetApp'));

      // Assets Project
      expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
        Properties: {
          ServiceRole: {
            'Fn::GetAtt': [
              'CdkAssetsDockerRole484B6DD3',
              'Arn',
            ],
          },
        },
        DependsOn: [
          'CdkAssetsDockerRoleVpcPolicy86CA024B',
        ],
      }, ResourcePart.CompleteDefinition);
    });
  });
});

describe('pipeline with single asset publisher', () => {
  let otherPipelineStack: Stack;
  let otherPipeline: cdkp.CdkPipeline;

  beforeEach(() => {
    app = new TestApp();
    pipelineStack = new Stack(app, 'PipelineStack', { env: PIPELINE_ENV });
    pipeline = new TestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      singlePublisherPerType: true,
    });
    otherPipelineStack = new Stack(app, 'OtherPipelineStack', { env: PIPELINE_ENV });
    otherPipeline = new TestGitHubNpmPipeline(otherPipelineStack, 'Cdk', {
      singlePublisherPerType: true,
    });
  });

  behavior('multiple assets are using the same job in singlePublisherMode', (suite) => {
    suite.legacy(() => {
      // WHEN
      pipeline.addApplicationStage(new TwoFileAssetsApp(app, 'FileAssetApp'));

      // THEN
      expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
        Stages: arrayWith({
          Name: 'Assets',
          Actions: [
            // Only one file asset action
            objectLike({ RunOrder: 1, Name: 'FileAsset' }),
          ],
        }),
      });
      expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
        Environment: {
          Image: 'aws/codebuild/standard:5.0',
        },
        Source: {
          BuildSpec: 'buildspec-assets-PipelineStack-Cdk-Assets-FileAsset.yaml',
        },
      });
      const assembly = SynthUtils.synthesize(pipelineStack, { skipValidation: true }).assembly;
      const buildSpec = JSON.parse(fs.readFileSync(path.join(assembly.directory, 'buildspec-assets-PipelineStack-Cdk-Assets-FileAsset.yaml')).toString());
      expect(buildSpec.phases.build.commands).toContain(`cdk-assets --path "assembly-FileAssetApp/FileAssetAppStackEADD68C5.assets.json" --verbose publish "${FILE_ASSET_SOURCE_HASH}:current_account-current_region"`);
      expect(buildSpec.phases.build.commands).toContain(`cdk-assets --path "assembly-FileAssetApp/FileAssetAppStackEADD68C5.assets.json" --verbose publish "${FILE_ASSET_SOURCE_HASH2}:current_account-current_region"`);
    });
  });

  behavior('other pipeline writes to separate assets build spec file', (suite) => {
    suite.legacy(() => {
      // WHEN
      pipeline.addApplicationStage(new TwoFileAssetsApp(app, 'FileAssetApp'));
      otherPipeline.addApplicationStage(new TwoFileAssetsApp(app, 'OtherFileAssetApp'));

      // THEN
      expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
        Source: {
          BuildSpec: 'buildspec-assets-PipelineStack-Cdk-Assets-FileAsset.yaml',
        },
      });
      expect(otherPipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
        Source: {
          BuildSpec: 'buildspec-assets-OtherPipelineStack-Cdk-Assets-FileAsset.yaml',
        },
      });
    });
  });
});


describe('pipeline with custom asset publisher BuildSpec', () => {

  beforeEach(() => {
    app = new TestApp();
    pipelineStack = new Stack(app, 'PipelineStack', { env: PIPELINE_ENV });
    pipeline = new TestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      singlePublisherPerType: true,
      assetBuildSpec: cb.BuildSpec.fromObject({
        phases: {
          pre_install: {
            commands: 'preinstall',
          },
        },
        cache: {
          paths: 'node_modules',
        },
      }),
    });
  });

  behavior('custom buildspec is merged correctly', (suite) => {
    suite.legacy(() => {
      // WHEN
      pipeline.addApplicationStage(new TwoFileAssetsApp(app, 'FileAssetApp'));

      // THEN
      expect(pipelineStack).toHaveResourceLike('AWS::CodePipeline::Pipeline', {
        Stages: arrayWith({
          Name: 'Assets',
          Actions: [
            // Only one file asset action
            objectLike({ RunOrder: 1, Name: 'FileAsset' }),
          ],
        }),
      });
      expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
        Environment: {
          Image: 'aws/codebuild/standard:5.0',
        },
        Source: {
          BuildSpec: 'buildspec-assets-PipelineStack-Cdk-Assets-FileAsset.yaml',
        },
      });
      const assembly = SynthUtils.synthesize(pipelineStack, { skipValidation: true }).assembly;
      const buildSpec = JSON.parse(fs.readFileSync(path.join(assembly.directory, 'buildspec-assets-PipelineStack-Cdk-Assets-FileAsset.yaml')).toString());
      expect(buildSpec.phases.build.commands).toContain(`cdk-assets --path "assembly-FileAssetApp/FileAssetAppStackEADD68C5.assets.json" --verbose publish "${FILE_ASSET_SOURCE_HASH}:current_account-current_region"`);
      expect(buildSpec.phases.build.commands).toContain(`cdk-assets --path "assembly-FileAssetApp/FileAssetAppStackEADD68C5.assets.json" --verbose publish "${FILE_ASSET_SOURCE_HASH2}:current_account-current_region"`);
      expect(buildSpec.phases.pre_install.commands).toContain('preinstall');
      expect(buildSpec.cache.paths).toContain('node_modules');
    });
  });

});

describe('pipeline with Docker credentials', () => {
  const secretSynthArn = 'arn:aws:secretsmanager:eu-west-1:0123456789012:secret:synth-012345';
  const secretUpdateArn = 'arn:aws:secretsmanager:eu-west-1:0123456789012:secret:update-012345';
  const secretPublishArn = 'arn:aws:secretsmanager:eu-west-1:0123456789012:secret:publish-012345';
  let secretSynth: secretsmanager.ISecret;
  let secretUpdate: secretsmanager.ISecret;
  let secretPublish: secretsmanager.ISecret;

  beforeEach(() => {
    app = new TestApp();
    pipelineStack = new Stack(app, 'PipelineStack', { env: PIPELINE_ENV });

    secretSynth = secretsmanager.Secret.fromSecretCompleteArn(pipelineStack, 'Secret1', secretSynthArn);
    secretUpdate = secretsmanager.Secret.fromSecretCompleteArn(pipelineStack, 'Secret2', secretUpdateArn);
    secretPublish = secretsmanager.Secret.fromSecretCompleteArn(pipelineStack, 'Secret3', secretPublishArn);
    pipeline = new TestGitHubNpmPipeline(pipelineStack, 'Cdk', {
      dockerCredentials: [
        cdkp.DockerCredential.customRegistry('synth.example.com', secretSynth, {
          usages: [cdkp.DockerCredentialUsage.SYNTH],
        }),
        cdkp.DockerCredential.customRegistry('selfupdate.example.com', secretUpdate, {
          usages: [cdkp.DockerCredentialUsage.SELF_UPDATE],
        }),
        cdkp.DockerCredential.customRegistry('publish.example.com', secretPublish, {
          usages: [cdkp.DockerCredentialUsage.ASSET_PUBLISHING],
        }),
      ],
    });
  });

  behavior('synth action receives install commands and access to relevant credentials', (suite) => {
    suite.legacy(() => {
      pipeline.addApplicationStage(new DockerAssetApp(app, 'App1'));

      const expectedCredsConfig = JSON.stringify({
        version: '1.0',
        domainCredentials: { 'synth.example.com': { secretsManagerSecretId: secretSynthArn } },
      });

      expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
        Environment: { Image: 'aws/codebuild/standard:5.0' },
        // Prove we're looking at the Synth project
        ServiceRole: { 'Fn::GetAtt': ['CdkPipelineBuildSynthCdkBuildProjectRole5E173C62', 'Arn'] },
        Source: {
          BuildSpec: encodedJson(deepObjectLike({
            phases: {
              pre_build: {
                commands: [
                  'npm ci',
                  'mkdir $HOME/.cdk',
                  `echo '${expectedCredsConfig}' > $HOME/.cdk/cdk-docker-creds.json`,
                ],
              },
            },
          })),
        },
      });
      expect(pipelineStack).toHaveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: arrayWith({
            Action: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
            Effect: 'Allow',
            Resource: secretSynthArn,
          }),
          Version: '2012-10-17',
        },
        Roles: [{ Ref: 'CdkPipelineBuildSynthCdkBuildProjectRole5E173C62' }],
      });
    });
  });

  behavior('synth action receives Windows install commands if a Windows image is detected', (suite) => {
    suite.legacy(() => {
      pipeline = new TestGitHubNpmPipeline(pipelineStack, 'Cdk2', {
        dockerCredentials: [
          cdkp.DockerCredential.customRegistry('synth.example.com', secretSynth, {
            usages: [cdkp.DockerCredentialUsage.SYNTH],
          }),
          cdkp.DockerCredential.customRegistry('selfupdate.example.com', secretUpdate, {
            usages: [cdkp.DockerCredentialUsage.SELF_UPDATE],
          }),
          cdkp.DockerCredential.customRegistry('publish.example.com', secretPublish, {
            usages: [cdkp.DockerCredentialUsage.ASSET_PUBLISHING],
          }),
        ],
        npmSynthOptions: {
          environment: {
            buildImage: cb.WindowsBuildImage.WINDOWS_BASE_2_0,
          },
        },
      });
      pipeline.addApplicationStage(new DockerAssetApp(app, 'App1'));

      const expectedCredsConfig = JSON.stringify({
        version: '1.0',
        domainCredentials: { 'synth.example.com': { secretsManagerSecretId: secretSynthArn } },
      });

      expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
        Environment: { Image: 'aws/codebuild/windows-base:2.0' },
        // Prove we're looking at the Synth project
        ServiceRole: { 'Fn::GetAtt': ['Cdk2PipelineBuildSynthCdkBuildProjectRole9869128F', 'Arn'] },
        Source: {
          BuildSpec: encodedJson(deepObjectLike({
            phases: {
              pre_build: {
                commands: [
                  'npm ci',
                  'mkdir %USERPROFILE%\\.cdk',
                  `echo '${expectedCredsConfig}' > %USERPROFILE%\\.cdk\\cdk-docker-creds.json`,
                ],
              },
            },
          })),
        },
      });
    });
  });

  behavior('self-update receives install commands and access to relevant credentials', (suite) => {
    suite.legacy(() => {
      pipeline.addApplicationStage(new DockerAssetApp(app, 'App1'));

      const expectedCredsConfig = JSON.stringify({
        version: '1.0',
        domainCredentials: { 'selfupdate.example.com': { secretsManagerSecretId: secretUpdateArn } },
      });

      expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
        Environment: { Image: 'aws/codebuild/standard:5.0' },
        // Prove we're looking at the SelfMutate project
        ServiceRole: { 'Fn::GetAtt': ['CdkUpdatePipelineSelfMutationRoleAAF1B580', 'Arn'] },
        Source: {
          BuildSpec: encodedJson(deepObjectLike({
            phases: {
              install: {
                commands: [
                  'npm install -g aws-cdk',
                  'mkdir $HOME/.cdk',
                  `echo '${expectedCredsConfig}' > $HOME/.cdk/cdk-docker-creds.json`,
                ],
              },
            },
          })),
        },
      });
      expect(pipelineStack).toHaveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: arrayWith({
            Action: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
            Effect: 'Allow',
            Resource: secretUpdateArn,
          }),
          Version: '2012-10-17',
        },
        Roles: [{ Ref: 'CdkUpdatePipelineSelfMutationRoleAAF1B580' }],
      });
    });
  });

  behavior('asset publishing receives install commands and access to relevant credentials', (suite) => {
    suite.legacy(() => {
      pipeline.addApplicationStage(new DockerAssetApp(app, 'App1'));

      const expectedCredsConfig = JSON.stringify({
        version: '1.0',
        domainCredentials: { 'publish.example.com': { secretsManagerSecretId: secretPublishArn } },
      });

      expect(pipelineStack).toHaveResourceLike('AWS::CodeBuild::Project', {
        Environment: { Image: 'aws/codebuild/standard:5.0' },
        // Prove we're looking at the Publishing project
        ServiceRole: { 'Fn::GetAtt': ['CdkAssetsDockerRole484B6DD3', 'Arn'] },
        Source: {
          BuildSpec: encodedJson(deepObjectLike({
            phases: {
              install: {
                commands: [
                  'mkdir $HOME/.cdk',
                  `echo '${expectedCredsConfig}' > $HOME/.cdk/cdk-docker-creds.json`,
                  'npm install -g cdk-assets',
                ],
              },
            },
          })),
        },
      });
      expect(pipelineStack).toHaveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: arrayWith({
            Action: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
            Effect: 'Allow',
            Resource: secretPublishArn,
          }),
          Version: '2012-10-17',
        },
        Roles: [{ Ref: 'CdkAssetsDockerRole484B6DD3' }],
      });
    });
  });

});

class PlainStackApp extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);
    new BucketStack(this, 'Stack');
  }
}

class FileAssetApp extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);
    const stack = new Stack(this, 'Stack');
    new s3_assets.Asset(stack, 'Asset', {
      path: path.join(__dirname, 'test-file-asset.txt'),
    });
  }
}

class TwoFileAssetsApp extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);
    const stack = new Stack(this, 'Stack');
    new s3_assets.Asset(stack, 'Asset1', {
      path: path.join(__dirname, 'test-file-asset.txt'),
    });
    new s3_assets.Asset(stack, 'Asset2', {
      path: path.join(__dirname, 'test-file-asset-two.txt'),
    });
  }
}

class DockerAssetApp extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);
    const stack = new Stack(this, 'Stack');
    new ecr_assets.DockerImageAsset(stack, 'Asset', {
      directory: path.join(__dirname, 'test-docker-asset'),
    });
  }
}

interface MegaAssetsAppProps extends StageProps {
  readonly numAssets: number;
}

// Creates a mix of file and image assets, up to a specified count
class MegaAssetsApp extends Stage {
  constructor(scope: Construct, id: string, props: MegaAssetsAppProps) {
    super(scope, id, props);
    const stack = new Stack(this, 'Stack');

    let assetCount = 0;
    for (; assetCount < props.numAssets / 2; assetCount++) {
      new s3_assets.Asset(stack, `Asset${assetCount}`, {
        path: path.join(__dirname, 'test-file-asset.txt'),
        assetHash: `FileAsset${assetCount}`,
      });
    }
    for (; assetCount < props.numAssets; assetCount++) {
      new ecr_assets.DockerImageAsset(stack, `Asset${assetCount}`, {
        directory: path.join(__dirname, 'test-docker-asset'),
        extraHash: `FileAsset${assetCount}`,
      });
    }
  }
}


function expectedAssetRolePolicy(assumeRolePattern: string | string[], attachedRole: string) {
  if (typeof assumeRolePattern === 'string') { assumeRolePattern = [assumeRolePattern]; }

  return {
    PolicyDocument: {
      Statement: [{
        Action: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
        Effect: 'Allow',
        Resource: {
          'Fn::Join': ['', [
            'arn:',
            { Ref: 'AWS::Partition' },
            `:logs:${PIPELINE_ENV.region}:${PIPELINE_ENV.account}:log-group:/aws/codebuild/*`,
          ]],
        },
      },
      {
        Action: ['codebuild:CreateReportGroup', 'codebuild:CreateReport', 'codebuild:UpdateReport', 'codebuild:BatchPutTestCases', 'codebuild:BatchPutCodeCoverages'],
        Effect: 'Allow',
        Resource: {
          'Fn::Join': ['', [
            'arn:',
            { Ref: 'AWS::Partition' },
            `:codebuild:${PIPELINE_ENV.region}:${PIPELINE_ENV.account}:report-group/*`,
          ]],
        },
      },
      {
        Action: ['codebuild:BatchGetBuilds', 'codebuild:StartBuild', 'codebuild:StopBuild'],
        Effect: 'Allow',
        Resource: '*',
      },
      {
        Action: 'sts:AssumeRole',
        Effect: 'Allow',
        Resource: assumeRolePattern.map(arn => { return { 'Fn::Sub': arn }; }),
      },
      {
        Action: ['s3:GetObject*', 's3:GetBucket*', 's3:List*'],
        Effect: 'Allow',
        Resource: [
          { 'Fn::GetAtt': ['CdkPipelineArtifactsBucket7B46C7BF', 'Arn'] },
          { 'Fn::Join': ['', [{ 'Fn::GetAtt': ['CdkPipelineArtifactsBucket7B46C7BF', 'Arn'] }, '/*']] },
        ],
      },
      {
        Action: ['kms:Decrypt', 'kms:DescribeKey'],
        Effect: 'Allow',
        Resource: { 'Fn::GetAtt': ['CdkPipelineArtifactsBucketEncryptionKeyDDD3258C', 'Arn'] },
      }],
    },
    Roles: [{ Ref: attachedRole }],
  };
}
