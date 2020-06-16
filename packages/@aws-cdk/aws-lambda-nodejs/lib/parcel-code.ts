import * as lambda from '@aws-cdk/aws-lambda';
import * as cdk from '@aws-cdk/core';
import * as fs from 'fs';
import * as path from 'path';
import { findPkgPath } from './util';

/**
 * Properties for a ParcelCode
 */
export interface ParcelCodeProps {
  /**
   * Entry file
   */
  readonly entry: string;

  /**
   * Expose modules as UMD under this name
   */
  readonly global: string;

  /**
   * Minify
   */
  readonly minify?: boolean;

  /**
   * Include source maps
   */
  readonly sourceMaps?: boolean;

  /**
   * The cache directory
   */
  readonly cacheDir?: string;

  /**
   * The node version to use as target for Babel
   */
  readonly nodeVersion: string;

  /**
   * The docker tag of the node base image to use in the parcel-bundler docker image
   *
   * @see https://hub.docker.com/_/node/?tab=tags
   */
  readonly nodeDockerTag: string;

  /**
   * The root of the project. This will be used as the source for the volume
   * mounted in the Docker container.
   */
  readonly projectRoot: string;

  /**
   * The environment variables to pass to the container running Parcel.
   *
   * @default - no environment variables are passed to the container
   */
  readonly environment?: { [key: string]: string; };
}

/**
 * Parcel code
 */
export class ParcelCode extends lambda.AssetCode {
  constructor(props: ParcelCodeProps) {
    // Original package.json path and content
    let pkgPath = findPkgPath();
    if (!pkgPath) {
      throw new Error('Cannot find a `package.json` in this project.');
    }
    pkgPath = path.join(pkgPath, 'package.json');
    const originalPkg = fs.readFileSync(pkgPath);
    const originalPkgJson = JSON.parse(originalPkg.toString());

    // Update engines.node in package.json to set the right Babel target
    setEngines(props.nodeVersion, pkgPath, originalPkgJson);

    // Entry file path relative to container path
    const containerEntryPath = path.join(cdk.AssetStaging.BUNDLING_INPUT_DIR, path.relative(props.projectRoot, path.resolve(props.entry)));

    try {
      const command = [
        'parcel', 'build', containerEntryPath.replace(/\\/g, '/'), // Always use POSIX paths in the container
        '--out-dir', cdk.AssetStaging.BUNDLING_OUTPUT_DIR,
        '--out-file', 'index.js',
        '--global', props.global,
        '--target', 'node',
        '--bundle-node-modules',
        '--log-level', '2',
        !props.minify && '--no-minify',
        !props.sourceMaps && '--no-source-maps',
        ...(props.cacheDir ? ['--cache-dir', '/parcel-cache'] : []),
      ].filter(Boolean) as string[];

      super(props.projectRoot, {
        assetHashType: cdk.AssetHashType.BUNDLE,
        bundling: {
          image: cdk.BundlingDockerImage.fromAsset(path.join(__dirname, '../parcel-bundler'), {
            buildArgs: {
              NODE_TAG: props.nodeDockerTag ?? `${process.versions.node}-alpine`,
            },
          }),
          environment: props.environment,
          volumes: props.cacheDir
            ? [{ containerPath: '/parcel-cache', hostPath: props.cacheDir }]
            : [],
          workingDirectory: path.dirname(containerEntryPath).replace(/\\/g, '/'), // Always use POSIX paths in the container
          command,
        },
      });
    } finally {
      restorePkg(pkgPath, originalPkg);
    }
  }
}

function setEngines(nodeVersion: string, pkgPath: string, originalPkgJson: any): void {
  // Update engines.node (Babel target)
  const updateData = {
    engines: {
      node: `>= ${nodeVersion}`,
    },
  };

  // Write new package.json
  if (Object.keys(updateData).length !== 0) {
    fs.writeFileSync(pkgPath, JSON.stringify({
      ...originalPkgJson,
      ...updateData,
    }, null, 2));
  }
}

function restorePkg(pkgPath: string, originalPkg: Buffer): void {
  fs.writeFileSync(pkgPath, originalPkg);
}
