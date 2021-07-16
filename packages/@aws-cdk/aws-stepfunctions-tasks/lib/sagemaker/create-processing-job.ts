import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Duration, Lazy, Size, Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { integrationResourceArn, validatePatternSupported } from '../private/task-utils';
import {
  AppSpecification,
  DatasetDefinition,
  ExperimentConfig,
  NetworkConfig,
  ProcessingInput,
  ProcessingOutputConfig,
  ProcessingResources,
  StoppingCondition,
} from './base-types';

/**
 * Properties for creating an Amazon SageMaker processing job
 */
export interface SageMakerCreateProcessingJobProps extends sfn.TaskStateBaseProps {
  /**
   * Role for the Processing Job. The role must be granted all necessary permissions for the SageMaker processing job to
   * be able to operate.
   *
   * See https://docs.aws.amazon.com/sagemaker/latest/dg/sagemaker-roles.html#sagemaker-roles-createprocessingjob-perms
   *
   * @default - a role with appropriate permissions will be created.
   */
  readonly role?: iam.IRole;

  /**
   * Configures the processing job to run a specified Docker container image.
   */
  readonly appSpecification: AppSpecification;

  /**
   * Sets the environment variables in the Docker container.
   *
   * @default - No environment variables
   */
  readonly environment?: sfn.TaskInput;

  /**
   * Associates a SageMaker job as a trial component with an experiment and trial. Specified when you call the
   * following APIs: CreateProcessingJob, CreateTrainingJob, CreateTransformJob
   *
   * @default - No experiment configuration
   */
  readonly experimentConfig?: ExperimentConfig;

  /**
   * Networking options for a processing job.
   *
   * @default - No network configuration
   */
  readonly networkConfig?: NetworkConfig;

  /**
   * For each input, data is downloaded from S3 into the processing container before the processing job begins running
   * if 'S3InputMode' is set to File.
   *
   * @default - No processing inputs
   */
  readonly processingInputs?: ProcessingInput[];

  /**
   * The name of the processing job. The name must be unique within an AWS Region in the AWS account.
   */
  readonly processingJobName: string;

  /**
   * Output configuration for the processing job.
   *
   * @default - No processing output configuration
   */
  readonly processingOutputConfig?: ProcessingOutputConfig;

  /**
   * Identifies the resources, ML compute instances, and ML storage volumes to deploy for a processing job.
   * In distributed training, you specify more than one instance.
   *
   * @default - 1 instance of EC2 `M4.XLarge` with `10GB` volume
   */
  readonly processingResources?: ProcessingResources;

  /**
   * The time limit for how long the processing job is allowed to run.
   *
   * @default - max runtime of 1 hour
   */
  readonly stoppingCondition?: StoppingCondition;

  /**
   * (Optional) An array of key-value pairs. For more information, see Using Cost Allocation Tags in the AWS Billing and Cost
   * Management User Guide: https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/cost-alloc-tags.html#allocation-whatURL
   *
   * @default - No tags
   */
  readonly tags?: sfn.TaskInput;
}

/**
 * Class representing the SageMaker Create Processing Job task.
 */
