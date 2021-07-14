import { readFileSync } from 'fs';
import { IBucket } from '@aws-cdk/aws-s3';
import { Lazy } from '@aws-cdk/core';
import { CfnGraphQLSchema } from '../appsync.generated';
import { GraphqlApi } from '../graphqlapi';
import { shapeAddition } from '../private/schema-shape-addition';
import { Schema } from '../schema';
import { IIntermediateType } from '../schema-base';
import { ResolvableField } from '../schema-field';
import { ObjectType } from '../schema-intermediate';

/**
 * Utility enum for Schema class
 */
enum SchemaMode {
  FILE = 'FILE',
  CODE = 'CODE',
  S3 = 'S3',
};

export class SchemaImpl implements Schema {

  /**
   * The definition for this schema
   */
  public readonly definition: string;

  /**
    * The underlying CFN GraphQL Schema Resource. This
    * resource is created on `bind` which allows the Schema
    * to be created outside the CDK (a feature that works well
    * with the code-first approach).
    *
    * @internal
    */
  protected _schema!: CfnGraphQLSchema;

  /**
    * The SchemaMode utilized by the Schema Implementation
    *
    * @internal
    */
  protected _mode: SchemaMode;

  public constructor() {
    this.definition = '';
    this._mode = SchemaMode.FILE;
  }

  /**
    * Called when the GraphQL Api is initialized to allow this object to bind
    * to the stack.
    */
  public bind(api: GraphqlApi): CfnGraphQLSchema {
    if (!this._schema) {
      this._schema = new CfnGraphQLSchema(api, 'Schema', {
        apiId: api.apiId,
        definition: this.definition,
      });
    }
    return this._schema;
  }

  /**
    * Escape hatch to add to Schema as desired. Will always result
    * in a newline.
    */
  public addToSchema(_addition: string, _delimiter?: string): void {
    throw new Error('API cannot append to schema because schema definition mode is not configured as CODE.');
  }

  /**
    * Add a query field to the schema's Query. CDK will create an
    * Object Type called 'Query'. For example,
    *
    * type Query {
    *   fieldName: Field.returnType
    * }
    */
  public addQuery(_fieldName: string, _field: ResolvableField): ObjectType {
    throw new Error(`Unable to add query. Schema definition mode must be ${SchemaMode.CODE}. Received: ${this._mode}`);
  }

  /**
    * Add a mutation field to the schema's Mutation. CDK will create an
    * Object Type called 'Mutation'. For example,
    *
    * type Mutation {
    *   fieldName: Field.returnType
    * }
    */
  public addMutation(_fieldName: string, _field: ResolvableField): ObjectType {
    throw new Error(`Unable to add mutation. Schema definition mode must be ${SchemaMode.CODE}. Received: ${this._mode}`);
  }

  /**
    * Add a subscription field to the schema's Subscription. CDK will create an
    * Object Type called 'Subscription'. For example,
    *
    * type Subscription {
    *   fieldName: Field.returnType
    * }
    */
  public addSubscription(_fieldName: string, _field: ResolvableField): ObjectType {
    throw new Error(`Unable to add subscription. Schema definition mode must be ${SchemaMode.CODE}. Received: ${this._mode}`);
  }

  /**
    * Add type to the schema
    */
  public addType(_type: IIntermediateType): IIntermediateType {
    throw new Error('API cannot add type because schema definition mode is not configured as CODE.');
  }
}

/**
 * Schema Implementation for a Schema generated through an Asset
 */
export class AssetSchema extends SchemaImpl {
  /**
   * The definition for this schema
   */
  public readonly definition: string;

  public constructor(filePath: string) {
    super();
    this.definition = readFileSync(filePath).toString('utf-8');
  }

  public bind(api: GraphqlApi): CfnGraphQLSchema {
    if (!this._schema) {
      this._schema = new CfnGraphQLSchema(api, 'Schema', {
        apiId: api.apiId,
        definition: this.definition,
      });
    }
    return this._schema;
  }
}

/**
 * Schema Implementation for a Schema generated through S3
 */
export class S3Schema extends SchemaImpl {
  /**
   * The Bucket that holds the GraphQL Schema
   */
  private bucket: IBucket;

  /**
   * The object key for this bucket
   */
  private key: string;

  public constructor(bucket: IBucket, key: string) {
    super();
    this.bucket = bucket;
    this.key = key;
    this._mode = SchemaMode.S3;
  }

