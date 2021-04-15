import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import * as cxapi from '@aws-cdk/cx-api';
import * as cdk from '../../../lib';
import { toCloudFormation } from '../../util';

const SAMPLE_ASSET_DIR = path.join(__dirname, 'sample-asset-directory');
const SAMPLE_ASSET_HASH = '6b84b87243a4a01c592d78e1fd3855c4bfef39328cd0a450cc97e81717fea2a2';

test('simple use case', () => {
  const app = new cdk.App({
    context: {
      [cxapi.DISABLE_ASSET_STAGING_CONTEXT]: 'true',
    },
  });
  const stack = new cdk.Stack(app, 'MyStack');
  new cdk.FileAsset(stack, 'MyAsset', {
    path: SAMPLE_ASSET_DIR,
  });

  // verify that metadata contains an "aws:cdk:asset" entry with
  // the correct information
  const entry = stack.node.metadata.find(m => m.type === 'aws:cdk:asset');
  expect(entry).toBeTruthy();

  // verify that now the template contains parameters for this asset
  const session = app.synth();

  expect(stack.resolve(entry!.data)).toEqual({
    path: SAMPLE_ASSET_DIR,
    id: '6b84b87243a4a01c592d78e1fd3855c4bfef39328cd0a450cc97e81717fea2a2',
    packaging: 'zip',
    sourceHash: '6b84b87243a4a01c592d78e1fd3855c4bfef39328cd0a450cc97e81717fea2a2',
    s3BucketParameter: 'AssetParameters6b84b87243a4a01c592d78e1fd3855c4bfef39328cd0a450cc97e81717fea2a2S3Bucket50B5A10B',
    s3KeyParameter: 'AssetParameters6b84b87243a4a01c592d78e1fd3855c4bfef39328cd0a450cc97e81717fea2a2S3VersionKey1F7D75F9',
    artifactHashParameter: 'AssetParameters6b84b87243a4a01c592d78e1fd3855c4bfef39328cd0a450cc97e81717fea2a2ArtifactHash220DE9BD',
  });

  const template = JSON.parse(fs.readFileSync(path.join(session.directory, 'MyStack.template.json'), { encoding: 'utf-8' }));

  expect(template.Parameters.AssetParameters6b84b87243a4a01c592d78e1fd3855c4bfef39328cd0a450cc97e81717fea2a2S3Bucket50B5A10B.Type).toBe('String');
  expect(template.Parameters.AssetParameters6b84b87243a4a01c592d78e1fd3855c4bfef39328cd0a450cc97e81717fea2a2S3VersionKey1F7D75F9.Type).toBe('String');
});

test('verify that the app resolves tokens in metadata', () => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'my-stack');
  const dirPath = path.resolve(__dirname, 'sample-asset-directory');

  new cdk.FileAsset(stack, 'MyAsset', {
    path: dirPath,
  });

  const synth = app.synth().getStackByName(stack.stackName);
  const meta = synth.manifest.metadata || {};
  expect(meta['/my-stack']).toBeTruthy();
  expect(meta['/my-stack'][0]).toBeTruthy();
  expect(meta['/my-stack'][0].data).toEqual({
    path: 'asset.6b84b87243a4a01c592d78e1fd3855c4bfef39328cd0a450cc97e81717fea2a2',
    id: '6b84b87243a4a01c592d78e1fd3855c4bfef39328cd0a450cc97e81717fea2a2',
    packaging: 'zip',
    sourceHash: '6b84b87243a4a01c592d78e1fd3855c4bfef39328cd0a450cc97e81717fea2a2',
    s3BucketParameter: 'AssetParameters6b84b87243a4a01c592d78e1fd3855c4bfef39328cd0a450cc97e81717fea2a2S3Bucket50B5A10B',
    s3KeyParameter: 'AssetParameters6b84b87243a4a01c592d78e1fd3855c4bfef39328cd0a450cc97e81717fea2a2S3VersionKey1F7D75F9',
    artifactHashParameter: 'AssetParameters6b84b87243a4a01c592d78e1fd3855c4bfef39328cd0a450cc97e81717fea2a2ArtifactHash220DE9BD',
  });
});

