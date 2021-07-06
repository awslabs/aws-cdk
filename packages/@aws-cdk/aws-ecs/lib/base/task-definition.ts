import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import { IResource, Lazy, Names, PhysicalName, Resource } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { ContainerDefinition, ContainerDefinitionOptions, PortMapping, Protocol } from '../container-definition';
import { CfnTaskDefinition } from '../ecs.generated';
import { FirelensLogRouter, FirelensLogRouterDefinitionOptions, FirelensLogRouterType, obtainDefaultFluentBitECRImage } from '../firelens-log-router';
import { AwsLogDriver } from '../log-drivers/aws-log-driver';
import { PlacementConstraint } from '../placement';
import { ProxyConfiguration } from '../proxy-configuration/proxy-configuration';
import { ImportedTaskDefinition } from './_imported-task-definition';

/**
 * The interface for all task definitions.
 */
export interface ITaskDefinition extends IResource {
  /**
   * ARN of this task definition
   * @attribute
   */
  readonly taskDefinitionArn: string;

  /**
   * Execution role for this task definition
   */
  readonly executionRole?: iam.IRole;

  /**
   * What launch types this task definition should be compatible with.
   */
  readonly compatibility: Compatibility;

  /**
   * Return true if the task definition can be run on an EC2 cluster
   */
  readonly isEc2Compatible: boolean;

  /**
   * Return true if the task definition can be run on a Fargate cluster
   */
  readonly isFargateCompatible: boolean;

  /**
   * Return true if the task definition can be run on a ECS Anywhere cluster
   */
  readonly isExternalCompatible: boolean;


  /**
   * The networking mode to use for the containers in the task.
   */
  readonly networkMode: NetworkMode;

  /**
   * The name of the IAM role that grants containers in the task permission to call AWS APIs on your behalf.
   */
  readonly taskRole: iam.IRole;
}

/**
 * The common properties for all task definitions. For more information, see
 * [Task Definition Parameters](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html).
 */
export interface CommonTaskDefinitionProps {
  /**
   * The name of a family that this task definition is registered to. A family groups multiple versions of a task definition.
   *
   * @default - Automatically generated name.
   */
  readonly family?: string;

  /**
   * The name of the IAM task execution role that grants the ECS agent to call AWS APIs on your behalf.
   *
   * The role will be used to retrieve container images from ECR and create CloudWatch log groups.
   *
   * @default - An execution role will be automatically created if you use ECR images in your task definition.
   */
  readonly executionRole?: iam.IRole;

  /**
   * The name of the IAM role that grants containers in the task permission to call AWS APIs on your behalf.
   *
   * @default - A task role is automatically created for you.
   */
  readonly taskRole?: iam.IRole;

  /**
   * The configuration details for the App Mesh proxy.
   *
   * @default - No proxy configuration.
   */
  readonly proxyConfiguration?: ProxyConfiguration;

  /**
   * The list of volume definitions for the task. For more information, see
   * [Task Definition Parameter Volumes](https://docs.aws.amazon.com/AmazonECS/latest/developerguide//task_definition_parameters.html#volumes).
   *
   * @default - No volumes are passed to the Docker daemon on a container instance.
   */
  readonly volumes?: Volume[];
}

/**
 * The properties for task definitions.
 */
export interface TaskDefinitionProps extends CommonTaskDefinitionProps {
  /**
   * The networking mode to use for the containers in the task.
   *
   * On Fargate, the only supported networking mode is AwsVpc.
   *
   * @default - NetworkMode.Bridge for EC2 & External tasks, AwsVpc for Fargate tasks.
   */
  readonly networkMode?: NetworkMode;

  /**
   * The placement constraints to use for tasks in the service.
   *
   * You can specify a maximum of 10 constraints per task (this limit includes
   * constraints in the task definition and those specified at run time).
   *
   * Not supported in Fargate.
   *
   * @default - No placement constraints.
   */
  readonly placementConstraints?: PlacementConstraint[];

  /**
   * The task launch type compatiblity requirement.
   */
  readonly compatibility: Compatibility;

