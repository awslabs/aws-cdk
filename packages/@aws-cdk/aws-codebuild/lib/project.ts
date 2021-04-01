import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecr from '@aws-cdk/aws-ecr';
import { DockerImageAsset, DockerImageAssetProps } from '@aws-cdk/aws-ecr-assets';
import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import * as s3 from '@aws-cdk/aws-s3';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import { ArnComponents, Aws, Duration, IResource, Lazy, Names, PhysicalName, Resource, SecretValue, Stack, Token, Tokenization } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { IArtifacts } from './artifacts';
import { BuildSpec } from './build-spec';
import { Cache } from './cache';
import { CodeBuildMetrics } from './codebuild-canned-metrics.generated';
import { CfnProject } from './codebuild.generated';
import { CodePipelineArtifacts } from './codepipeline-artifacts';
import { IFileSystemLocation } from './file-location';
import { NoArtifacts } from './no-artifacts';
import { NoSource } from './no-source';
import { runScriptLinuxBuildSpec, S3_BUCKET_ENV, S3_KEY_ENV } from './private/run-script-linux-build-spec';
import { LoggingOptions } from './project-logs';
import { renderReportGroupArn } from './report-group-utils';
import { ISource } from './source';
import { CODEPIPELINE_SOURCE_ARTIFACTS_TYPE, NO_SOURCE_TYPE } from './source-types';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';

/**
 * The type returned from {@link IProject#enableBatchBuilds}.
 */
export interface BatchBuildConfig {
  /** The IAM batch service Role of this Project. */
  readonly role: iam.IRole;
}

export interface IProject extends IResource, iam.IGrantable, ec2.IConnectable {
  /**
   * The ARN of this Project.
   * @attribute
   */
  readonly projectArn: string;

  /**
   * The human-visible name of this Project.
   * @attribute
   */
  readonly projectName: string;

  /** The IAM service Role of this Project. Undefined for imported Projects. */
  readonly role?: iam.IRole;

  /**
   * Enable batch builds.
   *
   * Returns an object contining the batch service role if batch builds
   * could be enabled.
   */
  enableBatchBuilds(): BatchBuildConfig | undefined;

  addToRolePolicy(policyStatement: iam.PolicyStatement): void;

  /**
   * Defines a CloudWatch event rule triggered when something happens with this project.
   *
   * @see https://docs.aws.amazon.com/codebuild/latest/userguide/sample-build-notifications.html
   */
  onEvent(id: string, options?: events.OnEventOptions): events.Rule;

  /**
   * Defines a CloudWatch event rule triggered when the build project state
   * changes. You can filter specific build status events using an event
   * pattern filter on the `build-status` detail field:
   *
   *    const rule = project.onStateChange('OnBuildStarted', { target });
   *    rule.addEventPattern({
   *      detail: {
   *        'build-status': [
   *          "IN_PROGRESS",
   *          "SUCCEEDED",
   *          "FAILED",
   *          "STOPPED"
   *        ]
   *      }
   *    });
   *
   * You can also use the methods `onBuildFailed` and `onBuildSucceeded` to define rules for
   * these specific state changes.
   *
   * To access fields from the event in the event target input,
   * use the static fields on the `StateChangeEvent` class.
   *
   * @see https://docs.aws.amazon.com/codebuild/latest/userguide/sample-build-notifications.html
   */
  onStateChange(id: string, options?: events.OnEventOptions): events.Rule;

  /**
   * Defines a CloudWatch event rule that triggers upon phase change of this
   * build project.
   *
   * @see https://docs.aws.amazon.com/codebuild/latest/userguide/sample-build-notifications.html
   */
  onPhaseChange(id: string, options?: events.OnEventOptions): events.Rule;

  /**
   * Defines an event rule which triggers when a build starts.
   */
  onBuildStarted(id: string, options?: events.OnEventOptions): events.Rule;

  /**
   * Defines an event rule which triggers when a build fails.
   */
  onBuildFailed(id: string, options?: events.OnEventOptions): events.Rule;

  /**
   * Defines an event rule which triggers when a build completes successfully.
   */
  onBuildSucceeded(id: string, options?: events.OnEventOptions): events.Rule;

