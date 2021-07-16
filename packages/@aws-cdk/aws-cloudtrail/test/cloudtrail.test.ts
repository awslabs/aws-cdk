import { ABSENT, SynthUtils } from '@aws-cdk/assert-internal';
import '@aws-cdk/assert-internal/jest';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import * as lambda from '@aws-cdk/aws-lambda';
import { LogGroup, RetentionDays } from '@aws-cdk/aws-logs';
import * as s3 from '@aws-cdk/aws-s3';
import * as sns from '@aws-cdk/aws-sns';
import { Stack } from '@aws-cdk/core';
import { ReadWriteType, Trail } from '../lib';

const ExpectedBucketPolicyProperties = {
  PolicyDocument: {
    Statement: [
      {
        Action: 's3:GetBucketAcl',
        Effect: 'Allow',
        Principal: {
          Service: 'cloudtrail.amazonaws.com',
        },
        Resource: {
          'Fn::GetAtt': [
            'MyAmazingCloudTrailS3A580FE27',
            'Arn',
          ],
        },
      },
      {
        Action: 's3:PutObject',
        Condition: {
          StringEquals: {
            's3:x-amz-acl': 'bucket-owner-full-control',
          },
        },
        Effect: 'Allow',
        Principal: {
          Service: 'cloudtrail.amazonaws.com',
        },
        Resource: {
          'Fn::Join': [
            '',
            [
              {
                'Fn::GetAtt': [
                  'MyAmazingCloudTrailS3A580FE27',
                  'Arn',
                ],
              },
              '/AWSLogs/123456789012/*',
            ],
          ],
        },
      },
    ],
    Version: '2012-10-17',
  },
};

const logsRolePolicyName = 'MyAmazingCloudTrailLogsRoleDefaultPolicy61DC49E7';
const logsRoleName = 'MyAmazingCloudTrailLogsRoleF2CCF977';

function getTestStack(): Stack {
  return new Stack(undefined, 'TestStack', { env: { account: '123456789012', region: 'us-east-1' } });
}

