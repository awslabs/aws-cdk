import '@aws-cdk/assert-internal/jest';
import * as iam from '@aws-cdk/aws-iam';
import * as firehose from '@aws-cdk/aws-kinesisfirehose';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import * as firehosedestinations from '../lib';

describe('S3 destination', () => {
  let stack: cdk.Stack;
  let bucket: s3.IBucket;
  let deliveryStreamRole: iam.IRole;
  let deliveryStream: firehose.IDeliveryStream;

  beforeEach(() => {
    stack = new cdk.Stack();
    bucket = new s3.Bucket(stack, 'destination');
    deliveryStreamRole = iam.Role.fromRoleArn(stack, 'Delivery Stream Role', 'arn:aws:iam::111122223333:role/DeliveryStreamRole');
    deliveryStream = firehose.DeliveryStream.fromDeliveryStreamAttributes(stack, 'Delivery Stream', {
      deliveryStreamName: 'mydeliverystream',
      role: deliveryStreamRole,
    });
  });

  it('provides defaults when no configuration is provided', () => {
    const destination = new firehosedestinations.S3(bucket);

    const destinationProperties = destination.bind(stack, { deliveryStream }).properties;

    expect(stack.resolve(destinationProperties)).toStrictEqual({
      extendedS3DestinationConfiguration: {
        bucketArn: stack.resolve(bucket.bucketArn),
        cloudWatchLoggingOptions: {
          enabled: true,
          logGroupName: {
            Ref: 'LogGroupF5B46931',
          },
          logStreamName: {
            Ref: 'LogGroupS3Destination70CE1003',
          },
        },
        roleArn: stack.resolve(deliveryStreamRole.roleArn),
      },
    });
  });

  it('allows full configuration', () => {
    const destination = new firehosedestinations.S3(bucket, {
      logging: true,
      compression: firehose.Compression.ZIP,
      prefix: 'regularPrefix',
      errorOutputPrefix: 'errorPrefix',
      bufferingInterval: cdk.Duration.seconds(60),
      bufferingSize: cdk.Size.mebibytes(1),
    });

    const destinationProperties = destination.bind(stack, { deliveryStream }).properties;

    expect(stack.resolve(destinationProperties)).toStrictEqual({
      extendedS3DestinationConfiguration: {
        bucketArn: stack.resolve(bucket.bucketArn),
        bufferingHints: {
          intervalInSeconds: 60,
          sizeInMBs: 1,
        },
        cloudWatchLoggingOptions: {
          enabled: true,
          logGroupName: {
            Ref: 'LogGroupF5B46931',
          },
          logStreamName: {
            Ref: 'LogGroupS3Destination70CE1003',
          },
        },
        prefix: 'regularPrefix',
        errorOutputPrefix: 'errorPrefix',
        compressionFormat: 'ZIP',
        roleArn: deliveryStreamRole.roleArn,
      },
    });
  });

  it('grants read/write access to the bucket', () => {
    const destination = new firehosedestinations.S3(bucket);

    destination.bind(stack, { deliveryStream });

    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      Roles: ['DeliveryStreamRole'],
      PolicyDocument: {
        Statement: [
          {
            Action: [
              's3:GetObject*',
              's3:GetBucket*',
              's3:List*',
              's3:DeleteObject*',
              's3:PutObject*',
              's3:Abort*',
            ],
            Effect: 'Allow',
            Resource: [
              {
                'Fn::GetAtt': [
                  'destinationDB878FB5',
                  'Arn',
                ],
              },
              {
                'Fn::Join': [
                  '',
                  [
                    {
                      'Fn::GetAtt': [
                        'destinationDB878FB5',
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
      },
    });
  });
});