  /**
   * @returns a CloudWatch metric associated with this build project.
   * @param metricName The name of the metric
   * @param props Customization properties
   */
  metric(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric;

  /**
   * Measures the number of builds triggered.
   *
   * Units: Count
   *
   * Valid CloudWatch statistics: Sum
   *
   * @default sum over 5 minutes
   */
  metricBuilds(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

  /**
   * Measures the duration of all builds over time.
   *
   * Units: Seconds
   *
   * Valid CloudWatch statistics: Average (recommended), Maximum, Minimum
   *
   * @default average over 5 minutes
   */
  metricDuration(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

  /**
   * Measures the number of successful builds.
   *
   * Units: Count
   *
   * Valid CloudWatch statistics: Sum
   *
   * @default sum over 5 minutes
   */
  metricSucceededBuilds(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

  /**
   * Measures the number of builds that failed because of client error or
   * because of a timeout.
   *
   * Units: Count
   *
   * Valid CloudWatch statistics: Sum
   *
   * @default sum over 5 minutes
   */
  metricFailedBuilds(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
}

/**
 * Represents a reference to a CodeBuild Project.
 *
 * If you're managing the Project alongside the rest of your CDK resources,
 * use the {@link Project} class.
 *
 * If you want to reference an already existing Project
 * (or one defined in a different CDK Stack),
 * use the {@link import} method.
 */
abstract class ProjectBase extends Resource implements IProject {
  public abstract readonly grantPrincipal: iam.IPrincipal;

  /** The ARN of this Project. */
  public abstract readonly projectArn: string;

  /** The human-visible name of this Project. */
  public abstract readonly projectName: string;

  /** The IAM service Role of this Project. */
  public abstract readonly role?: iam.IRole;

  /**
   * Actual connections object for this Project.
   * May be unset, in which case this Project is not configured to use a VPC.
   * @internal
   */
  protected _connections: ec2.Connections | undefined;

  /**
   * Access the Connections object.
   * Will fail if this Project does not have a VPC set.
   */
  public get connections(): ec2.Connections {
    if (!this._connections) {
      throw new Error('Only VPC-associated Projects have security groups to manage. Supply the "vpc" parameter when creating the Project');
    }
    return this._connections;
  }

  public enableBatchBuilds(): BatchBuildConfig | undefined {
    return undefined;
  }

  /**
   * Add a permission only if there's a policy attached.
   * @param statement The permissions statement to add
   */
  public addToRolePolicy(statement: iam.PolicyStatement) {
    if (this.role) {
      this.role.addToPrincipalPolicy(statement);
    }
  }

  /**
   * Defines a CloudWatch event rule triggered when something happens with this project.
   *
   * @see https://docs.aws.amazon.com/codebuild/latest/userguide/sample-build-notifications.html
   */
  public onEvent(id: string, options: events.OnEventOptions = {}): events.Rule {
    const rule = new events.Rule(this, id, options);
    rule.addTarget(options.target);
    rule.addEventPattern({
      source: ['aws.codebuild'],
      detail: {
        'project-name': [this.projectName],
      },
    });
    return rule;
  }

  /**
   * Defines a CloudWatch event rule triggered when the build project state
   * changes. You can filter specific build status events using an event
   * pattern filter on the `build-status` detail field:
   *
   *    const rule = project.onStateChange('OnBuildStarted', { target });
   *    rule.addEventPattern({
   *      detail: {
   *        'build-status': [
   *          "IN_PROGRESS",
   *          "SUCCEEDED",
   *          "FAILED",
   *          "STOPPED"
   *        ]
   *      }
   *    });
   *
   * You can also use the methods `onBuildFailed` and `onBuildSucceeded` to define rules for
   * these specific state changes.
   *
   * To access fields from the event in the event target input,
   * use the static fields on the `StateChangeEvent` class.
   *
   * @see https://docs.aws.amazon.com/codebuild/latest/userguide/sample-build-notifications.html
   */
  public onStateChange(id: string, options: events.OnEventOptions = {}) {
    const rule = this.onEvent(id, options);
    rule.addEventPattern({
      detailType: ['CodeBuild Build State Change'],
    });
    return rule;
  }

  /**
   * Defines a CloudWatch event rule that triggers upon phase change of this
   * build project.
   *
   * @see https://docs.aws.amazon.com/codebuild/latest/userguide/sample-build-notifications.html
   */
  public onPhaseChange(id: string, options: events.OnEventOptions = {}) {
    const rule = this.onEvent(id, options);
    rule.addEventPattern({
      detailType: ['CodeBuild Build Phase Change'],
    });
    return rule;
  }

  /**
   * Defines an event rule which triggers when a build starts.
   *
   * To access fields from the event in the event target input,
   * use the static fields on the `StateChangeEvent` class.
   */
  public onBuildStarted(id: string, options: events.OnEventOptions = {}) {
    const rule = this.onStateChange(id, options);
    rule.addEventPattern({
      detail: {
        'build-status': ['IN_PROGRESS'],
      },
    });
    return rule;
  }

  /**
   * Defines an event rule which triggers when a build fails.
   *
   * To access fields from the event in the event target input,
   * use the static fields on the `StateChangeEvent` class.
   */
  public onBuildFailed(id: string, options: events.OnEventOptions = {}) {
    const rule = this.onStateChange(id, options);
    rule.addEventPattern({
      detail: {
        'build-status': ['FAILED'],
      },
    });
    return rule;
  }

  /**
   * Defines an event rule which triggers when a build completes successfully.
   *
   * To access fields from the event in the event target input,
   * use the static fields on the `StateChangeEvent` class.
   */
  public onBuildSucceeded(id: string, options: events.OnEventOptions = {}) {
    const rule = this.onStateChange(id, options);
    rule.addEventPattern({
      detail: {
        'build-status': ['SUCCEEDED'],
      },
    });
    return rule;
  }

  /**
   * @returns a CloudWatch metric associated with this build project.
   * @param metricName The name of the metric
   * @param props Customization properties
   */
  public metric(metricName: string, props?: cloudwatch.MetricOptions) {
    return new cloudwatch.Metric({
      namespace: 'AWS/CodeBuild',
      metricName,
      dimensions: { ProjectName: this.projectName },
      ...props,
    }).attachTo(this);
  }

  /**
   * Measures the number of builds triggered.
   *
   * Units: Count
   *
   * Valid CloudWatch statistics: Sum
   *
   * @default sum over 5 minutes
   */
  public metricBuilds(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.cannedMetric(CodeBuildMetrics.buildsSum, props);
  }

  /**
   * Measures the duration of all builds over time.
   *
   * Units: Seconds
   *
   * Valid CloudWatch statistics: Average (recommended), Maximum, Minimum
   *
   * @default average over 5 minutes
   */
  public metricDuration(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.cannedMetric(CodeBuildMetrics.durationAverage, props);
  }

  /**
   * Measures the number of successful builds.
   *
   * Units: Count
   *
   * Valid CloudWatch statistics: Sum
   *
   * @default sum over 5 minutes
   */
  public metricSucceededBuilds(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.cannedMetric(CodeBuildMetrics.succeededBuildsSum, props);
  }

  /**
   * Measures the number of builds that failed because of client error or
   * because of a timeout.
   *
   * Units: Count
   *
   * Valid CloudWatch statistics: Sum
   *
   * @default sum over 5 minutes
   */
  public metricFailedBuilds(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.cannedMetric(CodeBuildMetrics.failedBuildsSum, props);
  }

  private cannedMetric(
    fn: (dims: { ProjectName: string }) => cloudwatch.MetricProps,
    props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return new cloudwatch.Metric({
      ...fn({ ProjectName: this.projectName }),
      ...props,
    }).attachTo(this);
  }
}

export interface CommonProjectProps {
  /**
   * A description of the project. Use the description to identify the purpose
   * of the project.
   *
   * @default - No description.
   */
  readonly description?: string;

  /**
   * Filename or contents of buildspec in JSON format.
   * @see https://docs.aws.amazon.com/codebuild/latest/userguide/build-spec-ref.html#build-spec-ref-example
   *
   * @default - Empty buildspec.
   */
  readonly buildSpec?: BuildSpec;

  /**
   * Service Role to assume while running the build.
   *
   * @default - A role will be created.
   */
  readonly role?: iam.IRole;

  /**
   * Encryption key to use to read and write artifacts.
   *
   * @default - The AWS-managed CMK for Amazon Simple Storage Service (Amazon S3) is used.
   */
  readonly encryptionKey?: kms.IKey;

  /**
   * Caching strategy to use.
   *
   * @default Cache.none
   */
  readonly cache?: Cache;

  /**
   * Build environment to use for the build.
   *
   * @default BuildEnvironment.LinuxBuildImage.STANDARD_1_0
   */
  readonly environment?: BuildEnvironment;

  /**
   * Indicates whether AWS CodeBuild generates a publicly accessible URL for
   * your project's build badge. For more information, see Build Badges Sample
   * in the AWS CodeBuild User Guide.
   *
   * @default false
   */
  readonly badge?: boolean;

  /**
   * The number of minutes after which AWS CodeBuild stops the build if it's
   * not complete. For valid values, see the timeoutInMinutes field in the AWS
   * CodeBuild User Guide.
   *
   * @default Duration.hours(1)
   */
  readonly timeout?: Duration;

  /**
   * Additional environment variables to add to the build environment.
   *
   * @default - No additional environment variables are specified.
   */
  readonly environmentVariables?: { [name: string]: BuildEnvironmentVariable };

  /**
   * Whether to check for the presence of any secrets in the environment variables of the default type, BuildEnvironmentVariableType.PLAINTEXT.
   * Since using a secret for the value of that kind of variable would result in it being displayed in plain text in the AWS Console,
   * the construct will throw an exception if it detects a secret was passed there.
   * Pass this property as false if you want to skip this validation,
   * and keep using a secret in a plain text environment variable.
   *
   * @default true
   */
  readonly checkSecretsInPlainTextEnvVariables?: boolean;

  /**
   * The physical, human-readable name of the CodeBuild Project.
   *
   * @default - Name is automatically generated.
   */
  readonly projectName?: string;

  /**
   * VPC network to place codebuild network interfaces
   *
   * Specify this if the codebuild project needs to access resources in a VPC.
   *
   * @default - No VPC is specified.
   */
  readonly vpc?: ec2.IVpc;

  /**
   * Where to place the network interfaces within the VPC.
   *
   * Only used if 'vpc' is supplied.
   *
   * @default - All private subnets.
   */
  readonly subnetSelection?: ec2.SubnetSelection;

  /**
   * What security group to associate with the codebuild project's network interfaces.
   * If no security group is identified, one will be created automatically.
   *
   * Only used if 'vpc' is supplied.
   *
   * @default - Security group will be automatically created.
   *
   */
  readonly securityGroups?: ec2.ISecurityGroup[];

  /**
   * Whether to allow the CodeBuild to send all network traffic
   *
   * If set to false, you must individually add traffic rules to allow the
   * CodeBuild project to connect to network targets.
   *
   * Only used if 'vpc' is supplied.
   *
   * @default true
   */
  readonly allowAllOutbound?: boolean;

  /**
   * An  ProjectFileSystemLocation objects for a CodeBuild build project.
   *
   * A ProjectFileSystemLocation object specifies the identifier, location, mountOptions, mountPoint,
   * and type of a file system created using Amazon Elastic File System.
   *
   * @default - no file system locations
   */
  readonly fileSystemLocations?: IFileSystemLocation[];

  /**
   * Add permissions to this project's role to create and use test report groups with name starting with the name of this project.
   *
   * That is the standard report group that gets created when a simple name
   * (in contrast to an ARN)
   * is used in the 'reports' section of the buildspec of this project.
   * This is usually harmless, but you can turn these off if you don't plan on using test
   * reports in this project.
   *
   * @default true
   *
   * @see https://docs.aws.amazon.com/codebuild/latest/userguide/test-report-group-naming.html
   */
  readonly grantReportGroupPermissions?: boolean;

  /**
   * Information about logs for the build project. A project can create logs in Amazon CloudWatch Logs, an S3 bucket, or both.
   *
   * @default - no log configuration is set
   */
  readonly logging?: LoggingOptions;

  /**
   * The number of minutes after which AWS CodeBuild stops the build if it's
   * still in queue. For valid values, see the timeoutInMinutes field in the AWS
   * CodeBuild User Guide.
   *
   * @default - no queue timeout is set
   */
  readonly queuedTimeout?: Duration
}

export interface ProjectProps extends CommonProjectProps {
  /**
   * The source of the build.
   * *Note*: if {@link NoSource} is given as the source,
   * then you need to provide an explicit `buildSpec`.
   *
   * @default - NoSource
   */
  readonly source?: ISource;

  /**
   * Defines where build artifacts will be stored.
   * Could be: PipelineBuildArtifacts, NoArtifacts and S3Artifacts.
   *
   * @default NoArtifacts
   */
  readonly artifacts?: IArtifacts;

  /**
   * The secondary sources for the Project.
   * Can be also added after the Project has been created by using the {@link Project#addSecondarySource} method.
   *
   * @default - No secondary sources.
   * @see https://docs.aws.amazon.com/codebuild/latest/userguide/sample-multi-in-out.html
   */
  readonly secondarySources?: ISource[];

  /**
   * The secondary artifacts for the Project.
   * Can also be added after the Project has been created by using the {@link Project#addSecondaryArtifact} method.
   *
   * @default - No secondary artifacts.
   * @see https://docs.aws.amazon.com/codebuild/latest/userguide/sample-multi-in-out.html
   */
  readonly secondaryArtifacts?: IArtifacts[];
}

/**
 * The extra options passed to the {@link IProject.bindToCodePipeline} method.
 */
export interface BindToCodePipelineOptions {
  /**
   * The artifact bucket that will be used by the action that invokes this project.
   */
  readonly artifactBucket: s3.IBucket;
}

/**
 * A representation of a CodeBuild Project.
 */
export class Project extends ProjectBase {

  public static fromProjectArn(scope: Construct, id: string, projectArn: string): IProject {
    const parsedArn = Stack.of(scope).parseArn(projectArn);

    class Import extends ProjectBase {
      public readonly grantPrincipal: iam.IPrincipal;
      public readonly projectArn = projectArn;
      public readonly projectName = parsedArn.resourceName!;
      public readonly role?: iam.Role = undefined;

      constructor(s: Construct, i: string) {
        super(s, i, {
          account: parsedArn.account,
          region: parsedArn.region,
        });
        this.grantPrincipal = new iam.UnknownPrincipal({ resource: this });
      }
    }

    return new Import(scope, id);
  }

  /**
   * Import a Project defined either outside the CDK,
   * or in a different CDK Stack
   * (and exported using the {@link export} method).
   *
   * @note if you're importing a CodeBuild Project for use
   *   in a CodePipeline, make sure the existing Project
   *   has permissions to access the S3 Bucket of that Pipeline -
   *   otherwise, builds in that Pipeline will always fail.
   *
   * @param scope the parent Construct for this Construct
   * @param id the logical name of this Construct
   * @param projectName the name of the project to import
   * @returns a reference to the existing Project
   */
  public static fromProjectName(scope: Construct, id: string, projectName: string): IProject {
    class Import extends ProjectBase {
      public readonly grantPrincipal: iam.IPrincipal;
      public readonly projectArn: string;
      public readonly projectName: string;
      public readonly role?: iam.Role = undefined;

      constructor(s: Construct, i: string) {
        super(s, i);

        this.projectArn = Stack.of(this).formatArn({
          service: 'codebuild',
          resource: 'project',
          resourceName: projectName,
        });

        this.grantPrincipal = new iam.UnknownPrincipal({ resource: this });
        this.projectName = projectName;
      }
    }

    return new Import(scope, id);
  }

  /**
   * Convert the environment variables map of string to {@link BuildEnvironmentVariable},
   * which is the customer-facing type, to a list of {@link CfnProject.EnvironmentVariableProperty},
   * which is the representation of environment variables in CloudFormation.
   *
   * @param environmentVariables the map of string to environment variables
   * @param validateNoPlainTextSecrets whether to throw an exception
   *   if any of the plain text environment variables contain secrets, defaults to 'false'
   * @returns an array of {@link CfnProject.EnvironmentVariableProperty} instances
   */
  public static serializeEnvVariables(environmentVariables: { [name: string]: BuildEnvironmentVariable },
    validateNoPlainTextSecrets: boolean = false, principal?: iam.IGrantable): CfnProject.EnvironmentVariableProperty[] {

    const ret = new Array<CfnProject.EnvironmentVariableProperty>();
    const ssmIamResources = new Array<string>();
    const secretsManagerIamResources = new Array<string>();

    for (const [name, envVariable] of Object.entries(environmentVariables)) {
      const envVariableValue = envVariable.value?.toString();
      const cfnEnvVariable: CfnProject.EnvironmentVariableProperty = {
        name,
        type: envVariable.type || BuildEnvironmentVariableType.PLAINTEXT,
        value: envVariableValue,
      };
      ret.push(cfnEnvVariable);

      // validate that the plain-text environment variables don't contain any secrets in them
      if (validateNoPlainTextSecrets && cfnEnvVariable.type === BuildEnvironmentVariableType.PLAINTEXT) {
        const fragments = Tokenization.reverseString(cfnEnvVariable.value);
        for (const token of fragments.tokens) {
          if (token instanceof SecretValue) {
            throw new Error(`Plaintext environment variable '${name}' contains a secret value! ` +
              'This means the value of this variable will be visible in plain text in the AWS Console. ' +
              "Please consider using CodeBuild's SecretsManager environment variables feature instead. " +
              "If you'd like to continue with having this secret in the plaintext environment variables, " +
              'please set the checkSecretsInPlainTextEnvVariables property to false');
          }
        }
      }

      if (principal) {
        const stack = Stack.of(principal);

        // save the SSM env variables
        if (envVariable.type === BuildEnvironmentVariableType.PARAMETER_STORE) {
          ssmIamResources.push(stack.formatArn({
            service: 'ssm',
            resource: 'parameter',
            // If the parameter name starts with / the resource name is not separated with a double '/'
            // arn:aws:ssm:region:1111111111:parameter/PARAM_NAME
            resourceName: envVariableValue.startsWith('/')
              ? envVariableValue.substr(1)
              : envVariableValue,
          }));
        }

        // save SecretsManager env variables
        if (envVariable.type === BuildEnvironmentVariableType.SECRETS_MANAGER) {
          if (Token.isUnresolved(envVariableValue)) {
            // the value of the property can be a complex string, separated by ':';
            // see https://docs.aws.amazon.com/codebuild/latest/userguide/build-spec-ref.html#build-spec.env.secrets-manager
            const secretArn = envVariableValue.split(':')[0];

            // if we are passed a Token, we should assume it's the ARN of the Secret
            // (as the name would not work anyway, because it would be the full name, which CodeBuild does not support)
            secretsManagerIamResources.push(secretArn);
          } else {
            // check if the provided value is a full ARN of the Secret
            let parsedArn: ArnComponents | undefined;
            try {
              parsedArn = stack.parseArn(envVariableValue, ':');
            } catch (e) {}
            const secretSpecifier: string = parsedArn ? parsedArn.resourceName : envVariableValue;

            // the value of the property can be a complex string, separated by ':';
            // see https://docs.aws.amazon.com/codebuild/latest/userguide/build-spec-ref.html#build-spec.env.secrets-manager
            const secretName = secretSpecifier.split(':')[0];
            const secretIamResourceName = parsedArn
              // If we were given an ARN, we don't' know whether the name is full, or partial,
              // as CodeBuild supports both ARN forms.
              // Because of that, follow the name with a '*', which works for both
              ? `${secretName}*`
              // If we were given just a name, it must be partial, as CodeBuild doesn't support providing full names.
              // In this case, we need to accommodate for the generated suffix in the IAM resource name
              : `${secretName}-??????`;
            secretsManagerIamResources.push(Stack.of(principal).formatArn({
              service: 'secretsmanager',
              resource: 'secret',
              resourceName: secretIamResourceName,
              sep: ':',
              // if we were given an ARN, we need to use the provided partition/account/region
              partition: parsedArn?.partition,
              account: parsedArn?.account,
              region: parsedArn?.region,
            }));
          }
        }
      }
    }

    if (ssmIamResources.length !== 0) {
      principal?.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({
        actions: ['ssm:GetParameters'],
        resources: ssmIamResources,
      }));
    }
    if (secretsManagerIamResources.length !== 0) {
      principal?.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: secretsManagerIamResources,
      }));
    }

    return ret;
  }

  public readonly grantPrincipal: iam.IPrincipal;

  /**
   * The IAM role for this project.
   */
  public readonly role?: iam.IRole;

  /**
   * The ARN of the project.
   */
  public readonly projectArn: string;

  /**
   * The name of the project.
   */
  public readonly projectName: string;

  private readonly source: ISource;
  private readonly buildImage: IBuildImage;
  private readonly _secondarySources: CfnProject.SourceProperty[];
  private readonly _secondarySourceVersions: CfnProject.ProjectSourceVersionProperty[];
  private readonly _secondaryArtifacts: CfnProject.ArtifactsProperty[];
  private _encryptionKey?: kms.IKey;
  private readonly _fileSystemLocations: CfnProject.ProjectFileSystemLocationProperty[];
  private _batchServiceRole?: iam.Role;

  constructor(scope: Construct, id: string, props: ProjectProps) {
    super(scope, id, {
      physicalName: props.projectName,
    });

    this.role = props.role || new iam.Role(this, 'Role', {
      roleName: PhysicalName.GENERATE_IF_NEEDED,
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
    });
    this.grantPrincipal = this.role;

    this.buildImage = (props.environment && props.environment.buildImage) || LinuxBuildImage.STANDARD_1_0;

    // let source "bind" to the project. this usually involves granting permissions
    // for the code build role to interact with the source.
    this.source = props.source || new NoSource();
    const sourceConfig = this.source.bind(this, this);
    if (props.badge && !this.source.badgeSupported) {
      throw new Error(`Badge is not supported for source type ${this.source.type}`);
    }

    const artifacts = props.artifacts
      ? props.artifacts
      : (this.source.type === CODEPIPELINE_SOURCE_ARTIFACTS_TYPE
        ? new CodePipelineArtifacts()
        : new NoArtifacts());
    const artifactsConfig = artifacts.bind(this, this);

    const cache = props.cache || Cache.none();

    // give the caching strategy the option to grant permissions to any required resources
    cache._bind(this);

    // Inject download commands for asset if requested
    const environmentVariables = props.environmentVariables || {};
    const buildSpec = props.buildSpec;
    if (this.source.type === NO_SOURCE_TYPE && (buildSpec === undefined || !buildSpec.isImmediate)) {
      throw new Error("If the Project's source is NoSource, you need to provide a concrete buildSpec");
    }

    this._secondarySources = [];
    this._secondarySourceVersions = [];
    this._fileSystemLocations = [];
    for (const secondarySource of props.secondarySources || []) {
      this.addSecondarySource(secondarySource);
    }

    this._secondaryArtifacts = [];
    for (const secondaryArtifact of props.secondaryArtifacts || []) {
      this.addSecondaryArtifact(secondaryArtifact);
    }

    this.validateCodePipelineSettings(artifacts);

    for (const fileSystemLocation of props.fileSystemLocations || []) {
      this.addFileSystemLocation(fileSystemLocation);
    }

    const resource = new CfnProject(this, 'Resource', {
      description: props.description,
      source: {
        ...sourceConfig.sourceProperty,
        buildSpec: buildSpec && buildSpec.toBuildSpec(),
      },
      artifacts: artifactsConfig.artifactsProperty,
      serviceRole: this.role.roleArn,
      environment: this.renderEnvironment(props, environmentVariables),
      fileSystemLocations: Lazy.any({ produce: () => this.renderFileSystemLocations() }),
      // lazy, because we have a setter for it in setEncryptionKey
      // The 'alias/aws/s3' default is necessary because leaving the `encryptionKey` field
      // empty will not remove existing encryptionKeys during an update (ref. t/D17810523)
      encryptionKey: Lazy.string({ produce: () => this._encryptionKey ? this._encryptionKey.keyArn : 'alias/aws/s3' }),
      badgeEnabled: props.badge,
      cache: cache._toCloudFormation(),
      name: this.physicalName,
      timeoutInMinutes: props.timeout && props.timeout.toMinutes(),
      queuedTimeoutInMinutes: props.queuedTimeout && props.queuedTimeout.toMinutes(),
      secondarySources: Lazy.any({ produce: () => this.renderSecondarySources() }),
      secondarySourceVersions: Lazy.any({ produce: () => this.renderSecondarySourceVersions() }),
      secondaryArtifacts: Lazy.any({ produce: () => this.renderSecondaryArtifacts() }),
      triggers: sourceConfig.buildTriggers,
      sourceVersion: sourceConfig.sourceVersion,
      vpcConfig: this.configureVpc(props),
      logsConfig: this.renderLoggingConfiguration(props.logging),
      buildBatchConfig: Lazy.any({
        produce: () => {
          const config: CfnProject.ProjectBuildBatchConfigProperty | undefined = this._batchServiceRole ? {
            serviceRole: this._batchServiceRole.roleArn,
          } : undefined;
          return config;
        },
      }),
    });

    this.addVpcRequiredPermissions(props, resource);

    this.projectArn = this.getResourceArnAttribute(resource.attrArn, {
      service: 'codebuild',
      resource: 'project',
      resourceName: this.physicalName,
    });
    this.projectName = this.getResourceNameAttribute(resource.ref);

    this.addToRolePolicy(this.createLoggingPermission());
    // add permissions to create and use test report groups
    // with names starting with the project's name,
    // unless the customer explicitly opts out of it
    if (props.grantReportGroupPermissions !== false) {
      this.addToRolePolicy(new iam.PolicyStatement({
        actions: [
          'codebuild:CreateReportGroup',
          'codebuild:CreateReport',
          'codebuild:UpdateReport',
          'codebuild:BatchPutTestCases',
          'codebuild:BatchPutCodeCoverages',
        ],
        resources: [renderReportGroupArn(this, `${this.projectName}-*`)],
      }));
    }

    if (props.encryptionKey) {
      this.encryptionKey = props.encryptionKey;
    }

    // bind
    const bindFunction = (this.buildImage as any).bind;
    if (bindFunction) {
      bindFunction.call(this.buildImage, this, this, {});
    }
  }

  public enableBatchBuilds(): BatchBuildConfig | undefined {
    if (!this._batchServiceRole) {
      this._batchServiceRole = new iam.Role(this, 'BatchServiceRole', {
        assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      });
      this._batchServiceRole.addToPrincipalPolicy(new iam.PolicyStatement({
        resources: [Lazy.string({
          produce: () => this.projectArn,
        })],
        actions: [
          'codebuild:StartBuild',
          'codebuild:StopBuild',
          'codebuild:RetryBuild',
        ],
      }));
    }
    return {
      role: this._batchServiceRole,
    };
  }

  /**
   * Adds a secondary source to the Project.
   *
   * @param secondarySource the source to add as a secondary source
   * @see https://docs.aws.amazon.com/codebuild/latest/userguide/sample-multi-in-out.html
   */
  public addSecondarySource(secondarySource: ISource): void {
    if (!secondarySource.identifier) {
      throw new Error('The identifier attribute is mandatory for secondary sources');
    }
    const secondarySourceConfig = secondarySource.bind(this, this);
    this._secondarySources.push(secondarySourceConfig.sourceProperty);
    if (secondarySourceConfig.sourceVersion) {
      this._secondarySourceVersions.push({
        sourceIdentifier: secondarySource.identifier,
        sourceVersion: secondarySourceConfig.sourceVersion,
      });
    }
  }

  /**
   * Adds a fileSystemLocation to the Project.
   *
   * @param fileSystemLocation the fileSystemLocation to add
   */
  public addFileSystemLocation(fileSystemLocation: IFileSystemLocation): void {
    const fileSystemConfig = fileSystemLocation.bind(this, this);
    this._fileSystemLocations.push(fileSystemConfig.location);
  }

  /**
   * Adds a secondary artifact to the Project.
   *
   * @param secondaryArtifact the artifact to add as a secondary artifact
   * @see https://docs.aws.amazon.com/codebuild/latest/userguide/sample-multi-in-out.html
   */
  public addSecondaryArtifact(secondaryArtifact: IArtifacts): void {
    if (!secondaryArtifact.identifier) {
      throw new Error('The identifier attribute is mandatory for secondary artifacts');
    }
    this._secondaryArtifacts.push(secondaryArtifact.bind(this, this).artifactsProperty);
  }

  /**
   * A callback invoked when the given project is added to a CodePipeline.
   *
   * @param _scope the construct the binding is taking place in
   * @param options additional options for the binding
   */
  public bindToCodePipeline(_scope: CoreConstruct, options: BindToCodePipelineOptions): void {
    // work around a bug in CodeBuild: it ignores the KMS key set on the pipeline,
    // and always uses its own, project-level key
    if (options.artifactBucket.encryptionKey && !this._encryptionKey) {
      // we cannot safely do this assignment if the key is of type kms.Key,
      // and belongs to a stack in a different account or region than the project
      // (that would cause an illegal reference, as KMS keys don't have physical names)
      const keyStack = Stack.of(options.artifactBucket.encryptionKey);
      const projectStack = Stack.of(this);
      if (!(options.artifactBucket.encryptionKey instanceof kms.Key &&
          (keyStack.account !== projectStack.account || keyStack.region !== projectStack.region))) {
        this.encryptionKey = options.artifactBucket.encryptionKey;
      }
    }
  }

  /**
   * @override
   */
  protected validate(): string[] {
    const ret = new Array<string>();
    if (this.source.type === CODEPIPELINE_SOURCE_ARTIFACTS_TYPE) {
      if (this._secondarySources.length > 0) {
        ret.push('A Project with a CodePipeline Source cannot have secondary sources. ' +
          "Use the CodeBuild Pipeline Actions' `extraInputs` property instead");
      }
      if (this._secondaryArtifacts.length > 0) {
        ret.push('A Project with a CodePipeline Source cannot have secondary artifacts. ' +
          "Use the CodeBuild Pipeline Actions' `outputs` property instead");
      }
    }
    return ret;
  }

  private set encryptionKey(encryptionKey: kms.IKey) {
    this._encryptionKey = encryptionKey;
    encryptionKey.grantEncryptDecrypt(this);
  }

  private createLoggingPermission() {
    const logGroupArn = Stack.of(this).formatArn({
      service: 'logs',
      resource: 'log-group',
      sep: ':',
      resourceName: `/aws/codebuild/${this.projectName}`,
    });

    const logGroupStarArn = `${logGroupArn}:*`;

    return new iam.PolicyStatement({
      resources: [logGroupArn, logGroupStarArn],
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
    });
  }

  private renderEnvironment(
    props: ProjectProps,
    projectVars: { [name: string]: BuildEnvironmentVariable } = {}): CfnProject.EnvironmentProperty {

    const env = props.environment ?? {};
    const vars: { [name: string]: BuildEnvironmentVariable } = {};
    const containerVars = env.environmentVariables || {};

    // first apply environment variables from the container definition
    for (const name of Object.keys(containerVars)) {
      vars[name] = containerVars[name];
    }

    // now apply project-level vars
    for (const name of Object.keys(projectVars)) {
      vars[name] = projectVars[name];
    }

    const hasEnvironmentVars = Object.keys(vars).length > 0;

    const errors = this.buildImage.validate(env);
    if (errors.length > 0) {
      throw new Error('Invalid CodeBuild environment: ' + errors.join('\n'));
    }

    const imagePullPrincipalType = this.buildImage.imagePullPrincipalType === ImagePullPrincipalType.CODEBUILD
      ? ImagePullPrincipalType.CODEBUILD
      : ImagePullPrincipalType.SERVICE_ROLE;
    if (this.buildImage.repository) {
      if (imagePullPrincipalType === ImagePullPrincipalType.SERVICE_ROLE) {
        this.buildImage.repository.grantPull(this);
      } else {
        const statement = new iam.PolicyStatement({
          principals: [new iam.ServicePrincipal('codebuild.amazonaws.com')],
          actions: ['ecr:GetDownloadUrlForLayer', 'ecr:BatchGetImage', 'ecr:BatchCheckLayerAvailability'],
        });
        statement.sid = 'CodeBuild';
        this.buildImage.repository.addToResourcePolicy(statement);
      }
    }
    if (imagePullPrincipalType === ImagePullPrincipalType.SERVICE_ROLE) {
      this.buildImage.secretsManagerCredentials?.grantRead(this);
    }

    const secret = this.buildImage.secretsManagerCredentials;
    return {
      type: this.buildImage.type,
      image: this.buildImage.imageId,
      imagePullCredentialsType: imagePullPrincipalType,
      registryCredential: secret
        ? {
          credentialProvider: 'SECRETS_MANAGER',
          // Secrets must be referenced by either the full ARN (with SecretsManager suffix), or by name.
          // "Partial" ARNs (without the suffix) will fail a validation regex at deploy-time.
          credential: secret.secretFullArn ?? secret.secretName,
        }
        : undefined,
      privilegedMode: env.privileged || false,
      computeType: env.computeType || this.buildImage.defaultComputeType,
      environmentVariables: hasEnvironmentVars
        ? Project.serializeEnvVariables(vars, props.checkSecretsInPlainTextEnvVariables ?? true, this)
        : undefined,
    };
  }

  private renderFileSystemLocations(): CfnProject.ProjectFileSystemLocationProperty[] | undefined {
    return this._fileSystemLocations.length === 0
      ? undefined
      : this._fileSystemLocations;
  }

  private renderSecondarySources(): CfnProject.SourceProperty[] | undefined {
    return this._secondarySources.length === 0
      ? undefined
      : this._secondarySources;
  }

  private renderSecondarySourceVersions(): CfnProject.ProjectSourceVersionProperty[] | undefined {
    return this._secondarySourceVersions.length === 0
      ? undefined
      : this._secondarySourceVersions;
  }

  private renderSecondaryArtifacts(): CfnProject.ArtifactsProperty[] | undefined {
    return this._secondaryArtifacts.length === 0
      ? undefined
      : this._secondaryArtifacts;
  }

  /**
   * If configured, set up the VPC-related properties
   *
   * Returns the VpcConfig that should be added to the
   * codebuild creation properties.
   */
  private configureVpc(props: ProjectProps): CfnProject.VpcConfigProperty | undefined {
    if ((props.securityGroups || props.allowAllOutbound !== undefined) && !props.vpc) {
      throw new Error('Cannot configure \'securityGroup\' or \'allowAllOutbound\' without configuring a VPC');
    }

    if (!props.vpc) { return undefined; }

    if ((props.securityGroups && props.securityGroups.length > 0) && props.allowAllOutbound !== undefined) {
      throw new Error('Configure \'allowAllOutbound\' directly on the supplied SecurityGroup.');
    }

    let securityGroups: ec2.ISecurityGroup[];
    if (props.securityGroups && props.securityGroups.length > 0) {
      securityGroups = props.securityGroups;
    } else {
      const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
        vpc: props.vpc,
        description: 'Automatic generated security group for CodeBuild ' + Names.uniqueId(this),
        allowAllOutbound: props.allowAllOutbound,
      });
      securityGroups = [securityGroup];
    }
    this._connections = new ec2.Connections({ securityGroups });

