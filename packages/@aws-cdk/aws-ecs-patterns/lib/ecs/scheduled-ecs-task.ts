import { Ec2TaskDefinition } from '@aws-cdk/aws-ecs';
import { EcsTask } from '@aws-cdk/aws-events-targets';
import { Construct } from 'constructs';
import { ScheduledTaskBase, ScheduledTaskBaseProps, ScheduledTaskImageProps } from '../base/scheduled-task-base';

/**
 * The properties for the ScheduledEc2Task task.
 */
export interface ScheduledEc2TaskProps extends ScheduledTaskBaseProps {
  /**
   * The properties to define if using an existing TaskDefinition in this construct.
   * ScheduledEc2TaskDefinitionOptions or ScheduledEc2TaskImageOptions must be defined, but not both.
   *
   * @default none
   */
  readonly scheduledEc2TaskDefinitionOptions?: ScheduledEc2TaskDefinitionOptions;

  /**
   * The properties to define if the construct is to create a TaskDefinition.
   * ScheduledEc2TaskDefinitionOptions or ScheduledEc2TaskImageOptions must be defined, but not both.
   *
   * @default none
   */
  readonly scheduledEc2TaskImageOptions?: ScheduledEc2TaskImageOptions;
}

/**
 * The properties for the ScheduledEc2Task using an image.
 */
export interface ScheduledEc2TaskImageOptions extends ScheduledTaskImageProps {
  /**
   * The minimum number of CPU units to reserve for the container.
   *
   * @default none
   */
  readonly cpu?: number;

  /**
   * The hard limit (in MiB) of memory to present to the container.
   *
   * If your container attempts to exceed the allocated memory, the container
   * is terminated.
   *
   * At least one of memoryLimitMiB and memoryReservationMiB is required for non-Fargate services.
   *
   * @default - No memory limit.
   */
  readonly memoryLimitMiB?: number;

  /**
   * The soft limit (in MiB) of memory to reserve for the container.
   *
   * When system memory is under contention, Docker attempts to keep the
   * container memory within the limit. If the container requires more memory,
   * it can consume up to the value specified by the Memory property or all of
   * the available memory on the container instance—whichever comes first.
   *
   * At least one of memoryLimitMiB and memoryReservationMiB is required for non-Fargate services.
   *
   * @default - No memory reserved.
   */
  readonly memoryReservationMiB?: number;
}

/**
 * The properties for the ScheduledEc2Task using a task definition.
 */
export interface ScheduledEc2TaskDefinitionOptions {
  /**
   * The task definition to use for tasks in the service. One of image or taskDefinition must be specified.
   *
   * [disable-awslint:ref-via-interface]
   *
   * @default - none
   */
  readonly taskDefinition: Ec2TaskDefinition;
}

/**
 * A scheduled EC2 task that will be initiated off of CloudWatch Events.
 */
export class ScheduledEc2Task extends ScheduledTaskBase {
  /**
   * The EC2 task definition in this construct.
   */
  public readonly taskDefinition: Ec2TaskDefinition;

  /**
   * The ECS task in this construct.
   */
  public readonly task: EcsTask;

  /**
   * Constructs a new instance of the ScheduledEc2Task class.
   */
  constructor(scope: Construct, id: string, props: ScheduledEc2TaskProps) {
    super(scope, id, props);

    if (props.scheduledEc2TaskDefinitionOptions && props.scheduledEc2TaskImageOptions) {
      throw new Error('You must specify either a scheduledEc2TaskDefinitionOptions or scheduledEc2TaskOptions, not both.');
    } else if (props.scheduledEc2TaskDefinitionOptions) {
      this.taskDefinition = props.scheduledEc2TaskDefinitionOptions.taskDefinition;
    } else if (props.scheduledEc2TaskImageOptions) {
      const taskImageOptions = props.scheduledEc2TaskImageOptions;
      // Create a Task Definition for the container to start, also creates a log driver
      this.taskDefinition = new Ec2TaskDefinition(this, 'ScheduledTaskDef');
      this.taskDefinition.addContainer('ScheduledContainer', {
        image: taskImageOptions.image,
        memoryLimitMiB: taskImageOptions.memoryLimitMiB,
        memoryReservationMiB: taskImageOptions.memoryReservationMiB,
        cpu: taskImageOptions.cpu,
        command: taskImageOptions.command,
        environment: taskImageOptions.environment,
        secrets: taskImageOptions.secrets,
        logging: taskImageOptions.logDriver ?? this.createAWSLogDriver(this.node.id),
      });
    } else {
      throw new Error('You must specify a taskDefinition or image');
    }

    this.task = this.addTaskDefinitionToEventTarget(this.taskDefinition);
  }
}
