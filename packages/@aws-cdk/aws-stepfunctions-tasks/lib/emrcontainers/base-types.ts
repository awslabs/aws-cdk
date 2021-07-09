/**
 * The information about job driver for Spark submit.
 */
export interface SparkSubmitJobDriver {

  /**
   * The entry point of job application.
   * Length Constraints: Minimum length of 1. Maximum length of 256.
   *
   * @default - No entry point
   */
  readonly entryPoint: string;

  /**
   * The arguments for job application.
   * Length Constraints: Minimum length of 1. Maximum length of 10280.
   *
   * @default - No arguments defined
   */
  readonly entryPointArguments?: string[];

  /**
   * The Spark submit parameters that are used for job runs.
   * Length Constraints: Minimum length of 1. Maximum length of 102400.
   *
   * @default - No spark submit parameters
   */
  readonly sparkSubmitParameters?: string;
}

/**
 * Specify the driver that the job runs on.
 */
export interface JobDriver {

  /**
   * The job driver parameters specified for spark submit.
   *
   * @see https://docs.aws.amazon.com/emr-on-eks/latest/APIReference/API_SparkSubmitJobDriver.html
   *
   * @default - No job driver parameters specified.
   */
  readonly sparkSubmitJobDriver?: SparkSubmitJobDriver;
}

/**
 * A configuration specification to be used when provisioning virtual clusters,
 * which can include configurations for applications and software bundled with Amazon EMR on EKS.
 * A configuration consists of a classification, properties, and optional nested configurations.
 * A classification refers to an application-specific configuration file.
 * Properties are the settings you want to change in that file.
 */
export interface Configuration {

  /**
   * The classification within a configuration.
   * Length Constraints: Minimum length of 1. Maximum length of 1024.
   */
  readonly classification: string;

  /**
   * A list of additional configurations to apply within a configuration object.
   * Array Members: Maximum number of 100 items.
   *
   * @default - No other configurations
   */
  readonly configurations?: Configuration[];

  /**
   * A set of properties specified within a configuration classification.
   * Map Entries: Maximum number of 100 items.
   *
   * @default - No properties
   */
  readonly properties?: { [key: string]: string };
}

/**
 * A configuration for CloudWatch monitoring.
 * You can configure your jobs to send log information to CloudWatch Logs.
 */
export interface CloudWatchMonitoringConfiguration {

  /**
   * The name of the log group for log publishing.
   * Length Constraints: Minimum length of 1. Maximum length of 512.
   *
   * @default - No default log group name
   */
  readonly logGroupName: string;

  /**
   * The specified name prefix for log streams.
   * Length Constraints: Minimum length of 1. Maximum length of 256.
   *
   * @default - No default log stream prefix name
   */
  readonly logStreamNamePrefix?: string;
}

/**
 *  Amazon S3 configuration for monitoring log publishing.
 *  You can configure your jobs to send log information to Amazon S3.
 */
export interface S3MonitoringConfiguration {

  /**
   * Amazon S3 destination URI for log publishing.
   * Length Constraints: Minimum length of 1. Maximum length of 10280.
   *
   * @default - No default S3 Destination URI
   */
  readonly logUri: string;
}

/**
 * Configuration setting for monitoring.
 */
export interface MonitoringConfiguration {

  /**
   * A configuration for CloudWatch monitoring.
   * You can configure your jobs to send log information to CloudWatch Logs.
   *
   * @default - No CloudWatch monitoring configuration
   */
  readonly cloudWatchMonitoringConfig?: CloudWatchMonitoringConfiguration;

  /**
   * Monitoring configurations for the persistent application UI.
   * Valid values - ENABLED | DISABLED
   *
   * @default - No persistent application UI configuration
   */
  readonly persistentAppUI?: string;

  /**
   *  Amazon S3 configuration for monitoring log publishing.
   *  You can configure your jobs to send log information to Amazon S3.
   *
   * @default - No S3 monitoring configuration
   */
  readonly s3MonitoringConfig?: S3MonitoringConfiguration;
}

/**
 * A configuration specification to be used to override existing configurations.
 */
export interface ConfigurationOverrides {

  /**
   * The configurations for the application running by the job run.
   * Maximum of 100 items
   *
   * @see https://docs.aws.amazon.com/emr-on-eks/latest/APIReference/API_Configuration.html
   *
   * @default - No application config
   */
  readonly applicationConfig?: Configuration[];

  /**
   * The configurations for monitoring.
   *
   * @see https://docs.aws.amazon.com/emr-on-eks/latest/APIReference/API_MonitoringConfiguration.html
   *
   * @default - No monitoring configurations
   */
  readonly monitoringConfig?: MonitoringConfiguration;
}
