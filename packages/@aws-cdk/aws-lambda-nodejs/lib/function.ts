import * as fs from 'fs';
import * as path from 'path';
import * as lambda from '@aws-cdk/aws-lambda';
import { Bundling } from './bundling';
import { PackageManager } from './package-manager';
import { BundlingOptions } from './types';
import { callsites, findUp } from './util';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/**
 * Properties for a NodejsFunction
 */
export interface NodejsFunctionProps extends lambda.FunctionOptions {
  /**
   * Path to the entry file (JavaScript or TypeScript).
   *
   * @default - Derived from the name of the defining file and the construct's id.
   * If the `NodejsFunction` is defined in `stack.ts` with `my-handler` as id
   * (`new NodejsFunction(this, 'my-handler')`), the construct will look at `stack.my-handler.ts`
   * and `stack.my-handler.js`.
   */
  readonly entry?: string;

  /**
   * The name of the exported handler in the entry file.
   *
   * @default handler
   */
  readonly handler?: string;

  /**
   * The runtime environment. Only runtimes of the Node.js family are
   * supported.
   *
   * @default Runtime.NODEJS_14_X
   */
  readonly runtime?: lambda.Runtime;

  /**
   * Whether to automatically reuse TCP connections when working with the AWS
   * SDK for JavaScript.
   *
   * This sets the `AWS_NODEJS_CONNECTION_REUSE_ENABLED` environment variable
   * to `1`.
   *
   * @see https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/node-reusing-connections.html
   *
   * @default true
   */
  readonly awsSdkConnectionReuse?: boolean;

  /**
   * The path to the dependencies lock file (`yarn.lock` or `package-lock.json`).
   *
   * This will be used as the source for the volume mounted in the Docker
   * container.
   *
   * Modules specified in `nodeModules` will be installed using the right
   * installer (`npm` or `yarn`) along with this lock file.
   *
   * @default - the path is found by walking up parent directories searching for
   *   a `yarn.lock` or `package-lock.json` file
   */
  readonly depsLockFilePath?: string;

  /**
   * Bundling options
   *
   * @default - use default bundling options: no minify, no sourcemap, all
   *   modules are bundled.
   */
  readonly bundling?: BundlingOptions;

  /**
   * The path to the directory containing project config files (`package.json` or `tsconfig.json`)
   *
   * @default - the directory containing the `depsLockFilePath`
   */
  readonly projectRoot?: string;
}

/**
 * A Node.js Lambda function bundled using esbuild
 */
export class NodejsFunction extends lambda.Function {
  constructor(scope: Construct, id: string, props: NodejsFunctionProps = {}) {
    if (props.runtime && props.runtime.family !== lambda.RuntimeFamily.NODEJS) {
      throw new Error('Only `NODEJS` runtimes are supported.');
    }

    // Entry and defaults
    const entry = path.resolve(findEntry(id, props.entry));
    const handler = props.handler ?? 'handler';
    const runtime = props.runtime ?? lambda.Runtime.NODEJS_14_X;
    const depsLockFilePath = findLockFile(props.depsLockFilePath);
    const projectRoot = props.projectRoot ?? path.dirname(depsLockFilePath);

    super(scope, id, {
      ...props,
      runtime,
      code: Bundling.bundle({
        ...props.bundling ?? {},
        entry,
        runtime,
        depsLockFilePath,
        projectRoot,
      }),
      handler: `index.${handler}`,
    });

    // Enable connection reuse for aws-sdk
    if (props.awsSdkConnectionReuse ?? true) {
      this.addEnvironment('AWS_NODEJS_CONNECTION_REUSE_ENABLED', '1', { removeInEdge: true });
    }
  }
}

/**
 * Checks given lock file or searches for a lock file
 */
function findLockFile(depsLockFilePath?: string): string {
  if (depsLockFilePath) {
    if (!fs.existsSync(depsLockFilePath)) {
      throw new Error(`Lock file at ${depsLockFilePath} doesn't exist`);
    }

    if (!fs.statSync(depsLockFilePath).isFile()) {
      throw new Error('`depsLockFilePath` should point to a file');
    }

    return path.resolve(depsLockFilePath);
  }

  const lockFile = findUp(PackageManager.PNPM.lockFile)
    ?? findUp(PackageManager.YARN.lockFile)
    ?? findUp(PackageManager.NPM.lockFile);

  if (!lockFile) {
    throw new Error('Cannot find a package lock file (`pnpm-lock.yaml`, `yarn.lock` or `package-lock.json`). Please specify it with `depsFileLockPath`.');
  }

  return lockFile;
}

/**
 * Searches for an entry file. Preference order is the following:
 * 1. Given entry file
 * 2. A .ts file named as the defining file with id as suffix (defining-file.id.ts)
 * 3. A .js file name as the defining file with id as suffix (defining-file.id.js)
 */
function findEntry(id: string, entry?: string): string {
  if (entry) {
    if (!/\.(jsx?|tsx?)$/.test(entry)) {
      throw new Error('Only JavaScript or TypeScript entry files are supported.');
    }
    if (!fs.existsSync(entry)) {
      throw new Error(`Cannot find entry file at ${entry}`);
    }
    return entry;
  }

  const definingFile = findDefiningFile();
  const extname = path.extname(definingFile);

  const tsHandlerFile = definingFile.replace(new RegExp(`${extname}$`), `.${id}.ts`);
  if (fs.existsSync(tsHandlerFile)) {
    return tsHandlerFile;
  }

  const jsHandlerFile = definingFile.replace(new RegExp(`${extname}$`), `.${id}.js`);
  if (fs.existsSync(jsHandlerFile)) {
    return jsHandlerFile;
  }

  throw new Error(`Cannot find handler file ${tsHandlerFile} or ${jsHandlerFile}`);
}

/**
 * Finds the name of the file where the `NodejsFunction` is defined
 */
function findDefiningFile(): string {
  let definingIndex;
  const sites = callsites();
  for (const [index, site] of sites.entries()) {
    if (site.getFunctionName() === 'NodejsFunction') {
      // The next site is the site where the NodejsFunction was created
      definingIndex = index + 1;
      break;
    }
  }

  if (!definingIndex || !sites[definingIndex]) {
    throw new Error('Cannot find defining file.');
  }

  return sites[definingIndex].getFileName();
}
