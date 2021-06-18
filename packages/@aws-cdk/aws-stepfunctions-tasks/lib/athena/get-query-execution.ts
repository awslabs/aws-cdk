import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Construct } from 'constructs';
import { integrationResourceArn, validatePatternSupported } from '../private/task-utils';

/**
 * Properties for getting a Query Execution
 */
export interface AthenaGetQueryExecutionProps extends sfn.TaskStateBaseProps {
  /**
   * Query that will be retrieved
   *
   * @example 'adfsaf-23trf23-f23rt23'
   */
  readonly queryExecutionId: string;
}

/**
 * Get an Athena Query Execution as a Task
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-athena.html
 */
export class AthenaGetQueryExecution extends sfn.TaskStateBase {
  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] = [
    sfn.IntegrationPattern.REQUEST_RESPONSE,
  ];

  protected readonly taskMetrics?: sfn.TaskMetricsConfig;
  protected readonly taskPolicies?: iam.PolicyStatement[];

  private readonly integrationPattern: sfn.IntegrationPattern;

  constructor(scope: Construct, id: string, private readonly props: AthenaGetQueryExecutionProps) {
    super(scope, id, props);
    this.integrationPattern = props.integrationPattern ?? sfn.IntegrationPattern.REQUEST_RESPONSE;

    validatePatternSupported(this.integrationPattern, AthenaGetQueryExecution.SUPPORTED_INTEGRATION_PATTERNS);

    this.taskPolicies = [
      new iam.PolicyStatement({
        resources: ['*'], // Grant access to all workgroups as it can not be specified in the request https://docs.aws.amazon.com/athena/latest/ug/workgroups-iam-policy.html
        actions: ['athena:getQueryExecution'],
      }),
    ];
  }

  /**
   * Provides the Athena get query execution service integration task configuration
   * @internal
   */
  protected _renderTask(): any {
    return {
      Resource: integrationResourceArn('athena', 'getQueryExecution', this.integrationPattern),
      Parameters: sfn.FieldUtils.renderObject({
        QueryExecutionId: this.props.queryExecutionId,
      }),
    };
  }
}

