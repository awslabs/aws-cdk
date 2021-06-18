import { ABSENT, objectLike } from '@aws-cdk/assert-internal';
import '@aws-cdk/assert-internal/jest';
import * as acm from '@aws-cdk/aws-certificatemanager';
import * as lambda from '@aws-cdk/aws-lambda';
import * as s3 from '@aws-cdk/aws-s3';
import { App, Duration, Stack } from '@aws-cdk/core';
import { CfnDistribution, Distribution, Function, FunctionCode, FunctionEventType, GeoRestriction, HttpVersion, IOrigin, LambdaEdgeEventType, PriceClass, SecurityPolicyProtocol } from '../lib';
import { defaultOrigin, defaultOriginGroup } from './test-origin';

let app: App;
let stack: Stack;

beforeEach(() => {
  app = new App();
  stack = new Stack(app, 'Stack', {
    env: { account: '1234', region: 'testregion' },
  });
});

test('minimal example renders correctly', () => {
  const origin = defaultOrigin();
  new Distribution(stack, 'MyDist', { defaultBehavior: { origin } });

  expect(stack).toHaveResource('AWS::CloudFront::Distribution', {
    DistributionConfig: {
      DefaultCacheBehavior: {
        CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6',
        Compress: true,
        TargetOriginId: 'StackMyDistOrigin1D6D5E535',
        ViewerProtocolPolicy: 'allow-all',
      },
      Enabled: true,
      HttpVersion: 'http2',
      IPV6Enabled: true,
      Origins: [{
        DomainName: 'www.example.com',
        Id: 'StackMyDistOrigin1D6D5E535',
        CustomOriginConfig: {
          OriginProtocolPolicy: 'https-only',
        },
      }],
    },
  });
});

test('exhaustive example of props renders correctly', () => {
  const origin = defaultOrigin();
  const certificate = acm.Certificate.fromCertificateArn(stack, 'Cert', 'arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012');

  new Distribution(stack, 'MyDist', {
    defaultBehavior: { origin },
    certificate,
    comment: 'a test',
    defaultRootObject: 'index.html',
    domainNames: ['example.com'],
    enabled: false,
    enableIpv6: false,
    enableLogging: true,
    geoRestriction: GeoRestriction.denylist('US', 'GB'),
    httpVersion: HttpVersion.HTTP1_1,
    logFilePrefix: 'logs/',
    logIncludesCookies: true,
    priceClass: PriceClass.PRICE_CLASS_100,
    webAclId: '473e64fd-f30b-4765-81a0-62ad96dd167a',
  });

  expect(stack).toHaveResource('AWS::CloudFront::Distribution', {
    DistributionConfig: {
      Aliases: ['example.com'],
      DefaultCacheBehavior: {
        CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6',
        Compress: true,
        TargetOriginId: 'StackMyDistOrigin1D6D5E535',
        ViewerProtocolPolicy: 'allow-all',
      },
      Comment: 'a test',
      DefaultRootObject: 'index.html',
      Enabled: false,
      HttpVersion: 'http1.1',
      IPV6Enabled: false,
      Logging: {
        Bucket: { 'Fn::GetAtt': ['MyDistLoggingBucket9B8976BC', 'RegionalDomainName'] },
        IncludeCookies: true,
        Prefix: 'logs/',
      },
      Origins: [{
        DomainName: 'www.example.com',
        Id: 'StackMyDistOrigin1D6D5E535',
        CustomOriginConfig: {
          OriginProtocolPolicy: 'https-only',
        },
      }],
      PriceClass: 'PriceClass_100',
      Restrictions: {
        GeoRestriction: {
          Locations: ['US', 'GB'],
          RestrictionType: 'blacklist',
        },
      },
      ViewerCertificate: {
        AcmCertificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012',
        SslSupportMethod: 'sni-only',
        MinimumProtocolVersion: 'TLSv1.2_2019',
      },
      WebACLId: '473e64fd-f30b-4765-81a0-62ad96dd167a',
    },
  });
});