export class SageMakerCreateProcessingJob extends sfn.TaskStateBase implements iam.IGrantable, ec2.IConnectable {
  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] = [
    sfn.IntegrationPattern.REQUEST_RESPONSE,
    sfn.IntegrationPattern.RUN_JOB,
  ];

  /**
   * Allows specify security group connections for instances of this fleet.
   */
  public readonly connections: ec2.Connections = new ec2.Connections();

  protected readonly taskPolicies?: iam.PolicyStatement[];
  protected readonly taskMetrics?: sfn.TaskMetricsConfig;

  /**
   * The processing resources for the task.
   */
  private readonly processingResources: ProcessingResources;
  /**
   * The stopping condition for the task
   */
  private readonly stoppingCondition: StoppingCondition;

  private readonly vpc?: ec2.IVpc;
  private securityGroup?: ec2.ISecurityGroup;
  private readonly securityGroups: ec2.ISecurityGroup[] = [];
  private readonly subnets?: string[];
  private readonly integrationPattern: sfn.IntegrationPattern;
  private _role?: iam.IRole;
  private _grantPrincipal?: iam.IPrincipal;

  constructor(
    scope: Construct,
    id: string,
    private readonly props: SageMakerCreateProcessingJobProps) {
    super(scope, id, props);
    this.integrationPattern = props.integrationPattern || sfn.IntegrationPattern.REQUEST_RESPONSE;
    validatePatternSupported(this.integrationPattern, SageMakerCreateProcessingJob.SUPPORTED_INTEGRATION_PATTERNS);

    // set the default processing resources if not defined.
    this.processingResources = props.processingResources || {
      clusterConfig: {
        instanceCount: 1,
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.M4, ec2.InstanceSize.XLARGE),
        volumeSize: Size.gibibytes(10),
      },
    };

    // set the stopping condition if not defined
    this.stoppingCondition = props.stoppingCondition || {
      maxRuntime: Duration.hours(1),
    };

    // check that either algorithm name or image is defined
    if (!props.appSpecification.imageUri && !props.appSpecification.containerImage) {
      throw new Error('Must define either an image URI or container image in the application specification');
    }

    if (props.appSpecification.imageUri && props.appSpecification.containerImage) {
      throw new Error('Cannot define both an image URI and container image in the application specification');
    }

    props.processingInputs?.forEach(input => {
      if (input.s3Input && input.datasetDefinition || (!input.s3Input && !input.datasetDefinition)) {
        throw new Error('ProcessingInput must contain one of either S3Input or DatasetDefinition');
      }

      const athenaDefinition = input.datasetDefinition?.athenaDatasetDefinition;
      const redshiftDefinition = input.datasetDefinition?.athenaDatasetDefinition;
      if (!input.s3Input && ((athenaDefinition && redshiftDefinition) || (!athenaDefinition && !redshiftDefinition))) {
        throw new Error('DatasetDefinition must contain one of either AthenaDatasetDefinition or RedshiftDatasetDefinition');
      }
    });

    // add the security groups to the connections object
    if (props.networkConfig && props.networkConfig.vpcConfig) {
      this.vpc = props.networkConfig.vpcConfig.vpc;
      this.subnets = (props.networkConfig.vpcConfig.subnets) ?
        (this.vpc.selectSubnets(props.networkConfig.vpcConfig.subnets).subnetIds) : this.vpc.selectSubnets().subnetIds;
    }

    this.taskPolicies = this.makePolicyStatements();
  }

  /**
   * The execution role for the SageMaker processing job.
   *
   * Only available after task has been added to a state machine.
   */
  public get role(): iam.IRole {
    if (this._role === undefined) {
      throw new Error('role not available yet--use the object in a Task first');
    }
    return this._role;
  }

  public get grantPrincipal(): iam.IPrincipal {
    if (this._grantPrincipal === undefined) {
      throw new Error('Principal not available yet--use the object in a Task first');
    }
    return this._grantPrincipal;
  }

  /**
   * Add the security group to all instances via the launch configuration security groups array.
   *
   * @param securityGroup: The security group to add
   */
  public addSecurityGroup(securityGroup: ec2.ISecurityGroup): void {
    this.securityGroups.push(securityGroup);
  }

  /**
   * @internal
   */
  protected _renderTask(): any {
    return {
      Resource: integrationResourceArn('sagemaker', 'createProcessingJob', this.integrationPattern),
      Parameters: sfn.FieldUtils.renderObject(this.renderParameters()),
    };
  }

  private renderParameters(): { [key: string]: any } {
    return {
      ...this.renderAppSpecification(this.props.appSpecification),
      Environment: this.props.environment?.value,
      ...this.renderExperimentConfig(this.props.experimentConfig),
      ...this.renderNetworkConfig(this.props.networkConfig),
      ...this.renderProcessingInputs(this.props.processingInputs),
      ProcessingJobName: this.props.processingJobName,
      ...this.renderProcessingOutputConfig(this.props.processingOutputConfig),
      ...this.renderProcessingResources(this.processingResources),
      RoleArn: this._role!.roleArn,
      ...this.renderStoppingCondition(this.stoppingCondition),
      Tags: this.props.tags?.value,
    };
  }

  private renderAppSpecification(spec: AppSpecification): { [key: string]: any } {
    return {
      AppSpecification: {
        ...(spec.containerArguments) ? { ContainerArguments: spec.containerArguments } : {},
        ...(spec.containerEntrypoint) ? { ContainerEntrypoint: spec.containerEntrypoint } : {},
        ImageUri: spec.imageUri || spec.containerImage!.bind(this).imageUri,
      },
    };
  }

  private renderProcessingResources(config: ProcessingResources): { [key: string]: any } {
    return {
      ProcessingResources: {
        ClusterConfig: {
          InstanceCount: config.clusterConfig.instanceCount,
          InstanceType: 'ml.' + config.clusterConfig.instanceType,
          VolumeSizeInGB: config.clusterConfig.volumeSize?.toGibibytes(),
          ...(config.clusterConfig.volumeEncryptionKey) ?
            { VolumeKmsKeyId: config.clusterConfig.volumeEncryptionKey.keyArn } : {},
        },
      },
    };
  }

  private renderStoppingCondition(config: StoppingCondition): { [key: string]: any } {
    return {
      StoppingCondition: {
        MaxRuntimeInSeconds: config.maxRuntime && config.maxRuntime.toSeconds(),
      },
    };
  }

  private renderNetworkConfig(config: NetworkConfig | undefined): { [key: string]: any } {
    return (config) ? {
      NetworkConfig: {
        ...(config.enableInterContainerTrafficEncryption) ? {
          EnableInterContainerTrafficEncryption: config.enableInterContainerTrafficEncryption,
        } : {},
        ...(config.enableNetworkIsolation) ? {
          EnableNetworkIsolation: config.enableNetworkIsolation,
        } : {},
        ...(config.vpcConfig) ? {
          VpcConfig: {
            SecurityGroupIds: Lazy.listValue({ produce: () => (this.securityGroups.map(sg => (sg.securityGroupId))) }),
            Subnets: this.subnets,
          },
        } : {},
      },
    } : {};
  }

  private renderProcessingInputs(config: ProcessingInput[] | undefined): { [key: string]: any } {
    return (config) ? {
      ProcessingInputs: config.map(input => {
        return {
          AppManaged: input.appManaged,
          InputName: input.inputName,
          ...(input.datasetDefinition) ? {
            DatasetDefinition: {
              ...this.renderAthenaDatasetDefinition(input.datasetDefinition),
              ...(input.datasetDefinition.dataDistributionType) ? {
                DataDistributionType: input.datasetDefinition.dataDistributionType,
              } : {},
              ...(input.datasetDefinition.inputMode) ? { InputMode: input.datasetDefinition.inputMode } : {},
              ...(input.datasetDefinition.localPath) ? { LocalPath: input.datasetDefinition.localPath } : {},
              ...this.renderRedshiftDatasetDefinition(input.datasetDefinition),
            },
          } : {},
          S3Input: {
            LocalPath: input.s3Input?.localPath,
            ...(input.s3Input?.s3CompressionType) ? { S3CompressionType: input.s3Input.s3CompressionType } : {},
            ...(input.s3Input?.s3DataDistributionType) ? { S3DataDistributionType: input.s3Input.s3DataDistributionType } : {},
            S3DataType: input.s3Input?.s3DataType,
            S3InputMode: input.s3Input?.s3InputMode,
            S3Uri: input.s3Input?.s3Uri,
          },
        };
      }),
    } : {};
  }

  private renderAthenaDatasetDefinition(datasetDefinition: DatasetDefinition | undefined): { [key: string]: any } {
    const athenaDatasetDefinition = datasetDefinition?.athenaDatasetDefinition;
    return (athenaDatasetDefinition) ? {
      DatasetDefinition: {
        ...(athenaDatasetDefinition) ? {
          AthenaDatasetDefinition: {
            Catalog: athenaDatasetDefinition.catalog,
            Database: athenaDatasetDefinition.database,
            ...(athenaDatasetDefinition.encryptionKey) ? {
              KmsKeyId: athenaDatasetDefinition.encryptionKey.keyId,
            } : {},
            ...(athenaDatasetDefinition.outputCompression) ? {
              OutputCompression: athenaDatasetDefinition.outputCompression,
            } : {},
            OutputFormat: athenaDatasetDefinition.outputFormat,
            OutputS3Uri: athenaDatasetDefinition.outputS3Uri,
            QueryString: athenaDatasetDefinition.queryString,
            ...(athenaDatasetDefinition.workGroup) ? {
              WorkGroup: athenaDatasetDefinition.workGroup,
            } : {},
          },
        } : {},
      },
    } : {};
  }

  private renderRedshiftDatasetDefinition(datasetDefinition: DatasetDefinition | undefined): { [key: string]: any } {
    const redshiftDatasetDefinition = datasetDefinition?.redshiftDatasetDefinition;
    return (redshiftDatasetDefinition) ? {
      RedshiftDatasetDefinition: {
        ClusterId: redshiftDatasetDefinition.clusterId,
        ClusterRoleArn: redshiftDatasetDefinition.clusterRoleArn,
        Database: redshiftDatasetDefinition.database,
        DbUser: redshiftDatasetDefinition.dbUser,
        ...(redshiftDatasetDefinition.encryptionKey) ? {
          KmsKeyId: redshiftDatasetDefinition.encryptionKey.keyId,
        } : {},
        ...(redshiftDatasetDefinition.outputCompression) ? {
          OutputCompression: redshiftDatasetDefinition.outputCompression,
        } : {},
        OutputFormat: redshiftDatasetDefinition.outputFormat,
        OutputS3Uri: redshiftDatasetDefinition.outputS3Uri,
        QueryString: redshiftDatasetDefinition.queryString,
      },
    } : {};
  }

  private renderProcessingOutputConfig(config: ProcessingOutputConfig | undefined): { [key: string]: any } {
    return (config) ? {
      ProcessingOutputConfig: {
        ...(config.encryptionKey) ? { KmsKeyId: config.encryptionKey.keyId } : {},
        Outputs: config.outputs.map(output => {
          return {
            OutputName: output.outputName,
            AppManaged: output.appManaged,
            ...(output.featureStoreOutput) ? {
              FeatureStoreOutput: { FeatureGroupName: output.featureStoreOutput.featureGroupName },
            } : {},
            S3Output: {
              LocalPath: output.s3Output.localPath,
              S3UploadMode: output.s3Output.s3UploadMode,
              S3Uri: output.s3Output.s3Uri,
            },
          };
        }),
      },
    } : {};
  }

  private renderExperimentConfig(config: ExperimentConfig | undefined): { [key: string]: any } {
    return (config) ? {
      ExperimentConfig: {
        ...(config.experimentName) ? { ExperimentName: config.experimentName } : {},
        ...(config.trialComponentDisplayName) ? { TrialComponentDisplayName: config.trialComponentDisplayName } : {},
        ...(config.trialName) ? { TrialName: config.trialName } : {},
      },
    } : {};
  }

  private makePolicyStatements(): iam.PolicyStatement[] {
    // Set the SageMaker role or create new one
    this._grantPrincipal = this._role =
      this.props.role ||
      new iam.Role(this, 'SagemakerRole', {
        assumedBy: new iam.ServicePrincipal('sagemaker.amazonaws.com'),
        inlinePolicies: {
          CreateProcessingJob: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                actions: [
                  'ecr:BatchCheckLayerAvailability',
                  'ecr:BatchGetImage',
                  'ecr:Describe*',
                  'ecr:GetAuthorizationToken',
                  'ecr:GetDownloadUrlForLayer',
                  'ecr:StartImageScan',
                ],
                resources: ['*'],
              }),
              new iam.PolicyStatement({
                actions: [
                  'cloudwatch:PutMetricData',
                  'logs:CreateLogStream',
                  'logs:PutLogEvents',
                  'logs:CreateLogGroup',
                  'logs:DescribeLogStreams',
                  'ecr:GetAuthorizationToken',
                  ...(this.props.networkConfig?.vpcConfig
                    ? [
                      'ec2:CreateNetworkInterface',
                      'ec2:CreateNetworkInterfacePermission',
                      'ec2:DeleteNetworkInterface',
                      'ec2:DeleteNetworkInterfacePermission',
                      'ec2:DescribeNetworkInterfaces',
                      'ec2:DescribeVpcs',
                      'ec2:DescribeDhcpOptions',
                      'ec2:DescribeSubnets',
                      'ec2:DescribeSecurityGroups',
                    ]
                    : []),
                ],
                resources: ['*'], // Those permissions cannot be resource-scoped
              }),
            ],
          }),
        },
      });

    if (this.props.processingResources && this.props.processingResources.clusterConfig &&
      this.props.processingResources.clusterConfig.volumeEncryptionKey) {
      this.props.processingResources.clusterConfig.volumeEncryptionKey.grant(this._role, 'kms:CreateGrant');
    }

    // create a security group if not defined
    if (this.vpc && this.securityGroup === undefined) {
      this.securityGroup = new ec2.SecurityGroup(this, 'ProcessJobSecurityGroup', {
        vpc: this.vpc,
      });
      this.connections.addSecurityGroup(this.securityGroup);
      this.securityGroups.push(this.securityGroup);
    }

    const stack = Stack.of(this);

    // https://docs.aws.amazon.com/step-functions/latest/dg/sagemaker-iam.html
    const policyStatements = [
      new iam.PolicyStatement({
        actions: ['sagemaker:CreateProcessingJob', 'sagemaker:DescribeProcessingJob', 'sagemaker:StopProcessingJob'],
        resources: [
          stack.formatArn({
            service: 'sagemaker',
            resource: 'processing-job',
            // If the job name comes from input, we cannot target the policy to a particular ARN prefix reliably...
            resourceName: sfn.JsonPath.isEncodedJsonPath(this.props.processingJobName) ? '*' : `${this.props.processingJobName}*`,
          }),
        ],
      }),
      new iam.PolicyStatement({
        actions: ['sagemaker:ListTags'],
        resources: ['*'],
      }),
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [this._role!.roleArn],
        conditions: {
          StringEquals: { 'iam:PassedToService': 'sagemaker.amazonaws.com' },
        },
      }),
    ];

    if (this.integrationPattern === sfn.IntegrationPattern.RUN_JOB) {
      policyStatements.push(
        new iam.PolicyStatement({
          actions: ['events:PutTargets', 'events:PutRule', 'events:DescribeRule'],
          resources: [
            stack.formatArn({
              service: 'events',
              resource: 'rule',
              resourceName: 'StepFunctionsGetEventsForSageMakerProcessingJobsRule',
            }),
          ],
        }),
      );
    }

    return policyStatements;
  }
}
