import * as fs from 'fs';
import * as path from 'path';
import * as autoscaling from '@aws-cdk/aws-autoscaling';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import * as lambda from '@aws-cdk/aws-lambda';
import * as ssm from '@aws-cdk/aws-ssm';
import { Annotations, CfnOutput, CfnResource, IResource, Resource, Stack, Tags, Token, Duration, Size } from '@aws-cdk/core';
import { Construct, Node } from 'constructs';
import * as YAML from 'yaml';
import { AwsAuth } from './aws-auth';
import { ClusterResource, clusterArnComponents } from './cluster-resource';
import { FargateProfile, FargateProfileOptions } from './fargate-profile';
import { HelmChart, HelmChartOptions } from './helm-chart';
import { INSTANCE_TYPES } from './instance-types';
import { KubernetesManifest } from './k8s-manifest';
import { KubernetesObjectValue } from './k8s-object-value';
import { KubernetesPatch } from './k8s-patch';
import { KubectlProvider } from './kubectl-provider';
import { Nodegroup, NodegroupOptions } from './managed-nodegroup';
import { OpenIdConnectProvider } from './oidc-provider';
import { BottleRocketImage } from './private/bottlerocket';
import { ServiceAccount, ServiceAccountOptions } from './service-account';
import { LifecycleLabel, renderAmazonLinuxUserData, renderBottlerocketUserData } from './user-data';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';

// defaults are based on https://eksctl.io
const DEFAULT_CAPACITY_COUNT = 2;
const DEFAULT_CAPACITY_TYPE = ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.LARGE);

/**
 * An EKS cluster
 */
export interface ICluster extends IResource, ec2.IConnectable {
  /**
   * The VPC in which this Cluster was created
   */
  readonly vpc: ec2.IVpc;

  /**
   * The physical name of the Cluster
   * @attribute
   */
  readonly clusterName: string;

  /**
   * The unique ARN assigned to the service by AWS
   * in the form of arn:aws:eks:
   * @attribute
   */
  readonly clusterArn: string;

  /**
   * The API Server endpoint URL
   * @attribute
   */
  readonly clusterEndpoint: string;

  /**
   * The certificate-authority-data for your cluster.
   * @attribute
   */
  readonly clusterCertificateAuthorityData: string;

  /**
   * The id of the cluster security group that was created by Amazon EKS for the cluster.
   * @attribute
   */
  readonly clusterSecurityGroupId: string;

  /**
   * The cluster security group that was created by Amazon EKS for the cluster.
   * @attribute
   */
  readonly clusterSecurityGroup: ec2.ISecurityGroup;

  /**
   * Amazon Resource Name (ARN) or alias of the customer master key (CMK).
   * @attribute
   */
  readonly clusterEncryptionConfigKeyArn: string;

  /**
   * The Open ID Connect Provider of the cluster used to configure Service Accounts.
   */
  readonly openIdConnectProvider: iam.IOpenIdConnectProvider;

  /**
   * An IAM role that can perform kubectl operations against this cluster.
   *
   * The role should be mapped to the `system:masters` Kubernetes RBAC role.
   */
  readonly kubectlRole?: iam.IRole;

  /**
   * Custom environment variables when running `kubectl` against this cluster.
   */
  readonly kubectlEnvironment?: { [key: string]: string };

  /**
   * A security group to use for `kubectl` execution.
   *
   * If this is undefined, the k8s endpoint is expected to be accessible
   * publicly.
   */
  readonly kubectlSecurityGroup?: ec2.ISecurityGroup;

  /**
   * Subnets to host the `kubectl` compute resources.
   *
   * If this is undefined, the k8s endpoint is expected to be accessible
   * publicly.
   */
  readonly kubectlPrivateSubnets?: ec2.ISubnet[];

  /**
   * An AWS Lambda layer that includes `kubectl`, `helm` and the `aws` CLI.
   *
   * If not defined, a default layer will be used.
   */
  readonly kubectlLayer?: lambda.ILayerVersion;

  /**
   * Amount of memory to allocate to the provider's lambda function.
   */
  readonly kubectlMemory?: Size;

  /**
   * Indicates whether Kubernetes resources can be automatically pruned. When
   * this is enabled (default), prune labels will be allocated and injected to
   * each resource. These labels will then be used when issuing the `kubectl
   * apply` operation with the `--prune` switch.
   */
  readonly prune: boolean;

  /**
   * Creates a new service account with corresponding IAM Role (IRSA).
   *
   * @param id logical id of service account
   * @param options service account options
   */
  addServiceAccount(id: string, options?: ServiceAccountOptions): ServiceAccount;

  /**
   * Defines a Kubernetes resource in this cluster.
   *
   * The manifest will be applied/deleted using kubectl as needed.
   *
   * @param id logical id of this manifest
   * @param manifest a list of Kubernetes resource specifications
   * @returns a `KubernetesManifest` object.
   */
  addManifest(id: string, ...manifest: Record<string, any>[]): KubernetesManifest;

  /**
   * Defines a Helm chart in this cluster.
   *
   * @param id logical id of this chart.
   * @param options options of this chart.
   * @returns a `HelmChart` construct
   */
  addHelmChart(id: string, options: HelmChartOptions): HelmChart;

  /**
   * Defines a CDK8s chart in this cluster.
   *
   * @param id logical id of this chart.
   * @param chart the cdk8s chart.
   * @returns a `KubernetesManifest` construct representing the chart.
   */
  addCdk8sChart(id: string, chart: Construct): KubernetesManifest;

}

/**
 * Attributes for EKS clusters.
 */
export interface ClusterAttributes {
  /**
   * The VPC in which this Cluster was created
   * @default - if not specified `cluster.vpc` will throw an error
   */
  readonly vpc?: ec2.IVpc;

  /**
   * The physical name of the Cluster
   */
  readonly clusterName: string;

  /**
   * The API Server endpoint URL
   * @default - if not specified `cluster.clusterEndpoint` will throw an error.
   */
  readonly clusterEndpoint?: string;

  /**
   * The certificate-authority-data for your cluster.
   * @default - if not specified `cluster.clusterCertificateAuthorityData` will
   * throw an error
   */
  readonly clusterCertificateAuthorityData?: string;

  /**
   * The cluster security group that was created by Amazon EKS for the cluster.
   * @default - if not specified `cluster.clusterSecurityGroupId` will throw an
   * error
   */
  readonly clusterSecurityGroupId?: string;

  /**
   * Amazon Resource Name (ARN) or alias of the customer master key (CMK).
   * @default - if not specified `cluster.clusterEncryptionConfigKeyArn` will
   * throw an error
   */
  readonly clusterEncryptionConfigKeyArn?: string;

  /**
   * Additional security groups associated with this cluster.
   * @default - if not specified, no additional security groups will be
   * considered in `cluster.connections`.
   */
  readonly securityGroupIds?: string[];

  /**
   * An IAM role with cluster administrator and "system:masters" permissions.
   * @default - if not specified, it not be possible to issue `kubectl` commands
   * against an imported cluster.
   */
  readonly kubectlRoleArn?: string;

  /**
   * Environment variables to use when running `kubectl` against this cluster.
   * @default - no additional variables
   */
  readonly kubectlEnvironment?: { [name: string]: string };

  /**
   * A security group to use for `kubectl` execution. If not specified, the k8s
   * endpoint is expected to be accessible publicly.
   * @default - k8s endpoint is expected to be accessible publicly
   */
  readonly kubectlSecurityGroupId?: string;

  /**
   * Subnets to host the `kubectl` compute resources. If not specified, the k8s
   * endpoint is expected to be accessible publicly.
   * @default - k8s endpoint is expected to be accessible publicly
   */
  readonly kubectlPrivateSubnetIds?: string[];

  /**
   * An Open ID Connect provider for this cluster that can be used to configure service accounts.
   * You can either import an existing provider using `iam.OpenIdConnectProvider.fromProviderArn`,
   * or create a new provider using `new eks.OpenIdConnectProvider`
   * @default - if not specified `cluster.openIdConnectProvider` and `cluster.addServiceAccount` will throw an error.
   */
  readonly openIdConnectProvider?: iam.IOpenIdConnectProvider;

  /**
   * An AWS Lambda Layer which includes `kubectl`, Helm and the AWS CLI. This layer
   * is used by the kubectl handler to apply manifests and install helm charts.
   *
   * The handler expects the layer to include the following executables:
   *
   *    helm/helm
   *    kubectl/kubectl
   *    awscli/aws
   *
   * @default - a layer bundled with this module.
   */
  readonly kubectlLayer?: lambda.ILayerVersion;