test('ensure comment prop is not greater than max lenght', () => {
  const origin = defaultOrigin();
  new Distribution(stack, 'MyDist', {
    defaultBehavior: { origin },
    comment: `Adding a comment longer than 128 characters should be trimmed and added the 
ellipsis so a user would know there was more to read and everything beyond this point should not show up`,
  });

  expect(stack).toHaveResource('AWS::CloudFront::Distribution', {
    DistributionConfig: {
      DefaultCacheBehavior: {
        CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6',
        Compress: true,
        TargetOriginId: 'StackMyDistOrigin1D6D5E535',
        ViewerProtocolPolicy: 'allow-all',
      },
      Comment: `Adding a comment longer than 128 characters should be trimmed and added the 
ellipsis so a user would know there was more to ...`,
      Enabled: true,
      HttpVersion: 'http2',
      IPV6Enabled: true,
      Origins: [
        {
          DomainName: 'www.example.com',
          Id: 'StackMyDistOrigin1D6D5E535',
          CustomOriginConfig: {
            OriginProtocolPolicy: 'https-only',
          },
        },
      ],
    },
  });
});

describe('multiple behaviors', () => {
  test('a second behavior can\'t be specified with the catch-all path pattern', () => {
    const origin = defaultOrigin();

    expect(() => {
      new Distribution(stack, 'MyDist', {
        defaultBehavior: { origin },
        additionalBehaviors: {
          '*': { origin },
        },
      });
    }).toThrow(/Only the default behavior can have a path pattern of \'*\'/);
  });

  test('a second behavior can be added to the original origin', () => {
    const origin = defaultOrigin();
    new Distribution(stack, 'MyDist', {
      defaultBehavior: { origin },
      additionalBehaviors: {
        'api/*': { origin },
      },
    });

    expect(stack).toHaveResource('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        DefaultCacheBehavior: {
          CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6',
          Compress: true,
          TargetOriginId: 'StackMyDistOrigin1D6D5E535',
          ViewerProtocolPolicy: 'allow-all',
        },
        CacheBehaviors: [{
          CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6',
          Compress: true,
          PathPattern: 'api/*',
          TargetOriginId: 'StackMyDistOrigin1D6D5E535',
          ViewerProtocolPolicy: 'allow-all',
        }],
        Enabled: true,
        HttpVersion: 'http2',
        IPV6Enabled: true,
        Origins: [{
          DomainName: 'www.example.com',
          Id: 'StackMyDistOrigin1D6D5E535',
          CustomOriginConfig: {
            OriginProtocolPolicy: 'https-only',
          },
        }],
      },
    });
  });

  test('a second behavior can be added to a secondary origin', () => {
    const origin = defaultOrigin();
    const origin2 = defaultOrigin('origin2.example.com');
    new Distribution(stack, 'MyDist', {
      defaultBehavior: { origin },
      additionalBehaviors: {
        'api/*': { origin: origin2 },
      },
    });

    expect(stack).toHaveResource('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        DefaultCacheBehavior: {
          CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6',
          Compress: true,
          TargetOriginId: 'StackMyDistOrigin1D6D5E535',
          ViewerProtocolPolicy: 'allow-all',
        },
        CacheBehaviors: [{
          CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6',
          Compress: true,
          PathPattern: 'api/*',
          TargetOriginId: 'StackMyDistOrigin20B96F3AD',
          ViewerProtocolPolicy: 'allow-all',
        }],
        Enabled: true,
        HttpVersion: 'http2',
        IPV6Enabled: true,
        Origins: [{
          DomainName: 'www.example.com',
          Id: 'StackMyDistOrigin1D6D5E535',
          CustomOriginConfig: {
            OriginProtocolPolicy: 'https-only',
          },
        },
        {
          DomainName: 'origin2.example.com',
          Id: 'StackMyDistOrigin20B96F3AD',
          CustomOriginConfig: {
            OriginProtocolPolicy: 'https-only',
          },
        }],
      },
    });
  });

  test('behavior creation order is preserved', () => {
    const origin = defaultOrigin();
    const origin2 = defaultOrigin('origin2.example.com');
    const dist = new Distribution(stack, 'MyDist', {
      defaultBehavior: { origin },
      additionalBehaviors: {
        'api/1*': { origin: origin2 },
      },
    });
    dist.addBehavior('api/2*', origin);

    expect(stack).toHaveResource('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        DefaultCacheBehavior: {
          CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6',
          Compress: true,
          TargetOriginId: 'StackMyDistOrigin1D6D5E535',
          ViewerProtocolPolicy: 'allow-all',
        },
        CacheBehaviors: [{
          CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6',
          Compress: true,
          PathPattern: 'api/1*',
          TargetOriginId: 'StackMyDistOrigin20B96F3AD',
          ViewerProtocolPolicy: 'allow-all',
        },
        {
          CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6',
          Compress: true,
          PathPattern: 'api/2*',
          TargetOriginId: 'StackMyDistOrigin1D6D5E535',
          ViewerProtocolPolicy: 'allow-all',
        }],
        Enabled: true,
        HttpVersion: 'http2',
        IPV6Enabled: true,
        Origins: [{
          DomainName: 'www.example.com',
          Id: 'StackMyDistOrigin1D6D5E535',
          CustomOriginConfig: {
            OriginProtocolPolicy: 'https-only',
          },
        },
        {
          DomainName: 'origin2.example.com',
          Id: 'StackMyDistOrigin20B96F3AD',
          CustomOriginConfig: {
            OriginProtocolPolicy: 'https-only',
          },
        }],
      },
    });
  });
});

