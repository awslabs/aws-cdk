import * as fs from 'fs';
import * as path from 'path';
import { filterCommits, getConventionalCommitsFromGitHistory } from './conventional-commits';
import { defaults } from './defaults';
import { bump } from './lifecycles/bump';
import { changelog } from './lifecycles/changelog';
import { commit } from './lifecycles/commit';
import { debug, debugObject } from './private/print';
import { ReleaseOptions } from './types';
import { resolveUpdaterObjectFromArgument } from './updaters';

module.exports = async function main(opts: ReleaseOptions): Promise<void> {
  // handle the default options
  const args: ReleaseOptions = {
    ...defaults,
    ...opts,
  };
  debugObject(args, 'options are (including defaults)', args);

  const packageInfo = determinePackageInfo(args);
  debugObject(args, 'packageInfo is', packageInfo);

  const currentVersion = packageInfo.version;
  debug(args, 'Current version is: ' + currentVersion);

  const commits = await getConventionalCommitsFromGitHistory(args, `v${currentVersion}`);
  const filteredCommits = filterCommits(args, commits);
  debugObject(args, 'Found and filtered commits', filteredCommits);

  const bumpResult = await bump(args, currentVersion);
  const newVersion = bumpResult.newVersion;
  debug(args, 'New version is: ' + newVersion);

  const changelogResult = await changelog(args, currentVersion, newVersion, filteredCommits);

  await commit(args, newVersion, [...bumpResult.changedFiles, ...changelogResult.changedFiles]);
};

interface PackageInfo {
  version: string;
  private: string | boolean | null | undefined;
}

function determinePackageInfo(args: ReleaseOptions): PackageInfo {
  for (const packageFile of args.packageFiles ?? []) {
    const updater = resolveUpdaterObjectFromArgument(packageFile);
    const pkgPath = path.resolve(process.cwd(), updater.filename);
    const contents = fs.readFileSync(pkgPath, 'utf8');
    // we stop on the first (successful) option
    return {
      version: updater.updater.readVersion(contents),
      private: typeof updater.updater.isPrivate === 'function' ? updater.updater.isPrivate(contents) : false,
    };
  }

  throw new Error('Could not establish the version to bump!');
}
