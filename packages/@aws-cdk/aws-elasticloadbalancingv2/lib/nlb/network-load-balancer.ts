import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as ec2 from '@aws-cdk/aws-ec2';
import { PolicyStatement, ServicePrincipal } from '@aws-cdk/aws-iam';
import { IBucket } from '@aws-cdk/aws-s3';
import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import { Resource } from '@aws-cdk/core';
import * as cxapi from '@aws-cdk/cx-api';
import { Construct } from 'constructs';
import { NetworkELBMetrics } from '../elasticloadbalancingv2-canned-metrics.generated';
import { BaseLoadBalancer, BaseLoadBalancerLookupOptions, BaseLoadBalancerProps, ILoadBalancerV2 } from '../shared/base-load-balancer';
import { BaseNetworkListenerProps, NetworkListener } from './network-listener';

/**
 * Properties for a network load balancer
 */
export interface NetworkLoadBalancerProps extends BaseLoadBalancerProps {
  /**
   * Indicates whether cross-zone load balancing is enabled.
   *
   * @default false
   */
  readonly crossZoneEnabled?: boolean;
}

/**
 * Properties to reference an existing load balancer
 */
export interface NetworkLoadBalancerAttributes {
  /**
   * ARN of the load balancer
   */
  readonly loadBalancerArn: string;

  /**
   * The canonical hosted zone ID of this load balancer
   *
   * @default - When not provided, LB cannot be used as Route53 Alias target.
   */
  readonly loadBalancerCanonicalHostedZoneId?: string;

  /**
   * The DNS name of this load balancer
   *
   * @default - When not provided, LB cannot be used as Route53 Alias target.
   */
  readonly loadBalancerDnsName?: string;

  /**
   * The VPC to associate with the load balancer.
   *
   * @default - When not provided, listeners cannot be created on imported load
   * balancers.
   */
  readonly vpc?: ec2.IVpc;
}

/**
 * Options for looking up an NetworkLoadBalancer
 */
export interface NetworkLoadBalancerLookupOptions extends BaseLoadBalancerLookupOptions {
}

/**
 * Define a new network load balancer
 *
 * @resource AWS::ElasticLoadBalancingV2::LoadBalancer
 */
export class NetworkLoadBalancer extends BaseLoadBalancer implements INetworkLoadBalancer {
  /**
   * Looks up the network load balancer.
   */
  public static fromLookup(scope: Construct, id: string, options: NetworkLoadBalancerLookupOptions): INetworkLoadBalancer {
    const props = BaseLoadBalancer._queryContextProvider(scope, {
      userOptions: options,
      loadBalancerType: cxschema.LoadBalancerType.NETWORK,
    });

    return new LookedUpNetworkLoadBalancer(scope, id, props);
  }

  public static fromNetworkLoadBalancerAttributes(scope: Construct, id: string, attrs: NetworkLoadBalancerAttributes): INetworkLoadBalancer {
    class Import extends Resource implements INetworkLoadBalancer {
      public readonly loadBalancerArn = attrs.loadBalancerArn;
      public readonly vpc?: ec2.IVpc = attrs.vpc;
      public addListener(lid: string, props: BaseNetworkListenerProps): NetworkListener {
        return new NetworkListener(this, lid, {
          loadBalancer: this,
          ...props,
        });
      }

      public get loadBalancerCanonicalHostedZoneId(): string {
        if (attrs.loadBalancerCanonicalHostedZoneId) { return attrs.loadBalancerCanonicalHostedZoneId; }
        // eslint-disable-next-line max-len
        throw new Error(`'loadBalancerCanonicalHostedZoneId' was not provided when constructing Network Load Balancer ${this.node.path} from attributes`);
      }

      public get loadBalancerDnsName(): string {
        if (attrs.loadBalancerDnsName) { return attrs.loadBalancerDnsName; }
        // eslint-disable-next-line max-len
        throw new Error(`'loadBalancerDnsName' was not provided when constructing Network Load Balancer ${this.node.path} from attributes`);
      }
    }

    return new Import(scope, id, { environmentFromArn: attrs.loadBalancerArn });
  }

  constructor(scope: Construct, id: string, props: NetworkLoadBalancerProps) {
    super(scope, id, props, {
      type: 'network',
    });

    if (props.crossZoneEnabled) { this.setAttribute('load_balancing.cross_zone.enabled', 'true'); }
  }

  /**
   * Add a listener to this load balancer
   *
   * @returns The newly created listener
   */
  public addListener(id: string, props: BaseNetworkListenerProps): NetworkListener {
    return new NetworkListener(this, id, {
      loadBalancer: this,
      ...props,
    });
  }

  /**
   * Enable access logging for this load balancer.
   *
   * A region must be specified on the stack containing the load balancer; you cannot enable logging on
   * environment-agnostic stacks. See https://docs.aws.amazon.com/cdk/latest/guide/environments.html
   *
   * This is extending the BaseLoadBalancer.logAccessLogs method to match the bucket permissions described
   * at https://docs.aws.amazon.com/elasticloadbalancing/latest/network/load-balancer-access-logs.html#access-logging-bucket-requirements
   */
  public logAccessLogs(bucket: IBucket, prefix?: string) {
    super.logAccessLogs(bucket, prefix);

    const logsDeliveryServicePrincipal = new ServicePrincipal('delivery.logs.amazonaws.com');

    bucket.addToResourcePolicy(
      new PolicyStatement({
        actions: ['s3:PutObject'],
        principals: [logsDeliveryServicePrincipal],
        resources: [
          bucket.arnForObjects(`${prefix ? prefix + '/' : ''}AWSLogs/${this.stack.account}/*`),
        ],
        conditions: {
          StringEquals: { 's3:x-amz-acl': 'bucket-owner-full-control' },
        },
      }),
    );
    bucket.addToResourcePolicy(
      new PolicyStatement({
        actions: ['s3:GetBucketAcl'],
        principals: [logsDeliveryServicePrincipal],
        resources: [bucket.bucketArn],
      }),
    );
  }

