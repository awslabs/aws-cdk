import * as fs from 'fs';
import * as path from 'path';
import { expect as ourExpect, haveResource } from '@aws-cdk/assert-internal';
import * as iam from '@aws-cdk/aws-iam';
import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import { App, DefaultStackSynthesizer, IgnoreMode, Lazy, LegacyStackSynthesizer, Stack, Stage } from '@aws-cdk/core';
import * as cxapi from '@aws-cdk/cx-api';
import { testFutureBehavior } from 'cdk-build-tools/lib/feature-flag';
import { DockerImageAsset } from '../lib';

/* eslint-disable quote-props */

const DEMO_IMAGE_ASSET_HASH = 'b2c69bfbfe983b634456574587443159b3b7258849856a118ad3d2772238f1a5';

const flags = { [cxapi.DOCKER_IGNORE_SUPPORT]: true };

describe('image asset', () => {
  testFutureBehavior('test instantiating Asset Image', flags, App, (app) => {
    // WHEN
    const stack = new Stack(app);
    new DockerImageAsset(stack, 'Image', {
      directory: path.join(__dirname, 'demo-image'),
    });

    // THEN
    const asm = app.synth();
    const artifact = asm.getStackArtifact(stack.artifactId);
    expect(artifact.template).toEqual({});
    expect(artifact.assets).toEqual([
      {
        repositoryName: 'aws-cdk/assets',
        imageTag: 'b2c69bfbfe983b634456574587443159b3b7258849856a118ad3d2772238f1a5',
        id: 'b2c69bfbfe983b634456574587443159b3b7258849856a118ad3d2772238f1a5',
        packaging: 'container-image',
        path: 'asset.b2c69bfbfe983b634456574587443159b3b7258849856a118ad3d2772238f1a5',
        sourceHash: 'b2c69bfbfe983b634456574587443159b3b7258849856a118ad3d2772238f1a5',
      },
    ]);
  });

  testFutureBehavior('with build args', flags, App, (app) => {
    // WHEN
    const stack = new Stack(app);
    new DockerImageAsset(stack, 'Image', {
      directory: path.join(__dirname, 'demo-image'),
      buildArgs: {
        a: 'b',
      },
    });

    // THEN
    const assetMetadata = stack.node.metadata.find(({ type }) => type === cxschema.ArtifactMetadataEntryType.ASSET);
    expect(assetMetadata && (assetMetadata.data as cxschema.ContainerImageAssetMetadataEntry).buildArgs).toEqual({ a: 'b' });
  });

  testFutureBehavior('with target', flags, App, (app) => {
    // WHEN
    const stack = new Stack(app);
    new DockerImageAsset(stack, 'Image', {
      directory: path.join(__dirname, 'demo-image'),
      buildArgs: {
        a: 'b',
      },
      target: 'a-target',
    });

    // THEN
    const assetMetadata = stack.node.metadata.find(({ type }) => type === cxschema.ArtifactMetadataEntryType.ASSET);
    expect(assetMetadata && (assetMetadata.data as cxschema.ContainerImageAssetMetadataEntry).target).toEqual('a-target');
  });

  testFutureBehavior('with file', flags, App, (app) => {
    // GIVEN
    const stack = new Stack(app);
    const directoryPath = path.join(__dirname, 'demo-image-custom-docker-file');
    // WHEN
    new DockerImageAsset(stack, 'Image', {
      directory: directoryPath,
      file: 'Dockerfile.Custom',
    });

    // THEN
    const assetMetadata = stack.node.metadata.find(({ type }) => type === cxschema.ArtifactMetadataEntryType.ASSET);
    expect(assetMetadata && (assetMetadata.data as cxschema.ContainerImageAssetMetadataEntry).file).toEqual('Dockerfile.Custom');
  });

  testFutureBehavior('asset.repository.grantPull can be used to grant a principal permissions to use the image', flags, App, (app) => {
    // GIVEN
    const stack = new Stack(app);
    const user = new iam.User(stack, 'MyUser');
    const asset = new DockerImageAsset(stack, 'Image', {
      directory: path.join(__dirname, 'demo-image'),
    });

    // WHEN
    asset.repository.grantPull(user);

    // THEN
    ourExpect(stack).to(haveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        'Statement': [
          {
            'Action': [
              'ecr:BatchCheckLayerAvailability',
              'ecr:GetDownloadUrlForLayer',
              'ecr:BatchGetImage',
            ],
            'Effect': 'Allow',
            'Resource': {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  {
                    'Ref': 'AWS::Partition',
                  },
                  ':ecr:',
                  {
                    'Ref': 'AWS::Region',
                  },
                  ':',
                  {
                    'Ref': 'AWS::AccountId',
                  },
                  ':repository/aws-cdk/assets',
                ],
              ],
            },
          },
          {
            'Action': 'ecr:GetAuthorizationToken',
            'Effect': 'Allow',
            'Resource': '*',
          },
        ],
        'Version': '2012-10-17',
      },
      'PolicyName': 'MyUserDefaultPolicy7B897426',
      'Users': [
        {
          'Ref': 'MyUserDC45028B',
        },
      ],
    }));
  });

  test('fails if the directory does not exist', () => {
    const stack = new Stack();
    // THEN
    expect(() => {
      new DockerImageAsset(stack, 'MyAsset', {
        directory: `/does/not/exist/${Math.floor(Math.random() * 9999)}`,
      });
    }).toThrow(/Cannot find image directory at/);
  });

  test('fails if the directory does not contain a Dockerfile', () => {
    const stack = new Stack();
    // THEN
    expect(() => {
      new DockerImageAsset(stack, 'Asset', {
        directory: __dirname,
      });
    }).toThrow(/Cannot find file at/);
  });

  test('fails if the file does not exist', () => {
    const stack = new Stack();
    // THEN
    expect(() => {
      new DockerImageAsset(stack, 'Asset', {
        directory: __dirname,
        file: 'doesnt-exist',
      });
    }).toThrow(/Cannot find file at/);
  });

  testFutureBehavior('docker directory is staged if asset staging is enabled', flags, App, (app) => {
    const stack = new Stack(app);
    const image = new DockerImageAsset(stack, 'MyAsset', {
      directory: path.join(__dirname, 'demo-image'),
    });

    const session = app.synth();

    expect(fs.existsSync(path.join(session.directory, `asset.${image.assetHash}`, 'Dockerfile'))).toBeDefined();
    expect(fs.existsSync(path.join(session.directory, `asset.${image.assetHash}`, 'index.py'))).toBeDefined();
  });

  testFutureBehavior('docker directory is staged without files specified in .dockerignore', flags, App, (app) => {
    testDockerDirectoryIsStagedWithoutFilesSpecifiedInDockerignore(app);
  });

  testFutureBehavior('docker directory is staged without files specified in .dockerignore with IgnoreMode.GLOB', flags, App, (app) => {
    testDockerDirectoryIsStagedWithoutFilesSpecifiedInDockerignore(app, IgnoreMode.GLOB);
  });

  testFutureBehavior('docker directory is staged with allow-listed files specified in .dockerignore', flags, App, (app) => {
    const stack = new Stack(app);
    const image = new DockerImageAsset(stack, 'MyAsset', {
      directory: path.join(__dirname, 'allow-listed-image'),
    });

    const session = app.synth();

    // Only the files exempted above should be included.
    expect(fs.existsSync(path.join(session.directory, `asset.${image.assetHash}`, '.dockerignore'))).toBeDefined();
    expect(fs.existsSync(path.join(session.directory, `asset.${image.assetHash}`, 'Dockerfile'))).toBeDefined();
    expect(fs.existsSync(path.join(session.directory, `asset.${image.assetHash}`, 'index.py'))).toBeDefined();
    expect(fs.existsSync(path.join(session.directory, `asset.${image.assetHash}`, 'foobar.txt'))).toBeDefined();
    expect(fs.existsSync(path.join(session.directory, `asset.${image.assetHash}`, 'subdirectory'))).toBeDefined();
    expect(fs.existsSync(path.join(session.directory, `asset.${image.assetHash}`, 'subdirectory', 'baz.txt'))).toBeDefined();
    expect(!fs.existsSync(path.join(session.directory, `asset.${image.assetHash}`, 'node_modules'))).toBeDefined();
    expect(!fs.existsSync(path.join(session.directory, `asset.${image.assetHash}`, 'node_modules', 'one'))).toBeDefined();
    expect(!fs.existsSync(path.join(session.directory, `asset.${image.assetHash}`, 'node_modules', 'some_dep'))).toBeDefined();
    expect(!fs.existsSync(path.join(session.directory, `asset.${image.assetHash}`, 'node_modules', 'some_dep', 'file'))).toBeDefined();
  });

  testFutureBehavior('docker directory is staged without files specified in exclude option', flags, App, (app) => {
    testDockerDirectoryIsStagedWithoutFilesSpecifiedInExcludeOption(app);
  });

  testFutureBehavior('docker directory is staged without files specified in exclude option with IgnoreMode.GLOB', flags, App, (app) => {
    testDockerDirectoryIsStagedWithoutFilesSpecifiedInExcludeOption(app, IgnoreMode.GLOB);
  });

  test('fails if using tokens in build args keys or values', () => {
    // GIVEN
    const stack = new Stack();
    const token = Lazy.string({ produce: () => 'foo' });
    const expected = /Cannot use tokens in keys or values of "buildArgs" since they are needed before deployment/;

    // THEN
    expect(() => new DockerImageAsset(stack, 'MyAsset1', {
      directory: path.join(__dirname, 'demo-image'),
      buildArgs: { [token]: 'value' },
    })).toThrow(expected);

    expect(() => new DockerImageAsset(stack, 'MyAsset2', {
      directory: path.join(__dirname, 'demo-image'),
      buildArgs: { key: token },
    })).toThrow(expected);
  });

  test('fails if using token as repositoryName', () => {
    // GIVEN
    const stack = new Stack();
    const token = Lazy.string({ produce: () => 'foo' });

    // THEN
    expect(() => new DockerImageAsset(stack, 'MyAsset1', {
      directory: path.join(__dirname, 'demo-image'),
      repositoryName: token,
    })).toThrow(/Cannot use Token as value of 'repositoryName'/);
  });

  testFutureBehavior('docker build options are included in the asset id', flags, App, (app) => {
    // GIVEN
    const stack = new Stack(app);
    const directory = path.join(__dirname, 'demo-image-custom-docker-file');

    const asset1 = new DockerImageAsset(stack, 'Asset1', { directory });
    const asset2 = new DockerImageAsset(stack, 'Asset2', { directory, file: 'Dockerfile.Custom' });
    const asset3 = new DockerImageAsset(stack, 'Asset3', { directory, target: 'NonDefaultTarget' });
    const asset4 = new DockerImageAsset(stack, 'Asset4', { directory, buildArgs: { opt1: '123', opt2: 'boom' } });
    const asset5 = new DockerImageAsset(stack, 'Asset5', { directory, file: 'Dockerfile.Custom', target: 'NonDefaultTarget' });
    const asset6 = new DockerImageAsset(stack, 'Asset6', { directory, extraHash: 'random-extra' });
    const asset7 = new DockerImageAsset(stack, 'Asset7', { directory, repositoryName: 'foo' });

    expect(asset1.assetHash).toEqual('ab01ecd4419f59e1ec0ac9e57a60dbb653be68a29af0223fa8cb24b4b747bc73');
    expect(asset2.assetHash).toEqual('7fb12f6148098e3f5c56c788a865d2af689125ead403b795fe6a262ec34384b3');
    expect(asset3.assetHash).toEqual('fc3b6d802ba198ba2ee55079dbef27682bcd1288d5849eb5bbd5cd69038359b3');
    expect(asset4.assetHash).toEqual('30439ea6dfeb4ddfd9175097286895c78393ef52a78c68f92db08abc4513cad6');
    expect(asset5.assetHash).toEqual('5775170880e26ba31799745241b90d4340c674bb3b1c01d758e416ee3f1c386f');
    expect(asset6.assetHash).toEqual('ba82fd351a4d3e3f5c5d948b9948e7e829badc3da90f97e00bb7724afbeacfd4');
    expect(asset7.assetHash).toEqual('26ec194928431cab6ec5af24ea9f01af2cf7b20e361128b07b2a7405d2951f95');
  });
});

