import * as appscaling from '@aws-cdk/aws-applicationautoscaling';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import {
  Aws, CfnCondition, CfnCustomResource, CfnResource, CustomResource, Duration,
  Fn, IResource, Lazy, Names, RemovalPolicy, Resource, Stack, Token,
} from '@aws-cdk/core';
import { Construct } from 'constructs';
import { DynamoDBMetrics } from './dynamodb-canned-metrics.generated';
import { CfnTable, CfnTableProps } from './dynamodb.generated';
import * as perms from './perms';
import { ReplicaProvider } from './replica-provider';
import { EnableScalingProps, IScalableTableAttribute } from './scalable-attribute-api';
import { ScalableTableAttribute } from './scalable-table-attribute';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct as CoreConstruct } from '@aws-cdk/core';

const HASH_KEY_TYPE = 'HASH';
const RANGE_KEY_TYPE = 'RANGE';

// https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Limits.html#limits-secondary-indexes
const MAX_LOCAL_SECONDARY_INDEX_COUNT = 5;

/**
 * Options for configuring a system errors metric that considers multiple operations.
 */
export interface SystemErrorsForOperationsMetricOptions extends cloudwatch.MetricOptions {

  /**
   * The operations to apply the metric to.
   *
   * @default - All operations available by DynamoDB tables will be considered.
   */
  readonly operations?: Operation[];

}

/**
 * Supported DynamoDB table operations.
 */
export enum Operation {

  /** GetItem */
  GET_ITEM = 'GetItem',

  /** BatchGetItem */
  BATCH_GET_ITEM = 'BatchGetItem',

  /** Scan */
  SCAN = 'Scan',

  /** Query */
  QUERY = 'Query',

  /** GetRecords */
  GET_RECORDS = 'GetRecords',

  /** PutItem */
  PUT_ITEM = 'PutItem',

  /** DeleteItem */
  DELETE_ITEM = 'DeleteItem',

  /** UpdateItem */
  UPDATE_ITEM = 'UpdateItem',

  /** BatchWriteItem */
  BATCH_WRITE_ITEM = 'BatchWriteItem',

}

/**
 * Represents an attribute for describing the key schema for the table
 * and indexes.
 */
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

/**
 * What kind of server-side encryption to apply to this table.
 */
export enum TableEncryption {
  /**
   * Server-side KMS encryption with a master key owned by AWS.
   */
  DEFAULT = 'AWS_OWNED',

  /**
   * Server-side KMS encryption with a customer master key managed by customer.
   * If `encryptionKey` is specified, this key will be used, otherwise, one will be defined.
   */
  CUSTOMER_MANAGED = 'CUSTOMER_MANAGED',

  /**
   * Server-side KMS encryption with a master key managed by AWS.
   */
  AWS_MANAGED = 'AWS_MANAGED',
}

/**
 * Properties of a DynamoDB Table
 *
 * Use {@link TableProps} for all table properties
 */
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
   *
   * This property cannot be set if `encryption` and/or `encryptionKey` is set.
   *
   * @default - server-side encryption is enabled with an AWS owned customer master key
   *
   * @deprecated This property is deprecated. In order to obtain the same behavior as
   * enabling this, set the `encryption` property to `TableEncryption.AWS_MANAGED` instead.
   */
  readonly serverSideEncryption?: boolean;

  /**
   * Whether server-side encryption with an AWS managed customer master key is enabled.
   *
   * This property cannot be set if `serverSideEncryption` is set.
   *
   * @default - server-side encryption is enabled with an AWS owned customer master key
   */
  readonly encryption?: TableEncryption;

  /**
   * External KMS key to use for table encryption.
   *
   * This property can only be set if `encryption` is set to `TableEncryption.CUSTOMER_MANAGED`.
   *
   * @default - If `encryption` is set to `TableEncryption.CUSTOMER_MANAGED` and this
   * property is undefined, a new KMS key will be created and associated with this table.
   */
  readonly encryptionKey?: kms.IKey;

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
   * The timeout for a table replication operation in a single region.
   *
   * @default Duration.minutes(30)
   */
  readonly replicationTimeout?: Duration;
}

/**
 * Properties for a DynamoDB Table
 */
export interface TableProps extends TableOptions {
  /**
   * Enforces a particular physical table name.
   * @default <generated>
   */
  readonly tableName?: string;
}

/**
 * Properties for a secondary index
 */
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

/**
 * Properties for a global secondary index
 */
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

