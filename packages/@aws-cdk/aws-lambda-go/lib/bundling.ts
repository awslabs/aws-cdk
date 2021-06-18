import * as os from 'os';
import * as path from 'path';
import { AssetCode, Code, Runtime } from '@aws-cdk/aws-lambda';
import * as cdk from '@aws-cdk/core';
import { BundlingOptions } from './types';
import { exec, findUp, getGoBuildVersion } from './util';

/**
 * Options for bundling
 */
export interface BundlingProps extends BundlingOptions {
  /**
   * Directory containing your go.mod file
   *
   * This will accept either a directory path containing a `go.mod` file
   * or a filepath to your `go.mod` file (i.e. `path/to/go.mod`).
   *
   * This will be used as the source of the volume mounted in the Docker
   * container and will be the directory where it will run `go build` from.
   *
   * @default - the path is found by walking up parent directories searching for
   *  a `go.mod` file from the location of `entry`
   */
  readonly moduleDir: string;

  /**
   * The path to the folder or file that contains the main application entry point files for the project.
   *
   * This accepts either a path to a directory or file.
   *
   * If a directory path is provided then it will assume there is a Go entry file (i.e. `main.go`) and
   * will construct the build command using the directory path.
   *
   * For example, if you provide the entry as:
   *
   *     entry: 'my-lambda-app/cmd/api'
   *
   * Then the `go build` command would be:
   *
   *     `go build ./cmd/api`
   *
   * If a path to a file is provided then it will use the filepath in the build command.
   *
   * For example, if you provide the entry as:
   *
   *     entry: 'my-lambda-app/cmd/api/main.go'
   *
   * Then the `go build` command would be:
   *
   *     `go build ./cmd/api/main.go`
   */
  readonly entry: string;

  /**
   * The runtime of the lambda function
   */
  readonly runtime: Runtime;
}

/**
 * Bundling
 */
export class Bundling implements cdk.BundlingOptions {
  public static bundle(options: BundlingProps): AssetCode {
    const bundling = new Bundling(options);

    return Code.fromAsset(path.dirname(options.moduleDir), {
      assetHashType: options.assetHashType ?? cdk.AssetHashType.OUTPUT,
      assetHash: options.assetHash,
      bundling: {
        image: bundling.image,
        command: bundling.command,
        environment: bundling.environment,
        local: bundling.local,
      },
    });
  }

  public static clearRunsLocallyCache(): void { // for tests
    this.runsLocally = undefined;
  }

  private static runsLocally?: boolean;

  // Core bundling options
  public readonly image: cdk.DockerImage;
  public readonly command: string[];
  public readonly environment?: { [key: string]: string };
  public readonly local?: cdk.ILocalBundling;

  private readonly relativeEntryPath: string;

  constructor(private readonly props: BundlingProps) {
    Bundling.runsLocally = Bundling.runsLocally
      ?? getGoBuildVersion()
      ?? false;

    const projectRoot = path.dirname(props.moduleDir);
    this.relativeEntryPath = `./${path.relative(projectRoot, path.resolve(props.entry))}`;

    const cgoEnabled = props.cgoEnabled ? '1' : '0';

    const environment = {
      CGO_ENABLED: cgoEnabled,
      GO111MODULE: 'on',
      GOARCH: 'amd64',
      GOOS: 'linux',
      ...props.environment,
    };

    // Docker bundling
    const shouldBuildImage = props.forcedDockerBundling || !Bundling.runsLocally;
    this.image = shouldBuildImage
      ? props.dockerImage ?? cdk.DockerImage.fromBuild(path.join(__dirname, '../lib'), {
        buildArgs: {
          ...props.buildArgs ?? {},
          IMAGE: Runtime.GO_1_X.bundlingImage.image, // always use the GO_1_X build image
        },
      })
      : cdk.DockerImage.fromRegistry('dummy'); // Do not build if we don't need to

    const bundlingCommand = this.createBundlingCommand(cdk.AssetStaging.BUNDLING_INPUT_DIR, cdk.AssetStaging.BUNDLING_OUTPUT_DIR);
    this.command = ['bash', '-c', bundlingCommand];
    this.environment = environment;

    // Local bundling
    if (!props.forcedDockerBundling) { // only if Docker is not forced
      const osPlatform = os.platform();
      const createLocalCommand = (outputDir: string) => this.createBundlingCommand(projectRoot, outputDir, osPlatform);

      this.local = {
        tryBundle(outputDir: string) {
          if (Bundling.runsLocally == false) {
            process.stderr.write('go build cannot run locally. Switching to Docker bundling.\n');
            return false;
          }

          const localCommand = createLocalCommand(outputDir);
          exec(
            osPlatform === 'win32' ? 'cmd' : 'bash',
            [
              osPlatform === 'win32' ? '/c' : '-c',
              localCommand,
            ],
            {
              env: { ...process.env, ...environment ?? {} },
              stdio: [ // show output
                'ignore', // ignore stdio
                process.stderr, // redirect stdout to stderr
                'inherit', // inherit stderr
              ],
              cwd: path.dirname(props.moduleDir),
              windowsVerbatimArguments: osPlatform === 'win32',
            },
          );
          return true;
        },
      };
    }
  }

  public createBundlingCommand(inputDir: string, outputDir: string, osPlatform: NodeJS.Platform = 'linux'): string {
    const pathJoin = osPathJoin(osPlatform);

    const hasVendor = findUp('vendor', path.dirname(this.props.entry));

    const goBuildCommand: string = [
      'go', 'build',
      hasVendor ? '-mod=vendor': '',
      '-o', `${pathJoin(outputDir, 'bootstrap')}`,
      `${this.props.goBuildFlags ? this.props.goBuildFlags.join(' ') : ''}`,
      `${this.relativeEntryPath.replace(/\\/g, '/')}`,
    ].filter(c => !!c).join(' ');

    return chain([
      ...this.props.commandHooks?.beforeBundling(inputDir, outputDir) ?? [],
      goBuildCommand,
      ...this.props.commandHooks?.afterBundling(inputDir, outputDir) ?? [],
    ]);
  }
}

/**
 * Platform specific path join
 */
function osPathJoin(platform: NodeJS.Platform) {
  return function(...paths: string[]): string {
    const joined = path.join(...paths);
    // If we are on win32 but need posix style paths
    if (os.platform() === 'win32' && platform !== 'win32') {
      return joined.replace(/\\/g, '/');
    }
    return joined;
  };
}

function chain(commands: string[]): string {
  return commands.filter(c => !!c).join(' && ');
}
