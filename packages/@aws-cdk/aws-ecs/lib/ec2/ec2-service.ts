import * as ec2 from '@aws-cdk/aws-ec2';
import { Lazy, Resource, Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { BaseService, BaseServiceOptions, DeploymentControllerType, IBaseService, IService, LaunchType } from '../base/base-service';
import { fromServiceAtrributes } from '../base/from-service-attributes';
import { NetworkMode, TaskDefinition } from '../base/task-definition';
import { ICluster } from '../cluster';
import { CfnService } from '../ecs.generated';
import { PlacementConstraint, PlacementStrategy } from '../placement';

/**
 * The properties for defining a service using the EC2 launch type.
 */
export interface Ec2ServiceProps extends BaseServiceOptions {
  /**
   * The task definition to use for tasks in the service.
   *
   * [disable-awslint:ref-via-interface]
   */
  readonly taskDefinition: TaskDefinition;

  /**
   * Specifies whether the task's elastic network interface receives a public IP address.
   * If true, each task will receive a public IP address.
   *
   * This property is only used for tasks that use the awsvpc network mode.
   *
   * @default false
   */
  readonly assignPublicIp?: boolean;

  /**
   * The subnets to associate with the service.
   *
   * This property is only used for tasks that use the awsvpc network mode.
   *
   * @default - Public subnets if `assignPublicIp` is set, otherwise the first available one of Private, Isolated, Public, in that order.
   */
  readonly vpcSubnets?: ec2.SubnetSelection;

  /**
   * The security groups to associate with the service. If you do not specify a security group, the default security group for the VPC is used.
   *
   * This property is only used for tasks that use the awsvpc network mode.
   *
   * @default - A new security group is created.
   * @deprecated use securityGroups instead.
   */
  readonly securityGroup?: ec2.ISecurityGroup;

  /**
   * The security groups to associate with the service. If you do not specify a security group, the default security group for the VPC is used.
   *
   * This property is only used for tasks that use the awsvpc network mode.
   *
   * @default - A new security group is created.
   */
  readonly securityGroups?: ec2.ISecurityGroup[];

  /**
   * The placement constraints to use for tasks in the service. For more information, see
   * [Amazon ECS Task Placement Constraints](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-placement-constraints.html).
   *
   * @default - No constraints.
   */
  readonly placementConstraints?: PlacementConstraint[];

  /**
   * The placement strategies to use for tasks in the service. For more information, see
   * [Amazon ECS Task Placement Strategies](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-placement-strategies.html).
   *
   * @default - No strategies.
   */
  readonly placementStrategies?: PlacementStrategy[];

  /**
   * Specifies whether the service will use the daemon scheduling strategy.
   * If true, the service scheduler deploys exactly one task on each container instance in your cluster.
   *
   * When you are using this strategy, do not specify a desired number of tasks orany task placement strategies.
   *
   * @default false
   */
  readonly daemon?: boolean;
}

/**
 * The interface for a service using the EC2 launch type on an ECS cluster.
 */
export interface IEc2Service extends IService {

}

/**
 * The properties to import from the service using the EC2 launch type.
 */
export interface Ec2ServiceAttributes {
  /**
   * The cluster that hosts the service.
   */
  readonly cluster: ICluster;

  /**
   * The service ARN.
   *
   * @default - either this, or {@link serviceName}, is required
   */
  readonly serviceArn?: string;

  /**
   * The name of the service.
   *
   * @default - either this, or {@link serviceArn}, is required
   */
  readonly serviceName?: string;
}

/**
 * This creates a service using the EC2 launch type on an ECS cluster.
 *
 * @resource AWS::ECS::Service
 */
export class Ec2Service extends BaseService implements IEc2Service {
  /**
   * Imports from the specified service ARN.
   */
  public static fromEc2ServiceArn(scope: Construct, id: string, ec2ServiceArn: string): IEc2Service {
    class Import extends Resource implements IEc2Service {
      public readonly serviceArn = ec2ServiceArn;
      public readonly serviceName = Stack.of(scope).parseArn(ec2ServiceArn).resourceName as string;
    }
    return new Import(scope, id);
  }

  /**
   * Imports from the specified service attrributes.
   */
  public static fromEc2ServiceAttributes(scope: Construct, id: string, attrs: Ec2ServiceAttributes): IBaseService {
    return fromServiceAtrributes(scope, id, attrs);
  }

  private readonly constraints: CfnService.PlacementConstraintProperty[];
  private readonly strategies: CfnService.PlacementStrategyProperty[];
  private readonly daemon: boolean;

  /**
   * Constructs a new instance of the Ec2Service class.
   */
  constructor(scope: Construct, id: string, props: Ec2ServiceProps) {
    if (props.daemon && props.desiredCount !== undefined) {
      throw new Error('Daemon mode launches one task on every instance. Don\'t supply desiredCount.');
    }

    if (props.daemon && props.maxHealthyPercent !== undefined && props.maxHealthyPercent !== 100) {
      throw new Error('Maximum percent must be 100 for daemon mode.');
    }

    if (props.minHealthyPercent !== undefined && props.maxHealthyPercent !== undefined && props.minHealthyPercent >= props.maxHealthyPercent) {
      throw new Error('Minimum healthy percent must be less than maximum healthy percent.');
    }

    if (!props.taskDefinition.isEc2Compatible) {
      throw new Error('Supplied TaskDefinition is not configured for compatibility with EC2');
    }

    if (props.securityGroup !== undefined && props.securityGroups !== undefined) {
      throw new Error('Only one of SecurityGroup or SecurityGroups can be populated.');
    }

    super(scope, id, {
      ...props,
      desiredCount: props.desiredCount,
      maxHealthyPercent: props.daemon && props.maxHealthyPercent === undefined ? 100 : props.maxHealthyPercent,
      minHealthyPercent: props.daemon && props.minHealthyPercent === undefined ? 0 : props.minHealthyPercent,
      launchType: LaunchType.EC2,
      enableECSManagedTags: props.enableECSManagedTags,
    },
    {
      cluster: props.cluster.clusterName,
      taskDefinition: props.deploymentController?.type === DeploymentControllerType.EXTERNAL ? undefined : props.taskDefinition.taskDefinitionArn,
      placementConstraints: Lazy.any({ produce: () => this.constraints }, { omitEmptyArray: true }),
      placementStrategies: Lazy.any({ produce: () => this.strategies }, { omitEmptyArray: true }),
      schedulingStrategy: props.daemon ? 'DAEMON' : 'REPLICA',
    }, props.taskDefinition);

    this.constraints = [];
    this.strategies = [];
    this.daemon = props.daemon || false;

    let securityGroups;
    if (props.securityGroup !== undefined) {
      securityGroups = [props.securityGroup];
    } else if (props.securityGroups !== undefined) {
      securityGroups = props.securityGroups;
    }

    if (props.taskDefinition.networkMode === NetworkMode.AWS_VPC) {
      this.configureAwsVpcNetworkingWithSecurityGroups(props.cluster.vpc, props.assignPublicIp, props.vpcSubnets, securityGroups);
    } else {
      // Either None, Bridge or Host networking. Copy SecurityGroups from ASG.
      // We have to be smart here -- by default future Security Group rules would be created
      // in the Cluster stack. However, if the Cluster is in a different stack than us,
      // that will lead to a cyclic reference (we point to that stack for the cluster name,
      // but that stack will point to the ALB probably created right next to us).
      //
      // In that case, reference the same security groups but make sure new rules are
      // created in the current scope (i.e., this stack)
      validateNoNetworkingProps(props);
      this.connections.addSecurityGroup(...securityGroupsInThisStack(this, props.cluster.connections.securityGroups));
    }

    this.addPlacementConstraints(...props.placementConstraints || []);
    this.addPlacementStrategies(...props.placementStrategies || []);

    this.node.addValidation({
      validate: () => !this.taskDefinition.defaultContainer ? ['A TaskDefinition must have at least one essential container'] : [],
    });
  }

  /**
   * Adds one or more placement strategies to use for tasks in the service. For more information, see
   * [Amazon ECS Task Placement Strategies](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-placement-strategies.html).
   */
  public addPlacementStrategies(...strategies: PlacementStrategy[]) {
    if (strategies.length > 0 && this.daemon) {
      throw new Error("Can't configure placement strategies when daemon=true");
    }

    for (const strategy of strategies) {
      this.strategies.push(...strategy.toJson());
    }
  }

  /**
   * Adds one or more placement constraints to use for tasks in the service. For more information, see
   * [Amazon ECS Task Placement Constraints](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-placement-constraints.html).
   */
  public addPlacementConstraints(...constraints: PlacementConstraint[]) {
    for (const constraint of constraints) {
      this.constraints.push(...constraint.toJson());
    }
  }

  /**
   * Validates this Ec2Service.
   */
  protected validate(): string[] {
    const ret = super.validate();
    if (!this.cluster.hasEc2Capacity) {
      ret.push('Cluster for this service needs Ec2 capacity. Call addXxxCapacity() on the cluster.');
    }
    return ret;
  }
}

/**
 * Validate combinations of networking arguments.
 */
function validateNoNetworkingProps(props: Ec2ServiceProps) {
  if (props.vpcSubnets !== undefined
    || props.securityGroup !== undefined
    || props.securityGroups !== undefined
    || props.assignPublicIp) {
    throw new Error('vpcSubnets, securityGroup(s) and assignPublicIp can only be used in AwsVpc networking mode');
  }
}

/**
 * Force security group rules to be created in this stack.
 *
 * For every security group, if the scope and the group are in different stacks, return
 * a fake "imported" security group instead. This will behave as the original security group,
 * but new Ingress and Egress rule resources will be added in the current stack instead of the
 * other one.
 */
function securityGroupsInThisStack(scope: Construct, groups: ec2.ISecurityGroup[]): ec2.ISecurityGroup[] {
  const thisStack = Stack.of(scope);

  let i = 1;
  return groups.map(group => {
    if (thisStack === Stack.of(group)) { return group; } // Simple case, just return the original one

    return ec2.SecurityGroup.fromSecurityGroupId(scope, `SecurityGroup${i++}`, group.securityGroupId, {
      allowAllOutbound: group.allowAllOutbound,
      mutable: true,
    });
  });
}

/**
 * The built-in container instance attributes
 */
export class BuiltInAttributes {
  /**
   * The id of the instance.
   */
  public static readonly INSTANCE_ID = 'instanceId';

  /**
   * The AvailabilityZone where the instance is running in.
   */
  public static readonly AVAILABILITY_ZONE = 'attribute:ecs.availability-zone';

  /**
   * The AMI id the instance is using.
   */
  public static readonly AMI_ID = 'attribute:ecs.ami-id';

  /**
   * The EC2 instance type.
   */
  public static readonly INSTANCE_TYPE = 'attribute:ecs.instance-type';

  /**
   * The operating system of the instance.
   *
   * Either 'linux' or 'windows'.
   */
  public static readonly OS_TYPE = 'attribute:ecs.os-type';
}
