import * as path from 'path';
import { notify } from '../private/print';
import { runExecFile } from '../private/run-exec-file';
import { ReleaseOptions } from '../types';

export async function commit(args: ReleaseOptions, newVersion: string, modifiedFiles: string[]): Promise<void> {
  if (args.skip?.commit) {
    return;
  }

  let msg = 'committing %s';
  const paths = new Array<string>();
  const toAdd = new Array<string>();
  // commit any of the config files that we've updated
  // the version # for.
  for (const modifiedFile of modifiedFiles) {
    paths.unshift(modifiedFile);
    toAdd.push(path.relative(process.cwd(), modifiedFile));

    // account for multiple files in the output message
    if (paths.length > 1) {
      msg += ' and %s';
    }
  }
  // nothing to do, exit without commit anything
  if (toAdd.length === 0) {
    return;
  }

  notify(args, msg, paths);

  await runExecFile(args, 'git', ['add'].concat(toAdd));
  const sign = args.sign ? ['-S'] : [];
  await runExecFile(args, 'git', ['commit'].concat(
    sign,
    [
      '-m',
      `${formatCommitMessage(args.releaseCommitMessageFormat!, newVersion)}`,
    ]),
  );
}

function formatCommitMessage(rawMsg: string, newVersion: string): string {
  return rawMsg.replace(/{{currentTag}}/g, newVersion);
}
