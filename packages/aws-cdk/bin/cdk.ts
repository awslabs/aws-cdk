#!/usr/bin/env node
import 'source-map-support/register';
import * as cxapi from '@aws-cdk/cx-api';
import * as colors from 'colors/safe';
import * as yargs from 'yargs';

import { SdkProvider } from '../lib/api/aws-auth';
import { BootstrapSource, Bootstrapper } from '../lib/api/bootstrap';
import { CloudFormationDeployments } from '../lib/api/cloudformation-deployments';
import { StackSelector } from '../lib/api/cxapp/cloud-assembly';
import { CloudExecutable } from '../lib/api/cxapp/cloud-executable';
import { execProgram } from '../lib/api/cxapp/exec';
import { ToolkitInfo } from '../lib/api/toolkit-info';
import { StackActivityProgress } from '../lib/api/util/cloudformation/stack-activity-monitor';
import { CdkToolkit } from '../lib/cdk-toolkit';
import { RequireApproval } from '../lib/diff';
import { availableInitLanguages, cliInit, printAvailableTemplates } from '../lib/init';
import { data, debug, error, print, setLogLevel } from '../lib/logging';
import { PluginHost } from '../lib/plugin';
import { serializeStructure } from '../lib/serialize';
import { Command, Configuration, Settings } from '../lib/settings';
import * as version from '../lib/version';

/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/no-shadow */ // yargs

