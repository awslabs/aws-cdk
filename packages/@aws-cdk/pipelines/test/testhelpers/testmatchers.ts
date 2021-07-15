/* eslint-disable import/no-extraneous-dependencies */
import { annotateMatcher, InspectionFailure, matcherFrom, PropertyMatcher } from '@aws-cdk/assert-internal';

/**
 * Sort an array (of Actions) by their RunOrder field before applying a matcher.
 *
 * Makes the matcher independent of the order in which the Actions get synthed
 * to the template. Elements with the same RunOrder will be sorted by name.
 */
export function sortedByRunOrder(matcher: any): PropertyMatcher {
  return annotateMatcher({ $sortedByRunOrder: matcher }, (value: any, failure: InspectionFailure) => {
    if (!Array.isArray(value)) {
      failure.failureReason = `Expected an Array, but got '${typeof value}'`;
      return false;
    }

    value = value.slice();

    value.sort((a: any, b: any) => {
      if (a.RunOrder !== b.RunOrder) { return a.RunOrder - b.RunOrder; }
      return (a.Name as string).localeCompare(b.Name);
    });

    return matcherFrom(matcher)(value, failure);
  });
}

export function stringNoLongerThan(length: number): PropertyMatcher {
  return annotateMatcher({ $stringIsNoLongerThan: length }, (value: any, failure: InspectionFailure) => {
    if (typeof value !== 'string') {
      failure.failureReason = `Expected a string, but got '${typeof value}'`;
      return false;
    }

    if (value.length > length) {
      failure.failureReason = `String is ${value.length} characters long. Expected at most ${length} characters`;
      return false;
    }

    return true;
  });
}