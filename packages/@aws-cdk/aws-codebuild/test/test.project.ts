import { countResources, expect, haveResource, haveResourceLike, objectLike, not, ResourcePart, arrayWith } from '@aws-cdk/assert-internal';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as logs from '@aws-cdk/aws-logs';
import * as s3 from '@aws-cdk/aws-s3';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import * as cdk from '@aws-cdk/core';
import { Test } from 'nodeunit';
import * as codebuild from '../lib';

/* eslint-disable quote-props */

export = {
  'can use filename as buildspec'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    new codebuild.Project(stack, 'Project', {
      source: codebuild.Source.s3({
        bucket: new s3.Bucket(stack, 'Bucket'),
        path: 'path',
      }),
      buildSpec: codebuild.BuildSpec.fromSourceFilename('hello.yml'),
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
      Source: {
        BuildSpec: 'hello.yml',
      },
    }));

    test.done();
  },

  'can use buildspec literal'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    new codebuild.Project(stack, 'Project', {
      buildSpec: codebuild.BuildSpec.fromObject({ phases: ['say hi'] }),
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
      Source: {
        BuildSpec: '{\n  "phases": [\n    "say hi"\n  ]\n}',
      },
    }));

    test.done();
  },

  'can use yamlbuildspec literal'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    new codebuild.Project(stack, 'Project', {
      buildSpec: codebuild.BuildSpec.fromObjectToYaml({
        text: 'text',
        decimal: 10,
        list: ['say hi'],
        obj: {
          text: 'text',
          decimal: 10,
          list: ['say hi'],
        },
      }),
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
      Source: {
        BuildSpec: 'text: text\ndecimal: 10\nlist:\n  - say hi\nobj:\n  text: text\n  decimal: 10\n  list:\n    - say hi\n',
      },
    }));

    test.done();
  },

  'must supply buildspec when using nosource'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    test.throws(() => {
      new codebuild.Project(stack, 'Project', {
      });
    }, /you need to provide a concrete buildSpec/);

    test.done();
  },

  'must supply literal buildspec when using nosource'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    test.throws(() => {
      new codebuild.Project(stack, 'Project', {
        buildSpec: codebuild.BuildSpec.fromSourceFilename('bla.yml'),
      });
    }, /you need to provide a concrete buildSpec/);

    test.done();
  },

  'GitHub source': {
    'has reportBuildStatus on by default'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      new codebuild.Project(stack, 'Project', {
        source: codebuild.Source.gitHub({
          owner: 'testowner',
          repo: 'testrepo',
          cloneDepth: 3,
        }),
      });

      // THEN
      expect(stack).to(haveResource('AWS::CodeBuild::Project', {
        Source: {
          Type: 'GITHUB',
          Location: 'https://github.com/testowner/testrepo.git',
          ReportBuildStatus: true,
          GitCloneDepth: 3,
        },
      }));

      test.done();
    },

    'can set a branch as the SourceVersion'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      new codebuild.Project(stack, 'Project', {
        source: codebuild.Source.gitHub({
          owner: 'testowner',
          repo: 'testrepo',
          branchOrRef: 'testbranch',
        }),
      });

      // THEN
      expect(stack).to(haveResource('AWS::CodeBuild::Project', {
        SourceVersion: 'testbranch',
      }));

      test.done();
    },

    'can explicitly set reportBuildStatus to false'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      new codebuild.Project(stack, 'Project', {
        source: codebuild.Source.gitHub({
          owner: 'testowner',
          repo: 'testrepo',
          reportBuildStatus: false,
        }),
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
        Source: {
          ReportBuildStatus: false,
        },
      }));

      test.done();
    },

    'can explicitly set webhook to true'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      new codebuild.Project(stack, 'Project', {
        source: codebuild.Source.gitHub({
          owner: 'testowner',
          repo: 'testrepo',
          webhook: true,
        }),
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
        Triggers: {
          Webhook: true,
        },
      }));

      test.done();
    },

    'can be added to a CodePipeline'(test: Test) {
      const stack = new cdk.Stack();
      const project = new codebuild.Project(stack, 'Project', {
        source: codebuild.Source.gitHub({
          owner: 'testowner',
          repo: 'testrepo',
        }),
      });

      project.bindToCodePipeline(project, {
        artifactBucket: new s3.Bucket(stack, 'Bucket'),
      }); // no exception

      test.done();
    },

    'can provide credentials to use with the source'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      new codebuild.GitHubSourceCredentials(stack, 'GitHubSourceCredentials', {
        accessToken: cdk.SecretValue.plainText('my-access-token'),
      });

      // THEN
      expect(stack).to(haveResource('AWS::CodeBuild::SourceCredential', {
        'ServerType': 'GITHUB',
        'AuthType': 'PERSONAL_ACCESS_TOKEN',
        'Token': 'my-access-token',
      }));

      test.done();
    },
  },

  'GitHub Enterprise source': {
    'can use branchOrRef to set the source version'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      new codebuild.Project(stack, 'Project', {
        source: codebuild.Source.gitHubEnterprise({
          httpsCloneUrl: 'https://mygithub-enterprise.com/myuser/myrepo',
          branchOrRef: 'testbranch',
        }),
      });

      // THEN
      expect(stack).to(haveResource('AWS::CodeBuild::Project', {
        SourceVersion: 'testbranch',
      }));

      test.done();
    },

    'can provide credentials to use with the source'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      new codebuild.GitHubEnterpriseSourceCredentials(stack, 'GitHubEnterpriseSourceCredentials', {
        accessToken: cdk.SecretValue.plainText('my-access-token'),
      });

      // THEN
      expect(stack).to(haveResource('AWS::CodeBuild::SourceCredential', {
        'ServerType': 'GITHUB_ENTERPRISE',
        'AuthType': 'PERSONAL_ACCESS_TOKEN',
        'Token': 'my-access-token',
      }));

      test.done();
    },
  },

  'BitBucket source': {
    'can use branchOrRef to set the source version'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      new codebuild.Project(stack, 'Project', {
        source: codebuild.Source.bitBucket({
          owner: 'testowner',
          repo: 'testrepo',
          branchOrRef: 'testbranch',
        }),
      });

      // THEN
      expect(stack).to(haveResource('AWS::CodeBuild::Project', {
        SourceVersion: 'testbranch',
      }));

      test.done();
    },

    'can provide credentials to use with the source'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      new codebuild.BitBucketSourceCredentials(stack, 'BitBucketSourceCredentials', {
        username: cdk.SecretValue.plainText('my-username'),
        password: cdk.SecretValue.plainText('password'),
      });

      // THEN
      expect(stack).to(haveResource('AWS::CodeBuild::SourceCredential', {
        'ServerType': 'BITBUCKET',
        'AuthType': 'BASIC_AUTH',
        'Username': 'my-username',
        'Token': 'password',
      }));

      test.done();
    },
  },

  'project with s3 cache bucket'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    new codebuild.Project(stack, 'Project', {
      source: codebuild.Source.s3({
        bucket: new s3.Bucket(stack, 'SourceBucket'),
        path: 'path',
      }),
      cache: codebuild.Cache.bucket(new s3.Bucket(stack, 'Bucket'), {
        prefix: 'cache-prefix',
      }),
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
      Cache: {
        Type: 'S3',
        Location: {
          'Fn::Join': [
            '/',
            [
              {
                'Ref': 'Bucket83908E77',
              },
              'cache-prefix',
            ],
          ],
        },
      },
    }));

    test.done();
  },

  's3 codebuild project with sourceVersion'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    new codebuild.Project(stack, 'Project', {
      source: codebuild.Source.s3({
        bucket: new s3.Bucket(stack, 'Bucket'),
        path: 'path',
        version: 's3version',
      }),
      cache: codebuild.Cache.local(codebuild.LocalCacheMode.CUSTOM, codebuild.LocalCacheMode.DOCKER_LAYER,
        codebuild.LocalCacheMode.SOURCE),
    });

    // THEN
    expect(stack).to(haveResource('AWS::CodeBuild::Project', {
      SourceVersion: 's3version',
    }));

    test.done();
  },

  'project with local cache modes'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    new codebuild.Project(stack, 'Project', {
      source: codebuild.Source.s3({
        bucket: new s3.Bucket(stack, 'Bucket'),
        path: 'path',
      }),
      cache: codebuild.Cache.local(codebuild.LocalCacheMode.CUSTOM, codebuild.LocalCacheMode.DOCKER_LAYER,
        codebuild.LocalCacheMode.SOURCE),
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
      Cache: {
        Type: 'LOCAL',
        Modes: [
          'LOCAL_CUSTOM_CACHE',
          'LOCAL_DOCKER_LAYER_CACHE',
          'LOCAL_SOURCE_CACHE',
        ],
      },
    }));

    test.done();
  },

  'project by default has no cache modes'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    new codebuild.Project(stack, 'Project', {
      source: codebuild.Source.s3({
        bucket: new s3.Bucket(stack, 'Bucket'),
        path: 'path',
      }),
    });

    // THEN
    expect(stack).to(not(haveResourceLike('AWS::CodeBuild::Project', {
      Cache: {},
    })));

    test.done();
  },

  'can use an imported Role for a Project within a VPC'(test: Test) {
    const stack = new cdk.Stack();

    const importedRole = iam.Role.fromRoleArn(stack, 'Role', 'arn:aws:iam::1234567890:role/service-role/codebuild-bruiser-service-role');
    const vpc = new ec2.Vpc(stack, 'Vpc');

    new codebuild.Project(stack, 'Project', {
      source: codebuild.Source.gitHubEnterprise({
        httpsCloneUrl: 'https://mygithub-enterprise.com/myuser/myrepo',
      }),
      role: importedRole,
      vpc,
    });

    expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
      // no need to do any assertions
    }));

    test.done();
  },

  'can use an imported Role with mutable = false for a Project within a VPC'(test: Test) {
    const stack = new cdk.Stack();

    const importedRole = iam.Role.fromRoleArn(stack, 'Role',
      'arn:aws:iam::1234567890:role/service-role/codebuild-bruiser-service-role', {
        mutable: false,
      });
    const vpc = new ec2.Vpc(stack, 'Vpc');

    new codebuild.Project(stack, 'Project', {
      source: codebuild.Source.gitHubEnterprise({
        httpsCloneUrl: 'https://mygithub-enterprise.com/myuser/myrepo',
      }),
      role: importedRole,
      vpc,
    });

    expect(stack).to(countResources('AWS::IAM::Policy', 0));

    // Check that the CodeBuild project does not have a DependsOn
    expect(stack).to(haveResource('AWS::CodeBuild::Project', (res: any) => {
      if (res.DependsOn && res.DependsOn.length > 0) {
        throw new Error(`CodeBuild project should have no DependsOn, but got: ${JSON.stringify(res, undefined, 2)}`);
      }
      return true;
    }, ResourcePart.CompleteDefinition));

    test.done();
  },

  'can use an ImmutableRole for a Project within a VPC'(test: Test) {
    const stack = new cdk.Stack();

    const role = new iam.Role(stack, 'Role', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
    });

    const vpc = new ec2.Vpc(stack, 'Vpc');

    new codebuild.Project(stack, 'Project', {
      source: codebuild.Source.gitHubEnterprise({
        httpsCloneUrl: 'https://mygithub-enterprise.com/myuser/myrepo',
      }),
      role: role.withoutPolicyUpdates(),
      vpc,
    });

    expect(stack).to(countResources('AWS::IAM::Policy', 0));

    // Check that the CodeBuild project does not have a DependsOn
    expect(stack).to(haveResource('AWS::CodeBuild::Project', (res: any) => {
      if (res.DependsOn && res.DependsOn.length > 0) {
        throw new Error(`CodeBuild project should have no DependsOn, but got: ${JSON.stringify(res, undefined, 2)}`);
      }
      return true;
    }, ResourcePart.CompleteDefinition));

    test.done();
  },

  'metric method generates a valid CloudWatch metric'(test: Test) {
    const stack = new cdk.Stack();

    const project = new codebuild.Project(stack, 'Project', {
      source: codebuild.Source.gitHubEnterprise({
        httpsCloneUrl: 'https://mygithub-enterprise.com/myuser/myrepo',
      }),
    });

    const metric = project.metric('Builds');
    test.equal(metric.metricName, 'Builds');
    test.equal(metric.period.toSeconds(), cdk.Duration.minutes(5).toSeconds());
    test.equal(metric.statistic, 'Average');

    test.done();
  },

  'CodeBuild test reports group': {
    'adds the appropriate permissions when reportGroup.grantWrite() is called'(test: Test) {
      const stack = new cdk.Stack();

      const reportGroup = new codebuild.ReportGroup(stack, 'ReportGroup');

      const project = new codebuild.Project(stack, 'Project', {
        buildSpec: codebuild.BuildSpec.fromObject({
          version: '0.2',
          reports: {
            [reportGroup.reportGroupArn]: {
              files: '**/*',
            },
          },
        }),
        grantReportGroupPermissions: false,
      });
      reportGroup.grantWrite(project);

      expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
        'PolicyDocument': {
          'Statement': [
            {},
            {
              'Action': [
                'codebuild:CreateReport',
                'codebuild:UpdateReport',
                'codebuild:BatchPutTestCases',
              ],
              'Resource': {
                'Fn::GetAtt': [
                  'ReportGroup8A84C76D',
                  'Arn',
                ],
              },
            },
          ],
        },
      }));

      test.done();
    },
  },

  'Environment': {
    'build image - can use secret to access build image'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const secret = new secretsmanager.Secret(stack, 'Secret');

      // WHEN
      new codebuild.Project(stack, 'Project', {
        source: codebuild.Source.s3({
          bucket: new s3.Bucket(stack, 'Bucket'),
          path: 'path',
        }),
        environment: {
          buildImage: codebuild.LinuxBuildImage.fromDockerRegistry('myimage', { secretsManagerCredentials: secret }),
        },
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
        Environment: objectLike({
          RegistryCredential: {
            CredentialProvider: 'SECRETS_MANAGER',
            Credential: { 'Ref': 'SecretA720EF05' },
          },
        }),
      }));

      test.done();
    },

    'build image - can use imported secret by name'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const secret = secretsmanager.Secret.fromSecretNameV2(stack, 'Secret', 'MySecretName');

      // WHEN
      new codebuild.Project(stack, 'Project', {
        source: codebuild.Source.s3({
          bucket: new s3.Bucket(stack, 'Bucket'),
          path: 'path',
        }),
        environment: {
          buildImage: codebuild.LinuxBuildImage.fromDockerRegistry('myimage', { secretsManagerCredentials: secret }),
        },
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
        Environment: objectLike({
          RegistryCredential: {
            CredentialProvider: 'SECRETS_MANAGER',
            Credential: 'MySecretName',
          },
        }),
      }));

      test.done();
    },

    'logs config - cloudWatch'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const logGroup = logs.LogGroup.fromLogGroupName(stack, 'LogGroup', 'MyLogGroupName');

      // WHEN
      new codebuild.Project(stack, 'Project', {
        source: codebuild.Source.s3({
          bucket: new s3.Bucket(stack, 'Bucket'),
          path: 'path',
        }),
        logging: {
          cloudWatch: {
            logGroup,
            prefix: '/my-logs',
          },
        },
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
        LogsConfig: objectLike({
          CloudWatchLogs: {
            GroupName: 'MyLogGroupName',
            Status: 'ENABLED',
            StreamName: '/my-logs',
          },
        }),
      }));

      test.done();
    },

    'logs config - cloudWatch disabled'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      new codebuild.Project(stack, 'Project', {
        source: codebuild.Source.s3({
          bucket: new s3.Bucket(stack, 'Bucket'),
          path: 'path',
        }),
        logging: {
          cloudWatch: {
            enabled: false,
          },
        },
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
        LogsConfig: objectLike({
          CloudWatchLogs: {
            Status: 'DISABLED',
          },
        }),
      }));

      test.done();
    },

    'logs config - s3'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const bucket = s3.Bucket.fromBucketName(stack, 'LogBucket', 'MyBucketName');

      // WHEN
      new codebuild.Project(stack, 'Project', {
        source: codebuild.Source.s3({
          bucket: new s3.Bucket(stack, 'Bucket'),
          path: 'path',
        }),
        logging: {
          s3: {
            bucket,
            prefix: 'my-logs',
          },
        },
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
        LogsConfig: objectLike({
          S3Logs: {
            Location: 'MyBucketName/my-logs',
            Status: 'ENABLED',
          },
        }),
      }));

      test.done();
    },

    'logs config - cloudWatch and s3'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const bucket = s3.Bucket.fromBucketName(stack, 'LogBucket2', 'MyBucketName');
      const logGroup = logs.LogGroup.fromLogGroupName(stack, 'LogGroup2', 'MyLogGroupName');

      // WHEN
      new codebuild.Project(stack, 'Project', {
        source: codebuild.Source.s3({
          bucket: new s3.Bucket(stack, 'Bucket'),
          path: 'path',
        }),
        logging: {
          cloudWatch: {
            logGroup,
          },
          s3: {
            bucket,
          },
        },
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
        LogsConfig: objectLike({
          CloudWatchLogs: {
            GroupName: 'MyLogGroupName',
            Status: 'ENABLED',
          },
          S3Logs: {
            Location: 'MyBucketName',
            Status: 'ENABLED',
          },
        }),
      }));

      test.done();
    },
  },

  'EnvironmentVariables': {
    'from SSM': {
      'can use environment variables'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        new codebuild.Project(stack, 'Project', {
          source: codebuild.Source.s3({
            bucket: new s3.Bucket(stack, 'Bucket'),
            path: 'path',
          }),
          environment: {
            buildImage: codebuild.LinuxBuildImage.fromDockerRegistry('myimage'),
          },
          environmentVariables: {
            'ENV_VAR1': {
              type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
              value: '/params/param1',
            },
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
          Environment: objectLike({
            EnvironmentVariables: [{
              Name: 'ENV_VAR1',
              Type: 'PARAMETER_STORE',
              Value: '/params/param1',
            }],
          }),
        }));

        test.done();
      },

      'grants the correct read permissions'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        new codebuild.Project(stack, 'Project', {
          source: codebuild.Source.s3({
            bucket: new s3.Bucket(stack, 'Bucket'),
            path: 'path',
          }),
          environment: {
            buildImage: codebuild.LinuxBuildImage.fromDockerRegistry('myimage'),
          },
          environmentVariables: {
            'ENV_VAR1': {
              type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
              value: '/params/param1',
            },
            'ENV_VAR2': {
              type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
              value: 'params/param2',
            },
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
          'PolicyDocument': {
            'Statement': arrayWith(objectLike({
              'Action': 'ssm:GetParameters',
              'Effect': 'Allow',
              'Resource': [{
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    {
                      Ref: 'AWS::Partition',
                    },
                    ':ssm:',
                    {
                      Ref: 'AWS::Region',
                    },
                    ':',
                    {
                      Ref: 'AWS::AccountId',
                    },
                    ':parameter/params/param1',
                  ],
                ],
              },
              {
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    {
                      Ref: 'AWS::Partition',
                    },
                    ':ssm:',
                    {
                      Ref: 'AWS::Region',
                    },
                    ':',
                    {
                      Ref: 'AWS::AccountId',
                    },
                    ':parameter/params/param2',
                  ],
                ],
              }],
            })),
          },
        }));


        test.done();
      },

      'does not grant read permissions when variables are not from parameter store'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        new codebuild.Project(stack, 'Project', {
          source: codebuild.Source.s3({
            bucket: new s3.Bucket(stack, 'Bucket'),
            path: 'path',
          }),
          environment: {
            buildImage: codebuild.LinuxBuildImage.fromDockerRegistry('myimage'),
          },
          environmentVariables: {
            'ENV_VAR1': {
              type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
              value: 'var1-value',
            },
          },
        });

        // THEN
        expect(stack).notTo(haveResourceLike('AWS::IAM::Policy', {
          'PolicyDocument': {
            'Statement': arrayWith(objectLike({
              'Action': 'ssm:GetParameters',
              'Effect': 'Allow',
            })),
          },
        }));

        test.done();
      },
    },

    'from SecretsManager': {
      'can be provided as a verbatim secret name'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        new codebuild.PipelineProject(stack, 'Project', {
          environmentVariables: {
            'ENV_VAR1': {
              type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
              value: 'my-secret',
            },
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
          'Environment': {
            'EnvironmentVariables': [
              {
                'Name': 'ENV_VAR1',
                'Type': 'SECRETS_MANAGER',
                'Value': 'my-secret',
              },
            ],
          },
        }));

        // THEN
        expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
          'PolicyDocument': {
            'Statement': arrayWith({
              'Action': 'secretsmanager:GetSecretValue',
              'Effect': 'Allow',
              'Resource': {
                'Fn::Join': ['', [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':secretsmanager:',
                  { Ref: 'AWS::Region' },
                  ':',
                  { Ref: 'AWS::AccountId' },
                  ':secret:my-secret-??????',
                ]],
              },
            }),
          },
        }));

        test.done();
      },

      'can be provided as a verbatim secret name followed by a JSON key'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        new codebuild.PipelineProject(stack, 'Project', {
          environmentVariables: {
            'ENV_VAR1': {
              type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
              value: 'my-secret:json-key',
            },
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
          'Environment': {
            'EnvironmentVariables': [
              {
                'Name': 'ENV_VAR1',
                'Type': 'SECRETS_MANAGER',
                'Value': 'my-secret:json-key',
              },
            ],
          },
        }));

        // THEN
        expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
          'PolicyDocument': {
            'Statement': arrayWith({
              'Action': 'secretsmanager:GetSecretValue',
              'Effect': 'Allow',
              'Resource': {
                'Fn::Join': ['', [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':secretsmanager:',
                  { Ref: 'AWS::Region' },
                  ':',
                  { Ref: 'AWS::AccountId' },
                  ':secret:my-secret-??????',
                ]],
              },
            }),
          },
        }));

        test.done();
      },

      'can be provided as a verbatim full secret ARN followed by a JSON key'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        new codebuild.PipelineProject(stack, 'Project', {
          environmentVariables: {
            'ENV_VAR1': {
              type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
              value: 'arn:aws:secretsmanager:us-west-2:123456789012:secret:my-secret-123456:json-key',
            },
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
          'Environment': {
            'EnvironmentVariables': [
              {
                'Name': 'ENV_VAR1',
                'Type': 'SECRETS_MANAGER',
                'Value': 'arn:aws:secretsmanager:us-west-2:123456789012:secret:my-secret-123456:json-key',
              },
            ],
          },
        }));

        // THEN
        expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
          'PolicyDocument': {
            'Statement': arrayWith({
              'Action': 'secretsmanager:GetSecretValue',
              'Effect': 'Allow',
              'Resource': 'arn:aws:secretsmanager:us-west-2:123456789012:secret:my-secret-123456*',
            }),
          },
        }));

        // THEN
        expect(stack).to(not(haveResourceLike('AWS::IAM::Policy', {
          'PolicyDocument': {
            'Statement': arrayWith({
              'Action': 'kms:Decrypt',
              'Effect': 'Allow',
              'Resource': 'arn:aws:kms:us-west-2:123456789012:key/*',
            }),
          },
        })));

        test.done();
      },

      'can be provided as a verbatim partial secret ARN'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        new codebuild.PipelineProject(stack, 'Project', {
          environmentVariables: {
            'ENV_VAR1': {
              type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
              value: 'arn:aws:secretsmanager:us-west-2:123456789012:secret:mysecret',
            },
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
          'Environment': {
            'EnvironmentVariables': [
              {
                'Name': 'ENV_VAR1',
                'Type': 'SECRETS_MANAGER',
                'Value': 'arn:aws:secretsmanager:us-west-2:123456789012:secret:mysecret',
              },
            ],
          },
        }));

        // THEN
        expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
          'PolicyDocument': {
            'Statement': arrayWith({
              'Action': 'secretsmanager:GetSecretValue',
              'Effect': 'Allow',
              'Resource': 'arn:aws:secretsmanager:us-west-2:123456789012:secret:mysecret*',
            }),
          },
        }));

        // THEN
        expect(stack).to(not(haveResourceLike('AWS::IAM::Policy', {
          'PolicyDocument': {
            'Statement': arrayWith({
              'Action': 'kms:Decrypt',
              'Effect': 'Allow',
              'Resource': 'arn:aws:kms:us-west-2:123456789012:key/*',
            }),
          },
        })));

        test.done();
      },

      "when provided as a verbatim partial secret ARN from another account, adds permission to decrypt keys in the Secret's account"(test: Test) {
        // GIVEN
        const app = new cdk.App();
        const stack = new cdk.Stack(app, 'ProjectStack', {
          env: { account: '123456789012' },
        });

        // WHEN
        new codebuild.PipelineProject(stack, 'Project', {
          environmentVariables: {
            'ENV_VAR1': {
              type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
              value: 'arn:aws:secretsmanager:us-west-2:901234567890:secret:mysecret',
            },
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
          'PolicyDocument': {
            'Statement': arrayWith({
              'Action': 'kms:Decrypt',
              'Effect': 'Allow',
              'Resource': 'arn:aws:kms:us-west-2:901234567890:key/*',
            }),
          },
        }));

        test.done();
      },

      'when two secrets from another account are provided as verbatim partial secret ARNs, adds only one permission for decrypting'(test: Test) {
        // GIVEN
        const app = new cdk.App();
        const stack = new cdk.Stack(app, 'ProjectStack', {
          env: { account: '123456789012' },
        });

        // WHEN
        new codebuild.PipelineProject(stack, 'Project', {
          environmentVariables: {
            'ENV_VAR1': {
              type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
              value: 'arn:aws:secretsmanager:us-west-2:901234567890:secret:mysecret',
            },
            'ENV_VAR2': {
              type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
              value: 'arn:aws:secretsmanager:us-west-2:901234567890:secret:other-secret',
            },
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
          'PolicyDocument': {
            'Statement': arrayWith({
              'Action': 'kms:Decrypt',
              'Effect': 'Allow',
              'Resource': 'arn:aws:kms:us-west-2:901234567890:key/*',
            }),
          },
        }));

        test.done();
      },

      'can be provided as the ARN attribute of a new Secret'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        const secret = new secretsmanager.Secret(stack, 'Secret');
        new codebuild.PipelineProject(stack, 'Project', {
          environmentVariables: {
            'ENV_VAR1': {
              type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
              value: secret.secretArn,
            },
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
          'Environment': {
            'EnvironmentVariables': [
              {
                'Name': 'ENV_VAR1',
                'Type': 'SECRETS_MANAGER',
                'Value': { 'Ref': 'SecretA720EF05' },
              },
            ],
          },
        }));

        // THEN
        expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
          'PolicyDocument': {
            'Statement': arrayWith({
              'Action': 'secretsmanager:GetSecretValue',
              'Effect': 'Allow',
              'Resource': { 'Ref': 'SecretA720EF05' },
            }),
          },
        }));

        test.done();
      },

      'when the same new secret is provided with different JSON keys, only adds the resource once'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        const secret = new secretsmanager.Secret(stack, 'Secret');
        new codebuild.PipelineProject(stack, 'Project', {
          environmentVariables: {
            'ENV_VAR1': {
              type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
              value: `${secret.secretArn}:json-key1`,
            },
            'ENV_VAR2': {
              type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
              value: `${secret.secretArn}:json-key2`,
            },
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
          'Environment': {
            'EnvironmentVariables': [
              {
                'Name': 'ENV_VAR1',
                'Type': 'SECRETS_MANAGER',
                'Value': { 'Fn::Join': ['', [{ 'Ref': 'SecretA720EF05' }, ':json-key1']] },
              },
              {
                'Name': 'ENV_VAR2',
                'Type': 'SECRETS_MANAGER',
                'Value': { 'Fn::Join': ['', [{ 'Ref': 'SecretA720EF05' }, ':json-key2']] },
              },
            ],
          },
        }));

        // THEN
        expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
          'PolicyDocument': {
            'Statement': arrayWith({
              'Action': 'secretsmanager:GetSecretValue',
              'Effect': 'Allow',
              'Resource': { 'Ref': 'SecretA720EF05' },
            }),
          },
        }));

        test.done();
      },

      'can be provided as the ARN attribute of a new Secret, followed by a JSON key'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        const secret = new secretsmanager.Secret(stack, 'Secret');
        new codebuild.PipelineProject(stack, 'Project', {
          environmentVariables: {
            'ENV_VAR1': {
              type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
              value: `${secret.secretArn}:json-key:version-stage`,
            },
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
          'Environment': {
            'EnvironmentVariables': [
              {
                'Name': 'ENV_VAR1',
                'Type': 'SECRETS_MANAGER',
                'Value': {
                  'Fn::Join': ['', [
                    { 'Ref': 'SecretA720EF05' },
                    ':json-key:version-stage',
                  ]],
                },
              },
            ],
          },
        }));

        // THEN
        expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
          'PolicyDocument': {
            'Statement': arrayWith({
              'Action': 'secretsmanager:GetSecretValue',
              'Effect': 'Allow',
              'Resource': { 'Ref': 'SecretA720EF05' },
            }),
          },
        }));

        test.done();
      },

      'can be provided as the name attribute of a Secret imported by name'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        const secret = secretsmanager.Secret.fromSecretNameV2(stack, 'Secret', 'mysecret');
        new codebuild.PipelineProject(stack, 'Project', {
          environmentVariables: {
            'ENV_VAR1': {
              type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
              value: secret.secretName,
            },
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
          'Environment': {
            'EnvironmentVariables': [
              {
                'Name': 'ENV_VAR1',
                'Type': 'SECRETS_MANAGER',
                'Value': 'mysecret',
              },
            ],
          },
        }));

        // THEN
        expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
          'PolicyDocument': {
            'Statement': arrayWith({
              'Action': 'secretsmanager:GetSecretValue',
              'Effect': 'Allow',
              'Resource': {
                'Fn::Join': ['', [
                  'arn:',
                  { 'Ref': 'AWS::Partition' },
                  ':secretsmanager:',
                  { 'Ref': 'AWS::Region' },
                  ':',
                  { 'Ref': 'AWS::AccountId' },
                  ':secret:mysecret-??????',
                ]],
              },
            }),
          },
        }));

        test.done();
      },

      'can be provided as the ARN attribute of a Secret imported by partial ARN, followed by a JSON key'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        const secret = secretsmanager.Secret.fromSecretPartialArn(stack, 'Secret',
          'arn:aws:secretsmanager:us-west-2:123456789012:secret:mysecret');
        new codebuild.PipelineProject(stack, 'Project', {
          environmentVariables: {
            'ENV_VAR1': {
              type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
              value: `${secret.secretArn}:json-key`,
            },
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
          'Environment': {
            'EnvironmentVariables': [
              {
                'Name': 'ENV_VAR1',
                'Type': 'SECRETS_MANAGER',
                'Value': 'arn:aws:secretsmanager:us-west-2:123456789012:secret:mysecret:json-key',
              },
            ],
          },
        }));

        // THEN
        expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
          'PolicyDocument': {
            'Statement': arrayWith({
              'Action': 'secretsmanager:GetSecretValue',
              'Effect': 'Allow',
              'Resource': 'arn:aws:secretsmanager:us-west-2:123456789012:secret:mysecret*',
            }),
          },
        }));

        test.done();
      },

      'can be provided as the ARN attribute of a Secret imported by complete ARN, followed by a JSON key'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        const secret = secretsmanager.Secret.fromSecretCompleteArn(stack, 'Secret',
          'arn:aws:secretsmanager:us-west-2:123456789012:secret:mysecret-123456');
        new codebuild.PipelineProject(stack, 'Project', {
          environmentVariables: {
            'ENV_VAR1': {
              type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
              value: `${secret.secretArn}:json-key`,
            },
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
          'Environment': {
            'EnvironmentVariables': [
              {
                'Name': 'ENV_VAR1',
                'Type': 'SECRETS_MANAGER',
                'Value': 'arn:aws:secretsmanager:us-west-2:123456789012:secret:mysecret-123456:json-key',
              },
            ],
          },
        }));

        // THEN
        expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
          'PolicyDocument': {
            'Statement': arrayWith({
              'Action': 'secretsmanager:GetSecretValue',
              'Effect': 'Allow',
              'Resource': 'arn:aws:secretsmanager:us-west-2:123456789012:secret:mysecret-123456*',
            }),
          },
        }));

        test.done();
      },

      'can be provided as a SecretArn of a new Secret, with its physical name set, created in a different account'(test: Test) {
        // GIVEN
        const app = new cdk.App();
        const secretStack = new cdk.Stack(app, 'SecretStack', {
          env: { account: '012345678912' },
        });
        const stack = new cdk.Stack(app, 'ProjectStack', {
          env: { account: '123456789012' },
        });

        // WHEN
        const secret = new secretsmanager.Secret(secretStack, 'Secret', { secretName: 'secret-name' });
        new codebuild.PipelineProject(stack, 'Project', {
          environmentVariables: {
            'ENV_VAR1': {
              type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
              value: secret.secretArn,
            },
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
          'Environment': {
            'EnvironmentVariables': [
              {
                'Name': 'ENV_VAR1',
                'Type': 'SECRETS_MANAGER',
                'Value': {
                  'Fn::Join': ['', [
                    'arn:',
                    { 'Ref': 'AWS::Partition' },
                    ':secretsmanager:',
                    { 'Ref': 'AWS::Region' },
                    ':012345678912:secret:secret-name',
                  ]],
                },
              },
            ],
          },
        }));

        expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
          'PolicyDocument': {
            'Statement': arrayWith({
              'Action': 'secretsmanager:GetSecretValue',
              'Effect': 'Allow',
              'Resource': {
                'Fn::Join': ['', [
                  'arn:',
                  { 'Ref': 'AWS::Partition' },
                  ':secretsmanager:',
                  { 'Ref': 'AWS::Region' },
                  ':012345678912:secret:secret-name-??????',
                ]],
              },
            }),
          },
        }));

        expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
          'PolicyDocument': {
            'Statement': arrayWith({
              'Action': 'kms:Decrypt',
              'Effect': 'Allow',
              'Resource': {
                'Fn::Join': ['', [
                  'arn:',
                  { 'Ref': 'AWS::Partition' },
                  ':kms:',
                  { 'Ref': 'AWS::Region' },
                  ':012345678912:key/*',
                ]],
              },
            }),
          },
        }));

        test.done();
      },

      'can be provided as a SecretArn of a Secret imported by name in a different account'(test: Test) {
        // GIVEN
        const app = new cdk.App();
        const secretStack = new cdk.Stack(app, 'SecretStack', {
          env: { account: '012345678912' },
        });
        const stack = new cdk.Stack(app, 'ProjectStack', {
          env: { account: '123456789012' },
        });

        // WHEN
        const secret = secretsmanager.Secret.fromSecretNameV2(secretStack, 'Secret', 'secret-name');
        new codebuild.PipelineProject(stack, 'Project', {
          environmentVariables: {
            'ENV_VAR1': {
              type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
              value: `${secret.secretArn}:json-key`,
            },
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
          'Environment': {
            'EnvironmentVariables': [
              {
                'Name': 'ENV_VAR1',
                'Type': 'SECRETS_MANAGER',
                'Value': {
                  'Fn::Join': ['', [
                    'arn:',
                    { 'Ref': 'AWS::Partition' },
                    ':secretsmanager:',
                    { 'Ref': 'AWS::Region' },
                    ':012345678912:secret:secret-name:json-key',
                  ]],
                },
              },
            ],
          },
        }));

        expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
          'PolicyDocument': {
            'Statement': arrayWith({
              'Action': 'secretsmanager:GetSecretValue',
              'Effect': 'Allow',
              'Resource': {
                'Fn::Join': ['', [
                  'arn:',
                  { 'Ref': 'AWS::Partition' },
                  ':secretsmanager:',
                  { 'Ref': 'AWS::Region' },
                  ':012345678912:secret:secret-name*',
                ]],
              },
            }),
          },
        }));

        expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
          'PolicyDocument': {
            'Statement': arrayWith({
              'Action': 'kms:Decrypt',
              'Effect': 'Allow',
              'Resource': {
                'Fn::Join': ['', [
                  'arn:',
                  { 'Ref': 'AWS::Partition' },
                  ':kms:',
                  { 'Ref': 'AWS::Region' },
                  ':012345678912:key/*',
                ]],
              },
            }),
          },
        }));

        test.done();
      },

      'can be provided as a SecretArn of a Secret imported by complete ARN from a different account'(test: Test) {
        // GIVEN
        const app = new cdk.App();
        const stack = new cdk.Stack(app, 'ProjectStack', {
          env: { account: '123456789012' },
        });
        const secretArn = 'arn:aws:secretsmanager:us-west-2:901234567890:secret:mysecret-123456';

        // WHEN
        const secret = secretsmanager.Secret.fromSecretCompleteArn(stack, 'Secret', secretArn);
        new codebuild.PipelineProject(stack, 'Project', {
          environmentVariables: {
            'ENV_VAR1': {
              type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
              value: secret.secretArn,
            },
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
          'Environment': {
            'EnvironmentVariables': [
              {
                'Name': 'ENV_VAR1',
                'Type': 'SECRETS_MANAGER',
                'Value': secretArn,
              },
            ],
          },
        }));

        expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
          'PolicyDocument': {
            'Statement': arrayWith({
              'Action': 'secretsmanager:GetSecretValue',
              'Effect': 'Allow',
              'Resource': `${secretArn}*`,
            }),
          },
        }));

        expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
          'PolicyDocument': {
            'Statement': arrayWith({
              'Action': 'kms:Decrypt',
              'Effect': 'Allow',
              'Resource': 'arn:aws:kms:us-west-2:901234567890:key/*',
            }),
          },
        }));

        test.done();
      },

      'should fail when the parsed Arn does not contain a secret name'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        test.throws(() => {
          new codebuild.PipelineProject(stack, 'Project', {
            environmentVariables: {
              'ENV_VAR1': {
                type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
                value: 'arn:aws:secretsmanager:us-west-2:123456789012:secret',
              },
            },
          });
        }, /SecretManager ARN is missing the name of the secret:/);

        test.done();
      },
    },

    'should fail creating when using a secret value in a plaintext variable'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // THEN
      test.throws(() => {
        new codebuild.PipelineProject(stack, 'Project', {
          environmentVariables: {
            'a': {
              value: `a_${cdk.SecretValue.secretsManager('my-secret')}_b`,
            },
          },
        });
      }, /Plaintext environment variable 'a' contains a secret value!/);

      test.done();
    },

    "should allow opting out of the 'secret value in a plaintext variable' validation"(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // THEN
      new codebuild.PipelineProject(stack, 'Project', {
        environmentVariables: {
          'b': {
            value: cdk.SecretValue.secretsManager('my-secret'),
          },
        },
        checkSecretsInPlainTextEnvVariables: false,
      });

      test.done();
    },
  },

  'Timeouts': {
    'can add queued timeout'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      new codebuild.Project(stack, 'Project', {
        source: codebuild.Source.s3({
          bucket: new s3.Bucket(stack, 'Bucket'),
          path: 'path',
        }),
        queuedTimeout: cdk.Duration.minutes(30),
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
        QueuedTimeoutInMinutes: 30,
      }));

      test.done();
    },

    'can override build timeout'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      new codebuild.Project(stack, 'Project', {
        source: codebuild.Source.s3({
          bucket: new s3.Bucket(stack, 'Bucket'),
          path: 'path',
        }),
        timeout: cdk.Duration.minutes(30),
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
        TimeoutInMinutes: 30,
      }));

      test.done();
    },
  },

  'Maximum concurrency': {
    'can limit maximum concurrency'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      new codebuild.Project(stack, 'Project', {
        source: codebuild.Source.s3({
          bucket: new s3.Bucket(stack, 'Bucket'),
          path: 'path',
        }),
        concurrentBuildLimit: 1,
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::CodeBuild::Project', {
        ConcurrentBuildLimit: 1,
      }));

      test.done();
    },
  },

  'can be imported': {
    'by ARN'(test: Test) {
      const stack = new cdk.Stack();
      const project = codebuild.Project.fromProjectArn(stack, 'Project',
        'arn:aws:codebuild:us-west-2:123456789012:project/My-Project');

      test.equal(project.projectName, 'My-Project');
      test.equal(project.env.account, '123456789012');
      test.equal(project.env.region, 'us-west-2');

      test.done();
    },
  },
};
