import * as iam from '@aws-cdk/aws-iam';
import { IResource, Lazy, Resource, withResolved } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnScalableTarget } from './applicationautoscaling.generated';
import { Schedule } from './schedule';
import { BasicStepScalingPolicyProps, StepScalingPolicy } from './step-scaling-policy';
import { BasicTargetTrackingScalingPolicyProps, TargetTrackingScalingPolicy } from './target-tracking-scaling-policy';

export interface IScalableTarget extends IResource {
  /**
   * @attribute
   */
  readonly scalableTargetId: string;
}

/**
 * Properties for a scalable target
 */
export interface ScalableTargetProps {
  /**
   * The minimum value that Application Auto Scaling can use to scale a target during a scaling activity.
   */
  readonly minCapacity: number;

  /**
   * The maximum value that Application Auto Scaling can use to scale a target during a scaling activity.
   */
  readonly maxCapacity: number;

  /**
   * Role that allows Application Auto Scaling to modify your scalable target.
   *
   * @default A role is automatically created
   */
  readonly role?: iam.IRole;

  /**
   * The resource identifier to associate with this scalable target.
   *
   * This string consists of the resource type and unique identifier.
   *
   * @example service/ecsStack-MyECSCluster-AB12CDE3F4GH/ecsStack-MyECSService-AB12CDE3F4GH
   * @see https://docs.aws.amazon.com/autoscaling/application/APIReference/API_RegisterScalableTarget.html
   */
  readonly resourceId: string;

  /**
   * The scalable dimension that's associated with the scalable target.
   *
   * Specify the service namespace, resource type, and scaling property.
   *
   * @example ecs:service:DesiredCount
   * @see https://docs.aws.amazon.com/autoscaling/application/APIReference/API_ScalingPolicy.html
   */
  readonly scalableDimension: string;

  /**
   * The namespace of the AWS service that provides the resource or
   * custom-resource for a resource provided by your own application or
   * service.
   *
   * For valid AWS service namespace values, see the RegisterScalableTarget
   * action in the Application Auto Scaling API Reference.
   *
   * @see https://docs.aws.amazon.com/autoscaling/application/APIReference/API_RegisterScalableTarget.html
   */
  readonly serviceNamespace: ServiceNamespace;
}

/**
 * Define a scalable target
 */
export class ScalableTarget extends Resource implements IScalableTarget {
  public static fromScalableTargetId(scope: Construct, id: string, scalableTargetId: string): IScalableTarget {
    class Import extends Resource implements IScalableTarget {
      public readonly scalableTargetId = scalableTargetId;
    }
    return new Import(scope, id);
  }

  /**
   * ID of the Scalable Target
   *
   * @example service/ecsStack-MyECSCluster-AB12CDE3F4GH/ecsStack-MyECSService-AB12CDE3F4GH|ecs:service:DesiredCount|ecs
   * @attribute
   */
  public readonly scalableTargetId: string;

  /**
   * The role used to give AutoScaling permissions to your resource
   */
  public readonly role: iam.IRole;

  private readonly actions = new Array<CfnScalableTarget.ScheduledActionProperty>();

