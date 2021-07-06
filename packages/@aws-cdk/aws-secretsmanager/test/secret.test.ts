import '@aws-cdk/assert-internal/jest';
import { expect as assertExpect, ResourcePart } from '@aws-cdk/assert-internal';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import * as lambda from '@aws-cdk/aws-lambda';
import * as cdk from '@aws-cdk/core';
import { testFutureBehavior, testLegacyBehavior } from 'cdk-build-tools/lib/feature-flag';
import * as secretsmanager from '../lib';

let app: cdk.App;
let stack: cdk.Stack;
beforeEach(() => {
  app = new cdk.App();
  stack = new cdk.Stack(app);
});

test('default secret', () => {
  // WHEN
  new secretsmanager.Secret(stack, 'Secret');

  // THEN
  expect(stack).toHaveResource('AWS::SecretsManager::Secret', {
    GenerateSecretString: {},
  });
});

test('set removalPolicy to secret', () => {
  // WHEN
  new secretsmanager.Secret(stack, 'Secret', {
    removalPolicy: cdk.RemovalPolicy.RETAIN,
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::SecretsManager::Secret',
    {
      DeletionPolicy: 'Retain',
    }, ResourcePart.CompleteDefinition,
  );
});

test('secret with kms', () => {
  // GIVEN
  const key = new kms.Key(stack, 'KMS');

  // WHEN
  new secretsmanager.Secret(stack, 'Secret', { encryptionKey: key });

  // THEN
  expect(stack).toHaveResourceLike('AWS::KMS::Key', {
    KeyPolicy: {
      Statement: [
        {},
        {
          Effect: 'Allow',
          Resource: '*',
          Action: [
            'kms:Decrypt',
            'kms:Encrypt',
            'kms:ReEncrypt*',
            'kms:GenerateDataKey*',
          ],
          Principal: {
            AWS: {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  {
                    Ref: 'AWS::Partition',
                  },
                  ':iam::',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':root',
                ],
              ],
            },
          },
          Condition: {
            StringEquals: {
              'kms:ViaService': {
                'Fn::Join': [
                  '',
                  [
                    'secretsmanager.',
                    {
                      Ref: 'AWS::Region',
                    },
                    '.amazonaws.com',
                  ],
                ],
              },
            },
          },
        },
        {
          Effect: 'Allow',
          Resource: '*',
          Action: [
            'kms:CreateGrant',
            'kms:DescribeKey',
          ],
          Principal: {
            AWS: {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  {
                    Ref: 'AWS::Partition',
                  },
                  ':iam::',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':root',
                ],
              ],
            },
          },
          Condition: {
            StringEquals: {
              'kms:ViaService': {
                'Fn::Join': [
                  '',
                  [
                    'secretsmanager.',
                    {
                      Ref: 'AWS::Region',
                    },
                    '.amazonaws.com',
                  ],
                ],
              },
            },
          },
        },
      ],
      Version: '2012-10-17',
    },
  });
});

test('secret with generate secret string options', () => {
  // WHEN
  new secretsmanager.Secret(stack, 'Secret', {
    generateSecretString: {
      excludeUppercase: true,
      passwordLength: 20,
    },
  });

  // THEN
  expect(stack).toHaveResource('AWS::SecretsManager::Secret', {
    GenerateSecretString: {
      ExcludeUppercase: true,
      PasswordLength: 20,
    },
  });
});

test('templated secret string', () => {
  // WHEN
  new secretsmanager.Secret(stack, 'Secret', {
    generateSecretString: {
      secretStringTemplate: JSON.stringify({ username: 'username' }),
      generateStringKey: 'password',
    },
  });

  // THEN
  expect(stack).toHaveResource('AWS::SecretsManager::Secret', {
    GenerateSecretString: {
      SecretStringTemplate: '{"username":"username"}',
      GenerateStringKey: 'password',
    },
  });
});

test('grantRead', () => {
  // GIVEN
  const key = new kms.Key(stack, 'KMS');
  const secret = new secretsmanager.Secret(stack, 'Secret', { encryptionKey: key });
  const role = new iam.Role(stack, 'Role', { assumedBy: new iam.AccountRootPrincipal() });

  // WHEN
  secret.grantRead(role);

  // THEN
  expect(stack).toHaveResource('AWS::IAM::Policy', {
    PolicyDocument: {
      Version: '2012-10-17',
      Statement: [{
        Action: [
          'secretsmanager:GetSecretValue',
          'secretsmanager:DescribeSecret',
        ],
        Effect: 'Allow',
        Resource: { Ref: 'SecretA720EF05' },
      }],
    },
  });
  expect(stack).toHaveResourceLike('AWS::KMS::Key', {
    KeyPolicy: {
      Statement: [
        {},
        {},
        {},
        {
          Action: 'kms:Decrypt',
          Condition: {
            StringEquals: {
              'kms:ViaService': {
                'Fn::Join': [
                  '',
                  [
                    'secretsmanager.',
                    {
                      Ref: 'AWS::Region',
                    },
                    '.amazonaws.com',
                  ],
                ],
              },
            },
          },
          Effect: 'Allow',
          Principal: {
            AWS: {
              'Fn::GetAtt': [
                'Role1ABCC5F0',
                'Arn',
              ],
            },
          },
          Resource: '*',
        },
      ],
      Version: '2012-10-17',
    },
  });
});

