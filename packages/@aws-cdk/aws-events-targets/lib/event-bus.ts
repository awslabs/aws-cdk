import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import { singletonEventRole } from './util';

/**
 * Configuration properties of an Event Bus event
 */
export interface EventBusProps {
  /**
   * Role to be used to publish the event
   *
   * @default a new role is created.
   */
  readonly role?: iam.IRole;
}

/**
 * Notify an existing Event Bus of an event
 */
export class EventBus implements events.IRuleTarget {
  private readonly role?: iam.IRole;

  constructor(private readonly eventBus: events.IEventBus, props: EventBusProps = {}) {
    this.role = props.role;
  }

  bind(rule: events.IRule, _id?: string): events.RuleTargetConfig {
    if (this.role) {
      this.role.addToPrincipalPolicy(this.putEventStatement());
    }
    const role = this.role ?? singletonEventRole(rule, [this.putEventStatement()]);
    return {
      arn: this.eventBus.eventBusArn,
      role,
    };
  }

  private putEventStatement() {
    return new iam.PolicyStatement({
      actions: ['events:PutEvents'],
      resources: [this.eventBus.eventBusArn],
    });
  }
}
