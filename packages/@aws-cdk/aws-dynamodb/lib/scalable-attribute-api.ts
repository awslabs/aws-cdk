import * as appscaling from '@aws-cdk/aws-applicationautoscaling';

/**
 * Interface for scalable attributes
 */
export interface IScalableTableAttribute {
  /**
   * Add scheduled scaling for this scaling attribute
   */
  scaleOnSchedule(id: string, actions: appscaling.ScalingSchedule): void;

  /**
   * Scale out or in to keep utilization at a given level
   */
  scaleOnUtilization(props: UtilizationScalingProps): void;

  /**
   * Suspend all scheduled scaling for this scaling attribute
   */
  turnOffScheduledScaling(): void;

  /**
   * Suspend scaling on utilization
   *
   * @param direction - suspend scaling in this direction
   *
   * @default - suspend scaling in both directions
   */
  turnOffUtilizationScaling(direction?: appscaling.Scale): void;
}

/**
 * Properties for enabling DynamoDB capacity scaling
 */
export interface EnableScalingProps {
  /**
   * Minimum capacity to scale to
   */
  readonly minCapacity: number;

  /**
   * Maximum capacity to scale to
   */
  readonly maxCapacity: number;
}

/**
 * Properties for enabling DynamoDB utilization tracking
 */
export interface UtilizationScalingProps extends appscaling.BaseTargetTrackingProps {
  /**
   * Target utilization percentage for the attribute
   */
  readonly targetUtilizationPercent: number;
}