async function parseCommandLineArguments() {
  // Use the following configuration for array arguments:
  //
  //     { type: 'array', default: [], nargs: 1, requiresArg: true }
  //
  // The default behavior of yargs is to eat all strings following an array argument:
  //
  //   ./prog --arg one two positional  => will parse to { arg: ['one', 'two', 'positional'], _: [] } (so no positional arguments)
  //   ./prog --arg one two -- positional  => does not help, for reasons that I can't understand. Still gets parsed incorrectly.
  //
  // By using the config above, every --arg will only consume one argument, so you can do the following:
  //
  //   ./prog --arg one --arg two position  =>  will parse to  { arg: ['one', 'two'], _: ['positional'] }.

  const initTemplateLanguages = await availableInitLanguages();
  return yargs
    .env('CDK')
    .usage('Usage: cdk -a <cdk-app> COMMAND')
    .option('app', { type: 'string', alias: 'a', desc: 'REQUIRED: command-line for executing your app or a cloud assembly directory (e.g. "node bin/my-app.js")', requiresArg: true })
    .option('context', { type: 'array', alias: 'c', desc: 'Add contextual string parameter (KEY=VALUE)', nargs: 1, requiresArg: true })
    .option('plugin', { type: 'array', alias: 'p', desc: 'Name or path of a node package that extend the CDK features. Can be specified multiple times', nargs: 1 })
    .option('trace', { type: 'boolean', desc: 'Print trace for stack warnings' })
    .option('strict', { type: 'boolean', desc: 'Do not construct stacks with warnings' })
    .option('lookups', { type: 'boolean', desc: 'Perform context lookups (synthesis fails if this is disabled and context lookups need to be performed)', default: true })
    .option('ignore-errors', { type: 'boolean', default: false, desc: 'Ignores synthesis errors, which will likely produce an invalid output' })
    .option('json', { type: 'boolean', alias: 'j', desc: 'Use JSON output instead of YAML when templates are printed to STDOUT', default: false })
    .option('verbose', { type: 'boolean', alias: 'v', desc: 'Show debug logs (specify multiple times to increase verbosity)', default: false })
    .count('verbose')
    .option('debug', { type: 'boolean', desc: 'Enable emission of additional debugging information, such as creation stack traces of tokens', default: false })
    .option('profile', { type: 'string', desc: 'Use the indicated AWS profile as the default environment', requiresArg: true })
    .option('proxy', { type: 'string', desc: 'Use the indicated proxy. Will read from HTTPS_PROXY environment variable if not specified', requiresArg: true })
    .option('ca-bundle-path', { type: 'string', desc: 'Path to CA certificate to use when validating HTTPS requests. Will read from AWS_CA_BUNDLE environment variable if not specified', requiresArg: true })
    .option('ec2creds', { type: 'boolean', alias: 'i', default: undefined, desc: 'Force trying to fetch EC2 instance credentials. Default: guess EC2 instance status' })
    .option('version-reporting', { type: 'boolean', desc: 'Include the "AWS::CDK::Metadata" resource in synthesized templates (enabled by default)', default: undefined })
    .option('path-metadata', { type: 'boolean', desc: 'Include "aws:cdk:path" CloudFormation metadata for each resource (enabled by default)', default: true })
    .option('asset-metadata', { type: 'boolean', desc: 'Include "aws:asset:*" CloudFormation metadata for resources that uses assets (enabled by default)', default: true })
    .option('role-arn', { type: 'string', alias: 'r', desc: 'ARN of Role to use when invoking CloudFormation', default: undefined, requiresArg: true })
    .option('toolkit-stack-name', { type: 'string', desc: 'The name of the CDK toolkit stack', requiresArg: true })
    .option('staging', { type: 'boolean', desc: 'Copy assets to the output directory (use --no-staging to disable, needed for local debugging the source files with SAM CLI)', default: true })
    .option('output', { type: 'string', alias: 'o', desc: 'Emits the synthesized cloud assembly into a directory (default: cdk.out)', requiresArg: true })
    .option('no-color', { type: 'boolean', desc: 'Removes colors and other style from console output', default: false })
    .command(['list [STACKS..]', 'ls [STACKS..]'], 'Lists all stacks in the app', yargs => yargs
      .option('long', { type: 'boolean', default: false, alias: 'l', desc: 'Display environment information for each stack' }),
    )
    .command(['synthesize [STACKS..]', 'synth [STACKS..]'], 'Synthesizes and prints the CloudFormation template for this stack', yargs => yargs
      .option('exclusively', { type: 'boolean', alias: 'e', desc: 'Only synthesize requested stacks, don\'t include dependencies' })
      .option('validation', { type: 'boolean', desc: 'After synthesis, validate stacks with the "validateOnSynth" attribute set (can also be controlled with CDK_VALIDATION)', default: true })
      .option('quiet', { type: 'boolean', alias: 'q', desc: 'Do not output CloudFormation Template to stdout', default: false }))
    .command('bootstrap [ENVIRONMENTS..]', 'Deploys the CDK toolkit stack into an AWS environment', yargs => yargs
      .option('bootstrap-bucket-name', { type: 'string', alias: ['b', 'toolkit-bucket-name'], desc: 'The name of the CDK toolkit bucket; bucket will be created and must not exist', default: undefined })
      .option('bootstrap-kms-key-id', { type: 'string', desc: 'AWS KMS master key ID used for the SSE-KMS encryption', default: undefined, conflicts: 'bootstrap-customer-key' })
      .option('bootstrap-customer-key', { type: 'boolean', desc: 'Create a Customer Master Key (CMK) for the bootstrap bucket (you will be charged but can customize permissions, modern bootstrapping only)', default: undefined, conflicts: 'bootstrap-kms-key-id' })
      .option('qualifier', { type: 'string', desc: 'Unique string to distinguish multiple bootstrap stacks', default: undefined })
      .option('public-access-block-configuration', { type: 'boolean', desc: 'Block public access configuration on CDK toolkit bucket (enabled by default) ', default: undefined })
      .option('tags', { type: 'array', alias: 't', desc: 'Tags to add for the stack (KEY=VALUE)', nargs: 1, requiresArg: true, default: [] })
      .option('execute', { type: 'boolean', desc: 'Whether to execute ChangeSet (--no-execute will NOT execute the ChangeSet)', default: true })
      .option('trust', { type: 'array', desc: 'The AWS account IDs that should be trusted to perform deployments into this environment (may be repeated, modern bootstrapping only)', default: [], nargs: 1, requiresArg: true })
      .option('trust-for-lookup', { type: 'array', desc: 'The AWS account IDs that should be trusted to look up values in this environment (may be repeated, modern bootstrapping only)', default: [], nargs: 1, requiresArg: true })
      .option('cloudformation-execution-policies', { type: 'array', desc: 'The Managed Policy ARNs that should be attached to the role performing deployments into this environment (may be repeated, modern bootstrapping only)', default: [], nargs: 1, requiresArg: true })
      .option('force', { alias: 'f', type: 'boolean', desc: 'Always bootstrap even if it would downgrade template version', default: false })
      .option('termination-protection', { type: 'boolean', default: undefined, desc: 'Toggle CloudFormation termination protection on the bootstrap stacks' })
      .option('show-template', { type: 'boolean', desc: 'Instead of actual bootstrapping, print the current CLI\'s bootstrapping template to stdout for customization', default: false })
      .option('template', { type: 'string', requiresArg: true, desc: 'Use the template from the given file instead of the built-in one (use --show-template to obtain an example)' }),
    )
    .command('deploy [STACKS..]', 'Deploys the stack(s) named STACKS into your AWS account', yargs => yargs
      .option('all', { type: 'boolean', default: false, desc: 'Deploy all available stacks' })
      .option('build-exclude', { type: 'array', alias: 'E', nargs: 1, desc: 'Do not rebuild asset with the given ID. Can be specified multiple times', default: [] })
      .option('exclusively', { type: 'boolean', alias: 'e', desc: 'Only deploy requested stacks, don\'t include dependencies' })
      .option('require-approval', { type: 'string', choices: [RequireApproval.Never, RequireApproval.AnyChange, RequireApproval.Broadening], desc: 'What security-sensitive changes need manual approval' })
      .option('ci', { type: 'boolean', desc: 'Force CI detection', default: process.env.CI !== undefined })
      .option('notification-arns', { type: 'array', desc: 'ARNs of SNS topics that CloudFormation will notify with stack related events', nargs: 1, requiresArg: true })
      // @deprecated(v2) -- tags are part of the Cloud Assembly and tags specified here will be overwritten on the next deployment
      .option('tags', { type: 'array', alias: 't', desc: 'Tags to add to the stack (KEY=VALUE), overrides tags from Cloud Assembly (deprecated)', nargs: 1, requiresArg: true })
      .option('execute', { type: 'boolean', desc: 'Whether to execute ChangeSet (--no-execute will NOT execute the ChangeSet)', default: true })
      .option('change-set-name', { type: 'string', desc: 'Name of the CloudFormation change set to create' })
      .option('confirm-change-set', { type: 'boolean', desc: 'Prompt to confirm whether to deploy the change set', default: false })
      .option('force', { alias: 'f', type: 'boolean', desc: 'Always deploy stack even if templates are identical', default: false })
      .option('parameters', { type: 'array', desc: 'Additional parameters passed to CloudFormation at deploy time (STACK:KEY=VALUE)', nargs: 1, requiresArg: true, default: {} })
      .option('outputs-file', { type: 'string', alias: 'O', desc: 'Path to file where stack outputs will be written as JSON', requiresArg: true })
      .option('previous-parameters', { type: 'boolean', default: true, desc: 'Use previous values for existing parameters (you must specify all parameters on every deployment if this is disabled)' })
      .option('progress', { type: 'string', choices: [StackActivityProgress.BAR, StackActivityProgress.EVENTS], desc: 'Display mode for stack activity events' }),
    )
    .command('destroy [STACKS..]', 'Destroy the stack(s) named STACKS', yargs => yargs
      .option('all', { type: 'boolean', default: false, desc: 'Destroy all available stacks' })
      .option('exclusively', { type: 'boolean', alias: 'e', desc: 'Only destroy requested stacks, don\'t include dependees' })
      .option('force', { type: 'boolean', alias: 'f', desc: 'Do not ask for confirmation before destroying the stacks' }))
    .command('diff [STACKS..]', 'Compares the specified stack with the deployed stack or a local template file, and returns with status 1 if any difference is found', yargs => yargs
      .option('exclusively', { type: 'boolean', alias: 'e', desc: 'Only diff requested stacks, don\'t include dependencies' })
      .option('context-lines', { type: 'number', desc: 'Number of context lines to include in arbitrary JSON diff rendering', default: 3, requiresArg: true })
      .option('template', { type: 'string', desc: 'The path to the CloudFormation template to compare with', requiresArg: true })
      .option('strict', { type: 'boolean', desc: 'Do not filter out AWS::CDK::Metadata resources', default: false })
      .option('security-only', { type: 'boolean', desc: 'Only diff for broadened security changes', default: false }))
    .option('fail', { type: 'boolean', desc: 'Fail with exit code 1 in case of diff', default: false })
    .command('metadata [STACK]', 'Returns all metadata associated with this stack')
    .command('init [TEMPLATE]', 'Create a new, empty CDK project from a template.', yargs => yargs
      .option('language', { type: 'string', alias: 'l', desc: 'The language to be used for the new project (default can be configured in ~/.cdk.json)', choices: initTemplateLanguages })
      .option('list', { type: 'boolean', desc: 'List the available templates' })
      .option('generate-only', { type: 'boolean', default: false, desc: 'If true, only generates project files, without executing additional operations such as setting up a git repo, installing dependencies or compiling the project' }),
    )
    .commandDir('../lib/commands', { exclude: /^_.*/ })
    .version(version.DISPLAY_VERSION)
    .demandCommand(1, '') // just print help
    .recommendCommands()
    .help()
    .alias('h', 'help')
    .epilogue([
      'If your app has a single stack, there is no need to specify the stack name',
      'If one of cdk.json or ~/.cdk.json exists, options specified there will be used as defaults. Settings in cdk.json take precedence.',
    ].join('\n\n'))
    .argv;
}

