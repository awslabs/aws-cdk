import * as console from 'console';
import * as path from 'path';
import * as process from 'process';
import cfn2ts from 'cfn2ts';
import * as fs from 'fs-extra';
import * as ts from 'typescript';

const LIB_ROOT = path.resolve(process.cwd(), 'lib');
const ROOT_PATH = findWorkspacePath();
const UBER_PACKAGE_JSON_PATH = path.resolve(process.cwd(), 'package.json');

async function main() {
  console.log(`🌴  workspace root path is: ${ROOT_PATH}`);

  const uberPackageJson = await fs.readJson(UBER_PACKAGE_JSON_PATH);

  const libraries = await findLibrariesToPackage(uberPackageJson);
  await verifyDependencies(uberPackageJson, libraries);
  await prepareSourceFiles(libraries, uberPackageJson);
  await combineRosettaFixtures(libraries);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error('❌ An error occurred: ', err.stack);
    process.exit(1);
  },
);

interface LibraryReference {
  readonly packageJson: PackageJson;
  readonly root: string;
  readonly shortName: string;
}

interface PackageJson {
  readonly bundleDependencies?: readonly string[];
  readonly bundledDependencies?: readonly string[];
  readonly dependencies?: { readonly [name: string]: string };
  readonly devDependencies?: { readonly [name: string]: string };
  readonly jsii: {
    readonly targets?: {
      readonly dotnet?: {
        readonly namespace: string;
        readonly [key: string]: unknown;
      },
      readonly java?: {
        readonly package: string;
        readonly [key: string]: unknown;
      },
      readonly python?: {
        readonly module: string;
        readonly [key: string]: unknown;
      },
      readonly [language: string]: unknown,
    },
  };
  readonly name: string;
  readonly types: string;
  readonly version: string;
  readonly stability: string;
  readonly [key: string]: unknown;
  readonly 'cdk-build': {
    readonly cloudformation: string[] | string;
  };
  readonly ubergen?: {
    readonly deprecatedPackages?: readonly string[];
    readonly excludeExperimentalModules?: boolean;
  };
}

/**
 * Find the workspace root path. Walk up the directory tree until you find lerna.json
 */
function findWorkspacePath(): string {
  return _findRootPath(process.cwd());

  function _findRootPath(part: string): string {
    if (part === path.resolve(part, '..')) {
      throw new Error('couldn\'t find a \'lerna.json\' file when walking up the directory tree, are you in a aws-cdk project?');
    }

    if (fs.existsSync(path.resolve(part, 'lerna.json'))) {
      return part;
    }

    return _findRootPath(path.resolve(part, '..'));
  }
}

async function findLibrariesToPackage(uberPackageJson: PackageJson): Promise<readonly LibraryReference[]> {
  console.log('🔍 Discovering libraries that need packaging...');

  const deprecatedPackages = uberPackageJson.ubergen?.deprecatedPackages;
  const result = new Array<LibraryReference>();
  const librariesRoot = path.resolve(ROOT_PATH, 'packages', '@aws-cdk');

  for (const dir of await fs.readdir(librariesRoot)) {
    const packageJson = await fs.readJson(path.resolve(librariesRoot, dir, 'package.json'));

    if (packageJson.ubergen?.exclude) {
      console.log(`\t⚠️ Skipping (ubergen excluded):   ${packageJson.name}`);
      continue;
    } else if (packageJson.jsii == null ) {
      console.log(`\t⚠️ Skipping (not jsii-enabled):   ${packageJson.name}`);
      continue;
    } else if (deprecatedPackages) {
      if (deprecatedPackages.some(packageName => packageName === packageJson.name)) {
        console.log(`\t⚠️ Skipping (ubergen deprecated): ${packageJson.name}`);
        continue;
      }
    } else if (packageJson.deprecated) {
      console.log(`\t⚠️ Skipping (deprecated):         ${packageJson.name}`);
      continue;
    }
    result.push({
      packageJson,
      root: path.join(librariesRoot, dir),
      shortName: packageJson.name.substr('@aws-cdk/'.length),
    });
  }

  console.log(`\tℹ️ Found ${result.length} relevant packages!`);

  return result;
}

