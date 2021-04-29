import * as crypto from 'crypto';
import { Metric, MetricOptions, MetricProps } from '@aws-cdk/aws-cloudwatch';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import { Construct } from 'constructs';
import { Code } from './code';
import { Schedule } from './schedule';
import { CloudWatchSyntheticsMetrics } from './synthetics-canned-metrics.generated';
import { CfnCanary } from './synthetics.generated';

/**
 * Specify a test that the canary should run
 */
export class Test {
  /**
   * Specify a custom test with your own code
   *
   * @returns `Test` associated with the specified Code object
   * @param options The configuration options
   */
  public static custom(options: CustomTestOptions): Test {
    Test.validateHandler(options.handler);
    return new Test(options.code, options.handler);
  }

  /**
   * Verifies that the given handler ends in '.handler'. Returns the handler if successful and
   * throws an error if not.
   *
   * @param handler - the handler given by the user
   */
  private static validateHandler(handler: string) {
    if (!handler.endsWith('.handler')) {
      throw new Error(`Canary Handler must end in '.handler' (${handler})`);
    }
    if (handler.length > 21) {
      throw new Error(`Canary Handler must be less than 21 characters (${handler})`);
    }
  }

  /**
   * Construct a Test property
   *
   * @param code The code that the canary should run
   * @param handler The handler of the canary
   */
  private constructor(public readonly code: Code, public readonly handler: string) {
  }
}

/**
 * Properties for specifying a test
 */
export interface CustomTestOptions {
  /**
   * The code of the canary script
   */
  readonly code: Code,

  /**
   * The handler for the code. Must end with `.handler`.
   */
  readonly handler: string,
}

/**
 * Runtime options for a canary
 */
export class Runtime {
  /**
   * `syn-1.0` includes the following:
   *
   * - Synthetics library 1.0
   * - Synthetics handler code 1.0
   * - Lambda runtime Node.js 10.x
   * - Puppeteer-core version 1.14.0
   * - The Chromium version that matches Puppeteer-core 1.14.0
   *
   * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Library_nodejs_puppeteer.html#CloudWatch_Synthetics_runtimeversion-1.0
   */
  public static readonly SYNTHETICS_1_0 = new Runtime('syn-1.0');

  /**
   * `syn-nodejs-2.0` includes the following:
   * - Lambda runtime Node.js 10.x
   * - Puppeteer-core version 3.3.0
   * - Chromium version 83.0.4103.0
   *
   * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Library_nodejs_puppeteer.html#CloudWatch_Synthetics_runtimeversion-2.0
   */
  public static readonly SYNTHETICS_NODEJS_2_0 = new Runtime('syn-nodejs-2.0');


  /**
   * `syn-nodejs-2.1` includes the following:
   * - Lambda runtime Node.js 10.x
   * - Puppeteer-core version 3.3.0
   * - Chromium version 83.0.4103.0
   *
   * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Library_nodejs_puppeteer.html#CloudWatch_Synthetics_runtimeversion-2.1
   */
  public static readonly SYNTHETICS_NODEJS_2_1 = new Runtime('syn-nodejs-2.1');

  /**
   * `syn-nodejs-2.2` includes the following:
   * - Lambda runtime Node.js 10.x
   * - Puppeteer-core version 3.3.0
   * - Chromium version 83.0.4103.0
   *
   * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Library_nodejs_puppeteer.html#CloudWatch_Synthetics_runtimeversion-2.2
   */
  public static readonly SYNTHETICS_NODEJS_2_2 = new Runtime('syn-nodejs-2.2');

  /**
   * `syn-nodejs-puppeteer-3.0` includes the following:
   * - Lambda runtime Node.js 12.x
   * - Puppeteer-core version 5.5.0
   * - Chromium version 88.0.4298.0
   *
   * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Library_nodejs_puppeteer.html#CloudWatch_Synthetics_runtimeversion-nodejs-puppeteer-3.0
   */
  public static readonly SYNTHETICS_NODEJS_PUPPETEER_3_0 = new Runtime('syn-nodejs-puppeteer-3.0');

  /**
   * `syn-nodejs-puppeteer-3.1` includes the following:
   * - Lambda runtime Node.js 12.x
   * - Puppeteer-core version 5.5.0
   * - Chromium version 88.0.4298.0
   *
   * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Library_nodejs_puppeteer.html#CloudWatch_Synthetics_runtimeversion-nodejs-puppeteer-3.1
   */
  public static readonly SYNTHETICS_NODEJS_PUPPETEER_3_1 = new Runtime('syn-nodejs-puppeteer-3.1');

  /**
   * Latest Puppeteer runtime using Node.js and Chrome.
   * The runtime will automatically update to the latest version
   * available in CDK for that region on every deployment. There
   * maybe a delay between a new runtime being released and
   * becoming available in CDK.
   *
   * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Library_nodejs_puppeteer.html
   */
  public static latestPuppeteer(_scope: Construct) {
    // _scope may be used in the future to retrieve the region if
    // the latest runtime is different across regions. This ensures
    // that the public API is stable
    return Runtime.SYNTHETICS_NODEJS_PUPPETEER_3_1;
  }

