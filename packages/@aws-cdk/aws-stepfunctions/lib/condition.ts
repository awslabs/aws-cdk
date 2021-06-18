/**
 * A Condition for use in a Choice state branch
 */
export abstract class Condition {
  /**
   * Matches if variable is present
   */
  public static isPresent(variable: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.IsPresent, true);
  }

  /**
   * Matches if variable is not present
   */
  public static isNotPresent(variable: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.IsPresent, false);
  }

  /**
   * Matches if variable is a string
   */
  public static isString(variable: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.IsString, true);
  }

  /**
   * Matches if variable is not a string
   */
  public static isNotString(variable: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.IsString, false);
  }

  /**
   * Matches if variable is numeric
   */
  public static isNumeric(variable: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.IsNumeric, true);
  }

  /**
   * Matches if variable is not numeric
   */
  public static isNotNumeric(variable: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.IsNumeric, false);
  }

  /**
   * Matches if variable is boolean
   */
  public static isBoolean(variable: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.IsBoolean, true);
  }

  /**
   * Matches if variable is not boolean
   */
  public static isNotBoolean(variable: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.IsBoolean, false);
  }

  /**
   * Matches if variable is a timestamp
   */
  public static isTimestamp(variable: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.IsTimestamp, true);
  }

  /**
   * Matches if variable is not a timestamp
   */
  public static isNotTimestamp(variable: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.IsTimestamp, false);
  }

  /**
   * Matches if variable is not null
   */
  public static isNotNull(variable: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.IsNull, false);
  }
  /**
   * Matches if variable is Null
   */
  public static isNull(variable: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.IsNull, true);
  }
  /**
   * Matches if a boolean field has the given value
   */
  public static booleanEquals(variable: string, value: boolean): Condition {
    return new VariableComparison(variable, ComparisonOperator.BooleanEquals, value);
  }

  /**
   * Matches if a boolean field equals to a value at a given mapping path
   */
  public static booleanEqualsJsonPath(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.BooleanEqualsPath, value);
  }

  /**
   * Matches if a string field equals to a value at a given mapping path
   */
  public static stringEqualsJsonPath(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.StringEqualsPath, value);
  }

  /**
   * Matches if a string field has the given value
   */
  public static stringEquals(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.StringEquals, value);
  }

  /**
   * Matches if a string field sorts before a given value
   */
  public static stringLessThan(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.StringLessThan, value);
  }

  /**
   * Matches if a string field sorts before a given value at a particular mapping
   */
  public static stringLessThanJsonPath(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.StringLessThanPath, value);
  }

  /**
   * Matches if a string field sorts equal to or before a given value
   */
  public static stringLessThanEquals(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.StringLessThanEquals, value);
  }

  /**
   * Matches if a string field sorts equal to or before a given mapping
   */
  public static stringLessThanEqualsJsonPath(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.StringLessThanEqualsPath, value);
  }

  /**
   * Matches if a string field sorts after a given value
   */
  public static stringGreaterThan(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.StringGreaterThan, value);
  }

  /**
   * Matches if a string field sorts after a value at a given mapping path
   */
  public static stringGreaterThanJsonPath(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.StringGreaterThanPath, value);
  }

  /**
   * Matches if a string field sorts after or equal to value at a given mapping path
   */
  public static stringGreaterThanEqualsJsonPath(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.StringGreaterThanEqualsPath, value);
  }

  /**
   * Matches if a string field sorts after or equal to a given value
   */
  public static stringGreaterThanEquals(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.StringGreaterThanEquals, value);
  }

  /**
   * Matches if a numeric field has the given value
   */
  public static numberEquals(variable: string, value: number): Condition {
    return new VariableComparison(variable, ComparisonOperator.NumericEquals, value);
  }

  /**
   * Matches if a numeric field has the value in a given mapping path
   */
  public static numberEqualsJsonPath(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.NumericEqualsPath, value);
  }

  /**
   * Matches if a numeric field is less than the given value
   */
  public static numberLessThan(variable: string, value: number): Condition {
    return new VariableComparison(variable, ComparisonOperator.NumericLessThan, value);
  }

  /**
   * Matches if a numeric field is less than the value at the given mapping path
   */
  public static numberLessThanJsonPath(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.NumericLessThanPath, value);
  }

  /**
   * Matches if a numeric field is less than or equal to the given value
   */
  public static numberLessThanEquals(variable: string, value: number): Condition {
    return new VariableComparison(variable, ComparisonOperator.NumericLessThanEquals, value);
  }

  /**
   * Matches if a numeric field is less than or equal to the numeric value at given mapping path
   */
  public static numberLessThanEqualsJsonPath(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.NumericLessThanEqualsPath, value);
  }

  /**
   * Matches if a numeric field is greater than the given value
   */
  public static numberGreaterThan(variable: string, value: number): Condition {
    return new VariableComparison(variable, ComparisonOperator.NumericGreaterThan, value);
  }

  /**
   * Matches if a numeric field is greater than the value at a given mapping path
   */
  public static numberGreaterThanJsonPath(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.NumericGreaterThanPath, value);
  }

  /**
   * Matches if a numeric field is greater than or equal to the given value
   */
  public static numberGreaterThanEquals(variable: string, value: number): Condition {
    return new VariableComparison(variable, ComparisonOperator.NumericGreaterThanEquals, value);
  }

  /**
   * Matches if a numeric field is greater than or equal to the value at a given mapping path
   */
  public static numberGreaterThanEqualsJsonPath(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.NumericGreaterThanEqualsPath, value);
  }

  /**
   * Matches if a timestamp field is the same time as the given timestamp
   */
  public static timestampEquals(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.TimestampEquals, value);
  }

  /**
   * Matches if a timestamp field is the same time as the timestamp at a given mapping path
   */
  public static timestampEqualsJsonPath(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.TimestampEqualsPath, value);
  }

  /**
   * Matches if a timestamp field is before the given timestamp
   */
  public static timestampLessThan(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.TimestampLessThan, value);
  }

  /**
   * Matches if a timestamp field is before the timestamp at a given mapping path
   */
  public static timestampLessThanJsonPath(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.TimestampLessThanPath, value);
  }

  /**
   * Matches if a timestamp field is before or equal to the given timestamp
   */
  public static timestampLessThanEquals(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.TimestampLessThanEquals, value);
  }

  /**
   * Matches if a timestamp field is before or equal to the timestamp at a given mapping path
   */
  public static timestampLessThanEqualsJsonPath(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.TimestampLessThanEqualsPath, value);
  }

  /**
   * Matches if a timestamp field is after the given timestamp
   */
  public static timestampGreaterThan(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.TimestampGreaterThan, value);
  }

  /**
   * Matches if a timestamp field is after the timestamp at a given mapping path
   */
  public static timestampGreaterThanJsonPath(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.TimestampGreaterThanPath, value);
  }

  /**
   * Matches if a timestamp field is after or equal to the given timestamp
   */
  public static timestampGreaterThanEquals(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.TimestampGreaterThanEquals, value);
  }

  /**
   * Matches if a timestamp field is after or equal to the timestamp at a given mapping path
   */
  public static timestampGreaterThanEqualsJsonPath(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.TimestampGreaterThanEqualsPath, value);
  }

  /**
   * Matches if a field matches a string pattern that can contain a wild card (*) e.g: log-*.txt or *LATEST*.
   * No other characters other than "*" have any special meaning - * can be escaped: \\*
   */
  public static stringMatches(variable: string, value: string): Condition {
    return new VariableComparison(variable, ComparisonOperator.StringMatches, value);
  }

  /**
   * Combine two or more conditions with a logical AND
   */
  public static and(...conditions: Condition[]): Condition {
    return new CompoundCondition(CompoundOperator.And, ...conditions);
  }

  /**
   * Combine two or more conditions with a logical OR
   */
  public static or(...conditions: Condition[]): Condition {
    return new CompoundCondition(CompoundOperator.Or, ...conditions);
  }

  /**
   * Negate a condition
   */
  public static not(condition: Condition): Condition {
    return new NotCondition(condition);
  }

  /**
   * Render Amazon States Language JSON for the condition
   */
  public abstract renderCondition(): any;
}