async function verifyDependencies(packageJson: any, libraries: readonly LibraryReference[]): Promise<void> {
  console.log('🧐 Verifying dependencies are complete...');

  let changed = false;
  const toBundle: Record<string, string> = {};

  for (const library of libraries) {
    for (const depName of library.packageJson.bundleDependencies ?? library.packageJson.bundledDependencies ?? []) {
      const requiredVersion = library.packageJson.devDependencies?.[depName]
        ?? library.packageJson.dependencies?.[depName]
        ?? '*';
      if (toBundle[depName] != null && toBundle[depName] !== requiredVersion) {
        throw new Error(`Required to bundle different versions of ${depName}: ${toBundle[depName]} and ${requiredVersion}.`);
      }
      toBundle[depName] = requiredVersion;
    }

    if (library.packageJson.name in packageJson.devDependencies) {
      const existingVersion = packageJson.devDependencies[library.packageJson.name];
      if (existingVersion !== library.packageJson.version) {
        console.log(`\t⚠️ Incorrect dependency: ${library.packageJson.name} (expected ${library.packageJson.version}, found ${packageJson.devDependencies[library.packageJson.name]})`);
        packageJson.devDependencies[library.packageJson.name] = library.packageJson.version;
        changed = true;
      }
      continue;
    }
    console.log(`\t⚠️ Missing dependency: ${library.packageJson.name}`);
    changed = true;
    packageJson.devDependencies = sortObject({
      ...packageJson.devDependencies ?? {},
      [library.packageJson.name]: library.packageJson.version,
    });
  }
  const workspacePath = path.resolve(ROOT_PATH, 'package.json');
  const workspace = await fs.readJson(workspacePath);
  let workspaceChanged = false;

  const spuriousBundledDeps = new Set<string>(packageJson.bundledDependencies ?? []);
  for (const [name, version] of Object.entries(toBundle)) {
    spuriousBundledDeps.delete(name);

    const nohoist = `${packageJson.name}/${name}`;
    if (!workspace.workspaces.nohoist?.includes(nohoist)) {
      console.log(`\t⚠️ Missing yarn workspace nohoist: ${nohoist}`);
      workspace.workspaces.nohoist = Array.from(new Set([
        ...workspace.workspaces.nohoist ?? [],
        nohoist,
        `${nohoist}/**`,
      ])).sort();
      workspaceChanged = true;
    }

    if (!(packageJson.bundledDependencies?.includes(name))) {
      console.log(`\t⚠️ Missing bundled dependency: ${name} at ${version}`);
      packageJson.bundledDependencies = [
        ...packageJson.bundledDependencies ?? [],
        name,
      ].sort();
      changed = true;
    }

    if (packageJson.dependencies?.[name] !== version) {
      console.log(`\t⚠️ Missing or incorrect dependency: ${name} at ${version}`);
      packageJson.dependencies = sortObject({
        ...packageJson.dependencies ?? {},
        [name]: version,
      });
      changed = true;
    }
  }
  packageJson.bundledDependencies = packageJson.bundledDependencies?.filter((dep: string) => !spuriousBundledDeps.has(dep));
  for (const toRemove of Array.from(spuriousBundledDeps)) {
    delete packageJson.dependencies[toRemove];
    changed = true;
  }

  if (workspaceChanged) {
    await fs.writeFile(workspacePath, JSON.stringify(workspace, null, 2) + '\n', { encoding: 'utf-8' });
    console.log('\t❌ Updated the yarn workspace configuration. Re-run "yarn install", and commit the changes.');
  }

  if (changed) {
    await fs.writeFile(UBER_PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2) + '\n', { encoding: 'utf8' });

    throw new Error('Fixed dependency inconsistencies. Commit the updated package.json file.');
  }
  console.log('\t✅ Dependencies are correct!');
}