test('grantRead cross account', () => {
  // GIVEN
  const key = new kms.Key(stack, 'KMS');
  const secret = new secretsmanager.Secret(stack, 'Secret', { encryptionKey: key });
  const principal = new iam.AccountPrincipal('1234');

  // WHEN
  secret.grantRead(principal, ['FOO', 'bar']).assertSuccess();

  // THEN
  expect(stack).toHaveResource('AWS::SecretsManager::ResourcePolicy', {
    ResourcePolicy: {
      Statement: [
        {
          Action: [
            'secretsmanager:GetSecretValue',
            'secretsmanager:DescribeSecret',
          ],
          Effect: 'Allow',
          Condition: {
            'ForAnyValue:StringEquals': {
              'secretsmanager:VersionStage': [
                'FOO',
                'bar',
              ],
            },
          },
          Principal: {
            AWS: {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  {
                    Ref: 'AWS::Partition',
                  },
                  ':iam::1234:root',
                ],
              ],
            },
          },
          Resource: {
            Ref: 'SecretA720EF05',
          },
        },
      ],
      Version: '2012-10-17',
    },
    SecretId: {
      Ref: 'SecretA720EF05',
    },
  });

  expect(stack).toHaveResourceLike('AWS::KMS::Key', {
    KeyPolicy: {
      Statement: [
        {},
        {},
        {},
        {
          Action: 'kms:Decrypt',
          Condition: {
            StringEquals: {
              'kms:ViaService': {
                'Fn::Join': [
                  '',
                  [
                    'secretsmanager.',
                    {
                      Ref: 'AWS::Region',
                    },
                    '.amazonaws.com',
                  ],
                ],
              },
            },
          },
          Effect: 'Allow',
          Principal: {
            AWS: {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  {
                    Ref: 'AWS::Partition',
                  },
                  ':iam::1234:root',
                ],
              ],
            },
          },
          Resource: '*',
        },
      ],
      Version: '2012-10-17',
    },
  });
});

test('grantRead with version label constraint', () => {
  // GIVEN
  const key = new kms.Key(stack, 'KMS');
  const secret = new secretsmanager.Secret(stack, 'Secret', { encryptionKey: key });
  const role = new iam.Role(stack, 'Role', { assumedBy: new iam.AccountRootPrincipal() });

  // WHEN
  secret.grantRead(role, ['FOO', 'bar']);

  // THEN
  expect(stack).toHaveResource('AWS::IAM::Policy', {
    PolicyDocument: {
      Version: '2012-10-17',
      Statement: [{
        Action: [
          'secretsmanager:GetSecretValue',
          'secretsmanager:DescribeSecret',
        ],
        Effect: 'Allow',
        Resource: { Ref: 'SecretA720EF05' },
        Condition: {
          'ForAnyValue:StringEquals': {
            'secretsmanager:VersionStage': ['FOO', 'bar'],
          },
        },
      }],
    },
  });
  expect(stack).toHaveResourceLike('AWS::KMS::Key', {
    KeyPolicy: {
      Statement: [
        {},
        {},
        {},
        {
          Action: 'kms:Decrypt',
          Condition: {
            StringEquals: {
              'kms:ViaService': {
                'Fn::Join': [
                  '',
                  [
                    'secretsmanager.',
                    {
                      Ref: 'AWS::Region',
                    },
                    '.amazonaws.com',
                  ],
                ],
              },
            },
          },
          Effect: 'Allow',
          Principal: {
            AWS: {
              'Fn::GetAtt': [
                'Role1ABCC5F0',
                'Arn',
              ],
            },
          },
          Resource: '*',
        },
      ],
      Version: '2012-10-17',
    },
  });
});

test('grantWrite', () => {
  // GIVEN
  const secret = new secretsmanager.Secret(stack, 'Secret', {});
  const role = new iam.Role(stack, 'Role', { assumedBy: new iam.AccountRootPrincipal() });

  // WHEN
  secret.grantWrite(role);

  // THEN
  expect(stack).toHaveResource('AWS::IAM::Policy', {
    PolicyDocument: {
      Version: '2012-10-17',
      Statement: [{
        Action: [
          'secretsmanager:PutSecretValue',
          'secretsmanager:UpdateSecret',
        ],
        Effect: 'Allow',
        Resource: { Ref: 'SecretA720EF05' },
      }],
    },
  });
});