  /**
   * @param name The name of the runtime version
   */
  public constructor(public readonly name: string) {
  }
}

/**
 * Options for specifying the s3 location that stores the data of each canary run. The artifacts bucket location **cannot**
 * be updated once the canary is created.
 */
export interface ArtifactsBucketLocation {
  /**
   * The s3 location that stores the data of each run.
   */
  readonly bucket: s3.IBucket;

  /**
   * The S3 bucket prefix. Specify this if you want a more specific path within the artifacts bucket.
   *
   * @default - no prefix
   */
  readonly prefix?: string;
}

/**
 * Properties for a canary
 */
export interface CanaryProps {
  /**
   * The s3 location that stores the data of the canary runs.
   *
   * @default - A new s3 bucket will be created without a prefix.
   */
  readonly artifactsBucketLocation?: ArtifactsBucketLocation;

  /**
   * Canary execution role.
   *
   * This is the role that will be assumed by the canary upon execution.
   * It controls the permissions that the canary will have. The role must
   * be assumable by the AWS Lambda service principal.
   *
   * If not supplied, a role will be created with all the required permissions.
   * If you provide a Role, you must add the required permissions.
   *
   * @see required permissions: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-synthetics-canary.html#cfn-synthetics-canary-executionrolearn
   *
   * @default - A unique role will be generated for this canary.
   * You can add permissions to roles by calling 'addToRolePolicy'.
   */
  readonly role?: iam.IRole;

  /**
   * How long the canary will be in a 'RUNNING' state. For example, if you set `timeToLive` to be 1 hour and `schedule` to be `rate(10 minutes)`,
   * your canary will run at 10 minute intervals for an hour, for a total of 6 times.
   *
   * @default - no limit
   */
  readonly timeToLive?: cdk.Duration;

  /**
   * Specify the schedule for how often the canary runs. For example, if you set `schedule` to `rate(10 minutes)`, then the canary will run every 10 minutes.
   * You can set the schedule with `Schedule.rate(Duration)` (recommended) or you can specify an expression using `Schedule.expression()`.
   * @default 'rate(5 minutes)'
   */
  readonly schedule?: Schedule;

  /**
   * Whether or not the canary should start after creation.
   *
   * @default true
   */
  readonly startAfterCreation?: boolean;

  /**
   * How many days should successful runs be retained.
   *
   * @default Duration.days(31)
   */
  readonly successRetentionPeriod?: cdk.Duration;

  /**
   * How many days should failed runs be retained.
   *
   * @default Duration.days(31)
   */
  readonly failureRetentionPeriod?: cdk.Duration;

  /**
   * The name of the canary. Be sure to give it a descriptive name that distinguishes it from
   * other canaries in your account.
   *
   * Do not include secrets or proprietary information in your canary name. The canary name
   * makes up part of the canary ARN, which is included in outbound calls over the internet.
   * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/servicelens_canaries_security.html
   *
   * @default - A unique name will be generated from the construct ID
   */
  readonly canaryName?: string;

  /**
   * Specify the runtime version to use for the canary.
   *
   * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Canaries_Library.html
   */
  readonly runtime: Runtime;

  /**
   * The type of test that you want your canary to run. Use `Test.custom()` to specify the test to run.
   */
  readonly test: Test;

}

/**
 * Define a new Canary
 */
export class Canary extends cdk.Resource {
  /**
   * Execution role associated with this Canary.
   */
  public readonly role: iam.IRole;

  /**
   * The canary ID
   * @attribute
   */
  public readonly canaryId: string;

  /**
   * The state of the canary. For example, 'RUNNING', 'STOPPED', 'NOT STARTED', or 'ERROR'.
   * @attribute
   */
  public readonly canaryState: string;

  /**
   * The canary Name
   * @attribute
   */
  public readonly canaryName: string;

  /**
   * Bucket where data from each canary run is stored.
   */
  public readonly artifactsBucket: s3.IBucket;

  public constructor(scope: Construct, id: string, props: CanaryProps) {
    if (props.canaryName && !cdk.Token.isUnresolved(props.canaryName)) {
      validateName(props.canaryName);
    }

    super(scope, id, {
      physicalName: props.canaryName || cdk.Lazy.string({
        produce: () => this.generateUniqueName(),
      }),
    });

    this.artifactsBucket = props.artifactsBucketLocation?.bucket ?? new s3.Bucket(this, 'ArtifactsBucket', {
      encryption: s3.BucketEncryption.KMS_MANAGED,
    });

    this.role = props.role ?? this.createDefaultRole(props.artifactsBucketLocation?.prefix);

    const resource: CfnCanary = new CfnCanary(this, 'Resource', {
      artifactS3Location: this.artifactsBucket.s3UrlForObject(props.artifactsBucketLocation?.prefix),
      executionRoleArn: this.role.roleArn,
      startCanaryAfterCreation: props.startAfterCreation ?? true,
      runtimeVersion: props.runtime.name,
      name: this.physicalName,
      schedule: this.createSchedule(props),
      failureRetentionPeriod: props.failureRetentionPeriod?.toDays(),
      successRetentionPeriod: props.successRetentionPeriod?.toDays(),
      code: this.createCode(props),
    });

    this.canaryId = resource.attrId;
    this.canaryState = resource.attrState;
    this.canaryName = this.getResourceNameAttribute(resource.ref);
  }

