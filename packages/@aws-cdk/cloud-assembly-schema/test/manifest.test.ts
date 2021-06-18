import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as semver from 'semver';
import { AssemblyManifest, Manifest, StackTagsMetadataEntry } from '../lib';

const FIXTURES = path.join(__dirname, 'fixtures');

function fixture(name: string) {
  return path.join(FIXTURES, name, 'manifest.json');
}

test('manifest save', () => {
  const outdir = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-tests'));
  const manifestFile = path.join(outdir, 'manifest.json');

  const assemblyManifest: AssemblyManifest = {
    version: 'version',
    runtime: {
      libraries: { lib1: '1.2.3' },
    },
  };

  Manifest.saveAssemblyManifest(assemblyManifest, manifestFile);

  const saved = JSON.parse(fs.readFileSync(manifestFile, { encoding: 'utf-8' }));

  expect(saved).toEqual({
    ...assemblyManifest,
    version: Manifest.version(), // version is forced
  });
});

test('manifest load', () => {
  const loaded = Manifest.loadAssemblyManifest(fixture('only-version'));
  expect(loaded).toMatchSnapshot();
});

test('manifest load fails for invalid nested property', () => {
  expect(() => Manifest.loadAssemblyManifest(fixture('invalid-nested-property'))).toThrow(/Invalid assembly manifest/);
});

test('manifest load fails for invalid artifact type', () => {
  expect(() => Manifest.loadAssemblyManifest(fixture('invalid-artifact-type'))).toThrow(/Invalid assembly manifest/);
});

test('manifest load fails on higher major version', () => {
  expect(() => Manifest.loadAssemblyManifest(fixture('high-version'))).toThrow(/Cloud assembly schema version mismatch/);
});

// once we start introducing minor version bumps that are considered
// non breaking, this test can be removed.
test('manifest load fails on higher minor version', () => {
  const outdir = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-tests'));
  const manifestFile = path.join(outdir, 'manifest.json');

  const newVersion = semver.inc(Manifest.version(), 'minor');
  expect(newVersion).toBeTruthy();

  if (newVersion) {
    const assemblyManifest: AssemblyManifest = {
      version: newVersion,
    };

    // can't use saveAssemblyManifest because it will force the correct version
    fs.writeFileSync(manifestFile, JSON.stringify(assemblyManifest));

    expect(() => Manifest.loadAssemblyManifest(manifestFile)).toThrow(/Cloud assembly schema version mismatch/);
  }
});

// once we start introducing patch version bumps that are considered
// non breaking, this test can be removed.
test('manifest load fails on higher patch version', () => {
  const outdir = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-tests'));
  const manifestFile = path.join(outdir, 'manifest.json');

  const newVersion = semver.inc(Manifest.version(), 'patch');
  expect(newVersion).toBeTruthy();

  if (newVersion) {
    const assemblyManifest: AssemblyManifest = {
      version: newVersion,
    };

    // can't use saveAssemblyManifest because it will force the correct version
    fs.writeFileSync(manifestFile, JSON.stringify(assemblyManifest));

    expect(() => Manifest.loadAssemblyManifest(manifestFile)).toThrow(/Cloud assembly schema version mismatch/);
  }
});

test('manifest load fails on invalid version', () => {
  expect(() => Manifest.loadAssemblyManifest(fixture('invalid-version'))).toThrow(/Invalid semver string/);
});

test('manifest load succeeds on unknown properties', () => {
  const manifest = Manifest.loadAssemblyManifest(fixture('unknown-property'));
  expect(manifest.version).toEqual('0.0.0');
});

test('stack-tags are deserialized properly', () => {
  const m: AssemblyManifest = Manifest.loadAssemblyManifest(fixture('with-stack-tags'));

  if (m.artifacts?.stack?.metadata?.AwsCdkPlaygroundBatch[0].data) {
    const entry = m.artifacts.stack.metadata.AwsCdkPlaygroundBatch[0].data as StackTagsMetadataEntry;
    expect(entry[0].key).toEqual('hello');
    expect(entry[0].value).toEqual('world');
  }
  expect(m.version).toEqual('0.0.0');
});

test('can access random metadata', () => {
  const loaded = Manifest.loadAssemblyManifest(fixture('random-metadata'));
  const randomArray = loaded.artifacts?.stack.metadata?.AwsCdkPlaygroundBatch[0].data;
  const randomNumber = loaded.artifacts?.stack.metadata?.AwsCdkPlaygroundBatch[1].data;
  const randomMap = loaded.artifacts?.stack.metadata?.AwsCdkPlaygroundBatch[2].data;

  expect(randomArray).toEqual(['42']);
  expect(randomNumber).toEqual(42);
  expect(randomMap).toEqual({
    key: 'value',
  });

  expect(randomMap).toBeTruthy();

  if (randomMap) {
    expect((randomMap as any).key).toEqual('value');
  }
});
