import * as appscaling from '@aws-cdk/aws-applicationautoscaling';
import { CfnCustomResource, CustomResource } from '@aws-cdk/aws-cloudformation';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import * as perms from './perms';
import { Aws, CfnCondition, Construct, Fn, IResource, Lazy, RemovalPolicy, Resource, Stack, Token } from '@aws-cdk/core';
import { CfnTable } from './dynamodb.generated';
import { ReplicaProvider } from './replica-provider';
import { EnableScalingProps, IScalableTableAttribute } from './scalable-attribute-api';
import { ScalableTableAttribute } from './scalable-table-attribute';

const HASH_KEY_TYPE = 'HASH';
const RANGE_KEY_TYPE = 'RANGE';

// https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Limits.html#limits-secondary-indexes
const MAX_LOCAL_SECONDARY_INDEX_COUNT = 5;

export enum TableEncryption {
  /**
   * Server-side KMS encryption with a customer master key managed by customer.
   * If `encryptionKey` is specified, this key will be used, otherwise, one will be defined.
   */
  CUSTOMER_MANAGED = 'CUSTOMER_MANAGED',
  /**
   * Server-side KMS encryption with a master key managed by AWS.
   */
  AWS_MANAGED = 'AWS_MANAGED',
  /**
   * Server-side KMS encryption with a master key owned by AWS.
   */
  DEFAULT = 'AWS_OWNED'
}

export interface Attribute {
  /**
   * The name of an attribute.
   */
  readonly name: string;

  /**
   * The data type of an attribute.
   */
  readonly type: AttributeType;
}

export interface TableOptions {
  /**
   * Partition key attribute definition.
   */
  readonly partitionKey: Attribute;

  /**
   * Table sort key attribute definition.
   *
   * @default no sort key
   */
  readonly sortKey?: Attribute;

  /**
   * The read capacity for the table. Careful if you add Global Secondary Indexes, as
   * those will share the table's provisioned throughput.
   *
   * Can only be provided if billingMode is Provisioned.
   *
   * @default 5
   */
  readonly readCapacity?: number;
  /**
   * The write capacity for the table. Careful if you add Global Secondary Indexes, as
   * those will share the table's provisioned throughput.
   *
   * Can only be provided if billingMode is Provisioned.
   *
   * @default 5
   */
  readonly writeCapacity?: number;

  /**
   * Specify how you are charged for read and write throughput and how you manage capacity.
   *
   * @default PROVISIONED if `replicationRegions` is not specified, PAY_PER_REQUEST otherwise
   */
  readonly billingMode?: BillingMode;

  /**
   * Whether point-in-time recovery is enabled.
   * @default - point-in-time recovery is disabled
   */
  readonly pointInTimeRecovery?: boolean;

  /**
   * Whether server-side encryption with an AWS managed customer master key is enabled.
   * @default - server-side encryption is enabled with an AWS owned customer master key
   * 
   * @deprecated - This property is deprecated, use encryption instead
   */
  readonly serverSideEncryption?: boolean;

  /**
   * Whether server-side encryption with an AWS managed customer master key is enabled.
   * @default - server-side encryption is enabled with an AWS owned customer master key
   * 
   */
  readonly encryption?: TableEncryption;

  /**
   * The name of TTL attribute.
   * @default - TTL is disabled
   */
  readonly timeToLiveAttribute?: string;

  /**
   * When an item in the table is modified, StreamViewType determines what information
   * is written to the stream for this table.
   *
   * @default - streams are disabled unless `replicationRegions` is specified
   */
  readonly stream?: StreamViewType;

  /**
   * The removal policy to apply to the DynamoDB Table.
   *
   * @default RemovalPolicy.RETAIN
   */
  readonly removalPolicy?: RemovalPolicy;

  /**
   * Regions where replica tables will be created
   *
   * @default - no replica tables are created
   * @experimental
   */
  readonly replicationRegions?: string[];

  /**
   * External KMS key to use for table encryption.
   *
   * @default - If encryption is set to "Customer managed" and this property is undefined,
   * a new KMS key will be created and associated with this table.
   */
  readonly encryptionKey?: kms.IKey;
}

export interface TableProps extends TableOptions {
  /**
   * Enforces a particular physical table name.
   * @default <generated>
   */
  readonly tableName?: string;
}

export interface SecondaryIndexProps {
  /**
   * The name of the secondary index.
   */
  readonly indexName: string;

  /**
   * The set of attributes that are projected into the secondary index.
   * @default ALL
   */
  readonly projectionType?: ProjectionType;

  /**
   * The non-key attributes that are projected into the secondary index.
   * @default - No additional attributes
   */
  readonly nonKeyAttributes?: string[];
}

export interface GlobalSecondaryIndexProps extends SecondaryIndexProps {
  /**
   * The attribute of a partition key for the global secondary index.
   */
  readonly partitionKey: Attribute;

  /**
   * The attribute of a sort key for the global secondary index.
   * @default - No sort key
   */
  readonly sortKey?: Attribute;

  /**
   * The read capacity for the global secondary index.
   *
   * Can only be provided if table billingMode is Provisioned or undefined.
   *
   * @default 5
   */
  readonly readCapacity?: number;

  /**
   * The write capacity for the global secondary index.
   *
   * Can only be provided if table billingMode is Provisioned or undefined.
   *
   * @default 5
   */
  readonly writeCapacity?: number;
}

export interface LocalSecondaryIndexProps extends SecondaryIndexProps {
  /**
   * The attribute of a sort key for the local secondary index.
   */
  readonly sortKey: Attribute;
}