test('"file" assets', () => {
  const stack = new cdk.Stack();
  const filePath = path.join(__dirname, 'file-asset.txt');
  new cdk.FileAsset(stack, 'MyAsset', { path: filePath });
  const entry = stack.node.metadata.find(m => m.type === 'aws:cdk:asset');
  expect(entry).toBeTruthy();

  // synthesize first so "prepare" is called
  const template = toCloudFormation(stack);

  expect(stack.resolve(entry!.data)).toEqual({
    path: 'asset.78add9eaf468dfa2191da44a7da92a21baba4c686cf6053d772556768ef21197.txt',
    packaging: 'file',
    id: '78add9eaf468dfa2191da44a7da92a21baba4c686cf6053d772556768ef21197',
    sourceHash: '78add9eaf468dfa2191da44a7da92a21baba4c686cf6053d772556768ef21197',
    s3BucketParameter: 'AssetParameters78add9eaf468dfa2191da44a7da92a21baba4c686cf6053d772556768ef21197S3Bucket2C60F94A',
    s3KeyParameter: 'AssetParameters78add9eaf468dfa2191da44a7da92a21baba4c686cf6053d772556768ef21197S3VersionKey9482DC35',
    artifactHashParameter: 'AssetParameters78add9eaf468dfa2191da44a7da92a21baba4c686cf6053d772556768ef21197ArtifactHash22BFFA67',
  });

  // verify that now the template contains parameters for this asset
  expect(template.Parameters.AssetParameters78add9eaf468dfa2191da44a7da92a21baba4c686cf6053d772556768ef21197S3Bucket2C60F94A.Type).toBe('String');
  expect(template.Parameters.AssetParameters78add9eaf468dfa2191da44a7da92a21baba4c686cf6053d772556768ef21197S3VersionKey9482DC35.Type).toBe('String');
});

test('fails if directory not found', () => {
  const stack = new cdk.Stack();
  expect(() => new cdk.FileAsset(stack, 'MyDirectory', {
    path: '/path/not/found/' + Math.random() * 999999,
  })).toThrow();
});

test('multiple assets under the same parent', () => {
  // GIVEN
  const stack = new cdk.Stack();

  // WHEN
  expect(() => new cdk.FileAsset(stack, 'MyDirectory1', { path: path.join(__dirname, 'sample-asset-directory') })).not.toThrow();
  expect(() => new cdk.FileAsset(stack, 'MyDirectory2', { path: path.join(__dirname, 'sample-asset-directory') })).not.toThrow();
});

test('isFile indicates if the asset represents a single file', () => {
  // GIVEN
  const stack = new cdk.Stack();

  // WHEN
  const directoryAsset = new cdk.FileAsset(stack, 'DirectoryAsset', {
    path: path.join(__dirname, 'sample-asset-directory'),
  });

  const fileAsset = new cdk.FileAsset(stack, 'FileAsset', {
    path: path.join(__dirname, 'sample-asset-directory', 'sample-asset-file.txt'),
  });

  // THEN
  expect(directoryAsset.isFile).toBe(false);
  expect(fileAsset.isFile).toBe(true);
});

test('isZipArchive indicates if the asset represents a .zip file (either explicitly or via ZipDirectory packaging)', () => {
  // GIVEN
  const stack = new cdk.Stack();

  // WHEN
  const nonZipAsset = new cdk.FileAsset(stack, 'NonZipAsset', {
    path: path.join(__dirname, 'sample-asset-directory', 'sample-asset-file.txt'),
  });

  const zipDirectoryAsset = new cdk.FileAsset(stack, 'ZipDirectoryAsset', {
    path: path.join(__dirname, 'sample-asset-directory'),
  });

  const zipFileAsset = new cdk.FileAsset(stack, 'ZipFileAsset', {
    path: path.join(__dirname, 'sample-asset-directory', 'sample-zip-asset.zip'),
  });

  const jarFileAsset = new cdk.FileAsset(stack, 'JarFileAsset', {
    path: path.join(__dirname, 'sample-asset-directory', 'sample-jar-asset.jar'),
  });

  // THEN
  expect(nonZipAsset.isZipArchive).toBe(false);
  expect(zipDirectoryAsset.isZipArchive).toBe(true);
  expect(zipFileAsset.isZipArchive).toBe(true);
  expect(jarFileAsset.isZipArchive).toBe(true);
});

