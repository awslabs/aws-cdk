import '@aws-cdk/assert-internal/jest';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as kms from '@aws-cdk/aws-kms';
import * as lambda from '@aws-cdk/aws-lambda';
import * as cdk from '@aws-cdk/core';
import * as secretsmanager from '../lib';

let stack: cdk.Stack;
beforeEach(() => {
  stack = new cdk.Stack();
});

test('create a rotation schedule with a rotation Lambda', () => {
  // GIVEN
  const secret = new secretsmanager.Secret(stack, 'Secret');
  const rotationLambda = new lambda.Function(stack, 'Lambda', {
    runtime: lambda.Runtime.NODEJS_10_X,
    code: lambda.Code.fromInline('export.handler = event => event;'),
    handler: 'index.handler',
  });

  // WHEN
  new secretsmanager.RotationSchedule(stack, 'RotationSchedule', {
    secret,
    rotationLambda,
  });

  // THEN
  expect(stack).toHaveResource('AWS::SecretsManager::RotationSchedule', {
    SecretId: {
      Ref: 'SecretA720EF05',
    },
    RotationLambdaARN: {
      'Fn::GetAtt': [
        'LambdaD247545B',
        'Arn',
      ],
    },
    RotationRules: {
      AutomaticallyAfterDays: 30,
    },
  });
});

test('assign permissions for rotation schedule with a rotation Lambda', () => {
  // GIVEN
  const secret = new secretsmanager.Secret(stack, 'Secret');
  const rotationLambda = new lambda.Function(stack, 'Lambda', {
    runtime: lambda.Runtime.NODEJS_10_X,
    code: lambda.Code.fromInline('export.handler = event => event;'),
    handler: 'index.handler',
  });

  // WHEN
  new secretsmanager.RotationSchedule(stack, 'RotationSchedule', {
    secret,
    rotationLambda,
  });

  // THEN
  expect(stack).toHaveResource('AWS::Lambda::Permission', {
    Action: 'lambda:InvokeFunction',
    FunctionName: {
      'Fn::GetAtt': [
        'LambdaD247545B',
        'Arn',
      ],
    },
    Principal: 'secretsmanager.amazonaws.com',
  });

  expect(stack).toHaveResource('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: [
        {
          Action: [
            'secretsmanager:DescribeSecret',
            'secretsmanager:GetSecretValue',
            'secretsmanager:PutSecretValue',
            'secretsmanager:UpdateSecretVersionStage',
          ],
          Effect: 'Allow',
          Resource: {
            Ref: 'SecretA720EF05',
          },
        },
        {
          Action: 'secretsmanager:GetRandomPassword',
          Effect: 'Allow',
          Resource: '*',
        },
      ],
      Version: '2012-10-17',
    },
    PolicyName: 'LambdaServiceRoleDefaultPolicyDAE46E21',
    Roles: [
      {
        Ref: 'LambdaServiceRoleA8ED4D3B',
      },
    ],
  });
});

test('assign kms permissions for rotation schedule with a rotation Lambda', () => {
  // GIVEN
  const encryptionKey = new kms.Key(stack, 'Key');
  const secret = new secretsmanager.Secret(stack, 'Secret', { encryptionKey });
  const rotationLambda = new lambda.Function(stack, 'Lambda', {
    runtime: lambda.Runtime.NODEJS_10_X,
    code: lambda.Code.fromInline('export.handler = event => event;'),
    handler: 'index.handler',
  });

  // WHEN
  new secretsmanager.RotationSchedule(stack, 'RotationSchedule', {
    secret,
    rotationLambda,
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::KMS::Key', {
    KeyPolicy: {
      Statement: [{}, {}, {},
        {
          Action: [
            'kms:Decrypt',
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
                'LambdaServiceRoleA8ED4D3B',
                'Arn',
              ],
            },
          },
          Resource: '*',
        }],
    },
  });
});

