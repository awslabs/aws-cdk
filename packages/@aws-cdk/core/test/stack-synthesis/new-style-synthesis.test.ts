import * as fs from 'fs';
import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import * as cxapi from '@aws-cdk/cx-api';
import { nodeunitShim, Test } from 'nodeunit-shim';
import { App, Aws, CfnResource, ContextProvider, DefaultStackSynthesizer, FileAssetPackaging, Stack } from '../../lib';
import { evaluateCFN } from '../evaluate-cfn';

const CFN_CONTEXT = {
  'AWS::Region': 'the_region',
  'AWS::AccountId': 'the_account',
  'AWS::URLSuffix': 'domain.aws',
};

let app: App;
let stack: Stack;
nodeunitShim({
  'setUp'(cb: () => void) {
    app = new App({
      context: {
        [cxapi.NEW_STYLE_STACK_SYNTHESIS_CONTEXT]: 'true',
      },
    });
    stack = new Stack(app, 'Stack');
    cb();
  },

  'stack template is in asset manifest'(test: Test) {
    // GIVEN
    new CfnResource(stack, 'Resource', {
      type: 'Some::Resource',
    });

    // WHEN
    const asm = app.synth();

    // THEN -- the S3 url is advertised on the stack artifact
    const stackArtifact = asm.getStackArtifact('Stack');

    const templateObjectKey = last(stackArtifact.stackTemplateAssetObjectUrl?.split('/'));

    test.equals(stackArtifact.stackTemplateAssetObjectUrl, `s3://cdk-hnb659fds-assets-\${AWS::AccountId}-\${AWS::Region}/${templateObjectKey}`);

    // THEN - the template is in the asset manifest
    const manifestArtifact = asm.artifacts.filter(isAssetManifest)[0];
    test.ok(manifestArtifact);
    const manifest: cxschema.AssetManifest = JSON.parse(fs.readFileSync(manifestArtifact.file, { encoding: 'utf-8' }));

    const firstFile = (manifest.files ? manifest.files[Object.keys(manifest.files)[0]] : undefined) ?? {};

    test.deepEqual(firstFile, {
      source: { path: 'Stack.template.json', packaging: 'file' },
      destinations: {
        'current_account-current_region': {
          bucketName: 'cdk-hnb659fds-assets-${AWS::AccountId}-${AWS::Region}',
          objectKey: templateObjectKey,
          assumeRoleArn: 'arn:${AWS::Partition}:iam::${AWS::AccountId}:role/cdk-hnb659fds-file-publishing-role-${AWS::AccountId}-${AWS::Region}',
        },
      },
    });

    test.done();
  },

  'version check is added to template'(test: Test) {
    // GIVEN
    new CfnResource(stack, 'Resource', {
      type: 'Some::Resource',
    });

    // THEN
    const template = app.synth().getStackByName('Stack').template;
    test.deepEqual(template?.Parameters?.BootstrapVersion?.Type, 'AWS::SSM::Parameter::Value<String>');
    test.deepEqual(template?.Parameters?.BootstrapVersion?.Default, '/cdk-bootstrap/hnb659fds/version');

    const assertions = template?.Rules?.CheckBootstrapVersion?.Assertions ?? [];
    test.deepEqual(assertions.length, 1);
    test.deepEqual(assertions[0].Assert, {
      'Fn::Not': [
        { 'Fn::Contains': [['1', '2', '3', '4', '5'], { Ref: 'BootstrapVersion' }] },
      ],
    });

    test.done();
  },

  'version check is not added to template if disabled'(test: Test) {
    // GIVEN
    stack = new Stack(app, 'Stack2', {
      synthesizer: new DefaultStackSynthesizer({
        generateBootstrapVersionRule: false,
      }),
    });
    new CfnResource(stack, 'Resource', {
      type: 'Some::Resource',
    });

    // THEN
    const template = app.synth().getStackByName('Stack2').template;
    test.equal(template?.Rules?.CheckBootstrapVersion, undefined);

    test.done();
  },

  'customize version parameter'(test: Test) {
    // GIVEN
    const myapp = new App();

    // WHEN
    const mystack = new Stack(myapp, 'mystack', {
      synthesizer: new DefaultStackSynthesizer({
        bootstrapStackVersionSsmParameter: 'stack-version-parameter',
      }),
    });

    mystack.synthesizer.addFileAsset({
      fileName: __filename,
      packaging: FileAssetPackaging.FILE,
      sourceHash: 'file-asset-hash',
    });

    // THEN
    const asm = myapp.synth();
    const manifestArtifact = getAssetManifest(asm);

    // THEN - the asset manifest has an SSM parameter entry
    expect(manifestArtifact.bootstrapStackVersionSsmParameter).toEqual('stack-version-parameter');

    test.done();
  },

  'generates missing context with the lookup role ARN as one of the missing context properties'(test: Test) {
    // GIVEN
    stack = new Stack(app, 'Stack2', {
      synthesizer: new DefaultStackSynthesizer({
        generateBootstrapVersionRule: false,
      }),
      env: {
        account: '111111111111', region: 'us-east-1',
      },
    });
    ContextProvider.getValue(stack, {
      provider: cxschema.ContextProvider.VPC_PROVIDER,
      props: {},
      dummyValue: undefined,
    }).value;

    // THEN
    const assembly = app.synth();
    test.equal(assembly.manifest.missing![0].props.lookupRoleArn, 'arn:${AWS::Partition}:iam::111111111111:role/cdk-hnb659fds-lookup-role-111111111111-us-east-1');

    test.done();
  },

  'add file asset'(test: Test) {
    // WHEN
    const location = stack.synthesizer.addFileAsset({
      fileName: __filename,
      packaging: FileAssetPackaging.FILE,
      sourceHash: 'abcdef',
    });

    // THEN - we have a fixed asset location with region placeholders
    test.equals(evalCFN(location.bucketName), 'cdk-hnb659fds-assets-the_account-the_region');
    test.equals(evalCFN(location.s3Url), 'https://s3.the_region.domain.aws/cdk-hnb659fds-assets-the_account-the_region/abcdef.js');

    // THEN - object key contains source hash somewhere
    test.ok(location.objectKey.indexOf('abcdef') > -1);

    test.done();
  },

  'add docker image asset'(test: Test) {
    // WHEN
    const location = stack.synthesizer.addDockerImageAsset({
      directoryName: '.',
      sourceHash: 'abcdef',
    });

    // THEN - we have a fixed asset location with region placeholders
    test.equals(evalCFN(location.repositoryName), 'cdk-hnb659fds-container-assets-the_account-the_region');
    test.equals(evalCFN(location.imageUri), 'the_account.dkr.ecr.the_region.domain.aws/cdk-hnb659fds-container-assets-the_account-the_region:abcdef');

    test.done();
  },

  'synthesis'(test: Test) {
    // GIVEN
    stack.synthesizer.addFileAsset({
      fileName: __filename,
      packaging: FileAssetPackaging.FILE,
      sourceHash: 'abcdef',
    });
    stack.synthesizer.addDockerImageAsset({
      directoryName: '.',
      sourceHash: 'abcdef',
    });

    // WHEN
    const asm = app.synth();

    // THEN - we have an asset manifest with both assets and the stack template in there
    const manifestArtifact = getAssetManifest(asm);
    const manifest = readAssetManifest(manifestArtifact);

    test.equals(Object.keys(manifest.files || {}).length, 2);
    test.equals(Object.keys(manifest.dockerImages || {}).length, 1);

    // THEN - the asset manifest has an SSM parameter entry
    expect(manifestArtifact.bootstrapStackVersionSsmParameter).toEqual('/cdk-bootstrap/hnb659fds/version');

    // THEN - every artifact has an assumeRoleArn
    for (const file of Object.values(manifest.files ?? {})) {
      for (const destination of Object.values(file.destinations)) {
        test.deepEqual(destination.assumeRoleArn, 'arn:${AWS::Partition}:iam::${AWS::AccountId}:role/cdk-hnb659fds-file-publishing-role-${AWS::AccountId}-${AWS::Region}');
      }
    }

    for (const file of Object.values(manifest.dockerImages ?? {})) {
      for (const destination of Object.values(file.destinations)) {
        test.deepEqual(destination.assumeRoleArn, 'arn:${AWS::Partition}:iam::${AWS::AccountId}:role/cdk-hnb659fds-image-publishing-role-${AWS::AccountId}-${AWS::Region}');
      }
    }

    test.done();
  },

  'customize publishing resources'(test: Test) {
    // GIVEN
    const myapp = new App();

    // WHEN
    const mystack = new Stack(myapp, 'mystack', {
      synthesizer: new DefaultStackSynthesizer({
        fileAssetsBucketName: 'file-asset-bucket',
        fileAssetPublishingRoleArn: 'file:role:arn',
        fileAssetPublishingExternalId: 'file-external-id',

        imageAssetsRepositoryName: 'image-ecr-repository',
        imageAssetPublishingRoleArn: 'image:role:arn',
        imageAssetPublishingExternalId: 'image-external-id',
      }),
    });

    mystack.synthesizer.addFileAsset({
      fileName: __filename,
      packaging: FileAssetPackaging.FILE,
      sourceHash: 'file-asset-hash',
    });

    mystack.synthesizer.addDockerImageAsset({
      directoryName: '.',
      sourceHash: 'docker-asset-hash',
    });

    // THEN
    const asm = myapp.synth();
    const manifest = readAssetManifest(getAssetManifest(asm));

    test.deepEqual(manifest.files?.['file-asset-hash']?.destinations?.['current_account-current_region'], {
      bucketName: 'file-asset-bucket',
      objectKey: 'file-asset-hash.js',
      assumeRoleArn: 'file:role:arn',
      assumeRoleExternalId: 'file-external-id',
    });

    test.deepEqual(manifest.dockerImages?.['docker-asset-hash']?.destinations?.['current_account-current_region'], {
      repositoryName: 'image-ecr-repository',
      imageTag: 'docker-asset-hash',
      assumeRoleArn: 'image:role:arn',
      assumeRoleExternalId: 'image-external-id',
    });

    test.done();
  },

  'synthesis with bucketPrefix'(test: Test) {
    // GIVEN
    const myapp = new App();

    // WHEN
    const mystack = new Stack(myapp, 'mystack-bucketPrefix', {
      synthesizer: new DefaultStackSynthesizer({
        fileAssetsBucketName: 'file-asset-bucket',
        fileAssetPublishingRoleArn: 'file:role:arn',
        fileAssetPublishingExternalId: 'file-external-id',
        bucketPrefix: '000000000000/',
      }),
    });

    mystack.synthesizer.addFileAsset({
      fileName: __filename,
      packaging: FileAssetPackaging.FILE,
      sourceHash: 'file-asset-hash-with-prefix',
    });

    // WHEN
    const asm = myapp.synth();

    // THEN -- the S3 url is advertised on the stack artifact
    const stackArtifact = asm.getStackArtifact('mystack-bucketPrefix');

    // THEN - we have an asset manifest with both assets and the stack template in there
    const manifest = readAssetManifest(getAssetManifest(asm));

    // THEN
    test.deepEqual(manifest.files?.['file-asset-hash-with-prefix']?.destinations?.['current_account-current_region'], {
      bucketName: 'file-asset-bucket',
      objectKey: '000000000000/file-asset-hash-with-prefix.js',
      assumeRoleArn: 'file:role:arn',
      assumeRoleExternalId: 'file-external-id',
    });

    const templateHash = last(stackArtifact.stackTemplateAssetObjectUrl?.split('/'));

    test.equals(stackArtifact.stackTemplateAssetObjectUrl, `s3://file-asset-bucket/000000000000/${templateHash}`);

    test.done();
  },

  'cannot use same synthesizer for multiple stacks'(test: Test) {
    // GIVEN
    const synthesizer = new DefaultStackSynthesizer();

    // WHEN
    new Stack(app, 'Stack2', { synthesizer });
    test.throws(() => {
      new Stack(app, 'Stack3', { synthesizer });
    }, /A StackSynthesizer can only be used for one Stack/);
    test.done();
  },
});

