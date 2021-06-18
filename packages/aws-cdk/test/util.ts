import * as fs from 'fs';
import * as path from 'path';
import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import * as cxapi from '@aws-cdk/cx-api';
import { CloudExecutable } from '../lib/api/cxapp/cloud-executable';
import { Configuration } from '../lib/settings';
import { MockSdkProvider } from './util/mock-sdk';

export const DEFAULT_FAKE_TEMPLATE = { No: 'Resources' };

export interface TestStackArtifact {
  stackName: string;
  template?: any;
  env?: string,
  depends?: string[];
  metadata?: cxapi.StackMetadata;
  assets?: cxschema.AssetMetadataEntry[];
  properties?: Partial<cxschema.AwsCloudFormationStackProperties>;
  terminationProtection?: boolean;
  displayName?: string;
}

export interface TestAssembly {
  stacks: TestStackArtifact[];
  missing?: cxschema.MissingContext[];
  nestedAssemblies?: TestAssembly[];
}

export class MockCloudExecutable extends CloudExecutable {
  public readonly configuration: Configuration;
  public readonly sdkProvider: MockSdkProvider;

  constructor(assembly: TestAssembly) {
    const configuration = new Configuration();
    const sdkProvider = new MockSdkProvider();

    super({
      configuration,
      sdkProvider,
      synthesizer: () => Promise.resolve(testAssembly(assembly)),
    });

    this.configuration = configuration;
    this.sdkProvider = sdkProvider;
  }
}

function clone(obj: any) {
  return JSON.parse(JSON.stringify(obj));
}

function addAttributes(assembly: TestAssembly, builder: cxapi.CloudAssemblyBuilder) {
  for (const stack of assembly.stacks) {
    const templateFile = `${stack.stackName}.template.json`;
    const template = stack.template ?? DEFAULT_FAKE_TEMPLATE;
    fs.writeFileSync(path.join(builder.outdir, templateFile), JSON.stringify(template, undefined, 2));

    // we call patchStackTags here to simulate the tags formatter
    // that is used when building real manifest files.
    const metadata: { [path: string]: cxschema.MetadataEntry[] } = patchStackTags({ ...stack.metadata });
    for (const asset of stack.assets || []) {
      metadata[asset.id] = [
        { type: cxschema.ArtifactMetadataEntryType.ASSET, data: asset },
      ];
    }

    for (const missing of assembly.missing || []) {
      builder.addMissing(missing);
    }

    builder.addArtifact(stack.stackName, {
      type: cxschema.ArtifactType.AWS_CLOUDFORMATION_STACK,
      environment: stack.env || 'aws://123456789012/here',

      dependencies: stack.depends,
      metadata,
      properties: {
        ...stack.properties,
        templateFile,
        terminationProtection: stack.terminationProtection,
      },
      displayName: stack.displayName,
    });
  }
}

export function testAssembly(assembly: TestAssembly): cxapi.CloudAssembly {
  const builder = new cxapi.CloudAssemblyBuilder();
  addAttributes(assembly, builder);

  if (assembly.nestedAssemblies != null && assembly.nestedAssemblies.length > 0) {
    assembly.nestedAssemblies?.forEach((nestedAssembly: TestAssembly, i: number) => {
      const nestedAssemblyBuilder = builder.createNestedAssembly(`nested${i}`, `nested${i}`);
      addAttributes(nestedAssembly, nestedAssemblyBuilder);
      nestedAssemblyBuilder.buildAssembly();
    });
  }

  return builder.buildAssembly();
}

/**
 * Transform stack tags from how they are decalred in source code (lower cased)
 * to how they are stored on disk (upper cased). In real synthesis this is done
 * by a special tags formatter.
 *
 * @see @aws-cdk/core/lib/stack.ts
 */
function patchStackTags(metadata: { [path: string]: cxschema.MetadataEntry[] }): { [path: string]: cxschema.MetadataEntry[] } {
  const cloned = clone(metadata) as { [path: string]: cxschema.MetadataEntry[] };

  for (const metadataEntries of Object.values(cloned)) {
    for (const metadataEntry of metadataEntries) {
      if (metadataEntry.type === cxschema.ArtifactMetadataEntryType.STACK_TAGS && metadataEntry.data) {
        const metadataAny = metadataEntry as any;

        metadataAny.data = metadataAny.data.map((t: any) => {
          return { Key: t.key, Value: t.value };
        });
      }
    }
  }
  return cloned;
}

export function testStack(stack: TestStackArtifact) {
  const assembly = testAssembly({ stacks: [stack] });
  return assembly.getStackByName(stack.stackName);
}

/**
 * Return a mocked instance of a class, given its constructor
 *
 * I don't understand why jest doesn't provide this by default,
 * but there you go.
 *
 * FIXME: Currently very limited. Doesn't support inheritance, getters or
 * automatic detection of properties (as those exist on instances, not
 * classes).
 */
export function instanceMockFrom<A>(ctr: new (...args: any[]) => A): jest.Mocked<A> {
  const ret: any = {};
  for (const methodName of Object.getOwnPropertyNames(ctr.prototype)) {
    ret[methodName] = jest.fn();
  }
  return ret;
}

/**
 * Run an async block with a class (constructor) replaced with a mock
 *
 * The class constructor will be replaced with a constructor that returns
 * a singleton, and the singleton will be passed to the block so that its
 * methods can be mocked individually.
 *
 * Uses `instanceMockFrom` so is subject to the same limitations that hold
 * for that function.
 */
export async function withMockedClassSingleton<A extends object, K extends keyof A, B>(
    obj: A,
    key: K,
    cb: (mock: A[K] extends jest.Constructable ? jest.Mocked<InstanceType<A[K]>> : never) => Promise<B>,
): Promise<B> {
  const original = obj[key];
  try {
    const mock = instanceMockFrom(original as any);
    obj[key] = jest.fn().mockReturnValue(mock) as any;
    const ret = await cb(mock as any);
    return ret;
  } finally {
    obj[key] = original;
  }
}

export function withMocked<A extends object, K extends keyof A, B>(obj: A, key: K, block: (fn: jest.Mocked<A>[K]) => B): B {
  const original = obj[key];
  const mockFn = jest.fn();
  (obj as any)[key] = mockFn;

  let asyncFinally: boolean = false;
  try {
    const ret = block(mockFn as any);
    if (!isPromise(ret)) { return ret; }

    asyncFinally = true;
    return ret.finally(() => { obj[key] = original; }) as any;
  } finally {
    if (!asyncFinally) {
      obj[key] = original;
    }
  }
}

function isPromise<A>(object: any): object is Promise<A> {
  return Promise.resolve(object) === object;
}
