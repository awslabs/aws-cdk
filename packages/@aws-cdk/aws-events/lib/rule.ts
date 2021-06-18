import { App, Lazy, Names, Resource, Stack, Token } from '@aws-cdk/core';
import { Construct, Node } from 'constructs';
import { IEventBus } from './event-bus';
import { EventPattern } from './event-pattern';
import { CfnEventBusPolicy, CfnRule } from './events.generated';
import { IRule } from './rule-ref';
import { Schedule } from './schedule';
import { IRuleTarget } from './target';
import { mergeEventPattern } from './util';

/**
 * Properties for defining an EventBridge Rule
 */
export interface RuleProps {
  /**
   * A description of the rule's purpose.
   *
   * @default - No description.
   */
  readonly description?: string;

  /**
   * A name for the rule.
   *
   * @default - AWS CloudFormation generates a unique physical ID and uses that ID
   * for the rule name. For more information, see Name Type.
   */
  readonly ruleName?: string;

  /**
   * Indicates whether the rule is enabled.
   *
   * @default true
   */
  readonly enabled?: boolean;

  /**
   * The schedule or rate (frequency) that determines when EventBridge
   * runs the rule. For more information, see Schedule Expression Syntax for
   * Rules in the Amazon EventBridge User Guide.
   *
   * @see https://docs.aws.amazon.com/eventbridge/latest/userguide/scheduled-events.html
   *
   * You must specify this property, the `eventPattern` property, or both.
   *
   * @default - None.
   */
  readonly schedule?: Schedule;

  /**
   * Describes which events EventBridge routes to the specified target.
   * These routed events are matched events. For more information, see Events
   * and Event Patterns in the Amazon EventBridge User Guide.
   *
   * @see
   * https://docs.aws.amazon.com/eventbridge/latest/userguide/eventbridge-and-event-patterns.html
   *
   * You must specify this property (either via props or via
   * `addEventPattern`), the `scheduleExpression` property, or both. The
   * method `addEventPattern` can be used to add filter values to the event
   * pattern.
   *
   * @default - None.
   */
  readonly eventPattern?: EventPattern;

  /**
   * Targets to invoke when this rule matches an event.
   *
   * Input will be the full matched event. If you wish to specify custom
   * target input, use `addTarget(target[, inputOptions])`.
   *
   * @default - No targets.
   */
  readonly targets?: IRuleTarget[];

  /**
   * The event bus to associate with this rule.
   *
   * @default - The default event bus.
   */
  readonly eventBus?: IEventBus;
}

/**
 * Defines an EventBridge Rule in this stack.
 *
 * @resource AWS::Events::Rule
 */
export class Rule extends Resource implements IRule {
  /**
   * Import an existing EventBridge Rule provided an ARN
   *
   * @param scope The parent creating construct (usually `this`).
   * @param id The construct's name.
   * @param eventRuleArn Event Rule ARN (i.e. arn:aws:events:<region>:<account-id>:rule/MyScheduledRule).
   */
  public static fromEventRuleArn(scope: Construct, id: string, eventRuleArn: string): IRule {
    const parts = Stack.of(scope).parseArn(eventRuleArn);

    class Import extends Resource implements IRule {
      public ruleArn = eventRuleArn;
      public ruleName = parts.resourceName || '';
    }
    return new Import(scope, id);
  }

  public readonly ruleArn: string;
  public readonly ruleName: string;

  private readonly targets = new Array<CfnRule.TargetProperty>();
  private readonly eventPattern: EventPattern = { };
  private readonly scheduleExpression?: string;
  private readonly description?: string;
  private readonly accountEventBusTargets: { [account: string]: boolean } = {};