async function prepareSourceFiles(libraries: readonly LibraryReference[], packageJson: PackageJson) {
  console.log('📝 Preparing source files...');

  if (packageJson.ubergen?.excludeExperimentalModules) {
    console.log('\t 👩🏻‍🔬 \'excludeExperimentalModules\' enabled. Regenerating all experimental modules as L1s using cfn2ts...');
  }

  await fs.remove(LIB_ROOT);

  const indexStatements = new Array<string>();
  for (const library of libraries) {
    const libDir = path.join(LIB_ROOT, library.shortName);
    const copied = await transformPackage(library, packageJson, libDir, libraries);

    if (!copied) {
      continue;
    }
    if (library.shortName === 'core') {
      indexStatements.push(`export * from './${library.shortName}';`);
    } else {
      indexStatements.push(`export * as ${library.shortName.replace(/-/g, '_')} from './${library.shortName}';`);
    }
  }

  await fs.writeFile(path.join(LIB_ROOT, 'index.ts'), indexStatements.join('\n'), { encoding: 'utf8' });

  console.log('\t🍺 Success!');
}

async function combineRosettaFixtures(libraries: readonly LibraryReference[]) {
  console.log('📝 Combining Rosetta fixtures...');

  const uberRosettaDir = path.resolve(LIB_ROOT, '..', 'rosetta');
  await fs.remove(uberRosettaDir);

  for (const library of libraries) {
    const packageRosettaDir = path.join(library.root, 'rosetta');
    if (await fs.pathExists(packageRosettaDir)) {
      await fs.copy(packageRosettaDir, uberRosettaDir, {
        overwrite: true,
        recursive: true,
      });
    }
  }

  console.log('\t🍺 Success!');
}

async function transformPackage(
    library: LibraryReference,
    uberPackageJson: PackageJson,
    destination: string,
    allLibraries: readonly LibraryReference[],
) {
  await fs.mkdirp(destination);

  if (uberPackageJson.ubergen?.excludeExperimentalModules && library.packageJson.stability === 'experimental') {
    // when stripExperimental is enabled, we only want to add the L1s of experimental modules.
    let cfnScopes = library.packageJson['cdk-build'].cloudformation;

    if (cfnScopes === undefined) {
      return false;
    }
    cfnScopes = Array.isArray(cfnScopes) ? cfnScopes : [cfnScopes];

    const destinationLib = path.join(destination, 'lib');
    await fs.mkdirp(destinationLib);
    await cfn2ts(cfnScopes, destinationLib);
    // create a lib/index.ts which only exports the generated files
    fs.writeFileSync(path.join(destinationLib, 'index.ts'),
      /// logic copied from `create-missing-libraries.ts`
      cfnScopes.map(s => (s === 'AWS::Serverless' ? 'AWS::SAM' : s).split('::')[1].toLocaleLowerCase())
        .map(s => `export * from './${s}.generated';`)
        .join('\n'));
    await copyOrTransformFiles(destination, destination, allLibraries, uberPackageJson);
  } else {
    await copyOrTransformFiles(library.root, destination, allLibraries, uberPackageJson);
  }

  await fs.writeFile(
    path.join(destination, 'index.ts'),
    `export * from './${library.packageJson.types.replace(/(\/index)?(\.d)?\.ts$/, '')}';\n`,
    { encoding: 'utf8' },
  );

  if (library.shortName !== 'core') {
    const config = uberPackageJson.jsii.targets;
    await fs.writeJson(
      path.join(destination, '.jsiirc.json'),
      {
        targets: transformTargets(config, library.packageJson.jsii.targets),
      },
      { spaces: 2 },
    );

    await fs.writeFile(
      path.resolve(LIB_ROOT, '..', `${library.shortName}.ts`),
      `export * from './lib/${library.shortName}';\n`,
      { encoding: 'utf8' },
    );
  }
  return true;
}

