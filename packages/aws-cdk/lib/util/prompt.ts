import * as promptly from 'promptly';

/**
 * Throw an error if STDIN is not a TTY
 */
function ensureTTY() {
  // only talk to user if STDIN is a terminal (otherwise, fail)
  if (!process.stdin.isTTY) {
    throw new Error(
      '"--require-approval" is enabled and stack includes security-sensitive updates, ' +
      'but terminal (TTY) is not attached so we are unable to get a confirmation from the user');
  }
}

/**
 * Prompt confirmation of changes. Throws an error if the answer is no.
 */
export async function confirmChangesOrAbort() {
  ensureTTY();
  const confirmed = await promptly.confirm('Do you wish to deploy these changes (y/n)?');
  if (!confirmed) { throw new Error('Aborted by user'); }
}
