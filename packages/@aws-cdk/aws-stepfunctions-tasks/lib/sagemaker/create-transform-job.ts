import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Size, Stack, Token } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { integrationResourceArn, validatePatternSupported } from '../private/task-utils';
import { BatchStrategy, DataProcessing, ModelClientOptions, S3DataType, TransformInput, TransformOutput, TransformResources } from './base-types';
import { renderTags } from './private/utils';

/**
 * Properties for creating an Amazon SageMaker transform job task
 *
 */
export interface SageMakerCreateTransformJobProps extends sfn.TaskStateBaseProps {
  /**
   * Transform Job Name.
   */
  readonly transformJobName: string;

  /**
   * Role for the Transform Job.
   *
   * @default - A role is created with `AmazonSageMakerFullAccess` managed policy
   */
  readonly role?: iam.IRole;

  /**
   * Number of records to include in a mini-batch for an HTTP inference request.
   *
   * @default - No batch strategy
   */
  readonly batchStrategy?: BatchStrategy;

  /**
   * Specifies the data to be used for inference,
   * and to associate the data that is relevant to the prediction results in the output.
   *
   * @default - No data processing attributes
   */
  readonly dataProcessing?: DataProcessing;

  /**
   * Environment variables to set in the Docker container.
   *
   * @default - No environment variables
   */
  readonly environment?: { [key: string]: string };

  /**
   * Maximum number of parallel requests that can be sent to each instance in a transform job.
   *
   * @default - Amazon SageMaker checks the optional execution-parameters to determine the settings for your chosen algorithm.
   * If the execution-parameters endpoint is not enabled, the default value is 1.
   */
  readonly maxConcurrentTransforms?: number;

  /**
   * Maximum allowed size of the payload, in MB.
   *
   * @default 6
   */
  readonly maxPayload?: Size;

  /**
   * Name of the model that you want to use for the transform job.
   */
  readonly modelName: string;

  /**
   * Configures the timeout and maximum number of retries for processing a transform job invocation.
   *
   * @default - 0 retries and 60 seconds of timeout
   */
  readonly modelClientOptions?: ModelClientOptions;

  /**
   * Tags to be applied to the train job.
   *
   * @default - No tags
   */
  readonly tags?: { [key: string]: string };

  /**
   * Dataset to be transformed and the Amazon S3 location where it is stored.
   */
  readonly transformInput: TransformInput;

  /**
   * S3 location where you want Amazon SageMaker to save the results from the transform job.
   */
  readonly transformOutput: TransformOutput;

  /**
   * ML compute instances for the transform job.
   *
   * @default - 1 instance of type M4.XLarge
   */
  readonly transformResources?: TransformResources;
}

/**
 * Class representing the SageMaker Create Transform Job task.
 *
 */
