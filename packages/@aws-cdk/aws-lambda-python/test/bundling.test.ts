import * as fs from 'fs';
import * as path from 'path';
import { Code, Runtime } from '@aws-cdk/aws-lambda';
import { DockerImage, FileSystem } from '@aws-cdk/core';
import { stageDependencies, bundle } from '../lib/bundling';

jest.mock('@aws-cdk/aws-lambda');

jest.mock('child_process', () => ({
  spawnSync: jest.fn(() => {
    return {
      status: 0,
      stderr: Buffer.from('stderr'),
      stdout: Buffer.from('sha256:1234567890abcdef'),
      pid: 123,
      output: ['stdout', 'stderr'],
      signal: null,
    };
  }),
}));

// Mock DockerImage.fromAsset() to avoid building the image
let fromBuildMock: jest.SpyInstance<DockerImage>;
beforeEach(() => {
  jest.clearAllMocks();

  fromBuildMock = jest.spyOn(DockerImage, 'fromBuild').mockReturnValue({
    image: 'built-image',
    cp: () => 'dest-path',
    run: () => {},
    toJSON: () => 'built-image',
  });
});

test('Bundling a function without dependencies', () => {
  const entry = path.join(__dirname, 'lambda-handler-nodeps');
  bundle({
    entry: entry,
    runtime: Runtime.PYTHON_3_7,
    outputPathSuffix: '.',
  });

  // Correctly bundles
  expect(Code.fromAsset).toHaveBeenCalledWith(entry, expect.objectContaining({
    bundling: expect.objectContaining({
      command: [
        'bash', '-c',
        'rsync -r . /asset-output/.',
      ],
    }),
  }));
});

test('Bundling a function with requirements.txt installed', () => {
  const entry = path.join(__dirname, 'lambda-handler');
  bundle({
    entry: entry,
    runtime: Runtime.PYTHON_3_7,
    outputPathSuffix: '.',
  });

  // Correctly bundles
  expect(Code.fromAsset).toHaveBeenCalledWith(entry, expect.objectContaining({
    bundling: expect.objectContaining({
      command: [
        'bash', '-c',
        'rsync -r /var/dependencies/. /asset-output/. && rsync -r . /asset-output/.',
      ],
    }),
  }));
});

test('Bundling Python 2.7 with requirements.txt installed', () => {
  const entry = path.join(__dirname, 'lambda-handler');
  bundle({
    entry: entry,
    runtime: Runtime.PYTHON_2_7,
    outputPathSuffix: '.',
  });

  // Correctly bundles with requirements.txt pip installed
  expect(Code.fromAsset).toHaveBeenCalledWith(entry, expect.objectContaining({
    bundling: expect.objectContaining({
      command: [
        'bash', '-c',
        'rsync -r /var/dependencies/. /asset-output/. && rsync -r . /asset-output/.',
      ],
    }),
  }));
});

test('Bundling a layer with dependencies', () => {
  const entry = path.join(__dirname, 'lambda-handler');

  bundle({
    entry: entry,
    runtime: Runtime.PYTHON_2_7,
    outputPathSuffix: 'python',
  });

  expect(Code.fromAsset).toHaveBeenCalledWith(entry, expect.objectContaining({
    bundling: expect.objectContaining({
      command: [
        'bash', '-c',
        'rsync -r /var/dependencies/. /asset-output/python && rsync -r . /asset-output/python',
      ],
    }),
  }));
});

test('Bundling a python code layer', () => {
  const entry = path.join(__dirname, 'lambda-handler-nodeps');

  bundle({
    entry: path.join(entry, '.'),
    runtime: Runtime.PYTHON_2_7,
    outputPathSuffix: 'python',
  });

  expect(Code.fromAsset).toHaveBeenCalledWith(entry, expect.objectContaining({
    bundling: expect.objectContaining({
      command: [
        'bash', '-c',
        'rsync -r . /asset-output/python',
      ],
    }),
  }));
});


describe('Dependency detection', () => {
  test.each(['Pipfile', 'poetry.lock', 'requirements.txt'])('detect dependency %p', filename => {
    // GIVEN
    const sourcedir = FileSystem.mkdtemp('source-');
    const stagedir = FileSystem.mkdtemp('stage-');
    fs.writeFileSync(path.join(sourcedir, filename), 'dummy!');

    // WHEN
    const found = stageDependencies(sourcedir, stagedir);

    // THEN
    expect(found).toBeTruthy();
    expect(fs.existsSync(path.join(stagedir, filename))).toBeTruthy();
  });

  test('No known dependencies', () => {
    const sourcedir = FileSystem.mkdtemp('source-');
    expect(stageDependencies(sourcedir, '/dummy')).toEqual(false);
  });
});

test('Bundling Docker with custom bundling image', () => {
  const entry = path.join(__dirname, 'lambda-handler-custom-build-docker-image');
  bundle({
    entry,
    runtime: Runtime.PYTHON_3_7,
    outputPathSuffix: '.',
    buildImageOptions: {
      buildArgs: {
        HELLO: 'WORLD',
        IMAGE: Runtime.PYTHON_3_7.bundlingImage.image,
      },
      file: 'Dockerfile.build',
    },
  });

  expect(fromBuildMock).toHaveBeenCalledWith(expect.stringContaining('python-bundling'),
    expect.objectContaining({
      buildArgs: expect.objectContaining({
        HELLO: 'WORLD',
        IMAGE: Runtime.PYTHON_3_7.bundlingImage.image,
      }),
      file: expect.stringContaining('Dockerfile.build'),
    }),
  );
});
