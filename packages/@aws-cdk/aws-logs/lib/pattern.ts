// Implementation of metric patterns

/**
 * Interface for objects that can render themselves to log patterns.
 */
export interface IFilterPattern {
  readonly logPatternString: string;
}

/**
 * Base class for patterns that only match JSON log events.
 */
export abstract class JsonPattern implements IFilterPattern {
  // This is a separate class so we have some type safety where users can't
  // combine text patterns and JSON patterns with an 'and' operation.
  constructor(public readonly jsonPatternString: string) { }

  public get logPatternString(): string {
    return '{ ' + this.jsonPatternString + ' }';
  }
}

/**
 * A collection of static methods to generate appropriate ILogPatterns
 */
export class FilterPattern {
  /**
   * Use the given string as log pattern.
   *
   * See https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/FilterAndPatternSyntax.html
   * for information on writing log patterns.
   *
   * @param logPatternString The pattern string to use.
   */
  public static literal(logPatternString: string): IFilterPattern {
    return new LiteralLogPattern(logPatternString);
  }

  /**
   * A log pattern that matches all events.
   */
  public static allEvents(): IFilterPattern {
    return new LiteralLogPattern('');
  }

  /**
   * A log pattern that matches if all the strings given appear in the event.
   *
   * @param terms The words to search for. All terms must match.
   */
  public static allTerms(...terms: string[]): IFilterPattern {
    return new TextLogPattern([terms]);
  }

  /**
   * A log pattern that matches if any of the strings given appear in the event.
   *
   * @param terms The words to search for. Any terms must match.
   */
  public static anyTerm(...terms: string[]): IFilterPattern {
    return new TextLogPattern(terms.map(t => [t]));
  }

  /**
   * A log pattern that matches if any of the given term groups matches the event.
   *
   * A term group matches an event if all the terms in it appear in the event string.
   *
   * @param termGroups A list of term groups to search for. Any one of the clauses must match.
   */
  public static anyTermGroup(...termGroups: string[][]): IFilterPattern {
    return new TextLogPattern(termGroups);
  }

  /**
   * A JSON log pattern that compares string values.
   *
   * This pattern only matches if the event is a JSON event, and the indicated field inside
   * compares with the string value.
   *
   * Use '$' to indicate the root of the JSON structure. The comparison operator can only
   * compare equality or inequality. The '*' wildcard may appear in the value may at the
   * start or at the end.
   *
   * For more information, see:
   *
   * https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/FilterAndPatternSyntax.html
   *
   * @param jsonField Field inside JSON. Example: "$.myField"
   * @param comparison Comparison to carry out. Either = or !=.
   * @param value The string value to compare to. May use '*' as wildcard at start or end of string.
   */
  public static stringValue(jsonField: string, comparison: string, value: string): JsonPattern {
    return new JSONStringPattern(jsonField, comparison, value);
  }

  /**
   * A JSON log pattern that compares numerical values.
   *
   * This pattern only matches if the event is a JSON event, and the indicated field inside
   * compares with the value in the indicated way.
   *
   * Use '$' to indicate the root of the JSON structure. The comparison operator can only
   * compare equality or inequality. The '*' wildcard may appear in the value may at the
   * start or at the end.
   *
   * For more information, see:
   *
   * https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/FilterAndPatternSyntax.html
   *
   * @param jsonField Field inside JSON. Example: "$.myField"
   * @param comparison Comparison to carry out. One of =, !=, <, <=, >, >=.
   * @param value The numerical value to compare to
   */
  public static numberValue(jsonField: string, comparison: string, value: number): JsonPattern {
    return new JSONNumberPattern(jsonField, comparison, value);
  }

  /**
   * A JSON log pattern that matches if the field exists and has the special value 'null'.
   *
   * @param jsonField Field inside JSON. Example: "$.myField"
   */
  public static isNull(jsonField: string): JsonPattern {
    return new JSONPostfixPattern(jsonField, 'IS NULL');
  }

  /**
   * A JSON log pattern that matches if the field does not exist.
   *
   * @param jsonField Field inside JSON. Example: "$.myField"
   */
  public static notExists(jsonField: string): JsonPattern {
    return new JSONPostfixPattern(jsonField, 'NOT EXISTS');
  }

  /**
   * A JSON log patter that matches if the field exists.
   *
   * This is a readable convenience wrapper over 'field = *'
   *
   * @param jsonField Field inside JSON. Example: "$.myField"
   */
  public static exists(jsonField: string): JsonPattern {
    return new JSONStringPattern(jsonField, '=', '*');
  }

