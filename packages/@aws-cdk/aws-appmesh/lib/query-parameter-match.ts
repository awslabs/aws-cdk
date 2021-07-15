import { CfnRoute } from './appmesh.generated';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/**
 * Configuration for `QueryParameterMatch`
 */
export interface QueryParameterMatchConfig {
  /**
   * Route CFN configuration for route query parameter match.
   */
  readonly queryParameterMatch: CfnRoute.QueryParameterProperty;
}

/**
 * Used to generate query parameter matching methods.
 */
export abstract class QueryParameterMatch {
  /**
   * The value of the query parameter with the given name in the request must match the
   * specified value exactly.
   *
   * @param queryParameterName the name of the query parameter to match against
   * @param queryParameterValue The exact value to test against
   */
  static valueIs(queryParameterName: string, queryParameterValue: string): QueryParameterMatch {
    return new QueryParameterMatchImpl(queryParameterName, { exact: queryParameterValue });
  }

  /**
   * Returns the query parameter match configuration.
   */
  public abstract bind(scope: Construct): QueryParameterMatchConfig;
}

class QueryParameterMatchImpl extends QueryParameterMatch {
  constructor(
    private readonly queryParameterName: string,
    private readonly matchProperty: CfnRoute.HttpQueryParameterMatchProperty,
  ) {
    super();
  }

  bind(_scope: Construct): QueryParameterMatchConfig {
    return {
      queryParameterMatch: {
        match: this.matchProperty,
        name: this.queryParameterName,
      },
    };
  }
}
