import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import * as constructs from 'constructs';
import { IConnection } from './connection';
import { CfnJob } from './glue.generated';
import { ISecurityConfiguration } from './security-configuration';

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
 * Job states emitted by Glue to CloudWatch Events.
 *
 * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/EventTypes.html#glue-event-types for more information.
 */
export enum JobEventState {
  /**
   * State indicating job run succeeded
   */
  SUCCEEDED = 'SUCCEEDED',

  /**
   * State indicating job run failed
   */
  FAILED = 'FAILED',

  /**
   * State indicating job run timed out
   */
  TIMEOUT = 'TIMEOUT',

  /**
   * State indicating job is starting
   */
  STARTING = 'STARTING',

  /**
   * State indicating job is running
   */
  RUNNING = 'RUNNING',

  /**
   * State indicating job is stopping
   */
  STOPPING = 'STOPPING',

  /**
   * State indicating job stopped
   */
  STOPPED = 'STOPPED',
}

/**
 * The Glue CloudWatch metric type.
 *
 * @see https://docs.aws.amazon.com/glue/latest/dg/monitoring-awsglue-with-cloudwatch-metrics.html
 */
export enum MetricType {
  /**
   * A value at a point in time.
   */
  GAUGE = 'gauge',

  /**
   * An aggregate number.
   */
  COUNT = 'count',
}

/**
 * The job command name used for job run.
 *
 * If you need to use a JobCommandName that doesn't exist as a static member, you
 * can instantiate a `WorkerType` object, e.g: `new JobCommandName('other name')`.
 */
export class JobCommandName {
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
 * Constants for some of the special parameters used by {@link Job}.
 *
 * These constants can be used as argument names in {@link JobProps.defaultArguments}.
 *
 * @see https://docs.aws.amazon.com/glue/latest/dg/aws-glue-programming-etl-glue-arguments.html
 * @see https://docs.aws.amazon.com/glue/latest/dg/monitor-spark-ui-jobs.html
 */
export enum JobSpecialArgumentNames {
  /**
   * The script programming language. This value must be either `scala` or `python`. If this parameter is not present, the default is `python`.
   */
  JOB_LANGUAGE = '--job-language',

  /**
   * The Scala class that serves as the entry point for your Scala script. This applies only if your `--job-language` is set to `scala`.
   */
  CLASS = '--class',

  /**
   * The Amazon Simple Storage Service (Amazon S3) location where your ETL script is located (in the form `s3://path/to/my/script.py`).
   * This parameter overrides a script location set in the JobCommand object.
   */
  SCRIPT_LOCATION = '--scriptLocation',

  /**
   * The Amazon S3 paths to additional Python modules that AWS Glue adds to the Python path before executing your script.
   * Multiple values must be complete paths separated by a comma (`,`).
   */
  EXTRA_PY_FILES = '--extra-py-files',

  /**
   * The Amazon S3 paths to additional Java `.jar` files that AWS Glue adds to the Java classpath before executing your script.
   * Multiple values must be complete paths separated by a comma (`,`).
   */
  EXTRA_JARS = '--extra-jars',

  /**
   * Setting this value to true prioritizes the customer's extra JAR files in the classpath.
   * This option is only available in AWS Glue version 2.0.
   */
  USER_JARS_FIRST = '--user-jars-first',

  /**
   * The Amazon S3 paths to additional files, such as configuration files that AWS Glue copies to the working directory of your script before executing it.
   * Multiple values must be complete paths separated by a comma (`,`).
   */
  EXTRA_FILES = '--extra-files',

  /**
   * Controls the behavior of a job bookmark. The following option values can be set.
   */
  JOB_BOOKMARK_OPTION = '--job-bookmark-option',

  /**
   * Specifies an Amazon S3 path to a bucket that can be used as a temporary directory for the job.
   */
  TEMP_DIR = '--TempDir',

