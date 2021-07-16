import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { Construct } from 'constructs';
import { integrationResourceArn, validatePatternSupported } from '../private/task-utils';
import {
  ApplicationConfigPropertyToJson,
  BootstrapActionConfigToJson,
  ConfigurationPropertyToJson,
  InstancesConfigPropertyToJson,
  KerberosAttributesPropertyToJson,
} from './private/cluster-utils';

/**
 * Properties for EmrCreateCluster
 *
 * See the RunJobFlow API for complete documentation on input parameters
 *
 * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_RunJobFlow.html
 *
 */
export interface EmrCreateClusterProps extends sfn.TaskStateBaseProps {
  /**
   * A specification of the number and type of Amazon EC2 instances.
   */
  readonly instances: EmrCreateCluster.InstancesConfigProperty;

  /**
   * Also called instance profile and EC2 role. An IAM role for an EMR cluster. The EC2 instances of the cluster assume this role.
   *
   * This attribute has been renamed from jobFlowRole to clusterRole to align with other ERM/StepFunction integration parameters.
   *
   * @default - * A Role will be created
   */
  readonly clusterRole?: iam.IRole;

  /**
   * The Name of the Cluster
   */
  readonly name: string;

  /**
   * The IAM role that will be assumed by the Amazon EMR service to access AWS resources on your behalf.
   *
   * @default - A role will be created that Amazon EMR service can assume.
   */
  readonly serviceRole?: iam.IRole;

  /**
   * A JSON string for selecting additional features.
   *
   * @default - None
   */
  readonly additionalInfo?: string;

  /**
   * A case-insensitive list of applications for Amazon EMR to install and configure when launching the cluster.
   *
   * @default - EMR selected default
   */
  readonly applications?: EmrCreateCluster.ApplicationConfigProperty[];

  /**
   * An IAM role for automatic scaling policies.
   *
   * @default - A role will be created.
   */
  readonly autoScalingRole?: iam.IRole;

  /**
   * A list of bootstrap actions to run before Hadoop starts on the cluster nodes.
   *
   * @default - None
   */
  readonly bootstrapActions?: EmrCreateCluster.BootstrapActionConfigProperty[];

  /**
   * The list of configurations supplied for the EMR cluster you are creating.
   *
   * @default - None
   */
  readonly configurations?: EmrCreateCluster.ConfigurationProperty[];

  /**
   * The ID of a custom Amazon EBS-backed Linux AMI.
   *
   * @default - None
   */
  readonly customAmiId?: string;

  /**
   * The size of the EBS root device volume of the Linux AMI that is used for each EC2 instance.
   *
   * @default - EMR selected default
   */
  readonly ebsRootVolumeSize?: cdk.Size;

  /**
   * Attributes for Kerberos configuration when Kerberos authentication is enabled using a security configuration.
   *
   * @default - None
   */
  readonly kerberosAttributes?: EmrCreateCluster.KerberosAttributesProperty;

  /**
   * The location in Amazon S3 to write the log files of the job flow.
   *
   * @default - None
   */
  readonly logUri?: string;

  /**
   * The Amazon EMR release label, which determines the version of open-source application packages installed on the cluster.
   *
   * @default - EMR selected default
   */
  readonly releaseLabel?: string;

  /**
   * Specifies the way that individual Amazon EC2 instances terminate when an automatic scale-in activity occurs or an instance group is resized.
   *
   * @default - EMR selected default
   */
  readonly scaleDownBehavior?: EmrCreateCluster.EmrClusterScaleDownBehavior;

  /**
   * The name of a security configuration to apply to the cluster.
   *
   * @default - None
   */
  readonly securityConfiguration?: string;

  /**
   * A list of tags to associate with a cluster and propagate to Amazon EC2 instances.
   *
   * @default - None
   */
  readonly tags?: { [key: string]: string };

  /**
   * A value of true indicates that all IAM users in the AWS account can perform cluster actions if they have the proper IAM policy permissions.
   *
   * @default true
   */
  readonly visibleToAllUsers?: boolean;
}

/**
 * A Step Functions Task to create an EMR Cluster.
 *
 * The ClusterConfiguration is defined as Parameters in the state machine definition.
 *
 * OUTPUT: the ClusterId.
 *
 */
