import { FargateTaskDefinition, FargatePlatformVersion } from '@aws-cdk/aws-ecs';
import { EcsTask } from '@aws-cdk/aws-events-targets';
import { Construct } from 'constructs';
import { ScheduledTaskBase, ScheduledTaskBaseProps, ScheduledTaskImageProps } from '../base/scheduled-task-base';

/**
 * The properties for the ScheduledFargateTask task.
 */
export interface ScheduledFargateTaskProps extends ScheduledTaskBaseProps {
  /**
   * The properties to define if using an existing TaskDefinition in this construct.
   * ScheduledFargateTaskDefinitionOptions or ScheduledFargateTaskImageOptions must be defined, but not both.
   *
   * @default none
   */
  readonly scheduledFargateTaskDefinitionOptions?: ScheduledFargateTaskDefinitionOptions;

  /**
   * The properties to define if the construct is to create a TaskDefinition.
   * ScheduledFargateTaskDefinitionOptions or ScheduledFargateTaskImageOptions must be defined, but not both.
   *
   * @default none
   */
  readonly scheduledFargateTaskImageOptions?: ScheduledFargateTaskImageOptions;

  /**
   * The platform version on which to run your service.
   *
   * If one is not specified, the LATEST platform version is used by default. For more information, see
   * [AWS Fargate Platform Versions](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/platform_versions.html)
   * in the Amazon Elastic Container Service Developer Guide.
   *
   * @default Latest
   */
  readonly platformVersion?: FargatePlatformVersion;
}

/**
 * The properties for the ScheduledFargateTask using an image.
 */
export interface ScheduledFargateTaskImageOptions extends ScheduledTaskImageProps {
  /**
   * The number of cpu units used by the task.
   *
   * Valid values, which determines your range of valid values for the memory parameter:
   *
   * 256 (.25 vCPU) - Available memory values: 0.5GB, 1GB, 2GB
   *
   * 512 (.5 vCPU) - Available memory values: 1GB, 2GB, 3GB, 4GB
   *
   * 1024 (1 vCPU) - Available memory values: 2GB, 3GB, 4GB, 5GB, 6GB, 7GB, 8GB
   *
   * 2048 (2 vCPU) - Available memory values: Between 4GB and 16GB in 1GB increments
   *
   * 4096 (4 vCPU) - Available memory values: Between 8GB and 30GB in 1GB increments
   *
   * This default is set in the underlying FargateTaskDefinition construct.
   *
   * @default 256
   */
  readonly cpu?: number;

  /**
   * The hard limit (in MiB) of memory to present to the container.
   *
   * If your container attempts to exceed the allocated memory, the container
   * is terminated.
   *
   * @default 512
   */
  readonly memoryLimitMiB?: number;
}

/**
 * The properties for the ScheduledFargateTask using a task definition.
 */
export interface ScheduledFargateTaskDefinitionOptions {
  /**
   * The task definition to use for tasks in the service. Image or taskDefinition must be specified, but not both.
   *
   * [disable-awslint:ref-via-interface]
   *
   * @default - none
   */
  readonly taskDefinition: FargateTaskDefinition;
}

/**
 * A scheduled Fargate task that will be initiated off of CloudWatch Events.
 */
export class ScheduledFargateTask extends ScheduledTaskBase {
  /**
   * The Fargate task definition in this construct.
   */
  public readonly taskDefinition: FargateTaskDefinition;

  /**
   * The ECS task in this construct.
   */
  public readonly task: EcsTask;

  /**
   * Constructs a new instance of the ScheduledFargateTask class.
   */
  constructor(scope: Construct, id: string, props: ScheduledFargateTaskProps) {
    super(scope, id, props);

    if (props.scheduledFargateTaskDefinitionOptions && props.scheduledFargateTaskImageOptions) {
      throw new Error('You must specify either a scheduledFargateTaskDefinitionOptions or scheduledFargateTaskOptions, not both.');
    } else if (props.scheduledFargateTaskDefinitionOptions) {
      this.taskDefinition = props.scheduledFargateTaskDefinitionOptions.taskDefinition;
    } else if (props.scheduledFargateTaskImageOptions) {
      const taskImageOptions = props.scheduledFargateTaskImageOptions;
      this.taskDefinition = new FargateTaskDefinition(this, 'ScheduledTaskDef', {
        memoryLimitMiB: taskImageOptions.memoryLimitMiB || 512,
        cpu: taskImageOptions.cpu || 256,
      });
      this.taskDefinition.addContainer('ScheduledContainer', {
        image: taskImageOptions.image,
        command: taskImageOptions.command,
        environment: taskImageOptions.environment,
        secrets: taskImageOptions.secrets,
        logging: taskImageOptions.logDriver ?? this.createAWSLogDriver(this.node.id),
      });
    } else {
      throw new Error('You must specify one of: taskDefinition or image');
    }

    // Use the EcsTask as the target of the EventRule
    this.task = new EcsTask( {
      cluster: this.cluster,
      taskDefinition: this.taskDefinition,
      taskCount: this.desiredTaskCount,
      subnetSelection: this.subnetSelection,
      platformVersion: props.platformVersion,
      securityGroups: props.securityGroups,
    });

    this.addTaskAsTarget(this.task);
  }
}