/**
 * Properties for a local secondary index
 */
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
   * Adds an IAM policy statement associated with this table to an IAM
   * principal's policy.
   *
   * If `encryptionKey` is present, appropriate grants to the key needs to be added
   * separately using the `table.encryptionKey.grant*` methods.
   *
   * @param grantee The principal (no-op if undefined)
   * @param actions The set of actions to allow (i.e. "dynamodb:PutItem", "dynamodb:GetItem", ...)
   */
  grant(grantee: iam.IGrantable, ...actions: string[]): iam.Grant;

  /**
   * Adds an IAM policy statement associated with this table's stream to an
   * IAM principal's policy.
   *
   * If `encryptionKey` is present, appropriate grants to the key needs to be added
   * separately using the `table.encryptionKey.grant*` methods.
   *
   * @param grantee The principal (no-op if undefined)
   * @param actions The set of actions to allow (i.e. "dynamodb:DescribeStream", "dynamodb:GetRecords", ...)
   */
  grantStream(grantee: iam.IGrantable, ...actions: string[]): iam.Grant;

  /**
   * Permits an IAM principal all data read operations from this table:
   * BatchGetItem, GetRecords, GetShardIterator, Query, GetItem, Scan.
   *
   * Appropriate grants will also be added to the customer-managed KMS key
   * if one was configured.
   *
   * @param grantee The principal to grant access to
   */
  grantReadData(grantee: iam.IGrantable): iam.Grant;

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
   * Appropriate grants will also be added to the customer-managed KMS key
   * if one was configured.
   *
   * @param grantee The principal to grant access to
   */
  grantStreamRead(grantee: iam.IGrantable): iam.Grant;

  /**
   * Permits an IAM principal all data write operations to this table:
   * BatchWriteItem, PutItem, UpdateItem, DeleteItem.
   *
   * Appropriate grants will also be added to the customer-managed KMS key
   * if one was configured.
   *
   * @param grantee The principal to grant access to
   */
  grantWriteData(grantee: iam.IGrantable): iam.Grant;

  /**
   * Permits an IAM principal to all data read/write operations to this table.
   * BatchGetItem, GetRecords, GetShardIterator, Query, GetItem, Scan,
   * BatchWriteItem, PutItem, UpdateItem, DeleteItem
   *
   * Appropriate grants will also be added to the customer-managed KMS key
   * if one was configured.
   *
   * @param grantee The principal to grant access to
   */
  grantReadWriteData(grantee: iam.IGrantable): iam.Grant;

  /**
   * Permits all DynamoDB operations ("dynamodb:*") to an IAM principal.
   *
   * Appropriate grants will also be added to the customer-managed KMS key
   * if one was configured.
   *
   * @param grantee The principal to grant access to
   */
  grantFullAccess(grantee: iam.IGrantable): iam.Grant;

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
   *
   * @deprecated use `metricSystemErrorsForOperations`
   */
  metricSystemErrors(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

  /**
   * Metric for the system errors this table
   *
   * @param props properties of a metric
   *
   */
  metricSystemErrorsForOperations(props?: SystemErrorsForOperationsMetricOptions): cloudwatch.IMetric;

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
   * Metric for throttled requests
   *
   * @param props properties of a metric
   *
   */
  metricThrottledRequests(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

  /**
   * Metric for the successful request latency
   *
   * @param props properties of a metric
   *
   */
  metricSuccessfulRequestLatency(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
}

/**
 * Reference to a dynamodb table.
 */
export interface TableAttributes {
  /**
   * The ARN of the dynamodb table.
   * One of this, or {@link tableName}, is required.
   *
   * @default - no table arn
   */
  readonly tableArn?: string;

  /**
   * The table name of the dynamodb table.
   * One of this, or {@link tableArn}, is required.
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
   * KMS encryption key, if this table uses a customer-managed encryption key.
   *
   * @default - no key
   */
  readonly encryptionKey?: kms.IKey;

  /**
   * The name of the global indexes set for this Table.
   * Note that you need to set either this property,
   * or {@link localIndexes},
   * if you want methods like grantReadData()
   * to grant permissions for indexes as well as the table itself.
   *
   * @default - no global indexes
   */
  readonly globalIndexes?: string[];

  /**
   * The name of the local indexes set for this Table.
   * Note that you need to set either this property,
   * or {@link globalIndexes},
   * if you want methods like grantReadData()
   * to grant permissions for indexes as well as the table itself.
   *
   * @default - no local indexes
   */
  readonly localIndexes?: string[];
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
   * KMS encryption key, if this table uses a customer-managed encryption key.
   */
  public abstract readonly encryptionKey?: kms.IKey;

  protected readonly regionalArns = new Array<string>();

  /**
   * Adds an IAM policy statement associated with this table to an IAM
   * principal's policy.
   *
   * If `encryptionKey` is present, appropriate grants to the key needs to be added
   * separately using the `table.encryptionKey.grant*` methods.
   *
   * @param grantee The principal (no-op if undefined)
   * @param actions The set of actions to allow (i.e. "dynamodb:PutItem", "dynamodb:GetItem", ...)
   */
  public grant(grantee: iam.IGrantable, ...actions: string[]): iam.Grant {
    return iam.Grant.addToPrincipal({
      grantee,
      actions,
      resourceArns: [
        this.tableArn,
        Lazy.string({ produce: () => this.hasIndex ? `${this.tableArn}/index/*` : Aws.NO_VALUE }),
        ...this.regionalArns,
        ...this.regionalArns.map(arn => Lazy.string({
          produce: () => this.hasIndex ? `${arn}/index/*` : Aws.NO_VALUE,
        })),
      ],
      scope: this,
    });
  }

  /**
   * Adds an IAM policy statement associated with this table's stream to an
   * IAM principal's policy.
   *
   * If `encryptionKey` is present, appropriate grants to the key needs to be added
   * separately using the `table.encryptionKey.grant*` methods.
   *
   * @param grantee The principal (no-op if undefined)
   * @param actions The set of actions to allow (i.e. "dynamodb:DescribeStream", "dynamodb:GetRecords", ...)
   */
  public grantStream(grantee: iam.IGrantable, ...actions: string[]): iam.Grant {
    if (!this.tableStreamArn) {
      throw new Error(`DynamoDB Streams must be enabled on the table ${this.node.path}`);
    }

    return iam.Grant.addToPrincipal({
      grantee,
      actions,
      resourceArns: [this.tableStreamArn],
      scope: this,
    });
  }

  /**
   * Permits an IAM principal all data read operations from this table:
   * BatchGetItem, GetRecords, GetShardIterator, Query, GetItem, Scan.
   *
   * Appropriate grants will also be added to the customer-managed KMS key
   * if one was configured.
   *
   * @param grantee The principal to grant access to
   */
  public grantReadData(grantee: iam.IGrantable): iam.Grant {
    return this.combinedGrant(grantee, { keyActions: perms.KEY_READ_ACTIONS, tableActions: perms.READ_DATA_ACTIONS });
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
      resourceArns: ['*'],
    });
  }

  /**
   * Permits an IAM principal all stream data read operations for this
   * table's stream:
   * DescribeStream, GetRecords, GetShardIterator, ListStreams.
   *
   * Appropriate grants will also be added to the customer-managed KMS key
   * if one was configured.
   *
   * @param grantee The principal to grant access to
   */
  public grantStreamRead(grantee: iam.IGrantable): iam.Grant {
    this.grantTableListStreams(grantee);
    return this.combinedGrant(grantee, { keyActions: perms.KEY_READ_ACTIONS, streamActions: perms.READ_STREAM_DATA_ACTIONS });
  }

  /**
   * Permits an IAM principal all data write operations to this table:
   * BatchWriteItem, PutItem, UpdateItem, DeleteItem.
   *
   * Appropriate grants will also be added to the customer-managed KMS key
   * if one was configured.
   *
   * @param grantee The principal to grant access to
   */
  public grantWriteData(grantee: iam.IGrantable): iam.Grant {
    return this.combinedGrant(grantee, { keyActions: perms.KEY_WRITE_ACTIONS, tableActions: perms.WRITE_DATA_ACTIONS });
  }

  /**
   * Permits an IAM principal to all data read/write operations to this table.
   * BatchGetItem, GetRecords, GetShardIterator, Query, GetItem, Scan,
   * BatchWriteItem, PutItem, UpdateItem, DeleteItem
   *
   * Appropriate grants will also be added to the customer-managed KMS key
   * if one was configured.
   *
   * @param grantee The principal to grant access to
   */
  public grantReadWriteData(grantee: iam.IGrantable): iam.Grant {
    const tableActions = perms.READ_DATA_ACTIONS.concat(perms.WRITE_DATA_ACTIONS);
    const keyActions = perms.KEY_READ_ACTIONS.concat(perms.KEY_WRITE_ACTIONS);
    return this.combinedGrant(grantee, { keyActions, tableActions });
  }

  /**
   * Permits all DynamoDB operations ("dynamodb:*") to an IAM principal.
   *
   * Appropriate grants will also be added to the customer-managed KMS key
   * if one was configured.
   *
   * @param grantee The principal to grant access to
   */
  public grantFullAccess(grantee: iam.IGrantable) {
    const keyActions = perms.KEY_READ_ACTIONS.concat(perms.KEY_WRITE_ACTIONS);
    return this.combinedGrant(grantee, { keyActions, tableActions: ['dynamodb:*'] });
  }

  /**
   * Return the given named metric for this Table
   *
   * By default, the metric will be calculated as a sum over a period of 5 minutes.
   * You can customize this by using the `statistic` and `period` properties.
   */
  public metric(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return new cloudwatch.Metric({
      namespace: 'AWS/DynamoDB',
      metricName,
      dimensions: {
        TableName: this.tableName,
      },
      ...props,
    }).attachTo(this);
  }

  /**
   * Metric for the consumed read capacity units this table
   *
   * By default, the metric will be calculated as a sum over a period of 5 minutes.
   * You can customize this by using the `statistic` and `period` properties.
   */
  public metricConsumedReadCapacityUnits(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.cannedMetric(DynamoDBMetrics.consumedReadCapacityUnitsSum, props);
  }

  /**
   * Metric for the consumed write capacity units this table
   *
   * By default, the metric will be calculated as a sum over a period of 5 minutes.
   * You can customize this by using the `statistic` and `period` properties.
   */
  public metricConsumedWriteCapacityUnits(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.cannedMetric(DynamoDBMetrics.consumedWriteCapacityUnitsSum, props);
  }

  /**
   * Metric for the system errors this table
   *
   * @deprecated use `metricSystemErrorsForOperations`.
   */
  public metricSystemErrors(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    if (!props?.dimensions?.Operation) {
      // 'Operation' must be passed because its an operational metric.
      throw new Error("'Operation' dimension must be passed for the 'SystemErrors' metric.");
    }

    const dimensions = {
      TableName: this.tableName,
      ...props?.dimensions ?? {},
    };

    return this.metric('SystemErrors', { statistic: 'sum', ...props, dimensions });
  }

  /**
   * Metric for the user errors. Note that this metric reports user errors across all
   * the tables in the account and region the table resides in.
   *
   * By default, the metric will be calculated as a sum over a period of 5 minutes.
   * You can customize this by using the `statistic` and `period` properties.
   */
  public metricUserErrors(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    if (props?.dimensions) {
      throw new Error("'dimensions' is not supported for the 'UserErrors' metric");
    }

    // overriding 'dimensions' here because this metric is an account metric.
    // see 'UserErrors' in https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/metrics-dimensions.html
    return this.metric('UserErrors', { statistic: 'sum', ...props, dimensions: {} });
  }

  /**
   * Metric for the conditional check failed requests this table
   *
   * By default, the metric will be calculated as a sum over a period of 5 minutes.
   * You can customize this by using the `statistic` and `period` properties.
   */
  public metricConditionalCheckFailedRequests(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.metric('ConditionalCheckFailedRequests', { statistic: 'sum', ...props });
  }

  /**
   * How many requests are throttled on this table
   *
   * Default: sum over 5 minutes
   */
  public metricThrottledRequests(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.cannedMetric(DynamoDBMetrics.throttledRequestsSum, props);
  }

  /**
   * Metric for the successful request latency this table.
   *
   * By default, the metric will be calculated as an average over a period of 5 minutes.
   * You can customize this by using the `statistic` and `period` properties.
   */
  public metricSuccessfulRequestLatency(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    if (!props?.dimensions?.Operation) {
      throw new Error("'Operation' dimension must be passed for the 'SuccessfulRequestLatency' metric.");
    }

    const dimensions = {
      TableName: this.tableName,
      Operation: props.dimensions.Operation,
    };

    return new cloudwatch.Metric({
      ...DynamoDBMetrics.successfulRequestLatencyAverage(dimensions),
      ...props,
      dimensions,
    }).attachTo(this);
  }

  /**
   * Metric for the system errors this table.
   *
   * This will sum errors across all possible operations.
   * Note that by default, each individual metric will be calculated as a sum over a period of 5 minutes.
   * You can customize this by using the `statistic` and `period` properties.
   */
  public metricSystemErrorsForOperations(props?: SystemErrorsForOperationsMetricOptions): cloudwatch.IMetric {

    if (props?.dimensions?.Operation) {
      throw new Error("The Operation dimension is not supported. Use the 'operations' property.");
    }

    const operations = props?.operations ?? Object.values(Operation);

    const values = this.createMetricsForOperations('SystemErrors', operations, { statistic: 'sum', ...props });

    const sum = new cloudwatch.MathExpression({
      expression: `${Object.keys(values).join(' + ')}`,
      usingMetrics: { ...values },
      color: props?.color,
      label: 'Sum of errors across all operations',
      period: props?.period,
    });

    return sum;
  }

  /**
   * Create a map of metrics that can be used in a math expression.
   *
   * Using the return value of this function as the `usingMetrics` property in `cloudwatch.MathExpression` allows you to
   * use the keys of this map as metric names inside you expression.
   *
   * @param metricName The metric name.
   * @param operations The list of operations to create metrics for.
   * @param props Properties for the individual metrics.
   * @param metricNameMapper Mapper function to allow controlling the individual metric name per operation.
   */
  private createMetricsForOperations(metricName: string, operations: Operation[],
    props?: cloudwatch.MetricOptions, metricNameMapper?: (op: Operation) => string): Record<string, cloudwatch.IMetric> {

    const metrics: Record<string, cloudwatch.IMetric> = {};

    const mapper = metricNameMapper ?? (op => op.toLowerCase());

    if (props?.dimensions?.Operation) {
      throw new Error('Invalid properties. Operation dimension is not supported when calculating operational metrics');
    }

    for (const operation of operations) {

      const metric = this.metric(metricName, {
        ...props,
        dimensions: {
          TableName: this.tableName,
          Operation: operation,
          ...props?.dimensions,
        },
      });

      const operationMetricName = mapper(operation);
      const firstChar = operationMetricName.charAt(0);

      if (firstChar === firstChar.toUpperCase()) {
        // https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/using-metric-math.html#metric-math-syntax
        throw new Error(`Mapper generated an illegal operation metric name: ${operationMetricName}. Must start with a lowercase letter`);
      }

      metrics[operationMetricName] = metric;
    }

    return metrics;
  }

  protected abstract get hasIndex(): boolean;

  /**
   * Adds an IAM policy statement associated with this table to an IAM
   * principal's policy.
   * @param grantee The principal (no-op if undefined)
   * @param opts Options for keyActions, tableActions and streamActions
   */
  private combinedGrant(
    grantee: iam.IGrantable,
    opts: {keyActions?: string[], tableActions?: string[], streamActions?: string[]},
  ): iam.Grant {
    if (opts.tableActions) {
      const resources = [this.tableArn,
        Lazy.string({ produce: () => this.hasIndex ? `${this.tableArn}/index/*` : Aws.NO_VALUE }),
        ...this.regionalArns,
        ...this.regionalArns.map(arn => Lazy.string({
          produce: () => this.hasIndex ? `${arn}/index/*` : Aws.NO_VALUE,
        }))];
      const ret = iam.Grant.addToPrincipal({
        grantee,
        actions: opts.tableActions,
        resourceArns: resources,
        scope: this,
      });
      if (this.encryptionKey && opts.keyActions) {
        this.encryptionKey.grant(grantee, ...opts.keyActions);
      }
      return ret;
    }
    if (opts.streamActions) {
      if (!this.tableStreamArn) {
        throw new Error(`DynamoDB Streams must be enabled on the table ${this.node.path}`);
      }
      const resources = [this.tableStreamArn];
      const ret = iam.Grant.addToPrincipal({
        grantee,
        actions: opts.streamActions,
        resourceArns: resources,
        scope: this,
      });
      return ret;
    }
    throw new Error(`Unexpected 'action', ${ opts.tableActions || opts.streamActions }`);
  }

  private cannedMetric(
    fn: (dims: { TableName: string }) => cloudwatch.MetricProps,
    props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return new cloudwatch.Metric({
      ...fn({ TableName: this.tableName }),
      ...props,
    }).attachTo(this);
  }
}

