jest.mock('child_process');

import { Manifest } from '@aws-cdk/cloud-assembly-schema';
import * as mockfs from 'mock-fs';
import { AssetManifest, AssetPublishing } from '../lib';
import { mockAws, mockedApiResult, mockUpload } from './mock-aws';
import { mockSpawn } from './mock-child_process';

const ABS_PATH = '/simple/cdk.out/some_external_file';

let aws: ReturnType<typeof mockAws>;
beforeEach(() => {
  jest.resetAllMocks();

  mockfs({
    '/simple/cdk.out/assets.json': JSON.stringify({
      version: Manifest.version(),
      files: {
        theAsset: {
          source: {
            path: 'some_file',
          },
          destinations: {
            theDestination: {
              region: 'us-north-50',
              assumeRoleArn: 'arn:aws:role',
              bucketName: 'some_bucket',
              objectKey: 'some_key',
            },
          },
        },
      },
    }),
    '/simple/cdk.out/some_file': 'FILE_CONTENTS',
    [ABS_PATH]: 'FILE_CONTENTS',
    '/abs/cdk.out/assets.json': JSON.stringify({
      version: Manifest.version(),
      files: {
        theAsset: {
          source: {
            path: '/simple/cdk.out/some_file',
          },
          destinations: {
            theDestination: {
              region: 'us-north-50',
              assumeRoleArn: 'arn:aws:role',
              bucketName: 'some_other_bucket',
              objectKey: 'some_key',
            },
          },
        },
      },
    }),
    '/external/cdk.out/assets.json': JSON.stringify({
      version: Manifest.version(),
      files: {
        externalAsset: {
          source: {
            executable: ['sometool'],
          },
          destinations: {
            theDestination: {
              region: 'us-north-50',
              assumeRoleArn: 'arn:aws:role',
              bucketName: 'some_external_bucket',
              objectKey: 'some_key',
            },
          },
        },
      },
    }),
    '/types/cdk.out/assets.json': JSON.stringify({
      version: Manifest.version(),
      files: {
        theTextAsset: {
          source: {
            path: 'plain_text.txt',
          },
          destinations: {
            theDestination: {
              region: 'us-north-50',
              assumeRoleArn: 'arn:aws:role',
              bucketName: 'some_bucket',
              objectKey: 'some_key.txt',
            },
          },
        },
        theImageAsset: {
          source: {
            path: 'image.png',
          },
          destinations: {
            theDestination: {
              region: 'us-north-50',
              assumeRoleArn: 'arn:aws:role',
              bucketName: 'some_bucket',
              objectKey: 'some_key.png',
            },
          },
        },
      },
    }),
    '/types/cdk.out/plain_text.txt': 'FILE_CONTENTS',
    '/types/cdk.out/image.png': 'FILE_CONTENTS',
  });

  aws = mockAws();
});

afterEach(() => {
  mockfs.restore();
});

test('pass destination properties to AWS client', async () => {
  const pub = new AssetPublishing(AssetManifest.fromPath('/simple/cdk.out'), { aws, throwOnError: false });

  await pub.publish();

  expect(aws.s3Client).toHaveBeenCalledWith(expect.objectContaining({
    region: 'us-north-50',
    assumeRoleArn: 'arn:aws:role',
  }));
});

test('Do nothing if file already exists', async () => {
  const pub = new AssetPublishing(AssetManifest.fromPath('/simple/cdk.out'), { aws });

  aws.mockS3.listObjectsV2 = mockedApiResult({ Contents: [{ Key: 'some_key' }] });

  await pub.publish();

  expect(aws.mockS3.listObjectsV2).toHaveBeenCalledWith(expect.objectContaining({
    Bucket: 'some_bucket',
    Prefix: 'some_key',
    MaxKeys: 1,
  }));
});