  /**
   * Amount of memory to allocate to the provider's lambda function.
   *
   * @default Size.gibibytes(1)
   */
  readonly kubectlMemory?: Size;

  /**
   * Indicates whether Kubernetes resources added through `addManifest()` can be
   * automatically pruned. When this is enabled (default), prune labels will be
   * allocated and injected to each resource. These labels will then be used
   * when issuing the `kubectl apply` operation with the `--prune` switch.
   *
   * @default true
   */
  readonly prune?: boolean;
}

/**
 * Options for configuring an EKS cluster.
 */
export interface CommonClusterOptions {
  /**
   * The VPC in which to create the Cluster.
   *
   * @default - a VPC with default configuration will be created and can be accessed through `cluster.vpc`.
   */
  readonly vpc?: ec2.IVpc;

  /**
   * Where to place EKS Control Plane ENIs
   *
   * If you want to create public load balancers, this must include public subnets.
   *
   * For example, to only select private subnets, supply the following:
   *
   * ```ts
   * vpcSubnets: [
   *   { subnetType: ec2.SubnetType.Private }
   * ]
   * ```
   *
   * @default - All public and private subnets
   */
  readonly vpcSubnets?: ec2.SubnetSelection[];

  /**
   * Role that provides permissions for the Kubernetes control plane to make calls to AWS API operations on your behalf.
   *
   * @default - A role is automatically created for you
   */
  readonly role?: iam.IRole;

  /**
   * Name for the cluster.
   *
   * @default - Automatically generated name
   */
  readonly clusterName?: string;

  /**
   * Security Group to use for Control Plane ENIs
   *
   * @default - A security group is automatically created
   */
  readonly securityGroup?: ec2.ISecurityGroup;

  /**
   * The Kubernetes version to run in the cluster
   */
  readonly version: KubernetesVersion;

  /**
   * Determines whether a CloudFormation output with the name of the cluster
   * will be synthesized.
   *
   * @default false
   */
  readonly outputClusterName?: boolean;

  /**
   * Determines whether a CloudFormation output with the `aws eks
   * update-kubeconfig` command will be synthesized. This command will include
   * the cluster name and, if applicable, the ARN of the masters IAM role.
   *
   * @default true
   */
  readonly outputConfigCommand?: boolean;
}

/**
 * Options for EKS clusters.
 */
export interface ClusterOptions extends CommonClusterOptions {
  /**
   * An IAM role that will be added to the `system:masters` Kubernetes RBAC
   * group.
   *
   * @see https://kubernetes.io/docs/reference/access-authn-authz/rbac/#default-roles-and-role-bindings
   *
   * @default - a role that assumable by anyone with permissions in the same
   * account will automatically be defined
   */
  readonly mastersRole?: iam.IRole;

  /**
   * Controls the "eks.amazonaws.com/compute-type" annotation in the CoreDNS
   * configuration on your cluster to determine which compute type to use
   * for CoreDNS.
   *
   * @default CoreDnsComputeType.EC2 (for `FargateCluster` the default is FARGATE)
   */
  readonly coreDnsComputeType?: CoreDnsComputeType;

  /**
   * Determines whether a CloudFormation output with the ARN of the "masters"
   * IAM role will be synthesized (if `mastersRole` is specified).
   *
   * @default false
   */
  readonly outputMastersRoleArn?: boolean;

  /**
   * Configure access to the Kubernetes API server endpoint..
   *
   * @see https://docs.aws.amazon.com/eks/latest/userguide/cluster-endpoint.html
   *
   * @default EndpointAccess.PUBLIC_AND_PRIVATE
   */
  readonly endpointAccess?: EndpointAccess;

  /**
   * Environment variables for the kubectl execution. Only relevant for kubectl enabled clusters.
   *
   * @default - No environment variables.
   */
  readonly kubectlEnvironment?: { [key: string]: string };

  /**
   * Custom environment variables when interacting with the EKS endpoint to manage the cluster lifecycle.
   *
   * @default - No environment variables.
   */
  readonly clusterHandlerEnvironment?: { [key: string]: string };

  /**
   * An AWS Lambda Layer which includes `kubectl`, Helm and the AWS CLI.
   *
   * By default, the provider will use the layer included in the
   * "aws-lambda-layer-kubectl" SAR application which is available in all
   * commercial regions.
   *
   * To deploy the layer locally, visit
   * https://github.com/aws-samples/aws-lambda-layer-kubectl/blob/master/cdk/README.md
   * for instructions on how to prepare the .zip file and then define it in your
   * app as follows:
   *
   * ```ts
   * const layer = new lambda.LayerVersion(this, 'kubectl-layer', {
   *   code: lambda.Code.fromAsset(`${__dirname}/layer.zip`)),
   *   compatibleRuntimes: [lambda.Runtime.PROVIDED]
   * })
   * ```
   *
   * @default - the layer provided by the `aws-lambda-layer-kubectl` SAR app.
   * @see https://github.com/aws-samples/aws-lambda-layer-kubectl
   */
  readonly kubectlLayer?: lambda.ILayerVersion;

  /**
   * Amount of memory to allocate to the provider's lambda function.
   *
   * @default Size.gibibytes(1)
   */
  readonly kubectlMemory?: Size;

  /**
   * Indicates whether Kubernetes resources added through `addManifest()` can be
   * automatically pruned. When this is enabled (default), prune labels will be
   * allocated and injected to each resource. These labels will then be used
   * when issuing the `kubectl apply` operation with the `--prune` switch.
   *
   * @default true
   */
  readonly prune?: boolean;

  /**
   * If set to true, the cluster handler functions will be placed in the private subnets
   * of the cluster vpc, subject to the `vpcSubnets` selection strategy.
   *
   * @default false
   */
  readonly placeClusterHandlerInVpc?: boolean;

  /**
   * KMS secret for envelope encryption for Kubernetes secrets.
   *
   * @default - By default, Kubernetes stores all secret object data within etcd and
   *            all etcd volumes used by Amazon EKS are encrypted at the disk-level
   *            using AWS-Managed encryption keys.
   */
  readonly secretsEncryptionKey?: kms.IKey;
}

/**
 * Group access configuration together.
 */
interface EndpointAccessConfig {

  /**
   * Indicates if private access is enabled.
   */
  readonly privateAccess: boolean;

  /**
   * Indicates if public access is enabled.
   */
  readonly publicAccess: boolean;
  /**
   * Public access is allowed only from these CIDR blocks.
   * An empty array means access is open to any address.
   *
   * @default - No restrictions.
   */
  readonly publicCidrs?: string[];

}

/**
 * Endpoint access characteristics.
 */
export class EndpointAccess {

  /**
   * The cluster endpoint is accessible from outside of your VPC.
   * Worker node traffic will leave your VPC to connect to the endpoint.
   *
   * By default, the endpoint is exposed to all adresses. You can optionally limit the CIDR blocks that can access the public endpoint using the `PUBLIC.onlyFrom` method.
   * If you limit access to specific CIDR blocks, you must ensure that the CIDR blocks that you
   * specify include the addresses that worker nodes and Fargate pods (if you use them)
   * access the public endpoint from.
   *
   * @param cidr The CIDR blocks.
   */
  public static readonly PUBLIC = new EndpointAccess({ privateAccess: false, publicAccess: true });

  /**
   * The cluster endpoint is only accessible through your VPC.
   * Worker node traffic to the endpoint will stay within your VPC.
   */
  public static readonly PRIVATE = new EndpointAccess({ privateAccess: true, publicAccess: false });

  /**
   * The cluster endpoint is accessible from outside of your VPC.
   * Worker node traffic to the endpoint will stay within your VPC.
   *
   * By default, the endpoint is exposed to all adresses. You can optionally limit the CIDR blocks that can access the public endpoint using the `PUBLIC_AND_PRIVATE.onlyFrom` method.
   * If you limit access to specific CIDR blocks, you must ensure that the CIDR blocks that you
   * specify include the addresses that worker nodes and Fargate pods (if you use them)
   * access the public endpoint from.
   *
   * @param cidr The CIDR blocks.
   */
  public static readonly PUBLIC_AND_PRIVATE = new EndpointAccess({ privateAccess: true, publicAccess: true });

