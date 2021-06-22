import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { getResourceArn } from '../resource-arn-suffix';

/**
 * Properties for RunLambdaTask
 *
 * @deprecated Use `LambdaInvoke`
 */
export interface RunLambdaTaskProps {
  /**
   * The JSON that you want to provide to your Lambda function as input.
   *
   * @default - The state input (JSON path '$')
   */
  readonly payload?: sfn.TaskInput;

  /**
   * The service integration pattern indicates different ways to invoke Lambda function.
   *
   * The valid value for Lambda is either FIRE_AND_FORGET or WAIT_FOR_TASK_TOKEN,
   * it determines whether to pause the workflow until a task token is returned.
   *
   * If this is set to WAIT_FOR_TASK_TOKEN, the JsonPath.taskToken value must be included
   * somewhere in the payload and the Lambda must call
   * `SendTaskSuccess/SendTaskFailure` using that token.
   *
   * @default FIRE_AND_FORGET
   */
  readonly integrationPattern?: sfn.ServiceIntegrationPattern;

  /**
   * Invocation type of the Lambda function
   *
   * @default RequestResponse
   */
  readonly invocationType?: InvocationType;

  /**
   * Client context to pass to the function
   *
   * @default - No context
   */
  readonly clientContext?: string;

  /**
   * Version or alias of the function to be invoked
   *
   * @default - No qualifier
   */
  readonly qualifier?: string;
}

/**
 * Invoke a Lambda function as a Task
 *
 * OUTPUT: the output of this task is either the return value of Lambda's
 * Invoke call, or whatever the Lambda Function posted back using
 * `SendTaskSuccess/SendTaskFailure` in `waitForTaskToken` mode.
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-lambda.html
 * @deprecated Use `LambdaInvoke`
 */
export class RunLambdaTask implements sfn.IStepFunctionsTask {
  private readonly integrationPattern: sfn.ServiceIntegrationPattern;

  constructor(private readonly lambdaFunction: lambda.IFunction, private readonly props: RunLambdaTaskProps = {}) {
    this.integrationPattern = props.integrationPattern || sfn.ServiceIntegrationPattern.FIRE_AND_FORGET;

    const supportedPatterns = [
      sfn.ServiceIntegrationPattern.FIRE_AND_FORGET,
      sfn.ServiceIntegrationPattern.WAIT_FOR_TASK_TOKEN,
    ];

    if (!supportedPatterns.includes(this.integrationPattern)) {
      throw new Error(`Invalid Service Integration Pattern: ${this.integrationPattern} is not supported to call Lambda.`);
    }

    if (this.integrationPattern === sfn.ServiceIntegrationPattern.WAIT_FOR_TASK_TOKEN
        && !sfn.FieldUtils.containsTaskToken(props.payload)) {
      throw new Error('Task Token is missing in payload (pass JsonPath.taskToken somewhere in payload)');
    }
  }

  public bind(_task: sfn.Task): sfn.StepFunctionsTaskConfig {
    return {
      resourceArn: getResourceArn('lambda', 'invoke', this.integrationPattern),
      policyStatements: [new iam.PolicyStatement({
        resources: [this.lambdaFunction.functionArn],
        actions: ['lambda:InvokeFunction'],
      })],
      metricPrefixSingular: 'LambdaFunction',
      metricPrefixPlural: 'LambdaFunctions',
      metricDimensions: { LambdaFunctionArn: this.lambdaFunction.functionArn },
      parameters: {
        FunctionName: this.lambdaFunction.functionName,
        Payload: this.props.payload ? this.props.payload.value : sfn.TaskInput.fromJsonPathAt('$').value,
        InvocationType: this.props.invocationType,
        ClientContext: this.props.clientContext,
        Qualifier: this.props.qualifier,
      },
    };
  }
}

/**
 * Invocation type of a Lambda
 * @deprecated use `LambdaInvocationType`
 */
export enum InvocationType {
  /**
   * Invoke synchronously
   *
   * The API response includes the function response and additional data.
   */
  REQUEST_RESPONSE = 'RequestResponse',

  /**
   * Invoke asynchronously
   *
   * Send events that fail multiple times to the function's dead-letter queue (if it's configured).
   * The API response only includes a status code.
   */
  EVENT = 'Event',

  /**
   * TValidate parameter values and verify that the user or role has permission to invoke the function.
   */
  DRY_RUN = 'DryRun'
}