if (!process.stdout.isTTY) {
  colors.disable();
}

async function initCommandLine() {
  const argv = await parseCommandLineArguments();
  if (argv.verbose) {
    setLogLevel(argv.verbose);
  }
  debug('CDK toolkit version:', version.DISPLAY_VERSION);
  debug('Command line arguments:', argv);

  const configuration = new Configuration({
    commandLineArguments: {
      ...argv,
      _: argv._ as [Command, ...string[]], // TypeScript at its best
    },
  });
  await configuration.load();

  const sdkProvider = await SdkProvider.withAwsCliCompatibleDefaults({
    profile: configuration.settings.get(['profile']),
    ec2creds: argv.ec2creds,
    httpOptions: {
      proxyAddress: argv.proxy,
      caBundlePath: argv['ca-bundle-path'],
    },
  });

  const cloudFormation = new CloudFormationDeployments({ sdkProvider });

  const cloudExecutable = new CloudExecutable({
    configuration,
    sdkProvider,
    synthesizer: execProgram,
  });

  /** Function to load plug-ins, using configurations additively. */
  function loadPlugins(...settings: Settings[]) {
    const loaded = new Set<string>();
    for (const source of settings) {
      const plugins: string[] = source.get(['plugin']) || [];
      for (const plugin of plugins) {
        const resolved = tryResolve(plugin);
        if (loaded.has(resolved)) { continue; }
        debug(`Loading plug-in: ${colors.green(plugin)} from ${colors.blue(resolved)}`);
        PluginHost.instance.load(plugin);
        loaded.add(resolved);
      }
    }

    function tryResolve(plugin: string): string {
      try {
        return require.resolve(plugin);
      } catch (e) {
        error(`Unable to resolve plugin ${colors.green(plugin)}: ${e.stack}`);
        throw new Error(`Unable to resolve plug-in: ${plugin}`);
      }
    }
  }

  loadPlugins(configuration.settings);

  const cmd = argv._[0];

  if (typeof(cmd) !== 'string') {
    throw new Error(`First argument should be a string. Got: ${cmd} (${typeof(cmd)})`);
  }

  // Bundle up global objects so the commands have access to them
  const commandOptions = { args: argv, configuration, aws: sdkProvider };

  try {
    const returnValue = argv.commandHandler
      ? await (argv.commandHandler as (opts: typeof commandOptions) => any)(commandOptions)
      : await main(cmd, argv);
    if (typeof returnValue === 'object') {
      return toJsonOrYaml(returnValue);
    } else if (typeof returnValue === 'string') {
      return returnValue;
    } else {
      return returnValue;
    }
  } finally {
    await version.displayVersionMessage();
  }

  async function main(command: string, args: any): Promise<number | string | {} | void> {
    const toolkitStackName: string = ToolkitInfo.determineName(configuration.settings.get(['toolkitStackName']));
    debug(`Toolkit stack: ${colors.bold(toolkitStackName)}`);

    if (args.all && args.STACKS) {
      throw new Error('You must either specify a list of Stacks or the `--all` argument');
    }

    args.STACKS = args.STACKS || [];
    args.ENVIRONMENTS = args.ENVIRONMENTS || [];

    const selector: StackSelector = {
      allTopLevel: args.all,
      patterns: args.STACKS,
    };

    const cli = new CdkToolkit({
      cloudExecutable,
      cloudFormation,
      verbose: argv.trace || argv.verbose > 0,
      ignoreErrors: argv['ignore-errors'],
      strict: argv.strict,
      configuration,
      sdkProvider,
    });

    switch (command) {
      case 'ls':
      case 'list':
        return cli.list(args.STACKS, { long: args.long });

      case 'diff':
        const enableDiffNoFail = isFeatureEnabled(configuration, cxapi.ENABLE_DIFF_NO_FAIL);
        return cli.diff({
          stackNames: args.STACKS,
          exclusively: args.exclusively,
          templatePath: args.template,
          strict: args.strict,
          contextLines: args.contextLines,
          securityOnly: args.securityOnly,
          fail: args.fail || !enableDiffNoFail,
        });

      case 'bootstrap':
        const source: BootstrapSource = determineBootsrapVersion(args, configuration);

        const bootstrapper = new Bootstrapper(source);

        if (args.showTemplate) {
          return bootstrapper.showTemplate();
        }

        return cli.bootstrap(args.ENVIRONMENTS, bootstrapper, {
          roleArn: args.roleArn,
          force: argv.force,
          toolkitStackName: toolkitStackName,
          execute: args.execute,
          tags: configuration.settings.get(['tags']),
          terminationProtection: args.terminationProtection,
          parameters: {
            bucketName: configuration.settings.get(['toolkitBucket', 'bucketName']),
            kmsKeyId: configuration.settings.get(['toolkitBucket', 'kmsKeyId']),
            createCustomerMasterKey: args.bootstrapCustomerKey,
            qualifier: args.qualifier,
            publicAccessBlockConfiguration: args.publicAccessBlockConfiguration,
            trustedAccounts: arrayFromYargs(args.trust),
            trustedAccountsForLookup: arrayFromYargs(args.trustForLookup),
            cloudFormationExecutionPolicies: arrayFromYargs(args.cloudformationExecutionPolicies),
          },
        });

      case 'deploy':
        const parameterMap: { [name: string]: string | undefined } = {};
        for (const parameter of args.parameters) {
          if (typeof parameter === 'string') {
            const keyValue = (parameter as string).split('=');
            parameterMap[keyValue[0]] = keyValue.slice(1).join('=');
          }
        }
        return cli.deploy({
          selector,
          exclusively: args.exclusively,
          toolkitStackName,
          roleArn: args.roleArn,
          notificationArns: args.notificationArns,
          requireApproval: configuration.settings.get(['requireApproval']),
          confirmChangeSet: configuration.settings.get(['confirmChangeSet']),
          reuseAssets: args['build-exclude'],
          tags: configuration.settings.get(['tags']),
          execute: args.execute,
          changeSetName: args.changeSetName,
          force: args.force,
          parameters: parameterMap,
          usePreviousParameters: args['previous-parameters'],
          outputsFile: configuration.settings.get(['outputsFile']),
          progress: configuration.settings.get(['progress']),
          ci: args.ci,
        });

      case 'destroy':
        return cli.destroy({
          selector,
          exclusively: args.exclusively,
          force: args.force,
          roleArn: args.roleArn,
        });

      case 'synthesize':
      case 'synth':
        if (args.exclusively) {
          return cli.synth(args.STACKS, args.exclusively, args.quiet, args.validation);
        } else {
          return cli.synth(args.STACKS, true, args.quiet, args.validation);
        }


      case 'metadata':
        return cli.metadata(args.STACK);

      case 'init':
        const language = configuration.settings.get(['language']);
        if (args.list) {
          return printAvailableTemplates(language);
        } else {
          return cliInit(args.TEMPLATE, language, undefined, args.generateOnly);
        }
      case 'version':
        return data(version.DISPLAY_VERSION);

      default:
        throw new Error('Unknown command: ' + command);
    }
  }

  function toJsonOrYaml(object: any): string {
    return serializeStructure(object, argv.json);
  }
}