    return {
      vpcId: props.vpc.vpcId,
      subnets: props.vpc.selectSubnets(props.subnetSelection).subnetIds,
      securityGroupIds: this.connections.securityGroups.map(s => s.securityGroupId),
    };
  }

  private renderLoggingConfiguration(props: LoggingOptions | undefined): CfnProject.LogsConfigProperty | undefined {
    if (props === undefined) {
      return undefined;
    }

    let s3Config: CfnProject.S3LogsConfigProperty | undefined = undefined;
    let cloudwatchConfig: CfnProject.CloudWatchLogsConfigProperty | undefined = undefined;

    if (props.s3) {
      const s3Logs = props.s3;
      s3Config = {
        status: (s3Logs.enabled ?? true) ? 'ENABLED' : 'DISABLED',
        location: `${s3Logs.bucket.bucketName}` + (s3Logs.prefix ? `/${s3Logs.prefix}` : ''),
        encryptionDisabled: s3Logs.encrypted,
      };
      s3Logs.bucket?.grantWrite(this);
    }

    if (props.cloudWatch) {
      const cloudWatchLogs = props.cloudWatch;
      const status = (cloudWatchLogs.enabled ?? true) ? 'ENABLED' : 'DISABLED';

      if (status === 'ENABLED' && !(cloudWatchLogs.logGroup)) {
        throw new Error('Specifying a LogGroup is required if CloudWatch logging for CodeBuild is enabled');
      }
      cloudWatchLogs.logGroup?.grantWrite(this);

      cloudwatchConfig = {
        status,
        groupName: cloudWatchLogs.logGroup?.logGroupName,
        streamName: cloudWatchLogs.prefix,
      };
    }

    return {
      s3Logs: s3Config,
      cloudWatchLogs: cloudwatchConfig,
    };
  }

  private addVpcRequiredPermissions(props: ProjectProps, project: CfnProject): void {
    if (!props.vpc || !this.role) {
      return;
    }

    this.role.addToPrincipalPolicy(new iam.PolicyStatement({
      resources: [`arn:${Aws.PARTITION}:ec2:${Aws.REGION}:${Aws.ACCOUNT_ID}:network-interface/*`],
      actions: ['ec2:CreateNetworkInterfacePermission'],
      conditions: {
        StringEquals: {
          'ec2:Subnet': props.vpc
            .selectSubnets(props.subnetSelection).subnetIds
            .map(si => `arn:${Aws.PARTITION}:ec2:${Aws.REGION}:${Aws.ACCOUNT_ID}:subnet/${si}`),
          'ec2:AuthorizedService': 'codebuild.amazonaws.com',
        },
      },
    }));

    const policy = new iam.Policy(this, 'PolicyDocument', {
      statements: [
        new iam.PolicyStatement({
          resources: ['*'],
          actions: [
            'ec2:CreateNetworkInterface',
            'ec2:DescribeNetworkInterfaces',
            'ec2:DeleteNetworkInterface',
            'ec2:DescribeSubnets',
            'ec2:DescribeSecurityGroups',
            'ec2:DescribeDhcpOptions',
            'ec2:DescribeVpcs',
          ],
        }),
      ],
    });
    this.role.attachInlinePolicy(policy);

    // add an explicit dependency between the EC2 Policy and this Project -
    // otherwise, creating the Project fails, as it requires these permissions
    // to be already attached to the Project's Role
    project.node.addDependency(policy);
  }

  private validateCodePipelineSettings(artifacts: IArtifacts) {
    const sourceType = this.source.type;
    const artifactsType = artifacts.type;

    if ((sourceType === CODEPIPELINE_SOURCE_ARTIFACTS_TYPE ||
        artifactsType === CODEPIPELINE_SOURCE_ARTIFACTS_TYPE) &&
        (sourceType !== artifactsType)) {
      throw new Error('Both source and artifacts must be set to CodePipeline');
    }
  }
}

