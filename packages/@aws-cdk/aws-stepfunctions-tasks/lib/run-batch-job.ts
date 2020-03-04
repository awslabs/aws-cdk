import * as batch from '@aws-cdk/aws-batch';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Duration, Stack } from '@aws-cdk/core';
import { getResourceArn } from './resource-arn-suffix';

/**
 * The overrides that should be sent to a container.
 */
export interface ContainerOverrides {
  /**
   * The command to send to the container that overrides
   * the default command from the Docker image or the job definition.
   *
   * @default - No command overrides
   */
  readonly command?: string[];

  /**
   * The environment variables to send to the container.
   * You can add new environment variables, which are added to the container
   * at launch, or you can override the existing environment variables from
   * the Docker image or the job definition.
   *
   * @default - No environment overrides
   */
  readonly environment?: { [key: string]: string };

  /**
   * The instance type to use for a multi-node parallel job.
   * This parameter is not valid for single-node container jobs.
   *
   * @default - No instance type overrides
   */
  readonly instanceType?: ec2.InstanceType;

  /**
   * The number of MiB of memory reserved for the job.
   * This value overrides the value set in the job definition.
   *
   * @default - No memory overrides
   */
  readonly memory?: number;

  /**
   * The number of physical GPUs to reserve for the container.
   * The number of GPUs reserved for all containers in a job
   * should not exceed the number of available GPUs on the compute
   * resource that the job is launched on.
   *
   * @default - No GPU reservation
   */
  readonly gpuCount?: number;

  /**
   * The number of vCPUs to reserve for the container.
   * This value overrides the value set in the job definition.
   *
   * @default - No vCPUs overrides
   */
  readonly vcpus?: number;
}

/**
 * An object representing an AWS Batch job dependency.
 */
export interface JobDependency {
  /**
   * The job ID of the AWS Batch job associated with this dependency.
   *
   * @default - No jobId
   */
  readonly jobId?: string;

  /**
   * The type of the job dependency.
   *
   * @default - No type
   */
  readonly type?: string;
}

/**
 * Properties for RunBatchJob
 */
export interface RunBatchJobProps {
  /**
   * The job definition used by this job.
   */
  readonly jobDefinition: batch.IJobDefinition;

  /**
   * The name of the job.
   * The first character must be alphanumeric, and up to 128 letters (uppercase and lowercase),
   * numbers, hyphens, and underscores are allowed.
   */
  readonly jobName: string;

  /**
   * The job queue into which the job is submitted.
   */
  readonly jobQueue: batch.IJobQueue;

  /**
   * The array size can be between 2 and 10,000.
   * If you specify array properties for a job, it becomes an array job.
   * For more information, see Array Jobs in the AWS Batch User Guide.
   *
   * @default - No array size
   */
  readonly arraySize?: number;

  /**
   * @see https://docs.aws.amazon.com/batch/latest/APIReference/API_SubmitJob.html#Batch-SubmitJob-request-containerOverrides
   *
   * @default - No container overrides
   */
  readonly containerOverrides?: ContainerOverrides;

  /**
   * @see https://docs.aws.amazon.com/batch/latest/APIReference/API_SubmitJob.html#Batch-SubmitJob-request-dependsOn
   *
   * @default - No dependencies
   */
  readonly dependsOn?: JobDependency[];

  /**
   * The payload to be passed as parametrs to the batch job
   *
   * @default - No parameters are passed
   */
  readonly payload?: { [key: string]: any };

  /**
   * The number of times to move a job to the RUNNABLE status.
   * You may specify between 1 and 10 attempts.
   * If the value of attempts is greater than one,
   * the job is retried on failure the same number of attempts as the value.
   *
   * @default - 1
   */
  readonly attempts?: number;

  /**
   * The timeout configuration for this SubmitJob operation.
   * The minimum value for the timeout is 60 seconds.
   *
   * @see https://docs.aws.amazon.com/batch/latest/APIReference/API_SubmitJob.html#Batch-SubmitJob-request-timeout
   *
   * @default - No timeout
   */
  readonly timeout?: Duration;

  /**
   * The service integration pattern indicates different ways to call TerminateCluster.
   *
   * The valid value is either FIRE_AND_FORGET or SYNC.
   *
   * @default SYNC
   */
  readonly integrationPattern?: sfn.ServiceIntegrationPattern;
}

/**
 * A Step Functions Task to run AWS Batch
 */
