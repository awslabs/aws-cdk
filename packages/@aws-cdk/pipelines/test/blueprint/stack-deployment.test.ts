import * as path from 'path';
import * as assets from '@aws-cdk/aws-s3-assets';
import { Stack, Stage } from '@aws-cdk/core';
import { StageDeployment } from '../../lib';
import { TestApp } from '../testhelpers/test-app';

test('"templateAsset"  represents the CFN template of the stack', () => {
  // GIVEN
  const stage = new Stage(new TestApp(), 'MyStage');
  new Stack(stage, 'MyStack');

  // WHEN
  const sd = StageDeployment.fromStage(stage);

  // THEN
  expect(sd.stacks[0].templateAsset).not.toBeUndefined();
  expect(sd.stacks[0].templateAsset?.assetId).not.toBeUndefined();
  expect(sd.stacks[0].templateAsset?.assetManifestPath).not.toBeUndefined();
  expect(sd.stacks[0].templateAsset?.assetSelector).not.toBeUndefined();
  expect(sd.stacks[0].templateAsset?.assetType).toBe('file');
  expect(sd.stacks[0].templateAsset?.isTemplate).toBeTruthy();
});

describe('templateUrl', () => {
  test('includes the https:// s3 URL of the template file', () => {
    // GIVEN
    const stage = new Stage(new TestApp(), 'MyStage', { env: { account: '111', region: 'us-east-1' } });
    new Stack(stage, 'MyStack');

    // WHEN
    const sd = StageDeployment.fromStage(stage);

    // THEN
    expect(sd.stacks[0].templateUrl).toBe('https://cdk-hnb659fds-assets-111-us-east-1.s3.us-east-1.amazonaws.com/4ef627170a212f66f5d1d9240d967ef306f4820ff9cb05b3a7ec703df6af6c3e.json');
  });

  test('without region', () => {
    // GIVEN
    const stage = new Stage(new TestApp(), 'MyStage', { env: { account: '111' } });
    new Stack(stage, 'MyStack');

    // WHEN
    const sd = StageDeployment.fromStage(stage);

    // THEN
    expect(sd.stacks[0].templateUrl).toBe('https://cdk-hnb659fds-assets-111-.s3.amazonaws.com/$%7BAWS::Region%7D/4ef627170a212f66f5d1d9240d967ef306f4820ff9cb05b3a7ec703df6af6c3e.json');
  });

});


test('"requiredAssets" contain only assets that are not the template', () => {
  // GIVEN
  const stage = new Stage(new TestApp(), 'MyStage');
  const stack = new Stack(stage, 'MyStack');
  new assets.Asset(stack, 'Asset', { path: path.join(__dirname, 'fixtures') });

  // WHEN
  const sd = StageDeployment.fromStage(stage);

  // THEN
  expect(sd.stacks[0].assets.length).toBe(1);
  expect(sd.stacks[0].assets[0].assetType).toBe('file');
  expect(sd.stacks[0].assets[0].isTemplate).toBeFalsy();
});

