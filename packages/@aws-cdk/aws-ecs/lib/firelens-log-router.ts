import * as iam from '@aws-cdk/aws-iam';
import * as ssm from '@aws-cdk/aws-ssm';
import * as cdk from '@aws-cdk/core';
import { Construct } from 'constructs';
import { TaskDefinition } from './base/task-definition';
import { ContainerDefinition, ContainerDefinitionOptions, ContainerDefinitionProps } from './container-definition';
import { ContainerImage } from './container-image';
import { CfnTaskDefinition } from './ecs.generated';
import { LogDriverConfig } from './log-drivers/log-driver';

/**
 * Firelens log router type, fluentbit or fluentd.
 * https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using_firelens.html
 */
export enum FirelensLogRouterType {
  /**
   * fluentbit
   */
  FLUENTBIT = 'fluentbit',

  /**
   * fluentd
   */
  FLUENTD = 'fluentd',
}

/**
 * Firelens configuration file type, s3 or file path.
 * https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using_firelens.html#firelens-taskdef-customconfig
 */
export enum FirelensConfigFileType {
  /**
   * s3
   */
  S3 = 's3',

  /**
   * fluentd
   */
  FILE = 'file',
}

/**
 * The options for firelens log router
 * https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using_firelens.html#firelens-taskdef-customconfig
 */
export interface FirelensOptions {
  /**
   * By default, Amazon ECS adds additional fields in your log entries that help identify the source of the logs.
   * You can disable this action by setting enable-ecs-log-metadata to false.
   * @default - true
   */
  readonly enableECSLogMetadata?: boolean;

  /**
   * Custom configuration file, s3 or file
   * @default - determined by checking configFileValue with S3 ARN.
   */
  readonly configFileType?: FirelensConfigFileType;

  /**
   * Custom configuration file, S3 ARN or a file path
   */
  readonly configFileValue: string;
}

/**
 * Firelens Configuration
 * https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using_firelens.html#firelens-taskdef
 */
export interface FirelensConfig {

  /**
   * The log router to use
   * @default - fluentbit
   */
  readonly type: FirelensLogRouterType;

  /**
   * Firelens options
   * @default - no additional options
   */
  readonly options?: FirelensOptions;
}

/**
 * The properties in a firelens log router.
 */
export interface FirelensLogRouterProps extends ContainerDefinitionProps {
  /**
   * Firelens configuration
   */
  readonly firelensConfig: FirelensConfig;
}

/**
 * The options for creating a firelens log router.
 */
export interface FirelensLogRouterDefinitionOptions extends ContainerDefinitionOptions {
  /**
   * Firelens configuration
   */
  readonly firelensConfig: FirelensConfig;
}

/**
 * Render to CfnTaskDefinition.FirelensConfigurationProperty from FirelensConfig
 */
function renderFirelensConfig(firelensConfig: FirelensConfig): CfnTaskDefinition.FirelensConfigurationProperty {
  if (!firelensConfig.options) {
    return { type: firelensConfig.type };
  } else {
    // firelensConfig.options.configFileType has been filled with s3 or file type in constructor.
    return {
      type: firelensConfig.type,
      options: {
        'enable-ecs-log-metadata': firelensConfig.options.enableECSLogMetadata ? 'true' : 'false',
        'config-file-type': firelensConfig.options.configFileType!,
        'config-file-value': firelensConfig.options.configFileValue,
      },
    };
  }
}

/**
 * SSM parameters for latest fluent bit docker image in ECR
 * https://github.com/aws/aws-for-fluent-bit#using-ssm-to-find-available-versions
 */
const fluentBitImageSSMPath = '/aws/service/aws-for-fluent-bit';

/**
 * Obtain Fluent Bit image in Amazon ECR and setup corresponding IAM permissions.
 * ECR image pull permissions will be granted in task execution role.
 * Cloudwatch logs, Kinesis data stream or firehose permissions will be grant by check options in logDriverConfig.
 * https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using_firelens.html#firelens-using-fluentbit
 */
