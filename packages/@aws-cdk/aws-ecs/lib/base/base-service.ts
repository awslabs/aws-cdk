import * as appscaling from '@aws-cdk/aws-applicationautoscaling';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as elb from '@aws-cdk/aws-elasticloadbalancing';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as iam from '@aws-cdk/aws-iam';
import * as cloudmap from '@aws-cdk/aws-servicediscovery';
import { Annotations, Duration, IResolvable, IResource, Lazy, Resource, Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { LoadBalancerTargetOptions, NetworkMode, TaskDefinition } from '../base/task-definition';
import { ICluster, CapacityProviderStrategy, ExecuteCommandLogging } from '../cluster';
import { ContainerDefinition, Protocol } from '../container-definition';
import { CfnService } from '../ecs.generated';
import { ScalableTaskCount } from './scalable-task-count';

/**
 * The interface for a service.
 */
export interface IService extends IResource {
  /**
   * The Amazon Resource Name (ARN) of the service.
   *
   * @attribute
   */
  readonly serviceArn: string;

  /**
   * The name of the service.
   *
   * @attribute
   */
  readonly serviceName: string;
}

/**
 * The deployment controller to use for the service.
 */
export interface DeploymentController {
  /**
   * The deployment controller type to use.
   *
   * @default DeploymentControllerType.ECS
   */
  readonly type?: DeploymentControllerType;
}

/**
 * The deployment circuit breaker to use for the service
 */
export interface DeploymentCircuitBreaker {
  /**
   * Whether to enable rollback on deployment failure
   * @default false
   */
  readonly rollback?: boolean;

}

export interface EcsTarget {
  /**
   * The name of the container.
   */
  readonly containerName: string;

  /**
   * The port number of the container. Only applicable when using application/network load balancers.
   *
   * @default - Container port of the first added port mapping.
   */
  readonly containerPort?: number;

  /**
   * The protocol used for the port mapping. Only applicable when using application load balancers.
   *
   * @default Protocol.TCP
   */
  readonly protocol?: Protocol;

  /**
   * ID for a target group to be created.
   */
  readonly newTargetGroupId: string;

  /**
   * Listener and properties for adding target group to the listener.
   */
  readonly listener: ListenerConfig;
}

/**
 * Interface for ECS load balancer target.
 */
export interface IEcsLoadBalancerTarget extends elbv2.IApplicationLoadBalancerTarget, elbv2.INetworkLoadBalancerTarget, elb.ILoadBalancerTarget {
}

/**
 * The properties for the base Ec2Service or FargateService service.
 */
export interface BaseServiceOptions {
  /**
   * The name of the cluster that hosts the service.
   */
  readonly cluster: ICluster;

  /**
   * The desired number of instantiations of the task definition to keep running on the service.
   *
   * @default - When creating the service, default is 1; when updating the service, default uses
   * the current task number.
   */
  readonly desiredCount?: number;

  /**
   * The name of the service.
   *
   * @default - CloudFormation-generated name.
   */
  readonly serviceName?: string;

  /**
   * The maximum number of tasks, specified as a percentage of the Amazon ECS
   * service's DesiredCount value, that can run in a service during a
   * deployment.
   *
   * @default - 100 if daemon, otherwise 200
   */
  readonly maxHealthyPercent?: number;

  /**
   * The minimum number of tasks, specified as a percentage of
   * the Amazon ECS service's DesiredCount value, that must
   * continue to run and remain healthy during a deployment.
   *
   * @default - 0 if daemon, otherwise 50
   */
  readonly minHealthyPercent?: number;

  /**
   * The period of time, in seconds, that the Amazon ECS service scheduler ignores unhealthy
   * Elastic Load Balancing target health checks after a task has first started.
   *
   * @default - defaults to 60 seconds if at least one load balancer is in-use and it is not already set
   */
  readonly healthCheckGracePeriod?: Duration;

  /**
   * The options for configuring an Amazon ECS service to use service discovery.
   *
   * @default - AWS Cloud Map service discovery is not enabled.
   */
  readonly cloudMapOptions?: CloudMapOptions;

  /**
   * Specifies whether to propagate the tags from the task definition or the service to the tasks in the service
   *
   * Valid values are: PropagatedTagSource.SERVICE, PropagatedTagSource.TASK_DEFINITION or PropagatedTagSource.NONE
   *
   * @default PropagatedTagSource.NONE
   */
  readonly propagateTags?: PropagatedTagSource;

  /**
   * Specifies whether to propagate the tags from the task definition or the service to the tasks in the service.
   * Tags can only be propagated to the tasks within the service during service creation.
   *
   * @deprecated Use `propagateTags` instead.
   * @default PropagatedTagSource.NONE
   */
  readonly propagateTaskTagsFrom?: PropagatedTagSource;

  /**
   * Specifies whether to enable Amazon ECS managed tags for the tasks within the service. For more information, see
   * [Tagging Your Amazon ECS Resources](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-using-tags.html)
   *
   * @default false
   */
  readonly enableECSManagedTags?: boolean;

  /**
   * Specifies which deployment controller to use for the service. For more information, see
   * [Amazon ECS Deployment Types](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-types.html)
   *
   * @default - Rolling update (ECS)
   */
  readonly deploymentController?: DeploymentController;

  /**
   * Whether to enable the deployment circuit breaker. If this property is defined, circuit breaker will be implicitly
   * enabled.
   * @default - disabled
   */
  readonly circuitBreaker?: DeploymentCircuitBreaker;

  /**
   * A list of Capacity Provider strategies used to place a service.
   *
   * @default - undefined
   *
   */
  readonly capacityProviderStrategies?: CapacityProviderStrategy[];

  /**
   * Whether to enable the ability to execute into a container
   *
   *  @default - undefined
   */
  readonly enableExecuteCommand?: boolean;
}

/**
 * Complete base service properties that are required to be supplied by the implementation
 * of the BaseService class.
 */
export interface BaseServiceProps extends BaseServiceOptions {
  /**
   * The launch type on which to run your service.
   *
   * LaunchType will be omitted if capacity provider strategies are specified on the service.
   *
   * @see - https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-ecs-service.html#cfn-ecs-service-capacityproviderstrategy
   *
   * Valid values are: LaunchType.ECS or LaunchType.FARGATE or LaunchType.EXTERNAL
   */
  readonly launchType: LaunchType;
}

/**
 * Base class for configuring listener when registering targets.
 */
export abstract class ListenerConfig {
  /**
   * Create a config for adding target group to ALB listener.
   */
  public static applicationListener(listener: elbv2.ApplicationListener, props?: elbv2.AddApplicationTargetsProps): ListenerConfig {
    return new ApplicationListenerConfig(listener, props);
  }

  /**
   * Create a config for adding target group to NLB listener.
   */
  public static networkListener(listener: elbv2.NetworkListener, props?: elbv2.AddNetworkTargetsProps): ListenerConfig {
    return new NetworkListenerConfig(listener, props);
  }

  /**
   * Create and attach a target group to listener.
   */
  public abstract addTargets(id: string, target: LoadBalancerTargetOptions, service: BaseService): void;
}

/**
 * Class for configuring application load balancer listener when registering targets.
 */
class ApplicationListenerConfig extends ListenerConfig {
  constructor(private readonly listener: elbv2.ApplicationListener, private readonly props?: elbv2.AddApplicationTargetsProps) {
    super();
  }

  /**
   * Create and attach a target group to listener.
   */
  public addTargets(id: string, target: LoadBalancerTargetOptions, service: BaseService) {
    const props = this.props || {};
    const protocol = props.protocol;
    const port = props.port ?? (protocol === elbv2.ApplicationProtocol.HTTPS ? 443 : 80);
    this.listener.addTargets(id, {
      ... props,
      targets: [
        service.loadBalancerTarget({
          ...target,
        }),
      ],
      port,
    });
  }
}

/**
 * Class for configuring network load balancer listener when registering targets.
 */
class NetworkListenerConfig extends ListenerConfig {
  constructor(private readonly listener: elbv2.NetworkListener, private readonly props?: elbv2.AddNetworkTargetsProps) {
    super();
  }

  /**
   * Create and attach a target group to listener.
   */
  public addTargets(id: string, target: LoadBalancerTargetOptions, service: BaseService) {
    const port = this.props?.port ?? 80;
    this.listener.addTargets(id, {
      ... this.props,
      targets: [
        service.loadBalancerTarget({
          ...target,
        }),
      ],
      port,
    });
  }
}

/**
 * The interface for BaseService.
 */
export interface IBaseService extends IService {
  /**
   * The cluster that hosts the service.
   */
  readonly cluster: ICluster;
}

/**
 * The base class for Ec2Service and FargateService services.
 */
export abstract class BaseService extends Resource
  implements IBaseService, elbv2.IApplicationLoadBalancerTarget, elbv2.INetworkLoadBalancerTarget, elb.ILoadBalancerTarget {

  /**
   * The security groups which manage the allowed network traffic for the service.
   */
  public readonly connections: ec2.Connections = new ec2.Connections();

  /**
   * The Amazon Resource Name (ARN) of the service.
   */
  public readonly serviceArn: string;

  /**
   * The name of the service.
   *
   * @attribute
   */
  public readonly serviceName: string;

  /**
   * The task definition to use for tasks in the service.
   */
  public readonly taskDefinition: TaskDefinition;

  /**
   * The cluster that hosts the service.
   */
  public readonly cluster: ICluster;

  /**
   * The details of the AWS Cloud Map service.
   */
  protected cloudmapService?: cloudmap.Service;

  /**
   * A list of Elastic Load Balancing load balancer objects, containing the load balancer name, the container
   * name (as it appears in a container definition), and the container port to access from the load balancer.
   */
  protected loadBalancers = new Array<CfnService.LoadBalancerProperty>();

  /**
   * A list of Elastic Load Balancing load balancer objects, containing the load balancer name, the container
   * name (as it appears in a container definition), and the container port to access from the load balancer.
   */
  protected networkConfiguration?: CfnService.NetworkConfigurationProperty;

  /**
   * The details of the service discovery registries to assign to this service.
   * For more information, see Service Discovery.
   */
  protected serviceRegistries = new Array<CfnService.ServiceRegistryProperty>();

  private readonly resource: CfnService;
  private scalableTaskCount?: ScalableTaskCount;

  /**
   * Constructs a new instance of the BaseService class.
   */
  constructor(
    scope: Construct,
    id: string,
    props: BaseServiceProps,
    additionalProps: any,
    taskDefinition: TaskDefinition) {
    super(scope, id, {
      physicalName: props.serviceName,
    });

    if (props.propagateTags && props.propagateTaskTagsFrom) {
      throw new Error('You can only specify either propagateTags or propagateTaskTagsFrom. Alternatively, you can leave both blank');
    }

    this.taskDefinition = taskDefinition;

    // launchType will set to undefined if using external DeploymentController or capacityProviderStrategies
    const launchType = props.deploymentController?.type === DeploymentControllerType.EXTERNAL ||
      props.capacityProviderStrategies !== undefined ?
      undefined : props.launchType;

    const propagateTagsFromSource = props.propagateTaskTagsFrom ?? props.propagateTags ?? PropagatedTagSource.NONE;

    this.resource = new CfnService(this, 'Service', {
      desiredCount: props.desiredCount,
      serviceName: this.physicalName,
      loadBalancers: Lazy.any({ produce: () => this.loadBalancers }, { omitEmptyArray: true }),
      deploymentConfiguration: {
        maximumPercent: props.maxHealthyPercent || 200,
        minimumHealthyPercent: props.minHealthyPercent === undefined ? 50 : props.minHealthyPercent,
        deploymentCircuitBreaker: props.circuitBreaker ? {
          enable: true,
          rollback: props.circuitBreaker.rollback ?? false,
        } : undefined,
      },
      propagateTags: propagateTagsFromSource === PropagatedTagSource.NONE ? undefined : props.propagateTags,
      enableEcsManagedTags: props.enableECSManagedTags ?? false,
      deploymentController: props.circuitBreaker ? {
        type: DeploymentControllerType.ECS,
      } : props.deploymentController,
      launchType: launchType,
      enableExecuteCommand: props.enableExecuteCommand,
      capacityProviderStrategy: props.capacityProviderStrategies,
      healthCheckGracePeriodSeconds: this.evaluateHealthGracePeriod(props.healthCheckGracePeriod),
      /* role: never specified, supplanted by Service Linked Role */
      networkConfiguration: Lazy.any({ produce: () => this.networkConfiguration }, { omitEmptyArray: true }),
      serviceRegistries: Lazy.any({ produce: () => this.serviceRegistries }, { omitEmptyArray: true }),
      ...additionalProps,
    });

    if (props.deploymentController?.type === DeploymentControllerType.EXTERNAL) {
      Annotations.of(this).addWarning('taskDefinition and launchType are blanked out when using external deployment controller.');
    }

    this.serviceArn = this.getResourceArnAttribute(this.resource.ref, {
      service: 'ecs',
      resource: 'service',
      resourceName: `${props.cluster.clusterName}/${this.physicalName}`,
    });
    this.serviceName = this.getResourceNameAttribute(this.resource.attrName);

    this.cluster = props.cluster;

    if (props.cloudMapOptions) {
      this.enableCloudMap(props.cloudMapOptions);
    }

    if (props.enableExecuteCommand) {
      this.enableExecuteCommand();

      const logging = this.cluster.executeCommandConfiguration?.logging ?? ExecuteCommandLogging.DEFAULT;

      if (this.cluster.executeCommandConfiguration?.kmsKey) {
        this.enableExecuteCommandEncryption(logging);
      }
      if (logging !== ExecuteCommandLogging.NONE) {
        this.executeCommandLogConfiguration();
      }
    }
    this.node.defaultChild = this.resource;
  }

  /**
   * The CloudMap service created for this service, if any.
   */
  public get cloudMapService(): cloudmap.IService | undefined {
    return this.cloudmapService;
  }

  private executeCommandLogConfiguration() {
    const logConfiguration = this.cluster.executeCommandConfiguration?.logConfiguration;
    this.taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
      actions: [
        'logs:DescribeLogGroups',
      ],
      resources: ['*'],
    }));

    const logGroupArn = logConfiguration?.cloudWatchLogGroup ? `arn:aws:logs:${this.stack.region}:${this.stack.account}:log-group:${logConfiguration.cloudWatchLogGroup.logGroupName}:*` : '*';
    this.taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
      actions: [
        'logs:CreateLogStream',
        'logs:DescribeLogStreams',
        'logs:PutLogEvents',
      ],
      resources: [logGroupArn],
    }));

    if (logConfiguration?.s3Bucket?.bucketName) {
      this.taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
        actions: [
          's3:GetBucketLocation',
        ],
        resources: ['*'],
      }));
      this.taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
        actions: [
          's3:PutObject',
        ],
        resources: [`arn:aws:s3:::${logConfiguration.s3Bucket.bucketName}/*`],
      }));
      if (logConfiguration.s3EncryptionEnabled) {
        this.taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
          actions: [
            's3:GetEncryptionConfiguration',
          ],
          resources: [`arn:aws:s3:::${logConfiguration.s3Bucket.bucketName}`],
        }));
      }
    }
  }

  private enableExecuteCommandEncryption(logging: ExecuteCommandLogging) {
    this.taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
      actions: [
        'kms:Decrypt',
        'kms:GenerateDataKey',
      ],
      resources: [`${this.cluster.executeCommandConfiguration?.kmsKey?.keyArn}`],
    }));

    this.cluster.executeCommandConfiguration?.kmsKey?.addToResourcePolicy(new iam.PolicyStatement({
      actions: [
        'kms:*',
      ],
      resources: ['*'],
      principals: [new iam.ArnPrincipal(`arn:aws:iam::${this.stack.account}:root`)],
    }));

    if (logging === ExecuteCommandLogging.DEFAULT || this.cluster.executeCommandConfiguration?.logConfiguration?.cloudWatchEncryptionEnabled) {
      this.cluster.executeCommandConfiguration?.kmsKey?.addToResourcePolicy(new iam.PolicyStatement({
        actions: [
          'kms:Encrypt*',
          'kms:Decrypt*',
          'kms:ReEncrypt*',
          'kms:GenerateDataKey*',
          'kms:Describe*',
        ],
        resources: ['*'],
        principals: [new iam.ServicePrincipal(`logs.${this.stack.region}.amazonaws.com`)],
        conditions: {
          ArnLike: { 'kms:EncryptionContext:aws:logs:arn': `arn:aws:logs:${this.stack.region}:${this.stack.account}:*` },
        },
      }));
    }
  }

  /**
   * This method is called to attach this service to an Application Load Balancer.
   *
   * Don't call this function directly. Instead, call `listener.addTargets()`
   * to add this service to a load balancer.
   */
  public attachToApplicationTargetGroup(targetGroup: elbv2.IApplicationTargetGroup): elbv2.LoadBalancerTargetProps {
    return this.defaultLoadBalancerTarget.attachToApplicationTargetGroup(targetGroup);
  }

  /**
   * Registers the service as a target of a Classic Load Balancer (CLB).
   *
   * Don't call this. Call `loadBalancer.addTarget()` instead.
   */
  public attachToClassicLB(loadBalancer: elb.LoadBalancer): void {
    return this.defaultLoadBalancerTarget.attachToClassicLB(loadBalancer);
  }

  /**
   * Return a load balancing target for a specific container and port.
   *
   * Use this function to create a load balancer target if you want to load balance to
   * another container than the first essential container or the first mapped port on
   * the container.
   *
   * Use the return value of this function where you would normally use a load balancer
   * target, instead of the `Service` object itself.
   *
   * @example
   *
   * listener.addTargets('ECS', {
   *   port: 80,
   *   targets: [service.loadBalancerTarget({
   *     containerName: 'MyContainer',
   *     containerPort: 1234,
   *   })],
   * });
   */
  public loadBalancerTarget(options: LoadBalancerTargetOptions): IEcsLoadBalancerTarget {
    const self = this;
    const target = this.taskDefinition._validateTarget(options);
    const connections = self.connections;
    return {
      attachToApplicationTargetGroup(targetGroup: elbv2.ApplicationTargetGroup): elbv2.LoadBalancerTargetProps {
        targetGroup.registerConnectable(self, self.taskDefinition._portRangeFromPortMapping(target.portMapping));
        return self.attachToELBv2(targetGroup, target.containerName, target.portMapping.containerPort);
      },
      attachToNetworkTargetGroup(targetGroup: elbv2.NetworkTargetGroup): elbv2.LoadBalancerTargetProps {
        return self.attachToELBv2(targetGroup, target.containerName, target.portMapping.containerPort);
      },
      connections,
      attachToClassicLB(loadBalancer: elb.LoadBalancer): void {
        return self.attachToELB(loadBalancer, target.containerName, target.portMapping.containerPort);
      },
    };
  }

  /**
   * Use this function to create all load balancer targets to be registered in this service, add them to
   * target groups, and attach target groups to listeners accordingly.
   *
   * Alternatively, you can use `listener.addTargets()` to create targets and add them to target groups.
   *
   * @example
   *
   * service.registerLoadBalancerTargets(
   *   {
   *     containerName: 'web',
   *     containerPort: 80,
   *     newTargetGroupId: 'ECS',
   *     listener: ecs.ListenerConfig.applicationListener(listener, {
   *       protocol: elbv2.ApplicationProtocol.HTTPS
   *     }),
   *   },
   * )
   */
  public registerLoadBalancerTargets(...targets: EcsTarget[]) {
    for (const target of targets) {
      target.listener.addTargets(target.newTargetGroupId, {
        containerName: target.containerName,
        containerPort: target.containerPort,
        protocol: target.protocol,
      }, this);
    }
  }

  /**
   * This method is called to attach this service to a Network Load Balancer.
   *
   * Don't call this function directly. Instead, call `listener.addTargets()`
   * to add this service to a load balancer.
   */
  public attachToNetworkTargetGroup(targetGroup: elbv2.INetworkTargetGroup): elbv2.LoadBalancerTargetProps {
    return this.defaultLoadBalancerTarget.attachToNetworkTargetGroup(targetGroup);
  }

  /**
   * An attribute representing the minimum and maximum task count for an AutoScalingGroup.
   */
  public autoScaleTaskCount(props: appscaling.EnableScalingProps) {
    if (this.scalableTaskCount) {
      throw new Error('AutoScaling of task count already enabled for this service');
    }

    return this.scalableTaskCount = new ScalableTaskCount(this, 'TaskCount', {
      serviceNamespace: appscaling.ServiceNamespace.ECS,
      resourceId: `service/${this.cluster.clusterName}/${this.serviceName}`,
      dimension: 'ecs:service:DesiredCount',
      role: this.makeAutoScalingRole(),
      ...props,
    });
  }

  /**
   * Enable CloudMap service discovery for the service
   *
   * @returns The created CloudMap service
   */
  public enableCloudMap(options: CloudMapOptions): cloudmap.Service {
    const sdNamespace = options.cloudMapNamespace ?? this.cluster.defaultCloudMapNamespace;
    if (sdNamespace === undefined) {
      throw new Error('Cannot enable service discovery if a Cloudmap Namespace has not been created in the cluster.');
    }

    // Determine DNS type based on network mode
    const networkMode = this.taskDefinition.networkMode;
    if (networkMode === NetworkMode.NONE) {
      throw new Error('Cannot use a service discovery if NetworkMode is None. Use Bridge, Host or AwsVpc instead.');
    }

    // Bridge or host network mode requires SRV records
    let dnsRecordType = options.dnsRecordType;

    if (networkMode === NetworkMode.BRIDGE || networkMode === NetworkMode.HOST) {
      if (dnsRecordType === undefined) {
        dnsRecordType = cloudmap.DnsRecordType.SRV;
      }
      if (dnsRecordType !== cloudmap.DnsRecordType.SRV) {
        throw new Error('SRV records must be used when network mode is Bridge or Host.');
      }
    }

    // Default DNS record type for AwsVpc network mode is A Records
    if (networkMode === NetworkMode.AWS_VPC) {
      if (dnsRecordType === undefined) {
        dnsRecordType = cloudmap.DnsRecordType.A;
      }
    }

    const { containerName, containerPort } = determineContainerNameAndPort({
      taskDefinition: this.taskDefinition,
      dnsRecordType: dnsRecordType!,
      container: options.container,
      containerPort: options.containerPort,
    });

    const cloudmapService = new cloudmap.Service(this, 'CloudmapService', {
      namespace: sdNamespace,
      name: options.name,
      dnsRecordType: dnsRecordType!,
      customHealthCheck: { failureThreshold: options.failureThreshold || 1 },
      dnsTtl: options.dnsTtl,
    });

    const serviceArn = cloudmapService.serviceArn;

    // add Cloudmap service to the ECS Service's serviceRegistry
    this.addServiceRegistry({
      arn: serviceArn,
      containerName,
      containerPort,
    });

    this.cloudmapService = cloudmapService;

    return cloudmapService;
  }

  /**
   * Associates this service with a CloudMap service
   */
  public associateCloudMapService(options: AssociateCloudMapServiceOptions): void {
    const service = options.service;

    const { containerName, containerPort } = determineContainerNameAndPort({
      taskDefinition: this.taskDefinition,
      dnsRecordType: service.dnsRecordType,
      container: options.container,
      containerPort: options.containerPort,
    });

    // add Cloudmap service to the ECS Service's serviceRegistry
    this.addServiceRegistry({
      arn: service.serviceArn,
      containerName,
      containerPort,
    });
  }

  /**
   * This method returns the specified CloudWatch metric name for this service.
   */
  public metric(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return new cloudwatch.Metric({
      namespace: 'AWS/ECS',
      metricName,
      dimensions: { ClusterName: this.cluster.clusterName, ServiceName: this.serviceName },
      ...props,
    }).attachTo(this);
  }

  /**
   * This method returns the CloudWatch metric for this service's memory utilization.
   *
   * @default average over 5 minutes
   */
  public metricMemoryUtilization(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.metric('MemoryUtilization', props);
  }

  /**
   * This method returns the CloudWatch metric for this service's CPU utilization.
   *
   * @default average over 5 minutes
   */
  public metricCpuUtilization(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.metric('CPUUtilization', props);
  }

  /**
   * This method is called to create a networkConfiguration.
   * @deprecated use configureAwsVpcNetworkingWithSecurityGroups instead.
   */
  // eslint-disable-next-line max-len
  protected configureAwsVpcNetworking(vpc: ec2.IVpc, assignPublicIp?: boolean, vpcSubnets?: ec2.SubnetSelection, securityGroup?: ec2.ISecurityGroup) {
    if (vpcSubnets === undefined) {
      vpcSubnets = assignPublicIp ? { subnetType: ec2.SubnetType.PUBLIC } : {};
    }
    if (securityGroup === undefined) {
      securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', { vpc });
    }
    this.connections.addSecurityGroup(securityGroup);

    this.networkConfiguration = {
      awsvpcConfiguration: {
        assignPublicIp: assignPublicIp ? 'ENABLED' : 'DISABLED',
        subnets: vpc.selectSubnets(vpcSubnets).subnetIds,
        securityGroups: Lazy.list({ produce: () => [securityGroup!.securityGroupId] }),
      },
    };
  }

  /**
   * This method is called to create a networkConfiguration.
   */
  // eslint-disable-next-line max-len
  protected configureAwsVpcNetworkingWithSecurityGroups(vpc: ec2.IVpc, assignPublicIp?: boolean, vpcSubnets?: ec2.SubnetSelection, securityGroups?: ec2.ISecurityGroup[]) {
    if (vpcSubnets === undefined) {
      vpcSubnets = assignPublicIp ? { subnetType: ec2.SubnetType.PUBLIC } : {};
    }
    if (securityGroups === undefined || securityGroups.length === 0) {
      securityGroups = [new ec2.SecurityGroup(this, 'SecurityGroup', { vpc })];
    }

    securityGroups.forEach((sg) => { this.connections.addSecurityGroup(sg); }, this);

    this.networkConfiguration = {
      awsvpcConfiguration: {
        assignPublicIp: assignPublicIp ? 'ENABLED' : 'DISABLED',
        subnets: vpc.selectSubnets(vpcSubnets).subnetIds,
        securityGroups: securityGroups.map((sg) => sg.securityGroupId),
      },
    };
  }

  private renderServiceRegistry(registry: ServiceRegistry): CfnService.ServiceRegistryProperty {
    return {
      registryArn: registry.arn,
      containerName: registry.containerName,
      containerPort: registry.containerPort,
    };
  }

  /**
   * Shared logic for attaching to an ELB
   */
  private attachToELB(loadBalancer: elb.LoadBalancer, containerName: string, containerPort: number): void {
    if (this.taskDefinition.networkMode === NetworkMode.AWS_VPC) {
      throw new Error('Cannot use a Classic Load Balancer if NetworkMode is AwsVpc. Use Host or Bridge instead.');
    }
    if (this.taskDefinition.networkMode === NetworkMode.NONE) {
      throw new Error('Cannot use a Classic Load Balancer if NetworkMode is None. Use Host or Bridge instead.');
    }

    this.loadBalancers.push({
      loadBalancerName: loadBalancer.loadBalancerName,
      containerName,
      containerPort,
    });
  }

  /**
   * Shared logic for attaching to an ELBv2
   */
  private attachToELBv2(targetGroup: elbv2.ITargetGroup, containerName: string, containerPort: number): elbv2.LoadBalancerTargetProps {
    if (this.taskDefinition.networkMode === NetworkMode.NONE) {
      throw new Error('Cannot use a load balancer if NetworkMode is None. Use Bridge, Host or AwsVpc instead.');
    }

    this.loadBalancers.push({
      targetGroupArn: targetGroup.targetGroupArn,
      containerName,
      containerPort,
    });

    // Service creation can only happen after the load balancer has
    // been associated with our target group(s), so add ordering dependency.
    this.resource.node.addDependency(targetGroup.loadBalancerAttached);

    const targetType = this.taskDefinition.networkMode === NetworkMode.AWS_VPC ? elbv2.TargetType.IP : elbv2.TargetType.INSTANCE;
    return { targetType };
  }

  private get defaultLoadBalancerTarget() {
    return this.loadBalancerTarget({
      containerName: this.taskDefinition.defaultContainer!.containerName,
    });
  }

  /**
   * Generate the role that will be used for autoscaling this service
   */
  private makeAutoScalingRole(): iam.IRole {
    // Use a Service Linked Role.
    return iam.Role.fromRoleArn(this, 'ScalingRole', Stack.of(this).formatArn({
      region: '',
      service: 'iam',
      resource: 'role/aws-service-role/ecs.application-autoscaling.amazonaws.com',
      resourceName: 'AWSServiceRoleForApplicationAutoScaling_ECSService',
    }));
  }

  /**
   * Associate Service Discovery (Cloud Map) service
   */
  private addServiceRegistry(registry: ServiceRegistry) {
    if (this.serviceRegistries.length >= 1) {
      throw new Error('Cannot associate with the given service discovery registry. ECS supports at most one service registry per service.');
    }

    const sr = this.renderServiceRegistry(registry);
    this.serviceRegistries.push(sr);
  }

  /**
   *  Return the default grace period when load balancers are configured and
   *  healthCheckGracePeriod is not already set
   */
  private evaluateHealthGracePeriod(providedHealthCheckGracePeriod?: Duration): IResolvable {
    return Lazy.any({
      produce: () => providedHealthCheckGracePeriod?.toSeconds() ?? (this.loadBalancers.length > 0 ? 60 : undefined),
    });
  }

  private enableExecuteCommand() {
    this.taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
      actions: [
        'ssmmessages:CreateControlChannel',
        'ssmmessages:CreateDataChannel',
        'ssmmessages:OpenControlChannel',
        'ssmmessages:OpenDataChannel',
      ],
      resources: ['*'],
    }));
  }
}