  /**
   * The number of cpu units used by the task.
   *
   * If you are using the EC2 launch type, this field is optional and any value can be used.
   * If you are using the Fargate launch type, this field is required and you must use one of the following values,
   * which determines your range of valid values for the memory parameter:
   *
   * 256 (.25 vCPU) - Available memory values: 512 (0.5 GB), 1024 (1 GB), 2048 (2 GB)
   *
   * 512 (.5 vCPU) - Available memory values: 1024 (1 GB), 2048 (2 GB), 3072 (3 GB), 4096 (4 GB)
   *
   * 1024 (1 vCPU) - Available memory values: 2048 (2 GB), 3072 (3 GB), 4096 (4 GB), 5120 (5 GB), 6144 (6 GB), 7168 (7 GB), 8192 (8 GB)
   *
   * 2048 (2 vCPU) - Available memory values: Between 4096 (4 GB) and 16384 (16 GB) in increments of 1024 (1 GB)
   *
   * 4096 (4 vCPU) - Available memory values: Between 8192 (8 GB) and 30720 (30 GB) in increments of 1024 (1 GB)
   *
   * @default - CPU units are not specified.
   */
  readonly cpu?: string;

  /**
   * The amount (in MiB) of memory used by the task.
   *
   * If using the EC2 launch type, this field is optional and any value can be used.
   * If using the Fargate launch type, this field is required and you must use one of the following values,
   * which determines your range of valid values for the cpu parameter:
   *
   * 512 (0.5 GB), 1024 (1 GB), 2048 (2 GB) - Available cpu values: 256 (.25 vCPU)
   *
   * 1024 (1 GB), 2048 (2 GB), 3072 (3 GB), 4096 (4 GB) - Available cpu values: 512 (.5 vCPU)
   *
   * 2048 (2 GB), 3072 (3 GB), 4096 (4 GB), 5120 (5 GB), 6144 (6 GB), 7168 (7 GB), 8192 (8 GB) - Available cpu values: 1024 (1 vCPU)
   *
   * Between 4096 (4 GB) and 16384 (16 GB) in increments of 1024 (1 GB) - Available cpu values: 2048 (2 vCPU)
   *
   * Between 8192 (8 GB) and 30720 (30 GB) in increments of 1024 (1 GB) - Available cpu values: 4096 (4 vCPU)
   *
   * @default - Memory used by task is not specified.
   */
  readonly memoryMiB?: string;

  /**
   * The IPC resource namespace to use for the containers in the task.
   *
   * Not supported in Fargate and Windows containers.
   *
   * @default - IpcMode used by the task is not specified
   */
  readonly ipcMode?: IpcMode;

  /**
   * The process namespace to use for the containers in the task.
   *
   * Not supported in Fargate and Windows containers.
   *
   * @default - PidMode used by the task is not specified
   */
  readonly pidMode?: PidMode;

  /**
   * The inference accelerators to use for the containers in the task.
   *
   * Not supported in Fargate.
   *
   * @default - No inference accelerators.
   */
  readonly inferenceAccelerators?: InferenceAccelerator[];
}

/**
 * The common task definition attributes used across all types of task definitions.
 */
export interface CommonTaskDefinitionAttributes {
  /**
   * The arn of the task definition
   */
  readonly taskDefinitionArn: string;

  /**
   * The networking mode to use for the containers in the task.
   *
   * @default Network mode cannot be provided to the imported task.
   */
  readonly networkMode?: NetworkMode;

  /**
   * The name of the IAM role that grants containers in the task permission to call AWS APIs on your behalf.
   *
   * @default Permissions cannot be granted to the imported task.
   */
  readonly taskRole?: iam.IRole;
}

/**
 *  A reference to an existing task definition
 */
export interface TaskDefinitionAttributes extends CommonTaskDefinitionAttributes {
  /**
   * What launch types this task definition should be compatible with.
   *
   * @default Compatibility.EC2_AND_FARGATE
   */
  readonly compatibility?: Compatibility;
}

abstract class TaskDefinitionBase extends Resource implements ITaskDefinition {

  public abstract readonly compatibility: Compatibility;
  public abstract readonly networkMode: NetworkMode;
  public abstract readonly taskDefinitionArn: string;
  public abstract readonly taskRole: iam.IRole;
  public abstract readonly executionRole?: iam.IRole;

  /**
   * Return true if the task definition can be run on an EC2 cluster
   */
  public get isEc2Compatible(): boolean {
    return isEc2Compatible(this.compatibility);
  }

