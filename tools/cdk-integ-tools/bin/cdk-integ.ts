#!/usr/bin/env node
// Exercise all integ stacks and if they deploy, update the expected synth files
import * as yargs from 'yargs';
import { DEFAULT_SYNTH_OPTIONS, IntegrationTests } from '../lib/integ-helpers';

/* eslint-disable no-console */

async function main() {
  const argv = yargs
    .usage('Usage: cdk-integ [TEST...]')
    .option('list', { type: 'boolean', default: false, desc: 'List tests instead of running them' })
    .option('clean', { type: 'boolean', default: true, desc: 'Skips stack clean up after test is completed (use --no-clean to negate)' })
    .option('verbose', { type: 'boolean', default: false, alias: 'v', desc: 'Verbose logs' })
    .option('dry-run', { type: 'boolean', default: false, desc: 'do not actually deploy the stack. just update the snapshot (not recommended!)' })
    .argv;

  const tests = await new IntegrationTests('test').fromCliArgs(argv._.map(x => x.toString()));

  if (argv.list) {
    process.stdout.write(tests.map(t => t.name).join(' ') + '\n');
    return;
  }

  for (const test of tests) {
    console.error(`Synthesizing ${test.name}.`);

    const stackToDeploy = await test.determineTestStack();
    console.error(`Selected stack: ${stackToDeploy}`);

    const args = new Array<string>();

    // inject "--verbose" to the command line of "cdk" if we are in verbose mode
    if (argv.verbose) {
      args.push('--verbose');
    }

    const dryRun = argv['dry-run'] ?? false;

    try {
      if (dryRun) {
        console.error('Skipping deployment (--dry-run), updating snapshot.');
      } else {
        console.error(`Deploying ${test.name}...`);
        await test.invokeCli([...args, 'deploy', '--require-approval', 'never', ...stackToDeploy], {
          verbose: argv.verbose,
          // Note: no "context" and "env", so use default user settings!
        });
        console.error('Deployment succeeded, updating snapshot.');
      }

      // If this all worked, write the new expectation file
      const actual = await test.cdkSynthFast(DEFAULT_SYNTH_OPTIONS);

      await test.writeExpected(actual);
    } finally {
      if (!dryRun) {
        if (argv.clean) {
          console.error('Cleaning up.');
          await test.invokeCli(['destroy', '--force', ...stackToDeploy]);
        } else {
          console.error('Skipping clean up (--no-clean).');
        }
      }
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
