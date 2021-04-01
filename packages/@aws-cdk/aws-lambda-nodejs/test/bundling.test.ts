import * as child_process from 'child_process';
import * as os from 'os';
import * as path from 'path';
import { Code, Runtime } from '@aws-cdk/aws-lambda';
import { AssetHashType, DockerImage } from '@aws-cdk/core';
import { version as delayVersion } from 'delay/package.json';
import { Bundling } from '../lib/bundling';
import { LogLevel } from '../lib/types';
import * as util from '../lib/util';

jest.mock('@aws-cdk/aws-lambda');

// Mock BundlingDockerImage.fromAsset() to avoid building the image
let fromAssetMock = jest.spyOn(DockerImage, 'fromBuild');
let getEsBuildVersionMock = jest.spyOn(util, 'getEsBuildVersion');
beforeEach(() => {
  jest.clearAllMocks();
  jest.resetAllMocks();
  Bundling.clearRunsLocallyCache();
  getEsBuildVersionMock.mockReturnValue('0.8.8');
  fromAssetMock.mockReturnValue({
    image: 'built-image',
    cp: () => 'dest-path',
    run: () => {},
    toJSON: () => 'built-image',
  });
});

let depsLockFilePath = '/project/yarn.lock';
let entry = '/project/lib/handler.ts';
let tsconfig = '/project/lib/custom-tsconfig.ts';

test('esbuild bundling in Docker', () => {
  Bundling.bundle({
    entry,
    depsLockFilePath,
    runtime: Runtime.NODEJS_12_X,
    environment: {
      KEY: 'value',
    },
    loader: {
      '.png': 'dataurl',
    },
    forceDockerBundling: true,
  });

  // Correctly bundles with esbuild
  expect(Code.fromAsset).toHaveBeenCalledWith(path.dirname(depsLockFilePath), {
    assetHashType: AssetHashType.OUTPUT,
    bundling: expect.objectContaining({
      environment: {
        KEY: 'value',
      },
      command: [
        'bash', '-c',
        'npx esbuild --bundle "/asset-input/lib/handler.ts" --target=node12 --platform=node --outfile="/asset-output/index.js" --external:aws-sdk --loader:.png=dataurl',
      ],
      workingDirectory: '/',
    }),
  });
});

test('esbuild bundling with handler named index.ts', () => {
  Bundling.bundle({
    entry: '/project/lib/index.ts',
    depsLockFilePath,
    runtime: Runtime.NODEJS_12_X,
    forceDockerBundling: true,
  });

  // Correctly bundles with esbuild
  expect(Code.fromAsset).toHaveBeenCalledWith('/project', {
    assetHashType: AssetHashType.OUTPUT,
    bundling: expect.objectContaining({
      command: [
        'bash', '-c',
        'npx esbuild --bundle "/asset-input/lib/index.ts" --target=node12 --platform=node --outfile="/asset-output/index.js" --external:aws-sdk',
      ],
    }),
  });
});

test('esbuild bundling with tsx handler', () => {
  Bundling.bundle({
    entry: '/project/lib/handler.tsx',
    depsLockFilePath,
    runtime: Runtime.NODEJS_12_X,
    forceDockerBundling: true,
  });

  // Correctly bundles with esbuild
  expect(Code.fromAsset).toHaveBeenCalledWith('/project', {
    assetHashType: AssetHashType.OUTPUT,
    bundling: expect.objectContaining({
      command: [
        'bash', '-c',
        'npx esbuild --bundle "/asset-input/lib/handler.tsx" --target=node12 --platform=node --outfile="/asset-output/index.js" --external:aws-sdk',
      ],
    }),
  });
});

test('esbuild with Windows paths', () => {
  const osPlatformMock = jest.spyOn(os, 'platform').mockReturnValue('win32');

  Bundling.bundle({
    entry: 'C:\\my-project\\lib\\entry.ts',
    runtime: Runtime.NODEJS_12_X,
    depsLockFilePath: 'C:\\my-project\\package-lock.json',
    forceDockerBundling: true,
  });

  expect(Code.fromAsset).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
    bundling: expect.objectContaining({
      command: expect.arrayContaining([
        expect.stringContaining('/lib/entry.ts'),
      ]),
    }),
  }));

  osPlatformMock.mockRestore();
});

test('esbuild bundling with externals and dependencies', () => {
  const packageLock = path.join(__dirname, '..', 'package-lock.json');
  Bundling.bundle({
    entry: __filename,
    depsLockFilePath: packageLock,
    runtime: Runtime.NODEJS_12_X,
    externalModules: ['abc'],
    nodeModules: ['delay'],
    forceDockerBundling: true,
  });

  // Correctly bundles with esbuild
  expect(Code.fromAsset).toHaveBeenCalledWith(path.dirname(packageLock), {
    assetHashType: AssetHashType.OUTPUT,
    bundling: expect.objectContaining({
      command: [
        'bash', '-c',
        [
          'npx esbuild --bundle "/asset-input/test/bundling.test.js" --target=node12 --platform=node --outfile="/asset-output/index.js" --external:abc --external:delay',
          `echo \'{\"dependencies\":{\"delay\":\"${delayVersion}\"}}\' > /asset-output/package.json`,
          'cp /asset-input/package-lock.json /asset-output/package-lock.json',
          'cd /asset-output',
          'npm install',
        ].join(' && '),
      ],
    }),
  });
});

