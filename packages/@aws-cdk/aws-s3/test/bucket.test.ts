import '@aws-cdk/assert-internal/jest';
import { EOL } from 'os';
import { ResourcePart, SynthUtils, arrayWith, objectLike } from '@aws-cdk/assert-internal';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import * as cdk from '@aws-cdk/core';
import * as cxapi from '@aws-cdk/cx-api';
import { testFutureBehavior, testLegacyBehavior } from 'cdk-build-tools/lib/feature-flag';
import * as s3 from '../lib';

// to make it easy to copy & paste from output:
/* eslint-disable quote-props */

const s3GrantWriteCtx = { [cxapi.S3_GRANT_WRITE_WITHOUT_ACL]: true };

describe('bucket', () => {
  test('default bucket', () => {
    const stack = new cdk.Stack();

    new s3.Bucket(stack, 'MyBucket');

    expect(stack).toMatchTemplate({
      'Resources': {
        'MyBucketF68F3FF0': {
          'Type': 'AWS::S3::Bucket',
          'DeletionPolicy': 'Retain',
          'UpdateReplacePolicy': 'Retain',
        },
      },
    });
  });

  test('CFN properties are type-validated during resolution', () => {
    const stack = new cdk.Stack();
    new s3.Bucket(stack, 'MyBucket', {
      bucketName: cdk.Token.asString(5), // Oh no
    });

    expect(() => {
      SynthUtils.synthesize(stack);
    }).toThrow(/bucketName: 5 should be a string/);
  });

  test('bucket without encryption', () => {
    const stack = new cdk.Stack();
    new s3.Bucket(stack, 'MyBucket', {
      encryption: s3.BucketEncryption.UNENCRYPTED,
    });

    expect(stack).toMatchTemplate({
      'Resources': {
        'MyBucketF68F3FF0': {
          'Type': 'AWS::S3::Bucket',
          'DeletionPolicy': 'Retain',
          'UpdateReplacePolicy': 'Retain',
        },
      },
    });
  });

  test('bucket with managed encryption', () => {
    const stack = new cdk.Stack();
    new s3.Bucket(stack, 'MyBucket', {
      encryption: s3.BucketEncryption.KMS_MANAGED,
    });

    expect(stack).toMatchTemplate({
      'Resources': {
        'MyBucketF68F3FF0': {
          'Type': 'AWS::S3::Bucket',
          'Properties': {
            'BucketEncryption': {
              'ServerSideEncryptionConfiguration': [
                {
                  'ServerSideEncryptionByDefault': {
                    'SSEAlgorithm': 'aws:kms',
                  },
                },
              ],
            },
          },
          'DeletionPolicy': 'Retain',
          'UpdateReplacePolicy': 'Retain',
        },
      },
    });
  });

  test('valid bucket names', () => {
    const stack = new cdk.Stack();

    expect(() => new s3.Bucket(stack, 'MyBucket1', {
      bucketName: 'abc.xyz-34ab',
    })).not.toThrow();

    expect(() => new s3.Bucket(stack, 'MyBucket2', {
      bucketName: '124.pp--33',
    })).not.toThrow();
  });

  test('bucket validation skips tokenized values', () => {
    const stack = new cdk.Stack();

    expect(() => new s3.Bucket(stack, 'MyBucket', {
      bucketName: cdk.Lazy.string({ produce: () => '_BUCKET' }),
    })).not.toThrow();
  });

  test('fails with message on invalid bucket names', () => {
    const stack = new cdk.Stack();
    const bucket = `-buckEt.-${new Array(65).join('$')}`;
    const expectedErrors = [
      `Invalid S3 bucket name (value: ${bucket})`,
      'Bucket name must be at least 3 and no more than 63 characters',
      'Bucket name must only contain lowercase characters and the symbols, period (.) and dash (-) (offset: 5)',
      'Bucket name must start and end with a lowercase character or number (offset: 0)',
      `Bucket name must start and end with a lowercase character or number (offset: ${bucket.length - 1})`,
      'Bucket name must not have dash next to period, or period next to dash, or consecutive periods (offset: 7)',
    ].join(EOL);

    expect(() => new s3.Bucket(stack, 'MyBucket', {
      bucketName: bucket,
    })).toThrow(expectedErrors);
  });

  test('fails if bucket name has less than 3 or more than 63 characters', () => {
    const stack = new cdk.Stack();

    expect(() => new s3.Bucket(stack, 'MyBucket1', {
      bucketName: 'a',
    })).toThrow(/at least 3/);

    expect(() => new s3.Bucket(stack, 'MyBucket2', {
      bucketName: new Array(65).join('x'),
    })).toThrow(/no more than 63/);
  });

  test('fails if bucket name has invalid characters', () => {
    const stack = new cdk.Stack();

    expect(() => new s3.Bucket(stack, 'MyBucket1', {
      bucketName: 'b@cket',
    })).toThrow(/offset: 1/);

    expect(() => new s3.Bucket(stack, 'MyBucket2', {
      bucketName: 'bucKet',
    })).toThrow(/offset: 3/);

    expect(() => new s3.Bucket(stack, 'MyBucket3', {
      bucketName: 'bučket',
    })).toThrow(/offset: 2/);
  });

  test('fails if bucket name does not start or end with lowercase character or number', () => {
    const stack = new cdk.Stack();

    expect(() => new s3.Bucket(stack, 'MyBucket1', {
      bucketName: '-ucket',
    })).toThrow(/offset: 0/);

    expect(() => new s3.Bucket(stack, 'MyBucket2', {
      bucketName: 'bucke.',
    })).toThrow(/offset: 5/);
  });

  test('fails only if bucket name has the consecutive symbols (..), (.-), (-.)', () => {
    const stack = new cdk.Stack();

    expect(() => new s3.Bucket(stack, 'MyBucket1', {
      bucketName: 'buc..ket',
    })).toThrow(/offset: 3/);

    expect(() => new s3.Bucket(stack, 'MyBucket2', {
      bucketName: 'buck.-et',
    })).toThrow(/offset: 4/);

    expect(() => new s3.Bucket(stack, 'MyBucket3', {
      bucketName: 'b-.ucket',
    })).toThrow(/offset: 1/);

    expect(() => new s3.Bucket(stack, 'MyBucket4', {
      bucketName: 'bu--cket',
    })).not.toThrow();
  });

  test('fails only if bucket name resembles IP address', () => {
    const stack = new cdk.Stack();

    expect(() => new s3.Bucket(stack, 'MyBucket1', {
      bucketName: '1.2.3.4',
    })).toThrow(/must not resemble an IP address/);

    expect(() => new s3.Bucket(stack, 'MyBucket2', {
      bucketName: '1.2.3',
    })).not.toThrow();

    expect(() => new s3.Bucket(stack, 'MyBucket3', {
      bucketName: '1.2.3.a',
    })).not.toThrow();

    expect(() => new s3.Bucket(stack, 'MyBucket4', {
      bucketName: '1000.2.3.4',
    })).not.toThrow();
  });

  test('fails if encryption key is used with managed encryption', () => {
    const stack = new cdk.Stack();
    const myKey = new kms.Key(stack, 'MyKey');

    expect(() => new s3.Bucket(stack, 'MyBucket', {
      encryption: s3.BucketEncryption.KMS_MANAGED,
      encryptionKey: myKey,
    })).toThrow(/encryptionKey is specified, so 'encryption' must be set to KMS/);
  });

  test('fails if encryption key is used with encryption set to unencrypted', () => {
    const stack = new cdk.Stack();
    const myKey = new kms.Key(stack, 'MyKey');

    expect(() => new s3.Bucket(stack, 'MyBucket', {
      encryption: s3.BucketEncryption.UNENCRYPTED,
      encryptionKey: myKey,
    })).toThrow(/encryptionKey is specified, so 'encryption' must be set to KMS/);
  });

  test('encryptionKey can specify kms key', () => {
    const stack = new cdk.Stack();

    const encryptionKey = new kms.Key(stack, 'MyKey', { description: 'hello, world' });

    new s3.Bucket(stack, 'MyBucket', { encryptionKey, encryption: s3.BucketEncryption.KMS });

    expect(stack).toHaveResource('AWS::KMS::Key');

    expect(stack).toHaveResource('AWS::S3::Bucket', {
      'BucketEncryption': {
        'ServerSideEncryptionConfiguration': [
          {
            'ServerSideEncryptionByDefault': {
              'KMSMasterKeyID': {
                'Fn::GetAtt': [
                  'MyKey6AB29FA6',
                  'Arn',
                ],
              },
              'SSEAlgorithm': 'aws:kms',
            },
          },
        ],
      },
    });
  });

  test('enforceSsl can be enabled', () => {
    const stack = new cdk.Stack();
    new s3.Bucket(stack, 'MyBucket', { enforceSSL: true });

    expect(stack).toMatchTemplate({
      'Resources': {
        'MyBucketF68F3FF0': {
          'Type': 'AWS::S3::Bucket',
          'UpdateReplacePolicy': 'Retain',
          'DeletionPolicy': 'Retain',
        },
        'MyBucketPolicyE7FBAC7B': {
          'Type': 'AWS::S3::BucketPolicy',
          'Properties': {
            'Bucket': {
              'Ref': 'MyBucketF68F3FF0',
            },
            'PolicyDocument': {
              'Statement': [
                {
                  'Action': 's3:*',
                  'Condition': {
                    'Bool': {
                      'aws:SecureTransport': 'false',
                    },
                  },
                  'Effect': 'Deny',
                  'Principal': '*',
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
                          '/*',
                        ],
                      ],
                    },
                  ],
                },
              ],
              'Version': '2012-10-17',
            },
          },
        },
      },
    });
  });

  test('bucketKeyEnabled can be enabled', () => {
    const stack = new cdk.Stack();

    new s3.Bucket(stack, 'MyBucket', { bucketKeyEnabled: true, encryption: s3.BucketEncryption.KMS });

    expect(stack).toHaveResource('AWS::S3::Bucket', {
      'BucketEncryption': {
        'ServerSideEncryptionConfiguration': [
          {
            'BucketKeyEnabled': true,
            'ServerSideEncryptionByDefault': {
              'KMSMasterKeyID': {
                'Fn::GetAtt': [
                  'MyBucketKeyC17130CF',
                  'Arn',
                ],
              },
              'SSEAlgorithm': 'aws:kms',
            },
          },
        ],
      },
    });
  });

  test('throws error if bucketKeyEnabled is set, but encryption is not KMS', () => {
    const stack = new cdk.Stack();

    expect(() => {
      new s3.Bucket(stack, 'MyBucket', { bucketKeyEnabled: true, encryption: s3.BucketEncryption.S3_MANAGED });
    }).toThrow("bucketKeyEnabled is specified, so 'encryption' must be set to KMS (value: S3MANAGED)");
    expect(() => {
      new s3.Bucket(stack, 'MyBucket3', { bucketKeyEnabled: true });
    }).toThrow("bucketKeyEnabled is specified, so 'encryption' must be set to KMS (value: NONE)");
  });

  test('bucket with versioning turned on', () => {
    const stack = new cdk.Stack();
    new s3.Bucket(stack, 'MyBucket', {
      versioned: true,
    });

    expect(stack).toMatchTemplate({
      'Resources': {
        'MyBucketF68F3FF0': {
          'Type': 'AWS::S3::Bucket',
          'Properties': {
            'VersioningConfiguration': {
              'Status': 'Enabled',
            },
          },
          'DeletionPolicy': 'Retain',
          'UpdateReplacePolicy': 'Retain',
        },
      },
    });
  });

  test('bucket with block public access set to BlockAll', () => {
    const stack = new cdk.Stack();
    new s3.Bucket(stack, 'MyBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    expect(stack).toMatchTemplate({
      'Resources': {
        'MyBucketF68F3FF0': {
          'Type': 'AWS::S3::Bucket',
          'Properties': {
            'PublicAccessBlockConfiguration': {
              'BlockPublicAcls': true,
              'BlockPublicPolicy': true,
              'IgnorePublicAcls': true,
              'RestrictPublicBuckets': true,
            },
          },
          'DeletionPolicy': 'Retain',
          'UpdateReplacePolicy': 'Retain',
        },
      },
    });
  });

  test('bucket with block public access set to BlockAcls', () => {
    const stack = new cdk.Stack();
    new s3.Bucket(stack, 'MyBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
    });

    expect(stack).toMatchTemplate({
      'Resources': {
        'MyBucketF68F3FF0': {
          'Type': 'AWS::S3::Bucket',
          'Properties': {
            'PublicAccessBlockConfiguration': {
              'BlockPublicAcls': true,
              'IgnorePublicAcls': true,
            },
          },
          'DeletionPolicy': 'Retain',
          'UpdateReplacePolicy': 'Retain',
        },
      },
    });
  });

  test('bucket with custom block public access setting', () => {
    const stack = new cdk.Stack();
    new s3.Bucket(stack, 'MyBucket', {
      blockPublicAccess: new s3.BlockPublicAccess({ restrictPublicBuckets: true }),
    });

    expect(stack).toMatchTemplate({
      'Resources': {
        'MyBucketF68F3FF0': {
          'Type': 'AWS::S3::Bucket',
          'Properties': {
            'PublicAccessBlockConfiguration': {
              'RestrictPublicBuckets': true,
            },
          },
          'DeletionPolicy': 'Retain',
          'UpdateReplacePolicy': 'Retain',
        },
      },
    });
  });

  test('bucket with custom canned access control', () => {
    const stack = new cdk.Stack();
    new s3.Bucket(stack, 'MyBucket', {
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
    });

    expect(stack).toMatchTemplate({
      'Resources': {
        'MyBucketF68F3FF0': {
          'Type': 'AWS::S3::Bucket',
          'Properties': {
            'AccessControl': 'LogDeliveryWrite',
          },
          'DeletionPolicy': 'Retain',
          'UpdateReplacePolicy': 'Retain',
        },
      },
    });
  });

  describe('permissions', () => {
    test('addPermission creates a bucket policy', () => {
      const stack = new cdk.Stack();
      const bucket = new s3.Bucket(stack, 'MyBucket', { encryption: s3.BucketEncryption.UNENCRYPTED });

      bucket.addToResourcePolicy(new iam.PolicyStatement({
        resources: ['foo'],
        actions: ['bar:baz'],
        principals: [new iam.AnyPrincipal()],
      }));

      expect(stack).toMatchTemplate({
        'Resources': {
          'MyBucketF68F3FF0': {
            'Type': 'AWS::S3::Bucket',
            'DeletionPolicy': 'Retain',
            'UpdateReplacePolicy': 'Retain',
          },
          'MyBucketPolicyE7FBAC7B': {
            'Type': 'AWS::S3::BucketPolicy',
            'Properties': {
              'Bucket': {
                'Ref': 'MyBucketF68F3FF0',
              },
              'PolicyDocument': {
                'Statement': [
                  {
                    'Action': 'bar:baz',
                    'Effect': 'Allow',
                    'Principal': '*',
                    'Resource': 'foo',
                  },
                ],
                'Version': '2012-10-17',
              },
            },
          },
        },
      });
    });

    test('forBucket returns a permission statement associated with the bucket\'s ARN', () => {
      const stack = new cdk.Stack();

      const bucket = new s3.Bucket(stack, 'MyBucket', { encryption: s3.BucketEncryption.UNENCRYPTED });

      const x = new iam.PolicyStatement({
        resources: [bucket.bucketArn],
        actions: ['s3:ListBucket'],
        principals: [new iam.AnyPrincipal()],
      });

      expect(stack.resolve(x.toStatementJson())).toEqual({
        Action: 's3:ListBucket',
        Effect: 'Allow',
        Principal: '*',
        Resource: { 'Fn::GetAtt': ['MyBucketF68F3FF0', 'Arn'] },
      });
    });

    test('arnForObjects returns a permission statement associated with objects in the bucket', () => {
      const stack = new cdk.Stack();

      const bucket = new s3.Bucket(stack, 'MyBucket', { encryption: s3.BucketEncryption.UNENCRYPTED });

      const p = new iam.PolicyStatement({
        resources: [bucket.arnForObjects('hello/world')],
        actions: ['s3:GetObject'],
        principals: [new iam.AnyPrincipal()],
      });

      expect(stack.resolve(p.toStatementJson())).toEqual({
        Action: 's3:GetObject',
        Effect: 'Allow',
        Principal: '*',
        Resource: {
          'Fn::Join': [
            '',
            [{ 'Fn::GetAtt': ['MyBucketF68F3FF0', 'Arn'] }, '/hello/world'],
          ],
        },
      });
    });

    test('arnForObjects accepts multiple arguments and FnConcats them', () => {
      const stack = new cdk.Stack();

      const bucket = new s3.Bucket(stack, 'MyBucket', { encryption: s3.BucketEncryption.UNENCRYPTED });

      const user = new iam.User(stack, 'MyUser');
      const team = new iam.Group(stack, 'MyTeam');

      const resource = bucket.arnForObjects(`home/${team.groupName}/${user.userName}/*`);
      const p = new iam.PolicyStatement({
        resources: [resource],
        actions: ['s3:GetObject'],
        principals: [new iam.AnyPrincipal()],
      });

      expect(stack.resolve(p.toStatementJson())).toEqual({
        Action: 's3:GetObject',
        Effect: 'Allow',
        Principal: '*',
        Resource: {
          'Fn::Join': [
            '',
            [
              { 'Fn::GetAtt': ['MyBucketF68F3FF0', 'Arn'] },
              '/home/',
              { Ref: 'MyTeam01DD6685' },
              '/',
              { Ref: 'MyUserDC45028B' },
              '/*',
            ],
          ],
        },
      });
    });
  });

  test('removal policy can be used to specify behavior upon delete', () => {
    const stack = new cdk.Stack();
    new s3.Bucket(stack, 'MyBucket', {
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: s3.BucketEncryption.UNENCRYPTED,
    });

    expect(stack).toMatchTemplate({
      Resources: {
        MyBucketF68F3FF0: {
          Type: 'AWS::S3::Bucket',
          DeletionPolicy: 'Retain',
          UpdateReplacePolicy: 'Retain',
        },
      },
    });
  });

  describe('import/export', () => {
    test('static import(ref) allows importing an external/existing bucket', () => {
      const stack = new cdk.Stack();

      const bucketArn = 'arn:aws:s3:::my-bucket';
      const bucket = s3.Bucket.fromBucketAttributes(stack, 'ImportedBucket', { bucketArn });

      // this is a no-op since the bucket is external
      bucket.addToResourcePolicy(new iam.PolicyStatement({
        resources: ['foo'],
        actions: ['bar:baz'],
        principals: [new iam.AnyPrincipal()],
      }));

      const p = new iam.PolicyStatement({
        resources: [bucket.bucketArn],
        actions: ['s3:ListBucket'],
        principals: [new iam.AnyPrincipal()],
      });

      // it is possible to obtain a permission statement for a ref
      expect(p.toStatementJson()).toEqual({
        Action: 's3:ListBucket',
        Effect: 'Allow',
        Principal: '*',
        Resource: 'arn:aws:s3:::my-bucket',
      });

      expect(bucket.bucketArn).toEqual(bucketArn);
      expect(stack.resolve(bucket.bucketName)).toEqual('my-bucket');

      expect(SynthUtils.synthesize(stack).template).toEqual({});
    });

    test('import does not create any resources', () => {
      const stack = new cdk.Stack();
      const bucket = s3.Bucket.fromBucketAttributes(stack, 'ImportedBucket', { bucketArn: 'arn:aws:s3:::my-bucket' });
      bucket.addToResourcePolicy(new iam.PolicyStatement({
        resources: ['*'],
        actions: ['*'],
        principals: [new iam.AnyPrincipal()],
      }));

      // at this point we technically didn't create any resources in the consuming stack.
      expect(stack).toMatchTemplate({});
    });

    test('import can also be used to import arbitrary ARNs', () => {
      const stack = new cdk.Stack();
      const bucket = s3.Bucket.fromBucketAttributes(stack, 'ImportedBucket', { bucketArn: 'arn:aws:s3:::my-bucket' });
      bucket.addToResourcePolicy(new iam.PolicyStatement({ resources: ['*'], actions: ['*'] }));

      // but now we can reference the bucket
      // you can even use the bucket name, which will be extracted from the arn provided.
      const user = new iam.User(stack, 'MyUser');
      user.addToPolicy(new iam.PolicyStatement({
        resources: [bucket.arnForObjects(`my/folder/${bucket.bucketName}`)],
        actions: ['s3:*'],
      }));

      expect(stack).toMatchTemplate({
        'Resources': {
          'MyUserDC45028B': {
            'Type': 'AWS::IAM::User',
          },
          'MyUserDefaultPolicy7B897426': {
            'Type': 'AWS::IAM::Policy',
            'Properties': {
              'PolicyDocument': {
                'Statement': [
                  {
                    'Action': 's3:*',
                    'Effect': 'Allow',
                    'Resource': 'arn:aws:s3:::my-bucket/my/folder/my-bucket',
                  },
                ],
                'Version': '2012-10-17',
              },
              'PolicyName': 'MyUserDefaultPolicy7B897426',
              'Users': [
                {
                  'Ref': 'MyUserDC45028B',
                },
              ],
            },
          },
        },
      });
    });

    test('import can explicitly set bucket region', () => {
      const stack = new cdk.Stack(undefined, undefined, {
        env: { region: 'us-east-1' },
      });

      const bucket = s3.Bucket.fromBucketAttributes(stack, 'ImportedBucket', {
        bucketName: 'myBucket',
        region: 'eu-west-1',
      });

      expect(bucket.bucketRegionalDomainName).toEqual(`myBucket.s3.eu-west-1.${stack.urlSuffix}`);
      expect(bucket.bucketWebsiteDomainName).toEqual(`myBucket.s3-website-eu-west-1.${stack.urlSuffix}`);
    });
  });

  test('grantRead', () => {
    const stack = new cdk.Stack();
    const reader = new iam.User(stack, 'Reader');
    const bucket = new s3.Bucket(stack, 'MyBucket');
    bucket.grantRead(reader);
    expect(stack).toMatchTemplate({
      'Resources': {
        'ReaderF7BF189D': {
          'Type': 'AWS::IAM::User',
        },
        'ReaderDefaultPolicy151F3818': {
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
                          '/*',
                        ],
                      ],
                    },
                  ],
                },
              ],
              'Version': '2012-10-17',
            },
            'PolicyName': 'ReaderDefaultPolicy151F3818',
            'Users': [
              {
                'Ref': 'ReaderF7BF189D',
              },
            ],
          },
        },
        'MyBucketF68F3FF0': {
          'Type': 'AWS::S3::Bucket',
          'DeletionPolicy': 'Retain',
          'UpdateReplacePolicy': 'Retain',
        },
      },
    });
  });

  describe('grantReadWrite', () => {
    testFutureBehavior('can be used to grant reciprocal permissions to an identity', s3GrantWriteCtx, cdk.App, (app) => {
      const stack = new cdk.Stack(app);
      const bucket = new s3.Bucket(stack, 'MyBucket');
      const user = new iam.User(stack, 'MyUser');
      bucket.grantReadWrite(user);

      expect(stack).toMatchTemplate({
        'Resources': {
          'MyBucketF68F3FF0': {
            'Type': 'AWS::S3::Bucket',
            'DeletionPolicy': 'Retain',
            'UpdateReplacePolicy': 'Retain',
          },
          'MyUserDC45028B': {
            'Type': 'AWS::IAM::User',
          },
          'MyUserDefaultPolicy7B897426': {
            'Type': 'AWS::IAM::Policy',
            'Properties': {
              'PolicyDocument': {
                'Statement': [
                  {
                    'Action': [
                      's3:GetObject*',
                      's3:GetBucket*',
                      's3:List*',
                      's3:DeleteObject*',
                      's3:PutObject',
                      's3:Abort*',
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
                            '/*',
                          ],
                        ],
                      },
                    ],
                  },
                ],
                'Version': '2012-10-17',
              },
              'PolicyName': 'MyUserDefaultPolicy7B897426',
              'Users': [
                {
                  'Ref': 'MyUserDC45028B',
                },
              ],
            },
          },
        },
      });
    });

    test('grant permissions to non-identity principal', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const bucket = new s3.Bucket(stack, 'MyBucket', { encryption: s3.BucketEncryption.KMS });

      // WHEN
      bucket.grantRead(new iam.OrganizationPrincipal('o-1234'));

      // THEN
      expect(stack).toHaveResource('AWS::S3::BucketPolicy', {
        PolicyDocument: {
          'Version': '2012-10-17',
          'Statement': [
            {
              'Action': ['s3:GetObject*', 's3:GetBucket*', 's3:List*'],
              'Condition': { 'StringEquals': { 'aws:PrincipalOrgID': 'o-1234' } },
              'Effect': 'Allow',
              'Principal': '*',
              'Resource': [
                { 'Fn::GetAtt': ['MyBucketF68F3FF0', 'Arn'] },
                { 'Fn::Join': ['', [{ 'Fn::GetAtt': ['MyBucketF68F3FF0', 'Arn'] }, '/*']] },
              ],
            },
          ],
        },
      });

      expect(stack).toHaveResourceLike('AWS::KMS::Key', {
        'KeyPolicy': {
          'Statement': arrayWith(
            {
              'Action': ['kms:Decrypt', 'kms:DescribeKey'],
              'Effect': 'Allow',
              'Resource': '*',
              'Principal': '*',
              'Condition': { 'StringEquals': { 'aws:PrincipalOrgID': 'o-1234' } },
            },
          ),
          'Version': '2012-10-17',
        },

      });
    });

    testLegacyBehavior('if an encryption key is included, encrypt/decrypt permissions are also added both ways', cdk.App, (app) => {
      const stack = new cdk.Stack(app);
      const bucket = new s3.Bucket(stack, 'MyBucket', { encryption: s3.BucketEncryption.KMS });
      const user = new iam.User(stack, 'MyUser');
      bucket.grantReadWrite(user);

      expect(stack).toMatchTemplate({
        'Resources': {
          'MyBucketKeyC17130CF': {
            'Type': 'AWS::KMS::Key',
            'Properties': {
              'Description': 'Created by Default/MyBucket',
              'KeyPolicy': {
                'Statement': [
                  {
                    'Action': [
                      'kms:Create*',
                      'kms:Describe*',
                      'kms:Enable*',
                      'kms:List*',
                      'kms:Put*',
                      'kms:Update*',
                      'kms:Revoke*',
                      'kms:Disable*',
                      'kms:Get*',
                      'kms:Delete*',
                      'kms:ScheduleKeyDeletion',
                      'kms:CancelKeyDeletion',
                      'kms:GenerateDataKey',
                      'kms:TagResource',
                      'kms:UntagResource',
                    ],
                    'Effect': 'Allow',
                    'Principal': {
                      'AWS': {
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
                            ':root',
                          ],
                        ],
                      },
                    },
                    'Resource': '*',
                  },
                  {
                    'Action': [
                      'kms:Decrypt',
                      'kms:DescribeKey',
                      'kms:Encrypt',
                      'kms:ReEncrypt*',
                      'kms:GenerateDataKey*',
                    ],
                    'Effect': 'Allow',
                    'Principal': {
                      'AWS': {
                        'Fn::GetAtt': [
                          'MyUserDC45028B',
                          'Arn',
                        ],
                      },
                    },
                    'Resource': '*',
                  },
                ],
                'Version': '2012-10-17',
              },
            },
            'DeletionPolicy': 'Retain',
            'UpdateReplacePolicy': 'Retain',
          },
          'MyBucketF68F3FF0': {
            'Type': 'AWS::S3::Bucket',
            'DeletionPolicy': 'Retain',
            'UpdateReplacePolicy': 'Retain',
            'Properties': {
              'BucketEncryption': {
                'ServerSideEncryptionConfiguration': [
                  {
                    'ServerSideEncryptionByDefault': {
                      'KMSMasterKeyID': {
                        'Fn::GetAtt': [
                          'MyBucketKeyC17130CF',
                          'Arn',
                        ],
                      },
                      'SSEAlgorithm': 'aws:kms',
                    },
                  },
                ],
              },
            },
          },
          'MyUserDC45028B': {
            'Type': 'AWS::IAM::User',
          },
          'MyUserDefaultPolicy7B897426': {
            'Type': 'AWS::IAM::Policy',
            'Properties': {
              'PolicyDocument': {
                'Statement': [
                  {
                    'Action': [
                      's3:GetObject*',
                      's3:GetBucket*',
                      's3:List*',
                      's3:DeleteObject*',
                      's3:PutObject*',
                      's3:Abort*',
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
                      'kms:Encrypt',
                      'kms:ReEncrypt*',
                      'kms:GenerateDataKey*',
                    ],
                    'Effect': 'Allow',
                    'Resource': {
                      'Fn::GetAtt': [
                        'MyBucketKeyC17130CF',
                        'Arn',
                      ],
                    },
                  },
                ],
                'Version': '2012-10-17',
              },
              'PolicyName': 'MyUserDefaultPolicy7B897426',
              'Users': [
                {
                  'Ref': 'MyUserDC45028B',
                },
              ],
            },
          },
        },
      });
    });

    testFutureBehavior('does not grant PutObjectAcl when the S3_GRANT_WRITE_WITHOUT_ACL feature is enabled', s3GrantWriteCtx, cdk.App, (app) => {
      const stack = new cdk.Stack(app, 'Stack');
      const bucket = new s3.Bucket(stack, 'MyBucket');
      const user = new iam.User(stack, 'MyUser');

      bucket.grantReadWrite(user);

      expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
        'PolicyDocument': {
          'Statement': [
            {
              'Action': [
                's3:GetObject*',
                's3:GetBucket*',
                's3:List*',
                's3:DeleteObject*',
                's3:PutObject',
                's3:Abort*',
              ],
              'Resource': [
                { 'Fn::GetAtt': ['MyBucketF68F3FF0', 'Arn'] },
                {
                  'Fn::Join': ['', [
                    { 'Fn::GetAtt': ['MyBucketF68F3FF0', 'Arn'] },
                    '/*',
                  ]],
                },
              ],
            },
          ],
        },
      });
    });
  });

  describe('grantWrite', () => {
    testFutureBehavior('with KMS key has appropriate permissions for multipart uploads', s3GrantWriteCtx, cdk.App, (app) => {
      const stack = new cdk.Stack(app);
      const bucket = new s3.Bucket(stack, 'MyBucket', { encryption: s3.BucketEncryption.KMS });
      const user = new iam.User(stack, 'MyUser');
      bucket.grantWrite(user);

      expect(stack).toHaveResource('AWS::IAM::Policy', {
        'PolicyDocument': {
          'Statement': [
            {
              'Action': [
                's3:DeleteObject*',
                's3:PutObject',
                's3:Abort*',
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
                      '/*',
                    ],
                  ],
                },
              ],
            },
            {
              'Action': [
                'kms:Encrypt',
                'kms:ReEncrypt*',
                'kms:GenerateDataKey*',
                'kms:Decrypt',
              ],
              'Effect': 'Allow',
              'Resource': {
                'Fn::GetAtt': [
                  'MyBucketKeyC17130CF',
                  'Arn',
                ],
              },
            },
          ],
          'Version': '2012-10-17',
        },
        'PolicyName': 'MyUserDefaultPolicy7B897426',
        'Users': [
          {
            'Ref': 'MyUserDC45028B',
          },
        ],
      });
    });

    testFutureBehavior('does not grant PutObjectAcl when the S3_GRANT_WRITE_WITHOUT_ACL feature is enabled', s3GrantWriteCtx, cdk.App, (app) => {
      const stack = new cdk.Stack(app, 'Stack');
      const bucket = new s3.Bucket(stack, 'MyBucket');
      const user = new iam.User(stack, 'MyUser');

      bucket.grantWrite(user);

      expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
        'PolicyDocument': {
          'Statement': [
            {
              'Action': [
                's3:DeleteObject*',
                's3:PutObject',
                's3:Abort*',
              ],
              'Resource': [
                { 'Fn::GetAtt': ['MyBucketF68F3FF0', 'Arn'] },
                {
                  'Fn::Join': ['', [
                    { 'Fn::GetAtt': ['MyBucketF68F3FF0', 'Arn'] },
                    '/*',
                  ]],
                },
              ],
            },
          ],
        },
      });
    });
  });

  describe('grantPut', () => {
    testFutureBehavior('does not grant PutObjectAcl when the S3_GRANT_WRITE_WITHOUT_ACL feature is enabled', s3GrantWriteCtx, cdk.App, (app) => {
      const stack = new cdk.Stack(app, 'Stack');
      const bucket = new s3.Bucket(stack, 'MyBucket');
      const user = new iam.User(stack, 'MyUser');

      bucket.grantPut(user);

      expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
        'PolicyDocument': {
          'Statement': [
            {
              'Action': [
                's3:PutObject',
                's3:Abort*',
              ],
              'Resource': {
                'Fn::Join': ['', [
                  { 'Fn::GetAtt': ['MyBucketF68F3FF0', 'Arn'] },
                  '/*',
                ]],
              },
            },
          ],
        },
      });
    });
  });

  testFutureBehavior('more grants', s3GrantWriteCtx, cdk.App, (app) => {
    const stack = new cdk.Stack(app);
    const bucket = new s3.Bucket(stack, 'MyBucket', { encryption: s3.BucketEncryption.KMS });
    const putter = new iam.User(stack, 'Putter');
    const writer = new iam.User(stack, 'Writer');
    const deleter = new iam.User(stack, 'Deleter');

    bucket.grantPut(putter);
    bucket.grantWrite(writer);
    bucket.grantDelete(deleter);

    const resources = SynthUtils.synthesize(stack).template.Resources;
    const actions = (id: string) => resources[id].Properties.PolicyDocument.Statement[0].Action;

    expect(actions('WriterDefaultPolicyDC585BCE')).toEqual(['s3:DeleteObject*', 's3:PutObject', 's3:Abort*']);
    expect(actions('PutterDefaultPolicyAB138DD3')).toEqual(['s3:PutObject', 's3:Abort*']);
    expect(actions('DeleterDefaultPolicyCD33B8A0')).toEqual('s3:DeleteObject*');
  });

  test('grantDelete, with a KMS Key', () => {
    // given
    const stack = new cdk.Stack();
    const key = new kms.Key(stack, 'MyKey');
    const deleter = new iam.User(stack, 'Deleter');
    const bucket = new s3.Bucket(stack, 'MyBucket', {
      bucketName: 'my-bucket-physical-name',
      encryptionKey: key,
      encryption: s3.BucketEncryption.KMS,
    });

    // when
    bucket.grantDelete(deleter);

    // then
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      'PolicyDocument': {
        'Statement': [
          {
            'Action': 's3:DeleteObject*',
            'Effect': 'Allow',
            'Resource': {
              'Fn::Join': [
                '',
                [
                  {
                    'Fn::GetAtt': [
                      'MyBucketF68F3FF0',
                      'Arn',
                    ],
                  },
                  '/*',
                ],
              ],
            },
          },
        ],
        'Version': '2012-10-17',
      },
    });
  });

  describe('cross-stack permissions', () => {
    test('in the same account and region', () => {
      const app = new cdk.App();
      const stackA = new cdk.Stack(app, 'stackA');
      const bucketFromStackA = new s3.Bucket(stackA, 'MyBucket');

      const stackB = new cdk.Stack(app, 'stackB');
      const user = new iam.User(stackB, 'UserWhoNeedsAccess');
      bucketFromStackA.grantRead(user);

      expect(stackA).toMatchTemplate({
        'Resources': {
          'MyBucketF68F3FF0': {
            'Type': 'AWS::S3::Bucket',
            'DeletionPolicy': 'Retain',
            'UpdateReplacePolicy': 'Retain',
          },
        },
        'Outputs': {
          'ExportsOutputFnGetAttMyBucketF68F3FF0Arn0F7E8E58': {
            'Value': {
              'Fn::GetAtt': [
                'MyBucketF68F3FF0',
                'Arn',
              ],
            },
            'Export': {
              'Name': 'stackA:ExportsOutputFnGetAttMyBucketF68F3FF0Arn0F7E8E58',
            },
          },
        },
      });

      expect(stackB).toMatchTemplate({
        'Resources': {
          'UserWhoNeedsAccessF8959C3D': {
            'Type': 'AWS::IAM::User',
          },
          'UserWhoNeedsAccessDefaultPolicy6A9EB530': {
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
                        'Fn::ImportValue': 'stackA:ExportsOutputFnGetAttMyBucketF68F3FF0Arn0F7E8E58',
                      },
                      {
                        'Fn::Join': [
                          '',
                          [
                            {
                              'Fn::ImportValue': 'stackA:ExportsOutputFnGetAttMyBucketF68F3FF0Arn0F7E8E58',
                            },
                            '/*',
                          ],
                        ],
                      },
                    ],
                  },
                ],
                'Version': '2012-10-17',
              },
              'PolicyName': 'UserWhoNeedsAccessDefaultPolicy6A9EB530',
              'Users': [
                {
                  'Ref': 'UserWhoNeedsAccessF8959C3D',
                },
              ],
            },
          },
        },
      });
    });

    test('in different accounts', () => {
      // given
      const stackA = new cdk.Stack(undefined, 'StackA', { env: { account: '123456789012' } });
      const bucketFromStackA = new s3.Bucket(stackA, 'MyBucket', {
        bucketName: 'my-bucket-physical-name',
      });

      const stackB = new cdk.Stack(undefined, 'StackB', { env: { account: '234567890123' } });
      const roleFromStackB = new iam.Role(stackB, 'MyRole', {
        assumedBy: new iam.AccountPrincipal('234567890123'),
        roleName: 'MyRolePhysicalName',
      });

      // when
      bucketFromStackA.grantRead(roleFromStackB);

      // then
      expect(stackA).toHaveResourceLike('AWS::S3::BucketPolicy', {
        'PolicyDocument': {
          'Statement': [
            {
              'Action': [
                's3:GetObject*',
                's3:GetBucket*',
                's3:List*',
              ],
              'Effect': 'Allow',
              'Principal': {
                'AWS': {
                  'Fn::Join': [
                    '',
                    [
                      'arn:',
                      {
                        'Ref': 'AWS::Partition',
                      },
                      ':iam::234567890123:role/MyRolePhysicalName',
                    ],
                  ],
                },
              },
            },
          ],
        },
      });

      expect(stackB).toHaveResourceLike('AWS::IAM::Policy', {
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
                  'Fn::Join': [
                    '',
                    [
                      'arn:',
                      {
                        'Ref': 'AWS::Partition',
                      },
                      ':s3:::my-bucket-physical-name',
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
                      ':s3:::my-bucket-physical-name/*',
                    ],
                  ],
                },
              ],
            },
          ],
        },
      });
    });

    test('in different accounts, with a KMS Key', () => {
      // given
      const stackA = new cdk.Stack(undefined, 'StackA', { env: { account: '123456789012' } });
      const key = new kms.Key(stackA, 'MyKey');
      const bucketFromStackA = new s3.Bucket(stackA, 'MyBucket', {
        bucketName: 'my-bucket-physical-name',
        encryptionKey: key,
        encryption: s3.BucketEncryption.KMS,
      });

      const stackB = new cdk.Stack(undefined, 'StackB', { env: { account: '234567890123' } });
      const roleFromStackB = new iam.Role(stackB, 'MyRole', {
        assumedBy: new iam.AccountPrincipal('234567890123'),
        roleName: 'MyRolePhysicalName',
      });

      // when
      bucketFromStackA.grantRead(roleFromStackB);

      // then
      expect(stackA).toHaveResourceLike('AWS::KMS::Key', {
        'KeyPolicy': {
          'Statement': [
            {
              // grant to the root of the owning account
            },
            {
              'Action': [
                'kms:Decrypt',
                'kms:DescribeKey',
              ],
              'Effect': 'Allow',
              'Principal': {
                'AWS': {
                  'Fn::Join': [
                    '',
                    [
                      'arn:',
                      {
                        'Ref': 'AWS::Partition',
                      },
                      ':iam::234567890123:role/MyRolePhysicalName',
                    ],
                  ],
                },
              },
            },
          ],
        },
      });

      expect(stackB).toHaveResourceLike('AWS::IAM::Policy', {
        'PolicyDocument': {
          'Statement': [
            {
              // Bucket grant
            },
            {
              'Action': [
                'kms:Decrypt',
                'kms:DescribeKey',
              ],
              'Effect': 'Allow',
              'Resource': '*',
            },
          ],
        },
      });
    });
  });

  test('urlForObject returns a token with the S3 URL of the token', () => {
    const stack = new cdk.Stack();
    const bucket = new s3.Bucket(stack, 'MyBucket');
    const bucketWithRegion = s3.Bucket.fromBucketAttributes(stack, 'RegionalBucket', {
      bucketArn: 'arn:aws:s3:::explicit-region-bucket',
      region: 'us-west-2',
    });

    new cdk.CfnOutput(stack, 'BucketURL', { value: bucket.urlForObject() });
    new cdk.CfnOutput(stack, 'MyFileURL', { value: bucket.urlForObject('my/file.txt') });
    new cdk.CfnOutput(stack, 'YourFileURL', { value: bucket.urlForObject('/your/file.txt') }); // "/" is optional
    new cdk.CfnOutput(stack, 'RegionBucketURL', { value: bucketWithRegion.urlForObject() });

    expect(stack).toMatchTemplate({
      'Resources': {
        'MyBucketF68F3FF0': {
          'Type': 'AWS::S3::Bucket',
          'DeletionPolicy': 'Retain',
          'UpdateReplacePolicy': 'Retain',
        },
      },
      'Outputs': {
        'BucketURL': {
          'Value': {
            'Fn::Join': [
              '',
              [
                'https://s3.',
                {
                  'Ref': 'AWS::Region',
                },
                '.',
                {
                  'Ref': 'AWS::URLSuffix',
                },
                '/',
                {
                  'Ref': 'MyBucketF68F3FF0',
                },
              ],
            ],
          },
        },
        'MyFileURL': {
          'Value': {
            'Fn::Join': [
              '',
              [
                'https://s3.',
                {
                  'Ref': 'AWS::Region',
                },
                '.',
                {
                  'Ref': 'AWS::URLSuffix',
                },
                '/',
                {
                  'Ref': 'MyBucketF68F3FF0',
                },
                '/my/file.txt',
              ],
            ],
          },
        },
        'YourFileURL': {
          'Value': {
            'Fn::Join': [
              '',
              [
                'https://s3.',
                {
                  'Ref': 'AWS::Region',
                },
                '.',
                {
                  'Ref': 'AWS::URLSuffix',
                },
                '/',
                {
                  'Ref': 'MyBucketF68F3FF0',
                },
                '/your/file.txt',
              ],
            ],
          },
        },
        'RegionBucketURL': {
          'Value': {
            'Fn::Join': [
              '',
              [
                'https://s3.us-west-2.',
                {
                  'Ref': 'AWS::URLSuffix',
                },
                '/explicit-region-bucket',
              ],
            ],
          },
        },
      },
    });
  });

  test('s3UrlForObject returns a token with the S3 URL of the token', () => {
    const stack = new cdk.Stack();
    const bucket = new s3.Bucket(stack, 'MyBucket');

    new cdk.CfnOutput(stack, 'BucketS3URL', { value: bucket.s3UrlForObject() });
    new cdk.CfnOutput(stack, 'MyFileS3URL', { value: bucket.s3UrlForObject('my/file.txt') });
    new cdk.CfnOutput(stack, 'YourFileS3URL', { value: bucket.s3UrlForObject('/your/file.txt') }); // "/" is optional

    expect(stack).toMatchTemplate({
      'Resources': {
        'MyBucketF68F3FF0': {
          'Type': 'AWS::S3::Bucket',
          'DeletionPolicy': 'Retain',
          'UpdateReplacePolicy': 'Retain',
        },
      },
      'Outputs': {
        'BucketS3URL': {
          'Value': {
            'Fn::Join': [
              '',
              [
                's3://',
                {
                  'Ref': 'MyBucketF68F3FF0',
                },
              ],
            ],
          },
        },
        'MyFileS3URL': {
          'Value': {
            'Fn::Join': [
              '',
              [
                's3://',
                {
                  'Ref': 'MyBucketF68F3FF0',
                },
                '/my/file.txt',
              ],
            ],
          },
        },
        'YourFileS3URL': {
          'Value': {
            'Fn::Join': [
              '',
              [
                's3://',
                {
                  'Ref': 'MyBucketF68F3FF0',
                },
                '/your/file.txt',
              ],
            ],
          },
        },
      },
    });
  });

  describe('grantPublicAccess', () => {
    test('by default, grants s3:GetObject to all objects', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const bucket = new s3.Bucket(stack, 'b');

      // WHEN
      bucket.grantPublicAccess();

      // THEN
      expect(stack).toHaveResource('AWS::S3::BucketPolicy', {
        'PolicyDocument': {
          'Statement': [
            {
              'Action': 's3:GetObject',
              'Effect': 'Allow',
              'Principal': '*',
              'Resource': { 'Fn::Join': ['', [{ 'Fn::GetAtt': ['bC3BBCC65', 'Arn'] }, '/*']] },
            },
          ],
          'Version': '2012-10-17',
        },
      });
    });

    test('"keyPrefix" can be used to only grant access to certain objects', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const bucket = new s3.Bucket(stack, 'b');

      // WHEN
      bucket.grantPublicAccess('only/access/these/*');

      // THEN
      expect(stack).toHaveResource('AWS::S3::BucketPolicy', {
        'PolicyDocument': {
          'Statement': [
            {
              'Action': 's3:GetObject',
              'Effect': 'Allow',
              'Principal': '*',
              'Resource': { 'Fn::Join': ['', [{ 'Fn::GetAtt': ['bC3BBCC65', 'Arn'] }, '/only/access/these/*']] },
            },
          ],
          'Version': '2012-10-17',
        },
      });
    });

    test('"allowedActions" can be used to specify actions explicitly', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const bucket = new s3.Bucket(stack, 'b');

      // WHEN
      bucket.grantPublicAccess('*', 's3:GetObject', 's3:PutObject');

      // THEN
      expect(stack).toHaveResource('AWS::S3::BucketPolicy', {
        'PolicyDocument': {
          'Statement': [
            {
              'Action': ['s3:GetObject', 's3:PutObject'],
              'Effect': 'Allow',
              'Principal': '*',
              'Resource': { 'Fn::Join': ['', [{ 'Fn::GetAtt': ['bC3BBCC65', 'Arn'] }, '/*']] },
            },
          ],
          'Version': '2012-10-17',
        },
      });
    });

    test('returns the PolicyStatement which can be then customized', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const bucket = new s3.Bucket(stack, 'b');

      // WHEN
      const result = bucket.grantPublicAccess();
      result.resourceStatement!.addCondition('IpAddress', { 'aws:SourceIp': '54.240.143.0/24' });

      // THEN
      expect(stack).toHaveResource('AWS::S3::BucketPolicy', {
        'PolicyDocument': {
          'Statement': [
            {
              'Action': 's3:GetObject',
              'Effect': 'Allow',
              'Principal': '*',
              'Resource': { 'Fn::Join': ['', [{ 'Fn::GetAtt': ['bC3BBCC65', 'Arn'] }, '/*']] },
              'Condition': {
                'IpAddress': { 'aws:SourceIp': '54.240.143.0/24' },
              },
            },
          ],
          'Version': '2012-10-17',
        },
      });
    });

    test('throws when blockPublicPolicy is set to true', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const bucket = new s3.Bucket(stack, 'MyBucket', {
        blockPublicAccess: new s3.BlockPublicAccess({ blockPublicPolicy: true }),
      });

      // THEN
      expect(() => bucket.grantPublicAccess()).toThrow(/blockPublicPolicy/);
    });
  });

  describe('website configuration', () => {
    test('only index doc', () => {
      const stack = new cdk.Stack();
      new s3.Bucket(stack, 'Website', {
        websiteIndexDocument: 'index2.html',
      });
      expect(stack).toHaveResource('AWS::S3::Bucket', {
        WebsiteConfiguration: {
          IndexDocument: 'index2.html',
        },
      });
    });
    test('fails if only error doc is specified', () => {
      const stack = new cdk.Stack();
      expect(() => {
        new s3.Bucket(stack, 'Website', {
          websiteErrorDocument: 'error.html',
        });
      }).toThrow(/"websiteIndexDocument" is required if "websiteErrorDocument" is set/);
    });
    test('error and index docs', () => {
      const stack = new cdk.Stack();
      new s3.Bucket(stack, 'Website', {
        websiteIndexDocument: 'index2.html',
        websiteErrorDocument: 'error.html',
      });
      expect(stack).toHaveResource('AWS::S3::Bucket', {
        WebsiteConfiguration: {
          IndexDocument: 'index2.html',
          ErrorDocument: 'error.html',
        },
      });
    });
    test('exports the WebsiteURL', () => {
      const stack = new cdk.Stack();
      const bucket = new s3.Bucket(stack, 'Website', {
        websiteIndexDocument: 'index.html',
      });
      expect(stack.resolve(bucket.bucketWebsiteUrl)).toEqual({ 'Fn::GetAtt': ['Website32962D0B', 'WebsiteURL'] });
    });
    test('exports the WebsiteDomain', () => {
      const stack = new cdk.Stack();
      const bucket = new s3.Bucket(stack, 'Website', {
        websiteIndexDocument: 'index.html',
      });
      expect(stack.resolve(bucket.bucketWebsiteDomainName)).toEqual({
        'Fn::Select': [
          2,
          {
            'Fn::Split': ['/', { 'Fn::GetAtt': ['Website32962D0B', 'WebsiteURL'] }],
          },
        ],
      });
    });
    test('exports the WebsiteURL for imported buckets', () => {
      const stack = new cdk.Stack();
      const bucket = s3.Bucket.fromBucketName(stack, 'Website', 'my-test-bucket');
      expect(stack.resolve(bucket.bucketWebsiteUrl)).toEqual({
        'Fn::Join': [
          '',
          [
            'http://my-test-bucket.s3-website-',
            { Ref: 'AWS::Region' },
            '.',
            { Ref: 'AWS::URLSuffix' },
          ],
        ],
      });
      expect(stack.resolve(bucket.bucketWebsiteDomainName)).toEqual({
        'Fn::Join': [
          '',
          [
            'my-test-bucket.s3-website-',
            { Ref: 'AWS::Region' },
            '.',
            { Ref: 'AWS::URLSuffix' },
          ],
        ],
      });
    });
    test('exports the WebsiteURL for imported buckets with url', () => {
      const stack = new cdk.Stack();
      const bucket = s3.Bucket.fromBucketAttributes(stack, 'Website', {
        bucketName: 'my-test-bucket',
        bucketWebsiteUrl: 'http://my-test-bucket.my-test.suffix',
      });
      expect(stack.resolve(bucket.bucketWebsiteUrl)).toEqual('http://my-test-bucket.my-test.suffix');
      expect(stack.resolve(bucket.bucketWebsiteDomainName)).toEqual('my-test-bucket.my-test.suffix');
    });
    test('adds RedirectAllRequestsTo property', () => {
      const stack = new cdk.Stack();
      new s3.Bucket(stack, 'Website', {
        websiteRedirect: {
          hostName: 'www.example.com',
          protocol: s3.RedirectProtocol.HTTPS,
        },
      });
      expect(stack).toHaveResource('AWS::S3::Bucket', {
        WebsiteConfiguration: {
          RedirectAllRequestsTo: {
            HostName: 'www.example.com',
            Protocol: 'https',
          },
        },
      });
    });
    test('fails if websiteRedirect and websiteIndex and websiteError are specified', () => {
      const stack = new cdk.Stack();
      expect(() => {
        new s3.Bucket(stack, 'Website', {
          websiteIndexDocument: 'index.html',
          websiteErrorDocument: 'error.html',
          websiteRedirect: {
            hostName: 'www.example.com',
          },
        });
      }).toThrow(/"websiteIndexDocument", "websiteErrorDocument" and, "websiteRoutingRules" cannot be set if "websiteRedirect" is used/);
    });
    test('fails if websiteRedirect and websiteRoutingRules are specified', () => {
      const stack = new cdk.Stack();
      expect(() => {
        new s3.Bucket(stack, 'Website', {
          websiteRoutingRules: [],
          websiteRedirect: {
            hostName: 'www.example.com',
          },
        });
      }).toThrow(/"websiteIndexDocument", "websiteErrorDocument" and, "websiteRoutingRules" cannot be set if "websiteRedirect" is used/);
    });
    test('adds RedirectRules property', () => {
      const stack = new cdk.Stack();
      new s3.Bucket(stack, 'Website', {
        websiteRoutingRules: [{
          hostName: 'www.example.com',
          httpRedirectCode: '302',
          protocol: s3.RedirectProtocol.HTTPS,
          replaceKey: s3.ReplaceKey.prefixWith('test/'),
          condition: {
            httpErrorCodeReturnedEquals: '200',
            keyPrefixEquals: 'prefix',
          },
        }],
      });
      expect(stack).toHaveResource('AWS::S3::Bucket', {
        WebsiteConfiguration: {
          RoutingRules: [{
            RedirectRule: {
              HostName: 'www.example.com',
              HttpRedirectCode: '302',
              Protocol: 'https',
              ReplaceKeyPrefixWith: 'test/',
            },
            RoutingRuleCondition: {
              HttpErrorCodeReturnedEquals: '200',
              KeyPrefixEquals: 'prefix',
            },
          }],
        },
      });
    });
    test('fails if routingRule condition object is empty', () => {
      const stack = new cdk.Stack();
      expect(() => {
        new s3.Bucket(stack, 'Website', {
          websiteRoutingRules: [{
            httpRedirectCode: '303',
            condition: {},
          }],
        });
      }).toThrow(/The condition property cannot be an empty object/);
    });
    describe('isWebsite set properly with', () => {
      test('only index doc', () => {
        const stack = new cdk.Stack();
        const bucket = new s3.Bucket(stack, 'Website', {
          websiteIndexDocument: 'index2.html',
        });
        expect(bucket.isWebsite).toEqual(true);
      });
      test('error and index docs', () => {
        const stack = new cdk.Stack();
        const bucket = new s3.Bucket(stack, 'Website', {
          websiteIndexDocument: 'index2.html',
          websiteErrorDocument: 'error.html',
        });
        expect(bucket.isWebsite).toEqual(true);
      });
      test('redirects', () => {
        const stack = new cdk.Stack();
        const bucket = new s3.Bucket(stack, 'Website', {
          websiteRedirect: {
            hostName: 'www.example.com',
            protocol: s3.RedirectProtocol.HTTPS,
          },
        });
        expect(bucket.isWebsite).toEqual(true);
      });
      test('no website properties set', () => {
        const stack = new cdk.Stack();
        const bucket = new s3.Bucket(stack, 'Website');
        expect(bucket.isWebsite).toEqual(false);
      });
      test('imported website buckets', () => {
        const stack = new cdk.Stack();
        const bucket = s3.Bucket.fromBucketAttributes(stack, 'Website', {
          bucketArn: 'arn:aws:s3:::my-bucket',
          isWebsite: true,
        });
        expect(bucket.isWebsite).toEqual(true);
      });
      test('imported buckets', () => {
        const stack = new cdk.Stack();
        const bucket = s3.Bucket.fromBucketAttributes(stack, 'NotWebsite', {
          bucketArn: 'arn:aws:s3:::my-bucket',
        });
        expect(bucket.isWebsite).toEqual(false);
      });
    });
  });

  test('Bucket.fromBucketArn', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const bucket = s3.Bucket.fromBucketArn(stack, 'my-bucket', 'arn:aws:s3:::my_corporate_bucket');

    // THEN
    expect(bucket.bucketName).toEqual('my_corporate_bucket');
    expect(bucket.bucketArn).toEqual('arn:aws:s3:::my_corporate_bucket');
  });

  test('Bucket.fromBucketName', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const bucket = s3.Bucket.fromBucketName(stack, 'imported-bucket', 'my-bucket-name');

    // THEN
    expect(bucket.bucketName).toEqual('my-bucket-name');
    expect(stack.resolve(bucket.bucketArn)).toEqual({
      'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':s3:::my-bucket-name']],
    });
  });

  test('if a kms key is specified, it implies bucket is encrypted with kms (dah)', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const key = new kms.Key(stack, 'k');

    // THEN
    new s3.Bucket(stack, 'b', { encryptionKey: key });
  });

  test('Bucket with Server Access Logs', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const accessLogBucket = new s3.Bucket(stack, 'AccessLogs');
    new s3.Bucket(stack, 'MyBucket', {
      serverAccessLogsBucket: accessLogBucket,
    });

    // THEN
    expect(stack).toHaveResource('AWS::S3::Bucket', {
      LoggingConfiguration: {
        DestinationBucketName: {
          Ref: 'AccessLogs8B620ECA',
        },
      },
    });
  });

  test('Bucket with Server Access Logs with Prefix', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const accessLogBucket = new s3.Bucket(stack, 'AccessLogs');
    new s3.Bucket(stack, 'MyBucket', {
      serverAccessLogsBucket: accessLogBucket,
      serverAccessLogsPrefix: 'hello',
    });

    // THEN
    expect(stack).toHaveResource('AWS::S3::Bucket', {
      LoggingConfiguration: {
        DestinationBucketName: {
          Ref: 'AccessLogs8B620ECA',
        },
        LogFilePrefix: 'hello',
      },
    });
  });

  test('Access log prefix given without bucket', () => {
    // GIVEN
    const stack = new cdk.Stack();

    new s3.Bucket(stack, 'MyBucket', {
      serverAccessLogsPrefix: 'hello',
    });

    // THEN
    expect(stack).toHaveResource('AWS::S3::Bucket', {
      LoggingConfiguration: {
        LogFilePrefix: 'hello',
      },
    });
  });

  test('Bucket Allow Log delivery changes bucket Access Control should fail', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const accessLogBucket = new s3.Bucket(stack, 'AccessLogs', {
      accessControl: s3.BucketAccessControl.AUTHENTICATED_READ,
    });
    expect(() =>
      new s3.Bucket(stack, 'MyBucket', {
        serverAccessLogsBucket: accessLogBucket,
        serverAccessLogsPrefix: 'hello',
        accessControl: s3.BucketAccessControl.AUTHENTICATED_READ,
      }),
    ).toThrow(/Cannot enable log delivery to this bucket because the bucket's ACL has been set and can't be changed/);
  });

  test('Defaults for an inventory bucket', () => {
    // Given
    const stack = new cdk.Stack();

    const inventoryBucket = new s3.Bucket(stack, 'InventoryBucket');
    new s3.Bucket(stack, 'MyBucket', {
      inventories: [
        {
          destination: {
            bucket: inventoryBucket,
          },
        },
      ],
    });

    expect(stack).toHaveResourceLike('AWS::S3::Bucket', {
      InventoryConfigurations: [
        {
          Enabled: true,
          IncludedObjectVersions: 'All',
          ScheduleFrequency: 'Weekly',
          Destination: {
            Format: 'CSV',
            BucketArn: { 'Fn::GetAtt': ['InventoryBucketA869B8CB', 'Arn'] },
          },
          Id: 'MyBucketInventory0',
        },
      ],
    });

    expect(stack).toHaveResourceLike('AWS::S3::BucketPolicy', {
      Bucket: { Ref: 'InventoryBucketA869B8CB' },
      PolicyDocument: {
        Statement: arrayWith(objectLike({
          Action: 's3:PutObject',
          Principal: { Service: 's3.amazonaws.com' },
          Resource: [
            {
              'Fn::GetAtt': ['InventoryBucketA869B8CB', 'Arn'],
            },
            {
              'Fn::Join': ['', [{ 'Fn::GetAtt': ['InventoryBucketA869B8CB', 'Arn'] }, '/*']],
            },
          ],
        })),
      },
    });
  });

  test('Bucket with objectOwnership set to BUCKET_OWNER_PREFERRED', () => {
    const stack = new cdk.Stack();
    new s3.Bucket(stack, 'MyBucket', {
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
    });
    expect(stack).toMatchTemplate({
      'Resources': {
        'MyBucketF68F3FF0': {
          'Type': 'AWS::S3::Bucket',
          'Properties': {
            'OwnershipControls': {
              'Rules': [
                {
                  'ObjectOwnership': 'BucketOwnerPreferred',
                },
              ],
            },
          },
          'UpdateReplacePolicy': 'Retain',
          'DeletionPolicy': 'Retain',
        },
      },
    });
  });

  test('Bucket with objectOwnership set to OBJECT_WRITER', () => {
    const stack = new cdk.Stack();
    new s3.Bucket(stack, 'MyBucket', {
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
    });
    expect(stack).toMatchTemplate({
      'Resources': {
        'MyBucketF68F3FF0': {
          'Type': 'AWS::S3::Bucket',
          'Properties': {
            'OwnershipControls': {
              'Rules': [
                {
                  'ObjectOwnership': 'ObjectWriter',
                },
              ],
            },
          },
          'UpdateReplacePolicy': 'Retain',
          'DeletionPolicy': 'Retain',
        },
      },
    });
  });

  test('Bucket with objectOwnerships set to undefined', () => {
    const stack = new cdk.Stack();
    new s3.Bucket(stack, 'MyBucket', {
      objectOwnership: undefined,
    });
    expect(stack).toMatchTemplate({
      'Resources': {
        'MyBucketF68F3FF0': {
          'Type': 'AWS::S3::Bucket',
          'UpdateReplacePolicy': 'Retain',
          'DeletionPolicy': 'Retain',
        },
      },
    });
  });

  test('with autoDeleteObjects', () => {
    const stack = new cdk.Stack();

    new s3.Bucket(stack, 'MyBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    expect(stack).toHaveResource('AWS::S3::Bucket', {
      UpdateReplacePolicy: 'Delete',
      DeletionPolicy: 'Delete',
    }, ResourcePart.CompleteDefinition);

    expect(stack).toHaveResource('AWS::S3::BucketPolicy', {
      Bucket: {
        Ref: 'MyBucketF68F3FF0',
      },
      'PolicyDocument': {
        'Statement': [
          {
            'Action': [
              's3:GetBucket*',
              's3:List*',
              's3:DeleteObject*',
            ],
            'Effect': 'Allow',
            'Principal': {
              'AWS': {
                'Fn::GetAtt': [
                  'CustomS3AutoDeleteObjectsCustomResourceProviderRole3B1BD092',
                  'Arn',
                ],
              },
            },
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
                    '/*',
                  ],
                ],
              },
            ],
          },
        ],
        'Version': '2012-10-17',
      },
    });

    expect(stack).toHaveResource('Custom::S3AutoDeleteObjects', {
      'Properties': {
        'ServiceToken': {
          'Fn::GetAtt': [
            'CustomS3AutoDeleteObjectsCustomResourceProviderHandler9D90184F',
            'Arn',
          ],
        },
        'BucketName': {
          'Ref': 'MyBucketF68F3FF0',
        },
      },
      'DependsOn': [
        'MyBucketPolicyE7FBAC7B',
      ],
    }, ResourcePart.CompleteDefinition);
  });

  test('with autoDeleteObjects on multiple buckets', () => {
    const stack = new cdk.Stack();

    new s3.Bucket(stack, 'Bucket1', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    new s3.Bucket(stack, 'Bucket2', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    expect(stack).toCountResources('AWS::Lambda::Function', 1);
  });

  test('autoDeleteObjects throws if RemovalPolicy is not DESTROY', () => {
    const stack = new cdk.Stack();

    expect(() => new s3.Bucket(stack, 'MyBucket', {
      autoDeleteObjects: true,
    })).toThrow(/Cannot use \'autoDeleteObjects\' property on a bucket without setting removal policy to \'DESTROY\'/);
  });
});
