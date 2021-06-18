import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import { IVpcEndpoint } from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import { CfnOutput, IResource as IResourceBase, Resource, Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { ApiDefinition } from './api-definition';
import { ApiKey, ApiKeyOptions, IApiKey } from './api-key';
import { ApiGatewayMetrics } from './apigateway-canned-metrics.generated';
import { CfnAccount, CfnRestApi } from './apigateway.generated';
import { CorsOptions } from './cors';
import { Deployment } from './deployment';
import { DomainName, DomainNameOptions } from './domain-name';
import { GatewayResponse, GatewayResponseOptions } from './gateway-response';
import { Integration } from './integration';
import { Method, MethodOptions } from './method';
import { Model, ModelOptions } from './model';
import { RequestValidator, RequestValidatorOptions } from './requestvalidator';
import { IResource, ResourceBase, ResourceOptions } from './resource';
import { Stage, StageOptions } from './stage';
import { UsagePlan, UsagePlanProps } from './usage-plan';

const RESTAPI_SYMBOL = Symbol.for('@aws-cdk/aws-apigateway.RestApiBase');

export interface IRestApi extends IResourceBase {
  /**
   * The ID of this API Gateway RestApi.
   * @attribute
   */
  readonly restApiId: string;

  /**
   * The resource ID of the root resource.
   * @attribute
   */
  readonly restApiRootResourceId: string;

  /**
   * API Gateway deployment that represents the latest changes of the API.
   * This resource will be automatically updated every time the REST API model changes.
   * `undefined` when no deployment is configured.
   */
  readonly latestDeployment?: Deployment;

  /**
   * API Gateway stage that points to the latest deployment (if defined).
   */
  deploymentStage: Stage;

  /**
   * Represents the root resource ("/") of this API. Use it to define the API model:
   *
   *    api.root.addMethod('ANY', redirectToHomePage); // "ANY /"
   *    api.root.addResource('friends').addMethod('GET', getFriendsHandler); // "GET /friends"
   *
   */
  readonly root: IResource;

  /**
   * Gets the "execute-api" ARN
   * @returns The "execute-api" ARN.
   * @default "*" returns the execute API ARN for all methods/resources in
   * this API.
   * @param method The method (default `*`)
   * @param path The resource path. Must start with '/' (default `*`)
   * @param stage The stage (default `*`)
   */
  arnForExecuteApi(method?: string, path?: string, stage?: string): string;
}

/**
 * Represents the props that all Rest APIs share
 */
export interface RestApiBaseProps {
  /**
   * Indicates if a Deployment should be automatically created for this API,
   * and recreated when the API model (resources, methods) changes.
   *
   * Since API Gateway deployments are immutable, When this option is enabled
   * (by default), an AWS::ApiGateway::Deployment resource will automatically
   * created with a logical ID that hashes the API model (methods, resources
   * and options). This means that when the model changes, the logical ID of
   * this CloudFormation resource will change, and a new deployment will be
   * created.
   *
   * If this is set, `latestDeployment` will refer to the `Deployment` object
   * and `deploymentStage` will refer to a `Stage` that points to this
   * deployment. To customize the stage options, use the `deployOptions`
   * property.
   *
   * A CloudFormation Output will also be defined with the root URL endpoint
   * of this REST API.
   *
   * @default true
   */
  readonly deploy?: boolean;

  /**
   * Options for the API Gateway stage that will always point to the latest
   * deployment when `deploy` is enabled. If `deploy` is disabled,
   * this value cannot be set.
   *
   * @default - Based on defaults of `StageOptions`.
   */
  readonly deployOptions?: StageOptions;

  /**
   * Retains old deployment resources when the API changes. This allows
   * manually reverting stages to point to old deployments via the AWS
   * Console.
   *
   * @default false
   */
  readonly retainDeployments?: boolean;

  /**
   * A name for the API Gateway RestApi resource.
   *
   * @default - ID of the RestApi construct.
   */
  readonly restApiName?: string;

  /**
   * Custom header parameters for the request.
   * @see https://docs.aws.amazon.com/cli/latest/reference/apigateway/import-rest-api.html
   *
   * @default - No parameters.
   */
  readonly parameters?: { [key: string]: string };

  /**
   * A policy document that contains the permissions for this RestApi
   *
   * @default - No policy.
   */
  readonly policy?: iam.PolicyDocument;

  /**
   * Indicates whether to roll back the resource if a warning occurs while API
   * Gateway is creating the RestApi resource.
   *
   * @default false
   */
  readonly failOnWarnings?: boolean;

  /**
   * Configure a custom domain name and map it to this API.
   *
   * @default - no domain name is defined, use `addDomainName` or directly define a `DomainName`.
   */
  readonly domainName?: DomainNameOptions;

  /**
   * Automatically configure an AWS CloudWatch role for API Gateway.
   *
   * @default true
   */
  readonly cloudWatchRole?: boolean;

  /**
   * Export name for the CfnOutput containing the API endpoint
   *
   * @default - when no export name is given, output will be created without export
   */
  readonly endpointExportName?: string;

  /**
   * A list of the endpoint types of the API. Use this property when creating
   * an API.
   *
   * @default EndpointType.EDGE
   */
  readonly endpointTypes?: EndpointType[];

  /**
   * Specifies whether clients can invoke the API using the default execute-api
   * endpoint. To require that clients use a custom domain name to invoke the
   * API, disable the default endpoint.
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-apigateway-restapi.html
   *
   * @default false
   */
  readonly disableExecuteApiEndpoint?: boolean;
}

/**
 * Represents the props that all Rest APIs share.
 * @deprecated - superseded by `RestApiBaseProps`
 */
export interface RestApiOptions extends RestApiBaseProps, ResourceOptions {
}

/**
 * Props to create a new instance of RestApi
 */
export interface RestApiProps extends RestApiOptions {
  /**
   * A description of the purpose of this API Gateway RestApi resource.
   *
   * @default - No description.
   */
  readonly description?: string;

  /**
   * The list of binary media mime-types that are supported by the RestApi
   * resource, such as "image/png" or "application/octet-stream"
   *
   * @default - RestApi supports only UTF-8-encoded text payloads.
   */
  readonly binaryMediaTypes?: string[];

  /**
   * A nullable integer that is used to enable compression (with non-negative
   * between 0 and 10485760 (10M) bytes, inclusive) or disable compression
   * (when undefined) on an API. When compression is enabled, compression or
   * decompression is not applied on the payload if the payload size is
   * smaller than this value. Setting it to zero allows compression for any
   * payload size.
   *
   * @default - Compression is disabled.
   */
  readonly minimumCompressionSize?: number;

  /**
   * The ID of the API Gateway RestApi resource that you want to clone.
   *
   * @default - None.
   */
  readonly cloneFrom?: IRestApi;

  /**
   * The source of the API key for metering requests according to a usage
   * plan.
   *
   * @default - Metering is disabled.
   */
  readonly apiKeySourceType?: ApiKeySourceType;

  /**
   * The EndpointConfiguration property type specifies the endpoint types of a REST API
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-apigateway-restapi-endpointconfiguration.html
   *
   * @default EndpointType.EDGE
   */
  readonly endpointConfiguration?: EndpointConfiguration;
}

/**
 * Props to instantiate a new SpecRestApi
 */
export interface SpecRestApiProps extends RestApiBaseProps {
  /**
   * An OpenAPI definition compatible with API Gateway.
   * @see https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-import-api.html
   */
  readonly apiDefinition: ApiDefinition;
}

/**
 * Base implementation that are common to various implementations of IRestApi
 */
export abstract class RestApiBase extends Resource implements IRestApi {
  /**
   * Checks if the given object is an instance of RestApiBase.
   * @internal
   */
  public static _isRestApiBase(x: any): x is RestApiBase {
    return x !== null && typeof(x) === 'object' && RESTAPI_SYMBOL in x;
  }

  /**
   * API Gateway deployment that represents the latest changes of the API.
   * This resource will be automatically updated every time the REST API model changes.
   * This will be undefined if `deploy` is false.
   */
  public get latestDeployment() {
    return this._latestDeployment;
  }

  /**
   * The first domain name mapped to this API, if defined through the `domainName`
   * configuration prop, or added via `addDomainName`
   */
  public get domainName() {
    return this._domainName;
  }

  /**
   * The ID of this API Gateway RestApi.
   */
  public abstract readonly restApiId: string;

  /**
   * The resource ID of the root resource.
   *
   * @attribute
   */
  public abstract readonly restApiRootResourceId: string;

  /**
   * Represents the root resource of this API endpoint ('/').
   * Resources and Methods are added to this resource.
   */
  public abstract readonly root: IResource;

  /**
   * API Gateway stage that points to the latest deployment (if defined).
   *
   * If `deploy` is disabled, you will need to explicitly assign this value in order to
   * set up integrations.
   */
  public deploymentStage!: Stage;

  /**
   * A human friendly name for this Rest API. Note that this is different from `restApiId`.
   */
  public readonly restApiName: string;

  private _latestDeployment?: Deployment;
  private _domainName?: DomainName;

  constructor(scope: Construct, id: string, props: RestApiBaseProps = { }) {
    super(scope, id);
    this.restApiName = props.restApiName ?? id;

    Object.defineProperty(this, RESTAPI_SYMBOL, { value: true });
  }

  /**
   * Returns the URL for an HTTP path.
   *
   * Fails if `deploymentStage` is not set either by `deploy` or explicitly.
   */
  public urlForPath(path: string = '/'): string {
    if (!this.deploymentStage) {
      throw new Error('Cannot determine deployment stage for API from "deploymentStage". Use "deploy" or explicitly set "deploymentStage"');
    }

    return this.deploymentStage.urlForPath(path);
  }

  /**
   * Defines an API Gateway domain name and maps it to this API.
   * @param id The construct id
   * @param options custom domain options
   */
  public addDomainName(id: string, options: DomainNameOptions): DomainName {
    const domainName = new DomainName(this, id, {
      ...options,
      mapping: this,
    });
    if (!this._domainName) {
      this._domainName = domainName;
    }
    return domainName;
  }

  /**
   * Adds a usage plan.
   */
  public addUsagePlan(id: string, props: UsagePlanProps = {}): UsagePlan {
    return new UsagePlan(this, id, props);
  }

  public arnForExecuteApi(method: string = '*', path: string = '/*', stage: string = '*') {
    if (!path.startsWith('/')) {
      throw new Error(`"path" must begin with a "/": '${path}'`);
    }

    if (method.toUpperCase() === 'ANY') {
      method = '*';
    }

    return Stack.of(this).formatArn({
      service: 'execute-api',
      resource: this.restApiId,
      sep: '/',
      resourceName: `${stage}/${method}${path}`,
    });
  }

  /**
   * Adds a new gateway response.
   */
  public addGatewayResponse(id: string, options: GatewayResponseOptions): GatewayResponse {
    return new GatewayResponse(this, id, {
      restApi: this,
      ...options,
    });
  }

  /**
   * Add an ApiKey
   */
  public addApiKey(id: string, options?: ApiKeyOptions): IApiKey {
    return new ApiKey(this, id, {
      resources: [this],
      ...options,
    });
  }

  /**
   * Returns the given named metric for this API
   */
  public metric(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName,
      dimensions: { ApiName: this.restApiName },
      ...props,
    }).attachTo(this);
  }

  /**
   * Metric for the number of client-side errors captured in a given period.
   *
   * Default: sum over 5 minutes
   */
  public metricClientError(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.cannedMetric(ApiGatewayMetrics._4XxErrorSum, props);
  }

  /**
   * Metric for the number of server-side errors captured in a given period.
   *
   * Default: sum over 5 minutes
   */
  public metricServerError(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.cannedMetric(ApiGatewayMetrics._5XxErrorSum, props);
  }

  /**
   * Metric for the number of requests served from the API cache in a given period.
   *
   * Default: sum over 5 minutes
   */
  public metricCacheHitCount(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.cannedMetric(ApiGatewayMetrics.cacheHitCountSum, props);
  }

  /**
   * Metric for the number of requests served from the backend in a given period,
   * when API caching is enabled.
   *
   * Default: sum over 5 minutes
   */
  public metricCacheMissCount(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.cannedMetric(ApiGatewayMetrics.cacheMissCountSum, props);
  }

  /**
   * Metric for the total number API requests in a given period.
   *
   * Default: sample count over 5 minutes
   */
  public metricCount(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.cannedMetric(ApiGatewayMetrics.countSum, {
      statistic: 'SampleCount',
      ...props,
    });
  }

  /**
   * Metric for the time between when API Gateway relays a request to the backend
   * and when it receives a response from the backend.
   *
   * Default: average over 5 minutes.
   */
  public metricIntegrationLatency(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.cannedMetric(ApiGatewayMetrics.integrationLatencyAverage, props);
  }

  /**
   * The time between when API Gateway receives a request from a client
   * and when it returns a response to the client.
   * The latency includes the integration latency and other API Gateway overhead.
   *
   * Default: average over 5 minutes.
   */
  public metricLatency(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.cannedMetric(ApiGatewayMetrics.latencyAverage, props);
  }

  /**
   * Internal API used by `Method` to keep an inventory of methods at the API
   * level for validation purposes.
   *
   * @internal
   */
  public _attachMethod(method: Method) {
    ignore(method);
  }

  /**
   * Associates a Deployment resource with this REST API.
   *
   * @internal
   */
  public _attachDeployment(deployment: Deployment) {
    ignore(deployment);
  }

  /**
   * @internal
   */
  protected _configureCloudWatchRole(apiResource: CfnRestApi) {
    const role = new iam.Role(this, 'CloudWatchRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonAPIGatewayPushToCloudWatchLogs')],
    });

    const resource = new CfnAccount(this, 'Account', {
      cloudWatchRoleArn: role.roleArn,
    });

    resource.node.addDependency(apiResource);
  }

  /**
   * @deprecated This method will be made internal. No replacement
   */
  protected configureCloudWatchRole(apiResource: CfnRestApi) {
    this._configureCloudWatchRole(apiResource);
  }

  /**
   * @deprecated This method will be made internal. No replacement
   */
  protected configureDeployment(props: RestApiBaseProps) {
    this._configureDeployment(props);
  }

  /**
   * @internal
   */
  protected _configureDeployment(props: RestApiBaseProps) {
    const deploy = props.deploy ?? true;
    if (deploy) {
      this._latestDeployment = new Deployment(this, 'Deployment', {
        description: 'Automatically created by the RestApi construct',
        api: this,
        retainDeployments: props.retainDeployments,
      });

      // encode the stage name into the construct id, so if we change the stage name, it will recreate a new stage.
      // stage name is part of the endpoint, so that makes sense.
      const stageName = (props.deployOptions && props.deployOptions.stageName) || 'prod';

      this.deploymentStage = new Stage(this, `DeploymentStage.${stageName}`, {
        deployment: this._latestDeployment,
        ...props.deployOptions,
      });

      new CfnOutput(this, 'Endpoint', { exportName: props.endpointExportName, value: this.urlForPath() });
    } else {
      if (props.deployOptions) {
        throw new Error('Cannot set \'deployOptions\' if \'deploy\' is disabled');
      }
    }
  }

  /**
   * @internal
   */
  protected _configureEndpoints(props: RestApiProps): CfnRestApi.EndpointConfigurationProperty | undefined {
    if (props.endpointTypes && props.endpointConfiguration) {
      throw new Error('Only one of the RestApi props, endpointTypes or endpointConfiguration, is allowed');
    }
    if (props.endpointConfiguration) {
      return {
        types: props.endpointConfiguration.types,
        vpcEndpointIds: props.endpointConfiguration?.vpcEndpoints?.map(vpcEndpoint => vpcEndpoint.vpcEndpointId),
      };
    }
    if (props.endpointTypes) {
      return { types: props.endpointTypes };
    }
    return undefined;
  }

  private cannedMetric(fn: (dims: { ApiName: string }) => cloudwatch.MetricProps, props?: cloudwatch.MetricOptions) {
    return new cloudwatch.Metric({
      ...fn({ ApiName: this.restApiName }),
      ...props,
    }).attachTo(this);
  }
}

