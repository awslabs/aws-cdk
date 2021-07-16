import { expect, haveResourceLike } from '@aws-cdk/assert-internal';
import { Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import { nodeunitShim, Test } from 'nodeunit-shim';
import * as cpactions from '../../lib';
import { TestFixture } from './TestFixture';
/* eslint-disable quote-props */

nodeunitShim({
  'CloudFormationStackSet creates correct IAM policy and Pipeline action variants': {
    'creates correct resources with no admin role specified (self managed)'(test: Test) {
      // GIVEN
      const stack = new TestFixture();

      stack.deployStage.addAction(new cpactions.CloudFormationStackSetAction({
        actionName: 'StackSetUpdate',
        description: 'desc',
        stackSetName: 'MyStack',
        templatePath: stack.sourceOutput.atPath('template.yaml'),
        parameters: cpactions.StackSetParameters.fromArtifactPath(stack.sourceOutput.atPath('parameters.json')),
        cfnCapabilities: [
          cdk.CfnCapabilities.NAMED_IAM,
        ],
        deploymentTargetsPath: stack.sourceOutput.atPath('accounts.json'),
        regions: ['us-east-1', 'us-west-1', 'ca-central-1'],
        failureTolerancePercentage: 50,
        maxConcurrentPercentage: 25,
      }));

      expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
        'PolicyDocument': {
          'Statement': [
            {
              'Action': [
                'cloudformation:CreateStackInstances',
                'cloudformation:CreateStackSet',
                'cloudformation:DescribeStackSet',
                'cloudformation:DescribeStackSetOperation',
                'cloudformation:ListStackInstances',
                'cloudformation:UpdateStackSet',
              ],
              'Effect': 'Allow',
              'Resource': {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    {
                      'Ref': 'AWS::Partition',
                    },
                    ':cloudformation:',
                    {
                      'Ref': 'AWS::Region',
                    },
                    ':',
                    {
                      'Ref': 'AWS::AccountId',
                    },
                    ':stackset/MyStack:*',
                  ],
                ],
              },
            },
            {
              'Action': 'iam:PassRole',
              'Effect': 'Allow',
              'Resource': {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    {
                      'Ref': 'AWS::Partition',
                    },
                    ':iam::',
                    {
                      'Ref': 'AWS::AccountId',
                    },
                    ':role/AWSCloudFormationStackSetAdministrationRole',
                  ],
                ],
              },
            },
            {
              'Action': [
                's3:GetObject*',
                's3:GetBucket*',
                's3:List*',
              ],
              'Effect': 'Allow',
              'Resource': [
                {
                  'Fn::GetAtt': [
                    'PipelineArtifactsBucket22248F97',
                    'Arn',
                  ],
                },
                {
                  'Fn::Join': [
                    '',
                    [
                      {
                        'Fn::GetAtt': [
                          'PipelineArtifactsBucket22248F97',
                          'Arn',
                        ],
                      },
                      '/*',
                    ],
                  ],
                },
              ],
            },
            {
              'Action': [
                'kms:Decrypt',
                'kms:DescribeKey',
              ],
              'Effect': 'Allow',
              'Resource': {
                'Fn::GetAtt': [
                  'PipelineArtifactsBucketEncryptionKey01D58D69',
                  'Arn',
                ],
              },
            },
          ],
        },
        'Roles': [
          {
            'Ref': 'PipelineDeployStackSetUpdateCodePipelineActionRole3EDBB32C',
          },
        ],
      }));

      expect(stack).to(haveResourceLike('AWS::CodePipeline::Pipeline', {
        'Stages': [
          { 'Name': 'Source' /* don't care about the rest */ },
          {
            'Name': 'Deploy',
            'Actions': [
              {
                'Configuration': {
                  'StackSetName': 'MyStack',
                  'Description': 'desc',
                  'TemplatePath': 'SourceArtifact::template.yaml',
                  'Parameters': 'SourceArtifact::parameters.json',
                  'Capabilities': 'CAPABILITY_NAMED_IAM',
                  'DeploymentTargets': 'SourceArtifact::accounts.json',
                  'FailureTolerancePercentage': 50,
                  'MaxConcurrentPercentage': 25,
                  'Regions': 'us-east-1,us-west-1,ca-central-1',
                },
                'InputArtifacts': [{ 'Name': 'SourceArtifact' }],
                'Name': 'StackSetUpdate',
              },
            ],
          },
        ],
      }));

      test.done();
    },

    'creates correct resources with no admin role specified (service managed)'(test: Test) {
      // GIVEN
      const stack = new TestFixture();

      stack.deployStage.addAction(new cpactions.CloudFormationStackSetAction({
        actionName: 'StackSetUpdate',
        description: 'desc',
        stackSetName: 'MyStack',
        templatePath: stack.sourceOutput.atPath('template.yaml'),
        parameters: cpactions.StackSetParameters.fromArtifactPath(stack.sourceOutput.atPath('parameters.json')),
        cfnCapabilities: [
          cdk.CfnCapabilities.NAMED_IAM,
        ],
        permissionModel: cpactions.StackSetPermissionModel.SERVICE_MANAGED,
        deploymentTargetsPath: stack.sourceOutput.atPath('accounts.json'),
        regions: ['us-east-1', 'us-west-1', 'ca-central-1'],
        failureTolerancePercentage: 50,
        maxConcurrentPercentage: 25,
      }));

      expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
        'PolicyDocument': {
          'Statement': [
            {
              'Action': [
                'cloudformation:CreateStackInstances',
                'cloudformation:CreateStackSet',
                'cloudformation:DescribeStackSet',
                'cloudformation:DescribeStackSetOperation',
                'cloudformation:ListStackInstances',
                'cloudformation:UpdateStackSet',
              ],
              'Effect': 'Allow',
              'Resource': {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    {
                      'Ref': 'AWS::Partition',
                    },
                    ':cloudformation:',
                    {
                      'Ref': 'AWS::Region',
                    },
                    ':',
                    {
                      'Ref': 'AWS::AccountId',
                    },
                    ':stackset/MyStack:*',
                  ],
                ],
              },
            },
            {
              'Action': [
                's3:GetObject*',
                's3:GetBucket*',
                's3:List*',
              ],
              'Effect': 'Allow',
              'Resource': [
                {
                  'Fn::GetAtt': [
                    'PipelineArtifactsBucket22248F97',
                    'Arn',
                  ],
                },
                {
                  'Fn::Join': [
                    '',
                    [
                      {
                        'Fn::GetAtt': [
                          'PipelineArtifactsBucket22248F97',
                          'Arn',
                        ],
                      },
                      '/*',
                    ],
                  ],
                },
              ],
            },
            {
              'Action': [
                'kms:Decrypt',
                'kms:DescribeKey',
              ],
              'Effect': 'Allow',
              'Resource': {
                'Fn::GetAtt': [
                  'PipelineArtifactsBucketEncryptionKey01D58D69',
                  'Arn',
                ],
              },
            },
          ],
        },
        'Roles': [
          {
            'Ref': 'PipelineDeployStackSetUpdateCodePipelineActionRole3EDBB32C',
          },
        ],
      }));

      expect(stack).to(haveResourceLike('AWS::CodePipeline::Pipeline', {
        'Stages': [
          { 'Name': 'Source' /* don't care about the rest */ },
          {
            'Name': 'Deploy',
            'Actions': [
              {
                'Configuration': {
                  'StackSetName': 'MyStack',
                  'Description': 'desc',
                  'TemplatePath': 'SourceArtifact::template.yaml',
                  'Parameters': 'SourceArtifact::parameters.json',
                  'Capabilities': 'CAPABILITY_NAMED_IAM',
                  'DeploymentTargets': 'SourceArtifact::accounts.json',
                  'FailureTolerancePercentage': 50,
                  'MaxConcurrentPercentage': 25,
                  'Regions': 'us-east-1,us-west-1,ca-central-1',
                  'PermissionModel': 'SERVICE_MANAGED',
                },
                'InputArtifacts': [{ 'Name': 'SourceArtifact' }],
                'Name': 'StackSetUpdate',
              },
            ],
          },
        ],
      }));

      test.done();
    },

    'creates correct resources with admin role specified'(test: Test) {
      // GIVEN
      const stack = new TestFixture();

      const adminRole = new Role(stack, 'ChangeSetRole', {
        assumedBy: new ServicePrincipal('cloudformation.amazonaws.com'),
      });

      stack.deployStage.addAction(new cpactions.CloudFormationStackSetAction({
        actionName: 'StackSetUpdate',
        description: 'desc',
        stackSetName: 'MyStack',
        templatePath: stack.sourceOutput.atPath('template.yaml'),
        parameters: cpactions.StackSetParameters.fromArtifactPath(stack.sourceOutput.atPath('parameters.json')),
        administrationRole: adminRole,
        cfnCapabilities: [
          cdk.CfnCapabilities.NAMED_IAM,
        ],
        executionRoleName: 'Exec',
        deploymentTargetsPath: stack.sourceOutput.atPath('accounts.json'),
        regions: ['us-east-1', 'us-west-1', 'ca-central-1'],
        failureTolerancePercentage: 50,
        maxConcurrentPercentage: 25,
      }));

      expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
        'PolicyDocument': {
          'Statement': [
            {
              'Action': [
                'cloudformation:CreateStackInstances',
                'cloudformation:CreateStackSet',
                'cloudformation:DescribeStackSet',
                'cloudformation:DescribeStackSetOperation',
                'cloudformation:ListStackInstances',
                'cloudformation:UpdateStackSet',
              ],
              'Effect': 'Allow',
              'Resource': {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    {
                      'Ref': 'AWS::Partition',
                    },
                    ':cloudformation:',
                    {
                      'Ref': 'AWS::Region',
                    },
                    ':',
                    {
                      'Ref': 'AWS::AccountId',
                    },
                    ':stackset/MyStack:*',
                  ],
                ],
              },
            },
            {
              'Action': 'iam:PassRole',
              'Effect': 'Allow',
              'Resource': {
                'Fn::GetAtt': [
                  'ChangeSetRole0BCF99E6',
                  'Arn',
                ],
              },
            },
            {
              'Action': [
                's3:GetObject*',
                's3:GetBucket*',
                's3:List*',
              ],
              'Effect': 'Allow',
              'Resource': [
                {
                  'Fn::GetAtt': [
                    'PipelineArtifactsBucket22248F97',
                    'Arn',
                  ],
                },
                {
                  'Fn::Join': [
                    '',
                    [
                      {
                        'Fn::GetAtt': [
                          'PipelineArtifactsBucket22248F97',
                          'Arn',
                        ],
                      },
                      '/*',
                    ],
                  ],
                },
              ],
            },
            {
              'Action': [
                'kms:Decrypt',
                'kms:DescribeKey',
              ],
              'Effect': 'Allow',
              'Resource': {
                'Fn::GetAtt': [
                  'PipelineArtifactsBucketEncryptionKey01D58D69',
                  'Arn',
                ],
              },
            },
          ],
        },
        'Roles': [
          {
            'Ref': 'PipelineDeployStackSetUpdateCodePipelineActionRole3EDBB32C',
          },
        ],
      }));

      expect(stack).to(haveResourceLike('AWS::CodePipeline::Pipeline', {
        'Stages': [
          { 'Name': 'Source' /* don't care about the rest */ },
          {
            'Name': 'Deploy',
            'Actions': [
              {
                'Configuration': {
                  'StackSetName': 'MyStack',
                  'Description': 'desc',
                  'TemplatePath': 'SourceArtifact::template.yaml',
                  'Parameters': 'SourceArtifact::parameters.json',
                  'Capabilities': 'CAPABILITY_NAMED_IAM',
                  'DeploymentTargets': 'SourceArtifact::accounts.json',
                  'FailureTolerancePercentage': 50,
                  'MaxConcurrentPercentage': 25,
                  'Regions': 'us-east-1,us-west-1,ca-central-1',
                },
                'InputArtifacts': [{ 'Name': 'SourceArtifact' }],
                'Name': 'StackSetUpdate',
              },
            ],
          },
        ],
      }));

      test.done();
    },

    'creates correct pipeline resource with target list'(test: Test) {
      // GIVEN
      const stack = new TestFixture();

      const adminRole = new Role(stack, 'ChangeSetRole', {
        assumedBy: new ServicePrincipal('cloudformation.amazonaws.com'),
      });

      stack.deployStage.addAction(new cpactions.CloudFormationStackSetAction({
        actionName: 'StackSetUpdate',
        description: 'desc',
        stackSetName: 'MyStack',
        templatePath: stack.sourceOutput.atPath('template.yaml'),
        parameters: cpactions.StackSetParameters.fromArtifactPath(stack.sourceOutput.atPath('parameters.json')),
        administrationRole: adminRole,
        cfnCapabilities: [
          cdk.CfnCapabilities.NAMED_IAM,
        ],
        executionRoleName: 'Exec',
        deploymentTargets: ['11111111111', '22222222222'],
        regions: ['us-east-1', 'us-west-1', 'ca-central-1'],
        failureTolerancePercentage: 50,
        maxConcurrentPercentage: 25,
      }));

      expect(stack).to(haveResourceLike('AWS::CodePipeline::Pipeline', {
        'Stages': [
          { 'Name': 'Source' /* don't care about the rest */ },
          {
            'Name': 'Deploy',
            'Actions': [
              {
                'Configuration': {
                  'StackSetName': 'MyStack',
                  'Description': 'desc',
                  'TemplatePath': 'SourceArtifact::template.yaml',
                  'Parameters': 'SourceArtifact::parameters.json',
                  'Capabilities': 'CAPABILITY_NAMED_IAM',
                  'DeploymentTargets': '11111111111,22222222222',
                  'FailureTolerancePercentage': 50,
                  'MaxConcurrentPercentage': 25,
                  'Regions': 'us-east-1,us-west-1,ca-central-1',
                },
                'InputArtifacts': [{ 'Name': 'SourceArtifact' }],
                'Name': 'StackSetUpdate',
              },
            ],
          },
        ],
      }));

      test.done();
    },

    'creates correct pipeline resource with parameter list'(test: Test) {
      // GIVEN
      const stack = new TestFixture();

      const adminRole = new Role(stack, 'ChangeSetRole', {
        assumedBy: new ServicePrincipal('cloudformation.amazonaws.com'),
      });

      stack.deployStage.addAction(new cpactions.CloudFormationStackSetAction({
        actionName: 'StackSetUpdate',
        description: 'desc',
        stackSetName: 'MyStack',
        templatePath: stack.sourceOutput.atPath('template.yaml'),
        parameters: cpactions.StackSetParameters.fromLiteral({
          key0: 'val0',
          key1: 'val1',
          key2: null,
          key3: undefined,
        }),
        administrationRole: adminRole,
        cfnCapabilities: [
          cdk.CfnCapabilities.NAMED_IAM,
        ],
        executionRoleName: 'Exec',
        deploymentTargetsPath: stack.sourceOutput.atPath('accounts.json'),
        regions: ['us-east-1', 'us-west-1', 'ca-central-1'],
        failureTolerancePercentage: 50,
        maxConcurrentPercentage: 25,
      }));

      expect(stack).to(haveResourceLike('AWS::CodePipeline::Pipeline', {
        'Stages': [
          { 'Name': 'Source' /* don't care about the rest */ },
          {
            'Name': 'Deploy',
            'Actions': [
              {
                'Configuration': {
                  'StackSetName': 'MyStack',
                  'Description': 'desc',
                  'TemplatePath': 'SourceArtifact::template.yaml',
                  'Parameters': 'ParameterKey=key0,ParameterValue=val0 ParameterKey=key1,ParameterValue=val1 ParameterKey=key2,UsePreviousValue=true ParameterKey=key3,UsePreviousValue=true',
                  'Capabilities': 'CAPABILITY_NAMED_IAM',
                  'DeploymentTargets': 'SourceArtifact::accounts.json',
                  'FailureTolerancePercentage': 50,
                  'MaxConcurrentPercentage': 25,
                  'Regions': 'us-east-1,us-west-1,ca-central-1',
                },
                'InputArtifacts': [{ 'Name': 'SourceArtifact' }],
                'Name': 'StackSetUpdate',
              },
            ],
          },
        ],
      }));

      test.done();
    },

  },
});
