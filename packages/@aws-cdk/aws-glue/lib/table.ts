import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import * as s3 from '@aws-cdk/aws-s3';
import { Fn, IResource, Resource, Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { DataFormat } from './data-format';
import { IDatabase } from './database';
import { CfnTable } from './glue.generated';
import { Column } from './schema';

export interface ITable extends IResource {
  /**
   * @attribute
   */
  readonly tableArn: string;

  /**
   * @attribute
   */
  readonly tableName: string;
}

/**
 * Encryption options for a Table.
 *
 * @see https://docs.aws.amazon.com/athena/latest/ug/encryption.html
 */
export enum TableEncryption {
  UNENCRYPTED = 'Unencrypted',

  /**
   * Server side encryption (SSE) with an Amazon S3-managed key.
   *
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingServerSideEncryption.html
   */
  S3_MANAGED = 'SSE-S3',

  /**
   * Server-side encryption (SSE) with an AWS KMS key managed by the account owner.
   *
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingKMSEncryption.html
   */
  KMS = 'SSE-KMS',

  /**
   * Server-side encryption (SSE) with an AWS KMS key managed by the KMS service.
   */
  KMS_MANAGED = 'SSE-KMS-MANAGED',

  /**
   * Client-side encryption (CSE) with an AWS KMS key managed by the account owner.
   *
   * @see https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingClientSideEncryption.html
   */
  CLIENT_SIDE_KMS = 'CSE-KMS'
}

export interface TableAttributes {
  readonly tableArn: string;
  readonly tableName: string;
}

export interface TableProps {
  /**
   * Name of the table.
   */
  readonly tableName: string;

  /**
   * Description of the table.
   *
   * @default generated
   */
  readonly description?: string;

  /**
   * Database in which to store the table.
   */
  readonly database: IDatabase;

  /**
   * S3 bucket in which to store data.
   *
   * @default one is created for you
   */
  readonly bucket?: s3.IBucket;

  /**
   * S3 prefix under which table objects are stored.
   *
   * @default - No prefix. The data will be stored under the root of the bucket.
   */
  readonly s3Prefix?: string;

  /**
   * Columns of the table.
   */
  readonly columns: Column[];

  /**
   * Partition columns of the table.
   *
   * @default table is not partitioned
   */
  readonly partitionKeys?: Column[]

  /**
   * Storage type of the table's data.
   */
  readonly dataFormat: DataFormat;

  /**
   * Indicates whether the table's data is compressed or not.
   *
   * @default false
   */
  readonly compressed?: boolean;

  /**
   * The kind of encryption to secure the data with.
   *
   * You can only provide this option if you are not explicitly passing in a bucket.
   *
   * If you choose `SSE-KMS`, you *can* provide an un-managed KMS key with `encryptionKey`.
   * If you choose `CSE-KMS`, you *must* provide an un-managed KMS key with `encryptionKey`.
   *
   * @default Unencrypted
   */
  readonly encryption?: TableEncryption;

  /**
   * External KMS key to use for bucket encryption.
   *
   * The `encryption` property must be `SSE-KMS` or `CSE-KMS`.
   *
   * @default key is managed by KMS.
   */
  readonly encryptionKey?: kms.IKey;

  /**
   * Indicates whether the table data is stored in subdirectories.
   *
   * @default false
   */
  readonly storedAsSubDirectories?: boolean;
}

/**
 * A Glue table.
 */
export class Table extends Resource implements ITable {
  public static fromTableArn(scope: Construct, id: string, tableArn: string): ITable {
    const tableName = Fn.select(1, Fn.split('/', Stack.of(scope).parseArn(tableArn).resourceName!));

    return Table.fromTableAttributes(scope, id, {
      tableArn,
      tableName,
    });
  }

  /**
   * Creates a Table construct that represents an external table.
   *
   * @param scope The scope creating construct (usually `this`).
   * @param id The construct's id.
   * @param attrs Import attributes
   */
  public static fromTableAttributes(scope: Construct, id: string, attrs: TableAttributes): ITable {
    class Import extends Resource implements ITable {
      public readonly tableArn = attrs.tableArn;
      public readonly tableName = attrs.tableName;
    }

    return new Import(scope, id);
  }

  /**
   * Database this table belongs to.
   */
  public readonly database: IDatabase;

  /**
   * Indicates whether the table's data is compressed or not.
   */
  public readonly compressed: boolean;

  /**
   * The type of encryption enabled for the table.
   */
  public readonly encryption: TableEncryption;

  /**
   * The KMS key used to secure the data if `encryption` is set to `CSE-KMS` or `SSE-KMS`. Otherwise, `undefined`.
   */
  public readonly encryptionKey?: kms.IKey;

  /**
   * S3 bucket in which the table's data resides.
   */
  public readonly bucket: s3.IBucket;

  /**
   * S3 Key Prefix under which this table's files are stored in S3.
   */
  public readonly s3Prefix: string;

  /**
   * Name of this table.
   */
  public readonly tableName: string;

  /**
   * ARN of this table.
   */
  public readonly tableArn: string;

  /**
   * Format of this table's data files.
   */
  public readonly dataFormat: DataFormat;

  /**
   * This table's columns.
   */
  public readonly columns: Column[];

  /**
   * This table's partition keys if the table is partitioned.
   */
  public readonly partitionKeys?: Column[];

  constructor(scope: Construct, id: string, props: TableProps) {
    super(scope, id, {
      physicalName: props.tableName,
    });

    this.database = props.database;
    this.dataFormat = props.dataFormat;
    this.s3Prefix = props.s3Prefix ?? '';

    validateSchema(props.columns, props.partitionKeys);
    this.columns = props.columns;
    this.partitionKeys = props.partitionKeys;

    this.compressed = props.compressed ?? false;
    const { bucket, encryption, encryptionKey } = createBucket(this, props);
    this.bucket = bucket;
    this.encryption = encryption;
    this.encryptionKey = encryptionKey;

    const tableResource = new CfnTable(this, 'Table', {
      catalogId: props.database.catalogId,

      databaseName: props.database.databaseName,

      tableInput: {
        name: this.physicalName,
        description: props.description || `${props.tableName} generated by CDK`,

        partitionKeys: renderColumns(props.partitionKeys),

        parameters: {
          classification: props.dataFormat.classificationString?.value,
          has_encrypted_data: this.encryption !== TableEncryption.UNENCRYPTED,
        },
        storageDescriptor: {
          location: `s3://${this.bucket.bucketName}/${this.s3Prefix}`,
          compressed: this.compressed,
          storedAsSubDirectories: props.storedAsSubDirectories ?? false,
          columns: renderColumns(props.columns),
          inputFormat: props.dataFormat.inputFormat.className,
          outputFormat: props.dataFormat.outputFormat.className,
          serdeInfo: {
            serializationLibrary: props.dataFormat.serializationLibrary.className,
          },
        },

        tableType: 'EXTERNAL_TABLE',
      },
    });

    this.tableName = this.getResourceNameAttribute(tableResource.ref);
    this.tableArn = this.stack.formatArn({
      service: 'glue',
      resource: 'table',
      resourceName: `${this.database.databaseName}/${this.tableName}`,
    });
    this.node.defaultChild = tableResource;
  }

  /**
   * Grant read permissions to the table and the underlying data stored in S3 to an IAM principal.
   *
   * @param grantee the principal
   */
  public grantRead(grantee: iam.IGrantable): iam.Grant {
    const ret = this.grant(grantee, readPermissions);
    if (this.encryptionKey && this.encryption === TableEncryption.CLIENT_SIDE_KMS) { this.encryptionKey.grantDecrypt(grantee); }
    this.bucket.grantRead(grantee, this.getS3PrefixForGrant());
    return ret;
  }

  /**
   * Grant write permissions to the table and the underlying data stored in S3 to an IAM principal.
   *
   * @param grantee the principal
   */
  public grantWrite(grantee: iam.IGrantable): iam.Grant {
    const ret = this.grant(grantee, writePermissions);
    if (this.encryptionKey && this.encryption === TableEncryption.CLIENT_SIDE_KMS) { this.encryptionKey.grantEncrypt(grantee); }
    this.bucket.grantWrite(grantee, this.getS3PrefixForGrant());
    return ret;
  }

  /**
   * Grant read and write permissions to the table and the underlying data stored in S3 to an IAM principal.
   *
   * @param grantee the principal
   */
  public grantReadWrite(grantee: iam.IGrantable): iam.Grant {
    const ret = this.grant(grantee, [...readPermissions, ...writePermissions]);
    if (this.encryptionKey && this.encryption === TableEncryption.CLIENT_SIDE_KMS) { this.encryptionKey.grantEncryptDecrypt(grantee); }
    this.bucket.grantReadWrite(grantee, this.getS3PrefixForGrant());
    return ret;
  }

  private grant(grantee: iam.IGrantable, actions: string[]) {
    return iam.Grant.addToPrincipal({
      grantee,
      resourceArns: [this.tableArn],
      actions,
    });
  }

  private getS3PrefixForGrant() {
    return this.s3Prefix + '*';
  }
}

function validateSchema(columns: Column[], partitionKeys?: Column[]): void {
  if (columns.length === 0) {
    throw new Error('you must specify at least one column for the table');
  }
  // Check there is at least one column and no duplicated column names or partition keys.
  const names = new Set<string>();
  (columns.concat(partitionKeys || [])).forEach(column => {
    if (names.has(column.name)) {
      throw new Error(`column names and partition keys must be unique, but \'${column.name}\' is duplicated`);
    }
    names.add(column.name);
  });
}

// map TableEncryption to bucket's SSE configuration (s3.BucketEncryption)
const encryptionMappings = {
  [TableEncryption.S3_MANAGED]: s3.BucketEncryption.S3_MANAGED,
  [TableEncryption.KMS_MANAGED]: s3.BucketEncryption.KMS_MANAGED,
  [TableEncryption.KMS]: s3.BucketEncryption.KMS,
  [TableEncryption.CLIENT_SIDE_KMS]: s3.BucketEncryption.UNENCRYPTED,
  [TableEncryption.UNENCRYPTED]: s3.BucketEncryption.UNENCRYPTED,
};

// create the bucket to store a table's data depending on the `encryption` and `encryptionKey` properties.
function createBucket(table: Table, props: TableProps) {
  const encryption = props.encryption || TableEncryption.UNENCRYPTED;
  let bucket = props.bucket;

  if (bucket && (encryption !== TableEncryption.UNENCRYPTED && encryption !== TableEncryption.CLIENT_SIDE_KMS)) {
    throw new Error('you can not specify encryption settings if you also provide a bucket');
  }

  let encryptionKey: kms.IKey | undefined;
  if (encryption === TableEncryption.CLIENT_SIDE_KMS && props.encryptionKey === undefined) {
    // CSE-KMS should behave the same as SSE-KMS - use the provided key or create one automatically
    // Since Bucket only knows about SSE, we repeat the logic for CSE-KMS at the Table level.
    encryptionKey = new kms.Key(table, 'Key');
  } else {
    encryptionKey = props.encryptionKey;
  }

  // create the bucket if none was provided
  if (!bucket) {
    if (encryption === TableEncryption.CLIENT_SIDE_KMS) {
      bucket = new s3.Bucket(table, 'Bucket');
    } else {
      bucket = new s3.Bucket(table, 'Bucket', {
        encryption: encryptionMappings[encryption],
        encryptionKey,
      });
      encryptionKey = bucket.encryptionKey;
    }
  }

  return {
    bucket,
    encryption,
    encryptionKey,
  };
}

const readPermissions = [
  'glue:BatchDeletePartition',
  'glue:BatchGetPartition',
  'glue:GetPartition',
  'glue:GetPartitions',
  'glue:GetTable',
  'glue:GetTables',
  'glue:GetTableVersion',
  'glue:GetTableVersions',
];

const writePermissions = [
  'glue:BatchCreatePartition',
  'glue:BatchDeletePartition',
  'glue:CreatePartition',
  'glue:DeletePartition',
  'glue:UpdatePartition',
];

function renderColumns(columns?: Array<Column | Column>) {
  if (columns === undefined) {
    return undefined;
  }
  return columns.map(column => {
    return {
      name: column.name,
      type: column.type.inputString,
      comment: column.comment,
    };
  });
}
