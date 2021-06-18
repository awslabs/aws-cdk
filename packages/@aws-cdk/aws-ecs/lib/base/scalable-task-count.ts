import * as appscaling from '@aws-cdk/aws-applicationautoscaling';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

/**
 * The properties of a scalable attribute representing task count.
 */
export interface ScalableTaskCountProps extends appscaling.BaseScalableAttributeProps {

}

/**
 * The scalable attribute representing task count.
 */
export class ScalableTaskCount extends appscaling.BaseScalableAttribute {
  /**
   * Constructs a new instance of the ScalableTaskCount class.
   */
  constructor(scope: Construct, id: string, props: ScalableTaskCountProps) {
    super(scope, id, props);
  }

  /**
   * Scales in or out based on a specified scheduled time.
   */
  public scaleOnSchedule(id: string, props: appscaling.ScalingSchedule) {
    return super.doScaleOnSchedule(id, props);
  }

  /**
   * Scales in or out based on a specified metric value.
   */
  public scaleOnMetric(id: string, props: appscaling.BasicStepScalingPolicyProps) {
    return super.doScaleOnMetric(id, props);
  }

  /**
   * Scales in or out to achieve a target CPU utilization.
   */
  public scaleOnCpuUtilization(id: string, props: CpuUtilizationScalingProps) {
    return super.doScaleToTrackMetric(id, {
      predefinedMetric: appscaling.PredefinedMetric.ECS_SERVICE_AVERAGE_CPU_UTILIZATION,
      policyName: props.policyName,
      disableScaleIn: props.disableScaleIn,
      targetValue: props.targetUtilizationPercent,
      scaleInCooldown: props.scaleInCooldown,
      scaleOutCooldown: props.scaleOutCooldown,
    });
  }

  /**
   * Scales in or out to achieve a target memory utilization.
   */
  public scaleOnMemoryUtilization(id: string, props: MemoryUtilizationScalingProps) {
    return super.doScaleToTrackMetric(id, {
      predefinedMetric: appscaling.PredefinedMetric.ECS_SERVICE_AVERAGE_MEMORY_UTILIZATION,
      targetValue: props.targetUtilizationPercent,
      policyName: props.policyName,
      disableScaleIn: props.disableScaleIn,
      scaleInCooldown: props.scaleInCooldown,
      scaleOutCooldown: props.scaleOutCooldown,
    });
  }

  /**
   * Scales in or out to achieve a target Application Load Balancer request count per target.
   */
  public scaleOnRequestCount(id: string, props: RequestCountScalingProps) {
    const resourceLabel = props.targetGroup.firstLoadBalancerFullName +
       '/' + props.targetGroup.targetGroupFullName;

    return super.doScaleToTrackMetric(id, {
      predefinedMetric: appscaling.PredefinedMetric.ALB_REQUEST_COUNT_PER_TARGET,
      resourceLabel,
      targetValue: props.requestsPerTarget,
      policyName: props.policyName,
      disableScaleIn: props.disableScaleIn,
      scaleInCooldown: props.scaleInCooldown,
      scaleOutCooldown: props.scaleOutCooldown,
    });
  }

  /**
   * Scales in or out to achieve a target on a custom metric.
   */
  public scaleToTrackCustomMetric(id: string, props: TrackCustomMetricProps) {
    return super.doScaleToTrackMetric(id, {
      customMetric: props.metric,
      targetValue: props.targetValue,
      policyName: props.policyName,
      disableScaleIn: props.disableScaleIn,
      scaleInCooldown: props.scaleInCooldown,
      scaleOutCooldown: props.scaleOutCooldown,
    });
  }
}

/**
 * The properties for enabling scaling based on CPU utilization.
 */
export interface CpuUtilizationScalingProps extends appscaling.BaseTargetTrackingProps {
  /**
   * The target value for CPU utilization across all tasks in the service.
   */
  readonly targetUtilizationPercent: number;
}

/**
 * The properties for enabling scaling based on memory utilization.
 */
export interface MemoryUtilizationScalingProps extends appscaling.BaseTargetTrackingProps {
  /**
   * The target value for memory utilization across all tasks in the service.
   */
  readonly targetUtilizationPercent: number;
}

/**
 * The properties for enabling scaling based on Application Load Balancer (ALB) request counts.
 */
export interface RequestCountScalingProps extends appscaling.BaseTargetTrackingProps {
  /**
   * The number of ALB requests per target.
   */
  readonly requestsPerTarget: number;

  /**
   * The ALB target group name.
   */
  readonly targetGroup: elbv2.ApplicationTargetGroup;
}

/**
 * The properties for enabling target tracking scaling based on a custom CloudWatch metric.
 */
export interface TrackCustomMetricProps extends appscaling.BaseTargetTrackingProps {
  /**
   * The custom CloudWatch metric to track.
   *
   * The metric must represent utilization; that is, you will always get the following behavior:
   *
   * - metric > targetValue => scale out
   * - metric < targetValue => scale in
   */
  readonly metric: cloudwatch.IMetric;

  /**
   * The target value for the custom CloudWatch metric.
   */
  readonly targetValue: number;
}