/**
 * Build machine compute type.
 */
export enum ComputeType {
  SMALL = 'BUILD_GENERAL1_SMALL',
  MEDIUM = 'BUILD_GENERAL1_MEDIUM',
  LARGE = 'BUILD_GENERAL1_LARGE',
  X2_LARGE = 'BUILD_GENERAL1_2XLARGE'
}

/**
 * The type of principal CodeBuild will use to pull your build Docker image.
 */
export enum ImagePullPrincipalType {
  /**
   * CODEBUILD specifies that CodeBuild uses its own identity when pulling the image.
   * This means the resource policy of the ECR repository that hosts the image will be modified to trust
   * CodeBuild's service principal.
   * This is the required principal type when using CodeBuild's pre-defined images.
   */
  CODEBUILD = 'CODEBUILD',

  /**
   * SERVICE_ROLE specifies that AWS CodeBuild uses the project's role when pulling the image.
   * The role will be granted pull permissions on the ECR repository hosting the image.
   */
  SERVICE_ROLE = 'SERVICE_ROLE'
}

export interface BuildEnvironment {
  /**
   * The image used for the builds.
   *
   * @default LinuxBuildImage.STANDARD_1_0
   */
  readonly buildImage?: IBuildImage;

  /**
   * The type of compute to use for this build.
   * See the {@link ComputeType} enum for the possible values.
   *
   * @default taken from {@link #buildImage#defaultComputeType}
   */
  readonly computeType?: ComputeType;