test('addResourceMetadata can be used to add CFN metadata to resources', () => {
  // GIVEN
  const stack = new cdk.Stack();
  stack.node.setContext(cxapi.ASSET_RESOURCE_METADATA_ENABLED_CONTEXT, true);

  const location = path.join(__dirname, 'sample-asset-directory');
  const resource = new cdk.CfnResource(stack, 'MyResource', { type: 'My::Resource::Type' });
  const asset = new cdk.FileAsset(stack, 'MyAsset', { path: location });

  // WHEN
  asset.addResourceMetadata(resource, 'PropName');

  // THEN
  const myResource = Object.values(toCloudFormation(stack).Resources).find((r: any) => r.Type === 'My::Resource::Type');
  expect(myResource).toMatchObject({
    Metadata: {
      'aws:asset:path': 'asset.6b84b87243a4a01c592d78e1fd3855c4bfef39328cd0a450cc97e81717fea2a2',
      'aws:asset:property': 'PropName',
    },
  });
});

test('asset metadata is only emitted if ASSET_RESOURCE_METADATA_ENABLED_CONTEXT is defined', () => {
  // GIVEN
  const stack = new cdk.Stack();

  const resource = new cdk.CfnResource(stack, 'MyResource', { type: 'My::Resource::Type' });
  const asset = new cdk.FileAsset(stack, 'MyAsset', { path: SAMPLE_ASSET_DIR });

  // WHEN
  asset.addResourceMetadata(resource, 'PropName');

  // THEN
  const myResource = Object.values(toCloudFormation(stack).Resources).find((r: any) => r.Type === 'My::Resource::Type');
  expect(myResource).toStrictEqual({
    Type: 'My::Resource::Type',
    // no metadata
  });
});

test('nested assemblies share assets: legacy synth edition', () => {
  // GIVEN
  const app = new cdk.App();
  const stack1 = new cdk.Stack(new cdk.Stage(app, 'Stage1'), 'Stack', { synthesizer: new cdk.LegacyStackSynthesizer() });
  const stack2 = new cdk.Stack(new cdk.Stage(app, 'Stage2'), 'Stack', { synthesizer: new cdk.LegacyStackSynthesizer() });

  // WHEN
  new cdk.FileAsset(stack1, 'MyAsset', { path: SAMPLE_ASSET_DIR });
  new cdk.FileAsset(stack2, 'MyAsset', { path: SAMPLE_ASSET_DIR });

  // THEN
  const assembly = app.synth();

  // Read the assets from the stack metadata
  for (const stageName of ['Stage1', 'Stage2']) {
    const stackArtifact = assembly.getNestedAssembly(`assembly-${stageName}`).artifacts.filter(isStackArtifact)[0];
    const assetMeta = stackArtifact.findMetadataByType(cxschema.ArtifactMetadataEntryType.ASSET);
    expect(assetMeta[0]).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          packaging: 'zip',
          path: `../asset.${SAMPLE_ASSET_HASH}`,
        }),
      }),
    );
  }
});

test('nested assemblies share assets: default synth edition', () => {
  // GIVEN
  const app = new cdk.App();
  const stack1 = new cdk.Stack(new cdk.Stage(app, 'Stage1'), 'Stack', { synthesizer: new cdk.DefaultStackSynthesizer() });
  const stack2 = new cdk.Stack(new cdk.Stage(app, 'Stage2'), 'Stack', { synthesizer: new cdk.DefaultStackSynthesizer() });

  // WHEN
  new cdk.FileAsset(stack1, 'MyAsset', { path: SAMPLE_ASSET_DIR });
  new cdk.FileAsset(stack2, 'MyAsset', { path: SAMPLE_ASSET_DIR });

  // THEN
  const assembly = app.synth();

  // Read the asset manifests to verify the file paths
  for (const stageName of ['Stage1', 'Stage2']) {
    const manifestArtifact = assembly.getNestedAssembly(`assembly-${stageName}`).artifacts.filter(isAssetManifestArtifact)[0];
    const manifest = JSON.parse(fs.readFileSync(manifestArtifact.file, { encoding: 'utf-8' }));

    expect(manifest.files[SAMPLE_ASSET_HASH].source).toEqual({
      packaging: 'zip',
      path: `../asset.${SAMPLE_ASSET_HASH}`,
    });
  }
});