/**
 * Represents a REST API in Amazon API Gateway, created with an OpenAPI specification.
 *
 * Some properties normally accessible on @see {@link RestApi} - such as the description -
 * must be declared in the specification. All Resources and Methods need to be defined as
 * part of the OpenAPI specification file, and cannot be added via the CDK.
 *
 * By default, the API will automatically be deployed and accessible from a
 * public endpoint.
 *
 *
 * @resource AWS::ApiGateway::RestApi
 */
export class SpecRestApi extends RestApiBase {
  /**
   * The ID of this API Gateway RestApi.
   */
  public readonly restApiId: string;

  /**
   * The resource ID of the root resource.
   *
   * @attribute
   */
  public readonly restApiRootResourceId: string;

  public readonly root: IResource;

  constructor(scope: Construct, id: string, props: SpecRestApiProps) {
    super(scope, id, props);
    const apiDefConfig = props.apiDefinition.bind(this);
    const resource = new CfnRestApi(this, 'Resource', {
      name: this.restApiName,
      policy: props.policy,
      failOnWarnings: props.failOnWarnings,
      body: apiDefConfig.inlineDefinition ?? undefined,
      bodyS3Location: apiDefConfig.inlineDefinition ? undefined : apiDefConfig.s3Location,
      endpointConfiguration: this._configureEndpoints(props),
      parameters: props.parameters,
    });
    this.node.defaultChild = resource;
    this.restApiId = resource.ref;
    this.restApiRootResourceId = resource.attrRootResourceId;
    this.root = new RootResource(this, {}, this.restApiRootResourceId);

    this._configureDeployment(props);
    if (props.domainName) {
      this.addDomainName('CustomDomain', props.domainName);
    }

    const cloudWatchRole = props.cloudWatchRole ?? true;
    if (cloudWatchRole) {
      this._configureCloudWatchRole(resource);
    }
  }
}

