import { EOL } from 'os';
import { expect as expectCDK, haveResource, haveResourceLike, ResourcePart } from '@aws-cdk/assert-internal';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import * as ecr from '../lib';

/* eslint-disable quote-props */

describe('repository', () => {
  test('construct repository', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    new ecr.Repository(stack, 'Repo');

    // THEN
    expectCDK(stack).toMatch({
      Resources: {
        Repo02AC86CF: {
          Type: 'AWS::ECR::Repository',
          DeletionPolicy: 'Retain',
          UpdateReplacePolicy: 'Retain',
        },
      },
    });
  });

  test('repository creation with imageScanOnPush', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    new ecr.Repository(stack, 'Repo', { imageScanOnPush: true });

    // THEN
    expectCDK(stack).to(haveResource('AWS::ECR::Repository', {
      ImageScanningConfiguration: {
        ScanOnPush: true,
      },
    }));
  });

  test('tag-based lifecycle policy', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const repo = new ecr.Repository(stack, 'Repo');

    // WHEN
    repo.addLifecycleRule({ tagPrefixList: ['abc'], maxImageCount: 1 });

    // THEN
    expectCDK(stack).to(haveResource('AWS::ECR::Repository', {
      LifecyclePolicy: {
        // eslint-disable-next-line max-len
        LifecyclePolicyText: '{"rules":[{"rulePriority":1,"selection":{"tagStatus":"tagged","tagPrefixList":["abc"],"countType":"imageCountMoreThan","countNumber":1},"action":{"type":"expire"}}]}',
      },
    }));
  });

  test('image tag mutability can be set', () => {
    // GIVEN
    const stack = new cdk.Stack();
    new ecr.Repository(stack, 'Repo', { imageTagMutability: ecr.TagMutability.IMMUTABLE });

    // THEN
    expectCDK(stack).to(haveResource('AWS::ECR::Repository', {
      ImageTagMutability: 'IMMUTABLE',
    }));
  });

  test('add day-based lifecycle policy', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const repo = new ecr.Repository(stack, 'Repo');
    repo.addLifecycleRule({
      maxImageAge: cdk.Duration.days(5),
    });

    // THEN
    expectCDK(stack).to(haveResource('AWS::ECR::Repository', {
      LifecyclePolicy: {
        // eslint-disable-next-line max-len
        LifecyclePolicyText: '{"rules":[{"rulePriority":1,"selection":{"tagStatus":"any","countType":"sinceImagePushed","countNumber":5,"countUnit":"days"},"action":{"type":"expire"}}]}',
      },
    }));
  });

  test('add count-based lifecycle policy', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const repo = new ecr.Repository(stack, 'Repo');

    // WHEN
    repo.addLifecycleRule({
      maxImageCount: 5,
    });

    // THEN
    expectCDK(stack).to(haveResource('AWS::ECR::Repository', {
      LifecyclePolicy: {
        // eslint-disable-next-line max-len
        LifecyclePolicyText: '{"rules":[{"rulePriority":1,"selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":5},"action":{"type":"expire"}}]}',
      },
    }));
  });

  test('mixing numbered and unnumbered rules', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const repo = new ecr.Repository(stack, 'Repo');

    // WHEN
    repo.addLifecycleRule({ tagStatus: ecr.TagStatus.TAGGED, tagPrefixList: ['a'], maxImageCount: 5 });
    repo.addLifecycleRule({ rulePriority: 10, tagStatus: ecr.TagStatus.TAGGED, tagPrefixList: ['b'], maxImageCount: 5 });

    // THEN
    expectCDK(stack).to(haveResource('AWS::ECR::Repository', {
      LifecyclePolicy: {
        // eslint-disable-next-line max-len
        LifecyclePolicyText: '{"rules":[{"rulePriority":10,"selection":{"tagStatus":"tagged","tagPrefixList":["b"],"countType":"imageCountMoreThan","countNumber":5},"action":{"type":"expire"}},{"rulePriority":11,"selection":{"tagStatus":"tagged","tagPrefixList":["a"],"countType":"imageCountMoreThan","countNumber":5},"action":{"type":"expire"}}]}',
      },
    }));
  });

  test('tagstatus Any is automatically sorted to the back', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const repo = new ecr.Repository(stack, 'Repo');

    // WHEN
    repo.addLifecycleRule({ maxImageCount: 5 });
    repo.addLifecycleRule({ tagStatus: ecr.TagStatus.TAGGED, tagPrefixList: ['important'], maxImageCount: 999 });

    // THEN
    expectCDK(stack).to(haveResource('AWS::ECR::Repository', {
      LifecyclePolicy: {
        // eslint-disable-next-line max-len
        LifecyclePolicyText: '{"rules":[{"rulePriority":1,"selection":{"tagStatus":"tagged","tagPrefixList":["important"],"countType":"imageCountMoreThan","countNumber":999},"action":{"type":"expire"}},{"rulePriority":2,"selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":5},"action":{"type":"expire"}}]}',
      },
    }));
  });

  test('lifecycle rules can be added upon initialization', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    new ecr.Repository(stack, 'Repo', {
      lifecycleRules: [
        { maxImageCount: 3 },
      ],
    });

    // THEN
    expectCDK(stack).to(haveResource('AWS::ECR::Repository', {
      'LifecyclePolicy': {
        // eslint-disable-next-line max-len
        'LifecyclePolicyText': '{"rules":[{"rulePriority":1,"selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":3},"action":{"type":"expire"}}]}',
      },
    }));
  });

  test('calculate repository URI', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const repo = new ecr.Repository(stack, 'Repo');

    // WHEN
    const uri = repo.repositoryUri;

    // THEN
    const arnSplit = { 'Fn::Split': [':', { 'Fn::GetAtt': ['Repo02AC86CF', 'Arn'] }] };
    expectCDK(stack.resolve(uri)).toMatch({
      'Fn::Join': ['', [
        { 'Fn::Select': [4, arnSplit] },
        '.dkr.ecr.',
        { 'Fn::Select': [3, arnSplit] },
        '.',
        { Ref: 'AWS::URLSuffix' },
        '/',
        { Ref: 'Repo02AC86CF' },
      ]],
    });
  });

  test('import with concrete arn', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const repo2 = ecr.Repository.fromRepositoryArn(stack, 'repo', 'arn:aws:ecr:us-east-1:585695036304:repository/foo/bar/foo/fooo');

    // THEN
    expect(stack.resolve(repo2.repositoryArn)).toBe('arn:aws:ecr:us-east-1:585695036304:repository/foo/bar/foo/fooo');
    expect(stack.resolve(repo2.repositoryName)).toBe('foo/bar/foo/fooo');
  });

  test('fails if importing with token arn and no name', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN/THEN
    expect(() => {
      ecr.Repository.fromRepositoryArn(stack, 'arn', cdk.Fn.getAtt('Boom', 'Boom').toString());
    }).toThrow(/\"repositoryArn\" is a late-bound value, and therefore \"repositoryName\" is required\. Use \`fromRepositoryAttributes\` instead/);
  });

  test('import with token arn and repository name (see awslabs/aws-cdk#1232)', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const repo = ecr.Repository.fromRepositoryAttributes(stack, 'Repo', {
      repositoryArn: cdk.Fn.getAtt('Boom', 'Arn').toString(),
      repositoryName: cdk.Fn.getAtt('Boom', 'Name').toString(),
    });

    // THEN
    expectCDK(stack.resolve(repo.repositoryArn)).toMatch({ 'Fn::GetAtt': ['Boom', 'Arn'] });
    expectCDK(stack.resolve(repo.repositoryName)).toMatch({ 'Fn::GetAtt': ['Boom', 'Name'] });
  });

  test('import only with a repository name (arn is deduced)', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const repo = ecr.Repository.fromRepositoryName(stack, 'just-name', 'my-repo');

    // THEN
    expectCDK(stack.resolve(repo.repositoryArn)).toMatch({
      'Fn::Join': ['', [
        'arn:',
        { Ref: 'AWS::Partition' },
        ':ecr:',
        { Ref: 'AWS::Region' },
        ':',
        { Ref: 'AWS::AccountId' },
        ':repository/my-repo',
      ]],
    });
    expect(stack.resolve(repo.repositoryName)).toBe('my-repo');
  });

  test('arnForLocalRepository can be used to render an ARN for a local repository', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const repoName = cdk.Fn.getAtt('Boom', 'Name').toString();

    // WHEN
    const repo = ecr.Repository.fromRepositoryAttributes(stack, 'Repo', {
      repositoryArn: ecr.Repository.arnForLocalRepository(repoName, stack),
      repositoryName: repoName,
    });

    // THEN
    expectCDK(stack.resolve(repo.repositoryName)).toMatch({ 'Fn::GetAtt': ['Boom', 'Name'] });
    expectCDK(stack.resolve(repo.repositoryArn)).toMatch({
      'Fn::Join': ['', [
        'arn:',
        { Ref: 'AWS::Partition' },
        ':ecr:',
        { Ref: 'AWS::Region' },
        ':',
        { Ref: 'AWS::AccountId' },
        ':repository/',
        { 'Fn::GetAtt': ['Boom', 'Name'] },
      ]],
    });
  });

  test('resource policy', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const repo = new ecr.Repository(stack, 'Repo');

    // WHEN
    repo.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['*'],
      principals: [new iam.AnyPrincipal()],
    }));

    // THEN
    expectCDK(stack).to(haveResource('AWS::ECR::Repository', {
      RepositoryPolicyText: {
        Statement: [
          {
            Action: '*',
            Effect: 'Allow',
            Principal: { AWS: '*' },
          },
        ],
        Version: '2012-10-17',
      },
    }));
  });

  test('fails if repository policy has no actions', () => {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'my-stack');
    const repo = new ecr.Repository(stack, 'Repo');

    // WHEN
    repo.addToResourcePolicy(new iam.PolicyStatement({
      resources: ['*'],
      principals: [new iam.ArnPrincipal('arn')],
    }));

    // THEN
    expect(() => app.synth()).toThrow(/A PolicyStatement must specify at least one \'action\' or \'notAction\'/);
  });

  test('fails if repository policy has no IAM principals', () => {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'my-stack');
    const repo = new ecr.Repository(stack, 'Repo');

    // WHEN
    repo.addToResourcePolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: ['ecr:*'],
    }));

    // THEN
    expect(() => app.synth()).toThrow(/A PolicyStatement used in a resource-based policy must specify at least one IAM principal/);
  });

  describe('events', () => {
    test('onImagePushed without imageTag creates the correct event', () => {
      const stack = new cdk.Stack();
      const repo = new ecr.Repository(stack, 'Repo');

      repo.onCloudTrailImagePushed('EventRule', {
        target: {
          bind: () => ({ arn: 'ARN', id: '' }),
        },
      });

      expectCDK(stack).to(haveResourceLike('AWS::Events::Rule', {
        'EventPattern': {
          'source': [
            'aws.ecr',
          ],
          'detail': {
            'eventName': [
              'PutImage',
            ],
            'requestParameters': {
              'repositoryName': [
                {
                  'Ref': 'Repo02AC86CF',
                },
              ],
            },
          },
        },
        'State': 'ENABLED',
      }));
    });

    test('onImageScanCompleted without imageTags creates the correct event', () => {
      const stack = new cdk.Stack();
      const repo = new ecr.Repository(stack, 'Repo');

      repo.onImageScanCompleted('EventRule', {
        target: {
          bind: () => ({ arn: 'ARN', id: '' }),
        },
      });

      expectCDK(stack).to(haveResourceLike('AWS::Events::Rule', {
        'EventPattern': {
          'source': [
            'aws.ecr',
          ],
          'detail': {
            'repository-name': [
              {
                'Ref': 'Repo02AC86CF',
              },
            ],
            'scan-status': [
              'COMPLETE',
            ],
          },
        },
        'State': 'ENABLED',
      }));
    });

    test('onImageScanCompleted with one imageTag creates the correct event', () => {
      const stack = new cdk.Stack();
      const repo = new ecr.Repository(stack, 'Repo');

      repo.onImageScanCompleted('EventRule', {
        imageTags: ['some-tag'],
        target: {
          bind: () => ({ arn: 'ARN', id: '' }),
        },
      });

      expectCDK(stack).to(haveResourceLike('AWS::Events::Rule', {
        'EventPattern': {
          'source': [
            'aws.ecr',
          ],
          'detail': {
            'repository-name': [
              {
                'Ref': 'Repo02AC86CF',
              },
            ],
            'image-tags': [
              'some-tag',
            ],
            'scan-status': [
              'COMPLETE',
            ],
          },
        },
        'State': 'ENABLED',
      }));
    });

    test('onImageScanCompleted with multiple imageTags creates the correct event', () => {
      const stack = new cdk.Stack();
      const repo = new ecr.Repository(stack, 'Repo');

      repo.onImageScanCompleted('EventRule', {
        imageTags: ['tag1', 'tag2', 'tag3'],
        target: {
          bind: () => ({ arn: 'ARN', id: '' }),
        },
      });

      expectCDK(stack).to(haveResourceLike('AWS::Events::Rule', {
        'EventPattern': {
          'source': [
            'aws.ecr',
          ],
          'detail': {
            'repository-name': [
              {
                'Ref': 'Repo02AC86CF',
              },
            ],
            'image-tags': [
              'tag1',
              'tag2',
              'tag3',
            ],
            'scan-status': [
              'COMPLETE',
            ],
          },
        },
        'State': 'ENABLED',
      }));
    });

    test('removal policy is "Retain" by default', () => {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      new ecr.Repository(stack, 'Repo');

      // THEN
      expectCDK(stack).to(haveResource('AWS::ECR::Repository', {
        'Type': 'AWS::ECR::Repository',
        'DeletionPolicy': 'Retain',
      }, ResourcePart.CompleteDefinition));
    });

    test('"Delete" removal policy can be set explicitly', () => {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      new ecr.Repository(stack, 'Repo', {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });

      // THEN
      expectCDK(stack).to(haveResource('AWS::ECR::Repository', {
        'Type': 'AWS::ECR::Repository',
        'DeletionPolicy': 'Delete',
      }, ResourcePart.CompleteDefinition));
    });

    test('grant adds appropriate resource-*', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const repo = new ecr.Repository(stack, 'TestHarnessRepo');

      // WHEN
      repo.grantPull(new iam.AnyPrincipal());

      // THEN
      expectCDK(stack).to(haveResource('AWS::ECR::Repository', {
        'RepositoryPolicyText': {
          'Statement': [
            {
              'Action': [
                'ecr:BatchCheckLayerAvailability',
                'ecr:GetDownloadUrlForLayer',
                'ecr:BatchGetImage',
              ],
              'Effect': 'Allow',
              'Principal': { AWS: '*' },
            },
          ],
          'Version': '2012-10-17',
        },
      }));
    });
  });

  describe('repository name validation', () => {
    test('repository name validations', () => {
      const stack = new cdk.Stack();

      expect(() => new ecr.Repository(stack, 'Repo1', {
        repositoryName: 'abc-xyz-34ab',
      })).not.toThrow();

      expect(() => new ecr.Repository(stack, 'Repo2', {
        repositoryName: '124/pp-33',
      })).not.toThrow();
    });

    test('repository name validation skips tokenized values', () => {
      const stack = new cdk.Stack();

      expect(() => new ecr.Repository(stack, 'Repo', {
        repositoryName: cdk.Lazy.string({ produce: () => '_REPO' }),
      })).not.toThrow();
    });

    test('fails with message on invalid repository names', () => {
      const stack = new cdk.Stack();
      const repositoryName = `-repositoRy.--${new Array(256).join('$')}`;
      const expectedErrors = [
        `Invalid ECR repository name (value: ${repositoryName})`,
        'Repository name must be at least 2 and no more than 256 characters',
        'Repository name must follow the specified pattern: (?:[a-z0-9]+(?:[._-][a-z0-9]+)*/)*[a-z0-9]+(?:[._-][a-z0-9]+)*',
      ].join(EOL);

      expect(() => new ecr.Repository(stack, 'Repo', {
        repositoryName,
      })).toThrow(expectedErrors);
    });

    test('fails if repository name has less than 2 or more than 256 characters', () => {
      const stack = new cdk.Stack();

      expect(() => new ecr.Repository(stack, 'Repo1', {
        repositoryName: 'a',
      })).toThrow(/at least 2/);

      expect(() => new ecr.Repository(stack, 'Repo2', {
        repositoryName: new Array(258).join('x'),
      })).toThrow(/no more than 256/);
    });

    test('fails if repository name does not follow the specified pattern', () => {
      const stack = new cdk.Stack();

      expect(() => new ecr.Repository(stack, 'Repo1', {
        repositoryName: 'aAa',
      })).toThrow(/must follow the specified pattern/);

      expect(() => new ecr.Repository(stack, 'Repo2', {
        repositoryName: 'a--a',
      })).toThrow(/must follow the specified pattern/);

      expect(() => new ecr.Repository(stack, 'Repo3', {
        repositoryName: 'a./a-a',
      })).toThrow(/must follow the specified pattern/);

      expect(() => new ecr.Repository(stack, 'Repo4', {
        repositoryName: 'a//a-a',
      })).toThrow(/must follow the specified pattern/);
    });
  });
});