/**
 * Determine which version of bootstrapping
 * (legacy, or "new") should be used.
 */
function determineBootsrapVersion(args: { template?: string }, configuration: Configuration): BootstrapSource {
  const isV1 = version.DISPLAY_VERSION.startsWith('1.');
  return isV1 ? determineV1BootstrapSource(args, configuration) : determineV2BootstrapSource(args);
}

function determineV1BootstrapSource(args: { template?: string }, configuration: Configuration): BootstrapSource {
  let source: BootstrapSource;
  if (args.template) {
    print(`Using bootstrapping template from ${args.template}`);
    source = { source: 'custom', templateFile: args.template };
  } else if (process.env.CDK_NEW_BOOTSTRAP) {
    print('CDK_NEW_BOOTSTRAP set, using new-style bootstrapping');
    source = { source: 'default' };
  } else if (isFeatureEnabled(configuration, cxapi.NEW_STYLE_STACK_SYNTHESIS_CONTEXT)) {
    print(`'${cxapi.NEW_STYLE_STACK_SYNTHESIS_CONTEXT}' context set, using new-style bootstrapping`);
    source = { source: 'default' };
  } else {
    // in V1, the "legacy" bootstrapping is the default
    source = { source: 'legacy' };
  }
  return source;
}

function determineV2BootstrapSource(args: { template?: string }): BootstrapSource {
  let source: BootstrapSource;
  if (args.template) {
    print(`Using bootstrapping template from ${args.template}`);
    source = { source: 'custom', templateFile: args.template };
  } else if (process.env.CDK_LEGACY_BOOTSTRAP) {
    print('CDK_LEGACY_BOOTSTRAP set, using legacy-style bootstrapping');
    source = { source: 'legacy' };
  } else {
    // in V2, the "new" bootstrapping is the default
    source = { source: 'default' };
  }
  return source;
}

function isFeatureEnabled(configuration: Configuration, featureFlag: string) {
  return configuration.context.get(featureFlag) ?? cxapi.futureFlagDefault(featureFlag);
}

/**
 * Translate a Yargs input array to something that makes more sense in a programming language
 * model (telling the difference between absence and an empty array)
 *
 * - An empty array is the default case, meaning the user didn't pass any arguments. We return
 *   undefined.
 * - If the user passed a single empty string, they did something like `--array=`, which we'll
 *   take to mean they passed an empty array.
 */
function arrayFromYargs(xs: string[]): string[] | undefined {
  if (xs.length === 0) { return undefined; }
  return xs.filter(x => x !== '');
}

initCommandLine()
  .then(value => {
    if (value == null) { return; }
    if (typeof value === 'string') {
      data(value);
    } else if (typeof value === 'number') {
      process.exitCode = value;
    }
  })
  .catch(err => {
    error(err.message);
    if (err.stack) {
      debug(err.stack);
    }
    process.exitCode = 1;
  });
