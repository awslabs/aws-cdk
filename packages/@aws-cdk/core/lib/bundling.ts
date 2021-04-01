import { spawnSync, SpawnSyncOptions } from 'child_process';
import * as crypto from 'crypto';
import { isAbsolute, join } from 'path';
import { FileSystem } from './fs';

/**
 * Bundling options
 *
 * @experimental
 */
export interface BundlingOptions {
  /**
   * The Docker image where the command will run.
   */
  readonly image: DockerImage;

  /**
   * The entrypoint to run in the Docker container.
   *
   * @example ['/bin/sh', '-c']
   *
   * @see https://docs.docker.com/engine/reference/builder/#entrypoint
   *
   * @default - run the entrypoint defined in the image
   */
  readonly entrypoint?: string[];

  /**
   * The command to run in the Docker container.
   *
   * @example ['npm', 'install']
   *
   * @see https://docs.docker.com/engine/reference/run/
   *
   * @default - run the command defined in the image
   */
  readonly command?: string[];

  /**
   * Additional Docker volumes to mount.
   *
   * @default - no additional volumes are mounted
   */
  readonly volumes?: DockerVolume[];

  /**
   * The environment variables to pass to the Docker container.
   *
   * @default - no environment variables.
   */
  readonly environment?: { [key: string]: string; };

  /**
   * Working directory inside the Docker container.
   *
   * @default /asset-input
   */
  readonly workingDirectory?: string;

  /**
   * The user to use when running the Docker container.
   *
   *   user | user:group | uid | uid:gid | user:gid | uid:group
   *
   * @see https://docs.docker.com/engine/reference/run/#user
   *
   * @default - uid:gid of the current user or 1000:1000 on Windows
   */
  readonly user?: string;

  /**
   * Local bundling provider.
   *
   * The provider implements a method `tryBundle()` which should return `true`
   * if local bundling was performed. If `false` is returned, docker bundling
   * will be done.
   *
   * @default - bundling will only be performed in a Docker container
   *
   * @experimental
   */
  readonly local?: ILocalBundling;

  /**
   * The type of output that this bundling operation is producing.
   *
   * @default BundlingOutput.AUTO_DISCOVER
   *
   * @experimental
   */
  readonly outputType?: BundlingOutput;
}

/**
 * The type of output that a bundling operation is producing.
 *
 * @experimental
 */
export enum BundlingOutput {
  /**
   * The bundling output directory includes a single .zip or .jar file which
   * will be used as the final bundle. If the output directory does not
   * include exactly a single archive, bundling will fail.
   */
  ARCHIVED = 'archived',

  /**
   * The bundling output directory contains one or more files which will be
   * archived and uploaded as a .zip file to S3.
   */
  NOT_ARCHIVED = 'not-archived',

  /**
   * If the bundling output directory contains a single archive file (zip or jar)
   * it will be used as the bundle output as-is. Otherwise all the files in the bundling output directory will be zipped.
   */
  AUTO_DISCOVER = 'auto-discover',
}

/**
 * Local bundling
 *
 * @experimental
 */
export interface ILocalBundling {
  /**
   * This method is called before attempting docker bundling to allow the
   * bundler to be executed locally. If the local bundler exists, and bundling
   * was performed locally, return `true`. Otherwise, return `false`.
   *
   * @param outputDir the directory where the bundled asset should be output
   * @param options bundling options for this asset
   */
  tryBundle(outputDir: string, options: BundlingOptions): boolean;
}

/**
 * A Docker image used for asset bundling
 *
 * @deprecated use DockerImage
 */
export class BundlingDockerImage {
  /**
   * Reference an image on DockerHub or another online registry.
   *
   * @param image the image name
   */
  public static fromRegistry(image: string) {
    return new DockerImage(image);
  }

  /**
   * Reference an image that's built directly from sources on disk.
   *
   * @param path The path to the directory containing the Docker file
   * @param options Docker build options
   *
   * @deprecated use DockerImage.fromBuild()
   */
  public static fromAsset(path: string, options: DockerBuildOptions = {}): BundlingDockerImage {
    return DockerImage.fromBuild(path, options);
  }

