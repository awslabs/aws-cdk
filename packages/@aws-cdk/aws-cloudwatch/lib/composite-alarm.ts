import { Lazy, Names, Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { AlarmBase, IAlarm, IAlarmRule } from './alarm-base';
import { CfnCompositeAlarm } from './cloudwatch.generated';

/**
 * Properties for creating a Composite Alarm
 */
export interface CompositeAlarmProps {

  /**
   * Whether the actions for this alarm are enabled
   *
   * @default true
   */
  readonly actionsEnabled?: boolean;

  /**
   * Description for the alarm
   *
   * @default No description
   */
  readonly alarmDescription?: string;

  /**
   * Name of the alarm
   *
   * @default Automatically generated name
   */
  readonly compositeAlarmName?: string;

  /**
   * Expression that specifies which other alarms are to be evaluated to determine this composite alarm's state.
   */
  readonly alarmRule: IAlarmRule;

}

/**
 * A Composite Alarm based on Alarm Rule.
 */
export class CompositeAlarm extends AlarmBase {
  /**
   * Import an existing CloudWatch composite alarm provided an Name.
   *
   * @param scope The parent creating construct (usually `this`)
   * @param id The construct's name
   * @param compositeAlarmName Composite Alarm Name
   */
  public static fromCompositeAlarmName(scope: Construct, id: string, compositeAlarmName: string): IAlarm {
    const stack = Stack.of(scope);

    return this.fromCompositeAlarmArn(scope, id, stack.formatArn({
      service: 'cloudwatch',
      resource: 'alarm',
      resourceName: compositeAlarmName,
    }));
  }

  /**
   * Import an existing CloudWatch composite alarm provided an ARN.
   *
   * @param scope The parent creating construct (usually `this`)
   * @param id The construct's name
   * @param compositeAlarmArn Composite Alarm ARN (i.e. arn:aws:cloudwatch:<region>:<account-id>:alarm/CompositeAlarmName)
   */
  public static fromCompositeAlarmArn(scope: Construct, id: string, compositeAlarmArn: string): IAlarm {
    class Import extends AlarmBase implements IAlarm {
      public readonly alarmArn = compositeAlarmArn;
      public readonly alarmName = Stack.of(scope).parseArn(compositeAlarmArn).resourceName!;
    }
    return new Import(scope, id);
  }

  /**
   * ARN of this alarm
   *
   * @attribute
   */
  public readonly alarmArn: string;

  /**
   * Name of this alarm.
   *
   * @attribute
   */
  public readonly alarmName: string;

  private readonly alarmRule: string;

  constructor(scope: Construct, id: string, props: CompositeAlarmProps) {
    super(scope, id, {
      physicalName: props.compositeAlarmName ?? Lazy.string({ produce: () => this.generateUniqueId() }),
    });

    if (props.alarmRule.renderAlarmRule().length > 10240) {
      throw new Error('Alarm Rule expression cannot be greater than 10240 characters, please reduce the conditions in the Alarm Rule');
    }

    this.alarmRule = props.alarmRule.renderAlarmRule();

    const alarm = new CfnCompositeAlarm(this, 'Resource', {
      alarmName: this.physicalName,
      alarmRule: this.alarmRule,
      alarmDescription: props.alarmDescription,
      actionsEnabled: props.actionsEnabled,
      alarmActions: Lazy.list({ produce: () => this.alarmActionArns }),
      insufficientDataActions: Lazy.list({ produce: (() => this.insufficientDataActionArns) }),
      okActions: Lazy.list({ produce: () => this.okActionArns }),
    });

    this.alarmName = this.getResourceNameAttribute(alarm.ref);
    this.alarmArn = this.getResourceArnAttribute(alarm.attrArn, {
      service: 'cloudwatch',
      resource: 'alarm',
      resourceName: this.physicalName,
      sep: ':',
    });
  }

  private generateUniqueId(): string {
    const name = Names.uniqueId(this);
    if (name.length > 240) {
      return name.substring(0, 120) + name.substring(name.length - 120);
    }
    return name;
  }
}
