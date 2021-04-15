import * as assets from '@aws-cdk/assets';
import { SymlinkFollowMode } from '@aws-cdk/core';

export function toSymlinkFollow(follow?: assets.FollowMode): SymlinkFollowMode | undefined {
  switch (follow) {
    case undefined: return undefined;
    case assets.FollowMode.NEVER: return SymlinkFollowMode.NEVER;
    case assets.FollowMode.ALWAYS: return SymlinkFollowMode.ALWAYS;
    case assets.FollowMode.BLOCK_EXTERNAL: return SymlinkFollowMode.BLOCK_EXTERNAL;
    case assets.FollowMode.EXTERNAL: return SymlinkFollowMode.EXTERNAL;
  }
}
