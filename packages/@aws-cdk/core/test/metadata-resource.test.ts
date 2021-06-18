import * as zlib from 'zlib';
import { App, Stack } from '../lib';
import { formatAnalytics } from '../lib/private/metadata-resource';
import { ConstructInfo } from '../lib/private/runtime-info';

// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '../lib';

describe('MetadataResource', () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App({
      analyticsReporting: true,
    });
    stack = new Stack(app, 'Stack');
  });

  test('is not included if the region is known and metadata is not available', () => {
    new Stack(app, 'StackUnavailable', {
      env: { region: 'definitely-no-metadata-resource-available-here' },
    });

    const stackTemplate = app.synth().getStackByName('StackUnavailable').template;

    expect(stackTemplate.Resources?.CDKMetadata).toBeUndefined();
  });

  test('is included if the region is known and metadata is available', () => {
    new Stack(app, 'StackPresent', {
      env: { region: 'us-east-1' },
    });

    const stackTemplate = app.synth().getStackByName('StackPresent').template;

    expect(stackTemplate.Resources?.CDKMetadata).toBeDefined();
  });

  test('is included if the region is unknown with conditions', () => {
    new Stack(app, 'StackUnknown');

    const stackTemplate = app.synth().getStackByName('StackUnknown').template;

    expect(stackTemplate.Resources?.CDKMetadata).toBeDefined();
    expect(stackTemplate.Resources?.CDKMetadata?.Condition).toBeDefined();
  });

  test('includes the formatted Analytics property', () => {
    // A very simple check that the jsii runtime psuedo-construct is present.
    // This check works whether we're running locally or on CodeBuild, on v1 or v2.
    // Other tests(in app.test.ts) will test version-specific results.
    expect(stackAnalytics()).toMatch(/jsii-runtime.Runtime/);
  });

  test('includes the current jsii runtime version', () => {
    process.env.JSII_AGENT = 'Java/1.2.3.4';

    expect(stackAnalytics()).toContain('Java/1.2.3.4!jsii-runtime.Runtime');
    delete process.env.JSII_AGENT;
  });

  test('includes constructs added to the stack', () => {
    new TestConstruct(stack, 'Test');

    expect(stackAnalytics()).toContain('FakeVersion.2.3!@amzn/core.TestConstruct');
  });

  test('only includes constructs in the allow list', () => {
    new TestThirdPartyConstruct(stack, 'Test');

    expect(stackAnalytics()).not.toContain('TestConstruct');
  });

  function stackAnalytics(stackName: string = 'Stack') {
    const encodedAnalytics = app.synth().getStackByName(stackName).template.Resources?.CDKMetadata?.Properties?.Analytics as string;
    return plaintextConstructsFromAnalytics(encodedAnalytics);
  }
});

describe('formatAnalytics', () => {
  test('analytics are formatted with a prefix of v2:deflate64:', () => {
    const constructInfo = [{ fqn: 'aws-cdk-lib.Construct', version: '1.2.3' }];

    expect(formatAnalytics(constructInfo)).toMatch(/v2:deflate64:.*/);
  });

  test('single construct', () => {
    const constructInfo = [{ fqn: 'aws-cdk-lib.Construct', version: '1.2.3' }];

    expectAnalytics(constructInfo, '1.2.3!aws-cdk-lib.Construct');
  });

  test('common prefixes with same versions are combined', () => {
    const constructInfo = [
      { fqn: 'aws-cdk-lib.Construct', version: '1.2.3' },
      { fqn: 'aws-cdk-lib.CfnResource', version: '1.2.3' },
      { fqn: 'aws-cdk-lib.Stack', version: '1.2.3' },
    ];

    expectAnalytics(constructInfo, '1.2.3!aws-cdk-lib.{Construct,CfnResource,Stack}');
  });

  test('nested modules with common prefixes and same versions are combined', () => {
    const constructInfo = [
      { fqn: 'aws-cdk-lib.Construct', version: '1.2.3' },
      { fqn: 'aws-cdk-lib.CfnResource', version: '1.2.3' },
      { fqn: 'aws-cdk-lib.Stack', version: '1.2.3' },
      { fqn: 'aws-cdk-lib.aws_servicefoo.CoolResource', version: '1.2.3' },
      { fqn: 'aws-cdk-lib.aws_servicefoo.OtherResource', version: '1.2.3' },
    ];

    expectAnalytics(constructInfo, '1.2.3!aws-cdk-lib.{Construct,CfnResource,Stack,aws_servicefoo.{CoolResource,OtherResource}}');
  });

  test('constructs are grouped by version', () => {
    const constructInfo = [
      { fqn: 'aws-cdk-lib.Construct', version: '1.2.3' },
      { fqn: 'aws-cdk-lib.CfnResource', version: '1.2.3' },
      { fqn: 'aws-cdk-lib.Stack', version: '1.2.3' },
      { fqn: 'aws-cdk-lib.CoolResource', version: '0.1.2' },
      { fqn: 'aws-cdk-lib.OtherResource', version: '0.1.2' },
    ];

    expectAnalytics(constructInfo, '1.2.3!aws-cdk-lib.{Construct,CfnResource,Stack},0.1.2!aws-cdk-lib.{CoolResource,OtherResource}');
  });

  // Compares the output of formatAnalytics with an expected (plaintext) output.
  // For ease of testing, the plaintext versions are compared rather than the encoded versions.
  function expectAnalytics(constructs: ConstructInfo[], expectedPlaintext: string) {
    expect(plaintextConstructsFromAnalytics(formatAnalytics(constructs))).toEqual(expectedPlaintext);
  }
});

function plaintextConstructsFromAnalytics(analytics: string) {
  return zlib.gunzipSync(Buffer.from(analytics.split(':')[2], 'base64')).toString('utf-8');
}

const JSII_RUNTIME_SYMBOL = Symbol.for('jsii.rtti');

class TestConstruct extends Construct {
  // @ts-ignore
  private static readonly [JSII_RUNTIME_SYMBOL] = { fqn: '@amzn/core.TestConstruct', version: 'FakeVersion.2.3' }
}

class TestThirdPartyConstruct extends Construct {
  // @ts-ignore
  private static readonly [JSII_RUNTIME_SYMBOL] = { fqn: 'mycoolthing.TestConstruct', version: '1.2.3' }
}