  /**
   * Return true if the task definition can be run on a Fargate cluster
   */
  public get isFargateCompatible(): boolean {
    return isFargateCompatible(this.compatibility);
  }

  /**
   * Return true if the task definition can be run on a ECS anywhere cluster
   */
  public get isExternalCompatible(): boolean {
    return isExternalCompatible(this.compatibility);
  }
}

/**
 * The base class for all task definitions.
 */
export class TaskDefinition extends TaskDefinitionBase {

  /**
   * Imports a task definition from the specified task definition ARN.
   *
   * The task will have a compatibility of EC2+Fargate.
   */
  public static fromTaskDefinitionArn(scope: Construct, id: string, taskDefinitionArn: string): ITaskDefinition {
    return new ImportedTaskDefinition(scope, id, { taskDefinitionArn: taskDefinitionArn });
  }

  /**
   * Create a task definition from a task definition reference
   */
  public static fromTaskDefinitionAttributes(scope: Construct, id: string, attrs: TaskDefinitionAttributes): ITaskDefinition {
    return new ImportedTaskDefinition(scope, id, {
      taskDefinitionArn: attrs.taskDefinitionArn,
      compatibility: attrs.compatibility,
      networkMode: attrs.networkMode,
      taskRole: attrs.taskRole,
    });
  }

  /**
   * The name of a family that this task definition is registered to.
   * A family groups multiple versions of a task definition.
   */
  public readonly family: string;

  /**
   * The full Amazon Resource Name (ARN) of the task definition.
   * @attribute
   */
  public readonly taskDefinitionArn: string;

  /**
   * The name of the IAM role that grants containers in the task permission to call AWS APIs on your behalf.
   */
  public readonly taskRole: iam.IRole;

  /**
   * The networking mode to use for the containers in the task.
   */
  public readonly networkMode: NetworkMode;

  /**
   * Default container for this task
   *
   * Load balancers will send traffic to this container. The first
   * essential container that is added to this task will become the default
   * container.
   */
  public defaultContainer?: ContainerDefinition;

  /**
   * The task launch type compatibility requirement.
   */
  public readonly compatibility: Compatibility;

  /**
   * The container definitions.
   */
  protected readonly containers = new Array<ContainerDefinition>();

  /**
   * All volumes
   */
  private readonly volumes: Volume[] = [];

  /**
   * Placement constraints for task instances
   */
  private readonly placementConstraints = new Array<CfnTaskDefinition.TaskDefinitionPlacementConstraintProperty>();

  /**
   * Inference accelerators for task instances
   */
  private readonly _inferenceAccelerators: InferenceAccelerator[] = [];

  private _executionRole?: iam.IRole;

  private _referencesSecretJsonField?: boolean;

