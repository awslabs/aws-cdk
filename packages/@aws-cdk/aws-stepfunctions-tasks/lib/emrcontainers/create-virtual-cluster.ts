// eslint-disable-next-line import/no-extraneous-dependencies
import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { integrationResourceArn, validatePatternSupported } from '../private/task-utils';

/**
 * Enum for supported types of Container Providers
 */
export enum ContainerProviderTypes {

  /**
   * Supported container provider type is an EKS Cluster
   */
  EKS = 'EKS',
}

/**
 * The information about the EKS cluster.
 */
export interface EksInfo {

  /**
   * The namespaces of the EKS cluster.
   * Length Constraints: Minimum length of 1. Maximum length of 63.
   *
   * @default - No namespace
   */
  readonly namespace?: string;
}

/**
 * The information about the container used for a job run or a managed endpoint.
 */
export interface ContainerInfo {

  /**
   * The information about the EKS cluster.
   *
   * @default - No EKS info
   */
  readonly eksInfo?: EksInfo;
}

/**
 * The information about the container provider.
 */
export interface ContainerProvider {

  /**
   * The ID of the container cluster.
   *
   * @default - No Cluster Id
   */
  readonly id: string;

  /**
   * The information about the container cluster.
   *
   * @default - No container info
   */
  readonly info?: ContainerInfo;

  /**
   * The type of the container provider.
   * EKS is the only supported type as of now.
   */
  readonly type: string;
}

/**
 * The props for a EMR Containers CreateVirtualCluster Task.
 */
export interface EmrContainersCreateVirtualClusterProps extends sfn.TaskStateBaseProps {

  /**
   * Name of the specified virtual cluster.
   *
   */
  readonly name: string;

  /**
   * The container provider of the virtual cluster
   *
   * @see https://docs.aws.amazon.com/emr-on-eks/latest/APIReference/API_ContainerProvider.html
   *
   * @default - No container provider
   */
  readonly containerProvider: ContainerProvider;

  /**
   * The tags assigned to the virtual cluster
   *
   * @default {}
   */
  readonly tags?: { [key: string]: string };
}

/**
 * Creates a Virtual Cluster from a EKS cluster in a Task State
 *
 * @see https://docs.amazonaws.cn/en_us/step-functions/latest/dg/connect-emr-eks.html
 */
export class EmrContainersCreateVirtualCluster extends sfn.TaskStateBase {

  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] = [
    sfn.IntegrationPattern.REQUEST_RESPONSE,
  ];

  protected readonly taskMetrics?: sfn.TaskMetricsConfig;
  protected readonly taskPolicies?: iam.PolicyStatement[];

  private readonly integrationPattern: sfn.IntegrationPattern;

  constructor(scope: Construct, id: string, private readonly props: EMRContainersCreateVirtualClusterProps) {
    super(scope, id, props);
    this.integrationPattern = props.integrationPattern ?? sfn.IntegrationPattern.REQUEST_RESPONSE;
    validatePatternSupported(this.integrationPattern, EMRContainersCreateVirtualCluster.SUPPORTED_INTEGRATION_PATTERNS);

    this.taskPolicies = this.createPolicyStatements();
  }

  /**
   * @internal
   */
  protected _renderTask(): any {
    return {
      Resource: integrationResourceArn('emr-containers', 'createVirtualCluster', this.integrationPattern),
      Parameters: sfn.FieldUtils.renderObject({
        Name: this.props.name,
        ContainerProvider: {
          Id: this.props.containerProvider.id,
          Info: {
            EksInfo: {
              Namespace: this.props.containerProvider.info?.eksInfo?.namespace,
            },
          },
          Type: this.props.containerProvider.type,
        },
        Tags: this.props.tags,
      }),
    };
  };

  private createPolicyStatements(): iam.PolicyStatement[] {
    return [
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['emr-containers:CreateVirtualCluster'],
      }),
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['iam:CreateServiceLinkedRole'],
        conditions: {
          stringLike: {
            'iam:AWSServiceName': 'emr-containers.amazonaws.com',
          },
        },
      }),
    ];
  }
}
