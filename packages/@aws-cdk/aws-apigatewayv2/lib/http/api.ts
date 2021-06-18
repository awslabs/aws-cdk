import { Metric, MetricOptions } from '@aws-cdk/aws-cloudwatch';
import { Duration } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnApi, CfnApiProps } from '../apigatewayv2.generated';
import { IApi } from '../common/api';
import { ApiBase } from '../common/base';
import { DomainMappingOptions, IStage } from '../common/stage';
import { IHttpRouteAuthorizer } from './authorizer';
import { IHttpRouteIntegration, HttpIntegration, HttpRouteIntegrationConfig } from './integration';
import { BatchHttpRouteOptions, HttpMethod, HttpRoute, HttpRouteKey } from './route';
import { HttpStage, HttpStageOptions } from './stage';
import { VpcLink, VpcLinkProps } from './vpc-link';

/**
 * Represents an HTTP API
 */
export interface IHttpApi extends IApi {
  /**
   * The identifier of this API Gateway HTTP API.
   * @attribute
   * @deprecated - use apiId instead
   */
  readonly httpApiId: string;

  /**
   * Metric for the number of client-side errors captured in a given period.
   *
   * @default - sum over 5 minutes
   */
  metricClientError(props?: MetricOptions): Metric;

  /**
   * Metric for the number of server-side errors captured in a given period.
   *
   * @default - sum over 5 minutes
   */
  metricServerError(props?: MetricOptions): Metric;

  /**
   * Metric for the amount of data processed in bytes.
   *
   * @default - sum over 5 minutes
   */
  metricDataProcessed(props?: MetricOptions): Metric;

  /**
   * Metric for the total number API requests in a given period.
   *
   * @default - SampleCount over 5 minutes
   */
  metricCount(props?: MetricOptions): Metric;

  /**
   * Metric for the time between when API Gateway relays a request to the backend
   * and when it receives a response from the backend.
   *
   * @default - no statistic
   */
  metricIntegrationLatency(props?: MetricOptions): Metric;

  /**
   * The time between when API Gateway receives a request from a client
   * and when it returns a response to the client.
   * The latency includes the integration latency and other API Gateway overhead.
   *
   * @default - no statistic
   */
  metricLatency(props?: MetricOptions): Metric;

  /**
   * Add a new VpcLink
   */
  addVpcLink(options: VpcLinkProps): VpcLink

  /**
   * Add a http integration
   * @internal
   */
  _addIntegration(scope: Construct, config: HttpRouteIntegrationConfig): HttpIntegration;
}

/**
 * Properties to initialize an instance of `HttpApi`.
 */
export interface HttpApiProps {
  /**
   * Name for the HTTP API resoruce
   * @default - id of the HttpApi construct.
   */
  readonly apiName?: string;

  /**
   * The description of the API.
   * @default - none
   */
  readonly description?: string;

  /**
   * An integration that will be configured on the catch-all route ($default).
   * @default - none
   */
  readonly defaultIntegration?: IHttpRouteIntegration;

  /**
   * Whether a default stage and deployment should be automatically created.
   * @default true
   */
  readonly createDefaultStage?: boolean;

  /**
   * Specifies a CORS configuration for an API.
   * @see https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-cors.html
   * @default - CORS disabled.
   */
  readonly corsPreflight?: CorsPreflightOptions;

  /**
   * Configure a custom domain with the API mapping resource to the HTTP API
   *
   * @default - no default domain mapping configured. meaningless if `createDefaultStage` is `false`.
   */
  readonly defaultDomainMapping?: DomainMappingOptions;

  /**
   * Specifies whether clients can invoke your API using the default endpoint.
   * By default, clients can invoke your API with the default
   * `https://{api_id}.execute-api.{region}.amazonaws.com` endpoint. Enable
   * this if you would like clients to use your custom domain name.
   * @default false execute-api endpoint enabled.
   */
  readonly disableExecuteApiEndpoint?: boolean;

  /**
   * Default Authorizer to applied to all routes in the gateway
   *
   * @default - No authorizer
   */
  readonly defaultAuthorizer?: IHttpRouteAuthorizer;

  /**
   * Default OIDC scopes attached to all routes in the gateway, unless explicitly configured on the route.
   *
   * @default - no default authorization scopes
   */
  readonly defaultAuthorizationScopes?: string[];
}

/**
 * Supported CORS HTTP methods
 */
export enum CorsHttpMethod{
  /** HTTP ANY */
  ANY = '*',
  /** HTTP DELETE */
  DELETE = 'DELETE',
  /** HTTP GET */
  GET = 'GET',
  /** HTTP HEAD */
  HEAD = 'HEAD',
  /** HTTP OPTIONS */
  OPTIONS = 'OPTIONS',
  /** HTTP PATCH */
  PATCH = 'PATCH',
  /** HTTP POST */
  POST = 'POST',
  /** HTTP PUT */
  PUT = 'PUT',
}

