import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Construct } from 'constructs';
import { integrationResourceArn, validatePatternSupported } from '../private/task-utils';
import { generatePolicyResource } from './private/utils';

/**
 * Properties for CodeBuildBatchGetReports
 */
export interface CodeBuildBatchGetReportsProps extends sfn.TaskStateBaseProps {
  /**
   * An array of ARNs that identify the Report objects to return.
   */
  readonly reportArns: string[];
}

/**
 * Return an array of reports as a task
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-codebuild.html
 */
export class CodeBuildBatchGetReports extends sfn.TaskStateBase {
  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] = [
    sfn.IntegrationPattern.REQUEST_RESPONSE,
  ];

  protected readonly taskMetrics?: sfn.TaskMetricsConfig;
  protected readonly taskPolicies?: iam.PolicyStatement[];

  private readonly integrationPattern: sfn.IntegrationPattern;

  constructor(scope: Construct, id: string, private readonly props: CodeBuildBatchGetReportsProps) {
    super(scope, id, props);
    this.integrationPattern = props.integrationPattern ?? sfn.IntegrationPattern.REQUEST_RESPONSE;

    validatePatternSupported(this.integrationPattern, CodeBuildBatchGetReports.SUPPORTED_INTEGRATION_PATTERNS);

    this.taskPolicies = [
      new iam.PolicyStatement({
        resources: generatePolicyResource(scope, this.props.reportArns, 'codebuild', 'report-group'),
        actions: ['codebuild:BatchGetReports'],
      }),
    ];
  }

  /**
   * Provides the CodeBuild BatchGetReports service integration task configuration
   * @internal
   */
  protected _renderTask(): any {
    return {
      Resource: integrationResourceArn('codebuild', 'batchGetReports', this.integrationPattern),
      Parameters: sfn.FieldUtils.renderObject({
        ReportArns: this.props.reportArns,
      }),
    };
  }
}
