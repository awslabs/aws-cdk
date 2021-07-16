import { ABSENT, expect, haveResource, haveResourceLike } from '@aws-cdk/assert-internal';
import * as certificatemanager from '@aws-cdk/aws-certificatemanager';
import * as lambda from '@aws-cdk/aws-lambda';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import { nodeunitShim, Test } from 'nodeunit-shim';
import {
  CfnDistribution,
  CloudFrontWebDistribution,
  Function,
  FunctionCode,
  FunctionEventType,
  GeoRestriction,
  KeyGroup,
  LambdaEdgeEventType,
  OriginAccessIdentity,
  PublicKey,
  SecurityPolicyProtocol,
  SSLMethod,
  ViewerCertificate,
  ViewerProtocolPolicy,
} from '../lib';

/* eslint-disable quote-props */

const publicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAudf8/iNkQgdvjEdm6xYS
JAyxd/kGTbJfQNg9YhInb7TSm0dGu0yx8yZ3fnpmxuRPqJIlaVr+fT4YRl71gEYa
dlhHmnVegyPNjP9dNqZ7zwNqMEPOPnS/NOHbJj1KYKpn1f8pPNycQ5MQCntKGnSj
6fc+nbcC0joDvGz80xuy1W4hLV9oC9c3GT26xfZb2jy9MVtA3cppNuTwqrFi3t6e
0iGpraxZlT5wewjZLpQkngqYr6s3aucPAZVsGTEYPo4nD5mswmtZOm+tgcOrivtD
/3sD/qZLQ6c5siqyS8aTraD6y+VXugujfarTU65IeZ6QAUbLMsWuZOIi5Jn8zAwx
NQIDAQAB
-----END PUBLIC KEY-----`;

nodeunitShim({

  'distribution with custom origin adds custom origin'(test: Test) {
    const stack = new cdk.Stack();

    new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
      originConfigs: [
        {
          originHeaders: {
            'X-Custom-Header': 'somevalue',
          },
          customOriginSource: {
            domainName: 'myorigin.com',
          },
          behaviors: [
            {
              isDefaultBehavior: true,
            },
          ],
        },
      ],
    });

    expect(stack).toMatch(
      {
        'Resources': {
          'AnAmazingWebsiteProbablyCFDistribution47E3983B': {
            'Type': 'AWS::CloudFront::Distribution',
            'Properties': {
              'DistributionConfig': {
                'DefaultCacheBehavior': {
                  'AllowedMethods': [
                    'GET',
                    'HEAD',
                  ],
                  'CachedMethods': [
                    'GET',
                    'HEAD',
                  ],
                  'ForwardedValues': {
                    'Cookies': {
                      'Forward': 'none',
                    },
                    'QueryString': false,
                  },
                  'TargetOriginId': 'origin1',
                  'ViewerProtocolPolicy': 'redirect-to-https',
                  'Compress': true,
                },
                'DefaultRootObject': 'index.html',
                'Enabled': true,
                'HttpVersion': 'http2',
                'IPV6Enabled': true,
                'Origins': [
                  {
                    'CustomOriginConfig': {
                      'HTTPPort': 80,
                      'HTTPSPort': 443,
                      'OriginKeepaliveTimeout': 5,
                      'OriginProtocolPolicy': 'https-only',
                      'OriginReadTimeout': 30,
                      'OriginSSLProtocols': [
                        'TLSv1.2',
                      ],
                    },
                    'ConnectionAttempts': 3,
                    'ConnectionTimeout': 10,
                    'DomainName': 'myorigin.com',
                    'Id': 'origin1',
                    'OriginCustomHeaders': [
                      {
                        'HeaderName': 'X-Custom-Header',
                        'HeaderValue': 'somevalue',
                      },
                    ],
                  },
                ],
                'PriceClass': 'PriceClass_100',
                'ViewerCertificate': {
                  'CloudFrontDefaultCertificate': true,
                },
              },
            },
          },
        },
      },
    );

    test.done();
  },

  'most basic distribution'(test: Test) {
    const stack = new cdk.Stack();
    const sourceBucket = new s3.Bucket(stack, 'Bucket');

    new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: sourceBucket,
          },
          behaviors: [
            {
              isDefaultBehavior: true,
            },
          ],
        },
      ],
    });

    expect(stack).toMatch({
      'Resources': {
        'Bucket83908E77': {
          'Type': 'AWS::S3::Bucket',
          'DeletionPolicy': 'Retain',
          'UpdateReplacePolicy': 'Retain',
        },
        'AnAmazingWebsiteProbablyCFDistribution47E3983B': {
          'Type': 'AWS::CloudFront::Distribution',
          'Properties': {
            'DistributionConfig': {
              'DefaultRootObject': 'index.html',
              'Origins': [
                {
                  'ConnectionAttempts': 3,
                  'ConnectionTimeout': 10,
                  'DomainName': {
                    'Fn::GetAtt': [
                      'Bucket83908E77',
                      'RegionalDomainName',
                    ],
                  },
                  'Id': 'origin1',
                  'S3OriginConfig': {},
                },
              ],
              'ViewerCertificate': {
                'CloudFrontDefaultCertificate': true,
              },
              'PriceClass': 'PriceClass_100',
              'DefaultCacheBehavior': {
                'AllowedMethods': [
                  'GET',
                  'HEAD',
                ],
                'CachedMethods': [
                  'GET',
                  'HEAD',
                ],
                'TargetOriginId': 'origin1',
                'ViewerProtocolPolicy': 'redirect-to-https',
                'ForwardedValues': {
                  'QueryString': false,
                  'Cookies': { 'Forward': 'none' },
                },
                'Compress': true,
              },
              'Enabled': true,
              'IPV6Enabled': true,
              'HttpVersion': 'http2',
            },
          },
        },
      },
    });
    test.done();
  },

  'can disable distribution'(test: Test) {
    const stack = new cdk.Stack();
    const sourceBucket = new s3.Bucket(stack, 'Bucket');

    new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
      enabled: false,
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: sourceBucket,
          },
          behaviors: [
            {
              isDefaultBehavior: true,
            },
          ],
        },
      ],
    });

    expect(stack).toMatch({
      'Resources': {
        'Bucket83908E77': {
          'Type': 'AWS::S3::Bucket',
          'DeletionPolicy': 'Retain',
          'UpdateReplacePolicy': 'Retain',
        },
        'AnAmazingWebsiteProbablyCFDistribution47E3983B': {
          'Type': 'AWS::CloudFront::Distribution',
          'Properties': {
            'DistributionConfig': {
              'DefaultRootObject': 'index.html',
              'Origins': [
                {
                  'ConnectionAttempts': 3,
                  'ConnectionTimeout': 10,
                  'DomainName': {
                    'Fn::GetAtt': [
                      'Bucket83908E77',
                      'RegionalDomainName',
                    ],
                  },
                  'Id': 'origin1',
                  'S3OriginConfig': {},
                },
              ],
              'ViewerCertificate': {
                'CloudFrontDefaultCertificate': true,
              },
              'PriceClass': 'PriceClass_100',
              'DefaultCacheBehavior': {
                'AllowedMethods': [
                  'GET',
                  'HEAD',
                ],
                'CachedMethods': [
                  'GET',
                  'HEAD',
                ],
                'TargetOriginId': 'origin1',
                'ViewerProtocolPolicy': 'redirect-to-https',
                'ForwardedValues': {
                  'QueryString': false,
                  'Cookies': { 'Forward': 'none' },
                },
                'Compress': true,
              },
              'Enabled': false,
              'IPV6Enabled': true,
              'HttpVersion': 'http2',
            },
          },
        },
      },
    });
    test.done();
  },

  'ensure long comments will not break the distribution'(test: Test) {
    const stack = new cdk.Stack();
    const sourceBucket = new s3.Bucket(stack, 'Bucket');

    new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
      comment: `Adding a comment longer than 128 characters should be trimmed and 
