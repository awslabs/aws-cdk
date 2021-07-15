import { Construct } from 'constructs';
import { CfnGatewayRoute } from './appmesh.generated';
import { HeaderMatch } from './header-match';
import { HttpRouteMethod } from './http-route-method';
import { HttpGatewayRoutePathMatch } from './http-route-path-match';
import { validateGrpcMatchArrayLength, validateGrpcGatewayRouteMatch } from './private/utils';
import { QueryParameterMatch } from './query-parameter-match';
import { Protocol } from './shared-interfaces';
import { IVirtualService } from './virtual-service';

/**
 * Configuration for gateway route host name match.
 */
export interface GatewayRouteHostnameMatchConfig {
  /**
   * GatewayRoute CFN configuration for host name match.
   */
  readonly hostnameMatch: CfnGatewayRoute.GatewayRouteHostnameMatchProperty;
}

/**
 * Used to generate host name matching methods.
 */
export abstract class GatewayRouteHostnameMatch {
  /**
   * The value of the host name must match the specified value exactly.
   *
   * @param name The exact host name to match on
   */
  public static exactly(name: string): GatewayRouteHostnameMatch {
    return new GatewayRouteHostnameMatchImpl({ exact: name });
  }

  /**
   * The value of the host name with the given name must end with the specified characters.
   *
   * @param suffix The specified ending characters of the host name to match on
   */
  public static endsWith(suffix: string): GatewayRouteHostnameMatch {
    return new GatewayRouteHostnameMatchImpl({ suffix });
  }

  /**
   * Returns the gateway route host name match configuration.
   */
  public abstract bind(scope: Construct): GatewayRouteHostnameMatchConfig;
}

class GatewayRouteHostnameMatchImpl extends GatewayRouteHostnameMatch {
  constructor(
    private readonly matchProperty: CfnGatewayRoute.GatewayRouteHostnameMatchProperty,
  ) {
    super();
  }

  bind(_scope: Construct): GatewayRouteHostnameMatchConfig {
    return {
      hostnameMatch: this.matchProperty,
    };
  }
}

/**
 * The criterion for determining a request match for this GatewayRoute.
 */
export interface HttpGatewayRouteMatch {
  /**
   * Specify how to match requests based on the 'path' part of their URL.
   *
   * @default - matches requests with any path
   */
  readonly path?: HttpGatewayRoutePathMatch;

  /**
   * Specifies the client request headers to match on. All specified headers
   * must match for the gateway route to match.
   *
   * @default - do not match on headers
   */
  readonly headers?: HeaderMatch[];

  /**
   * The gateway route host name to be matched on.
   *
   * @default - do not match on host name
   */
  readonly hostname?: GatewayRouteHostnameMatch;

  /**
   * The method to match on.
   *
   * @default - do not match on method
   */
  readonly method?: HttpRouteMethod;

  /**
   * The query parameters to match on.
   * All specified query parameters must match for the route to match.
   *
   * @default - do not match on query parameters
   */
  readonly queryParameters?: QueryParameterMatch[];

  /**
   * When `true`, rewrites the original request received at the Virtual Gateway to the destination Virtual Service name.
   * When `false`, retains the original hostname from the request.
   *
   * @default true
   */
  readonly rewriteRequestHostname?: boolean;
}

/**
 * The criterion for determining a request match for this GatewayRoute
 */
export interface GrpcGatewayRouteMatch {
  /**
   * Create service name based gRPC gateway route match.
   *
   * @default - no matching on service name
   */
  readonly serviceName?: string;

  /**
   * Create host name based gRPC gateway route match.
   *
   * @default - no matching on host name
   */
  readonly hostname?: GatewayRouteHostnameMatch;

  /**
   * Create metadata based gRPC gateway route match.
   * All specified metadata must match for the route to match.
   *
   * @default - no matching on metadata
   */
  readonly metadata?: HeaderMatch[];

  /**
   * When `true`, rewrites the original request received at the Virtual Gateway to the destination Virtual Service name.
   * When `false`, retains the original hostname from the request.
   *
   * @default true
   */
  readonly rewriteRequestHostname?: boolean;
}

/**
 * Properties specific for HTTP Based GatewayRoutes
 */
export interface HttpGatewayRouteSpecOptions {
  /**
   * The criterion for determining a request match for this GatewayRoute.
   * When path match is defined, this may optionally determine the path rewrite configuration.
   *
   * @default - matches any path and automatically rewrites the path to '/'
   */
  readonly match?: HttpGatewayRouteMatch;

  /**
   * The VirtualService this GatewayRoute directs traffic to
   */
  readonly routeTarget: IVirtualService;
}

/**
 * Properties specific for a gRPC GatewayRoute
 */
export interface GrpcGatewayRouteSpecOptions {
  /**
   * The criterion for determining a request match for this GatewayRoute
   */
  readonly match: GrpcGatewayRouteMatch;

  /**
   * The VirtualService this GatewayRoute directs traffic to
   */
  readonly routeTarget: IVirtualService;
}

/**
 * All Properties for GatewayRoute Specs
 */
export interface GatewayRouteSpecConfig {
  /**
   * The spec for an http gateway route
   *
   * @default - no http spec
   */
  readonly httpSpecConfig?: CfnGatewayRoute.HttpGatewayRouteProperty;