  private constructor(
    /**
     * Configuration properties.
     *
     * @internal
     */
    public readonly _config: EndpointAccessConfig) {
    if (!_config.publicAccess && _config.publicCidrs && _config.publicCidrs.length > 0) {
      throw new Error('CIDR blocks can only be configured when public access is enabled');
    }
  }


  /**
   * Restrict public access to specific CIDR blocks.
   * If public access is disabled, this method will result in an error.
   *
   * @param cidr CIDR blocks.
   */
  public onlyFrom(...cidr: string[]) {
    if (!this._config.privateAccess) {
      // when private access is disabled, we can't restric public
      // access since it will render the kubectl provider unusable.
      throw new Error('Cannot restric public access to endpoint when private access is disabled. Use PUBLIC_AND_PRIVATE.onlyFrom() instead.');
    }
    return new EndpointAccess({
      ...this._config,
      // override CIDR
      publicCidrs: cidr,
    });
  }
}

/**
 * Common configuration props for EKS clusters.
 */
export interface ClusterProps extends ClusterOptions {

  /**
   * Number of instances to allocate as an initial capacity for this cluster.
   * Instance type can be configured through `defaultCapacityInstanceType`,
   * which defaults to `m5.large`.
   *
   * Use `cluster.addAutoScalingGroupCapacity` to add additional customized capacity. Set this
   * to `0` is you wish to avoid the initial capacity allocation.
   *
   * @default 2
   */
  readonly defaultCapacity?: number;

  /**
   * The instance type to use for the default capacity. This will only be taken
   * into account if `defaultCapacity` is > 0.
   *
   * @default m5.large
   */
  readonly defaultCapacityInstance?: ec2.InstanceType;

  /**
   * The default capacity type for the cluster.
   *
   * @default NODEGROUP
   */
  readonly defaultCapacityType?: DefaultCapacityType;
}

/**
 * Kubernetes cluster version
 */
export class KubernetesVersion {
  /**
   * Kubernetes version 1.14
   */
  public static readonly V1_14 = KubernetesVersion.of('1.14');

  /**
   * Kubernetes version 1.15
   */
  public static readonly V1_15 = KubernetesVersion.of('1.15');

  /**
   * Kubernetes version 1.16
   */
  public static readonly V1_16 = KubernetesVersion.of('1.16');

  /**
   * Kubernetes version 1.17
   */
  public static readonly V1_17 = KubernetesVersion.of('1.17');

  /**
   * Kubernetes version 1.18
   */
  public static readonly V1_18 = KubernetesVersion.of('1.18');

  /**
   * Kubernetes version 1.19
   */
  public static readonly V1_19 = KubernetesVersion.of('1.19');

  /**
   * Custom cluster version
   * @param version custom version number
   */
  public static of(version: string) { return new KubernetesVersion(version); }
  /**
   *
   * @param version cluster version number
   */
  private constructor(public readonly version: string) { }
}

abstract class ClusterBase extends Resource implements ICluster {
  public abstract readonly connections: ec2.Connections;
  public abstract readonly vpc: ec2.IVpc;
  public abstract readonly clusterName: string;
  public abstract readonly clusterArn: string;
  public abstract readonly clusterEndpoint: string;
  public abstract readonly clusterCertificateAuthorityData: string;
  public abstract readonly clusterSecurityGroupId: string;
  public abstract readonly clusterSecurityGroup: ec2.ISecurityGroup;
  public abstract readonly clusterEncryptionConfigKeyArn: string;
  public abstract readonly kubectlRole?: iam.IRole;
  public abstract readonly kubectlEnvironment?: { [key: string]: string };
  public abstract readonly kubectlSecurityGroup?: ec2.ISecurityGroup;
  public abstract readonly kubectlPrivateSubnets?: ec2.ISubnet[];
  public abstract readonly kubectlMemory?: Size;
  public abstract readonly prune: boolean;
  public abstract readonly openIdConnectProvider: iam.IOpenIdConnectProvider;

  /**
   * Defines a Kubernetes resource in this cluster.
   *
   * The manifest will be applied/deleted using kubectl as needed.
   *
   * @param id logical id of this manifest
   * @param manifest a list of Kubernetes resource specifications
   * @returns a `KubernetesResource` object.
   */
  public addManifest(id: string, ...manifest: Record<string, any>[]): KubernetesManifest {
    return new KubernetesManifest(this, `manifest-${id}`, { cluster: this, manifest });
  }

  /**
   * Defines a Helm chart in this cluster.
   *
   * @param id logical id of this chart.
   * @param options options of this chart.
   * @returns a `HelmChart` construct
   */
  public addHelmChart(id: string, options: HelmChartOptions): HelmChart {
    return new HelmChart(this, `chart-${id}`, { cluster: this, ...options });
  }

  /**
   * Defines a CDK8s chart in this cluster.
   *
   * @param id logical id of this chart.
   * @param chart the cdk8s chart.
   * @returns a `KubernetesManifest` construct representing the chart.
   */
  public addCdk8sChart(id: string, chart: Construct): KubernetesManifest {

    const cdk8sChart = chart as any;

    // see https://github.com/awslabs/cdk8s/blob/master/packages/cdk8s/src/chart.ts#L84
    if (typeof cdk8sChart.toJson !== 'function') {
      throw new Error(`Invalid cdk8s chart. Must contain a 'toJson' method, but found ${typeof cdk8sChart.toJson}`);
    }

    return this.addManifest(id, ...cdk8sChart.toJson());
  }

  public addServiceAccount(id: string, options: ServiceAccountOptions = {}): ServiceAccount {
    return new ServiceAccount(this, id, {
      ...options,
      cluster: this,
    });
  }
}

/**
 * Options for fetching a ServiceLoadBalancerAddress.
 */
export interface ServiceLoadBalancerAddressOptions {

  /**
   * Timeout for waiting on the load balancer address.
   *
   * @default Duration.minutes(5)
   */
  readonly timeout?: Duration;

  /**
   * The namespace the service belongs to.
   *
   * @default 'default'
   */
  readonly namespace?: string;

}

/**
 * A Cluster represents a managed Kubernetes Service (EKS)
 *
 * This is a fully managed cluster of API Servers (control-plane)
 * The user is still required to create the worker nodes.
 */
export class Cluster extends ClusterBase {
  /**
   * Import an existing cluster
   *
   * @param scope the construct scope, in most cases 'this'
   * @param id the id or name to import as
   * @param attrs the cluster properties to use for importing information
   */
  public static fromClusterAttributes(scope: Construct, id: string, attrs: ClusterAttributes): ICluster {
    return new ImportedCluster(scope, id, attrs);
  }

  /**
   * The VPC in which this Cluster was created
   */
  public readonly vpc: ec2.IVpc;

  /**
   * The Name of the created EKS Cluster
   */
  public readonly clusterName: string;

  /**
   * The AWS generated ARN for the Cluster resource
   *
   * @example arn:aws:eks:us-west-2:666666666666:cluster/prod
   */
  public readonly clusterArn: string;

  /**
   * The endpoint URL for the Cluster
   *
   * This is the URL inside the kubeconfig file to use with kubectl
   *
   * @example https://5E1D0CEXAMPLEA591B746AFC5AB30262.yl4.us-west-2.eks.amazonaws.com
   */
  public readonly clusterEndpoint: string;

  /**
   * The certificate-authority-data for your cluster.
   */
  public readonly clusterCertificateAuthorityData: string;

  /**
   * The id of the cluster security group that was created by Amazon EKS for the cluster.
   */
  public readonly clusterSecurityGroupId: string;

  /**
   * The cluster security group that was created by Amazon EKS for the cluster.
   */
  public readonly clusterSecurityGroup: ec2.ISecurityGroup;

  /**
   * Amazon Resource Name (ARN) or alias of the customer master key (CMK).
   */
  public readonly clusterEncryptionConfigKeyArn: string;

  /**
   * Manages connection rules (Security Group Rules) for the cluster
   *
   * @type {ec2.Connections}
   * @memberof Cluster
   */
  public readonly connections: ec2.Connections;

  /**
   * IAM role assumed by the EKS Control Plane
   */
  public readonly role: iam.IRole;

  /**
   * The auto scaling group that hosts the default capacity for this cluster.
   * This will be `undefined` if the `defaultCapacityType` is not `EC2` or
   * `defaultCapacityType` is `EC2` but default capacity is set to 0.
   */
  public readonly defaultCapacity?: autoscaling.AutoScalingGroup;

