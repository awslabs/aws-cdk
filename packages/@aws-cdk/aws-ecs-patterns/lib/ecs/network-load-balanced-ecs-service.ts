import { Ec2Service, Ec2TaskDefinition } from '@aws-cdk/aws-ecs';
import * as cxapi from '@aws-cdk/cx-api';
import { Construct } from 'constructs';
import { NetworkLoadBalancedServiceBase, NetworkLoadBalancedServiceBaseProps } from '../base/network-load-balanced-service-base';

/**
 * The properties for the NetworkLoadBalancedEc2Service service.
 */
export interface NetworkLoadBalancedEc2ServiceProps extends NetworkLoadBalancedServiceBaseProps {
  /**
   * The task definition to use for tasks in the service. TaskDefinition or TaskImageOptions must be specified, but not both..
   *
   * [disable-awslint:ref-via-interface]
   *
   * @default - none
   */
  readonly taskDefinition?: Ec2TaskDefinition;

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
   * At least one of memoryLimitMiB and memoryReservationMiB is required.
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
   * At least one of memoryLimitMiB and memoryReservationMiB is required.
   *
   * @default - No memory reserved.
   */
  readonly memoryReservationMiB?: number;
}

/**
 * An EC2 service running on an ECS cluster fronted by a network load balancer.
 */
export class NetworkLoadBalancedEc2Service extends NetworkLoadBalancedServiceBase {
  /**
   * The ECS service in this construct.
   */
  public readonly service: Ec2Service;
  /**
   * The EC2 Task Definition in this construct.
   */
  public readonly taskDefinition: Ec2TaskDefinition;

  /**
   * Constructs a new instance of the NetworkLoadBalancedEc2Service class.
   */
  constructor(scope: Construct, id: string, props: NetworkLoadBalancedEc2ServiceProps = {}) {
    super(scope, id, props);

    if (props.taskDefinition && props.taskImageOptions) {
      throw new Error('You must specify either a taskDefinition or an image, not both.');
    } else if (props.taskDefinition) {
      this.taskDefinition = props.taskDefinition;
    } else if (props.taskImageOptions) {
      const taskImageOptions = props.taskImageOptions;
      this.taskDefinition = new Ec2TaskDefinition(this, 'TaskDef', {
        executionRole: taskImageOptions.executionRole,
        taskRole: taskImageOptions.taskRole,
        family: taskImageOptions.family,
      });

      // Create log driver if logging is enabled
      const enableLogging = taskImageOptions.enableLogging ?? true;
      const logDriver = taskImageOptions.logDriver ?? (enableLogging ? this.createAWSLogDriver(this.node.id) : undefined);

      const containerName = taskImageOptions.containerName ?? 'web';
      const container = this.taskDefinition.addContainer(containerName, {
        image: taskImageOptions.image,
        cpu: props.cpu,
        memoryLimitMiB: props.memoryLimitMiB,
        memoryReservationMiB: props.memoryReservationMiB,
        environment: taskImageOptions.environment,
        secrets: taskImageOptions.secrets,
        logging: logDriver,
        dockerLabels: taskImageOptions.dockerLabels,
      });
      container.addPortMappings({
        containerPort: taskImageOptions.containerPort || 80,
      });
    } else {
      throw new Error('You must specify one of: taskDefinition or image');
    }

    const desiredCount = this.node.tryGetContext(cxapi.ECS_REMOVE_DEFAULT_DESIRED_COUNT) ? this.internalDesiredCount : this.desiredCount;

    this.service = new Ec2Service(this, 'Service', {
      cluster: this.cluster,
      desiredCount: desiredCount,
      taskDefinition: this.taskDefinition,
      assignPublicIp: false,
      serviceName: props.serviceName,
      healthCheckGracePeriod: props.healthCheckGracePeriod,
      minHealthyPercent: props.minHealthyPercent,
      maxHealthyPercent: props.maxHealthyPercent,
      propagateTags: props.propagateTags,
      enableECSManagedTags: props.enableECSManagedTags,
      cloudMapOptions: props.cloudMapOptions,
      deploymentController: props.deploymentController,
      circuitBreaker: props.circuitBreaker,
    });
    this.addServiceAsTarget(this.service);
  }
}
