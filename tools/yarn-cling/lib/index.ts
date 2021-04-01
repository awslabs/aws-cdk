import { promises as fs, exists } from 'fs';
import * as path from 'path';
import * as lockfile from '@yarnpkg/lockfile';
import * as semver from 'semver';
import { hoistDependencies } from './hoisting';
import { PackageJson, PackageLock, PackageLockEntry, PackageLockPackage, YarnLock } from './types';

export interface ShrinkwrapOptions {
  /**
   * The package.json file to start scanning for dependencies
   */
  packageJsonFile: string;

  /**
   * The output lockfile to generate
   *
   * @default - Don't generate the file, just return the calculated output
   */
  outputFile?: string;

  /**
   * Whether to hoist dependencies
   *
   * @default true
   */
  hoist?: boolean;
}

export async function generateShrinkwrap(options: ShrinkwrapOptions): Promise<PackageLock> {
  // No args (yet)
  const packageJsonFile = options.packageJsonFile;
  const packageJsonDir = path.dirname(packageJsonFile);

  const yarnLockLoc = await findYarnLock(packageJsonDir);
  const yarnLock: YarnLock = lockfile.parse(await fs.readFile(yarnLockLoc, { encoding: 'utf8' }));
  const pkgJson = await loadPackageJson(packageJsonFile);

  const lock = await generateLockFile(pkgJson, yarnLock, packageJsonDir);

  if (options.hoist ?? true) {
    hoistDependencies(lock.dependencies || {});
  }

  if (options.outputFile) {
    // Write the shrinkwrap file
    await fs.writeFile(options.outputFile, JSON.stringify(lock, undefined, 2), { encoding: 'utf8' });
  }

  return lock;
}

async function generateLockFile(pkgJson: PackageJson, yarnLock: YarnLock, rootDir: string): Promise<PackageLock> {
  const lockFile = {
    name: pkgJson.name,
    version: pkgJson.version,
    lockfileVersion: 1,
    requires: true,
    dependencies: await dependenciesFor(pkgJson.dependencies || {}, yarnLock, rootDir),
  };

  checkRequiredVersions(lockFile);

  return lockFile;
}

// eslint-disable-next-line max-len
async function dependenciesFor(deps: Record<string, string>, yarnLock: YarnLock, rootDir: string): Promise<Record<string, PackageLockPackage>> {
  const ret: Record<string, PackageLockPackage> = {};

  // Get rid of any monorepo symlinks
  rootDir = await fs.realpath(rootDir);

  for (const [depName, versionRange] of Object.entries(deps)) {
    const depDir = await findPackageDir(depName, rootDir);
    const depPkgJsonFile = path.join(depDir, 'package.json');
    const depPkgJson = await loadPackageJson(depPkgJsonFile);
    const yarnKey = `${depName}@${versionRange}`;

    // Sanity check
    if (depPkgJson.name !== depName) {
      throw new Error(`Looking for '${depName}' from ${rootDir}, but found '${depPkgJson.name}' in ${depDir}`);
    }

    const yarnResolved = yarnLock.object[yarnKey];
    if (yarnResolved) {
      // Resolved by Yarn
      ret[depName] = {
        version: yarnResolved.version,
        integrity: yarnResolved.integrity,
        resolved: yarnResolved.resolved,
        requires: depPkgJson.dependencies,
        dependencies: await dependenciesFor(depPkgJson.dependencies || {}, yarnLock, depDir),
      };
    } else {
      // Comes from monorepo, just use whatever's in package.json
      ret[depName] = {
        version: depPkgJson.version,
        requires: depPkgJson.dependencies,
        dependencies: await dependenciesFor(depPkgJson.dependencies || {}, yarnLock, depDir),
      };
    }

    // Simplify by removing useless entries
    if (Object.keys(ret[depName].requires ?? {}).length === 0) { delete ret[depName].requires; }
    if (Object.keys(ret[depName].dependencies ?? {}).length === 0) { delete ret[depName].dependencies; }
  }

  return ret;
}

async function findYarnLock(start: string) {
  return findUp('yarn.lock', start);
}

async function findUp(fileName: string, start: string) {
  start = path.resolve(start);
  let dir = start;
  const yarnLockHere = () => path.join(dir, fileName);
  while (!await fileExists(yarnLockHere())) {
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`No ${fileName} found upwards from ${start}`);
    }
    dir = parent;
  }

  return yarnLockHere();
}

async function loadPackageJson(fileName: string): Promise<PackageJson> {
  return JSON.parse(await fs.readFile(fileName, { encoding: 'utf8' }));
}