  /**
   * Measure the Duration of a single canary run, in seconds.
   *
   * @param options - configuration options for the metric
   *
   * @default avg over 5 minutes
   */
  public metricDuration(options?: MetricOptions): Metric {
    return this.cannedMetric(CloudWatchSyntheticsMetrics.durationAverage, options);
  }

  /**
   * Measure the percentage of successful canary runs.
   *
   * @param options - configuration options for the metric
   *
   * @default avg over 5 minutes
   */
  public metricSuccessPercent(options?: MetricOptions): Metric {
    return this.cannedMetric(CloudWatchSyntheticsMetrics.successPercentAverage, options);
  }

  /**
   * Measure the number of failed canary runs over a given time period.
   *
   * Default: sum over 5 minutes
   *
   * @param options - configuration options for the metric
   */
  public metricFailed(options?: MetricOptions): Metric {
    return this.cannedMetric(CloudWatchSyntheticsMetrics.failedSum, options);
  }

  /**
   * Returns a default role for the canary
   */
  private createDefaultRole(prefix?: string): iam.IRole {
    const { partition } = cdk.Stack.of(this);
    // Created role will need these policies to run the Canary.
    // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-synthetics-canary.html#cfn-synthetics-canary-executionrolearn
    const policy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: ['*'],
          actions: ['s3:ListAllMyBuckets'],
        }),
        new iam.PolicyStatement({
          resources: [this.artifactsBucket.arnForObjects(`${prefix ? prefix+'/*' : '*'}`)],
          actions: ['s3:PutObject', 's3:GetBucketLocation'],
        }),
        new iam.PolicyStatement({
          resources: ['*'],
          actions: ['cloudwatch:PutMetricData'],
          conditions: { StringEquals: { 'cloudwatch:namespace': 'CloudWatchSynthetics' } },
        }),
        new iam.PolicyStatement({
          resources: [`arn:${partition}:logs:::*`],
          actions: ['logs:CreateLogStream', 'logs:CreateLogGroup', 'logs:PutLogEvents'],
        }),
      ],
    });

    return new iam.Role(this, 'ServiceRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        canaryPolicy: policy,
      },
    });
  }

  /**
   * Returns the code object taken in by the canary resource.
   */
  private createCode(props: CanaryProps): CfnCanary.CodeProperty {
    const codeConfig = {
      handler: props.test.handler,
      ...props.test.code.bind(this, props.test.handler),
    };
    return {
      handler: codeConfig.handler,
      script: codeConfig.inlineCode,
      s3Bucket: codeConfig.s3Location?.bucketName,
      s3Key: codeConfig.s3Location?.objectKey,
      s3ObjectVersion: codeConfig.s3Location?.objectVersion,
    };
  }

  /**
   * Returns a canary schedule object
   */
  private createSchedule(props: CanaryProps): CfnCanary.ScheduleProperty {
    return {
      durationInSeconds: String(`${props.timeToLive?.toSeconds() ?? 0}`),
      expression: props.schedule?.expressionString ?? 'rate(5 minutes)',
    };
  }

  /**
   * Creates a unique name for the canary. The generated name is the physical ID of the canary.
   */
  private generateUniqueName(): string {
    const name = cdk.Names.uniqueId(this).toLowerCase().replace(' ', '-');
    if (name.length <= 21) {
      return name;
    } else {
      return name.substring(0, 15) + nameHash(name);
    }
  }

  private cannedMetric(
    fn: (dims: { CanaryName: string }) => MetricProps,
    props?: MetricOptions): Metric {
    return new Metric({
      ...fn({ CanaryName: this.canaryName }),
      ...props,
    }).attachTo(this);
  }
}

/**
 * Take a hash of the given name.
 *
 * @param name the name to be hashed
 */
function nameHash(name: string): string {
  const md5 = crypto.createHash('sha256').update(name).digest('hex');
  return md5.slice(0, 6);
}

const nameRegex: RegExp = /^[0-9a-z_\-]+$/;

/**
 * Verifies that the name fits the regex expression: ^[0-9a-z_\-]+$.
 *
 * @param name - the given name of the canary
 */
function validateName(name: string) {
  if (name.length > 21) {
    throw new Error(`Canary name is too large, must be between 1 and 21 characters, but is ${name.length} (got "${name}")`);
  }
  if (!nameRegex.test(name)) {
    throw new Error(`Canary name must be lowercase, numbers, hyphens, or underscores (got "${name}")`);
  }
}