test('esbuild bundling with esbuild options', () => {
  Bundling.bundle({
    entry,
    depsLockFilePath,
    runtime: Runtime.NODEJS_12_X,
    minify: true,
    sourceMap: true,
    target: 'es2020',
    loader: {
      '.png': 'dataurl',
    },
    logLevel: LogLevel.SILENT,
    keepNames: true,
    tsconfig,
    metafile: true,
    banner: '/* comments */',
    footer: '/* comments */',
    forceDockerBundling: true,
    define: {
      'DEBUG': 'true',
      'process.env.KEY': JSON.stringify('VALUE'),
    },
  });

  // Correctly bundles with esbuild
  expect(Code.fromAsset).toHaveBeenCalledWith(path.dirname(depsLockFilePath), {
    assetHashType: AssetHashType.OUTPUT,
    bundling: expect.objectContaining({
      command: [
        'bash', '-c',
        [
          'npx esbuild --bundle "/asset-input/lib/handler.ts"',
          '--target=es2020 --platform=node --outfile="/asset-output/index.js"',
          '--minify --sourcemap --external:aws-sdk --loader:.png=dataurl',
          '--define:DEBUG=true --define:process.env.KEY="VALUE"',
          '--log-level=silent --keep-names --tsconfig=/asset-input/lib/custom-tsconfig.ts',
          '--metafile=/asset-output/index.meta.json --banner=\'/* comments */\' --footer=\'/* comments */\'',
        ].join(' '),
      ],
    }),
  });
});

test('Detects yarn.lock', () => {
  const yarnLock = path.join(__dirname, '..', 'yarn.lock');
  Bundling.bundle({
    entry: __filename,
    depsLockFilePath: yarnLock,
    runtime: Runtime.NODEJS_12_X,
    nodeModules: ['delay'],
    forceDockerBundling: true,
  });

  // Correctly bundles with esbuild
  expect(Code.fromAsset).toHaveBeenCalledWith(path.dirname(yarnLock), {
    assetHashType: AssetHashType.OUTPUT,
    bundling: expect.objectContaining({
      command: expect.arrayContaining([
        expect.stringMatching(/yarn\.lock.+yarn install/),
      ]),
    }),
  });
});

test('with Docker build args', () => {
  Bundling.bundle({
    entry,
    depsLockFilePath,
    runtime: Runtime.NODEJS_12_X,
    buildArgs: {
      HELLO: 'WORLD',
    },
    forceDockerBundling: true,
  });

  expect(fromAssetMock).toHaveBeenCalledWith(expect.stringMatching(/lib$/), expect.objectContaining({
    buildArgs: expect.objectContaining({
      HELLO: 'WORLD',
    }),
  }));
});

test('Local bundling', () => {
  const spawnSyncMock = jest.spyOn(child_process, 'spawnSync').mockReturnValue({
    status: 0,
    stderr: Buffer.from('stderr'),
    stdout: Buffer.from('stdout'),
    pid: 123,
    output: ['stdout', 'stderr'],
    signal: null,
  });

  const bundler = new Bundling({
    entry,
    depsLockFilePath,
    runtime: Runtime.NODEJS_12_X,
    environment: {
      KEY: 'value',
    },
  });

  expect(bundler.local).toBeDefined();

  const tryBundle = bundler.local?.tryBundle('/outdir', { image: Runtime.NODEJS_12_X.bundlingDockerImage });
  expect(tryBundle).toBe(true);

  expect(spawnSyncMock).toHaveBeenCalledWith(
    'bash',
    expect.arrayContaining(['-c', expect.stringContaining(entry)]),
    expect.objectContaining({
      env: expect.objectContaining({ KEY: 'value' }),
      cwd: '/project/lib',
    }),
  );

  // Docker image is not built
  expect(fromAssetMock).not.toHaveBeenCalled();

  spawnSyncMock.mockRestore();
});


test('Incorrect esbuild version', () => {
  getEsBuildVersionMock.mockReturnValueOnce('3.4.5');

  const bundler = new Bundling({
    entry,
    depsLockFilePath,
    runtime: Runtime.NODEJS_12_X,
  });

  const tryBundle = bundler.local?.tryBundle('/outdir', { image: Runtime.NODEJS_12_X.bundlingDockerImage });
  expect(tryBundle).toBe(false);
});

test('Custom bundling docker image', () => {
  Bundling.bundle({
    entry,
    depsLockFilePath,
    runtime: Runtime.NODEJS_12_X,
    dockerImage: DockerImage.fromRegistry('my-custom-image'),
    forceDockerBundling: true,
  });

  expect(Code.fromAsset).toHaveBeenCalledWith('/project', {
    assetHashType: AssetHashType.OUTPUT,
    bundling: expect.objectContaining({
      image: { image: 'my-custom-image' },
    }),
  });
});

test('with command hooks', () => {
  Bundling.bundle({
    entry,
    depsLockFilePath,
    runtime: Runtime.NODEJS_12_X,
    commandHooks: {
      beforeBundling(inputDir: string, outputDir: string): string[] {
        return [
          `echo hello > ${inputDir}/a.txt`,
          `cp ${inputDir}/a.txt ${outputDir}`,
        ];
      },
      afterBundling(inputDir: string, outputDir: string): string[] {
        return [`cp ${inputDir}/b.txt ${outputDir}/txt`];
      },
      beforeInstall() {
        return [];
      },
    },
    forceDockerBundling: true,
  });

  expect(Code.fromAsset).toHaveBeenCalledWith(path.dirname(depsLockFilePath), {
    assetHashType: AssetHashType.OUTPUT,
    bundling: expect.objectContaining({
      command: [
        'bash', '-c',
        expect.stringMatching(/^echo hello > \/asset-input\/a.txt && cp \/asset-input\/a.txt \/asset-output && .+ && cp \/asset-input\/b.txt \/asset-output\/txt$/),
      ],
    }),
  });
});
