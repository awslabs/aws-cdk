/**
 * Utility class to represent DynamoDB key conditions.
 */
export abstract class BaseKeyCondition {
  public and(cond: BaseKeyCondition): BaseKeyCondition {
    return new (class extends BaseKeyCondition {
      constructor(private readonly left: BaseKeyCondition, private readonly right: BaseKeyCondition) {
        super();
      }

      public renderCondition(): string {
        return `${this.left.renderCondition()} AND ${this.right.renderCondition()}`;
      }

      public keyNames(): string[] {
        return concatAndDedup(this.left.keyNames(), this.right.keyNames());
      }

      public args(): string[] {
        return concatAndDedup(this.left.args(), this.right.args());
      }
    })(this, cond);
  }

  public renderExpressionNames(): string {
    return this.keyNames()
      .map((keyName: string) => {
        return `"#${keyName}" : "${keyName}"`;
      })
      .join(', ');
  }

  public renderExpressionValues(): string {
    return this.args()
      .map((arg: string) => {
        return `":${arg}" : $util.dynamodb.toDynamoDBJson($ctx.args.${arg})`;
      })
      .join(', ');
  }

  public abstract renderCondition(): string;
  public abstract keyNames(): string[];
  public abstract args(): string[];
}

/**
 * Utility class to represent DynamoDB "begins_with" key conditions.
 */
export class BeginsWith extends BaseKeyCondition {
  constructor(private readonly keyName: string, private readonly arg: string) {
    super();
  }

  public renderCondition(): string {
    return `begins_with(#${this.keyName}, :${this.arg})`;
  }

  public keyNames(): string[] {
    return [this.keyName];
  }

  public args(): string[] {
    return [this.arg];
  }
}

/**
 * Utility class to represent DynamoDB binary key conditions.
 */
export class BinaryCondition extends BaseKeyCondition {
  constructor(private readonly keyName: string, private readonly op: string, private readonly arg: string) {
    super();
  }

  public renderCondition(): string {
    return `#${this.keyName} ${this.op} :${this.arg}`;
  }

  public keyNames(): string[] {
    return [this.keyName];
  }

  public args(): string[] {
    return [this.arg];
  }
}

/**
 * Utility class to represent DynamoDB "between" key conditions.
 */
export class Between extends BaseKeyCondition {
  constructor(private readonly keyName: string, private readonly arg1: string, private readonly arg2: string) {
    super();
  }

  public renderCondition(): string {
    return `#${this.keyName} BETWEEN :${this.arg1} AND :${this.arg2}`;
  }

  public keyNames(): string[] {
    return [this.keyName];
  }

  public args(): string[] {
    return [this.arg1, this.arg2];
  }
}

function concatAndDedup<T>(left: T[], right: T[]): T[] {
  return left.concat(right).filter((elem, index, self) => {
    return index === self.indexOf(elem);
  });
}
