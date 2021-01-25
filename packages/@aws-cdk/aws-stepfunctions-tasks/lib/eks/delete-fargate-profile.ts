import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { integrationResourceArn, validatePatternSupported } from '../private/task-utils';

/** Properties for deleting a Fargate Profile with EksDeleteFargateProfile */
export interface EksDeleteFargateProfileProps extends sfn.TaskStateBaseProps {

  /** The name of the Amazon EKS cluster to apply the Fargate profile to */
  readonly clusterName: string;

  /** The name of the Fargate profile */
  readonly fargateProfileName: string;
}

/**
 * Delete a Fargate Profile as a Task
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-eks.html
 */
export class EksDeleteFargateProfile extends sfn.TaskStateBase {

  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] = [
    sfn.IntegrationPattern.REQUEST_RESPONSE,
    sfn.IntegrationPattern.RUN_JOB,
  ];

  protected readonly taskMetrics?: sfn.TaskMetricsConfig;
  protected readonly taskPolicies?: iam.PolicyStatement[];

  private readonly integrationPattern: sfn.IntegrationPattern;

  constructor(scope: Construct, id: string, private readonly props: EksDeleteFargateProfileProps) {
    super(scope, id, props);
    this.integrationPattern = props.integrationPattern ?? sfn.IntegrationPattern.REQUEST_RESPONSE;

    validatePatternSupported(this.integrationPattern, EksDeleteFargateProfile.SUPPORTED_INTEGRATION_PATTERNS);

    this.taskPolicies = [
      new iam.PolicyStatement({
        resources: [
          Stack.of(this).formatArn({
            service: 'eks',
            resource: 'fargateprofile',
            resourceName: `${this.props.clusterName}/${this.props.fargateProfileName}/*`,
          }),
        ],
        actions: ['eks:DeleteFargateProfile'],
      }),
    ];
  }

  /**
   * Provides the EKS Delete NodeGroup service integration task configuration
   */
  /**
   * @internal
   */
  protected _renderTask(): any {
    return {
      Resource: integrationResourceArn('eks', 'deleteFargateProfile', this.integrationPattern),
      Parameters: sfn.FieldUtils.renderObject({
        ClusterName: this.props.clusterName,
        FargateProfileName: this.props.fargateProfileName,
      }),
    };
  }
}