  /**
   * Constructs a new instance of the TaskDefinition class.
   */
  constructor(scope: Construct, id: string, props: TaskDefinitionProps) {
    super(scope, id);

    this.family = props.family || Names.uniqueId(this);
    this.compatibility = props.compatibility;

    if (props.volumes) {
      props.volumes.forEach(v => this.addVolume(v));
    }

    this.networkMode = props.networkMode ?? (this.isFargateCompatible ? NetworkMode.AWS_VPC : NetworkMode.BRIDGE);
    if (this.isFargateCompatible && this.networkMode !== NetworkMode.AWS_VPC) {
      throw new Error(`Fargate tasks can only have AwsVpc network mode, got: ${this.networkMode}`);
    }
    if (props.proxyConfiguration && this.networkMode !== NetworkMode.AWS_VPC) {
      throw new Error(`ProxyConfiguration can only be used with AwsVpc network mode, got: ${this.networkMode}`);
    }
    if (props.placementConstraints && props.placementConstraints.length > 0 && this.isFargateCompatible) {
      throw new Error('Cannot set placement constraints on tasks that run on Fargate');
    }

    if (this.isFargateCompatible && (!props.cpu || !props.memoryMiB)) {
      throw new Error(`Fargate-compatible tasks require both CPU (${props.cpu}) and memory (${props.memoryMiB}) specifications`);
    }

    if (props.inferenceAccelerators && props.inferenceAccelerators.length > 0 && this.isFargateCompatible) {
      throw new Error('Cannot use inference accelerators on tasks that run on Fargate');
    }

    if (this.isExternalCompatible && this.networkMode !== NetworkMode.BRIDGE) {
      throw new Error(`External tasks can only have Bridge network mode, got: ${this.networkMode}`);
    }

    this._executionRole = props.executionRole;

    this.taskRole = props.taskRole || new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    if (props.inferenceAccelerators) {
      props.inferenceAccelerators.forEach(ia => this.addInferenceAccelerator(ia));
    }

    const taskDef = new CfnTaskDefinition(this, 'Resource', {
      containerDefinitions: Lazy.any({ produce: () => this.renderContainers() }, { omitEmptyArray: true }),
      volumes: Lazy.any({ produce: () => this.renderVolumes() }, { omitEmptyArray: true }),
      executionRoleArn: Lazy.string({ produce: () => this.executionRole && this.executionRole.roleArn }),
      family: this.family,
      taskRoleArn: this.taskRole.roleArn,
      requiresCompatibilities: [
        ...(isEc2Compatible(props.compatibility) ? ['EC2'] : []),
        ...(isFargateCompatible(props.compatibility) ? ['FARGATE'] : []),
        ...(isExternalCompatible(props.compatibility) ? ['EXTERNAL'] : []),
      ],
      networkMode: this.renderNetworkMode(this.networkMode),
      placementConstraints: Lazy.any({
        produce: () =>
          !isFargateCompatible(this.compatibility) ? this.placementConstraints : undefined,
      }, { omitEmptyArray: true }),
      proxyConfiguration: props.proxyConfiguration ? props.proxyConfiguration.bind(this.stack, this) : undefined,
      cpu: props.cpu,
      memory: props.memoryMiB,
      ipcMode: props.ipcMode,
      pidMode: props.pidMode,
      inferenceAccelerators: Lazy.any({
        produce: () =>
          !isFargateCompatible(this.compatibility) ? this.renderInferenceAccelerators() : undefined,
      }, { omitEmptyArray: true }),
    });

    if (props.placementConstraints) {
      props.placementConstraints.forEach(pc => this.addPlacementConstraint(pc));
    }

    this.taskDefinitionArn = taskDef.ref;
  }

  public get executionRole(): iam.IRole | undefined {
    return this._executionRole;
  }

  /**
   * Public getter method to access list of inference accelerators attached to the instance.
   */
  public get inferenceAccelerators(): InferenceAccelerator[] {
    return this._inferenceAccelerators;
  }

  private renderVolumes(): CfnTaskDefinition.VolumeProperty[] {
    return this.volumes.map(renderVolume);

    function renderVolume(spec: Volume): CfnTaskDefinition.VolumeProperty {
      return {
        host: spec.host,
        name: spec.name,
        dockerVolumeConfiguration: spec.dockerVolumeConfiguration && {
          autoprovision: spec.dockerVolumeConfiguration.autoprovision,
          driver: spec.dockerVolumeConfiguration.driver,
          driverOpts: spec.dockerVolumeConfiguration.driverOpts,
          labels: spec.dockerVolumeConfiguration.labels,
          scope: spec.dockerVolumeConfiguration.scope,
        },
        efsVolumeConfiguration: spec.efsVolumeConfiguration && {
          fileSystemId: spec.efsVolumeConfiguration.fileSystemId,
          authorizationConfig: spec.efsVolumeConfiguration.authorizationConfig,
          rootDirectory: spec.efsVolumeConfiguration.rootDirectory,
          transitEncryption: spec.efsVolumeConfiguration.transitEncryption,
          transitEncryptionPort: spec.efsVolumeConfiguration.transitEncryptionPort,

        },
      };
    }
  }

  private renderInferenceAccelerators(): CfnTaskDefinition.InferenceAcceleratorProperty[] {
    return this._inferenceAccelerators.map(renderInferenceAccelerator);

    function renderInferenceAccelerator(inferenceAccelerator: InferenceAccelerator) : CfnTaskDefinition.InferenceAcceleratorProperty {
      return {
        deviceName: inferenceAccelerator.deviceName,
        deviceType: inferenceAccelerator.deviceType,
      };
    }
  }

