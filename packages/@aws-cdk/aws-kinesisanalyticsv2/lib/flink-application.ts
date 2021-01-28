import * as iam from '@aws-cdk/aws-iam';
import * as logs from '@aws-cdk/aws-logs';
import * as core from '@aws-cdk/core';
import { Construct } from 'constructs';
import { ApplicationCode } from './application-code';
import { CfnApplication, CfnApplicationCloudWatchLoggingOption } from './kinesisanalyticsv2.generated';
import { flinkApplicationConfiguration, FlinkLogLevel, FlinkMetricsLevel } from './private/flink-application-configuration';
import { validateFlinkApplicationProps } from './private/validation';
import { PropertyGroup } from './property-group';

export interface IFlinkApplication extends core.IResource, iam.IGrantable {
  /**
   * The application ARN.
   *
   * @attribute
   */
  readonly applicationArn: string;

  /**
   * The name of the Flink application.
   *
   * @attribute
   */
  readonly applicationName: string;

  /**
   * The application IAM role.
   */
  readonly role?: iam.IRole;

  /**
   * Convenience method for adding a policy statement to the application role.
   */
  addToPrincipalPolicy(policyStatement: iam.PolicyStatement): boolean;
}

/**
 * Available Flink runtimes for Kinesis Analytics.
 *
 * @example
 * // Creating a new runtime that isn't in CDK yet.
 * const runtime = new FlinkRuntime(FLINK-9_99);
 */
export class FlinkRuntime {
  public static readonly FLINK_1_6 = new FlinkRuntime('FLINK-1_6');
  public static readonly FLINK_1_8 = new FlinkRuntime('FLINK-1_8');
  public static readonly FLINK_1_11 = new FlinkRuntime('FLINK-1_11');
  public constructor(public readonly value: string) {}
}

/**
 * Implements the functionality shared between CDK created and imported
 * IFlinkApplications.
 */
abstract class FlinkApplicationBase extends core.Resource implements IFlinkApplication {
  public abstract readonly applicationArn: string;
  public abstract readonly applicationName: string;
  public abstract readonly role?: iam.IRole;

  // Implement iam.IGrantable interface
  public abstract readonly grantPrincipal: iam.IPrincipal;

  /** Implement the convenience {@link IFlinkApplication.addToPrincipalPolicy} method. */
  public addToPrincipalPolicy(policyStatement: iam.PolicyStatement): boolean {
    if (this.role) {
      this.role.addToPrincipalPolicy(policyStatement);
      return true;
    }

    return false;
  }
}

/**
 * Props for creating a FlinkApplication construct.
 */
export interface FlinkApplicationProps {
  /**
   * A name for your FlinkApplication that is unique to an AWS account.
   *
   * @default - CloudFormation-generated name
   */
  readonly applicationName?: string;

  /**
   * The Flink version to use for this application.
   */
  readonly runtime: FlinkRuntime;

  /**
   * The Flink code asset to run.
   */
  readonly code: ApplicationCode;

  /**
   * Whether checkpointing is enabled while your application runs.
   *
   * @default true
   */
  readonly checkpointingEnabled?: boolean;

  /**
   * The interval between checkpoints.
   *
   * @default 1 minute
   */
  readonly checkpointInterval?: core.Duration;

  /**
   * The minimum amount of time in to wait after a checkpoint finishes to start
   * a new checkpoint.
   *
   * @default 5 seconds
   */
  readonly minPauseBetweenCheckpoints?: core.Duration;

  /**
   * The level of log verbosity from the Flink application.
   *
   * @default FlinkLogLevel.INFO
   */
  readonly logLevel?: FlinkLogLevel;

  /**
   * Describes the granularity of the CloudWatch metrics for an application.
   * Use caution with Parallelism level metrics. Parallelism granularity logs
   * metrics for each parallel thread and can quickly become expensive when
   * parallelism is high (e.g. > 64).
   *
   * @default FlinkMetricsLevel.APPLICATION
   */
  readonly metricsLevel?: FlinkMetricsLevel;

  /**
   * Whether the Kinesis Data Analytics service can increase the parallelism of
   * the application in response to resource usage.
   *
   * @default true
   */
  readonly autoScalingEnabled?: boolean;

  /**
   * The initial parallelism for the Flink application. Kinesis Data Analytics
   * can stop the app, increase the parallelism, and start the app again if
   * autoScalingEnabled is true (the default value).
   *
   * @default 1
   */
  readonly parallelism?: number;

  /**
   * The Flink parallelism allowed per Kinesis Processing Unit (KPU).
   *
   * @default 1
   */
  readonly parallelismPerKpu?: number

  /**
   * Determines if Flink snapshots are enabled.
   *
   * @default true
   */
  readonly snapshotsEnabled?: boolean;

  /**
   * Configuration PropertyGroups. You can use these property groups to pass
   * arbitrary runtime configuration values to your Flink App.
   */
  readonly propertyGroups?: PropertyGroup[];

