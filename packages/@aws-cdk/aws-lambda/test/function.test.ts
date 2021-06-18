import '@aws-cdk/assert-internal/jest';
import * as path from 'path';
import { ABSENT, ResourcePart, SynthUtils } from '@aws-cdk/assert-internal';
import { ProfilingGroup } from '@aws-cdk/aws-codeguruprofiler';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as efs from '@aws-cdk/aws-efs';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import * as logs from '@aws-cdk/aws-logs';
import * as s3 from '@aws-cdk/aws-s3';
import * as signer from '@aws-cdk/aws-signer';
import * as sqs from '@aws-cdk/aws-sqs';
import * as cdk from '@aws-cdk/core';
import * as constructs from 'constructs';
import * as _ from 'lodash';
import * as lambda from '../lib';

describe('function', () => {
  test('default function', () => {
    const stack = new cdk.Stack();

    new lambda.Function(stack, 'MyLambda', {
      code: new lambda.InlineCode('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
    });

    expect(stack).toHaveResource('AWS::IAM::Role', {
      AssumeRolePolicyDocument:
      {
        Statement:
          [{
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: { Service: 'lambda.amazonaws.com' },
          }],
        Version: '2012-10-17',
      },
      ManagedPolicyArns:
        [{ 'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']] }],
    });

    expect(stack).toHaveResource('AWS::Lambda::Function', {
      Properties:
      {
        Code: { ZipFile: 'foo' },
        Handler: 'index.handler',
        Role: { 'Fn::GetAtt': ['MyLambdaServiceRole4539ECB6', 'Arn'] },
        Runtime: 'nodejs10.x',
      },
      DependsOn: ['MyLambdaServiceRole4539ECB6'],
    }, ResourcePart.CompleteDefinition);
  });

  test('adds policy permissions', () => {
    const stack = new cdk.Stack();
    new lambda.Function(stack, 'MyLambda', {
      code: new lambda.InlineCode('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      initialPolicy: [new iam.PolicyStatement({ actions: ['*'], resources: ['*'] })],
    });
    expect(stack).toHaveResource('AWS::IAM::Role', {
      AssumeRolePolicyDocument:
      {
        Statement:
          [{
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: { Service: 'lambda.amazonaws.com' },
          }],
        Version: '2012-10-17',
      },
      ManagedPolicyArns:
        // eslint-disable-next-line max-len
        [{ 'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']] }],
    });
    expect(stack).toHaveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: '*',
            Effect: 'Allow',
            Resource: '*',
          },
        ],
        Version: '2012-10-17',
      },
      PolicyName: 'MyLambdaServiceRoleDefaultPolicy5BBC6F68',
      Roles: [
        {
          Ref: 'MyLambdaServiceRole4539ECB6',
        },
      ],
    });

    expect(stack).toHaveResource('AWS::Lambda::Function', {
      Properties: {
        Code: { ZipFile: 'foo' },
        Handler: 'index.handler',
        Role: { 'Fn::GetAtt': ['MyLambdaServiceRole4539ECB6', 'Arn'] },
        Runtime: 'nodejs10.x',
      },
      DependsOn: ['MyLambdaServiceRoleDefaultPolicy5BBC6F68', 'MyLambdaServiceRole4539ECB6'],
    }, ResourcePart.CompleteDefinition);
  });

  test('fails if inline code is used for an invalid runtime', () => {
    const stack = new cdk.Stack();
    expect(() => new lambda.Function(stack, 'MyLambda', {
      code: new lambda.InlineCode('foo'),
      handler: 'bar',
      runtime: lambda.Runtime.DOTNET_CORE_2,
    })).toThrow();
  });

  describe('addToResourcePolicy', () => {
    test('can be used to add permissions to the Lambda function', () => {
      const stack = new cdk.Stack();
      const fn = newTestLambda(stack);

      fn.addPermission('S3Permission', {
        action: 'lambda:*',
        principal: new iam.ServicePrincipal('s3.amazonaws.com'),
        sourceAccount: stack.account,
        sourceArn: 'arn:aws:s3:::my_bucket',
      });

      expect(stack).toHaveResource('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: 'lambda.amazonaws.com',
              },
            },
          ],
          Version: '2012-10-17',
        },
        ManagedPolicyArns:
          // eslint-disable-next-line max-len
          [{ 'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']] }],
      });

      expect(stack).toHaveResource('AWS::Lambda::Function', {
        Properties: {
          Code: {
            ZipFile: 'foo',
          },
          Handler: 'bar',
          Role: {
            'Fn::GetAtt': [
              'MyLambdaServiceRole4539ECB6',
              'Arn',
            ],
          },
          Runtime: 'python2.7',
        },
        DependsOn: [
          'MyLambdaServiceRole4539ECB6',
        ],
      }, ResourcePart.CompleteDefinition);

      expect(stack).toHaveResource('AWS::Lambda::Permission', {
        Action: 'lambda:*',
        FunctionName: {
          'Fn::GetAtt': [
            'MyLambdaCCE802FB',
            'Arn',
          ],
        },
        Principal: 's3.amazonaws.com',
        SourceAccount: {
          Ref: 'AWS::AccountId',
        },
        SourceArn: 'arn:aws:s3:::my_bucket',
      });
    });

    test('fails if the principal is not a service, account or arn principal', () => {
      const stack = new cdk.Stack();
      const fn = newTestLambda(stack);

      expect(() => fn.addPermission('F1', { principal: new iam.OrganizationPrincipal('org') }))
        .toThrow(/Invalid principal type for Lambda permission statement/);

      fn.addPermission('S1', { principal: new iam.ServicePrincipal('my-service') });
      fn.addPermission('S2', { principal: new iam.AccountPrincipal('account') });
      fn.addPermission('S3', { principal: new iam.ArnPrincipal('my:arn') });
    });

    test('applies source account/ARN conditions if the principal has conditions', () => {
      const stack = new cdk.Stack();
      const fn = newTestLambda(stack);
      const sourceAccount = 'some-account';
      const sourceArn = 'some-arn';
      const service = 'my-service';
      const principal = new iam.PrincipalWithConditions(new iam.ServicePrincipal(service), {
        ArnLike: {
          'aws:SourceArn': sourceArn,
        },
        StringEquals: {
          'aws:SourceAccount': sourceAccount,
        },
      });

      fn.addPermission('S1', { principal: principal });

      expect(stack).toHaveResource('AWS::Lambda::Permission', {
        Action: 'lambda:InvokeFunction',
        FunctionName: {
          'Fn::GetAtt': [
            'MyLambdaCCE802FB',
            'Arn',
          ],
        },
        Principal: service,
        SourceAccount: sourceAccount,
        SourceArn: sourceArn,
      });
    });

    test('fails if the principal has conditions that are not supported', () => {
      const stack = new cdk.Stack();
      const fn = newTestLambda(stack);

      expect(() => fn.addPermission('F1', {
        principal: new iam.PrincipalWithConditions(new iam.ServicePrincipal('my-service'), {
          ArnEquals: {
            'aws:SourceArn': 'source-arn',
          },
        }),
      })).toThrow(/PrincipalWithConditions had unsupported conditions for Lambda permission statement/);
      expect(() => fn.addPermission('F2', {
        principal: new iam.PrincipalWithConditions(new iam.ServicePrincipal('my-service'), {
          StringLike: {
            'aws:SourceAccount': 'source-account',
          },
        }),
      })).toThrow(/PrincipalWithConditions had unsupported conditions for Lambda permission statement/);
      expect(() => fn.addPermission('F3', {
        principal: new iam.PrincipalWithConditions(new iam.ServicePrincipal('my-service'), {
          ArnLike: {
            's3:DataAccessPointArn': 'data-access-point-arn',
          },
        }),
      })).toThrow(/PrincipalWithConditions had unsupported conditions for Lambda permission statement/);
    });

    test('BYORole', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const role = new iam.Role(stack, 'SomeRole', {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      });
      role.addToPolicy(new iam.PolicyStatement({ actions: ['confirm:itsthesame'], resources: ['*'] }));

      // WHEN
      const fn = new lambda.Function(stack, 'Function', {
        code: new lambda.InlineCode('test'),
        runtime: lambda.Runtime.PYTHON_3_6,
        handler: 'index.test',
        role,
        initialPolicy: [
          new iam.PolicyStatement({ actions: ['inline:inline'], resources: ['*'] }),
        ],
      });

      fn.addToRolePolicy(new iam.PolicyStatement({ actions: ['explicit:explicit'], resources: ['*'] }));

      // THEN
      expect(stack).toHaveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            { Action: 'confirm:itsthesame', Effect: 'Allow', Resource: '*' },
            { Action: 'inline:inline', Effect: 'Allow', Resource: '*' },
            { Action: 'explicit:explicit', Effect: 'Allow', Resource: '*' },
          ],
        },
      });
    });
  });

  test('fromFunctionArn', () => {
    // GIVEN
    const stack2 = new cdk.Stack();

    // WHEN
    const imported = lambda.Function.fromFunctionArn(stack2, 'Imported', 'arn:aws:lambda:us-east-1:123456789012:function:ProcessKinesisRecords');

    // THEN
    expect(imported.functionArn).toEqual('arn:aws:lambda:us-east-1:123456789012:function:ProcessKinesisRecords');
    expect(imported.functionName).toEqual('ProcessKinesisRecords');
  });

  describe('addPermissions', () => {
    test('imported Function w/ resolved account and function arn', () => {
      // GIVEN
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'Imports', {
        env: { account: '123456789012', region: 'us-east-1' },
      });

      // WHEN
      const iFunc = lambda.Function.fromFunctionAttributes(stack, 'iFunc', {
        functionArn: 'arn:aws:lambda:us-east-1:123456789012:function:BaseFunction',
      });
      iFunc.addPermission('iFunc', {
        principal: new iam.ServicePrincipal('cloudformation.amazonaws.com'),
      });

      // THEN
      expect(stack).toHaveResource('AWS::Lambda::Permission');
    });

    test('imported Function w/ unresolved account', () => {
      // GIVEN
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'Imports');

      // WHEN
      const iFunc = lambda.Function.fromFunctionAttributes(stack, 'iFunc', {
        functionArn: 'arn:aws:lambda:us-east-1:123456789012:function:BaseFunction',
      });
      iFunc.addPermission('iFunc', {
        principal: new iam.ServicePrincipal('cloudformation.amazonaws.com'),
      });

      // THEN
      expect(stack).not.toHaveResource('AWS::Lambda::Permission');
    });

    test('imported Function w/ unresolved account & allowPermissions set', () => {
      // GIVEN
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'Imports');

      // WHEN
      const iFunc = lambda.Function.fromFunctionAttributes(stack, 'iFunc', {
        functionArn: 'arn:aws:lambda:us-east-1:123456789012:function:BaseFunction',
        sameEnvironment: true, // since this is false, by default, for env agnostic stacks
      });
      iFunc.addPermission('iFunc', {
        principal: new iam.ServicePrincipal('cloudformation.amazonaws.com'),
      });

      // THEN
      expect(stack).toHaveResource('AWS::Lambda::Permission');
    });

    test('imported Function w/different account', () => {
      // GIVEN
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'Base', {
        env: { account: '111111111111' },
      });

      // WHEN
      const iFunc = lambda.Function.fromFunctionAttributes(stack, 'iFunc', {
        functionArn: 'arn:aws:lambda:us-east-1:123456789012:function:BaseFunction',
      });
      iFunc.addPermission('iFunc', {
        principal: new iam.ServicePrincipal('cloudformation.amazonaws.com'),
      });

      // THEN
      expect(stack).not.toHaveResource('AWS::Lambda::Permission');
    });
  });

  test('Lambda code can be read from a local directory via an asset', () => {
    // GIVEN
    const stack = new cdk.Stack();
    new lambda.Function(stack, 'MyLambda', {
      code: lambda.Code.fromAsset(path.join(__dirname, 'my-lambda-handler')),
      handler: 'index.handler',
      runtime: lambda.Runtime.PYTHON_3_6,
    });

    // THEN
    expect(stack).toHaveResource('AWS::Lambda::Function', {
      Code: {
        S3Bucket: {
          Ref: 'AssetParameters9678c34eca93259d11f2d714177347afd66c50116e1e08996eff893d3ca81232S3Bucket1354C645',
        },
        S3Key: {
          'Fn::Join': ['', [
            { 'Fn::Select': [0, { 'Fn::Split': ['||', { Ref: 'AssetParameters9678c34eca93259d11f2d714177347afd66c50116e1e08996eff893d3ca81232S3VersionKey5D873FAC' }] }] },
            { 'Fn::Select': [1, { 'Fn::Split': ['||', { Ref: 'AssetParameters9678c34eca93259d11f2d714177347afd66c50116e1e08996eff893d3ca81232S3VersionKey5D873FAC' }] }] },
          ]],
        },
      },
      Handler: 'index.handler',
      Role: {
        'Fn::GetAtt': [
          'MyLambdaServiceRole4539ECB6',
          'Arn',
        ],
      },
      Runtime: 'python3.6',
    });
  });

  test('default function with SQS DLQ when client sets deadLetterQueueEnabled to true and functionName defined by client', () => {
    const stack = new cdk.Stack();

    new lambda.Function(stack, 'MyLambda', {
      code: new lambda.InlineCode('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      functionName: 'OneFunctionToRuleThemAll',
      deadLetterQueueEnabled: true,
    });

    expect(stack).toHaveResource('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'lambda.amazonaws.com',
            },
          },
        ],
        Version: '2012-10-17',
      },
      ManagedPolicyArns: [
        {
          'Fn::Join': [
            '',
            [
              'arn:',
              {
                Ref: 'AWS::Partition',
              },
              ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
            ],
          ],
        },
      ],
    });
    expect(stack).toHaveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'sqs:SendMessage',
            Effect: 'Allow',
            Resource: {
              'Fn::GetAtt': [
                'MyLambdaDeadLetterQueue399EEA2D',
                'Arn',
              ],
            },
          },
        ],
        Version: '2012-10-17',
      },
      PolicyName: 'MyLambdaServiceRoleDefaultPolicy5BBC6F68',
      Roles: [
        {
          Ref: 'MyLambdaServiceRole4539ECB6',
        },
      ],
    });
    expect(stack).toHaveResource('AWS::Lambda::Function', {
      Properties: {
        Code: {
          ZipFile: 'foo',
        },
        Handler: 'index.handler',
        Role: {
          'Fn::GetAtt': [
            'MyLambdaServiceRole4539ECB6',
            'Arn',
          ],
        },
        Runtime: 'nodejs10.x',
        DeadLetterConfig: {
          TargetArn: {
            'Fn::GetAtt': [
              'MyLambdaDeadLetterQueue399EEA2D',
              'Arn',
            ],
          },
        },
        FunctionName: 'OneFunctionToRuleThemAll',
      },
      DependsOn: [
        'MyLambdaServiceRoleDefaultPolicy5BBC6F68',
        'MyLambdaServiceRole4539ECB6',
      ],
    }, ResourcePart.CompleteDefinition);
  });

  test('default function with SQS DLQ when client sets deadLetterQueueEnabled to true and functionName not defined by client', () => {
    const stack = new cdk.Stack();

    new lambda.Function(stack, 'MyLambda', {
      code: new lambda.InlineCode('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      deadLetterQueueEnabled: true,
    });

    expect(stack).toHaveResource('AWS::SQS::Queue', {
      MessageRetentionPeriod: 1209600,
    });

    expect(stack).toHaveResource('AWS::Lambda::Function', {
      DeadLetterConfig: {
        TargetArn: {
          'Fn::GetAtt': [
            'MyLambdaDeadLetterQueue399EEA2D',
            'Arn',
          ],
        },
      },
    });
  });

  test('default function with SQS DLQ when client sets deadLetterQueueEnabled to false', () => {
    const stack = new cdk.Stack();

    new lambda.Function(stack, 'MyLambda', {
      code: new lambda.InlineCode('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      deadLetterQueueEnabled: false,
    });

    expect(stack).toHaveResource('AWS::Lambda::Function', {
      Code: {
        ZipFile: 'foo',
      },
      Handler: 'index.handler',
      Role: {
        'Fn::GetAtt': [
          'MyLambdaServiceRole4539ECB6',
          'Arn',
        ],
      },
      Runtime: 'nodejs10.x',
    });
  });

  test('default function with SQS DLQ when client provides Queue to be used as DLQ', () => {
    const stack = new cdk.Stack();

    const dlQueue = new sqs.Queue(stack, 'DeadLetterQueue', {
      queueName: 'MyLambda_DLQ',
      retentionPeriod: cdk.Duration.days(14),
    });

    new lambda.Function(stack, 'MyLambda', {
      code: new lambda.InlineCode('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      deadLetterQueue: dlQueue,
    });

    expect(stack).toHaveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'sqs:SendMessage',
            Effect: 'Allow',
            Resource: {
              'Fn::GetAtt': [
                'DeadLetterQueue9F481546',
                'Arn',
              ],
            },
          },
        ],
        Version: '2012-10-17',
      },
    });

    expect(stack).toHaveResource('AWS::Lambda::Function', {
      DeadLetterConfig: {
        TargetArn: {
          'Fn::GetAtt': [
            'DeadLetterQueue9F481546',
            'Arn',
          ],
        },
      },
    });
  });

  test('default function with SQS DLQ when client provides Queue to be used as DLQ and deadLetterQueueEnabled set to true', () => {
    const stack = new cdk.Stack();

    const dlQueue = new sqs.Queue(stack, 'DeadLetterQueue', {
      queueName: 'MyLambda_DLQ',
      retentionPeriod: cdk.Duration.days(14),
    });

    new lambda.Function(stack, 'MyLambda', {
      code: new lambda.InlineCode('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      deadLetterQueueEnabled: true,
      deadLetterQueue: dlQueue,
    });

    expect(stack).toHaveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'sqs:SendMessage',
            Effect: 'Allow',
            Resource: {
              'Fn::GetAtt': [
                'DeadLetterQueue9F481546',
                'Arn',
              ],
            },
          },
        ],
        Version: '2012-10-17',
      },
    });

    expect(stack).toHaveResource('AWS::Lambda::Function', {
      DeadLetterConfig: {
        TargetArn: {
          'Fn::GetAtt': [
            'DeadLetterQueue9F481546',
            'Arn',
          ],
        },
      },
    });
  });

  test('error when default function with SQS DLQ when client provides Queue to be used as DLQ and deadLetterQueueEnabled set to false', () => {
    const stack = new cdk.Stack();

    const dlQueue = new sqs.Queue(stack, 'DeadLetterQueue', {
      queueName: 'MyLambda_DLQ',
      retentionPeriod: cdk.Duration.days(14),
    });

    expect(() => new lambda.Function(stack, 'MyLambda', {
      code: new lambda.InlineCode('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      deadLetterQueueEnabled: false,
      deadLetterQueue: dlQueue,
    })).toThrow(/deadLetterQueue defined but deadLetterQueueEnabled explicitly set to false/);
  });

  test('default function with Active tracing', () => {
    const stack = new cdk.Stack();

    new lambda.Function(stack, 'MyLambda', {
      code: new lambda.InlineCode('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      tracing: lambda.Tracing.ACTIVE,
    });

    expect(stack).toHaveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: [
              'xray:PutTraceSegments',
              'xray:PutTelemetryRecords',
            ],
            Effect: 'Allow',
            Resource: '*',
          },
        ],
        Version: '2012-10-17',
      },
      PolicyName: 'MyLambdaServiceRoleDefaultPolicy5BBC6F68',
      Roles: [
        {
          Ref: 'MyLambdaServiceRole4539ECB6',
        },
      ],
    });

    expect(stack).toHaveResource('AWS::Lambda::Function', {
      Properties: {
        Code: {
          ZipFile: 'foo',
        },
        Handler: 'index.handler',
        Role: {
          'Fn::GetAtt': [
            'MyLambdaServiceRole4539ECB6',
            'Arn',
          ],
        },
        Runtime: 'nodejs10.x',
        TracingConfig: {
          Mode: 'Active',
        },
      },
      DependsOn: [
        'MyLambdaServiceRoleDefaultPolicy5BBC6F68',
        'MyLambdaServiceRole4539ECB6',
      ],
    }, ResourcePart.CompleteDefinition);
  });

  test('default function with PassThrough tracing', () => {
    const stack = new cdk.Stack();

    new lambda.Function(stack, 'MyLambda', {
      code: new lambda.InlineCode('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      tracing: lambda.Tracing.PASS_THROUGH,
    });

    expect(stack).toHaveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: [
              'xray:PutTraceSegments',
              'xray:PutTelemetryRecords',
            ],
            Effect: 'Allow',
            Resource: '*',
          },
        ],
        Version: '2012-10-17',
      },
      PolicyName: 'MyLambdaServiceRoleDefaultPolicy5BBC6F68',
      Roles: [
        {
          Ref: 'MyLambdaServiceRole4539ECB6',
        },
      ],
    });

    expect(stack).toHaveResource('AWS::Lambda::Function', {
      Properties: {
        Code: {
          ZipFile: 'foo',
        },
        Handler: 'index.handler',
        Role: {
          'Fn::GetAtt': [
            'MyLambdaServiceRole4539ECB6',
            'Arn',
          ],
        },
        Runtime: 'nodejs10.x',
        TracingConfig: {
          Mode: 'PassThrough',
        },
      },
      DependsOn: [
        'MyLambdaServiceRoleDefaultPolicy5BBC6F68',
        'MyLambdaServiceRole4539ECB6',
      ],
    }, ResourcePart.CompleteDefinition);
  });

  test('default function with Disabled tracing', () => {
    const stack = new cdk.Stack();

    new lambda.Function(stack, 'MyLambda', {
      code: new lambda.InlineCode('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      tracing: lambda.Tracing.DISABLED,
    });

    expect(stack).not.toHaveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: [
              'xray:PutTraceSegments',
              'xray:PutTelemetryRecords',
            ],
            Effect: 'Allow',
            Resource: '*',
          },
        ],
        Version: '2012-10-17',
      },
      PolicyName: 'MyLambdaServiceRoleDefaultPolicy5BBC6F68',
      Roles: [
        {
          Ref: 'MyLambdaServiceRole4539ECB6',
        },
      ],
    });

    expect(stack).toHaveResource('AWS::Lambda::Function', {
      Properties: {
        Code: {
          ZipFile: 'foo',
        },
        Handler: 'index.handler',
        Role: {
          'Fn::GetAtt': [
            'MyLambdaServiceRole4539ECB6',
            'Arn',
          ],
        },
        Runtime: 'nodejs10.x',
      },
      DependsOn: [
        'MyLambdaServiceRole4539ECB6',
      ],
    }, ResourcePart.CompleteDefinition);
  });

  test('runtime and handler set to FROM_IMAGE are set to undefined in CloudFormation', () => {
    const stack = new cdk.Stack();

    new lambda.Function(stack, 'MyLambda', {
      code: lambda.Code.fromAssetImage(path.join(__dirname, 'docker-lambda-handler')),
      handler: lambda.Handler.FROM_IMAGE,
      runtime: lambda.Runtime.FROM_IMAGE,
    });

    expect(stack).toHaveResource('AWS::Lambda::Function', {
      Runtime: ABSENT,
      Handler: ABSENT,
      PackageType: 'Image',
    });
  });

  describe('grantInvoke', () => {
    test('adds iam:InvokeFunction', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const role = new iam.Role(stack, 'Role', {
        assumedBy: new iam.AccountPrincipal('1234'),
      });
      const fn = new lambda.Function(stack, 'Function', {
        code: lambda.Code.fromInline('xxx'),
        handler: 'index.handler',
        runtime: lambda.Runtime.NODEJS_10_X,
      });

      // WHEN
      fn.grantInvoke(role);

      // THEN
      expect(stack).toHaveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Action: 'lambda:InvokeFunction',
              Effect: 'Allow',
              Resource: { 'Fn::GetAtt': ['Function76856677', 'Arn'] },
            },
          ],
        },
      });
    });

    test('with a service principal', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const fn = new lambda.Function(stack, 'Function', {
        code: lambda.Code.fromInline('xxx'),
        handler: 'index.handler',
        runtime: lambda.Runtime.NODEJS_10_X,
      });
      const service = new iam.ServicePrincipal('apigateway.amazonaws.com');

      // WHEN
      fn.grantInvoke(service);

      // THEN
      expect(stack).toHaveResource('AWS::Lambda::Permission', {
        Action: 'lambda:InvokeFunction',
        FunctionName: {
          'Fn::GetAtt': [
            'Function76856677',
            'Arn',
          ],
        },
        Principal: 'apigateway.amazonaws.com',
      });
    });

    test('with an account principal', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const fn = new lambda.Function(stack, 'Function', {
        code: lambda.Code.fromInline('xxx'),
        handler: 'index.handler',
        runtime: lambda.Runtime.NODEJS_10_X,
      });
      const account = new iam.AccountPrincipal('123456789012');

      // WHEN
      fn.grantInvoke(account);

      // THEN
      expect(stack).toHaveResource('AWS::Lambda::Permission', {
        Action: 'lambda:InvokeFunction',
        FunctionName: {
          'Fn::GetAtt': [
            'Function76856677',
            'Arn',
          ],
        },
        Principal: '123456789012',
      });
    });

    test('with an arn principal', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const fn = new lambda.Function(stack, 'Function', {
        code: lambda.Code.fromInline('xxx'),
        handler: 'index.handler',
        runtime: lambda.Runtime.NODEJS_10_X,
      });
      const account = new iam.ArnPrincipal('arn:aws:iam::123456789012:role/someRole');

      // WHEN
      fn.grantInvoke(account);

      // THEN
      expect(stack).toHaveResource('AWS::Lambda::Permission', {
        Action: 'lambda:InvokeFunction',
        FunctionName: {
          'Fn::GetAtt': [
            'Function76856677',
            'Arn',
          ],
        },
        Principal: 'arn:aws:iam::123456789012:role/someRole',
      });
    });

    test('can be called twice for the same service principal', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const fn = new lambda.Function(stack, 'Function', {
        code: lambda.Code.fromInline('xxx'),
        handler: 'index.handler',
        runtime: lambda.Runtime.NODEJS_10_X,
      });
      const service = new iam.ServicePrincipal('elasticloadbalancing.amazonaws.com');

      // WHEN
      fn.grantInvoke(service);
      fn.grantInvoke(service);

      // THEN
      expect(stack).toHaveResource('AWS::Lambda::Permission', {
        Action: 'lambda:InvokeFunction',
        FunctionName: {
          'Fn::GetAtt': [
            'Function76856677',
            'Arn',
          ],
        },
        Principal: 'elasticloadbalancing.amazonaws.com',
      });
    });

    test('with an imported role (in the same account)', () => {
      // GIVEN
      const stack = new cdk.Stack(undefined, undefined, {
        env: { account: '123456789012' },
      });
      const fn = new lambda.Function(stack, 'Function', {
        code: lambda.Code.fromInline('xxx'),
        handler: 'index.handler',
        runtime: lambda.Runtime.NODEJS_10_X,
      });

      // WHEN
      fn.grantInvoke(iam.Role.fromRoleArn(stack, 'ForeignRole', 'arn:aws:iam::123456789012:role/someRole'));

      // THEN
      expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: 'lambda:InvokeFunction',
              Effect: 'Allow',
              Resource: { 'Fn::GetAtt': ['Function76856677', 'Arn'] },
            },
          ],
        },
        Roles: ['someRole'],
      });
    });

    test('with an imported role (from a different account)', () => {
      // GIVEN
      const stack = new cdk.Stack(undefined, undefined, {
        env: { account: '3333' },
      });
      const fn = new lambda.Function(stack, 'Function', {
        code: lambda.Code.fromInline('xxx'),
        handler: 'index.handler',
        runtime: lambda.Runtime.NODEJS_10_X,
      });

      // WHEN
      fn.grantInvoke(iam.Role.fromRoleArn(stack, 'ForeignRole', 'arn:aws:iam::123456789012:role/someRole'));

      // THEN
      expect(stack).toHaveResource('AWS::Lambda::Permission', {
        Action: 'lambda:InvokeFunction',
        FunctionName: {
          'Fn::GetAtt': [
            'Function76856677',
            'Arn',
          ],
        },
        Principal: 'arn:aws:iam::123456789012:role/someRole',
      });
    });

    test('on an imported function (same account)', () => {
      // GIVEN
      const stack = new cdk.Stack(undefined, undefined, {
        env: { account: '123456789012' },
      });
      const fn = lambda.Function.fromFunctionArn(stack, 'Function', 'arn:aws:lambda:us-east-1:123456789012:function:MyFn');

      // WHEN
      fn.grantInvoke(new iam.ServicePrincipal('elasticloadbalancing.amazonaws.com'));

      // THEN
      expect(stack).toHaveResource('AWS::Lambda::Permission', {
        Action: 'lambda:InvokeFunction',
        FunctionName: 'arn:aws:lambda:us-east-1:123456789012:function:MyFn',
        Principal: 'elasticloadbalancing.amazonaws.com',
      });
    });

    test('on an imported function (unresolved account)', () => {
      const stack = new cdk.Stack();
      const fn = lambda.Function.fromFunctionArn(stack, 'Function', 'arn:aws:lambda:us-east-1:123456789012:function:MyFn');

      expect(
        () => fn.grantInvoke(new iam.ServicePrincipal('elasticloadbalancing.amazonaws.com')),
      ).toThrow(/Cannot modify permission to lambda function/);
    });

    test('on an imported function (unresolved account & w/ allowPermissions)', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const fn = lambda.Function.fromFunctionAttributes(stack, 'Function', {
        functionArn: 'arn:aws:lambda:us-east-1:123456789012:function:MyFn',
        sameEnvironment: true,
      });

      // WHEN
      fn.grantInvoke(new iam.ServicePrincipal('elasticloadbalancing.amazonaws.com'));

      // THEN
      expect(stack).toHaveResource('AWS::Lambda::Permission', {
        Action: 'lambda:InvokeFunction',
        FunctionName: 'arn:aws:lambda:us-east-1:123456789012:function:MyFn',
        Principal: 'elasticloadbalancing.amazonaws.com',
      });
    });

    test('on an imported function (different account)', () => {
      // GIVEN
      const stack = new cdk.Stack(undefined, undefined, {
        env: { account: '111111111111' }, // Different account
      });
      const fn = lambda.Function.fromFunctionArn(stack, 'Function', 'arn:aws:lambda:us-east-1:123456789012:function:MyFn');

      // THEN
      expect(() => { fn.grantInvoke(new iam.ServicePrincipal('elasticloadbalancing.amazonaws.com')); })
        .toThrow(/Cannot modify permission to lambda function/);
    });
  });

  test('Can use metricErrors on a lambda Function', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new lambda.Function(stack, 'Function', {
      code: lambda.Code.fromInline('xxx'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
    });

    // THEN
    expect(stack.resolve(fn.metricErrors())).toEqual({
      dimensions: { FunctionName: { Ref: 'Function76856677' } },
      namespace: 'AWS/Lambda',
      metricName: 'Errors',
      period: cdk.Duration.minutes(5),
      statistic: 'Sum',
    });
  });

  test('addEventSource calls bind', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new lambda.Function(stack, 'Function', {
      code: lambda.Code.fromInline('xxx'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
    });

    let bindTarget;

    class EventSourceMock implements lambda.IEventSource {
      public bind(target: lambda.IFunction) {
        bindTarget = target;
      }
    }

    // WHEN
    fn.addEventSource(new EventSourceMock());

    // THEN
    expect(bindTarget).toEqual(fn);
  });

  test('using an incompatible layer', () => {
    // GIVEN
    const stack = new cdk.Stack(undefined, 'TestStack');
    const layer = lambda.LayerVersion.fromLayerVersionAttributes(stack, 'TestLayer', {
      layerVersionArn: 'arn:aws:...',
      compatibleRuntimes: [lambda.Runtime.NODEJS_12_X],
    });

    // THEN
    expect(() => new lambda.Function(stack, 'Function', {
      layers: [layer],
      runtime: lambda.Runtime.NODEJS_10_X,
      code: lambda.Code.fromInline('exports.main = function() { console.log("DONE"); }'),
      handler: 'index.main',
    })).toThrow(/nodejs10.x is not in \[nodejs12.x\]/);
  });

  test('using more than 5 layers', () => {
    // GIVEN
    const stack = new cdk.Stack(undefined, 'TestStack');
    const layers = new Array(6).fill(lambda.LayerVersion.fromLayerVersionAttributes(stack, 'TestLayer', {
      layerVersionArn: 'arn:aws:...',
      compatibleRuntimes: [lambda.Runtime.NODEJS_10_X],
    }));

    // THEN
    expect(() => new lambda.Function(stack, 'Function', {
      layers,
      runtime: lambda.Runtime.NODEJS_10_X,
      code: lambda.Code.fromInline('exports.main = function() { console.log("DONE"); }'),
      handler: 'index.main',
    })).toThrow(/Unable to add layer:/);
  });

  test('environment variables work in China', () => {
    // GIVEN
    const stack = new cdk.Stack(undefined, undefined, { env: { region: 'cn-north-1' } });

    // WHEN
    new lambda.Function(stack, 'MyLambda', {
      code: new lambda.InlineCode('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS,
      environment: {
        SOME: 'Variable',
      },
    });

    // THEN
    expect(stack).toHaveResource('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          SOME: 'Variable',
        },
      },
    });
  });

  test('environment variables work in an unspecified region', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    new lambda.Function(stack, 'MyLambda', {
      code: new lambda.InlineCode('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS,
      environment: {
        SOME: 'Variable',
      },
    });

    // THEN
    expect(stack).toHaveResource('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          SOME: 'Variable',
        },
      },
    });
  });

  test('support reserved concurrent executions', () => {
    const stack = new cdk.Stack();

    new lambda.Function(stack, 'MyLambda', {
      code: new lambda.InlineCode('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS,
      reservedConcurrentExecutions: 10,
    });

    expect(stack).toHaveResource('AWS::Lambda::Function', {
      ReservedConcurrentExecutions: 10,
    });
  });

  test('its possible to specify event sources upon creation', () => {
    // GIVEN
    const stack = new cdk.Stack();

    let bindCount = 0;

    class EventSource implements lambda.IEventSource {
      public bind(_fn: lambda.IFunction): void {
        bindCount++;
      }
    }

    // WHEN
    new lambda.Function(stack, 'fn', {
      code: lambda.Code.fromInline('boom'),
      runtime: lambda.Runtime.NODEJS_10_X,
      handler: 'index.bam',
      events: [
        new EventSource(),
        new EventSource(),
      ],
    });

    // THEN
    expect(bindCount).toEqual(2);
  });

  test('Provided Runtime returns the right values', () => {
    const rt = lambda.Runtime.PROVIDED;

    expect(rt.name).toEqual('provided');
    expect(rt.supportsInlineCode).toEqual(false);
  });

  test('specify log retention', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    new lambda.Function(stack, 'MyLambda', {
      code: new lambda.InlineCode('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // THEN
    expect(stack).toHaveResource('Custom::LogRetention', {
      LogGroupName: {
        'Fn::Join': [
          '',
          [
            '/aws/lambda/',
            {
              Ref: 'MyLambdaCCE802FB',
            },
          ],
        ],
      },
      RetentionInDays: 30,
    });
  });

  test('imported lambda with imported security group and allowAllOutbound set to false', () => {
    // GIVEN
    const stack = new cdk.Stack();

    const fn = lambda.Function.fromFunctionAttributes(stack, 'fn', {
      functionArn: 'arn:aws:lambda:us-east-1:123456789012:function:my-function',
      securityGroup: ec2.SecurityGroup.fromSecurityGroupId(stack, 'SG', 'sg-123456789', {
        allowAllOutbound: false,
      }),
    });

    // WHEN
    fn.connections.allowToAnyIpv4(ec2.Port.tcp(443));

    // THEN
    expect(stack).toHaveResource('AWS::EC2::SecurityGroupEgress', {
      GroupId: 'sg-123456789',
    });
  });

  test('with event invoke config', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    new lambda.Function(stack, 'fn', {
      code: new lambda.InlineCode('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      onFailure: {
        bind: () => ({ destination: 'on-failure-arn' }),
      },
      onSuccess: {
        bind: () => ({ destination: 'on-success-arn' }),
      },
      maxEventAge: cdk.Duration.hours(1),
      retryAttempts: 0,
    });

    // THEN
    expect(stack).toHaveResource('AWS::Lambda::EventInvokeConfig', {
      FunctionName: {
        Ref: 'fn5FF616E3',
      },
      Qualifier: '$LATEST',
      DestinationConfig: {
        OnFailure: {
          Destination: 'on-failure-arn',
        },
        OnSuccess: {
          Destination: 'on-success-arn',
        },
      },
      MaximumEventAgeInSeconds: 3600,
      MaximumRetryAttempts: 0,
    });
  });

  test('throws when calling configureAsyncInvoke on already configured function', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new lambda.Function(stack, 'fn', {
      code: new lambda.InlineCode('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      maxEventAge: cdk.Duration.hours(1),
    });

    // THEN
    expect(() => fn.configureAsyncInvoke({ retryAttempts: 0 })).toThrow(/An EventInvokeConfig has already been configured/);
  });

  test('event invoke config on imported lambda', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = lambda.Function.fromFunctionAttributes(stack, 'fn', {
      functionArn: 'arn:aws:lambda:us-east-1:123456789012:function:my-function',
    });

    // WHEN
    fn.configureAsyncInvoke({
      retryAttempts: 1,
    });

    // THEN
    expect(stack).toHaveResource('AWS::Lambda::EventInvokeConfig', {
      FunctionName: 'my-function',
      Qualifier: '$LATEST',
      MaximumRetryAttempts: 1,
    });
  });

  test('add a version with event invoke config', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new lambda.Function(stack, 'fn', {
      code: new lambda.InlineCode('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
    });

    // WHEN
    fn.addVersion('1', 'sha256', 'desc', undefined, {
      retryAttempts: 0,
    });

    // THEN
    expect(stack).toHaveResource('AWS::Lambda::EventInvokeConfig', {
      FunctionName: {
        Ref: 'fn5FF616E3',
      },
      Qualifier: {
        'Fn::GetAtt': [
          'fnVersion197FA813F',
          'Version',
        ],
      },
      MaximumRetryAttempts: 0,
    });
  });

  test('check edge compatibility with env vars that can be removed', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new lambda.Function(stack, 'fn', {
      code: new lambda.InlineCode('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
    });
    fn.addEnvironment('KEY', 'value', { removeInEdge: true });

    // WHEN
    fn._checkEdgeCompatibility();

    // THEN
    expect(stack).toHaveResource('AWS::Lambda::Function', {
      Environment: ABSENT,
    });
  });

  test('check edge compatibility with env vars that cannot be removed', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new lambda.Function(stack, 'fn', {
      code: new lambda.InlineCode('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      environment: {
        KEY: 'value',
      },
    });
    fn.addEnvironment('OTHER_KEY', 'other_value', { removeInEdge: true });

    // THEN
    expect(() => fn._checkEdgeCompatibility()).toThrow(/The function Default\/fn contains environment variables \[KEY\] and is not compatible with Lambda@Edge/);
  });

  test('add incompatible layer', () => {
    // GIVEN
    const stack = new cdk.Stack(undefined, 'TestStack');
    const bucket = new s3.Bucket(stack, 'Bucket');
    const code = new lambda.S3Code(bucket, 'ObjectKey');

    const func = new lambda.Function(stack, 'myFunc', {
      runtime: lambda.Runtime.PYTHON_3_7,
      handler: 'index.handler',
      code,
    });
    const layer = new lambda.LayerVersion(stack, 'myLayer', {
      code,
      compatibleRuntimes: [lambda.Runtime.NODEJS],
    });

    // THEN
    expect(() => func.addLayers(layer)).toThrow(
      /This lambda function uses a runtime that is incompatible with this layer/);
  });

  test('add compatible layer', () => {
    // GIVEN
    const stack = new cdk.Stack(undefined, 'TestStack');
    const bucket = new s3.Bucket(stack, 'Bucket');
    const code = new lambda.S3Code(bucket, 'ObjectKey');

    const func = new lambda.Function(stack, 'myFunc', {
      runtime: lambda.Runtime.PYTHON_3_7,
      handler: 'index.handler',
      code,
    });
    const layer = new lambda.LayerVersion(stack, 'myLayer', {
      code,
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_7],
    });

    // THEN
    // should not throw
    expect(() => func.addLayers(layer)).not.toThrow();
  });

  test('add compatible layer for deep clone', () => {
    // GIVEN
    const stack = new cdk.Stack(undefined, 'TestStack');
    const bucket = new s3.Bucket(stack, 'Bucket');
    const code = new lambda.S3Code(bucket, 'ObjectKey');

    const runtime = lambda.Runtime.PYTHON_3_7;
    const func = new lambda.Function(stack, 'myFunc', {
      runtime,
      handler: 'index.handler',
      code,
    });
    const clone = _.cloneDeep(runtime);
    const layer = new lambda.LayerVersion(stack, 'myLayer', {
      code,
      compatibleRuntimes: [clone],
    });

    // THEN
    // should not throw
    expect(() => func.addLayers(layer)).not.toThrow();
  });

  test('empty inline code is not allowed', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN/THEN
    expect(() => new lambda.Function(stack, 'fn', {
      handler: 'foo',
      runtime: lambda.Runtime.NODEJS_10_X,
      code: lambda.Code.fromInline(''),
    })).toThrow(/Lambda inline code cannot be empty/);
  });

  test('logGroup is correctly returned', () => {
    const stack = new cdk.Stack();
    const fn = new lambda.Function(stack, 'fn', {
      handler: 'foo',
      runtime: lambda.Runtime.NODEJS_10_X,
      code: lambda.Code.fromInline('foo'),
    });
    const logGroup = fn.logGroup;
    expect(logGroup.logGroupName).toBeDefined();
    expect(logGroup.logGroupArn).toBeDefined();
  });

  test('dlq is returned when provided by user', () => {
    const stack = new cdk.Stack();

    const dlQueue = new sqs.Queue(stack, 'DeadLetterQueue', {
      queueName: 'MyLambda_DLQ',
      retentionPeriod: cdk.Duration.days(14),
    });

    const fn = new lambda.Function(stack, 'fn', {
      handler: 'foo',
      runtime: lambda.Runtime.NODEJS_10_X,
      code: lambda.Code.fromInline('foo'),
      deadLetterQueue: dlQueue,
    });
    const deadLetterQueue = fn.deadLetterQueue;
    expect(deadLetterQueue?.queueArn).toBeDefined();
    expect(deadLetterQueue?.queueName).toBeDefined();
    expect(deadLetterQueue?.queueUrl).toBeDefined();
  });

  test('dlq is returned when setup by cdk', () => {
    const stack = new cdk.Stack();
    const fn = new lambda.Function(stack, 'fn', {
      handler: 'foo',
      runtime: lambda.Runtime.NODEJS_10_X,
      code: lambda.Code.fromInline('foo'),
      deadLetterQueueEnabled: true,
    });
    const deadLetterQueue = fn.deadLetterQueue;
    expect(deadLetterQueue?.queueArn).toBeDefined();
    expect(deadLetterQueue?.queueName).toBeDefined();
    expect(deadLetterQueue?.queueUrl).toBeDefined();
  });

  test('dlq is undefined when not setup', () => {
    const stack = new cdk.Stack();
    const fn = new lambda.Function(stack, 'fn', {
      handler: 'foo',
      runtime: lambda.Runtime.NODEJS_10_X,
      code: lambda.Code.fromInline('foo'),
    });
    const deadLetterQueue = fn.deadLetterQueue;
    expect(deadLetterQueue).toBeUndefined();
  });

  test('one and only one child LogRetention construct will be created', () => {
    const stack = new cdk.Stack();
    const fn = new lambda.Function(stack, 'fn', {
      handler: 'foo',
      runtime: lambda.Runtime.NODEJS_10_X,
      code: lambda.Code.fromInline('foo'),
      logRetention: logs.RetentionDays.FIVE_DAYS,
    });

    // Call logGroup a few times. If more than one instance of LogRetention was created,
    // the second call will fail on duplicate constructs.
    fn.logGroup;
    fn.logGroup;
    fn.logGroup;
  });

  test('fails when inline code is specified on an incompatible runtime', () => {
    const stack = new cdk.Stack();
    expect(() => new lambda.Function(stack, 'fn', {
      handler: 'foo',
      runtime: lambda.Runtime.PROVIDED,
      code: lambda.Code.fromInline('foo'),
    })).toThrow(/Inline source not allowed for/);
  });

  test('multiple calls to latestVersion returns the same version', () => {
    const stack = new cdk.Stack();

    const fn = new lambda.Function(stack, 'MyLambda', {
      code: new lambda.InlineCode('hello()'),
      handler: 'index.hello',
      runtime: lambda.Runtime.NODEJS_10_X,
    });

    const version1 = fn.latestVersion;
    const version2 = fn.latestVersion;

    const expectedArn = {
      'Fn::Join': ['', [
        { 'Fn::GetAtt': ['MyLambdaCCE802FB', 'Arn'] },
        ':$LATEST',
      ]],
    };
    expect(version1).toEqual(version2);
    expect(stack.resolve(version1.functionArn)).toEqual(expectedArn);
    expect(stack.resolve(version2.functionArn)).toEqual(expectedArn);
  });

  test('default function with kmsKeyArn, environmentEncryption passed as props', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const key: kms.IKey = new kms.Key(stack, 'EnvVarEncryptKey', {
      description: 'sample key',
    });

    // WHEN
    new lambda.Function(stack, 'MyLambda', {
      code: new lambda.InlineCode('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      environment: {
        SOME: 'Variable',
      },
      environmentEncryption: key,
    });

    // THEN
    expect(stack).toHaveResource('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          SOME: 'Variable',
        },
      },
      KmsKeyArn: {
        'Fn::GetAtt': [
          'EnvVarEncryptKey1A7CABDB',
          'Arn',
        ],
      },
    });
  });

  describe('profiling group', () => {
    test('default function with CDK created Profiling Group', () => {
      const stack = new cdk.Stack();

      new lambda.Function(stack, 'MyLambda', {
        code: new lambda.InlineCode('foo'),
        handler: 'index.handler',
        runtime: lambda.Runtime.PYTHON_3_6,
        profiling: true,
      });

      expect(stack).toHaveResource('AWS::CodeGuruProfiler::ProfilingGroup', {
        ProfilingGroupName: 'MyLambdaProfilingGroupC5B6CCD8',
        ComputePlatform: 'AWSLambda',
      });

      expect(stack).toHaveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: [
                'codeguru-profiler:ConfigureAgent',
                'codeguru-profiler:PostAgentProfile',
              ],
              Effect: 'Allow',
              Resource: {
                'Fn::GetAtt': ['MyLambdaProfilingGroupEC6DE32F', 'Arn'],
              },
            },
          ],
          Version: '2012-10-17',
        },
        PolicyName: 'MyLambdaServiceRoleDefaultPolicy5BBC6F68',
        Roles: [
          {
            Ref: 'MyLambdaServiceRole4539ECB6',
          },
        ],
      });

      expect(stack).toHaveResource('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            AWS_CODEGURU_PROFILER_GROUP_ARN: { 'Fn::GetAtt': ['MyLambdaProfilingGroupEC6DE32F', 'Arn'] },
            AWS_CODEGURU_PROFILER_ENABLED: 'TRUE',
          },
        },
      });
    });

    test('default function with client provided Profiling Group', () => {
      const stack = new cdk.Stack();

      new lambda.Function(stack, 'MyLambda', {
        code: new lambda.InlineCode('foo'),
        handler: 'index.handler',
        runtime: lambda.Runtime.PYTHON_3_6,
        profilingGroup: new ProfilingGroup(stack, 'ProfilingGroup'),
      });

      expect(stack).toHaveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: [
                'codeguru-profiler:ConfigureAgent',
                'codeguru-profiler:PostAgentProfile',
              ],
              Effect: 'Allow',
              Resource: {
                'Fn::GetAtt': ['ProfilingGroup26979FD7', 'Arn'],
              },
            },
          ],
          Version: '2012-10-17',
        },
        PolicyName: 'MyLambdaServiceRoleDefaultPolicy5BBC6F68',
        Roles: [
          {
            Ref: 'MyLambdaServiceRole4539ECB6',
          },
        ],
      });

      expect(stack).toHaveResource('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            AWS_CODEGURU_PROFILER_GROUP_ARN: {
              'Fn::Join': [
                '',
                [
                  'arn:', { Ref: 'AWS::Partition' }, ':codeguru-profiler:', { Ref: 'AWS::Region' },
                  ':', { Ref: 'AWS::AccountId' }, ':profilingGroup/', { Ref: 'ProfilingGroup26979FD7' },
                ],
              ],
            },
            AWS_CODEGURU_PROFILER_ENABLED: 'TRUE',
          },
        },
      });
    });

    test('default function with client provided Profiling Group but profiling set to false', () => {
      const stack = new cdk.Stack();

      new lambda.Function(stack, 'MyLambda', {
        code: new lambda.InlineCode('foo'),
        handler: 'index.handler',
        runtime: lambda.Runtime.PYTHON_3_6,
        profiling: false,
        profilingGroup: new ProfilingGroup(stack, 'ProfilingGroup'),
      });

      expect(stack).not.toHaveResource('AWS::IAM::Policy');

      expect(stack).not.toHaveResource('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            AWS_CODEGURU_PROFILER_GROUP_ARN: {
              'Fn::Join': [
                '',
                [
                  'arn:', { Ref: 'AWS::Partition' }, ':codeguru-profiler:', { Ref: 'AWS::Region' },
                  ':', { Ref: 'AWS::AccountId' }, ':profilingGroup/', { Ref: 'ProfilingGroup26979FD7' },
                ],
              ],
            },
            AWS_CODEGURU_PROFILER_ENABLED: 'TRUE',
          },
        },
      });
    });

    test('default function with profiling enabled and client provided env vars', () => {
      const stack = new cdk.Stack();

      expect(() => new lambda.Function(stack, 'MyLambda', {
        code: new lambda.InlineCode('foo'),
        handler: 'index.handler',
        runtime: lambda.Runtime.PYTHON_3_6,
        profiling: true,
        environment: {
          AWS_CODEGURU_PROFILER_GROUP_ARN: 'profiler_group_arn',
          AWS_CODEGURU_PROFILER_ENABLED: 'yes',
        },
      })).toThrow(/AWS_CODEGURU_PROFILER_GROUP_ARN and AWS_CODEGURU_PROFILER_ENABLED must not be set when profiling options enabled/);
    });

    test('default function with client provided Profiling Group and client provided env vars', () => {
      const stack = new cdk.Stack();

      expect(() => new lambda.Function(stack, 'MyLambda', {
        code: new lambda.InlineCode('foo'),
        handler: 'index.handler',
        runtime: lambda.Runtime.PYTHON_3_6,
        profilingGroup: new ProfilingGroup(stack, 'ProfilingGroup'),
        environment: {
          AWS_CODEGURU_PROFILER_GROUP_ARN: 'profiler_group_arn',
          AWS_CODEGURU_PROFILER_ENABLED: 'yes',
        },
      })).toThrow(/AWS_CODEGURU_PROFILER_GROUP_ARN and AWS_CODEGURU_PROFILER_ENABLED must not be set when profiling options enabled/);
    });

    test('throws an error when used with an unsupported runtime', () => {
      const stack = new cdk.Stack();
      expect(() => new lambda.Function(stack, 'MyLambda', {
        code: new lambda.InlineCode('foo'),
        handler: 'index.handler',
        runtime: lambda.Runtime.NODEJS_10_X,
        profilingGroup: new ProfilingGroup(stack, 'ProfilingGroup'),
        environment: {
          AWS_CODEGURU_PROFILER_GROUP_ARN: 'profiler_group_arn',
          AWS_CODEGURU_PROFILER_ENABLED: 'yes',
        },
      })).toThrow(/not supported by runtime/);
    });
  });

  describe('currentVersion', () => {
    // see test.function-hash.ts for more coverage for this
    test('logical id of version is based on the function hash', () => {
      // GIVEN
      const stack1 = new cdk.Stack();
      const fn1 = new lambda.Function(stack1, 'MyFunction', {
        handler: 'foo',
        runtime: lambda.Runtime.NODEJS_12_X,
        code: lambda.Code.fromAsset(path.join(__dirname, 'handler.zip')),
        environment: {
          FOO: 'bar',
        },
      });
      const stack2 = new cdk.Stack();
      const fn2 = new lambda.Function(stack2, 'MyFunction', {
        handler: 'foo',
        runtime: lambda.Runtime.NODEJS_12_X,
        code: lambda.Code.fromAsset(path.join(__dirname, 'handler.zip')),
        environment: {
          FOO: 'bear',
        },
      });

      // WHEN
      new cdk.CfnOutput(stack1, 'CurrentVersionArn', {
        value: fn1.currentVersion.functionArn,
      });
      new cdk.CfnOutput(stack2, 'CurrentVersionArn', {
        value: fn2.currentVersion.functionArn,
      });

      // THEN
      const template1 = SynthUtils.synthesize(stack1).template;
      const template2 = SynthUtils.synthesize(stack2).template;

      // these functions are different in their configuration but the original
      // logical ID of the version would be the same unless the logical ID
      // includes the hash of function's configuration.
      expect(template1.Outputs.CurrentVersionArn.Value).not.toEqual(template2.Outputs.CurrentVersionArn.Value);
    });
  });

  describe('filesystem', () => {
    test('mount efs filesystem', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'Vpc', {
        maxAzs: 3,
        natGateways: 1,
      });

      const fs = new efs.FileSystem(stack, 'Efs', {
        vpc,
      });
      const accessPoint = fs.addAccessPoint('AccessPoint');
      // WHEN
      new lambda.Function(stack, 'MyFunction', {
        vpc,
        handler: 'foo',
        runtime: lambda.Runtime.NODEJS_12_X,
        code: lambda.Code.fromAsset(path.join(__dirname, 'handler.zip')),
        filesystem: lambda.FileSystem.fromEfsAccessPoint(accessPoint, '/mnt/msg'),
      });

      // THEN
      expect(stack).toHaveResource('AWS::Lambda::Function', {
        FileSystemConfigs: [
          {
            Arn: {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  {
                    Ref: 'AWS::Partition',
                  },
                  ':elasticfilesystem:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':access-point/',
                  {
                    Ref: 'EfsAccessPointE419FED9',
                  },
                ],
              ],
            },
            LocalMountPath: '/mnt/msg',
          },
        ],
      });
    });

    test('throw error mounting efs with no vpc', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'Vpc', {
        maxAzs: 3,
        natGateways: 1,
      });

      const fs = new efs.FileSystem(stack, 'Efs', {
        vpc,
      });
      const accessPoint = fs.addAccessPoint('AccessPoint');

      // THEN
      expect(() => {
        new lambda.Function(stack, 'MyFunction', {
          handler: 'foo',
          runtime: lambda.Runtime.NODEJS_12_X,
          code: lambda.Code.fromAsset(path.join(__dirname, 'handler.zip')),
          filesystem: lambda.FileSystem.fromEfsAccessPoint(accessPoint, '/mnt/msg'),
        });
      }).toThrow();
    });

    test('verify deps when mounting efs', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'Vpc', {
        maxAzs: 3,
        natGateways: 1,
      });
      const securityGroup = new ec2.SecurityGroup(stack, 'LambdaSG', {
        vpc,
        allowAllOutbound: false,
      });

      const fs = new efs.FileSystem(stack, 'Efs', {
        vpc,
      });
      const accessPoint = fs.addAccessPoint('AccessPoint');
      // WHEN
      new lambda.Function(stack, 'MyFunction', {
        vpc,
        handler: 'foo',
        securityGroups: [securityGroup],
        runtime: lambda.Runtime.NODEJS_12_X,
        code: lambda.Code.fromAsset(path.join(__dirname, 'handler.zip')),
        filesystem: lambda.FileSystem.fromEfsAccessPoint(accessPoint, '/mnt/msg'),
      });

      // THEN
      expect(stack).toHaveResource('AWS::Lambda::Function', {
        DependsOn: [
          'EfsEfsMountTarget195B2DD2E',
          'EfsEfsMountTarget2315C927F',
          'EfsEfsSecurityGroupfromLambdaSG20491B2F751D',
          'LambdaSGtoEfsEfsSecurityGroupFCE2954020499719694A',
          'MyFunctionServiceRoleDefaultPolicyB705ABD4',
          'MyFunctionServiceRole3C357FF2',
        ],
      }, ResourcePart.CompleteDefinition);
    });
  });

  describe('code config', () => {
    class MyCode extends lambda.Code {
      public readonly isInline: boolean;
      constructor(private readonly config: lambda.CodeConfig) {
        super();
        this.isInline = 'inlineCode' in config;
      }

      public bind(_scope: constructs.Construct): lambda.CodeConfig {
        return this.config;
      }
    }

    test('only one of inline, s3 or imageConfig are allowed', () => {
      const stack = new cdk.Stack();

      expect(() => new lambda.Function(stack, 'Fn1', {
        code: new MyCode({}),
        handler: 'index.handler',
        runtime: lambda.Runtime.GO_1_X,
      })).toThrow(/lambda.Code must specify exactly one of/);

      expect(() => new lambda.Function(stack, 'Fn2', {
        code: new MyCode({
          inlineCode: 'foo',
          image: { imageUri: 'bar' },
        }),
        handler: 'index.handler',
        runtime: lambda.Runtime.GO_1_X,
      })).toThrow(/lambda.Code must specify exactly one of/);

      expect(() => new lambda.Function(stack, 'Fn3', {
        code: new MyCode({
          image: { imageUri: 'baz' },
          s3Location: { bucketName: 's3foo', objectKey: 's3bar' },
        }),
        handler: 'index.handler',
        runtime: lambda.Runtime.GO_1_X,
      })).toThrow(/lambda.Code must specify exactly one of/);

      expect(() => new lambda.Function(stack, 'Fn4', {
        code: new MyCode({ inlineCode: 'baz', s3Location: { bucketName: 's3foo', objectKey: 's3bar' } }),
        handler: 'index.handler',
        runtime: lambda.Runtime.GO_1_X,
      })).toThrow(/lambda.Code must specify exactly one of/);
    });

    test('handler must be FROM_IMAGE when image asset is specified', () => {
      const stack = new cdk.Stack();

      expect(() => new lambda.Function(stack, 'Fn1', {
        code: lambda.Code.fromAssetImage('test/docker-lambda-handler'),
        handler: lambda.Handler.FROM_IMAGE,
        runtime: lambda.Runtime.FROM_IMAGE,
      })).not.toThrow();

      expect(() => new lambda.Function(stack, 'Fn2', {
        code: lambda.Code.fromAssetImage('test/docker-lambda-handler'),
        handler: 'index.handler',
        runtime: lambda.Runtime.FROM_IMAGE,
      })).toThrow(/handler must be.*FROM_IMAGE/);
    });

    test('runtime must be FROM_IMAGE when image asset is specified', () => {
      const stack = new cdk.Stack();

      expect(() => new lambda.Function(stack, 'Fn1', {
        code: lambda.Code.fromAssetImage('test/docker-lambda-handler'),
        handler: lambda.Handler.FROM_IMAGE,
        runtime: lambda.Runtime.FROM_IMAGE,
      })).not.toThrow();

      expect(() => new lambda.Function(stack, 'Fn2', {
        code: lambda.Code.fromAssetImage('test/docker-lambda-handler'),
        handler: lambda.Handler.FROM_IMAGE,
        runtime: lambda.Runtime.GO_1_X,
      })).toThrow(/runtime must be.*FROM_IMAGE/);
    });

    test('imageUri is correctly configured', () => {
      const stack = new cdk.Stack();

      new lambda.Function(stack, 'Fn1', {
        code: new MyCode({
          image: {
            imageUri: 'ecr image uri',
          },
        }),
        handler: lambda.Handler.FROM_IMAGE,
        runtime: lambda.Runtime.FROM_IMAGE,
      });

      expect(stack).toHaveResource('AWS::Lambda::Function', {
        Code: {
          ImageUri: 'ecr image uri',
        },
        ImageConfig: ABSENT,
      });
    });

    test('imageConfig is correctly configured', () => {
      const stack = new cdk.Stack();

      new lambda.Function(stack, 'Fn1', {
        code: new MyCode({
          image: {
            imageUri: 'ecr image uri',
            cmd: ['cmd', 'param1'],
            entrypoint: ['entrypoint', 'param2'],
          },
        }),
        handler: lambda.Handler.FROM_IMAGE,
        runtime: lambda.Runtime.FROM_IMAGE,
      });

      expect(stack).toHaveResource('AWS::Lambda::Function', {
        ImageConfig: {
          Command: ['cmd', 'param1'],
          EntryPoint: ['entrypoint', 'param2'],
        },
      });
    });
  });

  describe('code signing config', () => {
    test('default', () => {
      const stack = new cdk.Stack();

      const signingProfile = new signer.SigningProfile(stack, 'SigningProfile', {
        platform: signer.Platform.AWS_LAMBDA_SHA384_ECDSA,
      });

      const codeSigningConfig = new lambda.CodeSigningConfig(stack, 'CodeSigningConfig', {
        signingProfiles: [signingProfile],
      });

      new lambda.Function(stack, 'MyLambda', {
        code: new lambda.InlineCode('foo'),
        handler: 'index.handler',
        runtime: lambda.Runtime.NODEJS_10_X,
        codeSigningConfig,
      });

      expect(stack).toHaveResource('AWS::Lambda::Function', {
        CodeSigningConfigArn: {
          'Fn::GetAtt': [
            'CodeSigningConfigD8D41C10',
            'CodeSigningConfigArn',
          ],
        },
      });
    });
  });

  test('error when layers set in a container function', () => {
    const stack = new cdk.Stack();
    const bucket = new s3.Bucket(stack, 'Bucket');
    const code = new lambda.S3Code(bucket, 'ObjectKey');

    const layer = new lambda.LayerVersion(stack, 'Layer', {
      code,
    });

    expect(() => new lambda.DockerImageFunction(stack, 'MyLambda', {
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, 'docker-lambda-handler')),
      layers: [layer],
    })).toThrow(/Layers are not supported for container image functions/);
  });
});

function newTestLambda(scope: constructs.Construct) {
  return new lambda.Function(scope, 'MyLambda', {
    code: new lambda.InlineCode('foo'),
    handler: 'bar',
    runtime: lambda.Runtime.PYTHON_2_7,
  });
}