  /**
   * Validate the existence of the input target and set default values.
   *
   * @internal
   */
  public _validateTarget(options: LoadBalancerTargetOptions): LoadBalancerTarget {
    const targetContainer = this.findContainer(options.containerName);
    if (targetContainer === undefined) {
      throw new Error(`No container named '${options.containerName}'. Did you call "addContainer()"?`);
    }
    const targetProtocol = options.protocol || Protocol.TCP;
    const targetContainerPort = options.containerPort || targetContainer.containerPort;
    const portMapping = targetContainer.findPortMapping(targetContainerPort, targetProtocol);
    if (portMapping === undefined) {
      // eslint-disable-next-line max-len
      throw new Error(`Container '${targetContainer}' has no mapping for port ${options.containerPort} and protocol ${targetProtocol}. Did you call "container.addPortMappings()"?`);
    }
    return {
      containerName: options.containerName,
      portMapping,
    };
  }

  /**
   * Returns the port range to be opened that match the provided container name and container port.
   *
   * @internal
   */
  public _portRangeFromPortMapping(portMapping: PortMapping): ec2.Port {
    if (portMapping.hostPort !== undefined && portMapping.hostPort !== 0) {
      return portMapping.protocol === Protocol.UDP ? ec2.Port.udp(portMapping.hostPort) : ec2.Port.tcp(portMapping.hostPort);
    }
    if (this.networkMode === NetworkMode.BRIDGE || this.networkMode === NetworkMode.NAT) {
      return EPHEMERAL_PORT_RANGE;
    }
    return portMapping.protocol === Protocol.UDP ? ec2.Port.udp(portMapping.containerPort) : ec2.Port.tcp(portMapping.containerPort);
  }

  /**
   * Adds a policy statement to the task IAM role.
   */
  public addToTaskRolePolicy(statement: iam.PolicyStatement) {
    this.taskRole.addToPrincipalPolicy(statement);
  }

  /**
   * Adds a policy statement to the task execution IAM role.
   */
  public addToExecutionRolePolicy(statement: iam.PolicyStatement) {
    this.obtainExecutionRole().addToPrincipalPolicy(statement);
  }

  /**
   * Adds a new container to the task definition.
   */
  public addContainer(id: string, props: ContainerDefinitionOptions) {
    return new ContainerDefinition(this, id, { taskDefinition: this, ...props });
  }

  /**
   * Adds a firelens log router to the task definition.
   */
  public addFirelensLogRouter(id: string, props: FirelensLogRouterDefinitionOptions) {
    // only one firelens log router is allowed in each task.
    if (this.containers.find(x => x instanceof FirelensLogRouter)) {
      throw new Error('Firelens log router is already added in this task.');
    }

    return new FirelensLogRouter(this, id, { taskDefinition: this, ...props });
  }

  /**
   * Links a container to this task definition.
   * @internal
   */
  public _linkContainer(container: ContainerDefinition) {
    this.containers.push(container);
    if (this.defaultContainer === undefined && container.essential) {
      this.defaultContainer = container;
    }
    if (container.referencesSecretJsonField) {
      this._referencesSecretJsonField = true;
    }
  }

  /**
   * Adds a volume to the task definition.
   */
  public addVolume(volume: Volume) {
    this.volumes.push(volume);
  }

  /**
   * Adds the specified placement constraint to the task definition.
   */
  public addPlacementConstraint(constraint: PlacementConstraint) {
    if (isFargateCompatible(this.compatibility)) {
      throw new Error('Cannot set placement constraints on tasks that run on Fargate');
    }
    this.placementConstraints.push(...constraint.toJson());
  }

  /**
   * Adds the specified extension to the task definition.
   *
   * Extension can be used to apply a packaged modification to
   * a task definition.
   */
  public addExtension(extension: ITaskDefinitionExtension) {
    extension.extend(this);
  }

  /**
   * Adds an inference accelerator to the task definition.
   */
  public addInferenceAccelerator(inferenceAccelerator: InferenceAccelerator) {
    if (isFargateCompatible(this.compatibility)) {
      throw new Error('Cannot use inference accelerators on tasks that run on Fargate');
    }
    this._inferenceAccelerators.push(inferenceAccelerator);
  }

