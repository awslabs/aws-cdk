import * as fs from 'fs';
import * as path from 'path';
import * as lambda from '@aws-cdk/aws-lambda';
import * as cdk from '@aws-cdk/core';

/**
 * Options for bundling
 */
export interface BundlingOptions {
  /**
   * Entry path
   */
  readonly entry: string;

  /**
   * The runtime of the lambda function
   */
  readonly runtime: lambda.Runtime;

  /**
   * Install dependencies while bundling
   */
  readonly installDependencies: boolean;
}

/**
 * Produce bundled Lambda asset code
 */
export function bundle(options: BundlingOptions): lambda.AssetCode {
  let installer = options.runtime === lambda.Runtime.PYTHON_2_7 ? Installer.PIP : Installer.PIP3;

  let hasRequirements = fs.existsSync(path.join(options.entry, 'requirements.txt'));
  let installDependencies = options.installDependencies;

  let depsCommand = chain([
    hasRequirements && installDependencies ? `${installer} install -r requirements.txt -t ${cdk.AssetStaging.BUNDLING_OUTPUT_DIR}` : '',
    `cp -au . ${cdk.AssetStaging.BUNDLING_OUTPUT_DIR}`,
  ]);

  return lambda.Code.fromAsset(options.entry, {
    bundling: {
      image: options.runtime.bundlingDockerImage,
      command: ['bash', '-c', depsCommand],
    },
  });
}

enum Installer {
  PIP = 'pip',
  PIP3 = 'pip3',
}

function chain(commands: string[]): string {
  return commands.filter(c => !!c).join(' && ');
}

export interface DependencyBundlingOptions {
  /**
   * Entry path
   */
  readonly entry: string;

  /**
   * The runtime of the lambda function
   */
  readonly runtime: lambda.Runtime;
}
export function bundleDependencies(options: DependencyBundlingOptions): lambda.AssetCode {
  let installer = options.runtime === lambda.Runtime.PYTHON_2_7 ? Installer.PIP : Installer.PIP3;
  let depsCommand = chain([
    `${installer} install -r requirements.txt -t ${cdk.AssetStaging.BUNDLING_OUTPUT_DIR}/python`,
  ]);

  return lambda.Code.fromAsset(options.entry, {
    bundling: {
      image: options.runtime.bundlingDockerImage,
      command: ['bash', '-c', depsCommand],
    },
    exclude: ['*', '!requirements.txt'],
  });
}