  constructor(scope: Construct, id: string, props: RuleProps = { }) {
    super(scope, id, {
      physicalName: props.ruleName,
    });

    if (props.eventBus && props.schedule) {
      throw new Error('Cannot associate rule with \'eventBus\' when using \'schedule\'');
    }

    this.description = props.description;
    this.scheduleExpression = props.schedule && props.schedule.expressionString;

    const resource = new CfnRule(this, 'Resource', {
      name: this.physicalName,
      description: this.description,
      state: props.enabled == null ? 'ENABLED' : (props.enabled ? 'ENABLED' : 'DISABLED'),
      scheduleExpression: this.scheduleExpression,
      eventPattern: Lazy.any({ produce: () => this._renderEventPattern() }),
      targets: Lazy.any({ produce: () => this.renderTargets() }),
      eventBusName: props.eventBus && props.eventBus.eventBusName,
    });

    this.ruleArn = this.getResourceArnAttribute(resource.attrArn, {
      service: 'events',
      resource: 'rule',
      resourceName: this.physicalName,
    });
    this.ruleName = this.getResourceNameAttribute(resource.ref);

    this.addEventPattern(props.eventPattern);

    for (const target of props.targets || []) {
      this.addTarget(target);
    }
  }

  /**
   * Adds a target to the rule. The abstract class RuleTarget can be extended to define new
   * targets.
   *
   * No-op if target is undefined.
   */
  public addTarget(target?: IRuleTarget): void {
    if (!target) { return; }

    // Simply increment id for each `addTarget` call. This is guaranteed to be unique.
    const autoGeneratedId = `Target${this.targets.length}`;

    const targetProps = target.bind(this, autoGeneratedId);
    const inputProps = targetProps.input && targetProps.input.bind(this);

    const roleArn = targetProps.role?.roleArn;
    const id = targetProps.id || autoGeneratedId;

    if (targetProps.targetResource) {
      const targetStack = Stack.of(targetProps.targetResource);
      const targetAccount = targetStack.account;
      const targetRegion = targetStack.region;

      const sourceStack = Stack.of(this);
      const sourceAccount = sourceStack.account;
      const sourceRegion = sourceStack.region;

      if (targetRegion !== sourceRegion) {
        throw new Error('Rule and target must be in the same region');
      }

      if (targetAccount !== sourceAccount) {
        // cross-account event - strap in, this works differently than regular events!
        // based on:
        // https://docs.aws.amazon.com/eventbridge/latest/userguide/eventbridge-cross-account-event-delivery.html

        // for cross-account events, we require concrete accounts
        if (Token.isUnresolved(targetAccount)) {
          throw new Error('You need to provide a concrete account for the target stack when using cross-account events');
        }
        if (Token.isUnresolved(sourceAccount)) {
          throw new Error('You need to provide a concrete account for the source stack when using cross-account events');
        }
        // and the target region has to be concrete as well
        if (Token.isUnresolved(targetRegion)) {
          throw new Error('You need to provide a concrete region for the target stack when using cross-account events');
        }

        // the _actual_ target is just the event bus of the target's account
        // make sure we only add it once per account
        const exists = this.accountEventBusTargets[targetAccount];
        if (!exists) {
          this.accountEventBusTargets[targetAccount] = true;
          this.targets.push({
            id,
            arn: targetStack.formatArn({
              service: 'events',
              resource: 'event-bus',
              resourceName: 'default',
              region: targetRegion,
              account: targetAccount,
            }),
          });
        }

        // Grant the source account permissions to publish events to the event bus of the target account.
        // Do it in a separate stack instead of the target stack (which seems like the obvious place to put it),
        // because it needs to be deployed before the rule containing the above event-bus target in the source stack
        // (EventBridge verifies whether you have permissions to the targets on rule creation),
        // but it's common for the target stack to depend on the source stack
        // (that's the case with CodePipeline, for example)
        const sourceApp = this.node.root;
        if (!sourceApp || !App.isApp(sourceApp)) {
          throw new Error('Event stack which uses cross-account targets must be part of a CDK app');
        }
        const targetApp = Node.of(targetProps.targetResource).root;
        if (!targetApp || !App.isApp(targetApp)) {
          throw new Error('Target stack which uses cross-account event targets must be part of a CDK app');
        }
        if (sourceApp !== targetApp) {
          throw new Error('Event stack and target stack must belong to the same CDK app');
        }
        const stackId = `EventBusPolicy-${sourceAccount}-${targetRegion}-${targetAccount}`;
        let eventBusPolicyStack: Stack = sourceApp.node.tryFindChild(stackId) as Stack;
        if (!eventBusPolicyStack) {
          eventBusPolicyStack = new Stack(sourceApp, stackId, {
            env: {
              account: targetAccount,
              region: targetRegion,
            },
            stackName: `${targetStack.stackName}-EventBusPolicy-support-${targetRegion}-${sourceAccount}`,
          });
          new CfnEventBusPolicy(eventBusPolicyStack, 'GivePermToOtherAccount', {
            action: 'events:PutEvents',
            statementId: `Allow-account-${sourceAccount}`,
            principal: sourceAccount,
          });
        }
        // deploy the event bus permissions before the source stack
        sourceStack.addDependency(eventBusPolicyStack);

        // The actual rule lives in the target stack.
        // Other than the account, it's identical to this one

        // eventPattern is mutable through addEventPattern(), so we need to lazy evaluate it
        // but only Tokens can be lazy in the framework, so make a subclass instead
        const self = this;
        class CopyRule extends Rule {
          public _renderEventPattern(): any {
            return self._renderEventPattern();
          }

          // we need to override validate(), as it uses the
          // value of the eventPattern field,
          // which might be empty in the case of the copied rule
          // (as the patterns in the original might be added through addEventPattern(),
          // not passed through the constructor).
          // Anyway, even if the original rule is invalid,
          // we would get duplicate errors if we didn't override this,
          // which is probably a bad idea in and of itself
          protected validate(): string[] {
            return [];
          }
        }

        new CopyRule(targetStack, `${Names.uniqueId(this)}-${id}`, {
          targets: [target],
          eventPattern: this.eventPattern,
          schedule: this.scheduleExpression ? Schedule.expression(this.scheduleExpression) : undefined,
          description: this.description,
        });

        return;
      }
    }

    this.targets.push({
      id,
      arn: targetProps.arn,
      roleArn,
      ecsParameters: targetProps.ecsParameters,
      kinesisParameters: targetProps.kinesisParameters,
      runCommandParameters: targetProps.runCommandParameters,
      batchParameters: targetProps.batchParameters,
      deadLetterConfig: targetProps.deadLetterConfig,
      retryPolicy: targetProps.retryPolicy,
      sqsParameters: targetProps.sqsParameters,
      httpParameters: targetProps.httpParameters,
      input: inputProps && inputProps.input,
      inputPath: inputProps && inputProps.inputPath,
      inputTransformer: inputProps?.inputTemplate !== undefined ? {
        inputTemplate: inputProps.inputTemplate,
        inputPathsMap: inputProps.inputPathsMap,
      } : undefined,
    });
  }