export class EmrCreateCluster extends sfn.TaskStateBase {
  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] = [
    sfn.IntegrationPattern.REQUEST_RESPONSE,
    sfn.IntegrationPattern.RUN_JOB,
  ];

  protected readonly taskPolicies?: iam.PolicyStatement[];
  protected readonly taskMetrics?: sfn.TaskMetricsConfig;

  private readonly visibleToAllUsers: boolean;
  private readonly integrationPattern: sfn.IntegrationPattern;

  private _serviceRole: iam.IRole;
  private _clusterRole: iam.IRole;
  private _autoScalingRole?: iam.IRole;

  constructor(scope: Construct, id: string, private readonly props: EmrCreateClusterProps) {
    super(scope, id, props);
    this.visibleToAllUsers = this.props.visibleToAllUsers ?? true;
    this.integrationPattern = props.integrationPattern || sfn.IntegrationPattern.RUN_JOB;
    validatePatternSupported(this.integrationPattern, EmrCreateCluster.SUPPORTED_INTEGRATION_PATTERNS);

    this._autoScalingRole = this.props.autoScalingRole;

    // If the Roles are undefined then they weren't provided, so create them
    this._serviceRole = this.props.serviceRole ?? this.createServiceRole();
    this._clusterRole = this.props.clusterRole ?? this.createClusterRole();

    // AutoScaling roles are not valid with InstanceFleet clusters.
    // Attempt to create only if .instances.instanceFleets is undefined or empty
    if (this.props.instances.instanceFleets === undefined || this.props.instances.instanceFleets.length === 0) {
      this._autoScalingRole = this._autoScalingRole || this.createAutoScalingRole();
      // If InstanceFleets are used and an AutoScaling Role is specified, throw an error
    } else if (this._autoScalingRole !== undefined) {
      throw new Error('Auto Scaling roles can not be specified with instance fleets.');
    }

    this.taskPolicies = this.createPolicyStatements(this._serviceRole, this._clusterRole, this._autoScalingRole);
  }

  /**
   * The service role for the EMR Cluster.
   *
   * Only available after task has been added to a state machine.
   */
  public get serviceRole(): iam.IRole {
    if (this._serviceRole === undefined) {
      throw new Error('role not available yet--use the object in a Task first');
    }
    return this._serviceRole;
  }

  /**
   * The instance role for the EMR Cluster.
   *
   * Only available after task has been added to a state machine.
   */
  public get clusterRole(): iam.IRole {
    if (this._clusterRole === undefined) {
      throw new Error('role not available yet--use the object in a Task first');
    }
    return this._clusterRole;
  }

  /**
   * The autoscaling role for the EMR Cluster.
   *
   * Only available after task has been added to a state machine.
   */
  public get autoScalingRole(): iam.IRole {
    if (this._autoScalingRole === undefined) {
      throw new Error('role not available yet--use the object in a Task first');
    }
    return this._autoScalingRole;
  }

  /**
   * @internal
   */
  protected _renderTask(): any {
    return {
      Resource: integrationResourceArn('elasticmapreduce', 'createCluster', this.integrationPattern),
      Parameters: sfn.FieldUtils.renderObject({
        Instances: InstancesConfigPropertyToJson(this.props.instances),
        JobFlowRole: cdk.stringToCloudFormation(this._clusterRole.roleName),
        Name: cdk.stringToCloudFormation(this.props.name),
        ServiceRole: cdk.stringToCloudFormation(this._serviceRole.roleName),
        AdditionalInfo: cdk.stringToCloudFormation(this.props.additionalInfo),
        Applications: cdk.listMapper(ApplicationConfigPropertyToJson)(this.props.applications),
        AutoScalingRole: cdk.stringToCloudFormation(this._autoScalingRole?.roleName),
        BootstrapActions: cdk.listMapper(BootstrapActionConfigToJson)(this.props.bootstrapActions),
        Configurations: cdk.listMapper(ConfigurationPropertyToJson)(this.props.configurations),
        CustomAmiId: cdk.stringToCloudFormation(this.props.customAmiId),
        EbsRootVolumeSize: this.props.ebsRootVolumeSize?.toGibibytes(),
        KerberosAttributes: this.props.kerberosAttributes ? KerberosAttributesPropertyToJson(this.props.kerberosAttributes) : undefined,
        LogUri: cdk.stringToCloudFormation(this.props.logUri),
        ReleaseLabel: cdk.stringToCloudFormation(this.props.releaseLabel),
        ScaleDownBehavior: cdk.stringToCloudFormation(this.props.scaleDownBehavior?.valueOf()),
        SecurityConfiguration: cdk.stringToCloudFormation(this.props.securityConfiguration),
        ...(this.props.tags ? this.renderTags(this.props.tags) : undefined),
        VisibleToAllUsers: cdk.booleanToCloudFormation(this.visibleToAllUsers),
      }),
    };
  }

  private renderTags(tags: { [key: string]: any } | undefined): { [key: string]: any } {
    return tags ? { Tags: Object.keys(tags).map((key) => ({ Key: key, Value: tags[key] })) } : {};
  }

  /**
   * This generates the PolicyStatements required by the Task to call CreateCluster.
   */
  private createPolicyStatements(serviceRole: iam.IRole, clusterRole: iam.IRole, autoScalingRole?: iam.IRole): iam.PolicyStatement[] {
    const stack = cdk.Stack.of(this);

    const policyStatements = [
      new iam.PolicyStatement({
        actions: ['elasticmapreduce:RunJobFlow', 'elasticmapreduce:DescribeCluster', 'elasticmapreduce:TerminateJobFlows'],
        resources: ['*'],
      }),
    ];

    // Allow the StateMachine to PassRole to Cluster roles
    policyStatements.push(
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [serviceRole.roleArn, clusterRole.roleArn],
      }),
    );
    if (autoScalingRole !== undefined) {
      policyStatements.push(
        new iam.PolicyStatement({
          actions: ['iam:PassRole'],
          resources: [autoScalingRole.roleArn],
        }),
      );
    }

    if (this.integrationPattern === sfn.IntegrationPattern.RUN_JOB) {
      policyStatements.push(
        new iam.PolicyStatement({
          actions: ['events:PutTargets', 'events:PutRule', 'events:DescribeRule'],
          resources: [
            stack.formatArn({
              service: 'events',
              resource: 'rule',
              resourceName: 'StepFunctionsGetEventForEMRRunJobFlowRule',
            }),
          ],
        }),
      );
    }

    return policyStatements;
  }

  /**
   * Generate the Role used by the EMR Service
   */
  private createServiceRole(): iam.IRole {
    return new iam.Role(this, 'ServiceRole', {
      assumedBy: new iam.ServicePrincipal('elasticmapreduce.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonElasticMapReduceRole')],
    });
  }

  /**
   * Generate the Role and Instance Profile used by the EC2 instances
   *
   * Data access permissions will need to be updated by the user
   */
  private createClusterRole(): iam.IRole {
    const role = new iam.Role(this, 'InstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    new iam.CfnInstanceProfile(this, 'InstanceProfile', {
      roles: [role.roleName],
      instanceProfileName: role.roleName,
    });

    return role;
  }

  /**
   * Generate the Role used to AutoScale the Cluster
   */
  private createAutoScalingRole(): iam.IRole {
    const role = new iam.Role(this, 'AutoScalingRole', {
      assumedBy: new iam.ServicePrincipal('elasticmapreduce.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonElasticMapReduceforAutoScalingRole')],
    });

    role.assumeRolePolicy?.addStatements(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('application-autoscaling.amazonaws.com')],
        actions: ['sts:AssumeRole'],
      }),
    );

    return role;
  }
}

