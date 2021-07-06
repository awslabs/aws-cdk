import * as os from 'os';
import * as path from 'path';
import { FileAssetPackaging } from '@aws-cdk/cloud-assembly-schema';
import * as cxapi from '@aws-cdk/cx-api';
import * as fs from 'fs-extra';
import { nodeunitShim, Test } from 'nodeunit-shim';
import * as sinon from 'sinon';
import { App, AssetHashType, AssetStaging, BundlingDockerImage, BundlingOptions, BundlingOutput, FileSystem, Stack, Stage } from '../lib';

const STUB_INPUT_FILE = '/tmp/docker-stub.input';
const STUB_INPUT_CONCAT_FILE = '/tmp/docker-stub.input.concat';

enum DockerStubCommand {
  SUCCESS = 'DOCKER_STUB_SUCCESS',
  FAIL = 'DOCKER_STUB_FAIL',
  SUCCESS_NO_OUTPUT = 'DOCKER_STUB_SUCCESS_NO_OUTPUT',
  MULTIPLE_FILES = 'DOCKER_STUB_MULTIPLE_FILES',
  SINGLE_ARCHIVE = 'DOCKER_STUB_SINGLE_ARCHIVE',
}

const FIXTURE_TEST1_DIR = path.join(__dirname, 'fs', 'fixtures', 'test1');
const FIXTURE_TARBALL = path.join(__dirname, 'fs', 'fixtures.tar.gz');

const userInfo = os.userInfo();
const USER_ARG = `-u ${userInfo.uid}:${userInfo.gid}`;

// this is a way to provide a custom "docker" command for staging.
process.env.CDK_DOCKER = `${__dirname}/docker-stub.sh`;

