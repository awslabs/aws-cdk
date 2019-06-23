import logs = require('@aws-cdk/aws-logs');
import { Construct, Stack } from '@aws-cdk/cdk';
import { ContainerDefinition } from '../container-definition';
import { LogDriver, LogDriverConfig } from "./log-driver";

/**
 * Properties for defining a new AWS Log Driver
 */
export interface AwsLogDriverProps {
  /**
   * Prefix for the log streams
   *
   * The awslogs-stream-prefix option allows you to associate a log stream
   * with the specified prefix, the container name, and the ID of the Amazon
   * ECS task to which the container belongs. If you specify a prefix with
   * this option, then the log stream takes the following format:
   *
   *     prefix-name/container-name/ecs-task-id
   */
  readonly streamPrefix: string;

  /**
   * The log group to log to
   *
   * @default - A log group is automatically created.
   */
  readonly logGroup?: logs.ILogGroup;

  /**
   * The number of days log events are kept in CloudWatch Logs when the log
   * group is automatically created by this construct.
   *
   * @default - Logs never expire.
   */
  readonly logRetention?: logs.RetentionDays;

  /**
   * This option defines a multiline start pattern in Python strftime format.
   *
   * A log message consists of a line that matches the pattern and any
   * following lines that don’t match the pattern. Thus the matched line is
   * the delimiter between log messages.
   *
   * @default - No multiline matching.
   */
  readonly datetimeFormat?: string;

  /**
   * This option defines a multiline start pattern using a regular expression.
   *
   * A log message consists of a line that matches the pattern and any
   * following lines that don’t match the pattern. Thus the matched line is
   * the delimiter between log messages.
   *
   * This option is ignored if datetimeFormat is also configured.
   *
   * @default - No multiline matching.
   */
  readonly multilinePattern?: string;
}

/**
 * A log driver that will log to an AWS Log Group
 */
export class AwsLogDriver extends LogDriver {
  /**
   * The log group that the logs will be sent to
   *
   * Only available after the LogDriver has been bound to a ContainerDefinition.
   */
  public logGroup?: logs.ILogGroup;

  constructor(private readonly props: AwsLogDriverProps) {
    super();

    if (props.logGroup && props.logRetention) {
      throw new Error('Cannot specify both `logGroup` and `logRetentionDays`.');
    }
  }

  /**
   * Called when the log driver is configured on a container
   */
  public bind(scope: Construct, containerDefinition: ContainerDefinition): LogDriverConfig {
    this.logGroup = this.props.logGroup || new logs.LogGroup(scope, 'LogGroup', {
        retention: this.props.logRetention || Infinity,
    });

    this.logGroup.grantWrite(containerDefinition.taskDefinition.obtainExecutionRole());

    return {
      logDriver: 'awslogs',
      options: removeEmpty({
        'awslogs-group': this.logGroup.logGroupName,
        'awslogs-stream-prefix': this.props.streamPrefix,
        'awslogs-region': Stack.of(containerDefinition).region,
        'awslogs-datetime-format': this.props.datetimeFormat,
        'awslogs-multiline-pattern': this.props.multilinePattern,
      }),
    };
  }
}

/**
 * Remove undefined values from a dictionary
 */
function removeEmpty<T>(x: {[key: string]: (T | undefined)}): {[key: string]: T} {
  for (const key of Object.keys(x)) {
    if (!x[key]) {
      delete x[key];
    }
  }
  return x as any;
}
