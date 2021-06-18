import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { arrayWith, ResourcePart, stringLike } from '@aws-cdk/assert-internal';
import '@aws-cdk/assert-internal/jest';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import { Asset } from '@aws-cdk/aws-s3-assets';
import { AssetStaging, App, Aws, CfnResource, Stack, DefaultStackSynthesizer, IStackSynthesizer, FileAssetSource, FileAssetLocation } from '@aws-cdk/core';
import * as ec2 from '../lib';

let app: App;
let stack: Stack;
let instanceRole: iam.Role;
let resource: CfnResource;
let linuxUserData: ec2.UserData;

function resetState() {
  resetStateWithSynthesizer();
}

function resetStateWithSynthesizer(customSynthesizer?: IStackSynthesizer) {
  app = new App();
  stack = new Stack(app, 'Stack', {
    env: { account: '1234', region: 'testregion' },
    synthesizer: customSynthesizer,
  });
  instanceRole = new iam.Role(stack, 'InstanceRole', {
    assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
  });
  resource = new CfnResource(stack, 'Resource', {
    type: 'CDK::Test::Resource',
  });
  linuxUserData = ec2.UserData.forLinux();
};

beforeEach(resetState);

test('whole config with restart handles', () => {
  // WHEN
  const handle = new ec2.InitServiceRestartHandle();
  const config = new ec2.InitConfig([
    ec2.InitFile.fromString('/etc/my.cnf', '[mysql]\ngo_fast=true', { serviceRestartHandles: [handle] }),
    ec2.InitSource.fromUrl('/tmp/foo', 'https://amazon.com/foo.zip', { serviceRestartHandles: [handle] }),
    ec2.InitPackage.yum('httpd', { serviceRestartHandles: [handle] }),
    ec2.InitCommand.argvCommand(['/bin/true'], { serviceRestartHandles: [handle] }),
    ec2.InitService.enable('httpd', { serviceRestartHandle: handle }),
  ]);

  // THEN
  expect(config._bind(stack, linuxOptions()).config).toEqual(expect.objectContaining({
    services: {
      sysvinit: {
        httpd: {
          enabled: true,
          ensureRunning: true,
          commands: ['000'],
          files: ['/etc/my.cnf'],
          packages: {
            yum: ['httpd'],
          },
          sources: ['/tmp/foo'],
        },
      },
    },
  }));
});

test('CloudFormationInit can be added to after instantiation', () => {
  // GIVEN
  const config = new ec2.InitConfig([]);
  const init = ec2.CloudFormationInit.fromConfig(config);

  // WHEN
  config.add(ec2.InitCommand.argvCommand(['/bin/true']));
  init.attach(resource, linuxOptions());

  // THEN
  expectMetadataLike({
    'AWS::CloudFormation::Init': {
      config: {
        commands: {
          '000': { command: ['/bin/true'] },
        },
      },
    },
  });
});

test('CloudFormationInit cannot be attached twice', () => {
  // GIVEN
  const init = ec2.CloudFormationInit.fromElements();

  // WHEN
  init.attach(resource, linuxOptions());

  // THEN
  expect(() => { init.attach(resource, linuxOptions()); }).toThrow(/already has/);
});

test('empty configs are not rendered', () => {
  // GIVEN
  const config1 = new ec2.InitConfig([]);
  const config2 = new ec2.InitConfig([
    ec2.InitCommand.argvCommand(['/bin/true']),
  ]);

  // WHEN
  const init = ec2.CloudFormationInit.fromConfigSets({
    configSets: { default: ['config2', 'config1'] },
    configs: { config1, config2 },
  });
  init.attach(resource, linuxOptions());

  // THEN
  expectMetadataLike({
    'AWS::CloudFormation::Init': {
      configSets: {
        default: ['config2'],
      },
      config2: {
        commands: {
          '000': { command: ['/bin/true'] },
        },
      },
    },
  });
});

