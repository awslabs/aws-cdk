import * as fs from 'fs';
import * as path from 'path';
import * as lambda from '@aws-cdk/aws-lambda';
import * as cdk from '@aws-cdk/core';
import { hasDependencies, bundleFunction } from './bundling';
import { PythonLayerVersion } from './layer';

/**
 * Properties for a PythonFunction
 */
export interface PythonFunctionProps extends lambda.FunctionOptions {
  /**
   * The path to the root directory of the function.
   */
  readonly entry: string;

  /**
   * The path (relative to entry) to the index file containing the exported handler.
   *
   * @default index.py
   */
  readonly index?: string;

  /**
   * The name of the exported handler in the index file.
   *
   * @default handler
   */
  readonly handler?: string;

  /**
   * The runtime environment. Only runtimes of the Python family are
   * supported.
   *
   * @default lambda.Runtime.PYTHON_3_7
   */
  readonly runtime?: lambda.Runtime;

  /**
   * The location to install dependencies.
   *
   * @default DependenciesLocation.LAYER
   */
  readonly dependenciesLocation?: DependenciesLocation;
}

/**
 * Where to install dependencies.
 */
export enum DependenciesLocation {
  /**
   * Does not install dependencies.
   */
  NONE = 'none',

  /**
   * Includes dependencies inside the lambda bundle.
   */
  INLINE = 'inline',

  /**
   * Bundles dependencies into a separate lambda layer.
   */
  LAYER = 'layer',
}

/**
 * A Python Lambda function
 */
export class PythonFunction extends lambda.Function {
  constructor(scope: cdk.Construct, id: string, props: PythonFunctionProps) {
    if (props.runtime && props.runtime.family !== lambda.RuntimeFamily.PYTHON) {
      throw new Error('Only `PYTHON` runtimes are supported.');
    }
    if (props.index && !/\.py$/.test(props.index)) {
      throw new Error('Only Python (.py) index files are supported.');
    }

    // Entry and defaults
    const entry = path.resolve(props.entry);
    const index = props.index ?? 'index.py';

    const resolvedIndex = path.resolve(entry, index);
    if (!fs.existsSync(resolvedIndex)) {
      throw new Error(`Cannot find index file at ${resolvedIndex}`);
    }

    const handler = props.handler ?? 'handler';
    const runtime = props.runtime ?? lambda.Runtime.PYTHON_3_7;
    const dependenciesLocation = props.dependenciesLocation ?? DependenciesLocation.LAYER;

    const code = bundleFunction({
      runtime,
      entry,
      installDependenciesInline: dependenciesLocation === DependenciesLocation.INLINE,
    });

    super(scope, id, {
      ...props,
      runtime,
      code,
      handler: `${index.slice(0, -3)}.${handler}`,
    });

    if (dependenciesLocation === DependenciesLocation.LAYER && hasDependencies(entry)) {
      this.addLayers(new PythonLayerVersion(this, 'Dependencies', {
        entry: entry,
        compatibleRuntimes: [runtime],
      }));
    }
  }
}