/**
 * The options to enabling AWS Cloud Map for an Amazon ECS service.
 */
export interface CloudMapOptions {
  /**
   * The name of the Cloud Map service to attach to the ECS service.
   *
   * @default CloudFormation-generated name
   */
  readonly name?: string,

  /**
   * The service discovery namespace for the Cloud Map service to attach to the ECS service.
   *
   * @default - the defaultCloudMapNamespace associated to the cluster
   */
  readonly cloudMapNamespace?: cloudmap.INamespace;

  /**
   * The DNS record type that you want AWS Cloud Map to create. The supported record types are A or SRV.
   *
   * @default - DnsRecordType.A if TaskDefinition.networkMode = AWS_VPC, otherwise DnsRecordType.SRV
   */
  readonly dnsRecordType?: cloudmap.DnsRecordType.A | cloudmap.DnsRecordType.SRV,

  /**
   * The amount of time that you want DNS resolvers to cache the settings for this record.
   *
   * @default 60
   */
  readonly dnsTtl?: Duration;

  /**
   * The number of 30-second intervals that you want Cloud Map to wait after receiving an UpdateInstanceCustomHealthStatus
   * request before it changes the health status of a service instance.
   *
   * NOTE: This is used for HealthCheckCustomConfig
   */
  readonly failureThreshold?: number;