  constructor(scope: Construct, id: string, props: ScalableTargetProps) {
    super(scope, id);

    withResolved(props.maxCapacity, max => {
      if (max < 0) {
        throw new RangeError(`maxCapacity cannot be negative, got: ${props.maxCapacity}`);
      }
    });

    withResolved(props.minCapacity, min => {
      if (min < 0) {
        throw new RangeError(`minCapacity cannot be negative, got: ${props.minCapacity}`);
      }
    });

    withResolved(props.minCapacity, props.maxCapacity, (min, max) => {
      if (max < min) {
        throw new RangeError(`minCapacity (${props.minCapacity}) should be lower than maxCapacity (${props.maxCapacity})`);
      }
    });

    this.role = props.role || new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('application-autoscaling.amazonaws.com'),
    });

    const resource = new CfnScalableTarget(this, 'Resource', {
      maxCapacity: props.maxCapacity,
      minCapacity: props.minCapacity,
      resourceId: props.resourceId,
      roleArn: this.role.roleArn,
      scalableDimension: props.scalableDimension,
      scheduledActions: Lazy.any({ produce: () => this.actions }, { omitEmptyArray: true }),
      serviceNamespace: props.serviceNamespace,
    });

    this.scalableTargetId = resource.ref;
  }

  /**
   * Add a policy statement to the role's policy
   */
  public addToRolePolicy(statement: iam.PolicyStatement) {
    this.role.addToPrincipalPolicy(statement);
  }

  /**
   * Scale out or in based on time
   */
  public scaleOnSchedule(id: string, action: ScalingSchedule) {
    if (action.minCapacity === undefined && action.maxCapacity === undefined) {
      throw new Error(`You must supply at least one of minCapacity or maxCapacity, got ${JSON.stringify(action)}`);
    }
    this.actions.push({
      scheduledActionName: id,
      schedule: action.schedule.expressionString,
      startTime: action.startTime,
      endTime: action.endTime,
      scalableTargetAction: {
        maxCapacity: action.maxCapacity,
        minCapacity: action.minCapacity,
      },
    });
  }

  /**
   * Scale out or in, in response to a metric
   */
  public scaleOnMetric(id: string, props: BasicStepScalingPolicyProps) {
    return new StepScalingPolicy(this, id, { ...props, scalingTarget: this });
  }

  /**
   * Scale out or in in order to keep a metric around a target value
   */
  public scaleToTrackMetric(id: string, props: BasicTargetTrackingScalingPolicyProps) {
    return new TargetTrackingScalingPolicy(this, id, { ...props, scalingTarget: this });
  }
}

/**
 * A scheduled scaling action
 */
export interface ScalingSchedule {
  /**
   * When to perform this action.
   */
  readonly schedule: Schedule;

  /**
   * When this scheduled action becomes active.
   *
   * @default The rule is activate immediately
   */
  readonly startTime?: Date

  /**
   * When this scheduled action expires.
   *
   * @default The rule never expires.
   */
  readonly endTime?: Date;

  /**
   * The new minimum capacity.
   *
   * During the scheduled time, if the current capacity is below the minimum
   * capacity, Application Auto Scaling scales out to the minimum capacity.
   *
   * At least one of maxCapacity and minCapacity must be supplied.
   *
   * @default No new minimum capacity
   */
  readonly minCapacity?: number;

  /**
   * The new maximum capacity.
   *
   * During the scheduled time, the current capacity is above the maximum
   * capacity, Application Auto Scaling scales in to the maximum capacity.
   *
   * At least one of maxCapacity and minCapacity must be supplied.
   *
   * @default No new maximum capacity
   */
  readonly maxCapacity?: number;
}

/**
 * The service that supports Application AutoScaling
 */
export enum ServiceNamespace {
  /**
   * Elastic Container Service
   */
  ECS = 'ecs',

  /**
   * Elastic Map Reduce
   */
  ELASTIC_MAP_REDUCE = 'elasticmapreduce',

  /**
   * Elastic Compute Cloud
   */
  EC2 = 'ec2',

  /**
   * App Stream
   */
  APPSTREAM = 'appstream',

  /**
   * Dynamo DB
   */
  DYNAMODB = 'dynamodb',

  /**
   * Relational Database Service
   */
  RDS = 'rds',

  /**
   * SageMaker
   */
  SAGEMAKER = 'sagemaker',

  /**
   * Custom Resource
   */
  CUSTOM_RESOURCE = 'custom-resource',

  /**
   * Lambda
   */
  LAMBDA = 'lambda',

  /**
   * Comprehend
   */
  COMPREHEND = 'comprehend',

  /**
   * Kafka
   */
  KAFKA = 'kafka',
}
