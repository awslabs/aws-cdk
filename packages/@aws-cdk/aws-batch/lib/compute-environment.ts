import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import { IResource, Resource, Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnComputeEnvironment } from './batch.generated';

/**
 * Property to specify if the compute environment
 * uses On-Demand or SpotFleet compute resources.
 */
export enum ComputeResourceType {
  /**
   * Resources will be EC2 On-Demand resources.
   */
  ON_DEMAND = 'EC2',

  /**
   * Resources will be EC2 SpotFleet resources.
   */
  SPOT = 'SPOT',

  /**
   * Resources will be Fargate resources.
   */
  FARGATE = 'FARGATE',

  /**
   * Resources will be Fargate resources.
   */
  FARGATE_SPOT = 'FARGATE_SPOT',
}

/**
 * Properties for how to prepare compute resources
 * that are provisioned for a compute environment.
 */
export enum AllocationStrategy {
  /**
   * Batch will use the best fitting instance type will be used
   * when assigning a batch job in this compute environment.
   */
  BEST_FIT = 'BEST_FIT',

  /**
   * Batch will select additional instance types that are large enough to
   * meet the requirements of the jobs in the queue, with a preference for
   * instance types with a lower cost per unit vCPU.
   */
  BEST_FIT_PROGRESSIVE = 'BEST_FIT_PROGRESSIVE',

  /**
   * This is only available for Spot Instance compute resources and will select
   * additional instance types that are large enough to meet the requirements of
   * the jobs in the queue, with a preference for instance types that are less
   * likely to be interrupted.
   */
  SPOT_CAPACITY_OPTIMIZED = 'SPOT_CAPACITY_OPTIMIZED',
}

/**
 * Launch template property specification
 */
export interface LaunchTemplateSpecification {
  /**
   * The Launch template name
   */
  readonly launchTemplateName: string;
  /**
   * The launch template version to be used (optional).
   *
   * @default - the default version of the launch template
   */
  readonly version?: string;
}

/**
 * Properties for defining the structure of the batch compute cluster.
 */
export interface ComputeResources {
  /**
   * The allocation strategy to use for the compute resource in case not enough instances of the best
   * fitting instance type can be allocated. This could be due to availability of the instance type in
   * the region or Amazon EC2 service limits. If this is not specified, the default for the EC2
   * ComputeResourceType is BEST_FIT, which will use only the best fitting instance type, waiting for
   * additional capacity if it's not available. This allocation strategy keeps costs lower but can limit
   * scaling. If you are using Spot Fleets with BEST_FIT then the Spot Fleet IAM Role must be specified.
   * BEST_FIT_PROGRESSIVE will select an additional instance type that is large enough to meet the
   * requirements of the jobs in the queue, with a preference for an instance type with a lower cost.
   * The default value for the SPOT instance type is SPOT_CAPACITY_OPTIMIZED, which is only available for
   * for this type of compute resources and will select an additional instance type that is large enough
   * to meet the requirements of the jobs in the queue, with a preference for an instance type that is
   * less likely to be interrupted.
   *
   * @default AllocationStrategy.BEST_FIT
   */
  readonly allocationStrategy?: AllocationStrategy;

  /**
   * The Amazon ECS instance profile applied to Amazon EC2 instances in a compute environment. You can specify
   * the short name or full Amazon Resource Name (ARN) of an instance profile. For example, ecsInstanceRole or
   * arn:aws:iam::<aws_account_id>:instance-profile/ecsInstanceRole . For more information, see Amazon ECS
   * Instance Role in the AWS Batch User Guide.
   *
   * @default - a new role will be created.
   * @link https://docs.aws.amazon.com/batch/latest/userguide/instance_IAM_role.html
   */
  readonly instanceRole?: string;

  /**
   * An optional launch template to associate with your compute resources.
   * For more information, see README file.
   *
   * @default - no custom launch template will be used
   * @link https://docs.aws.amazon.com/batch/latest/userguide/launch-templates.html
   */
  readonly launchTemplate?: LaunchTemplateSpecification;

