import * as childProcess from 'child_process';
import * as path from 'path';
import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import * as cxapi from '@aws-cdk/cx-api';
import * as fs from 'fs-extra';
import { debug } from '../../logging';
import { Configuration, PROJECT_CONFIG, USER_DEFAULTS } from '../../settings';
import { versionNumber } from '../../version';
import { SdkProvider } from '../aws-auth';

/** Invokes the cloud executable and returns JSON output */
export async function execProgram(aws: SdkProvider, config: Configuration): Promise<cxapi.CloudAssembly> {
  const env: { [key: string]: string } = { };

  const context = config.context.all;
  await populateDefaultEnvironmentIfNeeded(aws, env);

  const debugMode: boolean = config.settings.get(['debug']) ?? true;
  if (debugMode) {
    env.CDK_DEBUG = 'true';
  }

  const pathMetadata: boolean = config.settings.get(['pathMetadata']) ?? true;
  if (pathMetadata) {
    context[cxapi.PATH_METADATA_ENABLE_CONTEXT] = true;
  }

  const assetMetadata: boolean = config.settings.get(['assetMetadata']) ?? true;
  if (assetMetadata) {
    context[cxapi.ASSET_RESOURCE_METADATA_ENABLED_CONTEXT] = true;
  }

  const versionReporting: boolean = config.settings.get(['versionReporting']) ?? true;
  if (versionReporting) { context[cxapi.ANALYTICS_REPORTING_ENABLED_CONTEXT] = true; }
  // We need to keep on doing this for framework version from before this flag was deprecated.
  if (!versionReporting) { context['aws:cdk:disable-version-reporting'] = true; }

  const stagingEnabled = config.settings.get(['staging']) ?? true;
  if (!stagingEnabled) {
    context[cxapi.DISABLE_ASSET_STAGING_CONTEXT] = true;
  }

  const bundlingStacks = config.settings.get(['bundlingStacks']) ?? ['*'];
  context[cxapi.BUNDLING_STACKS] = bundlingStacks;

  debug('context:', context);
  env[cxapi.CONTEXT_ENV] = JSON.stringify(context);

  const app = config.settings.get(['app']);
  if (!app) {
    throw new Error(`--app is required either in command-line, in ${PROJECT_CONFIG} or in ${USER_DEFAULTS}`);
  }

  // bypass "synth" if app points to a cloud assembly
  if (await fs.pathExists(app) && (await fs.stat(app)).isDirectory()) {
    debug('--app points to a cloud assembly, so we bypass synth');
    return createAssembly(app);
  }

  const commandLine = await guessExecutable(appToArray(app));

  const outdir = config.settings.get(['output']);
  if (!outdir) {
    throw new Error('unexpected: --output is required');
  }
  await fs.mkdirp(outdir);

  debug('outdir:', outdir);
  env[cxapi.OUTDIR_ENV] = outdir;

  // Send version information
  env[cxapi.CLI_ASM_VERSION_ENV] = cxschema.Manifest.version();
  env[cxapi.CLI_VERSION_ENV] = versionNumber();

  debug('env:', env);

  await exec();

  return createAssembly(outdir);

  function createAssembly(appDir: string) {
    try {
      return new cxapi.CloudAssembly(appDir);
    } catch (error) {
      if (error instanceof cxschema.VersionMismatchError) {
        // this means the CLI version is too old.
        // we instruct the user to upgrade.
        throw new Error('This CDK CLI is not compatible with the CDK library used by your application. Please upgrade the CLI to the latest version.');
      }
      throw error;
    }
  }

  async function exec() {
    return new Promise<void>((ok, fail) => {
      // We use a slightly lower-level interface to:
      //
      // - Pass arguments in an array instead of a string, to get around a
      //   number of quoting issues introduced by the intermediate shell layer
      //   (which would be different between Linux and Windows).
      //
      // - Inherit stderr from controlling terminal. We don't use the captured value
      //   anyway, and if the subprocess is printing to it for debugging purposes the
      //   user gets to see it sooner. Plus, capturing doesn't interact nicely with some
      //   processes like Maven.
      const proc = childProcess.spawn(commandLine[0], commandLine.slice(1), {
        stdio: ['ignore', 'inherit', 'inherit'],
        detached: false,
        shell: true,
        env: {
          ...process.env,
          ...env,
        },
      });

      proc.on('error', fail);

      proc.on('exit', code => {
        if (code === 0) {
          return ok();
        } else {
          return fail(new Error(`Subprocess exited with error ${code}`));
        }
      });
    });
  }
}

/**
 * If we don't have region/account defined in context, we fall back to the default SDK behavior
 * where region is retrieved from ~/.aws/config and account is based on default credentials provider
 * chain and then STS is queried.
 *
 * This is done opportunistically: for example, if we can't access STS for some reason or the region
 * is not configured, the context value will be 'null' and there could failures down the line. In
 * some cases, synthesis does not require region/account information at all, so that might be perfectly
 * fine in certain scenarios.
 *
 * @param context The context key/value bash.
 */
async function populateDefaultEnvironmentIfNeeded(aws: SdkProvider, env: { [key: string]: string | undefined}) {
  env[cxapi.DEFAULT_REGION_ENV] = aws.defaultRegion;
  debug(`Setting "${cxapi.DEFAULT_REGION_ENV}" environment variable to`, env[cxapi.DEFAULT_REGION_ENV]);

  const accountId = (await aws.defaultAccount())?.accountId;
  if (accountId) {
    env[cxapi.DEFAULT_ACCOUNT_ENV] = accountId;
    debug(`Setting "${cxapi.DEFAULT_ACCOUNT_ENV}" environment variable to`, env[cxapi.DEFAULT_ACCOUNT_ENV]);
  }
}

/**
 * Make sure the 'app' is an array
 *
 * If it's a string, split on spaces as a trivial way of tokenizing the command line.
 */
function appToArray(app: any) {
  return typeof app === 'string' ? app.split(' ') : app;
}

type CommandGenerator = (file: string) => string[];

/**
 * Execute the given file with the same 'node' process as is running the current process
 */
function executeNode(scriptFile: string): string[] {
  return [process.execPath, scriptFile];
}

/**
 * Mapping of extensions to command-line generators
 */
const EXTENSION_MAP = new Map<string, CommandGenerator>([
  ['.js', executeNode],
]);

/**
 * Guess the executable from the command-line argument
 *
 * Only do this if the file is NOT marked as executable. If it is,
 * we'll defer to the shebang inside the file itself.
 *
 * If we're on Windows, we ALWAYS take the handler, since it's hard to
 * verify if registry associations have or have not been set up for this
 * file type, so we'll assume the worst and take control.
 */
async function guessExecutable(commandLine: string[]) {
  if (commandLine.length === 1) {
    let fstat;

    try {
      fstat = await fs.stat(commandLine[0]);
    } catch (error) {
      debug(`Not a file: '${commandLine[0]}'. Using '${commandLine}' as command-line`);
      return commandLine;
    }

    // eslint-disable-next-line no-bitwise
    const isExecutable = (fstat.mode & fs.constants.X_OK) !== 0;
    const isWindows = process.platform === 'win32';

    const handler = EXTENSION_MAP.get(path.extname(commandLine[0]));
    if (handler && (!isExecutable || isWindows)) {
      return handler(commandLine[0]);
    }
  }
  return commandLine;
}
