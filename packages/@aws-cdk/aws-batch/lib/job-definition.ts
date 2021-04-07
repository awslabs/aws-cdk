import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as iam from '@aws-cdk/aws-iam';
import { Duration, IResource, Resource, Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnJobDefinition } from './batch.generated';
import { ExposedSecret } from './exposed-secret';
import { JobDefinitionImageConfig } from './job-definition-image-config';

/**
 * The log driver to use for the container.
 */
export enum LogDriver {
  /**
   * Specifies the Amazon CloudWatch Logs logging driver.
   */
  AWSLOGS = 'awslogs',

  /**
   * Specifies the Fluentd logging driver.
   */
  FLUENTD = 'fluentd',

  /**
   * Specifies the Graylog Extended Format (GELF) logging driver.
   */
  GELF = 'gelf',

  /**
   * Specifies the journald logging driver.
   */
  JOURNALD = 'journald',

  /**
   * Specifies the logentries logging driver.
   */
  LOGENTRIES = 'logentries',

  /**
   * Specifies the JSON file logging driver.
   */
  JSON_FILE = 'json-file',

  /**
   * Specifies the Splunk logging driver.
   */
  SPLUNK = 'splunk',

  /**
   * Specifies the syslog logging driver.
   */
  SYSLOG = 'syslog'
}

/**
 * Platform capabilities
 */
export enum PlatformCapabilities {
  /**
   * Specifies EC2 environment.
   */
  EC2 = 'EC2',

  /**
   * Specifies Fargate environment.
   */
  FARGATE = 'FARGATE'
}

/**
 * Log configuration options to send to a custom log driver for the container.
 */
export interface LogConfiguration {
  /**
   * The log driver to use for the container.
   */
  readonly logDriver: LogDriver;

  /**
   * The configuration options to send to the log driver.
   *
   * @default - No configuration options are sent
   */
  readonly options?: any;

  /**
   * The secrets to pass to the log configuration as options.
   * For more information, see https://docs.aws.amazon.com/batch/latest/userguide/specifying-sensitive-data-secrets.html#secrets-logconfig
   *
   * @default - No secrets are passed
   */
  readonly secretOptions?: ExposedSecret[];
}


/**
 * Fargate platform configuration
 */
export interface FargatePlatformConfiguration {
  /**
   * Fargate platform version
   */
  readonly platformVersion: ecs.FargatePlatformVersion
}

/**
 * Properties of a job definition container.
 */
export interface JobDefinitionContainer {
  /**
   * The command that is passed to the container.
   *
   * If you provide a shell command as a single string, you have to quote command-line arguments.
   *
   * @default - CMD value built into container image.
   */
  readonly command?: string[];

  /**
   * The environment variables to pass to the container.
   *
   * @default none
   */
  readonly environment?: { [key: string]: string };

  /**
   * The image used to start a container.
   */
  readonly image: ecs.ContainerImage;

  /**
   * The instance type to use for a multi-node parallel job. Currently all node groups in a
   * multi-node parallel job must use the same instance type. This parameter is not valid
   * for single-node container jobs.
   *
   * @default - None
   */
  readonly instanceType?: ec2.InstanceType;

  /**
   * The IAM role that the container can assume for AWS permissions.
   *
   * @default - An IAM role will created.
   */
  readonly jobRole?: iam.IRole;

  /**
   * Linux-specific modifications that are applied to the container, such as details for device mappings.
   * For now, only the `devices` property is supported.
   *
   * @default - None will be used.
   */
  readonly linuxParams?: ecs.LinuxParameters;

  /**
   * The log configuration specification for the container.
   *
   * @default - containers use the same logging driver that the Docker daemon uses
   */
  readonly logConfiguration?: LogConfiguration;

  /**
   * The hard limit (in MiB) of memory to present to the container. If your container attempts to exceed
   * the memory specified here, the container is killed. You must specify at least 4 MiB of memory for a job.
   *
   * @default 4
   */
  readonly memoryLimitMiB?: number;

  /**
   * The mount points for data volumes in your container.
   *
   * @default - No mount points will be used.
   */
  readonly mountPoints?: ecs.MountPoint[];

  /**
   * When this parameter is true, the container is given elevated privileges on the host container instance (similar to the root user).
   * @default false
   */
  readonly privileged?: boolean;

  /**
   * When this parameter is true, the container is given read-only access to its root file system.
   *
   * @default false
   */
  readonly readOnly?: boolean;

  /**
   * The number of physical GPUs to reserve for the container. The number of GPUs reserved for all
   * containers in a job should not exceed the number of available GPUs on the compute resource that the job is launched on.
   *
   * @default - No GPU reservation.
   */
  readonly gpuCount?: number;

  /**
   * A list of ulimits to set in the container.
   *
   * @default - No limits.
   */
  readonly ulimits?: ecs.Ulimit[];

  /**
   * The user name to use inside the container.
   *
   * @default - None will be used.
   */
  readonly user?: string;

  /**
   * The number of vCPUs reserved for the container. Each vCPU is equivalent to
   * 1,024 CPU shares. You must specify at least one vCPU.
   *
   * @default 1
   */
  readonly vcpus?: number;