  /**
   * The spec for an http2 gateway route
   *
   * @default - no http2 spec
   */
  readonly http2SpecConfig?: CfnGatewayRoute.HttpGatewayRouteProperty;

  /**
   * The spec for a grpc gateway route
   *
   * @default - no grpc spec
   */
  readonly grpcSpecConfig?: CfnGatewayRoute.GrpcGatewayRouteProperty;
}

/**
 * Used to generate specs with different protocols for a GatewayRoute
 */
export abstract class GatewayRouteSpec {
  /**
   * Creates an HTTP Based GatewayRoute
   *
   * @param options - no http gateway route
   */
  public static http(options: HttpGatewayRouteSpecOptions): GatewayRouteSpec {
    return new HttpGatewayRouteSpec(options, Protocol.HTTP);
  }

  /**
   * Creates an HTTP2 Based GatewayRoute
   *
   * @param options - no http2 gateway route
   */
  public static http2(options: HttpGatewayRouteSpecOptions): GatewayRouteSpec {
    return new HttpGatewayRouteSpec(options, Protocol.HTTP2);
  }

  /**
   * Creates an gRPC Based GatewayRoute
   *
   * @param options - no grpc gateway route
   */
  public static grpc(options: GrpcGatewayRouteSpecOptions): GatewayRouteSpec {
    return new GrpcGatewayRouteSpec(options);
  }

  /**
   * Called when the GatewayRouteSpec type is initialized. Can be used to enforce
   * mutual exclusivity with future properties
   */
  public abstract bind(scope: Construct): GatewayRouteSpecConfig;
}

class HttpGatewayRouteSpec extends GatewayRouteSpec {
  readonly match?: HttpGatewayRouteMatch;

  /**
   * The VirtualService this GatewayRoute directs traffic to
   */
  readonly routeTarget: IVirtualService;

  /**
   * Type of route you are creating
   */
  readonly routeType: Protocol;

  constructor(options: HttpGatewayRouteSpecOptions, protocol: Protocol.HTTP | Protocol.HTTP2) {
    super();
    this.routeTarget = options.routeTarget;
    this.routeType = protocol;
    this.match = options.match;
  }

  public bind(scope: Construct): GatewayRouteSpecConfig {
    const pathMatchConfig = (this.match?.path ?? HttpGatewayRoutePathMatch.startsWith('/')).bind(scope);
    const rewriteRequestHostname = this.match?.rewriteRequestHostname;

    const prefixPathRewrite = pathMatchConfig.prefixPathRewrite;
    const wholePathRewrite = pathMatchConfig.wholePathRewrite;

    const httpConfig: CfnGatewayRoute.HttpGatewayRouteProperty = {
      match: {
        prefix: pathMatchConfig.prefixPathMatch,
        path: pathMatchConfig.wholePathMatch,
        hostname: this.match?.hostname?.bind(scope).hostnameMatch,
        method: this.match?.method,
        headers: this.match?.headers?.map(header => header.bind(scope).headerMatch),
        queryParameters: this.match?.queryParameters?.map(queryParameter => queryParameter.bind(scope).queryParameterMatch),
      },
      action: {
        target: {
          virtualService: {
            virtualServiceName: this.routeTarget.virtualServiceName,
          },
        },
        rewrite: rewriteRequestHostname !== undefined || prefixPathRewrite || wholePathRewrite
          ? {
            hostname: rewriteRequestHostname === undefined
              ? undefined
              : {
                defaultTargetHostname: rewriteRequestHostname? 'ENABLED' : 'DISABLED',
              },
            prefix: prefixPathRewrite,
            path: wholePathRewrite,
          }
          : undefined,
      },
    };
    return {
      httpSpecConfig: this.routeType === Protocol.HTTP ? httpConfig : undefined,
      http2SpecConfig: this.routeType === Protocol.HTTP2 ? httpConfig : undefined,
    };
  }
}

class GrpcGatewayRouteSpec extends GatewayRouteSpec {
  readonly match: GrpcGatewayRouteMatch;

  /**
   * The VirtualService this GatewayRoute directs traffic to
   */
  readonly routeTarget: IVirtualService;

  constructor(options: GrpcGatewayRouteSpecOptions) {
    super();
    this.match = options.match;
    this.routeTarget = options.routeTarget;
  }

  public bind(scope: Construct): GatewayRouteSpecConfig {
    const metadataMatch = this.match.metadata;

    validateGrpcGatewayRouteMatch(this.match);
    validateGrpcMatchArrayLength(metadataMatch);

    return {
      grpcSpecConfig: {
        match: {
          serviceName: this.match.serviceName,
          hostname: this.match.hostname?.bind(scope).hostnameMatch,
          metadata: metadataMatch?.map(metadata => metadata.bind(scope).headerMatch),
        },
        action: {
          target: {
            virtualService: {
              virtualServiceName: this.routeTarget.virtualServiceName,
            },
          },
          rewrite: this.match.rewriteRequestHostname === undefined
            ? undefined
            : {
              hostname: {
                defaultTargetHostname: this.match.rewriteRequestHostname ? 'ENABLED' : 'DISABLED',
              },
            },
        },
      },
    };
  }
}