export namespace EmrCreateCluster {
  /**
   * The Cluster ScaleDownBehavior specifies the way that individual Amazon EC2 instances terminate when an automatic scale-in activity
   * occurs or an instance group is resized.
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_RunJobFlow.html#EMR-RunJobFlow-request-ScaleDownBehavior
   */
  export enum EmrClusterScaleDownBehavior {
    /**
     * Indicates that Amazon EMR terminates nodes at the instance-hour boundary, regardless of when the request to terminate the instance was
     * submitted. This option is only available with Amazon EMR 5.1.0 and later and is the default for clusters created using that version
     */
    TERMINATE_AT_INSTANCE_HOUR = 'TERMINATE_AT_INSTANCE_HOUR',

    /**
     * Indicates that Amazon EMR adds nodes to a deny list and drains tasks from nodes before terminating the Amazon EC2 instances, regardless of the
     * instance-hour boundary.
     */
    TERMINATE_AT_TASK_COMPLETION = 'TERMINATE_AT_TASK_COMPLETION',
  }

  /**
   * Instance Role Types
   *
   */
  export enum InstanceRoleType {
    /**
     * Master Node
     */
    MASTER = 'MASTER',
    /**
     * Core Node
     */
    CORE = 'CORE',
    /**
     * Task Node
     */
    TASK = 'TASK',
  }

  /**
   * EBS Volume Types
   *
   */
  export enum EbsBlockDeviceVolumeType {
    /**
     * gp2 Volume Type
     */
    GP2 = 'gp2',
    /**
     * io1 Volume Type
     */
    IO1 = 'io1',
    /**
     * Standard Volume Type
     */
    STANDARD = 'standard',
  }

  /**
   * EBS volume specifications such as volume type, IOPS, and size (GiB) that will be requested for the EBS volume attached
   * to an EC2 instance in the cluster.
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_VolumeSpecification.html
   *
   */
  export interface VolumeSpecificationProperty {
    /**
     * The number of I/O operations per second (IOPS) that the volume supports.
     *
     * @default - EMR selected default
     */
    readonly iops?: number;

    /**
     * The volume size. If the volume type is EBS-optimized, the minimum value is 10GiB.
     * Maximum size is 1TiB
     */
    readonly volumeSize: cdk.Size;

    /**
     * The volume type. Volume types supported are gp2, io1, standard.
     */
    readonly volumeType: EbsBlockDeviceVolumeType;
  }

  /**
   * Configuration of requested EBS block device associated with the instance group with count of volumes that will be
   * associated to every instance.
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_EbsBlockDeviceConfig.html
   *
   */
  export interface EbsBlockDeviceConfigProperty {
    /**
     * EBS volume specifications such as volume type, IOPS, and size (GiB) that will be requested for the EBS volume attached to an EC2
     * instance in the cluster.
     */
    readonly volumeSpecification: VolumeSpecificationProperty;

    /**
     * Number of EBS volumes with a specific volume configuration that will be associated with every instance in the instance group
     *
     * @default EMR selected default
     */
    readonly volumesPerInstance?: number;
  }

  /**
   * The Amazon EBS configuration of a cluster instance.
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_EbsConfiguration.html
   *
   */
  export interface EbsConfigurationProperty {
    /**
     * An array of Amazon EBS volume specifications attached to a cluster instance.
     *
     * @default - None
     */
    readonly ebsBlockDeviceConfigs?: EbsBlockDeviceConfigProperty[];

    /**
     * Indicates whether an Amazon EBS volume is EBS-optimized.
     *
     * @default - EMR selected default
     */
    readonly ebsOptimized?: boolean;
  }

  /**
   * An instance type configuration for each instance type in an instance fleet, which determines the EC2 instances Amazon EMR attempts to
   * provision to fulfill On-Demand and Spot target capacities.
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_InstanceTypeConfig.html
   *
   */
  export interface InstanceTypeConfigProperty {
    /**
     * The bid price for each EC2 Spot instance type as defined by InstanceType. Expressed in USD.
     *
     * @default - None
     */
    readonly bidPrice?: string;

    /**
     * The bid price, as a percentage of On-Demand price.
     *
     * @default - None
     */
    readonly bidPriceAsPercentageOfOnDemandPrice?: number;

