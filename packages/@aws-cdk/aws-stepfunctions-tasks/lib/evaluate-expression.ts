import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import * as path from 'path';

/**
 * Properties for EvaluateExpression
 *
 * @experimental
 */
export interface EvaluateExpressionProps extends sfn.TaskStateBaseProps {
  /**
   * The expression to evaluate. The expression may contain state paths.
   *
   * @example '$.a + $.b'
   */
  readonly expression: string;

  /**
   * The runtime language to use to evaluate the expression.
   *
   * @default lambda.Runtime.NODEJS_10_X
   */
  readonly runtime?: lambda.Runtime;
}

/**
 * The event received by the Lambda function
 *
 * @internal
 */
export interface Event {
  /**
   * The expression to evaluate
   */
  readonly expression: string;

  /**
   * The expression attribute values
   */
  readonly expressionAttributeValues: { [key: string]: any };
}

/**
 * A Step Functions Task to evaluate an expression
 *
 * OUTPUT: the output of this task is the evaluated expression.
 *
 * @experimental
 */
export class EvaluateExpression extends sfn.TaskStateBase {
  protected readonly taskMetrics?: sfn.TaskMetricsConfig;
  protected readonly taskPolicies?: iam.PolicyStatement[];

  private readonly evalFn: lambda.SingletonFunction;

  constructor(scope: cdk.Construct, id: string, private readonly props: EvaluateExpressionProps) {
    super(scope, id, props);

    this.evalFn = createEvalFn(this.props.runtime || lambda.Runtime.NODEJS_10_X, this);

    this.taskPolicies = [
      new iam.PolicyStatement({
        resources: [this.evalFn.functionArn],
        actions: ['lambda:InvokeFunction'],
      }),
    ];
  }

  /**
   * @internal
   */
  protected _renderTask(): any {
    const matches = this.props.expression.match(/\$[.\[][.a-zA-Z[\]0-9]+/g);

    let expressionAttributeValues = {};
    if (matches) {
      expressionAttributeValues = matches.reduce(
        (acc, m) => ({
          ...acc,
          [m]: sfn.JsonPath.stringAt(m), // It's okay to always use `stringAt` here
        }),
        {},
      );
    }

    const parameters: Event = {
      expression: this.props.expression,
      expressionAttributeValues,
    };
    return {
      Resource: this.evalFn.functionArn,
      Parameters: sfn.FieldUtils.renderObject(parameters),
    };
  }
}

function createEvalFn(runtime: lambda.Runtime, scope: cdk.Construct) {
  const code = lambda.Code.asset(path.join(__dirname, `eval-${runtime.name}-handler`));
  const lambdaPurpose = 'Eval';

  switch (runtime) {
    case lambda.Runtime.NODEJS_10_X:
      return new lambda.SingletonFunction(scope, 'EvalFunction', {
        runtime,
        handler: 'index.handler',
        uuid: 'a0d2ce44-871b-4e74-87a1-f5e63d7c3bdc',
        lambdaPurpose,
        code,
      });
    // TODO: implement other runtimes
    default:
      throw new Error(`The runtime ${runtime.name} is currently not supported.`);
  }
}
