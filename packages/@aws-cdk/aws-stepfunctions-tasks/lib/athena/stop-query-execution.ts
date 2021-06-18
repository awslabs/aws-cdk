import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Construct } from 'constructs';
import { integrationResourceArn, validatePatternSupported } from '../private/task-utils';

/**
 * Properties for stoping a Query Execution
 */
export interface AthenaStopQueryExecutionProps extends sfn.TaskStateBaseProps {
  /**
   * Query that will be stopped
   */
  readonly queryExecutionId: string;
}

/**
 * Stop an Athena Query Execution as a Task
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-athena.html
 */
export class AthenaStopQueryExecution extends sfn.TaskStateBase {
  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] = [
    sfn.IntegrationPattern.REQUEST_RESPONSE,
  ];

  protected readonly taskMetrics?: sfn.TaskMetricsConfig;
  protected readonly taskPolicies?: iam.PolicyStatement[];

  private readonly integrationPattern: sfn.IntegrationPattern;

  constructor(scope: Construct, id: string, private readonly props: AthenaStopQueryExecutionProps) {
    super(scope, id, props);
    this.integrationPattern = props.integrationPattern ?? sfn.IntegrationPattern.REQUEST_RESPONSE;

    validatePatternSupported(this.integrationPattern, AthenaStopQueryExecution.SUPPORTED_INTEGRATION_PATTERNS);

    this.taskPolicies = [
      new iam.PolicyStatement({
        resources: ['*'], // Grant access to allow user to stop queries on all workgroups as no workgroup defined in request https://docs.aws.amazon.com/athena/latest/ug/workgroups-iam-policy.html
        actions: ['athena:stopQueryExecution'],
      }),
    ];
  }

  /**
   * Provides the Athena stop query execution service integration task configuration
   */
  /**
   * @internal
   */
  protected _renderTask(): any {
    return {
      Resource: integrationResourceArn('athena', 'stopQueryExecution', this.integrationPattern),
      Parameters: sfn.FieldUtils.renderObject({
        QueryExecutionId: this.props.queryExecutionId,
      }),
    };
  }
}

