import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { integrationResourceArn } from '../private/task-utils';

/**
 * Properties for EmrModifyInstanceFleetByName
 *
 */
export interface EmrModifyInstanceFleetByNameProps extends sfn.TaskStateBaseProps {
  /**
   * The ClusterId to update.
   */
  readonly clusterId: string;

  /**
   * The InstanceFleetName to update.
   */
  readonly instanceFleetName: string;

  /**
   * The target capacity of On-Demand units for the instance fleet.
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_InstanceFleetModifyConfig.html
   *
   * @default - None
   */
  readonly targetOnDemandCapacity: number;

  /**
   * The target capacity of Spot units for the instance fleet.
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_InstanceFleetModifyConfig.html
   *
   * @default - None
   */
  readonly targetSpotCapacity: number;
}

/**
 * A Step Functions Task to to modify an InstanceFleet on an EMR Cluster.
 *
 */
export class EmrModifyInstanceFleetByName extends sfn.TaskStateBase {
  protected readonly taskPolicies?: iam.PolicyStatement[];
  protected readonly taskMetrics?: sfn.TaskMetricsConfig;

  constructor(scope: Construct, id: string, private readonly props: EmrModifyInstanceFleetByNameProps) {
    super(scope, id, props);

    this.taskPolicies = [
      new iam.PolicyStatement({
        actions: [
          'elasticmapreduce:ModifyInstanceFleet',
          'elasticmapreduce:ListInstanceFleets',
        ],
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
      Resource: integrationResourceArn('elasticmapreduce', 'modifyInstanceFleetByName',
        sfn.IntegrationPattern.REQUEST_RESPONSE),
      Parameters: sfn.FieldUtils.renderObject({
        ClusterId: this.props.clusterId,
        InstanceFleetName: this.props.instanceFleetName,
        InstanceFleet: {
          TargetOnDemandCapacity: this.props.targetOnDemandCapacity,
          TargetSpotCapacity: this.props.targetSpotCapacity,
        },
      }),
    };
  }
}