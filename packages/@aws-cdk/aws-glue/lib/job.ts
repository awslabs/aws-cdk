import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import * as constructs from 'constructs';
import { CfnJob } from './glue.generated';

/**
 * TODO Consider adding the following
 * - metrics/events methods
 * - helper constans class with known glue special params for use in default arguments https://docs.aws.amazon.com/glue/latest/dg/aws-glue-programming-etl-glue-arguments.html
 */

/**
 * AWS Glue version determines the versions of Apache Spark and Python that are available to the job.
 *
 * @see https://docs.aws.amazon.com/glue/latest/dg/add-job.html.
 *
 * If you need to use a GlueVersion that doesn't exist as a static member, you
 * can instantiate a `GlueVersion` object, e.g: `new GlueVersion('1.5')`.
 */
export class GlueVersion {
  /**
   * A list of all known `GlueVersion`s.
   */
  public static readonly ALL = new Array<GlueVersion>();

  /**
   * Glue version using Spark 2.2.1 and Python 2.7
   */
  public static readonly ZERO_POINT_NINE = new GlueVersion('0.9');

  /**
   * Glue version using Spark 2.4.3, Python 2.7 and Python 3.6
   */
  public static readonly ONE_POINT_ZERO = new GlueVersion('1.0');

  /**
   * Glue version using Spark 2.4.3 and Python 3.7
   */
  public static readonly TWO_POINT_ZERO = new GlueVersion('2.0');

  /**
   * The name of this GlueVersion, as expected by Job resource.
   */
  public readonly name: string;

  constructor(name: string) {
    this.name = name;
    GlueVersion.ALL.push(this);
  }

  /**
   * The glue version name as expected by job resource.
   */
  public toString(): string {
    return this.name;
  }
}

/**
 * The type of predefined worker that is allocated when a job runs.
 *
 * If you need to use a WorkerType that doesn't exist as a static member, you
 * can instantiate a `WorkerType` object, e.g: `new WorkerType('other type')`.
 */
export class WorkerType {
  /** A list of all known `WorkerType`s. */
  public static readonly ALL = new Array<WorkerType>();

  /**
   * Each worker provides 4 vCPU, 16 GB of memory and a 50GB disk, and 2 executors per worker.
   */
  public static readonly STANDARD = new WorkerType('Standard');

  /**
   * Each worker maps to 1 DPU (4 vCPU, 16 GB of memory, 64 GB disk), and provides 1 executor per worker. Suitable for memory-intensive jobs.
   */
  public static readonly G_1X = new WorkerType('G.1X');

  /**
   * Each worker maps to 2 DPU (8 vCPU, 32 GB of memory, 128 GB disk), and provides 1 executor per worker. Suitable for memory-intensive jobs.
   */
  public static readonly G_2X = new WorkerType('G.2X');

  /**
   * The name of this WorkerType, as expected by Job resource.
   */
  public readonly name: string;

  constructor(name: string) {
    this.name = name;
    WorkerType.ALL.push(this);
  }

  /**
   * The worker type name as expected by Job resource.
   */
  public toString(): string {
    return this.name;
  }
}

/**
 * Python version
 */
export enum PythonVersion {
  /**
   * Python 2 (the exact version depends on GlueVersion and JobCommand used)
   */
  TWO = '2',

  /**
   * Python 3 (the exact version depends on GlueVersion and JobCommand used)
   */
  THREE = '3',
}

/**
 * The job command name used for job run.
 *
 * If you need to use a JobCommandName that doesn't exist as a static member, you
 * can instantiate a `WorkerType` object, e.g: `new JobCommandName('other name')`.
 */
export class JobCommandName {
  /** A list of all known `JobCommandName`s. */
  public static readonly ALL = new Array<JobCommandName>();

  /**
   * Command for running a Glue ETL job.
   */
  public static readonly GLUE_ETL = new JobCommandName('glueetl');

  /**
   * Command for running a Glue streaming job.
   */
  public static readonly GLUE_STREAMING = new JobCommandName('gluestreaming');

  /**
   * Command for running a Glue python shell job.
   */
  public static readonly PYTHON_SHELL = new JobCommandName('pythonshell');

  /**
   * The name of this JobCommandName, as expected by Job resource.
   */
  public readonly name: string;

  constructor(name: string) {
    this.name = name;
    JobCommandName.ALL.push(this);
  }