  /**
   * The types of EC2 instances that may be launched in the compute environment. You can specify instance
   * families to launch any instance type within those families (for example, c4 or p3), or you can specify
   * specific sizes within a family (such as c4.8xlarge). You can also choose optimal to pick instance types
   * (from the C, M, and R instance families) on the fly that match the demand of your job queues.
   *
   * @default optimal
   */
  readonly instanceTypes?: ec2.InstanceType[];

  /**
   * The EC2 security group(s) associated with instances launched in the compute environment.
   *
   * @default - AWS default security group.
   */
  readonly securityGroups?: ec2.ISecurityGroup[];

  /**
   * The VPC network that all compute resources will be connected to.
   */
  readonly vpc: ec2.IVpc;

  /**
   * The VPC subnets into which the compute resources are launched.
   *
   * @default - private subnets of the supplied VPC.
   */
  readonly vpcSubnets?: ec2.SubnetSelection;

  /**
   * The type of compute environment: ON_DEMAND or SPOT.
   *
   * @default ON_DEMAND
   */
  readonly type?: ComputeResourceType;

  /**
   * This property will be ignored if you set the environment type to ON_DEMAND.
   *
   * The maximum percentage that a Spot Instance price can be when compared with the On-Demand price for
   * that instance type before instances are launched. For example, if your maximum percentage is 20%,
   * then the Spot price must be below 20% of the current On-Demand price for that EC2 instance. You always
   * pay the lowest (market) price and never more than your maximum percentage. If you leave this field empty,
   * the default value is 100% of the On-Demand price.
   *
   * @default 100
   */
  readonly bidPercentage?: number;

  /**
   * The desired number of EC2 vCPUS in the compute environment.
   *
   * @default - no desired vcpu value will be used.
   */
  readonly desiredvCpus?: number;

  /**
   * The maximum number of EC2 vCPUs that an environment can reach. Each vCPU is equivalent to
   * 1,024 CPU shares. You must specify at least one vCPU.
   *
   * @default 256
   */
  readonly maxvCpus?: number;

  /**
   * The minimum number of EC2 vCPUs that an environment should maintain (even if the compute environment state is DISABLED).
   * Each vCPU is equivalent to 1,024 CPU shares. By keeping this set to 0 you will not have instance time wasted when
   * there is no work to be run. If you set this above zero you will maintain that number of vCPUs at all times.
   *
   * @default 0
   */
  readonly minvCpus?: number;

  /**
   * The Amazon EC2 placement group to associate with your compute resources.
   *
   * @default - No placement group will be used.
   */
  readonly placementGroup?: string;

  /**
   * The EC2 key pair that is used for instances launched in the compute environment.
   * If no key is defined, then SSH access is not allowed to provisioned compute resources.
   *
   * @default - no SSH access will be possible.
   */
  readonly ec2KeyPair?: string;

  /**
   * The Amazon Machine Image (AMI) ID used for instances launched in the compute environment.
   *
   * @default - no image will be used.
   */
  readonly image?: ec2.IMachineImage;

  /**
   * This property will be ignored if you set the environment type to ON_DEMAND.
   *
   * The Amazon Resource Name (ARN) of the Amazon EC2 Spot Fleet IAM role applied to a SPOT compute environment.
   * For more information, see Amazon EC2 Spot Fleet Role in the AWS Batch User Guide.
   *
   * @link https://docs.aws.amazon.com/batch/latest/userguide/spot_fleet_IAM_role.html
   * @default - no fleet role will be used.
   */
  readonly spotFleetRole?: iam.IRole;

  /**
   * Key-value pair tags to be applied to resources that are launched in the compute environment.
   * For AWS Batch, these take the form of "String1": "String2", where String1 is the tag key and
   * String2 is the tag value—for example, { "Name": "AWS Batch Instance - C4OnDemand" }.
   *
   * @default - no tags will be assigned on compute resources.
   */
  readonly computeResourcesTags?: {
    [key: string]: string
  };
}

/**
 * Properties for creating a new Compute Environment
 */
export interface ComputeEnvironmentProps {
  /**
   * A name for the compute environment.
   *
   * Up to 128 letters (uppercase and lowercase), numbers, hyphens, and underscores are allowed.
   *
   * @default - CloudFormation-generated name
   */
  readonly computeEnvironmentName?: string;