  /**
   * Adds an event pattern filter to this rule. If a pattern was already specified,
   * these values are merged into the existing pattern.
   *
   * For example, if the rule already contains the pattern:
   *
   *    {
   *      "resources": [ "r1" ],
   *      "detail": {
   *        "hello": [ 1 ]
   *      }
   *    }
   *
   * And `addEventPattern` is called with the pattern:
   *
   *    {
   *      "resources": [ "r2" ],
   *      "detail": {
   *        "foo": [ "bar" ]
   *      }
   *    }
   *
   * The resulting event pattern will be:
   *
   *    {
   *      "resources": [ "r1", "r2" ],
   *      "detail": {
   *        "hello": [ 1 ],
   *        "foo": [ "bar" ]
   *      }
   *    }
   *
   */
  public addEventPattern(eventPattern?: EventPattern) {
    if (!eventPattern) {
      return;
    }
    mergeEventPattern(this.eventPattern, eventPattern);
  }

  /**
   * Not private only to be overrideen in CopyRule.
   *
   * @internal
   */
  public _renderEventPattern(): any {
    const eventPattern = this.eventPattern;

    if (Object.keys(eventPattern).length === 0) {
      return undefined;
    }

    // rename 'detailType' to 'detail-type'
    const out: any = {};
    for (let key of Object.keys(eventPattern)) {
      const value = (eventPattern as any)[key];
      if (key === 'detailType') {
        key = 'detail-type';
      }
      out[key] = value;
    }

    return out;
  }

  protected validate() {
    if (Object.keys(this.eventPattern).length === 0 && !this.scheduleExpression) {
      return ['Either \'eventPattern\' or \'schedule\' must be defined'];
    }

    return [];
  }

  private renderTargets() {
    if (this.targets.length === 0) {
      return undefined;
    }

    return this.targets;
  }
}