test('get an exception when using tokens for parameters', () => {
  expect(() => {
    // GIVEN
    new DefaultStackSynthesizer({
      fileAssetsBucketName: `my-bucket-${Aws.REGION}`,
    });
  }).toThrow(/cannot contain tokens/);
});

/**
 * Evaluate a possibly string-containing value the same way CFN would do
 *
 * (Be invariant to the specific Fn::Sub or Fn::Join we would output)
 */
function evalCFN(value: any) {
  return evaluateCFN(stack.resolve(value), CFN_CONTEXT);
}

function isAssetManifest(x: cxapi.CloudArtifact): x is cxapi.AssetManifestArtifact {
  return x instanceof cxapi.AssetManifestArtifact;
}

function getAssetManifest(asm: cxapi.CloudAssembly): cxapi.AssetManifestArtifact {
  const manifestArtifact = asm.artifacts.filter(isAssetManifest)[0];
  if (!manifestArtifact) { throw new Error('no asset manifest in assembly'); }
  return manifestArtifact;
}

function readAssetManifest(manifestArtifact: cxapi.AssetManifestArtifact): cxschema.AssetManifest {
  return JSON.parse(fs.readFileSync(manifestArtifact.file, { encoding: 'utf-8' }));
}

function last<A>(xs?: A[]): A | undefined {
  return xs ? xs[xs.length - 1] : undefined;
}
