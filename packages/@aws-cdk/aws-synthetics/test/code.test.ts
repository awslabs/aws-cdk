import * as path from 'path';
import { TemplateAssertions } from '@aws-cdk/assertions';
import * as s3 from '@aws-cdk/aws-s3';
import { App, Stack } from '@aws-cdk/core';
import * as synthetics from '../lib';

describe(synthetics.Code.fromInline, () => {
  test('fromInline works', () => {
    // GIVEN
    const stack = new Stack(new App(), 'canaries');

    // WHEN
    const inline = synthetics.Code.fromInline(`
      exports.handler = async () => {
        console.log(\'hello world\');
      };`);

    // THEN
    expect(inline.bind(stack, 'index.handler').inlineCode).toEqual(`
      exports.handler = async () => {
        console.log(\'hello world\');
      };`);
  });

  test('fails if empty', () => {
    expect(() => synthetics.Code.fromInline(''))
      .toThrowError('Canary inline code cannot be empty');
  });

  test('fails if handler is not "index.handler"', () => {
    // GIVEN
    const stack = new Stack(new App(), 'canaries');

    // THEN
    expect(() => synthetics.Code.fromInline('code').bind(stack, 'canary.handler'))
      .toThrowError('The handler for inline code must be "index.handler" (got "canary.handler")');
  });
});

describe(synthetics.Code.fromAsset, () => {
  test('fromAsset works', () => {
    // GIVEN
    const stack = new Stack(new App(), 'canaries');

    // WHEN
    const directoryAsset = synthetics.Code.fromAsset(path.join(__dirname, 'canaries'));
    new synthetics.Canary(stack, 'Canary', {
      test: synthetics.Test.custom({
        handler: 'canary.handler',
        code: directoryAsset,
      }),
      runtime: synthetics.Runtime.SYNTHETICS_NODEJS_2_0,
    });

    // THEN
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Synthetics::Canary', {
      Code: {
        Handler: 'canary.handler',
        S3Bucket: stack.resolve(directoryAsset.bind(stack, 'canary.handler').s3Location?.bucketName),
        S3Key: stack.resolve(directoryAsset.bind(stack, 'canary.handler').s3Location?.objectKey),
      },
    });
  });

  test('only one Asset object gets created even if multiple canaries use the same AssetCode', () => {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'canaries');

    // WHEN
    const directoryAsset = synthetics.Code.fromAsset(path.join(__dirname, 'canaries'));
    new synthetics.Canary(stack, 'Canary1', {
      test: synthetics.Test.custom({
        handler: 'canary.handler',
        code: directoryAsset,
      }),
      runtime: synthetics.Runtime.SYNTHETICS_NODEJS_2_0,
    });

    new synthetics.Canary(stack, 'Canary2', {
      test: synthetics.Test.custom({
        handler: 'canary.handler',
        code: directoryAsset,
      }),
      runtime: synthetics.Runtime.SYNTHETICS_NODEJS_2_0,
    });

    // THEN
    const assembly = app.synth();
    const synthesized = assembly.stacks[0];

    expect(synthesized.assets.length).toEqual(1);
  });

  test('fails if path does not exist', () => {
    const assetPath = path.join(__dirname, 'does-not-exist');
    expect(() => synthetics.Code.fromAsset(assetPath))
      .toThrowError(`${assetPath} is not a valid path`);
  });

  test('fails if non-zip asset is used', () => {
    // GIVEN
    const stack = new Stack(new App(), 'canaries');

    // THEN
    const assetPath = path.join(__dirname, 'canaries', 'nodejs', 'node_modules', 'canary.js');
    expect(() => synthetics.Code.fromAsset(assetPath).bind(stack, 'canary.handler'))
      .toThrowError(`Asset must be a .zip file or a directory (${assetPath})`);
  });

  test('fails if "nodejs/node_modules" folder structure not used', () => {
    // GIVEN
    const stack = new Stack(new App(), 'canaries');

    // THEN
    const assetPath = path.join(__dirname, 'canaries', 'nodejs', 'node_modules');
    expect(() => synthetics.Code.fromAsset(assetPath).bind(stack, 'canary.handler'))
      .toThrowError(`The canary resource requires that the handler is present at "nodejs/node_modules/canary.js" but not found at ${assetPath} (https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Canaries_WritingCanary.html#CloudWatch_Synthetics_Canaries_write_from_scratch)`);
  });

  test('fails if handler is specified incorrectly', () => {
    // GIVEN
    const stack = new Stack(new App(), 'canaries');

    // THEN
    const assetPath = path.join(__dirname, 'canaries', 'nodejs', 'node_modules');
    expect(() => synthetics.Code.fromAsset(assetPath).bind(stack, 'incorrect.handler'))
      .toThrowError(`The canary resource requires that the handler is present at "nodejs/node_modules/incorrect.js" but not found at ${assetPath} (https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Canaries_WritingCanary.html#CloudWatch_Synthetics_Canaries_write_from_scratch)`);
  });
});


describe(synthetics.Code.fromBucket, () => {
  test('fromBucket works', () => {
    // GIVEN
    const stack = new Stack(new App(), 'canaries');
    const bucket = new s3.Bucket(stack, 'CodeBucket');

    // WHEN
    const code = synthetics.Code.fromBucket(bucket, 'code.js');
    const codeConfig = code.bind(stack, 'code.handler');

    // THEN
    expect(codeConfig.s3Location?.bucketName).toEqual(bucket.bucketName);
    expect(codeConfig.s3Location?.objectKey).toEqual('code.js');
  });
});