  /**
   * Enables the EMRFS S3-optimized committer for writing Parquet data into Amazon S3.
   * Setting the value to `true` enables the committer. By default the flag is turned off.
   */
  ENABLE_S3_PARQUET_OPTIMIZED_COMMITTER = '--enable-s3-parquet-optimized-committer',

  /**
   * Sets the EMRFS rename algorithm version to version 2.
   * This option is only available on AWS Glue version 1.0.
   */
  ENABLE_RENAME_ALGORITHM_V2 = '--enable-rename-algorithm-v2',

  /**
   * Enables using the AWS Glue Data Catalog as an Apache Spark Hive metastore.
   */
  ENABLE_GLUE_DATA_CATALOG = '--enable-glue-datacatalog',

  /**
   * Enables the collection of metrics for job profiling for this job run.
   * To enable metrics, only specify the key; no value is needed.
   */
  ENABLE_METRICS = '--enable-metrics',

  /**
   * Enables real-time continuous logging for AWS Glue jobs to view real-time Apache Spark job logs in CloudWatch.
   */
  ENABLE_CONTINUOUS_LOGGING = '--enable-continuous-cloudwatch-log',

  /**
   * Specifies a standard filter (true) or no filter (false) for continuous logging.
   * Choosing the standard filter prunes out non-useful Apache Spark driver/executor and Apache Hadoop YARN heartbeat log messages.
   * Choosing no filter gives all the log messages.
   */
  ENABLE_CONTINUOUS_LOG_FILTER = '--enable-continuous-log-filter',

  /**
   * Specifies a custom Amazon CloudWatch log group name for a job enabled for continuous logging.
   */
  LOG_GROUP = '--continuous-log-logGroup',

  /**
   * Specifies a custom CloudWatch log stream prefix for a job enabled for continuous logging.
   */
  LOG_STREAM_PREFIX = '--continuous-log-logStreamPrefix',

  /**
   * Specifies a custom conversion log pattern for a job enabled for continuous logging.
   */
  LOG_CONVERSION_PATTERN = '--continuous-log-conversionPattern',

  /**
   * Enables Apache Spark web UI.
   * @see https://docs.aws.amazon.com/glue/latest/dg/monitor-spark-ui-jobs.html
   */
  ENABLE_SPARK_UI = '--enable-spark-ui',

  /**
   * Specifies the Amazon S3 path for storing the Spark event logs for the job.
   * @see https://docs.aws.amazon.com/glue/latest/dg/monitor-spark-ui-jobs.html
   */
  SPARK_UI_LOGS_PATH = '--spark-event-logs-path',
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
   * @default no connection.
   */
  readonly connections?: IConnection [];

  /**
   * The {@link SecurityConfiguration} to use for this job.
   *
   * @default no security configuration.
   */
  readonly securityConfiguration?: ISecurityConfiguration;

  /**
   * The default arguments for this job, specified as name-value pairs.
   *
   * {@link JobSpecialArgumentNames} defines some of the Special Parameters used by AWS Glue.
   * @see https://docs.aws.amazon.com/glue/latest/dg/aws-glue-programming-etl-glue-arguments.html A list of Special Parameters Used by AWS Glue
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

  /**
   * Create a CloudWatch Metric with namespace = 'AWS/Events', metricName = 'TriggeredRules' and RuleName = rule.ruleName dimension.
   * This is used by ruleXXXMetric methods.
   *
   * @param rule for use in setting RuleName dimension value
   * @param props metric properties
   */
  public static ruleMetric(rule: events.IRule, props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return new cloudwatch.Metric({
      namespace: 'AWS/Events',
      metricName: 'TriggeredRules',
      dimensions: { RuleName: rule.ruleName },
      statistic: cloudwatch.Statistic.SUM,
      ...props,
    }).attachTo(rule);
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

  /**
   * Used to cache results of ._rule calls.
   * @private
   */
  private _rules: Record<string, events.Rule> = {};

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
      connections: props.connections ? { connections: props.connections.map((connection) => connection.connectionName) } : undefined,
      securityConfiguration: props.securityConfiguration ? props.securityConfiguration.securityConfigurationName : undefined,
      defaultArguments: props.defaultArguments,
      tags: props.tags,
    });