describe('staging', () => {
  test('copy file assets under <outdir>/${fingerprint}.ext', () => {
    const tempdir = mkdtempSync();
    process.chdir(tempdir); // change current directory to somewhere in /tmp

    // GIVEN
    const app = new cdk.App({ outdir: tempdir });
    const stack = new cdk.Stack(app, 'stack');

    // WHEN
    new cdk.FileAsset(stack, 'ZipFile', {
      path: path.join(SAMPLE_ASSET_DIR, 'sample-zip-asset.zip'),
    });

    new cdk.FileAsset(stack, 'TextFile', {
      path: path.join(SAMPLE_ASSET_DIR, 'sample-asset-file.txt'),
    });

    // THEN
    app.synth();
    expect(fs.existsSync(tempdir)).toBe(true);
    expect(fs.existsSync(path.join(tempdir, 'asset.a7a79cdf84b802ea8b198059ff899cffc095a1b9606e919f98e05bf80779756b.zip'))).toBe(true);
  });

  test('copy directory under .assets/fingerprint/**', () => {
    const tempdir = mkdtempSync();
    process.chdir(tempdir); // change current directory to somewhere in /tmp

    // GIVEN
    const app = new cdk.App({ outdir: tempdir });
    const stack = new cdk.Stack(app, 'stack');

    // WHEN
    new cdk.FileAsset(stack, 'ZipDirectory', {
      path: SAMPLE_ASSET_DIR,
    });

    // THEN
    app.synth();
    expect(fs.existsSync(tempdir)).toBe(true);
    const hash = 'asset.6b84b87243a4a01c592d78e1fd3855c4bfef39328cd0a450cc97e81717fea2a2';
    expect(fs.existsSync(path.join(tempdir, hash, 'sample-asset-file.txt'))).toBe(true);
    expect(fs.existsSync(path.join(tempdir, hash, 'sample-jar-asset.jar'))).toBe(true);
    expect(() => fs.readdirSync(tempdir)).not.toThrow();
  });

  test('staging path is relative if the dir is below the working directory', () => {
    // GIVEN
    const tempdir = mkdtempSync();
    process.chdir(tempdir); // change current directory to somewhere in /tmp

    const staging = '.my-awesome-staging-directory';
    const app = new cdk.App({
      outdir: staging,
      context: {
        [cxapi.ASSET_RESOURCE_METADATA_ENABLED_CONTEXT]: 'true',
      },
    });

    const stack = new cdk.Stack(app, 'stack');

    const resource = new cdk.CfnResource(stack, 'MyResource', { type: 'My::Resource::Type' });
    const asset = new cdk.FileAsset(stack, 'MyAsset', { path: SAMPLE_ASSET_DIR });

    // WHEN
    asset.addResourceMetadata(resource, 'PropName');

    const template = toCloudFormation(stack);
    expect(template.Resources.MyResource.Metadata).toEqual({
      'aws:asset:path': 'asset.6b84b87243a4a01c592d78e1fd3855c4bfef39328cd0a450cc97e81717fea2a2',
      'aws:asset:property': 'PropName',
    });
  });

  test('if staging is disabled, asset path is absolute', () => {
    // GIVEN
    const staging = path.resolve(mkdtempSync());
    const app = new cdk.App({
      outdir: staging,
      context: {
        [cxapi.DISABLE_ASSET_STAGING_CONTEXT]: 'true',
        [cxapi.ASSET_RESOURCE_METADATA_ENABLED_CONTEXT]: 'true',
      },
    });

    const stack = new cdk.Stack(app, 'stack');

    const resource = new cdk.CfnResource(stack, 'MyResource', { type: 'My::Resource::Type' });
    const asset = new cdk.FileAsset(stack, 'MyAsset', { path: SAMPLE_ASSET_DIR });

    // WHEN
    asset.addResourceMetadata(resource, 'PropName');

    const template = toCloudFormation(stack);
    expect(template.Resources.MyResource.Metadata).toEqual({
      'aws:asset:path': SAMPLE_ASSET_DIR,
      'aws:asset:property': 'PropName',
    });
  });

  test('cdk metadata points to staged asset', () => {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'stack');
    new cdk.FileAsset(stack, 'MyAsset', { path: SAMPLE_ASSET_DIR });

    // WHEN
    const session = app.synth();
    const artifact = session.getStackByName(stack.stackName);
    const metadata = artifact.manifest.metadata || {};
    const md = Object.values(metadata)[0]![0]!.data as cxschema.AssetMetadataEntry;
    expect(md.path).toBe('asset.6b84b87243a4a01c592d78e1fd3855c4bfef39328cd0a450cc97e81717fea2a2');
  });
});

function mkdtempSync() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'assets.test'));
}

function isStackArtifact(x: any): x is cxapi.CloudFormationStackArtifact {
  return x instanceof cxapi.CloudFormationStackArtifact;
}

function isAssetManifestArtifact(x: any): x is cxapi.AssetManifestArtifact {
  return x instanceof cxapi.AssetManifestArtifact;
}
