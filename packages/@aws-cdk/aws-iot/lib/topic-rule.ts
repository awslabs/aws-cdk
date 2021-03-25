import { Grant, IGrantable, PolicyStatement, AddToResourcePolicyResult } from '@aws-cdk/aws-iam';
import { Resource, IResource, Lazy } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnTopicRule } from './iot.generated';
import { ITopicRuleAction } from './topic-rule-action';
import { singletonTopicRuleRole, parseRuleName, undefinedIfAllValuesAreEmpty, topicArn } from './util';

/**
 * The AWS IoT rules engine uses an SQL-like syntax to select data from MQTT
 * messages. The SQL statements are interpreted based on an SQL version
 * specified with the awsIotSqlVersion property in a JSON document that describes
 * the rule.
 */
export enum AwsIotSqlVersion {
  /**
   * Version beta
   *
   * The most recent beta SQL version. If you use this version, it might
   * introduce breaking changes to your rules.
   */
  BETA = 'beta',
  /**
   * Version 2015-10-08
   *
   * The original SQL version built on 2015-10-08.
   */
  VERSION2015_10_08 = '2015-10-08',
  /**
   * Version 2016-03-23
   *
   * The SQL version built on 2016-03-23.
   *
   * Supports secrets, task recycling.
   */
  VERSION2016_03_23 = '2016-03-23',
}
/**
 * An IoT Topic Rule
 */
export interface ITopicRule extends IResource {
  /**
   * Then name of the topic rule
   */
  readonly ruleName: string;
  /**
   * Then name of the topic rule
   *
   * @attribute
   *
   */
  readonly topicRuleArn: string;
  /**
   * Adds a statement to the IAM resource created for this topic rule
   */
  addToResourcePolicy(statement: PolicyStatement): AddToResourcePolicyResult;
  /**
   *  Grant topic publishing permissions to the given identity
   */
  grantPublish(identity: IGrantable, topic: string): Grant;
}
/**
 * A reference to an IoT Topic Rule.
 */
export interface TopicRuleAttributes {
  /**
   * The ARN of the IoT Topic Rule. At least one of bucketArn or bucketName must be
   * defined in order to initialize a bucket ref.
   */
  readonly topicRuleArn: string;
}
/**
 * Properties for defining an IoT Topic Rule.
 */
export interface TopicRuleProps {
  /**
   * The name of the rule.
   *
   * @default - generated
   */
  readonly ruleName?: string
  /**
   * The rule actions.
   *
   * @default - empty
   */
  readonly actions?: ITopicRuleAction[];
  /**
   * The rule enabled status.
   *
   * @default - false
   */
  readonly ruleDisabled?: boolean;
  /**
   * The rule sql.
   */
  readonly sql: string;
  /**
   * The rule AWS IoT SQL version.
   *
   * @default - 2012-17-10
   */
  readonly awsIotSqlVersion?: AwsIotSqlVersion;
  /**
   * The topic rule description.
   *
   * @default - none
   */
  readonly description?: string;
  /**
   * The rule actions to preform on error.
   *
   * @default - none
   */
  readonly errorAction?: ITopicRuleAction;
}

/**
 * Either a new or imported topic rule
 */
export abstract class TopicRuleBase extends Resource implements ITopicRule {
  public abstract readonly ruleName: string;
  public abstract readonly topicRuleArn: string;

  /**
   * Add a statement to the IAM resource for this rule
   */
  public addToResourcePolicy(statement: PolicyStatement): AddToResourcePolicyResult {
    singletonTopicRuleRole(this, [statement]);
    return { statementAdded: true };
  }

  /**
   * Grant topic publishing permissions to the given identity
   */
  public grantPublish(grantee: IGrantable, topic: string): Grant {
    return Grant.addToPrincipalOrResource({
      grantee,
      actions: ['iot:Publish'],
      resourceArns: [topicArn(this, topic)],
      resource: this,
    });
  }
}
/**
 * A new topic rule
 */
export class TopicRule extends TopicRuleBase {
  /**
   * Import topic rule attributes
   */
  public static fromTopicRuleArn(scope: Construct, id: string, topicRuleArn: string): ITopicRule {
    return TopicRule.fromTopicRuleAttributes(scope, id, { topicRuleArn });
  }
  /**
   * Import topic rule attributes
   */
  public static fromTopicRuleAttributes(scope: Construct, id: string, attrs: TopicRuleAttributes): ITopicRule {
    const topicRuleArn = attrs.topicRuleArn;
    const ruleName = parseRuleName(attrs.topicRuleArn);
    class Import extends TopicRuleBase {
      public readonly ruleName = ruleName;
      public readonly topicRuleArn = topicRuleArn;
    }

    return new Import(scope, id);
  }

  public readonly ruleName: string;
  public readonly topicRuleArn: string;
  private readonly actions = new Array<CfnTopicRule.ActionProperty>();
  private errorAction: CfnTopicRule.ActionProperty = {};

  constructor(scope: Construct, id: string, props: TopicRuleProps) {
    super(scope, id, {
      physicalName: props.ruleName,
    });

    if (props.errorAction) {
      this.addErrorAction(props.errorAction);
    }

    const resource = new CfnTopicRule(this, 'Resource', {
      ruleName: this.physicalName,
      topicRulePayload: {
        errorAction: Lazy.any({ produce: () => undefinedIfAllValuesAreEmpty(this.errorAction) }),
        description: props.description,
        awsIotSqlVersion: props.awsIotSqlVersion || AwsIotSqlVersion.VERSION2015_10_08,
        sql: props.sql,
        ruleDisabled: props.ruleDisabled || false,
        actions: Lazy.any({ produce: () => this.renderActions() }),
      },
    });

    this.ruleName = resource.ref;
    this.topicRuleArn = resource.attrArn;
    for (const action of props.actions || []) {
      this.addAction(action);
    }
  }

  /**
   * Adds an action to this topic rule.
   */
  public addAction(action: ITopicRuleAction) {
    this.actions.push(action.bind(this));
  }

  /**
   * Adds an error action to this topic rule.
   */
  public addErrorAction(action: ITopicRuleAction) {
    this.errorAction = action.bind(this);
  }

  public renderActions() {
    if (this.actions.length === 0) {
      throw new Error('Topic invalid. Must contain at least one action');
    }
    return this.actions;
  }
}