function transformTargets(monoConfig: PackageJson['jsii']['targets'], targets: PackageJson['jsii']['targets']): PackageJson['jsii']['targets'] {
  if (targets == null) { return targets; }

  const result: Record<string, any> = {};
  for (const [language, config] of Object.entries(targets)) {
    switch (language) {
      case 'dotnet':
        if (monoConfig?.dotnet != null) {
          result[language] = {
            namespace: (config as any).namespace,
          };
        }
        break;
      case 'java':
        if (monoConfig?.java != null) {
          result[language] = {
            package: (config as any).package,
          };
        }
        break;
      case 'python':
        if (monoConfig?.python != null) {
          result[language] = {
            module: `${monoConfig.python.module}.${(config as any).module.replace(/^aws_cdk\./, '')}`,
          };
        }
        break;
      default:
        throw new Error(`Unsupported language for submodule configuration translation: ${language}`);
    }
  }

  return result;
}

async function copyOrTransformFiles(from: string, to: string, libraries: readonly LibraryReference[], uberPackageJson: PackageJson) {
  const promises = (await fs.readdir(from)).map(async name => {
    if (shouldIgnoreFile(name)) { return; }

    if (name.endsWith('.d.ts') || name.endsWith('.js')) {
      if (await fs.pathExists(path.join(from, name.replace(/\.(d\.ts|js)$/, '.ts')))) {
        // We won't copy .d.ts and .js files with a corresponding .ts file
        return;
      }
    }

    const source = path.join(from, name);
    const destination = path.join(to, name);

    const stat = await fs.stat(source);
    if (stat.isDirectory()) {
      await fs.mkdirp(destination);
      return copyOrTransformFiles(source, destination, libraries, uberPackageJson);
    }
    if (name.endsWith('.ts')) {
      return fs.writeFile(
        destination,
        await rewriteImports(source, to, libraries),
        { encoding: 'utf8' },
      );
    } else if (name === 'cfn-types-2-classes.json') {
      // This is a special file used by the cloudformation-include module that contains mappings
      // of CFN resource types to the fully-qualified class names of the CDK L1 classes.
      // We need to rewrite it to refer to the uberpackage instead of the individual packages
      const cfnTypes2Classes: { [key: string]: string } = await fs.readJson(source);
      for (const cfnType of Object.keys(cfnTypes2Classes)) {
        const fqn = cfnTypes2Classes[cfnType];
        // replace @aws-cdk/aws-<service> with <uber-package-name>/aws-<service>,
        // except for @aws-cdk/core, which maps just to the name of the uberpackage
        cfnTypes2Classes[cfnType] = fqn.startsWith('@aws-cdk/core.')
          ? fqn.replace('@aws-cdk/core', uberPackageJson.name)
          : fqn.replace('@aws-cdk', uberPackageJson.name);
      }
      await fs.writeJson(destination, cfnTypes2Classes, { spaces: 2 });
    } else if (name === 'README.md') {
      return fs.writeFile(
        destination,
        await rewriteReadmeImports(source),
        { encoding: 'utf8' },
      );
    } else {
      return fs.copyFile(source, destination);
    }
  });

  await Promise.all(promises);
}

/**
 * Rewrites the imports in README.md from v1 ('@aws-cdk/...') to v2 ('aws-cdk-lib').
 * Uses the module imports (import { aws_foo as foo } from 'aws-cdk-lib') for module imports,
 * and "barrel" imports for types (import { Bucket } from 'aws-cdk-lib/aws-s3').
 */