describe('certificates', () => {
  test('should fail if using an imported certificate from outside of us-east-1', () => {
    const origin = defaultOrigin();
    const certificate = acm.Certificate.fromCertificateArn(stack, 'Cert', 'arn:aws:acm:eu-west-1:123456789012:certificate/12345678-1234-1234-1234-123456789012');

    expect(() => {
      new Distribution(stack, 'Dist', {
        defaultBehavior: { origin },
        certificate,
      });
    }).toThrow(/Distribution certificates must be in the us-east-1 region and the certificate you provided is in eu-west-1./);
  });

  test('adding a certificate without a domain name throws', () => {
    const certificate = acm.Certificate.fromCertificateArn(stack, 'Cert', 'arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012');

    expect(() => {
      new Distribution(stack, 'Dist1', {
        defaultBehavior: { origin: defaultOrigin() },
        certificate,
      });
    }).toThrow(/Must specify at least one domain name/);

    expect(() => {
      new Distribution(stack, 'Dist2', {
        defaultBehavior: { origin: defaultOrigin() },
        domainNames: [],
        certificate,
      });
    }).toThrow(/Must specify at least one domain name/);
  });

  test('adding a certificate and domain renders the correct ViewerCertificate and Aliases property', () => {
    const certificate = acm.Certificate.fromCertificateArn(stack, 'Cert', 'arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012');

    new Distribution(stack, 'Dist', {
      defaultBehavior: { origin: defaultOrigin() },
      domainNames: ['example.com', 'www.example.com'],
      certificate,
    });

    expect(stack).toHaveResourceLike('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        Aliases: ['example.com', 'www.example.com'],
        ViewerCertificate: {
          AcmCertificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012',
          SslSupportMethod: 'sni-only',
          MinimumProtocolVersion: 'TLSv1.2_2019',
        },
      },
    });
  });

  test('adding a certificate with non default security policy protocol', () => {
    const certificate = acm.Certificate.fromCertificateArn(stack, 'Cert', 'arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012');
    new Distribution(stack, 'Dist', {
      defaultBehavior: { origin: defaultOrigin() },
      domainNames: ['www.example.com'],
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2016,
      certificate: certificate,
    });

    expect(stack).toHaveResourceLike('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        ViewerCertificate: {
          AcmCertificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012',
          SslSupportMethod: 'sni-only',
          MinimumProtocolVersion: 'TLSv1_2016',
        },
      },
    });
  });
});