test('grantWrite with kms', () => {
  // GIVEN
  const key = new kms.Key(stack, 'KMS');
  const secret = new secretsmanager.Secret(stack, 'Secret', { encryptionKey: key });
  const role = new iam.Role(stack, 'Role', { assumedBy: new iam.AccountRootPrincipal() });

  // WHEN
  secret.grantWrite(role);

  // THEN
  const expectStack = expect(stack);
  expectStack.toHaveResource('AWS::IAM::Policy', {
    PolicyDocument: {
      Version: '2012-10-17',
      Statement: [{
        Action: [
          'secretsmanager:PutSecretValue',
          'secretsmanager:UpdateSecret',
        ],
        Effect: 'Allow',
        Resource: { Ref: 'SecretA720EF05' },
      }],
    },
  });
  expectStack.toHaveResourceLike('AWS::KMS::Key', {
    KeyPolicy: {
      Statement: [
        {},
        {},
        {},
        {
          Action: [
            'kms:Encrypt',
            'kms:ReEncrypt*',
            'kms:GenerateDataKey*',
          ],
          Condition: {
            StringEquals: {
              'kms:ViaService': {
                'Fn::Join': [
                  '',
                  [
                    'secretsmanager.',
                    {
                      Ref: 'AWS::Region',
                    },
                    '.amazonaws.com',
                  ],
                ],
              },
            },
          },
          Effect: 'Allow',
          Principal: {
            AWS: {
              'Fn::GetAtt': [
                'Role1ABCC5F0',
                'Arn',
              ],
            },
          },
          Resource: '*',
        },
      ],
    },
  });
});

test('secretValue', () => {
  // GIVEN
  const key = new kms.Key(stack, 'KMS');
  const secret = new secretsmanager.Secret(stack, 'Secret', { encryptionKey: key });

  // WHEN
  new cdk.CfnResource(stack, 'FakeResource', {
    type: 'CDK::Phony::Resource',
    properties: {
      value: secret.secretValue,
    },
  });

  // THEN
  expect(stack).toHaveResource('CDK::Phony::Resource', {
    value: {
      'Fn::Join': ['', [
        '{{resolve:secretsmanager:',
        { Ref: 'SecretA720EF05' },
        ':SecretString:::}}',
      ]],
    },
  });
});

describe('secretName', () => {
  describe('without @aws-cdk/aws-secretsmanager:parseOwnedSecretName set', () => {
    function assertSecretParsing(secret: secretsmanager.Secret) {
      new cdk.CfnOutput(stack, 'MySecretName', {
        value: secret.secretName,
      });

      // Creates secret name by parsing ARN.
      expect(stack).toHaveOutput({
        outputName: 'MySecretName',
        outputValue: { 'Fn::Select': [6, { 'Fn::Split': [':', { Ref: 'SecretA720EF05' }] }] },
      });
    }

    testLegacyBehavior('when secretName is undefined', cdk.App, (cdkApp) => {
      stack = new cdk.Stack(cdkApp);
      const secret = new secretsmanager.Secret(stack, 'Secret', {
        secretName: undefined,
      });
      assertSecretParsing(secret);
    });

    testLegacyBehavior('when secretName is defined', cdk.App, (cdkApp) => {
      stack = new cdk.Stack(cdkApp);
      const secret = new secretsmanager.Secret(stack, 'Secret', {
        secretName: 'mySecret',
      });
      assertSecretParsing(secret);
    });
  });

  describe('with @aws-cdk/aws-secretsmanager:parseOwnedSecretName set', () => {
    const flags = { '@aws-cdk/aws-secretsmanager:parseOwnedSecretName': 'true' };
    testFutureBehavior('selects the first two parts of the resource name when the name is auto-generated', flags, cdk.App, (cdkApp) => {
      stack = new cdk.Stack(cdkApp);

      const secret = new secretsmanager.Secret(stack, 'Secret');
      new cdk.CfnOutput(stack, 'MySecretName', {
        value: secret.secretName,
      });

      const resourceName = { 'Fn::Select': [6, { 'Fn::Split': [':', { Ref: 'SecretA720EF05' }] }] };

      expect(stack).toHaveOutput({
        outputName: 'MySecretName',
        outputValue: {
          'Fn::Join': ['-', [
            { 'Fn::Select': [0, { 'Fn::Split': ['-', resourceName] }] },
            { 'Fn::Select': [1, { 'Fn::Split': ['-', resourceName] }] },
          ]],
        },
      });
    });

    testFutureBehavior('is simply the first segment when the provided secret name has no hyphens', flags, cdk.App, (cdkApp) => {
      stack = new cdk.Stack(cdkApp);

      const secret = new secretsmanager.Secret(stack, 'Secret', { secretName: 'mySecret' });
      new cdk.CfnOutput(stack, 'MySecretName', {
        value: secret.secretName,
      });

      const resourceName = { 'Fn::Select': [6, { 'Fn::Split': [':', { Ref: 'SecretA720EF05' }] }] };

      expect(stack).toHaveOutput({
        outputName: 'MySecretName',
        outputValue: {
          'Fn::Select': [0, { 'Fn::Split': ['-', resourceName] }],
        },
      });
    });

    function assertSegments(secret: secretsmanager.Secret, segments: number) {
      new cdk.CfnOutput(stack, 'MySecretName', {
        value: secret.secretName,
      });

      const resourceName = { 'Fn::Select': [6, { 'Fn::Split': [':', { Ref: 'SecretA720EF05' }] }] };
      const secretNameSegments = [];
      for (let i = 0; i < segments; i++) {
        secretNameSegments.push({ 'Fn::Select': [i, { 'Fn::Split': ['-', resourceName] }] });
      }

      expect(stack).toHaveOutput({
        outputName: 'MySecretName',
        outputValue: {
          'Fn::Join': ['-', secretNameSegments],
        },
      });
    }

    testFutureBehavior('selects the 2 parts of the resource name when the secret name is provided', flags, cdk.App, (cdkApp) => {
      stack = new cdk.Stack(cdkApp);
      const secret = new secretsmanager.Secret(stack, 'Secret', { secretName: 'my-secret' });
      assertSegments(secret, 2);
    });

    testFutureBehavior('selects the 3 parts of the resource name when the secret name is provided', flags, cdk.App, (cdkApp) => {
      stack = new cdk.Stack(cdkApp);
      const secret = new secretsmanager.Secret(stack, 'Secret', { secretName: 'my-secret-hyphenated' });
      assertSegments(secret, 3);
    });

    testFutureBehavior('selects the 4 parts of the resource name when the secret name is provided', flags, cdk.App, (cdkApp) => {
      stack = new cdk.Stack(cdkApp);
      const secret = new secretsmanager.Secret(stack, 'Secret', { secretName: 'my-secret-with-hyphens' });
      assertSegments(secret, 4);
    });

    testFutureBehavior('uses existing Tokens as secret names as-is', flags, cdk.App, (cdkApp) => {
      stack = new cdk.Stack(cdkApp);

      const secret1 = new secretsmanager.Secret(stack, 'Secret1');
      const secret2 = new secretsmanager.Secret(stack, 'Secret2', {
        secretName: secret1.secretName,
      });
      new cdk.CfnOutput(stack, 'MySecretName1', {
        value: secret1.secretName,
      });
      new cdk.CfnOutput(stack, 'MySecretName2', {
        value: secret2.secretName,
      });

      const outputs = assertExpect(stack).value.Outputs;
      expect(outputs.MySecretName1).toEqual(outputs.MySecretName2);
    });
  });
});

