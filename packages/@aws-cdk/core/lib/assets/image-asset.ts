import * as fs from 'fs';
import * as path from 'path';
import * as cxapi from '@aws-cdk/cx-api';
import { Construct } from 'constructs';
import { Annotations } from '../annotations';
import { FeatureFlags } from '../feature-flags';
import { FileFingerprintOptions, IgnoreMode } from '../fs';
import { Stack } from '../stack';
import { Token } from '../token';
import { AssetStaging } from './asset-staging';
import { IAsset } from './common';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct as CoreConstruct } from '../construct-compat';

/**
 * Options for ImageAsset
 */
export interface ImageAssetOptions extends FileFingerprintOptions {
  /**
   * ECR repository name
   *
   * Specify this property if you need to statically address the image, e.g.
   * from a Kubernetes Pod. Note, this is only the repository name, without the
   * registry and the tag parts.
   *
   * @default - the default ECR repository for CDK assets
   * @deprecated to control the location of docker image assets, please override
   * `Stack.addDockerImageAsset`. this feature will be removed in future
   * releases.
   */
  readonly repositoryName?: string;

  /**
   * Build args to pass to the `docker build` command.
   *
   * Since Docker build arguments are resolved before deployment, keys and
   * values cannot refer to unresolved tokens (such as `lambda.functionArn` or
   * `queue.queueUrl`).
   *
   * @default - no build args are passed
   */
  readonly buildArgs?: { [key: string]: string };

  /**
   * Docker target to build to
   *
   * @default - no target
   */
  readonly target?: string;

  /**
   * Path to the Dockerfile (relative to the directory).
   *
   * @default 'Dockerfile'
   */
  readonly file?: string;
}

/**
 * Props for DockerImageAssets
 */
export interface ImageAssetProps extends ImageAssetOptions {
  /**
   * The directory where the Dockerfile is stored
   */
  readonly directory: string;
}

/**
 * An asset that represents a Docker image.
 *
 * The image will be created in build time and uploaded to an ECR repository.
 */
export class ImageAsset extends CoreConstruct implements IAsset {
  /**
   * The full URI of the image (including a tag). Use this reference to pull
   * the asset.
   */
  public readonly imageUri: string;

  /**
   * The name of the repository where the image is stored.
   */
  public readonly repositoryName: string;

  /**
   * A hash of this asset, which is available at construction time. As this is a plain string, it
   * can be used in construct IDs in order to enforce creation of a new resource when the content
   * hash has changed.
   */
  public readonly assetHash: string;

  constructor(scope: Construct, id: string, props: ImageAssetProps) {
    super(scope, id);

    // none of the properties use tokens
    validateProps(props);

    // resolve full path
    const dir = path.resolve(props.directory);
    if (!fs.existsSync(dir)) {
      throw new Error(`Cannot find image directory at ${dir}`);
    }

    // validate the docker file exists
    const file = path.join(dir, props.file || 'Dockerfile');
    if (!fs.existsSync(file)) {
      throw new Error(`Cannot find file at ${file}`);
    }

    const defaultIgnoreMode = FeatureFlags.of(this).isEnabled(cxapi.DOCKER_IGNORE_SUPPORT)
      ? IgnoreMode.DOCKER : IgnoreMode.GLOB;
    let ignoreMode = props.ignoreMode ?? defaultIgnoreMode;

    let exclude: string[] = props.exclude || [];

    const ignore = path.join(dir, '.dockerignore');

    if (fs.existsSync(ignore)) {
      const dockerIgnorePatterns = fs.readFileSync(ignore).toString().split('\n').filter(e => !!e);

      exclude = [
        ...dockerIgnorePatterns,
        ...exclude,

        // Ensure .dockerignore is included no matter what.
        '!.dockerignore',
      ];
    }

    // Ensure the Dockerfile is included no matter what.
    exclude.push('!' + path.basename(file));

    if (props.repositoryName) {
      Annotations.of(this).addWarning('DockerImageAsset.repositoryName is deprecated. Override "core.Stack.addDockerImageAsset" to control asset locations');
    }

    // include build context in "extra" so it will impact the hash
    const extraHash: { [field: string]: any } = { };
    if (props.extraHash) { extraHash.user = props.extraHash; }
    if (props.buildArgs) { extraHash.buildArgs = props.buildArgs; }
    if (props.target) { extraHash.target = props.target; }
    if (props.file) { extraHash.file = props.file; }
    if (props.repositoryName) { extraHash.repositoryName = props.repositoryName; }

    // add "salt" to the hash in order to invalidate the image in the upgrade to
    // 1.21.0 which removes the AdoptedRepository resource (and will cause the
    // deletion of the ECR repository the app used).
    extraHash.version = '1.21.0';

    const staging = new AssetStaging(this, 'Staging', {
      ...props,
      follow: props.followSymlinks,
      exclude,
      ignoreMode,
      sourcePath: dir,
      extraHash: Object.keys(extraHash).length === 0
        ? undefined
        : JSON.stringify(extraHash),
    });

    this.assetHash = staging.assetHash;

    const stack = Stack.of(this);
    const location = stack.synthesizer.addDockerImageAsset({
      directoryName: staging.relativeStagedPath(stack),
      dockerBuildArgs: props.buildArgs,
      dockerBuildTarget: props.target,
      dockerFile: props.file,
      sourceHash: staging.assetHash,
    });

    this.repositoryName = location.repositoryName;
    this.imageUri = location.imageUri;
  }
}

