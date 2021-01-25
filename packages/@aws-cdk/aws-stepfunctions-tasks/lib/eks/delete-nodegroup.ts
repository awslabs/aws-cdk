import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { integrationResourceArn, validatePatternSupported } from '../private/task-utils';

/** Properties for deleteing a NodeGroup function with EksDeleteNodegroup */
export interface EksDeleteNodegroupProps extends sfn.TaskStateBaseProps {

  /** The name of the Amazon EKS cluster that is associated with your node group. */
  readonly clusterName: string;

  /** The name of the node group to delete. */
  readonly nodegroupName: string;
}

/**
 * Deleting a Nodegroup as a Task
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-eks.html
 */
export class EksDeleteNodegroup extends sfn.TaskStateBase {

  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] = [
    sfn.IntegrationPattern.REQUEST_RESPONSE,
    sfn.IntegrationPattern.RUN_JOB,
  ];

  protected readonly taskMetrics?: sfn.TaskMetricsConfig;
  protected readonly taskPolicies?: iam.PolicyStatement[];

  private readonly integrationPattern: sfn.IntegrationPattern;

  constructor(scope: Construct, id: string, private readonly props: EksDeleteNodegroupProps) {
    super(scope, id, props);
    this.integrationPattern = props.integrationPattern ?? sfn.IntegrationPattern.REQUEST_RESPONSE;

    validatePatternSupported(this.integrationPattern, EksDeleteNodegroup.SUPPORTED_INTEGRATION_PATTERNS);

    this.taskPolicies = [
      new iam.PolicyStatement({
        resources: [
          Stack.of(this).formatArn({
            service: 'eks',
            resource: 'nodegroup',
            resourceName: `${this.props.clusterName}/${this.props.nodegroupName}/*`,
          }),
        ],
        actions: ['eks:DeleteNodegroup'],
      }),
    ];
  }

  /**
   * Provides the EKS Delete Nodegroup service integration task configuration
   */
  /**
   * @internal
   */
  protected _renderTask(): any {
    return {
      Resource: integrationResourceArn('eks', 'deleteNodegroup', this.integrationPattern),
      Parameters: sfn.FieldUtils.renderObject({
        ClusterName: this.props.clusterName,
        NodegroupName: this.props.nodegroupName,
      }),
    };
  }
}
