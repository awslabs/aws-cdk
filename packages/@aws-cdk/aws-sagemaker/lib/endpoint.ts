import * as appscaling from '@aws-cdk/aws-applicationautoscaling';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as ec2 from "@aws-cdk/aws-ec2";
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import { EOL } from 'os';
import { CfnEndpoint } from '.';
import { EndpointConfig, ProductionVariant } from "./endpoint-config";
import { ScalableInstanceCount } from './scalable-instance-count';

/*
 * Amazon SageMaker automatic scaling doesn't support automatic scaling for burstable instances such
 * as T2, because they already allow for increased capacity under increased workloads.
 * https://docs.aws.amazon.com/sagemaker/latest/dg/endpoint-auto-scaling-add-policy.html
 */
const BURSTABLE_INSTANCE_TYPE_PREFIXES = Object.entries(ec2.InstanceClass)
  .filter(([name, _]) => name.startsWith('BURSTABLE'))
  .map(([_, prefix]) => `${prefix}.`);

/**
 * The interface for a SageMaker Endpoint resource.
 */
export interface IEndpoint extends cdk.IResource {
  /**
   * The ARN of the endpoint.
   *
   * @attribute
   */
  readonly endpointArn: string;
  /**
   * The name of the endpoint.
   *
   * @attribute
   */
  readonly endpointName: string;

  /**
   * Permits an IAM principal to invoke this endpoint
   * @param grantee The principal to grant access to
   */
  grantInvoke(grantee: iam.IGrantable): iam.Grant;
}

/**
 * Represents a production variant that has been associated with an endpoint.
 */