/**
 * Attributes that can be specified when importing a RestApi
 */
export interface RestApiAttributes {
  /**
   * The ID of the API Gateway RestApi.
   */
  readonly restApiId: string;

  /**
   * The resource ID of the root resource.
   */
  readonly rootResourceId: string;
}

/**
 * Represents a REST API in Amazon API Gateway.
 *
 * Use `addResource` and `addMethod` to configure the API model.
 *
 * By default, the API will automatically be deployed and accessible from a
 * public endpoint.
 */
export class RestApi extends RestApiBase {
  /**
   * Import an existing RestApi.
   */
  public static fromRestApiId(scope: Construct, id: string, restApiId: string): IRestApi {
    class Import extends RestApiBase {
      public readonly restApiId = restApiId;

      public get root(): IResource {
        throw new Error('root is not configured when imported using `fromRestApiId()`. Use `fromRestApiAttributes()` API instead.');
      }

      public get restApiRootResourceId(): string {
        throw new Error('restApiRootResourceId is not configured when imported using `fromRestApiId()`. Use `fromRestApiAttributes()` API instead.');
      }
    }

    return new Import(scope, id);
  }

  /**
   * Import an existing RestApi that can be configured with additional Methods and Resources.
   */
  public static fromRestApiAttributes(scope: Construct, id: string, attrs: RestApiAttributes): IRestApi {
    class Import extends RestApiBase {
      public readonly restApiId = attrs.restApiId;
      public readonly restApiRootResourceId = attrs.rootResourceId;
      public readonly root: IResource = new RootResource(this, {}, this.restApiRootResourceId);
    }

    return new Import(scope, id);
  }

