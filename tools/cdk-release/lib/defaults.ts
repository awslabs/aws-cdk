import { ReleaseOptions } from './types';

const defaultPackageFiles = [
  'package.json',
  'bower.json',
  'manifest.json',
];

export const defaultBumpFiles = defaultPackageFiles.concat([
  'package-lock.json',
  'npm-shrinkwrap.json',
]);

export const defaults: Partial<ReleaseOptions> = {
  infile: 'CHANGELOG.md',
  // firstRelease: false,
  sign: false,
  // noVerify: false,
  // commitAll: false,
  silent: false,
  scripts: {},
  skip: {
    tag: true,
  },
  packageFiles: defaultPackageFiles,
  bumpFiles: defaultBumpFiles,
  dryRun: false,
  // gitTagFallback: true,
  releaseCommitMessageFormat: 'chore(release): {{currentTag}}',
  changeLogHeader: '# Changelog\n\nAll notable changes to this project will be documented in this file. ' +
    'See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.\n',
};