    /**
     * A configuration classification that applies when provisioning cluster instances, which can include configurations for applications
     * and software that run on the cluster.
     *
     * @default - None
     */
    readonly configurations?: ConfigurationProperty[];

    /**
     * The configuration of Amazon Elastic Block Storage (EBS) attached to each instance as defined by InstanceType.
     *
     * @default - None
     */
    readonly ebsConfiguration?: EbsConfigurationProperty;

    /**
     * An EC2 instance type
     */
    readonly instanceType: string;

    /**
     * The number of units that a provisioned instance of this type provides toward fulfilling the target capacities defined
     * in the InstanceFleetConfig.
     *
     * @default - None
     */
    readonly weightedCapacity?: number;
  }

  /**
   * Spot Timeout Actions
   *
   */
  export enum SpotTimeoutAction {
    /**\
     * SWITCH_TO_ON_DEMAND
     */
    SWITCH_TO_ON_DEMAND = 'SWITCH_TO_ON_DEMAND',
    /**
     * TERMINATE_CLUSTER
     */
    TERMINATE_CLUSTER = 'TERMINATE_CLUSTER',
  }

  /**
   * Different allocation strategies that can be used by the EMR cluster
   */
  export class AllocationStrategy {
    /** lowest-price allocation strategy. */
    public static readonly LOWEST_PRICE = new AllocationStrategy('lowest-price');
    /** capacity-optimized allocation strategy */
    public static readonly CAPACITY_OPTIMIZED = new AllocationStrategy('capacity-optimized');

    /**
     * Create a new AllocationStrategy with an arbitrary allocation strategy.
     *
     * @param customAllocationStrategy the allocation strategy string,
     *   for example "lowest-price"
     */
    public static of(customAllocationStrategy: string): AllocationStrategy {
      return new AllocationStrategy(customAllocationStrategy);
    }

    /** The name of the allocation strategy to be used in EMR task parameters */
    public readonly name: string;

    private constructor(name: string) {
      this.name = name;
    }
  }

  /**
   * The launch specification for Spot Instances in the fleet, which determines the defined duration, provisioning timeout behavior, and allocation strategy.
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_SpotProvisioningSpecification.html
   *
   */
  export interface SpotProvisioningSpecificationProperty {

    /**
     * Specifies the strategy to use in launching Spot Instance fleets.
     *
     * @default AllocationStrategy.CAPACITY_OPTIMIZED
     */
    readonly allocationStrategy?: AllocationStrategy;

    /**
     * The defined duration for Spot instances (also known as Spot blocks) in minutes.
     *
     * @default No blockDurationMinutes
     */
    readonly blockDurationMinutes?: number;

    /**
     * The action to take when TargetSpotCapacity has not been fulfilled when the TimeoutDurationMinutes has expired
     */
    readonly timeoutAction: SpotTimeoutAction;

    /**
     * The spot provisioning timeout period in minutes.
     */
    readonly timeoutDurationMinutes: number;
  }

  /**
   * The launch specification for On-demand instances in the instance fleet, which determines the allocation strategy.
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_OnDemandProvisioningSpecification.html
   *
   * @experimental
   */
  export interface OnDemandProvisioningSpecificationProperty {

    /**
     * Specifies the strategy to use in launching On-Demand Instance fleets.
     *
     * @default AllocationStrategy.LOWEST_PRICE
     */
    readonly allocationStrategy?: AllocationStrategy;
  }

  /**
   * The launch specification for Spot Instances in the fleet, which determines the defined duration, provisioning timeout behavior, and allocation strategy.
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_InstanceFleetProvisioningSpecifications.html
   *
   */
  export interface InstanceFleetProvisioningSpecificationsProperty {
    /**
     * The launch specification for Spot Instances in the fleet, which determines the defined duration, provisioning timeout behavior, and allocation strategy.
     *
     * @default - None
     */
    readonly spotSpecification?: SpotProvisioningSpecificationProperty;

    /**
     * The launch specification for On-Demand Instances in the instance fleet, which determines the allocation strategy.
     *
     * @default - None
     */
    readonly onDemandSpecification?: OnDemandProvisioningSpecificationProperty;
  }


  /**
   * The configuration that defines an instance fleet.
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_InstanceFleetConfig.html
   *
   */
  export interface InstanceFleetConfigProperty {
    /**
     * The node type that the instance fleet hosts. Valid values are MASTER,CORE,and TASK.
     */
    readonly instanceFleetType: InstanceRoleType;

    /**
     * The instance type configurations that define the EC2 instances in the instance fleet.
     *
     * @default No instanceTpeConfigs
     */
    readonly instanceTypeConfigs?: InstanceTypeConfigProperty[];

    /**
     * The launch specification for the instance fleet.
     *
     * @default No launchSpecifications
     */
    readonly launchSpecifications?: InstanceFleetProvisioningSpecificationsProperty;

    /**
     * The friendly name of the instance fleet.
     *
     * @default No name
     */
    readonly name?: string;

    /**
     * The target capacity of On-Demand units for the instance fleet, which determines how many On-Demand instances to provision.
     *
     * @default No targetOnDemandCapacity
     */
    readonly targetOnDemandCapacity?: number;

    /**
     * The target capacity of Spot units for the instance fleet, which determines how many Spot instances to provision
     *
     * @default No targetSpotCapacity
     */
    readonly targetSpotCapacity?: number;
  }