describe('hosted rotation', () => {
  test('single user not in a vpc', () => {
    // GIVEN
    const app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
    const secret = new secretsmanager.Secret(stack, 'Secret');

    // WHEN
    secret.addRotationSchedule('RotationSchedule', {
      hostedRotation: secretsmanager.HostedRotation.mysqlSingleUser(),
    });

    // THEN
    expect(stack).toHaveResource('AWS::SecretsManager::RotationSchedule', {
      SecretId: {
        Ref: 'SecretA720EF05',
      },
      HostedRotationLambda: {
        RotationType: 'MySQLSingleUser',
      },
      RotationRules: {
        AutomaticallyAfterDays: 30,
      },
    });

    expect(app.synth().getStackByName(stack.stackName).template).toEqual(expect.objectContaining({
      Transform: 'AWS::SecretsManager-2020-07-23',
    }));

    expect(stack).toHaveResource('AWS::SecretsManager::ResourcePolicy', {
      ResourcePolicy: {
        Statement: [
          {
            Action: 'secretsmanager:DeleteSecret',
            Effect: 'Deny',
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

  test('multi user not in a vpc', () => {
    // GIVEN
    const secret = new secretsmanager.Secret(stack, 'Secret');
    const masterSecret = new secretsmanager.Secret(stack, 'MasterSecret');

    // WHEN
    secret.addRotationSchedule('RotationSchedule', {
      hostedRotation: secretsmanager.HostedRotation.postgreSqlMultiUser({
        masterSecret,
      }),
    });

    // THEN
    expect(stack).toHaveResource('AWS::SecretsManager::RotationSchedule', {
      SecretId: {
        Ref: 'SecretA720EF05',
      },
      HostedRotationLambda: {
        MasterSecretArn: {
          Ref: 'MasterSecretA11BF785',
        },
        RotationType: 'PostgreSQLMultiUser',
      },
      RotationRules: {
        AutomaticallyAfterDays: 30,
      },
    });

    expect(stack).toHaveResource('AWS::SecretsManager::ResourcePolicy', {
      ResourcePolicy: {
        Statement: [
          {
            Action: 'secretsmanager:DeleteSecret',
            Effect: 'Deny',
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
            Resource: '*',
          },
        ],
        Version: '2012-10-17',
      },
      SecretId: {
        Ref: 'MasterSecretA11BF785',
      },
    });
  });

  test('single user in a vpc', () => {
    // GIVEN
    const vpc = new ec2.Vpc(stack, 'Vpc');
    const secret = new secretsmanager.Secret(stack, 'Secret');
    const dbSecurityGroup = new ec2.SecurityGroup(stack, 'SecurityGroup', { vpc });
    const dbConnections = new ec2.Connections({
      defaultPort: ec2.Port.tcp(3306),
      securityGroups: [dbSecurityGroup],
    });

    // WHEN
    const hostedRotation = secretsmanager.HostedRotation.mysqlSingleUser({ vpc });
    secret.addRotationSchedule('RotationSchedule', { hostedRotation });
    dbConnections.allowDefaultPortFrom(hostedRotation);

    // THEN
    expect(stack).toHaveResource('AWS::SecretsManager::RotationSchedule', {
      SecretId: {
        Ref: 'SecretA720EF05',
      },
      HostedRotationLambda: {
        RotationType: 'MySQLSingleUser',
        VpcSecurityGroupIds: {
          'Fn::GetAtt': [
            'SecretRotationScheduleSecurityGroup3F1F76EA',
            'GroupId',
          ],
        },
        VpcSubnetIds: {
          'Fn::Join': [
            '',
            [
              {
                Ref: 'VpcPrivateSubnet1Subnet536B997A',
              },
              ',',
              {
                Ref: 'VpcPrivateSubnet2Subnet3788AAA1',
              },
            ],
          ],
        },
      },
      RotationRules: {
        AutomaticallyAfterDays: 30,
      },
    });

    expect(stack).toHaveResource('AWS::EC2::SecurityGroupIngress', {
      FromPort: 3306,
      GroupId: {
        'Fn::GetAtt': [
          'SecurityGroupDD263621',
          'GroupId',
        ],
      },
      SourceSecurityGroupId: {
        'Fn::GetAtt': [
          'SecretRotationScheduleSecurityGroup3F1F76EA',
          'GroupId',
        ],
      },
      ToPort: 3306,
    });
  });

  test('single user in a vpc with security groups', () => {
    // GIVEN
    const vpc = new ec2.Vpc(stack, 'Vpc');
    const secret = new secretsmanager.Secret(stack, 'Secret');
    const dbSecurityGroup = new ec2.SecurityGroup(stack, 'SecurityGroup', { vpc });
    const dbConnections = new ec2.Connections({
      defaultPort: ec2.Port.tcp(3306),
      securityGroups: [dbSecurityGroup],
    });

    // WHEN
    const hostedRotation = secretsmanager.HostedRotation.mysqlSingleUser({
      vpc,
      securityGroups: [
        new ec2.SecurityGroup(stack, 'SG1', { vpc }),
        new ec2.SecurityGroup(stack, 'SG2', { vpc }),
      ],
    });
    secret.addRotationSchedule('RotationSchedule', { hostedRotation });
    dbConnections.allowDefaultPortFrom(hostedRotation);

    // THEN
    expect(stack).toHaveResource('AWS::SecretsManager::RotationSchedule', {
      SecretId: {
        Ref: 'SecretA720EF05',
      },
      HostedRotationLambda: {
        RotationType: 'MySQLSingleUser',
        VpcSecurityGroupIds: {
          'Fn::Join': [
            '',
            [
              {
                'Fn::GetAtt': [
                  'SG1BA065B6E',
                  'GroupId',
                ],
              },
              ',',
              {
                'Fn::GetAtt': [
                  'SG20CE3219C',
                  'GroupId',
                ],
              },
            ],
          ],
        },
        VpcSubnetIds: {
          'Fn::Join': [
            '',
            [
              {
                Ref: 'VpcPrivateSubnet1Subnet536B997A',
              },
              ',',
              {
                Ref: 'VpcPrivateSubnet2Subnet3788AAA1',
              },
            ],
          ],
        },
      },
      RotationRules: {
        AutomaticallyAfterDays: 30,
      },
    });

    expect(stack).toHaveResource('AWS::EC2::SecurityGroupIngress', {
      FromPort: 3306,
      GroupId: {
        'Fn::GetAtt': [
          'SecurityGroupDD263621',
          'GroupId',
        ],
      },
      SourceSecurityGroupId: {
        'Fn::GetAtt': [
          'SG20CE3219C',
          'GroupId',
        ],
      },
      ToPort: 3306,
    });
  });

  test('throws with security groups and no vpc', () => {
    // GIVEN
    const secret = new secretsmanager.Secret(stack, 'Secret');

    // THEN
    expect(() => secret.addRotationSchedule('RotationSchedule', {
      hostedRotation: secretsmanager.HostedRotation.oracleSingleUser({
        securityGroups: [ec2.SecurityGroup.fromSecurityGroupId(secret, 'SG', 'sg-12345678')],
      }),
    })).toThrow(/`vpc` must be specified when specifying `securityGroups`/);
  });

  test('throws when accessing the connections object when not in a vpc', () => {
    // GIVEN
    const secret = new secretsmanager.Secret(stack, 'Secret');

    // WHEN
    const hostedRotation = secretsmanager.HostedRotation.sqlServerSingleUser();
    secret.addRotationSchedule('RotationSchedule', { hostedRotation });

    // THEN
    expect(() => hostedRotation.connections.allowToAnyIpv4(ec2.Port.allTraffic()))
      .toThrow(/Cannot use connections for a hosted rotation that is not deployed in a VPC/);
  });
});