  /**
   * The node group that hosts the default capacity for this cluster.
   * This will be `undefined` if the `defaultCapacityType` is `EC2` or
   * `defaultCapacityType` is `NODEGROUP` but default capacity is set to 0.
   */
  public readonly defaultNodegroup?: Nodegroup;

  /**
   * An IAM role that can perform kubectl operations against this cluster.
   *
   * The role should be mapped to the `system:masters` Kubernetes RBAC role.
   */
  public readonly kubectlRole?: iam.IRole;

  /**
   * Custom environment variables when running `kubectl` against this cluster.
   */
  public readonly kubectlEnvironment?: { [key: string]: string };

  /**
   * A security group to use for `kubectl` execution.
   *
   * @default - If not specified, the k8s endpoint is expected to be accessible
   * publicly.
   */
  public readonly kubectlSecurityGroup?: ec2.ISecurityGroup;

  /**
   * Subnets to host the `kubectl` compute resources.
   *
   * @default - If not specified, the k8s endpoint is expected to be accessible
   * publicly.
   */
  public readonly kubectlPrivateSubnets?: ec2.ISubnet[];

  /**
   * An IAM role with administrative permissions to create or update the
   * cluster. This role also has `systems:master` permissions.
   */
  public readonly adminRole: iam.Role;

  /**
   * If the cluster has one (or more) FargateProfiles associated, this array
   * will hold a reference to each.
   */
  private readonly _fargateProfiles: FargateProfile[] = [];

  /**
   * an Open ID Connect Provider instance
   */
  private _openIdConnectProvider?: iam.IOpenIdConnectProvider;

  /**
   * The AWS Lambda layer that contains `kubectl`, `helm` and the AWS CLI. If
   * undefined, a SAR app that contains this layer will be used.
   */
  public readonly kubectlLayer?: lambda.ILayerVersion;

  /**
   * The amount of memory allocated to the kubectl provider's lambda function.
   */
  public readonly kubectlMemory?: Size;

  /**
   * Determines if Kubernetes resources can be pruned automatically.
   */
  public readonly prune: boolean;

  /**
   * If this cluster is kubectl-enabled, returns the `ClusterResource` object
   * that manages it. If this cluster is not kubectl-enabled (i.e. uses the
   * stock `CfnCluster`), this is `undefined`.
   */
  private readonly _clusterResource: ClusterResource;

  /**
   * Manages the aws-auth config map.
   */
  private _awsAuth?: AwsAuth;

  private _spotInterruptHandler?: HelmChart;

  private _neuronDevicePlugin?: KubernetesManifest;

  private readonly endpointAccess: EndpointAccess;

  private readonly vpcSubnets: ec2.SubnetSelection[];

  private readonly version: KubernetesVersion;

  /**
   * A dummy CloudFormation resource that is used as a wait barrier which
   * represents that the cluster is ready to receive "kubectl" commands.
   *
   * Specifically, all fargate profiles are automatically added as a dependency
   * of this barrier, which means that it will only be "signaled" when all
   * fargate profiles have been successfully created.
   *
   * When kubectl resources call `_attachKubectlResourceScope()`, this resource
   * is added as their dependency which implies that they can only be deployed
   * after the cluster is ready.
   */
  private readonly _kubectlReadyBarrier: CfnResource;

  private readonly _kubectlResourceProvider: KubectlProvider;

