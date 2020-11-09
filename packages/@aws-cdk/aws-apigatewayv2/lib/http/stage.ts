import { Metric, MetricOptions } from '@aws-cdk/aws-cloudwatch';
import { ILogGroup } from '@aws-cdk/aws-logs';
import { Resource, Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnStage } from '../apigatewayv2.generated';
import { CommonStageOptions, IDomainName, IStage } from '../common';
import { IHttpApi } from './api';
import { HttpApiMapping } from './api-mapping';


const DEFAULT_STAGE_NAME = '$default';

/**
 * Represents the HttpStage
 */
export interface IHttpStage extends IStage {
}

/**
 * Options to create a new stage for an HTTP API.
 */
export interface HttpStageOptions extends CommonStageOptions {
  /**
   * The options for custom domain and api mapping
   *
   * @default - no custom domain and api mapping configuration
   */
  readonly domainMapping?: DomainMappingOptions;

  /**
   * Settings for logging access in this stage.
   *
   * @default - No access logging
   */
  readonly accessLogSettings?: AccessLogSettings;
}

/**
 * Properties to initialize an instance of `HttpStage`.
 */
export interface HttpStageProps extends HttpStageOptions {
  /**
   * The HTTP API to which this stage is associated.
   */
  readonly httpApi: IHttpApi;
}

/**
 * Access logging configuration
 */
export interface AccessLogSettings {
  /**
   * CloudWatch Logs log group to receive access logs
   */
  readonly destination: ILogGroup;

  /**
   * A single line format of the access logs of data, as specified by selected $context variables. The format must include at least $context.requestId.
   */
  readonly format: string;
}

/**
 * Options for defaultDomainMapping
 */
export interface DefaultDomainMappingOptions {
  /**
   * The domain name for the mapping
   *
   */
  readonly domainName: IDomainName;

  /**
   * The API mapping key. Leave it undefined for the root path mapping.
   * @default - empty key for the root path mapping
   */
  readonly mappingKey?: string;
}

/**
 * Options for DomainMapping
 */
export interface DomainMappingOptions extends DefaultDomainMappingOptions {
  /**
   * The API Stage
   *
   * @default - the $default stage
   */
  readonly stage?: IStage;
}

/**
 * Represents a stage where an instance of the API is deployed.
 * @resource AWS::ApiGatewayV2::Stage
 */
export class HttpStage extends Resource implements IStage {
  /**
   * Import an existing stage into this CDK app.
   */
  public static fromStageName(scope: Construct, id: string, stageName: string): IStage {
    class Import extends Resource implements IStage {
      public readonly stageName = stageName;
    }
    return new Import(scope, id);
  }

  public readonly stageName: string;
  private httpApi: IHttpApi;

  constructor(scope: Construct, id: string, props: HttpStageProps) {
    super(scope, id, {
      physicalName: props.stageName ? props.stageName : DEFAULT_STAGE_NAME,
    });

    new CfnStage(this, 'Resource', {
      apiId: props.httpApi.httpApiId,
      stageName: this.physicalName,
      autoDeploy: props.autoDeploy,
      ...props.accessLogSettings ? {
        accessLogSettings: {
          destinationArn: props.accessLogSettings.destination.logGroupArn,
          format: props.accessLogSettings.format,
        },
      }: {},
    });

    this.stageName = this.physicalName;
    this.httpApi = props.httpApi;

    if (props.domainMapping) {
      new HttpApiMapping(this, `${props.domainMapping.domainName}${props.domainMapping.mappingKey}`, {
        api: props.httpApi,
        domainName: props.domainMapping.domainName,
        stage: this,
        apiMappingKey: props.domainMapping.mappingKey,
      });
      // ensure the dependency
      this.node.addDependency(props.domainMapping.domainName);
    }

  }

  /**
   * The URL to this stage.
   */
  public get url(): string {
    const s = Stack.of(this);
    const urlPath = this.stageName === DEFAULT_STAGE_NAME ? '' : this.stageName;
    return `https://${this.httpApi.httpApiId}.execute-api.${s.region}.${s.urlSuffix}/${urlPath}`;
  }

  /**
   * Return the given named metric for this HTTP Api Gateway Stage
   *
   * @default - average over 5 minutes
   */
  public metric(metricName: string, props?: MetricOptions): Metric {
    var api = this.httpApi;
    return api.metric(metricName, props).with({
      dimensions: { ApiId: this.httpApi.httpApiId, Stage: this.stageName },
    }).attachTo(this);
  }

  /**
   * Metric for the number of client-side errors captured in a given period.
   *
   * @default - sum over 5 minutes
   */
  public metricClientError(props?: MetricOptions): Metric {
    return this.metric('4XXError', { statistic: 'Sum', ...props });
  }

  /**
   * Metric for the number of server-side errors captured in a given period.
   *
   * @default - sum over 5 minutes
   */
  public metricServerError(props?: MetricOptions): Metric {
    return this.metric('5XXError', { statistic: 'Sum', ...props });
  }

  /**
   * Metric for the amount of data processed in bytes.
   *
   * @default - sum over 5 minutes
   */
  public metricDataProcessed(props?: MetricOptions): Metric {
    return this.metric('DataProcessed', { statistic: 'Sum', ...props });
  }

  /**
   * Metric for the total number API requests in a given period.
   *
   * @default - SampleCount over 5 minutes
   */
  public metricCount(props?: MetricOptions): Metric {
    return this.metric('Count', { statistic: 'SampleCount', ...props });
  }

  /**
   * Metric for the time between when API Gateway relays a request to the backend
   * and when it receives a response from the backend.
   *
   * @default - no statistic
   */
  public metricIntegrationLatency(props?: MetricOptions): Metric {
    return this.metric('IntegrationLatency', props);
  }

  /**
   * The time between when API Gateway receives a request from a client
   * and when it returns a response to the client.
   * The latency includes the integration latency and other API Gateway overhead.
   *
   * @default - no statistic
   */
  public metricLatency(props?: MetricOptions): Metric {
    return this.metric('Latency', props);
  }
}
