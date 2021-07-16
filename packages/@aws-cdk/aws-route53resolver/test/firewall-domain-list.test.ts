import * as path from 'path';
import '@aws-cdk/assert-internal/jest';
import { Bucket } from '@aws-cdk/aws-s3';
import { Stack } from '@aws-cdk/core';
import { FirewallDomainList, FirewallDomains } from '../lib';

let stack: Stack;
beforeEach(() => {
  stack = new Stack();
});

test('domain list from strings', () => {
  // WHEN
  new FirewallDomainList(stack, 'List', {
    domains: FirewallDomains.fromList(['first-domain.com', 'second-domain.net']),
  });

  // THEN
  expect(stack).toHaveResource('AWS::Route53Resolver::FirewallDomainList', {
    Domains: [
      'first-domain.com',
      'second-domain.net',
    ],
  });
});

test('domain list from S3 URL', () => {
  // WHEN
  new FirewallDomainList(stack, 'List', {
    domains: FirewallDomains.fromS3Url('s3://bucket/prefix/object'),
  });

  // THEN
  expect(stack).toHaveResource('AWS::Route53Resolver::FirewallDomainList', {
    DomainFileUrl: 's3://bucket/prefix/object',
  });
});

test('domain list from S3', () => {
  // WHEN
  new FirewallDomainList(stack, 'List', {
    domains: FirewallDomains.fromS3(Bucket.fromBucketName(stack, 'Bucket', 'bucket'), 'prefix/object'),
  });

  // THEN
  expect(stack).toHaveResource('AWS::Route53Resolver::FirewallDomainList', {
    DomainFileUrl: 's3://bucket/prefix/object',
  });
});

test('domain list from asset', () => {
  // WHEN
  new FirewallDomainList(stack, 'List', {
    domains: FirewallDomains.fromAsset(path.join(__dirname, 'domains.txt')),
  });

  // THEN
  expect(stack).toHaveResource('AWS::Route53Resolver::FirewallDomainList', {
    DomainFileUrl: {
      'Fn::Join': [
        '',
        [
          's3://',
          {
            Ref: 'AssetParameterse820b3f07bf66854be0dfd6f3ec357a10d644f2011069e5ad07d42f4f89ed35aS3BucketD6778673',
          },
          '/',
          {
            'Fn::Select': [
              0,
              {
                'Fn::Split': [
                  '||',
                  {
                    Ref: 'AssetParameterse820b3f07bf66854be0dfd6f3ec357a10d644f2011069e5ad07d42f4f89ed35aS3VersionKey1A69D23D',
                  },
                ],
              },
            ],
          },
          {
            'Fn::Select': [
              1,
              {
                'Fn::Split': [
                  '||',
                  {
                    Ref: 'AssetParameterse820b3f07bf66854be0dfd6f3ec357a10d644f2011069e5ad07d42f4f89ed35aS3VersionKey1A69D23D',
                  },
                ],
              },
            ],
          },
        ],
      ],
    },
  });
});

test('throws with invalid name', () => {
  expect(() => new FirewallDomainList(stack, 'List', {
    name: 'Inv@lid',
    domains: FirewallDomains.fromList(['domain.com']),
  })).toThrow(/Invalid domain list name/);
});

test('throws with invalid domain', () => {
  expect(() => new FirewallDomainList(stack, 'List', {
    domains: FirewallDomains.fromList(['valid.fr', 'inv@lid.com']),
  })).toThrow(/Invalid domain/);
});

test('throws with fromAsset and not .txt', () => {
  expect(() => new FirewallDomainList(stack, 'List', {
    domains: FirewallDomains.fromAsset('image.jpg'),
  })).toThrow(/expects a file with the .txt extension/);
});

test('throws with invalid S3 URL', () => {
  expect(() => new FirewallDomainList(stack, 'List', {
    domains: FirewallDomains.fromS3Url('https://invalid/bucket/url'),
  })).toThrow(/The S3 URL must start with s3:\/\//);
});
