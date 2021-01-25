import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Construct } from 'constructs';
import { integrationResourceArn, validatePatternSupported } from '../private/task-utils';

/** Properties for creating a Nodegroup with EksCreateNodegroup */
export interface EksCreateNodegroupProps extends sfn.TaskStateBaseProps {

  /** The name of the cluster to create the node group in */
  readonly clusterName: string;

  /** The unique name to give your node group */
  readonly nodegroupName: string;

  /**
   * The scaling configuration details for the Auto Scaling group that is created for your node group
   *
   * @default - no scaling config
   */
  readonly scalingConfig?: NodeGroupScalingConfig;

  /**
   * The root device disk size (in GiB) for your node group instances
   *
   * @default - 20 GiB
   */
  readonly diskSize?: number;

  /**
   * The subnets to use for the Auto Scaling group that is created for your node group
   * @example subnets must have the tag key kubernetes.io/cluster/CLUSTER_NAME with a value of shared , where CLUSTER_NAME is replaced with the name of your cluster
   */
  readonly subnets: string[];

  /**
   * The instance type to use for your node group
   *
   * @default - t3.medium
   */
  readonly instanceTypes?: string[];

  /**
   * AMI type for your node group
   *
   * @default - GPU uses AL2_x86_64_GPU, Non-GPU uses AL2_x86_64, Arm uses AL2_ARM_64
   */
  readonly amiType?: string;

  /**
   * The remote access (SSH) configuration to use with your node group
   * you specify launchTemplate , then don't specify remoteAccess , or the node group deployment will fail
   *
   * @default - no remote access config
   */
  readonly remoteAccess?: RemoteAccessConfig;

  /** The Amazon Resource Name (ARN) of the IAM role to associate with your node group */
  readonly nodeRole: string;

  /**
   * The Kubernetes labels to be applied to the nodes in the node group when they are created
   *
   * @default - no labels
   */
  readonly labels?: Record<string, string>;

  /**
   * The metadata to apply to the node group to assist with categorization and organization
   *
   * @default - no tags
   */
  readonly tags?: Record<string, string>;

  /**
   * Unique, case-sensitive identifier that you provide to ensure the idempotency of the request
   *
   * @default - no client request token
   */
  readonly clientRequestToken?: string;

  /**
   * An object representing a node group's launch template specification
   * If specified, then do not specify instanceTypes , diskSize , or remoteAccess
   *
   * @default - no launch template
   */
  readonly launchTemplate?: LaunchTemplateSpecification;

  /**
   * Kubernetes version to use for your managed nodes
   *
   * @default - Kubernetes version of the cluster is used
   */
  readonly version?: string;

  /**
   * AMI version of the Amazon EKS-optimized AMI to use with your node group
   *
   * @default - latest available AMI version for the node group's current Kubernetes version
   */
  readonly releaseVersion?: string;
}

/**
 * Create a Nodegroup as a Task
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-eks.html
 */
