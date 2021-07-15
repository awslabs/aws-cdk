import { CfnGatewayRoute, CfnRoute } from './appmesh.generated';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/**
 * The type returned from the `bind()` method in {@link HttpRoutePathMatch}.
 */
export interface HttpRoutePathMatchConfig {
  /**
   * Route configuration for matching on the complete URL path of the request.
   *
   * @default - no matching will be performed on the complete URL path
   */
  readonly wholePathMatch?: CfnRoute.HttpPathMatchProperty;

  /**
   * Route configuration for matching on the prefix of the URL path of the request.
   *
   * @default - no matching will be performed on the prefix of the URL path
   */
  readonly prefixPathMatch?: string;
}

/**
 * Defines HTTP route matching based on the URL path of the request.
 */
export abstract class HttpRoutePathMatch {
  /**
   * The value of the path must match the specified value exactly.
   * The provided `path` must start with the '/' character.
   *
   * @param path the exact path to match on
   */
  public static exactly(path: string): HttpRoutePathMatch {
    return new HttpRouteWholePathMatch({ exact: path });
  }

  /**
   * The value of the path must match the specified regex.
   *
   * @param regex the regex used to match the path
   */
  public static regex(regex: string): HttpRoutePathMatch {
    return new HttpRouteWholePathMatch({ regex: regex });
  }

  /**
   * The value of the path must match the specified prefix.
   *
   * @param prefix the value to use to match the beginning of the path part of the URL of the request.
   *   It must start with the '/' character. If provided as "/", matches all requests.
   *   For example, if your virtual service name is "my-service.local"
   *   and you want the route to match requests to "my-service.local/metrics", your prefix should be "/metrics".
   */
  public static startsWith(prefix: string): HttpRoutePathMatch {
    return new HttpRoutePrefixPathMatch(prefix);
  }

  /**
   * Returns the route path match configuration.
   */
  public abstract bind(scope: Construct): HttpRoutePathMatchConfig;
}

class HttpRoutePrefixPathMatch extends HttpRoutePathMatch {
  constructor(private readonly prefix: string) {
    super();

    if (prefix && prefix[0] !== '/') {
      throw new Error(`Prefix Path for the match must start with \'/\', got: ${prefix}`);
    }
  }

  bind(_scope: Construct): HttpRoutePathMatchConfig {
    return {
      prefixPathMatch: this.prefix,
    };
  }
}

class HttpRouteWholePathMatch extends HttpRoutePathMatch {
  constructor(private readonly match: CfnRoute.HttpPathMatchProperty) {
    super();

    if (match.exact && match.exact[0] !== '/') {
      throw new Error(`Exact Path for the match must start with \'/\', got: ${match.exact}`);
    }
  }

  bind(_scope: Construct): HttpRoutePathMatchConfig {
    return {
      wholePathMatch: this.match,
    };
  }
}

/**
 * The type returned from the `bind()` method in {@link HttpGatewayRoutePathMatch}.
 */
export interface HttpGatewayRoutePathMatchConfig {
  /**
   * Gateway route configuration for matching on the complete URL path of the request.
   *
   * @default - no matching will be performed on the complete URL path
   */
  readonly wholePathMatch?: CfnGatewayRoute.HttpPathMatchProperty;

  /**
   * Gateway route configuration for matching on the prefix of the URL path of the request.
   *
   * @default - no matching will be performed on the prefix of the URL path
   */
  readonly prefixPathMatch?: string;

  /**
   * Gateway route configuration for rewriting the complete URL path of the request..
   *
   * @default - no rewrite will be performed on the request's complete URL path
   */
  readonly wholePathRewrite?: CfnGatewayRoute.HttpGatewayRoutePathRewriteProperty;

  /**
   * Gateway route configuration for rewriting the prefix of the URL path of the request.
   *
   * @default - rewrites the request's URL path to '/'
   */
  readonly prefixPathRewrite?: CfnGatewayRoute.HttpGatewayRoutePrefixRewriteProperty;
}

/**
 * Defines HTTP gateway route matching based on the URL path of the request.
 */