test('import by secretArn', () => {
  // GIVEN
  const secretArn = 'arn:aws:secretsmanager:eu-west-1:111111111111:secret:MySecret-f3gDy9';

  // WHEN
  const secret = secretsmanager.Secret.fromSecretArn(stack, 'Secret', secretArn);

  // THEN
  expect(secret.secretArn).toBe(secretArn);
  expect(secret.secretFullArn).toBe(secretArn);
  expect(secret.secretName).toBe('MySecret');
  expect(secret.encryptionKey).toBeUndefined();
  expect(stack.resolve(secret.secretValue)).toEqual(`{{resolve:secretsmanager:${secretArn}:SecretString:::}}`);
  expect(stack.resolve(secret.secretValueFromJson('password'))).toEqual(`{{resolve:secretsmanager:${secretArn}:SecretString:password::}}`);
});

test('import by secretArn throws if ARN is malformed', () => {
  // GIVEN
  const arnWithoutResourceName = 'arn:aws:secretsmanager:eu-west-1:111111111111:secret';

  // WHEN
  expect(() => secretsmanager.Secret.fromSecretArn(stack, 'Secret1', arnWithoutResourceName)).toThrow(/invalid ARN format/);
});

test('import by secretArn supports secret ARNs without suffixes', () => {
  // GIVEN
  const arnWithoutSecretsManagerSuffix = 'arn:aws:secretsmanager:eu-west-1:111111111111:secret:MySecret';

  // WHEN
  const secret = secretsmanager.Secret.fromSecretArn(stack, 'Secret', arnWithoutSecretsManagerSuffix);

  // THEN
  expect(secret.secretArn).toBe(arnWithoutSecretsManagerSuffix);
  expect(secret.secretName).toBe('MySecret');
});

test('import by secretArn does not strip suffixes unless the suffix length is six', () => {
  // GIVEN
  const arnWith5CharacterSuffix = 'arn:aws:secretsmanager:eu-west-1:111111111111:secret:github-token';
  const arnWith6CharacterSuffix = 'arn:aws:secretsmanager:eu-west-1:111111111111:secret:github-token-f3gDy9';
  const arnWithMultiple6CharacterSuffix = 'arn:aws:secretsmanager:eu-west-1:111111111111:secret:github-token-f3gDy9-acb123';

  // THEN
  expect(secretsmanager.Secret.fromSecretArn(stack, 'Secret5', arnWith5CharacterSuffix).secretName).toEqual('github-token');
  expect(secretsmanager.Secret.fromSecretArn(stack, 'Secret6', arnWith6CharacterSuffix).secretName).toEqual('github-token');
  expect(secretsmanager.Secret.fromSecretArn(stack, 'Secret6Twice', arnWithMultiple6CharacterSuffix).secretName).toEqual('github-token-f3gDy9');
});