  /**
   * Initiates an EKS Cluster with the supplied arguments
   *
   * @param scope a Construct, most likely a cdk.Stack created
   * @param id the id of the Construct to create
   * @param props properties in the IClusterProps interface
   */
  constructor(scope: Construct, id: string, props: ClusterProps) {
    super(scope, id, {
      physicalName: props.clusterName,
    });

    const stack = Stack.of(this);

    this.prune = props.prune ?? true;
    this.vpc = props.vpc || new ec2.Vpc(this, 'DefaultVpc');
    this.version = props.version;

    this.tagSubnets();

    // this is the role used by EKS when interacting with AWS resources
    this.role = props.role || new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('eks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSClusterPolicy'),
      ],
    });

    const securityGroup = props.securityGroup || new ec2.SecurityGroup(this, 'ControlPlaneSecurityGroup', {
      vpc: this.vpc,
      description: 'EKS Control Plane Security Group',
    });

    this.vpcSubnets = props.vpcSubnets ?? [{ subnetType: ec2.SubnetType.PUBLIC }, { subnetType: ec2.SubnetType.PRIVATE }];

    const selectedSubnetIdsPerGroup = this.vpcSubnets.map(s => this.vpc.selectSubnets(s).subnetIds);
    if (selectedSubnetIdsPerGroup.some(Token.isUnresolved) && selectedSubnetIdsPerGroup.length > 1) {
      throw new Error('eks.Cluster: cannot select multiple subnet groups from a VPC imported from list tokens with unknown length. Select only one subnet group, pass a length to Fn.split, or switch to Vpc.fromLookup.');
    }

    // Get subnetIds for all selected subnets
    const subnetIds = Array.from(new Set(flatten(selectedSubnetIdsPerGroup)));


    this.endpointAccess = props.endpointAccess ?? EndpointAccess.PUBLIC_AND_PRIVATE;
    this.kubectlEnvironment = props.kubectlEnvironment;
    this.kubectlLayer = props.kubectlLayer;
    this.kubectlMemory = props.kubectlMemory;

    const privateSubents = this.selectPrivateSubnets().slice(0, 16);
    const publicAccessDisabled = !this.endpointAccess._config.publicAccess;
    const publicAccessRestricted = !publicAccessDisabled
      && this.endpointAccess._config.publicCidrs
      && this.endpointAccess._config.publicCidrs.length !== 0;

    // validate endpoint access configuration

    if (privateSubents.length === 0 && publicAccessDisabled) {
      // no private subnets and no public access at all, no good.
      throw new Error('Vpc must contain private subnets when public endpoint access is disabled');
    }

    if (privateSubents.length === 0 && publicAccessRestricted) {
      // no private subents and public access is restricted, no good.
      throw new Error('Vpc must contain private subnets when public endpoint access is restricted');
    }

    const placeClusterHandlerInVpc = props.placeClusterHandlerInVpc ?? false;

    if (placeClusterHandlerInVpc && privateSubents.length === 0) {
      throw new Error('Cannot place cluster handler in the VPC since no private subnets could be selected');
    }

    const resource = this._clusterResource = new ClusterResource(this, 'Resource', {
      name: this.physicalName,
      environment: props.clusterHandlerEnvironment,
      roleArn: this.role.roleArn,
      version: props.version.version,
      resourcesVpcConfig: {
        securityGroupIds: [securityGroup.securityGroupId],
        subnetIds,
      },
      ...(props.secretsEncryptionKey ? {
        encryptionConfig: [{
          provider: {
            keyArn: props.secretsEncryptionKey.keyArn,
          },
          resources: ['secrets'],
        }],
      } : {}),
      endpointPrivateAccess: this.endpointAccess._config.privateAccess,
      endpointPublicAccess: this.endpointAccess._config.publicAccess,
      publicAccessCidrs: this.endpointAccess._config.publicCidrs,
      secretsEncryptionKey: props.secretsEncryptionKey,
      vpc: this.vpc,
      subnets: placeClusterHandlerInVpc ? privateSubents : undefined,
    });

    if (this.endpointAccess._config.privateAccess && privateSubents.length !== 0) {

      // when private access is enabled and the vpc has private subnets, lets connect
      // the provider to the vpc so that it will work even when restricting public access.

      // validate VPC properties according to: https://docs.aws.amazon.com/eks/latest/userguide/cluster-endpoint.html
      if (this.vpc instanceof ec2.Vpc && !(this.vpc.dnsHostnamesEnabled && this.vpc.dnsSupportEnabled)) {
        throw new Error('Private endpoint access requires the VPC to have DNS support and DNS hostnames enabled. Use `enableDnsHostnames: true` and `enableDnsSupport: true` when creating the VPC.');
      }

      this.kubectlPrivateSubnets = privateSubents;

      // the vpc must exist in order to properly delete the cluster (since we run `kubectl delete`).
      // this ensures that.
      this._clusterResource.node.addDependency(this.vpc);
    }

    this.adminRole = resource.adminRole;

    // we use an SSM parameter as a barrier because it's free and fast.
    this._kubectlReadyBarrier = new CfnResource(this, 'KubectlReadyBarrier', {
      type: 'AWS::SSM::Parameter',
      properties: {
        Type: 'String',
        Value: 'aws:cdk:eks:kubectl-ready',
      },
    });

    // add the cluster resource itself as a dependency of the barrier
    this._kubectlReadyBarrier.node.addDependency(this._clusterResource);

    this.clusterName = this.getResourceNameAttribute(resource.ref);
    this.clusterArn = this.getResourceArnAttribute(resource.attrArn, clusterArnComponents(this.physicalName));

    this.clusterEndpoint = resource.attrEndpoint;
    this.clusterCertificateAuthorityData = resource.attrCertificateAuthorityData;
    this.clusterSecurityGroupId = resource.attrClusterSecurityGroupId;
    this.clusterEncryptionConfigKeyArn = resource.attrEncryptionConfigKeyArn;

    this.clusterSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, 'ClusterSecurityGroup', this.clusterSecurityGroupId);

    this.connections = new ec2.Connections({
      securityGroups: [this.clusterSecurityGroup, securityGroup],
      defaultPort: ec2.Port.tcp(443), // Control Plane has an HTTPS API
    });

    // we can use the cluster security group since its already attached to the cluster
    // and configured to allow connections from itself.
    this.kubectlSecurityGroup = this.clusterSecurityGroup;

    // use the cluster creation role to issue kubectl commands against the cluster because when the
    // cluster is first created, that's the only role that has "system:masters" permissions
    this.kubectlRole = this.adminRole;

    this._kubectlResourceProvider = this.defineKubectlProvider();

    const updateConfigCommandPrefix = `aws eks update-kubeconfig --name ${this.clusterName}`;
    const getTokenCommandPrefix = `aws eks get-token --cluster-name ${this.clusterName}`;
    const commonCommandOptions = [`--region ${stack.region}`];

    if (props.outputClusterName) {
      new CfnOutput(this, 'ClusterName', { value: this.clusterName });
    }

    // if an explicit role is not configured, define a masters role that can
    // be assumed by anyone in the account (with sts:AssumeRole permissions of
    // course)
    const mastersRole = props.mastersRole ?? new iam.Role(this, 'MastersRole', {
      assumedBy: new iam.AccountRootPrincipal(),
    });

    // map the IAM role to the `system:masters` group.
    this.awsAuth.addMastersRole(mastersRole);

    if (props.outputMastersRoleArn) {
      new CfnOutput(this, 'MastersRoleArn', { value: mastersRole.roleArn });
    }

    commonCommandOptions.push(`--role-arn ${mastersRole.roleArn}`);

    // allocate default capacity if non-zero (or default).
    const minCapacity = props.defaultCapacity ?? DEFAULT_CAPACITY_COUNT;
    if (minCapacity > 0) {
      const instanceType = props.defaultCapacityInstance || DEFAULT_CAPACITY_TYPE;
      this.defaultCapacity = props.defaultCapacityType === DefaultCapacityType.EC2 ?
        this.addAutoScalingGroupCapacity('DefaultCapacity', { instanceType, minCapacity }) : undefined;

      this.defaultNodegroup = props.defaultCapacityType !== DefaultCapacityType.EC2 ?
        this.addNodegroupCapacity('DefaultCapacity', { instanceTypes: [instanceType], minSize: minCapacity }) : undefined;
    }

    const outputConfigCommand = props.outputConfigCommand ?? true;
    if (outputConfigCommand) {
      const postfix = commonCommandOptions.join(' ');
      new CfnOutput(this, 'ConfigCommand', { value: `${updateConfigCommandPrefix} ${postfix}` });
      new CfnOutput(this, 'GetTokenCommand', { value: `${getTokenCommandPrefix} ${postfix}` });
    }

    this.defineCoreDnsComputeType(props.coreDnsComputeType ?? CoreDnsComputeType.EC2);
  }

  /**
   * Fetch the load balancer address of a service of type 'LoadBalancer'.
   *
   * @param serviceName The name of the service.
   * @param options Additional operation options.
   */
  public getServiceLoadBalancerAddress(serviceName: string, options: ServiceLoadBalancerAddressOptions = {}): string {

    const loadBalancerAddress = new KubernetesObjectValue(this, `${serviceName}LoadBalancerAddress`, {
      cluster: this,
      objectType: 'service',
      objectName: serviceName,
      objectNamespace: options.namespace,
      jsonPath: '.status.loadBalancer.ingress[0].hostname',
      timeout: options.timeout,
    });

    return loadBalancerAddress.value;

  }

  /**
   * Add nodes to this EKS cluster
   *
   * The nodes will automatically be configured with the right VPC and AMI
   * for the instance type and Kubernetes version.
   *
   * Note that if you specify `updateType: RollingUpdate` or `updateType: ReplacingUpdate`, your nodes might be replaced at deploy
   * time without notice in case the recommended AMI for your machine image type has been updated by AWS.
   * The default behavior for `updateType` is `None`, which means only new instances will be launched using the new AMI.
   *
   * Spot instances will be labeled `lifecycle=Ec2Spot` and tainted with `PreferNoSchedule`.
   * In addition, the [spot interrupt handler](https://github.com/awslabs/ec2-spot-labs/tree/master/ec2-spot-eks-solution/spot-termination-handler)
   * daemon will be installed on all spot instances to handle
   * [EC2 Spot Instance Termination Notices](https://aws.amazon.com/blogs/aws/new-ec2-spot-instance-termination-notices/).
   */
  public addAutoScalingGroupCapacity(id: string, options: AutoScalingGroupCapacityOptions): autoscaling.AutoScalingGroup {
    if (options.machineImageType === MachineImageType.BOTTLEROCKET && options.bootstrapOptions !== undefined) {
      throw new Error('bootstrapOptions is not supported for Bottlerocket');
    }
    const asg = new autoscaling.AutoScalingGroup(this, id, {
      ...options,
      vpc: this.vpc,
      machineImage: options.machineImageType === MachineImageType.BOTTLEROCKET ?
        new BottleRocketImage({
          kubernetesVersion: this.version.version,
        }) :
        new EksOptimizedImage({
          nodeType: nodeTypeForInstanceType(options.instanceType),
          cpuArch: cpuArchForInstanceType(options.instanceType),
          kubernetesVersion: this.version.version,
        }),
      updateType: options.updateType,
      instanceType: options.instanceType,
    });

    this.connectAutoScalingGroupCapacity(asg, {
      mapRole: options.mapRole,
      bootstrapOptions: options.bootstrapOptions,
      bootstrapEnabled: options.bootstrapEnabled,
      machineImageType: options.machineImageType,
      spotInterruptHandler: options.spotInterruptHandler,
    });

    if (nodeTypeForInstanceType(options.instanceType) === NodeType.INFERENTIA) {
      this.addNeuronDevicePlugin();
    }

    return asg;
  }

  /**
   * Add managed nodegroup to this Amazon EKS cluster
   *
   * This method will create a new managed nodegroup and add into the capacity.
   *
   * @see https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html
   * @param id The ID of the nodegroup
   * @param options options for creating a new nodegroup
   */
  public addNodegroupCapacity(id: string, options?: NodegroupOptions): Nodegroup {
    return new Nodegroup(this, `Nodegroup${id}`, {
      cluster: this,
      ...options,
    });
  }

  /**
   * Connect capacity in the form of an existing AutoScalingGroup to the EKS cluster.
   *
   * The AutoScalingGroup must be running an EKS-optimized AMI containing the
   * /etc/eks/bootstrap.sh script. This method will configure Security Groups,
   * add the right policies to the instance role, apply the right tags, and add
   * the required user data to the instance's launch configuration.
   *
   * Spot instances will be labeled `lifecycle=Ec2Spot` and tainted with `PreferNoSchedule`.
   * If kubectl is enabled, the
   * [spot interrupt handler](https://github.com/awslabs/ec2-spot-labs/tree/master/ec2-spot-eks-solution/spot-termination-handler)
   * daemon will be installed on all spot instances to handle
   * [EC2 Spot Instance Termination Notices](https://aws.amazon.com/blogs/aws/new-ec2-spot-instance-termination-notices/).
   *
   * Prefer to use `addAutoScalingGroupCapacity` if possible.
   *
   * @see https://docs.aws.amazon.com/eks/latest/userguide/launch-workers.html
   * @param autoScalingGroup [disable-awslint:ref-via-interface]
   * @param options options for adding auto scaling groups, like customizing the bootstrap script
   */
  public connectAutoScalingGroupCapacity(autoScalingGroup: autoscaling.AutoScalingGroup, options: AutoScalingGroupOptions) {
    // self rules
    autoScalingGroup.connections.allowInternally(ec2.Port.allTraffic());

    // Cluster to:nodes rules
    autoScalingGroup.connections.allowFrom(this, ec2.Port.tcp(443));
    autoScalingGroup.connections.allowFrom(this, ec2.Port.tcpRange(1025, 65535));

    // Allow HTTPS from Nodes to Cluster
    autoScalingGroup.connections.allowTo(this, ec2.Port.tcp(443));

    // Allow all node outbound traffic
    autoScalingGroup.connections.allowToAnyIpv4(ec2.Port.allTcp());
    autoScalingGroup.connections.allowToAnyIpv4(ec2.Port.allUdp());
    autoScalingGroup.connections.allowToAnyIpv4(ec2.Port.allIcmp());

    // allow traffic to/from managed node groups (eks attaches this security group to the managed nodes)
    autoScalingGroup.addSecurityGroup(this.clusterSecurityGroup);

    const bootstrapEnabled = options.bootstrapEnabled ?? true;
    if (options.bootstrapOptions && !bootstrapEnabled) {
      throw new Error('Cannot specify "bootstrapOptions" if "bootstrapEnabled" is false');
    }

    if (bootstrapEnabled) {
      const userData = options.machineImageType === MachineImageType.BOTTLEROCKET ?
        renderBottlerocketUserData(this) :
        renderAmazonLinuxUserData(this.clusterName, autoScalingGroup, options.bootstrapOptions);
      autoScalingGroup.addUserData(...userData);
    }

    autoScalingGroup.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSWorkerNodePolicy'));
    autoScalingGroup.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKS_CNI_Policy'));
    autoScalingGroup.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'));

    // EKS Required Tags
    // https://docs.aws.amazon.com/eks/latest/userguide/worker.html
    Tags.of(autoScalingGroup).add(`kubernetes.io/cluster/${this.clusterName}`, 'owned', {
      applyToLaunchedInstances: true,
      // exclude security groups to avoid multiple "owned" security groups.
      // (the cluster security group already has this tag)
      excludeResourceTypes: ['AWS::EC2::SecurityGroup'],
    });

    // do not attempt to map the role if `kubectl` is not enabled for this
    // cluster or if `mapRole` is set to false. By default this should happen.
    const mapRole = options.mapRole ?? true;
    if (mapRole) {
      // see https://docs.aws.amazon.com/en_us/eks/latest/userguide/add-user-role.html
      this.awsAuth.addRoleMapping(autoScalingGroup.role, {
        username: 'system:node:{{EC2PrivateDNSName}}',
        groups: [
          'system:bootstrappers',
          'system:nodes',
        ],
      });
    } else {
      // since we are not mapping the instance role to RBAC, synthesize an
      // output so it can be pasted into `aws-auth-cm.yaml`
      new CfnOutput(autoScalingGroup, 'InstanceRoleARN', {
        value: autoScalingGroup.role.roleArn,
      });
    }

    const addSpotInterruptHandler = options.spotInterruptHandler ?? true;
    // if this is an ASG with spot instances, install the spot interrupt handler (only if kubectl is enabled).
    if (autoScalingGroup.spotPrice && addSpotInterruptHandler) {
      this.addSpotInterruptHandler();
    }
  }

  /**
   * Lazily creates the AwsAuth resource, which manages AWS authentication mapping.
   */
  public get awsAuth() {
    if (!this._awsAuth) {
      this._awsAuth = new AwsAuth(this, 'AwsAuth', { cluster: this });
    }

    return this._awsAuth;
  }

  /**
   * If this cluster is kubectl-enabled, returns the OpenID Connect issuer url.
   * This is because the values is only be retrieved by the API and not exposed
   * by CloudFormation. If this cluster is not kubectl-enabled (i.e. uses the
   * stock `CfnCluster`), this is `undefined`.
   * @attribute
   */
  public get clusterOpenIdConnectIssuerUrl(): string {
    return this._clusterResource.attrOpenIdConnectIssuerUrl;
  }

  /**
   * If this cluster is kubectl-enabled, returns the OpenID Connect issuer.
   * This is because the values is only be retrieved by the API and not exposed
   * by CloudFormation. If this cluster is not kubectl-enabled (i.e. uses the
   * stock `CfnCluster`), this is `undefined`.
   * @attribute
   */
  public get clusterOpenIdConnectIssuer(): string {
    return this._clusterResource.attrOpenIdConnectIssuer;
  }

  /**
   * An `OpenIdConnectProvider` resource associated with this cluster, and which can be used
   * to link this cluster to AWS IAM.
   *
   * A provider will only be defined if this property is accessed (lazy initialization).
   */
  public get openIdConnectProvider() {
    if (!this._openIdConnectProvider) {
      this._openIdConnectProvider = new OpenIdConnectProvider(this, 'OpenIdConnectProvider', {
        url: this.clusterOpenIdConnectIssuerUrl,
      });
    }

    return this._openIdConnectProvider;
  }

  /**
   * Adds a Fargate profile to this cluster.
   * @see https://docs.aws.amazon.com/eks/latest/userguide/fargate-profile.html
   *
   * @param id the id of this profile
   * @param options profile options
   */
  public addFargateProfile(id: string, options: FargateProfileOptions) {
    return new FargateProfile(this, `fargate-profile-${id}`, {
      ...options,
      cluster: this,
    });
  }

  /**
   * Internal API used by `FargateProfile` to keep inventory of Fargate profiles associated with
   * this cluster, for the sake of ensuring the profiles are created sequentially.
   *
   * @returns the list of FargateProfiles attached to this cluster, including the one just attached.
   * @internal
   */
  public _attachFargateProfile(fargateProfile: FargateProfile): FargateProfile[] {
    this._fargateProfiles.push(fargateProfile);

    // add all profiles as a dependency of the "kubectl-ready" barrier because all kubectl-
    // resources can only be deployed after all fargate profiles are created.
    this._kubectlReadyBarrier.node.addDependency(fargateProfile);

    return this._fargateProfiles;
  }

  /**
   * Adds a resource scope that requires `kubectl` to this cluster and returns
   * the `KubectlProvider` which is the custom resource provider that should be
   * used as the resource provider.
   *
   * Called from `HelmResource` and `KubernetesResource`
   *
   * @param resourceScope the construct scope in which kubectl resources are defined.
   *
   * @internal
   */
  public _attachKubectlResourceScope(resourceScope: Construct): KubectlProvider {
    Node.of(resourceScope).addDependency(this._kubectlReadyBarrier);
    return this._kubectlResourceProvider;
  }

  private defineKubectlProvider() {
    const uid = '@aws-cdk/aws-eks.KubectlProvider';

    // since we can't have the provider connect to multiple networks, and we
    // wanted to avoid resource tear down, we decided for now that we will only
    // support a single EKS cluster per CFN stack.
    if (this.stack.node.tryFindChild(uid)) {
      throw new Error('Only a single EKS cluster can be defined within a CloudFormation stack');
    }

    return new KubectlProvider(this.stack, uid, { cluster: this });
  }

  private selectPrivateSubnets(): ec2.ISubnet[] {
    const privateSubnets: ec2.ISubnet[] = [];
    const vpcPrivateSubnetIds = this.vpc.privateSubnets.map(s => s.subnetId);
    const vpcPublicSubnetIds = this.vpc.publicSubnets.map(s => s.subnetId);

    for (const placement of this.vpcSubnets) {

      for (const subnet of this.vpc.selectSubnets(placement).subnets) {

        if (vpcPrivateSubnetIds.includes(subnet.subnetId)) {
          // definitely private, take it.
          privateSubnets.push(subnet);
          continue;
        }

        if (vpcPublicSubnetIds.includes(subnet.subnetId)) {
          // definitely public, skip it.
          continue;
        }

        // neither public and nor private - what is it then? this means its a subnet instance that was explicitly passed
        // in the subnet selection. since ISubnet doesn't contain information on type, we have to assume its private and let it
        // fail at deploy time :\ (its better than filtering it out and preventing a possibly successful deployment)
        privateSubnets.push(subnet);
      }

    }

    return privateSubnets;
  }

  /**
   * Installs the AWS spot instance interrupt handler on the cluster if it's not
   * already added.
   */
  private addSpotInterruptHandler() {
    if (!this._spotInterruptHandler) {
      this._spotInterruptHandler = this.addHelmChart('spot-interrupt-handler', {
        chart: 'aws-node-termination-handler',
        version: '0.13.2',
        repository: 'https://aws.github.io/eks-charts',
        namespace: 'kube-system',
        values: {
          nodeSelector: {
            lifecycle: LifecycleLabel.SPOT,
          },
        },
      });
    }

    return this._spotInterruptHandler;
  }

  /**
   * Installs the Neuron device plugin on the cluster if it's not
   * already added.
   */
  private addNeuronDevicePlugin() {
    if (!this._neuronDevicePlugin) {
      const fileContents = fs.readFileSync(path.join(__dirname, 'addons/neuron-device-plugin.yaml'), 'utf8');
      const sanitized = YAML.parse(fileContents);
      this._neuronDevicePlugin = this.addManifest('NeuronDevicePlugin', sanitized);
    }

    return this._neuronDevicePlugin;
  }

  /**
   * Opportunistically tag subnets with the required tags.
   *
   * If no subnets could be found (because this is an imported VPC), add a warning.
   *
   * @see https://docs.aws.amazon.com/eks/latest/userguide/network_reqs.html
   */
  private tagSubnets() {
    const tagAllSubnets = (type: string, subnets: ec2.ISubnet[], tag: string) => {
      for (const subnet of subnets) {
        // if this is not a concrete subnet, attach a construct warning
        if (!ec2.Subnet.isVpcSubnet(subnet)) {
          // message (if token): "could not auto-tag public/private subnet with tag..."
          // message (if not token): "count not auto-tag public/private subnet xxxxx with tag..."
          const subnetID = Token.isUnresolved(subnet.subnetId) || Token.isUnresolved([subnet.subnetId]) ? '' : ` ${subnet.subnetId}`;
          Annotations.of(this).addWarning(`Could not auto-tag ${type} subnet${subnetID} with "${tag}=1", please remember to do this manually`);
          continue;
        }

        Tags.of(subnet).add(tag, '1');
      }
    };

    // https://docs.aws.amazon.com/eks/latest/userguide/network_reqs.html
    tagAllSubnets('private', this.vpc.privateSubnets, 'kubernetes.io/role/internal-elb');
    tagAllSubnets('public', this.vpc.publicSubnets, 'kubernetes.io/role/elb');
  }

  /**
   * Patches the CoreDNS deployment configuration and sets the "eks.amazonaws.com/compute-type"
   * annotation to either "ec2" or "fargate". Note that if "ec2" is selected, the resource is
   * omitted/removed, since the cluster is created with the "ec2" compute type by default.
   */
  private defineCoreDnsComputeType(type: CoreDnsComputeType) {
    // ec2 is the "built in" compute type of the cluster so if this is the
    // requested type we can simply omit the resource. since the resource's
    // `restorePatch` is configured to restore the value to "ec2" this means
    // that deletion of the resource will change to "ec2" as well.
    if (type === CoreDnsComputeType.EC2) {
      return;
    }

    // this is the json patch we merge into the resource based off of:
    // https://docs.aws.amazon.com/eks/latest/userguide/fargate-getting-started.html#fargate-gs-coredns
    const renderPatch = (computeType: CoreDnsComputeType) => ({
      spec: {
        template: {
          metadata: {
            annotations: {
              'eks.amazonaws.com/compute-type': computeType,
            },
          },
        },
      },
    });

    new KubernetesPatch(this, 'CoreDnsComputeTypePatch', {
      cluster: this,
      resourceName: 'deployment/coredns',
      resourceNamespace: 'kube-system',
      applyPatch: renderPatch(CoreDnsComputeType.FARGATE),
      restorePatch: renderPatch(CoreDnsComputeType.EC2),
    });
  }
}