/**
 * Comparison Operator types
 */
enum ComparisonOperator {
  StringEquals,
  StringEqualsPath,
  StringLessThan,
  StringLessThanPath,
  StringGreaterThan,
  StringGreaterThanPath,
  StringLessThanEquals,
  StringLessThanEqualsPath,
  StringGreaterThanEquals,
  StringGreaterThanEqualsPath,
  NumericEquals,
  NumericEqualsPath,
  NumericLessThan,
  NumericLessThanPath,
  NumericGreaterThan,
  NumericGreaterThanPath,
  NumericLessThanEquals,
  NumericLessThanEqualsPath,
  NumericGreaterThanEquals,
  NumericGreaterThanEqualsPath,
  BooleanEquals,
  BooleanEqualsPath,
  TimestampEquals,
  TimestampEqualsPath,
  TimestampLessThan,
  TimestampLessThanPath,
  TimestampGreaterThan,
  TimestampGreaterThanPath,
  TimestampLessThanEquals,
  TimestampLessThanEqualsPath,
  TimestampGreaterThanEquals,
  TimestampGreaterThanEqualsPath,
  IsNull,
  IsBoolean,
  IsNumeric,
  IsString,
  IsTimestamp,
  IsPresent,
  StringMatches,

}

/**
 * Compound Operator types
 */
enum CompoundOperator {
  And,
  Or,
}

/**
 * Scalar comparison
 */
class VariableComparison extends Condition {
  constructor(private readonly variable: string, private readonly comparisonOperator: ComparisonOperator, private readonly value: any) {
    super();
    if (!/^\$|(\$[.[])/.test(variable)) {
      throw new Error(`Variable reference must be '$', start with '$.', or start with '$[', got '${variable}'`);
    }
  }

  public renderCondition(): any {
    return {
      Variable: this.variable,
      [ComparisonOperator[this.comparisonOperator]]: this.value,
    };
  }
}

/**
 * Logical compound condition
 */
class CompoundCondition extends Condition {
  private readonly conditions: Condition[];

  constructor(private readonly operator: CompoundOperator, ...conditions: Condition[]) {
    super();
    this.conditions = conditions;
    if (conditions.length === 0) {
      throw new Error('Must supply at least one inner condition for a logical combination');
    }
  }

  public renderCondition(): any {
    return {
      [CompoundOperator[this.operator]]: this.conditions.map(c => c.renderCondition()),
    };
  }
}

/**
 * Logical unary condition
 */
class NotCondition extends Condition {
  constructor(private readonly comparisonOperation: Condition) {
    super();
  }

  public renderCondition(): any {
    return {
      Not: this.comparisonOperation.renderCondition(),
    };
  }
}
