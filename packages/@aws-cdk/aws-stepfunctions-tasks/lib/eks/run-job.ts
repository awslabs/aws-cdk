import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Construct } from 'constructs';
import { integrationResourceArn, validatePatternSupported } from '../private/task-utils';

/** Properties for running a EKS Job with EksRunJob */
export interface EksRunJobProps extends sfn.TaskStateBaseProps {

  /** Name of the cluster */
  readonly clusterName: string;

  /** Base 64 encoded certificate data required to communicate with your cluster */
  readonly certificateAuthority: string;

  /** API endpoint to communicate with your cluster */
  readonly endpoint: string;

  /** Creates one or more pods and ensures that a specified number of the pods successfully terminate */
  readonly job: object;

  /**
   * Logging configuration for job
   * @default - No log options
   */
  readonly logOptions?: LogOptions;
}

/**
 * Run a EKS job as a Task
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-eks.html
 */
export class EksRunJob extends sfn.TaskStateBase {

  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] = [
    sfn.IntegrationPattern.REQUEST_RESPONSE,
    sfn.IntegrationPattern.RUN_JOB,
  ];

  protected readonly taskMetrics?: sfn.TaskMetricsConfig;
  protected readonly taskPolicies?: iam.PolicyStatement[];

  private readonly integrationPattern: sfn.IntegrationPattern;

  constructor(scope: Construct, id: string, private readonly props: EksRunJobProps) {
    super(scope, id, props);
    this.integrationPattern = props.integrationPattern ?? sfn.IntegrationPattern.REQUEST_RESPONSE;

    validatePatternSupported(this.integrationPattern, EksRunJob.SUPPORTED_INTEGRATION_PATTERNS);
  }

  /**
   * Provides the EKS Run Job service integration task configuration
   */
  /**
   * @internal
   */
  protected _renderTask(): any {
    if (this.props.logOptions) {
      return {
        Resource: integrationResourceArn('eks', 'runJob', this.integrationPattern),
        Parameters: sfn.FieldUtils.renderObject({
          ClusterName: this.props.clusterName,
          CertificateAuthority: this.props.certificateAuthority,
          Endpoint: this.props.endpoint,
          Job: this.props.job,
          LogOptions: {
            RawLogs: this.props.logOptions.rawLogs ?? false,
            RetrieveLogs: this.props.logOptions.retrieveLogs ?? false,
            LogParameters: this.props.logOptions.logParameters,
          },
        }),
      };
    } else {
      return {
        Resource: integrationResourceArn('eks', 'runJob', this.integrationPattern),
        Parameters: sfn.FieldUtils.renderObject({
          ClusterName: this.props.clusterName,
          CertificateAuthority: this.props.certificateAuthority,
          Endpoint: this.props.endpoint,
          Job: this.props.job,
        }),
      };
    }

  }
}

/** Logging Configuration for EKS Run Job */
export interface LogOptions {

  /**
   * Flag to retrieve logs
   * @default - false
  */
  readonly retrieveLogs?: boolean;

  /**
   * Non grouped logs
   * @default - false
   */
  readonly rawLogs?: boolean

  /**
   * Logging paramaters mapped String to List of String
   * @default - no logParameters
   */
  readonly logParameters ?: { [key: string]: string[] };
}