export class EksCreateNodegroup extends sfn.TaskStateBase {

  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] = [
    sfn.IntegrationPattern.REQUEST_RESPONSE,
    sfn.IntegrationPattern.RUN_JOB,
  ];

  protected readonly taskMetrics?: sfn.TaskMetricsConfig;
  protected readonly taskPolicies?: iam.PolicyStatement[];

  private readonly integrationPattern: sfn.IntegrationPattern;

  constructor(scope: Construct, id: string, private readonly props: EksCreateNodegroupProps) {
    super(scope, id, props);
    this.integrationPattern = props.integrationPattern ?? sfn.IntegrationPattern.REQUEST_RESPONSE;

    validatePatternSupported(this.integrationPattern, EksCreateNodegroup.SUPPORTED_INTEGRATION_PATTERNS);

    this.taskPolicies = [
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['ec2:DescribeSubnets', 'eks:CreateNodegroup'],
      }),
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['iam:GetRole',
          'iam:listAttachedRolePolicies'],
      }),
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['ec2:DescribeLaunchTemplates', // To support the use case of creating and updating Auto Scaling groups (Under additional required permissions) https://docs.aws.amazon.com/autoscaling/ec2/userguide/ec2-auto-scaling-launch-template-permissions.html
          'ec2:DescribeLaunchTemplateVersions',
          'ec2:DescribeVpcs',
          'ec2:DescribeSubnets',
          'ec2:DescribeAvailabilityZones'],
      }),
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['iam:PassRole'],
        conditions: {
          StringEqualsIfExists: {
            'iam:PassedToService': [
              'eks.amazonaws.com',
            ],
          },
        },
      }),
    ];
  }

  /**
   * Provides the EKS Create NodeGroup service integration task configuration
   */
  /**
   * @internal
   */
  protected _renderTask(): any {
    if (this.props.remoteAccess) {
      return {
        Resource: integrationResourceArn('eks', 'createNodegroup', this.integrationPattern),
        Parameters: sfn.FieldUtils.renderObject({
          ClusterName: this.props.clusterName,
          NodegroupName: this.props.nodegroupName,
          ScalingConfig: {
            MinSize: this.props.scalingConfig?.minSize,
            MaxSize: this.props.scalingConfig?.maxSize,
            DesiredSize: this.props.scalingConfig?.desiredSize,
          },
          DiskSize: this.props.diskSize,
          Subnets: this.props.subnets,
          InstanceTypes: this.props.instanceTypes,
          AmiType: this.props.amiType,
          RemoteAccess: {
            Ec2SshKey: this.props.remoteAccess?.ec2SshKey,
            SourceSecurityGroups: this.props.remoteAccess?.sourceSecurityGroups,
          },
          NodeRole: this.props.nodeRole,
          Labels: this.props.labels,
          Tags: this.props.tags,
          ClientRequestToken: this.props.clientRequestToken,
          Version: this.props.version,
          ReleaseVersion: this.props.releaseVersion,
        }),
      };
    } else {
      return {
        Resource: integrationResourceArn('eks', 'createNodegroup', this.integrationPattern),
        Parameters: sfn.FieldUtils.renderObject({
          ClusterName: this.props.clusterName,
          NodegroupName: this.props.nodegroupName,
          ScalingConfig: {
            MinSize: this.props.scalingConfig?.minSize,
            MaxSize: this.props.scalingConfig?.maxSize,
            DesiredSize: this.props.scalingConfig?.desiredSize,
          },
          DiskSize: this.props.diskSize,
          Subnets: this.props.subnets,
          InstanceTypes: this.props.instanceTypes,
          AmiType: this.props.amiType,
          NodeRole: this.props.nodeRole,
          Labels: this.props.labels,
          Tags: this.props.tags,
          ClientRequestToken: this.props.clientRequestToken,
          LaunchTemplate: {
            Name: this.props.launchTemplate?.name,
            Version: this.props.launchTemplate?.version,
            Id: this.props.launchTemplate?.id,
          },
          Version: this.props.version,
          ReleaseVersion: this.props.releaseVersion,
        }),
      };
    }
  }
}

/**
 * An object representing the scaling configuration details
 *
 * @see https://docs.aws.amazon.com/eks/latest/APIReference/API_NodegroupScalingConfig.html
 */
export interface NodeGroupScalingConfig {

  /**
   * The minimum number of worker nodes that the managed node group can scale in to
   *
   * @default - greater than zero
   */
  readonly minSize?: number;

  /**
   * The maximum number of worker nodes that the managed node group can scale out to
   *
   * @default - maximum 100
   */
  readonly maxSize?: number;

  /**
   * The current number of worker nodes that the managed node group should maintain
   *
   * @default - min size
   */
  readonly desiredSize?: number;
}

/**
 * An object representing the remote access configuration for the managed node group.
 *
 * @see https://docs.aws.amazon.com/eks/latest/APIReference/API_RemoteAccessConfig.html
 */
export interface RemoteAccessConfig {

  /**
   * The Amazon EC2 SSH key that provides access for SSH communication
   *
   * @default - No EC2 SSH Key
   */
  readonly ec2SshKey?: string;

  /**
   *  security groups that are allowed SSH access (port 22) to the worker nodes
   *
   * @default - port 22 on the worker nodes is opened to the internet (0.0.0.0/0
   */
  readonly sourceSecurityGroups?: string[];
}

/**
 * An object representing a node group's launch template specification
 * If specified, then do not specify instanceTypes , diskSize , or remoteAccess
 *
 * @see https://docs.aws.amazon.com/eks/latest/APIReference/API_LaunchTemplateSpecification.html
 */
export interface LaunchTemplateSpecification {

  /**
   * The name of the launch template
   *
   * @default - No name
   */
  readonly name?: string;

  /**
   * The version of the launch template to use
   *
   * @default - template's default version
   */
  readonly version?: string;

  /**
   * The ID of the launch template
   *
   * @default - No id
   */
  readonly id?: string;
}
