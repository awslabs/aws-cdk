import * as cxapi from '@aws-cdk/cx-api';
import * as fs from 'fs-extra';
import { Test } from 'nodeunit';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import { App, AssetHashType, AssetStaging, BundlingDockerImage, Stack } from '../lib';

const STUB_INPUT_FILE = '/tmp/docker-stub.input';
const STUB_INPUT_CONCAT_FILE = '/tmp/docker-stub.input.concat';
const STAGING_TMP_DIRECTORY = path.join('.', '.cdk.staging');

enum DockerStubCommand {
  SUCCESS           = 'DOCKER_STUB_SUCCESS',
  FAIL              = 'DOCKER_STUB_FAIL',
  SUCCESS_NO_OUTPUT = 'DOCKER_STUB_SUCCESS_NO_OUTPUT'
}

const userInfo = os.userInfo();
const USER_ARG = `-u ${userInfo.uid}:${userInfo.gid}`;

// this is a way to provide a custom "docker" command for staging.
process.env.CDK_DOCKER = `${__dirname}/docker-stub.sh`;

export = {

  'tearDown'(cb: any) {
    if (fs.existsSync(STUB_INPUT_FILE)) {
      fs.unlinkSync(STUB_INPUT_FILE);
    }
    if (fs.existsSync(STUB_INPUT_CONCAT_FILE)) {
      fs.unlinkSync(STUB_INPUT_CONCAT_FILE);
    }
    if (fs.existsSync(STAGING_TMP_DIRECTORY)) {
      fs.removeSync(STAGING_TMP_DIRECTORY);
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
    test.deepEqual(stack.resolve(staging.stagedPath), 'asset.2f37f937c51e2c191af66acf9b09f548926008ec68c575bd2ee54b6e997c0e00');
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
    test.deepEqual(stack.resolve(staging.stagedPath), sourcePath);
    test.done();
  },

  'files are copied to the output directory during synth'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');
    const file = path.join(__dirname, 'fs', 'fixtures.tar.gz');

    // WHEN
    new AssetStaging(stack, 's1', { sourcePath: directory });
    new AssetStaging(stack, 'file', { sourcePath: file });

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
    const ensureDirSyncSpy = sinon.spy(fs, 'ensureDirSync');

    // WHEN
    new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [ DockerStubCommand.SUCCESS ],
      },
    });

    // THEN
    const assembly = app.synth();
    test.deepEqual(
      readDockerStubInput(),
      `run --rm ${USER_ARG} -v /input:/asset-input:delegated -v /output:/asset-output:delegated -w /asset-input alpine DOCKER_STUB_SUCCESS`,
    );
    test.deepEqual(fs.readdirSync(assembly.directory), [
      'asset.2f37f937c51e2c191af66acf9b09f548926008ec68c575bd2ee54b6e997c0e00',
      'cdk.out',
      'manifest.json',
      'stack.template.json',
      'tree.json',
    ]);

    // asset is bundled in a directory inside .cdk.staging
    test.ok(ensureDirSyncSpy.calledWith(STAGING_TMP_DIRECTORY));
    test.ok(ensureDirSyncSpy.calledWith(path.resolve(path.join(STAGING_TMP_DIRECTORY, 'asset-bundle-hash-dec215520dfd57a87aa1362e9e15131938583cd6e5a2bd9a45d38fe5dc5ab3d7'))));
    test.done();
  },

  'bundler reuses its output when it can'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');
    const ensureDirSyncSpy = sinon.spy(fs, 'ensureDirSync');

    // WHEN
    new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [ DockerStubCommand.SUCCESS ],
      },
    });

    new AssetStaging(stack, 'AssetDuplicate', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [ DockerStubCommand.SUCCESS ],
      },
    });

    // THEN
    app.synth();

    // We're testing that docker was run exactly once even though there are two bundling assets.
    test.deepEqual(
      readDockerStubInputConcat(),
      `run --rm ${USER_ARG} -v /input:/asset-input:delegated -v /output:/asset-output:delegated -w /asset-input alpine DOCKER_STUB_SUCCESS`,
    );

    // asset is bundled in a directory inside .cdk.staging
    test.ok(ensureDirSyncSpy.calledWith(STAGING_TMP_DIRECTORY));
    test.ok(ensureDirSyncSpy.calledWith(path.resolve(path.join(STAGING_TMP_DIRECTORY, 'asset-bundle-hash-dec215520dfd57a87aa1362e9e15131938583cd6e5a2bd9a45d38fe5dc5ab3d7'))));

    test.done();
  },

  'bundler considers its options when reusing bundle output'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');
    const ensureDirSyncSpy = sinon.spy(fs, 'ensureDirSync');

    // WHEN
    new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [ DockerStubCommand.SUCCESS ],
      },
    });

    new AssetStaging(stack, 'AssetWithDifferentBundlingOptions', {
      sourcePath: directory,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [ DockerStubCommand.SUCCESS ],
        environment: {
          UNIQUE_ENV_VAR: 'SOMEVALUE',
        },
      },
    });

    // THEN
    app.synth();

    // We're testing that docker was run twice - once for each set of bundler options
    // operating on the same source asset.
    test.deepEqual(
      readDockerStubInputConcat(),
      `run --rm ${USER_ARG} -v /input:/asset-input:delegated -v /output:/asset-output:delegated -w /asset-input alpine DOCKER_STUB_SUCCESS\n` +
      `run --rm ${USER_ARG} -v /input:/asset-input:delegated -v /output:/asset-output:delegated --env UNIQUE_ENV_VAR=SOMEVALUE -w /asset-input alpine DOCKER_STUB_SUCCESS`,
    );

    // asset is bundled in a directory inside .cdk.staging
    test.ok(ensureDirSyncSpy.calledWith(STAGING_TMP_DIRECTORY));
    // 'Asset'
    test.ok(ensureDirSyncSpy.calledWith(path.resolve(path.join(STAGING_TMP_DIRECTORY, 'asset-bundle-hash-dec215520dfd57a87aa1362e9e15131938583cd6e5a2bd9a45d38fe5dc5ab3d7'))));
    // 'AssetWithDifferentBundlingOptions'
    test.ok(ensureDirSyncSpy.calledWith(path.resolve(path.join(STAGING_TMP_DIRECTORY, 'asset-bundle-hash-a33245f0209379d58d125d89906c2b47d38382ae745375f25697760a8c475c6b'))));

    test.done();
  },

  'bundler outputs to a temp dir when using bundle asset type'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');
    const directory = path.join(__dirname, 'fs', 'fixtures', 'test1');
    const mkdtempSyncSpy = sinon.spy(fs, 'mkdtempSync');
    const chmodSyncSpy = sinon.spy(fs, 'chmodSync');

    // WHEN
    new AssetStaging(stack, 'Asset', {
      sourcePath: directory,
      assetHashType: AssetHashType.BUNDLE,
      bundling: {
        image: BundlingDockerImage.fromRegistry('alpine'),
        command: [ DockerStubCommand.SUCCESS ],
      },
    });

    // THEN
    test.ok(mkdtempSyncSpy.calledWith(sinon.match(path.join(STAGING_TMP_DIRECTORY, 'asset-bundle-temp-'))));
    test.ok(chmodSyncSpy.calledWith(sinon.match(path.join(STAGING_TMP_DIRECTORY, 'asset-bundle-temp-')), 0o777));

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
        command: [ DockerStubCommand.FAIL ],
      },
    }), /Failed to run bundling.*asset-bundle-hash.*-error/);

    // THEN
    test.ok(!fs.existsSync(path.resolve(path.join(STAGING_TMP_DIRECTORY,
      'asset-bundle-hash-e40b2b1537234d458e9e524494dc0a7a364079d457a2886a44b1f3c28a956469'))));
    test.ok(fs.existsSync(path.join(STAGING_TMP_DIRECTORY,
      'asset-bundle-hash-e40b2b1537234d458e9e524494dc0a7a364079d457a2886a44b1f3c28a956469-error')));

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
        command: [ DockerStubCommand.SUCCESS_NO_OUTPUT ],
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
        command: [ DockerStubCommand.SUCCESS ],
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
        command: [ DockerStubCommand.SUCCESS ],
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
    }), /Cannot use `AssetHashType.BUNDLE` when `bundling` is not specified/);
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
        command: [ DockerStubCommand.FAIL ],
      },
    }), /Failed to run bundling Docker image for asset stack\/Asset/);
    test.equal(
      readDockerStubInput(),
      `run --rm ${USER_ARG} -v /input:/asset-input:delegated -v /output:/asset-output:delegated -w /asset-input this-is-an-invalid-docker-image DOCKER_STUB_FAIL`,
    );

    test.done();
  },
};

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
