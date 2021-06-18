import * as notifications from '@aws-cdk/aws-codestarnotifications';
import * as iam from '@aws-cdk/aws-iam';
import { IResource, Resource, Token } from '@aws-cdk/core';
import * as constructs from 'constructs';
import { TopicPolicy } from './policy';
import { ITopicSubscription } from './subscriber';
import { Subscription } from './subscription';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/**
 * Represents an SNS topic
 */
export interface ITopic extends IResource, notifications.INotificationRuleTarget {
  /**
   * The ARN of the topic
   *
   * @attribute
   */
  readonly topicArn: string;

  /**
   * The name of the topic
   *
   * @attribute
   */
  readonly topicName: string;

  /**
   * Subscribe some endpoint to this topic
   */
  addSubscription(subscription: ITopicSubscription): void;

  /**
   * Adds a statement to the IAM resource policy associated with this topic.
   *
   * If this topic was created in this stack (`new Topic`), a topic policy
   * will be automatically created upon the first call to `addToPolicy`. If
   * the topic is imported (`Topic.import`), then this is a no-op.
   */
  addToResourcePolicy(statement: iam.PolicyStatement): iam.AddToResourcePolicyResult;

  /**
   * Grant topic publishing permissions to the given identity
   */
  grantPublish(identity: iam.IGrantable): iam.Grant;
}

/**
 * Either a new or imported Topic
 */
export abstract class TopicBase extends Resource implements ITopic {
  public abstract readonly topicArn: string;

  public abstract readonly topicName: string;

  /**
   * Controls automatic creation of policy objects.
   *
   * Set by subclasses.
   */
  protected abstract readonly autoCreatePolicy: boolean;

  private policy?: TopicPolicy;

  /**
   * Subscribe some endpoint to this topic
   */
  public addSubscription(subscription: ITopicSubscription) {
    const subscriptionConfig = subscription.bind(this);

    const scope = subscriptionConfig.subscriberScope || this;
    let id = subscriptionConfig.subscriberId;
    if (Token.isUnresolved(subscriptionConfig.subscriberId)) {
      id = this.nextTokenId(scope);
    }

    // We use the subscriber's id as the construct id. There's no meaning
    // to subscribing the same subscriber twice on the same topic.
    if (scope.node.tryFindChild(id)) {
      throw new Error(`A subscription with id "${id}" already exists under the scope ${scope.node.path}`);
    }

    new Subscription(scope, id, {
      topic: this,
      ...subscriptionConfig,
    });
  }

  /**
   * Adds a statement to the IAM resource policy associated with this topic.
   *
   * If this topic was created in this stack (`new Topic`), a topic policy
   * will be automatically created upon the first call to `addToPolicy`. If
   * the topic is imported (`Topic.import`), then this is a no-op.
   */
  public addToResourcePolicy(statement: iam.PolicyStatement): iam.AddToResourcePolicyResult {
    if (!this.policy && this.autoCreatePolicy) {
      this.policy = new TopicPolicy(this, 'Policy', { topics: [this] });
    }

    if (this.policy) {
      this.policy.document.addStatements(statement);
      return { statementAdded: true, policyDependable: this.policy };
    }
    return { statementAdded: false };
  }

  protected validate(): string[] {
    const errors = super.validate();
    errors.push(...this.policy?.document.validateForResourcePolicy() || []);
    return errors;
  }

  /**
   * Grant topic publishing permissions to the given identity
   */
  public grantPublish(grantee: iam.IGrantable) {
    return iam.Grant.addToPrincipalOrResource({
      grantee,
      actions: ['sns:Publish'],
      resourceArns: [this.topicArn],
      resource: this,
    });
  }

  /**
   * Represents a notification target
   * That allows SNS topic to associate with this rule target.
   */
  public bindAsNotificationRuleTarget(_scope: constructs.Construct): notifications.NotificationRuleTargetConfig {
    // SNS topic need to grant codestar-notifications service to publish
    // @see https://docs.aws.amazon.com/dtconsole/latest/userguide/set-up-sns.html
    this.grantPublish(new iam.ServicePrincipal('codestar-notifications.amazonaws.com'));
    return {
      targetType: 'SNS',
      targetAddress: this.topicArn,
    };
  }

  private nextTokenId(scope: Construct) {
    let nextSuffix = 1;
    const re = /TokenSubscription:([\d]*)/gm;
    // Search through the construct and all of its children
    // for previous subscriptions that match our regex pattern
    for (const source of scope.node.findAll()) {
      const m = re.exec(source.node.id); // Use regex to find a match
      if (m !== null) { // if we found a match
        const matchSuffix = parseInt(m[1], 10); // get the suffix for that match (as integer)
        if (matchSuffix >= nextSuffix) { // check if the match suffix is larger or equal to currently proposed suffix
          nextSuffix = matchSuffix + 1; // increment the suffix
        }
      }
    }
    return `TokenSubscription:${nextSuffix}`;
  }
}
