import { InstanceType, ISecurityGroup, SubnetSelection } from '@aws-cdk/aws-ec2';
import { IRole, ManagedPolicy, Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import { IResource, Resource, Annotations, withResolved } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { Cluster, ICluster } from './cluster';
import { CfnNodegroup } from './eks.generated';
import { INSTANCE_TYPES } from './instance-types';

/**
 * NodeGroup interface
 */
export interface INodegroup extends IResource {
  /**
   * Name of the nodegroup
   * @attribute
   */
  readonly nodegroupName: string;
}

/**
 * The AMI type for your node group. GPU instance types should use the `AL2_x86_64_GPU` AMI type, which uses the
 * Amazon EKS-optimized Linux AMI with GPU support. Non-GPU instances should use the `AL2_x86_64` AMI type, which
 * uses the Amazon EKS-optimized Linux AMI.
 */
export enum NodegroupAmiType {
  /**
   * Amazon Linux 2 (x86-64)
   */
  AL2_X86_64 = 'AL2_x86_64',
  /**
   * Amazon Linux 2 with GPU support
   */
  AL2_X86_64_GPU = 'AL2_x86_64_GPU',
  /**
   * Amazon Linux 2 (ARM-64)
   */
  AL2_ARM_64 = 'AL2_ARM_64'
}

/**
 * Capacity type of the managed node group
 */
export enum CapacityType {
  /**
   * spot instances
   */
  SPOT = 'SPOT',
  /**
   * on-demand instances
   */
  ON_DEMAND = 'ON_DEMAND'
}

/**
 * The remote access (SSH) configuration to use with your node group.
 *
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-eks-nodegroup-remoteaccess.html
 */
export interface NodegroupRemoteAccess {
  /**
   * The Amazon EC2 SSH key that provides access for SSH communication with the worker nodes in the managed node group.
   */
  readonly sshKeyName: string;
  /**
   * The security groups that are allowed SSH access (port 22) to the worker nodes. If you specify an Amazon EC2 SSH
   * key but do not specify a source security group when you create a managed node group, then port 22 on the worker
   * nodes is opened to the internet (0.0.0.0/0).
   *
   * @default - port 22 on the worker nodes is opened to the internet (0.0.0.0/0)
   */
  readonly sourceSecurityGroups?: ISecurityGroup[];
}

/**
 * Launch template property specification
 */
export interface LaunchTemplateSpec {
  /**
   * The Launch template ID
   */
  readonly id: string;
  /**
   * The launch template version to be used (optional).
   *
   * @default - the default version of the launch template
   */
  readonly version?: string;
}

/**
 * Effect types of kubernetes node taint.
 */
export enum TaintEffect {
  /**
   * NoSchedule
   */
  NO_SCHEDULE = 'NO_SCHEDULE',
  /**
   * PreferNoSchedule
   */
  PREFER_NO_SCHEDULE = 'PREFER_NO_SCHEDULE',
  /**
   * NoExecute
   */
  NO_EXECUTE = 'NO_EXECUTE',
}

/**
 * Taint interface
 */
export interface TaintSpec {
  /**
   * Effect type
   *
   * @default - None
   */
  readonly effect?: TaintEffect;
  /**
   * Taint key
   *
   * @default - None
   */
  readonly key?: string;
  /**
   * Taint value
   *
   * @default - None
   */
  readonly value?: string;
}

/**
 * The Nodegroup Options for addNodeGroup() method
 */
export interface NodegroupOptions {
  /**
   * Name of the Nodegroup
   *
   * @default - resource ID
   */
  readonly nodegroupName?: string;
  /**
   * The subnets to use for the Auto Scaling group that is created for your node group. By specifying the
   * SubnetSelection, the selected subnets will automatically apply required tags i.e.
   * `kubernetes.io/cluster/CLUSTER_NAME` with a value of `shared`, where `CLUSTER_NAME` is replaced with
   * the name of your cluster.
   *
   * @default - private subnets
   */
  readonly subnets?: SubnetSelection;
  /**
   * The AMI type for your node group.
   *
   * @default - auto-determined from the instanceTypes property.
   */
  readonly amiType?: NodegroupAmiType;
  /**
   * The root device disk size (in GiB) for your node group instances.
   *
   * @default 20
   */
  readonly diskSize?: number;
  /**
   * The current number of worker nodes that the managed node group should maintain. If not specified,
   * the nodewgroup will initially create `minSize` instances.
   *
   * @default 2
   */
  readonly desiredSize?: number;
  /**
   * The maximum number of worker nodes that the managed node group can scale out to. Managed node groups can support up to 100 nodes by default.
   *
   * @default - desiredSize
   */
  readonly maxSize?: number;
  /**
   * The minimum number of worker nodes that the managed node group can scale in to. This number must be greater than or equal to zero.
   *
   * @default 1
   */
  readonly minSize?: number;
  /**
   * Force the update if the existing node group's pods are unable to be drained due to a pod disruption budget issue.
   * If an update fails because pods could not be drained, you can force the update after it fails to terminate the old
   * node whether or not any pods are
   * running on the node.
   *
   * @default true
   */
  readonly forceUpdate?: boolean;
  /**
   * The instance type to use for your node group. Currently, you can specify a single instance type for a node group.
   * The default value for this parameter is `t3.medium`. If you choose a GPU instance type, be sure to specify the
   * `AL2_x86_64_GPU` with the amiType parameter.
   *
   * @default t3.medium
   * @deprecated Use `instanceTypes` instead.
   */
  readonly instanceType?: InstanceType;
  /**
   * The instance types to use for your node group.
   * @default t3.medium will be used according to the cloudformation document.
   * @see - https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-eks-nodegroup.html#cfn-eks-nodegroup-instancetypes
   */
  readonly instanceTypes?: InstanceType[];
  /**
   * The Kubernetes labels to be applied to the nodes in the node group when they are created.
   *
   * @default - None
   */
  readonly labels?: { [name: string]: string };
  /**
   * The Kubernetes taints to be applied to the nodes in the node group when they are created.
   *
   * @default - None
   */
  readonly taints?: TaintSpec[];
  /**
   * The IAM role to associate with your node group. The Amazon EKS worker node kubelet daemon
   * makes calls to AWS APIs on your behalf. Worker nodes receive permissions for these API calls through
   * an IAM instance profile and associated policies. Before you can launch worker nodes and register them
   * into a cluster, you must create an IAM role for those worker nodes to use when they are launched.
   *
   * @default - None. Auto-generated if not specified.
   */
  readonly nodeRole?: IRole;
  /**
   * The AMI version of the Amazon EKS-optimized AMI to use with your node group (for example, `1.14.7-YYYYMMDD`).
   *
   * @default - The latest available AMI version for the node group's current Kubernetes version is used.
   */
  readonly releaseVersion?: string;
  /**
   * The remote access (SSH) configuration to use with your node group. Disabled by default, however, if you
   * specify an Amazon EC2 SSH key but do not specify a source security group when you create a managed node group,
   * then port 22 on the worker nodes is opened to the internet (0.0.0.0/0)
   *
   * @default - disabled
   */
  readonly remoteAccess?: NodegroupRemoteAccess;
  /**
   * The metadata to apply to the node group to assist with categorization and organization. Each tag consists of
   * a key and an optional value, both of which you define. Node group tags do not propagate to any other resources
   * associated with the node group, such as the Amazon EC2 instances or subnets.
   *
   * @default - None
   */
  readonly tags?: { [name: string]: string };
  /**
   * Launch template specification used for the nodegroup
   * @see - https://docs.aws.amazon.com/eks/latest/userguide/launch-templates.html
   * @default - no launch template
   */
  readonly launchTemplateSpec?: LaunchTemplateSpec;
  /**
   * The capacity type of the nodegroup.
   *
   * @default - ON_DEMAND
   */
  readonly capacityType?: CapacityType;
}

/**
 * NodeGroup properties interface
 */
export interface NodegroupProps extends NodegroupOptions {
  /**
   * Cluster resource
   */
  readonly cluster: ICluster;
}

/**
 * The Nodegroup resource class
 */
export class Nodegroup extends Resource implements INodegroup {
  /**
   * Import the Nodegroup from attributes
   */
  public static fromNodegroupName(scope: Construct, id: string, nodegroupName: string): INodegroup {
    class Import extends Resource implements INodegroup {
      public readonly nodegroupName = nodegroupName;
    }
    return new Import(scope, id);
  }
  /**
   * ARN of the nodegroup
   *
   * @attribute
   */
  public readonly nodegroupArn: string;
  /**
   * Nodegroup name
   *
   * @attribute
   */
  public readonly nodegroupName: string;
  /**
   * the Amazon EKS cluster resource
   *
   * @attribute ClusterName
   */
  public readonly cluster: ICluster;
  /**
   * IAM role of the instance profile for the nodegroup
   */
  public readonly role: IRole;

  private readonly desiredSize: number;
  private readonly maxSize: number;
  private readonly minSize: number;

  constructor(scope: Construct, id: string, props: NodegroupProps) {
    super(scope, id, {
      physicalName: props.nodegroupName,
    });

    this.cluster = props.cluster;

    this.desiredSize = props.desiredSize ?? props.minSize ?? 2;
    this.maxSize = props.maxSize ?? this.desiredSize;
    this.minSize = props.minSize ?? 1;

    withResolved(this.desiredSize, this.maxSize, (desired, max) => {
      if (desired === undefined) {return ;}
      if (desired > max) {
        throw new Error(`Desired capacity ${desired} can't be greater than max size ${max}`);
      }
    });

    withResolved(this.desiredSize, this.minSize, (desired, min) => {
      if (desired === undefined) {return ;}
      if (desired < min) {
        throw new Error(`Minimum capacity ${min} can't be greater than desired size ${desired}`);
      }
    });

    if (props.launchTemplateSpec && props.diskSize) {
      // see - https://docs.aws.amazon.com/eks/latest/userguide/launch-templates.html
      // and https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-eks-nodegroup.html#cfn-eks-nodegroup-disksize
      throw new Error('diskSize must be specified within the launch template');
    }

    if (props.instanceType && props.instanceTypes) {
      throw new Error('"instanceType is deprecated, please use "instanceTypes" only.');
    }

    if (props.instanceType) {
      Annotations.of(this).addWarning('"instanceType" is deprecated and will be removed in the next major version. please use "instanceTypes" instead');
    }
    const instanceTypes = props.instanceTypes ?? (props.instanceType ? [props.instanceType] : undefined);
    let expectedAmiType = undefined;

    if (instanceTypes && instanceTypes.length > 0) {
      // if the user explicitly configured instance types, we can calculate the expected ami type.
      expectedAmiType = getAmiType(instanceTypes);

      // if the user explicitly configured an ami type, make sure its the same as the expected one.
      if (props.amiType && props.amiType !== expectedAmiType) {
        throw new Error(`The specified AMI does not match the instance types architecture, either specify ${expectedAmiType} or dont specify any`);
      }
    }

    if (!props.nodeRole) {
      const ngRole = new Role(this, 'NodeGroupRole', {
        assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      });

      ngRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSWorkerNodePolicy'));
      ngRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonEKS_CNI_Policy'));
      ngRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'));
      this.role = ngRole;
    } else {
      this.role = props.nodeRole;
    }

    const resource = new CfnNodegroup(this, 'Resource', {
      clusterName: this.cluster.clusterName,
      nodegroupName: props.nodegroupName,
      nodeRole: this.role.roleArn,
      subnets: this.cluster.vpc.selectSubnets(props.subnets).subnetIds,

      // if a launch template is configured, we cannot apply a default since it
      // might exist in the launch template as well, causing a deployment failure.
      amiType: props.launchTemplateSpec !== undefined ? props.amiType : (props.amiType ?? expectedAmiType),

      capacityType: props.capacityType ? props.capacityType.valueOf() : undefined,
      diskSize: props.diskSize,
      forceUpdateEnabled: props.forceUpdate ?? true,

      // note that we don't check if a launch template is configured here (even though it might configure instance types as well)
      // because this doesn't have a default value, meaning the user had to explicitly configure this.
      instanceTypes: instanceTypes?.map(t => t.toString()),
      labels: props.labels,
      taints: props.taints,
      launchTemplate: props.launchTemplateSpec,
      releaseVersion: props.releaseVersion,
      remoteAccess: props.remoteAccess ? {
        ec2SshKey: props.remoteAccess.sshKeyName,
        sourceSecurityGroups: props.remoteAccess.sourceSecurityGroups ?
          props.remoteAccess.sourceSecurityGroups.map(m => m.securityGroupId) : undefined,
      } : undefined,
      scalingConfig: {
        desiredSize: this.desiredSize,
        maxSize: this.maxSize,
        minSize: this.minSize,
      },
      tags: props.tags,
    });

    // managed nodegroups update the `aws-auth` on creation, but we still need to track
    // its state for consistency.
    if (this.cluster instanceof Cluster) {
      // see https://docs.aws.amazon.com/en_us/eks/latest/userguide/add-user-role.html
      this.cluster.awsAuth.addRoleMapping(this.role, {
        username: 'system:node:{{EC2PrivateDNSName}}',
        groups: [
          'system:bootstrappers',
          'system:nodes',
        ],
      });
    }

    this.nodegroupArn = this.getResourceArnAttribute(resource.attrArn, {
      service: 'eks',
      resource: 'nodegroup',
      resourceName: this.physicalName,
    });
    this.nodegroupName = this.getResourceNameAttribute(resource.ref);
  }
}

function getAmiTypeForInstanceType(instanceType: InstanceType) {
  return INSTANCE_TYPES.graviton2.includes(instanceType.toString().substring(0, 3)) ? NodegroupAmiType.AL2_ARM_64 :
    INSTANCE_TYPES.graviton.includes(instanceType.toString().substring(0, 2)) ? NodegroupAmiType.AL2_ARM_64 :
      INSTANCE_TYPES.gpu.includes(instanceType.toString().substring(0, 2)) ? NodegroupAmiType.AL2_X86_64_GPU :
        INSTANCE_TYPES.inferentia.includes(instanceType.toString().substring(0, 4)) ? NodegroupAmiType.AL2_X86_64_GPU :
          NodegroupAmiType.AL2_X86_64;
}

// this function examines the CPU architecture of every instance type and determines
// what ami type is compatible for all of them. it either throws or produces a single value because
// instance types of different CPU architectures are not supported.
function getAmiType(instanceTypes: InstanceType[]) {
  const amiTypes = new Set(instanceTypes.map(i => getAmiTypeForInstanceType(i)));
  if (amiTypes.size == 0) { // protective code, the current implementation will never result in this.
    throw new Error(`Cannot determine any ami type comptaible with instance types: ${instanceTypes.map(i => i.toString).join(',')}`);
  }
  if (amiTypes.size > 1) {
    throw new Error('instanceTypes of different CPU architectures is not allowed');
  }
  return amiTypes.values().next().value;
}
