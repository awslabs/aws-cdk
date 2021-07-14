import { IBucket } from '@aws-cdk/aws-s3';
import { CfnGraphQLSchema } from './appsync.generated';
import { GraphqlApi } from './graphqlapi';
import { AssetSchema, CodeSchema, S3Schema } from './private/schema-implementation';
import { IIntermediateType } from './schema-base';
import { ResolvableField } from './schema-field';
import { ObjectType } from './schema-intermediate';

/**
 * The Schema for a GraphQL Api
 *
 * If no options are configured, schema will be generated
 * code-first.
 */
export abstract class Schema {
  /**
   * Generate a Schema from file
   *
   * @returns `Schema` with immutable schema defintion
   * @param filePath the file path of the schema file
   */
  public static fromAsset(filePath: string): Schema {
    return new AssetSchema(filePath);
  }

  /**
   * Point GraphQL Schema to a S3 Location
   *
   * @returns `Schema` with immutable schema defintion
   * @param bucket the s3 bucket that holds the GraphQL Schema
   * @param key the object key for the schema
   */
  public static fromBucket(bucket: IBucket, key: string): Schema {
    return new S3Schema(bucket, key);
  }

  /**
   * Generate a Schema that can be edited through a code-first
   * approach
   *
   * @returns `Schema` with mutable schema defintion
   */
  public static fromCode(): Schema {
    return new CodeSchema();
  }

  /**
   * The definition for this schema
   */
  public readonly abstract definition: string;

  /**
   * Called when the GraphQL Api is initialized to allow this object to bind
   * to the stack.
   */
  public abstract bind(api: GraphqlApi): CfnGraphQLSchema;

  /**
   * Escape hatch to add to Schema as desired. Will always result
   * in a newline.
   */
  public abstract addToSchema(addition: string, delimiter?: string): void;
  /**
   * Add a query field to the schema's Query. CDK will create an
   * Object Type called 'Query'. For example,
   *
   * type Query {
   *   fieldName: Field.returnType
   * }
   */
  public abstract addQuery(fieldName: string, field: ResolvableField): ObjectType;

  /**
   * Add a mutation field to the schema's Mutation. CDK will create an
   * Object Type called 'Mutation'. For example,
   *
   * type Mutation {
   *   fieldName: Field.returnType
   * }
   */
  public abstract addMutation(_fieldName: string, _field: ResolvableField): ObjectType;

  /**
   * Add a subscription field to the schema's Subscription. CDK will create an
   * Object Type called 'Subscription'. For example,
   *
   * type Subscription {
   *   fieldName: Field.returnType
   * }
   */
  public abstract addSubscription(_fieldName: string, _field: ResolvableField): ObjectType;

  /**
   * Add type to the schema
   */
  public abstract addType(_type: IIntermediateType): IIntermediateType;
}