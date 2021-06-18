import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';
// eslint-disable-next-line import/no-extraneous-dependencies
import * as tjs from 'typescript-json-schema';

function log(message: string) {
  // eslint-disable-next-line no-console
  console.log(message);
}

/**
 * Where schemas are committed.
 */
const SCHEMA_DIR = path.resolve(__dirname, '../schema');

const SCHEMA_DEFINITIONS: { [schemaName: string]: { rootTypeName: string } } = {
  'assets': { rootTypeName: 'AssetManifest' },
  'cloud-assembly': { rootTypeName: 'AssemblyManifest' },
};

export const SCHEMAS = Object.keys(SCHEMA_DEFINITIONS);

export function update() {
  for (const s of SCHEMAS) {
    generateSchema(s);
  }

  bump();
}

export function bump() {
  const versionFile = path.join(SCHEMA_DIR, 'cloud-assembly.version.json');

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const metadata = require(versionFile);

  const oldVersion = metadata.version;
  const newVersion = semver.inc(oldVersion, 'major');

  log(`Updating schema version: ${oldVersion} -> ${newVersion}`);
  fs.writeFileSync(versionFile, JSON.stringify({ version: newVersion }));
}

/**
 * Generates a schema from typescript types.
 * @returns JSON schema
 * @param schemaName the schema to generate
 * @param shouldBump writes a new version of the schema and bumps the major version
 */
export function generateSchema(schemaName: string, saveToFile: boolean = true) {
  const spec = SCHEMA_DEFINITIONS[schemaName];
  const out = saveToFile ? path.join(SCHEMA_DIR, `${schemaName}.schema.json`) : '';

  const settings: Partial<tjs.Args> = {
    required: true,
    ref: true,
    topRef: true,
    noExtraProps: false,
    out,
  };

  const compilerOptions = {
    strictNullChecks: true,
  };

  const program = tjs.getProgramFromFiles([path.join(__dirname, '../lib/index.d.ts')], compilerOptions);
  const schema = tjs.generateSchema(program, spec.rootTypeName, settings);

  augmentDescription(schema);
  addAnyMetadataEntry(schema);

  if (out) {
    log(`Generating schema to ${out}`);
    fs.writeFileSync(out, JSON.stringify(schema, null, 4));
  }

  return schema;
}

/**
 * Remove 'default' from the schema since its generated
 * from the tsdocs, which are not necessarily actual values,
 * but rather descriptive behavior.
 *
 * To keep this inforamtion in the schema, we append it to the
 * 'description' of the property.
 */
function augmentDescription(schema: any) {
  function _recurse(o: any) {
    for (const prop in o) {
      if (prop === 'description' && typeof o[prop] === 'string') {
        const description = o[prop];
        const defaultValue = o.default;

        if (!defaultValue) {
          // property doesn't have a default value
          // skip
          continue;
        }

        const descriptionWithDefault = `${description} (Default ${defaultValue})`;

        delete o.default;
        o[prop] = descriptionWithDefault;
      } else if (typeof o[prop] === 'object') {
        _recurse(o[prop]);
      }
    }
  }

  _recurse(schema);
}

/**
 * Patch the properties of MetadataEntry to allow
 * specifying any free form data. This is needed since source
 * code doesn't allow this in order to enforce stricter jsii
 * compatibility checks.
 */
function addAnyMetadataEntry(schema: any) {
  schema.definitions.MetadataEntry?.properties.data.anyOf.push({ description: 'Free form data.' });
}
