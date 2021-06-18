import { Duration } from '@aws-cdk/core';

/**
 * Schedule for canary runs
 */
export class Schedule {
  /**
   * The canary will be executed once.
   */
  public static once(): Schedule {
    return new Schedule('rate(0 minutes)');
  }

  /**
   * Construct a schedule from a literal schedule expression. The expression must be in a `rate(number units)` format.
   * For example, `Schedule.expression('rate(10 minutes)')`
   *
   * @param expression The expression to use.
   */
  public static expression(expression: string): Schedule {
    return new Schedule(expression);
  }

  /**
   * Construct a schedule from an interval. Allowed values: 0 (for a single run) or between 1 and 60 minutes.
   * To specify a single run, you can use `Schedule.once()`.
   *
   * @param interval The interval at which to run the canary
   */
  public static rate(interval: Duration): Schedule {
    const minutes = interval.toMinutes();
    if (minutes > 60) {
      throw new Error('Schedule duration must be between 1 and 60 minutes');
    }
    if (minutes === 0) {
      return Schedule.once();
    }
    if (minutes === 1) {
      return new Schedule('rate(1 minute)');
    }
    return new Schedule(`rate(${minutes} minutes)`);
  }

  private constructor(
    /**
     * The Schedule expression
     */
    public readonly expressionString: string) {}
}