  /**
   * Indicates how the project builds Docker images. Specify true to enable
   * running the Docker daemon inside a Docker container. This value must be
   * set to true only if this build project will be used to build Docker
   * images, and the specified build environment image is not one provided by
   * AWS CodeBuild with Docker support. Otherwise, all associated builds that
   * attempt to interact with the Docker daemon will fail.
   *
   * @default false
   */
  readonly privileged?: boolean;

  /**
   * The environment variables that your builds can use.
   */
  readonly environmentVariables?: { [name: string]: BuildEnvironmentVariable };
}

/**
 * Represents a Docker image used for the CodeBuild Project builds.
 * Use the concrete subclasses, either:
 * {@link LinuxBuildImage} or {@link WindowsBuildImage}.
 */
export interface IBuildImage {
  /**
   * The type of build environment.
   */
  readonly type: string;

  /**
   * The Docker image identifier that the build environment uses.
   *
   * @see https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-available.html
   */
  readonly imageId: string;

  /**
   * The default {@link ComputeType} to use with this image,
   * if one was not specified in {@link BuildEnvironment#computeType} explicitly.
   */
  readonly defaultComputeType: ComputeType;

  /**
   * The type of principal that CodeBuild will use to pull this build Docker image.
   *
   * @default ImagePullPrincipalType.SERVICE_ROLE
   */
  readonly imagePullPrincipalType?: ImagePullPrincipalType;

