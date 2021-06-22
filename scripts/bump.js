#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const semver = require('semver');
const ver = require('./resolve-version');
const { exec } = require('child_process');
const repoRoot = path.join(__dirname, '..');

const releaseAs = process.argv[2] || 'minor';
const forTesting = process.env.BUMP_CANDIDATE || false;

async function main() {
  if (releaseAs !== 'minor' && releaseAs !== 'patch') {
    throw new Error(`invalid bump type "${releaseAs}". only "minor" (the default) and "patch" are allowed. major version bumps require *slightly* more intention`);
  }

  console.error(`Starting ${releaseAs} version bump`);
  console.error('Current version information:', JSON.stringify(ver, undefined, 2));

  const changelogPath = path.join(repoRoot, ver.changelogFile);
  const opts = {
    releaseAs: releaseAs,
    skip: { tag: true },
    packageFiles: [ { filename: ver.versionFile, type: 'json' } ],
    bumpFiles: [ { filename: ver.versionFile, type: 'json' } ],
    infile: ver.changelogFile,
    prerelease: ver.prerelease,
    scripts: {
      postchangelog: `${path.join(__dirname, 'changelog-experimental-fix.sh')} ${changelogPath}`
    }
  };

  if (forTesting) {
    opts.skip.commit = true;
    opts.skip.changelog = true;

    // if we are on a "stable" branch, add a pre-release tag ("rc") to the
    // version number as a safety in case this version will accidentally be
    // published.
    opts.prerelease = ver.prerelease || 'rc'
    console.error(`BUMP_CANDIDATE is set, so bumping version for testing (with the "${opts.prerelease}" prerelease tag)`);
  }

  // `standard-release` will -- among other things -- create the changelog.
  // However, on the v2 branch, `conventional-changelog` (which `standard-release` uses) gets confused
  // and creates really muddled changelogs with both v1 and v2 releases intermingled, and lots of missing data.
  // A super HACK here is to locally remove all version tags that don't match this major version prior
  // to doing the bump, and then later fetching to restore those tags.
  const majorVersion = semver.major(ver.version);
  await exec(`git tag -d $(git tag -l | grep -v '^v${majorVersion}.')`);

  // Delay loading standard-version until the git tags have been pruned.
  const standardVersion = require('standard-version');
  await standardVersion(opts);

  // fetch back the tags, and only the tags, removed locally above
  await exec('git fetch origin "refs/tags/*:refs/tags/*"');
}

main().catch(err => {
  console.error(err.stack);
  process.exit(1);
});
