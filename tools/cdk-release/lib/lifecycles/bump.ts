import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';
import { writeFile } from '../private/files';
import { notify } from '../private/print';
import { ReleaseOptions, ReleaseType } from '../types';
import { resolveUpdaterObjectFromArgument } from '../updaters/index';

export interface BumpResult {
  readonly newVersion: string;
  readonly changedFiles: string[];
}

export async function bump(args: ReleaseOptions, currentVersion: string): Promise<BumpResult> {
  if (args.skip?.bump) {
    return {
      newVersion: currentVersion,
      changedFiles: [],
    };
  }

  const releaseType = getReleaseType(args.prerelease, args.releaseAs, currentVersion);
  const newVersion = semver.inc(currentVersion, releaseType, args.prerelease);
  if (!newVersion) {
    throw new Error('Could not increment version: ' + currentVersion);
  }
  const changedFiles = updateBumpFiles(args, newVersion);
  return { newVersion, changedFiles };
}

function getReleaseType(prerelease: string | undefined, expectedReleaseType: ReleaseType, currentVersion: string): semver.ReleaseType {
  if (typeof prerelease === 'string') {
    if (isInPrerelease(currentVersion)) {
      if (shouldContinuePrerelease(currentVersion, expectedReleaseType) ||
        getTypePriority(getCurrentActiveType(currentVersion)) > getTypePriority(expectedReleaseType)
      ) {
        return 'prerelease';
      }
    }

    return 'pre' + expectedReleaseType as semver.ReleaseType;
  } else {
    return expectedReleaseType;
  }
}

function isInPrerelease(version: string): boolean {
  return Array.isArray(semver.prerelease(version));
}

/**
 * if a version is currently in pre-release state,
 * and if it current in-pre-release type is same as expect type,
 * it should continue the pre-release with the same type
 *
 * @param version
 * @param expectType
 * @return {boolean}
 */
function shouldContinuePrerelease(version: string, expectType: ReleaseType): boolean {
  return getCurrentActiveType(version) === expectType;
}

const TypeList = ['major', 'minor', 'patch'].reverse();
/**
 * extract the in-pre-release type in target version
 *
 * @param version
 * @return {string}
 */
function getCurrentActiveType(version: string): string {
  for (const item of TypeList) {
    if ((semver as any)[item](version)) {
      return item;
    }
  }
  throw new Error('unreachable');
}

/**
 * calculate the priority of release type,
 * major - 2, minor - 1, patch - 0
 *
 * @param type
 * @return {number}
 */
function getTypePriority(type: string): number {
  return TypeList.indexOf(type);
}

/**
 * attempt to update the version number in provided `bumpFiles`
 * @param args config object
 * @param newVersion version number to update to.
 * @return the collection of file paths that were actually changed
 */
function updateBumpFiles(args: ReleaseOptions, newVersion: string): string[] {
  const ret = new Array<string>();

  for (const bumpFile of (args.bumpFiles ?? [])) {
    const updater = resolveUpdaterObjectFromArgument(bumpFile);
    if (!updater) {
      continue;
    }
    const configPath = path.resolve(process.cwd(), updater.filename);
    const stat = fs.lstatSync(configPath);
    if (!stat.isFile()) {
      continue;
    }
    const contents = fs.readFileSync(configPath, 'utf8');
    notify(args,
      'bumping version in ' + updater.filename + ' from %s to %s',
      [updater.updater.readVersion(contents), newVersion],
    );
    writeFile(args, configPath,
      updater.updater.writeVersion(contents, newVersion),
    );
    ret.push(updater.filename);
  }

  return ret;
}
