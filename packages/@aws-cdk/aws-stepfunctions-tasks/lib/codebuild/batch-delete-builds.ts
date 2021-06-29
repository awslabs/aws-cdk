import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Construct } from 'constructs';
import { integrationResourceArn, validatePatternSupported } from '../private/task-utils';
import { generatePolicyResource } from './private/utils';

/**
 * Properties for CodeBuildBatchDeleteBuilds
 */
export interface CodeBuildBatchDeleteBuildsProps extends sfn.TaskStateBaseProps {
  /**
   * The IDs of the builds to delete.
   */
  readonly ids: string[];
}

/**
 * Delete one or more builds as a task
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-codebuild.html
 */
export class CodeBuildBatchDeleteBuilds extends sfn.TaskStateBase {
  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] = [
    sfn.IntegrationPattern.REQUEST_RESPONSE,
  ];

  protected readonly taskMetrics?: sfn.TaskMetricsConfig;
  protected readonly taskPolicies?: iam.PolicyStatement[];

  private readonly integrationPattern: sfn.IntegrationPattern;

  constructor(scope: Construct, id: string, private readonly props: CodeBuildBatchDeleteBuildsProps) {
    super(scope, id, props);
    this.integrationPattern = props.integrationPattern ?? sfn.IntegrationPattern.REQUEST_RESPONSE;

    validatePatternSupported(this.integrationPattern, CodeBuildBatchDeleteBuilds.SUPPORTED_INTEGRATION_PATTERNS);

    this.taskPolicies = [
      new iam.PolicyStatement({
        resources: generatePolicyResource(scope, this.props.ids, 'codebuild', 'project'),
        actions: ['codebuild:BatchDeleteBuilds'],
      }),
    ];
  }

  /**
   * Provides the CodeBuild BatchDeleteBuilds service integration task configuration
   * @internal
   */
  protected _renderTask(): any {
    return {
      Resource: integrationResourceArn('codebuild', 'batchDeleteBuilds', this.integrationPattern),
      Parameters: sfn.FieldUtils.renderObject({
        Ids: this.props.ids,
      }),
    };
  }
}