  /**
   * CloudWatch Alarm Comparison Operators
   *
   */
  export enum CloudWatchAlarmComparisonOperator {
    /**
     * GREATER_THAN_OR_EQUAL
     */
    GREATER_THAN_OR_EQUAL = 'GREATER_THAN_OR_EQUAL',
    /**
     * GREATER_THAN
     */
    GREATER_THAN = 'GREATER_THAN',
    /**
     * LESS_THAN
     */
    LESS_THAN = 'LESS_THAN',
    /**
     * LESS_THAN_OR_EQUAL
     */
    LESS_THAN_OR_EQUAL = 'LESS_THAN_OR_EQUAL',
  }

  /**
   * CloudWatch Alarm Statistics
   *
   */
  export enum CloudWatchAlarmStatistic {
    /**
     * SAMPLE_COUNT
     */
    SAMPLE_COUNT = 'SAMPLE_COUNT',
    /**
     * AVERAGE
     */
    AVERAGE = 'AVERAGE',
    /**
     * SUM
     */
    SUM = 'SUM',
    /**
     * MINIMUM
     */
    MINIMUM = 'MINIMUM',
    /**
     * MAXIMUM
     */
    MAXIMUM = 'MAXIMUM',
  }

  /**
   * CloudWatch Alarm Units
   *
   */
  export enum CloudWatchAlarmUnit {
    /**
     * NONE
     */
    NONE = 'NONE',
    /**
     * SECONDS
     */
    SECONDS = 'SECONDS',
    /**
     * MICRO_SECONDS
     */
    MICRO_SECONDS = 'MICRO_SECONDS',
    /**
     * MILLI_SECONDS
     */
    MILLI_SECONDS = 'MILLI_SECONDS',
    /**
     * BYTES
     */
    BYTES = 'BYTES',
    /**
     * KILO_BYTES
     */
    KILO_BYTES = 'KILO_BYTES',
    /**
     * MEGA_BYTES
     */
    MEGA_BYTES = 'MEGA_BYTES',
    /**
     * GIGA_BYTES
     */
    GIGA_BYTES = 'GIGA_BYTES',
    /**
     * TERA_BYTES
     */
    TERA_BYTES = 'TERA_BYTES',
    /**
     * BITS
     */
    BITS = 'BITS',
    /**
     * KILO_BITS
     */
    KILO_BITS = 'KILO_BITS',
    /**
     * MEGA_BITS
     */
    MEGA_BITS = 'MEGA_BITS',
    /**
     * GIGA_BITS
     */
    GIGA_BITS = 'GIGA_BITS',
    /**
     * TERA_BITS
     */
    TERA_BITS = 'TERA_BITS',
    /**
     * PERCENT
     */
    PERCENT = 'PERCENT',
    /**
     * COUNT
     */
    COUNT = 'COUNT',
    /**
     * BYTES_PER_SECOND
     */
    BYTES_PER_SECOND = 'BYTES_PER_SECOND',
    /**
     * KILO_BYTES_PER_SECOND
     */
    KILO_BYTES_PER_SECOND = 'KILO_BYTES_PER_SECOND',
    /**
     * MEGA_BYTES_PER_SECOND
     */
    MEGA_BYTES_PER_SECOND = 'MEGA_BYTES_PER_SECOND',
    /**
     * GIGA_BYTES_PER_SECOND
     */
    GIGA_BYTES_PER_SECOND = 'GIGA_BYTES_PER_SECOND',
    /**
     * TERA_BYTES_PER_SECOND
     */
    TERA_BYTES_PER_SECOND = 'TERA_BYTES_PER_SECOND',
    /**
     * BITS_PER_SECOND
     */
    BITS_PER_SECOND = 'BITS_PER_SECOND',
    /**
     * KILO_BITS_PER_SECOND
     */
    KILO_BITS_PER_SECOND = 'KILO_BITS_PER_SECOND',
    /**
     * MEGA_BITS_PER_SECOND
     */
    MEGA_BITS_PER_SECOND = 'MEGA_BITS_PER_SECOND',
    /**
     * GIGA_BITS_PER_SECOND
     */
    GIGA_BITS_PER_SECOND = 'GIGA_BITS_PER_SECOND',
    /**
     * TERA_BITS_PER_SECOND
     */
    TERA_BITS_PER_SECOND = 'TERA_BITS_PER_SECOND',
    /**
     * COUNT_PER_SECOND
     */
    COUNT_PER_SECOND = 'COUNT_PER_SECOND',
  }

  /**
   * A CloudWatch dimension, which is specified using a Key (known as a Name in CloudWatch), Value pair. By default, Amazon EMR uses
   * one dimension whose Key is JobFlowID and Value is a variable representing the cluster ID, which is ${emr.clusterId}. This enables
   * the rule to bootstrap when the cluster ID becomes available
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_MetricDimension.html
   *
   */
  export interface MetricDimensionProperty {
    /**
     * The dimension name
     */
    readonly key: string;

    /**
     * The dimension value
     */
    readonly value: string;
  }

  /**
   * The definition of a CloudWatch metric alarm, which determines when an automatic scaling activity is triggered. When the defined alarm conditions
   * are satisfied, scaling activity begins.
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_CloudWatchAlarmDefinition.html
   *
   */
  export interface CloudWatchAlarmDefinitionProperty {
    /**
     * Determines how the metric specified by MetricName is compared to the value specified by Threshold
     */
    readonly comparisonOperator: CloudWatchAlarmComparisonOperator;