  /**
   * Creates the task execution IAM role if it doesn't already exist.
   */
  public obtainExecutionRole(): iam.IRole {
    if (!this._executionRole) {
      this._executionRole = new iam.Role(this, 'ExecutionRole', {
        assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        // needed for cross-account access with TagParameterContainerImage
        roleName: PhysicalName.GENERATE_IF_NEEDED,
      });
    }
    return this._executionRole;
  }

  /**
   * Whether this task definition has at least a container that references a
   * specific JSON field of a secret stored in Secrets Manager.
   */
  public get referencesSecretJsonField(): boolean | undefined {
    return this._referencesSecretJsonField;
  }

  /**
   * Validates the task definition.
   */
  protected validate(): string[] {
    const ret = super.validate();

    if (isEc2Compatible(this.compatibility)) {
      // EC2 mode validations

      // Container sizes
      for (const container of this.containers) {
        if (!container.memoryLimitSpecified) {
          ret.push(`ECS Container ${container.containerName} must have at least one of 'memoryLimitMiB' or 'memoryReservationMiB' specified`);
        }
      }
    }
    return ret;
  }

  /**
   * Returns the container that match the provided containerName.
   */
  public findContainer(containerName: string): ContainerDefinition | undefined {
    return this.containers.find(c => c.containerName === containerName);
  }

  private renderNetworkMode(networkMode: NetworkMode): string | undefined {
    return (networkMode === NetworkMode.NAT) ? undefined : networkMode;
  }

  private renderContainers() {
    // add firelens log router container if any application container is using firelens log driver,
    // also check if already created log router container
    for (const container of this.containers) {
      if (container.logDriverConfig && container.logDriverConfig.logDriver === 'awsfirelens'
        && !this.containers.find(x => x instanceof FirelensLogRouter)) {
        this.addFirelensLogRouter('log-router', {
          image: obtainDefaultFluentBitECRImage(this, container.logDriverConfig),
          firelensConfig: {
            type: FirelensLogRouterType.FLUENTBIT,
          },
          logging: new AwsLogDriver({ streamPrefix: 'firelens' }),
          memoryReservationMiB: 50,
        });

        break;
      }
    }

    return this.containers.map(x => x.renderContainerDefinition());
  }
}

/**
 * The port range to open up for dynamic port mapping
 */
const EPHEMERAL_PORT_RANGE = ec2.Port.tcpRange(32768, 65535);

/**
 * The networking mode to use for the containers in the task.
 */
export enum NetworkMode {
  /**
   * The task's containers do not have external connectivity and port mappings can't be specified in the container definition.
   */
  NONE = 'none',

  /**
   * The task utilizes Docker's built-in virtual network which runs inside each container instance.
   */
  BRIDGE = 'bridge',

  /**
   * The task is allocated an elastic network interface.
   */
  AWS_VPC = 'awsvpc',

  /**
   * The task bypasses Docker's built-in virtual network and maps container ports directly to the EC2 instance's network interface directly.
   *
   * In this mode, you can't run multiple instantiations of the same task on a
   * single container instance when port mappings are used.
   */
  HOST = 'host',

  /**
   * The task utilizes NAT network mode required by Windows containers.
   *
   * This is the only supported network mode for Windows containers. For more information, see
   * [Task Definition Parameters](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#network_mode).
   */
  NAT = 'nat'
}

/**
 * The IPC resource namespace to use for the containers in the task.
 */
export enum IpcMode {
  /**
   * If none is specified, then IPC resources within the containers of a task are private and not
   * shared with other containers in a task or on the container instance
   */
  NONE = 'none',

  /**
   * If host is specified, then all containers within the tasks that specified the host IPC mode on
   * the same container instance share the same IPC resources with the host Amazon EC2 instance.
   */
  HOST = 'host',

  /**
   * If task is specified, all containers within the specified task share the same IPC resources.
   */
  TASK = 'task',
}

/**
 * The process namespace to use for the containers in the task.
 */
export enum PidMode {
  /**
   * If host is specified, then all containers within the tasks that specified the host PID mode
   * on the same container instance share the same process namespace with the host Amazon EC2 instance.
   */
  HOST = 'host',

  /**
   * If task is specified, all containers within the specified task share the same process namespace.
   */
  TASK = 'task',
}

/**
 * Elastic Inference Accelerator.
 * For more information, see [Elastic Inference Basics](https://docs.aws.amazon.com/elastic-inference/latest/developerguide/basics.html)
 */