  /**
   * A JSON log pattern that matches if the field exists and equals the boolean value.
   *
   * @param jsonField Field inside JSON. Example: "$.myField"
   * @param value The value to match
   */
  public static booleanValue(jsonField: string, value: boolean): JsonPattern {
    return new JSONPostfixPattern(jsonField, value ? 'IS TRUE' : 'IS FALSE');
  }

  /**
   * A JSON log pattern that matches if all given JSON log patterns match
   */
  public static all(...patterns: JsonPattern[]): JsonPattern {
    if (patterns.length === 0) { throw new Error('Must supply at least one pattern, or use allEvents() to match all events.'); }
    if (patterns.length === 1) { return patterns[0]; }
    return new JSONAggregatePattern('&&', patterns);
  }

  /**
   * A JSON log pattern that matches if any of the given JSON log patterns match
   */
  public static any(...patterns: JsonPattern[]): JsonPattern {
    if (patterns.length === 0) { throw new Error('Must supply at least one pattern'); }
    if (patterns.length === 1) { return patterns[0]; }
    return new JSONAggregatePattern('||', patterns);
  }

  /**
   * A space delimited log pattern matcher.
   *
   * The log event is divided into space-delimited columns (optionally
   * enclosed by "" or [] to capture spaces into column values), and names
   * are given to each column.
   *
   * '...' may be specified once to match any number of columns.
   *
   * Afterwards, conditions may be added to individual columns.
   *
   * @param columns The columns in the space-delimited log stream.
   */
  public static spaceDelimited(...columns: string[]): SpaceDelimitedTextPattern {
    return SpaceDelimitedTextPattern.construct(columns);
  }
}

/**
 * Use a string literal as a log pattern
 */
class LiteralLogPattern implements IFilterPattern {
  constructor(public readonly logPatternString: string) {
  }
}

/**
 * Search for a set of set of terms
 */
class TextLogPattern implements IFilterPattern {
  public readonly logPatternString: string;

  constructor(clauses: string[][]) {
    const quotedClauses = clauses.map(terms => terms.map(quoteTerm).join(' '));
    if (quotedClauses.length === 1) {
      this.logPatternString = quotedClauses[0];
    } else {
      this.logPatternString = quotedClauses.map(alt => '?' + alt).join(' ');
    }
  }
}

/**
 * A string comparison for JSON values
 */
class JSONStringPattern extends JsonPattern {
  public constructor(jsonField: string, comparison: string, value: string) {
    comparison = validateStringOperator(comparison);
    super(`${jsonField} ${comparison} ${quoteTerm(value)}`);
  }
}

/**
 * A number comparison for JSON values
 */
class JSONNumberPattern extends JsonPattern {
  public constructor(jsonField: string, comparison: string, value: number) {
    comparison = validateNumericalOperator(comparison);
    super(`${jsonField} ${comparison} ${value}`);
  }
}

/**
 * A postfix operator for JSON patterns
 */
class JSONPostfixPattern extends JsonPattern {
  public constructor(jsonField: string, postfix: string) {
    // No validation, we assume these are generated by trusted factory functions
    super(`${jsonField} ${postfix}`);
  }
}

/**
 * Combines multiple other JSON patterns with an operator
 */
class JSONAggregatePattern extends JsonPattern {
  public constructor(operator: string, patterns: JsonPattern[]) {
    if (operator !== '&&' && operator !== '||') {
      throw new Error('Operator must be one of && or ||');
    }

    const clauses = patterns.map(p => '(' + p.jsonPatternString + ')');

    super(clauses.join(` ${operator} `));
  }
}

export type RestrictionMap = {[column: string]: ColumnRestriction[]};

const COL_ELLIPSIS = '...';

/**
 * Space delimited text pattern
 */
export class SpaceDelimitedTextPattern implements IFilterPattern {
  /**
   * Construct a new instance of a space delimited text pattern
   *
   * Since this class must be public, we can't rely on the user only creating it through
   * the `LogPattern.spaceDelimited()` factory function. We must therefore validate the
   * argument in the constructor. Since we're returning a copy on every mutation, and we
   * don't want to re-validate the same things on every construction, we provide a limited
   * set of mutator functions and only validate the new data every time.
   */
  public static construct(columns: string[]) {
    // Validation happens here because a user could instantiate this object directly without
    // going through the factory
    for (const column of columns) {
      if (!validColumnName(column)) {
        throw new Error(`Invalid column name: ${column}`);
      }
    }

    if (sum(columns.map(c => c === COL_ELLIPSIS ? 1 : 0)) > 1) {
      throw new Error("Can use at most one '...' column");
    }

    return new SpaceDelimitedTextPattern(columns, {});
  }

