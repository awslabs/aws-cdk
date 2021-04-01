import { IgnoreMode } from '@aws-cdk/core';
import { FollowMode } from './follow-mode';

/**
 * Obtains applied when copying directories into the staging location.
 * @deprecated see `core.CopyOptions`
 */
export interface CopyOptions {
  /**
   * A strategy for how to handle symlinks.
   *
   * @default Never
   * @deprecated use `followSymlinks` instead
   */
  readonly follow?: FollowMode;

  /**
   * Glob patterns to exclude from the copy.
   *
   * @default nothing is excluded
   */
  readonly exclude?: string[];

  /**
   * The ignore behavior to use for exclude patterns.
   *
   * @default - GLOB for file assets, DOCKER or GLOB for docker assets depending on whether the
   * '@aws-cdk/aws-ecr-assets:dockerIgnoreSupport' flag is set.
   */
  readonly ignoreMode?: IgnoreMode;
}

/**
 * Options related to calculating source hash.
 * @deprecated see `core.FingerprintOptions`
 */
export interface FingerprintOptions extends CopyOptions {
  /**
   * Extra information to encode into the fingerprint (e.g. build instructions
   * and other inputs)
   *
   * @default - hash is only based on source content
   */
  readonly extraHash?: string;
}