describe('custom error responses', () => {
  test('should fail if only the error code is provided', () => {
    const origin = defaultOrigin();

    expect(() => {
      new Distribution(stack, 'Dist', {
        defaultBehavior: { origin },
        errorResponses: [{ httpStatus: 404 }],
      });
    }).toThrow(/A custom error response without either a \'responseHttpStatus\', \'ttl\' or \'responsePagePath\' is not valid./);
  });

  test('should render the array of error configs if provided', () => {
    const origin = defaultOrigin();
    new Distribution(stack, 'Dist', {
      defaultBehavior: { origin },
      errorResponses: [{
        // responseHttpStatus defaults to httpsStatus
        httpStatus: 404,
        responsePagePath: '/errors/404.html',
      },
      {
        // without responsePagePath
        httpStatus: 500,
        ttl: Duration.seconds(2),
      },
      {
        // with responseHttpStatus different from httpStatus
        httpStatus: 403,
        responseHttpStatus: 200,
        responsePagePath: '/index.html',
      }],
    });

    expect(stack).toHaveResourceLike('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        CustomErrorResponses: [
          {
            ErrorCode: 404,
            ResponseCode: 404,
            ResponsePagePath: '/errors/404.html',
          },
          {
            ErrorCachingMinTTL: 2,
            ErrorCode: 500,
          },
          {
            ErrorCode: 403,
            ResponseCode: 200,
            ResponsePagePath: '/index.html',
          },
        ],
      },
    });
  });
});

describe('logging', () => {
  test('does not include logging if disabled and no bucket provided', () => {
    const origin = defaultOrigin();
    new Distribution(stack, 'MyDist', { defaultBehavior: { origin } });

    expect(stack).toHaveResourceLike('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        Logging: ABSENT,
      },
    });
  });

  test('throws error if logging disabled but bucket provided', () => {
    const origin = defaultOrigin();

    expect(() => {
      new Distribution(stack, 'MyDist', {
        defaultBehavior: { origin },
        enableLogging: false,
        logBucket: new s3.Bucket(stack, 'Bucket'),
      });
    }).toThrow(/Explicitly disabled logging but provided a logging bucket./);
  });

  test('creates bucket if none is provided', () => {
    const origin = defaultOrigin();
    new Distribution(stack, 'MyDist', {
      defaultBehavior: { origin },
      enableLogging: true,
    });

    expect(stack).toHaveResourceLike('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        Logging: {
          Bucket: { 'Fn::GetAtt': ['MyDistLoggingBucket9B8976BC', 'RegionalDomainName'] },
        },
      },
    });
  });

  test('uses existing bucket if provided', () => {
    const origin = defaultOrigin();
    const loggingBucket = new s3.Bucket(stack, 'MyLoggingBucket');
    new Distribution(stack, 'MyDist', {
      defaultBehavior: { origin },
      logBucket: loggingBucket,
    });

    expect(stack).toHaveResourceLike('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        Logging: {
          Bucket: { 'Fn::GetAtt': ['MyLoggingBucket4382CD04', 'RegionalDomainName'] },
        },
      },
    });
  });

  test('can set prefix and cookies', () => {
    const origin = defaultOrigin();
    new Distribution(stack, 'MyDist', {
      defaultBehavior: { origin },
      enableLogging: true,
      logFilePrefix: 'logs/',
      logIncludesCookies: true,
    });

    expect(stack).toHaveResourceLike('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        Logging: {
          Bucket: { 'Fn::GetAtt': ['MyDistLoggingBucket9B8976BC', 'RegionalDomainName'] },
          IncludeCookies: true,
          Prefix: 'logs/',
        },
      },
    });
  });
});