  /** @param image The Docker image */
  protected constructor(public readonly image: string, private readonly _imageHash?: string) {}

  /**
   * Provides a stable representation of this image for JSON serialization.
   *
   * @return The overridden image name if set or image hash name in that order
   */
  public toJSON() {
    return this._imageHash ?? this.image;
  }

  /**
   * Runs a Docker image
   */
  public run(options: DockerRunOptions = {}) {
    const volumes = options.volumes || [];
    const environment = options.environment || {};
    const entrypoint = options.entrypoint?.[0] || null;
    const command = [
      ...options.entrypoint?.[1]
        ? [...options.entrypoint.slice(1)]
        : [],
      ...options.command
        ? [...options.command]
        : [],
    ];

    const dockerArgs: string[] = [
      'run', '--rm',
      ...options.user
        ? ['-u', options.user]
        : [],
      ...flatten(volumes.map(v => ['-v', `${v.hostPath}:${v.containerPath}:${v.consistency ?? DockerVolumeConsistency.DELEGATED}`])),
      ...flatten(Object.entries(environment).map(([k, v]) => ['--env', `${k}=${v}`])),
      ...options.workingDirectory
        ? ['-w', options.workingDirectory]
        : [],
      ...entrypoint
        ? ['--entrypoint', entrypoint]
        : [],
      this.image,
      ...command,
    ];

    dockerExec(dockerArgs);
  }

  /**
   * Copies a file or directory out of the Docker image to the local filesystem.
   *
   * If `outputPath` is omitted the destination path is a temporary directory.
   *
   * @param imagePath the path in the Docker image
   * @param outputPath the destination path for the copy operation
   * @returns the destination path
   */
  public cp(imagePath: string, outputPath?: string): string {
    const { stdout } = dockerExec(['create', this.image], {}); // Empty options to avoid stdout redirect here
    const match = stdout.toString().match(/([0-9a-f]{16,})/);
    if (!match) {
      throw new Error('Failed to extract container ID from Docker create output');
    }

    const containerId = match[1];
    const containerPath = `${containerId}:${imagePath}`;
    const destPath = outputPath ?? FileSystem.mkdtemp('cdk-docker-cp-');
    try {
      dockerExec(['cp', containerPath, destPath]);
      return destPath;
    } catch (err) {
      throw new Error(`Failed to copy files from ${containerPath} to ${destPath}: ${err}`);
    } finally {
      dockerExec(['rm', '-v', containerId]);
    }
  }
}

/**
 * A Docker image
 */
export class DockerImage extends BundlingDockerImage {
  /**
   * Builds a Docker image
   *
   * @param path The path to the directory containing the Docker file
   * @param options Docker build options
   */
  public static fromBuild(path: string, options: DockerBuildOptions = {}) {
    const buildArgs = options.buildArgs || {};

    if (options.file && isAbsolute(options.file)) {
      throw new Error(`"file" must be relative to the docker build directory. Got ${options.file}`);
    }

    // Image tag derived from path and build options
    const input = JSON.stringify({ path, ...options });
    const tagHash = crypto.createHash('sha256').update(input).digest('hex');
    const tag = `cdk-${tagHash}`;

    const dockerArgs: string[] = [
      'build', '-t', tag,
      ...(options.file ? ['-f', join(path, options.file)] : []),
      ...flatten(Object.entries(buildArgs).map(([k, v]) => ['--build-arg', `${k}=${v}`])),
      path,
    ];

    dockerExec(dockerArgs);

    // Fingerprints the directory containing the Dockerfile we're building and
    // differentiates the fingerprint based on build arguments. We do this so
    // we can provide a stable image hash. Otherwise, the image ID will be
    // different every time the Docker layer cache is cleared, due primarily to
    // timestamps.
    const hash = FileSystem.fingerprint(path, { extraHash: JSON.stringify(options) });
    return new DockerImage(tag, hash);
  }

  /**
   * Reference an image on DockerHub or another online registry.
   *
   * @param image the image name
   */
  public static fromRegistry(image: string) {
    return new DockerImage(image);
  }

