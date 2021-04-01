import * as os from 'os';
import * as path from 'path';
import { AssetCode, Code, Runtime } from '@aws-cdk/aws-lambda';
import * as cdk from '@aws-cdk/core';
import { BundlingOptions } from './types';
import { exec, extractDependencies, findUp, getEsBuildVersion, LockFile } from './util';

const ESBUILD_VERSION = '0';

/**
 * Bundling properties
 */
export interface BundlingProps extends BundlingOptions {
  /**
   * Path to lock file
   */
  readonly depsLockFilePath: string;

  /**
   * Entry file
   */
  readonly entry: string;

  /**
   * The runtime of the lambda function
   */
  readonly runtime: Runtime;
}

/**
 * Bundling with esbuild
 */
export class Bundling implements cdk.BundlingOptions {
  /**
   * esbuild bundled Lambda asset code
   */
  public static bundle(options: BundlingProps): AssetCode {
    return Code.fromAsset(path.dirname(options.depsLockFilePath), {
      assetHashType: cdk.AssetHashType.OUTPUT,
      bundling: new Bundling(options),
    });
  }

  public static clearRunsLocallyCache(): void {
    this.runsLocally = undefined;
  }

  private static runsLocally?: boolean;

  // Core bundling options
  public readonly image: cdk.DockerImage;
  public readonly command: string[];
  public readonly environment?: { [key: string]: string };
  public readonly workingDirectory: string;
  public readonly local?: cdk.ILocalBundling;

  private readonly relativeEntryPath: string;
  private readonly relativeTsconfigPath?: string;
  private readonly externals: string[];

