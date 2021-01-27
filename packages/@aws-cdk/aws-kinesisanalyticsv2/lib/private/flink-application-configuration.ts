import * as core from '@aws-cdk/core';

/**
 * Available log levels for Flink applications.
 */
export enum FlinkLogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Granularity of metrics sent to CloudWatch.
 */
export enum FlinkMetricsLevel {
  APPLICATION = 'APPLICATION',
  TASK = 'TASK',
  OPERATOR = 'OPERATOR',
  PARALLELISM = 'PARALLELISM',
}

interface FlinkApplicationConfiguration extends
  CheckpointConfiguration,
  MonitoringConfiguration,
  ParallelismConfiguration {}

interface CheckpointConfiguration {
  checkpointingEnabled?: boolean;
  minPauseBetweenCheckpoints?: core.Duration;
}

interface MonitoringConfiguration {
  logLevel?: FlinkLogLevel;
  metricsLevel?: FlinkMetricsLevel;
}

interface ParallelismConfiguration {
  autoScalingEnabled?: boolean;
  parallelism?: number;
  parallelismPerKpu?: number;
}

/**
 * Build the nested Cfn FlinkApplicationConfiguration object. This function
 * doesn't return empty config objects, returning the minimal config needed to
 * express the supplied properties.
 *
 * This function also handles the quirky configType: 'CUSTOM' setting required
 * whenever config in one of the nested groupings.
 */
export function flinkApplicationConfiguration(config: FlinkApplicationConfiguration) {
  const checkpointConfiguration = configFor({
    checkpointingEnabled: config.checkpointingEnabled,
    minPauseBetweenCheckpoints: config.minPauseBetweenCheckpoints?.toMilliseconds(),
  });

  const monitoringConfiguration = configFor({
    logLevel: config.logLevel,
    metricsLevel: config.metricsLevel,
  });

  const parallelismConfiguration = configFor({
    autoScalingEnabled: config.autoScalingEnabled,
    parallelism: config.parallelism,
    parallelismPerKpu: config.parallelismPerKpu,
  });

  const applicationConfiguration = {
    checkpointConfiguration,
    monitoringConfiguration,
    parallelismConfiguration,
  };

  if (isEmptyObj(applicationConfiguration)) {
    return;
  }

  return applicationConfiguration;
}

function configFor(config: {[key: string]: unknown}) {
  if (isEmptyObj(config)) {
    return;
  }

  return {
    ...config,
    configurationType: 'CUSTOM',
  };
}

function isEmptyObj(obj: {[key: string]: unknown}) {
  return Object.values(obj).every(v => v === undefined);
}