    const resourceName = this.getResourceNameAttribute(jobResource.ref);
    this.jobArn = Job.buildJobArn(this, resourceName);
    this.jobName = resourceName;
  }


  /**
   * Create a CloudWatch Event Rule matching transition into the given `JobEventState`s
   *
   * @param state used in matching the CloudWatch Event
   *
   * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/EventTypes.html#glue-event-types
   */
  public rule(state: JobEventState, props?: events.RuleProps): events.Rule {
    const ruleId = `${state}Rule`;
    return new events.Rule(this, ruleId, {
      description: `Event triggered when Glue job ${this.jobName} is in ${state} state`,
      eventPattern: {
        source: ['aws.glue'],
        detailType: ['Glue Job State Change', 'Glue Job Run Status'],
        detail: {
          state: [state],
          jobName: [this.jobName],
        },
      },
      ...props,
    });
  }

  /**
   * Return a CloudWatch Event Rule matching JobEventState.SUCCEEDED.
   * The rule is cached for later usage.
   *
   * @param props rule props for first invocation. If props are passed again they are ignored.
   */
  public successRule(props?: events.RuleProps): events.Rule {
    return this._rule(JobEventState.SUCCEEDED, props);
  }

  /**
   * Return a CloudWatch Event Rule matching JobEventState.FAILED.
   * The rule is cached for later usage.
   *
   * @param props rule props for first invocation. If props are passed again they are ignored.
   */
  public failureRule(props?: events.RuleProps): events.Rule {
    return this._rule(JobEventState.FAILED, props);
  }

  /**
   * Return a CloudWatch Event Rule matching JobEventState.TIMEOUT.
   * The rule is cached for later usage.
   *
   * @param props rule props for first invocation. If props are passed again they are ignored.
   */
  public timeoutRule(props?: events.RuleProps): events.Rule {
    return this._rule(JobEventState.TIMEOUT, props);
  }

  /**
   * Return a CloudWatch Metric indicating job success that's based on successRule()
   */
  public successRuleMetric(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return Job.ruleMetric(this.successRule(), props);
  }

  /**
   * Return a CloudWatch Metric indicating job success that's based on failureRule()
   */
  public failureRuleMetric(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return Job.ruleMetric(this.failureRule(), props);
  }

  /**
   * Return a CloudWatch Metric indicating job success that's based on timeoutRule()
   */
  public timeoutRuleMetric(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return Job.ruleMetric(this.timeoutRule(), props);
  }

  /**
   * Create a CloudWatch metric.
   *
   * @param metricName name of the metric typically prefixed with `glue.driver.`, `glue.<executorId>.` or `glue.ALL.`.
   * @param jobRunId a dimension that filters for metrics of a specific JobRun ID, or `ALL`.
   * @param type the metric type.
   *
   * @see https://docs.aws.amazon.com/glue/latest/dg/monitoring-awsglue-with-cloudwatch-metrics.html
   */
  public metric(metricName: string, jobRunId: string, type: MetricType, props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return new cloudwatch.Metric({
      metricName,
      namespace: 'Glue',
      dimensions: {
        JobName: this.jobName,
        JobRunId: jobRunId,
        Type: type,
      },
      ...props,
    }).attachTo(this);
  }

  /**
   * Create a Rule with the given props and caches the resulting rule. Subsequent returns cached value and ignores props
   *
   * @param state used in matching the CloudWatch Event
   * @param props rule properties
   * @private
   */
  private _rule(state: JobEventState, props?: events.RuleProps) {
    if (!this._rules[state]) {
      this._rules[state] = this.rule(state, props);
    }
    return this._rules[state];
  }
}