describe('cloudtrail', () => {
  describe('constructs the expected resources', () => {
    test('with no properties', () => {
      const stack = getTestStack();
      new Trail(stack, 'MyAmazingCloudTrail');
      expect(stack).toHaveResource('AWS::CloudTrail::Trail');
      expect(stack).toHaveResource('AWS::S3::Bucket');
      expect(stack).toHaveResource('AWS::S3::BucketPolicy', ExpectedBucketPolicyProperties);
      expect(stack).not.toHaveResource('AWS::Logs::LogGroup');
      const trail: any = SynthUtils.synthesize(stack).template.Resources.MyAmazingCloudTrail54516E8D;
      expect(trail.DependsOn).toEqual(['MyAmazingCloudTrailS3Policy39C120B0']);
    });

    test('with s3bucket', () => {
      const stack = getTestStack();
      const Trailbucket = new s3.Bucket(stack, 'S3');
      const cloudTrailPrincipal = new iam.ServicePrincipal('cloudtrail.amazonaws.com');
      Trailbucket.addToResourcePolicy(new iam.PolicyStatement({
        resources: [Trailbucket.bucketArn],
        actions: ['s3:GetBucketAcl'],
        principals: [cloudTrailPrincipal],
      }));

      Trailbucket.addToResourcePolicy(new iam.PolicyStatement({
        resources: [Trailbucket.arnForObjects(`AWSLogs/${Stack.of(stack).account}/*`)],
        actions: ['s3:PutObject'],
        principals: [cloudTrailPrincipal],
        conditions: {
          StringEquals: { 's3:x-amz-acl': 'bucket-owner-full-control' },
        },
      }));

      new Trail(stack, 'Trail', { bucket: Trailbucket });

      expect(stack).toHaveResource('AWS::CloudTrail::Trail');
      expect(stack).toHaveResource('AWS::S3::Bucket');
      expect(stack).toHaveResource('AWS::S3::BucketPolicy');
      expect(stack).not.toHaveResource('AWS::Logs::LogGroup');
    });

    test('with sns topic', () => {
      const stack = getTestStack();
      const topic = new sns.Topic(stack, 'Topic');


      new Trail(stack, 'Trail', { snsTopic: topic });

      expect(stack).toHaveResource('AWS::CloudTrail::Trail');
      expect(stack).not.toHaveResource('AWS::Logs::LogGroup');
      expect(stack).toHaveResource('AWS::SNS::TopicPolicy', {
        PolicyDocument: {
          Statement: [
            {
              Action: 'sns:Publish',
              Effect: 'Allow',
              Principal: { Service: 'cloudtrail.amazonaws.com' },
              Resource: { Ref: 'TopicBFC7AF6E' },
              Sid: '0',
            },
          ],
          Version: '2012-10-17',
        },
      });
    });

    test('with imported s3 bucket', () => {
      // GIVEN
      const stack = getTestStack();
      const bucket = s3.Bucket.fromBucketName(stack, 'S3', 'SomeBucket');

      // WHEN
      new Trail(stack, 'Trail', { bucket });

      expect(stack).toHaveResource('AWS::CloudTrail::Trail', {
        S3BucketName: 'SomeBucket',
      });
    });

    test('with s3KeyPrefix', () => {
      // GIVEN
      const stack = getTestStack();

      // WHEN
      new Trail(stack, 'Trail', { s3KeyPrefix: 'someprefix' });

      expect(stack).toHaveResource('AWS::CloudTrail::Trail');
      expect(stack).toHaveResource('AWS::S3::Bucket');
      expect(stack).toHaveResource('AWS::S3::BucketPolicy', {
        Bucket: { Ref: 'TrailS30071F172' },
        PolicyDocument: {
          Statement: [
            {
              Action: 's3:GetBucketAcl',
              Effect: 'Allow',
              Principal: { Service: 'cloudtrail.amazonaws.com' },
              Resource: { 'Fn::GetAtt': ['TrailS30071F172', 'Arn'] },
            },
            {
              Action: 's3:PutObject',
              Condition: {
                StringEquals: { 's3:x-amz-acl': 'bucket-owner-full-control' },
              },
              Effect: 'Allow',
              Principal: { Service: 'cloudtrail.amazonaws.com' },
              Resource: {
                'Fn::Join': [
                  '',
                  [
                    { 'Fn::GetAtt': ['TrailS30071F172', 'Arn'] },
                    '/someprefix/AWSLogs/123456789012/*',
                  ],
                ],
              },
            },
          ],
          Version: '2012-10-17',
        },
      });
    });

    test('encryption keys', () => {
      const stack = new Stack();
      const key = new kms.Key(stack, 'key');
      new Trail(stack, 'EncryptionKeyTrail', {
        trailName: 'EncryptionKeyTrail',
        encryptionKey: key,
      });
      new Trail(stack, 'KmsKeyTrail', {
        trailName: 'KmsKeyTrail',
        kmsKey: key,
      });
      new Trail(stack, 'UnencryptedTrail', {
        trailName: 'UnencryptedTrail',
      });
      expect(() => new Trail(stack, 'ErrorTrail', {
        trailName: 'ErrorTrail',
        encryptionKey: key,
        kmsKey: key,
      })).toThrow(/Both kmsKey and encryptionKey must not be specified/);

      expect(stack).toHaveResource('AWS::CloudTrail::Trail', {
        TrailName: 'EncryptionKeyTrail',
        KMSKeyId: {
          'Fn::GetAtt': ['keyFEDD6EC0', 'Arn'],
        },
      });
      expect(stack).toHaveResource('AWS::CloudTrail::Trail', {
        TrailName: 'KmsKeyTrail',
        KMSKeyId: {
          'Fn::GetAtt': ['keyFEDD6EC0', 'Arn'],
        },
      });
      expect(stack).toHaveResource('AWS::CloudTrail::Trail', {
        TrailName: 'UnencryptedTrail',
        KMSKeyId: ABSENT,
      });
    });

    describe('with cloud watch logs', () => {
      test('enabled', () => {
        const stack = getTestStack();
        new Trail(stack, 'MyAmazingCloudTrail', {
          sendToCloudWatchLogs: true,
        });

        expect(stack).toHaveResource('AWS::CloudTrail::Trail');
        expect(stack).toHaveResource('AWS::S3::Bucket');
        expect(stack).toHaveResource('AWS::S3::BucketPolicy', ExpectedBucketPolicyProperties);
        expect(stack).toHaveResource('AWS::Logs::LogGroup');
        expect(stack).toHaveResource('AWS::IAM::Role');
        expect(stack).toHaveResource('AWS::Logs::LogGroup', { RetentionInDays: 365 });
        expect(stack).toHaveResource('AWS::IAM::Policy', {
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow',
              Action: ['logs:PutLogEvents', 'logs:CreateLogStream'],
              Resource: {
                'Fn::GetAtt': ['MyAmazingCloudTrailLogGroup2BE67F87', 'Arn'],
              },
            }],
          },
          PolicyName: logsRolePolicyName,
          Roles: [{ Ref: 'MyAmazingCloudTrailLogsRoleF2CCF977' }],
        });
        const trail: any = SynthUtils.synthesize(stack).template.Resources.MyAmazingCloudTrail54516E8D;
        expect(trail.DependsOn).toEqual([logsRolePolicyName, logsRoleName, 'MyAmazingCloudTrailS3Policy39C120B0']);
      });

      test('enabled and custom retention', () => {
        const stack = getTestStack();
        new Trail(stack, 'MyAmazingCloudTrail', {
          cloudWatchLogsRetention: RetentionDays.ONE_WEEK,
        });

        expect(stack).toHaveResource('AWS::CloudTrail::Trail');
        expect(stack).toHaveResource('AWS::S3::Bucket');
        expect(stack).toHaveResource('AWS::S3::BucketPolicy', ExpectedBucketPolicyProperties);
        expect(stack).toHaveResource('AWS::Logs::LogGroup');
        expect(stack).toHaveResource('AWS::IAM::Role');
        expect(stack).toHaveResource('AWS::Logs::LogGroup', {
          RetentionInDays: 7,
        });
        const trail: any = SynthUtils.synthesize(stack).template.Resources.MyAmazingCloudTrail54516E8D;
        expect(trail.DependsOn).toEqual([logsRolePolicyName, logsRoleName, 'MyAmazingCloudTrailS3Policy39C120B0']);
      });

      test('enabled and with custom log group', () => {
        const stack = getTestStack();
        const cloudWatchLogGroup = new LogGroup(stack, 'MyLogGroup', {
          retention: RetentionDays.FIVE_DAYS,
        });
        new Trail(stack, 'MyAmazingCloudTrail', {
          cloudWatchLogsRetention: RetentionDays.ONE_WEEK,
          cloudWatchLogGroup,
        });

        expect(stack).toHaveResource('AWS::Logs::LogGroup', {
          RetentionInDays: 5,
        });

        expect(stack).toHaveResource('AWS::CloudTrail::Trail', {
          CloudWatchLogsLogGroupArn: stack.resolve(cloudWatchLogGroup.logGroupArn),
        });

        expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
          PolicyDocument: {
            Statement: [{
              Resource: stack.resolve(cloudWatchLogGroup.logGroupArn),
            }],
          },
        });
      });

      test('enabled and with custom role', () => {
        const stack = getTestStack();

        const cloudTrailPrincipal = new iam.ServicePrincipal('cloudtrail.amazonaws.com');
        const logsRole = new iam.Role(stack, 'TestRole', { assumedBy: cloudTrailPrincipal });

        new Trail(stack, 'MyAmazingCloudTrail', {
          cloudWatchLogsRole: logsRole,
        });

        expect(stack).toHaveResource('AWS::CloudTrail::Trail', {
          CloudWatchLogsRoleArn: stack.resolve(logsRole.roleArn),
        });

        expect(stack).toHaveResource('AWS::IAM::Role', {
          AssumeRolePolicyDocument: {
            Statement: [
              {
                Action: 'sts:AssumeRole',
                Effect: 'Allow',
                Principal: {
                  Service: 'cloudtrail.amazonaws.com',
                },
              },
            ],
            Version: '2012-10-17',
          },
        });
        expect(stack).toCountResources('AWS::IAM::Role', 1);
      });

      test('disabled', () => {
        const stack = getTestStack();
        const t = new Trail(stack, 'MyAmazingCloudTrail', {
          sendToCloudWatchLogs: false,
          cloudWatchLogsRetention: RetentionDays.ONE_WEEK,
        });
        expect(t.logGroup).toBeUndefined();
        expect(stack).not.toHaveResource('AWS::Logs::LogGroup');
      });
    });

    describe('with event selectors', () => {
      test('all s3 events', () => {
        const stack = getTestStack();

        const cloudTrail = new Trail(stack, 'MyAmazingCloudTrail');
        cloudTrail.logAllS3DataEvents();

        expect(stack).toHaveResourceLike('AWS::CloudTrail::Trail', {
          EventSelectors: [
            {
              DataResources: [{
                Type: 'AWS::S3::Object',
                Values: [
                  {
                    'Fn::Join': [
                      '',
                      [
                        'arn:',
                        {
                          Ref: 'AWS::Partition',
                        },
                        ':s3:::',
                      ],
                    ],
                  },
                ],
              }],
              IncludeManagementEvents: ABSENT,
              ReadWriteType: ABSENT,
            },
          ],
        });
      });

      test('specific s3 buckets and objects', () => {
        const stack = getTestStack();
        const bucket = new s3.Bucket(stack, 'testBucket', { bucketName: 'test-bucket' });

        const cloudTrail = new Trail(stack, 'MyAmazingCloudTrail');
        cloudTrail.addS3EventSelector([{ bucket }]);
        cloudTrail.addS3EventSelector([{
          bucket,
          objectPrefix: 'prefix-1/prefix-2',
        }]);

        expect(stack).toHaveResourceLike('AWS::CloudTrail::Trail', {
          EventSelectors: [
            {
              DataResources: [{
                Type: 'AWS::S3::Object',
                Values: [{
                  'Fn::Join': [
                    '',
                    [
                      { 'Fn::GetAtt': ['testBucketDF4D7D1A', 'Arn'] },
                      '/',
                    ],
                  ],
                }],
              }],
            },
            {
              DataResources: [{
                Type: 'AWS::S3::Object',
                Values: [{
                  'Fn::Join': [
                    '',
                    [
                      { 'Fn::GetAtt': ['testBucketDF4D7D1A', 'Arn'] },
                      '/prefix-1/prefix-2',
                    ],
                  ],
                }],
              }],
            },
          ],
        });
      });

      test('no s3 event selector when list is empty', () => {
        const stack = getTestStack();
        const cloudTrail = new Trail(stack, 'MyAmazingCloudTrail');
        cloudTrail.addS3EventSelector([]);
        expect(stack).toHaveResourceLike('AWS::CloudTrail::Trail', {
          EventSelectors: [],
        });
      });

      test('with hand-specified props', () => {
        const stack = getTestStack();

        const cloudTrail = new Trail(stack, 'MyAmazingCloudTrail');
        cloudTrail.logAllS3DataEvents({ includeManagementEvents: false, readWriteType: ReadWriteType.READ_ONLY });

        expect(stack).toHaveResourceLike('AWS::CloudTrail::Trail', {
          EventSelectors: [
            {
              DataResources: [{
                Type: 'AWS::S3::Object',
                Values: [
                  {
                    'Fn::Join': [
                      '',
                      [
                        'arn:',
                        {
                          Ref: 'AWS::Partition',
                        },
                        ':s3:::',
                      ],
                    ],
                  },
                ],
              }],
              IncludeManagementEvents: false,
              ReadWriteType: 'ReadOnly',
            },
          ],
        });
      });

      test('with management event', () => {
        const stack = getTestStack();

        new Trail(stack, 'MyAmazingCloudTrail', { managementEvents: ReadWriteType.WRITE_ONLY });

        expect(stack).toHaveResourceLike('AWS::CloudTrail::Trail', {
          EventSelectors: [
            {
              IncludeManagementEvents: true,
              ReadWriteType: 'WriteOnly',
            },
          ],
        });
      });

      test('for Lambda function data event', () => {
        const stack = getTestStack();
        const lambdaFunction = new lambda.Function(stack, 'LambdaFunction', {
          runtime: lambda.Runtime.NODEJS_10_X,
          handler: 'hello.handler',
          code: lambda.Code.fromInline('exports.handler = {}'),
        });

        const cloudTrail = new Trail(stack, 'MyAmazingCloudTrail');
        cloudTrail.addLambdaEventSelector([lambdaFunction]);

        expect(stack).toHaveResourceLike('AWS::CloudTrail::Trail', {
          EventSelectors: [
            {
              DataResources: [{
                Type: 'AWS::Lambda::Function',
                Values: [{
                  'Fn::GetAtt': ['LambdaFunctionBF21E41F', 'Arn'],
                }],
              }],
            },
          ],
        });
      });

      test('for all Lambda function data events', () => {
        const stack = getTestStack();

        const cloudTrail = new Trail(stack, 'MyAmazingCloudTrail');
        cloudTrail.logAllLambdaDataEvents();

        expect(stack).toHaveResourceLike('AWS::CloudTrail::Trail', {
          EventSelectors: [
            {
              DataResources: [{
                Type: 'AWS::Lambda::Function',
                Values: [
                  {
                    'Fn::Join': [
                      '',
                      [
                        'arn:',
                        {
                          Ref: 'AWS::Partition',
                        },
                        ':lambda',
                      ],
                    ],
                  },
                ],
              }],
            },
          ],
        });
      });

      test('managementEvents set to None correctly turns off management events', () => {
        const stack = getTestStack();

        new Trail(stack, 'MyAmazingCloudTrail', {
          managementEvents: ReadWriteType.NONE,
        });

        expect(stack).toHaveResourceLike('AWS::CloudTrail::Trail', {
          EventSelectors: [
            {
              IncludeManagementEvents: false,
            },
          ],
        });
      });
    });
  });

  describe('onEvent', () => {
    test('add an event rule', () => {
      // GIVEN
      const stack = getTestStack();

      // WHEN
      Trail.onEvent(stack, 'DoEvents', {
        target: {
          bind: () => ({
            id: '',
            arn: 'arn',
          }),
        },
      });

      // THEN
      expect(stack).toHaveResource('AWS::Events::Rule', {
        EventPattern: {
          'detail-type': [
            'AWS API Call via CloudTrail',
          ],
        },
        State: 'ENABLED',
        Targets: [
          {
            Arn: 'arn',
            Id: 'Target0',
          },
        ],
      });
    });
  });
});