test('import by secretArn supports tokens for ARNs', () => {
  // GIVEN
  const stackA = new cdk.Stack(app, 'StackA');
  const stackB = new cdk.Stack(app, 'StackB');
  const secretA = new secretsmanager.Secret(stackA, 'SecretA');

  // WHEN
  const secretB = secretsmanager.Secret.fromSecretArn(stackB, 'SecretB', secretA.secretArn);
  new cdk.CfnOutput(stackB, 'secretBSecretName', { value: secretB.secretName });

  // THEN
  expect(secretB.secretArn).toBe(secretA.secretArn);
  expect(stackB).toHaveOutput({
    outputName: 'secretBSecretName',
    outputValue: { 'Fn::Select': [6, { 'Fn::Split': [':', { 'Fn::ImportValue': 'StackA:ExportsOutputRefSecretA188F281703FC8A52' }] }] },
  });
});

test('import by secretArn guesses at complete or partial ARN', () => {
  // GIVEN
  const secretArnWithSuffix = 'arn:aws:secretsmanager:eu-west-1:111111111111:secret:MySecret-f3gDy9';
  const secretArnWithoutSuffix = 'arn:aws:secretsmanager:eu-west-1:111111111111:secret:MySecret';

  // WHEN
  const secretWithCompleteArn = secretsmanager.Secret.fromSecretArn(stack, 'SecretWith', secretArnWithSuffix);
  const secretWithoutCompleteArn = secretsmanager.Secret.fromSecretArn(stack, 'SecretWithout', secretArnWithoutSuffix);

  // THEN
  expect(secretWithCompleteArn.secretFullArn).toEqual(secretArnWithSuffix);
  expect(secretWithoutCompleteArn.secretFullArn).toBeUndefined();
});

test('fromSecretCompleteArn', () => {
  // GIVEN
  const secretArn = 'arn:aws:secretsmanager:eu-west-1:111111111111:secret:MySecret-f3gDy9';

  // WHEN
  const secret = secretsmanager.Secret.fromSecretCompleteArn(stack, 'Secret', secretArn);

  // THEN
  expect(secret.secretArn).toBe(secretArn);
  expect(secret.secretFullArn).toBe(secretArn);
  expect(secret.secretName).toBe('MySecret');
  expect(secret.encryptionKey).toBeUndefined();
  expect(stack.resolve(secret.secretValue)).toEqual(`{{resolve:secretsmanager:${secretArn}:SecretString:::}}`);
  expect(stack.resolve(secret.secretValueFromJson('password'))).toEqual(`{{resolve:secretsmanager:${secretArn}:SecretString:password::}}`);
});

test('fromSecretCompleteArn - grants', () => {
  // GIVEN
  const secretArn = 'arn:aws:secretsmanager:eu-west-1:111111111111:secret:MySecret-f3gDy9';
  const secret = secretsmanager.Secret.fromSecretCompleteArn(stack, 'Secret', secretArn);
  const role = new iam.Role(stack, 'Role', { assumedBy: new iam.AccountRootPrincipal() });

  // WHEN
  secret.grantRead(role);
  secret.grantWrite(role);

  // THEN
  expect(stack).toHaveResource('AWS::IAM::Policy', {
    PolicyDocument: {
      Version: '2012-10-17',
      Statement: [{
        Action: [
          'secretsmanager:GetSecretValue',
          'secretsmanager:DescribeSecret',
        ],
        Effect: 'Allow',
        Resource: secretArn,
      },
      {
        Action: [
          'secretsmanager:PutSecretValue',
          'secretsmanager:UpdateSecret',
        ],
        Effect: 'Allow',
        Resource: secretArn,
      }],
    },
  });
});

test('fromSecretCompleteArn - can be assigned to a property with type number', () => {
  // GIVEN
  const secretArn = 'arn:aws:secretsmanager:eu-west-1:111111111111:secret:MySecret-f3gDy9';
  const secret = secretsmanager.Secret.fromSecretCompleteArn(stack, 'Secret', secretArn);

  // WHEN
  new lambda.Function(stack, 'MyFunction', {
    code: lambda.Code.fromInline('foo'),
    handler: 'bar',
    runtime: lambda.Runtime.NODEJS,
    memorySize: cdk.Token.asNumber(secret.secretValueFromJson('LambdaFunctionMemorySize')),
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::Lambda::Function', {
    MemorySize: `{{resolve:secretsmanager:${secretArn}:SecretString:LambdaFunctionMemorySize::}}`,
  });
});