  /**
   * The container to point to for a SRV record.
   * @default - the task definition's default container
   */
  readonly container?: ContainerDefinition;

  /**
   * The port to point to for a SRV record.
   * @default - the default port of the task definition's default container
   */
  readonly containerPort?: number;
}

/**
 * The options for using a cloudmap service.
 */
export interface AssociateCloudMapServiceOptions {
  /**
   * The cloudmap service to register with.
   */
  readonly service: cloudmap.IService;

  /**
   * The container to point to for a SRV record.
   * @default - the task definition's default container
   */
  readonly container?: ContainerDefinition;

  /**
   * The port to point to for a SRV record.
   * @default - the default port of the task definition's default container
   */
  readonly containerPort?: number;
}

/**
 * Service Registry for ECS service
 */
interface ServiceRegistry {
  /**
   * Arn of the Cloud Map Service that will register a Cloud Map Instance for your ECS Service
   */
  readonly arn: string;

  /**
   * The container name value, already specified in the task definition, to be used for your service discovery service.
   * If the task definition that your service task specifies uses the bridge or host network mode,
   * you must specify a containerName and containerPort combination from the task definition.
   * If the task definition that your service task specifies uses the awsvpc network mode and a type SRV DNS record is
   * used, you must specify either a containerName and containerPort combination or a port value, but not both.
   */
  readonly containerName?: string;