export interface InferenceAccelerator {
  /**
   * The Elastic Inference accelerator device name.
   * @default - empty
   */
  readonly deviceName?: string;

  /**
   * The Elastic Inference accelerator type to use. The allowed values are: eia2.medium, eia2.large and eia2.xlarge.
   * @default - empty
   */
  readonly deviceType?: string;
}

/**
 * A data volume used in a task definition.
 *
 * For tasks that use a Docker volume, specify a DockerVolumeConfiguration.
 * For tasks that use a bind mount host volume, specify a host and optional sourcePath.
 *
 * For more information, see [Using Data Volumes in Tasks](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using_data_volumes.html).
 */
export interface Volume {
  /**
   * This property is specified when you are using bind mount host volumes.
   *
   * Bind mount host volumes are supported when you are using either the EC2 or Fargate launch types.
   * The contents of the host parameter determine whether your bind mount host volume persists on the
   * host container instance and where it is stored. If the host parameter is empty, then the Docker
   * daemon assigns a host path for your data volume. However, the data is not guaranteed to persist
   * after the containers associated with it stop running.
   */
  readonly host?: Host;

  /**
   * The name of the volume.
   *
   * Up to 255 letters (uppercase and lowercase), numbers, and hyphens are allowed.
   * This name is referenced in the sourceVolume parameter of container definition mountPoints.
   */
  readonly name: string;

  /**
   * This property is specified when you are using Docker volumes.
   *
   * Docker volumes are only supported when you are using the EC2 launch type.
   * Windows containers only support the use of the local driver.
   * To use bind mounts, specify a host instead.
   */
  readonly dockerVolumeConfiguration?: DockerVolumeConfiguration;

  /**
   * This property is specified when you are using Amazon EFS.
   *
   * When specifying Amazon EFS volumes in tasks using the Fargate launch type,
   * Fargate creates a supervisor container that is responsible for managing the Amazon EFS volume.
   * The supervisor container uses a small amount of the task's memory.
   * The supervisor container is visible when querying the task metadata version 4 endpoint,
   * but is not visible in CloudWatch Container Insights.
   *
   * @default No Elastic FileSystem is setup
   */
  readonly efsVolumeConfiguration?: EfsVolumeConfiguration;
}

/**
 * The details on a container instance bind mount host volume.
 */
export interface Host {
  /**
   * Specifies the path on the host container instance that is presented to the container.
   * If the sourcePath value does not exist on the host container instance, the Docker daemon creates it.
   * If the location does exist, the contents of the source path folder are exported.
   *
   * This property is not supported for tasks that use the Fargate launch type.
   */
  readonly sourcePath?: string;
}

/**
 * Properties for an ECS target.
 *
 * @internal
 */
export interface LoadBalancerTarget {
  /**
   * The name of the container.
   */
  readonly containerName: string;

  /**
   * The port mapping of the target.
   */
  readonly portMapping: PortMapping
}

/**
 * Properties for defining an ECS target. The port mapping for it must already have been created through addPortMapping().
 */
export interface LoadBalancerTargetOptions {
  /**
   * The name of the container.
   */
  readonly containerName: string;

  /**
   * The port number of the container. Only applicable when using application/network load balancers.
   *
   * @default - Container port of the first added port mapping.
   */
  readonly containerPort?: number;

  /**
   * The protocol used for the port mapping. Only applicable when using application load balancers.
   *
   * @default Protocol.TCP
   */
  readonly protocol?: Protocol;
}

/**
 * The configuration for a Docker volume. Docker volumes are only supported when you are using the EC2 launch type.
 */
export interface DockerVolumeConfiguration {
  /**
   * Specifies whether the Docker volume should be created if it does not already exist.
   * If true is specified, the Docker volume will be created for you.
   *
   * @default false
   */
  readonly autoprovision?: boolean;
  /**
   * The Docker volume driver to use.
   */
  readonly driver: string;
  /**
   * A map of Docker driver-specific options passed through.
   *
   * @default No options
   */
  readonly driverOpts?: {[key: string]: string};
  /**
   * Custom metadata to add to your Docker volume.
   *
   * @default No labels
   */
  readonly labels?: { [key: string]: string; }
  /**
   * The scope for the Docker volume that determines its lifecycle.
   */
  readonly scope: Scope;
}

