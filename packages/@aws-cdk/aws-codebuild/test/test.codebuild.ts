import { ABSENT, expect, haveResource, haveResourceLike } from '@aws-cdk/assert-internal';
import * as codecommit from '@aws-cdk/aws-codecommit';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as kms from '@aws-cdk/aws-kms';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import { Test } from 'nodeunit';
import * as codebuild from '../lib';
import { CodePipelineSource } from '../lib/codepipeline-source';
import { NoSource } from '../lib/no-source';

/* eslint-disable quote-props */

export = {
  'default properties': {
    'with CodePipeline source'(test: Test) {
      const stack = new cdk.Stack();

      new codebuild.PipelineProject(stack, 'MyProject');

      expect(stack).toMatch({
        'Resources': {
          'MyProjectRole9BBE5233': {
            'Type': 'AWS::IAM::Role',
            'Properties': {
              'AssumeRolePolicyDocument': {
                'Statement': [
                  {
                    'Action': 'sts:AssumeRole',
                    'Effect': 'Allow',
                    'Principal': {
                      'Service': 'codebuild.amazonaws.com',
                    },
                  },
                ],
                'Version': '2012-10-17',
              },
            },
          },
          'MyProjectRoleDefaultPolicyB19B7C29': {
            'Type': 'AWS::IAM::Policy',
            'Properties': {
              'PolicyDocument': {
                'Statement': [
                  {
                    'Action': [
                      'logs:CreateLogGroup',
                      'logs:CreateLogStream',
                      'logs:PutLogEvents',
                    ],
                    'Effect': 'Allow',
                    'Resource': [
                      {
                        'Fn::Join': [
                          '',
                          [
                            'arn:',
                            {
                              'Ref': 'AWS::Partition',
                            },
                            ':logs:',
                            {
                              'Ref': 'AWS::Region',
                            },
                            ':',
                            {
                              'Ref': 'AWS::AccountId',
                            },
                            ':log-group:/aws/codebuild/',
                            {
                              'Ref': 'MyProject39F7B0AE',
                            },
                          ],
                        ],
                      },
                      {
                        'Fn::Join': [
                          '',
                          [
                            'arn:',
                            {
                              'Ref': 'AWS::Partition',
                            },
                            ':logs:',
                            {
                              'Ref': 'AWS::Region',
                            },
                            ':',
                            {
                              'Ref': 'AWS::AccountId',
                            },
                            ':log-group:/aws/codebuild/',
                            {
                              'Ref': 'MyProject39F7B0AE',
                            },
                            ':*',
                          ],
                        ],
                      },
                    ],
                  },
                  {
                    'Action': [
                      'codebuild:CreateReportGroup',
                      'codebuild:CreateReport',
                      'codebuild:UpdateReport',
                      'codebuild:BatchPutTestCases',
                      'codebuild:BatchPutCodeCoverages',
                    ],
                    'Effect': 'Allow',
                    'Resource': {
                      'Fn::Join': ['', [
                        'arn:',
                        { 'Ref': 'AWS::Partition' },
                        ':codebuild:',
                        { 'Ref': 'AWS::Region' },
                        ':',
                        { 'Ref': 'AWS::AccountId' },
                        ':report-group/',
                        { 'Ref': 'MyProject39F7B0AE' },
                        '-*',
                      ]],
                    },
                  },
                ],
                'Version': '2012-10-17',
              },
              'PolicyName': 'MyProjectRoleDefaultPolicyB19B7C29',
              'Roles': [
                {
                  'Ref': 'MyProjectRole9BBE5233',
                },
              ],
            },
          },
          'MyProject39F7B0AE': {
            'Type': 'AWS::CodeBuild::Project',
            'Properties': {
              'Source': {
                'Type': 'CODEPIPELINE',
              },
              'Artifacts': {
                'Type': 'CODEPIPELINE',
              },
              'ServiceRole': {
                'Fn::GetAtt': [
                  'MyProjectRole9BBE5233',
                  'Arn',
                ],
              },
              'Environment': {
                'Type': 'LINUX_CONTAINER',
                'PrivilegedMode': false,
                'Image': 'aws/codebuild/standard:1.0',
                'ImagePullCredentialsType': 'CODEBUILD',
                'ComputeType': 'BUILD_GENERAL1_SMALL',
              },
              'EncryptionKey': 'alias/aws/s3',
            },
          },
        },
      });

      test.done();
    },
    'with CodeCommit source'(test: Test) {
      const stack = new cdk.Stack();

      const repo = new codecommit.Repository(stack, 'MyRepo', {
        repositoryName: 'hello-cdk',
      });

      const source = codebuild.Source.codeCommit({ repository: repo, cloneDepth: 2 });

      new codebuild.Project(stack, 'MyProject', {
        source,
      });

      expect(stack).toMatch({
        'Resources': {
          'MyRepoF4F48043': {
            'Type': 'AWS::CodeCommit::Repository',
            'Properties': {
              'RepositoryName': 'hello-cdk',
            },
          },
          'MyProjectRole9BBE5233': {
            'Type': 'AWS::IAM::Role',
            'Properties': {
              'AssumeRolePolicyDocument': {
                'Statement': [
                  {
                    'Action': 'sts:AssumeRole',
                    'Effect': 'Allow',
                    'Principal': {
                      'Service': 'codebuild.amazonaws.com',
                    },
                  },
                ],
                'Version': '2012-10-17',
              },
            },
          },
          'MyProjectRoleDefaultPolicyB19B7C29': {
            'Type': 'AWS::IAM::Policy',
            'Properties': {
              'PolicyDocument': {
                'Statement': [
                  {
                    'Action': 'codecommit:GitPull',
                    'Effect': 'Allow',
                    'Resource': {
                      'Fn::GetAtt': [
                        'MyRepoF4F48043',
                        'Arn',
                      ],
                    },
                  },
                  {
                    'Action': [
                      'logs:CreateLogGroup',
                      'logs:CreateLogStream',
                      'logs:PutLogEvents',
                    ],
                    'Effect': 'Allow',
                    'Resource': [
                      {
                        'Fn::Join': [
                          '',
                          [
                            'arn:',
                            {
                              'Ref': 'AWS::Partition',
                            },
                            ':logs:',
                            {
                              'Ref': 'AWS::Region',
                            },
                            ':',
                            {
                              'Ref': 'AWS::AccountId',
                            },
                            ':log-group:/aws/codebuild/',
                            {
                              'Ref': 'MyProject39F7B0AE',
                            },
                          ],
                        ],
                      },
                      {
                        'Fn::Join': [
                          '',
                          [
                            'arn:',
                            {
                              'Ref': 'AWS::Partition',
                            },
                            ':logs:',
                            {
                              'Ref': 'AWS::Region',
                            },
                            ':',
                            {
                              'Ref': 'AWS::AccountId',
                            },
                            ':log-group:/aws/codebuild/',
                            {
                              'Ref': 'MyProject39F7B0AE',
                            },
                            ':*',
                          ],
                        ],
                      },
                    ],
                  },
                  {
                    'Action': [
                      'codebuild:CreateReportGroup',
                      'codebuild:CreateReport',
                      'codebuild:UpdateReport',
                      'codebuild:BatchPutTestCases',
                      'codebuild:BatchPutCodeCoverages',
                    ],
                    'Effect': 'Allow',
                    'Resource': {
                      'Fn::Join': ['', [
                        'arn:',
                        { 'Ref': 'AWS::Partition' },
                        ':codebuild:',
                        { 'Ref': 'AWS::Region' },
                        ':',
                        { 'Ref': 'AWS::AccountId' },
                        ':report-group/',
                        { 'Ref': 'MyProject39F7B0AE' },
                        '-*',
                      ]],
                    },
                  },
                ],
                'Version': '2012-10-17',
              },
              'PolicyName': 'MyProjectRoleDefaultPolicyB19B7C29',
              'Roles': [
                {
                  'Ref': 'MyProjectRole9BBE5233',
                },
              ],
            },
          },
          'MyProject39F7B0AE': {
            'Type': 'AWS::CodeBuild::Project',
            'Properties': {
              'Artifacts': {
                'Type': 'NO_ARTIFACTS',
              },
              'Environment': {
                'ComputeType': 'BUILD_GENERAL1_SMALL',
                'Image': 'aws/codebuild/standard:1.0',
                'ImagePullCredentialsType': 'CODEBUILD',
                'PrivilegedMode': false,
                'Type': 'LINUX_CONTAINER',
              },
              'ServiceRole': {
                'Fn::GetAtt': [
                  'MyProjectRole9BBE5233',
                  'Arn',
                ],
              },
              'Source': {
                'Location': {
                  'Fn::GetAtt': [
                    'MyRepoF4F48043',
                    'CloneUrlHttp',
                  ],
                },
                'GitCloneDepth': 2,
                'Type': 'CODECOMMIT',
              },
              'EncryptionKey': 'alias/aws/s3',
            },
          },
        },
      });
      test.done();
    },
    'with S3Bucket source'(test: Test) {
      const stack = new cdk.Stack();
      const bucket = new s3.Bucket(stack, 'MyBucket');

      new codebuild.Project(stack, 'MyProject', {
        source: codebuild.Source.s3({
          bucket,
          path: 'path/to/source.zip',
        }),
        environment: {
          buildImage: codebuild.WindowsBuildImage.WINDOWS_BASE_2_0,
        },
      });

      expect(stack).toMatch({
        'Resources': {
          'MyBucketF68F3FF0': {
            'Type': 'AWS::S3::Bucket',
            'DeletionPolicy': 'Retain',
            'UpdateReplacePolicy': 'Retain',
          },
          'MyProjectRole9BBE5233': {
            'Type': 'AWS::IAM::Role',
            'Properties': {
              'AssumeRolePolicyDocument': {
                'Statement': [
                  {
                    'Action': 'sts:AssumeRole',
                    'Effect': 'Allow',
                    'Principal': {
                      'Service': 'codebuild.amazonaws.com',
                    },
                  },
                ],
                'Version': '2012-10-17',
              },
            },
          },
          'MyProjectRoleDefaultPolicyB19B7C29': {
            'Type': 'AWS::IAM::Policy',
            'Properties': {
              'PolicyDocument': {
                'Statement': [
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
                          'MyBucketF68F3FF0',
                          'Arn',
                        ],
                      },
                      {
                        'Fn::Join': [
                          '',
                          [
                            {
                              'Fn::GetAtt': [
                                'MyBucketF68F3FF0',
                                'Arn',
                              ],
                            },
                            '/path/to/source.zip',
                          ],
                        ],
                      },
                    ],
                  },
                  {
                    'Action': [
                      'logs:CreateLogGroup',
                      'logs:CreateLogStream',
                      'logs:PutLogEvents',
                    ],
                    'Effect': 'Allow',
                    'Resource': [
                      {
                        'Fn::Join': [
                          '',
                          [
                            'arn:',
                            {
                              'Ref': 'AWS::Partition',
                            },
                            ':logs:',
                            {
                              'Ref': 'AWS::Region',
                            },
                            ':',
                            {
                              'Ref': 'AWS::AccountId',
                            },
                            ':log-group:/aws/codebuild/',
                            {
                              'Ref': 'MyProject39F7B0AE',
                            },
                          ],
                        ],
                      },
                      {
                        'Fn::Join': [
                          '',
                          [
                            'arn:',
                            {
                              'Ref': 'AWS::Partition',
                            },
                            ':logs:',
                            {
                              'Ref': 'AWS::Region',
                            },
                            ':',
                            {
                              'Ref': 'AWS::AccountId',
                            },
                            ':log-group:/aws/codebuild/',
                            {
                              'Ref': 'MyProject39F7B0AE',
                            },
                            ':*',
                          ],
                        ],
                      },
                    ],
                  },
                  {
                    'Action': [
                      'codebuild:CreateReportGroup',
                      'codebuild:CreateReport',
                      'codebuild:UpdateReport',
                      'codebuild:BatchPutTestCases',
                      'codebuild:BatchPutCodeCoverages',
                    ],
                    'Effect': 'Allow',
                    'Resource': {
                      'Fn::Join': ['', [
                        'arn:',
                        { 'Ref': 'AWS::Partition' },
                        ':codebuild:',
                        { 'Ref': 'AWS::Region' },
                        ':',
                        { 'Ref': 'AWS::AccountId' },
                        ':report-group/',
                        { 'Ref': 'MyProject39F7B0AE' },
                        '-*',
                      ]],
                    },
                  },
                ],
                'Version': '2012-10-17',
              },
              'PolicyName': 'MyProjectRoleDefaultPolicyB19B7C29',
              'Roles': [
                {
                  'Ref': 'MyProjectRole9BBE5233',
                },
              ],
            },
          },
          'MyProject39F7B0AE': {
            'Type': 'AWS::CodeBuild::Project',
            'Properties': {
              'Artifacts': {
                'Type': 'NO_ARTIFACTS',
              },
              'Environment': {
                'ComputeType': 'BUILD_GENERAL1_MEDIUM',
                'Image': 'aws/codebuild/windows-base:2.0',
                'ImagePullCredentialsType': 'CODEBUILD',
                'PrivilegedMode': false,
                'Type': 'WINDOWS_CONTAINER',
              },
              'ServiceRole': {
                'Fn::GetAtt': [
                  'MyProjectRole9BBE5233',
                  'Arn',
                ],
              },
              'Source': {
                'Location': {
                  'Fn::Join': [
                    '',
                    [
                      {
                        'Ref': 'MyBucketF68F3FF0',
                      },
                      '/path/to/source.zip',
                    ],
                  ],
                },
                'Type': 'S3',
              },
              'EncryptionKey': 'alias/aws/s3',
            },
          },
        },
      });
      test.done();
    },
    'with GitHub source'(test: Test) {
      const stack = new cdk.Stack();

      new codebuild.Project(stack, 'Project', {
        source: codebuild.Source.gitHub({
          owner: 'testowner',
          repo: 'testrepo',
          cloneDepth: 3,
          fetchSubmodules: true,
          webhook: true,
          reportBuildStatus: false,
          webhookFilters: [
            codebuild.FilterGroup.inEventOf(codebuild.EventAction.PUSH).andTagIsNot('stable'),
            codebuild.FilterGroup.inEventOf(codebuild.EventAction.PULL_REQUEST_REOPENED).andBaseBranchIs('master'),
          ],
        }),
      });

      expect(stack).to(haveResource('AWS::CodeBuild::Project', {
        Source: {
          Type: 'GITHUB',
          Location: 'https://github.com/testowner/testrepo.git',
          ReportBuildStatus: false,
          GitCloneDepth: 3,
          GitSubmodulesConfig: {
            FetchSubmodules: true,
          },
        },
      }));

      expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
        Triggers: {
          Webhook: true,
          FilterGroups: [
            [
              { Type: 'EVENT', Pattern: 'PUSH' },
              { Type: 'HEAD_REF', Pattern: 'refs/tags/stable', ExcludeMatchedPattern: true },
            ],
            [
              { Type: 'EVENT', Pattern: 'PULL_REQUEST_REOPENED' },
              { Type: 'BASE_REF', Pattern: 'refs/heads/master' },
            ],
          ],
        },
      }));

      test.done();
    },
    'with GitHubEnterprise source'(test: Test) {
      const stack = new cdk.Stack();

      const pushFilterGroup = codebuild.FilterGroup.inEventOf(codebuild.EventAction.PUSH);
      new codebuild.Project(stack, 'MyProject', {
        source: codebuild.Source.gitHubEnterprise({
          httpsCloneUrl: 'https://github.testcompany.com/testowner/testrepo',
          ignoreSslErrors: true,
          cloneDepth: 4,
          webhook: true,
          reportBuildStatus: false,
          webhookFilters: [
            pushFilterGroup.andBranchIs('master'),
            pushFilterGroup.andBranchIs('develop'),
            pushFilterGroup.andFilePathIs('ReadMe.md'),
          ],
        }),
      });

      expect(stack).to(haveResource('AWS::CodeBuild::Project', {
        Source: {
          Type: 'GITHUB_ENTERPRISE',
          InsecureSsl: true,
          GitCloneDepth: 4,
          ReportBuildStatus: false,
          Location: 'https://github.testcompany.com/testowner/testrepo',
        },
      }));

      expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
        Triggers: {
          Webhook: true,
          FilterGroups: [
            [
              { Type: 'EVENT', Pattern: 'PUSH' },
              { Type: 'HEAD_REF', Pattern: 'refs/heads/master' },
            ],
            [
              { Type: 'EVENT', Pattern: 'PUSH' },
              { Type: 'HEAD_REF', Pattern: 'refs/heads/develop' },
            ],
            [
              { Type: 'EVENT', Pattern: 'PUSH' },
              { Type: 'FILE_PATH', Pattern: 'ReadMe.md' },
            ],
          ],
        },
      }));

      test.done();
    },
    'with Bitbucket source'(test: Test) {
      const stack = new cdk.Stack();

      new codebuild.Project(stack, 'Project', {
        source: codebuild.Source.bitBucket({
          owner: 'testowner',
          repo: 'testrepo',
          cloneDepth: 5,
          reportBuildStatus: false,
          webhookFilters: [
            codebuild.FilterGroup.inEventOf(
              codebuild.EventAction.PULL_REQUEST_CREATED,
              codebuild.EventAction.PULL_REQUEST_UPDATED,
              codebuild.EventAction.PULL_REQUEST_MERGED,
            ).andTagIs('v.*'),
            // duplicate event actions are fine
            codebuild.FilterGroup.inEventOf(codebuild.EventAction.PUSH, codebuild.EventAction.PUSH).andActorAccountIsNot('aws-cdk-dev'),
          ],
        }),
      });

      expect(stack).to(haveResource('AWS::CodeBuild::Project', {
        Source: {
          Type: 'BITBUCKET',
          Location: 'https://bitbucket.org/testowner/testrepo.git',
          GitCloneDepth: 5,
          ReportBuildStatus: false,
        },
      }));

      expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
        Triggers: {
          Webhook: true,
          FilterGroups: [
            [
              { Type: 'EVENT', Pattern: 'PULL_REQUEST_CREATED, PULL_REQUEST_UPDATED, PULL_REQUEST_MERGED' },
              { Type: 'HEAD_REF', Pattern: 'refs/tags/v.*' },
            ],
            [
              { Type: 'EVENT', Pattern: 'PUSH' },
              { Type: 'ACTOR_ACCOUNT_ID', Pattern: 'aws-cdk-dev', ExcludeMatchedPattern: true },
            ],
          ],
        },
      }));

      test.done();
    },

    'with webhookTriggersBatchBuild option'(test: Test) {
      const stack = new cdk.Stack();

      new codebuild.Project(stack, 'Project', {
        source: codebuild.Source.gitHub({
          owner: 'testowner',
          repo: 'testrepo',
          webhook: true,
          webhookTriggersBatchBuild: true,
        }),
      });

      expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
        Triggers: {
          Webhook: true,
          BuildType: 'BUILD_BATCH',
        },
        BuildBatchConfig: {
          ServiceRole: {
            'Fn::GetAtt': [
              'ProjectBatchServiceRoleF97A1CFB',
              'Arn',
            ],
          },
        },
      }));

      expect(stack).to(haveResourceLike('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: 'codebuild.amazonaws.com',
              },
            },
          ],
          Version: '2012-10-17',
        },
      }));

      expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: [
                'codebuild:StartBuild',
                'codebuild:StopBuild',
                'codebuild:RetryBuild',
              ],
              Effect: 'Allow',
              Resource: {
                'Fn::GetAtt': [
                  'ProjectC78D97AD',
                  'Arn',
                ],
              },
            },
          ],
          Version: '2012-10-17',
        },
      }));

      test.done();
    },

    'fail creating a Project when webhook false and webhookTriggersBatchBuild option'(test: Test) {
      [false, undefined].forEach((webhook) => {
        const stack = new cdk.Stack();

        test.throws(() => {
          new codebuild.Project(stack, 'Project', {
            source: codebuild.Source.gitHub({
              owner: 'testowner',
              repo: 'testrepo',
              webhook,
              webhookTriggersBatchBuild: true,
            }),
          });
        }, /`webhookTriggersBatchBuild` cannot be used when `webhook` is `false`/);
      });

      test.done();
    },

    'fail creating a Project when no build spec is given'(test: Test) {
      const stack = new cdk.Stack();

      test.throws(() => {
        new codebuild.Project(stack, 'MyProject', {
        });
      }, /buildSpec/);

      test.done();
    },
    'with VPC configuration'(test: Test) {
      const stack = new cdk.Stack();

      const bucket = new s3.Bucket(stack, 'MyBucket');
      const vpc = new ec2.Vpc(stack, 'MyVPC');
      const securityGroup = new ec2.SecurityGroup(stack, 'SecurityGroup1', {
        securityGroupName: 'Bob',
        vpc,
        allowAllOutbound: true,
        description: 'Example',
      });
      const project = new codebuild.Project(stack, 'MyProject', {
        source: codebuild.Source.s3({
          bucket,
          path: 'path/to/source.zip',
        }),
        vpc,
        securityGroups: [securityGroup],
      });
      expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
        'VpcConfig': {
          'SecurityGroupIds': [
            {
              'Fn::GetAtt': [
                'SecurityGroup1F554B36F',
                'GroupId',
              ],
            },
          ],
          'Subnets': [
            {
              'Ref': 'MyVPCPrivateSubnet1Subnet641543F4',
            },
            {
              'Ref': 'MyVPCPrivateSubnet2SubnetA420D3F0',
            },
          ],
          'VpcId': {
            'Ref': 'MyVPCAFB07A31',
          },
        },
      }));

      test.notEqual(project.connections, undefined);

      test.done();
    },
    'without VPC configuration but security group identified'(test: Test) {
      const stack = new cdk.Stack();

      const bucket = new s3.Bucket(stack, 'MyBucket');
      const vpc = new ec2.Vpc(stack, 'MyVPC');
      const securityGroup = new ec2.SecurityGroup(stack, 'SecurityGroup1', {
        securityGroupName: 'Bob',
        vpc,
        allowAllOutbound: true,
        description: 'Example',
      });

      test.throws(() =>
        new codebuild.Project(stack, 'MyProject', {
          source: codebuild.Source.s3({
            bucket,
            path: 'path/to/source.zip',
          }),
          securityGroups: [securityGroup],
        })
      , /Cannot configure 'securityGroup' or 'allowAllOutbound' without configuring a VPC/);
      test.done();
    },
    'with VPC configuration but allowAllOutbound identified'(test: Test) {
      const stack = new cdk.Stack();
      const bucket = new s3.Bucket(stack, 'MyBucket');
      const vpc = new ec2.Vpc(stack, 'MyVPC');
      const securityGroup = new ec2.SecurityGroup(stack, 'SecurityGroup1', {
        securityGroupName: 'Bob',
        vpc,
        allowAllOutbound: true,
        description: 'Example',
      });
      test.throws(() =>
        new codebuild.Project(stack, 'MyProject', {
          source: codebuild.Source.s3({
            bucket,
            path: 'path/to/source.zip',
          }),
          vpc,
          allowAllOutbound: true,
          securityGroups: [securityGroup],
        })
      , /Configure 'allowAllOutbound' directly on the supplied SecurityGroup/);
      test.done();
    },

    'without passing a VPC cannot access the connections property'(test: Test) {
      const stack = new cdk.Stack();

      const project = new codebuild.PipelineProject(stack, 'MyProject');

      test.throws(() => project.connections,
        /Only VPC-associated Projects have security groups to manage. Supply the "vpc" parameter when creating the Project/);

      test.done();
    },

    'no KMS Key defaults to default S3 managed key'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      new codebuild.PipelineProject(stack, 'MyProject');

      // THEN
      expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
        EncryptionKey: 'alias/aws/s3',
      }));

      test.done();
    },

    'with a KMS Key adds decrypt permissions to the CodeBuild Role'(test: Test) {
      const stack = new cdk.Stack();

      const key = new kms.Key(stack, 'MyKey');

      new codebuild.PipelineProject(stack, 'MyProject', {
        encryptionKey: key,
        grantReportGroupPermissions: false,
      });

      expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
        'PolicyDocument': {
          'Statement': [
            {}, // CloudWatch logs
            {
              'Action': [
                'kms:Decrypt',
                'kms:Encrypt',
                'kms:ReEncrypt*',
                'kms:GenerateDataKey*',
              ],
              'Effect': 'Allow',
              'Resource': {
                'Fn::GetAtt': [
                  'MyKey6AB29FA6',
                  'Arn',
                ],
              },
            },
          ],
        },
        'Roles': [
          {
            'Ref': 'MyProjectRole9BBE5233',
          },
        ],
      }));

      test.done();
    },
  },

  'using timeout and path in S3 artifacts sets it correctly'(test: Test) {
    const stack = new cdk.Stack();
    const bucket = new s3.Bucket(stack, 'Bucket');
    new codebuild.Project(stack, 'Project', {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
      }),
      artifacts: codebuild.Artifacts.s3({
        path: 'some/path',
        name: 'some_name',
        bucket,
      }),
      timeout: cdk.Duration.minutes(123),
    });

    expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
      'Artifacts': {
        'Path': 'some/path',
        'Name': 'some_name',
        'Type': 'S3',
      },
      'TimeoutInMinutes': 123,
    }));

    test.done();
  },

  'secondary sources': {
    'require providing an identifier when creating a Project'(test: Test) {
      const stack = new cdk.Stack();

      test.throws(() => {
        new codebuild.Project(stack, 'MyProject', {
          buildSpec: codebuild.BuildSpec.fromObject({
            version: '0.2',
          }),
          secondarySources: [
            codebuild.Source.s3({
              bucket: new s3.Bucket(stack, 'MyBucket'),
              path: 'path',
            }),
          ],
        });
      }, /identifier/);

      test.done();
    },

    'are not allowed for a Project with CodePipeline as Source'(test: Test) {
      const stack = new cdk.Stack();
      const project = new codebuild.PipelineProject(stack, 'MyProject');

      project.addSecondarySource(codebuild.Source.s3({
        bucket: new s3.Bucket(stack, 'MyBucket'),
        path: 'some/path',
        identifier: 'id',
      }));

      test.throws(() => {
        expect(stack);
      }, /secondary sources/);

      test.done();
    },

    'added with an identifer after the Project has been created are rendered in the template'(test: Test) {
      const stack = new cdk.Stack();
      const bucket = new s3.Bucket(stack, 'MyBucket');
      const project = new codebuild.Project(stack, 'MyProject', {
        source: codebuild.Source.s3({
          bucket,
          path: 'some/path',
        }),
      });

      project.addSecondarySource(codebuild.Source.s3({
        bucket,
        path: 'another/path',
        identifier: 'source1',
      }));

      expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
        'SecondarySources': [
          {
            'SourceIdentifier': 'source1',
            'Type': 'S3',
          },
        ],
      }));

      test.done();
    },
  },

  'secondary source versions': {
    'allow secondary source versions'(test: Test) {
      const stack = new cdk.Stack();
      const bucket = new s3.Bucket(stack, 'MyBucket');
      const project = new codebuild.Project(stack, 'MyProject', {
        source: codebuild.Source.s3({
          bucket,
          path: 'some/path',
        }),
      });

      project.addSecondarySource(codebuild.Source.s3({
        bucket,
        path: 'another/path',
        identifier: 'source1',
        version: 'someversion',
      }));

      expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
        'SecondarySources': [
          {
            'SourceIdentifier': 'source1',
            'Type': 'S3',
          },
        ],
        'SecondarySourceVersions': [
          {
            'SourceIdentifier': 'source1',
            'SourceVersion': 'someversion',
          },
        ],
      }));

      test.done();
    },

    'allow not to specify secondary source versions'(test: Test) {
      const stack = new cdk.Stack();
      const bucket = new s3.Bucket(stack, 'MyBucket');
      const project = new codebuild.Project(stack, 'MyProject', {
        source: codebuild.Source.s3({
          bucket,
          path: 'some/path',
        }),
      });

      project.addSecondarySource(codebuild.Source.s3({
        bucket,
        path: 'another/path',
        identifier: 'source1',
      }));

      expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
        'SecondarySources': [
          {
            'SourceIdentifier': 'source1',
            'Type': 'S3',
          },
        ],
      }));

      test.done();
    },
  },

  'fileSystemLocations': {
    'create fileSystemLocation and validate attributes'(test: Test) {
      const stack = new cdk.Stack();
      new codebuild.Project(stack, 'MyProject', {
        buildSpec: codebuild.BuildSpec.fromObject({
          version: '0.2',
        }),
        fileSystemLocations: [codebuild.FileSystemLocation.efs({
          identifier: 'myidentifier2',
          location: 'myclodation.mydnsroot.com:/loc',
          mountPoint: '/media',
          mountOptions: 'opts',
        })],
      });

      expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
        'FileSystemLocations': [
          {
            'Identifier': 'myidentifier2',
            'MountPoint': '/media',
            'MountOptions': 'opts',
            'Location': 'myclodation.mydnsroot.com:/loc',
            'Type': 'EFS',
          },
        ],
      }));

      test.done();
    },
    'Multiple fileSystemLocation created'(test: Test) {
      const stack = new cdk.Stack();
      const project = new codebuild.Project(stack, 'MyProject', {
        buildSpec: codebuild.BuildSpec.fromObject({
          version: '0.2',
        }),
      });
      project.addFileSystemLocation(codebuild.FileSystemLocation.efs({
        identifier: 'myidentifier3',
        location: 'myclodation.mydnsroot.com:/loc',
        mountPoint: '/media',
        mountOptions: 'opts',
      }));

      expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
        'FileSystemLocations': [
          {
            'Identifier': 'myidentifier3',
            'MountPoint': '/media',
            'MountOptions': 'opts',
            'Location': 'myclodation.mydnsroot.com:/loc',
            'Type': 'EFS',
          },
        ],
      }));

      test.done();
    },
  },

  'secondary artifacts': {
    'require providing an identifier when creating a Project'(test: Test) {
      const stack = new cdk.Stack();

      test.throws(() => {
        new codebuild.Project(stack, 'MyProject', {
          buildSpec: codebuild.BuildSpec.fromObject({
            version: '0.2',
          }),
          secondaryArtifacts: [
            codebuild.Artifacts.s3({
              bucket: new s3.Bucket(stack, 'MyBucket'),
              path: 'some/path',
              name: 'name',
            }),
          ],
        });
      }, /identifier/);

      test.done();
    },

    'are not allowed for a Project with CodePipeline as Source'(test: Test) {
      const stack = new cdk.Stack();
      const project = new codebuild.PipelineProject(stack, 'MyProject');

      project.addSecondaryArtifact(codebuild.Artifacts.s3({
        bucket: new s3.Bucket(stack, 'MyBucket'),
        path: 'some/path',
        name: 'name',
        identifier: 'id',
      }));

      test.throws(() => {
        expect(stack);
      }, /secondary artifacts/);

      test.done();
    },

    'added with an identifier after the Project has been created are rendered in the template'(test: Test) {
      const stack = new cdk.Stack();
      const bucket = new s3.Bucket(stack, 'MyBucket');
      const project = new codebuild.Project(stack, 'MyProject', {
        source: codebuild.Source.s3({
          bucket,
          path: 'some/path',
        }),
      });

      project.addSecondaryArtifact(codebuild.Artifacts.s3({
        bucket,
        path: 'another/path',
        name: 'name',
        identifier: 'artifact1',
      }));

      expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
        'SecondaryArtifacts': [
          {
            'ArtifactIdentifier': 'artifact1',
            'Type': 'S3',
          },
        ],
      }));

      test.done();
    },

    'disabledEncryption is set'(test: Test) {
      const stack = new cdk.Stack();
      const bucket = new s3.Bucket(stack, 'MyBucket');
      const project = new codebuild.Project(stack, 'MyProject', {
        source: codebuild.Source.s3({
          bucket,
          path: 'some/path',
        }),
      });

      project.addSecondaryArtifact(codebuild.Artifacts.s3({
        bucket,
        path: 'another/path',
        name: 'name',
        identifier: 'artifact1',
        encryption: false,
      }));

      expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
        'SecondaryArtifacts': [
          {
            'ArtifactIdentifier': 'artifact1',
            'EncryptionDisabled': true,
          },
        ],
      }));

      test.done();
    },
  },

  'artifacts': {
    'CodePipeline': {
      'both source and artifacs are set to CodePipeline'(test: Test) {
        const stack = new cdk.Stack();

        new codebuild.PipelineProject(stack, 'MyProject');

        expect(stack).to(haveResource('AWS::CodeBuild::Project', {
          'Source': {
            'Type': 'CODEPIPELINE',
          },
          'Artifacts': {
            'Type': 'CODEPIPELINE',
          },
          'ServiceRole': {
            'Fn::GetAtt': [
              'MyProjectRole9BBE5233',
              'Arn',
            ],
          },
          'Environment': {
            'Type': 'LINUX_CONTAINER',
            'PrivilegedMode': false,
            'Image': 'aws/codebuild/standard:1.0',
            'ImagePullCredentialsType': 'CODEBUILD',
            'ComputeType': 'BUILD_GENERAL1_SMALL',
          },
        }));

        test.done();
      },
    },
    'S3': {
      'name is not set so use buildspec'(test: Test) {
        const stack = new cdk.Stack();
        const bucket = new s3.Bucket(stack, 'MyBucket');
        new codebuild.Project(stack, 'MyProject', {
          source: codebuild.Source.s3({
            bucket,
            path: 'some/path',
          }),
          artifacts: codebuild.Artifacts.s3({
            bucket,
            path: 'another/path',
            identifier: 'artifact1',
          }),
        });

        expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
          'Artifacts': {
            'Name': ABSENT,
            'ArtifactIdentifier': 'artifact1',
            'OverrideArtifactName': true,
          },
        }));

        test.done();
      },
      'name is set so use it'(test: Test) {
        const stack = new cdk.Stack();
        const bucket = new s3.Bucket(stack, 'MyBucket');
        new codebuild.Project(stack, 'MyProject', {
          source: codebuild.Source.s3({
            bucket,
            path: 'some/path',
          }),
          artifacts: codebuild.Artifacts.s3({
            bucket,
            path: 'another/path',
            name: 'specificname',
            identifier: 'artifact1',
          }),
        });

        expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
          'Artifacts': {
            'ArtifactIdentifier': 'artifact1',
            'Name': 'specificname',
            'OverrideArtifactName': ABSENT,
          },
        }));

        test.done();
      },
    },
  },

  'events'(test: Test) {
    const stack = new cdk.Stack();
    const project = new codebuild.Project(stack, 'MyProject', {
      source: codebuild.Source.s3({
        bucket: new s3.Bucket(stack, 'MyBucket'),
        path: 'path',
      }),
    });

    project.onBuildFailed('OnBuildFailed', { target: { bind: () => ({ arn: 'ARN', id: 'ID' }) } });
    project.onBuildSucceeded('OnBuildSucceeded', { target: { bind: () => ({ arn: 'ARN', id: 'ID' }) } });
    project.onPhaseChange('OnPhaseChange', { target: { bind: () => ({ arn: 'ARN', id: 'ID' }) } });
    project.onStateChange('OnStateChange', { target: { bind: () => ({ arn: 'ARN', id: 'ID' }) } });
    project.onBuildStarted('OnBuildStarted', { target: { bind: () => ({ arn: 'ARN', id: 'ID' }) } });

    expect(stack).to(haveResource('AWS::Events::Rule', {
      'EventPattern': {
        'source': [
          'aws.codebuild',
        ],
        'detail-type': [
          'CodeBuild Build State Change',
        ],
        'detail': {
          'project-name': [
            {
              'Ref': 'MyProject39F7B0AE',
            },
          ],
          'build-status': [
            'FAILED',
          ],
        },
      },
      'State': 'ENABLED',
    }));

    expect(stack).to(haveResource('AWS::Events::Rule', {
      'EventPattern': {
        'source': [
          'aws.codebuild',
        ],
        'detail-type': [
          'CodeBuild Build State Change',
        ],
        'detail': {
          'project-name': [
            {
              'Ref': 'MyProject39F7B0AE',
            },
          ],
          'build-status': [
            'SUCCEEDED',
          ],
        },
      },
      'State': 'ENABLED',
    }));

    expect(stack).to(haveResource('AWS::Events::Rule', {
      'EventPattern': {
        'source': [
          'aws.codebuild',
        ],
        'detail-type': [
          'CodeBuild Build Phase Change',
        ],
        'detail': {
          'project-name': [
            {
              'Ref': 'MyProject39F7B0AE',
            },
          ],
        },
      },
      'State': 'ENABLED',
    }));

    expect(stack).to(haveResource('AWS::Events::Rule', {
      'EventPattern': {
        'source': [
          'aws.codebuild',
        ],
        'detail-type': [
          'CodeBuild Build State Change',
        ],
        'detail': {
          'project-name': [
            {
              'Ref': 'MyProject39F7B0AE',
            },
          ],
        },
      },
      'State': 'ENABLED',
    }));

    expect(stack).to(haveResource('AWS::Events::Rule', {
      'EventPattern': {
        'source': [
          'aws.codebuild',
        ],
        'detail-type': [
          'CodeBuild Build State Change',
        ],
        'detail': {
          'project-name': [
            {
              'Ref': 'MyProject39F7B0AE',
            },
          ],
          'build-status': [
            'IN_PROGRESS',
          ],
        },
      },
      'State': 'ENABLED',
    }));

    test.done();
  },

  'environment variables can be overridden at the project level'(test: Test) {
    const stack = new cdk.Stack();

    new codebuild.PipelineProject(stack, 'Project', {
      environment: {
        environmentVariables: {
          FOO: { value: '1234' },
          BAR: { value: `111${cdk.Token.asString({ twotwotwo: '222' })}`, type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE },
        },
      },
      environmentVariables: {
        GOO: { value: 'ABC' },
        FOO: { value: 'OVERRIDE!' },
      },
    });

    expect(stack).to(haveResource('AWS::CodeBuild::Project', {
      'Source': {
        'Type': 'CODEPIPELINE',
      },
      'Artifacts': {
        'Type': 'CODEPIPELINE',
      },
      'ServiceRole': {
        'Fn::GetAtt': [
          'ProjectRole4CCB274E',
          'Arn',
        ],
      },
      'Environment': {
        'Type': 'LINUX_CONTAINER',
        'EnvironmentVariables': [
          {
            'Type': 'PLAINTEXT',
            'Value': 'OVERRIDE!',
            'Name': 'FOO',
          },
          {
            'Type': 'PARAMETER_STORE',
            'Value': {
              'Fn::Join': [
                '',
                [
                  '111',
                  { twotwotwo: '222' },
                ],
              ],
            },
            'Name': 'BAR',
          },
          {
            'Type': 'PLAINTEXT',
            'Value': 'ABC',
            'Name': 'GOO',
          },
        ],
        'PrivilegedMode': false,
        'Image': 'aws/codebuild/standard:1.0',
        'ImagePullCredentialsType': 'CODEBUILD',
        'ComputeType': 'BUILD_GENERAL1_SMALL',
      },
    }));

    test.done();
  },

  '.metricXxx() methods can be used to obtain Metrics for CodeBuild projects'(test: Test) {
    const stack = new cdk.Stack();

    const project = new codebuild.Project(stack, 'MyBuildProject', {
      source: codebuild.Source.s3({
        bucket: new s3.Bucket(stack, 'MyBucket'),
        path: 'path',
      }),
    });

    const metricBuilds = project.metricBuilds();
    test.same(metricBuilds.dimensions!.ProjectName, project.projectName);
    test.deepEqual(metricBuilds.namespace, 'AWS/CodeBuild');
    test.deepEqual(metricBuilds.statistic, 'Sum', 'default stat is SUM');
    test.deepEqual(metricBuilds.metricName, 'Builds');

    const metricDuration = project.metricDuration({ label: 'hello' });

    test.deepEqual(metricDuration.metricName, 'Duration');
    test.deepEqual(metricDuration.label, 'hello');

    test.deepEqual(project.metricFailedBuilds().metricName, 'FailedBuilds');
    test.deepEqual(project.metricSucceededBuilds().metricName, 'SucceededBuilds');

    test.done();
  },

  'using ComputeType.Small with a Windows image fails validation'(test: Test) {
    const stack = new cdk.Stack();
    const invalidEnvironment: codebuild.BuildEnvironment = {
      buildImage: codebuild.WindowsBuildImage.WINDOWS_BASE_2_0,
      computeType: codebuild.ComputeType.SMALL,
    };

    test.throws(() => {
      new codebuild.Project(stack, 'MyProject', {
        source: codebuild.Source.s3({
          bucket: new s3.Bucket(stack, 'MyBucket'),
          path: 'path',
        }),
        environment: invalidEnvironment,
      });
    }, /Windows images do not support the Small ComputeType/);

    test.done();
  },

  'fromCodebuildImage'(test: Test) {
    const stack = new cdk.Stack();
    new codebuild.PipelineProject(stack, 'Project', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.fromCodeBuildImageId('aws/codebuild/standard:4.0'),
      },
    });

    expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
      'Environment': {
        'Image': 'aws/codebuild/standard:4.0',
      },
    }));

    test.done();
  },

  'Windows2019 image': {
    'WIN_SERVER_CORE_2016_BASE': {
      'has type WINDOWS_SERVER_2019_CONTAINER and default ComputeType MEDIUM'(test: Test) {
        const stack = new cdk.Stack();
        new codebuild.PipelineProject(stack, 'Project', {
          environment: {
            buildImage: codebuild.WindowsBuildImage.WIN_SERVER_CORE_2019_BASE,
          },
        });

        expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
          'Environment': {
            'Type': 'WINDOWS_SERVER_2019_CONTAINER',
            'ComputeType': 'BUILD_GENERAL1_MEDIUM',
          },
        }));

        test.done();
      },
    },
  },

  'ARM image': {
    'AMAZON_LINUX_2_ARM': {
      'has type ARM_CONTAINER and default ComputeType LARGE'(test: Test) {
        const stack = new cdk.Stack();
        new codebuild.PipelineProject(stack, 'Project', {
          environment: {
            buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_ARM,
          },
        });

        expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
          'Environment': {
            'Type': 'ARM_CONTAINER',
            'ComputeType': 'BUILD_GENERAL1_LARGE',
          },
        }));

        test.done();
      },

      'cannot be used in conjunction with ComputeType SMALL'(test: Test) {
        const stack = new cdk.Stack();

        test.throws(() => {
          new codebuild.PipelineProject(stack, 'Project', {
            environment: {
              buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_ARM,
              computeType: codebuild.ComputeType.SMALL,
            },
          });
        }, /ARM images only support ComputeType 'BUILD_GENERAL1_LARGE' - 'BUILD_GENERAL1_SMALL' was given/);

        test.done();
      },

      'cannot be used in conjunction with ComputeType MEDIUM'(test: Test) {
        const stack = new cdk.Stack();

        test.throws(() => {
          new codebuild.PipelineProject(stack, 'Project', {
            environment: {
              buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_ARM,
              computeType: codebuild.ComputeType.MEDIUM,
            },
          });
        }, /ARM images only support ComputeType 'BUILD_GENERAL1_LARGE' - 'BUILD_GENERAL1_MEDIUM' was given/);

        test.done();
      },

      'cannot be used in conjunction with ComputeType X2_LARGE'(test: Test) {
        const stack = new cdk.Stack();

        test.throws(() => {
          new codebuild.PipelineProject(stack, 'Project', {
            environment: {
              buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_ARM,
              computeType: codebuild.ComputeType.X2_LARGE,
            },
          });
        }, /ARM images only support ComputeType 'BUILD_GENERAL1_LARGE' - 'BUILD_GENERAL1_2XLARGE' was given/);

        test.done();
      },
    },
  },

  'badge support test'(test: Test) {
    const stack = new cdk.Stack();

    interface BadgeValidationTestCase {
      source: codebuild.Source,
      allowsBadge: boolean
    }

    const repo = new codecommit.Repository(stack, 'MyRepo', {
      repositoryName: 'hello-cdk',
    });
    const bucket = new s3.Bucket(stack, 'MyBucket');

    const cases: BadgeValidationTestCase[] = [
      { source: new NoSource(), allowsBadge: false },
      { source: new CodePipelineSource(), allowsBadge: false },
      { source: codebuild.Source.codeCommit({ repository: repo }), allowsBadge: true },
      { source: codebuild.Source.s3({ bucket, path: 'path/to/source.zip' }), allowsBadge: false },
      { source: codebuild.Source.gitHub({ owner: 'awslabs', repo: 'aws-cdk' }), allowsBadge: true },
      { source: codebuild.Source.gitHubEnterprise({ httpsCloneUrl: 'url' }), allowsBadge: true },
      { source: codebuild.Source.bitBucket({ owner: 'awslabs', repo: 'aws-cdk' }), allowsBadge: true },
    ];

    cases.forEach(testCase => {
      const source = testCase.source;
      const validationBlock = () => { new codebuild.Project(stack, `MyProject-${source.type}`, { source, badge: true }); };
      if (testCase.allowsBadge) {
        test.doesNotThrow(validationBlock);
      } else {
        test.throws(validationBlock, /Badge is not supported for source type /);
      }
    });

    test.done();
  },

  'webhook Filters': {
    'a Group cannot be created with an empty set of event actions'(test: Test) {
      test.throws(() => {
        codebuild.FilterGroup.inEventOf();
      }, /A filter group must contain at least one event action/);

      test.done();
    },

    'cannot have base ref conditions if the Group contains the PUSH action'(test: Test) {
      const filterGroup = codebuild.FilterGroup.inEventOf(codebuild.EventAction.PULL_REQUEST_CREATED,
        codebuild.EventAction.PUSH);

      test.throws(() => {
        filterGroup.andBaseRefIs('.*');
      }, /A base reference condition cannot be added if a Group contains a PUSH event action/);

      test.done();
    },

    'cannot be used when webhook is false'(test: Test) {
      const stack = new cdk.Stack();

      test.throws(() => {
        new codebuild.Project(stack, 'Project', {
          source: codebuild.Source.bitBucket({
            owner: 'owner',
            repo: 'repo',
            webhook: false,
            webhookFilters: [
              codebuild.FilterGroup.inEventOf(codebuild.EventAction.PUSH),
            ],
          }),
        });
      }, /`webhookFilters` cannot be used when `webhook` is `false`/);

      test.done();
    },

    'can have FILE_PATH filters if the Group contains PUSH and PR_CREATED events'(test: Test) {
      codebuild.FilterGroup.inEventOf(
        codebuild.EventAction.PULL_REQUEST_CREATED,
        codebuild.EventAction.PUSH)
        .andFilePathIsNot('.*\\.java');

      test.done();
    },

    'BitBucket sources do not support the PULL_REQUEST_REOPENED event action'(test: Test) {
      const stack = new cdk.Stack();

      test.throws(() => {
        new codebuild.Project(stack, 'Project', {
          source: codebuild.Source.bitBucket({
            owner: 'owner',
            repo: 'repo',
            webhookFilters: [
              codebuild.FilterGroup.inEventOf(codebuild.EventAction.PULL_REQUEST_REOPENED),
            ],
          }),
        });
      }, /BitBucket sources do not support the PULL_REQUEST_REOPENED webhook event action/);

      test.done();
    },

    'BitBucket sources support file path conditions'(test: Test) {
      const stack = new cdk.Stack();
      const filterGroup = codebuild.FilterGroup.inEventOf(codebuild.EventAction.PUSH).andFilePathIs('.*');

      new codebuild.Project(stack, 'Project', {
        source: codebuild.Source.bitBucket({
          owner: 'owner',
          repo: 'repo',
          webhookFilters: [filterGroup],
        }),
      });

      test.done();
    },

    'GitHub Enterprise Server sources do not support FILE_PATH filters on PR events'(test: Test) {
      const stack = new cdk.Stack();
      const pullFilterGroup = codebuild.FilterGroup.inEventOf(
        codebuild.EventAction.PULL_REQUEST_CREATED,
        codebuild.EventAction.PULL_REQUEST_MERGED,
        codebuild.EventAction.PULL_REQUEST_REOPENED,
        codebuild.EventAction.PULL_REQUEST_UPDATED,
      );

      test.throws(() => {
        new codebuild.Project(stack, 'MyFilePathProject', {
          source: codebuild.Source.gitHubEnterprise({
            httpsCloneUrl: 'https://github.testcompany.com/testowner/testrepo',
            webhookFilters: [
              pullFilterGroup.andFilePathIs('ReadMe.md'),
            ],
          }),
        });
      }, /FILE_PATH filters cannot be used with GitHub Enterprise Server pull request events/);
      test.done();
    },

    'COMMIT_MESSAGE Filter': {
      'GitHub Enterprise Server sources do not support COMMIT_MESSAGE filters on PR events'(test: Test) {
        const stack = new cdk.Stack();
        const pullFilterGroup = codebuild.FilterGroup.inEventOf(
          codebuild.EventAction.PULL_REQUEST_CREATED,
          codebuild.EventAction.PULL_REQUEST_MERGED,
          codebuild.EventAction.PULL_REQUEST_REOPENED,
          codebuild.EventAction.PULL_REQUEST_UPDATED,
        );

        test.throws(() => {
          new codebuild.Project(stack, 'MyProject', {
            source: codebuild.Source.gitHubEnterprise({
              httpsCloneUrl: 'https://github.testcompany.com/testowner/testrepo',
              webhookFilters: [
                pullFilterGroup.andCommitMessageIs('the commit message'),
              ],
            }),
          });
        }, /COMMIT_MESSAGE filters cannot be used with GitHub Enterprise Server pull request events/);
        test.done();
      },
      'GitHub Enterprise Server sources support COMMIT_MESSAGE filters on PUSH events'(test: Test) {
        const stack = new cdk.Stack();
        const pushFilterGroup = codebuild.FilterGroup.inEventOf(codebuild.EventAction.PUSH);

        test.doesNotThrow(() => {
          new codebuild.Project(stack, 'MyProject', {
            source: codebuild.Source.gitHubEnterprise({
              httpsCloneUrl: 'https://github.testcompany.com/testowner/testrepo',
              webhookFilters: [
                pushFilterGroup.andCommitMessageIs('the commit message'),
              ],
            }),
          });
        });
        test.done();
      },
      'BitBucket and GitHub sources support a COMMIT_MESSAGE filter'(test: Test) {
        const stack = new cdk.Stack();
        const filterGroup = codebuild
          .FilterGroup
          .inEventOf(codebuild.EventAction.PUSH, codebuild.EventAction.PULL_REQUEST_CREATED)
          .andCommitMessageIs('the commit message');

        test.doesNotThrow(() => {
          new codebuild.Project(stack, 'BitBucket Project', {
            source: codebuild.Source.bitBucket({
              owner: 'owner',
              repo: 'repo',
              webhookFilters: [filterGroup],
            }),
          });
          new codebuild.Project(stack, 'GitHub Project', {
            source: codebuild.Source.gitHub({
              owner: 'owner',
              repo: 'repo',
              webhookFilters: [filterGroup],
            }),
          });
        });
        test.done();
      },
    },
  },

  'enableBatchBuilds()'(test: Test) {
    const stack = new cdk.Stack();

    const project = new codebuild.Project(stack, 'Project', {
      source: codebuild.Source.gitHub({
        owner: 'testowner',
        repo: 'testrepo',
      }),
    });

    const returnVal = project.enableBatchBuilds();
    if (!returnVal?.role) {
      throw new Error('Expecting return value with role');
    }

    expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
      BuildBatchConfig: {
        ServiceRole: {
          'Fn::GetAtt': [
            'ProjectBatchServiceRoleF97A1CFB',
            'Arn',
          ],
        },
      },
    }));

    expect(stack).to(haveResourceLike('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'codebuild.amazonaws.com',
            },
          },
        ],
        Version: '2012-10-17',
      },
    }));

    expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: [
              'codebuild:StartBuild',
              'codebuild:StopBuild',
              'codebuild:RetryBuild',
            ],
            Effect: 'Allow',
            Resource: {
              'Fn::GetAtt': [
                'ProjectC78D97AD',
                'Arn',
              ],
            },
          },
        ],
        Version: '2012-10-17',
      },
    }));

    test.done();
  },
};
