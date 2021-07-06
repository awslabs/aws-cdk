import * as child_process from 'child_process';
import * as os from 'os';
import * as path from 'path';
import { Code, Runtime } from '@aws-cdk/aws-lambda';
import { AssetHashType, DockerImage } from '@aws-cdk/core';
import { version as delayVersion } from 'delay/package.json';
import { Bundling } from '../lib/bundling';
import { EsbuildInstallation } from '../lib/esbuild-installation';
import { LogLevel } from '../lib/types';
import * as util from '../lib/util';

jest.mock('@aws-cdk/aws-lambda');

// Mock DockerImage.fromAsset() to avoid building the image
let fromBuildMock: jest.SpyInstance<DockerImage>;
let detectEsbuildMock: jest.SpyInstance<EsbuildInstallation | undefined>;
beforeEach(() => {
  jest.clearAllMocks();
  jest.resetAllMocks();
  jest.restoreAllMocks();
  Bundling.clearEsbuildInstallationCache();

  detectEsbuildMock = jest.spyOn(EsbuildInstallation, 'detect').mockReturnValue({
    isLocal: true,
    version: '0.8.8',
  });

  fromBuildMock = jest.spyOn(DockerImage, 'fromBuild').mockReturnValue({
    image: 'built-image',
    cp: () => 'dest-path',
    run: () => {},
    toJSON: () => 'built-image',
  });
});

let projectRoot = '/project';
let depsLockFilePath = '/project/yarn.lock';
let entry = '/project/lib/handler.ts';
let tsconfig = '/project/lib/custom-tsconfig.ts';

test('esbuild bundling in Docker', () => {
  Bundling.bundle({
    entry,
    projectRoot,
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
        'esbuild --bundle "/asset-input/lib/handler.ts" --target=node12 --platform=node --outfile="/asset-output/index.js" --external:aws-sdk --loader:.png=dataurl',
      ],
      workingDirectory: '/',
    }),
  });
});

test('esbuild bundling with handler named index.ts', () => {
  Bundling.bundle({
    entry: '/project/lib/index.ts',
    projectRoot,
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
        'esbuild --bundle "/asset-input/lib/index.ts" --target=node12 --platform=node --outfile="/asset-output/index.js" --external:aws-sdk',
      ],
    }),
  });
});

test('esbuild bundling with tsx handler', () => {
  Bundling.bundle({
    entry: '/project/lib/handler.tsx',
    projectRoot,
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
        'esbuild --bundle "/asset-input/lib/handler.tsx" --target=node12 --platform=node --outfile="/asset-output/index.js" --external:aws-sdk',
      ],
    }),
  });
});

test('esbuild with Windows paths', () => {
  const osPlatformMock = jest.spyOn(os, 'platform').mockReturnValue('win32');
  // Mock path.basename() because it cannot extract the basename of a Windows
  // path when running on Linux
  jest.spyOn(path, 'basename').mockReturnValueOnce('package-lock.json');
  jest.spyOn(path, 'relative').mockReturnValueOnce('lib\\entry.ts').mockReturnValueOnce('package-lock.json');

  Bundling.bundle({
    entry: 'C:\\my-project\\lib\\entry.ts',
    runtime: Runtime.NODEJS_12_X,
    projectRoot: 'C:\\my-project',
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
    projectRoot: path.dirname(packageLock),
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
          'esbuild --bundle "/asset-input/test/bundling.test.js" --target=node12 --platform=node --outfile="/asset-output/index.js" --external:abc --external:delay',
          `echo \'{\"dependencies\":{\"delay\":\"${delayVersion}\"}}\' > /asset-output/package.json`,
          'cp /asset-input/package-lock.json /asset-output/package-lock.json',
          'cd /asset-output',
          'npm ci',
        ].join(' && '),
      ],
    }),
  });
});

test('esbuild bundling with esbuild options', () => {
  Bundling.bundle({
    entry,
    projectRoot,
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
      'process.env.KEY': JSON.stringify('VALUE'),
      'process.env.BOOL': 'true',
      'process.env.NUMBER': '7777',
      'process.env.STRING': JSON.stringify('this is a "test"'),
    },
  });

  // Correctly bundles with esbuild
  const defineInstructions = '--define:process.env.KEY="\\"VALUE\\"" --define:process.env.BOOL="true" --define:process.env.NUMBER="7777" --define:process.env.STRING="\\"this is a \\\\\\"test\\\\\\"\\""';
  expect(Code.fromAsset).toHaveBeenCalledWith(path.dirname(depsLockFilePath), {
    assetHashType: AssetHashType.OUTPUT,
    bundling: expect.objectContaining({
      command: [
        'bash', '-c',
        [
          'esbuild --bundle "/asset-input/lib/handler.ts"',
          '--target=es2020 --platform=node --outfile="/asset-output/index.js"',
          '--minify --sourcemap --external:aws-sdk --loader:.png=dataurl',
          defineInstructions,
          '--log-level=silent --keep-names --tsconfig=/asset-input/lib/custom-tsconfig.ts',
          '--metafile=/asset-output/index.meta.json --banner:js="/* comments */" --footer:js="/* comments */"',
        ].join(' '),
      ],
    }),
  });

  // Make sure that the define instructions are working as expected with the esbuild CLI
  const bundleProcess = util.exec('bash', ['-c', `npx esbuild --bundle ${`${__dirname}/integ-handlers/define.ts`} ${defineInstructions}`]);
  expect(bundleProcess.stdout.toString()).toMatchSnapshot();
});

