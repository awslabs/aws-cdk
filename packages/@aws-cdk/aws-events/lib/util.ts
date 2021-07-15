import { Token, TokenComparison } from '@aws-cdk/core';
import { EventPattern } from './event-pattern';

/**
 * Merge the `src` event pattern into the `dest` event pattern by adding all
 * values from `src` into the fields in `dest`.
 *
 * See `rule.addEventPattern` for details.
 */
export function mergeEventPattern(dest: any, src: any) {
  dest = dest || { };

  mergeObject(dest, src);

  return dest;

  function mergeObject(destObj: any, srcObj: any) {
    if (typeof(srcObj) !== 'object') {
      throw new Error(`Invalid event pattern '${JSON.stringify(srcObj)}', expecting an object or an array`);
    }

    for (const field of Object.keys(srcObj)) {

      const srcValue = srcObj[field];
      const destValue = destObj[field];

      if (srcValue === undefined) { continue; }

      if (typeof(srcValue) !== 'object') {
        throw new Error(`Invalid event pattern field { ${field}: ${JSON.stringify(srcValue)} }. All fields must be arrays`);
      }

      // dest doesn't have this field
      if (destObj[field] === undefined) {
        destObj[field] = srcValue;
        continue;
      }

      if (Array.isArray(srcValue) !== Array.isArray(destValue)) {
        throw new Error(`Invalid event pattern field ${field}. ` +
          `Type mismatch between existing pattern ${JSON.stringify(destValue)} and added pattern ${JSON.stringify(srcValue)}`);
      }

      // if this is an array, concat and deduplicate the values
      if (Array.isArray(srcValue)) {
        const result = [...destValue, ...srcValue];
        const resultJson = result.map(i => JSON.stringify(i));
        destObj[field] = result.filter((value, index) => resultJson.indexOf(JSON.stringify(value)) === index);
        continue;
      }

      // otherwise, it's an object, so recurse
      mergeObject(destObj[field], srcValue);
    }
  }
}

/**
 * Whether two string probably contain the same environment dimension (region or account)
 *
 * Used to compare either accounts or regions, and also returns true if both
 * are unresolved (in which case both are expted to be "current region" or "current account").
 * @internal
 */
export function sameEnvDimension(dim1: string, dim2: string) {
  return [TokenComparison.SAME, TokenComparison.BOTH_UNRESOLVED].includes(Token.compareStrings(dim1, dim2));
}

/**
 * Transform an eventPattern object into a valid Event Rule Pattern
 * by changing detailType into detail-type when present.
 */
export function renderEventPattern(eventPattern: EventPattern): any {
  if (Object.keys(eventPattern).length === 0) {
    return undefined;
  }

  // rename 'detailType' to 'detail-type'
  const out: any = {};
  for (let key of Object.keys(eventPattern)) {
    const value = (eventPattern as any)[key];
    if (key === 'detailType') {
      key = 'detail-type';
    }
    out[key] = value;
  }

  return out;
}