test('upload file if new (list returns other key)', async () => {
  const pub = new AssetPublishing(AssetManifest.fromPath('/simple/cdk.out'), { aws });

  aws.mockS3.listObjectsV2 = mockedApiResult({ Contents: [{ Key: 'some_key.but_not_the_one' }] });
  aws.mockS3.upload = mockUpload('FILE_CONTENTS');

  await pub.publish();

  expect(aws.mockS3.upload).toHaveBeenCalledWith(expect.objectContaining({
    Bucket: 'some_bucket',
    Key: 'some_key',
    ContentType: 'application/octet-stream',
  }));

  // We'll just have to assume the contents are correct
});

test('correctly looks up content type', async () => {
  const pub = new AssetPublishing(AssetManifest.fromPath('/types/cdk.out'), { aws });

  aws.mockS3.listObjectsV2 = mockedApiResult({ Contents: [{ Key: 'some_key.but_not_the_one' }] });
  aws.mockS3.upload = mockUpload('FILE_CONTENTS');

  await pub.publish();

  expect(aws.mockS3.upload).toHaveBeenCalledWith(expect.objectContaining({
    Bucket: 'some_bucket',
    Key: 'some_key.txt',
    ContentType: 'text/plain',
  }));

  expect(aws.mockS3.upload).toHaveBeenCalledWith(expect.objectContaining({
    Bucket: 'some_bucket',
    Key: 'some_key.png',
    ContentType: 'image/png',
  }));

  // We'll just have to assume the contents are correct
});

test('upload file if new (list returns no key)', async () => {
  const pub = new AssetPublishing(AssetManifest.fromPath('/simple/cdk.out'), { aws });

  aws.mockS3.listObjectsV2 = mockedApiResult({ Contents: undefined });
  aws.mockS3.upload = mockUpload('FILE_CONTENTS');

  await pub.publish();

  expect(aws.mockS3.upload).toHaveBeenCalledWith(expect.objectContaining({
    Bucket: 'some_bucket',
    Key: 'some_key',
  }));

  // We'll just have to assume the contents are correct
});

test('successful run does not need to query account ID', async () => {
  const pub = new AssetPublishing(AssetManifest.fromPath('/simple/cdk.out'), { aws });

  aws.mockS3.listObjectsV2 = mockedApiResult({ Contents: undefined });
  aws.mockS3.upload = mockUpload('FILE_CONTENTS');

  await pub.publish();

  expect(aws.discoverCurrentAccount).not.toHaveBeenCalled();
});

test('correctly identify asset path if path is absolute', async () => {
  const pub = new AssetPublishing(AssetManifest.fromPath('/abs/cdk.out'), { aws });

  aws.mockS3.listObjectsV2 = mockedApiResult({ Contents: undefined });
  aws.mockS3.upload = mockUpload('FILE_CONTENTS');

  await pub.publish();

  expect(true).toBeTruthy(); // No exception, satisfy linter
});

describe('external assets', () => {
  let pub: AssetPublishing;
  beforeEach(() => {
    pub = new AssetPublishing(AssetManifest.fromPath('/external/cdk.out'), { aws });
  });

  test('do nothing if file exists already', async () => {
    aws.mockS3.listObjectsV2 = mockedApiResult({ Contents: [{ Key: 'some_key' }] });

    await pub.publish();

    expect(aws.mockS3.listObjectsV2).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: 'some_external_bucket',
      Prefix: 'some_key',
      MaxKeys: 1,
    }));
  });

  test('upload external asset correctly', async () => {
    aws.mockS3.listObjectsV2 = mockedApiResult({ Contents: undefined });
    aws.mockS3.upload = mockUpload('FILE_CONTENTS');
    const expectAllSpawns = mockSpawn({ commandLine: ['sometool'], stdout: ABS_PATH });

    await pub.publish();

    expect(aws.s3Client).toHaveBeenCalledWith(expect.objectContaining({
      region: 'us-north-50',
      assumeRoleArn: 'arn:aws:role',
    }));

    expectAllSpawns();
  });
});