added the ellipsis so a user would know there was more to read and everything beyond this point should not show up`,
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: sourceBucket,
          },
          behaviors: [
            {
              isDefaultBehavior: true,
            },
          ],
        },
      ],
    });

    expect(stack).toMatch({
      Resources: {
        Bucket83908E77: {
          Type: 'AWS::S3::Bucket',
          DeletionPolicy: 'Retain',
          UpdateReplacePolicy: 'Retain',
        },
        AnAmazingWebsiteProbablyCFDistribution47E3983B: {
          Type: 'AWS::CloudFront::Distribution',
          Properties: {
            DistributionConfig: {
              DefaultRootObject: 'index.html',
              Origins: [
                {
                  ConnectionAttempts: 3,
                  ConnectionTimeout: 10,
                  DomainName: {
                    'Fn::GetAtt': ['Bucket83908E77', 'RegionalDomainName'],
                  },
                  Id: 'origin1',
                  S3OriginConfig: {},
                },
              ],
              ViewerCertificate: {
                CloudFrontDefaultCertificate: true,
              },
              PriceClass: 'PriceClass_100',
              DefaultCacheBehavior: {
                AllowedMethods: ['GET', 'HEAD'],
                CachedMethods: ['GET', 'HEAD'],
                TargetOriginId: 'origin1',
                ViewerProtocolPolicy: 'redirect-to-https',
                ForwardedValues: {
                  QueryString: false,
                  Cookies: { Forward: 'none' },
                },
                Compress: true,
              },
              Comment: `Adding a comment longer than 128 characters should be trimmed and 