test('fromSecretPartialArn', () => {
  // GIVEN
  const secretArn = 'arn:aws:secretsmanager:eu-west-1:111111111111:secret:MySecret';

  // WHEN
  const secret = secretsmanager.Secret.fromSecretPartialArn(stack, 'Secret', secretArn);

  // THEN
  expect(secret.secretArn).toBe(secretArn);
  expect(secret.secretFullArn).toBeUndefined();
  expect(secret.secretName).toBe('MySecret');
  expect(secret.encryptionKey).toBeUndefined();
  expect(stack.resolve(secret.secretValue)).toEqual(`{{resolve:secretsmanager:${secretArn}:SecretString:::}}`);
  expect(stack.resolve(secret.secretValueFromJson('password'))).toEqual(`{{resolve:secretsmanager:${secretArn}:SecretString:password::}}`);
});

test('fromSecretPartialArn - grants', () => {
  // GIVEN
  const secretArn = 'arn:aws:secretsmanager:eu-west-1:111111111111:secret:MySecret';
  const secret = secretsmanager.Secret.fromSecretPartialArn(stack, 'Secret', secretArn);
  const role = new iam.Role(stack, 'Role', { assumedBy: new iam.AccountRootPrincipal() });

  // WHEN
  secret.grantRead(role);
  secret.grantWrite(role);

  // THEN
  expect(stack).toHaveResource('AWS::IAM::Policy', {
    PolicyDocument: {
      Version: '2012-10-17',
      Statement: [{
        Action: [
          'secretsmanager:GetSecretValue',
          'secretsmanager:DescribeSecret',
        ],
        Effect: 'Allow',
        Resource: `${secretArn}-??????`,
      },
      {
        Action: [
          'secretsmanager:PutSecretValue',
          'secretsmanager:UpdateSecret',
        ],
        Effect: 'Allow',
        Resource: `${secretArn}-??????`,
      }],
    },
  });
});

describe('fromSecretAttributes', () => {
  test('import by attributes', () => {
    // GIVEN
    const encryptionKey = new kms.Key(stack, 'KMS');
    const secretArn = 'arn:aws:secretsmanager:eu-west-1:111111111111:secret:MySecret-f3gDy9';

    // WHEN
    const secret = secretsmanager.Secret.fromSecretAttributes(stack, 'Secret', {
      secretArn, encryptionKey,
    });

    // THEN
    expect(secret.secretArn).toBe(secretArn);
    expect(secret.secretFullArn).toBe(secretArn);
    expect(secret.secretName).toBe('MySecret');
    expect(secret.encryptionKey).toBe(encryptionKey);
    expect(stack.resolve(secret.secretValue)).toBe(`{{resolve:secretsmanager:${secretArn}:SecretString:::}}`);
    expect(stack.resolve(secret.secretValueFromJson('password'))).toBe(`{{resolve:secretsmanager:${secretArn}:SecretString:password::}}`);
  });

  test('throws if secretArn and either secretCompleteArn or secretPartialArn are provided', () => {
    const secretArn = 'arn:aws:secretsmanager:eu-west-1:111111111111:secret:MySecret-f3gDy9';

    const error = /cannot use `secretArn` with `secretCompleteArn` or `secretPartialArn`/;
    expect(() => secretsmanager.Secret.fromSecretAttributes(stack, 'Secret', {
      secretArn,
      secretCompleteArn: secretArn,
    })).toThrow(error);
    expect(() => secretsmanager.Secret.fromSecretAttributes(stack, 'Secret', {
      secretArn,
      secretPartialArn: secretArn,
    })).toThrow(error);
  });

  test('throws if no ARN is provided', () => {
    expect(() => secretsmanager.Secret.fromSecretAttributes(stack, 'Secret', {})).toThrow(/must use only one of `secretCompleteArn` or `secretPartialArn`/);
  });

  test('throws if both complete and partial ARNs are provided', () => {
    const secretArn = 'arn:aws:secretsmanager:eu-west-1:111111111111:secret:MySecret-f3gDy9';
    expect(() => secretsmanager.Secret.fromSecretAttributes(stack, 'Secret', {
      secretPartialArn: secretArn,
      secretCompleteArn: secretArn,
    })).toThrow(/must use only one of `secretCompleteArn` or `secretPartialArn`/);
  });

  test('throws if secretCompleteArn is not complete', () => {
    expect(() => secretsmanager.Secret.fromSecretAttributes(stack, 'Secret', {
      secretCompleteArn: 'arn:aws:secretsmanager:eu-west-1:111111111111:secret:MySecret',
    })).toThrow(/does not appear to be complete/);
  });

  test('parses environment from secretArn', () => {
    // GIVEN
    const secretAccount = '222222222222';

    // WHEN
    const secret = secretsmanager.Secret.fromSecretAttributes(stack, 'Secret', {
      secretCompleteArn: `arn:aws:secretsmanager:eu-west-1:${secretAccount}:secret:MySecret-f3gDy9`,
    });

    // THEN
    expect(secret.env.account).toBe(secretAccount);
  });
});

