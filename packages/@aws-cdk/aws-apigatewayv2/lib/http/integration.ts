import { Resource, Duration } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnIntegration } from '../apigatewayv2.generated';
import { IIntegration } from '../common';
import { IHttpApi } from './api';
import { HttpMethod, IHttpRoute } from './route';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';

/**
 * Represents an Integration for an HTTP API.
 */
export interface IHttpIntegration extends IIntegration {
  /** The HTTP API associated with this integration */
  readonly httpApi: IHttpApi;
}

/**
 * Supported integration types
 */
export enum HttpIntegrationType {
  /**
   * Integration type is a Lambda proxy
   * @see https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
   */
  LAMBDA_PROXY = 'AWS_PROXY',
  /**
   * Integration type is an HTTP proxy
   * @see https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
   */
  HTTP_PROXY = 'HTTP_PROXY',
}

/**
 * Supported connection types
 */
export enum HttpConnectionType {
  /**
   * For private connections between API Gateway and resources in a VPC
   */
  VPC_LINK = 'VPC_LINK',
  /**
   * For connections through public routable internet
   */
  INTERNET = 'INTERNET',
}

/**
 * Payload format version for lambda proxy integration
 * @see https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
 */
export class PayloadFormatVersion {
  /** Version 1.0 */
  public static readonly VERSION_1_0 = new PayloadFormatVersion('1.0');
  /** Version 2.0 */
  public static readonly VERSION_2_0 = new PayloadFormatVersion('2.0');

  /**
   * A custom payload version.
   * Typically used if there is a version number that the CDK doesn't support yet
   */
  public static custom(version: string) {
    return new PayloadFormatVersion(version);
  }

  /** version as a string */
  public readonly version: string;

  private constructor(version: string) {
    this.version = version;
  }
}

/**
 * The integration properties
 */
export interface HttpIntegrationProps {
  /**
   * The HTTP API to which this integration should be bound.
   */
  readonly httpApi: IHttpApi;

  /**
   * The description of the integration
   *
   * @default - undefined
   */
  readonly description?: string;

  /**
   * Specifies the credentials ARN required for the integration, if any.
   *
   * @default - undefined
   */
  readonly credentials?: string;

  /**
   * Integration type
   */
  readonly integrationType: HttpIntegrationType;

  /**
   * Specifies the AWS service action to invoke.
   *
   * @default - undefined
   */
  readonly integrationSubtype?: string;

  /**
   * Custom timeout for HTTP APIs
   *
   * @default - undefined
   */
  readonly timeout?: Duration;

  /**
   * Request parameters are a key-value map specifying parameters that are passed to AWS_PROXY integrations.
   *
   * @default - undefined
   */
  readonly requestParameters?: { [key: string]: any };

  /**
   * Integration URI.
   * This will be the function ARN in the case of `HttpIntegrationType.LAMBDA_PROXY`,
   * or HTTP URL in the case of `HttpIntegrationType.HTTP_PROXY`.
   *
   * @default - undefined
   */
  readonly integrationUri?: string;

  /**
   * The HTTP method to use when calling the underlying HTTP proxy
   * @default - none. required if the integration type is `HttpIntegrationType.HTTP_PROXY`.
   */
  readonly method?: HttpMethod;

  /**
   * The ID of the VPC link for a private integration. Supported only for HTTP APIs.
   *
   * @default - undefined
   */
  readonly connectionId?: string;

  /**
   * The type of the network connection to the integration endpoint
   *
   * @default HttpConnectionType.INTERNET
   */
  readonly connectionType?: HttpConnectionType;

  /**
   * The version of the payload format
   * @see https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
   * @default - defaults to latest in the case of HttpIntegrationType.LAMBDA_PROXY`, irrelevant otherwise.
   */
  readonly payloadFormatVersion?: PayloadFormatVersion;
}

/**
 * The integration for an API route.
 * @resource AWS::ApiGatewayV2::Integration
 */
export class HttpIntegration extends Resource implements IHttpIntegration {
  public readonly integrationId: string;

  public readonly httpApi: IHttpApi;

  constructor(scope: Construct, id: string, props: HttpIntegrationProps) {
    super(scope, id);

    if (props.timeout && (props.timeout.toMilliseconds() < 50 || props.timeout.toMilliseconds() > 30000)) {
      throw new Error(`The timeout of HTTP integration should be between 50 and 30,000, got ${props.timeout.toMilliseconds()}.`);
    }

    const integ = new CfnIntegration(this, 'Resource', {
      apiId: props.httpApi.apiId,
      description: props.description,
      integrationType: props.integrationType,
      integrationSubtype: props.integrationSubtype,
      integrationUri: props.integrationUri,
      integrationMethod: props.method,
      credentialsArn: props.credentials,
      requestParameters: props.requestParameters,
      connectionId: props.connectionId,
      connectionType: props.connectionType,
      payloadFormatVersion: props.payloadFormatVersion?.version,
      timeoutInMillis: props.timeout?.toMilliseconds(),
    });
    this.integrationId = integ.ref;
    this.httpApi = props.httpApi;
  }
}

/**
 * Options to the HttpRouteIntegration during its bind operation.
 */
export interface HttpRouteIntegrationBindOptions {
  /**
   * The route to which this is being bound.
   */
  readonly route: IHttpRoute;

  /**
   * The current scope in which the bind is occurring.
   * If the `HttpRouteIntegration` being bound creates additional constructs,
   * this will be used as their parent scope.
   */
  readonly scope: CoreConstruct;
}

/**
 * The interface that various route integration classes will inherit.
 */
export interface IHttpRouteIntegration {
  /**
   * Bind this integration to the route.
   */
  bind(options: HttpRouteIntegrationBindOptions): HttpRouteIntegrationConfig;
}

/**
 * Config returned back as a result of the bind.
 */
export interface HttpRouteIntegrationConfig {
  /**
   * The description of the integration
   *
   * @default - undefined
   */
  readonly description?: string;

  /**
   * Integration type.
   */
  readonly type: HttpIntegrationType;

  /**
   * Specifies the credentials ARN required for the integration, if any.
   *
   * @default - undefined
   */
  readonly credentials?: string;

  /**
   * Specifies the AWS service action to invoke.
   *
   * @default - undefined
   */
  readonly subtype?: string;

  /**
   * Custom timeout for HTTP APIs
   *
   * @default - undefined
   */
  readonly timeout?: Duration;

  /**
   * Request parameters are a key-value map specifying parameters that are passed to AWS_PROXY integrations.
   *
   * @default - undefined
   */
  readonly requestParameters?: { [key: string]: any };

  /**
   * Integration URI
   *
   * @default - undefined
   */
  readonly uri?: string;

  /**
   * The HTTP method that must be used to invoke the underlying proxy.
   * Required for `HttpIntegrationType.HTTP_PROXY`
   * @default - undefined
   */
  readonly method?: HttpMethod;

  /**
   * The ID of the VPC link for a private integration. Supported only for HTTP APIs.
   *
   * @default - undefined
   */
  readonly connectionId?: string;

  /**
   * The type of the network connection to the integration endpoint
   *
   * @default HttpConnectionType.INTERNET
   */
  readonly connectionType?: HttpConnectionType;

  /**
   * Payload format version in the case of lambda proxy integration
   * @see https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
   * @default - undefined
   */
  readonly payloadFormatVersion: PayloadFormatVersion;
}