/**
 * Options for the CORS Configuration
 */
export interface CorsPreflightOptions {
  /**
   * Specifies whether credentials are included in the CORS request.
   * @default false
   */
  readonly allowCredentials?: boolean;

  /**
   * Represents a collection of allowed headers.
   * @default - No Headers are allowed.
   */
  readonly allowHeaders?: string[];

  /**
   * Represents a collection of allowed HTTP methods.
   * @default - No Methods are allowed.
   */
  readonly allowMethods?: CorsHttpMethod[];

  /**
   * Represents a collection of allowed origins.
   * @default - No Origins are allowed.
   */
  readonly allowOrigins?: string[];

  /**
   * Represents a collection of exposed headers.
   * @default - No Expose Headers are allowed.
   */
  readonly exposeHeaders?: string[];

  /**
   * The duration that the browser should cache preflight request results.
   * @default Duration.seconds(0)
   */
  readonly maxAge?: Duration;
}

/**
 * Options for the Route with Integration resoruce
 */
export interface AddRoutesOptions extends BatchHttpRouteOptions {
  /**
   * The path at which all of these routes are configured.
   */
  readonly path: string;

  /**
   * The HTTP methods to be configured
   * @default HttpMethod.ANY
   */
  readonly methods?: HttpMethod[];

  /**
   * Authorizer to be associated to these routes.
   *
   * Use NoneAuthorizer to remove the default authorizer for the api
   *
   * @default - uses the default authorizer if one is specified on the HttpApi
   */
  readonly authorizer?: IHttpRouteAuthorizer;

  /**
   * The list of OIDC scopes to include in the authorization.
   *
   * These scopes will override the default authorization scopes on the gateway.
   * Set to [] to remove default scopes
   *
   * @default - uses defaultAuthorizationScopes if configured on the API, otherwise none.
   */
  readonly authorizationScopes?: string[];
}

abstract class HttpApiBase extends ApiBase implements IHttpApi { // note that this is not exported
  public abstract readonly apiId: string;
  public abstract readonly httpApiId: string;
  public abstract readonly apiEndpoint: string;
  private vpcLinks: Record<string, VpcLink> = {};

  public metricClientError(props?: MetricOptions): Metric {
    return this.metric('4xx', { statistic: 'Sum', ...props });
  }

  public metricServerError(props?: MetricOptions): Metric {
    return this.metric('5xx', { statistic: 'Sum', ...props });
  }

  public metricDataProcessed(props?: MetricOptions): Metric {
    return this.metric('DataProcessed', { statistic: 'Sum', ...props });
  }

  public metricCount(props?: MetricOptions): Metric {
    return this.metric('Count', { statistic: 'SampleCount', ...props });
  }

  public metricIntegrationLatency(props?: MetricOptions): Metric {
    return this.metric('IntegrationLatency', props);
  }

  public metricLatency(props?: MetricOptions): Metric {
    return this.metric('Latency', props);
  }

  public addVpcLink(options: VpcLinkProps): VpcLink {
    const { vpcId } = options.vpc;
    if (vpcId in this.vpcLinks) {
      return this.vpcLinks[vpcId];
    }

    const count = Object.keys(this.vpcLinks).length + 1;
    const vpcLink = new VpcLink(this, `VpcLink-${count}`, options);
    this.vpcLinks[vpcId] = vpcLink;

    return vpcLink;
  }

  /**
   * @internal
   */
  public _addIntegration(scope: Construct, config: HttpRouteIntegrationConfig): HttpIntegration {
    const { configHash, integration: existingIntegration } = this._integrationCache.getIntegration(scope, config);
    if (existingIntegration) {
      return existingIntegration as HttpIntegration;
    }

    const integration = new HttpIntegration(scope, `HttpIntegration-${configHash}`, {
      httpApi: this,
      integrationType: config.type,
      integrationUri: config.uri,
      method: config.method,
      connectionId: config.connectionId,
      connectionType: config.connectionType,
      payloadFormatVersion: config.payloadFormatVersion,
    });
    this._integrationCache.saveIntegration(scope, config, integration);

    return integration;
  }
}

/**
 * Attributes for importing an HttpApi into the CDK
 */
export interface HttpApiAttributes {
  /**
   * The identifier of the HttpApi
   */
  readonly httpApiId: string;
  /**
   * The endpoint URL of the HttpApi
   * @default - throws an error if apiEndpoint is accessed.
   */
  readonly apiEndpoint?: string;
}

/**
 * Create a new API Gateway HTTP API endpoint.
 * @resource AWS::ApiGatewayV2::Api
 */
export class HttpApi extends HttpApiBase {
  /**
   * Import an existing HTTP API into this CDK app.
   */
  public static fromHttpApiAttributes(scope: Construct, id: string, attrs: HttpApiAttributes): IHttpApi {
    class Import extends HttpApiBase {
      public readonly apiId = attrs.httpApiId;
      public readonly httpApiId = attrs.httpApiId;
      private readonly _apiEndpoint = attrs.apiEndpoint;

      public get apiEndpoint(): string {
        if (!this._apiEndpoint) {
          throw new Error('apiEndpoint is not configured on the imported HttpApi.');
        }
        return this._apiEndpoint;
      }
    }
    return new Import(scope, id);
  }