test('import by secret name', () => {
  // GIVEN
  const secretName = 'MySecret';

  // WHEN
  const secret = secretsmanager.Secret.fromSecretName(stack, 'Secret', secretName);

  // THEN
  expect(secret.secretArn).toBe(secretName);
  expect(secret.secretName).toBe(secretName);
  expect(secret.secretFullArn).toBeUndefined();
  expect(stack.resolve(secret.secretValue)).toBe(`{{resolve:secretsmanager:${secretName}:SecretString:::}}`);
  expect(stack.resolve(secret.secretValueFromJson('password'))).toBe(`{{resolve:secretsmanager:${secretName}:SecretString:password::}}`);
});

test('import by secret name with grants', () => {
  // GIVEN
  const role = new iam.Role(stack, 'Role', { assumedBy: new iam.AccountRootPrincipal() });
  const secret = secretsmanager.Secret.fromSecretName(stack, 'Secret', 'MySecret');

  // WHEN
  secret.grantRead(role);
  secret.grantWrite(role);

  // THEN
  const expectedSecretReference = {
    'Fn::Join': ['', [
      'arn:',
      { Ref: 'AWS::Partition' },
      ':secretsmanager:',
      { Ref: 'AWS::Region' },
      ':',
      { Ref: 'AWS::AccountId' },
      ':secret:MySecret*',
    ]],
  };
  expect(stack).toHaveResource('AWS::IAM::Policy', {
    PolicyDocument: {
      Version: '2012-10-17',
      Statement: [{
        Action: [
          'secretsmanager:GetSecretValue',
          'secretsmanager:DescribeSecret',
        ],
        Effect: 'Allow',
        Resource: expectedSecretReference,
      },
      {
        Action: [
          'secretsmanager:PutSecretValue',
          'secretsmanager:UpdateSecret',
        ],
        Effect: 'Allow',
        Resource: expectedSecretReference,
      }],
    },
  });
});

test('import by secret name v2', () => {
  // GIVEN
  const secretName = 'MySecret';

  // WHEN
  const secret = secretsmanager.Secret.fromSecretNameV2(stack, 'Secret', secretName);

  // THEN
  expect(secret.secretArn).toBe(`arn:${stack.partition}:secretsmanager:${stack.region}:${stack.account}:secret:MySecret`);
  expect(secret.secretName).toBe(secretName);
  expect(secret.secretFullArn).toBeUndefined();
  expect(stack.resolve(secret.secretValue)).toEqual({
    'Fn::Join': ['', [
      '{{resolve:secretsmanager:arn:',
      { Ref: 'AWS::Partition' },
      ':secretsmanager:',
      { Ref: 'AWS::Region' },
      ':',
      { Ref: 'AWS::AccountId' },
      ':secret:MySecret:SecretString:::}}',
    ]],
  });
});

test('import by secret name v2 with grants', () => {
  // GIVEN
  const role = new iam.Role(stack, 'Role', { assumedBy: new iam.AccountRootPrincipal() });
  const secret = secretsmanager.Secret.fromSecretNameV2(stack, 'Secret', 'MySecret');

  // WHEN
  secret.grantRead(role);
  secret.grantWrite(role);

  // THEN
  const expectedSecretReference = {
    'Fn::Join': ['', [
      'arn:',
      { Ref: 'AWS::Partition' },
      ':secretsmanager:',
      { Ref: 'AWS::Region' },
      ':',
      { Ref: 'AWS::AccountId' },
      ':secret:MySecret-??????',
    ]],
  };
  expect(stack).toHaveResource('AWS::IAM::Policy', {
    PolicyDocument: {
      Version: '2012-10-17',
      Statement: [{
        Action: [
          'secretsmanager:GetSecretValue',
          'secretsmanager:DescribeSecret',
        ],
        Effect: 'Allow',
        Resource: expectedSecretReference,
      },
      {
        Action: [
          'secretsmanager:PutSecretValue',
          'secretsmanager:UpdateSecret',
        ],
        Effect: 'Allow',
        Resource: expectedSecretReference,
      }],
    },
  });
});

test('can attach a secret with attach()', () => {
  // GIVEN
  const secret = new secretsmanager.Secret(stack, 'Secret');

  // WHEN
  secret.attach({
    asSecretAttachmentTarget: () => ({
      targetId: 'target-id',
      targetType: 'target-type' as secretsmanager.AttachmentTargetType,
    }),
  });

  // THEN
  expect(stack).toHaveResource('AWS::SecretsManager::SecretTargetAttachment', {
    SecretId: {
      Ref: 'SecretA720EF05',
    },
    TargetId: 'target-id',
    TargetType: 'target-type',
  });
});

test('throws when trying to attach a target multiple times to a secret', () => {
  // GIVEN
  const secret = new secretsmanager.Secret(stack, 'Secret');
  const target = {
    asSecretAttachmentTarget: () => ({
      targetId: 'target-id',
      targetType: 'target-type' as secretsmanager.AttachmentTargetType,
    }),
  };
  secret.attach(target);

  // THEN
  expect(() => secret.attach(target)).toThrow(/Secret is already attached to a target/);
});