describe('with Lambda@Edge functions', () => {
  let lambdaFunction: lambda.Function;
  let origin: IOrigin;

  beforeEach(() => {
    lambdaFunction = new lambda.Function(stack, 'Function', {
      runtime: lambda.Runtime.NODEJS,
      code: lambda.Code.fromInline('whatever'),
      handler: 'index.handler',
    });

    origin = defaultOrigin();
  });

  test('can add an edge lambdas to the default behavior', () => {
    new Distribution(stack, 'MyDist', {
      defaultBehavior: {
        origin,
        edgeLambdas: [
          {
            functionVersion: lambdaFunction.currentVersion,
            eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
            includeBody: true,
          },
        ],
      },
    });

    expect(stack).toHaveResourceLike('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        DefaultCacheBehavior: {
          LambdaFunctionAssociations: [
            {
              EventType: 'origin-request',
              IncludeBody: true,
              LambdaFunctionARN: {
                Ref: 'FunctionCurrentVersion4E2B2261477a5ae8059bbaa7813f752292c0f65e',
              },
            },
          ],
        },
      },
    });
  });

  test('edgelambda.amazonaws.com is added to the trust policy of lambda', () => {
    new Distribution(stack, 'MyDist', {
      defaultBehavior: {
        origin,
        edgeLambdas: [
          {
            functionVersion: lambdaFunction.currentVersion,
            eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
          },
        ],
      },
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
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'edgelambda.amazonaws.com',
            },
          },
        ],
        Version: '2012-10-17',
      },
    });
  });

  test('can add an edge lambdas to additional behaviors', () => {
    new Distribution(stack, 'MyDist', {
      defaultBehavior: { origin },
      additionalBehaviors: {
        'images/*': {
          origin,
          edgeLambdas: [
            {
              functionVersion: lambdaFunction.currentVersion,
              eventType: LambdaEdgeEventType.VIEWER_REQUEST,
            },
          ],
        },
      },
    });

    expect(stack).toHaveResourceLike('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        CacheBehaviors: [
          {
            PathPattern: 'images/*',
            LambdaFunctionAssociations: [
              {
                EventType: 'viewer-request',
                LambdaFunctionARN: {
                  Ref: 'FunctionCurrentVersion4E2B2261477a5ae8059bbaa7813f752292c0f65e',
                },
              },
            ],
          },
        ],
      },
    });
  });

  test('fails creation when attempting to add the $LATEST function version as an edge Lambda to the default behavior', () => {
    expect(() => {
      new Distribution(stack, 'MyDist', {
        defaultBehavior: {
          origin,
          edgeLambdas: [
            {
              functionVersion: lambdaFunction.latestVersion,
              eventType: LambdaEdgeEventType.ORIGIN_RESPONSE,
            },
          ],
        },
      });
    }).toThrow(/\$LATEST function version cannot be used for Lambda@Edge/);
  });

  test('with removable env vars', () => {
    const envLambdaFunction = new lambda.Function(stack, 'EnvFunction', {
      runtime: lambda.Runtime.NODEJS,
      code: lambda.Code.fromInline('whateverwithenv'),
      handler: 'index.handler',
    });
    envLambdaFunction.addEnvironment('KEY', 'value', { removeInEdge: true });

    new Distribution(stack, 'MyDist', {
      defaultBehavior: {
        origin,
        edgeLambdas: [
          {
            functionVersion: envLambdaFunction.currentVersion,
            eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
          },
        ],
      },
    });

    expect(stack).toHaveResource('AWS::Lambda::Function', {
      Environment: ABSENT,
      Code: {
        ZipFile: 'whateverwithenv',
      },
    });
  });

  test('with incompatible env vars', () => {
    const envLambdaFunction = new lambda.Function(stack, 'EnvFunction', {
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.fromInline('whateverwithenv'),
      handler: 'index.handler',
      environment: {
        KEY: 'value',
      },
    });

    new Distribution(stack, 'MyDist', {
      defaultBehavior: {
        origin,
        edgeLambdas: [
          {
            functionVersion: envLambdaFunction.currentVersion,
            eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
          },
        ],
      },
    });

    expect(() => app.synth()).toThrow(/KEY/);
  });

  test('with singleton function', () => {
    const singleton = new lambda.SingletonFunction(stack, 'Singleton', {
      uuid: 'singleton-for-cloudfront',
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.fromInline('code'),
      handler: 'index.handler',
    });

    new Distribution(stack, 'MyDist', {
      defaultBehavior: {
        origin,
        edgeLambdas: [
          {
            functionVersion: singleton.currentVersion,
            eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
          },
        ],
      },
    });

    expect(stack).toHaveResourceLike('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        DefaultCacheBehavior: {
          LambdaFunctionAssociations: [
            {
              EventType: 'origin-request',
              LambdaFunctionARN: {
                Ref: 'SingletonLambdasingletonforcloudfrontCurrentVersion0078406348a0962a52448a200cd0dbc0e22edb2a',
              },
            },
          ],
        },
      },
    });
  });
});

