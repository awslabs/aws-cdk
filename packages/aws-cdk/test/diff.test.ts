import { Writable } from 'stream';
import { NodeStringDecoder, StringDecoder } from 'string_decoder';
import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import { FormatStream, TemplateDiff, LogicalPathMap, DifferenceFormatter } from '@aws-cdk/cloudformation-diff';
import { CloudFormationStackArtifact } from '@aws-cdk/cx-api';
import { PluginHost } from '../lib';
import { CloudFormationDeployments } from '../lib/api/cloudformation-deployments';
import { CdkToolkit } from '../lib/cdk-toolkit';
import { DifferenceFormatterSource } from '../lib/diff';
import { instanceMockFrom, MockCloudExecutable } from './util';

class TestDifferenceFormatter extends DifferenceFormatter {
  formatDifferences(): void {
    this.formatSecurityChanges();
    this.stream.write('This is TestDifferenceFormatter.formatDifferences');
    this.stream.write(JSON.stringify(this.templateDiff));
    this.stream.write(JSON.stringify(this.logicalToPathMap));
    this.stream.write(JSON.stringify(this.context));
  }
  formatSecurityChanges(): void {
    this.stream.write('This is TestDifferenceFormatter.formatSecurityChanges');
  }
}

let cloudExecutable: MockCloudExecutable;
let cloudFormation: jest.Mocked<CloudFormationDeployments>;
let toolkit: CdkToolkit;
let differenceFormatterSource: DifferenceFormatterSource;

beforeEach(() => {
  cloudExecutable = new MockCloudExecutable({
    stacks: [{
      stackName: 'A',
      template: { resource: 'A' },
    },
    {
      stackName: 'B',
      depends: ['A'],
      template: { resource: 'B' },
    },
    {
      stackName: 'C',
      depends: ['A'],
      template: { resource: 'C' },
      metadata: {
        '/resource': [
          {
            type: cxschema.ArtifactMetadataEntryType.ERROR,
            data: 'this is an error',
          },
        ],
      },
    },
    {
      stackName: 'D',
      template: { resource: 'D' },
    }],
  });

  cloudFormation = instanceMockFrom(CloudFormationDeployments);

  toolkit = new CdkToolkit({
    cloudExecutable,
    cloudFormation,
    configuration: cloudExecutable.configuration,
    sdkProvider: cloudExecutable.sdkProvider,
  });

  differenceFormatterSource = {
    name: 'cool-test',
    getFormatter(stream: FormatStream,
      templateDiff: TemplateDiff,
      logicalToPathMap?: LogicalPathMap,
      context?: number) {
      return new TestDifferenceFormatter(stream, templateDiff, logicalToPathMap, context);
    },
  };

  // Default implementations
  cloudFormation.readCurrentTemplate.mockImplementation((stackArtifact: CloudFormationStackArtifact) => {
    if (stackArtifact.stackName === 'D') {
      return Promise.resolve({ resource: 'D' });
    }
    return Promise.resolve({});
  });
  cloudFormation.deployStack.mockImplementation((options) => Promise.resolve({
    noOp: true,
    outputs: {},
    stackArn: '',
    stackArtifact: options.stack,
  }));
});

test('diff can diff multiple stacks', async () => {
  // GIVEN
  const buffer = new StringWritable();

  // WHEN
  const exitCode = await toolkit.diff({
    stackNames: ['B'],
    stream: buffer,
  });

  // THEN
  const plainTextOutput = buffer.data.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
  expect(plainTextOutput).toContain('Stack A');
  expect(plainTextOutput).toContain('Stack B');

  expect(exitCode).toBe(0);
});

test('diff can diff multiple stacks with custom formatter', async () => {
  // GIVEN
  const buffer = new StringWritable();
  PluginHost.instance.registerDifferenceFormatterSource(differenceFormatterSource);

  // WHEN
  const exitCode = await toolkit.diff({
    stackNames: ['B'],
    stream: buffer,

  });

  // THEN
  const plainTextOutput = buffer.data.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
  expect(plainTextOutput).toContain('Stack A');
  expect(plainTextOutput).toContain('Stack B');
  expect(plainTextOutput).toContain('This is TestDifferenceFormatter.formatDifferences');
  expect(plainTextOutput).toContain('This is TestDifferenceFormatter.formatSecurityChanges');

  expect(exitCode).toBe(0);
});

test('exits with 1 with diffs and fail set to true', async () => {
  // GIVEN
  const buffer = new StringWritable();

  // WHEN
  const exitCode = await toolkit.diff({
    stackNames: ['A'],
    stream: buffer,
    fail: true,
  });

  // THEN
  expect(exitCode).toBe(1);
});

test('exits with 1 with diff in first stack, but not in second stack and fail set to true', async () => {
  // GIVEN
  const buffer = new StringWritable();

  // WHEN
  const exitCode = await toolkit.diff({
    stackNames: ['A', 'D'],
    stream: buffer,
    fail: true,
  });

  // THEN
  expect(exitCode).toBe(1);
});

test('throws an error during diffs on stack with error metadata', async () => {
  const buffer = new StringWritable();

  // WHEN
  await expect(() => toolkit.diff({
    stackNames: ['C'],
    stream: buffer,
  })).rejects.toThrow(/Found errors/);
});

class StringWritable extends Writable {
  public data: string;
  private readonly _decoder: NodeStringDecoder;

  constructor(options: any = {}) {
    super(options);
    this._decoder = new StringDecoder(options && options.defaultEncoding);
    this.data = '';
  }

  public _write(chunk: any, encoding: string, callback: (error?: Error | undefined) => void) {
    if (encoding === 'buffer') {
      chunk = this._decoder.write(chunk);
    }
    this.data += chunk;
    callback();
  }

  public _final(callback: (error?: Error | null) => void) {
    this.data += this._decoder.end();
    callback();
  }
}