  /**
   * The secretsManagerCredentials for access to a private registry.
   *
   * @default no credentials will be used
   */
  readonly secretsManagerCredentials?: secretsmanager.ISecret;

  /**
   * An optional ECR repository that the image is hosted in.
   *
   * @default no repository
   */
  readonly repository?: ecr.IRepository;

  /**
   * Allows the image a chance to validate whether the passed configuration is correct.
   *
   * @param buildEnvironment the current build environment
   */
  validate(buildEnvironment: BuildEnvironment): string[];

  /**
   * Make a buildspec to run the indicated script
   */
  runScriptBuildspec(entrypoint: string): BuildSpec;
}

/** Optional arguments to {@link IBuildImage.binder} - currently empty. */
export interface BuildImageBindOptions { }

/** The return type from {@link IBuildImage.binder} - currently empty. */
export interface BuildImageConfig { }

// @deprecated(not in tsdoc on purpose): add bind() to IBuildImage
// and get rid of IBindableBuildImage

/** A variant of {@link IBuildImage} that allows binding to the project. */
export interface IBindableBuildImage extends IBuildImage {
  /** Function that allows the build image access to the construct tree. */
  bind(scope: CoreConstruct, project: IProject, options: BuildImageBindOptions): BuildImageConfig;
}

class ArmBuildImage implements IBuildImage {
  public readonly type = 'ARM_CONTAINER';
  public readonly defaultComputeType = ComputeType.LARGE;
  public readonly imagePullPrincipalType = ImagePullPrincipalType.CODEBUILD;
  public readonly imageId: string;

  constructor(imageId: string) {
    this.imageId = imageId;
  }

  public validate(buildEnvironment: BuildEnvironment): string[] {
    const ret = [];
    if (buildEnvironment.computeType &&
        buildEnvironment.computeType !== ComputeType.LARGE) {
      ret.push(`ARM images only support ComputeType '${ComputeType.LARGE}' - ` +
        `'${buildEnvironment.computeType}' was given`);
    }
    return ret;
  }

  public runScriptBuildspec(entrypoint: string): BuildSpec {
    return runScriptLinuxBuildSpec(entrypoint);
  }
}

/**
 * The options when creating a CodeBuild Docker build image
 * using {@link LinuxBuildImage.fromDockerRegistry}
 * or {@link WindowsBuildImage.fromDockerRegistry}.
 */
export interface DockerImageOptions {
  /**
   * The credentials, stored in Secrets Manager,
   * used for accessing the repository holding the image,
   * if the repository is private.
   *
   * @default no credentials will be used (we assume the repository is public)
   */
  readonly secretsManagerCredentials?: secretsmanager.ISecret;
}

/**
 * Construction properties of {@link LinuxBuildImage}.
 * Module-private, as the constructor of {@link LinuxBuildImage} is private.
 */
interface LinuxBuildImageProps {
  readonly imageId: string;
  readonly imagePullPrincipalType?: ImagePullPrincipalType;
  readonly secretsManagerCredentials?: secretsmanager.ISecret;
  readonly repository?: ecr.IRepository;
}