/**
 * The authorization configuration details for the Amazon EFS file system.
 */
export interface AuthorizationConfig {
  /**
   * The access point ID to use.
   * If an access point is specified, the root directory value will be
   * relative to the directory set for the access point.
   * If specified, transit encryption must be enabled in the EFSVolumeConfiguration.
   *
   * @default No id
   */
  readonly accessPointId?: string;
  /**
   * Whether or not to use the Amazon ECS task IAM role defined
   * in a task definition when mounting the Amazon EFS file system.
   * If enabled, transit encryption must be enabled in the EFSVolumeConfiguration.
   *
   * Valid values: ENABLED | DISABLED
   *
   * @default If this parameter is omitted, the default value of DISABLED is used.
   */
  readonly iam?: string;
}

/**
 * The configuration for an Elastic FileSystem volume.
 */
export interface EfsVolumeConfiguration {
  /**
   * The Amazon EFS file system ID to use.
   */
  readonly fileSystemId: string;
  /**
   * The directory within the Amazon EFS file system to mount as the root directory inside the host.
   * Specifying / will have the same effect as omitting this parameter.
   *
   * @default The root of the Amazon EFS volume
   */
  readonly rootDirectory?: string;
  /**
   * Whether or not to enable encryption for Amazon EFS data in transit between
   * the Amazon ECS host and the Amazon EFS server.
   * Transit encryption must be enabled if Amazon EFS IAM authorization is used.
   *
   * Valid values: ENABLED | DISABLED
   *
   * @default DISABLED
   */
  readonly transitEncryption?: string;
  /**
   * The port to use when sending encrypted data between
   * the Amazon ECS host and the Amazon EFS server. EFS mount helper uses.
   *
   * @default Port selection strategy that the Amazon EFS mount helper uses.
   */
  readonly transitEncryptionPort?: number;
  /**
   * The authorization configuration details for the Amazon EFS file system.
   *
   * @default No configuration.
   */
  readonly authorizationConfig?: AuthorizationConfig;
}

/**
 * The scope for the Docker volume that determines its lifecycle.
 * Docker volumes that are scoped to a task are automatically provisioned when the task starts and destroyed when the task stops.
 * Docker volumes that are scoped as shared persist after the task stops.
 */
export enum Scope {
  /**
   * Docker volumes that are scoped to a task are automatically provisioned when the task starts and destroyed when the task stops.
   */
  TASK = 'task',

  /**
   * Docker volumes that are scoped as shared persist after the task stops.
   */
  SHARED = 'shared'
}

/**
 * The task launch type compatibility requirement.
 */
export enum Compatibility {
  /**
   * The task should specify the EC2 launch type.
   */
  EC2,

  /**
   * The task should specify the Fargate launch type.
   */
  FARGATE,

  /**
   * The task can specify either the EC2 or Fargate launch types.
   */
  EC2_AND_FARGATE,

  /**
   * The task should specify the External launch type.
   */
  EXTERNAL
}

/**
 * An extension for Task Definitions
 *
 * Classes that want to make changes to a TaskDefinition (such as
 * adding helper containers) can implement this interface, and can
 * then be "added" to a TaskDefinition like so:
 *
 *    taskDefinition.addExtension(new MyExtension("some_parameter"));
 */
export interface ITaskDefinitionExtension {
  /**
   * Apply the extension to the given TaskDefinition
   *
   * @param taskDefinition [disable-awslint:ref-via-interface]
   */
  extend(taskDefinition: TaskDefinition): void;
}

/**
 * Return true if the given task definition can be run on an EC2 cluster
 */
export function isEc2Compatible(compatibility: Compatibility): boolean {
  return [Compatibility.EC2, Compatibility.EC2_AND_FARGATE].includes(compatibility);
}

/**
 * Return true if the given task definition can be run on a Fargate cluster
 */
export function isFargateCompatible(compatibility: Compatibility): boolean {
  return [Compatibility.FARGATE, Compatibility.EC2_AND_FARGATE].includes(compatibility);
}

/**
 * Return true if the given task definition can be run on a ECS Anywhere cluster
 */
export function isExternalCompatible(compatibility: Compatibility): boolean {
  return [Compatibility.EXTERNAL].includes(compatibility);
}