  /**
   * A list of data volumes used in a job.
   *
   * @default - No data volumes will be used.
   */
  readonly volumes?: ecs.Volume[];

  /**
   * The platform configuration for jobs that are running on Fargate resources.
   *
   * @default - LATEST platform version will be used
   */
  readonly fargatePlatformConfiguration?: FargatePlatformConfiguration;

  /**
   * The IAM role that AWS Batch can assume.
   *
   * @default - None
   */
  readonly executionRole?: iam.IRole;
}

/**
 * Construction properties of the {@link JobDefinition} construct.
 */
export interface JobDefinitionProps {
  /**
   * The name of the job definition.
   *
   * Up to 128 letters (uppercase and lowercase), numbers, hyphens, and underscores are allowed.
   *
   * @default Cloudformation-generated name
   */
  readonly jobDefinitionName?: string;

  /**
   * An object with various properties specific to container-based jobs.
   */
  readonly container: JobDefinitionContainer;

  /**
   * An object with various properties specific to multi-node parallel jobs.
   *
   * @default - undefined
   */
  readonly nodeProps?: IMultiNodeProps;

  /**
   * When you submit a job, you can specify parameters that should replace the
   * placeholders or override the default job definition parameters. Parameters
   * in job submission requests take precedence over the defaults in a job definition.
   * This allows you to use the same job definition for multiple jobs that use the same
   * format, and programmatically change values in the command at submission time.
   *
   * @link https://docs.aws.amazon.com/batch/latest/userguide/job_definition_parameters.html
   * @default - undefined
   */
  readonly parameters?: { [key: string]: string };

  /**
   * The number of times to move a job to the RUNNABLE status. You may specify between 1 and
   * 10 attempts. If the value of attempts is greater than one, the job is retried on failure
   * the same number of attempts as the value.
   *
   * @default 1
   */
  readonly retryAttempts?: number;

  /**
   * The timeout configuration for jobs that are submitted with this job definition. You can specify
   * a timeout duration after which AWS Batch terminates your jobs if they have not finished.
   *
   * @default - undefined
   */
  readonly timeout?: Duration;

  /**
   * The platform capabilities required by the job definition.
   *
   * @default - undefined
   */
  readonly platformCapabilities?: PlatformCapabilities[];
}

/**
 * Properties for specifying multi-node properties for compute resources.
 */
export interface IMultiNodeProps {
  /**
   * Specifies the node index for the main node of a multi-node parallel job. This node index value must be fewer than the number of nodes.
   */
  mainNode: number;

  /**
   * A list of node ranges and their properties associated with a multi-node parallel job.
   */
  rangeProps: INodeRangeProps[];

  /**
   * The number of nodes associated with a multi-node parallel job.
   */
  count: number;
}

/**
 * Properties for a multi-node batch job.
 */
export interface INodeRangeProps {
  /**
   * The container details for the node range.
   */
  container: JobDefinitionContainer;

  /**
   * The minimum node index value to apply this container definition against.
   *
   * You may nest node ranges, for example 0:10 and 4:5, in which case the 4:5 range properties override the 0:10 properties.
   *
   * @default 0
   */
  fromNodeIndex?: number;

  /**
   * The maximum node index value to apply this container definition against. If omitted, the highest value is used relative.
   *
   * to the number of nodes associated with the job. You may nest node ranges, for example 0:10 and 4:5,
   * in which case the 4:5 range properties override the 0:10 properties.
   *
   * @default {@link IMultiNodeprops.count}
   */
  toNodeIndex?: number;
}

/**
 * An interface representing a job definition - either a new one, created with the CDK, *using the
 * {@link JobDefinition} class, or existing ones, referenced using the {@link JobDefinition.fromJobDefinitionArn} method.
 */
export interface IJobDefinition extends IResource {
  /**
   * The ARN of this batch job definition.
   *
   * @attribute
   */
  readonly jobDefinitionArn: string;

  /**
   * The name of the batch job definition.
   *
   * @attribute
   */
  readonly jobDefinitionName: string;
}

/**
 * Batch Job Definition.
 *
 * Defines a batch job definition to execute a specific batch job.
 */
export class JobDefinition extends Resource implements IJobDefinition {
  /**
   * Imports an existing batch job definition by its amazon resource name.
   *
   * @param scope
   * @param id
   * @param jobDefinitionArn
   */
  public static fromJobDefinitionArn(scope: Construct, id: string, jobDefinitionArn: string): IJobDefinition {
    const stack = Stack.of(scope);
    const jobDefName = stack.parseArn(jobDefinitionArn).resourceName!;

    class Import extends Resource implements IJobDefinition {
      public readonly jobDefinitionArn = jobDefinitionArn;
      public readonly jobDefinitionName = jobDefName;
    }

    return new Import(scope, id);
  }

