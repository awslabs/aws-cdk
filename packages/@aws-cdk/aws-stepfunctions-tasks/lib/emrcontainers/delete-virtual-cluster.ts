import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { integrationResourceArn, validatePatternSupported } from '../private/task-utils';

/**
 * The props for a EMR Containers DeleteVirtualCluster Task.
 */
export interface EMRContainersDeleteVirtualClusterProps extends sfn.TaskStateBaseProps {
  /**
   * The ID of the virtual cluster that will be deleted.
   */
  readonly virtualClusterId: sfn.TaskInput;
}

/**
 * Deletes a EMR Containers virtual cluster as a Task.
 *
 * @see https://docs.amazonaws.cn/en_us/step-functions/latest/dg/connect-emr-eks.html
 */
export class EMRContainersDeleteVirtualCluster extends sfn.TaskStateBase {

  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] = [
    sfn.IntegrationPattern.REQUEST_RESPONSE,
    sfn.IntegrationPattern.RUN_JOB,
  ];

  protected readonly taskMetrics?: sfn.TaskMetricsConfig;
  protected readonly taskPolicies?: iam.PolicyStatement[];

  private readonly integrationPattern: sfn.IntegrationPattern;

  constructor(scope: Construct, id: string, private readonly props: EMRContainersDeleteVirtualClusterProps) {
    super(scope, id, props);
    this.integrationPattern = props.integrationPattern ?? sfn.IntegrationPattern.RUN_JOB;

    validatePatternSupported(this.integrationPattern, EMRContainersDeleteVirtualCluster.SUPPORTED_INTEGRATION_PATTERNS);

    this.taskPolicies = this.createPolicyStatements();
  }

  /**
   * @internal
   */
  protected _renderTask(): any {
    return {
      Resource: integrationResourceArn('emr-containers', 'deleteVirtualCluster', this.integrationPattern),
      Parameters: sfn.FieldUtils.renderObject({
        Id: this.props.id,
      }),
    };
  };

  private createPolicyStatements(): iam.PolicyStatement[] {
    let iamActions: string[] | undefined;

    if (this.integrationPattern === sfn.IntegrationPattern.REQUEST_RESPONSE) {
      iamActions = ['emr-containers:DeleteVirtualCluster'];
    } else if (this.integrationPattern === sfn.IntegrationPattern.RUN_JOB) {
      iamActions = [
        'emr-containers:ListVirtualClusters',
        'emr-containers:DescribeVirtualCluster',
        'emr-containers:DeleteVirtualCluster',
      ];
    }

    return [new iam.PolicyStatement({
      resources: ['*'],
      actions: iamActions,
    })];
  }
}
