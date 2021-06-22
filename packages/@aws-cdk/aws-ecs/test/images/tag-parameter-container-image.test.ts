import { expect, haveResourceLike, SynthUtils } from '@aws-cdk/assert-internal';
import * as ecr from '@aws-cdk/aws-ecr';
import * as cdk from '@aws-cdk/core';
import { nodeunitShim, Test } from 'nodeunit-shim';
import * as ecs from '../../lib';

nodeunitShim({
  'TagParameter container image': {
    'throws an error when tagParameterName() is used without binding the image'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const repository = new ecr.Repository(stack, 'Repository');
      const tagParameterContainerImage = new ecs.TagParameterContainerImage(repository);
      new cdk.CfnOutput(stack, 'Output', {
        value: tagParameterContainerImage.tagParameterName,
      });

      test.throws(() => {
        SynthUtils.synthesize(stack);
      }, /TagParameterContainerImage must be used in a container definition when using tagParameterName/);

      test.done();
    },

    'throws an error when tagParameterValue() is used without binding the image'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const repository = new ecr.Repository(stack, 'Repository');
      const tagParameterContainerImage = new ecs.TagParameterContainerImage(repository);
      new cdk.CfnOutput(stack, 'Output', {
        value: tagParameterContainerImage.tagParameterValue,
      });

      test.throws(() => {
        SynthUtils.synthesize(stack);
      }, /TagParameterContainerImage must be used in a container definition when using tagParameterValue/);

      test.done();
    },

    'can be used in a cross-account manner'(test: Test) {
      // GIVEN
      const app = new cdk.App();
      const pipelineStack = new cdk.Stack(app, 'PipelineStack', {
        env: {
          account: 'pipeline-account',
          region: 'us-west-1',
        },
      });
      const repositoryName = 'my-ecr-repo';
      const repository = new ecr.Repository(pipelineStack, 'Repository', {
        repositoryName: repositoryName,
      });
      const tagParameterContainerImage = new ecs.TagParameterContainerImage(repository);

      const serviceStack = new cdk.Stack(app, 'ServiceStack', {
        env: {
          account: 'service-account',
          region: 'us-west-1',
        },
      });
      const fargateTaskDefinition = new ecs.FargateTaskDefinition(serviceStack, 'ServiceTaskDefinition');

      // WHEN
      fargateTaskDefinition.addContainer('Container', {
        image: tagParameterContainerImage,
      });

      // THEN
      expect(pipelineStack).to(haveResourceLike('AWS::ECR::Repository', {
        RepositoryName: repositoryName,
        RepositoryPolicyText: {
          Statement: [{
            Action: [
              'ecr:BatchCheckLayerAvailability',
              'ecr:GetDownloadUrlForLayer',
              'ecr:BatchGetImage',
            ],
            Effect: 'Allow',
            Principal: {
              AWS: {
                'Fn::Join': ['', [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':iam::service-account:role/servicestackionexecutionrolee7e2d9a783a54eb795f4',
                ]],
              },
            },
          }],
        },
      }));
      expect(serviceStack).to(haveResourceLike('AWS::IAM::Role', {
        RoleName: 'servicestackionexecutionrolee7e2d9a783a54eb795f4',
      }));
      expect(serviceStack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
        ContainerDefinitions: [
          {
            Image: {
              'Fn::Join': ['', [
                {
                  'Fn::Select': [4, {
                    'Fn::Split': [':', {
                      'Fn::Join': ['', [
                        'arn:',
                        { Ref: 'AWS::Partition' },
                        `:ecr:us-west-1:pipeline-account:repository/${repositoryName}`,
                      ]],
                    }],
                  }],
                },
                '.dkr.ecr.',
                {
                  'Fn::Select': [3, {
                    'Fn::Split': [':', {
                      'Fn::Join': ['', [
                        'arn:',
                        { Ref: 'AWS::Partition' },
                        `:ecr:us-west-1:pipeline-account:repository/${repositoryName}`,
                      ]],
                    }],
                  }],
                },
                '.',
                { Ref: 'AWS::URLSuffix' },
                `/${repositoryName}:`,
                { Ref: 'ServiceTaskDefinitionContainerImageTagParamCEC9D0BA' },
              ]],
            },
          },
        ],
      }));

      test.done();
    },
  },
});
