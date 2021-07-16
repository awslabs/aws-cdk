import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import { nodeunitShim, Test } from 'nodeunit-shim';
import * as cdk from '../lib';

function createModernApp() {
  return new cdk.App();
}

nodeunitShim({
  'synthesis with an empty app'(test: Test) {
    // GIVEN
    const app = createModernApp();

    // WHEN
    const session = app.synth();

    // THEN
    test.same(app.synth(), session); // same session if we synth() again
    test.deepEqual(list(session.directory), ['cdk.out', 'manifest.json', 'tree.json']);
    test.deepEqual(readJson(session.directory, 'manifest.json').artifacts, {
      Tree: {
        type: 'cdk:tree',
        properties: { file: 'tree.json' },
      },
    });
    test.deepEqual(readJson(session.directory, 'tree.json'), {
      version: 'tree-0.1',
      tree: expect.objectContaining({
        id: 'App',
        path: '',
        children: {
          Tree: expect.objectContaining({ id: 'Tree', path: 'Tree' }),
        },
      }),
    });
    test.done();
  },

  'synthesis respects disabling tree metadata'(test: Test) {
    const app = new cdk.App({
      treeMetadata: false,
    });
    const assembly = app.synth();
    test.deepEqual(list(assembly.directory), ['cdk.out', 'manifest.json']);
    test.done();
  },

  'single empty stack'(test: Test) {
    // GIVEN
    const app = createModernApp();
    new cdk.Stack(app, 'one-stack');

    // WHEN
    const session = app.synth();

    // THEN
    test.ok(list(session.directory).includes('one-stack.template.json'));
    test.done();
  },

  'some random construct implements "synthesize"'(test: Test) {
    // GIVEN
    const app = createModernApp();
    const stack = new cdk.Stack(app, 'one-stack');

    class MyConstruct extends cdk.Construct {
      protected synthesize(s: cdk.ISynthesisSession) {
        writeJson(s.assembly.outdir, 'foo.json', { bar: 123 });
        s.assembly.addArtifact('my-random-construct', {
          type: cxschema.ArtifactType.AWS_CLOUDFORMATION_STACK,
          environment: 'aws://12345/bar',
          properties: {
            templateFile: 'foo.json',
          },
        });
      }
    }

    new MyConstruct(stack, 'MyConstruct');

    // WHEN
    const session = app.synth();

    // THEN
    test.ok(list(session.directory).includes('one-stack.template.json'));
    test.ok(list(session.directory).includes('foo.json'));

    test.deepEqual(readJson(session.directory, 'foo.json'), { bar: 123 });
    test.deepEqual(session.manifest, {
      version: cxschema.Manifest.version(),
      artifacts: {
        'Tree': {
          type: 'cdk:tree',
          properties: { file: 'tree.json' },
        },
        'my-random-construct': {
          type: 'aws:cloudformation:stack',
          environment: 'aws://12345/bar',
          properties: { templateFile: 'foo.json' },
        },
        'one-stack': {
          type: 'aws:cloudformation:stack',
          environment: 'aws://unknown-account/unknown-region',
          properties: {
            templateFile: 'one-stack.template.json',
            terminationProtection: false,
            validateOnSynth: false,
          },
          displayName: 'one-stack',
        },
      },
    });
    test.done();
  },

  'random construct uses addCustomSynthesis'(test: Test) {
    // GIVEN
    const app = createModernApp();
    const stack = new cdk.Stack(app, 'one-stack');

    class MyConstruct extends cdk.Construct {
      constructor(scope: cdk.Construct, id: string) {
        super(scope, id);

        cdk.attachCustomSynthesis(this, {
          onSynthesize(s: cdk.ISynthesisSession) {
            writeJson(s.assembly.outdir, 'foo.json', { bar: 123 });
            s.assembly.addArtifact('my-random-construct', {
              type: cxschema.ArtifactType.AWS_CLOUDFORMATION_STACK,
              environment: 'aws://12345/bar',
              properties: {
                templateFile: 'foo.json',
              },
            });
          },
        });
      }
    }

    new MyConstruct(stack, 'MyConstruct');

    // WHEN
    const session = app.synth();

    // THEN
    test.ok(list(session.directory).includes('one-stack.template.json'));
    test.ok(list(session.directory).includes('foo.json'));

    test.deepEqual(readJson(session.directory, 'foo.json'), { bar: 123 });
    test.deepEqual(session.manifest, {
      version: cxschema.Manifest.version(),
      artifacts: {
        'Tree': {
          type: 'cdk:tree',
          properties: { file: 'tree.json' },
        },
        'my-random-construct': {
          type: 'aws:cloudformation:stack',
          environment: 'aws://12345/bar',
          properties: { templateFile: 'foo.json' },
        },
        'one-stack': {
          type: 'aws:cloudformation:stack',
          environment: 'aws://unknown-account/unknown-region',
          properties: {
            templateFile: 'one-stack.template.json',
            validateOnSynth: false,
          },
          displayName: 'one-stack',
        },
      },
    });
    test.done();
  },

  'it should be possible to synthesize without an app'(test: Test) {
    const calls = new Array<string>();

    class SynthesizeMe extends cdk.Construct {
      constructor() {
        super(undefined as any, 'id');
      }

      protected synthesize(session: cdk.ISynthesisSession) {
        calls.push('synthesize');

        session.assembly.addArtifact('art', {
          type: cxschema.ArtifactType.AWS_CLOUDFORMATION_STACK,
          properties: {
            templateFile: 'hey.json',
            parameters: {
              paramId: 'paramValue',
              paramId2: 'paramValue2',
            },
          },
          environment: 'aws://unknown-account/us-east-1',
        });

        writeJson(session.assembly.outdir, 'hey.json', { hello: 123 });
      }

      protected validate(): string[] {
        calls.push('validate');
        return [];
      }

      protected prepare(): void {
        calls.push('prepare');
      }
    }

    const root = new SynthesizeMe();
    const assembly = cdk.ConstructNode.synth(root.node, { outdir: fs.mkdtempSync(path.join(os.tmpdir(), 'outdir')) });

    test.deepEqual(calls, ['prepare', 'validate', 'synthesize']);
    const stack = assembly.getStackByName('art');
    test.deepEqual(stack.template, { hello: 123 });
    test.deepEqual(stack.templateFile, 'hey.json');
    test.deepEqual(stack.parameters, { paramId: 'paramValue', paramId2: 'paramValue2' });
    test.deepEqual(stack.environment, { region: 'us-east-1', account: 'unknown-account', name: 'aws://unknown-account/us-east-1' });
    test.done();
  },
});

function list(outdir: string) {
  return fs.readdirSync(outdir).sort();
}

function readJson(outdir: string, file: string) {
  return JSON.parse(fs.readFileSync(path.join(outdir, file), 'utf-8'));
}

function writeJson(outdir: string, file: string, data: any) {
  fs.writeFileSync(path.join(outdir, file), JSON.stringify(data, undefined, 2));
}