export function obtainDefaultFluentBitECRImage(task: TaskDefinition, logDriverConfig?: LogDriverConfig, imageTag?: string): ContainerImage {
  // grant ECR image pull permissions to executor role
  task.addToExecutionRolePolicy(new iam.PolicyStatement({
    actions: [
      'ecr:GetAuthorizationToken',
      'ecr:BatchCheckLayerAvailability',
      'ecr:GetDownloadUrlForLayer',
      'ecr:BatchGetImage',
    ],
    resources: ['*'],
  }));

  // grant cloudwatch or firehose permissions to task role
  const logName = logDriverConfig && logDriverConfig.logDriver === 'awsfirelens'
    && logDriverConfig.options && logDriverConfig.options.Name;
  if (logName === 'cloudwatch') {
    task.addToTaskRolePolicy(new iam.PolicyStatement({
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:DescribeLogStreams',
        'logs:PutLogEvents',
      ],
      resources: ['*'],
    }));
  } else if (logName === 'firehose') {
    task.addToTaskRolePolicy(new iam.PolicyStatement({
      actions: [
        'firehose:PutRecordBatch',
      ],
      resources: ['*'],
    }));
  } else if (logName === 'kinesis') {
    task.addToTaskRolePolicy(new iam.PolicyStatement({
      actions: [
        'kinesis:PutRecords',
      ],
      resources: ['*'],
    }));
  }

  const fluentBitImageTag = imageTag || 'latest';
  const fluentBitImage = `${fluentBitImageSSMPath}/${fluentBitImageTag}`;

  // Not use ContainerImage.fromEcrRepository since it's not support parsing ECR repo URI,
  // use repo ARN might result in complex Fn:: functions in cloudformation template.
  return ContainerImage.fromRegistry(ssm.StringParameter.valueForStringParameter(task, fluentBitImage));
}

/**
 * Firelens log router
 */
export class FirelensLogRouter extends ContainerDefinition {
  /**
   * Firelens configuration
   */
  public readonly firelensConfig: FirelensConfig;

  /**
   * Constructs a new instance of the FirelensLogRouter class.
   */
  constructor(scope: Construct, id: string, props: FirelensLogRouterProps) {
    super(scope, id, props);
    const options = props.firelensConfig.options;
    if (options) {
      const enableECSLogMetadata = options.enableECSLogMetadata || options.enableECSLogMetadata === undefined;
      const configFileType = (options.configFileType === undefined || options.configFileType === FirelensConfigFileType.S3) &&
        (cdk.Token.isUnresolved(options.configFileValue) || /arn:aws[a-zA-Z-]*:s3:::.+/.test(options.configFileValue))
        ? FirelensConfigFileType.S3 : FirelensConfigFileType.FILE;
      this.firelensConfig = {
        type: props.firelensConfig.type,
        options: {
          enableECSLogMetadata,
          configFileType,
          configFileValue: options.configFileValue,
        },
      };

      // grant s3 access permissions
      if (configFileType === FirelensConfigFileType.S3) {
        props.taskDefinition.addToExecutionRolePolicy(new iam.PolicyStatement({
          actions: [
            's3:GetObject',
          ],
          resources: [options.configFileValue],
        }));
        props.taskDefinition.addToExecutionRolePolicy(new iam.PolicyStatement({
          actions: [
            's3:GetBucketLocation',
          ],
          resources: [options.configFileValue.split('/')[0]],
        }));
      }
    } else {
      this.firelensConfig = props.firelensConfig;
    }
  }

  /**
   * Render this container definition to a CloudFormation object
   */
  public renderContainerDefinition(_taskDefinition?: TaskDefinition): CfnTaskDefinition.ContainerDefinitionProperty {
    return {
      ...(super.renderContainerDefinition()),
      firelensConfiguration: this.firelensConfig && renderFirelensConfig(this.firelensConfig),
    };
  }
}