  public readonly restApiId: string;

  public readonly root: IResource;

  public readonly restApiRootResourceId: string;

  /**
   * The list of methods bound to this RestApi
   */
  public readonly methods = new Array<Method>();

  /**
   * This list of deployments bound to this RestApi
   */
  private readonly deployments = new Array<Deployment>();

  constructor(scope: Construct, id: string, props: RestApiProps = { }) {
    super(scope, id, props);

    const resource = new CfnRestApi(this, 'Resource', {
      name: this.restApiName,
      description: props.description,
      policy: props.policy,
      failOnWarnings: props.failOnWarnings,
      minimumCompressionSize: props.minimumCompressionSize,
      binaryMediaTypes: props.binaryMediaTypes,
      endpointConfiguration: this._configureEndpoints(props),
      apiKeySourceType: props.apiKeySourceType,
      cloneFrom: props.cloneFrom?.restApiId,
      parameters: props.parameters,
      disableExecuteApiEndpoint: props.disableExecuteApiEndpoint,
    });
    this.node.defaultChild = resource;
    this.restApiId = resource.ref;

    const cloudWatchRole = props.cloudWatchRole ?? true;
    if (cloudWatchRole) {
      this._configureCloudWatchRole(resource);
    }

    this._configureDeployment(props);
    if (props.domainName) {
      this.addDomainName('CustomDomain', props.domainName);
    }

    this.root = new RootResource(this, props, resource.attrRootResourceId);
    this.restApiRootResourceId = resource.attrRootResourceId;
  }