async function rewriteReadmeImports(fromFile: string): Promise<string> {
  const readmeOriginal = await fs.readFile(fromFile, { encoding: 'utf8' });
  return readmeOriginal
    // import * as s3 from '@aws-cdk/aws-s3'
    .replace(/^(\s*)import \* as (.*) from (?:'|")@aws-cdk\/(.*)(?:'|");(\s*)$/gm, rewriteCdkImports)
    // import s3 = require('@aws-cdk/aws-s3')
    .replace(/^(\s*)import (.*) = require\((?:'|")@aws-cdk\/(.*)(?:'|")\);(\s*)$/gm, rewriteCdkImports)
    // import { Bucket } from '@aws-cdk/aws-s3'
    .replace(/^(\s*)import ({.*}) from (?:'|")@aws-cdk\/(.*)(?:'|");(\s*)$/gm, rewriteCdkTypeImports);

  function rewriteCdkImports(_match: string, prefix: string, alias: string, module: string, suffix: string): string {
    if (module === 'core') {
      return `${prefix}import * as ${alias} from 'aws-cdk-lib';${suffix}`;
    } else {
      return `${prefix}import { ${module.replace(/-/g, '_')} as ${alias} } from 'aws-cdk-lib';${suffix}`;
    }
  }
  function rewriteCdkTypeImports(_match: string, prefix: string, types: string, module: string, suffix: string): string {
    if (module === 'core') {
      return `${prefix}import ${types} from 'aws-cdk-lib';${suffix}`;
    } else {
      return `${prefix}import ${types} from 'aws-cdk-lib/${module}';${suffix}`;
    }
  }
}

async function rewriteImports(fromFile: string, targetDir: string, libraries: readonly LibraryReference[]): Promise<string> {
  const sourceFile = ts.createSourceFile(
    fromFile,
    await fs.readFile(fromFile, { encoding: 'utf8' }),
    ts.ScriptTarget.ES2018,
    true,
    ts.ScriptKind.TS,
  );

  const transformResult = ts.transform(sourceFile, [importRewriter]);
  const transformedSource = transformResult.transformed[0] as ts.SourceFile;

  const printer = ts.createPrinter();
  return printer.printFile(transformedSource);

  function importRewriter(ctx: ts.TransformationContext) {
    function visitor(node: ts.Node): ts.Node {
      if (ts.isExternalModuleReference(node) && ts.isStringLiteral(node.expression)) {
        const newTarget = rewrittenImport(node.expression.text);
        if (newTarget != null) {
          return addRewrittenNote(
            ts.updateExternalModuleReference(node, newTarget),
            node.expression,
          );
        }
      } else if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const newTarget = rewrittenImport(node.moduleSpecifier.text);
        if (newTarget != null) {
          return addRewrittenNote(
            ts.updateImportDeclaration(
              node,
              node.decorators,
              node.modifiers,
              node.importClause,
              newTarget,
            ),
            node.moduleSpecifier,
          );
        }
      }
      return ts.visitEachChild(node, visitor, ctx);
    }
    return visitor;
  }

  function addRewrittenNote(node: ts.Node, original: ts.StringLiteral): ts.Node {
    return ts.addSyntheticTrailingComment(
      node,
      ts.SyntaxKind.SingleLineCommentTrivia,
      ` Automatically re-written from ${original.getText()}`,
      false, // hasTrailingNewline
    );
  }

  function rewrittenImport(moduleSpecifier: string): ts.StringLiteral | undefined {
    const sourceLibrary = libraries.find(
      lib =>
        moduleSpecifier === lib.packageJson.name ||
        moduleSpecifier.startsWith(`${lib.packageJson.name}/`),
    );
    if (sourceLibrary == null) { return undefined; }

    const importedFile = moduleSpecifier === sourceLibrary.packageJson.name
      ? path.join(LIB_ROOT, sourceLibrary.shortName)
      : path.join(LIB_ROOT, sourceLibrary.shortName, moduleSpecifier.substr(sourceLibrary.packageJson.name.length + 1));
    return ts.createStringLiteral(
      path.relative(targetDir, importedFile),
    );
  }
}

const IGNORED_FILE_NAMES = new Set([
  '.eslintrc.js',
  '.gitignore',
  '.jest.config.js',
  '.jsii',
  '.npmignore',
  'node_modules',
  'package.json',
  'test',
  'tsconfig.json',
  'tsconfig.tsbuildinfo',
  'LICENSE',
  'NOTICE',
]);
function shouldIgnoreFile(name: string): boolean {
  return IGNORED_FILE_NAMES.has(name);
}

function sortObject<T>(obj: Record<string, T>): Record<string, T> {
  const result: Record<string, T> = {};

  for (const [key, value] of Object.entries(obj).sort((l, r) => l[0].localeCompare(r[0]))) {
    result[key] = value;
  }

  return result;
}