export interface IEndpointProductionVariant {
  /**
   * The name of the production variant.
   */
  readonly variantName: string;
  /**
   * Return the given named metric for Endpoint
   *
   * @default sum over 5 minutes
   */
  metric(namespace: string, metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  /**
   * Metric for the number of invocations
   *
   * @default sum over 5 minutes
   */
  metricInvocations(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  /**
   * Metric for the number of invocations per instance
   *
   * @default sum over 5 minutes
   */
  metricInvocationsPerInstance(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  /**
   * Metric for model latency
   *
   * @default average over 5 minutes
   */
  metricModelLatency(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  /**
   * Metric for overhead latency
   *
   * @default average over 5 minutes
   */
  metricOverheadLatency(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  /**
   * Metric for the number of invocations by HTTP response code
   *
   * @default sum over 5 minutes
   */
  metricInvocationResponseCode(responseCode: InvocationHttpResponseCode, props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  /**
   * Metric for disk utilization
   *
   * @default average over 5 minutes
   */
  metricDiskUtilization(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  /**
   * Metric for CPU utilization
   *
   * @default average over 5 minutes
   */
  metricCPUUtilization(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  /**
   * Metric for memory utilization
   *
   * @default average over 5 minutes
   */
  metricMemoryUtilization(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  /**
   * Metric for GPU utilization
   *
   * @default average over 5 minutes
   */
  metricGPUUtilization(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  /**
   * Metric for GPU memory utilization
   *
   * @default average over 5 minutes
   */
  metricGPUMemoryUtilization(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
  /**
   * Enable autoscaling for SageMaker Endpoint production variant
   *
   * @param scalingProps EnableScalingProps
   */
  autoScaleInstanceCount(scalingProps: appscaling.EnableScalingProps): ScalableInstanceCount;
}

class EndpointProductionVariant implements IEndpointProductionVariant {
  public readonly variantName: string;
  private readonly endpoint: Endpoint;
  private readonly initialInstanceCount: number;
  private readonly instanceType: ec2.InstanceType;
  private scalableInstanceCount?: ScalableInstanceCount;

  constructor(endpoint: Endpoint, variant: ProductionVariant) {
    this.initialInstanceCount = variant.initialInstanceCount;
    this.instanceType = variant.instanceType;
    this.variantName = variant.variantName;
    this.endpoint = endpoint;
  }

  public metric(
    namespace: string,
    metricName: string,
    props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return new cloudwatch.Metric({
      namespace,
      metricName,
      dimensions: {
        EndpointName: this.endpoint.endpointName,
        VariantName: this.variantName
      },
      statistic: 'Sum',
      ...props
    });
  }

  public metricInvocations(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.metric('AWS/SageMaker', 'Invocations', props);
  }

  public metricInvocationsPerInstance(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.metric('AWS/SageMaker', 'InvocationsPerInstance', props);
  }

  public metricModelLatency(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.metric('AWS/SageMaker', 'ModelLatency', {
      statistic: 'Average',
      ...props
    });
  }

  public metricOverheadLatency(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.metric('AWS/SageMaker', 'OverheadLatency', {
      statistic: 'Average',
      ...props
    });
  }

  public metricInvocationResponseCode(
    responseCode: InvocationHttpResponseCode,
    props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.metric('AWS/SageMaker', responseCode, props);
  }

  public metricDiskUtilization(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.metric('/aws/sagemaker/Endpoints', 'DiskUtilization', {
      statistic: 'Average',
      ...props
    });
  }

  public metricCPUUtilization(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.metric('/aws/sagemaker/Endpoints', 'CPUUtilization', {
      statistic: 'Average',
      ...props
    });
  }

  public metricMemoryUtilization(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.metric('/aws/sagemaker/Endpoints', 'MemoryUtilization', {
      statistic: 'Average',
      ...props
    });
  }

  public metricGPUUtilization(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.metric('/aws/sagemaker/Endpoints', 'GPUUtilization', {
      statistic: 'Average',
      ...props
    });
  }

  public metricGPUMemoryUtilization(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.metric('/aws/sagemaker/Endpoints', 'GPUMemoryUtilization', {
      statistic: 'Average',
      ...props
    });
  }

  public autoScaleInstanceCount(scalingProps: appscaling.EnableScalingProps): ScalableInstanceCount {
    const errors: string[] = [];
    if (scalingProps.minCapacity && scalingProps.minCapacity > this.initialInstanceCount) {
      errors.push(`minCapacity cannot be greater than initial instance count: ${this.initialInstanceCount}`);
    }
    if (scalingProps.maxCapacity && scalingProps.maxCapacity < this.initialInstanceCount) {
      errors.push(`maxCapacity cannot be less than initial instance count: ${this.initialInstanceCount}`);
    }
    if (BURSTABLE_INSTANCE_TYPE_PREFIXES.some(prefix => this.instanceType.toString().startsWith(prefix))) {
      errors.push(`AutoScaling not supported for burstable instance types like ${this.instanceType}`);
    }
    if (this.scalableInstanceCount) {
      errors.push('AutoScaling of task count already enabled for this service');
    }

    if (errors.length > 0) {
      throw new Error(`Invalid Application Auto Scaling configuration: ${errors.join(EOL)}`);
    }

    return this.scalableInstanceCount = new ScalableInstanceCount(this.endpoint, 'InstanceCount', {
      serviceNamespace: appscaling.ServiceNamespace.SAGEMAKER,
      resourceId: `endpoint/${this.endpoint.endpointName}/variant/${this.variantName}`,
      dimension: 'sagemaker:variant:DesiredInstanceCount',
      role: this.makeScalingRole(),
      minCapacity: scalingProps.minCapacity || this.initialInstanceCount,
      maxCapacity: scalingProps.maxCapacity || this.initialInstanceCount,
    });
  }

  /**
   * Return the service linked role that will be used for AutoScaling
   *
   * Documentation is available here: https://docs.aws.amazon.com/autoscaling/application/userguide/application-auto-scaling-service-linked-roles.html
   */
  private makeScalingRole(): iam.IRole {
    // Use a Service Linked Role.
    return iam.Role.fromRoleArn(this.endpoint, 'ScalingRole', cdk.Stack.of(this.endpoint).formatArn({
      service: 'iam',
      region: '',
      resource: 'role/aws-service-role/sagemaker.application-autoscaling.amazonaws.com',
      resourceName: 'AWSServiceRoleForApplicationAutoScaling_SageMakerEndpoint'
    }));
  }
}
/**
 * Name tag constant
 */
const NAME_TAG: string = 'Name';

abstract class EndpointBase extends cdk.Resource implements IEndpoint {
  /**
   * The ARN of the endpoint.
   *
   * @attribute
   */
  public abstract readonly endpointArn: string;

  /**
   * The name of the endpoint.
   *
   * @attribute
   */
  public abstract readonly endpointName: string;

  /**
   * Permits an IAM principal to invoke this endpoint
   * @param grantee The principal to grant access to
   */
  public grantInvoke(grantee: iam.IGrantable) {
    return iam.Grant.addToPrincipal({
      grantee,
      actions: ['sagemaker:InvokeEndpoint'],
      resourceArns: [this.endpointArn],
    });
  }
}

/**
 * Construction properties for a SageMaker Endpoint.
 */
export interface EndpointProps {

  /**
   * Name of the endpoint.
   *
   * @default AWS CloudFormation generates a unique physical ID and uses that ID for the endpoint's
   * name.
   */
  readonly endpointName?: string;

  /**
   * The endpoint configuration to use for this endpoint.
   *
   * [disable-awslint:ref-via-interface]
   */
  readonly endpointConfig: EndpointConfig;
}

/**
 * HTTP response codes for Endpoint invocations
 */
export enum InvocationHttpResponseCode {
  /**
   * 4xx response codes from Endpoint invocations
   */
  INVOCATION_4XX_ERRORS = 'Invocation4XXErrors',

  /**
   * 5xx response codes from Endpoint invocations
   */
  INVOCATION_5XX_ERRORS = 'Invocation5XXErrors',
}

/**
 * Defines a SageMaker endpoint.
 */
export class Endpoint extends EndpointBase {
  /**
   * Imports an Endpoint defined either outside the CDK or in a different CDK stack.
   * @param scope the Construct scope.
   * @param id the resource id.
   * @param endpointName the name of the endpoint.
   */
  public static fromEndpointName(scope: cdk.Construct, id: string, endpointName: string): IEndpoint {
    class Import extends EndpointBase {
      public endpointName = endpointName;
      public endpointArn = cdk.Stack.of(this).formatArn({
        service: 'sagemaker',
        resource: 'endpoint',
        resourceName: this.endpointName
      });
    }

    return new Import(scope, id);
  }

  /**
   * The ARN of the endpoint.
   *
   * @attribute
   */
  public readonly endpointArn: string;
  /**
   * The name of the endpoint.
   *
   * @attribute
   */
  public readonly endpointName: string;
  private readonly endpointConfig: EndpointConfig;

  constructor(scope: cdk.Construct, id: string, props: EndpointProps) {
    super(scope, id, {
      physicalName: props.endpointName
    });

    // apply a name tag to the endpoint resource
    this.node.applyAspect(new cdk.Tag(NAME_TAG, this.node.path));

    this.endpointConfig = props.endpointConfig;

    // create the endpoint resource
    const endpoint = new CfnEndpoint(this, 'Endpoint', {
      endpointConfigName: props.endpointConfig.endpointConfigName,
      endpointName: this.physicalName,
    });
    this.endpointName = this.getResourceNameAttribute(endpoint.attrEndpointName);
    this.endpointArn = this.getResourceArnAttribute(endpoint.ref, {
      service: 'sagemaker',
      resource: 'endpoint',
      resourceName: this.physicalName,
    });
  }

  /**
   * Get production variants associated with endpoint.
   */
  public get productionVariants(): IEndpointProductionVariant[] {
    return this.endpointConfig.productionVariants.map(v => new EndpointProductionVariant(this, v));
  }

  /**
   * Find production variant based on variant name
   * @param name Variant name from production variant
   */
  public findProductionVariant(name: string): IEndpointProductionVariant {
    const variant = this.endpointConfig.findProductionVariant(name);
    return new EndpointProductionVariant(this, variant);
  }
}
