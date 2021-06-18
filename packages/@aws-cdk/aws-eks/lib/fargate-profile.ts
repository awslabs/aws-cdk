import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import { CustomResource, ITaggable, Lazy, TagManager, TagType } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { Cluster } from './cluster';
import { FARGATE_PROFILE_RESOURCE_TYPE } from './cluster-resource-handler/consts';
import { ClusterResourceProvider } from './cluster-resource-provider';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';

/**
 * Options for defining EKS Fargate Profiles.
 */
export interface FargateProfileOptions {
  /**
   * The name of the Fargate profile.
   * @default - generated
   */
  readonly fargateProfileName?: string;

  /**
   * The pod execution role to use for pods that match the selectors in the
   * Fargate profile. The pod execution role allows Fargate infrastructure to
   * register with your cluster as a node, and it provides read access to Amazon
   * ECR image repositories.
   *
   * @see https://docs.aws.amazon.com/eks/latest/userguide/pod-execution-role.html
   * @default - a role will be automatically created
   */
  readonly podExecutionRole?: iam.IRole;

  /**
   * The selectors to match for pods to use this Fargate profile. Each selector
   * must have an associated namespace. Optionally, you can also specify labels
   * for a namespace.
   *
   * At least one selector is required and you may specify up to five selectors.
   */
  readonly selectors: Selector[];

  /**
   * The VPC from which to select subnets to launch your pods into.
   *
   * By default, all private subnets are selected. You can customize this using
   * `subnetSelection`.
   *
   * @default - all private subnets used by theEKS cluster
   */
  readonly vpc?: ec2.IVpc;

  /**
   * Select which subnets to launch your pods into. At this time, pods running
   * on Fargate are not assigned public IP addresses, so only private subnets
   * (with no direct route to an Internet Gateway) are allowed.
   *
   * @default - all private subnets of the VPC are selected.
   */
  readonly subnetSelection?: ec2.SubnetSelection;
}

/**
 * Configuration props for EKS Fargate Profiles.
 */
export interface FargateProfileProps extends FargateProfileOptions {
  /**
   * The EKS cluster to apply the Fargate profile to.
   * [disable-awslint:ref-via-interface]
   */
  readonly cluster: Cluster;
}

/**
 * Fargate profile selector.
 */
export interface Selector {
  /**
   * The Kubernetes namespace that the selector should match.
   *
   * You must specify a namespace for a selector. The selector only matches pods
   * that are created in this namespace, but you can create multiple selectors
   * to target multiple namespaces.
   */
  readonly namespace: string;

  /**
   * The Kubernetes labels that the selector should match. A pod must contain
   * all of the labels that are specified in the selector for it to be
   * considered a match.
   *
   * @default - all pods within the namespace will be selected.
   */
  readonly labels?: { [key: string]: string };
}

/**
 * Fargate profiles allows an administrator to declare which pods run on
 * Fargate. This declaration is done through the profile’s selectors. Each
 * profile can have up to five selectors that contain a namespace and optional
 * labels. You must define a namespace for every selector. The label field
 * consists of multiple optional key-value pairs. Pods that match a selector (by
 * matching a namespace for the selector and all of the labels specified in the
 * selector) are scheduled on Fargate. If a namespace selector is defined
 * without any labels, Amazon EKS will attempt to schedule all pods that run in
 * that namespace onto Fargate using the profile. If a to-be-scheduled pod
 * matches any of the selectors in the Fargate profile, then that pod is
 * scheduled on Fargate.
 *
 * If a pod matches multiple Fargate profiles, Amazon EKS picks one of the
 * matches at random. In this case, you can specify which profile a pod should
 * use by adding the following Kubernetes label to the pod specification:
 * eks.amazonaws.com/fargate-profile: profile_name. However, the pod must still
 * match a selector in that profile in order to be scheduled onto Fargate.
 */
export class FargateProfile extends CoreConstruct implements ITaggable {
  /**
   * The full Amazon Resource Name (ARN) of the Fargate profile.
   *
   * @attribute
   */
  public readonly fargateProfileArn: string;

  /**
   * The name of the Fargate profile.
   *
   * @attribute
   */
  public readonly fargateProfileName: string;

  /**
   * Resource tags.
   */
  public readonly tags: TagManager;

  /**
   * The pod execution role to use for pods that match the selectors in the
   * Fargate profile. The pod execution role allows Fargate infrastructure to
   * register with your cluster as a node, and it provides read access to Amazon
   * ECR image repositories.
   */
  public readonly podExecutionRole: iam.IRole;

  constructor(scope: Construct, id: string, props: FargateProfileProps) {
    super(scope, id);

    const provider = ClusterResourceProvider.getOrCreate(this, {
      adminRole: props.cluster.adminRole,
    });

    this.podExecutionRole = props.podExecutionRole ?? new iam.Role(this, 'PodExecutionRole', {
      assumedBy: new iam.ServicePrincipal('eks-fargate-pods.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSFargatePodExecutionRolePolicy')],
    });

    this.podExecutionRole.grantPassRole(props.cluster.adminRole);

    let subnets: string[] | undefined;
    if (props.vpc) {
      const selection: ec2.SubnetSelection = props.subnetSelection ?? { subnetType: ec2.SubnetType.PRIVATE };
      subnets = props.vpc.selectSubnets(selection).subnetIds;
    }

    if (props.selectors.length < 1) {
      throw new Error('Fargate profile requires at least one selector');
    }

    if (props.selectors.length > 5) {
      throw new Error('Fargate profile supports up to five selectors');
    }

    this.tags = new TagManager(TagType.MAP, 'AWS::EKS::FargateProfile');

    const resource = new CustomResource(this, 'Resource', {
      serviceToken: provider.serviceToken,
      resourceType: FARGATE_PROFILE_RESOURCE_TYPE,
      properties: {
        AssumeRoleArn: props.cluster.adminRole.roleArn,
        Config: {
          clusterName: props.cluster.clusterName,
          fargateProfileName: props.fargateProfileName,
          podExecutionRoleArn: this.podExecutionRole.roleArn,
          selectors: props.selectors,
          subnets,
          tags: Lazy.any({ produce: () => this.tags.renderTags() }),
        },
      },
    });

    this.fargateProfileArn = resource.getAttString('fargateProfileArn');
    this.fargateProfileName = resource.ref;

    // Fargate profiles must be created sequentially. If other profile(s) already
    // exist on the same cluster, create a dependency to force sequential creation.
    const clusterFargateProfiles = props.cluster._attachFargateProfile(this);
    if (clusterFargateProfiles.length > 1) {
      const previousProfile = clusterFargateProfiles[clusterFargateProfiles.length - 2];
      resource.node.addDependency(previousProfile);
    }

    // map the fargate pod execution role to the relevant groups in rbac
    // see https://github.com/aws/aws-cdk/issues/7981
    props.cluster.awsAuth.addRoleMapping(this.podExecutionRole, {
      username: 'system:node:{{SessionName}}',
      groups: [
        'system:bootstrappers',
        'system:nodes',
        'system:node-proxier',
      ],
    });
  }
}
