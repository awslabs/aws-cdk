import { IRole } from '@aws-cdk/aws-iam';
import { IStateMachine } from '@aws-cdk/aws-stepfunctions';
import { AwsServiceIntegration, AwsServiceIntegrationProps } from './private/integration';

/**
 * The common Step Functions integration resource for HTTP API
 */
abstract class StepFunctionsIntegration extends AwsServiceIntegration {

  /**
   *
   * @internal
   */
  protected _integrationService(): string {
    return 'StepFunctions';
  }
}

/**
 * Step Functions StartExecution integration properties
 */
export interface StepFunctionsStartExecutionIntegrationProps extends AwsServiceIntegrationProps {

  /**
   * The state machine to be executed
   */
  readonly stateMachine: IStateMachine;

  /**
   * The execution name
   *
   * @default - undefined
   */
  readonly name?: string;

  /**
   * The input parameters of execution
   *
   * @default - undefined
   */
  readonly input?: any;

  /**
   * The region of state machine
   *
   * @default - undefined
   */
  readonly region?: string;
}

/**
 * The StepFunctions-StartExecution integration resource for HTTP API
 */
export class StepFunctionsStartExecutionIntegration extends StepFunctionsIntegration {

  constructor(private readonly _props: StepFunctionsStartExecutionIntegrationProps) {
    super(_props);
  }

  /**
   *
   * @internal
   */
  protected _integrationAction(): string {
    return 'StartExecution';
  }

  /**
   *
   * @internal
   */
  protected _fulfillRole(credentialsRole: IRole): void {
    this._props.stateMachine.grantStartExecution(credentialsRole);
  }

  /**
   *
   * @internal
   */
  protected _buildRequestParameters(): { [key: string]: any } {
    return {
      StateMachineArn: this._props.stateMachine.stateMachineArn,
      Name: this._props.name,
      Input: this._props.input,
      Region: this._props.region,
    };
  }
}

/**
 * Step Functions StartSyncExecution integration properties
 */
export interface StepFunctionsStartSyncExecutionIntegrationProps extends StepFunctionsStartExecutionIntegrationProps {

  /**
   * Passes the AWS X-Ray trace header. The trace header can also be passed in the request payload.
   *
   * @default - undefined
   */
  readonly traceHeader?: string;
}

/**
 * The StepFunctions-StartExecution integration resource for HTTP API
 */
export class StepFunctionsStartSyncExecutionIntegration extends StepFunctionsIntegration {

  constructor(private readonly _props: StepFunctionsStartSyncExecutionIntegrationProps) {
    super(_props);
  }

  /**
   *
   * @internal
   */
  protected _integrationAction(): string {
    return 'StartSyncExecution';
  }

  /**
   *
   * @internal
   */
  protected _fulfillRole(credentialsRole: IRole): void {
    this._props.stateMachine.grantStartExecution(credentialsRole);
  }

  /**
   *
   * @internal
   */
  protected _buildRequestParameters(): { [key: string]: any } {
    return {
      StateMachineArn: this._props.stateMachine.stateMachineArn,
      Name: this._props.name,
      Input: this._props.input,
      Region: this._props.region,
      TraceHeader: this._props.traceHeader,
    };
  }
}