nodeunitShim({

  'tearDown'(cb: any) {
    AssetStaging.clearAssetHashCache();
    if (fs.existsSync(STUB_INPUT_FILE)) {
      fs.unlinkSync(STUB_INPUT_FILE);
    }
    if (fs.existsSync(STUB_INPUT_CONCAT_FILE)) {
      fs.unlinkSync(STUB_INPUT_CONCAT_FILE);
    }
    cb();
    sinon.restore();
  },

  'base case'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const sourcePath = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // WHEN
    const staging = new AssetStaging(stack, 's1', { sourcePath });

    test.deepEqual(staging.sourceHash, '2f37f937c51e2c191af66acf9b09f548926008ec68c575bd2ee54b6e997c0e00');
    test.deepEqual(staging.sourcePath, sourcePath);
    test.deepEqual(path.basename(staging.stagedPath), 'asset.2f37f937c51e2c191af66acf9b09f548926008ec68c575bd2ee54b6e997c0e00');
    test.deepEqual(path.basename(staging.relativeStagedPath(stack)), 'asset.2f37f937c51e2c191af66acf9b09f548926008ec68c575bd2ee54b6e997c0e00');
    test.deepEqual(staging.packaging, FileAssetPackaging.ZIP_DIRECTORY);
    test.deepEqual(staging.isArchive, true);
    test.done();
  },

  'staging of an archive file correctly sets packaging and isArchive'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const sourcePath = path.join(__dirname, 'archive', 'archive.zip');

    // WHEN
    const staging = new AssetStaging(stack, 's1', { sourcePath });

    test.deepEqual(staging.packaging, FileAssetPackaging.FILE);
    test.deepEqual(staging.isArchive, true);
    test.done();
  },

  'asset packaging type is correct when staging is skipped because of memory cache'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const sourcePath = path.join(__dirname, 'archive', 'archive.zip');

    // WHEN
    const staging1 = new AssetStaging(stack, 's1', { sourcePath });
    const staging2 = new AssetStaging(stack, 's2', { sourcePath });

    test.deepEqual(staging1.packaging, FileAssetPackaging.FILE);
    test.deepEqual(staging1.isArchive, true);
    test.deepEqual(staging2.packaging, staging1.packaging);
    test.deepEqual(staging2.isArchive, staging1.isArchive);
    test.done();
  },

  'asset packaging type is correct when staging is skipped because of disk cache'(test: Test) {
    // GIVEN
    const TEST_OUTDIR = path.join(__dirname, 'cdk.out');
    if (fs.existsSync(TEST_OUTDIR)) {
      fs.removeSync(TEST_OUTDIR);
    }

    const sourcePath = path.join(__dirname, 'archive', 'archive.zip');

    const app1 = new App({ outdir: TEST_OUTDIR });
    const stack1 = new Stack(app1, 'Stack');

    const app2 = new App({ outdir: TEST_OUTDIR }); // same OUTDIR
    const stack2 = new Stack(app2, 'stack');

    // WHEN
    const staging1 = new AssetStaging(stack1, 'Asset', { sourcePath });

    // Now clear asset hash cache to show that during the second staging
    // even though the asset is already available on disk it will correctly
    // be considered as a FileAssetPackaging.FILE.
    AssetStaging.clearAssetHashCache();

    const staging2 = new AssetStaging(stack2, 'Asset', { sourcePath });

    // THEN
    test.deepEqual(staging1.packaging, FileAssetPackaging.FILE);
    test.deepEqual(staging1.isArchive, true);
    test.deepEqual(staging2.packaging, staging1.packaging);
    test.deepEqual(staging2.isArchive, staging1.isArchive);

    test.done();
  },

  'staging of a non-archive file correctly sets packaging and isArchive'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const sourcePath = __filename;

    // WHEN
    const staging = new AssetStaging(stack, 's1', { sourcePath });

    test.deepEqual(staging.packaging, FileAssetPackaging.FILE);
    test.deepEqual(staging.isArchive, false);
    test.done();
  },

  'staging can be disabled through context'(test: Test) {
    // GIVEN
    const stack = new Stack();
    stack.node.setContext(cxapi.DISABLE_ASSET_STAGING_CONTEXT, true);
    const sourcePath = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // WHEN
    const staging = new AssetStaging(stack, 's1', { sourcePath });

    test.deepEqual(staging.sourceHash, '2f37f937c51e2c191af66acf9b09f548926008ec68c575bd2ee54b6e997c0e00');
    test.deepEqual(staging.sourcePath, sourcePath);
    test.deepEqual(staging.stagedPath, sourcePath);
    test.deepEqual(staging.relativeStagedPath(stack), sourcePath);
    test.done();
  },

  'files are copied to the output directory during synth'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');

    // WHEN
    new AssetStaging(stack, 's1', { sourcePath: FIXTURE_TEST1_DIR });
    new AssetStaging(stack, 'file', { sourcePath: FIXTURE_TARBALL });

    // THEN
    const assembly = app.synth();
    test.deepEqual(fs.readdirSync(assembly.directory), [
      'asset.2f37f937c51e2c191af66acf9b09f548926008ec68c575bd2ee54b6e997c0e00',
      'asset.af10ac04b3b607b0f8659c8f0cee8c343025ee75baf0b146f10f0e5311d2c46b.gz',
      'cdk.out',
      'manifest.json',
      'stack.template.json',
      'tree.json',
    ]);
    test.done();
  },

  'assets in nested assemblies get staged into assembly root directory'(test: Test) {
    // GIVEN
    const app = new App();
    const stack1 = new Stack(new Stage(app, 'Stage1'), 'Stack');
    const stack2 = new Stack(new Stage(app, 'Stage2'), 'Stack');

    // WHEN
    new AssetStaging(stack1, 's1', { sourcePath: FIXTURE_TEST1_DIR });
    new AssetStaging(stack2, 's1', { sourcePath: FIXTURE_TEST1_DIR });

    // THEN
    const assembly = app.synth();

    // One asset directory at the top
    test.deepEqual(fs.readdirSync(assembly.directory), [
      'assembly-Stage1',
      'assembly-Stage2',
      'asset.2f37f937c51e2c191af66acf9b09f548926008ec68c575bd2ee54b6e997c0e00',
      'cdk.out',
      'manifest.json',
      'tree.json',
    ]);
    test.done();
  },

  'allow specifying extra data to include in the source hash'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // WHEN
    const withoutExtra = new AssetStaging(stack, 'withoutExtra', { sourcePath: directory });
    const withExtra = new AssetStaging(stack, 'withExtra', { sourcePath: directory, extraHash: 'boom' });

    // THEN
    test.notEqual(withoutExtra.sourceHash, withExtra.sourceHash);
    test.deepEqual(withoutExtra.sourceHash, '2f37f937c51e2c191af66acf9b09f548926008ec68c575bd2ee54b6e997c0e00');
    test.deepEqual(withExtra.sourceHash, 'c95c915a5722bb9019e2c725d11868e5a619b55f36172f76bcbcaa8bb2d10c5f');
    test.done();
  },

  'with bundling'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');
    const processStdErrWriteSpy = sinon.spy(process.stderr, 'write');

    // WHEN
    new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.SUCCESS],
      },
    });

    // THEN
    const assembly = app.synth();
    test.deepEqual(
      readDockerStubInput(),
      `run --rm ${USER_ARG} -v /input:/asset-input:delegated -v /output:/asset-output:delegated -w /asset-input alpine DOCKER_STUB_SUCCESS`,
    );
    test.deepEqual(fs.readdirSync(assembly.directory), [
      'asset.b1e32e86b3523f2fa512eb99180ee2975a50a4439e63e8badd153f2a68d61aa4',
      'cdk.out',
      'manifest.json',
      'stack.template.json',
      'tree.json',
    ]);

    // shows a message before bundling
    test.ok(processStdErrWriteSpy.calledWith('Bundling asset stack/Asset...\n'));

    test.done();
  },

  'bundled resources have absolute path when staging is disabled'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    stack.node.setContext(cxapi.DISABLE_ASSET_STAGING_CONTEXT, true);
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // WHEN
    const asset = new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.SUCCESS],
      },
    });

    // THEN
    const assembly = app.synth();

    test.deepEqual(fs.readdirSync(assembly.directory), [
      'asset.b1e32e86b3523f2fa512eb99180ee2975a50a4439e63e8badd153f2a68d61aa4',
      'cdk.out',
      'manifest.json',
      'stack.template.json',
      'tree.json',
    ]);

    test.equal(asset.sourceHash, 'b1e32e86b3523f2fa512eb99180ee2975a50a4439e63e8badd153f2a68d61aa4');
    test.equal(asset.sourcePath, directory);

    const resolvedStagePath = asset.relativeStagedPath(stack);
    // absolute path ending with bundling dir
    test.ok(path.isAbsolute(resolvedStagePath));
    test.ok(new RegExp('asset.b1e32e86b3523f2fa512eb99180ee2975a50a4439e63e8badd153f2a68d61aa4$').test(resolvedStagePath));

    test.done();
  },

  'bundler reuses its output when it can'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // WHEN
    new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.SUCCESS],
      },
    });

    new AssetStaging(stack, 'AssetDuplicate', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.SUCCESS],
      },
    });

    // THEN
    const assembly = app.synth();

    // We're testing that docker was run exactly once even though there are two bundling assets.
    test.deepEqual(
      readDockerStubInputConcat(),
      `run --rm ${USER_ARG} -v /input:/asset-input:delegated -v /output:/asset-output:delegated -w /asset-input alpine DOCKER_STUB_SUCCESS`,
    );

    test.deepEqual(fs.readdirSync(assembly.directory), [
      'asset.b1e32e86b3523f2fa512eb99180ee2975a50a4439e63e8badd153f2a68d61aa4',
      'cdk.out',
      'manifest.json',
      'stack.template.json',
      'tree.json',
    ]);

    test.done();
  },

  'uses asset hash cache with AssetHashType.OUTPUT'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');
    const fingerPrintSpy = sinon.spy(FileSystem, 'fingerprint');

    // WHEN
    new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      assetHashType: AssetHashType.OUTPUT,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.SUCCESS],
      },
    });

    new AssetStaging(stack, 'AssetDuplicate', {
      sourcePath: directory,
      assetHashType: AssetHashType.OUTPUT,
      bundling: { // Same bundling but with keys ordered differently
        command: [DockerStubCommand.SUCCESS],
        image: BundlingDockerImage.fromRegistry('alpine'),
      },
    });

    // THEN
    const assembly = app.synth();

    // We're testing that docker was run exactly once even though there are two bundling assets
    // and that the hash is based on the output
    test.deepEqual(
      readDockerStubInputConcat(),
      `run --rm ${USER_ARG} -v /input:/asset-input:delegated -v /output:/asset-output:delegated -w /asset-input alpine DOCKER_STUB_SUCCESS`,
    );

    test.deepEqual(fs.readdirSync(assembly.directory), [
      'asset.33cbf2cae5432438e0f046bc45ba8c3cef7b6afcf47b59d1c183775c1918fb1f',
      'cdk.out',
      'manifest.json',
      'stack.template.json',
      'tree.json',
    ]);

    // Only one fingerprinting
    test.ok(fingerPrintSpy.calledOnce);

    test.done();
  },

  'bundler considers its options when reusing bundle output'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // WHEN
    new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.SUCCESS],
      },
    });

    new AssetStaging(stack, 'AssetWithDifferentBundlingOptions', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.SUCCESS],
        environment: {
          UNIQUE_ENV_VAR: 'SOMEVALUE',
        },
      },
    });

    // THEN
    const assembly = app.synth();

    // We're testing that docker was run twice - once for each set of bundler options
    // operating on the same source asset.
    test.deepEqual(
      readDockerStubInputConcat(),
      `run --rm ${USER_ARG} -v /input:/asset-input:delegated -v /output:/asset-output:delegated -w /asset-input alpine DOCKER_STUB_SUCCESS\n` +
      `run --rm ${USER_ARG} -v /input:/asset-input:delegated -v /output:/asset-output:delegated --env UNIQUE_ENV_VAR=SOMEVALUE -w /asset-input alpine DOCKER_STUB_SUCCESS`,
    );

    test.deepEqual(fs.readdirSync(assembly.directory), [
      'asset.b1e32e86b3523f2fa512eb99180ee2975a50a4439e63e8badd153f2a68d61aa4', // 'Asset'
      'asset.e80bb8f931b87e84975de193f5a7ecddd7558d3caf3d35d3a536d9ae6539234f', // 'AssetWithDifferentBundlingOptions'
      'cdk.out',
      'manifest.json',
      'stack.template.json',
      'tree.json',
    ]);

    test.done();
  },

  'bundler outputs to intermediate dir and renames to asset'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');
    const ensureDirSync = sinon.spy(fs, 'ensureDirSync');
    const chmodSyncSpy = sinon.spy(fs, 'chmodSync');
    const renameSyncSpy = sinon.spy(fs, 'renameSync');

    // WHEN
    new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      assetHashType: AssetHashType.BUNDLE,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.SUCCESS],
      },
    });

    // THEN
    const assembly = app.synth();

    test.ok(ensureDirSync.calledWith(sinon.match(path.join(assembly.directory, 'bundling-temp-'))));
    test.ok(chmodSyncSpy.calledWith(sinon.match(path.join(assembly.directory, 'bundling-temp-')), 0o777));
    test.ok(renameSyncSpy.calledWith(sinon.match(path.join(assembly.directory, 'bundling-temp-')), sinon.match(path.join(assembly.directory, 'asset.'))));

    test.deepEqual(fs.readdirSync(assembly.directory), [
      'asset.33cbf2cae5432438e0f046bc45ba8c3cef7b6afcf47b59d1c183775c1918fb1f', // 'Asset'
      'cdk.out',
      'manifest.json',
      'stack.template.json',
      'tree.json',
    ]);

    test.done();
  },

  'bundling failure preserves the bundleDir for diagnosability'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // WHEN
    test.throws(() => new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.FAIL],
      },
    }), /Failed.*bundl.*asset.*-error/);

    // THEN
    const assembly = app.synth();

    const dir = fs.readdirSync(assembly.directory);
    test.ok(dir.some(entry => entry.match(/asset.*-error/)));

    test.done();
  },

  'bundler re-uses assets from previous synths'(test: Test) {
    // GIVEN
    const TEST_OUTDIR = path.join(__dirname, 'cdk.out');
    if (fs.existsSync(TEST_OUTDIR)) {
      fs.removeSync(TEST_OUTDIR);
    }

    const app = new App({ outdir: TEST_OUTDIR });
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // WHEN
    new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.SUCCESS],
      },
    });

    // Clear asset hash cache to show that during the second synth bundling
    // will consider the existing bundling dir (file system cache).
    AssetStaging.clearAssetHashCache();

    // GIVEN
    const app2 = new App({ outdir: TEST_OUTDIR });
    const stack2 = new Stack(app2, 'stack');

    // WHEN
    new AssetStaging(stack2, 'Asset', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.SUCCESS],
      },
    });

    // THEN
    const appAssembly = app.synth();
    const app2Assembly = app2.synth();

    test.deepEqual(
      readDockerStubInputConcat(),
      `run --rm ${USER_ARG} -v /input:/asset-input:delegated -v /output:/asset-output:delegated -w /asset-input alpine DOCKER_STUB_SUCCESS`,
    );

    test.equals(appAssembly.directory, app2Assembly.directory);
    test.deepEqual(fs.readdirSync(appAssembly.directory), [
      'asset.b1e32e86b3523f2fa512eb99180ee2975a50a4439e63e8badd153f2a68d61aa4',
      'cdk.out',
      'manifest.json',
      'stack.template.json',
      'tree.json',
    ]);

    test.done();
  },

  'bundling throws when /asset-ouput is empty'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // THEN
    test.throws(() => new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.SUCCESS_NO_OUTPUT],
      },
    }), /Bundling did not produce any output/);

    test.equal(
      readDockerStubInput(),
      `run --rm ${USER_ARG} -v /input:/asset-input:delegated -v /output:/asset-output:delegated -w /asset-input alpine DOCKER_STUB_SUCCESS_NO_OUTPUT`,
    );
    test.done();
  },

  'bundling with BUNDLE asset hash type'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // WHEN
    const asset = new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.SUCCESS],
      },
      assetHashType: AssetHashType.BUNDLE,
    });

    // THEN
    test.equal(
      readDockerStubInput(),
      `run --rm ${USER_ARG} -v /input:/asset-input:delegated -v /output:/asset-output:delegated -w /asset-input alpine DOCKER_STUB_SUCCESS`,
    );
    test.equal(asset.assetHash, '33cbf2cae5432438e0f046bc45ba8c3cef7b6afcf47b59d1c183775c1918fb1f');

    test.done();
  },


  'bundling with docker security option'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // WHEN
    const asset = new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.SUCCESS],
        securityOpt: 'no-new-privileges',
      },
      assetHashType: AssetHashType.BUNDLE,
    });

    // THEN
    test.equal(
      readDockerStubInput(),
      `run --rm --security-opt no-new-privileges ${USER_ARG} -v /input:/asset-input:delegated -v /output:/asset-output:delegated -w /asset-input alpine DOCKER_STUB_SUCCESS`,
    );
    test.equal(asset.assetHash, '33cbf2cae5432438e0f046bc45ba8c3cef7b6afcf47b59d1c183775c1918fb1f');

    test.done();
  },

  'bundling with OUTPUT asset hash type'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // WHEN
    const asset = new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.SUCCESS],
      },
      assetHashType: AssetHashType.OUTPUT,
    });

    // THEN
    test.equal(asset.assetHash, '33cbf2cae5432438e0f046bc45ba8c3cef7b6afcf47b59d1c183775c1918fb1f');

    test.done();
  },

  'custom hash'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // WHEN
    const asset = new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      assetHash: 'my-custom-hash',
    });

    // THEN
    test.equal(fs.existsSync(STUB_INPUT_FILE), false);
    test.equal(asset.assetHash, 'b9c77053f5b83bbe5ba343bc18e92db939a49017010813225fea91fa892c4823'); // hash of 'my-custom-hash'

    test.done();
  },

  'throws with assetHash and not CUSTOM hash type'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // THEN
    test.throws(() => new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.SUCCESS],
      },
      assetHash: 'my-custom-hash',
      assetHashType: AssetHashType.BUNDLE,
    }), /Cannot specify `bundle` for `assetHashType`/);

    test.done();
  },

  'throws with BUNDLE hash type and no bundling'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // THEN
    test.throws(() => new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      assetHashType: AssetHashType.BUNDLE,
    }), /Cannot use `bundle` hash type when `bundling` is not specified/);
    test.equal(fs.existsSync(STUB_INPUT_FILE), false);

    test.done();
  },

  'throws with OUTPUT hash type and no bundling'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // THEN
    test.throws(() => new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      assetHashType: AssetHashType.OUTPUT,
    }), /Cannot use `output` hash type when `bundling` is not specified/);
    test.equal(fs.existsSync(STUB_INPUT_FILE), false);

    test.done();
  },

  'throws with CUSTOM and no hash'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // THEN
    test.throws(() => new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      assetHashType: AssetHashType.CUSTOM,
    }), /`assetHash` must be specified when `assetHashType` is set to `AssetHashType.CUSTOM`/);
    test.equal(fs.existsSync(STUB_INPUT_FILE), false); // "docker" not executed

    test.done();
  },

  'throws when bundling fails'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // THEN
    test.throws(() => new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('this-is-an-invalid-docker-image'),
        command: [DockerStubCommand.FAIL],
      },
    }), /Failed to bundle asset stack\/Asset/);
    test.equal(
      readDockerStubInput(),
      `run --rm ${USER_ARG} -v /input:/asset-input:delegated -v /output:/asset-output:delegated -w /asset-input this-is-an-invalid-docker-image DOCKER_STUB_FAIL`,
    );

    test.done();
  },

  'with local bundling'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // WHEN
    let dir: string | undefined;
    let opts: BundlingOptions | undefined;
    new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.SUCCESS],
        local: {
          tryBundle(outputDir: string, options: BundlingOptions): boolean {
            dir = outputDir;
            opts = options;
            fs.writeFileSync(path.join(outputDir, 'hello.txt'), 'hello'); // output cannot be empty
            return true;
          },
        },
      },
    });

    // THEN
    test.ok(dir && /asset.[0-9a-f]{16,}/.test(dir));
    test.equals(opts?.command?.[0], DockerStubCommand.SUCCESS);
    test.throws(() => readDockerStubInput());

    if (dir) {
      fs.removeSync(path.join(dir, 'hello.txt'));
    }

    test.done();
  },

  'with local bundling returning false'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // WHEN
    new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.SUCCESS],
        local: {
          tryBundle(_bundleDir: string): boolean {
            return false;
          },
        },
      },
    });

    // THEN
    test.ok(readDockerStubInput());

    test.done();
  },

  'bundling can be skipped by setting context'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'MyStack');
    stack.node.setContext(cxapi.BUNDLING_STACKS, ['OtherStack']);
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // WHEN
    const asset = new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      assetHashType: AssetHashType.BUNDLE,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.SUCCESS],
      },
    });

    test.throws(() => readDockerStubInput()); // Bundling did not run
    test.equal(asset.sourcePath, directory);
    test.equal(asset.stagedPath, directory);
    test.equal(asset.relativeStagedPath(stack), directory);
    test.equal(asset.assetHash, 'f66d7421aa2d044a6c1f60ddfc76dc78571fcd8bd228eb48eb394e2dbad94a5c');

    test.done();
  },

  'bundling still occurs with partial wildcard'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'MyStack');
    stack.node.setContext(cxapi.BUNDLING_STACKS, ['*Stack']);
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // WHEN
    const asset = new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      assetHashType: AssetHashType.BUNDLE,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.SUCCESS],
      },
    });

    test.equal(
      readDockerStubInput(),
      `run --rm ${USER_ARG} -v /input:/asset-input:delegated -v /output:/asset-output:delegated -w /asset-input alpine DOCKER_STUB_SUCCESS`,
    );
    test.equal(asset.assetHash, '33cbf2cae5432438e0f046bc45ba8c3cef7b6afcf47b59d1c183775c1918fb1f'); // hash of MyStack/Asset

    test.done();
  },

  'bundling still occurs with full wildcard'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'MyStack');
    stack.node.setContext(cxapi.BUNDLING_STACKS, ['*']);
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // WHEN
    const asset = new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      assetHashType: AssetHashType.BUNDLE,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.SUCCESS],
      },
    });

    test.equal(
      readDockerStubInput(),
      `run --rm ${USER_ARG} -v /input:/asset-input:delegated -v /output:/asset-output:delegated -w /asset-input alpine DOCKER_STUB_SUCCESS`,
    );
    test.equal(asset.assetHash, '33cbf2cae5432438e0f046bc45ba8c3cef7b6afcf47b59d1c183775c1918fb1f'); // hash of MyStack/Asset

    test.done();
  },

  'bundling that produces a single archive file is autodiscovered'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // WHEN
    const staging = new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.SINGLE_ARCHIVE],
      },
    });

    // THEN
    const assembly = app.synth();
    test.deepEqual(fs.readdirSync(assembly.directory), [
      'asset.f43148c61174f444925231b5849b468f21e93b5d1469cd07c53625ffd039ef48', // this is the bundle dir
      'asset.f43148c61174f444925231b5849b468f21e93b5d1469cd07c53625ffd039ef48.zip',
      'cdk.out',
      'manifest.json',
      'stack.template.json',
      'tree.json',
    ]);
    test.deepEqual(fs.readdirSync(path.join(assembly.directory, 'asset.f43148c61174f444925231b5849b468f21e93b5d1469cd07c53625ffd039ef48')), [
      'test.zip', // bundle dir with "touched" bundled output file
    ]);
    test.deepEqual(staging.packaging, FileAssetPackaging.FILE);
    test.deepEqual(staging.isArchive, true);

    test.done();
  },

  'bundling that produces a single archive file with disk cache'(test: Test) {
    // GIVEN
    const TEST_OUTDIR = path.join(__dirname, 'cdk.out');
    if (fs.existsSync(TEST_OUTDIR)) {
      fs.removeSync(TEST_OUTDIR);
    }

    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    const app1 = new App({ outdir: TEST_OUTDIR });
    const stack1 = new Stack(app1, 'Stack');

    const app2 = new App({ outdir: TEST_OUTDIR }); // same OUTDIR
    const stack2 = new Stack(app2, 'stack');

    // WHEN
    const staging1 = new AssetStaging(stack1, 'Asset', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.SINGLE_ARCHIVE],
        outputType: BundlingOutput.ARCHIVED,
      },
    });

    // Now clear asset hash cache to show that during the second staging
    // even though bundling is skipped it will correctly be considered
    // as a FileAssetPackaging.FILE.
    AssetStaging.clearAssetHashCache();

    const staging2 = new AssetStaging(stack2, 'Asset', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.SINGLE_ARCHIVE],
        outputType: BundlingOutput.ARCHIVED,
      },
    });

    // THEN
    test.deepEqual(staging1.packaging, FileAssetPackaging.FILE);
    test.deepEqual(staging1.isArchive, true);
    test.deepEqual(staging2.packaging, staging1.packaging);
    test.deepEqual(staging2.isArchive, staging1.isArchive);

    test.done();
  },

  'bundling that produces a single archive file with NOT_ARCHIVED'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // WHEN
    const staging = new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.SINGLE_ARCHIVE],
        outputType: BundlingOutput.NOT_ARCHIVED,
      },
    });

    // THEN
    const assembly = app.synth();
    test.deepEqual(fs.readdirSync(assembly.directory), [
      'asset.86ec07746e1d859290cfd8b9c648e581555649c75f51f741f11e22cab6775abc',
      'cdk.out',
      'manifest.json',
      'stack.template.json',
      'tree.json',
    ]);
    test.deepEqual(staging.packaging, FileAssetPackaging.ZIP_DIRECTORY);
    test.deepEqual(staging.isArchive, true);

    test.done();
  },

  'throws with ARCHIVED and bundling that does not produce a single archive file'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');

    // WHEN
    test.throws(() => new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [DockerStubCommand.MULTIPLE_FILES],
        outputType: BundlingOutput.ARCHIVED,
      },
    }), /Bundling output directory is expected to include only a single .zip or .jar file when `output` is set to `ARCHIVED`/);


    test.done();
  },
});

// Reads a docker stub and cleans the volume paths out of the stub.
function readAndCleanDockerStubInput(file: string) {
  return fs
    .readFileSync(file, 'utf-8')
    .trim()
    .replace(/-v ([^:]+):\/asset-input/g, '-v /input:/asset-input')
    .replace(/-v ([^:]+):\/asset-output/g, '-v /output:/asset-output');
}

// Last docker input since last teardown
function readDockerStubInput() {
  return readAndCleanDockerStubInput(STUB_INPUT_FILE);
}
// Concatenated docker inputs since last teardown
function readDockerStubInputConcat() {
  return readAndCleanDockerStubInput(STUB_INPUT_CONCAT_FILE);
}
