import { BaseKeyCondition, BeginsWith, Between, BinaryCondition } from './private';

/**
 * Factory class for DynamoDB key conditions.
 */
export class KeyCondition {
  /**
   * Condition k = arg, true if the key attribute k is equal to the Query argument
   */
  public static eq(keyName: string, arg: string): KeyCondition {
    return new KeyCondition(new BinaryCondition(keyName, '=', arg));
  }

  /**
   * Condition k < arg, true if the key attribute k is less than the Query argument
   */
  public static lt(keyName: string, arg: string): KeyCondition {
    return new KeyCondition(new BinaryCondition(keyName, '<', arg));
  }

  /**
   * Condition k <= arg, true if the key attribute k is less than or equal to the Query argument
   */
  public static le(keyName: string, arg: string): KeyCondition {
    return new KeyCondition(new BinaryCondition(keyName, '<=', arg));
  }

  /**
   * Condition k > arg, true if the key attribute k is greater than the the Query argument
   */
  public static gt(keyName: string, arg: string): KeyCondition {
    return new KeyCondition(new BinaryCondition(keyName, '>', arg));
  }

  /**
   * Condition k >= arg, true if the key attribute k is greater or equal to the Query argument
   */
  public static ge(keyName: string, arg: string): KeyCondition {
    return new KeyCondition(new BinaryCondition(keyName, '>=', arg));
  }

  /**
   * Condition (k, arg). True if the key attribute k begins with the Query argument.
   */
  public static beginsWith(keyName: string, arg: string): KeyCondition {
    return new KeyCondition(new BeginsWith(keyName, arg));
  }

  /**
   * Condition k BETWEEN arg1 AND arg2, true if k >= arg1 and k <= arg2.
   */
  public static between(keyName: string, arg1: string, arg2: string): KeyCondition {
    return new KeyCondition(new Between(keyName, arg1, arg2));
  }

  private constructor(private readonly cond: BaseKeyCondition) { }

  /**
   * Conjunction between two conditions.
   */
  public and(keyCond: KeyCondition): KeyCondition {
    return new KeyCondition(this.cond.and(keyCond.cond));
  }

  /**
   * Renders the key condition to a VTL string.
   */
  public renderTemplate(): string {
    return `"query" : {
            "expression" : "${this.cond.renderCondition()}",
            "expressionNames" : {
                ${this.cond.renderExpressionNames()}
            },
            "expressionValues" : {
                ${this.cond.renderExpressionValues()}
            }
        }`;
  }
}

/**
 * Utility class representing the assigment of a value to an attribute.
 */
export class Assign {
  constructor(private readonly attr: string, private readonly arg: string) { }

  /**
   * Renders the assignment as a VTL string.
   */
  public renderAsAssignment(): string {
    return `"${this.attr}" : $util.dynamodb.toDynamoDBJson(${this.arg})`;
  }

  /**
   * Renders the assignment as a map element.
   */
  public putInMap(map: string): string {
    return `$util.qr($${map}.put("${this.attr}", ${this.arg}))`;
  }
}

/**
 * Utility class to allow assigning a value or an auto-generated id
 * to a partition key.
 */
export class PartitionKeyStep {
  constructor(private readonly key: string) { }

  /**
   * Assign an auto-generated value to the partition key.
   */
  public is(val: string): PartitionKey {
    return new PartitionKey(new Assign(this.key, `$ctx.args.${val}`));
  }

  /**
   * Assign an auto-generated value to the partition key.
   */
  public auto(): PartitionKey {
    return new PartitionKey(new Assign(this.key, '$util.autoId()'));
  }
}

/**
 * Utility class to allow assigning a value or an auto-generated id
 * to a sort key.
 */
export class SortKeyStep {
  constructor(private readonly pkey: Assign, private readonly skey: string) { }

  /**
   * Assign an auto-generated value to the sort key.
   */
  public is(val: string): PrimaryKey {
    return new PrimaryKey(this.pkey, new Assign(this.skey, `$ctx.args.${val}`));
  }

  /**
   * Assign an auto-generated value to the sort key.
   */
  public auto(): PrimaryKey {
    return new PrimaryKey(this.pkey, new Assign(this.skey, '$util.autoId()'));
  }
}

/**
 * Specifies the assignment to the primary key. It either
 * contains the full primary key or only the partition key.
 */
export class PrimaryKey {
  /**
   * Allows assigning a value to the partition key.
   */
  public static partition(key: string): PartitionKeyStep {
    return new PartitionKeyStep(key);
  }

  constructor(protected readonly pkey: Assign, private readonly skey?: Assign) { }

  /**
   * Renders the key assignment to a VTL string.
   */
  public renderTemplate(): string {
    const assignments = [this.pkey.renderAsAssignment()];
    if (this.skey) {
      assignments.push(this.skey.renderAsAssignment());
    }
    return `"key" : {
      ${assignments.join(',')}
    }`;
  }
}

/**
 * Specifies the assignment to the partition key. It can be
 * enhanced with the assignment of the sort key.
 */
export class PartitionKey extends PrimaryKey {
  constructor(pkey: Assign) {
    super(pkey);
  }

  /**
   * Allows assigning a value to the sort key.
   */
  public sort(key: string): SortKeyStep {
    return new SortKeyStep(this.pkey, key);
  }
}

/**
 * Specifies the attribute value assignments.
 */
export class AttributeValues {
  constructor(private readonly container: string, private readonly assignments: Assign[] = []) { }

  /**
   * Allows assigning a value to the specified attribute.
   */
  public attribute(attr: string): AttributeValuesStep {
    return new AttributeValuesStep(attr, this.container, this.assignments);
  }

  /**
   * Renders the variables required for `renderTemplate`.
   */
  public renderVariables(): string {
    return `#set($input = ${this.container})
      ${this.assignments.map(a => a.putInMap('input')).join('\n')}`;
  }

  /**
   * Renders the attribute value assingments to a VTL string.
   */
  public renderTemplate(): string {
    return '"attributeValues": $util.dynamodb.toMapValuesJson($input)';
  }
}

/**
 * Utility class to allow assigning a value to an attribute.
 */
export class AttributeValuesStep {
  constructor(private readonly attr: string, private readonly container: string, private readonly assignments: Assign[]) { }

  /**
   * Assign the value to the current attribute.
   */
  public is(val: string): AttributeValues {
    this.assignments.push(new Assign(this.attr, val));
    return new AttributeValues(this.container, this.assignments);
  }
}

/**
 * Factory class for attribute value assignments.
 */
export class Values {
  /**
   * Treats the specified object as a map of assignments, where the property
   * names represent attribute names. It’s opinionated about how it represents
   * some of the nested objects: e.g., it will use lists (“L”) rather than sets
   * (“SS”, “NS”, “BS”). By default it projects the argument container ("$ctx.args").
   */
  public static projecting(arg?: string): AttributeValues {
    return new AttributeValues('$ctx.args' + (arg ? `.${arg}` : ''));
  }

  /**
   * Allows assigning a value to the specified attribute.
   */
  public static attribute(attr: string): AttributeValuesStep {
    return new AttributeValues('{}').attribute(attr);
  }
}