function testDockerDirectoryIsStagedWithoutFilesSpecifiedInDockerignore(app: App, ignoreMode?: IgnoreMode) {
  const stack = new Stack(app);
  const image = new DockerImageAsset(stack, 'MyAsset', {
    ignoreMode,
    directory: path.join(__dirname, 'dockerignore-image'),
  });

  const session = app.synth();

  // .dockerignore itself should be included in output to be processed during docker build
  expect(fs.existsSync(path.join(session.directory, `asset.${image.assetHash}`, '.dockerignore'))).toBeDefined();
  expect(fs.existsSync(path.join(session.directory, `asset.${image.assetHash}`, 'Dockerfile'))).toBeDefined();
  expect(fs.existsSync(path.join(session.directory, `asset.${image.assetHash}`, 'index.py'))).toBeDefined();
  expect(!fs.existsSync(path.join(session.directory, `asset.${image.assetHash}`, 'foobar.txt'))).toBeDefined();
  expect(fs.existsSync(path.join(session.directory, `asset.${image.assetHash}`, 'subdirectory'))).toBeDefined();
  expect(fs.existsSync(path.join(session.directory, `asset.${image.assetHash}`, 'subdirectory', 'baz.txt'))).toBeDefined();
}

function testDockerDirectoryIsStagedWithoutFilesSpecifiedInExcludeOption(app: App, ignoreMode?: IgnoreMode) {
  const stack = new Stack(app);
  const image = new DockerImageAsset(stack, 'MyAsset', {
    directory: path.join(__dirname, 'dockerignore-image'),
    exclude: ['subdirectory'],
    ignoreMode,
  });

  const session = app.synth();

  expect(fs.existsSync(path.join(session.directory, `asset.${image.assetHash}`, '.dockerignore'))).toBeDefined();
  expect(fs.existsSync(path.join(session.directory, `asset.${image.assetHash}`, 'Dockerfile'))).toBeDefined();
  expect(fs.existsSync(path.join(session.directory, `asset.${image.assetHash}`, 'index.py'))).toBeDefined();
  expect(!fs.existsSync(path.join(session.directory, `asset.${image.assetHash}`, 'foobar.txt'))).toBeDefined();
  expect(!fs.existsSync(path.join(session.directory, `asset.${image.assetHash}`, 'subdirectory'))).toBeDefined();
  expect(!fs.existsSync(path.join(session.directory, `asset.${image.assetHash}`, 'subdirectory', 'baz.txt'))).toBeDefined();
}