  /**
   * The container port value, already specified in the task definition, to be used for your service discovery service.
   * If the task definition that your service task specifies uses the bridge or host network mode,
   * you must specify a containerName and containerPort combination from the task definition.
   * If the task definition that your service task specifies uses the awsvpc network mode and a type SRV DNS record is
   * used, you must specify either a containerName and containerPort combination or a port value, but not both.
   */
  readonly containerPort?: number;
}

/**
 * The launch type of an ECS service
 */
export enum LaunchType {
  /**
   * The service will be launched using the EC2 launch type
   */
  EC2 = 'EC2',

  /**
   * The service will be launched using the FARGATE launch type
   */
  FARGATE = 'FARGATE',

  /**
   * The service will be launched using the EXTERNAL launch type
   */
  EXTERNAL = 'EXTERNAL'
}

/**
 * The deployment controller type to use for the service.
 */
export enum DeploymentControllerType {
  /**
   * The rolling update (ECS) deployment type involves replacing the current
   * running version of the container with the latest version.
   */
  ECS = 'ECS',

  /**
   * The blue/green (CODE_DEPLOY) deployment type uses the blue/green deployment model powered by AWS CodeDeploy
   */
  CODE_DEPLOY = 'CODE_DEPLOY',

  /**
   * The external (EXTERNAL) deployment type enables you to use any third-party deployment controller
   */
  EXTERNAL = 'EXTERNAL'
}