  /**
   * Return the given named metric for this Network Load Balancer
   *
   * @default Average over 5 minutes
   */
  public metric(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return new cloudwatch.Metric({
      namespace: 'AWS/NetworkELB',
      metricName,
      dimensions: { LoadBalancer: this.loadBalancerFullName },
      ...props,
    }).attachTo(this);
  }

  /**
   * The total number of concurrent TCP flows (or connections) from clients to targets.
   *
   * This metric includes connections in the SYN_SENT and ESTABLISHED states.
   * TCP connections are not terminated at the load balancer, so a client
   * opening a TCP connection to a target counts as a single flow.
   *
   * @default Average over 5 minutes
   */
  public metricActiveFlowCount(props?: cloudwatch.MetricOptions) {
    return this.cannedMetric(NetworkELBMetrics.activeFlowCountSum, {
      statistic: 'Average', // Doesn't make sense to me but backwards compatibility and all that
      ...props,
    });
  }

  /**
   * The number of load balancer capacity units (LCU) used by your load balancer.
   *
   * @default Sum over 5 minutes
   */
  public metricConsumedLCUs(props?: cloudwatch.MetricOptions) {
    return this.cannedMetric(NetworkELBMetrics.consumedLcUsAverage, {
      statistic: 'Sum',
      ...props,
    });
  }

  /**
   * The number of targets that are considered healthy.
   *
   * @default Average over 5 minutes
   * @deprecated use ``NetworkTargetGroup.metricHealthyHostCount`` instead
   */
  public metricHealthyHostCount(props?: cloudwatch.MetricOptions) {
    return this.cannedMetric(NetworkELBMetrics.healthyHostCountAverage, props);
  }

  /**
   * The number of targets that are considered unhealthy.
   *
   * @default Average over 5 minutes
   * @deprecated use ``NetworkTargetGroup.metricUnHealthyHostCount`` instead
   */
  public metricUnHealthyHostCount(props?: cloudwatch.MetricOptions) {
    return this.cannedMetric(NetworkELBMetrics.unHealthyHostCountAverage, props);
  }

  /**
   * The total number of new TCP flows (or connections) established from clients to targets in the time period.
   *
   * @default Sum over 5 minutes
   */
  public metricNewFlowCount(props?: cloudwatch.MetricOptions) {
    return this.cannedMetric(NetworkELBMetrics.newFlowCountSum, props);
  }

  /**
   * The total number of bytes processed by the load balancer, including TCP/IP headers.
   *
   * @default Sum over 5 minutes
   */
  public metricProcessedBytes(props?: cloudwatch.MetricOptions) {
    return this.cannedMetric(NetworkELBMetrics.processedBytesSum, props);
  }

  /**
   * The total number of reset (RST) packets sent from a client to a target.
   *
   * These resets are generated by the client and forwarded by the load balancer.
   *
   * @default Sum over 5 minutes
   */
  public metricTcpClientResetCount(props?: cloudwatch.MetricOptions) {
    return this.cannedMetric(NetworkELBMetrics.tcpClientResetCountSum, props);
  }

  /**
   * The total number of reset (RST) packets generated by the load balancer.
   *
   * @default Sum over 5 minutes
   */
  public metricTcpElbResetCount(props?: cloudwatch.MetricOptions) {
    return this.cannedMetric(NetworkELBMetrics.tcpElbResetCountSum, props);
  }

  /**
   * The total number of reset (RST) packets sent from a target to a client.
   *
   * These resets are generated by the target and forwarded by the load balancer.
   *
   * @default Sum over 5 minutes
   */
  public metricTcpTargetResetCount(props?: cloudwatch.MetricOptions) {
    return this.cannedMetric(NetworkELBMetrics.tcpTargetResetCountSum, props);
  }

  private cannedMetric(
    fn: (dims: { LoadBalancer: string }) => cloudwatch.MetricProps,
    props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return new cloudwatch.Metric({
      ...fn({ LoadBalancer: this.loadBalancerFullName }),
      ...props,
    }).attachTo(this);
  }
}

/**
 * A network load balancer
 */
export interface INetworkLoadBalancer extends ILoadBalancerV2, ec2.IVpcEndpointServiceLoadBalancer {

  /**
   * The VPC this load balancer has been created in (if available)
   */
  readonly vpc?: ec2.IVpc;

  /**
   * Add a listener to this load balancer
   *
   * @returns The newly created listener
   */
  addListener(id: string, props: BaseNetworkListenerProps): NetworkListener;
}

class LookedUpNetworkLoadBalancer extends Resource implements INetworkLoadBalancer {
  public readonly loadBalancerCanonicalHostedZoneId: string;
  public readonly loadBalancerDnsName: string;
  public readonly loadBalancerArn: string;
  public readonly vpc?: ec2.IVpc;

  constructor(scope: Construct, id: string, props: cxapi.LoadBalancerContextResponse) {
    super(scope, id, { environmentFromArn: props.loadBalancerArn });

    this.loadBalancerArn = props.loadBalancerArn;
    this.loadBalancerCanonicalHostedZoneId = props.loadBalancerCanonicalHostedZoneId;
    this.loadBalancerDnsName = props.loadBalancerDnsName;

    this.vpc = ec2.Vpc.fromLookup(this, 'Vpc', {
      vpcId: props.vpcId,
    });
  }

  public addListener(lid: string, props: BaseNetworkListenerProps): NetworkListener {
    return new NetworkListener(this, lid, {
      loadBalancer: this,
      ...props,
    });
  }
}