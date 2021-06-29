import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Construct } from 'constructs';
import { integrationResourceArn, validatePatternSupported } from '../private/task-utils';
import { generateSinglePolicyResource } from './private/utils';

/**
 * Properties for CodeBuildStopBuild
 */
export interface CodeBuildStopBuildProps extends sfn.TaskStateBaseProps {
  /**
   * The ID of the build to stop.
   */
  readonly buildId: string;
}

/**
 * Stop a CodeBuild Build as a task
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-codebuild.html
 */
export class CodeBuildStopBuild extends sfn.TaskStateBase {
  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] = [
    sfn.IntegrationPattern.REQUEST_RESPONSE,
  ];

  protected readonly taskMetrics?: sfn.TaskMetricsConfig;
  protected readonly taskPolicies?: iam.PolicyStatement[];

  private readonly integrationPattern: sfn.IntegrationPattern;

  constructor(scope: Construct, id: string, private readonly props: CodeBuildStopBuildProps) {
    super(scope, id, props);
    this.integrationPattern = props.integrationPattern ?? sfn.IntegrationPattern.REQUEST_RESPONSE;

    validatePatternSupported(this.integrationPattern, CodeBuildStopBuild.SUPPORTED_INTEGRATION_PATTERNS);

    this.taskPolicies = [
      new iam.PolicyStatement({
        resources: generateSinglePolicyResource(scope, this.props.buildId, 'codebuild', 'project'),
        actions: ['codebuild:StopBuild'],
      }),
    ];
  }

  /**
   * Provides the CodeBuild StopBuild service integration task configuration
   * @internal
   */
  protected _renderTask(): any {
    return {
      Resource: integrationResourceArn('codebuild', 'stopBuild', this.integrationPattern),
      Parameters: sfn.FieldUtils.renderObject({
        Id: this.props.buildId,
      }),
    };
  }
}