describe('userdata', () => {
  let simpleInit: ec2.CloudFormationInit;
  beforeEach(() => {
    simpleInit = ec2.CloudFormationInit.fromElements(
      ec2.InitCommand.argvCommand(['/bin/true']),
    );
  });

  test('linux userdata contains right commands', () => {
    // WHEN
    simpleInit.attach(resource, linuxOptions());

    // THEN
    const lines = linuxUserData.render().split('\n');
    expectLine(lines, cmdArg('cfn-init', `--region ${Aws.REGION}`));
    expectLine(lines, cmdArg('cfn-init', `--stack ${Aws.STACK_NAME}`));
    expectLine(lines, cmdArg('cfn-init', `--resource ${resource.logicalId}`));
    expectLine(lines, cmdArg('cfn-init', '-c default'));
    expectLine(lines, cmdArg('cfn-signal', `--region ${Aws.REGION}`));
    expectLine(lines, cmdArg('cfn-signal', `--stack ${Aws.STACK_NAME}`));
    expectLine(lines, cmdArg('cfn-signal', `--resource ${resource.logicalId}`));
    expectLine(lines, cmdArg('cfn-signal', '-e $?'));
    expectLine(lines, cmdArg('cat', 'cfn-init.log'));
    expectLine(lines, /fingerprint/);
  });

  test('Windows userdata contains right commands', () => {
    // WHEN
    const windowsUserData = ec2.UserData.forWindows();

    simpleInit.attach(resource, {
      platform: ec2.OperatingSystemType.WINDOWS,
      instanceRole,
      userData: windowsUserData,
    });

    // THEN
    const lines = windowsUserData.render().split('\n');
    expectLine(lines, cmdArg('cfn-init', `--region ${Aws.REGION}`));
    expectLine(lines, cmdArg('cfn-init', `--stack ${Aws.STACK_NAME}`));
    expectLine(lines, cmdArg('cfn-init', `--resource ${resource.logicalId}`));
    expectLine(lines, cmdArg('cfn-init', '-c default'));
    expectLine(lines, cmdArg('cfn-signal', `--region ${Aws.REGION}`));
    expectLine(lines, cmdArg('cfn-signal', `--stack ${Aws.STACK_NAME}`));
    expectLine(lines, cmdArg('cfn-signal', `--resource ${resource.logicalId}`));
    expectLine(lines, cmdArg('cfn-signal', '-e $LASTEXITCODE'));
    expectLine(lines, cmdArg('type', 'cfn-init.log'));
    expectLine(lines, /fingerprint/);
  });

  test('ignoreFailures disables result code reporting', () => {
    // WHEN
    simpleInit.attach(resource, {
      ...linuxOptions(),
      ignoreFailures: true,
    });

    // THEN
    const lines = linuxUserData.render().split('\n');
    dontExpectLine(lines, cmdArg('cfn-signal', '-e $?'));
    expectLine(lines, cmdArg('cfn-signal', '-e 0'));
  });

  test('can disable log printing', () => {
    // WHEN
    simpleInit.attach(resource, {
      ...linuxOptions(),
      printLog: false,
    });

    // THEN
    const lines = linuxUserData.render().split('\n');
    dontExpectLine(lines, cmdArg('cat', 'cfn-init.log'));
  });

  test('can disable fingerprinting', () => {
    // WHEN
    simpleInit.attach(resource, {
      ...linuxOptions(),
      embedFingerprint: false,
    });

    // THEN
    const lines = linuxUserData.render().split('\n');
    dontExpectLine(lines, /fingerprint/);
  });

  test('can request multiple different configsets to be used', () => {
    // WHEN
    simpleInit.attach(resource, {
      ...linuxOptions(),
      configSets: ['banana', 'peach'],
    });

    // THEN
    const lines = linuxUserData.render().split('\n');
    expectLine(lines, cmdArg('cfn-init', '-c banana,peach'));
  });
});

