#!/usr/bin/env node
import 'source-map-support/register';

import * as cxapi from '@aws-cdk/cx-api';
import * as colors from 'colors/safe';
import * as yargs from 'yargs';

import { ToolkitInfo } from '../lib';
import { SdkProvider } from '../lib/api/aws-auth';
import { CloudFormationDeployments } from '../lib/api/cloudformation-deployments';
import { CloudExecutable } from '../lib/api/cxapp/cloud-executable';
import { execProgram } from '../lib/api/cxapp/exec';
import { CdkToolkit } from '../lib/cdk-toolkit';
import { RequireApproval } from '../lib/diff';
import { availableInitLanguages, cliInit, printAvailableTemplates } from '../lib/init';
import { data, debug, error, setVerbose } from '../lib/logging';
import { PluginHost } from '../lib/plugin';
import { serializeStructure } from '../lib/serialize';
import { Configuration, Settings } from '../lib/settings';
import * as version from '../lib/version';

// tslint:disable:no-shadowed-variable max-line-length
async function parseCommandLineArguments() {
  const initTemplateLanuages = await availableInitLanguages;
  return yargs
    .env('CDK')
    .usage('Usage: cdk -a <cdk-app> COMMAND')
    .option('app', { type: 'string', alias: 'a', desc: 'REQUIRED: command-line for executing your app or a cloud assembly directory (e.g. "node bin/my-app.js")', requiresArg: true })
    .option('context', { type: 'array', alias: 'c', desc: 'Add contextual string parameter (KEY=VALUE)', nargs: 1, requiresArg: true })
    .option('plugin', { type: 'array', alias: 'p', desc: 'Name or path of a node package that extend the CDK features. Can be specified multiple times', nargs: 1 })
    .option('trace', { type: 'boolean', desc: 'Print trace for stack warnings' })
    .option('strict', { type: 'boolean', desc: 'Do not construct stacks with warnings' })
    .option('ignore-errors', { type: 'boolean', default: false, desc: 'Ignores synthesis errors, which will likely produce an invalid output' })
    .option('json', { type: 'boolean', alias: 'j', desc: 'Use JSON output instead of YAML when templates are printed to STDOUT', default: false })
    .option('verbose', { type: 'boolean', alias: 'v', desc: 'Show debug logs', default: false })
    .option('profile', { type: 'string', desc: 'Use the indicated AWS profile as the default environment', requiresArg: true })
    .option('proxy', { type: 'string', desc: 'Use the indicated proxy. Will read from HTTPS_PROXY environment variable if not specified.', requiresArg: true })
    .option('ca-bundle-path', { type: 'string', desc: 'Path to CA certificate to use when validating HTTPS requests. Will read from AWS_CA_BUNDLE environment variable if not specified.', requiresArg: true })
    .option('ec2creds', { type: 'boolean', alias: 'i', default: undefined, desc: 'Force trying to fetch EC2 instance credentials. Default: guess EC2 instance status.' })
    .option('localstack-endpoint', { type: 'string', requiresArg: true, desc: 'Specify service endpoints for service calls made with the AWS SDK. (i.e. http://localhost:4566).'})
    .option('version-reporting', { type: 'boolean', desc: 'Include the "AWS::CDK::Metadata" resource in synthesized templates (enabled by default)', default: undefined })
    .option('path-metadata', { type: 'boolean', desc: 'Include "aws:cdk:path" CloudFormation metadata for each resource (enabled by default)', default: true })
    .option('asset-metadata', { type: 'boolean', desc: 'Include "aws:asset:*" CloudFormation metadata for resources that user assets (enabled by default)', default: true })
    .option('role-arn', { type: 'string', alias: 'r', desc: 'ARN of Role to use when invoking CloudFormation', default: undefined, requiresArg: true })
    .option('toolkit-stack-name', { type: 'string', desc: 'The name of the CDK toolkit stack', requiresArg: true })
    .option('staging', { type: 'boolean', desc: 'Copy assets to the output directory (use --no-staging to disable, needed for local debugging the source files with SAM CLI)', default: true })
    .option('output', { type: 'string', alias: 'o', desc: 'Emits the synthesized cloud assembly into a directory (default: cdk.out)', requiresArg: true })
    .option('no-color', { type: 'boolean', desc: 'Removes colors and other style from console output', default: false })
    .command([ 'list [STACKS..]', 'ls [STACKS..]' ], 'Lists all stacks in the app', yargs => yargs
      .option('long', { type: 'boolean', default: false, alias: 'l', desc: 'Display environment information for each stack' }),
    )
    .command([ 'synthesize [STACKS..]', 'synth [STACKS..]' ], 'Synthesizes and prints the CloudFormation template for this stack', yargs => yargs
      .option('exclusively', { type: 'boolean', alias: 'e', desc: 'Only synthesize requested stacks, don\'t include dependencies' }))
    .command('bootstrap [ENVIRONMENTS..]', 'Deploys the CDK toolkit stack into an AWS environment', yargs => yargs
      .option('bootstrap-bucket-name', { type: 'string', alias: ['b', 'toolkit-bucket-name'], desc: 'The name of the CDK toolkit bucket; bucket will be created and must not exist', default: undefined })
      .option('bootstrap-kms-key-id', { type: 'string', desc: 'AWS KMS master key ID used for the SSE-KMS encryption', default: undefined })
      .option('qualifier', { type: 'string', desc: 'Unique string to distinguish multiple bootstrap stacks', default: undefined })
      .option('tags', { type: 'array', alias: 't', desc: 'Tags to add for the stack (KEY=VALUE)', nargs: 1, requiresArg: true, default: [] })
      .option('execute', {type: 'boolean', desc: 'Whether to execute ChangeSet (--no-execute will NOT execute the ChangeSet)', default: true})
      .option('trust', { type: 'array', desc: 'The (space-separated) list of AWS account IDs that should be trusted to perform deployments into this environment', default: [], hidden: true })
      .option('cloudformation-execution-policies', { type: 'array', desc: 'The (space-separated) list of Managed Policy ARNs that should be attached to the role performing deployments into this environment. Required if --trust was passed', default: [], hidden: true })
      .option('force', { alias: 'f', type: 'boolean', desc: 'Always bootstrap even if it would downgrade template version', default: false }),
    )
    .command('deploy [STACKS..]', 'Deploys the stack(s) named STACKS into your AWS account', yargs => yargs
      .option('build-exclude', { type: 'array', alias: 'E', nargs: 1, desc: 'Do not rebuild asset with the given ID. Can be specified multiple times.', default: [] })
      .option('exclusively', { type: 'boolean', alias: 'e', desc: 'Only deploy requested stacks, don\'t include dependencies' })
      .option('require-approval', { type: 'string', choices: [RequireApproval.Never, RequireApproval.AnyChange, RequireApproval.Broadening], desc: 'What security-sensitive changes need manual approval' })
      .option('ci', { type: 'boolean', desc: 'Force CI detection (deprecated)', default: process.env.CI !== undefined })
      .option('notification-arns', {type: 'array', desc: 'ARNs of SNS topics that CloudFormation will notify with stack related events', nargs: 1, requiresArg: true})
      .option('tags', { type: 'array', alias: 't', desc: 'Tags to add to the stack (KEY=VALUE)', nargs: 1, requiresArg: true })
      .option('execute', { type: 'boolean', desc: 'Whether to execute ChangeSet (--no-execute will NOT execute the ChangeSet)', default: true })
      .option('force', { alias: 'f', type: 'boolean', desc: 'Always deploy stack even if templates are identical', default: false })
      .option('parameters', { type: 'array', desc: 'Additional parameters passed to CloudFormation at deploy time (STACK:KEY=VALUE)', nargs: 1, requiresArg: true, default: {} })
      .option('outputs-file', { type: 'string', alias: 'O', desc: 'Path to file where stack outputs will be written as JSON', requiresArg: true })
      .option('previous-parameters', { type: 'boolean', default: true, desc: 'Use previous values for existing parameters (you must specify all parameters on every deployment if this is disabled)' }),
    )
    .command('destroy [STACKS..]', 'Destroy the stack(s) named STACKS', yargs => yargs
      .option('exclusively', { type: 'boolean', alias: 'e', desc: 'Only destroy requested stacks, don\'t include dependees' })
      .option('force', { type: 'boolean', alias: 'f', desc: 'Do not ask for confirmation before destroying the stacks' }))
    .command('diff [STACKS..]', 'Compares the specified stack with the deployed stack or a local template file, and returns with status 1 if any difference is found', yargs => yargs
      .option('exclusively', { type: 'boolean', alias: 'e', desc: 'Only diff requested stacks, don\'t include dependencies' })
      .option('context-lines', { type: 'number', desc: 'Number of context lines to include in arbitrary JSON diff rendering', default: 3, requiresArg: true })
      .option('template', { type: 'string', desc: 'The path to the CloudFormation template to compare with', requiresArg: true })
      .option('strict', { type: 'boolean', desc: 'Do not filter out AWS::CDK::Metadata resources', default: false }))
    .option('fail', { type: 'boolean', desc: 'Fail with exit code 1 in case of diff', default: false })
    .command('metadata [STACK]', 'Returns all metadata associated with this stack')
    .command('init [TEMPLATE]', 'Create a new, empty CDK project from a template. Invoked without TEMPLATE, the app template will be used.', yargs => yargs
      .option('language', { type: 'string', alias: 'l', desc: 'The language to be used for the new project (default can be configured in ~/.cdk.json)', choices: initTemplateLanuages })
      .option('list', { type: 'boolean', desc: 'List the available templates' })
      .option('generate-only', { type: 'boolean', default: false, desc: 'If true, only generates project files, without executing additional operations such as setting up a git repo, installing dependencies or compiling the project'}),
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
    setVerbose();
  }
  debug('CDK toolkit version:', version.DISPLAY_VERSION);
  debug('Command line arguments:', argv);

  const configuration = new Configuration(argv);
  await configuration.load();

  const sdkProvider = await SdkProvider.withAwsCliCompatibleDefaults({
    profile: configuration.settings.get(['profile']),
    ec2creds: argv.ec2creds,
    httpOptions: {
      proxyAddress: argv.proxy,
      caBundlePath: argv['ca-bundle-path'],
    },
    localstackEndpoint: argv['localstack-endpoint'],
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

    args.STACKS = args.STACKS || [];
    args.ENVIRONMENTS = args.ENVIRONMENTS || [];

    const cli = new CdkToolkit({
      cloudExecutable,
      cloudFormation,
      verbose: argv.trace || argv.verbose,
      ignoreErrors: argv['ignore-errors'],
      strict: argv.strict,
      configuration,
      sdkProvider,
    });

    switch (command) {
      case 'ls':
      case 'list':
        return await cli.list(args.STACKS, { long: args.long });

      case 'diff':
        return await cli.diff({
          stackNames: args.STACKS,
          exclusively: args.exclusively,
          templatePath: args.template,
          strict: args.strict,
          contextLines: args.contextLines,
          fail: args.fail || !configuration.context.get(cxapi.ENABLE_DIFF_NO_FAIL),
        });

      case 'bootstrap':
        return await cli.bootstrap(args.ENVIRONMENTS, toolkitStackName,
          args.roleArn,
          !!process.env.CDK_NEW_BOOTSTRAP,
          argv.force,
          {
            bucketName: configuration.settings.get(['toolkitBucket', 'bucketName']),
            kmsKeyId: configuration.settings.get(['toolkitBucket', 'kmsKeyId']),
            qualifier: args.qualifier,
            tags: configuration.settings.get(['tags']),
            execute: args.execute,
            trustedAccounts: args.trust,
            cloudFormationExecutionPolicies: args.cloudformationExecutionPolicies,
          });

      case 'deploy':
        const parameterMap: { [name: string]: string | undefined } = {};
        for (const parameter of args.parameters) {
          if (typeof parameter === 'string') {
            const keyValue = (parameter as string).split('=');
            parameterMap[keyValue[0]] = keyValue.slice(1).join('=');
          }
        }
        return await cli.deploy({
          stackNames: args.STACKS,
          exclusively: args.exclusively,
          toolkitStackName,
          roleArn: args.roleArn,
          notificationArns: args.notificationArns,
          requireApproval: configuration.settings.get(['requireApproval']),
          reuseAssets: args['build-exclude'],
          tags: configuration.settings.get(['tags']),
          execute: args.execute,
          force: args.force,
          parameters: parameterMap,
          usePreviousParameters: args['previous-parameters'],
          outputsFile: args.outputsFile,
        });

      case 'destroy':
        return await cli.destroy({
          stackNames: args.STACKS,
          exclusively: args.exclusively,
          force: args.force,
          roleArn: args.roleArn,
        });

      case 'synthesize':
      case 'synth':
        return await cli.synth(args.STACKS, args.exclusively);

      case 'metadata':
        return await cli.metadata(args.STACK);

      case 'init':
        const language = configuration.settings.get(['language']);
        if (args.list) {
          return await printAvailableTemplates(language);
        } else {
          return await cliInit(args.TEMPLATE, language, undefined, args.generateOnly);
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
    debug(err.stack);
    process.exitCode = 1;
  });