  /**
   * The deployed root URL of this REST API.
   */
  public get url() {
    return this.urlForPath();
  }

  /**
   * Adds a new model.
   */
  public addModel(id: string, props: ModelOptions): Model {
    return new Model(this, id, {
      ...props,
      restApi: this,
    });
  }

  /**
   * Adds a new request validator.
   */
  public addRequestValidator(id: string, props: RequestValidatorOptions): RequestValidator {
    return new RequestValidator(this, id, {
      ...props,
      restApi: this,
    });
  }

  /**
   * Internal API used by `Method` to keep an inventory of methods at the API
   * level for validation purposes.
   *
   * @internal
   */
  public _attachMethod(method: Method) {
    this.methods.push(method);

    // add this method as a dependency to all deployments defined for this api
    // when additional deployments are added, _attachDeployment is called and
    // this method will be added there.
    for (const dep of this.deployments) {
      dep._addMethodDependency(method);
    }
  }

  /**
   * Attaches a deployment to this REST API.
   *
   * @internal
   */
  public _attachDeployment(deployment: Deployment) {
    this.deployments.push(deployment);

    // add all methods that were already defined as dependencies of this
    // deployment when additional methods are added, _attachMethod is called and
    // it will be added as a dependency to this deployment.
    for (const method of this.methods) {
      deployment._addMethodDependency(method);
    }
  }