  public bind(api: GraphqlApi): CfnGraphQLSchema {
    if (!this._schema) {
      this._schema = new CfnGraphQLSchema(api, 'Schema', {
        apiId: api.apiId,
        definitionS3Location: this.bucket.s3UrlForObject(this.key),
      });
    }
    return this._schema;
  }
}

/**
 * Schema Implementation for a Schema generated through Code-First
 */
export class CodeSchema extends SchemaImpl {
  /**
   * The definition for this schema
   */
  public definition: string;

  private query?: ObjectType;

  private mutation?: ObjectType;

  private subscription?: ObjectType;

  private types: IIntermediateType[];

  public constructor() {
    super();
    this.definition = '';
    this.types = [];
    this._mode = SchemaMode.CODE;
  }

  /**
   * Called when the GraphQL Api is initialized to allow this object to bind
   * to the stack.
   *
   * @param api The binding GraphQL Api
   */
  public bind(api: GraphqlApi): CfnGraphQLSchema {
    if (!this._schema) {
      this._schema = new CfnGraphQLSchema(api, 'Schema', {
        apiId: api.apiId,
        definition: Lazy.string({
          produce: () => this.types.reduce((acc, type) => { return `${acc}${type._bindToGraphqlApi(api).toString()}\n`; },
            `${this.declareSchema()}${this.definition}`),
        }),
      });
    }
    return this._schema;
  }

  /**
   * Escape hatch to add to Schema as desired. Will always result
   * in a newline.
   *
   * @param addition the addition to add to schema
   * @param delimiter the delimiter between schema and addition
   * @default - ''
   *
   */
  public addToSchema(addition: string, delimiter?: string): void {
    const sep = delimiter ?? '';
    this.definition = `${this.definition}${sep}${addition}\n`;
  }

  /**
   * Add a query field to the schema's Query. CDK will create an
   * Object Type called 'Query'. For example,
   *
   * type Query {
   *   fieldName: Field.returnType
   * }
   *
   * @param fieldName the name of the query
   * @param field the resolvable field to for this query
   */
  public addQuery(fieldName: string, field: ResolvableField): ObjectType {
    if (!this.query) {
      this.query = new ObjectType('Query', { definition: {} });
      this.addType(this.query);
    };
    this.query.addField({ fieldName, field });
    return this.query;
  }

  /**
   * Add a mutation field to the schema's Mutation. CDK will create an
   * Object Type called 'Mutation'. For example,
   *
   * type Mutation {
   *   fieldName: Field.returnType
   * }
   *
   * @param fieldName the name of the Mutation
   * @param field the resolvable field to for this Mutation
   */
  public addMutation(fieldName: string, field: ResolvableField): ObjectType {
    if (!this.mutation) {
      this.mutation = new ObjectType('Mutation', { definition: {} });
      this.addType(this.mutation);
    };
    this.mutation.addField({ fieldName, field });
    return this.mutation;
  }

  /**
   * Add a subscription field to the schema's Subscription. CDK will create an
   * Object Type called 'Subscription'. For example,
   *
   * type Subscription {
   *   fieldName: Field.returnType
   * }
   *
   * @param fieldName the name of the Subscription
   * @param field the resolvable field to for this Subscription
   */
  public addSubscription(fieldName: string, field: ResolvableField): ObjectType {
    if (!this.subscription) {
      this.subscription = new ObjectType('Subscription', { definition: {} });
      this.addType(this.subscription);
    }
    const directives = field.fieldOptions?.directives?.filter((directive) => directive.mutationFields);
    if (directives && directives.length > 1) {
      throw new Error(`Subscription fields must not have more than one @aws_subscribe directives. Received: ${directives.length}`);
    }
    this.subscription.addField({ fieldName, field });
    return this.subscription;
  }

  /**
   * Add type to the schema
   *
   * @param type the intermediate type to add to the schema
   */
  public addType(type: IIntermediateType): IIntermediateType {
    this.types.push(type);
    return type;
  }

  /**
   * Set the root types of this schema if they are defined.
   *
   * For example:
   * schema {
   *   query: Query
   *   mutation: Mutation
   *   subscription: Subscription
   * }
   */
  private declareSchema(): string {
    if (!this.query && !this.mutation && !this.subscription) {
      return '';
    }
    type root = 'mutation' | 'query' | 'subscription';
    const list: root[] = ['query', 'mutation', 'subscription'];
    return shapeAddition({
      prefix: 'schema',
      fields: list.map((key: root) => this[key] ? `${key}: ${this[key]?.name}` : '')
        .filter((field) => field != ''),
    }) + '\n';
  }
}