test('add a rotation schedule to an attached secret', () => {
  // GIVEN
  const secret = new secretsmanager.Secret(stack, 'Secret');
  const attachedSecret = secret.attach({
    asSecretAttachmentTarget: () => ({
      targetId: 'target-id',
      targetType: 'target-type' as secretsmanager.AttachmentTargetType,
    }),
  });
  const rotationLambda = new lambda.Function(stack, 'Lambda', {
    runtime: lambda.Runtime.NODEJS_10_X,
    code: lambda.Code.fromInline('export.handler = event => event;'),
    handler: 'index.handler',
  });

  // WHEN
  attachedSecret.addRotationSchedule('RotationSchedule', {
    rotationLambda,
  });

  // THEN
  expect(stack).toHaveResource('AWS::SecretsManager::RotationSchedule', {
    SecretId: {
      Ref: 'SecretAttachment2E1B7C3B', // The secret returned by the attachment, not the secret itself.
    },
  });
});

test('throws when specifying secretStringTemplate but not generateStringKey', () => {
  expect(() => new secretsmanager.Secret(stack, 'Secret', {
    generateSecretString: {
      secretStringTemplate: JSON.stringify({ username: 'username' }),
    },
  })).toThrow(/`secretStringTemplate`.+`generateStringKey`/);
});

test('throws when specifying generateStringKey but not secretStringTemplate', () => {
  expect(() => new secretsmanager.Secret(stack, 'Secret', {
    generateSecretString: {
      generateStringKey: 'password',
    },
  })).toThrow(/`secretStringTemplate`.+`generateStringKey`/);
});

test('equivalence of SecretValue and Secret.fromSecretAttributes', () => {
  // GIVEN
  const secretArn = 'arn:aws:secretsmanager:eu-west-1:111111111111:secret:MySecret-f3gDy9';

  // WHEN
  const imported = secretsmanager.Secret.fromSecretAttributes(stack, 'Imported', { secretArn: secretArn }).secretValueFromJson('password');
  const value = cdk.SecretValue.secretsManager(secretArn, { jsonField: 'password' });

  // THEN
  expect(stack.resolve(imported)).toEqual(stack.resolve(value));
});

test('can add to the resource policy of a secret', () => {
  // GIVEN
  const secret = new secretsmanager.Secret(stack, 'Secret');

  // WHEN
  secret.addToResourcePolicy(new iam.PolicyStatement({
    actions: ['secretsmanager:GetSecretValue'],
    resources: ['*'],
    principals: [new iam.ArnPrincipal('arn:aws:iam::123456789012:user/cool-user')],
  }));

  // THEN
  expect(stack).toHaveResource('AWS::SecretsManager::ResourcePolicy', {
    ResourcePolicy: {
      Statement: [
        {
          Action: 'secretsmanager:GetSecretValue',
          Effect: 'Allow',
          Principal: {
            AWS: 'arn:aws:iam::123456789012:user/cool-user',
          },
          Resource: '*',
        },
      ],
      Version: '2012-10-17',
    },
    SecretId: {
      Ref: 'SecretA720EF05',
    },
  });
});

test('fails if secret policy has no actions', () => {
  // GIVEN
  stack = new cdk.Stack(app, 'my-stack');
  const secret = new secretsmanager.Secret(stack, 'Secret');

  // WHEN
  secret.addToResourcePolicy(new iam.PolicyStatement({
    resources: ['*'],
    principals: [new iam.ArnPrincipal('arn')],
  }));

  // THEN
  expect(() => app.synth()).toThrow(/A PolicyStatement must specify at least one \'action\' or \'notAction\'/);
});

test('fails if secret policy has no IAM principals', () => {
  // GIVEN
  stack = new cdk.Stack(app, 'my-stack');
  const secret = new secretsmanager.Secret(stack, 'Secret');

  // WHEN
  secret.addToResourcePolicy(new iam.PolicyStatement({
    resources: ['*'],
    actions: ['secretsmanager:*'],
  }));

  // THEN
  expect(() => app.synth()).toThrow(/A PolicyStatement used in a resource-based policy must specify at least one IAM principal/);
});

test('with replication regions', () => {
  // WHEN
  const secret = new secretsmanager.Secret(stack, 'Secret', {
    replicaRegions: [
      {
        region: 'eu-west-1',
      },
    ],
  });
  secret.addReplicaRegion('eu-central-1', kms.Key.fromKeyArn(stack, 'Key', 'arn:aws:kms:eu-central-1:123456789012:key/my-key-id'));

  // THEN
  expect(stack).toHaveResource('AWS::SecretsManager::Secret', {
    ReplicaRegions: [
      {
        Region: 'eu-west-1',
      },
      {
        KmsKeyId: 'arn:aws:kms:eu-central-1:123456789012:key/my-key-id',
        Region: 'eu-central-1',
      },
    ],
  });
});