  /**
   * A human friendly name for this HTTP API. Note that this is different from `httpApiId`.
   */
  public readonly httpApiName?: string;
  public readonly apiId: string;
  public readonly httpApiId: string;

  /**
   * Specifies whether clients can invoke this HTTP API by using the default execute-api endpoint.
   */
  public readonly disableExecuteApiEndpoint?: boolean;

  /**
   * The default stage of this API
   */
  public readonly defaultStage: IStage | undefined;

  private readonly _apiEndpoint: string;

  private readonly defaultAuthorizer?: IHttpRouteAuthorizer;
  private readonly defaultAuthorizationScopes?: string[];

  constructor(scope: Construct, id: string, props?: HttpApiProps) {
    super(scope, id);

    this.httpApiName = props?.apiName ?? id;
    this.disableExecuteApiEndpoint = props?.disableExecuteApiEndpoint;

    let corsConfiguration: CfnApi.CorsProperty | undefined;
    if (props?.corsPreflight) {
      const cors = props.corsPreflight;
      if (cors.allowOrigins && cors.allowOrigins.includes('*') && cors.allowCredentials) {
        throw new Error("CORS preflight - allowCredentials is not supported when allowOrigin is '*'");
      }
      const {
        allowCredentials,
        allowHeaders,
        allowMethods,
        allowOrigins,
        exposeHeaders,
        maxAge,
      } = props.corsPreflight;
      corsConfiguration = {
        allowCredentials,
        allowHeaders,
        allowMethods,
        allowOrigins,
        exposeHeaders,
        maxAge: maxAge?.toSeconds(),
      };
    }

    const apiProps: CfnApiProps = {
      name: this.httpApiName,
      protocolType: 'HTTP',
      corsConfiguration,
      description: props?.description,
      disableExecuteApiEndpoint: this.disableExecuteApiEndpoint,
    };

    const resource = new CfnApi(this, 'Resource', apiProps);
    this.apiId = resource.ref;
    this.httpApiId = resource.ref;
    this._apiEndpoint = resource.attrApiEndpoint;
    this.defaultAuthorizer = props?.defaultAuthorizer;
    this.defaultAuthorizationScopes = props?.defaultAuthorizationScopes;

    if (props?.defaultIntegration) {
      new HttpRoute(this, 'DefaultRoute', {
        httpApi: this,
        routeKey: HttpRouteKey.DEFAULT,
        integration: props.defaultIntegration,
        authorizer: props.defaultAuthorizer,
        authorizationScopes: props.defaultAuthorizationScopes,
      });
    }

    if (props?.createDefaultStage === undefined || props.createDefaultStage === true) {
      this.defaultStage = new HttpStage(this, 'DefaultStage', {
        httpApi: this,
        autoDeploy: true,
        domainMapping: props?.defaultDomainMapping,
      });

      // to ensure the domain is ready before creating the default stage
      if (props?.defaultDomainMapping) {
        this.defaultStage.node.addDependency(props.defaultDomainMapping.domainName);
      }
    }

    if (props?.createDefaultStage === false && props.defaultDomainMapping) {
      throw new Error('defaultDomainMapping not supported with createDefaultStage disabled',
      );
    }
  }

  /**
   * Get the default endpoint for this API.
   */
  public get apiEndpoint(): string {
    if (this.disableExecuteApiEndpoint) {
      throw new Error('apiEndpoint is not accessible when disableExecuteApiEndpoint is set to true.');
    }
    return this._apiEndpoint;
  }

  /**
   * Get the URL to the default stage of this API.
   * Returns `undefined` if `createDefaultStage` is unset.
   */
  public get url(): string | undefined {
    return this.defaultStage ? this.defaultStage.url : undefined;
  }

  /**
   * Add a new stage.
   */
  public addStage(id: string, options: HttpStageOptions): HttpStage {
    const stage = new HttpStage(this, id, {
      httpApi: this,
      ...options,
    });
    return stage;
  }

  /**
   * Add multiple routes that uses the same configuration. The routes all go to the same path, but for different
   * methods.
   */
  public addRoutes(options: AddRoutesOptions): HttpRoute[] {
    const methods = options.methods ?? [HttpMethod.ANY];
    return methods.map((method) => {
      const authorizationScopes = options.authorizationScopes ?? this.defaultAuthorizationScopes;

      return new HttpRoute(this, `${method}${options.path}`, {
        httpApi: this,
        routeKey: HttpRouteKey.with(options.path, method),
        integration: options.integration,
        authorizer: options.authorizer ?? this.defaultAuthorizer,
        authorizationScopes,
      });
    });
  }
}
