import * as ec2 from '@aws-cdk/aws-ec2';
import * as eks from '@aws-cdk/aws-eks';
import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Construct } from 'constructs';
import { integrationResourceArn, validatePatternSupported } from '../private/task-utils';

/** Properties for creating a cluster with EksCreateCluster */
export interface EksCreateClusterProps extends sfn.TaskStateBaseProps {
  /** Name of the cluster */
  readonly name: string;

  /**
   * The desired Kubernetes version for your cluster.
   * @default - latest
   */
  readonly kubernetesVersion?: eks.KubernetesVersion;

  /** EKS Role ARN to create a cluster */
  readonly role: iam.IRole;

  /** VPC configuration used by the cluster control plane */
  readonly resourcesVpcConfig: ec2.IVpc;

  /**
   * Indicates if private access is enabled.
   * @default false
   */
  readonly privateAccess?: boolean;

  /**
   * Indicates if public access is enabled.
   * @default true
   */
  readonly publicAccess?: boolean;

  /**
   * Public access is allowed only from these CIDR blocks.
   * An empty array means access is open to any address.
   *
   * @default - No restrictions.
   */
  readonly publicCidrs?: string[];

  /**
   * Enable or disable exporting the Kubernetes control plane logs for your cluster to CloudWatch Logs.
   * @default - no logging configuration
   */
  readonly loggingConfiguration?: LoggingOptions;

  /**
   * Unique, case-sensitive identifier that you provide to ensure the idempotency of the request.
   * @default - no client request token
   */
  readonly clientRequestToken?: string;

  /**
   * Metadata that you apply to the cluster to assist with categorization and organization
   * @default - no tags
   */
  readonly tags?: { [key: string]: string };

  /**
   * The encryption configuration for the cluster.
   * @default - No encryption config
   */
  readonly encryptionConfig?: EncryptionConfig[];
}

/**
 * Create a cluster as a Task
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-eks.html
 */
export class EksCreateCluster extends sfn.TaskStateBase {

  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] = [
    sfn.IntegrationPattern.REQUEST_RESPONSE,
    sfn.IntegrationPattern.RUN_JOB,
  ];

  protected readonly taskMetrics?: sfn.TaskMetricsConfig;
  protected readonly taskPolicies?: iam.PolicyStatement[];

  private readonly integrationPattern: sfn.IntegrationPattern;

  constructor(scope: Construct, id: string, private readonly props: EksCreateClusterProps) {
    super(scope, id, props);
    this.integrationPattern = props.integrationPattern ?? sfn.IntegrationPattern.REQUEST_RESPONSE;

    validatePatternSupported(this.integrationPattern, EksCreateCluster.SUPPORTED_INTEGRATION_PATTERNS);

    let iamActions: string[] | undefined;
    if (this.integrationPattern === sfn.IntegrationPattern.REQUEST_RESPONSE) {
      iamActions = ['eks:CreateCluster'];
    } else if (this.integrationPattern === sfn.IntegrationPattern.RUN_JOB) {
      iamActions = [
        'eks:CreateCluster',
        'eks:DeleteCluster',
        'eks:DescribeCluster',
      ];
    }

    this.taskPolicies = [
      new iam.PolicyStatement({
        resources: ['*'], // Need wildcard permissions to create cluster with any name https://docs.aws.amazon.com/step-functions/latest/dg/eks-iam.html
        actions: iamActions,
      }),
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [props.role.roleArn],
        conditions: {
          StringEquals: { 'iam:PassedToService': 'eks.amazonaws.com' },
        },
      }),
    ];
  }

  /**
   * Provides the EKS create cluster service integration task configuration
   */
  /**
   * @internal
   */
  protected _renderTask(): any {
    const subnets: string[] = [];
    this.props.resourcesVpcConfig.publicSubnets.forEach(element => subnets?.push(element.subnetId));
    this.props.resourcesVpcConfig.privateSubnets.forEach(element => subnets?.push(element.subnetId));
    this.props.resourcesVpcConfig.isolatedSubnets.forEach(element => subnets?.push(element.subnetId));

    const securityGroup = new ec2.SecurityGroup(this, 'ControlPlaneSecurityGroup', {
      vpc: this.props.resourcesVpcConfig,
      description: 'EKS Control Plane Security Group',
    });

    return {
      Resource: integrationResourceArn('eks', 'createCluster', this.integrationPattern),
      Parameters: sfn.FieldUtils.renderObject({
        Name: this.props.name,
        Version: this.props.kubernetesVersion?.version,
        RoleArn: this.props.role.roleArn,
        ResourcesVpcConfig: {
          SubnetIds: subnets,
          SecurityGroupIds: [securityGroup.securityGroupId],
          EndpointPublicAccess: this.props.publicAccess ?? true,
          EndpointPrivateAccess: this.props.privateAccess ?? false,
          PublicAccessCidrs: [this.props.publicCidrs ?? '0.0.0.0/0'],
        },
        ...(this.props.loggingConfiguration?.clusterLoggingList ? {
          Logging: {
            ClusterLogging: this.props.loggingConfiguration?.clusterLoggingList,
          },
        } : {} ),
        ClientRequestToken: this.props.clientRequestToken,
        Tags: this.props.tags,
        EncryptionConfig: this.props.encryptionConfig,
      }),
    };
  }
}

/** Enable or disable exporting the Kubernetes control plane logs for your cluster to CloudWatch Logs */
export interface LoggingOptions {

  /**
   * The cluster control plane logging configuration for your cluster
   *
   * @default - no cluster logging
   */
  readonly clusterLoggingList?: ClusterLogging[];
}

/**
 * The cluster control plane logging configuration for your cluster */
export interface ClusterLogging {

  /**
   * The available cluster control plane log types
   *
   * @default - no types
   */
  readonly types?: string[];

  /**
   * Flag for log type exports of its control plane logs to CloudWatch Logs
   *
   * @default - false
   */
  readonly enabled?: boolean;
}

/** The encryption configuration for the cluster. */
export interface EncryptionConfig {

  /**
   * Specifies the resources to be encrypted. The only supported value is "secrets".
   *
   * @default - no resources
  */
  readonly resources?: string[];

  /**
   * AWS Key Management Service (AWS KMS) customer master key (CMK). Either the ARN or the alias can be used.
   *
   * @default - no provider
   */
  readonly provider?: Provider
}

/** The encryption configuration for the cluster. */
export interface Provider {

  /**
   * Amazon Resource Name (ARN) or alias of the customer master key (CMK).
   *
   * @default - no keyArn
  */
  readonly keyArn?: string;
}