  /**
   * Imports an existing batch job definition by its name.
   * If name is specified without a revision then the latest active revision is used.
   *
   * @param scope
   * @param id
   * @param jobDefinitionName
   */
  public static fromJobDefinitionName(scope: Construct, id: string, jobDefinitionName: string): IJobDefinition {
    const stack = Stack.of(scope);
    const jobDefArn = stack.formatArn({
      service: 'batch',
      resource: 'job-definition',
      sep: '/',
      resourceName: jobDefinitionName,
    });

    class Import extends Resource implements IJobDefinition {
      public readonly jobDefinitionArn = jobDefArn;
      public readonly jobDefinitionName = jobDefinitionName;
    }

    return new Import(scope, id);
  }

  public readonly jobDefinitionArn: string;
  public readonly jobDefinitionName: string;
  private readonly imageConfig: JobDefinitionImageConfig;

  constructor(scope: Construct, id: string, props: JobDefinitionProps) {
    super(scope, id, {
      physicalName: props.jobDefinitionName,
    });

    this.validateProps(props);

    this.imageConfig = new JobDefinitionImageConfig(this, props.container);

    const jobDef = new CfnJobDefinition(this, 'Resource', {
      jobDefinitionName: props.jobDefinitionName,
      containerProperties: this.buildJobContainer(props.container),
      type: 'container',
      nodeProperties: props.nodeProps
        ? {
          mainNode: props.nodeProps.mainNode,
          nodeRangeProperties: this.buildNodeRangeProps(props.nodeProps),
          numNodes: props.nodeProps.count,
        }
        : undefined,
      parameters: props.parameters,
      retryStrategy: {
        attempts: props.retryAttempts || 1,
      },
      timeout: {
        attemptDurationSeconds: props.timeout ? props.timeout.toSeconds() : undefined,
      },
      platformCapabilities: props.platformCapabilities || undefined,
    });

    this.jobDefinitionArn = this.getResourceArnAttribute(jobDef.ref, {
      service: 'batch',
      resource: 'job-definition',
      resourceName: this.physicalName,
    });
    this.jobDefinitionName = this.getResourceNameAttribute(jobDef.ref);
  }

  private deserializeEnvVariables(env?: { [name: string]: string}): CfnJobDefinition.EnvironmentProperty[] | undefined {
    const vars = new Array<CfnJobDefinition.EnvironmentProperty>();

    if (env === undefined) {
      return undefined;
    }

    Object.keys(env).map((name: string) => {
      vars.push({ name, value: env[name] });
    });

    return vars;
  }

  /**
   * Validates the properties provided for a new job definition.
   */
  private validateProps(props: JobDefinitionProps) {
    if (props === undefined) {
      return;
    }

    if (props.platformCapabilities !== undefined && props.platformCapabilities.includes(PlatformCapabilities.FARGATE)
        && props.container.executionRole === undefined) {
      throw new Error('Fargate job must have executionRole set');
    }
  }

  private buildJobContainer(container?: JobDefinitionContainer): CfnJobDefinition.ContainerPropertiesProperty | undefined {
    if (container === undefined) {
      return undefined;
    }

    return {
      command: container.command,
      environment: this.deserializeEnvVariables(container.environment),
      image: this.imageConfig.imageName,
      instanceType: container.instanceType && container.instanceType.toString(),
      jobRoleArn: container.jobRole && container.jobRole.roleArn,
      executionRoleArn: container.executionRole && container.executionRole.roleArn,
      linuxParameters: container.linuxParams
        ? { devices: container.linuxParams.renderLinuxParameters().devices }
        : undefined,
      logConfiguration: container.logConfiguration ? {
        logDriver: container.logConfiguration.logDriver,
        options: container.logConfiguration.options,
        secretOptions: container.logConfiguration.secretOptions
          ? this.buildLogConfigurationSecretOptions(container.logConfiguration.secretOptions)
          : undefined,
      } : undefined,
      memory: container.memoryLimitMiB || 4,
      mountPoints: container.mountPoints,
      privileged: container.privileged || false,
      resourceRequirements: container.gpuCount
        ? [{ type: 'GPU', value: String(container.gpuCount) }]
        : undefined,
      readonlyRootFilesystem: container.readOnly || false,
      ulimits: container.ulimits,
      user: container.user,
      vcpus: container.vcpus || 1,
      volumes: container.volumes,
      fargatePlatformConfiguration: container.fargatePlatformConfiguration ? {
        platformVersion: container.fargatePlatformConfiguration.platformVersion,
      } : undefined,
    };
  }

  private buildNodeRangeProps(multiNodeProps: IMultiNodeProps): CfnJobDefinition.NodeRangePropertyProperty[] {
    const rangeProps = new Array<CfnJobDefinition.NodeRangePropertyProperty>();

    for (const prop of multiNodeProps.rangeProps) {
      rangeProps.push({
        container: this.buildJobContainer(prop.container),
        targetNodes: `${prop.fromNodeIndex || 0}:${prop.toNodeIndex || multiNodeProps.count}`,
      });
    }

    return rangeProps;
  }

  private buildLogConfigurationSecretOptions(secretOptions: ExposedSecret[]): CfnJobDefinition.SecretProperty[] {
    return secretOptions.map(secretOption => {
      return {
        name: secretOption.optionName,
        valueFrom: secretOption.secretArn,
      };
    });
  }
}