    /**
     * A CloudWatch metric dimension
     *
     * @default - No dimensions
     */
    readonly dimensions?: MetricDimensionProperty[];

    /**
     * The number of periods, in five-minute increments, during which the alarm condition must exist before the alarm triggers automatic
     * scaling activity.
     *
     * @default 1
     */
    readonly evaluationPeriods?: number;

    /**
     * The name of the CloudWatch metric that is watched to determine an alarm condition.
     */
    readonly metricName: string;

    /**
     * The namespace for the CloudWatch metric.
     *
     * @default 'AWS/ElasticMapReduce'
     */
    readonly namespace?: string;

    /**
     * The period, in seconds, over which the statistic is applied. EMR CloudWatch metrics are emitted every five minutes (300 seconds), so if
     * an EMR CloudWatch metric is specified, specify 300.
     */
    readonly period: cdk.Duration;

    /**
     * The statistic to apply to the metric associated with the alarm.
     *
     * @default CloudWatchAlarmStatistic.AVERAGE
     */
    readonly statistic?: CloudWatchAlarmStatistic;

    /**
     * The value against which the specified statistic is compared.
     *
     * @default - None
     */
    readonly threshold?: number;

    /**
     * The unit of measure associated with the CloudWatch metric being watched. The value specified for Unit must correspond to the units
     * specified in the CloudWatch metric.
     *
     * @default CloudWatchAlarmUnit.NONE
     */
    readonly unit?: CloudWatchAlarmUnit;
  }

  /**
   * The conditions that trigger an automatic scaling activity and the definition of a CloudWatch metric alarm.
   * When the defined alarm conditions are met along with other trigger parameters, scaling activity begins.
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_ScalingTrigger.html
   *
   */
  export interface ScalingTriggerProperty {
    /**
     * The definition of a CloudWatch metric alarm. When the defined alarm conditions are met along with other trigger parameters,
     * scaling activity begins.
     */
    readonly cloudWatchAlarmDefinition: CloudWatchAlarmDefinitionProperty;
  }

  /**
   * EC2 Instance Market
   *
   */
  export enum InstanceMarket {
    /**
     * On Demand Instance
     */
    ON_DEMAND = 'ON_DEMAND',
    /**
     * Spot Instance
     */
    SPOT = 'SPOT',
  }

  /**
   * AutoScaling Adjustment Type
   *
   */
  export enum ScalingAdjustmentType {
    /**
     * CHANGE_IN_CAPACITY
     */
    CHANGE_IN_CAPACITY = 'CHANGE_IN_CAPACITY',
    /**
     * PERCENT_CHANGE_IN_CAPACITY
     */
    PERCENT_CHANGE_IN_CAPACITY = 'PERCENT_CHANGE_IN_CAPACITY',
    /**
     * EXACT_CAPACITY
     */
    EXACT_CAPACITY = 'EXACT_CAPACITY',
  }

  /**
   * An automatic scaling configuration, which describes how the policy adds or removes instances, the cooldown period, and the number of EC2
   * instances that will be added each time the CloudWatch metric alarm condition is satisfied.
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_SimpleScalingPolicyConfiguration.html
   *
   */
  export interface SimpleScalingPolicyConfigurationProperty {
    /**
     * The way in which EC2 instances are added (if ScalingAdjustment is a positive number) or terminated (if ScalingAdjustment is a negative
     * number) each time the scaling activity is triggered.
     *
     * @default - None
     */
    readonly adjustmentType?: ScalingAdjustmentType;

    /**
     * The amount of time, in seconds, after a scaling activity completes before any further trigger-related scaling activities can start.
     *
     * @default 0
     */
    readonly coolDown?: number;

    /**
     * The amount by which to scale in or scale out, based on the specified AdjustmentType. A positive value adds to the instance group's
     * EC2 instance count while a negative number removes instances. If AdjustmentType is set to EXACT_CAPACITY, the number should only be
     * a positive integer.
     */
    readonly scalingAdjustment: number;
  }

  /**
   * The type of adjustment the automatic scaling activity makes when triggered, and the periodicity of the adjustment.
   * And an automatic scaling configuration, which describes how the policy adds or removes instances, the cooldown period,
   * and the number of EC2 instances that will be added each time the CloudWatch metric alarm condition is satisfied.
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_ScalingAction.html
   *
   */
  export interface ScalingActionProperty {
    /**
     * Not available for instance groups. Instance groups use the market type specified for the group.
     *
     * @default - EMR selected default
     */
    readonly market?: InstanceMarket;

    /**
     * The type of adjustment the automatic scaling activity makes when triggered, and the periodicity of the adjustment.
     */
    readonly simpleScalingPolicyConfiguration: SimpleScalingPolicyConfigurationProperty;
  }

  /**
   * A scale-in or scale-out rule that defines scaling activity, including the CloudWatch metric alarm that triggers activity, how EC2
   * instances are added or removed, and the periodicity of adjustments.
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_ScalingRule.html
   *
   */
  export interface ScalingRuleProperty {
    /**
     * The conditions that trigger an automatic scaling activity.
     */
    readonly action: ScalingActionProperty;

    /**
     * A friendly, more verbose description of the automatic scaling rule.
     *
     * @default - None
     */
    readonly description?: string;

    /**
     * The name used to identify an automatic scaling rule. Rule names must be unique within a scaling policy.
     */
    readonly name: string;