  constructor(private readonly props: BundlingProps) {
    Bundling.runsLocally = Bundling.runsLocally
      ?? getEsBuildVersion()?.startsWith(ESBUILD_VERSION)
      ?? false;

    const projectRoot = path.dirname(props.depsLockFilePath);
    this.relativeEntryPath = path.relative(projectRoot, path.resolve(props.entry));

    if (props.tsconfig) {
      this.relativeTsconfigPath = path.relative(projectRoot, path.resolve(props.tsconfig));
    }

    this.externals = [
      ...props.externalModules ?? ['aws-sdk'], // Mark aws-sdk as external by default (available in the runtime)
      ...props.nodeModules ?? [], // Mark the modules that we are going to install as externals also
    ];

    // Docker bundling
    const shouldBuildImage = props.forceDockerBundling || !Bundling.runsLocally;
    this.image = shouldBuildImage
      ? props.dockerImage ?? cdk.DockerImage.fromBuild(path.join(__dirname, '../lib'), {
        buildArgs: {
          ...props.buildArgs ?? {},
          IMAGE: props.runtime.bundlingDockerImage.image,
          ESBUILD_VERSION: props.esbuildVersion ?? ESBUILD_VERSION,
        },
      })
      : cdk.DockerImage.fromRegistry('dummy'); // Do not build if we don't need to

    const bundlingCommand = this.createBundlingCommand(cdk.AssetStaging.BUNDLING_INPUT_DIR, cdk.AssetStaging.BUNDLING_OUTPUT_DIR);
    this.command = ['bash', '-c', bundlingCommand];
    this.environment = props.environment;
    // Bundling sets the working directory to cdk.AssetStaging.BUNDLING_INPUT_DIR
    // and we want to force npx to use the globally installed esbuild.
    this.workingDirectory = '/';

    // Local bundling
    if (!props.forceDockerBundling) { // only if Docker is not forced
      const osPlatform = os.platform();
      const createLocalCommand = (outputDir: string) => this.createBundlingCommand(projectRoot, outputDir, osPlatform);

      this.local = {
        tryBundle(outputDir: string) {
          if (Bundling.runsLocally === false) {
            process.stderr.write('esbuild cannot run locally. Switching to Docker bundling.\n');
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
              env: { ...process.env, ...props.environment ?? {} },
              stdio: [ // show output
                'ignore', // ignore stdio
                process.stderr, // redirect stdout to stderr
                'inherit', // inherit stderr
              ],
              cwd: path.dirname(props.entry),
              windowsVerbatimArguments: osPlatform === 'win32',
            });

          return true;
        },
      };
    }
  }

  public createBundlingCommand(inputDir: string, outputDir: string, osPlatform: NodeJS.Platform = 'linux'): string {
    const pathJoin = osPathJoin(osPlatform);

    const npx = osPlatform === 'win32' ? 'npx.cmd' : 'npx';
    const loaders = Object.entries(this.props.loader ?? {});
    const defines = Object.entries(this.props.define ?? {});

    const esbuildCommand: string = [
      npx, 'esbuild',
      '--bundle', `"${pathJoin(inputDir, this.relativeEntryPath)}"`,
      `--target=${this.props.target ?? toTarget(this.props.runtime)}`,
      '--platform=node',
      `--outfile="${pathJoin(outputDir, 'index.js')}"`,
      ...this.props.minify ? ['--minify'] : [],
      ...this.props.sourceMap ? ['--sourcemap'] : [],
      ...this.externals.map(external => `--external:${external}`),
      ...loaders.map(([ext, name]) => `--loader:${ext}=${name}`),
      ...defines.map(([key, value]) => `--define:${key}=${value}`),
      ...this.props.logLevel ? [`--log-level=${this.props.logLevel}`] : [],
      ...this.props.keepNames ? ['--keep-names'] : [],
      ...this.relativeTsconfigPath ? [`--tsconfig=${pathJoin(inputDir, this.relativeTsconfigPath)}`] : [],
      ...this.props.metafile ? [`--metafile=${pathJoin(outputDir, 'index.meta.json')}`] : [],
      ...this.props.banner ? [`--banner='${this.props.banner}'`] : [],
      ...this.props.footer ? [`--footer='${this.props.footer}'`] : [],
    ].join(' ');

    let depsCommand = '';
    if (this.props.nodeModules) {
      // Find 'package.json' closest to entry folder, we are going to extract the
      // modules versions from it.
      const pkgPath = findUp('package.json', path.dirname(this.props.entry));
      if (!pkgPath) {
        throw new Error('Cannot find a `package.json` in this project. Using `nodeModules` requires a `package.json`.');
      }

      // Determine dependencies versions, lock file and installer
      const dependencies = extractDependencies(pkgPath, this.props.nodeModules);
      let installer = Installer.NPM;
      let lockFile = LockFile.NPM;
      if (this.props.depsLockFilePath.endsWith(LockFile.YARN)) {
        lockFile = LockFile.YARN;
        installer = Installer.YARN;
      }

      const osCommand = new OsCommand(osPlatform);

      // Create dummy package.json, copy lock file if any and then install
      depsCommand = chain([
        osCommand.writeJson(pathJoin(outputDir, 'package.json'), { dependencies }),
        osCommand.copy(pathJoin(inputDir, lockFile), pathJoin(outputDir, lockFile)),
        osCommand.changeDirectory(outputDir),
        `${installer} install`,
      ]);
    }

    return chain([
      ...this.props.commandHooks?.beforeBundling(inputDir, outputDir) ?? [],
      esbuildCommand,
      ...(this.props.nodeModules && this.props.commandHooks?.beforeInstall(inputDir, outputDir)) ?? [],
      depsCommand,
      ...this.props.commandHooks?.afterBundling(inputDir, outputDir) ?? [],
    ]);
  }
}

enum Installer {
  NPM = 'npm',
  YARN = 'yarn',
}

/**
 * OS agnostic command
 */
class OsCommand {
  constructor(private readonly osPlatform: NodeJS.Platform) {}

  public writeJson(filePath: string, data: any): string {
    const stringifiedData = JSON.stringify(data);
    if (this.osPlatform === 'win32') {
      return `echo ^${stringifiedData}^ > ${filePath}`;
    }

    return `echo '${stringifiedData}' > ${filePath}`;
  }

  public copy(src: string, dest: string): string {
    if (this.osPlatform === 'win32') {
      return `copy ${src} ${dest}`;
    }

    return `cp ${src} ${dest}`;
  }

  public changeDirectory(dir: string): string {
    return `cd ${dir}`;
  }
}

/**
 * Chain commands
 */
function chain(commands: string[]): string {
  return commands.filter(c => !!c).join(' && ');
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

/**
 * Converts a runtime to an esbuild node target
 */
function toTarget(runtime: Runtime): string {
  const match = runtime.name.match(/nodejs(\d+)/);

  if (!match) {
    throw new Error('Cannot extract version from runtime.');
  }

  return `node${match[1]}`;
}
