import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import * as logs from '@aws-cdk/aws-logs';
import * as cdk from '@aws-cdk/core';
import { LogGroupResourcePolicy } from './log-group-resource-policy';
import { TargetBaseProps, bindBaseTargetConfig } from './util';

/**
 * Customize the CloudWatch LogGroup Event Target
 */
export interface LogGroupProps extends TargetBaseProps {
  /**
   * The event to send to the CloudWatch LogGroup
   *
   * This will be the event logged into the CloudWatch LogGroup
   *
   * @default - the entire EventBridge event
   */
  readonly event?: events.RuleTargetInput;
}

/**
 * Use an AWS CloudWatch LogGroup as an event rule target.
 */
export class CloudWatchLogGroup implements events.IRuleTarget {
  constructor(private readonly logGroup: logs.ILogGroup, private readonly props: LogGroupProps = {}) {}

  /**
   * Returns a RuleTarget that can be used to log an event into a CloudWatch LogGroup
   */
  public bind(_rule: events.IRule, _id?: string): events.RuleTargetConfig {
    // Use a custom resource to set the log group resource policy since it is not supported by CDK and cfn.
    const resourcePolicyId = `EventsLogGroupPolicy${_rule.node.uniqueId}`;

    const logGroupStack = cdk.Stack.of(this.logGroup);

    if (!this.logGroup.node.tryFindChild(resourcePolicyId)) {
      new LogGroupResourcePolicy(logGroupStack, resourcePolicyId, {
        policyStatements: [new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['logs:PutLogEvents', 'logs:CreateLogStream'],
          resources: [this.logGroup.logGroupArn],
          principals: [new iam.ServicePrincipal('events.amazonaws.com')],
        })],
      });
    }

    return {
      ...bindBaseTargetConfig(this.props),
      arn: logGroupStack.formatArn({
        service: 'logs',
        resource: 'log-group',
        sep: ':',
        resourceName: this.logGroup.logGroupName,
      }),
      input: this.props.event,
      targetResource: this.logGroup,
    };
  }
}
