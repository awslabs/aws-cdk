import cdk = require('@aws-cdk/core');
import { ITargetGroup, TargetGroupImportProps } from './base-target-group';

/**
 * Base internal class for existing target groups
 */
export abstract class ImportedTargetGroupBase extends cdk.Construct implements ITargetGroup {
  /**
   * ARN of the target group
   */
  public readonly targetGroupArn: string;

  /**
   * A token representing a list of ARNs of the load balancers that route traffic to this target group
   */
  public readonly loadBalancerArns: string;

  /**
   * Return an object to depend on the listeners added to this target group
   */
  public readonly loadBalancerAttached: cdk.IDependable = new cdk.ConcreteDependable();

  constructor(scope: cdk.Construct, id: string, props: TargetGroupImportProps) {
    super(scope, id);

    this.targetGroupArn = props.targetGroupArn;
    this.loadBalancerArns = props.loadBalancerArns || cdk.Aws.noValue;
  }
}