    /**
     * The CloudWatch alarm definition that determines when automatic scaling activity is triggered.
     */
    readonly trigger: ScalingTriggerProperty;
  }

  /**
   * The upper and lower EC2 instance limits for an automatic scaling policy. Automatic scaling activities triggered by automatic scaling
   * rules will not cause an instance group to grow above or below these limits.
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_ScalingConstraints.html
   *
   */
  export interface ScalingConstraintsProperty {
    /**
     * The upper boundary of EC2 instances in an instance group beyond which scaling activities are not allowed to grow. Scale-out
     * activities will not add instances beyond this boundary.
     */
    readonly maxCapacity: number;

    /**
     * The lower boundary of EC2 instances in an instance group below which scaling activities are not allowed to shrink. Scale-in
     * activities will not terminate instances below this boundary.
     */
    readonly minCapacity: number;
  }

  /**
   * An automatic scaling policy for a core instance group or task instance group in an Amazon EMR cluster.
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_AutoScalingPolicy.html
   *
   */
  export interface AutoScalingPolicyProperty {
    /**
     * The upper and lower EC2 instance limits for an automatic scaling policy. Automatic scaling activity will not cause an instance
     * group to grow above or below these limits.
     */
    readonly constraints: ScalingConstraintsProperty;

    /**
     * The scale-in and scale-out rules that comprise the automatic scaling policy.
     */
    readonly rules: ScalingRuleProperty[];
  }

  /**
   * Configuration defining a new instance group.
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_InstanceGroupConfig.html
   *
   */
  export interface InstanceGroupConfigProperty {
    /**
     * An automatic scaling policy for a core instance group or task instance group in an Amazon EMR cluster.
     *
     * @default - None
     */
    readonly autoScalingPolicy?: AutoScalingPolicyProperty;

    /**
     * The bid price for each EC2 Spot instance type as defined by InstanceType. Expressed in USD.
     *
     * @default - None
     */
    readonly bidPrice?: string;

    /**
     * The list of configurations supplied for an EMR cluster instance group.
     *
     * @default - None
     */
    readonly configurations?: ConfigurationProperty[];

    /**
     * EBS configurations that will be attached to each EC2 instance in the instance group.
     *
     * @default - None
     */
    readonly ebsConfiguration?: EbsConfigurationProperty;

    /**
     * Target number of instances for the instance group.
     */
    readonly instanceCount: number;

    /**
     * The role of the instance group in the cluster.
     */
    readonly instanceRole: InstanceRoleType;

    /**
     * The EC2 instance type for all instances in the instance group.
     */
    readonly instanceType: string;

    /**
     * Market type of the EC2 instances used to create a cluster node.
     *
     * @default - EMR selected default
     */
    readonly market?: InstanceMarket;

    /**
     * Friendly name given to the instance group.
     *
     * @default - None
     */
    readonly name?: string;
  }

  /**
   * The Amazon EC2 Availability Zone configuration of the cluster (job flow).
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_PlacementType.html
   *
   */
  export interface PlacementTypeProperty {
    /**
     * The Amazon EC2 Availability Zone for the cluster. AvailabilityZone is used for uniform instance groups, while AvailabilityZones
     * (plural) is used for instance fleets.
     *
     * @default - EMR selected default
     */
    readonly availabilityZone?: string;

    /**
     * When multiple Availability Zones are specified, Amazon EMR evaluates them and launches instances in the optimal Availability Zone.
     * AvailabilityZones is used for instance fleets, while AvailabilityZone (singular) is used for uniform instance groups.
     *
     * @default - EMR selected default
     */
    readonly availabilityZones?: string[];
  }

  /**
   * A specification of the number and type of Amazon EC2 instances.
   *
   * See the RunJobFlow API for complete documentation on input parameters
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_JobFlowInstancesConfig.html
   *
   */
  export interface InstancesConfigProperty {
    /**
     * A list of additional Amazon EC2 security group IDs for the master node.
     *
     * @default - None
     */
    readonly additionalMasterSecurityGroups?: string[];

    /**
     * A list of additional Amazon EC2 security group IDs for the core and task nodes.
     *
     * @default - None
     */
    readonly additionalSlaveSecurityGroups?: string[];

    /**
     * The name of the EC2 key pair that can be used to ssh to the master node as the user called "hadoop."
     *
     * @default - None
     */
    readonly ec2KeyName?: string;

    /**
     * Applies to clusters that use the uniform instance group configuration. To launch the cluster in Amazon Virtual Private Cloud (Amazon VPC),
     * set this parameter to the identifier of the Amazon VPC subnet where you want the cluster to launch.
     *
     * @default EMR selected default
     */
    readonly ec2SubnetId?: string;

    /**
     * Applies to clusters that use the instance fleet configuration. When multiple EC2 subnet IDs are specified, Amazon EMR evaluates them and
     * launches instances in the optimal subnet.
     *
     * @default EMR selected default
     */
    readonly ec2SubnetIds?: string[];

    /**
     * The identifier of the Amazon EC2 security group for the master node.
     *
     * @default - None
     */
    readonly emrManagedMasterSecurityGroup?: string;

    /**
     * The identifier of the Amazon EC2 security group for the core and task nodes.
     *
     * @default - None
     */
    readonly emrManagedSlaveSecurityGroup?: string;

    /**
     * Applies only to Amazon EMR release versions earlier than 4.0. The Hadoop version for the cluster.
     *
     * @default - 0.18 if the AmiVersion parameter is not set. If AmiVersion is set, the version of Hadoop for that AMI version is used.
     */
    readonly hadoopVersion?: string;

