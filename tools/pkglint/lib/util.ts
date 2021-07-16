import * as fs from 'fs';
import * as path from 'path';
import { PackageJson, PKGLINT_IGNORES } from './packagejson';

/**
 * Expect a particular JSON key to be a given value
 */
export function expectJSON(ruleName: string, pkg: PackageJson, jsonPath: string, expected: any, ignore?: RegExp, caseInsensitive: boolean = false) {
  const parts = jsonPath.split('.');
  const actual = deepGet(pkg.json, parts);
  if (applyCaseInsensitive(applyIgnore(actual)) !== applyCaseInsensitive(applyIgnore(expected))) {
    pkg.report({
      ruleName,
      message: `${jsonPath} should be ${JSON.stringify(expected)}${ignore ? ` (ignoring ${ignore})` : ''}, is ${JSON.stringify(actual)}`,
      fix: () => { deepSet(pkg.json, parts, expected); },
    });
  }

  function applyIgnore(val: any): string {
    if (!ignore || val == null) { return JSON.stringify(val); }
    const str = JSON.stringify(val);
    return str.replace(ignore, '');
  }

  function applyCaseInsensitive(val: any): string {
    if (!caseInsensitive || val == null) { return JSON.stringify(val); }
    const str = JSON.stringify(val);
    return str.toLowerCase();
  }
}

/**
 * Export a package-level file to contain a given line
 */
export function fileShouldContain(ruleName: string, pkg: PackageJson, fileName: string, ...lines: string[]) {
  for (const line of lines) {
    const doesContain = pkg.fileContainsSync(fileName, line);
    if (!doesContain) {
      pkg.report({
        ruleName,
        message: `${fileName} should contain '${line}'`,
        fix: () => pkg.addToFileSync(fileName, line),
      });
    }
  }
}

export function fileShouldNotContain(ruleName: string, pkg: PackageJson, fileName: string, ...lines: string[]) {
  for (const line of lines) {
    const doesContain = pkg.fileContainsSync(fileName, line);
    if (doesContain) {
      pkg.report({
        ruleName,
        message: `${fileName} should NOT contain '${line}'`,
        fix: () => pkg.removeFromFileSync(fileName, line),
      });
    }
  }
}

/**
 * Export a package-level file to contain specific content
 */
export function fileShouldBe(ruleName: string, pkg: PackageJson, fileName: string, content: string) {
  const isContent = pkg.fileIsSync(fileName, content);
  if (!isContent) {
    pkg.report({
      ruleName,
      message: `${fileName} should contain exactly '${content}'`,
      fix: () => pkg.writeFileSync(fileName, content),
    });
  }
}

/**
 * Export a package-level file to contain specific content
 */
export function fileShouldBeginWith(ruleName: string, pkg: PackageJson, fileName: string, ...lines: string[]) {
  const isContent = pkg.fileBeginsWith(fileName, ...lines);
  if (!isContent) {
    pkg.report({
      ruleName,
      message: `${fileName} does NOT begin with ${lines}'`,
    });
  }
}

/**
 * Enforce a dev dependency
 */
export function expectDevDependency(ruleName: string, pkg: PackageJson, packageName: string, version: string) {
  const actualVersion = pkg.getDevDependency(packageName);
  if (version !== actualVersion) {
    pkg.report({
      ruleName,
      message: `Missing devDependency: ${packageName} @ ${version}`,
      fix: () => pkg.addDevDependency(packageName, version),
    });
  }
}

/**
 * Return whether the given value is an object
 *
 * Even though arrays technically are objects, we usually want to treat them differently,
 * so we return false in those cases.
 */
export function isObject(x: any) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

/**
 * Deep get a value from a tree of nested objects
 *
 * Returns undefined if any part of the path was unset or
 * not an object.
 */
export function deepGet(x: any, jsonPath: string[]): any {
  jsonPath = jsonPath.slice();

  while (jsonPath.length > 0 && isObject(x)) {
    const key = jsonPath.shift()!;
    x = x[key];
  }
  return jsonPath.length === 0 ? x : undefined;
}

/**
 * Deep set a value in a tree of nested objects
 *
 * Throws an error if any part of the path is not an object.
 */
export function deepSet(x: any, jsonPath: string[], value: any) {
  jsonPath = jsonPath.slice();

  if (jsonPath.length === 0) {
    throw new Error('Path may not be empty');
  }

  while (jsonPath.length > 1 && isObject(x)) {
    const key = jsonPath.shift()!;
    if (!(key in x)) { x[key] = {}; }
    x = x[key];
  }

  if (!isObject(x)) {
    throw new Error(`Expected an object, got '${x}'`);
  }

  x[jsonPath[0]] = value;
}

export function findUpward(dir: string, pred: (x: string) => boolean): string | undefined {
  while (true) {
    if (pred(dir)) { return dir; }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return undefined;
    }

    dir = parent;
  }
}

export function monoRepoRoot() {
  const ret = findUpward(process.cwd(), d => fs.existsSync(path.join(d, 'release.json')) || fs.existsSync(path.join(d, '.nzmroot')));
  if (!ret) {
    throw new Error('Could not find lerna.json');
  }
  return ret;
}

export function* findInnerPackages(dir: string): IterableIterator<string> {
  for (const fname of fs.readdirSync(dir, { encoding: 'utf8' })) {
    try {
      const stat = fs.statSync(path.join(dir, fname));
      if (!stat.isDirectory()) { continue; }
    } catch (e) {
      // Survive invalid symlinks
      if (e.code !== 'ENOENT') { throw e; }
      continue;
    }
    if (PKGLINT_IGNORES.includes(fname)) { continue; }

    if (fs.existsSync(path.join(dir, fname, 'package.json'))) {
      yield path.join(dir, fname);
    }

    yield* findInnerPackages(path.join(dir, fname));
  }
}