  /**
   * The worker type name as expected by Job resource.
   */
  public toString(): string {
    return this.name;
  }
}

/**
 * JobCommand specifies the execution environment and the code executed when a job is run.
 */
export class JobCommand {

  /**
   * Create a glueetl JobCommand with the given scriptLocation
   *
   * @param scriptLocation specifies the Amazon Simple Storage Service (Amazon S3) path to a script that executes a job.
   * @param pythonVersion specifies the Python shell version for the ETL job. Versions supported vary depending on GlueVersion.
   */
  public static glueEtl(scriptLocation: string, pythonVersion?: PythonVersion) {
    return new JobCommand(JobCommandName.GLUE_ETL, scriptLocation, pythonVersion);
  }

  /**
   * Create a gluestreaming JobCommand with the given scriptLocation
   *
   * @param scriptLocation specifies the Amazon Simple Storage Service (Amazon S3) path to a script that executes a job.
   * @param pythonVersion specifies the Python shell version for the streaming job. Versions supported vary depending on GlueVersion.
   */
  public static glueStreaming(scriptLocation: string, pythonVersion?: PythonVersion) {
    return new JobCommand(JobCommandName.GLUE_STREAMING, scriptLocation, pythonVersion);
  }

  /**
   * Create a pythonshell JobCommand with the given scriptLocation and pythonVersion
   *
   * @param scriptLocation specifies the Amazon Simple Storage Service (Amazon S3) path to a script that executes a job.
   * @param pythonVersion the Python version being used to execute a Python shell job.
   */
  public static pythonShell(scriptLocation: string, pythonVersion?: PythonVersion) {
    return new JobCommand(JobCommandName.PYTHON_SHELL, scriptLocation, pythonVersion);
  }

  /**
   * The name of the job command e.g. glueetl for an Apache Spark ETL job or pythonshell for a Python shell job.
   */
  readonly name: JobCommandName;

  /**
   * Specifies the Amazon Simple Storage Service (Amazon S3) path to a script that executes a job.
   */
  readonly scriptLocation: string;

  /**
   * The Python version being used to execute a Python shell job.
   */
  readonly pythonVersion?: PythonVersion;

  constructor(name: JobCommandName, scriptLocation: string, pythonVersion?: PythonVersion) {
    this.name = name;
    this.scriptLocation = scriptLocation;
    this.pythonVersion = pythonVersion;
  }
}

/**
 * Interface representing a created or an imported {@link Job}.
 */
export interface IJob extends cdk.IResource {
  /**
   * The name of the job.
   * @attribute
   */
  readonly jobName: string;

  /**
   * The ARN of the job.
   * @attribute
   */
  readonly jobArn: string;
}

/**
 * Attributes for importing {@link Job}.
 */
export interface JobAttributes {
  /**
   * The name of the job.
   */
  readonly jobName: string;
}

/**
 * Construction properties for {@link Job}.
 */
export interface JobProps {
  /**
   * The name of the job.
   *
   * @default cloudformation generated name.
   */
  readonly jobName?: string;

  /**
   * The description of the job.
   *
   * @default no value.
   */
  readonly description?: string;

  /**
   * The number of AWS Glue data processing units (DPUs) that can be allocated when this job runs.
   *
   * @default 10 when you specify an Apache Spark ETL or Sreaming job, 0.0625 DPU when you specify a Python shell job.
   */
  readonly maxCapacity?: number;

  /**
   * The maximum number of times to retry this job after a JobRun fails.
   *
   * @default ?
   */
  readonly maxRetries?: number;

  /**
   * The maximum number of concurrent runs allowed for the job.
   * An error is returned when this threshold is reached. The maximum value you can specify is controlled by a service limit.
   *
   * @default 1.
   */
  readonly maxConcurrentRuns?: number;

  /**
   * The number of minutes to wait after a job run starts, before sending a job run delay notification.
   *
   * @default ?
   */
  readonly notifyDelayAfter?: cdk.Duration;

  /**
   * The maximum time that a job run can consume resources before it is terminated and enters TIMEOUT status.
   *
   * @default 2,880 minutes (48 hours)
   */
  readonly timeout?: cdk.Duration;

  /**
   * Glue version determines the versions of Apache Spark and Python that AWS Glue supports. The Python version indicates the version supported for jobs of type Spark.
   *
   * @default 0.9
   */
  readonly glueVersion?: GlueVersion;