/**
 * Options for adding worker nodes
 */
export interface AutoScalingGroupCapacityOptions extends autoscaling.CommonAutoScalingGroupProps {
  /**
   * Instance type of the instances to start
   */
  readonly instanceType: ec2.InstanceType;

  /**
   * Will automatically update the aws-auth ConfigMap to map the IAM instance
   * role to RBAC.
   *
   * This cannot be explicitly set to `true` if the cluster has kubectl disabled.
   *
   * @default - true if the cluster has kubectl enabled (which is the default).
   */
  readonly mapRole?: boolean;

  /**
   * Configures the EC2 user-data script for instances in this autoscaling group
   * to bootstrap the node (invoke `/etc/eks/bootstrap.sh`) and associate it
   * with the EKS cluster.
   *
   * If you wish to provide a custom user data script, set this to `false` and
   * manually invoke `autoscalingGroup.addUserData()`.
   *
   * @default true
   */
  readonly bootstrapEnabled?: boolean;

  /**
   * EKS node bootstrapping options.
   *
   * @default - none
   */
  readonly bootstrapOptions?: BootstrapOptions;

  /**
   * Machine image type
   *
   * @default MachineImageType.AMAZON_LINUX_2
   */
  readonly machineImageType?: MachineImageType;

  /**
   * Installs the AWS spot instance interrupt handler on the cluster if it's not
   * already added. Only relevant if `spotPrice` is used.
   *
   * @default true
   */
  readonly spotInterruptHandler?: boolean;
}

