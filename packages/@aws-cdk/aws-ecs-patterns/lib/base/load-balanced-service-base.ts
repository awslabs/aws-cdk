import { ICertificate } from '@aws-cdk/aws-certificatemanager';
import ec2 = require('@aws-cdk/aws-ec2');
import ecs = require('@aws-cdk/aws-ecs');
import { Cluster } from '@aws-cdk/aws-ecs';
import elbv2 = require('@aws-cdk/aws-elasticloadbalancingv2');
import cdk = require('@aws-cdk/cdk');

export enum LoadBalancerType {
  Application,
  Network
}

export interface LoadBalancedServiceBaseProps {
  /**
   * The cluster where your service will be deployed
   * You can only specify either vpc or cluster. Alternatively, you can leave both blank
   *
   * @default create a new cluster
   */
  readonly cluster?: ecs.ICluster;

  /**
   * VPC that the cluster instances or tasks are running in
   * You can only specify either vpc or cluster. Alternatively, you can leave both blank
   *
   * @default use vpc of cluster or create a new one
   */
  readonly vpc?: ec2.IVpc;

  /**
   * The image to start.
   */
  readonly image: ecs.ContainerImage;

  /**
   * The container port of the application load balancer attached to your Fargate service. Corresponds to container port mapping.
   *
   * @default 80
   */
  readonly containerPort?: number;

  /**
   * Determines whether the Application Load Balancer will be internet-facing
   *
   * @default true
   */
  readonly publicLoadBalancer?: boolean;

  /**
   * Number of desired copies of running tasks
   *
   * @default 1
   */
  readonly desiredCount?: number;

  /**
   * Whether to create an application load balancer or a network load balancer
   *
   * @default application
   */
  readonly loadBalancerType?: LoadBalancerType

  /**
   * Certificate Manager certificate to associate with the load balancer.
   * Setting this option will set the load balancer port to 443.
   *
   * @default - No certificate associated with the load balancer.
   */
  readonly certificate?: ICertificate;

  /**
   * Environment variables to pass to the container
   *
   * @default - No environment variables.
   */
  readonly environment?: { [key: string]: string };
}

/**
 * Base class for load-balanced Fargate and ECS service
 */
export abstract class LoadBalancedServiceBase extends cdk.Construct {
  public readonly loadBalancerType: LoadBalancerType;

  public readonly loadBalancer: elbv2.BaseLoadBalancer;

  public readonly listener: elbv2.ApplicationListener | elbv2.NetworkListener;

  public readonly targetGroup: elbv2.ApplicationTargetGroup | elbv2.NetworkTargetGroup;

  public readonly cluster: ecs.ICluster;

  constructor(scope: cdk.Construct, id: string, props: LoadBalancedServiceBaseProps) {
    super(scope, id);

    if (props.cluster && props.vpc) {
      throw new Error(`You can only specify either vpc or cluster. Alternatively, you can leave both blank`);
    } else if (props.cluster) {
      this.cluster = props.cluster;
    } else {
      this.cluster = new Cluster(this, 'Cluster', { vpc: props.vpc });
    }

    // Load balancer
    this.loadBalancerType = props.loadBalancerType !== undefined ? props.loadBalancerType : LoadBalancerType.Application;

    if (this.loadBalancerType !== LoadBalancerType.Application && this.loadBalancerType !== LoadBalancerType.Network) {
       throw new Error(`invalid loadBalancerType`);
    }

    const internetFacing = props.publicLoadBalancer !== undefined ? props.publicLoadBalancer : true;

    const lbProps = {
      vpc: this.cluster.vpc,
      internetFacing
    };

    if (this.loadBalancerType === LoadBalancerType.Application) {
      this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'LB', lbProps);
    } else {
      this.loadBalancer = new elbv2.NetworkLoadBalancer(this, 'LB', lbProps);
    }

    const targetProps = {
      port: 80
    };

    const hasCertificate = props.certificate !== undefined;
    if (hasCertificate && this.loadBalancerType !== LoadBalancerType.Application) {
      throw new Error("Cannot add certificate to an NLB");
    }

    if (this.loadBalancerType === LoadBalancerType.Application) {
      this.listener = (this.loadBalancer as elbv2.ApplicationLoadBalancer).addListener('PublicListener', {
        port: hasCertificate ? 443 : 80,
        open: true
      });
      this.targetGroup = this.listener.addTargets('ECS', targetProps);

      if (props.certificate !== undefined) {
        this.listener.addCertificateArns('Arns', [props.certificate.certificateArn]);
      }
    } else {
      this.listener = (this.loadBalancer as elbv2.NetworkLoadBalancer).addListener('PublicListener', { port: 80 });
      this.targetGroup = this.listener.addTargets('ECS', targetProps);
    }

    new cdk.CfnOutput(this, 'LoadBalancerDNS', { value: this.loadBalancer.loadBalancerDnsName });
  }

  protected addServiceAsTarget(service: ecs.BaseService) {
    if (this.loadBalancerType === LoadBalancerType.Application) {
      (this.targetGroup as elbv2.ApplicationTargetGroup).addTarget(service);
    } else {
      (this.targetGroup as elbv2.NetworkTargetGroup).addTarget(service);
    }
  }
}
