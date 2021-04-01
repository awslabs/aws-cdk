import { DockerImage } from '@aws-cdk/core';

/**
 * Bundling options
 */
export interface BundlingOptions {
  /**
   * Whether to minify files when bundling.
   *
   * @default false
   */
  readonly minify?: boolean;

  /**
   * Whether to include source maps when bundling.
   *
   * @default false
   */
  readonly sourceMap?: boolean;

  /**
   * Target environment for the generated JavaScript code.
   *
   * @see https://esbuild.github.io/api/#target
   *
   * @default - the node version of the runtime
   */
  readonly target?: string;

  /**
   * Use loaders to change how a given input file is interpreted.
   *
   * Configuring a loader for a given file type lets you load that file type with
   * an `import` statement or a `require` call.
   *
   * @see https://esbuild.github.io/api/#loader
   *
   * @example { '.png': 'dataurl' }
   *
   * @default - use esbuild default loaders
   */
  readonly loader?: { [ext: string]: string };

  /**
   * Log level for esbuild
   *
   * @default LogLevel.WARNING
   */
  readonly logLevel?: LogLevel;

  /**
   * Whether to preserve the original `name` values even in minified code.
   *
   * In JavaScript the `name` property on functions and classes defaults to a
   * nearby identifier in the source code.
   *
   * However, minification renames symbols to reduce code size and bundling
   * sometimes need to rename symbols to avoid collisions. That changes value of
   * the `name` property for many of these cases. This is usually fine because
   * the `name` property is normally only used for debugging. However, some
   * frameworks rely on the `name` property for registration and binding purposes.
   * If this is the case, you can enable this option to preserve the original
   * `name` values even in minified code.
   *
   * @default false
   */
  readonly keepNames?: boolean;

  /**
   * Normally the esbuild automatically discovers `tsconfig.json` files and reads their contents during a build.
   *
   * However, you can also configure a custom `tsconfig.json` file to use instead.
   *
   * This is similar to entry path, you need to provide path to your custom `tsconfig.json`.
   *
   * This can be useful if you need to do multiple builds of the same code with different settings.
   *
   * @example { 'tsconfig': 'path/custom.tsconfig.json' }
   *
   * @default - automatically discovered by `esbuild`
   */
  readonly tsconfig? : string

  /**
   * This option tells esbuild to write out a JSON file relative to output directory with metadata about the build.
   *
   * The metadata in this JSON file follows this schema (specified using TypeScript syntax):
   *
   * ```typescript
   *  {
   *     outputs: {
   *          [path: string]: {
   *            bytes: number
   *            inputs: {
   *              [path: string]: { bytesInOutput: number }
   *            }
   *            imports: { path: string }[]
   *            exports: string[]
   *          }
   *        }
   *     }
   * }
   * ```
   * This data can then be analyzed by other tools. For example,
   * bundle buddy can consume esbuild's metadata format and generates a treemap visualization
   * of the modules in your bundle and how much space each one takes up.
   * @see https://esbuild.github.io/api/#metafile
   * @default - false
   */
  readonly metafile?: boolean

  /**
   * Use this to insert an arbitrary string at the beginning of generated JavaScript files.
   *
   * This is similar to footer which inserts at the end instead of the beginning.
   *
   * This is commonly used to insert comments:
   *
   * @default -  no comments are passed
   */
  readonly banner? : string

  /**
   * Use this to insert an arbitrary string at the end of generated JavaScript files.
   *
   * This is similar to banner which inserts at the beginning instead of the end.
   *
   * This is commonly used to insert comments
   *
   * @default -  no comments are passed
   */
  readonly footer? : string

  /**
   * Environment variables defined when bundling runs.
   *
   * @default - no environment variables are defined.
   */
  readonly environment?: { [key: string]: string; };

  /**
   * Replace global identifiers with constant expressions.
   *
   * @example { 'process.env.DEBUG': 'true' }
   * @example { 'process.env.API_KEY': JSON.stringify('xxx-xxxx-xxx') }
   *
   * @default - no replacements are made
   */
  readonly define?: { [key: string]: string };

  /**
   * A list of modules that should be considered as externals (already available
   * in the runtime).
   *
   * @default ['aws-sdk']
   */
  readonly externalModules?: string[];

  /**
   * A list of modules that should be installed instead of bundled. Modules are
   * installed in a Lambda compatible environment only when bundling runs in
   * Docker.
   *
   * @default - all modules are bundled
   */
  readonly nodeModules?: string[];

  /**
   * The version of esbuild to use when running in a Docker container.
   *
   * @default - latest v0
   */
  readonly esbuildVersion?: string;

  /**
   * Build arguments to pass when building the bundling image.
   *
   * @default - no build arguments are passed
   */
  readonly buildArgs?: { [key:string] : string };

  /**
   * Force bundling in a Docker container even if local bundling is
   * possible. This is useful if your function relies on node modules
   * that should be installed (`nodeModules`) in a Lambda compatible
   * environment.
   *
   * @default false
   */
  readonly forceDockerBundling?: boolean;

  /**
   * A custom bundling Docker image.
   *
   * This image should have esbuild installed globally. If you plan to use `nodeModules`
   * it should also have `npm` or `yarn` depending on the lock file you're using.
   *
   * See https://github.com/aws/aws-cdk/blob/master/packages/%40aws-cdk/aws-lambda-nodejs/lib/Dockerfile
   * for the default image provided by @aws-cdk/aws-lambda-nodejs.
   *
   * @default - use the Docker image provided by @aws-cdk/aws-lambda-nodejs
   */
  readonly dockerImage?: DockerImage;

  /**
   * Command hooks
   *
   * @default - do not run additional commands
   */
  readonly commandHooks?: ICommandHooks;
}

/**
 * Command hooks
 *
 * These commands will run in the environment in which bundling occurs: inside
 * the container for Docker bundling or on the host OS for local bundling.
 *
 * Commands are chained with `&&`.
 *
 * @example
 * {
 *   // Copy a file from the input directory to the output directory
 *   // to include it in the bundled asset
 *   afterBundling(inputDir: string, outputDir: string): string[] {
 *     return [`cp ${inputDir}/my-binary.node ${outputDir}`];
 *   }
 *   // ...
 * }
 */
export interface ICommandHooks {
  /**
   * Returns commands to run before bundling.
   *
   * Commands are chained with `&&`.
   */
  beforeBundling(inputDir: string, outputDir: string): string[];

  /**
   * Returns commands to run before installing node modules.
   *
   * This hook only runs when node modules are installed.
   *
   * Commands are chained with `&&`.
   */
  beforeInstall(inputDir: string, outputDir: string): string[];

  /**
   * Returns commands to run after bundling.
   *
   * Commands are chained with `&&`.
   */
  afterBundling(inputDir: string, outputDir: string): string[];
}

/**
 * Log level for esbuild
 */
export enum LogLevel {
  /** Show everything */
  INFO = 'info',
  /** Show warnings and errors */
  WARNING = 'warning',
  /** Show errors only */
  ERROR = 'error',
  /** Show nothing */
  SILENT = 'silent',
}
