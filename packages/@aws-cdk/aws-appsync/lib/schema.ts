import { AssetSchemaImpl, CodeSchemaImpl, SchemaImpl, S3SchemaImpl } from './private/schema-implementation';
import { S3Location } from './schema-utils';

/**
 * The Schema for a GraphQL Api
 *
 * If no options are configured, schema will be generated
 * code-first.
 */
export abstract class Schema extends SchemaImpl {
  /**
   * Generate a Schema from file
   *
   * @returns `Schema` with immutable schema defintion
   * @param filePath the file path of the schema file
   */
  public static fromAsset(filePath: string): Schema {
    return new AssetSchemaImpl(filePath);
  }

  /**
   * Point GraphQL Schema to a S3 Location
   *
   * @returns `Schema` with immutable schema defintion
   * @param s3Location the s3 location of the schema
   */
  public static fromS3Location(s3Location: S3Location): Schema {
    return new S3SchemaImpl(s3Location);
  }

  /**
   * Generate a Schema that can be edited through a code-first
   * approach
   *
   * @returns `Schema` with mutable schema defintion
   */
  public static fromCode(): Schema {
    return new CodeSchemaImpl();
  }
}