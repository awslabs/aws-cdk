import * as apigateway from '@aws-cdk/aws-apigateway';
import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { Construct } from 'constructs';
import { BaseInvokeApiGatewayApi } from './base';
import { BaseInvokeApiGatewayApiProps } from './base-types';

/**
 * Properties for invoking an REST API Endpoint
 */
export interface InvokeApiGatewayRestApiProps extends BaseInvokeApiGatewayApiProps {
  /**
   * API to call
   */
  readonly api: apigateway.IRestApi;

  /**
   * Name of the stage where the API is deployed to in API Gateway
   */
  readonly stageName: string;
}

/**
 * Invoke REST API endpoint as a Task
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-api-gateway.html
 */
export class InvokeApiGatewayRestApi extends BaseInvokeApiGatewayApi {
  protected readonly taskMetrics?: sfn.TaskMetricsConfig | undefined;
  protected readonly taskPolicies?: iam.PolicyStatement[] | undefined;

  protected readonly apiEndpoint: string;
  protected readonly arnForExecuteApi: string;
  protected readonly stageName?: string;

  constructor(scope: Construct, id: string, private readonly props: InvokeApiGatewayRestApiProps) {
    super(scope, id, props);

    this.apiEndpoint = this.getApiEndpoint();
    this.arnForExecuteApi = props.api.arnForExecuteApi(props.method, props.path, props.stageName);
    this.stageName = props.stageName;

    this.taskPolicies = this.createPolicyStatements();
  }

  private getApiEndpoint(): string {
    const apiStack = cdk.Stack.of(this.props.api);
    return `${this.props.api.restApiId}.execute-api.${apiStack.region}.${apiStack.urlSuffix}`;
  }
}