  /** @param image The Docker image */
  constructor(public readonly image: string, _imageHash?: string) {
    super(image, _imageHash);
  }

  /**
   * Provides a stable representation of this image for JSON serialization.
   *
   * @return The overridden image name if set or image hash name in that order
   */
  public toJSON() {
    return super.toJSON();
  }

  /**
   * Runs a Docker image
   */
  public run(options: DockerRunOptions = {}) {
    return super.run(options);
  }

  /**
   * Copies a file or directory out of the Docker image to the local filesystem.
   *
   * If `outputPath` is omitted the destination path is a temporary directory.
   *
   * @param imagePath the path in the Docker image
   * @param outputPath the destination path for the copy operation
   * @returns the destination path
   */
  public cp(imagePath: string, outputPath?: string): string {
    return super.cp(imagePath, outputPath);
  }
}

/**
 * A Docker volume
 */
export interface DockerVolume {
  /**
   * The path to the file or directory on the host machine
   */
  readonly hostPath: string;

  /**
   * The path where the file or directory is mounted in the container
   */
  readonly containerPath: string;

  /**
   * Mount consistency. Only applicable for macOS
   *
   * @default DockerConsistency.DELEGATED
   * @see https://docs.docker.com/storage/bind-mounts/#configure-mount-consistency-for-macos
   */
  readonly consistency?: DockerVolumeConsistency;
}

/**
 * Supported Docker volume consistency types. Only valid on macOS due to the way file storage works on Mac
 */
export enum DockerVolumeConsistency {
  /**
   * Read/write operations inside the Docker container are applied immediately on the mounted host machine volumes
   */
  CONSISTENT = 'consistent',
  /**
   * Read/write operations on mounted Docker volumes are first written inside the container and then synchronized to the host machine
   */
  DELEGATED = 'delegated',
  /**
   * Read/write operations on mounted Docker volumes are first applied on the host machine and then synchronized to the container
   */
  CACHED = 'cached',
}

/**
 * Docker run options
 */
export interface DockerRunOptions {
  /**
   * The entrypoint to run in the container.
   *
   * @default - run the entrypoint defined in the image
   */
  readonly entrypoint?: string[];

  /**
   * The command to run in the container.
   *
   * @default - run the command defined in the image
   */
  readonly command?: string[];

  /**
   * Docker volumes to mount.
   *
   * @default - no volumes are mounted
   */
  readonly volumes?: DockerVolume[];

  /**
   * The environment variables to pass to the container.
   *
   * @default - no environment variables.
   */
  readonly environment?: { [key: string]: string; };

  /**
   * Working directory inside the container.
   *
   * @default - image default
   */
  readonly workingDirectory?: string;

  /**
   * The user to use when running the container.
   *
   * @default - root or image default
   */
  readonly user?: string;
}

/**
 * Docker build options
 */
export interface DockerBuildOptions {
  /**
   * Build args
   *
   * @default - no build args
   */
  readonly buildArgs?: { [key: string]: string };

  /**
   * Name of the Dockerfile, must relative to the docker build path.
   *
   * @default `Dockerfile`
   */
  readonly file?: string;
}

function flatten(x: string[][]) {
  return Array.prototype.concat([], ...x);
}

function dockerExec(args: string[], options?: SpawnSyncOptions) {
  const prog = process.env.CDK_DOCKER ?? 'docker';
  const proc = spawnSync(prog, args, options ?? {
    stdio: [ // show Docker output
      'ignore', // ignore stdio
      process.stderr, // redirect stdout to stderr
      'inherit', // inherit stderr
    ],
  });

  if (proc.error) {
    throw proc.error;
  }

  if (proc.status !== 0) {
    if (proc.stdout || proc.stderr) {
      throw new Error(`[Status ${proc.status}] stdout: ${proc.stdout?.toString().trim()}\n\n\nstderr: ${proc.stderr?.toString().trim()}`);
    }
    throw new Error(`${prog} exited with status ${proc.status}`);
  }

  return proc;
}
