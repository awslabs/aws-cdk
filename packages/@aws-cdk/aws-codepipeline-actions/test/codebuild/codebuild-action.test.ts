import { expect, haveResourceLike } from '@aws-cdk/assert-internal';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codecommit from '@aws-cdk/aws-codecommit';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as s3 from '@aws-cdk/aws-s3';
import * as sns from '@aws-cdk/aws-sns';
import { App, SecretValue, Stack } from '@aws-cdk/core';
import { nodeunitShim, Test } from 'nodeunit-shim';
import * as cpactions from '../../lib';

/* eslint-disable quote-props */

nodeunitShim({
  'CodeBuild action': {
    'that is cross-account and has outputs': {
      'causes an error'(test: Test) {
        const app = new App();

        const projectStack = new Stack(app, 'ProjectStack', {
          env: {
            region: 'us-west-2',
            account: '012345678912',
          },
        });
        const project = new codebuild.PipelineProject(projectStack, 'Project');

        const pipelineStack = new Stack(app, 'PipelineStack', {
          env: {
            region: 'us-west-2',
            account: '012345678913',
          },
        });
        const sourceOutput = new codepipeline.Artifact();
        const pipeline = new codepipeline.Pipeline(pipelineStack, 'Pipeline', {
          stages: [
            {
              stageName: 'Source',
              actions: [new cpactions.CodeCommitSourceAction({
                actionName: 'CodeCommit',
                repository: codecommit.Repository.fromRepositoryName(pipelineStack, 'Repo', 'repo-name'),
                output: sourceOutput,
              })],
            },
          ],
        });
        const buildStage = pipeline.addStage({
          stageName: 'Build',
        });

        // this works fine - no outputs!
        buildStage.addAction(new cpactions.CodeBuildAction({
          actionName: 'Build1',
          input: sourceOutput,
          project,
        }));

        const buildAction2 = new cpactions.CodeBuildAction({
          actionName: 'Build2',
          input: sourceOutput,
          project,
          outputs: [new codepipeline.Artifact()],
        });

        test.throws(() => {
          buildStage.addAction(buildAction2);
        }, /https:\/\/github\.com\/aws\/aws-cdk\/issues\/4169/);

        test.done();
      },
    },

    'can be backed by an imported project'(test: Test) {
      const stack = new Stack();

      const codeBuildProject = codebuild.PipelineProject.fromProjectName(stack, 'CodeBuild',
        'codeBuildProjectNameInAnotherAccount');

      const sourceOutput = new codepipeline.Artifact();
      new codepipeline.Pipeline(stack, 'Pipeline', {
        stages: [
          {
            stageName: 'Source',
            actions: [
              new cpactions.S3SourceAction({
                actionName: 'S3_Source',
                bucket: new s3.Bucket(stack, 'Bucket'),
                bucketKey: 'key',
                output: sourceOutput,
              }),
            ],
          },
          {
            stageName: 'Build',
            actions: [
              new cpactions.CodeBuildAction({
                actionName: 'CodeBuild',
                input: sourceOutput,
                project: codeBuildProject,
              }),
            ],
          },
        ],
      });

      expect(stack).to(haveResourceLike('AWS::CodePipeline::Pipeline', {
        'Stages': [
          {
            'Name': 'Source',
          },
          {
            'Name': 'Build',
            'Actions': [
              {
                'Name': 'CodeBuild',
                'Configuration': {
                  'ProjectName': 'codeBuildProjectNameInAnotherAccount',
                },
              },
            ],
          },
        ],
      }));

      test.done();
    },

    'exposes variables for other actions to consume'(test: Test) {
      const stack = new Stack();

      const sourceOutput = new codepipeline.Artifact();
      const codeBuildAction = new cpactions.CodeBuildAction({
        actionName: 'CodeBuild',
        input: sourceOutput,
        project: new codebuild.PipelineProject(stack, 'CodeBuild', {
          buildSpec: codebuild.BuildSpec.fromObject({
            version: '0.2',
            env: {
              'exported-variables': [
                'SomeVar',
              ],
            },
            phases: {
              build: {
                commands: [
                  'export SomeVar="Some Value"',
                ],
              },
            },
          }),
        }),
      });
      new codepipeline.Pipeline(stack, 'Pipeline', {
        stages: [
          {
            stageName: 'Source',
            actions: [
              new cpactions.S3SourceAction({
                actionName: 'S3_Source',
                bucket: s3.Bucket.fromBucketName(stack, 'Bucket', 'bucket'),
                bucketKey: 'key',
                output: sourceOutput,
              }),
            ],
          },
          {
            stageName: 'Build',
            actions: [
              codeBuildAction,
              new cpactions.ManualApprovalAction({
                actionName: 'Approve',
                additionalInformation: codeBuildAction.variable('SomeVar'),
                notificationTopic: sns.Topic.fromTopicArn(stack, 'Topic', 'arn:aws:sns:us-east-1:123456789012:mytopic'),
                runOrder: 2,
              }),
            ],
          },
        ],
      });

      expect(stack).to(haveResourceLike('AWS::CodePipeline::Pipeline', {
        'Stages': [
          {
            'Name': 'Source',
          },
          {
            'Name': 'Build',
            'Actions': [
              {
                'Name': 'CodeBuild',
                'Namespace': 'Build_CodeBuild_NS',
              },
              {
                'Name': 'Approve',
                'Configuration': {
                  'CustomData': '#{Build_CodeBuild_NS.SomeVar}',
                },
              },
            ],
          },
        ],
      }));

      test.done();
    },

    'sets the BatchEnabled configuration'(test: Test) {
      const stack = new Stack();

      const codeBuildProject = new codebuild.PipelineProject(stack, 'CodeBuild');

      const sourceOutput = new codepipeline.Artifact();
      new codepipeline.Pipeline(stack, 'Pipeline', {
        stages: [
          {
            stageName: 'Source',
            actions: [
              new cpactions.S3SourceAction({
                actionName: 'S3_Source',
                bucket: new s3.Bucket(stack, 'Bucket'),
                bucketKey: 'key',
                output: sourceOutput,
              }),
            ],
          },
          {
            stageName: 'Build',
            actions: [
              new cpactions.CodeBuildAction({
                actionName: 'CodeBuild',
                input: sourceOutput,
                project: codeBuildProject,
                executeBatchBuild: true,
              }),
            ],
          },
        ],
      });

      expect(stack).to(haveResourceLike('AWS::CodePipeline::Pipeline', {
        'Stages': [
          {
            'Name': 'Source',
          },
          {
            'Name': 'Build',
            'Actions': [
              {
                'Name': 'CodeBuild',
                'Configuration': {
                  'BatchEnabled': 'true',
                },
              },
            ],
          },
        ],
      }));

      test.done();
    },

    'sets the CombineArtifacts configuration'(test: Test) {
      const stack = new Stack();

      const codeBuildProject = new codebuild.PipelineProject(stack, 'CodeBuild');

      const sourceOutput = new codepipeline.Artifact();
      new codepipeline.Pipeline(stack, 'Pipeline', {
        stages: [
          {
            stageName: 'Source',
            actions: [
              new cpactions.S3SourceAction({
                actionName: 'S3_Source',
                bucket: new s3.Bucket(stack, 'Bucket'),
                bucketKey: 'key',
                output: sourceOutput,
              }),
            ],
          },
          {
            stageName: 'Build',
            actions: [
              new cpactions.CodeBuildAction({
                actionName: 'CodeBuild',
                input: sourceOutput,
                project: codeBuildProject,
                executeBatchBuild: true,
                combineBatchBuildArtifacts: true,
              }),
            ],
          },
        ],
      });

      expect(stack).to(haveResourceLike('AWS::CodePipeline::Pipeline', {
        'Stages': [
          {
            'Name': 'Source',
          },
          {
            'Name': 'Build',
            'Actions': [
              {
                'Name': 'CodeBuild',
                'Configuration': {
                  'BatchEnabled': 'true',
                  'CombineArtifacts': 'true',
                },
              },
            ],
          },
        ],
      }));

      test.done();
    },

    'environment variables': {
      'should fail by default when added to a Pipeline while using a secret value in a plaintext variable'(test: Test) {
        const stack = new Stack();

        const sourceOutput = new codepipeline.Artifact();
        const pipeline = new codepipeline.Pipeline(stack, 'Pipeline', {
          stages: [
            {
              stageName: 'Source',
              actions: [new cpactions.CodeCommitSourceAction({
                actionName: 'source',
                repository: new codecommit.Repository(stack, 'CodeCommitRepo', {
                  repositoryName: 'my-repo',
                }),
                output: sourceOutput,
              })],
            },
          ],
        });

        const buildStage = pipeline.addStage({
          stageName: 'Build',
        });
        const codeBuildProject = new codebuild.PipelineProject(stack, 'CodeBuild');
        const buildAction = new cpactions.CodeBuildAction({
          actionName: 'Build',
          project: codeBuildProject,
          input: sourceOutput,
          environmentVariables: {
            'X': {
              value: SecretValue.secretsManager('my-secret'),
            },
          },
        });

        test.throws(() => {
          buildStage.addAction(buildAction);
        }, /Plaintext environment variable 'X' contains a secret value!/);

        test.done();
      },

      "should allow opting out of the 'secret value in a plaintext variable' validation"(test: Test) {
        const stack = new Stack();

        const sourceOutput = new codepipeline.Artifact();
        new codepipeline.Pipeline(stack, 'Pipeline', {
          stages: [
            {
              stageName: 'Source',
              actions: [new cpactions.CodeCommitSourceAction({
                actionName: 'source',
                repository: new codecommit.Repository(stack, 'CodeCommitRepo', {
                  repositoryName: 'my-repo',
                }),
                output: sourceOutput,
              })],
            },
            {
              stageName: 'Build',
              actions: [new cpactions.CodeBuildAction({
                actionName: 'build',
                project: new codebuild.PipelineProject(stack, 'CodeBuild'),
                input: sourceOutput,
                environmentVariables: {
                  'X': {
                    value: SecretValue.secretsManager('my-secret'),
                  },
                },
                checkSecretsInPlainTextEnvVariables: false,
              })],
            },
          ],
        });

        test.done();
      },
    },
  },
});