    /**
     * The number of EC2 instances in the cluster.
     *
     * @default 0
     */
    readonly instanceCount?: number;

    /**
     * Describes the EC2 instances and instance configurations for clusters that use the instance fleet configuration.
     * The instance fleet configuration is available only in Amazon EMR versions 4.8.0 and later, excluding 5.0.x versions.
     *
     * @default - None
     */
    readonly instanceFleets?: InstanceFleetConfigProperty[];

    /**
     * Configuration for the instance groups in a cluster.
     *
     * @default - None
     */
    readonly instanceGroups?: InstanceGroupConfigProperty[];

    /**
     * The EC2 instance type of the master node.
     *
     * @default - None
     */
    readonly masterInstanceType?: string;

    /**
     * The Availability Zone in which the cluster runs.
     *
     * @default - EMR selected default
     */
    readonly placement?: PlacementTypeProperty;

    /**
     * The identifier of the Amazon EC2 security group for the Amazon EMR service to access clusters in VPC private subnets.
     *
     * @default - None
     */
    readonly serviceAccessSecurityGroup?: string;

    /**
     * The EC2 instance type of the core and task nodes.
     *
     * @default - None
     */
    readonly slaveInstanceType?: string;

    /**
     * Specifies whether to lock the cluster to prevent the Amazon EC2 instances from being terminated by API call, user intervention,
     * or in the event of a job-flow error.
     *
     * @default false
     */
    readonly terminationProtected?: boolean;
  }

  /**
   * Properties for the EMR Cluster Applications
   *
   * Applies to Amazon EMR releases 4.0 and later. A case-insensitive list of applications for Amazon EMR to install and configure when launching
   * the cluster.
   *
   * See the RunJobFlow API for complete documentation on input parameters
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_Application.html
   *
   */
  export interface ApplicationConfigProperty {
    /**
     * This option is for advanced users only. This is meta information about third-party applications that third-party vendors use
     * for testing purposes.
     *
     * @default No additionalInfo
     */
    readonly additionalInfo?: { [key: string]: string };

    /**
     * Arguments for Amazon EMR to pass to the application.
     *
     * @default No args
     */
    readonly args?: string[];

    /**
     * The name of the application.
     */
    readonly name: string;

    /**
     * The version of the application.
     *
     * @default No version
     */
    readonly version?: string;
  }

  /**
   * Configuration of the script to run during a bootstrap action.
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_ScriptBootstrapActionConfig.html
   *
   */
  export interface ScriptBootstrapActionConfigProperty {
    /**
     * Location of the script to run during a bootstrap action. Can be either a location in Amazon S3 or on a local file system.
     */
    readonly path: string;

    /**
     * A list of command line arguments to pass to the bootstrap action script.
     *
     * @default No args
     */
    readonly args?: string[];
  }

  /**
   * Configuration of a bootstrap action.
   *
   * See the RunJobFlow API for complete documentation on input parameters
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_BootstrapActionConfig.html
   *
   */
  export interface BootstrapActionConfigProperty {
    /**
     * The name of the bootstrap action.
     */
    readonly name: string;

    /**
     * The script run by the bootstrap action
     */
    readonly scriptBootstrapAction: ScriptBootstrapActionConfigProperty;
  }

  /**
   * An optional configuration specification to be used when provisioning cluster instances, which can include configurations for
   * applications and software bundled with Amazon EMR.
   *
   * See the RunJobFlow API for complete documentation on input parameters
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_Configuration.html
   *
   */
  export interface ConfigurationProperty {
    /**
     * The classification within a configuration.
     *
     * @default No classification
     */
    readonly classification?: string;

    /**
     * A set of properties specified within a configuration classification.
     *
     * @default No properties
     */
    readonly properties?: { [key: string]: string };

    /**
     * A list of additional configurations to apply within a configuration object.
     *
     * @default No configurations
     */
    readonly configurations?: ConfigurationProperty[];
  }

  /**
   * Attributes for Kerberos configuration when Kerberos authentication is enabled using a security configuration.
   *
   * See the RunJobFlow API for complete documentation on input parameters
   *
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_KerberosAttributes.html
   *
   */
  export interface KerberosAttributesProperty {
    /**
     * The Active Directory password for ADDomainJoinUser.
     *
     * @default No adDomainJoinPassword
     */
    readonly adDomainJoinPassword?: string;

    /**
     * Required only when establishing a cross-realm trust with an Active Directory domain. A user with sufficient privileges to join
     * resources to the domain.
     *
     * @default No adDomainJoinUser
     */
    readonly adDomainJoinUser?: string;

    /**
     * Required only when establishing a cross-realm trust with a KDC in a different realm. The cross-realm principal password, which
     * must be identical across realms.
     *
     * @default No crossRealmTrustPrincipalPassword
     */
    readonly crossRealmTrustPrincipalPassword?: string;

    /**
     * The password used within the cluster for the kadmin service on the cluster-dedicated KDC, which maintains Kerberos principals,
     * password policies, and keytabs for the cluster.
     *
     * @default No kdcAdminPassword
     */
    readonly kdcAdminPassword?: string;

    /**
     * The name of the Kerberos realm to which all nodes in a cluster belong. For example, EC2.INTERNAL.
     */
    readonly realm: string;
  }
}
