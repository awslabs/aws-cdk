import { Certificate, CertificateValidation, ICertificate } from '@aws-cdk/aws-certificatemanager';
import { IVpc } from '@aws-cdk/aws-ec2';
import {
  AwsLogDriver, BaseService, CloudMapOptions, Cluster, ContainerDefinition, ContainerImage, ICluster, LogDriver, PropagatedTagSource,
  Protocol, Secret,
} from '@aws-cdk/aws-ecs';
import { ApplicationListener, ApplicationLoadBalancer, ApplicationProtocol, ApplicationTargetGroup, SslPolicy } from '@aws-cdk/aws-elasticloadbalancingv2';
import { IRole } from '@aws-cdk/aws-iam';
import { ARecord, IHostedZone, RecordTarget } from '@aws-cdk/aws-route53';
import { LoadBalancerTarget } from '@aws-cdk/aws-route53-targets';
import { CfnOutput, Duration, Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';

/**
 * The properties for the base ApplicationMultipleTargetGroupsEc2Service or ApplicationMultipleTargetGroupsFargateService service.
 */
export interface ApplicationMultipleTargetGroupsServiceBaseProps {
  /**
   * The name of the cluster that hosts the service.
   *
   * If a cluster is specified, the vpc construct should be omitted. Alternatively, you can omit both cluster and vpc.
   *
   * @default - create a new cluster; if both cluster and vpc are omitted, a new VPC will be created for you.
   */
  readonly cluster?: ICluster;

  /**
   * The VPC where the container instances will be launched or the elastic network interfaces (ENIs) will be deployed.
   *
   * If a vpc is specified, the cluster construct should be omitted. Alternatively, you can omit both vpc and cluster.
   *
   * @default - uses the VPC defined in the cluster or creates a new VPC.
   */
  readonly vpc?: IVpc;

  /**
   * The properties required to create a new task definition. Only one of TaskDefinition or TaskImageOptions must be specified.
   *
   * @default none
   */
  readonly taskImageOptions?: ApplicationLoadBalancedTaskImageProps;

  /**
   * The desired number of instantiations of the task definition to keep running on the service.
   *
   * @default - If the feature flag, ECS_REMOVE_DEFAULT_DESIRED_COUNT is false, the default is 1;
   * if true, the default is 1 for all new services and uses the existing services desired count
   * when updating an existing service.
   */
  readonly desiredCount?: number;

  /**
   * The period of time, in seconds, that the Amazon ECS service scheduler ignores unhealthy
   * Elastic Load Balancing target health checks after a task has first started.
   *
   * @default - defaults to 60 seconds if at least one load balancer is in-use and it is not already set
   */
  readonly healthCheckGracePeriod?: Duration;

  /**
   * The name of the service.
   *
   * @default - CloudFormation-generated name.
   */
  readonly serviceName?: string;

  /**
   * The application load balancer that will serve traffic to the service.
   *
   * @default - a new load balancer with a listener will be created.
   */
  readonly loadBalancers?: ApplicationLoadBalancerProps[];

  /**
   * Specifies whether to propagate the tags from the task definition or the service to the tasks in the service.
   * Tags can only be propagated to the tasks within the service during service creation.
   *
   * @default - none
   */
  readonly propagateTags?: PropagatedTagSource;

  /**
   * Specifies whether to enable Amazon ECS managed tags for the tasks within the service. For more information, see
   * [Tagging Your Amazon ECS Resources](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-using-tags.html)
   *
   * @default false
   */
  readonly enableECSManagedTags?: boolean;

  /**
   * The options for configuring an Amazon ECS service to use service discovery.
   *
   * @default - AWS Cloud Map service discovery is not enabled.
   */
  readonly cloudMapOptions?: CloudMapOptions;

  /**
   * Properties to specify ALB target groups.
   *
   * @default - default portMapping registered as target group and attached to the first defined listener
   */
  readonly targetGroups?: ApplicationTargetProps[];
}

/**
 * Options for configuring a new container.
 */
export interface ApplicationLoadBalancedTaskImageProps {
  /**
   * The image used to start a container. Image or taskDefinition must be specified, not both.
   *
   * @default - none
   */
  readonly image: ContainerImage;

  /**
   * The environment variables to pass to the container.
   *
   * @default - No environment variables.
   */
  readonly environment?: { [key: string]: string };

  /**
   * The secrets to expose to the container as an environment variable.
   *
   * @default - No secret environment variables.
   */
  readonly secrets?: { [key: string]: Secret };

  /**
   * Flag to indicate whether to enable logging.
   *
   * @default true
   */
  readonly enableLogging?: boolean;

  /**
   * The log driver to use.
   *
   * @default - AwsLogDriver if enableLogging is true
   */
  readonly logDriver?: LogDriver;

  /**
   * The name of the task execution IAM role that grants the Amazon ECS container agent permission to call AWS APIs on your behalf.
   *
   * @default - No value
   */
  readonly executionRole?: IRole;

  /**
   * The name of the task IAM role that grants containers in the task permission to call AWS APIs on your behalf.
   *
   * @default - A task role is automatically created for you.
   */
  readonly taskRole?: IRole;

  /**
   * The container name value to be specified in the task definition.
   *
   * @default - web
   */
  readonly containerName?: string;

  /**
   * A list of port numbers on the container that is bound to the user-specified or automatically assigned host port.
   *
   * If you are using containers in a task with the awsvpc or host network mode, exposed ports should be specified using containerPort.
   * If you are using containers in a task with the bridge network mode and you specify a container port and not a host port,
   * your container automatically receives a host port in the ephemeral port range.
   *
   * Port mappings that are automatically assigned in this way do not count toward the 100 reserved ports limit of a container instance.
   *
   * For more information, see
   * [hostPort](https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_PortMapping.html#ECS-Type-PortMapping-hostPort).
   *
   * @default - [80]
   */
  readonly containerPorts?: number[];

  /**
   * The name of a family that this task definition is registered to. A family groups multiple versions of a task definition.
   *
   * @default - Automatically generated name.
   */
  readonly family?: string;

  /**
   * A key/value map of labels to add to the container.
   *
   * @default - No labels.
   */
  readonly dockerLabels?: { [key: string]: string };
}

/**
 * Properties to define an application target group.
 */
export interface ApplicationTargetProps {
  /**
   * The port number of the container. Only applicable when using application/network load balancers.
   */
  readonly containerPort: number;

  /**
   * The protocol used for the port mapping. Only applicable when using application load balancers.
   *
   * @default ecs.Protocol.TCP
   */
  readonly protocol?: Protocol;

  /**
   * Name of the listener the target group attached to.
   *
   * @default - default listener (first added listener)
   */
  readonly listener?: string;

  /**
   * Priority of this target group.
   *
   * The rule with the lowest priority will be used for every request.
   * If priority is not given, these target groups will be added as
   * defaults, and must not have conditions.
   *
   * Priorities must be unique.
   *
   * @default Target groups are used as defaults
   */
  readonly priority?: number;

  /**
   * Rule applies if the requested host matches the indicated host.
   *
   * May contain up to three '*' wildcards.
   *
   * Requires that priority is set.
   *
   * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-listeners.html#host-conditions
   *
   * @default No host condition
   */
  readonly hostHeader?: string;

  /**
   * Rule applies if the requested path matches the given path pattern.
   *
   * May contain up to three '*' wildcards.
   *
   * Requires that priority is set.
   *
   * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-listeners.html#path-conditions
   *
   * @default No path condition
   */
  readonly pathPattern?: string;
}

/**
 * Properties to define an application load balancer.
 */
export interface ApplicationLoadBalancerProps {
  /**
   * Name of the load balancer.
   */
  readonly name: string;

  /**
   * Listeners (at least one listener) attached to this load balancer.
   */
  readonly listeners: ApplicationListenerProps[];

  /**
   * Determines whether the Load Balancer will be internet-facing.
   *
   * @default true
   */
  readonly publicLoadBalancer?: boolean;

  /**
   * The domain name for the service, e.g. "api.example.com."
   *
   * @default - No domain name.
   */
  readonly domainName?: string;

  /**
   * The Route53 hosted zone for the domain, e.g. "example.com."
   *
   * @default - No Route53 hosted domain zone.
   */
  readonly domainZone?: IHostedZone;
}

/**
 * Properties to define an application listener.
 */
export interface ApplicationListenerProps {
  /**
   * Name of the listener.
   */
  readonly name: string;

  /**
   * The protocol for connections from clients to the load balancer.
   * The load balancer port is determined from the protocol (port 80 for
   * HTTP, port 443 for HTTPS).  A domain name and zone must be also be
   * specified if using HTTPS.
   *
   * @default ApplicationProtocol.HTTP. If a certificate is specified, the protocol will be
   * set by default to ApplicationProtocol.HTTPS.
   */
  readonly protocol?: ApplicationProtocol;

  /**
   * The port on which the listener listens for requests.
   *
   * @default - Determined from protocol if known.
   */
  readonly port?: number;

  /**
   * Certificate Manager certificate to associate with the load balancer.
   * Setting this option will set the load balancer protocol to HTTPS.
   *
   * @default - No certificate associated with the load balancer, if using
   * the HTTP protocol. For HTTPS, a DNS-validated certificate will be
   * created for the load balancer's specified domain name.
   */
  readonly certificate?: ICertificate;

  /**
   * The security policy that defines which ciphers and protocols are supported by the ALB Listener.
   *
   * @default - The recommended elastic load balancing security policy
   */
  readonly sslPolicy?: SslPolicy;
}

/**
 * The base class for ApplicationMultipleTargetGroupsEc2Service and ApplicationMultipleTargetGroupsFargateService classes.
 */
export abstract class ApplicationMultipleTargetGroupsServiceBase extends CoreConstruct {
  /**
   * The desired number of instantiations of the task definition to keep running on the service.
   * @deprecated - Use `internalDesiredCount` instead.
   */
  public readonly desiredCount: number;

  /**
   * The desired number of instantiations of the task definition to keep running on the service.
   * The default is 1 for all new services and uses the existing services desired count
   * when updating an existing service, if one is not provided.
   */
  public readonly internalDesiredCount?: number;

  /**
   * The default Application Load Balancer for the service (first added load balancer).
   */
  public readonly loadBalancer: ApplicationLoadBalancer;

  /**
   * The default listener for the service (first added listener).
   */
  public readonly listener: ApplicationListener;

  /**
   * The cluster that hosts the service.
   */
  public readonly cluster: ICluster;

  protected logDriver?: LogDriver;
  protected listeners = new Array<ApplicationListener>();
  protected targetGroups = new Array<ApplicationTargetGroup>();

  private loadBalancers = new Array<ApplicationLoadBalancer>();

  /**
   * Constructs a new instance of the ApplicationMultipleTargetGroupsServiceBase class.
   */
  constructor(scope: Construct, id: string, props: ApplicationMultipleTargetGroupsServiceBaseProps = {}) {
    super(scope, id);

    this.validateInput(props);

    this.cluster = props.cluster || this.getDefaultCluster(this, props.vpc);

    this.desiredCount = props.desiredCount || 1;
    this.internalDesiredCount = props.desiredCount;

    if (props.taskImageOptions) {
      this.logDriver = this.createLogDriver(props.taskImageOptions.enableLogging, props.taskImageOptions.logDriver);
    }

    if (props.loadBalancers) {
      for (const lbProps of props.loadBalancers) {
        const lb = this.createLoadBalancer(lbProps.name, lbProps.publicLoadBalancer);
        this.loadBalancers.push(lb);
        const protocolType = new Set<ApplicationProtocol>();
        for (const listenerProps of lbProps.listeners) {
          const protocol = this.createListenerProtocol(listenerProps.protocol, listenerProps.certificate);
          if (listenerProps.certificate !== undefined && protocol !== undefined && protocol !== ApplicationProtocol.HTTPS) {
            throw new Error('The HTTPS protocol must be used when a certificate is given');
          }
          protocolType.add(protocol);
          const listener = this.configListener(protocol, {
            certificate: listenerProps.certificate,
            domainName: lbProps.domainName,
            domainZone: lbProps.domainZone,
            listenerName: listenerProps.name,
            loadBalancer: lb,
            port: listenerProps.port,
            sslPolicy: listenerProps.sslPolicy,
          });
          this.listeners.push(listener);
        }
        const domainName = this.createDomainName(lb, lbProps.domainName, lbProps.domainZone);
        new CfnOutput(this, `LoadBalancerDNS${lb.node.id}`, { value: lb.loadBalancerDnsName });
        for (const protocol of protocolType) {
          new CfnOutput(this, `ServiceURL${lb.node.id}${protocol.toLowerCase()}`, { value: protocol.toLowerCase() + '://' + domainName });
        }
      }
      // set up default load balancer and listener.
      this.loadBalancer = this.loadBalancers[0];
      this.listener = this.listeners[0];
    } else {
      this.loadBalancer = this.createLoadBalancer('LB');
      const protocol = this.createListenerProtocol();
      this.listener = this.configListener(protocol, {
        listenerName: 'PublicListener',
        loadBalancer: this.loadBalancer,
      });
      const domainName = this.createDomainName(this.loadBalancer);

      new CfnOutput(this, 'LoadBalancerDNS', { value: this.loadBalancer.loadBalancerDnsName });
      new CfnOutput(this, 'ServiceURL', { value: protocol.toLowerCase() + '://' + domainName });
    }
  }

  /**
   * Returns the default cluster.
   */
  protected getDefaultCluster(scope: Construct, vpc?: IVpc): Cluster {
    // magic string to avoid collision with user-defined constructs.
    const DEFAULT_CLUSTER_ID = `EcsDefaultClusterMnL3mNNYN${vpc ? vpc.node.id : ''}`;
    const stack = Stack.of(scope);
    return stack.node.tryFindChild(DEFAULT_CLUSTER_ID) as Cluster || new Cluster(stack, DEFAULT_CLUSTER_ID, { vpc });
  }

  protected createAWSLogDriver(prefix: string): AwsLogDriver {
    return new AwsLogDriver({ streamPrefix: prefix });
  }

  protected findListener(name?: string): ApplicationListener {
    if (!name) {
      return this.listener;
    }
    for (const listener of this.listeners) {
      if (listener.node.id === name) {
        return listener;
      }
    }
    throw new Error(`Listener ${name} is not defined. Did you define listener with name ${name}?`);
  }

  protected registerECSTargets(service: BaseService, container: ContainerDefinition, targets: ApplicationTargetProps[]): ApplicationTargetGroup {
    for (const targetProps of targets) {
      const targetGroup = this.findListener(targetProps.listener).addTargets(`ECSTargetGroup${container.containerName}${targetProps.containerPort}`, {
        port: 80,
        targets: [
          service.loadBalancerTarget({
            containerName: container.containerName,
            containerPort: targetProps.containerPort,
            protocol: targetProps.protocol,
          }),
        ],
        hostHeader: targetProps.hostHeader,
        pathPattern: targetProps.pathPattern,
        priority: targetProps.priority,
      });
      this.targetGroups.push(targetGroup);
    }
    if (this.targetGroups.length === 0) {
      throw new Error('At least one target group should be specified.');
    }
    return this.targetGroups[0];
  }

  protected addPortMappingForTargets(container: ContainerDefinition, targets: ApplicationTargetProps[]) {
    for (const target of targets) {
      if (!container.findPortMapping(target.containerPort, target.protocol || Protocol.TCP)) {
        container.addPortMappings({
          containerPort: target.containerPort,
          protocol: target.protocol,
        });
      }
    }
  }

  /**
   * Create log driver if logging is enabled.
   */
  private createLogDriver(enableLoggingProp?: boolean, logDriverProp?: LogDriver): LogDriver | undefined {
    const enableLogging = enableLoggingProp ?? true;
    const logDriver = logDriverProp ?? (enableLogging ? this.createAWSLogDriver(this.node.id) : undefined);
    return logDriver;
  }

  private configListener(protocol: ApplicationProtocol, props: ListenerConfig): ApplicationListener {
    const listener = this.createListener(props, protocol);
    let certificate;
    if (protocol === ApplicationProtocol.HTTPS) {
      certificate = this.createListenerCertificate(props.listenerName, props.certificate, props.domainName, props.domainZone);
    } else {
      certificate = undefined;
    }
    if (certificate !== undefined) {
      listener.addCertificateArns(`Arns${props.listenerName}`, [certificate.certificateArn]);
    }

    return listener;
  }

  private validateInput(props: ApplicationMultipleTargetGroupsServiceBaseProps) {
    if (props.cluster && props.vpc) {
      throw new Error('You can only specify either vpc or cluster. Alternatively, you can leave both blank');
    }

    if (props.desiredCount !== undefined && props.desiredCount < 1) {
      throw new Error('You must specify a desiredCount greater than 0');
    }

    if (props.loadBalancers) {
      if (props.loadBalancers.length === 0) {
        throw new Error('At least one load balancer must be specified');
      }
      for (const lbProps of props.loadBalancers) {
        if (lbProps.listeners.length === 0) {
          throw new Error('At least one listener must be specified');
        }
      }
    }
  }

  private createLoadBalancer(name: string, publicLoadBalancer?: boolean): ApplicationLoadBalancer {
    const internetFacing = publicLoadBalancer ?? true;
    const lbProps = {
      vpc: this.cluster.vpc,
      internetFacing,
    };

    return new ApplicationLoadBalancer(this, name, lbProps);
  }

  private createListenerProtocol(listenerProtocol?: ApplicationProtocol, certificate?: ICertificate): ApplicationProtocol {
    return listenerProtocol ?? (certificate ? ApplicationProtocol.HTTPS : ApplicationProtocol.HTTP);
  }

  private createListenerCertificate(listenerName: string, certificate?: ICertificate, domainName?: string, domainZone?: IHostedZone): ICertificate {
    if (typeof domainName === 'undefined' || typeof domainZone === 'undefined') {
      throw new Error('A domain name and zone is required when using the HTTPS protocol');
    }

    if (certificate !== undefined) {
      return certificate;
    } else {
      return new Certificate(this, `Certificate${listenerName}`, {
        domainName,
        validation: CertificateValidation.fromDns(domainZone),
      });
    }
  }

  private createListener({ loadBalancer, listenerName, port, sslPolicy }: ListenerConfig, protocol?: ApplicationProtocol): ApplicationListener {
    return loadBalancer.addListener(listenerName, {
      protocol,
      open: true,
      port,
      sslPolicy,
    });
  }

  private createDomainName(loadBalancer: ApplicationLoadBalancer, name?: string, zone?: IHostedZone): string {
    let domainName = loadBalancer.loadBalancerDnsName;
    if (typeof name !== 'undefined') {
      if (typeof zone === 'undefined') {
        throw new Error('A Route53 hosted domain zone name is required to configure the specified domain name');
      }

      const record = new ARecord(this, `DNS${loadBalancer.node.id}`, {
        zone,
        recordName: name,
        target: RecordTarget.fromAlias(new LoadBalancerTarget(loadBalancer)),
      });

      domainName = record.domainName;
    }
    return domainName;
  }
}

/**
 * Properties to configure a listener.
 */
interface ListenerConfig {
  /**
   * Name of the listener
   */
  readonly listenerName: string;

  /**
   * Load balancer the listener attached to
   */
  readonly loadBalancer: ApplicationLoadBalancer;

  /**
   * The port on which the listener listens for requests.
   *
   * @default - Determined from protocol if known.
   */
  readonly port?: number;

  /**
   * Certificate for the listener
   *
   * @default none
   */
  readonly certificate?: ICertificate;

  /**
   * SSL Policy for the listener
   *
   * @default null
   */
  readonly sslPolicy?: SslPolicy;

  /**
   * The domain name for the service, e.g. "api.example.com."
   *
   * @default - No domain name.
   */
  readonly domainName?: string;

  /**
   * The Route53 hosted zone for the domain, e.g. "example.com."
   *
   * @default - No Route53 hosted domain zone.
   */
  readonly domainZone?: IHostedZone;
}