/**
 * Provides a DynamoDB table.
 */
export class Table extends TableBase {
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
      public readonly encryptionKey?: kms.IKey;
      protected readonly hasIndex = (attrs.globalIndexes ?? []).length > 0 ||
        (attrs.localIndexes ?? []).length > 0;

      constructor(_tableArn: string, tableName: string, tableStreamArn?: string) {
        super(scope, id);
        this.tableArn = _tableArn;
        this.tableName = tableName;
        this.tableStreamArn = tableStreamArn;
        this.encryptionKey = attrs.encryptionKey;
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

  public readonly encryptionKey?: kms.IKey;

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

  private readonly globalReplicaCustomResources = new Array<CustomResource>();

  constructor(scope: Construct, id: string, props: TableProps) {
    super(scope, id, {
      physicalName: props.tableName,
    });

    const { sseSpecification, encryptionKey } = this.parseEncryption(props);

    let streamSpecification: CfnTable.StreamSpecificationProperty | undefined;
    if (props.replicationRegions) {
      if (props.stream && props.stream !== StreamViewType.NEW_AND_OLD_IMAGES) {
        throw new Error('`stream` must be set to `NEW_AND_OLD_IMAGES` when specifying `replicationRegions`');
      }
      streamSpecification = { streamViewType: StreamViewType.NEW_AND_OLD_IMAGES };

      this.billingMode = props.billingMode ?? BillingMode.PAY_PER_REQUEST;
    } else {
      this.billingMode = props.billingMode ?? BillingMode.PROVISIONED;
      if (props.stream) {
        streamSpecification = { streamViewType: props.stream };
      }
    }
    this.validateProvisioning(props);

    this.table = new CfnTable(this, 'Resource', {
      tableName: this.physicalName,
      keySchema: this.keySchema,
      attributeDefinitions: this.attributeDefinitions,
      globalSecondaryIndexes: Lazy.any({ produce: () => this.globalSecondaryIndexes }, { omitEmptyArray: true }),
      localSecondaryIndexes: Lazy.any({ produce: () => this.localSecondaryIndexes }, { omitEmptyArray: true }),
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

    this.tableArn = this.getResourceArnAttribute(this.table.attrArn, {
      service: 'dynamodb',
      resource: 'table',
      resourceName: this.physicalName,
    });
    this.tableName = this.getResourceNameAttribute(this.table.ref);

    if (props.tableName) { this.node.addMetadata('aws:cdk:hasPhysicalName', this.tableName); }

    this.tableStreamArn = streamSpecification ? this.table.attrStreamArn : undefined;

    this.scalingRole = this.makeScalingRole();

    this.addKey(props.partitionKey, HASH_KEY_TYPE);
    this.tablePartitionKey = props.partitionKey;

    if (props.sortKey) {
      this.addKey(props.sortKey, RANGE_KEY_TYPE);
      this.tableSortKey = props.sortKey;
    }

    if (props.replicationRegions && props.replicationRegions.length > 0) {
      this.createReplicaTables(props.replicationRegions, props.replicationTimeout);
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

    this.tableScaling.scalableWriteAttribute = new ScalableTableAttribute(this, 'WriteScaling', {
      serviceNamespace: appscaling.ServiceNamespace.DYNAMODB,
      resourceId: `table/${this.tableName}`,
      dimension: 'dynamodb:table:WriteCapacityUnits',
      role: this.scalingRole,
      ...props,
    });
    for (const globalReplicaCustomResource of this.globalReplicaCustomResources) {
      globalReplicaCustomResource.node.addDependency(this.tableScaling.scalableWriteAttribute);
    }
    return this.tableScaling.scalableWriteAttribute;
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

    if (this.globalReplicaCustomResources.length > 0 && this.billingMode === BillingMode.PROVISIONED) {
      const writeAutoScaleAttribute = this.tableScaling.scalableWriteAttribute;
      if (!writeAutoScaleAttribute) {
        errors.push('A global Table that uses PROVISIONED as the billing mode needs auto-scaled write capacity. ' +
          'Use the autoScaleWriteCapacity() method to enable it.');
      } else if (!writeAutoScaleAttribute._scalingPolicyCreated) {
        errors.push('A global Table that uses PROVISIONED as the billing mode needs auto-scaled write capacity with a policy. ' +
          'Call one of the scaleOn*() methods of the object returned from autoScaleWriteCapacity()');
      }
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
    if (this.nonKeyAttributes.size + nonKeyAttributes.length > 100) {
      // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Limits.html#limits-secondary-indexes
      throw new RangeError('a maximum number of nonKeyAttributes across all of secondary indexes is 100');
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
      projectionType: props.projectionType ?? ProjectionType.ALL,
      nonKeyAttributes: props.nonKeyAttributes ?? undefined,
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
  private createReplicaTables(regions: string[], timeout?: Duration) {
    const stack = Stack.of(this);

    if (!Token.isUnresolved(stack.region) && regions.includes(stack.region)) {
      throw new Error('`replicationRegions` cannot include the region where this stack is deployed.');
    }

    const provider = ReplicaProvider.getOrCreate(this, { timeout });

    // Documentation at https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/V2gt_IAM.html
    // is currently incorrect. AWS Support recommends `dynamodb:*` in both source and destination regions

    const onEventHandlerPolicy = new SourceTableAttachedPolicy(this, provider.onEventHandler.role!);
    const isCompleteHandlerPolicy = new SourceTableAttachedPolicy(this, provider.isCompleteHandler.role!);

    // Permissions in the source region
    this.grant(onEventHandlerPolicy, 'dynamodb:*');
    this.grant(isCompleteHandlerPolicy, 'dynamodb:DescribeTable');

    let previousRegion: CustomResource | undefined;
    let previousRegionCondition: CfnCondition | undefined;
    for (const region of new Set(regions)) { // Remove duplicates
      // Use multiple custom resources because multiple create/delete
      // updates cannot be combined in a single API call.
      const currentRegion = new CustomResource(this, `Replica${region}`, {
        serviceToken: provider.provider.serviceToken,
        resourceType: 'Custom::DynamoDBReplica',
        properties: {
          TableName: this.tableName,
          Region: region,
        },
      });
      currentRegion.node.addDependency(
        onEventHandlerPolicy.policy,
        isCompleteHandlerPolicy.policy,
      );
      this.globalReplicaCustomResources.push(currentRegion);

      // Deploy time check to prevent from creating a replica in the region
      // where this stack is deployed. Only needed for environment agnostic
      // stacks.
      let createReplica: CfnCondition | undefined;
      if (Token.isUnresolved(stack.region)) {
        createReplica = new CfnCondition(this, `StackRegionNotEquals${region}`, {
          expression: Fn.conditionNot(Fn.conditionEquals(region, Aws.REGION)),
        });
        const cfnCustomResource = currentRegion.node.defaultChild as CfnCustomResource;
        cfnCustomResource.cfnOptions.condition = createReplica;
      }

      // Save regional arns for grantXxx() methods
      this.regionalArns.push(stack.formatArn({
        region,
        service: 'dynamodb',
        resource: 'table',
        resourceName: this.tableName,
      }));

      // We need to create/delete regions sequentially because we cannot
      // have multiple table updates at the same time. The `isCompleteHandler`
      // of the provider waits until the replica is in an ACTIVE state.
      if (previousRegion) {
        if (previousRegionCondition) {
          // we can't simply use a Dependency,
          // because the previousRegion is protected by the "different region" Condition,
          // and you can't have Fn::If in DependsOn.
          // Instead, rely on Ref adding a dependency implicitly!
          const previousRegionCfnResource = previousRegion.node.defaultChild as CfnResource;
          const currentRegionCfnResource = currentRegion.node.defaultChild as CfnResource;
          currentRegionCfnResource.addMetadata('DynamoDbReplicationDependency',
            Fn.conditionIf(previousRegionCondition.logicalId, previousRegionCfnResource.ref, Aws.NO_VALUE));
        } else {
          currentRegion.node.addDependency(previousRegion);
        }
      }

      previousRegion = currentRegion;
      previousRegionCondition = createReplica;
    }

    // Permissions in the destination regions (outside of the loop to
    // minimize statements in the policy)
    onEventHandlerPolicy.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['dynamodb:*'],
      resources: this.regionalArns,
    }));
  }

  /**
   * Whether this table has indexes
   */
  protected get hasIndex(): boolean {
    return this.globalSecondaryIndexes.length + this.localSecondaryIndexes.length > 0;
  }

  /**
   * Set up key properties and return the Table encryption property from the
   * user's configuration.
   */
  private parseEncryption(props: TableProps): { sseSpecification: CfnTableProps['sseSpecification'], encryptionKey?: kms.IKey } {
    let encryptionType = props.encryption;

    if (encryptionType != null && props.serverSideEncryption != null) {
      throw new Error('Only one of encryption and serverSideEncryption can be specified, but both were provided');
    }

    if (props.serverSideEncryption && props.encryptionKey) {
      throw new Error('encryptionKey cannot be specified when serverSideEncryption is specified. Use encryption instead');
    }

    if (encryptionType === undefined) {
      encryptionType = props.encryptionKey != null
        // If there is a configured encryptionKey, the encryption is implicitly CUSTOMER_MANAGED
        ? TableEncryption.CUSTOMER_MANAGED
        // Otherwise, if severSideEncryption is enabled, it's AWS_MANAGED; else undefined (do not set anything)
        : props.serverSideEncryption ? TableEncryption.AWS_MANAGED : undefined;
    }

    if (encryptionType !== TableEncryption.CUSTOMER_MANAGED && props.encryptionKey) {
      throw new Error('`encryptionKey cannot be specified unless encryption is set to TableEncryption.CUSTOMER_MANAGED (it was set to ${encryptionType})`');
    }

    if (encryptionType === TableEncryption.CUSTOMER_MANAGED && props.replicationRegions) {
      throw new Error('TableEncryption.CUSTOMER_MANAGED is not supported by DynamoDB Global Tables (where replicationRegions was set)');
    }

    switch (encryptionType) {
      case TableEncryption.CUSTOMER_MANAGED:
        const encryptionKey = props.encryptionKey ?? new kms.Key(this, 'Key', {
          description: `Customer-managed key auto-created for encrypting DynamoDB table at ${this.node.path}`,
          enableKeyRotation: true,
        });

        return {
          sseSpecification: { sseEnabled: true, kmsMasterKeyId: encryptionKey.keyArn, sseType: 'KMS' },
          encryptionKey,
        };

      case TableEncryption.AWS_MANAGED:
        // Not specifying "sseType: 'KMS'" here because it would cause phony changes to existing stacks.
        return { sseSpecification: { sseEnabled: true } };

      case TableEncryption.DEFAULT:
        return { sseSpecification: { sseEnabled: false } };

      case undefined:
        // Not specifying "sseEnabled: false" here because it would cause phony changes to existing stacks.
        return { sseSpecification: undefined };

      default:
        throw new Error(`Unexpected 'encryptionType': ${encryptionType}`);
    }
  }
}

/**
 * Data types for attributes within a table
 *
 * @see https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.NamingRulesDataTypes.html#HowItWorks.DataTypes
 */
export enum AttributeType {
  /** Up to 400KiB of binary data (which must be encoded as base64 before sending to DynamoDB) */
  BINARY = 'B',
  /** Numeric values made of up to 38 digits (positive, negative or zero) */
  NUMBER = 'N',
  /** Up to 400KiB of UTF-8 encoded text */
  STRING = 'S',
}

/**
 * DynamoDB's Read/Write capacity modes.
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

/**
 * The set of attributes that are projected into the index
 *
 * @see https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Projection.html
 */
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

/**
 * An inline policy that is logically bound to the source table of a DynamoDB Global Tables
 * "cluster". This is here to ensure permissions are removed as part of (and not before) the
 * CleanUp phase of a stack update, when a replica is removed (or the entire "cluster" gets
 * replaced).
 *
 * If statements are added directly to the handler roles (as opposed to in a separate inline
 * policy resource), new permissions are in effect before clean up happens, and so replicas that
 * need to be dropped can no longer be due to lack of permissions.
 */
class SourceTableAttachedPolicy extends CoreConstruct implements iam.IGrantable {
  public readonly grantPrincipal: iam.IPrincipal;
  public readonly policy: iam.IManagedPolicy;

  public constructor(sourceTable: Table, role: iam.IRole) {
    super(sourceTable, `SourceTableAttachedManagedPolicy-${Names.nodeUniqueId(role.node)}`);

    const policy = new iam.ManagedPolicy(this, 'Resource', {
      // A CF update of the description property of a managed policy requires
      // a replacement. Use the table name in the description to force a managed
      // policy replacement when the table name changes. This way we preserve permissions
      // to delete old replicas in case of a table replacement.
      description: `DynamoDB replication managed policy for table ${sourceTable.tableName}`,
      roles: [role],
    });
    this.policy = policy;
    this.grantPrincipal = new SourceTableAttachedPrincipal(role, policy);
  }
}

/**
 * An `IPrincipal` entity that can be used as the target of `grant` calls, used by the
 * `SourceTableAttachedPolicy` class so it can act as an `IGrantable`.
 */
class SourceTableAttachedPrincipal extends iam.PrincipalBase {
  public constructor(private readonly role: iam.IRole, private readonly policy: iam.ManagedPolicy) {
    super();
  }

  public get policyFragment(): iam.PrincipalPolicyFragment {
    return this.role.policyFragment;
  }

  public addToPrincipalPolicy(statement: iam.PolicyStatement): iam.AddToPrincipalPolicyResult {
    this.policy.addStatements(statement);
    return {
      policyDependable: this.policy,
      statementAdded: true,
    };
  }
}