/**
 * Propagate tags from either service or task definition
 */
export enum PropagatedTagSource {
  /**
   * Propagate tags from service
   */
  SERVICE = 'SERVICE',

  /**
   * Propagate tags from task definition
   */
  TASK_DEFINITION = 'TASK_DEFINITION',

  /**
   * Do not propagate
   */
  NONE = 'NONE'
}

/**
 * Options for `determineContainerNameAndPort`
 */
interface DetermineContainerNameAndPortOptions {
  dnsRecordType: cloudmap.DnsRecordType;
  taskDefinition: TaskDefinition;
  container?: ContainerDefinition;
  containerPort?: number;
}

/**
 * Determine the name of the container and port to target for the service registry.
 */
function determineContainerNameAndPort(options: DetermineContainerNameAndPortOptions) {
  // If the record type is SRV, then provide the containerName and containerPort to target.
  // We use the name of the default container and the default port of the default container
  // unless the user specifies otherwise.
  if (options.dnsRecordType === cloudmap.DnsRecordType.SRV) {
    // Ensure the user-provided container is from the right task definition.
    if (options.container && options.container.taskDefinition != options.taskDefinition) {
      throw new Error('Cannot add discovery for a container from another task definition');
    }

    const container = options.container ?? options.taskDefinition.defaultContainer!;

    // Ensure that any port given by the user is mapped.
    if (options.containerPort && !container.portMappings.some(mapping => mapping.containerPort === options.containerPort)) {
      throw new Error('Cannot add discovery for a container port that has not been mapped');
    }

    return {
      containerName: container.containerName,
      containerPort: options.containerPort ?? options.taskDefinition.defaultContainer!.containerPort,
    };
  }

  return {};
}