  /**
   * Performs validation of the REST API.
   */
  protected validate() {
    if (this.methods.length === 0) {
      return ["The REST API doesn't contain any methods"];
    }

    return [];
  }
}

/**
 * The endpoint configuration of a REST API, including VPCs and endpoint types.
 *
 * EndpointConfiguration is a property of the AWS::ApiGateway::RestApi resource.
 */
export interface EndpointConfiguration {
  /**
   * A list of endpoint types of an API or its custom domain name.
   *
   * @default EndpointType.EDGE
   */
  readonly types: EndpointType[];

  /**
   * A list of VPC Endpoints against which to create Route53 ALIASes
   *
   * @default - no ALIASes are created for the endpoint.
   */
  readonly vpcEndpoints?: IVpcEndpoint[];
}

export enum ApiKeySourceType {
  /**
   * To read the API key from the `X-API-Key` header of a request.
   */
  HEADER = 'HEADER',

  /**
   * To read the API key from the `UsageIdentifierKey` from a custom authorizer.
   */
  AUTHORIZER = 'AUTHORIZER',
}

export enum EndpointType {
  /**
   * For an edge-optimized API and its custom domain name.
   */
  EDGE = 'EDGE',

  /**
   * For a regional API and its custom domain name.
   */
  REGIONAL = 'REGIONAL',

  /**
   * For a private API and its custom domain name.
   */
  PRIVATE = 'PRIVATE'
}

class RootResource extends ResourceBase {
  public readonly parentResource?: IResource;
  public readonly api: RestApiBase;
  public readonly resourceId: string;
  public readonly path: string;
  public readonly defaultIntegration?: Integration | undefined;
  public readonly defaultMethodOptions?: MethodOptions | undefined;
  public readonly defaultCorsPreflightOptions?: CorsOptions | undefined;

  private readonly _restApi?: RestApi;

  constructor(api: RestApiBase, props: ResourceOptions, resourceId: string) {
    super(api, 'Default');

    this.parentResource = undefined;
    this.defaultIntegration = props.defaultIntegration;
    this.defaultMethodOptions = props.defaultMethodOptions;
    this.defaultCorsPreflightOptions = props.defaultCorsPreflightOptions;
    this.api = api;
    this.resourceId = resourceId;
    this.path = '/';

    if (api instanceof RestApi) {
      this._restApi = api;
    }

    if (this.defaultCorsPreflightOptions) {
      this.addCorsPreflight(this.defaultCorsPreflightOptions);
    }
  }

  /**
   * Get the RestApi associated with this Resource.
   * @deprecated - Throws an error if this Resource is not associated with an instance of `RestApi`. Use `api` instead.
   */
  public get restApi(): RestApi {
    if (!this._restApi) {
      throw new Error('RestApi is not available on Resource not connected to an instance of RestApi. Use `api` instead');
    }
    return this._restApi;
  }
}

function ignore(_x: any) {
  return;
}