function validateProps(props: ImageAssetProps) {
  for (const [key, value] of Object.entries(props)) {
    if (Token.isUnresolved(value)) {
      throw new Error(`Cannot use Token as value of '${key}': this value is used before deployment starts`);
    }
  }

  validateBuildArgs(props.buildArgs);
}

function validateBuildArgs(buildArgs?: { [key: string]: string }) {
  for (const [key, value] of Object.entries(buildArgs || {})) {
    if (Token.isUnresolved(key) || Token.isUnresolved(value)) {
      throw new Error('Cannot use tokens in keys or values of "buildArgs" since they are needed before deployment');
    }
  }
}

export interface DockerImageAssetSource {
  /**
   * The hash of the contents of the docker build context. This hash is used
   * throughout the system to identify this image and avoid duplicate work
   * in case the source did not change.
   *
   * NOTE: this means that if you wish to update your docker image, you
   * must make a modification to the source (e.g. add some metadata to your Dockerfile).
   */
  readonly sourceHash: string;

  /**
   * An external command that will produce the packaged asset.
   *
   * The command should produce the name of a local Docker image on `stdout`.
   *
   * @default - Exactly one of `directoryName` and `executable` is required
   */
  readonly executable?: string[];

  /**
   * The directory where the Dockerfile is stored, must be relative
   * to the cloud assembly root.
   *
   * @default - Exactly one of `directoryName` and `executable` is required
   */
  readonly directoryName?: string;

  /**
   * Build args to pass to the `docker build` command.
   *
   * Since Docker build arguments are resolved before deployment, keys and
   * values cannot refer to unresolved tokens (such as `lambda.functionArn` or
   * `queue.queueUrl`).
   *
   * Only allowed when `directoryName` is specified.
   *
   * @default - no build args are passed
   */
  readonly dockerBuildArgs?: { [key: string]: string };

  /**
   * Docker target to build to
   *
   * Only allowed when `directoryName` is specified.
   *
   * @default - no target
   */
  readonly dockerBuildTarget?: string;

  /**
   * Path to the Dockerfile (relative to the directory).
   *
   * Only allowed when `directoryName` is specified.
   *
   * @default - no file
   */
  readonly dockerFile?: string;

  /**
   * ECR repository name
   *
   * Specify this property if you need to statically address the image, e.g.
   * from a Kubernetes Pod. Note, this is only the repository name, without the
   * registry and the tag parts.
   *
   * @default - automatically derived from the asset's ID.
   * @deprecated repository name should be specified at the environment-level and not at the image level
   */
  readonly repositoryName?: string;
}

/**
 * The location of the published docker image. This is where the image can be
 * consumed at runtime.
 */
export interface DockerImageAssetLocation {
  /**
   * The URI of the image in Amazon ECR.
   */
  readonly imageUri: string;

  /**
   * The name of the ECR repository.
   */
  readonly repositoryName: string;
}
