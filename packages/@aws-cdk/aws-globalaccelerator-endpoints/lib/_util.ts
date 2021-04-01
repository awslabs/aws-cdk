import { Token } from '@aws-cdk/core';

export function validateWeight(x?: number) {
  if (x !== undefined && !Token.isUnresolved(x) && (x < 0 || x > 255)) {
    throw new Error(`'weight' must be between 0 and 255, got: ${x}`);
  }
}