  /**
   * A role to use to grant permissions to your application. Prefer omitting
   * this property and using the default role.
   *
   * @default - a new Role will be created
   */
  readonly role?: iam.IRole;

  /**
   * Provide a RemovalPolicy to override the default.
   *
   * @default RemovalPolicy.DESTROY
   */
  readonly removalPolicy?: core.RemovalPolicy;
}

/**
 * Attributes passed to the fromAttributes factory method.
 */
export interface Attributes {
  readonly applicationName: string;
  readonly applicationArn: string;
}

/**
 * The L2 construct for Flink Kinesis Data Applications.
 *
 * @resource AWS::KinesisAnalyticsV2::Application
 *
 * @experimental
 */
export class FlinkApplication extends FlinkApplicationBase {
  /**
   * Import an existing Flink application, defined outside of CDK code.
   */
  public static fromAttributes(scope: Construct, id: string, attributes: Attributes): IFlinkApplication {
    class Import extends FlinkApplicationBase {
      // Imported flink applications have no associated role or grantPrincipal
      public readonly role = undefined;
      public readonly grantPrincipal = new iam.UnknownPrincipal({ resource: this });

      public readonly applicationName = attributes.applicationName;
      public readonly applicationArn = attributes.applicationArn;
    }

    return new Import(scope, id);
  }

  public readonly applicationArn: string;
  public readonly applicationName: string;

  // Role must be optional for JSII compatibility
  public readonly role?: iam.IRole;

  public readonly grantPrincipal: iam.IPrincipal;

  constructor(scope: Construct, id: string, props: FlinkApplicationProps) {
    super(scope, id, { physicalName: props.applicationName });
    validateFlinkApplicationProps(props);

    this.role = props.role ?? new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('kinesisanalytics.amazonaws.com'),
    });
    this.grantPrincipal = this.role;

    // Permit metric publishing to CloudWatch
    this.role.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
    }));

    // TODO: Refactor to make this bug impossible
    const code = props.code.bind(this);
    if (!props.code.bucket) {
      throw new Error('BUG: Bound code is missing its bucket.');
    }
    props.code.bucket.grantRead(this);

    const resource = new CfnApplication(this, 'Resource', {
      runtimeEnvironment: props.runtime.value,
      serviceExecutionRole: this.role.roleArn,
      applicationConfiguration: {
        applicationCodeConfiguration: code,
        environmentProperties: props.propertyGroups?.length
          ? { propertyGroups: props.propertyGroups.map(pg => pg.toCfn()) }
          : undefined,
        flinkApplicationConfiguration: flinkApplicationConfiguration({
          checkpointingEnabled: props.checkpointingEnabled,
          checkpointInterval: props.checkpointInterval,
          minPauseBetweenCheckpoints: props.minPauseBetweenCheckpoints,
          logLevel: props.logLevel,
          metricsLevel: props.metricsLevel,
          autoScalingEnabled: props.autoScalingEnabled,
          parallelism: props.parallelism,
          parallelismPerKpu: props.parallelismPerKpu,
        }),
        applicationSnapshotConfiguration: {
          snapshotsEnabled: props.snapshotsEnabled ?? true,
        },
      },
    });
    resource.node.addDependency(this.role);

    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: core.RemovalPolicy.DESTROY,
    });

    const logStream = new logs.LogStream(this, 'LogStream', {
      logGroup,
      removalPolicy: core.RemovalPolicy.DESTROY,
    });

    const logStreamArn = `arn:${core.Aws.PARTITION}:logs:${core.Aws.REGION}:${core.Aws.ACCOUNT_ID}:log-group:${logGroup.logGroupName}:log-stream:${logStream.logStreamName}`;

    // Permit logging
    this.role.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['logs:DescribeLogStreams', 'logs:DescribeLogGroups'],
      resources: [
        logGroup.logGroupArn,
        core.Stack.of(this).formatArn({
          service: 'logs',
          resource: 'log-group',
          resourceName: '*',
        }),
      ],
    }));
    this.role.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['logs:PutLogEvents'],
      resources: [logStreamArn],
    }));

    new CfnApplicationCloudWatchLoggingOption(this, 'LoggingOption', {
      applicationName: resource.ref,
      cloudWatchLoggingOption: {
        logStreamArn,
      },
    }).node.addDependency(resource);

    this.applicationName = this.getResourceNameAttribute(resource.ref);
    this.applicationArn = this.getResourceArnAttribute(
      core.Stack.of(this).formatArn(flinkApplicationArnComponents(resource.ref)),
      flinkApplicationArnComponents(this.physicalName),
    );

    resource.applyRemovalPolicy(props.removalPolicy, {
      default: core.RemovalPolicy.DESTROY,
    });
  }
}

function flinkApplicationArnComponents(resourceName: string): core.ArnComponents {
  return {
    service: 'kinesisanalytics',
    resource: 'application',
    resourceName,
  };
}
