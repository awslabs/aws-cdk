export interface Lifecycles {
  bump?: string;
  changelog?: string;
  postchangelog?: string;
  commit?: string;

  // we don't actually do tagging at all, but still support passing it as an option,
  // for conformance with standard-version (CDK doesn't use its tagging capabilities anyway)
  tag?: string;
}

type LifecyclesSkip = {
  [key in keyof Lifecycles]: boolean;
}

/* ****** Updaters ******** */

export interface UpdaterModule {
  isPrivate?: (contents: string) => string | boolean | null | undefined;
  readVersion(contents: string): string;
  writeVersion(contents: string, version: string): string;
}

export interface ArgUpdater {
  filename: string;
  type?: string;
  updater?: UpdaterModule | string;
}

export type ArgFile = string | ArgUpdater;

export interface Updater {
  filename: string;
  updater: UpdaterModule;
}

export type ReleaseType = 'major' | 'minor' | 'patch';

export interface ConventionalCommitType {
  type: string;
  section?: string;
  hidden?: boolean;
}

/* ****** main options ******** */

export interface ReleaseOptions {
  releaseAs: ReleaseType;
  skip?: LifecyclesSkip;
  packageFiles?: ArgFile[];
  bumpFiles?: ArgFile[];
  infile?: string;
  prerelease?: string;
  scripts?: Lifecycles;
  dryRun?: boolean;
  verbose?: boolean;
  silent?: boolean;
  sign?: boolean;
  stripExperimentalChanges?: boolean;

  changeLogHeader?: string;
  includeDateInChangelog?: boolean;
  releaseCommitMessageFormat?: string;
}