async function fileExists(fullPath: string): Promise<boolean> {
  try {
    await fs.stat(fullPath);
    return true;
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR') { return false; }
    throw e;
  }
}

export function formatPackageLock(entry: PackageLockEntry) {
  const lines = new Array<string>();
  recurse([], entry);
  return lines.join('\n');

  function recurse(names: string[], thisEntry: PackageLockEntry) {
    if (names.length > 0) {
      // eslint-disable-next-line no-console
      lines.push(`${names.join(' -> ')} @ ${thisEntry.version}`);
    }
    for (const [depName, depEntry] of Object.entries(thisEntry.dependencies || {})) {
      recurse([...names, depName], depEntry);
    }
  }
}

/**
 * Find package directory
 *
 * Do this by walking upwards in the directory tree until we find
 * `<dir>/node_modules/<package>/package.json`.
 *
 * -------
 *
 * Things that we tried but don't work:
 *
 * 1.    require.resolve(`${depName}/package.json`, { paths: [rootDir] });
 *
 * Breaks with ES Modules if `package.json` has not been exported, which is
 * being enforced starting Node12.
 *
 * 2.    findPackageJsonUpwardFrom(require.resolve(depName, { paths: [rootDir] }))
 *
 * Breaks if a built-in NodeJS package name conflicts with an NPM package name
 * (in Node15 `string_decoder` is introduced...)
 */
async function findPackageDir(depName: string, rootDir: string) {
  let prevDir;
  let dir = rootDir;
  while (dir !== prevDir) {
    const candidateDir = path.join(dir, 'node_modules', depName);
    if (await new Promise(ok => exists(path.join(candidateDir, 'package.json'), ok))) {
      return candidateDir;
    }

    prevDir = dir;
    dir = path.dirname(dir); // dirname('/') -> '/', dirname('c:\\') -> 'c:\\'
  }

  throw new Error(`Did not find '${depName}' upwards of '${rootDir}'`);
}

/**
 * We may sometimes try to adjust a package version to a version that's incompatible with the declared requirement.
 *
 * For example, this recently happened for 'netmask', where the package we
 * depend on has `{ requires: { netmask: '^1.0.6', } }`, but we need to force-substitute in version `2.0.1`.
 *
 * If NPM processes the shrinkwrap and encounters the following situation:
 *
 * ```
 * {
 *   netmask: { version: '2.0.1' },
 *   resolver: {
 *     requires: {
 *       netmask: '^1.0.6'
 *     }
 *   }
 * }
 * ```
 *
 * NPM is going to disregard the swhinkrwap and still give `resolver` its own private
 * copy of netmask `^1.0.6`.
 *
 * We tried overriding the `requires` version, and that works for `npm install` (yay)
 * but if anyone runs `npm ls` afterwards, `npm ls` is going to check the actual source
 * `package.jsons` against the actual `node_modules` file tree, and complain that the
 * versions don't match.
 *
 * We run `npm ls` in our tests to make sure our dependency tree is sane, and our customers
 * might too, so this is not a great solution.
 *
 * To cut any discussion short in the future, we're going to detect this situation and
 * tell our future selves that is cannot and will not work, and we should find another
 * solution.
 */
export function checkRequiredVersions(root: PackageLock | PackageLockPackage) {
  recurse(root, []);

  function recurse(entry: PackageLock | PackageLockPackage, parentChain: PackageLockEntry[]) {
    // On the root, 'requires' is the value 'true', for God knows what reason. Don't care about those.
    if (typeof entry.requires === 'object') {

      // For every 'requires' dependency, find the version it actually got resolved to and compare.
      for (const [name, range] of Object.entries(entry.requires)) {
        const resolvedPackage = findResolved(name, [entry, ...parentChain]);
        if (!resolvedPackage) { continue; }

        if (!semver.satisfies(resolvedPackage.version, range)) {
          // Ruh-roh.
          throw new Error(`Looks like we're trying to force '${name}' to version '${resolvedPackage.version}', but the dependency `
            + `is specified as '${range}'. This can never properly work via shrinkwrapping. Try vendoring a patched `
            + 'version of the intermediary dependencies instead.');
        }
      }
    }

    for (const dep of Object.values(entry.dependencies ?? {})) {
      recurse(dep, [entry, ...parentChain]);
    }
  }

  /**
   * Find a package name in a package lock tree.
   */
  function findResolved(name: string, chain: PackageLockEntry[]) {
    for (const level of chain) {
      if (level.dependencies?.[name]) {
        return level.dependencies?.[name];
      }
    }
    return undefined;
  }
}