  // TODO: Temporarily changed from private to protected to unblock build. We need to think
  //     about how to handle jsii types with private constructors.
  protected constructor(private readonly columns: string[], private readonly restrictions: RestrictionMap) {
    // Private constructor so we validate in the .construct() factory function
  }

  /**
   * Restrict where the pattern applies
   */
  public whereString(columnName: string, comparison: string, value: string): SpaceDelimitedTextPattern {
    if (columnName === COL_ELLIPSIS) {
      throw new Error("Can't use '...' in a restriction");
    }
    if (this.columns.indexOf(columnName) === -1) {
      throw new Error(`Column in restrictions that is not in columns: ${columnName}`);
    }

    comparison = validateStringOperator(comparison);

    return new SpaceDelimitedTextPattern(this.columns, this.addRestriction(columnName, {
      comparison,
      stringValue: value,
    }));
  }

  /**
   * Restrict where the pattern applies
   */
  public whereNumber(columnName: string, comparison: string, value: number): SpaceDelimitedTextPattern {
    if (columnName === COL_ELLIPSIS) {
      throw new Error("Can't use '...' in a restriction");
    }
    if (this.columns.indexOf(columnName) === -1) {
      throw new Error(`Column in restrictions that is not in columns: ${columnName}`);
    }

    comparison = validateNumericalOperator(comparison);

    return new SpaceDelimitedTextPattern(this.columns, this.addRestriction(columnName, {
      comparison,
      numberValue: value,
    }));
  }

  public get logPatternString(): string {
    return '[' + this.columns.map(this.columnExpression.bind(this)).join(', ') + ']';
  }

  /**
   * Return the column expression for the given column
   */
  private columnExpression(column: string) {
    const restrictions = this.restrictions[column];
    if (!restrictions) { return column; }

    return restrictions.map(r => renderRestriction(column, r)).join(' && ');
  }

  /**
   * Make a copy of the current restrictions and add one
   */
  private addRestriction(columnName: string, restriction: ColumnRestriction) {
    const ret: RestrictionMap = {};
    for (const key of Object.keys(this.restrictions)) {
      ret[key] = this.restrictions[key].slice();
    }
    if (!(columnName in ret)) { ret[columnName] = []; }
    ret[columnName].push(restriction);
    return ret;
  }
}

export interface ColumnRestriction {
  /**
   * Comparison operator to use
   */
  readonly comparison: string;

  /**
   * String value to compare to
   *
   * Exactly one of 'stringValue' and 'numberValue' must be set.
   */
  readonly stringValue?: string;

  /**
   * Number value to compare to
   *
   * Exactly one of 'stringValue' and 'numberValue' must be set.
   */
  readonly numberValue?: number;
}

/**
 * Quote a term for use in a pattern expression
 *
 * It's never wrong to quote a string term, and required if the term
 * contains non-alphanumerical characters, so we just always do it.
 *
 * Inner double quotes are escaped using a backslash.
 */
function quoteTerm(term: string): string {
  return '"' + term.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

/**
 * Return whether the given column name is valid in a space-delimited table
 */
function validColumnName(column: string) {
  return column === COL_ELLIPSIS || /^[a-zA-Z0-9_-]+$/.exec(column);
}

/**
 * Validate and normalize the string comparison operator
 *
 * Correct for a common typo/confusion, treat '==' as '='
 */
function validateStringOperator(operator: string) {
  if (operator === '==') { operator = '='; }

  if (operator !== '=' && operator !== '!=') {
    throw new Error(`Invalid comparison operator ('${operator}'), must be either '=' or '!='`);
  }

  return operator;
}

const VALID_OPERATORS = ['=', '!=', '<', '<=', '>', '>='];

/**
 * Validate and normalize numerical comparison operators
 *
 * Correct for a common typo/confusion, treat '==' as '='
 */
function validateNumericalOperator(operator: string) {
  // Correct for a common typo, treat '==' as '='
  if (operator === '==') { operator = '='; }

  if (VALID_OPERATORS.indexOf(operator) === -1) {
    throw new Error(`Invalid comparison operator ('${operator}'), must be one of ${VALID_OPERATORS.join(', ')}`);
  }

  return operator;
}

/**
 * Render a table restriction
 */
function renderRestriction(column: string, restriction: ColumnRestriction) {
  if (restriction.numberValue !== undefined) {
    return `${column} ${restriction.comparison} ${restriction.numberValue}`;
  } else if (restriction.stringValue) {
    return `${column} ${restriction.comparison} ${quoteTerm(restriction.stringValue)}`;
  } else {
    throw new Error('Invalid restriction');
  }
}

function sum(xs: number[]): number {
  return xs.reduce((a, c) => a + c, 0);
}