testFutureBehavior('nested assemblies share assets: legacy synth edition', flags, App, (app) => {
  // GIVEN
  const stack1 = new Stack(new Stage(app, 'Stage1'), 'Stack', { synthesizer: new LegacyStackSynthesizer() });
  const stack2 = new Stack(new Stage(app, 'Stage2'), 'Stack', { synthesizer: new LegacyStackSynthesizer() });

  // WHEN
  new DockerImageAsset(stack1, 'Image', { directory: path.join(__dirname, 'demo-image') });
  new DockerImageAsset(stack2, 'Image', { directory: path.join(__dirname, 'demo-image') });

  // THEN
  const assembly = app.synth();

  // Read the assets from the stack metadata
  for (const stageName of ['Stage1', 'Stage2']) {
    const stackArtifact = assembly.getNestedAssembly(`assembly-${stageName}`).artifacts.filter(isStackArtifact)[0];
    const assetMeta = stackArtifact.findMetadataByType(cxschema.ArtifactMetadataEntryType.ASSET);
    expect(assetMeta[0]).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          path: `../asset.${DEMO_IMAGE_ASSET_HASH}`,
        }),
      }),
    );
  }
});

testFutureBehavior('nested assemblies share assets: default synth edition', flags, App, (app) => {
  // GIVEN
  const stack1 = new Stack(new Stage(app, 'Stage1'), 'Stack', { synthesizer: new DefaultStackSynthesizer() });
  const stack2 = new Stack(new Stage(app, 'Stage2'), 'Stack', { synthesizer: new DefaultStackSynthesizer() });

  // WHEN
  new DockerImageAsset(stack1, 'Image', { directory: path.join(__dirname, 'demo-image') });
  new DockerImageAsset(stack2, 'Image', { directory: path.join(__dirname, 'demo-image') });

  // THEN
  const assembly = app.synth();

  // Read the asset manifests to verify the file paths
  for (const stageName of ['Stage1', 'Stage2']) {
    const manifestArtifact = assembly.getNestedAssembly(`assembly-${stageName}`).artifacts.filter(isAssetManifestArtifact)[0];
    const manifest = JSON.parse(fs.readFileSync(manifestArtifact.file, { encoding: 'utf-8' }));

    expect(manifest.dockerImages[DEMO_IMAGE_ASSET_HASH].source).toEqual({
      directory: `../asset.${DEMO_IMAGE_ASSET_HASH}`,
    });
  }
});

function isStackArtifact(x: any): x is cxapi.CloudFormationStackArtifact {
  return x instanceof cxapi.CloudFormationStackArtifact;
}

function isAssetManifestArtifact(x: any): x is cxapi.AssetManifestArtifact {
  return x instanceof cxapi.AssetManifestArtifact;
}