/**
 * An interface that represents a DynamoDB Table - either created with the CDK, or an existing one.
 */
export interface ITable extends IResource {
  /**
   * Arn of the dynamodb table.
   *
   * @attribute
   */
  readonly tableArn: string;

  /**
   * Table name of the dynamodb table.
   *
   * @attribute
   */
  readonly tableName: string;

  /**
   * ARN of the table's stream, if there is one.
   *
   * @attribute
   */
  readonly tableStreamArn?: string;

  /**
   * 
   * Optional KMS encryption key associated with this table.
   */
  readonly encryptionKey?: kms.IKey;

  /**
   * Returns an ARN that represents all objects within the table that match
   * the key pattern specified. To represent all keys, specify ``"*"``.
   */
  arnForObjects(keyPattern: string): string;

  /**
   * Permits an IAM principal all data read operations from this table:
   * BatchGetItem, GetRecords, GetShardIterator, Query, GetItem, Scan.
   * 
   * If an encryption key is used, permission to use the key for
   * encrypt/decrypt will also be granted
   * 
   * @param grantee The principal to grant access to
   * @param objectsKeyPattern Restrict the permission to a certain key pattern (default '*')
   */
  grantReadData(grantee: iam.IGrantable, objectsKeyPattern?: any): iam.Grant;

  /**
   * Permits an IAM Principal to list streams attached to current dynamodb table.
   *
   * @param grantee The principal (no-op if undefined)
   */
  grantTableListStreams(grantee: iam.IGrantable): iam.Grant;

  /**
   * Permits an IAM principal all stream data read operations for this
   * table's stream:
   * DescribeStream, GetRecords, GetShardIterator, ListStreams.
   * 
   * If an encryption key is used, permission to use the key for
   * encrypt/decrypt will also be granted
   * 
   * @param grantee The principal to grant access to
   * @param objectsKeyPattern Restrict the permission to a certain key pattern (default '*')
   */
  grantStreamRead(grantee: iam.IGrantable, objectsKeyPattern?: any): iam.Grant;

  /**
   * Permits an IAM principal all data write operations to this table:
   * BatchWriteItem, PutItem, UpdateItem, DeleteItem.
   * 
   * If an encryption key is used, permission to use the key for
   * encrypt/decrypt will also be granted
   * 
   * @param grantee The principal to grant access to
   * @param objectsKeyPattern Restrict the permission to a certain key pattern (default '*')
   */
  grantWriteData(grantee: iam.IGrantable, objectsKeyPattern?: any): iam.Grant;

  /**
   * Permits an IAM principal to all data read/write operations to this table.
   * BatchGetItem, GetRecords, GetShardIterator, Query, GetItem, Scan,
   * BatchWriteItem, PutItem, UpdateItem, DeleteItem
   * 
   * If an encryption key is used, permission to use the key for
   * encrypt/decrypt will also be granted
   * 
   * @param grantee The principal to grant access to
   * @param objectsKeyPattern Restrict the permission to a certain key pattern (default '*')
   */
  grantReadWriteData(grantee: iam.IGrantable, objectsKeyPattern?: any): iam.Grant;

