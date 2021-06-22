import * as crypto from 'crypto';

/**
 * Generates a unique hash identfifer using SHA256 encryption algorithm
 */
export function hashValues(...ids: string[]): string {
  const sha256 = crypto.createHash('sha256');
  ids.forEach(val => sha256.update(val));
  return sha256.digest('hex').slice(0, 12);
}