/**
 * EKS node bootstrapping options.
 */
export interface BootstrapOptions {
  /**
   * Sets `--max-pods` for the kubelet based on the capacity of the EC2 instance.
   *
   * @default true
   */
  readonly useMaxPods?: boolean;

  /**
   * Restores the docker default bridge network.
   *
   * @default false
   */
  readonly enableDockerBridge?: boolean;

  /**
   * Number of retry attempts for AWS API call (DescribeCluster).
   *
   * @default 3
   */
  readonly awsApiRetryAttempts?: number;

  /**
   * The contents of the `/etc/docker/daemon.json` file. Useful if you want a
   * custom config differing from the default one in the EKS AMI.
   *
   * @default - none
   */
  readonly dockerConfigJson?: string;

  /**

   * Overrides the IP address to use for DNS queries within the
   * cluster.
   *
   * @default - 10.100.0.10 or 172.20.0.10 based on the IP
   * address of the primary interface.
   */
  readonly dnsClusterIp?: string;

  /**
   * Extra arguments to add to the kubelet. Useful for adding labels or taints.
   *
   * @example --node-labels foo=bar,goo=far
   * @default - none
   */
  readonly kubeletExtraArgs?: string;

  /**
   * Additional command line arguments to pass to the `/etc/eks/bootstrap.sh`
   * command.
   *
   * @see https://github.com/awslabs/amazon-eks-ami/blob/master/files/bootstrap.sh
   * @default - none
   */
  readonly additionalArgs?: string;
}

/**
 * Options for adding an AutoScalingGroup as capacity
 */
export interface AutoScalingGroupOptions {
  /**
   * Will automatically update the aws-auth ConfigMap to map the IAM instance
   * role to RBAC.
   *
   * This cannot be explicitly set to `true` if the cluster has kubectl disabled.
   *
   * @default - true if the cluster has kubectl enabled (which is the default).
   */
  readonly mapRole?: boolean;

  /**
   * Configures the EC2 user-data script for instances in this autoscaling group
   * to bootstrap the node (invoke `/etc/eks/bootstrap.sh`) and associate it
   * with the EKS cluster.
   *
   * If you wish to provide a custom user data script, set this to `false` and
   * manually invoke `autoscalingGroup.addUserData()`.
   *
   * @default true
   */
  readonly bootstrapEnabled?: boolean;

  /**
   * Allows options for node bootstrapping through EC2 user data.
   * @default - default options
   */
  readonly bootstrapOptions?: BootstrapOptions;

  /**
   * Allow options to specify different machine image type
   *
   * @default MachineImageType.AMAZON_LINUX_2
   */
  readonly machineImageType?: MachineImageType;

  /**
   * Installs the AWS spot instance interrupt handler on the cluster if it's not
   * already added. Only relevant if `spotPrice` is configured on the auto-scaling group.
   *
   * @default true
   */
  readonly spotInterruptHandler?: boolean;
}

/**
 * Import a cluster to use in another stack
 */