added the ellipsis so a user would know there was more to ...`,
              Enabled: true,
              IPV6Enabled: true,
              HttpVersion: 'http2',
            },
          },
        },
      },
    });
    test.done();
  },

  'distribution with bucket and OAI'(test: Test) {
    const stack = new cdk.Stack();
    const s3BucketSource = new s3.Bucket(stack, 'Bucket');
    const originAccessIdentity = new OriginAccessIdentity(stack, 'OAI');

    new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
      originConfigs: [{
        s3OriginSource: { s3BucketSource, originAccessIdentity },
        behaviors: [{ isDefaultBehavior: true }],
      }],
    });

    expect(stack).to(haveResourceLike('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        Origins: [
          {
            ConnectionAttempts: 3,
            ConnectionTimeout: 10,
            DomainName: {
              'Fn::GetAtt': [
                'Bucket83908E77',
                'RegionalDomainName',
              ],
            },
            Id: 'origin1',
            S3OriginConfig: {
              OriginAccessIdentity: {
                'Fn::Join': ['', ['origin-access-identity/cloudfront/', { Ref: 'OAIE1EFC67F' }]],
              },
            },
          },
        ],
      },
    }));

    expect(stack).to(haveResourceLike('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: [{
          Action: 's3:GetObject',
          Principal: {
            CanonicalUser: { 'Fn::GetAtt': ['OAIE1EFC67F', 'S3CanonicalUserId'] },
          },
          Resource: {
            'Fn::Join': ['', [{ 'Fn::GetAtt': ['Bucket83908E77', 'Arn'] }, '/*']],
          },
        }],
      },
    }));

    test.done();
  },


  'distribution with trusted signers on default distribution'(test: Test) {
    const stack = new cdk.Stack();
    const sourceBucket = new s3.Bucket(stack, 'Bucket');
    const pubKey = new PublicKey(stack, 'MyPubKey', {
      encodedKey: publicKey,
    });
    const keyGroup = new KeyGroup(stack, 'MyKeyGroup', {
      items: [
        pubKey,
      ],
    });

    new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: sourceBucket,
          },
          behaviors: [
            {
              isDefaultBehavior: true,
              trustedSigners: ['1234'],
              trustedKeyGroups: [
                keyGroup,
              ],
            },
          ],
        },
      ],
    });

    expect(stack).toMatch({
      'Resources': {
        'Bucket83908E77': {
          'Type': 'AWS::S3::Bucket',
          'DeletionPolicy': 'Retain',
          'UpdateReplacePolicy': 'Retain',
        },
        'MyPubKey6ADA4CF5': {
          'Type': 'AWS::CloudFront::PublicKey',
          'Properties': {
            'PublicKeyConfig': {
              'CallerReference': 'c8141e732ea37b19375d4cbef2b2d2c6f613f0649a',
              'EncodedKey': publicKey,
              'Name': 'MyPubKey',
            },
          },
        },
        'MyKeyGroupAF22FD35': {
          'Type': 'AWS::CloudFront::KeyGroup',
          'Properties': {
            'KeyGroupConfig': {
              'Items': [
                {
                  'Ref': 'MyPubKey6ADA4CF5',
                },
              ],
              'Name': 'MyKeyGroup',
            },
          },
        },
        'AnAmazingWebsiteProbablyCFDistribution47E3983B': {
          'Type': 'AWS::CloudFront::Distribution',
          'Properties': {
            'DistributionConfig': {
              'DefaultRootObject': 'index.html',
              'Origins': [
                {
                  'ConnectionAttempts': 3,
                  'ConnectionTimeout': 10,
                  'DomainName': {
                    'Fn::GetAtt': [
                      'Bucket83908E77',
                      'RegionalDomainName',
                    ],
                  },
                  'Id': 'origin1',
                  'S3OriginConfig': {},
                },
              ],
              'ViewerCertificate': {
                'CloudFrontDefaultCertificate': true,
              },
              'PriceClass': 'PriceClass_100',
              'DefaultCacheBehavior': {
                'AllowedMethods': [
                  'GET',
                  'HEAD',
                ],
                'CachedMethods': [
                  'GET',
                  'HEAD',
                ],
                'TargetOriginId': 'origin1',
                'ViewerProtocolPolicy': 'redirect-to-https',
                'ForwardedValues': {
                  'QueryString': false,
                  'Cookies': { 'Forward': 'none' },
                },
                'TrustedKeyGroups': [
                  {
                    'Ref': 'MyKeyGroupAF22FD35',
                  },
                ],
                'TrustedSigners': ['1234'],
                'Compress': true,
              },
              'Enabled': true,
              'IPV6Enabled': true,
              'HttpVersion': 'http2',
            },
          },
        },
      },
    });
    test.done();
  },

  'distribution with ViewerProtocolPolicy set to a non-default value'(test: Test) {
    const stack = new cdk.Stack();
    const sourceBucket = new s3.Bucket(stack, 'Bucket');

    new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
      viewerProtocolPolicy: ViewerProtocolPolicy.ALLOW_ALL,
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: sourceBucket,
          },
          behaviors: [
            {
              isDefaultBehavior: true,
            },
          ],
        },
      ],
    });

    expect(stack).toMatch({
      'Resources': {
        'Bucket83908E77': {
          'Type': 'AWS::S3::Bucket',
          'DeletionPolicy': 'Retain',
          'UpdateReplacePolicy': 'Retain',
        },
        'AnAmazingWebsiteProbablyCFDistribution47E3983B': {
          'Type': 'AWS::CloudFront::Distribution',
          'Properties': {
            'DistributionConfig': {
              'DefaultRootObject': 'index.html',
              'Origins': [
                {
                  'ConnectionAttempts': 3,
                  'ConnectionTimeout': 10,
                  'DomainName': {
                    'Fn::GetAtt': [
                      'Bucket83908E77',
                      'RegionalDomainName',
                    ],
                  },
                  'Id': 'origin1',
                  'S3OriginConfig': {},
                },
              ],
              'ViewerCertificate': {
                'CloudFrontDefaultCertificate': true,
              },
              'PriceClass': 'PriceClass_100',
              'DefaultCacheBehavior': {
                'AllowedMethods': [
                  'GET',
                  'HEAD',
                ],
                'CachedMethods': [
                  'GET',
                  'HEAD',
                ],
                'TargetOriginId': 'origin1',
                'ViewerProtocolPolicy': 'allow-all',
                'ForwardedValues': {
                  'QueryString': false,
                  'Cookies': { 'Forward': 'none' },
                },
                'Compress': true,
              },
              'Enabled': true,
              'IPV6Enabled': true,
              'HttpVersion': 'http2',
            },
          },
        },
      },
    });
    test.done();
  },

  'distribution with disabled compression'(test: Test) {
    const stack = new cdk.Stack();
    const sourceBucket = new s3.Bucket(stack, 'Bucket');

    new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: sourceBucket,
          },
          behaviors: [
            {
              isDefaultBehavior: true,
              compress: false,
            },
          ],
        },
      ],
    });

    expect(stack).toMatch({
      'Resources': {
        'Bucket83908E77': {
          'Type': 'AWS::S3::Bucket',
          'DeletionPolicy': 'Retain',
          'UpdateReplacePolicy': 'Retain',
        },
        'AnAmazingWebsiteProbablyCFDistribution47E3983B': {
          'Type': 'AWS::CloudFront::Distribution',
          'Properties': {
            'DistributionConfig': {
              'DefaultRootObject': 'index.html',
              'Origins': [
                {
                  'ConnectionAttempts': 3,
                  'ConnectionTimeout': 10,
                  'DomainName': {
                    'Fn::GetAtt': [
                      'Bucket83908E77',
                      'RegionalDomainName',
                    ],
                  },
                  'Id': 'origin1',
                  'S3OriginConfig': {},
                },
              ],
              'ViewerCertificate': {
                'CloudFrontDefaultCertificate': true,
              },
              'PriceClass': 'PriceClass_100',
              'DefaultCacheBehavior': {
                'AllowedMethods': [
                  'GET',
                  'HEAD',
                ],
                'CachedMethods': [
                  'GET',
                  'HEAD',
                ],
                'TargetOriginId': 'origin1',
                'ViewerProtocolPolicy': 'redirect-to-https',
                'ForwardedValues': {
                  'QueryString': false,
                  'Cookies': { 'Forward': 'none' },
                },
                'Compress': false,
              },
              'Enabled': true,
              'IPV6Enabled': true,
              'HttpVersion': 'http2',
            },
          },
        },
      },
    });
    test.done();
  },

  'distribution with CloudFront function-association'(test: Test) {
    const stack = new cdk.Stack();
    const sourceBucket = new s3.Bucket(stack, 'Bucket');

    new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: sourceBucket,
          },
          behaviors: [
            {
              isDefaultBehavior: true,
              functionAssociations: [{
                eventType: FunctionEventType.VIEWER_REQUEST,
                function: new Function(stack, 'TestFunction', {
                  code: FunctionCode.fromInline('foo'),
                }),
              }],
            },
          ],
        },
      ],
    });

    expect(stack).to(haveResourceLike('AWS::CloudFront::Distribution', {
      'DistributionConfig': {
        'DefaultCacheBehavior': {
          'FunctionAssociations': [
            {
              'EventType': 'viewer-request',
              'FunctionARN': {
                'Fn::GetAtt': [
                  'TestFunction22AD90FC',
                  'FunctionARN',
                ],
              },
            },
          ],
        },
      },
    }));

    test.done();
  },

  'distribution with resolvable lambda-association'(test: Test) {
    const stack = new cdk.Stack();
    const sourceBucket = new s3.Bucket(stack, 'Bucket');

    const lambdaFunction = new lambda.Function(stack, 'Lambda', {
      code: lambda.Code.fromInline('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
    });

    new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: sourceBucket,
          },
          behaviors: [
            {
              isDefaultBehavior: true,
              lambdaFunctionAssociations: [{
                eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
                lambdaFunction: lambdaFunction.currentVersion,
                includeBody: true,
              }],
            },
          ],
        },
      ],
    });

    expect(stack).to(haveResourceLike('AWS::CloudFront::Distribution', {
      'DistributionConfig': {
        'DefaultCacheBehavior': {
          'LambdaFunctionAssociations': [
            {
              'EventType': 'origin-request',
              'IncludeBody': true,
              'LambdaFunctionARN': {
                'Ref': 'LambdaCurrentVersionDF706F6A97fb843e9bd06fcd2bb15eeace80e13e',
              },
            },
          ],
        },
      },
    }));

    test.done();
  },

  'associate a lambda with removable env vars'(test: Test) {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'Stack');
    const sourceBucket = new s3.Bucket(stack, 'Bucket');

    const lambdaFunction = new lambda.Function(stack, 'Lambda', {
      code: lambda.Code.fromInline('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
    });
    lambdaFunction.addEnvironment('KEY', 'value', { removeInEdge: true });

    new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: sourceBucket,
          },
          behaviors: [
            {
              isDefaultBehavior: true,
              lambdaFunctionAssociations: [{
                eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
                lambdaFunction: lambdaFunction.currentVersion,
              }],
            },
          ],
        },
      ],
    });

    expect(stack).to(haveResource('AWS::Lambda::Function', {
      Environment: ABSENT,
    }));

    test.done();
  },

  'throws when associating a lambda with incompatible env vars'(test: Test) {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'Stack');
    const sourceBucket = new s3.Bucket(stack, 'Bucket');

    const lambdaFunction = new lambda.Function(stack, 'Lambda', {
      code: lambda.Code.fromInline('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      environment: {
        KEY: 'value',
      },
    });

    new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: sourceBucket,
          },
          behaviors: [
            {
              isDefaultBehavior: true,
              lambdaFunctionAssociations: [{
                eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
                lambdaFunction: lambdaFunction.currentVersion,
              }],
            },
          ],
        },
      ],
    });

    test.throws(() => app.synth(), /KEY/);

    test.done();
  },

  'throws when associating a lambda with includeBody and a response event type'(test: Test) {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'Stack');
    const sourceBucket = new s3.Bucket(stack, 'Bucket');

    const fnVersion = lambda.Version.fromVersionArn(stack, 'Version', 'arn:aws:lambda:testregion:111111111111:function:myTestFun:v1');

    test.throws(() => {
      new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
        originConfigs: [
          {
            s3OriginSource: {
              s3BucketSource: sourceBucket,
            },
            behaviors: [
              {
                isDefaultBehavior: true,
                lambdaFunctionAssociations: [{
                  eventType: LambdaEdgeEventType.VIEWER_RESPONSE,
                  includeBody: true,
                  lambdaFunction: fnVersion,
                }],
              },
            ],
          },
        ],
      });
    }, /'includeBody' can only be true for ORIGIN_REQUEST or VIEWER_REQUEST event types./);

    test.done();
  },

  'distribution has a defaultChild'(test: Test) {
    const stack = new cdk.Stack();
    const sourceBucket = new s3.Bucket(stack, 'Bucket');

    const distribution = new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: sourceBucket,
          },
          behaviors: [{ isDefaultBehavior: true }],
        },
      ],
    });

    test.ok(distribution.node.defaultChild instanceof CfnDistribution);
    test.done();
  },

  'allows multiple aliasConfiguration CloudFrontWebDistribution per stack'(test: Test) {
    const stack = new cdk.Stack();
    const s3BucketSource = new s3.Bucket(stack, 'Bucket');

    const originConfigs = [{
      s3OriginSource: { s3BucketSource },
      behaviors: [{ isDefaultBehavior: true }],
    }];

    new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
      originConfigs,
      aliasConfiguration: { acmCertRef: 'acm_ref', names: ['www.example.com'] },
    });
    new CloudFrontWebDistribution(stack, 'AnotherAmazingWebsiteProbably', {
      originConfigs,
      aliasConfiguration: { acmCertRef: 'another_acm_ref', names: ['ftp.example.com'] },
    });

    expect(stack).to(haveResourceLike('AWS::CloudFront::Distribution', {
      'DistributionConfig': {
        'Aliases': ['www.example.com'],
        'ViewerCertificate': {
          'AcmCertificateArn': 'acm_ref',
          'SslSupportMethod': 'sni-only',
        },
      },
    }));

    expect(stack).to(haveResourceLike('AWS::CloudFront::Distribution', {
      'DistributionConfig': {
        'Aliases': ['ftp.example.com'],
        'ViewerCertificate': {
          'AcmCertificateArn': 'another_acm_ref',
          'SslSupportMethod': 'sni-only',
        },
      },
    }));
    test.done();
  },

  'viewerCertificate': {
    'acmCertificate': {
      'base usage'(test: Test) {
        const stack = new cdk.Stack();
        const sourceBucket = new s3.Bucket(stack, 'Bucket');

        const certificate = new certificatemanager.Certificate(stack, 'cert', {
          domainName: 'example.com',
        });

        new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
          originConfigs: [{
            s3OriginSource: { s3BucketSource: sourceBucket },
            behaviors: [{ isDefaultBehavior: true }],
          }],
          viewerCertificate: ViewerCertificate.fromAcmCertificate(certificate),
        });

        expect(stack).to(haveResourceLike('AWS::CloudFront::Distribution', {
          'DistributionConfig': {
            'Aliases': [],
            'ViewerCertificate': {
              'AcmCertificateArn': {
                'Ref': 'cert56CA94EB',
              },
              'SslSupportMethod': 'sni-only',
            },
          },
        }));

        test.done();
      },
      'imported certificate fromCertificateArn'(test: Test) {
        const stack = new cdk.Stack();
        const sourceBucket = new s3.Bucket(stack, 'Bucket');

        const certificate = certificatemanager.Certificate.fromCertificateArn(
          stack, 'cert', 'arn:aws:acm:us-east-1:1111111:certificate/11-3336f1-44483d-adc7-9cd375c5169d',
        );

        new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
          originConfigs: [{
            s3OriginSource: { s3BucketSource: sourceBucket },
            behaviors: [{ isDefaultBehavior: true }],
          }],
          viewerCertificate: ViewerCertificate.fromAcmCertificate(certificate),
        });

        expect(stack).to(haveResourceLike('AWS::CloudFront::Distribution', {
          'DistributionConfig': {
            'Aliases': [],
            'ViewerCertificate': {
              'AcmCertificateArn': 'arn:aws:acm:us-east-1:1111111:certificate/11-3336f1-44483d-adc7-9cd375c5169d',
              'SslSupportMethod': 'sni-only',
            },
          },
        }));

        test.done();
      },
      'advanced usage'(test: Test) {
        const stack = new cdk.Stack();
        const sourceBucket = new s3.Bucket(stack, 'Bucket');

        const certificate = new certificatemanager.Certificate(stack, 'cert', {
          domainName: 'example.com',
        });

        new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
          originConfigs: [{
            s3OriginSource: { s3BucketSource: sourceBucket },
            behaviors: [{ isDefaultBehavior: true }],
          }],
          viewerCertificate: ViewerCertificate.fromAcmCertificate(certificate, {
            securityPolicy: SecurityPolicyProtocol.SSL_V3,
            sslMethod: SSLMethod.VIP,
            aliases: ['example.com', 'www.example.com'],
          }),
        });

        expect(stack).to(haveResourceLike('AWS::CloudFront::Distribution', {
          'DistributionConfig': {
            'Aliases': ['example.com', 'www.example.com'],
            'ViewerCertificate': {
              'AcmCertificateArn': {
                'Ref': 'cert56CA94EB',
              },
              'MinimumProtocolVersion': 'SSLv3',
              'SslSupportMethod': 'vip',
            },
          },
        }));

        test.done();
      },
    },
    'iamCertificate': {
      'base usage'(test: Test) {
        const stack = new cdk.Stack();
        const sourceBucket = new s3.Bucket(stack, 'Bucket');

        new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
          originConfigs: [{
            s3OriginSource: { s3BucketSource: sourceBucket },
            behaviors: [{ isDefaultBehavior: true }],
          }],
          viewerCertificate: ViewerCertificate.fromIamCertificate('test'),
        });

        expect(stack).to(haveResourceLike('AWS::CloudFront::Distribution', {
          'DistributionConfig': {
            'Aliases': [],
            'ViewerCertificate': {
              'IamCertificateId': 'test',
              'SslSupportMethod': 'sni-only',
            },
          },
        }));

        test.done();
      },
      'advanced usage'(test: Test) {
        const stack = new cdk.Stack();
        const sourceBucket = new s3.Bucket(stack, 'Bucket');

        new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
          originConfigs: [{
            s3OriginSource: { s3BucketSource: sourceBucket },
            behaviors: [{ isDefaultBehavior: true }],
          }],
          viewerCertificate: ViewerCertificate.fromIamCertificate('test', {
            securityPolicy: SecurityPolicyProtocol.TLS_V1,
            sslMethod: SSLMethod.VIP,
            aliases: ['example.com'],
          }),
        });

        expect(stack).to(haveResourceLike('AWS::CloudFront::Distribution', {
          'DistributionConfig': {
            'Aliases': ['example.com'],
            'ViewerCertificate': {
              'IamCertificateId': 'test',
              'MinimumProtocolVersion': 'TLSv1',
              'SslSupportMethod': 'vip',
            },
          },
        }));

        test.done();
      },
    },
    'cloudFrontDefaultCertificate': {
      'base usage'(test: Test) {
        const stack = new cdk.Stack();
        const sourceBucket = new s3.Bucket(stack, 'Bucket');

        new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
          originConfigs: [{
            s3OriginSource: { s3BucketSource: sourceBucket },
            behaviors: [{ isDefaultBehavior: true }],
          }],
          viewerCertificate: ViewerCertificate.fromCloudFrontDefaultCertificate(),
        });

        expect(stack).to(haveResourceLike('AWS::CloudFront::Distribution', {
          'DistributionConfig': {
            'Aliases': [],
            'ViewerCertificate': {
              'CloudFrontDefaultCertificate': true,
            },
          },
        }));

        test.done();
      },
      'aliases are set'(test: Test) {
        const stack = new cdk.Stack();
        const sourceBucket = new s3.Bucket(stack, 'Bucket');

        new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
          originConfigs: [{
            s3OriginSource: { s3BucketSource: sourceBucket },
            behaviors: [{ isDefaultBehavior: true }],
          }],
          viewerCertificate: ViewerCertificate.fromCloudFrontDefaultCertificate('example.com', 'www.example.com'),
        });

        expect(stack).to(haveResourceLike('AWS::CloudFront::Distribution', {
          'DistributionConfig': {
            'Aliases': ['example.com', 'www.example.com'],
            'ViewerCertificate': {
              'CloudFrontDefaultCertificate': true,
            },
          },
        }));

        test.done();
      },
    },
    'errors': {
      'throws if both deprecated aliasConfiguration and viewerCertificate'(test: Test) {
        const stack = new cdk.Stack();
        const sourceBucket = new s3.Bucket(stack, 'Bucket');

        test.throws(() => {
          new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
            originConfigs: [{
              s3OriginSource: { s3BucketSource: sourceBucket },
              behaviors: [{ isDefaultBehavior: true }],
            }],
            aliasConfiguration: { acmCertRef: 'test', names: ['ftp.example.com'] },
            viewerCertificate: ViewerCertificate.fromCloudFrontDefaultCertificate('example.com', 'www.example.com'),
          });
        }, /You cannot set both aliasConfiguration and viewerCertificate properties/);

        test.done();
      },
      'throws if invalid security policy for SSL method'(test: Test) {
        const stack = new cdk.Stack();
        const sourceBucket = new s3.Bucket(stack, 'Bucket');

        test.throws(() => {
          new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
            originConfigs: [{
              s3OriginSource: { s3BucketSource: sourceBucket },
              behaviors: [{ isDefaultBehavior: true }],
            }],
            viewerCertificate: ViewerCertificate.fromIamCertificate('test', {
              securityPolicy: SecurityPolicyProtocol.TLS_V1_1_2016,
              sslMethod: SSLMethod.VIP,
            }),
          });
        }, /TLSv1.1_2016 is not compabtible with sslMethod vip./);

        test.done();
      },
      // FIXME https://github.com/aws/aws-cdk/issues/4724
      'does not throw if acmCertificate explicitly not in us-east-1'(test: Test) {
        const stack = new cdk.Stack();
        const sourceBucket = new s3.Bucket(stack, 'Bucket');

        const certificate = certificatemanager.Certificate.fromCertificateArn(
          stack, 'cert', 'arn:aws:acm:eu-west-3:1111111:certificate/11-3336f1-44483d-adc7-9cd375c5169d',
        );

        new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
          originConfigs: [{
            s3OriginSource: { s3BucketSource: sourceBucket },
            behaviors: [{ isDefaultBehavior: true }],
          }],
          viewerCertificate: ViewerCertificate.fromAcmCertificate(certificate),
        });

        expect(stack).to(haveResourceLike('AWS::CloudFront::Distribution', {
          'DistributionConfig': {
            'Aliases': [],
            'ViewerCertificate': {
              'AcmCertificateArn': 'arn:aws:acm:eu-west-3:1111111:certificate/11-3336f1-44483d-adc7-9cd375c5169d',
              'SslSupportMethod': 'sni-only',
            },
          },
        }));

        test.done();
      },
    },
  },

  'edgelambda.amazonaws.com is added to the trust policy of lambda'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const sourceBucket = new s3.Bucket(stack, 'Bucket');
    const fn = new lambda.Function(stack, 'Lambda', {
      code: lambda.Code.fromInline('foo'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
    });
    const lambdaVersion = new lambda.Version(stack, 'LambdaVersion', { lambda: fn });

    // WHEN
    new CloudFrontWebDistribution(stack, 'MyDistribution', {
      originConfigs: [
        {
          s3OriginSource: { s3BucketSource: sourceBucket },
          behaviors: [
            {
              isDefaultBehavior: true,
              lambdaFunctionAssociations: [
                {
                  eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
                  lambdaFunction: lambdaVersion,
                },
              ],
            },
          ],
        },
      ],
    });

    // THEN
    expect(stack).to(haveResource('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        'Statement': [
          {
            'Action': 'sts:AssumeRole',
            'Effect': 'Allow',
            'Principal': {
              'Service': 'lambda.amazonaws.com',
            },
          },
          {
            'Action': 'sts:AssumeRole',
            'Effect': 'Allow',
            'Principal': {
              'Service': 'edgelambda.amazonaws.com',
            },
          },
        ],
        'Version': '2012-10-17',
      },
    }));
    test.done();
  },

  'edgelambda.amazonaws.com is not added to lambda role for imported functions'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const sourceBucket = new s3.Bucket(stack, 'Bucket');
    const lambdaVersion = lambda.Version.fromVersionArn(stack, 'Version', 'arn:my-version');

    // WHEN
    new CloudFrontWebDistribution(stack, 'MyDistribution', {
      originConfigs: [
        {
          s3OriginSource: { s3BucketSource: sourceBucket },
          behaviors: [
            {
              isDefaultBehavior: true,
              lambdaFunctionAssociations: [
                {
                  eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
                  lambdaFunction: lambdaVersion,
                },
              ],
            },
          ],
        },
      ],
    });

    expect(stack).notTo(haveResourceLike('AWS::IAM::Role'));
    test.done();
  },

  'geo restriction': {
    'success': {
      'allowlist'(test: Test) {
        const stack = new cdk.Stack();
        const sourceBucket = new s3.Bucket(stack, 'Bucket');

        new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
          originConfigs: [{
            s3OriginSource: { s3BucketSource: sourceBucket },
            behaviors: [{ isDefaultBehavior: true }],
          }],
          geoRestriction: GeoRestriction.allowlist('US', 'UK'),
        });

        expect(stack).toMatch({
          'Resources': {
            'Bucket83908E77': {
              'Type': 'AWS::S3::Bucket',
              'DeletionPolicy': 'Retain',
              'UpdateReplacePolicy': 'Retain',
            },
            'AnAmazingWebsiteProbablyCFDistribution47E3983B': {
              'Type': 'AWS::CloudFront::Distribution',
              'Properties': {
                'DistributionConfig': {
                  'DefaultRootObject': 'index.html',
                  'Origins': [
                    {
                      'ConnectionAttempts': 3,
                      'ConnectionTimeout': 10,
                      'DomainName': {
                        'Fn::GetAtt': [
                          'Bucket83908E77',
                          'RegionalDomainName',
                        ],
                      },
                      'Id': 'origin1',
                      'S3OriginConfig': {},
                    },
                  ],
                  'ViewerCertificate': {
                    'CloudFrontDefaultCertificate': true,
                  },
                  'PriceClass': 'PriceClass_100',
                  'DefaultCacheBehavior': {
                    'AllowedMethods': [
                      'GET',
                      'HEAD',
                    ],
                    'CachedMethods': [
                      'GET',
                      'HEAD',
                    ],
                    'TargetOriginId': 'origin1',
                    'ViewerProtocolPolicy': 'redirect-to-https',
                    'ForwardedValues': {
                      'QueryString': false,
                      'Cookies': { 'Forward': 'none' },
                    },
                    'Compress': true,
                  },
                  'Enabled': true,
                  'IPV6Enabled': true,
                  'HttpVersion': 'http2',
                  'Restrictions': {
                    'GeoRestriction': {
                      'Locations': ['US', 'UK'],
                      'RestrictionType': 'whitelist',
                    },
                  },
                },
              },
            },
          },
        });

        test.done();
      },
      'denylist'(test: Test) {
        const stack = new cdk.Stack();
        const sourceBucket = new s3.Bucket(stack, 'Bucket');

        new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
          originConfigs: [{
            s3OriginSource: { s3BucketSource: sourceBucket },
            behaviors: [{ isDefaultBehavior: true }],
          }],
          geoRestriction: GeoRestriction.denylist('US'),
        });

        expect(stack).toMatch({
          'Resources': {
            'Bucket83908E77': {
              'Type': 'AWS::S3::Bucket',
              'DeletionPolicy': 'Retain',
              'UpdateReplacePolicy': 'Retain',
            },
            'AnAmazingWebsiteProbablyCFDistribution47E3983B': {
              'Type': 'AWS::CloudFront::Distribution',
              'Properties': {
                'DistributionConfig': {
                  'DefaultRootObject': 'index.html',
                  'Origins': [
                    {
                      'ConnectionAttempts': 3,
                      'ConnectionTimeout': 10,
                      'DomainName': {
                        'Fn::GetAtt': [
                          'Bucket83908E77',
                          'RegionalDomainName',
                        ],
                      },
                      'Id': 'origin1',
                      'S3OriginConfig': {},
                    },
                  ],
                  'ViewerCertificate': {
                    'CloudFrontDefaultCertificate': true,
                  },
                  'PriceClass': 'PriceClass_100',
                  'DefaultCacheBehavior': {
                    'AllowedMethods': [
                      'GET',
                      'HEAD',
                    ],
                    'CachedMethods': [
                      'GET',
                      'HEAD',
                    ],
                    'TargetOriginId': 'origin1',
                    'ViewerProtocolPolicy': 'redirect-to-https',
                    'ForwardedValues': {
                      'QueryString': false,
                      'Cookies': { 'Forward': 'none' },
                    },
                    'Compress': true,
                  },
                  'Enabled': true,
                  'IPV6Enabled': true,
                  'HttpVersion': 'http2',
                  'Restrictions': {
                    'GeoRestriction': {
                      'Locations': ['US'],
                      'RestrictionType': 'blacklist',
                    },
                  },
                },
              },
            },
          },
        });

        test.done();
      },
    },
    'error': {
      'throws if locations is empty array'(test: Test) {
        test.throws(() => {
          GeoRestriction.allowlist();
        }, /Should provide at least 1 location/);

        test.throws(() => {
          GeoRestriction.denylist();
        }, /Should provide at least 1 location/);

        test.done();
      },
      'throws if locations format is wrong'(test: Test) {
        test.throws(() => {
          GeoRestriction.allowlist('us');
        }, /Invalid location format for location: us, location should be two-letter and uppercase country ISO 3166-1-alpha-2 code/);

        test.throws(() => {
          GeoRestriction.denylist('us');
        }, /Invalid location format for location: us, location should be two-letter and uppercase country ISO 3166-1-alpha-2 code/);

        test.done();
      },
    },
  },

  'Connection behaviors between CloudFront and your origin': {
    'success': {
      'connectionAttempts = 1'(test: Test) {
        const stack = new cdk.Stack();
        test.doesNotThrow(() => {
          new CloudFrontWebDistribution(stack, 'Distribution', {
            originConfigs: [{
              behaviors: [{ isDefaultBehavior: true }],
              connectionAttempts: 1,
              customOriginSource: { domainName: 'myorigin.com' },
            }],
          });
        }, /connectionAttempts: You can specify 1, 2, or 3 as the number of attempts./);
        test.done();
      },
      '3 = connectionAttempts'(test: Test) {
        const stack = new cdk.Stack();
        test.doesNotThrow(() => {
          new CloudFrontWebDistribution(stack, 'Distribution', {
            originConfigs: [{
              behaviors: [{ isDefaultBehavior: true }],
              connectionAttempts: 3,
              customOriginSource: { domainName: 'myorigin.com' },
            }],
          });
        }, /connectionAttempts: You can specify 1, 2, or 3 as the number of attempts./);
        test.done();
      },
      'connectionTimeout = 1'(test: Test) {
        const stack = new cdk.Stack();
        test.doesNotThrow(() => {
          new CloudFrontWebDistribution(stack, 'Distribution', {
            originConfigs: [{
              behaviors: [{ isDefaultBehavior: true }],
              connectionTimeout: cdk.Duration.seconds(1),
              customOriginSource: { domainName: 'myorigin.com' },
            }],
          });
        }, /connectionTimeout: You can specify a number of seconds between 1 and 10 (inclusive)./);
        test.done();
      },
      '10 = connectionTimeout'(test: Test) {
        const stack = new cdk.Stack();
        test.doesNotThrow(() => {
          new CloudFrontWebDistribution(stack, 'Distribution', {
            originConfigs: [{
              behaviors: [{ isDefaultBehavior: true }],
              connectionTimeout: cdk.Duration.seconds(10),
              customOriginSource: { domainName: 'myorigin.com' },
            }],
          });
        }, /connectionTimeout: You can specify a number of seconds between 1 and 10 (inclusive)./);
        test.done();
      },
    },
    'errors': {
      'connectionAttempts = 1.1'(test: Test) {
        const stack = new cdk.Stack();
        test.throws(() => {
          new CloudFrontWebDistribution(stack, 'Distribution', {
            originConfigs: [{
              behaviors: [{ isDefaultBehavior: true }],
              connectionAttempts: 1.1,
              customOriginSource: { domainName: 'myorigin.com' },
            }],
          });
        }, /connectionAttempts: You can specify 1, 2, or 3 as the number of attempts./);
        test.done();
      },
      'connectionAttempts = -1'(test: Test) {
        const stack = new cdk.Stack();
        test.throws(() => {
          new CloudFrontWebDistribution(stack, 'Distribution', {
            originConfigs: [{
              behaviors: [{ isDefaultBehavior: true }],
              connectionAttempts: -1,
              customOriginSource: { domainName: 'myorigin.com' },
            }],
          });
        }, /connectionAttempts: You can specify 1, 2, or 3 as the number of attempts./);
        test.done();
      },
      'connectionAttempts < 1'(test: Test) {
        const stack = new cdk.Stack();
        test.throws(() => {
          new CloudFrontWebDistribution(stack, 'Distribution', {
            originConfigs: [{
              behaviors: [{ isDefaultBehavior: true }],
              connectionAttempts: 0,
              customOriginSource: { domainName: 'myorigin.com' },
            }],
          });
        }, /connectionAttempts: You can specify 1, 2, or 3 as the number of attempts./);
        test.done();
      },
      '3 < connectionAttempts'(test: Test) {
        const stack = new cdk.Stack();
        test.throws(() => {
          new CloudFrontWebDistribution(stack, 'Distribution', {
            originConfigs: [{
              behaviors: [{ isDefaultBehavior: true }],
              connectionAttempts: 4,
              customOriginSource: { domainName: 'myorigin.com' },
            }],
          });
        }, /connectionAttempts: You can specify 1, 2, or 3 as the number of attempts./);
        test.done();
      },
      'connectionTimeout = 1.1'(test: Test) {
        const stack = new cdk.Stack();
        test.throws(() => {
          new CloudFrontWebDistribution(stack, 'Distribution', {
            originConfigs: [{
              behaviors: [{ isDefaultBehavior: true }],
              connectionTimeout: cdk.Duration.seconds(1.1),
              customOriginSource: { domainName: 'myorigin.com' },
            }],
          });
        }, /connectionTimeout: You can specify a number of seconds between 1 and 10 \(inclusive\)./);
        test.done();
      },
      'connectionTimeout < 1'(test: Test) {
        const stack = new cdk.Stack();
        test.throws(() => {
          new CloudFrontWebDistribution(stack, 'Distribution', {
            originConfigs: [{
              behaviors: [{ isDefaultBehavior: true }],
              connectionTimeout: cdk.Duration.seconds(0),
              customOriginSource: { domainName: 'myorigin.com' },
            }],
          });
        }, /connectionTimeout: You can specify a number of seconds between 1 and 10 \(inclusive\)./);
        test.done();
      },
      '10 < connectionTimeout'(test: Test) {
        const stack = new cdk.Stack();
        test.throws(() => {
          new CloudFrontWebDistribution(stack, 'Distribution', {
            originConfigs: [{
              behaviors: [{ isDefaultBehavior: true }],
              connectionTimeout: cdk.Duration.seconds(11),
              customOriginSource: { domainName: 'myorigin.com' },
            }],
          });
        }, /connectionTimeout: You can specify a number of seconds between 1 and 10 \(inclusive\)./);
        test.done();
      },
    },
  },

  'existing distributions can be imported'(test: Test) {
    const stack = new cdk.Stack();
    const dist = CloudFrontWebDistribution.fromDistributionAttributes(stack, 'ImportedDist', {
      domainName: 'd111111abcdef8.cloudfront.net',
      distributionId: '012345ABCDEF',
    });

    test.equals(dist.distributionDomainName, 'd111111abcdef8.cloudfront.net');
    test.equals(dist.distributionId, '012345ABCDEF');

    test.done();
  },
});