const ASSET_STATEMENT = {
  Action: ['s3:GetObject*', 's3:GetBucket*', 's3:List*'],
  Effect: 'Allow',
  Resource: [
    {
      'Fn::Join': ['', [
        'arn:',
        { Ref: 'AWS::Partition' },
        ':s3:::',
        { Ref: stringLike('AssetParameter*S3Bucket*') },
      ]],
    },
    {
      'Fn::Join': ['', [
        'arn:',
        { Ref: 'AWS::Partition' },
        ':s3:::',
        { Ref: stringLike('AssetParameter*S3Bucket*') },
        '/*',
      ]],
    },
  ],
};

describe('assets n buckets', () => {
  test.each([
    ['Existing'],
    [''],
  ])('InitFile.from%sAsset', (existing: string) => {
    // GIVEN
    const asset = new Asset(stack, 'Asset', { path: __filename });
    const init = ec2.CloudFormationInit.fromElements(
      existing
        ? ec2.InitFile.fromExistingAsset('/etc/fun.js', asset)
        : ec2.InitFile.fromAsset('/etc/fun.js', __filename),
    );

    // WHEN
    init.attach(resource, linuxOptions());

    // THEN
    expect(stack).toHaveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: arrayWith(ASSET_STATEMENT),
        Version: '2012-10-17',
      },
    });
    expectMetadataLike({
      'AWS::CloudFormation::Init': {
        config: {
          files: {
            '/etc/fun.js': {
              source: {
                'Fn::Join': ['', [
                  'https://s3.testregion.',
                  { Ref: 'AWS::URLSuffix' },
                  '/',
                  { Ref: stringLike('AssetParameters*') },
                  '/',
                  { 'Fn::Select': [0, { 'Fn::Split': ['||', { Ref: stringLike('AssetParameters*') }] }] },
                  { 'Fn::Select': [1, { 'Fn::Split': ['||', { Ref: stringLike('AssetParameters*') }] }] },
                ]],
              },
            },
          },
        },
      },
      'AWS::CloudFormation::Authentication': {
        S3AccessCreds: {
          type: 'S3',
          roleName: { Ref: 'InstanceRole3CCE2F1D' },
          buckets: [
            { Ref: stringLike('AssetParameters*S3Bucket*') },
          ],
        },
      },
    });
  });

  test.each([
    ['Existing'],
    [''],
  ])('InitSource.from%sAsset', (existing: string) => {
    // GIVEN
    const asset = new Asset(stack, 'Asset', { path: path.join(__dirname, 'asset-fixture') });
    const init = ec2.CloudFormationInit.fromElements(
      existing
        ? ec2.InitSource.fromExistingAsset('/etc/fun', asset)
        : ec2.InitSource.fromAsset('/etc/fun', path.join(__dirname, 'asset-fixture')),
    );

    // WHEN
    init.attach(resource, linuxOptions());

    // THEN
    expect(stack).toHaveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: arrayWith(ASSET_STATEMENT),
        Version: '2012-10-17',
      },
    });
    expectMetadataLike({
      'AWS::CloudFormation::Init': {
        config: {
          sources: {
            '/etc/fun': {
              'Fn::Join': ['', [
                'https://s3.testregion.',
                { Ref: 'AWS::URLSuffix' },
                '/',
                { Ref: stringLike('AssetParameters*') },
                '/',
                { 'Fn::Select': [0, { 'Fn::Split': ['||', { Ref: stringLike('AssetParameters*') }] }] },
                { 'Fn::Select': [1, { 'Fn::Split': ['||', { Ref: stringLike('AssetParameters*') }] }] },
              ]],
            },
          },
        },
      },
      'AWS::CloudFormation::Authentication': {
        S3AccessCreds: {
          type: 'S3',
          roleName: { Ref: 'InstanceRole3CCE2F1D' },
          buckets: [
            { Ref: stringLike('AssetParameters*S3Bucket*') },
          ],
        },
      },
    });
  });

  test('InitFile.fromS3Object', () => {
    const bucket = s3.Bucket.fromBucketName(stack, 'Bucket', 'my-bucket');
    const init = ec2.CloudFormationInit.fromElements(
      ec2.InitFile.fromS3Object('/etc/fun.js', bucket, 'file.js'),
    );

    // WHEN
    init.attach(resource, linuxOptions());

    // THEN
    expect(stack).toHaveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: arrayWith({
          Action: ['s3:GetObject*', 's3:GetBucket*', 's3:List*'],
          Effect: 'Allow',
          Resource: [
            { 'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':s3:::my-bucket']] },
            { 'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':s3:::my-bucket/file.js']] },
          ],
        }),
        Version: '2012-10-17',
      },
    });
    expectMetadataLike({
      'AWS::CloudFormation::Init': {
        config: {
          files: {
            '/etc/fun.js': {
              source: { 'Fn::Join': ['', ['https://s3.testregion.', { Ref: 'AWS::URLSuffix' }, '/my-bucket/file.js']] },
            },
          },
        },
      },
      'AWS::CloudFormation::Authentication': {
        S3AccessCreds: {
          type: 'S3',
          roleName: { Ref: 'InstanceRole3CCE2F1D' },
          buckets: ['my-bucket'],
        },
      },
    });
  });

  test('InitSource.fromS3Object', () => {
    const bucket = s3.Bucket.fromBucketName(stack, 'Bucket', 'my-bucket');
    const init = ec2.CloudFormationInit.fromElements(
      ec2.InitSource.fromS3Object('/etc/fun', bucket, 'file.zip'),
    );

    // WHEN
    init.attach(resource, linuxOptions());

    // THEN
    expect(stack).toHaveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: arrayWith({
          Action: ['s3:GetObject*', 's3:GetBucket*', 's3:List*'],
          Effect: 'Allow',
          Resource: [
            { 'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':s3:::my-bucket']] },
            { 'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':s3:::my-bucket/file.zip']] },
          ],
        }),
        Version: '2012-10-17',
      },
    });
    expectMetadataLike({
      'AWS::CloudFormation::Init': {
        config: {
          sources: {
            '/etc/fun': { 'Fn::Join': ['', ['https://s3.testregion.', { Ref: 'AWS::URLSuffix' }, '/my-bucket/file.zip']] },
          },
        },
      },
      'AWS::CloudFormation::Authentication': {
        S3AccessCreds: {
          type: 'S3',
          roleName: { Ref: 'InstanceRole3CCE2F1D' },
          buckets: ['my-bucket'],
        },
      },
    });
  });

  test('no duplication of bucket names when using multiple assets', () => {
    // GIVEN
    const init = ec2.CloudFormationInit.fromElements(
      ec2.InitFile.fromAsset('/etc/fun.js', __filename),
      ec2.InitSource.fromAsset('/etc/fun', path.join(__dirname, 'asset-fixture')),
    );

    // WHEN
    init.attach(resource, linuxOptions());

    // THEN
    expectMetadataLike({
      'AWS::CloudFormation::Authentication': {
        S3AccessCreds: {
          type: 'S3',
          roleName: { Ref: 'InstanceRole3CCE2F1D' },
          buckets: [
            { Ref: stringLike('AssetParameters*S3Bucket*') },
          ],
        },
      },
    });
  });

  test('multiple buckets appear in the same auth block', () => {
    // GIVEN
    const bucket = s3.Bucket.fromBucketName(stack, 'Bucket', 'my-bucket');
    const init = ec2.CloudFormationInit.fromElements(
      ec2.InitFile.fromS3Object('/etc/fun.js', bucket, 'file.js'),
      ec2.InitSource.fromAsset('/etc/fun', path.join(__dirname, 'asset-fixture')),
    );

    // WHEN
    init.attach(resource, linuxOptions());

    // THEN
    expectMetadataLike({
      'AWS::CloudFormation::Authentication': {
        S3AccessCreds: {
          type: 'S3',
          roleName: { Ref: 'InstanceRole3CCE2F1D' },
          buckets: arrayWith(
            { Ref: stringLike('AssetParameters*S3Bucket*') },
            'my-bucket',
          ),
        },
      },
    });
  });

  test('fingerprint data changes on asset hash update', () => {
    function calculateFingerprint(assetFilePath: string): string | undefined {
      resetState(); // Needed so the same resources/assets/filenames can be used.
      AssetStaging.clearAssetHashCache(); // Needed so changing the content of the file will update the hash
      const init = ec2.CloudFormationInit.fromElements(
        ec2.InitFile.fromAsset('/etc/myFile', assetFilePath),
      );
      init.attach(resource, linuxOptions());

      return linuxUserData.render().split('\n').find(line => line.match(/# fingerprint:/));
    }

    // Setup initial asset file
    const assetFileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfn-init-test'));
    const assetFilePath = path.join(assetFileDir, 'fingerprint-test');
    fs.writeFileSync(assetFilePath, 'hello');

    const fingerprintOne = calculateFingerprint(assetFilePath);
    const fingerprintOneAgain = calculateFingerprint(assetFilePath);
    // Consistent without changes.
    expect(fingerprintOneAgain).toEqual(fingerprintOne);

    // Change asset file content/hash
    fs.writeFileSync(assetFilePath, ' world');

    const fingerprintTwo = calculateFingerprint(assetFilePath);

    expect(fingerprintTwo).not.toEqual(fingerprintOne);
  });

  test('fingerprint data changes on existing asset update, even for assets with unchanging URLs', () => {
    function calculateFingerprint(assetFilePath: string): string | undefined {
      resetStateWithSynthesizer(new SingletonLocationSythesizer());
      AssetStaging.clearAssetHashCache(); // Needed so changing the content of the file will update the hash
      const init = ec2.CloudFormationInit.fromElements(
        ec2.InitFile.fromExistingAsset('/etc/myFile', new Asset(stack, 'FileAsset', { path: assetFilePath })),
      );
      init.attach(resource, linuxOptions());

      return linuxUserData.render().split('\n').find(line => line.match(/# fingerprint:/));
    }

    // Setup initial asset file
    const assetFileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfn-init-test'));
    const assetFilePath = path.join(assetFileDir, 'fingerprint-test');
    fs.writeFileSync(assetFilePath, 'hello');

    const fingerprintOne = calculateFingerprint(assetFilePath);
    const fingerprintOneAgain = calculateFingerprint(assetFilePath);
    // Consistent without changes.
    expect(fingerprintOneAgain).toEqual(fingerprintOne);

    // Change asset file content/hash
    fs.writeFileSync(assetFilePath, ' world');

    const fingerprintTwo = calculateFingerprint(assetFilePath);

    expect(fingerprintTwo).not.toEqual(fingerprintOne);
  });
});

function linuxOptions() {
  return {
    platform: ec2.OperatingSystemType.LINUX,
    instanceRole,
    userData: linuxUserData,
  };
}

function expectMetadataLike(pattern: any) {
  expect(stack).toHaveResourceLike('CDK::Test::Resource', {
    Metadata: pattern,
  }, ResourcePart.CompleteDefinition);
}

function expectLine(lines: string[], re: RegExp) {
  for (const line of lines) {
    if (re.test(line)) { return; }
  }

  throw new Error(`None of the lines matched '${re}': ${lines.join('\n')}`);
}

function dontExpectLine(lines: string[], re: RegExp) {
  try {
    expectLine(lines, re);
  } catch (e) {
    return;
  }
  throw new Error(`Found unexpected line matching '${re}': ${lines.join('\n')}`);
}

function cmdArg(command: string, argument: string) {
  return new RegExp(`${escapeRegex(command)}(\.exe)? .*${escapeRegex(argument)}`);
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

/** Creates file assets that have a hard-coded asset url, rather than the default based on asset hash */
class SingletonLocationSythesizer extends DefaultStackSynthesizer {
  public addFileAsset(_asset: FileAssetSource): FileAssetLocation {
    const httpUrl = 'https://MyBucket.s3.amazonaws.com/MyAsset';
    return {
      bucketName: 'MyAssetBucket',
      objectKey: 'MyAssetFile',
      httpUrl,
      s3ObjectUrl: httpUrl,
      s3Url: httpUrl,
    };
  }
}
