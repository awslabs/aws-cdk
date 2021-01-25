import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Construct } from 'constructs';
import { integrationResourceArn, validatePatternSupported } from '../private/task-utils';

/** Properties for creating a Fargate Profile with EksCreateFargateProfile */
export interface EksCreateFargateProfileProps extends sfn.TaskStateBaseProps {

  /** The name of the Fargate profile */
  readonly fargateProfileName: string;

  /** The name of the Amazon EKS cluster to apply the Fargate profile to */
  readonly clusterName: string;

  /** The Amazon Resource Name (ARN) of the pod execution role to use for pods that match the selectors in the Fargate profile */
  readonly podExecutionRole: string;

  /**
   * The selectors to match for pods to use this Fargate profile
   *
   * @default - no selectors
   */
  readonly selectors?: object[];

  /**
   * Unique, case-sensitive identifier that you provide to ensure the idempotency of the request
   *
   * @default - no client request token
   */
  readonly clientRequestToken?: string;

  /**
   * The metadata to apply to the node group to assist with categorization and organization
   *
   * @default - no tags
   */
  readonly tags?: {[key: string]: string};
}

/**
 * Create a Fargate Profile as a Task
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-eks.html
 */
export class EksCreateFargateProfile extends sfn.TaskStateBase {

  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] = [
    sfn.IntegrationPattern.REQUEST_RESPONSE,
    sfn.IntegrationPattern.RUN_JOB,
  ];

  protected readonly taskMetrics?: sfn.TaskMetricsConfig;
  protected readonly taskPolicies?: iam.PolicyStatement[];

  private readonly integrationPattern: sfn.IntegrationPattern;

  constructor(scope: Construct, id: string, private readonly props: EksCreateFargateProfileProps) {
    super(scope, id, props);
    this.integrationPattern = props.integrationPattern ?? sfn.IntegrationPattern.REQUEST_RESPONSE;

    validatePatternSupported(this.integrationPattern, EksCreateFargateProfile.SUPPORTED_INTEGRATION_PATTERNS);

    this.taskPolicies = [
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['eks:CreateFargateProfile'],
      }),
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['iam:GetRole'],
      }),
      new iam.PolicyStatement({
        resources: [this.props.podExecutionRole],
        actions: ['iam:PassRole'],
        conditions: {
          StringEqualsIfExists: {
            'iam:PassedToService': [
              'eks.amazonaws.com',
            ],
          },
        },
      }),
    ];
  }

  /**
   * Provides the EKS Create NodeGroup service integration task configuration
   */
  /**
   * @internal
   */
  protected _renderTask(): any {
    return {
      Resource: integrationResourceArn('eks', 'createFargateProfile', this.integrationPattern),
      Parameters: sfn.FieldUtils.renderObject({
        FargateProfileName: this.props.fargateProfileName,
        ClusterName: this.props.clusterName,
        PodExecutionRoleArn: this.props.podExecutionRole,
        Selectors: this.props.selectors,
        ClientRequestToken: this.props.clientRequestToken,
        Tags: this.props.tags,
      }),
    };
  }
}