class ImportedCluster extends ClusterBase {
  public readonly clusterName: string;
  public readonly clusterArn: string;
  public readonly connections = new ec2.Connections();
  public readonly kubectlRole?: iam.IRole;
  public readonly kubectlEnvironment?: { [key: string]: string; } | undefined;
  public readonly kubectlSecurityGroup?: ec2.ISecurityGroup | undefined;
  public readonly kubectlPrivateSubnets?: ec2.ISubnet[] | undefined;
  public readonly kubectlLayer?: lambda.ILayerVersion;
  public readonly kubectlMemory?: Size;
  public readonly prune: boolean;

  // so that `clusterSecurityGroup` on `ICluster` can be configured without optionality, avoiding users from having
  // to null check on an instance of `Cluster`, which will always have this configured.
  private readonly _clusterSecurityGroup?: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, private readonly props: ClusterAttributes) {
    super(scope, id);

    this.clusterName = props.clusterName;
    this.clusterArn = this.stack.formatArn(clusterArnComponents(props.clusterName));
    this.kubectlRole = props.kubectlRoleArn ? iam.Role.fromRoleArn(this, 'KubectlRole', props.kubectlRoleArn) : undefined;
    this.kubectlSecurityGroup = props.kubectlSecurityGroupId ? ec2.SecurityGroup.fromSecurityGroupId(this, 'KubectlSecurityGroup', props.kubectlSecurityGroupId) : undefined;
    this.kubectlEnvironment = props.kubectlEnvironment;
    this.kubectlPrivateSubnets = props.kubectlPrivateSubnetIds ? props.kubectlPrivateSubnetIds.map((subnetid, index) => ec2.Subnet.fromSubnetId(this, `KubectlSubnet${index}`, subnetid)) : undefined;
    this.kubectlLayer = props.kubectlLayer;
    this.kubectlMemory = props.kubectlMemory;
    this.prune = props.prune ?? true;

    let i = 1;
    for (const sgid of props.securityGroupIds ?? []) {
      this.connections.addSecurityGroup(ec2.SecurityGroup.fromSecurityGroupId(this, `SecurityGroup${i}`, sgid));
      i++;
    }

    if (props.clusterSecurityGroupId) {
      this._clusterSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, 'ClusterSecurityGroup', this.clusterSecurityGroupId);
      this.connections.addSecurityGroup(this._clusterSecurityGroup);
    }
  }

  public get vpc() {
    if (!this.props.vpc) {
      throw new Error('"vpc" is not defined for this imported cluster');
    }
    return this.props.vpc;
  }

  public get clusterSecurityGroup(): ec2.ISecurityGroup {
    if (!this._clusterSecurityGroup) {
      throw new Error('"clusterSecurityGroup" is not defined for this imported cluster');
    }
    return this._clusterSecurityGroup;
  }

  public get clusterSecurityGroupId(): string {
    if (!this.props.clusterSecurityGroupId) {
      throw new Error('"clusterSecurityGroupId" is not defined for this imported cluster');
    }
    return this.props.clusterSecurityGroupId;
  }

  public get clusterEndpoint(): string {
    if (!this.props.clusterEndpoint) {
      throw new Error('"clusterEndpoint" is not defined for this imported cluster');
    }
    return this.props.clusterEndpoint;
  }

  public get clusterCertificateAuthorityData(): string {
    if (!this.props.clusterCertificateAuthorityData) {
      throw new Error('"clusterCertificateAuthorityData" is not defined for this imported cluster');
    }
    return this.props.clusterCertificateAuthorityData;
  }

  public get clusterEncryptionConfigKeyArn(): string {
    if (!this.props.clusterEncryptionConfigKeyArn) {
      throw new Error('"clusterEncryptionConfigKeyArn" is not defined for this imported cluster');
    }
    return this.props.clusterEncryptionConfigKeyArn;
  }

  public get openIdConnectProvider(): iam.IOpenIdConnectProvider {
    if (!this.props.openIdConnectProvider) {
      throw new Error('"openIdConnectProvider" is not defined for this imported cluster');
    }
    return this.props.openIdConnectProvider;
  }
}

/**
 * Properties for EksOptimizedImage
 */
export interface EksOptimizedImageProps {
  /**
   * What instance type to retrieve the image for (standard or GPU-optimized)
   *
   * @default NodeType.STANDARD
   */
  readonly nodeType?: NodeType;

  /**
   * What cpu architecture to retrieve the image for (arm64 or x86_64)
   *
   * @default CpuArch.X86_64
   */
  readonly cpuArch?: CpuArch;

  /**
   * The Kubernetes version to use
   *
   * @default - The latest version
   */
  readonly kubernetesVersion?: string;
}

/**
 * Construct an Amazon Linux 2 image from the latest EKS Optimized AMI published in SSM
 */
export class EksOptimizedImage implements ec2.IMachineImage {
  private readonly nodeType?: NodeType;
  private readonly cpuArch?: CpuArch;
  private readonly kubernetesVersion?: string;
  private readonly amiParameterName: string;

  /**
   * Constructs a new instance of the EcsOptimizedAmi class.
   */
  public constructor(props: EksOptimizedImageProps = {}) {
    this.nodeType = props.nodeType ?? NodeType.STANDARD;
    this.cpuArch = props.cpuArch ?? CpuArch.X86_64;
    this.kubernetesVersion = props.kubernetesVersion ?? LATEST_KUBERNETES_VERSION;

    // set the SSM parameter name
    this.amiParameterName = `/aws/service/eks/optimized-ami/${this.kubernetesVersion}/`
      + (this.nodeType === NodeType.STANDARD ? this.cpuArch === CpuArch.X86_64 ?
        'amazon-linux-2/' : 'amazon-linux-2-arm64/' : '')
      + (this.nodeType === NodeType.GPU ? 'amazon-linux-2-gpu/' : '')
      + (this.nodeType === NodeType.INFERENTIA ? 'amazon-linux-2-gpu/' : '')
      + 'recommended/image_id';
  }

  /**
   * Return the correct image
   */
  public getImage(scope: CoreConstruct): ec2.MachineImageConfig {
    const ami = ssm.StringParameter.valueForStringParameter(scope, this.amiParameterName);
    return {
      imageId: ami,
      osType: ec2.OperatingSystemType.LINUX,
      userData: ec2.UserData.forLinux(),
    };
  }
}

// MAINTAINERS: use ./scripts/kube_bump.sh to update LATEST_KUBERNETES_VERSION
const LATEST_KUBERNETES_VERSION = '1.14';

/**
 * Whether the worker nodes should support GPU or just standard instances
 */
export enum NodeType {
  /**
   * Standard instances
   */
  STANDARD = 'Standard',

  /**
   * GPU instances
   */
  GPU = 'GPU',

  /**
   * Inferentia instances
   */
  INFERENTIA = 'INFERENTIA',
}

/**
 * CPU architecture
 */
export enum CpuArch {
  /**
   * arm64 CPU type
   */
  ARM_64 = 'arm64',

  /**
   * x86_64 CPU type
   */
  X86_64 = 'x86_64',
}

/**
 * The type of compute resources to use for CoreDNS.
 */
export enum CoreDnsComputeType {
  /**
   * Deploy CoreDNS on EC2 instances.
   */
  EC2 = 'ec2',

  /**
   * Deploy CoreDNS on Fargate-managed instances.
   */
  FARGATE = 'fargate'
}

/**
 * The default capacity type for the cluster
 */
export enum DefaultCapacityType {
  /**
   * managed node group
   */
  NODEGROUP,
  /**
   * EC2 autoscaling group
   */
  EC2
}

/**
 * The machine image type
 */
export enum MachineImageType {
  /**
   * Amazon EKS-optimized Linux AMI
   */
  AMAZON_LINUX_2,
  /**
   * Bottlerocket AMI
   */
  BOTTLEROCKET
}

function nodeTypeForInstanceType(instanceType: ec2.InstanceType) {
  return INSTANCE_TYPES.gpu.includes(instanceType.toString().substring(0, 2)) ? NodeType.GPU :
    INSTANCE_TYPES.inferentia.includes(instanceType.toString().substring(0, 4)) ? NodeType.INFERENTIA :
      NodeType.STANDARD;
}

function cpuArchForInstanceType(instanceType: ec2.InstanceType) {
  return INSTANCE_TYPES.graviton2.includes(instanceType.toString().substring(0, 3)) ? CpuArch.ARM_64 :
    INSTANCE_TYPES.graviton.includes(instanceType.toString().substring(0, 2)) ? CpuArch.ARM_64 :
      CpuArch.X86_64;
}

function flatten<A>(xss: A[][]): A[] {
  return Array.prototype.concat.call([], ...xss);
}
