import * as path from 'path';
import * as s3 from '@aws-cdk/aws-s3';
import * as core from '@aws-cdk/core';
import * as flink from '../lib';

const app = new core.App();
const stack = new core.Stack(app, 'FlinkAppCodeFromBucketTest');

const asset = new core.FileAsset(stack, 'CodeAsset', {
  path: path.join(__dirname, 'code-asset'),
});
const bucket = s3.Bucket.fromBucketName(asset, 'AssetBucket', asset.s3BucketName);
const fileKey = asset.s3ObjectKey;

///! show
new flink.Application(stack, 'App', {
  code: flink.ApplicationCode.fromBucket(bucket, fileKey),
  runtime: flink.Runtime.FLINK_1_11,
});
///! hide

app.synth();