  /**
   * The details of the required compute resources for the managed compute environment.
   *
   * If specified, and this is an unmanaged compute environment, will throw an error.
   *
   * By default, AWS Batch managed compute environments use a recent, approved version of the
   * Amazon ECS-optimized AMI for compute resources.
   *
   * @default - CloudFormation defaults
   * @link https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-batch-computeenvironment-computeresources.html
   */
  readonly computeResources?: ComputeResources;

  /**
   * The state of the compute environment. If the state is set to true, then the compute
   * environment accepts jobs from a queue and can scale out automatically based on queues.
   *
   * @default true
   */
  readonly enabled?: boolean;

  /**
   * The IAM role used by Batch to make calls to other AWS services on your behalf for managing
   * the resources that you use with the service. By default, this role is created for you using
   * the AWS managed service policy for Batch.
   *
   * @link https://docs.aws.amazon.com/batch/latest/userguide/service_IAM_role.html
   *
   * @default - Role using the 'service-role/AWSBatchServiceRole' policy.
   */
  readonly serviceRole?: iam.IRole,

  /**
   * Determines if AWS should manage the allocation of compute resources for processing jobs.
   * If set to false, then you are in charge of providing the compute resource details.
   *
   * @default true
   */
  readonly managed?: boolean;
}

/**
 * Properties of a compute environment.
 */
export interface IComputeEnvironment extends IResource {
  /**
   * The ARN of this compute environment.
   *
   * @attribute
   */
  readonly computeEnvironmentArn: string;

  /**
   * The name of this compute environment.
   *
   * @attribute
   */
  readonly computeEnvironmentName: string;
}

/**
 * Batch Compute Environment.
 *
 * Defines a batch compute environment to run batch jobs on.
 */
export class ComputeEnvironment extends Resource implements IComputeEnvironment {
  /**
   * Fetches an existing batch compute environment by its amazon resource name.
   *
   * @param scope
   * @param id
   * @param computeEnvironmentArn
   */
  public static fromComputeEnvironmentArn(scope: Construct, id: string, computeEnvironmentArn: string): IComputeEnvironment {
    const stack = Stack.of(scope);
    const computeEnvironmentName = stack.parseArn(computeEnvironmentArn).resourceName!;

    class Import extends Resource implements IComputeEnvironment {
      public readonly computeEnvironmentArn = computeEnvironmentArn;
      public readonly computeEnvironmentName = computeEnvironmentName;
    }

    return new Import(scope, id);
  }

  /**
   * The ARN of this compute environment.
   *
   * @attribute
   */
  public readonly computeEnvironmentArn: string;

  /**
   * The name of this compute environment.
   *
   * @attribute
   */
  public readonly computeEnvironmentName: string;

  constructor(scope: Construct, id: string, props: ComputeEnvironmentProps = { enabled: true, managed: true }) {
    super(scope, id, {
      physicalName: props.computeEnvironmentName,
    });

    this.validateProps(props);

    const spotFleetRole = this.getSpotFleetRole(props);
    let computeResources: CfnComputeEnvironment.ComputeResourcesProperty | undefined;

    // Only allow compute resources to be set when using MANAGED type
    if (props.computeResources && this.isManaged(props)) {
      computeResources = {
        allocationStrategy: props.computeResources.allocationStrategy
         || (
           props.computeResources.type === ComputeResourceType.SPOT
             ? AllocationStrategy.SPOT_CAPACITY_OPTIMIZED
             : AllocationStrategy.BEST_FIT
         ),
        bidPercentage: props.computeResources.bidPercentage,
        desiredvCpus: props.computeResources.desiredvCpus,
        ec2KeyPair: props.computeResources.ec2KeyPair,
        imageId: props.computeResources.image && props.computeResources.image.getImage(this).imageId,
        instanceRole: props.computeResources.instanceRole
          ? props.computeResources.instanceRole
          : new iam.CfnInstanceProfile(this, 'Instance-Profile', {
            roles: [new iam.Role(this, 'Ecs-Instance-Role', {
              assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
              managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEC2ContainerServiceforEC2Role'),
              ],
            }).roleName],
          }).attrArn,
        instanceTypes: this.buildInstanceTypes(props.computeResources.instanceTypes),
        launchTemplate: props.computeResources.launchTemplate,
        maxvCpus: props.computeResources.maxvCpus || 256,
        minvCpus: props.computeResources.minvCpus || 0,
        placementGroup: props.computeResources.placementGroup,
        securityGroupIds: this.buildSecurityGroupIds(props.computeResources.vpc, props.computeResources.securityGroups),
        spotIamFleetRole: spotFleetRole?.roleArn,
        subnets: props.computeResources.vpc.selectSubnets(props.computeResources.vpcSubnets).subnetIds,
        tags: props.computeResources.computeResourcesTags,
        type: props.computeResources.type || ComputeResourceType.ON_DEMAND,
      };
    }

