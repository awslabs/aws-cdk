import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Construct } from 'constructs';
import { integrationResourceArn, validatePatternSupported } from '../private/task-utils';
import { JobDriver, ConfigurationOverrides } from './base-types';

/**
 * The props for a EMR Containers StartJobRun Task.
 */
export interface EMRContainersStartJobRunProps extends sfn.TaskStateBaseProps {

  /**
   * The virtual cluster ID for which the job run request is submitted.
   */
  readonly clusterId: string;

  /**
   * The name of the job run.
   *
   * @default - No job name
   */
  readonly jobName?: string;

  /**
   * The execution role ARN for the job run.
   *
   * @default - No execution arn
   */
  readonly executionRoleArn: string;

  /**
   * The Amazon EMR release version to use for the job run.
   */
  readonly releaseLabel: string;

  /**
   * The job driver for the job run.
   *
   * @see https://docs.aws.amazon.com/emr-on-eks/latest/APIReference/API_JobDriver.html
   *
   * @default - No job driver
   */
  readonly jobDriver: JobDriver;

  /**
   * A configuration specification to be used to override existing configurations.
   *
   * @see https://docs.aws.amazon.com/emr-on-eks/latest/APIReference/API_ConfigurationOverrides.html
   *
   * @default - No configuration override
   */
  readonly configurationOverrides?: ConfigurationOverrides;

  /**
   * The tags assigned to job runs.
   *
   * @default - None
   */
  readonly tags?: { [key: string]: string };
}

/**
 * Starts a job run. A job run is a unit of work, such as a Spark jar, PySpark script, or SparkSQL query,
 * that you submit to Amazon EMR on EKS.
 *
 * @see https://docs.amazonaws.cn/en_us/step-functions/latest/dg/connect-emr-eks.html
 */
export class EMRContainersStartJobRun extends sfn.TaskStateBase {
  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] = [
    sfn.IntegrationPattern.REQUEST_RESPONSE,
    sfn.IntegrationPattern.RUN_JOB,
  ];

  protected readonly taskMetrics?: sfn.TaskMetricsConfig;
  protected readonly taskPolicies?: iam.PolicyStatement[];

  private readonly integrationPattern: sfn.IntegrationPattern;

  constructor(scope: Construct, id: string, private readonly props: EMRContainersStartJobRunProps) {
    super(scope, id, props);
    this.integrationPattern = props.integrationPattern ?? sfn.IntegrationPattern.RUN_JOB;

    validatePatternSupported(this.integrationPattern, EMRContainersStartJobRun.SUPPORTED_INTEGRATION_PATTERNS);
  }

  /**
   * @internal
   *
   * TODO: ALL of this needs work
   */
  protected _renderTask(): any {
    return {
      Resource: integrationResourceArn('emr-containers', 'startJobRun', this.integrationPattern),
      Parameters: sfn.FieldUtils.renderObject({
        VirtualClusterId: this.props.clusterId,
        JobName: this.props.jobName,
        ExecutionRoleArn: this.props.executionRoleArn,
        ReleaseLabel: this.props.releaseLabel,
        JobDriver: this.props.jobDriver,
        ConfigurationOverrides: this.props.configurationOverrides,
        Tags: this.props.tags,
      }),
    };
  };
}
