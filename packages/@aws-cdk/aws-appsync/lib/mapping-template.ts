import { readFileSync } from 'fs';
import { AttributeValues, KeyCondition, PrimaryKey } from './key';

/**
 * MappingTemplates for AppSync resolvers
 */
export abstract class MappingTemplate {
  /**
   * Create a mapping template from the given string
   */
  public static fromString(template: string): MappingTemplate {
    return new StringMappingTemplate(template);
  }

  /**
   * Create a mapping template from the given file
   */
  public static fromFile(fileName: string): MappingTemplate {
    return new StringMappingTemplate(readFileSync(fileName).toString('utf-8'));
  }

  /**
   * Mapping template for a result list from DynamoDB
   */
  public static dynamoDbResultList(): MappingTemplate {
    return this.fromString('$util.toJson($ctx.result.items)');
  }

  /**
   * Mapping template for a single result item from DynamoDB
   */
  public static dynamoDbResultItem(): MappingTemplate {
    return this.fromString('$util.toJson($ctx.result)');
  }

  /**
   * Mapping template to scan a DynamoDB table to fetch all entries
   */
  public static dynamoDbScanTable(): MappingTemplate {
    return this.fromString('{"version" : "2017-02-28", "operation" : "Scan"}');
  }

  /**
   * Mapping template to query a set of items from a DynamoDB table
   *
   * @param cond the key condition for the query
   */
  public static dynamoDbQuery(cond: KeyCondition, indexName?: string): MappingTemplate {
    return this.fromString(`{"version" : "2017-02-28", "operation" : "Query", ${indexName ? `"index" : "${indexName}", ` : ''}${cond.renderTemplate()}}`);
  }

  /**
   * Mapping template to get a single item from a DynamoDB table
   *
   * @param keyName the name of the hash key field
   * @param idArg the name of the Query argument
   */
  public static dynamoDbGetItem(keyName: string, idArg: string): MappingTemplate {
    return this.fromString(`{"version": "2017-02-28", "operation": "GetItem", "key": {"${keyName}": $util.dynamodb.toDynamoDBJson($ctx.args.${idArg})}}`);
  }

  /**
   * Mapping template to delete a single item from a DynamoDB table
   *
   * @param keyName the name of the hash key field
   * @param idArg the name of the Mutation argument
   */
  public static dynamoDbDeleteItem(keyName: string, idArg: string): MappingTemplate {
    return this.fromString(`{"version": "2017-02-28", "operation": "DeleteItem", "key": {"${keyName}": $util.dynamodb.toDynamoDBJson($ctx.args.${idArg})}}`);
  }

  /**
   * Mapping template to save a single item to a DynamoDB table
   *
   * @param key the assigment of Mutation values to the primary key
   * @param values the assignment of Mutation values to the table attributes
   */
  public static dynamoDbPutItem(key: PrimaryKey, values: AttributeValues): MappingTemplate {
    return this.fromString(`
      ${values.renderVariables()}
      {
        "version": "2017-02-28",
        "operation": "PutItem",
        ${key.renderTemplate()},
        ${values.renderTemplate()}
      }`);
  }

  /**
   * Mapping template to invoke a Lambda function
   *
   * @param payload the VTL template snippet of the payload to send to the lambda.
   * If no payload is provided all available context fields are sent to the Lambda function
   */
  public static lambdaRequest(payload: string = '$util.toJson($ctx)'): MappingTemplate {
    return this.fromString(`{"version": "2017-02-28", "operation": "Invoke", "payload": ${payload}}`);
  }

  /**
   * Mapping template to return the Lambda result to the caller
   */
  public static lambdaResult(): MappingTemplate {
    return this.fromString('$util.toJson($ctx.result)');
  }

  /**
   * this is called to render the mapping template to a VTL string
   */
  public abstract renderTemplate(): string;
}

class StringMappingTemplate extends MappingTemplate {
  constructor(private readonly template: string) {
    super();
  }

  public renderTemplate() {
    return this.template;
  }
}