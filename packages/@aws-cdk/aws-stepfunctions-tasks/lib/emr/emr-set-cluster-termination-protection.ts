import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { integrationResourceArn } from '../private/task-utils';

/**
 * Properties for EmrSetClusterTerminationProtection
 *
 */
export interface EmrSetClusterTerminationProtectionProps extends sfn.TaskStateBaseProps {
  /**
   * The ClusterId to update.
   */
  readonly clusterId: string;

  /**
   * Termination protection indicator.
   */
  readonly terminationProtected: boolean;
}

/**
 * A Step Functions Task to to set Termination Protection on an EMR Cluster.
 *
 */
export class EmrSetClusterTerminationProtection extends sfn.TaskStateBase {
  protected readonly taskPolicies?: iam.PolicyStatement[];
  protected readonly taskMetrics?: sfn.TaskMetricsConfig;

  constructor(scope: Construct, id: string, private readonly props: EmrSetClusterTerminationProtectionProps) {
    super(scope, id, props);

    this.taskPolicies = [
      new iam.PolicyStatement({
        actions: ['elasticmapreduce:SetTerminationProtection'],
        resources: [
          Stack.of(this).formatArn({
            service: 'elasticmapreduce',
            resource: 'cluster',
            resourceName: '*',
          }),
        ],
      }),
    ];
  }

  /**
   * @internal
   */
  protected _renderTask(): any {
    return {
      Resource: integrationResourceArn('elasticmapreduce', 'setClusterTerminationProtection',
        sfn.IntegrationPattern.REQUEST_RESPONSE),
      Parameters: sfn.FieldUtils.renderObject({
        ClusterId: this.props.clusterId,
        TerminationProtected: this.props.terminationProtected,
      }),
    };
  }
}