describe('with CloudFront functions', () => {
  test('can add a CloudFront function to the default behavior', () => {
    new Distribution(stack, 'MyDist', {
      defaultBehavior: {
        origin: defaultOrigin(),
        functionAssociations: [
          {
            eventType: FunctionEventType.VIEWER_REQUEST,
            function: new Function(stack, 'TestFunction', {
              code: FunctionCode.fromInline('foo'),
            }),
          },
        ],
      },
    });

    expect(stack).toHaveResourceLike('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        DefaultCacheBehavior: {
          FunctionAssociations: [
            {
              EventType: 'viewer-request',
              FunctionARN: {
                'Fn::GetAtt': [
                  'TestFunction22AD90FC',
                  'FunctionARN',
                ],
              },
            },
          ],
        },
      },
    });
  });
});

test('price class is included if provided', () => {
  const origin = defaultOrigin();
  new Distribution(stack, 'Dist', {
    defaultBehavior: { origin },
    priceClass: PriceClass.PRICE_CLASS_200,
  });

  expect(stack).toHaveResourceLike('AWS::CloudFront::Distribution', {
    DistributionConfig: {
      PriceClass: 'PriceClass_200',
    },
  });
});

test('escape hatches are supported', () => {
  const dist = new Distribution(stack, 'Dist', {
    defaultBehavior: { origin: defaultOrigin },
  });
  const cfnDist = dist.node.defaultChild as CfnDistribution;
  cfnDist.addPropertyOverride('DistributionConfig.DefaultCacheBehavior.ForwardedValues.Headers', ['*']);

  expect(stack).toHaveResourceLike('AWS::CloudFront::Distribution', {
    DistributionConfig: {
      DefaultCacheBehavior: {
        ForwardedValues: {
          Headers: ['*'],
        },
      },
    },
  });
});

describe('origin IDs', () => {
  test('origin ID is limited to 128 characters', () => {
    const nestedStack = new Stack(stack, 'LongNameThatWillEndUpGeneratingAUniqueNodeIdThatIsLongerThanTheOneHundredAndTwentyEightCharacterLimit');

    new Distribution(nestedStack, 'AReallyAwesomeDistributionWithAMemorableNameThatIWillNeverForget', {
      defaultBehavior: { origin: defaultOrigin() },
    });

    expect(nestedStack).toHaveResourceLike('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        Origins: [objectLike({
          Id: 'ngerThanTheOneHundredAndTwentyEightCharacterLimitAReallyAwesomeDistributionWithAMemorableNameThatIWillNeverForgetOrigin1D38031F9',
        })],
      },
    });
  });

  test('origin group ID is limited to 128 characters', () => {
    const nestedStack = new Stack(stack, 'LongNameThatWillEndUpGeneratingAUniqueNodeIdThatIsLongerThanTheOneHundredAndTwentyEightCharacterLimit');

    new Distribution(nestedStack, 'AReallyAwesomeDistributionWithAMemorableNameThatIWillNeverForget', {
      defaultBehavior: { origin: defaultOriginGroup() },
    });

    expect(nestedStack).toHaveResourceLike('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        OriginGroups: {
          Items: [objectLike({
            Id: 'hanTheOneHundredAndTwentyEightCharacterLimitAReallyAwesomeDistributionWithAMemorableNameThatIWillNeverForgetOriginGroup1B5CE3FE6',
          })],
        },
      },
    });
  });
});
