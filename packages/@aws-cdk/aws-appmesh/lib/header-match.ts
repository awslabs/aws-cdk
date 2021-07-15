import { CfnRoute } from './index';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/**
 * Configuration for `HeaderMatch`
 */
export interface HeaderMatchConfig {
  /**
   * Route CFN configuration for the route header match.
   */
  readonly headerMatch: CfnRoute.HttpRouteHeaderProperty;
}

/**
 * Used to generate header matching methods.
 */
export abstract class HeaderMatch {
  /**
   * The value of the header with the given name in the request must match the
   * specified value exactly.
   *
   * @param headerName the name of the header to match against
   * @param headerValue The exact value to test against
   */
  public static valueIs(headerName: string, headerValue: string): HeaderMatch {
    return new HeaderMatchImpl(headerName, false, { exact: headerValue });
  }

  /**
   * The value of the header with the given name in the request must not match
   * the specified value exactly.
   *
   * @param headerName the name of the header to match against
   * @param headerValue The exact value to test against
   */
  public static valueIsNot(headerName: string, headerValue: string): HeaderMatch {
    return new HeaderMatchImpl(headerName, true, { exact: headerValue });
  }

  /**
   * The value of the header with the given name in the request must start with
   * the specified characters.
   *
   * @param headerName the name of the header to match against
   * @param prefix The prefix to test against
   */
  public static valueStartsWith(headerName: string, prefix: string): HeaderMatch {
    return new HeaderMatchImpl(headerName, false, { prefix });
  }

  /**
   * The value of the header with the given name in the request must not start
   * with the specified characters.
   *
   * @param headerName the name of the header to match against
   * @param prefix The prefix to test against
   */
  public static valueDoesNotStartWith(headerName: string, prefix: string): HeaderMatch {
    return new HeaderMatchImpl(headerName, true, { prefix });
  }

  /**
   * The value of the header with the given name in the request must end with
   * the specified characters.
   *
   * @param headerName the name of the header to match against
   * @param suffix The suffix to test against
   */
  public static valueEndsWith(headerName: string, suffix: string): HeaderMatch {
    return new HeaderMatchImpl(headerName, false, { suffix });
  }

  /**
   * The value of the header with the given name in the request must not end
   * with the specified characters.
   *
   * @param headerName the name of the header to match against
   * @param suffix The suffix to test against
   */
  public static valueDoesNotEndWith(headerName: string, suffix: string): HeaderMatch {
    return new HeaderMatchImpl(headerName, true, { suffix });
  }

  /**
   * The value of the header with the given name in the request must include
   * the specified characters.
   *
   * @param headerName the name of the header to match against
   * @param regex The regex to test against
   */
  public static valueMatchesRegex(headerName: string, regex: string): HeaderMatch {
    return new HeaderMatchImpl(headerName, false, { regex });
  }

  /**
   * The value of the header with the given name in the request must not
   * include the specified characters.
   *
   * @param headerName the name of the header to match against
   * @param regex The regex to test against
   */
  public static valueDoesNotMatchRegex(headerName: string, regex: string): HeaderMatch {
    return new HeaderMatchImpl(headerName, true, { regex });
  }

  /**
   * The value of the header with the given name in the request must be in a
   * range of values.
   *
   * @param headerName the name of the header to match against
   * @param start Match on values starting at and including this value
   * @param end Match on values up to but not including this value
   */
  public static valuesIsInRange(headerName: string, start: number, end: number): HeaderMatch {
    return new HeaderMatchImpl(headerName, false, {
      range: {
        start,
        end,
      },
    });
  }

  /**
   * The value of the header with the given name in the request must not be in
   * a range of values.
   *
   * @param headerName the name of the header to match against
   * @param start Match on values starting at and including this value
   * @param end Match on values up to but not including this value
   */
  public static valuesIsNotInRange(headerName: string, start: number, end: number): HeaderMatch {
    return new HeaderMatchImpl(headerName, true, {
      range: {
        start,
        end,
      },
    });
  }

  /**
   * Returns the header match configuration.
   */
  public abstract bind(scope: Construct): HeaderMatchConfig;
}

class HeaderMatchImpl extends HeaderMatch {
  constructor(
    private readonly headerName: string,
    private readonly invert: boolean,
    private readonly matchProperty: CfnRoute.HeaderMatchMethodProperty,
  ) {
    super();
  }

  bind(_scope: Construct): HeaderMatchConfig {
    return {
      headerMatch: {
        name: this.headerName,
        invert: this.invert,
        match: this.matchProperty,
      },
    };
  }
}