/**
 * A CodeBuild image running Linux.
 *
 * This class has a bunch of public constants that represent the most popular images.
 *
 * You can also specify a custom image using one of the static methods:
 *
 * - LinuxBuildImage.fromDockerRegistry(image[, { secretsManagerCredentials }])
 * - LinuxBuildImage.fromEcrRepository(repo[, tag])
 * - LinuxBuildImage.fromAsset(parent, id, props)
 *
 *
 * @see https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-available.html
 */
export class LinuxBuildImage implements IBuildImage {
  public static readonly STANDARD_1_0 = LinuxBuildImage.codeBuildImage('aws/codebuild/standard:1.0');
  public static readonly STANDARD_2_0 = LinuxBuildImage.codeBuildImage('aws/codebuild/standard:2.0');
  public static readonly STANDARD_3_0 = LinuxBuildImage.codeBuildImage('aws/codebuild/standard:3.0');
  /** The `aws/codebuild/standard:4.0` build image. */
  public static readonly STANDARD_4_0 = LinuxBuildImage.codeBuildImage('aws/codebuild/standard:4.0');
  /** The `aws/codebuild/standard:5.0` build image. */
  public static readonly STANDARD_5_0 = LinuxBuildImage.codeBuildImage('aws/codebuild/standard:5.0');

  public static readonly AMAZON_LINUX_2 = LinuxBuildImage.codeBuildImage('aws/codebuild/amazonlinux2-x86_64-standard:1.0');
  public static readonly AMAZON_LINUX_2_2 = LinuxBuildImage.codeBuildImage('aws/codebuild/amazonlinux2-x86_64-standard:2.0');
  /** The Amazon Linux 2 x86_64 standard image, version `3.0`. */
  public static readonly AMAZON_LINUX_2_3 = LinuxBuildImage.codeBuildImage('aws/codebuild/amazonlinux2-x86_64-standard:3.0');

  public static readonly AMAZON_LINUX_2_ARM: IBuildImage = new ArmBuildImage('aws/codebuild/amazonlinux2-aarch64-standard:1.0');

  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_BASE = LinuxBuildImage.codeBuildImage('aws/codebuild/ubuntu-base:14.04');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_ANDROID_JAVA8_24_4_1 = LinuxBuildImage.codeBuildImage('aws/codebuild/android-java-8:24.4.1');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_ANDROID_JAVA8_26_1_1 = LinuxBuildImage.codeBuildImage('aws/codebuild/android-java-8:26.1.1');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_DOCKER_17_09_0 = LinuxBuildImage.codeBuildImage('aws/codebuild/docker:17.09.0');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_DOCKER_18_09_0 = LinuxBuildImage.codeBuildImage('aws/codebuild/docker:18.09.0');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_GOLANG_1_10 = LinuxBuildImage.codeBuildImage('aws/codebuild/golang:1.10');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_GOLANG_1_11 = LinuxBuildImage.codeBuildImage('aws/codebuild/golang:1.11');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_OPEN_JDK_8 = LinuxBuildImage.codeBuildImage('aws/codebuild/java:openjdk-8');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_OPEN_JDK_9 = LinuxBuildImage.codeBuildImage('aws/codebuild/java:openjdk-9');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_OPEN_JDK_11 = LinuxBuildImage.codeBuildImage('aws/codebuild/java:openjdk-11');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_NODEJS_10_14_1 = LinuxBuildImage.codeBuildImage('aws/codebuild/nodejs:10.14.1');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_NODEJS_10_1_0 = LinuxBuildImage.codeBuildImage('aws/codebuild/nodejs:10.1.0');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_NODEJS_8_11_0 = LinuxBuildImage.codeBuildImage('aws/codebuild/nodejs:8.11.0');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_NODEJS_6_3_1 = LinuxBuildImage.codeBuildImage('aws/codebuild/nodejs:6.3.1');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_PHP_5_6 = LinuxBuildImage.codeBuildImage('aws/codebuild/php:5.6');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_PHP_7_0 = LinuxBuildImage.codeBuildImage('aws/codebuild/php:7.0');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_PHP_7_1 = LinuxBuildImage.codeBuildImage('aws/codebuild/php:7.1');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_PYTHON_3_7_1 = LinuxBuildImage.codeBuildImage('aws/codebuild/python:3.7.1');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_PYTHON_3_6_5 = LinuxBuildImage.codeBuildImage('aws/codebuild/python:3.6.5');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_PYTHON_3_5_2 = LinuxBuildImage.codeBuildImage('aws/codebuild/python:3.5.2');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_PYTHON_3_4_5 = LinuxBuildImage.codeBuildImage('aws/codebuild/python:3.4.5');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_PYTHON_3_3_6 = LinuxBuildImage.codeBuildImage('aws/codebuild/python:3.3.6');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_PYTHON_2_7_12 = LinuxBuildImage.codeBuildImage('aws/codebuild/python:2.7.12');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_RUBY_2_5_3 = LinuxBuildImage.codeBuildImage('aws/codebuild/ruby:2.5.3');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_RUBY_2_5_1 = LinuxBuildImage.codeBuildImage('aws/codebuild/ruby:2.5.1');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_RUBY_2_3_1 = LinuxBuildImage.codeBuildImage('aws/codebuild/ruby:2.3.1');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_RUBY_2_2_5 = LinuxBuildImage.codeBuildImage('aws/codebuild/ruby:2.2.5');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_DOTNET_CORE_1_1 = LinuxBuildImage.codeBuildImage('aws/codebuild/dot-net:core-1');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_DOTNET_CORE_2_0 = LinuxBuildImage.codeBuildImage('aws/codebuild/dot-net:core-2.0');
  /** @deprecated Use {@link STANDARD_2_0} and specify runtime in buildspec runtime-versions section */
  public static readonly UBUNTU_14_04_DOTNET_CORE_2_1 = LinuxBuildImage.codeBuildImage('aws/codebuild/dot-net:core-2.1');

  /**
   * @returns a Linux build image from a Docker Hub image.
   */
  public static fromDockerRegistry(name: string, options: DockerImageOptions = {}): IBuildImage {
    return new LinuxBuildImage({
      ...options,
      imageId: name,
      imagePullPrincipalType: ImagePullPrincipalType.SERVICE_ROLE,
    });
  }

  /**
   * @returns A Linux build image from an ECR repository.
   *
   * NOTE: if the repository is external (i.e. imported), then we won't be able to add
   * a resource policy statement for it so CodeBuild can pull the image.
   *
   * @see https://docs.aws.amazon.com/codebuild/latest/userguide/sample-ecr.html
   *
   * @param repository The ECR repository
   * @param tag Image tag (default "latest")
   */
  public static fromEcrRepository(repository: ecr.IRepository, tag: string = 'latest'): IBuildImage {
    return new LinuxBuildImage({
      imageId: repository.repositoryUriForTag(tag),
      imagePullPrincipalType: ImagePullPrincipalType.SERVICE_ROLE,
      repository,
    });
  }

  /**
   * Uses an Docker image asset as a Linux build image.
   */
  public static fromAsset(scope: Construct, id: string, props: DockerImageAssetProps): IBuildImage {
    const asset = new DockerImageAsset(scope, id, props);
    return new LinuxBuildImage({
      imageId: asset.imageUri,
      imagePullPrincipalType: ImagePullPrincipalType.SERVICE_ROLE,
      repository: asset.repository,
    });
  }

  /**
   * Uses a Docker image provided by CodeBuild.
   *
   * @returns A Docker image provided by CodeBuild.
   *
   * @see https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-available.html
   *
   * @param id The image identifier
   * @example 'aws/codebuild/standard:4.0'
   */
  public static fromCodeBuildImageId(id: string): IBuildImage {
    return LinuxBuildImage.codeBuildImage(id);
  }

  private static codeBuildImage(name: string): IBuildImage {
    return new LinuxBuildImage({
      imageId: name,
      imagePullPrincipalType: ImagePullPrincipalType.CODEBUILD,
    });
  }

  public readonly type = 'LINUX_CONTAINER';
  public readonly defaultComputeType = ComputeType.SMALL;
  public readonly imageId: string;
  public readonly imagePullPrincipalType?: ImagePullPrincipalType;
  public readonly secretsManagerCredentials?: secretsmanager.ISecret;
  public readonly repository?: ecr.IRepository;