export class RunBatchJob implements sfn.IStepFunctionsTask {
  private readonly integrationPattern: sfn.ServiceIntegrationPattern;

  constructor(private readonly props: RunBatchJobProps) {
    // validate integrationPattern
    this.integrationPattern =
      props.integrationPattern || sfn.ServiceIntegrationPattern.SYNC;

    const supportedPatterns = [
      sfn.ServiceIntegrationPattern.FIRE_AND_FORGET,
      sfn.ServiceIntegrationPattern.SYNC
    ];

    if (!supportedPatterns.includes(this.integrationPattern)) {
      throw new Error(
        `Invalid Service Integration Pattern: ${this.integrationPattern} is not supported to call RunBatchJob.`
      );
    }

    // validate arraySize limits
    if (
      props.arraySize !== undefined &&
      (props.arraySize < 2 || props.arraySize > 10000)
    ) {
      throw new Error(
        `Invalid value of arraySize. The array size can be between 2 and 10,000.`
      );
    }

    // validate attempts
    if (
      props.attempts !== undefined &&
      (props.attempts < 1 || props.attempts > 10)
    ) {
      throw new Error(
        `Invalid value of attempts. You may specify between 1 and 10 attempts.`
      );
    }

    // validate timeout
    if (props.timeout && props.timeout.toSeconds() < 60) {
      throw new Error(
        `Invalid value of timrout. The minimum value for the timeout is 60 seconds.`
      );
    }

    // This is reuqired since environment variables must not start with AWS_BATCH;
    // this naming convention is reserved for variables that are set by the AWS Batch service.
    if (props.containerOverrides?.environment) {
      Object.keys(props.containerOverrides.environment).forEach(key => {
        if (key.match(/^AWS_BATCH/)) {
          throw new Error(
            `Invalid environment variable name: ${key}. Environment variable names starting with 'AWS_BATCH' are reserved.`
          );
        }
      });
    }
  }

  private configureContainerOverrides(containerOverrides: ContainerOverrides) {
    return {
      Command: containerOverrides.command,
      Environment: containerOverrides.environment
        ? Object.entries(containerOverrides.environment).map(
            ([key, value]) => ({
              Name: key,
              Value: value
            })
          )
        : undefined,
      InstanceType: containerOverrides.instanceType?.toString(),
      Memory: containerOverrides.memory,
      ResourceRequirements: containerOverrides.gpuCount
        ? [
            {
              Type: 'GPU',
              Value: `${containerOverrides.gpuCount}`
            }
          ]
        : undefined,
      Vcpus: containerOverrides.vcpus
    };
  }

  public bind(_task: sfn.Task): sfn.StepFunctionsTaskConfig {
    return {
      resourceArn: getResourceArn(
        'batch',
        'submitJob',
        this.integrationPattern
      ),
      policyStatements: [
        // Resource-level access control is not supported by Batch
        // https://docs.aws.amazon.com/step-functions/latest/dg/batch-iam.html
        new iam.PolicyStatement({
          resources: ['*'],
          actions: ['batch:SubmitJob']
        }),
        new iam.PolicyStatement({
          resources: [
            Stack.of(_task).formatArn({
              service: 'events',
              resource: 'rule/StepFunctionsGetEventsForBatchJobsRule'
            })
          ],
          actions: [
            'events:PutTargets',
            'events:PutRule',
            'events:DescribeRule'
          ]
        })
      ],
      parameters: {
        JobDefinition: this.props.jobDefinition.jobDefinitionArn,
        JobName: this.props.jobName,
        JobQueue: this.props.jobQueue.jobQueueArn,
        Parameters: this.props.payload,

        ArrayProperties:
          this.props.arraySize !== undefined
            ? { Size: this.props.arraySize }
            : undefined,

        ContainerOverrides: this.props.containerOverrides
          ? this.configureContainerOverrides(this.props.containerOverrides)
          : undefined,

        DependsOn: this.props.dependsOn
          ? this.props.dependsOn.map(jobDependency => ({
              JobId: jobDependency.jobId,
              Type: jobDependency.type
            }))
          : undefined,

        RetryStrategy:
          this.props.attempts !== undefined
            ? { Attempts: this.props.attempts }
            : undefined,

        Timeout: this.props.timeout
          ? { AttemptDurationSeconds: this.props.timeout.toSeconds() }
          : undefined
      }
    };
  }
}