export abstract class HttpGatewayRoutePathMatch {
  /**
   * The value of the path must match the specified prefix.
   *
   * @param prefix the value to use to match the beginning of the path part of the URL of the request.
   *   It must start with the '/' character.
   *   When `rewriteTo` is provided, it must also end with the '/' character.
   *   If provided as "/", matches all requests.
   *   For example, if your virtual service name is "my-service.local"
   *   and you want the route to match requests to "my-service.local/metrics", your prefix should be "/metrics".
   * @param rewriteTo Specify either disabling automatic rewrite or rewriting to specified prefix path.
   *   To disable automatic rewrite, provide `''`.
   *   As a default, request's URL path is automatically rewritten to '/'.
   */
  public static startsWith(prefix: string, rewriteTo?: string): HttpGatewayRoutePathMatch {
    return new HttpGatewayRoutePrefixPathMatch(prefix, rewriteTo);
  }

  /**
   * The value of the path must match the specified value exactly.
   * The provided `path` must start with the '/' character.
   *
   * @param path the exact path to match on
   * @param rewriteTo the value to substitute for the matched part of the path of the gateway request URL
   *   As a default, retains original request's URL path.
   */
  public static exactly(path: string, rewriteTo?: string): HttpGatewayRoutePathMatch {
    return new HttpGatewayRouteWholePathMatch({ exact: path }, rewriteTo);
  }

  /**
   * The value of the path must match the specified regex.
   *
   * @param regex the regex used to match the path
   * @param rewriteTo the value to substitute for the matched part of the path of the gateway request URL
   *   As a default, retains original request's URL path.
   */
  public static regex(regex: string, rewriteTo?: string): HttpGatewayRoutePathMatch {
    return new HttpGatewayRouteWholePathMatch({ regex }, rewriteTo);
  }

  /**
   * Returns the gateway route path match configuration.
   */
  public abstract bind(scope: Construct): HttpGatewayRoutePathMatchConfig;
}

class HttpGatewayRoutePrefixPathMatch extends HttpGatewayRoutePathMatch {
  constructor(
    private readonly prefixPathMatch: string,
    private readonly rewriteTo?: string,
  ) {
    super();

    if (prefixPathMatch[0] !== '/') {
      throw new Error('Prefix path for the match must start with \'/\', '
        + `got: ${prefixPathMatch}`);
    }

    if (rewriteTo) {
      if (prefixPathMatch[prefixPathMatch.length - 1] !== '/') {
        throw new Error('When prefix path for the rewrite is specified, prefix path for the match must end with \'/\', '
          + `got: ${prefixPathMatch}`);
      }
      if (rewriteTo[0] !== '/' || rewriteTo[rewriteTo.length - 1] !== '/') {
        throw new Error('Prefix path for the rewrite must start and end with \'/\', '
          + `got: ${rewriteTo}`);
      }
    }
  }

  bind(_scope: Construct): HttpGatewayRoutePathMatchConfig {
    return {
      prefixPathMatch: this.prefixPathMatch,
      prefixPathRewrite: this.rewriteTo === undefined
        ? undefined
        : {
          defaultPrefix: this.rewriteTo === '' ? 'DISABLED' : undefined,
          value: this.rewriteTo === '' ? undefined : this.rewriteTo,
        },
    };
  }
}

class HttpGatewayRouteWholePathMatch extends HttpGatewayRoutePathMatch {
  constructor(
    private readonly wholePathMatch: CfnGatewayRoute.HttpPathMatchProperty,
    private readonly exactPathRewrite?: string | undefined,
  ) {
    super();

    if (wholePathMatch.exact && wholePathMatch.exact[0] !== '/') {
      throw new Error(`Exact Path for the match must start with \'/\', got: ${ wholePathMatch.exact }`);
    }
    if (exactPathRewrite === '') {
      throw new Error('Exact Path for the rewrite cannot be empty. Unlike startsWith() method, no automatic rewrite on whole path match');
    }
    if (exactPathRewrite && exactPathRewrite[0] !== '/') {
      throw new Error(`Exact Path for the rewrite must start with \'/\', got: ${ exactPathRewrite }`);
    }
  }

  bind(_scope: Construct): HttpGatewayRoutePathMatchConfig {
    return {
      wholePathMatch: this.wholePathMatch,
      wholePathRewrite: this.exactPathRewrite === undefined ? undefined : { exact: this.exactPathRewrite },
    };
  }
}
