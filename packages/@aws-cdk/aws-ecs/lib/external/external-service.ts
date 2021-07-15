import * as appscaling from '@aws-cdk/aws-applicationautoscaling';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as cloudmap from '@aws-cdk/aws-servicediscovery';
import { Resource, Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { AssociateCloudMapServiceOptions, BaseService, BaseServiceOptions, CloudMapOptions, DeploymentControllerType, EcsTarget, IBaseService, IEcsLoadBalancerTarget, IService, LaunchType, PropagatedTagSource } from '../base/base-service';
import { fromServiceAtrributes } from '../base/from-service-attributes';
import { ScalableTaskCount } from '../base/scalable-task-count';
import { Compatibility, LoadBalancerTargetOptions, TaskDefinition } from '../base/task-definition';
import { ICluster } from '../cluster';
/**
 * The properties for defining a service using the External launch type.
 */
export interface ExternalServiceProps extends BaseServiceOptions {
  /**
   * The task definition to use for tasks in the service.
   *
   * [disable-awslint:ref-via-interface]
   */
  readonly taskDefinition: TaskDefinition;

  /**
   * The security groups to associate with the service. If you do not specify a security group, the default security group for the VPC is used.
   *
   *
   * @default - A new security group is created.
   */
  readonly securityGroups?: ec2.ISecurityGroup[];
}

/**
 * The interface for a service using the External launch type on an ECS cluster.
 */
export interface IExternalService extends IService {

}

/**
 * The properties to import from the service using the External launch type.
 */
export interface ExternalServiceAttributes {
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
 * This creates a service using the External launch type on an ECS cluster.
 *
 * @resource AWS::ECS::Service
 */
export class ExternalService extends BaseService implements IExternalService {

  /**
   * Imports from the specified service ARN.
   */
  public static fromExternalServiceArn(scope: Construct, id: string, externalServiceArn: string): IExternalService {
    class Import extends Resource implements IExternalService {
      public readonly serviceArn = externalServiceArn;
      public readonly serviceName = Stack.of(scope).parseArn(externalServiceArn).resourceName as string;
    }
    return new Import(scope, id);
  }

  /**
   * Imports from the specified service attrributes.
   */
  public static fromExternalServiceAttributes(scope: Construct, id: string, attrs: ExternalServiceAttributes): IBaseService {
    return fromServiceAtrributes(scope, id, attrs);
  }

  /**
   * Constructs a new instance of the ExternalService class.
   */
  constructor(scope: Construct, id: string, props: ExternalServiceProps) {
    if (props.minHealthyPercent !== undefined && props.maxHealthyPercent !== undefined && props.minHealthyPercent >= props.maxHealthyPercent) {
      throw new Error('Minimum healthy percent must be less than maximum healthy percent.');
    }

    if (props.taskDefinition.compatibility !== Compatibility.EXTERNAL) {
      throw new Error('Supplied TaskDefinition is not configured for compatibility with ECS Anywhere cluster');
    }

    if (props.cluster.defaultCloudMapNamespace !== undefined) {
      throw new Error (`Cloud map integration is not supported for External service ${props.cluster.defaultCloudMapNamespace}`);
    }

    if (props.cloudMapOptions !== undefined) {
      throw new Error ('Cloud map options are not supported for External service');
    }

    if (props.enableExecuteCommand !== undefined) {
      throw new Error ('Enable Execute Command options are not supported for External service');
    }

    if (props.capacityProviderStrategies !== undefined) {
      throw new Error ('Capacity Providers are not supported for External service');
    }

    const propagateTagsFromSource = props.propagateTags ?? PropagatedTagSource.NONE;

    super(scope, id, {
      ...props,
      desiredCount: props.desiredCount,
      maxHealthyPercent: props.maxHealthyPercent === undefined ? 100 : props.maxHealthyPercent,
      minHealthyPercent: props.minHealthyPercent === undefined ? 0 : props.minHealthyPercent,
      launchType: LaunchType.EXTERNAL,
      propagateTags: propagateTagsFromSource,
      enableECSManagedTags: props.enableECSManagedTags,
    },
    {
      cluster: props.cluster.clusterName,
      taskDefinition: props.deploymentController?.type === DeploymentControllerType.EXTERNAL ? undefined : props.taskDefinition.taskDefinitionArn,
    }, props.taskDefinition);

    this.node.addValidation({
      validate: () => !this.taskDefinition.defaultContainer ? ['A TaskDefinition must have at least one essential container'] : [],
    });

    this.node.addValidation({
      validate: () => this.networkConfiguration !== undefined ? ['Network configurations not supported for an external service'] : [],
    });
  }

  /**
   * Overriden method to throw error as `attachToApplicationTargetGroup` is not supported for external service
   */
  public attachToApplicationTargetGroup(_targetGroup: elbv2.IApplicationTargetGroup): elbv2.LoadBalancerTargetProps {
    throw new Error ('Application load balancer cannot be attached to an external service');
  }

  /**
   * Overriden method to throw error as `loadBalancerTarget` is not supported for external service
   */
  public loadBalancerTarget(_options: LoadBalancerTargetOptions): IEcsLoadBalancerTarget {
    throw new Error ('External service cannot be attached as load balancer targets');
  }

  /**
   * Overriden method to throw error as `registerLoadBalancerTargets` is not supported for external service
   */
  public registerLoadBalancerTargets(..._targets: EcsTarget[]) {
    throw new Error ('External service cannot be registered as load balancer targets');
  }

  /**
   * Overriden method to throw error as `configureAwsVpcNetworkingWithSecurityGroups` is not supported for external service
   */
  // eslint-disable-next-line max-len, no-unused-vars
  protected configureAwsVpcNetworkingWithSecurityGroups(_vpc: ec2.IVpc, _assignPublicIp?: boolean, _vpcSubnets?: ec2.SubnetSelection, _securityGroups?: ec2.ISecurityGroup[]) {
    throw new Error ('Only Bridge network mode is supported for external service');
  }

  /**
   * Overriden method to throw error as `autoScaleTaskCount` is not supported for external service
   */
  public autoScaleTaskCount(_props: appscaling.EnableScalingProps): ScalableTaskCount {
    throw new Error ('Autoscaling not supported for external service');
  }

  /**
   * Overriden method to throw error as `enableCloudMap` is not supported for external service
   */
  public enableCloudMap(_options: CloudMapOptions): cloudmap.Service {
    throw new Error ('Cloud map integration not supported for an external service');
  }

  /**
   * Overriden method to throw error as `associateCloudMapService` is not supported for external service
   */
  public associateCloudMapService(_options: AssociateCloudMapServiceOptions): void {
    throw new Error ('Cloud map service association is not supported for an external service');
  }
}