  /**
   * The type of predefined worker that is allocated when a job runs.
   *
   * @default ?
   */
  readonly workerType?: WorkerType;

  /**
   * The number of workers of a defined {@link WorkerType} that are allocated when a job runs.
   *
   * @default ?
   */
  readonly numberOfWorkers?: number;

  /**
   * The {@link Connection}s used for this job.
   *
   * TODO Enable after https://github.com/aws/aws-cdk/issues/12442 is merged.
   */
  // readonly connections?: IConnection [];

  /**
   * The {@link SecurityConfiguration} to use for this job.
   *
   * TODO Enable after https://github.com/aws/aws-cdk/issues/12449 is merged.
   */
  // readonly securityConfiguration?: ISecurityConfiguration;

  /**
   * The default arguments for this job, specified as name-value pairs.
   *
   * @see https://docs.aws.amazon.com/glue/latest/dg/aws-glue-programming-etl-glue-arguments.html for a list of Special Parameters Used by AWS Glue
   * @default no arguments
   */
  readonly defaultArguments?: { [key: string]: string };

  /**
   * The tags to use with this job.
   *
   * @default no tags
   */
  readonly tags?: { [key: string]: string };

  /**
   * The IAM role associated with this job.
   * @default a new IAM role with arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole managed policy
   */
  readonly role?: iam.IRole;

  /**
   * The job command specifying the type of the job e.g. glueetl or pythonshell and relevant parameters.
   */
  readonly jobCommand: JobCommand;
}

/**
 * A Glue Job.
 */
export class Job extends cdk.Resource implements IJob {
  /**
     * Creates a Glue Job
     *
     * @param scope The scope creating construct (usually `this`).
     * @param id The construct's id.
     * @param attrs Import attributes
     */
  public static fromJobAttributes(scope: constructs.Construct, id: string, attrs: JobAttributes): IJob {
    class Import extends cdk.Resource implements IJob {
      public readonly jobName = attrs.jobName;
      public readonly jobArn = Job.buildJobArn(scope, attrs.jobName);
    }

    return new Import(scope, id);
  }

  private static buildJobArn(scope: constructs.Construct, jobName: string) : string {
    return cdk.Stack.of(scope).formatArn({
      service: 'glue',
      resource: 'job',
      resourceName: jobName,
    });
  }

  /**
   * The ARN of the job.
   */
  public readonly jobArn: string;

  /**
   * The name of the job.
   */
  public readonly jobName: string;

  /**
   * The IAM role associated with this job.
   */
  public readonly role: iam.IRole;

  constructor(scope: constructs.Construct, id: string, props: JobProps) {
    super(scope, id, {
      physicalName: props.jobName,
    });

    // Create a basic service role if one is not provided https://docs.aws.amazon.com/glue/latest/dg/create-service-policy.html
    this.role = props.role || new iam.Role(this, 'ServiceRole', {
      assumedBy: new iam.ServicePrincipal('glue'),
      // arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole')],
    });

    const jobResource = new CfnJob(this, 'Resource', {
      name: props.jobName,
      description: props.description,
      role: this.role.roleArn,
      command: {
        name: props.jobCommand.name.name,
        scriptLocation: props.jobCommand.scriptLocation,
        pythonVersion: props.jobCommand.pythonVersion,
      },
      glueVersion: props.glueVersion ? props.glueVersion.name : undefined,
      workerType: props.workerType ? props.workerType.name : undefined,
      numberOfWorkers: props.numberOfWorkers,
      maxCapacity: props.maxCapacity,
      maxRetries: props.maxRetries,
      executionProperty: props.maxConcurrentRuns ? { maxConcurrentRuns: props.maxConcurrentRuns } : undefined,
      notificationProperty: props.notifyDelayAfter ? { notifyDelayAfter: props.notifyDelayAfter.toMinutes() } : undefined,
      timeout: props.timeout ? props.timeout.toMinutes() : undefined,
      // connections: props.connections ? { connections: props.connections.map((connection) => connection.connectionName) } : undefined,
      // securityConfiguration: props.securityConfiguration ? props.securityConfiguration.securityConfigurationName : undefined,
      defaultArguments: props.defaultArguments,
      tags: props.tags,
    });

    const resourceName = this.getResourceNameAttribute(jobResource.ref);
    this.jobArn = Job.buildJobArn(this, resourceName);
    this.jobName = resourceName;
  }
}
