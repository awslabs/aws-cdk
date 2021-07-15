import { expect, haveResource } from '@aws-cdk/assert-internal';
import { AnyPrincipal, PolicyStatement } from '@aws-cdk/aws-iam';
import { RemovalPolicy, Stack, App } from '@aws-cdk/core';
import { nodeunitShim, Test } from 'nodeunit-shim';
import * as s3 from '../lib';

// to make it easy to copy & paste from output:
/* eslint-disable quote-props */

nodeunitShim({
  'default properties'(test: Test) {
    const stack = new Stack();

    const myBucket = new s3.Bucket(stack, 'MyBucket');
    const myBucketPolicy = new s3.BucketPolicy(stack, 'MyBucketPolicy', {
      bucket: myBucket,
    });
    myBucketPolicy.document.addStatements(new PolicyStatement({
      resources: [myBucket.bucketArn],
      actions: ['s3:GetObject*'],
      principals: [new AnyPrincipal()],
    }));

    expect(stack).to(haveResource('AWS::S3::BucketPolicy', {
      Bucket: {
        'Ref': 'MyBucketF68F3FF0',
      },
      PolicyDocument: {
        'Version': '2012-10-17',
        'Statement': [
          {
            'Action': 's3:GetObject*',
            'Effect': 'Allow',
            'Principal': { AWS: '*' },
            'Resource': { 'Fn::GetAtt': ['MyBucketF68F3FF0', 'Arn'] },
          },
        ],
      },
    }));

    test.done();
  },

  'when specifying a removalPolicy at creation'(test: Test) {
    const stack = new Stack();

    const myBucket = new s3.Bucket(stack, 'MyBucket');
    const myBucketPolicy = new s3.BucketPolicy(stack, 'MyBucketPolicy', {
      bucket: myBucket,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    myBucketPolicy.document.addStatements(new PolicyStatement({
      resources: [myBucket.bucketArn],
      actions: ['s3:GetObject*'],
      principals: [new AnyPrincipal()],
    }));

    expect(stack).toMatch({
      'Resources': {
        'MyBucketF68F3FF0': {
          'Type': 'AWS::S3::Bucket',
          'DeletionPolicy': 'Retain',
          'UpdateReplacePolicy': 'Retain',
        },
        'MyBucketPolicy0AFEFDBE': {
          'Type': 'AWS::S3::BucketPolicy',
          'Properties': {
            'Bucket': {
              'Ref': 'MyBucketF68F3FF0',
            },
            'PolicyDocument': {
              'Statement': [
                {
                  'Action': 's3:GetObject*',
                  'Effect': 'Allow',
                  'Principal': { AWS: '*' },
                  'Resource': { 'Fn::GetAtt': ['MyBucketF68F3FF0', 'Arn'] },
                },
              ],
              'Version': '2012-10-17',
            },
          },
          'DeletionPolicy': 'Retain',
          'UpdateReplacePolicy': 'Retain',
        },
      },
    });

    test.done();
  },

  'when specifying a removalPolicy after creation'(test: Test) {
    const stack = new Stack();

    const myBucket = new s3.Bucket(stack, 'MyBucket');
    myBucket.addToResourcePolicy(new PolicyStatement({
      resources: [myBucket.bucketArn],
      actions: ['s3:GetObject*'],
      principals: [new AnyPrincipal()],
    }));
    myBucket.policy?.applyRemovalPolicy(RemovalPolicy.RETAIN);

    expect(stack).toMatch({
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
                  'Action': 's3:GetObject*',
                  'Effect': 'Allow',
                  'Principal': { AWS: '*' },
                  'Resource': { 'Fn::GetAtt': ['MyBucketF68F3FF0', 'Arn'] },
                },
              ],
              'Version': '2012-10-17',
            },
          },
          'DeletionPolicy': 'Retain',
          'UpdateReplacePolicy': 'Retain',
        },
      },
    });

    test.done();
  },

  'fails if bucket policy has no actions'(test: Test) {
    const app = new App();
    const stack = new Stack(app, 'my-stack');
    const myBucket = new s3.Bucket(stack, 'MyBucket');
    myBucket.addToResourcePolicy(new PolicyStatement({
      resources: [myBucket.bucketArn],
      principals: [new AnyPrincipal()],
    }));

    test.throws(() => app.synth(), /A PolicyStatement must specify at least one \'action\' or \'notAction\'/);

    test.done();
  },

  'fails if bucket policy has no IAM principals'(test: Test) {
    const app = new App();
    const stack = new Stack(app, 'my-stack');
    const myBucket = new s3.Bucket(stack, 'MyBucket');
    myBucket.addToResourcePolicy(new PolicyStatement({
      resources: [myBucket.bucketArn],
      actions: ['s3:GetObject*'],
    }));

    test.throws(() => app.synth(), /A PolicyStatement used in a resource-based policy must specify at least one IAM principal/);

    test.done();
  },
});