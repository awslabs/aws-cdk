import * as child_process from 'child_process';
import * as crypto from 'crypto';
import * as path from 'path';
import { nodeunitShim, Test } from 'nodeunit-shim';
import * as sinon from 'sinon';
import { BundlingDockerImage, DockerImage, FileSystem } from '../lib';

nodeunitShim({
  'tearDown'(callback: any) {
    sinon.restore();
    callback();
  },

  'bundling with image from registry'(test: Test) {
    const spawnSyncStub = sinon.stub(child_process, 'spawnSync').returns({
      status: 0,
      stderr: Buffer.from('stderr'),
      stdout: Buffer.from('stdout'),
      pid: 123,
      output: ['stdout', 'stderr'],
      signal: null,
    });

    const image = BundlingDockerImage.fromRegistry('alpine');
    image.run({
      command: ['cool', 'command'],
      environment: {
        VAR1: 'value1',
        VAR2: 'value2',
      },
      volumes: [{ hostPath: '/host-path', containerPath: '/container-path' }],
      workingDirectory: '/working-directory',
      user: 'user:group',
    });

    test.ok(spawnSyncStub.calledWith('docker', [
      'run', '--rm',
      '-u', 'user:group',
      '-v', '/host-path:/container-path:delegated',
      '--env', 'VAR1=value1',
      '--env', 'VAR2=value2',
      '-w', '/working-directory',
      'alpine',
      'cool', 'command',
    ], { stdio: ['ignore', process.stderr, 'inherit'] }));
    test.done();
  },

  'bundling with image from asset'(test: Test) {
    const spawnSyncStub = sinon.stub(child_process, 'spawnSync').returns({
      status: 0,
      stderr: Buffer.from('stderr'),
      stdout: Buffer.from('stdout'),
      pid: 123,
      output: ['stdout', 'stderr'],
      signal: null,
    });

    const imageHash = '123456abcdef';
    const fingerprintStub = sinon.stub(FileSystem, 'fingerprint');
    fingerprintStub.callsFake(() => imageHash);

    const image = DockerImage.fromBuild('docker-path', {
      buildArgs: {
        TEST_ARG: 'cdk-test',
      },
    });
    image.run();

    const tagHash = crypto.createHash('sha256').update(JSON.stringify({
      path: 'docker-path',
      buildArgs: {
        TEST_ARG: 'cdk-test',
      },
    })).digest('hex');
    const tag = `cdk-${tagHash}`;

    test.ok(spawnSyncStub.firstCall.calledWith('docker', [
      'build', '-t', tag,
      '--build-arg', 'TEST_ARG=cdk-test',
      'docker-path',
    ]));

    test.ok(spawnSyncStub.secondCall.calledWith('docker', [
      'run', '--rm',
      tag,
    ]));
    test.done();
  },

  'throws in case of spawnSync error'(test: Test) {
    sinon.stub(child_process, 'spawnSync').returns({
      status: 0,
      stderr: Buffer.from('stderr'),
      stdout: Buffer.from('stdout'),
      pid: 123,
      output: ['stdout', 'stderr'],
      signal: null,
      error: new Error('UnknownError'),
    });

    const image = BundlingDockerImage.fromRegistry('alpine');
    test.throws(() => image.run(), /UnknownError/);
    test.done();
  },

  'throws if status is not 0'(test: Test) {
    sinon.stub(child_process, 'spawnSync').returns({
      status: -1,
      stderr: Buffer.from('stderr'),
      stdout: Buffer.from('stdout'),
      pid: 123,
      output: ['stdout', 'stderr'],
      signal: null,
    });

    const image = BundlingDockerImage.fromRegistry('alpine');
    test.throws(() => image.run(), /\[Status -1\]/);
    test.done();
  },

  'BundlerDockerImage json is the bundler image name by default'(test: Test) {
    const image = BundlingDockerImage.fromRegistry('alpine');

    test.equals(image.toJSON(), 'alpine');
    test.done();
  },

  'BundlerDockerImage json is the bundler image if building an image'(test: Test) {
    sinon.stub(child_process, 'spawnSync').returns({
      status: 0,
      stderr: Buffer.from('stderr'),
      stdout: Buffer.from('stdout'),
      pid: 123,
      output: ['stdout', 'stderr'],
      signal: null,
    });
    const imageHash = '123456abcdef';
    const fingerprintStub = sinon.stub(FileSystem, 'fingerprint');
    fingerprintStub.callsFake(() => imageHash);

    const image = DockerImage.fromBuild('docker-path');

    const tagHash = crypto.createHash('sha256').update(JSON.stringify({
      path: 'docker-path',
    })).digest('hex');

    test.equals(image.image, `cdk-${tagHash}`);
    test.equals(image.toJSON(), imageHash);
    test.ok(fingerprintStub.calledWith('docker-path', sinon.match({ extraHash: JSON.stringify({}) })));
    test.done();
  },

  'custom dockerfile is passed through to docker exec'(test: Test) {
    const spawnSyncStub = sinon.stub(child_process, 'spawnSync').returns({
      status: 0,
      stderr: Buffer.from('stderr'),
      stdout: Buffer.from('sha256:1234567890abcdef'),
      pid: 123,
      output: ['stdout', 'stderr'],
      signal: null,
    });

    const imagePath = path.join(__dirname, 'fs/fixtures/test1');
    BundlingDockerImage.fromAsset(imagePath, {
      file: 'my-dockerfile',
    });

    test.ok(spawnSyncStub.calledOnce);
    const expected = path.join(imagePath, 'my-dockerfile');
    test.ok(new RegExp(`-f ${expected}`).test(spawnSyncStub.firstCall.args[1]?.join(' ') ?? ''));

    test.done();
  },

  'fromAsset'(test: Test) {
    sinon.stub(child_process, 'spawnSync').returns({
      status: 0,
      stderr: Buffer.from('stderr'),
      stdout: Buffer.from('sha256:1234567890abcdef'),
      pid: 123,
      output: ['stdout', 'stderr'],
      signal: null,
    });

    const imagePath = path.join(__dirname, 'fs/fixtures/test1');
    const image = BundlingDockerImage.fromAsset(imagePath, {
      file: 'my-dockerfile',
    });
    test.ok(image);
    test.ok(image.image);
    test.done();
  },

  'custom entrypoint is passed through to docker exec'(test: Test) {
    const spawnSyncStub = sinon.stub(child_process, 'spawnSync').returns({
      status: 0,
      stderr: Buffer.from('stderr'),
      stdout: Buffer.from('stdout'),
      pid: 123,
      output: ['stdout', 'stderr'],
      signal: null,
    });

    const image = BundlingDockerImage.fromRegistry('alpine');
    image.run({
      entrypoint: ['/cool/entrypoint', '--cool-entrypoint-arg'],
      command: ['cool', 'command'],
      environment: {
        VAR1: 'value1',
        VAR2: 'value2',
      },
      volumes: [{ hostPath: '/host-path', containerPath: '/container-path' }],
      workingDirectory: '/working-directory',
      user: 'user:group',
    });

    test.ok(spawnSyncStub.calledWith('docker', [
      'run', '--rm',
      '-u', 'user:group',
      '-v', '/host-path:/container-path:delegated',
      '--env', 'VAR1=value1',
      '--env', 'VAR2=value2',
      '-w', '/working-directory',
      '--entrypoint', '/cool/entrypoint',
      'alpine',
      '--cool-entrypoint-arg',
      'cool', 'command',
    ], { stdio: ['ignore', process.stderr, 'inherit'] }));
    test.done();
  },

  'cp utility copies from an image'(test: Test) {
    // GIVEN
    const containerId = '1234567890abcdef1234567890abcdef';
    const spawnSyncStub = sinon.stub(child_process, 'spawnSync').returns({
      status: 0,
      stderr: Buffer.from('stderr'),
      stdout: Buffer.from(`${containerId}\n`),
      pid: 123,
      output: ['stdout', 'stderr'],
      signal: null,
    });

    // WHEN
    BundlingDockerImage.fromRegistry('alpine').cp('/foo/bar', '/baz');

    // THEN
    test.ok(spawnSyncStub.calledWith(sinon.match.any, ['create', 'alpine'], sinon.match.any));
    test.ok(spawnSyncStub.calledWith(sinon.match.any, ['cp', `${containerId}:/foo/bar`, '/baz'], sinon.match.any));
    test.ok(spawnSyncStub.calledWith(sinon.match.any, ['rm', '-v', containerId]));

    test.done();
  },

  'cp utility cleans up after itself'(test: Test) {
    // GIVEN
    const containerId = '1234567890abcdef1234567890abcdef';
    const spawnSyncStub = sinon.stub(child_process, 'spawnSync').returns({
      status: 0,
      stderr: Buffer.from('stderr'),
      stdout: Buffer.from(`${containerId}\n`),
      pid: 123,
      output: ['stdout', 'stderr'],
      signal: null,
    });

    spawnSyncStub.withArgs(sinon.match.any, sinon.match.array.startsWith(['cp']), sinon.match.any)
      .returns({
        status: 1,
        stderr: Buffer.from('it failed for a very good reason'),
        stdout: Buffer.from('stdout'),
        pid: 123,
        output: ['stdout', 'stderr'],
        signal: null,
      });

    // WHEN
    test.throws(() => {
      BundlingDockerImage.fromRegistry('alpine').cp('/foo/bar', '/baz');
    }, /Failed.*copy/i);

    // THEN
    test.ok(spawnSyncStub.calledWith(sinon.match.any, ['rm', '-v', containerId]));
    test.done();
  },

  'cp utility copies to a temp dir of outputPath is omitted'(test: Test) {
    // GIVEN
    const containerId = '1234567890abcdef1234567890abcdef';
    sinon.stub(child_process, 'spawnSync').returns({
      status: 0,
      stderr: Buffer.from('stderr'),
      stdout: Buffer.from(`${containerId}\n`),
      pid: 123,
      output: ['stdout', 'stderr'],
      signal: null,
    });

    // WHEN
    const tempPath = DockerImage.fromRegistry('alpine').cp('/foo/bar');

    // THEN
    test.ok(/cdk-docker-cp-/.test(tempPath));

    test.done();
  },
});