export class SageMakerCreateTransformJob extends sfn.TaskStateBase {
  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] = [
    sfn.IntegrationPattern.REQUEST_RESPONSE,
    sfn.IntegrationPattern.RUN_JOB,
  ];

  protected readonly taskPolicies?: iam.PolicyStatement[];
  protected readonly taskMetrics?: sfn.TaskMetricsConfig;

  /**
   * Dataset to be transformed and the Amazon S3 location where it is stored.
   */
  private readonly transformInput: TransformInput;

  /**
   * ML compute instances for the transform job.
   */
  private readonly transformResources: TransformResources;
  private readonly integrationPattern: sfn.IntegrationPattern;
  private _role?: iam.IRole;

  constructor(scope: Construct, id: string, private readonly props: SageMakerCreateTransformJobProps) {
    super(scope, id, props);
    this.integrationPattern = props.integrationPattern || sfn.IntegrationPattern.REQUEST_RESPONSE;
    validatePatternSupported(this.integrationPattern, SageMakerCreateTransformJob.SUPPORTED_INTEGRATION_PATTERNS);

    // set the sagemaker role or create new one
    if (props.role) {
      this._role = props.role;
    }

    // set the S3 Data type of the input data config objects to be 'S3Prefix' if not defined
    this.transformInput = props.transformInput.transformDataSource.s3DataSource.s3DataType
      ? props.transformInput
      : Object.assign({}, props.transformInput, {
        transformDataSource: { s3DataSource: { ...props.transformInput.transformDataSource.s3DataSource, s3DataType: S3DataType.S3_PREFIX } },
      });

    // set the default value for the transform resources
    this.transformResources = props.transformResources || {
      instanceCount: 1,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.M4, ec2.InstanceSize.XLARGE),
    };

    this.taskPolicies = this.makePolicyStatements();
  }

  /**
   * @internal
   */
  protected _renderTask(): any {
    return {
      Resource: integrationResourceArn('sagemaker', 'createTransformJob', this.integrationPattern),
      Parameters: sfn.FieldUtils.renderObject(this.renderParameters()),
    };
  }

  /**
   * The execution role for the Sagemaker transform job.
   *
   * Only available after task has been added to a state machine.
   */
  public get role(): iam.IRole {
    if (this._role === undefined) {
      throw new Error('role not available yet--use the object in a Task first');
    }
    return this._role;
  }

  private renderParameters(): { [key: string]: any } {
    return {
      ...(this.props.batchStrategy ? { BatchStrategy: this.props.batchStrategy } : {}),
      ...(this.props.dataProcessing ? this.renderDataProcessing(this.props.dataProcessing) : {}),
      ...this.renderEnvironment(this.props.environment),
      ...(this.props.maxConcurrentTransforms ? { MaxConcurrentTransforms: this.props.maxConcurrentTransforms } : {}),
      ...(this.props.maxPayload ? { MaxPayloadInMB: this.props.maxPayload.toMebibytes() } : {}),
      ...this.props.modelClientOptions ? this.renderModelClientOptions(this.props.modelClientOptions) : {},
      ModelName: this.props.modelName,
      ...renderTags(this.props.tags),
      ...this.renderTransformInput(this.transformInput),
      TransformJobName: this.props.transformJobName,
      ...this.renderTransformOutput(this.props.transformOutput),
      ...this.renderTransformResources(this.transformResources),
    };
  }

  private renderDataProcessing(dataProcessing: DataProcessing): { [key: string]: any } {
    return {
      DataProcessing: {
        InputFilter: dataProcessing.inputFilter,
        JoinSource: dataProcessing.joinSource,
        OutputFilter: dataProcessing.outputFilter,
      },
    };
  }

  private renderModelClientOptions(options: ModelClientOptions): { [key: string]: any } {
    const retries = options.invocationsMaxRetries;
    if (!Token.isUnresolved(retries) && retries? (retries < 0 || retries > 3): false) {
      throw new Error(`invocationsMaxRetries should be between 0 and 3. Received: ${retries}.`);
    }
    const timeout = options.invocationsTimeout?.toSeconds();
    if (!Token.isUnresolved(timeout) && timeout? (timeout < 1 || timeout > 3600): false) {
      throw new Error(`invocationsTimeout should be between 1 and 3600 seconds. Received: ${timeout}.`);
    }
    return {
      ModelClientConfig: {
        InvocationsMaxRetries: retries ?? 0,
        InvocationsTimeoutInSeconds: timeout ?? 60,
      },
    };
  }

  private renderTransformInput(input: TransformInput): { [key: string]: any } {
    return {
      TransformInput: {
        ...(input.compressionType ? { CompressionType: input.compressionType } : {}),
        ...(input.contentType ? { ContentType: input.contentType } : {}),
        DataSource: {
          S3DataSource: {
            S3Uri: input.transformDataSource.s3DataSource.s3Uri,
            S3DataType: input.transformDataSource.s3DataSource.s3DataType,
          },
        },
        ...(input.splitType ? { SplitType: input.splitType } : {}),
      },
    };
  }

  private renderTransformOutput(output: TransformOutput): { [key: string]: any } {
    return {
      TransformOutput: {
        S3OutputPath: output.s3OutputPath,
        ...(output.encryptionKey ? { KmsKeyId: output.encryptionKey.keyArn } : {}),
        ...(output.accept ? { Accept: output.accept } : {}),
        ...(output.assembleWith ? { AssembleWith: output.assembleWith } : {}),
      },
    };
  }

  private renderTransformResources(resources: TransformResources): { [key: string]: any } {
    return {
      TransformResources: {
        InstanceCount: resources.instanceCount,
        InstanceType: 'ml.' + resources.instanceType,
        ...(resources.volumeEncryptionKey ? { VolumeKmsKeyId: resources.volumeEncryptionKey.keyArn } : {}),
      },
    };
  }

  private renderEnvironment(environment: { [key: string]: any } | undefined): { [key: string]: any } {
    return environment ? { Environment: environment } : {};
  }

  private makePolicyStatements(): iam.PolicyStatement[] {
    const stack = Stack.of(this);

    // create new role if doesn't exist
    if (this._role === undefined) {
      this._role = new iam.Role(this, 'SagemakerTransformRole', {
        assumedBy: new iam.ServicePrincipal('sagemaker.amazonaws.com'),
        managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess')],
      });
    }

    // https://docs.aws.amazon.com/step-functions/latest/dg/sagemaker-iam.html
    const policyStatements = [
      new iam.PolicyStatement({
        actions: ['sagemaker:CreateTransformJob', 'sagemaker:DescribeTransformJob', 'sagemaker:StopTransformJob'],
        resources: [
          stack.formatArn({
            service: 'sagemaker',
            resource: 'transform-job',
            resourceName: '*',
          }),
        ],
      }),
      new iam.PolicyStatement({
        actions: ['sagemaker:ListTags'],
        resources: ['*'],
      }),
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [this.role.roleArn],
        conditions: {
          StringEquals: { 'iam:PassedToService': 'sagemaker.amazonaws.com' },
        },
      }),
    ];

    if (this.integrationPattern === sfn.IntegrationPattern.RUN_JOB) {
      policyStatements.push(
        new iam.PolicyStatement({
          actions: ['events:PutTargets', 'events:PutRule', 'events:DescribeRule'],
          resources: [
            stack.formatArn({
              service: 'events',
              resource: 'rule',
              resourceName: 'StepFunctionsGetEventsForSageMakerTransformJobsRule',
            }),
          ],
        }),
      );
    }

    return policyStatements;
  }
}
