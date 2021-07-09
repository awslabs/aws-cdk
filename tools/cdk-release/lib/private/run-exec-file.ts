import { execFile as childProcessExecFile } from 'child_process';
import { promisify } from 'util';
import { ReleaseOptions } from '../types';
import { notify } from './print';

const execFile = promisify(childProcessExecFile);

export async function runExecFile(args: ReleaseOptions, cmd: string, cmdArgs: string[]): Promise<string | undefined> {
  if (args.dryRun) {
    notify(args, "would execute command: '%s %s'", [cmd, cmdArgs
      // quote arguments with spaces, for a more realistic printing experience
      .map(cmdArg => cmdArg.match(/\s/) ? `"${cmdArg}"` : cmdArg)
      .join(' ')],
    );
    return;
  }
  const streams = await execFile(cmd, cmdArgs);
  return streams.stdout;
}
