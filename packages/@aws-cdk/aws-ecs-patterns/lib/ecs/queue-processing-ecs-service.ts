import { Ec2Service, Ec2TaskDefinition } from '@aws-cdk/aws-ecs';
import * as cxapi from '@aws-cdk/cx-api';
import { Construct } from 'constructs';
import { QueueProcessingServiceBase, QueueProcessingServiceBaseProps } from '../base/queue-processing-service-base';

/**
 * The properties for the QueueProcessingEc2Service service.
 */
export interface QueueProcessingEc2ServiceProps extends QueueProcessingServiceBaseProps {
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

  /**
   * Optional name for the container added
   *
   * @default - QueueProcessingContainer
   */
  readonly containerName?: string;
}

/**
 * Class to create a queue processing EC2 service.
 */
export class QueueProcessingEc2Service extends QueueProcessingServiceBase {
  /**
   * The EC2 service in this construct.
   */
  public readonly service: Ec2Service;
  /**
   * The EC2 task definition in this construct
   */
  public readonly taskDefinition: Ec2TaskDefinition;

  /**
   * Constructs a new instance of the QueueProcessingEc2Service class.
   */
  constructor(scope: Construct, id: string, props: QueueProcessingEc2ServiceProps) {
    super(scope, id, props);

    const containerName = props.containerName ?? 'QueueProcessingContainer';

    // Create a Task Definition for the container to start
    this.taskDefinition = new Ec2TaskDefinition(this, 'QueueProcessingTaskDef', {
      family: props.family,
    });
    this.taskDefinition.addContainer(containerName, {
      image: props.image,
      memoryLimitMiB: props.memoryLimitMiB,
      memoryReservationMiB: props.memoryReservationMiB,
      cpu: props.cpu,
      command: props.command,
      environment: this.environment,
      secrets: this.secrets,
      logging: this.logDriver,
    });

    // The desiredCount should be removed from the fargate service when the feature flag is removed.
    const desiredCount = this.node.tryGetContext(cxapi.ECS_REMOVE_DEFAULT_DESIRED_COUNT) ? undefined : this.desiredCount;

    // Create an ECS service with the previously defined Task Definition and configure
    // autoscaling based on cpu utilization and number of messages visible in the SQS queue.
    this.service = new Ec2Service(this, 'QueueProcessingService', {
      cluster: this.cluster,
      desiredCount: desiredCount,
      taskDefinition: this.taskDefinition,
      serviceName: props.serviceName,
      minHealthyPercent: props.minHealthyPercent,
      maxHealthyPercent: props.maxHealthyPercent,
      propagateTags: props.propagateTags,
      enableECSManagedTags: props.enableECSManagedTags,
      deploymentController: props.deploymentController,
      circuitBreaker: props.circuitBreaker,
    });

    this.configureAutoscalingForService(this.service);
    this.grantPermissionsToService(this.service);
  }
}
