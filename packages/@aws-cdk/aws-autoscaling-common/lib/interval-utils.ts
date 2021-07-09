import { ScalingInterval } from './types';

export interface CompleteScalingInterval {
  readonly lower: number;
  readonly upper: number;
  readonly change?: number;
}

/**
 * Normalize the given interval set to cover the complete number line and make sure it has at most one gap
 */
export function normalizeIntervals(intervals: ScalingInterval[], changesAreAbsolute: boolean): CompleteScalingInterval[] {
  // Make intervals a complete numberline
  const full = orderAndCompleteIntervals(intervals);
  // Add 'undefined's in uncovered areas of the number line
  makeGapsUndefined(full);

  // In case of relative changes, treat 0-change also as 'undefined' (= no change action)
  if (!changesAreAbsolute) { makeZerosUndefined(full); }

  // Combine adjacent undefines and make sure there's at most one of them
  combineUndefineds(full);
  validateAtMostOneUndefined(full);

  return full;
}

/**
 * Completely order scaling intervals, making their lower and upper bounds concrete.
 */
function orderAndCompleteIntervals(intervals: ScalingInterval[]): CompleteScalingInterval[] {
  if (intervals.length < 2) {
    throw new Error('Require at least 2 intervals');
  }

  for (const interval of intervals) {
    if (interval.lower === undefined && interval.upper === undefined) {
      throw new Error(`Must supply at least one of 'upper' or 'lower', got: ${JSON.stringify(interval)}`);
    }
  }

  // Make a copy
  intervals = intervals.map(x => ({ ...x }));

  // Sort by whatever number we have for each interval
  intervals.sort(comparatorFromKey((x: ScalingInterval) => x.lower ?? x.upper));

  // Propagate boundaries until no more change
  while (propagateBounds(intervals)) { /* Repeat */ }

  const lastIndex = intervals.length - 1;

  // Validate that no intervals have undefined bounds now, which must mean they're complete.
  if (intervals[0].lower === undefined) { intervals[0] = { ...intervals[0], lower: 0 }; }
  if (intervals[lastIndex].upper === undefined) { intervals[lastIndex] = { ...intervals[lastIndex], upper: Infinity }; }
  for (const interval of intervals) {
    if (interval.lower === undefined || interval.upper === undefined) {
      throw new Error(`Could not determine the lower and upper bounds for ${JSON.stringify(interval)}`);
    }
  }

  const completeIntervals = intervals as CompleteScalingInterval[];

  // Validate that we have nonoverlapping intervals now.
  for (let i = 0; i < completeIntervals.length - 1; i++) {
    if (overlap(completeIntervals[i], completeIntervals[i + 1])) {
      throw new Error(`Two intervals overlap: ${JSON.stringify(completeIntervals[i])} and ${JSON.stringify(completeIntervals[i + 1])}`);
    }
  }

  // Fill up the gaps

  return completeIntervals;
}

/**
 * Make the intervals cover the complete number line
 *
 * This entails adding intervals with an 'undefined' change to fill up the gaps.
 *
 * Since metrics have a halfopen interval, the first one will get a lower bound
 * of 0, the last one will get an upper bound of +Infinity.
 *
 * In case of absolute adjustments, the lower number of the adjacent bound will
 * be used, which means conservative change. In case of relative adjustments,
 * we'll use relative adjusment 0 (which means no change).
 */
function makeGapsUndefined(intervals: CompleteScalingInterval[]) {
  // Add edge intervals if necessary, but only for relative adjustments. Since we're
  // going to make scaling intervals extend all the way out to infinity on either side,
  // the result is the same for absolute adjustments anyway.
  if (intervals[0].lower !== 0) {
    intervals.splice(0, 0, {
      lower: 0,
      upper: intervals[0].lower,
      change: undefined,
    });
  }
  if (last(intervals).upper !== Infinity) {
    intervals.push({
      lower: last(intervals).upper,
      upper: Infinity,
      change: undefined,
    });
  }

  let i = 1;
  while (i < intervals.length) {
    if (intervals[i - 1].upper < intervals[i].lower) {
      intervals.splice(i, 0, {
        lower: intervals[i - 1].upper,
        upper: intervals[i].lower,
        change: undefined,
      });
    } else {
      i++;
    }
  }
}

/**
 * Turn zero changes into undefined, in-place
 */
function makeZerosUndefined(intervals: CompleteScalingInterval[]) {
  for (let i = 0; i < intervals.length; ++i) {
    const interval = intervals[i];
    if (interval.change === 0) {
      intervals[i] = { ...interval, change: undefined };
    }
  }
}

/**
 * If there are adjacent "undefined" intervals, combine them
 */
function combineUndefineds(intervals: CompleteScalingInterval[]) {
  let i = 0;
  while (i < intervals.length - 1) {
    if (intervals[i].change === undefined && intervals[i + 1].change === undefined) {
      intervals[i] = { ...intervals[i], upper: intervals[i + 1].upper };
      intervals.splice(i + 1, 1);
    } else {
      i++;
    }
  }
}

function validateAtMostOneUndefined(intervals: CompleteScalingInterval[]) {
  const undef = intervals.filter(x => x.change === undefined);
  if (undef.length > 1) {
    throw new Error(`Can have at most one no-change interval, got ${JSON.stringify(undef)}`);
  }
}

function comparatorFromKey<T, U>(keyFn: (x: T) => U) {
  return (a: T, b: T) => {
    const keyA = keyFn(a);
    const keyB = keyFn(b);

    if (keyA < keyB) { return -1; }
    if (keyA === keyB) { return 0; }
    return 1;
  };
}

function propagateBounds(intervals: ScalingInterval[]) {
  let ret = false;

  // Propagate upper bounds upwards
  for (let i = 0; i < intervals.length - 1; i++) {
    if (intervals[i].upper !== undefined && intervals[i + 1].lower === undefined) {
      intervals[i + 1] = { ...intervals[i + 1], lower: intervals[i].upper };
      ret = true;
    }
  }

  // Propagate lower bounds downwards
  for (let i = intervals.length - 1; i >= 1; i--) {
    if (intervals[i].lower !== undefined && intervals[i - 1].upper === undefined) {
      intervals[i - 1] = { ...intervals[i - 1], upper: intervals[i].lower };
      ret = true;
    }
  }

  return ret;
}

/**
 * Whether two intervals overlap
 */
function overlap(a: CompleteScalingInterval, b: CompleteScalingInterval) {
  return a.lower < b.upper && a.upper > b.lower;
}

function last<T>(xs: T[]) {
  return xs[xs.length - 1];
}

export interface Alarms {
  readonly lowerAlarmIntervalIndex?: number;
  readonly upperAlarmIntervalIndex?: number;
}

/**
 * Locate the intervals that should have the alarm thresholds, by index.
 *
 * Pick the intervals on either side of the singleton "undefined" interval, or
 * pick the middle interval if there's no such interval.
 */
export function findAlarmThresholds(intervals: CompleteScalingInterval[]): Alarms {
  const gapIndex = intervals.findIndex(x => x.change === undefined);

  if (gapIndex !== -1) {
    return {
      lowerAlarmIntervalIndex: gapIndex > 0 ? gapIndex - 1 : undefined,
      upperAlarmIntervalIndex: gapIndex < intervals.length - 1 ? gapIndex + 1 : undefined,
    };
  }

  if (intervals.length === 1) {
    return { upperAlarmIntervalIndex: 0 };
  }

  const middleIndex = Math.floor(intervals.length / 2);

  return {
    lowerAlarmIntervalIndex: middleIndex - 1,
    upperAlarmIntervalIndex: middleIndex,
  };
}