    const computeEnvironment = new CfnComputeEnvironment(this, 'Resource', {
      computeEnvironmentName: this.physicalName,
      computeResources,
      serviceRole: props.serviceRole?.roleArn
        ?? new iam.Role(this, 'Resource-Service-Instance-Role', {
          managedPolicies: [
            iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBatchServiceRole'),
          ],
          assumedBy: new iam.ServicePrincipal('batch.amazonaws.com'),
        }).roleArn,
      state: props.enabled === undefined ? 'ENABLED' : (props.enabled ? 'ENABLED' : 'DISABLED'),
      type: this.isManaged(props) ? 'MANAGED' : 'UNMANAGED',
    });

    if (props.computeResources && props.computeResources.vpc) {
      this.node.addDependency(props.computeResources.vpc);
    }

    this.computeEnvironmentArn = this.getResourceArnAttribute(computeEnvironment.ref, {
      service: 'batch',
      resource: 'compute-environment',
      resourceName: this.physicalName,
    });
    this.computeEnvironmentName = this.getResourceNameAttribute(computeEnvironment.ref);
  }

  private isManaged(props: ComputeEnvironmentProps): boolean {
    return props.managed ?? true;
  }

  /**
   * Validates the properties provided for a new batch compute environment.
   */
  private validateProps(props: ComputeEnvironmentProps) {
    if (props === undefined) {
      return;
    }

    if (!this.isManaged(props) && props.computeResources !== undefined) {
      throw new Error('It is not allowed to set computeResources on an AWS unmanaged compute environment');
    }

    if (this.isManaged(props) && props.computeResources === undefined) {
      throw new Error('computeResources is missing but required on a managed compute environment');
    }

    if (props.computeResources) {
      if (props.computeResources.type === ComputeResourceType.FARGATE || props.computeResources.type === ComputeResourceType.FARGATE_SPOT) {
        // VALIDATE FOR FARGATE

        // Bid percentage cannot be set for Fargate evnvironments
        if (props.computeResources.bidPercentage !== undefined) {
          throw new Error('Bid percentage must not be set for Fargate compute environments');
        }

        // Allocation strategy cannot be set for Fargate evnvironments
        if (props.computeResources.allocationStrategy !== undefined) {
          throw new Error('Allocation strategy must not be set for Fargate compute environments');
        }

        // Desired vCPUs cannot be set for Fargate evnvironments
        if (props.computeResources.desiredvCpus !== undefined) {
          throw new Error('Desired vCPUs must not be set for Fargate compute environments');
        }

        // Image ID cannot be set for Fargate evnvironments
        if (props.computeResources.image !== undefined) {
          throw new Error('Image must not be set for Fargate compute environments');
        }

        // Instance types cannot be set for Fargate evnvironments
        if (props.computeResources.instanceTypes !== undefined) {
          throw new Error('Instance types must not be set for Fargate compute environments');
        }

        // EC2 key pair cannot be set for Fargate evnvironments
        if (props.computeResources.ec2KeyPair !== undefined) {
          throw new Error('EC2 key pair must not be set for Fargate compute environments');
        }

        // Instance role cannot be set for Fargate evnvironments
        if (props.computeResources.instanceRole !== undefined) {
          throw new Error('Instance role must not be set for Fargate compute environments');
        }

        // Launch template cannot be set for Fargate evnvironments
        if (props.computeResources.launchTemplate !== undefined) {
          throw new Error('Launch template must not be set for Fargate compute environments');
        }

        // Min vCPUs cannot be set for Fargate evnvironments
        if (props.computeResources.minvCpus !== undefined) {
          throw new Error('Min vCPUs must not be set for Fargate compute environments');
        }

        // Placement group cannot be set for Fargate evnvironments
        if (props.computeResources.placementGroup !== undefined) {
          throw new Error('Placement group must not be set for Fargate compute environments');
        }

        // Spot fleet role cannot be set for Fargate evnvironments
        if (props.computeResources.spotFleetRole !== undefined) {
          throw new Error('Spot fleet role must not be set for Fargate compute environments');
        }
      } else {
        // VALIDATE FOR ON_DEMAND AND SPOT
        if (props.computeResources.minvCpus) {
          // minvCpus cannot be less than 0
          if (props.computeResources.minvCpus < 0) {
            throw new Error('Minimum vCpus for a batch compute environment cannot be less than 0');
          }

          // minvCpus cannot exceed max vCpus
          if (props.computeResources.maxvCpus &&
              props.computeResources.minvCpus > props.computeResources.maxvCpus) {
            throw new Error('Minimum vCpus cannot be greater than the maximum vCpus');
          }
        }
        // Setting a bid percentage is only allowed on SPOT resources +
        // Cannot use SPOT_CAPACITY_OPTIMIZED when using ON_DEMAND
        if (props.computeResources.type === ComputeResourceType.ON_DEMAND) {
          // VALIDATE FOR ON_DEMAND

          // Bid percentage is not allowed
          if (props.computeResources.bidPercentage !== undefined) {
            throw new Error('Setting the bid percentage is only allowed for SPOT type resources on a batch compute environment');
          }

          // SPOT_CAPACITY_OPTIMIZED allocation is not allowed
          if (props.computeResources.allocationStrategy && props.computeResources.allocationStrategy === AllocationStrategy.SPOT_CAPACITY_OPTIMIZED) {
            throw new Error('The SPOT_CAPACITY_OPTIMIZED allocation strategy is only allowed if the environment is a SPOT type compute environment');
          }
        } else if (props.computeResources.type === ComputeResourceType.SPOT) {
          // VALIDATE FOR SPOT

          // Bid percentage must be from 0 - 100
          if (props.computeResources.bidPercentage !== undefined &&
              (props.computeResources.bidPercentage < 0 || props.computeResources.bidPercentage > 100)) {
            throw new Error('Bid percentage can only be a value between 0 and 100');
          }
        }
      }
    }
  }

  private buildInstanceTypes(instanceTypes?: ec2.InstanceType[]): string[] {
    if (instanceTypes === undefined) {
      return [
        'optimal',
      ];
    }

    return instanceTypes.map((type: ec2.InstanceType) => type.toString());
  }

  private buildSecurityGroupIds(vpc: ec2.IVpc, securityGroups?: ec2.ISecurityGroup[]): string[] | undefined {
    if (securityGroups === undefined) {
      return [
        new ec2.SecurityGroup(this, 'Resource-Security-Group', { vpc }).securityGroupId,
      ];
    }

    return securityGroups.map((group: ec2.ISecurityGroup) => group.securityGroupId);
  }

  /**
   * Generates an AWS IAM role for provisioning spotfleet resources
   * if the allocation strategy is set to BEST_FIT or not defined.
   *
   * @param props - the compute environment construct properties
   */
  private getSpotFleetRole(props: ComputeEnvironmentProps): iam.IRole | undefined {
    if (props.computeResources?.allocationStrategy && props.computeResources.allocationStrategy !== AllocationStrategy.BEST_FIT) {
      return undefined;
    }

    if (props.computeResources) {
      if (props.computeResources.spotFleetRole) {
        return props.computeResources.spotFleetRole;
      } else if (props.computeResources.type === ComputeResourceType.SPOT) {
        return iam.Role.fromRoleArn(this, 'Resource-SpotFleet-Role',
          `arn:${this.stack.partition}:iam::${this.stack.account}:role/aws-service-role/spotfleet.amazonaws.com/AWSServiceRoleForEC2SpotFleet`);
      }
    }

    return undefined;
  }
}