test('Detects yarn.lock', () => {
  const yarnLock = path.join(__dirname, '..', 'yarn.lock');
  Bundling.bundle({
    entry: __filename,
    projectRoot: path.dirname(yarnLock),
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

test('Detects pnpm-lock.yaml', () => {
  const pnpmLock = '/project/pnpm-lock.yaml';
  Bundling.bundle({
    entry: __filename,
    projectRoot,
    depsLockFilePath: pnpmLock,
    runtime: Runtime.NODEJS_12_X,
    nodeModules: ['delay'],
    forceDockerBundling: true,
  });

  // Correctly bundles with esbuild
  expect(Code.fromAsset).toHaveBeenCalledWith(path.dirname(pnpmLock), {
    assetHashType: AssetHashType.OUTPUT,
    bundling: expect.objectContaining({
      command: expect.arrayContaining([
        expect.stringMatching(/pnpm-lock\.yaml.+pnpm install/),
      ]),
    }),
  });
});

test('with Docker build args', () => {
  Bundling.bundle({
    entry,
    projectRoot,
    depsLockFilePath,
    runtime: Runtime.NODEJS_12_X,
    buildArgs: {
      HELLO: 'WORLD',
    },
    forceDockerBundling: true,
  });

  expect(fromBuildMock).toHaveBeenCalledWith(expect.stringMatching(/lib$/), expect.objectContaining({
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
    projectRoot,
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
      cwd: '/project',
    }),
  );

  // Docker image is not built
  expect(fromBuildMock).not.toHaveBeenCalled();

  spawnSyncMock.mockRestore();
});


test('Incorrect esbuild version', () => {
  detectEsbuildMock.mockReturnValueOnce({
    isLocal: true,
    version: '3.4.5',
  });

  const bundler = new Bundling({
    entry,
    projectRoot,
    depsLockFilePath,
    runtime: Runtime.NODEJS_12_X,
  });

  expect(() => bundler.local?.tryBundle('/outdir', {
    image: Runtime.NODEJS_12_X.bundlingImage,
  })).toThrow(/Expected esbuild version 0.x but got 3.4.5/);
});

test('Custom bundling docker image', () => {
  Bundling.bundle({
    entry,
    projectRoot,
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
    projectRoot,
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

test('esbuild bundling with projectRoot', () => {
  Bundling.bundle({
    entry: '/project/lib/index.ts',
    projectRoot: '/project',
    depsLockFilePath,
    tsconfig,
    runtime: Runtime.NODEJS_12_X,
  });

  // Correctly bundles with esbuild
  expect(Code.fromAsset).toHaveBeenCalledWith('/project', {
    assetHashType: AssetHashType.OUTPUT,
    bundling: expect.objectContaining({
      command: [
        'bash', '-c',
        'esbuild --bundle "/asset-input/lib/index.ts" --target=node12 --platform=node --outfile="/asset-output/index.js" --external:aws-sdk --tsconfig=/asset-input/lib/custom-tsconfig.ts',
      ],
    }),
  });
});

test('esbuild bundling with projectRoot and externals and dependencies', () => {
  const repoRoot = path.join(__dirname, '../../../..');
  const packageLock = path.join(repoRoot, 'common', 'package-lock.json');
  Bundling.bundle({
    entry: __filename,
    projectRoot: repoRoot,
    depsLockFilePath: packageLock,
    runtime: Runtime.NODEJS_12_X,
    externalModules: ['abc'],
    nodeModules: ['delay'],
    forceDockerBundling: true,
  });

  // Correctly bundles with esbuild
  expect(Code.fromAsset).toHaveBeenCalledWith(repoRoot, {
    assetHashType: AssetHashType.OUTPUT,
    bundling: expect.objectContaining({
      command: [
        'bash', '-c',
        [
          'esbuild --bundle "/asset-input/packages/@aws-cdk/aws-lambda-nodejs/test/bundling.test.js" --target=node12 --platform=node --outfile="/asset-output/index.js" --external:abc --external:delay',
          `echo \'{\"dependencies\":{\"delay\":\"${delayVersion}\"}}\' > /asset-output/package.json`,
          'cp /asset-input/common/package-lock.json /asset-output/package-lock.json',
          'cd /asset-output',
          'npm ci',
        ].join(' && '),
      ],
    }),
  });
});
