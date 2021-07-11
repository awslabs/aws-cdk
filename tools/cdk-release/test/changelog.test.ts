import { ConventionalCommit, filterCommits, getConventionalCommitsFromGitHistory } from '../lib/conventional-commits';
import { changelog } from '../lib/lifecycles/changelog';
import { ReleaseOptions } from '../lib/types';

describe('Changelog generation', () => {
  const args: ReleaseOptions = {
    releaseAs: 'minor',
    dryRun: true,
    silent: true,
    includeDateInChangelog: false,
  };

  test("correctly handles 'BREAKING CHANGES'", async () => {
    const commits: ConventionalCommit[] = [
      buildCommit({
        type: 'feat',
        subject: 'super important feature',
        notes: [
          {
            title: 'BREAKING CHANGE',
            text: 'this is a breaking change',
          },
        ],
      }),
      buildCommit({
        type: 'fix',
        scope: 'scope',
        subject: 'hairy bugfix',
      }),
      buildCommit({
        type: 'chore',
        subject: 'this commit should not be rendered in the Changelog',
      }),
    ];

    const changelogContents = await invokeChangelogFrom1_23_0to1_24_0(args, commits);

    expect(changelogContents).toBe(
      `## [1.24.0](https://github.com/aws/aws-cdk/compare/v1.23.0...v1.24.0)

### ⚠ BREAKING CHANGES TO EXPERIMENTAL FEATURES

* this is a breaking change

### Features

* super important feature


### Bug Fixes

* **scope:** hairy bugfix

`);
  });

  test("correctly skips experimental modules, even with 'BREAKING CHANGES'", async () => {
    const commits: ConventionalCommit[] = [
      buildCommit({
        type: 'feat',
        scope: 'scope',
        subject: 'super important feature',
      }),
      buildCommit({
        type: 'fix',
        scope: 'example-construct-library', // really hope we don't stabilize this one
        subject: 'hairy bugfix',
        notes: [
          {
            title: 'BREAKING CHANGE',
            text: 'this is a breaking change',
          },
        ],
      }),
    ];

    const changelogContents = await invokeChangelogFrom1_23_0to1_24_0({
      ...args,
      stripExperimentalChanges: true,
    }, commits);

    expect(changelogContents).toBe(
      `## [1.24.0](https://github.com/aws/aws-cdk/compare/v1.23.0...v1.24.0)

### Features

* **scope:** super important feature

`);
  });

  test('makes it so that no Git commits are queried if Changelog generation is skipped', async () => {
    const commits = await getConventionalCommitsFromGitHistory({
      ...args,
      skip: {
        changelog: true,
      },
    }, '3.9.2');

    expect(commits).toHaveLength(0);
  });
});

interface PartialCommit extends Partial<ConventionalCommit> {
  readonly type: string;
  readonly subject: string;
}

function buildCommit(commit: PartialCommit): ConventionalCommit {
  return {
    notes: [],
    references: [],
    header: `${commit.type}${commit.scope ? '(' + commit.scope + ')' : ''}: ${commit.subject}`,
    ...commit,
  };
}

async function invokeChangelogFrom1_23_0to1_24_0(args: ReleaseOptions, commits: ConventionalCommit[]): Promise<string> {
  const changelogResult = await changelog(args, '1.23.0', '1.24.0', filterCommits(args, commits));
  return changelogResult.contents;
}