  private constructor(props: LinuxBuildImageProps) {
    this.imageId = props.imageId;
    this.imagePullPrincipalType = props.imagePullPrincipalType;
    this.secretsManagerCredentials = props.secretsManagerCredentials;
    this.repository = props.repository;
  }

  public validate(_: BuildEnvironment): string[] {
    return [];
  }

  public runScriptBuildspec(entrypoint: string): BuildSpec {
    return runScriptLinuxBuildSpec(entrypoint);
  }
}

/**
 * Environment type for Windows Docker images
 */
export enum WindowsImageType {
  /**
   * The standard environment type, WINDOWS_CONTAINER
   */
  STANDARD = 'WINDOWS_CONTAINER',

  /**
   * The WINDOWS_SERVER_2019_CONTAINER environment type
   */
  SERVER_2019 = 'WINDOWS_SERVER_2019_CONTAINER'
}

/**
 * Construction properties of {@link WindowsBuildImage}.
 * Module-private, as the constructor of {@link WindowsBuildImage} is private.
 */
interface WindowsBuildImageProps {
  readonly imageId: string;
  readonly imagePullPrincipalType?: ImagePullPrincipalType;
  readonly secretsManagerCredentials?: secretsmanager.ISecret;
  readonly repository?: ecr.IRepository;
  readonly imageType?: WindowsImageType;
}

/**
 * A CodeBuild image running Windows.
 *
 * This class has a bunch of public constants that represent the most popular images.
 *
 * You can also specify a custom image using one of the static methods:
 *
 * - WindowsBuildImage.fromDockerRegistry(image[, { secretsManagerCredentials }, imageType])
 * - WindowsBuildImage.fromEcrRepository(repo[, tag, imageType])
 * - WindowsBuildImage.fromAsset(parent, id, props, [, imageType])
 *
 * @see https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-available.html
 */
export class WindowsBuildImage implements IBuildImage {
  /**
   * Corresponds to the standard CodeBuild image `aws/codebuild/windows-base:1.0`.
   *
   * @deprecated `WindowsBuildImage.WINDOWS_BASE_2_0` should be used instead.
   */
  public static readonly WIN_SERVER_CORE_2016_BASE: IBuildImage = new WindowsBuildImage({
    imageId: 'aws/codebuild/windows-base:1.0',
    imagePullPrincipalType: ImagePullPrincipalType.CODEBUILD,
  });

  /**
   * The standard CodeBuild image `aws/codebuild/windows-base:2.0`, which is
   * based off Windows Server Core 2016.
   */
  public static readonly WINDOWS_BASE_2_0: IBuildImage = new WindowsBuildImage({
    imageId: 'aws/codebuild/windows-base:2.0',
    imagePullPrincipalType: ImagePullPrincipalType.CODEBUILD,
  });

  /**
   * The standard CodeBuild image `aws/codebuild/windows-base:2019-1.0`, which is
   * based off Windows Server Core 2019.
   */
  public static readonly WIN_SERVER_CORE_2019_BASE: IBuildImage = new WindowsBuildImage({
    imageId: 'aws/codebuild/windows-base:2019-1.0',
    imagePullPrincipalType: ImagePullPrincipalType.CODEBUILD,
    imageType: WindowsImageType.SERVER_2019,
  });

  /**
   * @returns a Windows build image from a Docker Hub image.
   */
  public static fromDockerRegistry(
    name: string,
    options: DockerImageOptions = {},
    imageType: WindowsImageType = WindowsImageType.STANDARD): IBuildImage {

    return new WindowsBuildImage({
      ...options,
      imageId: name,
      imagePullPrincipalType: ImagePullPrincipalType.SERVICE_ROLE,
      imageType,
    });
  }

  /**
   * @returns A Linux build image from an ECR repository.
   *
   * NOTE: if the repository is external (i.e. imported), then we won't be able to add
   * a resource policy statement for it so CodeBuild can pull the image.
   *
   * @see https://docs.aws.amazon.com/codebuild/latest/userguide/sample-ecr.html
   *
   * @param repository The ECR repository
   * @param tag Image tag (default "latest")
   */
  public static fromEcrRepository(
    repository: ecr.IRepository,
    tag: string = 'latest',
    imageType: WindowsImageType = WindowsImageType.STANDARD): IBuildImage {

    return new WindowsBuildImage({
      imageId: repository.repositoryUriForTag(tag),
      imagePullPrincipalType: ImagePullPrincipalType.SERVICE_ROLE,
      imageType,
      repository,
    });
  }

  /**
   * Uses an Docker image asset as a Windows build image.
   */
  public static fromAsset(
    scope: Construct,
    id: string,
    props: DockerImageAssetProps,
    imageType: WindowsImageType = WindowsImageType.STANDARD): IBuildImage {

    const asset = new DockerImageAsset(scope, id, props);
    return new WindowsBuildImage({
      imageId: asset.imageUri,
      imagePullPrincipalType: ImagePullPrincipalType.SERVICE_ROLE,
      imageType,
      repository: asset.repository,
    });
  }

  public readonly type: string;
  public readonly defaultComputeType = ComputeType.MEDIUM;
  public readonly imageId: string;
  public readonly imagePullPrincipalType?: ImagePullPrincipalType;
  public readonly secretsManagerCredentials?: secretsmanager.ISecret;
  public readonly repository?: ecr.IRepository;

  private constructor(props: WindowsBuildImageProps) {
    this.type = (props.imageType ?? WindowsImageType.STANDARD).toString();
    this.imageId = props.imageId;
    this.imagePullPrincipalType = props.imagePullPrincipalType;
    this.secretsManagerCredentials = props.secretsManagerCredentials;
    this.repository = props.repository;
  }

  public validate(buildEnvironment: BuildEnvironment): string[] {
    const ret: string[] = [];
    if (buildEnvironment.computeType === ComputeType.SMALL) {
      ret.push('Windows images do not support the Small ComputeType');
    }
    return ret;
  }

  public runScriptBuildspec(entrypoint: string): BuildSpec {
    return BuildSpec.fromObject({
      version: '0.2',
      phases: {
        pre_build: {
          // Would love to do downloading here and executing in the next step,
          // but I don't know how to propagate the value of $TEMPDIR.
          //
          // Punting for someone who knows PowerShell well enough.
          commands: [],
        },
        build: {
          commands: [
            'Set-Variable -Name TEMPDIR -Value (New-TemporaryFile).DirectoryName',
            `aws s3 cp s3://$env:${S3_BUCKET_ENV}/$env:${S3_KEY_ENV} $TEMPDIR\\scripts.zip`,
            'New-Item -ItemType Directory -Path $TEMPDIR\\scriptdir',
            'Expand-Archive -Path $TEMPDIR/scripts.zip -DestinationPath $TEMPDIR\\scriptdir',
            '$env:SCRIPT_DIR = "$TEMPDIR\\scriptdir"',
            `& $TEMPDIR\\scriptdir\\${entrypoint}`,
          ],
        },
      },
    });
  }
}

export interface BuildEnvironmentVariable {
  /**
   * The type of environment variable.
   * @default PlainText
   */
  readonly type?: BuildEnvironmentVariableType;

  /**
   * The value of the environment variable.
   * For plain-text variables (the default), this is the literal value of variable.
   * For SSM parameter variables, pass the name of the parameter here (`parameterName` property of `IParameter`).
   * For SecretsManager variables secrets, pass either the secret name (`secretName` property of `ISecret`)
   * or the secret ARN (`secretArn` property of `ISecret`) here,
   * along with optional SecretsManager qualifiers separated by ':', like the JSON key, or the version or stage
   * (see https://docs.aws.amazon.com/codebuild/latest/userguide/build-spec-ref.html#build-spec.env.secrets-manager for details).
   */
  readonly value: any;
}

export enum BuildEnvironmentVariableType {
  /**
   * An environment variable in plaintext format.
   */
  PLAINTEXT = 'PLAINTEXT',

  /**
   * An environment variable stored in Systems Manager Parameter Store.
   */
  PARAMETER_STORE = 'PARAMETER_STORE',

  /**
   * An environment variable stored in AWS Secrets Manager.
   */
  SECRETS_MANAGER = 'SECRETS_MANAGER'
}
