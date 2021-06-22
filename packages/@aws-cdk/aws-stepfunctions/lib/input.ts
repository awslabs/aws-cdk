import { JsonPath } from './fields';

/**
 * Type union for task classes that accept multiple types of payload
 */
export class TaskInput {
  /**
   * Use a literal string as task input
   *
   * This might be a JSON-encoded object, or just a text.
   */
  public static fromText(text: string) {
    return new TaskInput(InputType.TEXT, text);
  }

  /**
   * Use an object as task input
   *
   * This object may contain JSON path fields as object values, if desired.
   */
  public static fromObject(obj: { [key: string]: any }) {
    return new TaskInput(InputType.OBJECT, obj);
  }

  /**
   * Use a part of the execution data or task context as task input
   *
   * Use this when you want to use a subobject or string from
   * the current state machine execution or the current task context
   * as complete payload to a task.
   */
  public static fromJsonPathAt(path: string) {
    return new TaskInput(InputType.TEXT, JsonPath.stringAt(path));
  }

  /**
   * Use a part of the execution data as task input
   *
   * Use this when you want to use a subobject or string from
   * the current state machine execution as complete payload
   * to a task.
   *
   * @deprecated Use `fromJsonPathAt`.
   */
  public static fromDataAt(path: string) {
    return new TaskInput(InputType.TEXT, JsonPath.stringAt(path));
  }

  /**
   * Use a part of the task context as task input
   *
   * Use this when you want to use a subobject or string from
   * the current task context as complete payload
   * to a task.
   *
   * @deprecated Use `fromJsonPathAt`.
   */
  public static fromContextAt(path: string) {
    return new TaskInput(InputType.TEXT, JsonPath.stringAt(path));
  }

  /**
   *
   * @param type type of task input
   * @param value payload for the corresponding input type.
   * It can be a JSON-encoded object, context, data, etc.
   */
  private constructor(public readonly type: InputType, public readonly value: any) {}
}

/**
 * The type of task input
 */
export enum InputType {
  /**
   * Use a literal string
   * This might be a JSON-encoded object, or just text.
   * valid JSON text: standalone, quote-delimited strings; objects; arrays; numbers; Boolean values; and null.
   *
   * example: `literal string`
   * example: {"json": "encoded"}
   */
  TEXT,
  /**
   * Use an object which may contain Data and Context fields
   * as object values, if desired.
   *
   * example:
   * {
   *  literal: 'literal',
   *  SomeInput: sfn.JsonPath.stringAt('$.someField')
   * }
   *
   * @see https://docs.aws.amazon.com/step-functions/latest/dg/concepts-state-machine-data.html
   * @see https://docs.aws.amazon.com/step-functions/latest/dg/input-output-contextobject.html
   */
  OBJECT,
}