  /**
   * Metric for the number of Errors executing all Lambdas
   */
  metric(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric;

  /**
   * Metric for the consumed read capacity units
   *
   * @param props properties of a metric
   */
  metricConsumedReadCapacityUnits(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

  /**
   * Metric for the consumed write capacity units
   *
   * @param props properties of a metric
   */
  metricConsumedWriteCapacityUnits(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

  /**
   * Metric for the system errors
   *
   * @param props properties of a metric
   */
  metricSystemErrors(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

  /**
   * Metric for the user errors
   *
   * @param props properties of a metric
   */
  metricUserErrors(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

  /**
   * Metric for the conditional check failed requests
   *
   * @param props properties of a metric
   */
  metricConditionalCheckFailedRequests(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

  /**
   * Metric for the successful request latency
   *
   * @param props properties of a metric
   */
  metricSuccessfulRequestLatency(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
}

/**
 * Reference to a dynamodb table.
 */
export interface TableAttributes {
  /**
   * The ARN of the dynamodb table.
   * One of this, or {@link tabeName}, is required.
   *
   * @default - no table arn
   */
  readonly tableArn?: string;

  /**
   * The table name of the dynamodb table.
   * One of this, or {@link tabeArn}, is required.
   *
   * @default - no table name
   */
  readonly tableName?: string;

  /**
   * The ARN of the table's stream.
   *
   * @default - no table stream
   */
  readonly tableStreamArn?: string;

  /**
   * KMS encryption key, if this queue is server-side encrypted by a KMS key.
   */
  readonly keyArn?: string;
}

abstract class TableBase extends Resource implements ITable {
  /**
   * @attribute
   */
  public abstract readonly tableArn: string;

  /**
   * @attribute
   */
  public abstract readonly tableName: string;

  /**
   * @attribute
   */
  public abstract readonly tableStreamArn?: string;

  /**
   * Optional KMS encryption key associated with this table.
   */
  public abstract readonly encryptionKey?: kms.IKey;

  /**
   * Returns an ARN that represents all objects within the table that match
   * the key pattern specified. To represent all keys, specify ``"*"``.
   *
   * If you specify multiple components for keyPattern, they will be concatenated::
   *
   *   arnForObjects('home/', team, '/', user, '/*')
   *
   */
  public arnForObjects(keyPattern: string): string {
    return `${this.tableArn}/${keyPattern}`;
  }

  /**
   * Adds an IAM policy statement associated with this table to an IAM
   * principal's policy.
   * @param grantee The principal (no-op if undefined)
   * @param tableActions The set of actions to allow (i.e. "dynamodb:PutItem", "dynamodb:GetItem", ...)
   * @param keyActions The set of actions to allow (i.e. "kms:Encrypt", "kms:Decrypt", ...)
   * @param otherResourceArns 
   */
  public grant(grantee: iam.IGrantable, tableActions: string[], keyActions?: string[], ...otherResourceArns: string[]) {
    const resources = [this.tableArn, Lazy.stringValue({ produce: () => this.hasIndex ? `${this.tableArn}/index/*` : Aws.NO_VALUE }), ...otherResourceArns];
    const ret = iam.Grant.addToPrincipal({
      grantee,
      actions: tableActions,
      resourceArns: resources,
      scope: this
    });
    if (this.encryptionKey && keyActions) {
      this.encryptionKey.grant(grantee, ...keyActions);
    }
    return ret;
  }

  /**
   * Adds an IAM policy statement associated with this table's stream to an
   * IAM principal's policy.
   * @param grantee The principal (no-op if undefined)
   * @param streamActions The set of actions to allow (i.e. "dynamodb:DescribeStream", "dynamodb:GetRecords", ...)
   * @param keyActions The set of actions to allow (i.e. "kms:Encrypt", "kms:Decrypt", ...)
   * @param otherResourceArns
   */
  public grantStream(grantee: iam.IGrantable, streamActions: string[], keyActions?: string[], ...otherResourceArns: string[]) {
    if (!this.tableStreamArn) {
      throw new Error(`DynamoDB Streams must be enabled on the table ${this.node.path}`);
    }
    const resources = [ this.tableStreamArn, ...otherResourceArns];
    const ret = iam.Grant.addToPrincipal({
      grantee,
      actions: streamActions,
      resourceArns: resources,
      scope: this
    });
    if (this.encryptionKey && keyActions) {
      this.encryptionKey.grant(grantee, ...keyActions);
    }
    return ret;
  }

  /**
   * Permits an IAM principal all data read operations from this table:
   * BatchGetItem, GetRecords, GetShardIterator, Query, GetItem, Scan.
   * 
   * If an encryption key is used, permission to use the key for
   * encrypt/decrypt will also be granted.
   * @param grantee The principal to grant access to
   * @param objectsKeyPattern Restrict the permission to a certain key pattern (default '*')
   */
  public grantReadData(grantee: iam.IGrantable, objectsKeyPattern: any = '*'): iam.Grant {
    return this.grant(grantee, perms.READ_DATA_ACTIONS, perms.KEY_READ_ACTIONS, this.arnForObjects(objectsKeyPattern));
  }

  /**
   * Permits an IAM Principal to list streams attached to current dynamodb table.
   *
   * @param grantee The principal (no-op if undefined)
   */
  public grantTableListStreams(grantee: iam.IGrantable): iam.Grant {
    if (!this.tableStreamArn) {
      throw new Error(`DynamoDB Streams must be enabled on the table ${this.node.path}`);
    }
    return iam.Grant.addToPrincipal({
      grantee,
      actions: ['dynamodb:ListStreams'],
      resourceArns: [
        Lazy.stringValue({ produce: () => `${this.tableArn}/stream/*` }),
      ],
    });
  }

  /**
   * Permits an IAM principal all stream data read operations for this
   * table's stream:
   * DescribeStream, GetRecords, GetShardIterator, ListStreams.
   * 
   * If an encryption key is used, permission to use the key for
   * encrypt/decrypt will also be granted.
   * 
   * @param grantee The principal to grant access to
   * @param objectsKeyPattern Restrict the permission to a certain key pattern (default '*')
   */
  public grantStreamRead(grantee: iam.IGrantable, objectsKeyPattern: any = '*'): iam.Grant {
    this.grantTableListStreams(grantee);
    return this.grantStream(grantee, perms.READ_STREAM_DATA_ACTIONS, perms.KEY_READ_ACTIONS, this.arnForObjects(objectsKeyPattern));
  }

  /**
   * Permits an IAM principal all data write operations to this table:
   * BatchWriteItem, PutItem, UpdateItem, DeleteItem.
   * 
   * If an encryption key is used, permission to use the key for
   * encrypt/decrypt will also be granted.
   * 
   * @param grantee The principal to grant access to
   * @param objectsKeyPattern Restrict the permission to a certain key pattern (default '*')
   */
  public grantWriteData(grantee: iam.IGrantable, objectsKeyPattern: any = '*'): iam.Grant {
    return this.grant(grantee, perms.WRITE_DATA_ACTIONS, perms.KEY_WRITE_ACTIONS, this.arnForObjects(objectsKeyPattern));
  }

  /**
   * Permits an IAM principal to all data read/write operations to this table.
   * BatchGetItem, GetRecords, GetShardIterator, Query, GetItem, Scan,
   * BatchWriteItem, PutItem, UpdateItem, DeleteItem
   * 
   * If an encryption key is used, permission to use the key for
   * encrypt/decrypt will also be granted.
   * 
   * @param grantee The principal to grant access to
   * @param objectsKeyPattern Restrict the permission to a certain key pattern (default '*')
   */
  public grantReadWriteData(grantee: iam.IGrantable, objectsKeyPattern: any = '*'): iam.Grant {
    const tableActions = perms.READ_DATA_ACTIONS.concat(perms.WRITE_DATA_ACTIONS);
    const keyActions = perms.KEY_READ_ACTIONS.concat(perms.KEY_WRITE_ACTIONS);
    return this.grant(grantee, tableActions, keyActions, this.arnForObjects(objectsKeyPattern));
  }

  /**
   * Permits all DynamoDB operations ("dynamodb:*") to an IAM principal.
   * 
   * If an encryption key is used, permission to use the key for
   * encrypt/decrypt will also be granted.
   * 
   * 
   * @param grantee The principal to grant access to
   * @param objectsKeyPattern Restrict the permission to a certain key pattern (default '*')
   */
  public grantFullAccess(grantee: iam.IGrantable, objectsKeyPattern: any = '*') {
    const keyActions = perms.KEY_READ_ACTIONS.concat(perms.KEY_WRITE_ACTIONS);
    return this.grant(grantee, ['dynamodb:*'], keyActions, this.arnForObjects(objectsKeyPattern));
  }

  /**
   * Return the given named metric for this Table
   */
  public metric(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return new cloudwatch.Metric({
      namespace: 'AWS/DynamoDB',
      metricName,
      dimensions: {
        TableName: this.tableName,
      },
      ...props,
    });
  }

  /**
   * Metric for the consumed read capacity units this table
   *
   * @default sum over a minute
   */
  public metricConsumedReadCapacityUnits(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.metric('ConsumedReadCapacityUnits', { statistic: 'sum', ...props});
  }

  /**
   * Metric for the consumed write capacity units this table
   *
   * @default sum over a minute
   */
  public metricConsumedWriteCapacityUnits(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.metric('ConsumedWriteCapacityUnits', { statistic: 'sum', ...props});
  }

  /**
   * Metric for the system errors this table
   *
   * @default sum over a minute
   */
  public metricSystemErrors(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.metric('SystemErrors', { statistic: 'sum', ...props});
  }

  /**
   * Metric for the user errors this table
   *
   * @default sum over a minute
   */
  public metricUserErrors(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.metric('UserErrors', { statistic: 'sum', ...props});
  }

  /**
   * Metric for the conditional check failed requests this table
   *
   * @default sum over a minute
   */
  public metricConditionalCheckFailedRequests(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.metric('ConditionalCheckFailedRequests', { statistic: 'sum', ...props});
  }

  /**
   * Metric for the successful request latency this table
   *
   * @default avg over a minute
   */
  public metricSuccessfulRequestLatency(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.metric('SuccessfulRequestLatency', { statistic: 'avg', ...props});
  }

  protected abstract get hasIndex(): boolean;
}

/**
 * Provides a DynamoDB table.
 */
export class Table extends TableBase {
  public encryptionKey?: kms.IKey | undefined;
  /**
   * Permits an IAM Principal to list all DynamoDB Streams.
   * @deprecated Use {@link #grantTableListStreams} for more granular permission
   * @param grantee The principal (no-op if undefined)
   */
  public static grantListStreams(grantee: iam.IGrantable): iam.Grant {
    return iam.Grant.addToPrincipal({
      grantee,
      actions: ['dynamodb:ListStreams'],
      resourceArns: ['*'],
    });
  }

  /**
   * Creates a Table construct that represents an external table via table name.
   *
   * @param scope The parent creating construct (usually `this`).
   * @param id The construct's name.
   * @param tableName The table's name.
   */
  public static fromTableName(scope: Construct, id: string, tableName: string): ITable {
    return Table.fromTableAttributes(scope, id, { tableName });
  }

  /**
   * Creates a Table construct that represents an external table via table arn.
   *
   * @param scope The parent creating construct (usually `this`).
   * @param id The construct's name.
   * @param tableArn The table's ARN.
   */
  public static fromTableArn(scope: Construct, id: string, tableArn: string): ITable {
    return Table.fromTableAttributes(scope, id, { tableArn });
  }

  /**
   * Creates a Table construct that represents an external table.
   *
   * @param scope The parent creating construct (usually `this`).
   * @param id The construct's name.
   * @param attrs A `TableAttributes` object.
   */
  public static fromTableAttributes(scope: Construct, id: string, attrs: TableAttributes): ITable {

    class Import extends TableBase {

      public readonly tableName: string;
      public readonly tableArn: string;
      public readonly tableStreamArn?: string;
      public readonly encryptionKey: kms.IKey | undefined;

      constructor(_tableArn: string, tableName: string, tableStreamArn?: string) {
        super(scope, id);
        this.tableArn = _tableArn;
        this.tableName = tableName;
        this.tableStreamArn = tableStreamArn;
        this.encryptionKey = attrs.keyArn ? kms.Key.fromKeyArn(this, 'Key', attrs.keyArn): undefined
      }

      protected get hasIndex(): boolean {
        return false;
      }
    }

    let name: string;
    let arn: string;
    const stack = Stack.of(scope);
    if (!attrs.tableName) {
      if (!attrs.tableArn) { throw new Error('One of tableName or tableArn is required!'); }

      arn = attrs.tableArn;
      const maybeTableName = stack.parseArn(attrs.tableArn).resourceName;
      if (!maybeTableName) { throw new Error('ARN for DynamoDB table must be in the form: ...'); }
      name = maybeTableName;
    } else {
      if (attrs.tableArn) { throw new Error('Only one of tableArn or tableName can be provided'); }
      name = attrs.tableName;
      arn = stack.formatArn({
        service: 'dynamodb',
        resource: 'table',
        resourceName: attrs.tableName,
      });
    }

    return new Import(arn, name, attrs.tableStreamArn);
  }

  /**
   * @attribute
   */
  public readonly tableArn: string;

  /**
   * @attribute
   */
  public readonly tableName: string;

  /**
   * @attribute
   */
  public readonly tableStreamArn: string | undefined;

  private readonly table: CfnTable;

  private readonly keySchema = new Array<CfnTable.KeySchemaProperty>();
  private readonly attributeDefinitions = new Array<CfnTable.AttributeDefinitionProperty>();
  private readonly globalSecondaryIndexes = new Array<CfnTable.GlobalSecondaryIndexProperty>();
  private readonly localSecondaryIndexes = new Array<CfnTable.LocalSecondaryIndexProperty>();

  private readonly secondaryIndexNames = new Set<string>();
  private readonly nonKeyAttributes = new Set<string>();

  private readonly tablePartitionKey: Attribute;
  private readonly tableSortKey?: Attribute;

  private readonly billingMode: BillingMode;
  private readonly tableScaling: ScalableAttributePair = {};
  private readonly indexScaling = new Map<string, ScalableAttributePair>();
  private readonly scalingRole: iam.IRole;
  

  constructor(scope: Construct, id: string, props: TableProps) {
    super(scope, id, {
      physicalName: props.tableName,
    });


    const { sseSpecification, encryptionKey } = this.parseEncryption(props);

    this.billingMode = props.billingMode || BillingMode.PROVISIONED;
    this.validateProvisioning(props);

    let streamSpecification: CfnTable.StreamSpecificationProperty | undefined;
    if (props.replicationRegions) {
      if (props.stream && props.stream !== StreamViewType.NEW_AND_OLD_IMAGES) {
        throw new Error('`stream` must be set to `NEW_AND_OLD_IMAGES` when specifying `replicationRegions`');
      }
      streamSpecification = { streamViewType: StreamViewType.NEW_AND_OLD_IMAGES };

      if (props.billingMode && props.billingMode !== BillingMode.PAY_PER_REQUEST) {
        throw new Error('The `PAY_PER_REQUEST` billing mode must be used when specifying `replicationRegions`');
      }
      this.billingMode = BillingMode.PAY_PER_REQUEST;
    } else if (props.stream) {
      streamSpecification = { streamViewType : props.stream };
    }

    this.table = new CfnTable(this, 'Resource', {
      tableName: this.physicalName,
      keySchema: this.keySchema,
      attributeDefinitions: this.attributeDefinitions,
      globalSecondaryIndexes: Lazy.anyValue({ produce: () => this.globalSecondaryIndexes }, { omitEmptyArray: true }),
      localSecondaryIndexes: Lazy.anyValue({ produce: () => this.localSecondaryIndexes }, { omitEmptyArray: true }),
      pointInTimeRecoverySpecification: props.pointInTimeRecovery ? { pointInTimeRecoveryEnabled: props.pointInTimeRecovery } : undefined,
      billingMode: this.billingMode === BillingMode.PAY_PER_REQUEST ? this.billingMode : undefined,
      provisionedThroughput: this.billingMode === BillingMode.PAY_PER_REQUEST ? undefined : {
        readCapacityUnits: props.readCapacity || 5,
        writeCapacityUnits: props.writeCapacity || 5,
      },
      sseSpecification,
      streamSpecification,
      timeToLiveSpecification: props.timeToLiveAttribute ? { attributeName: props.timeToLiveAttribute, enabled: true } : undefined,
    });
    this.table.applyRemovalPolicy(props.removalPolicy);

    this.encryptionKey = encryptionKey;

    if (props.tableName) { this.node.addMetadata('aws:cdk:hasPhysicalName', props.tableName); }

    this.tableArn = this.getResourceArnAttribute(this.table.attrArn, {
      service: 'dynamodb',
      resource: 'table',
      resourceName: this.physicalName,
    });
    this.tableName = this.getResourceNameAttribute(this.table.ref);

    this.tableStreamArn = streamSpecification ? this.table.attrStreamArn : undefined;

    this.scalingRole = this.makeScalingRole();

    this.addKey(props.partitionKey, HASH_KEY_TYPE);
    this.tablePartitionKey = props.partitionKey;

    if (props.sortKey) {
      this.addKey(props.sortKey, RANGE_KEY_TYPE);
      this.tableSortKey = props.sortKey;
    }

    if (props.replicationRegions) {
      this.createReplicaTables(props.replicationRegions);
    }
  }

  /**
   * Add a global secondary index of table.
   *
   * @param props the property of global secondary index
   */
  public addGlobalSecondaryIndex(props: GlobalSecondaryIndexProps) {
    this.validateProvisioning(props);
    this.validateIndexName(props.indexName);

    // build key schema and projection for index
    const gsiKeySchema = this.buildIndexKeySchema(props.partitionKey, props.sortKey);
    const gsiProjection = this.buildIndexProjection(props);

    this.secondaryIndexNames.add(props.indexName);
    this.globalSecondaryIndexes.push({
      indexName: props.indexName,
      keySchema: gsiKeySchema,
      projection: gsiProjection,
      provisionedThroughput: this.billingMode === BillingMode.PAY_PER_REQUEST ? undefined : {
        readCapacityUnits: props.readCapacity || 5,
        writeCapacityUnits: props.writeCapacity || 5,
      },
    });

    this.indexScaling.set(props.indexName, {});
  }

  /**
   * Add a local secondary index of table.
   *
   * @param props the property of local secondary index
   */
  public addLocalSecondaryIndex(props: LocalSecondaryIndexProps) {
    // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Limits.html#limits-secondary-indexes
    if (this.localSecondaryIndexes.length >= MAX_LOCAL_SECONDARY_INDEX_COUNT) {
      throw new RangeError(`a maximum number of local secondary index per table is ${MAX_LOCAL_SECONDARY_INDEX_COUNT}`);
    }

    this.validateIndexName(props.indexName);

    // build key schema and projection for index
    const lsiKeySchema = this.buildIndexKeySchema(this.tablePartitionKey, props.sortKey);
    const lsiProjection = this.buildIndexProjection(props);

    this.secondaryIndexNames.add(props.indexName);
    this.localSecondaryIndexes.push({
      indexName: props.indexName,
      keySchema: lsiKeySchema,
      projection: lsiProjection,
    });
  }

  /**
   * Enable read capacity scaling for this table
   *
   * @returns An object to configure additional AutoScaling settings
   */
  public autoScaleReadCapacity(props: EnableScalingProps): IScalableTableAttribute {
    if (this.tableScaling.scalableReadAttribute) {
      throw new Error('Read AutoScaling already enabled for this table');
    }
    if (this.billingMode === BillingMode.PAY_PER_REQUEST) {
      throw new Error('AutoScaling is not available for tables with PAY_PER_REQUEST billing mode');
    }

    return this.tableScaling.scalableReadAttribute = new ScalableTableAttribute(this, 'ReadScaling', {
      serviceNamespace: appscaling.ServiceNamespace.DYNAMODB,
      resourceId: `table/${this.tableName}`,
      dimension: 'dynamodb:table:ReadCapacityUnits',
      role: this.scalingRole,
      ...props,
    });
  }

  /**
   * Enable write capacity scaling for this table
   *
   * @returns An object to configure additional AutoScaling settings for this attribute
   */
  public autoScaleWriteCapacity(props: EnableScalingProps): IScalableTableAttribute {
    if (this.tableScaling.scalableWriteAttribute) {
      throw new Error('Write AutoScaling already enabled for this table');
    }
    if (this.billingMode === BillingMode.PAY_PER_REQUEST) {
      throw new Error('AutoScaling is not available for tables with PAY_PER_REQUEST billing mode');
    }

    return this.tableScaling.scalableWriteAttribute = new ScalableTableAttribute(this, 'WriteScaling', {
      serviceNamespace: appscaling.ServiceNamespace.DYNAMODB,
      resourceId: `table/${this.tableName}`,
      dimension: 'dynamodb:table:WriteCapacityUnits',
      role: this.scalingRole,
      ...props,
    });
  }

  /**
   * Enable read capacity scaling for the given GSI
   *
   * @returns An object to configure additional AutoScaling settings for this attribute
   */
  public autoScaleGlobalSecondaryIndexReadCapacity(indexName: string, props: EnableScalingProps): IScalableTableAttribute {
    if (this.billingMode === BillingMode.PAY_PER_REQUEST) {
      throw new Error('AutoScaling is not available for tables with PAY_PER_REQUEST billing mode');
    }
    const attributePair = this.indexScaling.get(indexName);
    if (!attributePair) {
      throw new Error(`No global secondary index with name ${indexName}`);
    }
    if (attributePair.scalableReadAttribute) {
      throw new Error('Read AutoScaling already enabled for this index');
    }

    return attributePair.scalableReadAttribute = new ScalableTableAttribute(this, `${indexName}ReadScaling`, {
      serviceNamespace: appscaling.ServiceNamespace.DYNAMODB,
      resourceId: `table/${this.tableName}/index/${indexName}`,
      dimension: 'dynamodb:index:ReadCapacityUnits',
      role: this.scalingRole,
      ...props,
    });
  }

  /**
   * Enable write capacity scaling for the given GSI
   *
   * @returns An object to configure additional AutoScaling settings for this attribute
   */
  public autoScaleGlobalSecondaryIndexWriteCapacity(indexName: string, props: EnableScalingProps): IScalableTableAttribute {
    if (this.billingMode === BillingMode.PAY_PER_REQUEST) {
      throw new Error('AutoScaling is not available for tables with PAY_PER_REQUEST billing mode');
    }
    const attributePair = this.indexScaling.get(indexName);
    if (!attributePair) {
      throw new Error(`No global secondary index with name ${indexName}`);
    }
    if (attributePair.scalableWriteAttribute) {
      throw new Error('Write AutoScaling already enabled for this index');
    }

    return attributePair.scalableWriteAttribute = new ScalableTableAttribute(this, `${indexName}WriteScaling`, {
      serviceNamespace: appscaling.ServiceNamespace.DYNAMODB,
      resourceId: `table/${this.tableName}/index/${indexName}`,
      dimension: 'dynamodb:index:WriteCapacityUnits',
      role: this.scalingRole,
      ...props,
    });
  }

  /**
   * Validate the table construct.
   *
   * @returns an array of validation error message
   */
  protected validate(): string[] {
    const errors = new Array<string>();

    if (!this.tablePartitionKey) {
      errors.push('a partition key must be specified');
    }
    if (this.localSecondaryIndexes.length > 0 && !this.tableSortKey) {
      errors.push('a sort key of the table must be specified to add local secondary indexes');
    }

    return errors;
  }

  /**
   * Validate read and write capacity are not specified for on-demand tables (billing mode PAY_PER_REQUEST).
   *
   * @param props read and write capacity properties
   */
  private validateProvisioning(props: { readCapacity?: number, writeCapacity?: number }): void {
    if (this.billingMode === BillingMode.PAY_PER_REQUEST) {
      if (props.readCapacity !== undefined || props.writeCapacity !== undefined) {
        throw new Error('you cannot provision read and write capacity for a table with PAY_PER_REQUEST billing mode');
      }
    }
  }

  /**
   * Validate index name to check if a duplicate name already exists.
   *
   * @param indexName a name of global or local secondary index
   */
  private validateIndexName(indexName: string) {
    if (this.secondaryIndexNames.has(indexName)) {
      // a duplicate index name causes validation exception, status code 400, while trying to create CFN stack
      throw new Error(`a duplicate index name, ${indexName}, is not allowed`);
    }
    this.secondaryIndexNames.add(indexName);
  }

  /**
   * Validate non-key attributes by checking limits within secondary index, which may vary in future.
   *
   * @param nonKeyAttributes a list of non-key attribute names
   */
  private validateNonKeyAttributes(nonKeyAttributes: string[]) {
    if (this.nonKeyAttributes.size + nonKeyAttributes.length > 20) {
      // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Limits.html#limits-secondary-indexes
      throw new RangeError('a maximum number of nonKeyAttributes across all of secondary indexes is 20');
    }

    // store all non-key attributes
    nonKeyAttributes.forEach(att => this.nonKeyAttributes.add(att));
  }

  private buildIndexKeySchema(partitionKey: Attribute, sortKey?: Attribute): CfnTable.KeySchemaProperty[] {
    this.registerAttribute(partitionKey);
    const indexKeySchema: CfnTable.KeySchemaProperty[] = [
      { attributeName: partitionKey.name, keyType: HASH_KEY_TYPE },
    ];

    if (sortKey) {
      this.registerAttribute(sortKey);
      indexKeySchema.push({ attributeName: sortKey.name, keyType: RANGE_KEY_TYPE });
    }

    return indexKeySchema;
  }

  private buildIndexProjection(props: SecondaryIndexProps): CfnTable.ProjectionProperty {
    if (props.projectionType === ProjectionType.INCLUDE && !props.nonKeyAttributes) {
      // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-dynamodb-projectionobject.html
      throw new Error(`non-key attributes should be specified when using ${ProjectionType.INCLUDE} projection type`);
    }

    if (props.projectionType !== ProjectionType.INCLUDE && props.nonKeyAttributes) {
      // this combination causes validation exception, status code 400, while trying to create CFN stack
      throw new Error(`non-key attributes should not be specified when not using ${ProjectionType.INCLUDE} projection type`);
    }

    if (props.nonKeyAttributes) {
      this.validateNonKeyAttributes(props.nonKeyAttributes);
    }

    return {
      projectionType: props.projectionType ? props.projectionType : ProjectionType.ALL,
      nonKeyAttributes: props.nonKeyAttributes ? props.nonKeyAttributes : undefined,
    };
  }

  private findKey(keyType: string) {
    return this.keySchema.find(prop => prop.keyType === keyType);
  }

  private addKey(attribute: Attribute, keyType: string) {
    const existingProp = this.findKey(keyType);
    if (existingProp) {
      throw new Error(`Unable to set ${attribute.name} as a ${keyType} key, because ${existingProp.attributeName} is a ${keyType} key`);
    }
    this.registerAttribute(attribute);
    this.keySchema.push({
      attributeName: attribute.name,
      keyType,
    });
    return this;
  }

  /**
   * Register the key attribute of table or secondary index to assemble attribute definitions of TableResourceProps.
   *
   * @param attribute the key attribute of table or secondary index
   */
  private registerAttribute(attribute: Attribute) {
    const { name, type } = attribute;
    const existingDef = this.attributeDefinitions.find(def => def.attributeName === name);
    if (existingDef && existingDef.attributeType !== type) {
      throw new Error(`Unable to specify ${name} as ${type} because it was already defined as ${existingDef.attributeType}`);
    }
    if (!existingDef) {
      this.attributeDefinitions.push({
        attributeName: name,
        attributeType: type,
      });
    }
  }

  /**
   * Return the role that will be used for AutoScaling
   */
  private makeScalingRole(): iam.IRole {
    // Use a Service Linked Role.
    // https://docs.aws.amazon.com/autoscaling/application/userguide/application-auto-scaling-service-linked-roles.html
    return iam.Role.fromRoleArn(this, 'ScalingRole', Stack.of(this).formatArn({
      service: 'iam',
      region: '',
      resource: 'role/aws-service-role/dynamodb.application-autoscaling.amazonaws.com',
      resourceName: 'AWSServiceRoleForApplicationAutoScaling_DynamoDBTable',
    }));
  }

  /**
   * Creates replica tables
   *
   * @param regions regions where to create tables
   */
  private createReplicaTables(regions: string[]) {
    const stack = Stack.of(this);

    if (!Token.isUnresolved(stack.region) && regions.includes(stack.region)) {
      throw new Error('`replicationRegions` cannot include the region where this stack is deployed.');
    }

    const provider = ReplicaProvider.getOrCreate(this);

    // Documentation at https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/V2gt_IAM.html
    // is currently incorrect. AWS Support recommends `dynamodb:*` in both source and destination regions

    // Permissions in the source region
    this.grant(provider.onEventHandler, ['dynamodb:*']);
    this.grant(provider.isCompleteHandler, ['dynamodb:DescribeTable']);

    // Permissions in the destination regions
    provider.onEventHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:*'],
      resources: regions.map(region => stack.formatArn({
        region,
        service: 'dynamodb',
        resource: 'table',
        resourceName: this.tableName,
      })),
    }));

    let previousRegion;
    for (const region of new Set(regions)) { // Remove duplicates
      // Use multiple custom resources because multiple create/delete
      // updates cannot be combined in a single API call.
      const currentRegion = new CustomResource(this, `Replica${region}`, {
        provider: provider.provider,
        resourceType: 'Custom::DynamoDBReplica',
        properties: {
          TableName: this.tableName,
          Region: region,
        },
      });

      // Deploy time check to prevent from creating a replica in the region
      // where this stack is deployed. Only needed for environment agnostic
      // stacks.
      if (Token.isUnresolved(stack.region)) {
        const createReplica = new CfnCondition(this, `StackRegionNotEquals${region}`, {
          expression: Fn.conditionNot(Fn.conditionEquals(region, Aws.REGION)),
        });
        const cfnCustomResource = currentRegion.node.defaultChild as CfnCustomResource;
        cfnCustomResource.cfnOptions.condition = createReplica;
      }

      // We need to create/delete regions sequentially because we cannot
      // have multiple table updates at the same time. The `isCompleteHandler`
      // of the provider waits until the replica is an ACTIVE state.
      if (previousRegion) {
        currentRegion.node.addDependency(previousRegion);
      }
      previousRegion = currentRegion;
    }
  }
  /**
   * Set up key properties and return the Table encryption property from the
   * user's configuration.
   */
  private parseEncryption(props:TableProps): {sseSpecification: CfnTable.SSESpecificationProperty, encryptionKey?: kms.IKey} {
    let encryptionType = props.encryption;

    if (encryptionType !== undefined && props.serverSideEncryption) {
      throw new Error(`Both encryption and serverSideEncryption is specified, only either field can be set, not both`);
    }
    
    if (encryptionType === undefined) {
      encryptionType = props.encryptionKey ? TableEncryption.CUSTOMER_MANAGED : TableEncryption.DEFAULT;
    }

    if (props.serverSideEncryption && props.encryptionKey) {
      throw new Error(`encryptionKey cannot be specified for serverSideEncryption, use encryption instead`);
    }
    
    if (encryptionType !== TableEncryption.CUSTOMER_MANAGED && props.encryptionKey) {
      throw new Error(`encryptionKey is specified, so 'encryption' must be set to Customer_Managed`);
    }

    if (encryptionType === TableEncryption.CUSTOMER_MANAGED) {
      const encryptionKey = props.encryptionKey || new kms.Key(this, 'Key', {
          description: `Created by ${this.node.path}`,
          enableKeyRotation: true
      });

      return { sseSpecification: {sseEnabled: true, kmsMasterKeyId: encryptionKey.keyArn, sseType: 'KMS'}, encryptionKey };
    }

    if (encryptionType === TableEncryption.AWS_MANAGED || props.serverSideEncryption) {
      return { sseSpecification: {sseEnabled: true, sseType: 'KMS'} };
    }
    if (encryptionType === TableEncryption.DEFAULT) {
      return { sseSpecification: {sseEnabled: false} };
    }
    throw new Error(`Unexpected 'encryptionType': ${encryptionType}`);
  }

  /**
   * Whether this table has indexes
   */
  protected get hasIndex(): boolean {
    return this.globalSecondaryIndexes.length + this.localSecondaryIndexes.length > 0;
  }
}

export enum AttributeType {
  /** Up to 400KiB of binary data (which must be encoded as base64 before sending to DynamoDB) */
  BINARY = 'B',
  /** Numeric values made of up to 38 digits (positive, negative or zero) */
  NUMBER = 'N',
  /** Up to 400KiB of UTF-8 encoded text */
  STRING = 'S',
}

/**
 * DyanmoDB's Read/Write capacity modes.
 */
export enum BillingMode {
  /**
   * Pay only for what you use. You don't configure Read/Write capacity units.
   */
  PAY_PER_REQUEST = 'PAY_PER_REQUEST',
  /**
   * Explicitly specified Read/Write capacity units.
   */
  PROVISIONED = 'PROVISIONED',
}

export enum ProjectionType {
  /** Only the index and primary keys are projected into the index. */
  KEYS_ONLY = 'KEYS_ONLY',
  /** Only the specified table attributes are projected into the index. The list of projected attributes is in `nonKeyAttributes`. */
  INCLUDE = 'INCLUDE',
  /** All of the table attributes are projected into the index. */
  ALL = 'ALL'
}

/**
 * When an item in the table is modified, StreamViewType determines what information
 * is written to the stream for this table.
 *
 * @see https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_StreamSpecification.html
 */
export enum StreamViewType {
  /** The entire item, as it appears after it was modified, is written to the stream. */
  NEW_IMAGE = 'NEW_IMAGE',
  /** The entire item, as it appeared before it was modified, is written to the stream. */
  OLD_IMAGE = 'OLD_IMAGE',
  /** Both the new and the old item images of the item are written to the stream. */
  NEW_AND_OLD_IMAGES = 'NEW_AND_OLD_IMAGES',
  /** Only the key attributes of the modified item are written to the stream. */
  KEYS_ONLY = 'KEYS_ONLY'
}

/**
 * Just a convenient way to keep track of both attributes
 */
interface ScalableAttributePair {
  scalableReadAttribute?: ScalableTableAttribute;
  scalableWriteAttribute?: ScalableTableAttribute;
}
