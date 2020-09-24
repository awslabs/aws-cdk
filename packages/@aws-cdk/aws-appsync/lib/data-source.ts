import { ITable } from '@aws-cdk/aws-dynamodb';
import { IGrantable, IPrincipal, IRole, Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import { IFunction } from '@aws-cdk/aws-lambda';
import { Construct, IResolvable, IConstruct } from '@aws-cdk/core';
import { CfnDataSource } from './appsync.generated';
import { IGraphqlApi } from './graphqlapi-base';
import { BaseResolverProps, Resolver } from './resolver';

/**
 * Base properties for an AppSync datasource
 */
export interface BaseDataSourceProps {
  /**
   * The API to attach this data source to
   */
  readonly api: IGraphqlApi;
  /**
   * The name of the data source
   *
   * @default - id of data source
   */
  readonly name?: string;
  /**
   * the description of the data source
   *
   * @default - None
   */
  readonly description?: string;
}

/**
 * properties for an AppSync datasource backed by a resource
 */
export interface BackedDataSourceProps extends BaseDataSourceProps {
  /**
   * The IAM service role to be assumed by AppSync to interact with the data source
   *
   * @default -  Create a new role
   */
  readonly serviceRole?: IRole;
}

/**
 * Enum containing the possible AppSync Data Source types
 */
export enum DataSourceType {
  /**
   * An AppSync dummy datasource
   */
  NONE = 'NONE',
  /**
   * An AppSync datasource backed by a DynamoDB table
   */
  DYNAMODB = 'AMAZON_DYNAMODB',
  /**
   * An AppSync datasource backed by a http endpoint
   */
  HTTP = 'HTTP',
  /**
   * An AppSync datasource backed by a Lambda function
   */
  LAMBDA = 'AWS_LAMBDA',
}

/**
 * props used by implementations of BaseDataSource to provide configuration. Should not be used directly.
 */
export interface ExtendedDataSourceProps {
  /**
   * the type of the AppSync datasource
   */
  readonly type: DataSourceType;
  /**
   * configuration for DynamoDB Datasource
   *
   * @default - No config
   */
  readonly dynamoDbConfig?: CfnDataSource.DynamoDBConfigProperty | IResolvable;
  /**
   * configuration for Elasticsearch Datasource
   *
   * @default - No config
   */
  readonly elasticsearchConfig?: CfnDataSource.ElasticsearchConfigProperty | IResolvable;
  /**
   * configuration for HTTP Datasource
   *
   * @default - No config
   */
  readonly httpConfig?: CfnDataSource.HttpConfigProperty | IResolvable;
  /**
   * configuration for Lambda Datasource
   *
   * @default - No config
   */
  readonly lambdaConfig?: CfnDataSource.LambdaConfigProperty | IResolvable;
  /**
   * configuration for RDS Datasource
   *
   * @default - No config
   */
  readonly relationalDatabaseConfig?: CfnDataSource.RelationalDatabaseConfigProperty | IResolvable;
}

/**
 * Represents an AppSync data source
 */
export interface IDataSource extends IConstruct {
  /**
   * the name of the data source
   */
  readonly name: string;
  /**
   * the ARN of the data source
   */
  readonly arn: string;
  /**
   * the underlying CFN data source resource
   */
  readonly ds: CfnDataSource;
  /**
   * creates a new resolver for this datasource and API using the given properties
   */
  createResolver(props: BaseResolverProps): Resolver;
}

/**
 * Abstract AppSync datasource implementation.
 *
 * Do not use directly but use subclasses for concrete datasources
 */
export abstract class BaseDataSource extends Construct implements IDataSource {
  /**
   * the name of the data source
   */
  public readonly name: string;
  /**
   * the arn of the data source
   */
  public readonly arn: string;
  /**
   * the underlying CFN data source resource
   */
  public readonly ds: CfnDataSource;

  protected api: IGraphqlApi;
  protected serviceRole?: IRole;

  constructor(scope: Construct, id: string, props: BackedDataSourceProps, extended: ExtendedDataSourceProps) {
    super(scope, id);
    if (extended.type !== 'NONE') {
      this.serviceRole = props.serviceRole ?? new Role(this, 'ServiceRole', { assumedBy: new ServicePrincipal('appsync') });
    }
    const name = props.name ?? id;
    this.ds = new CfnDataSource(this, 'Resource', {
      apiId: props.api.apiId,
      name: name,
      description: props.description,
      serviceRoleArn: this.serviceRole?.roleArn,
      ...extended,
    });
    this.arn = this.ds.attrDataSourceArn;
    this.name = name;
    this.api = props.api;
  }

  /**
   * creates a new resolver for this datasource and API using the given properties
   */
  public createResolver(props: BaseResolverProps): Resolver {
    return new Resolver(this, `${props.typeName}${props.fieldName}Resolver`, {
      api: this.api,
      dataSource: this,
      ...props,
    });
  }
}

/**
 * Abstract AppSync datasource implementation. Do not use directly but use subclasses for resource backed datasources
 */
export abstract class BackedDataSource extends BaseDataSource implements IGrantable {
  /**
   * the principal of the data source to be IGrantable
   */
  public readonly grantPrincipal: IPrincipal;

  constructor(scope: Construct, id: string, props: BackedDataSourceProps, extended: ExtendedDataSourceProps) {
    super(scope, id, props, extended);
    this.grantPrincipal = this.serviceRole!;
  }
}

/**
 * Properties for an AppSync dummy datasource
 */
export interface NoneDataSourceProps extends BaseDataSourceProps { }

/**
 * An AppSync dummy datasource
 */
export class NoneDataSource extends BaseDataSource {
  constructor(scope: Construct, id: string, props: NoneDataSourceProps) {
    super(scope, id, props, {
      type: DataSourceType.NONE,
    });
  }
}

/**
 * Properties for an AppSync DynamoDB datasource
 */
export interface DynamoDbDataSourceProps extends BackedDataSourceProps {
  /**
   * The DynamoDB table backing this data source
   */
  readonly table: ITable;
  /**
   * Specify whether this DS is read only or has read and write permissions to the DynamoDB table
   *
   * @default false
   */
  readonly readOnlyAccess?: boolean;
  /**
   * use credentials of caller to access DynamoDB
   *
   * @default false
   */
  readonly useCallerCredentials?: boolean;
}

/**
 * An AppSync datasource backed by a DynamoDB table
 */
export class DynamoDbDataSource extends BackedDataSource {
  constructor(scope: Construct, id: string, props: DynamoDbDataSourceProps) {
    super(scope, id, props, {
      type: DataSourceType.DYNAMODB,
      dynamoDbConfig: {
        tableName: props.table.tableName,
        awsRegion: props.table.stack.region,
        useCallerCredentials: props.useCallerCredentials,
      },
    });
    if (props.readOnlyAccess) {
      props.table.grantReadData(this);
    } else {
      props.table.grantReadWriteData(this);
    }
  }
}

/**
 * The authorization config in case the HTTP endpoint requires authorization
 */
export interface AwsIamConfig {
  /**
   * The signing region for AWS IAM authorization
   */
  readonly signingRegion: string;

  /**
   * The signing service name for AWS IAM authorization
   */
  readonly signingServiceName: string;
}

/**
 * Properties for an AppSync http datasource
 */
export interface HttpDataSourceProps extends BaseDataSourceProps {
  /**
   * The http endpoint
   */
  readonly endpoint: string;

  /**
   * The authorization config in case the HTTP endpoint requires authorization
   *
   * @default - none
   */
  readonly authorizationConfig?: AwsIamConfig;
}

/**
 * An AppSync datasource backed by a http endpoint
 */
export class HttpDataSource extends BaseDataSource {
  constructor(scope: Construct, id: string, props: HttpDataSourceProps) {
    const authorizationConfig = props.authorizationConfig ? {
      authorizationType: 'AWS_IAM',
      awsIamConfig: props.authorizationConfig,
    } : undefined;
    super(scope, id, props, {
      type: DataSourceType.HTTP,
      httpConfig: {
        endpoint: props.endpoint,
        authorizationConfig,
      },
    });
  }
}

/**
 * Properties for an AppSync Lambda datasource
 */
export interface LambdaDataSourceProps extends BackedDataSourceProps {
  /**
   * The Lambda function to call to interact with this data source
   */
  readonly lambdaFunction: IFunction;
}

/**
 * An AppSync datasource backed by a Lambda function
 */
export class LambdaDataSource extends BackedDataSource {
  constructor(scope: Construct, id: string, props: LambdaDataSourceProps) {
    super(scope, id, props, {
      type: DataSourceType.LAMBDA,
      lambdaConfig: {
        lambdaFunctionArn: props.lambdaFunction.functionArn,
      },
    });
    props.lambdaFunction.grantInvoke(this);
  }
}
