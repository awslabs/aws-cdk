import { IAlarm, IAlarmRule } from './alarm-base';

/**
 * Enumeration indicates state of Alarm used in building Alarm Rule.
 */
export enum AlarmState {

  /**
   * State indicates resource is in ALARM
   */
  ALARM = 'ALARM',

  /**
   * State indicates resource is not in ALARM
   */
  OK = 'OK',

  /**
   * State indicates there is not enough data to determine is resource is in ALARM
   */
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',

}

/**
 * Enumeration of supported Composite Alarms operators.
 */
enum Operator {

  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',

}

/**
 * Class with static functions to build AlarmRule for Composite Alarms.
 */
export class AlarmRule {
  /**
   * function to join all provided AlarmRules with AND operator.
   *
   * @param operands IAlarmRules to be joined with AND operator.
   */
  public static allOf(...operands: IAlarmRule[]): IAlarmRule {
    return this.concat(Operator.AND, ...operands);
  }

  /**
   * function to join all provided AlarmRules with OR operator.
   *
   * @param operands IAlarmRules to be joined with OR operator.
   */
  public static anyOf(...operands: IAlarmRule[]): IAlarmRule {
    return this.concat(Operator.OR, ...operands);
  }

  /**
   * function to wrap provided AlarmRule in NOT operator.
   *
   * @param operand IAlarmRule to be wrapped in NOT operator.
   */
  public static not(operand: IAlarmRule): IAlarmRule {
    return new class implements IAlarmRule {
      public renderAlarmRule(): string {
        return `(NOT (${operand.renderAlarmRule()}))`;
      }
    };
  }

  /**
   * function to build TRUE/FALSE intent for Rule Expression.
   *
   * @param value boolean value to be used in rule expression.
   */
  public static fromBoolean(value: boolean): IAlarmRule {
    return new class implements IAlarmRule {
      public renderAlarmRule(): string {
        return `${String(value).toUpperCase()}`;
      }
    };
  }

  /**
   * function to build Rule Expression for given IAlarm and AlarmState.
   *
   * @param alarm IAlarm to be used in Rule Expression.
   * @param alarmState AlarmState to be used in Rule Expression.
   */
  public static fromAlarm(alarm: IAlarm, alarmState: AlarmState): IAlarmRule {
    return new class implements IAlarmRule {
      public renderAlarmRule(): string {
        return `${alarmState}("${alarm.alarmArn}")`;
      }
    };
  }

  /**
   * function to build Rule Expression for given Alarm Rule string.
   *
   * @param alarmRule string to be used in Rule Expression.
   */
  public static fromString(alarmRule: string): IAlarmRule {
    return new class implements IAlarmRule {
      public renderAlarmRule(): string {
        return alarmRule;
      }
    };
  }

  private static concat(operator: Operator, ...operands: IAlarmRule[]): IAlarmRule {
    return new class implements IAlarmRule {
      public renderAlarmRule(): string {
        const expression = operands
          .map(operand => `${operand.renderAlarmRule()}`)
          .join(` ${operator} `);
        return `(${expression})`;
      }
    };
  }
}
