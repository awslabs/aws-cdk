# AWS Glue Construct Library
<!--BEGIN STABILITY BANNER-->

---

![cfn-resources: Stable](https://img.shields.io/badge/cfn--resources-stable-success.svg?style=for-the-badge)

> All classes with the `Cfn` prefix in this module ([CFN Resources]) are always stable and safe to use.
>
> [CFN Resources]: https://docs.aws.amazon.com/cdk/latest/guide/constructs.html#constructs_lib

![cdk-constructs: Experimental](https://img.shields.io/badge/cdk--constructs-experimental-important.svg?style=for-the-badge)

> The APIs of higher level constructs in this module are experimental and under active development.
> They are subject to non-backward compatible changes or removal in any future version. These are
> not subject to the [Semantic Versioning](https://semver.org/) model and breaking changes will be
> announced in the release notes. This means that while you may use them, you may need to update
> your source code when upgrading to a newer version of this package.

---

<!--END STABILITY BANNER-->

This module is part of the [AWS Cloud Development Kit](https://github.com/aws/aws-cdk) project.

## Connection

A `Connection` allows Glue jobs, crawlers and development endpoints to access certain types of data stores. For example, to create a network connection to connect to a data source within a VPC:

```ts
new glue.Connection(stack, 'MyConnection', {
  connectionType: glue.ConnectionTypes.NETWORK,
  // The security groups granting AWS Glue inbound access to the data source within the VPC
  securityGroups: [securityGroup],
  // The VPC subnet which contains the data source
  subnet,
});
```

If you need to use a connection type that doesn't exist as a static member on `ConnectionType`, you can instantiate a `ConnectionType` object, e.g: `new glue.ConnectionType('NEW_TYPE')`.

See [Adding a Connection to Your Data Store](https://docs.aws.amazon.com/glue/latest/dg/populate-add-connection.html) and [Connection Structure](https://docs.aws.amazon.com/glue/latest/dg/aws-glue-api-catalog-connections.html#aws-glue-api-catalog-connections-Connection) documentation for more information on the supported data stores and their configurations.

## Database

A `Database` is a logical grouping of `Tables` in the Glue Catalog.

```ts
new glue.Database(stack, 'MyDatabase', {
  databaseName: 'my_database'
});
```

## SecurityConfiguration

A `SecurityConfiguration` is a set of security properties that can be used by AWS Glue to encrypt data at rest.

```ts
new glue.SecurityConfiguration(stack, 'MySecurityConfiguration', {
  securityConfigurationName: 'name',
  cloudWatchEncryption: {
    mode: glue.CloudWatchEncryptionMode.KMS,
  },
  jobBookmarksEncryption: {
    mode: glue.JobBookmarksEncryptionMode.CLIENT_SIDE_KMS,
  },
  s3Encryption: {
    mode: glue.S3EncryptionMode.KMS,
  },
});
```

By default, a shared KMS key is created for use with the encryption configurations that require one. You can also supply your own key for each encryption config, for example, for CloudWatch encryption:

```ts
new glue.SecurityConfiguration(stack, 'MySecurityConfiguration', {
  securityConfigurationName: 'name',
  cloudWatchEncryption: {
    mode: glue.CloudWatchEncryptionMode.KMS,
    kmsKey: key,
  },
});
```

See [documentation](https://docs.aws.amazon.com/glue/latest/dg/encryption-security-configuration.html) for more info for Glue encrypting data written by Crawlers, Jobs, and Development Endpoints.


## Table

A Glue table describes a table of data in S3: its structure (column names and types), location of data (S3 objects with a common prefix in a S3 bucket), and format for the files (Json, Avro, Parquet, etc.):

```ts
new glue.Table(stack, 'MyTable', {
  database: myDatabase,
  tableName: 'my_table',
  columns: [{
    name: 'col1',
    type: glue.Schema.STRING,
  }, {
    name: 'col2',
    type: glue.Schema.array(Schema.STRING),
    comment: 'col2 is an array of strings' // comment is optional
  }],
  dataFormat: glue.DataFormat.JSON
});
```

By default, a S3 bucket will be created to store the table's data but you can manually pass the `bucket` and `s3Prefix`:

```ts
new glue.Table(stack, 'MyTable', {
  bucket: myBucket,
  s3Prefix: 'my-table/'
  ...
});
```

By default, an S3 bucket will be created to store the table's data and stored in the bucket root. You can also manually pass the `bucket` and `s3Prefix`:

### Partitions

To improve query performance, a table can specify `partitionKeys` on which data is stored and queried separately. For example, you might partition a table by `year` and `month` to optimize queries based on a time window:

```ts
new glue.Table(stack, 'MyTable', {
  database: myDatabase,
  tableName: 'my_table',
  columns: [{
    name: 'col1',
    type: glue.Schema.STRING
  }],
  partitionKeys: [{
    name: 'year',
    type: glue.Schema.SMALL_INT
  }, {
    name: 'month',
    type: glue.Schema.SMALL_INT
  }],
  dataFormat: glue.DataFormat.JSON
});
```

## [Encryption](https://docs.aws.amazon.com/athena/latest/ug/encryption.html)

You can enable encryption on a Table's data:

* `Unencrypted` - files are not encrypted. The default encryption setting.
* [S3Managed](https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingServerSideEncryption.html) - Server side encryption (`SSE-S3`) with an Amazon S3-managed key.

```ts
new glue.Table(stack, 'MyTable', {
  encryption: glue.TableEncryption.S3_MANAGED
  ...
});
```

* [Kms](https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingKMSEncryption.html) - Server-side encryption (`SSE-KMS`) with an AWS KMS Key managed by the account owner.

```ts
// KMS key is created automatically
new glue.Table(stack, 'MyTable', {
  encryption: glue.TableEncryption.KMS
  ...
});

// with an explicit KMS key
new glue.Table(stack, 'MyTable', {
  encryption: glue.TableEncryption.KMS,
  encryptionKey: new kms.Key(stack, 'MyKey')
  ...
});
```

* [KmsManaged](https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingKMSEncryption.html) - Server-side encryption (`SSE-KMS`), like `Kms`, except with an AWS KMS Key managed by the AWS Key Management Service.

```ts
new glue.Table(stack, 'MyTable', {
  encryption: glue.TableEncryption.KMS_MANAGED
  ...
});
```

* [ClientSideKms](https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingClientSideEncryption.html#client-side-encryption-kms-managed-master-key-intro) - Client-side encryption (`CSE-KMS`) with an AWS KMS Key managed by the account owner.

```ts
// KMS key is created automatically
new glue.Table(stack, 'MyTable', {
  encryption: glue.TableEncryption.CLIENT_SIDE_KMS
  ...
});

// with an explicit KMS key
new glue.Table(stack, 'MyTable', {
  encryption: glue.TableEncryption.CLIENT_SIDE_KMS,
  encryptionKey: new kms.Key(stack, 'MyKey')
  ...
});
```

*Note: you cannot provide a `Bucket` when creating the `Table` if you wish to use server-side encryption (`KMS`, `KMS_MANAGED` or `S3_MANAGED`)*.

## Types

A table's schema is a collection of columns, each of which have a `name` and a `type`. Types are recursive structures, consisting of primitive and complex types:

```ts
new glue.Table(stack, 'MyTable', {
  columns: [{
    name: 'primitive_column',
    type: glue.Schema.STRING
  }, {
    name: 'array_column',
    type: glue.Schema.array(glue.Schema.INTEGER),
    comment: 'array<integer>'
  }, {
    name: 'map_column',
    type: glue.Schema.map(
      glue.Schema.STRING,
      glue.Schema.TIMESTAMP),
    comment: 'map<string,string>'
  }, {
    name: 'struct_column',
    type: glue.Schema.struct([{
      name: 'nested_column',
      type: glue.Schema.DATE,
      comment: 'nested comment'
    }]),
    comment: "struct<nested_column:date COMMENT 'nested comment'>"
  }],
  ...
```

### Primitives

#### Numeric

| Name      	| Type     	| Comments                                                                                                          |
|-----------	|----------	|------------------------------------------------------------------------------------------------------------------	|
| FLOAT     	| Constant 	| A 32-bit single-precision floating point number                                                                   |
| INTEGER   	| Constant 	| A 32-bit signed value in two's complement format, with a minimum value of -2^31 and a maximum value of 2^31-1 	|
| DOUBLE    	| Constant 	| A 64-bit double-precision floating point number                                                                   |
| BIG_INT   	| Constant 	| A 64-bit signed INTEGER in two’s complement format, with a minimum value of -2^63 and a maximum value of 2^63 -1  |
| SMALL_INT 	| Constant 	| A 16-bit signed INTEGER in two’s complement format, with a minimum value of -2^15 and a maximum value of 2^15-1   |
| TINY_INT  	| Constant 	| A 8-bit signed INTEGER in two’s complement format, with a minimum value of -2^7 and a maximum value of 2^7-1      |

#### Date and time

| Name      	| Type     	| Comments                                                                                                                                                                	|
|-----------	|----------	|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------	|
| DATE      	| Constant 	| A date in UNIX format, such as YYYY-MM-DD.                                                                                                                              	|
| TIMESTAMP 	| Constant 	| Date and time instant in the UNiX format, such as yyyy-mm-dd hh:mm:ss[.f...]. For example, TIMESTAMP '2008-09-15 03:04:05.324'. This format uses the session time zone. 	|

#### String

| Name                                       	| Type     	| Comments                                                                                                                                                                                          	|
|--------------------------------------------	|----------	|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------	|
| STRING                                     	| Constant 	| A string literal enclosed in single or double quotes                                                                                                                                              	|
| decimal(precision: number, scale?: number) 	| Function 	| `precision` is the total number of digits. `scale` (optional) is the number of digits in fractional part with a default of 0. For example, use these type definitions: decimal(11,5), decimal(15) 	|
| char(length: number)                       	| Function 	| Fixed length character data, with a specified length between 1 and 255, such as char(10)                                                                                                          	|
| varchar(length: number)                    	| Function 	| Variable length character data, with a specified length between 1 and 65535, such as varchar(10)                                                                                                  	|

#### Miscellaneous

| Name    	| Type     	| Comments                      	|
|---------	|----------	|-------------------------------	|
| BOOLEAN 	| Constant 	| Values are `true` and `false` 	|
| BINARY  	| Constant 	| Value is in binary            	|

### Complex

| Name                                	| Type     	| Comments                                                          	|
|-------------------------------------	|----------	|-------------------------------------------------------------------	|
| array(itemType: Type)               	| Function 	| An array of some other type                                       	|
| map(keyType: Type, valueType: Type) 	| Function 	| A map of some primitive key type to any value type                	|
| struct(collumns: Column[])          	| Function 	| Nested structure containing individually named and typed collumns 	|

## View

A Glue view describes a view that consists of an SQL statement and a column definition as used by a Table. A minimal view definition looks like this:

```ts
new glue.View(stack, "MyView", {
  database: myDatabase,
  tableName: "my_view",
  columns: [{
    name: "x",
    type: glue.Schema.INTEGER
  }],
  statement: "SELECT 1 x"
});
```

### Placeholders in statements

A view's SQL statement may refer to resources like tables which you want to replace at deploy time. Take the following view as an example:

```ts
new glue.View(stack, "MyView", {
  database: myDatabase,
  tableName: "my_view",
  columns: [{
    name: "x",
    type: glue.Schema.INTEGER
  }],
  statement: "SELECT x from table_a UNION SELECT x from table_b"
});
```

Now imagine that the table names can't be hardcoded. You replace value in a view's SQL statement with the optional `placeHolders` property:

```ts
new glue.View(stack, "MyView", {
  database: myDatabase,
  tableName: "my_view",
  columns: [{
    name: "x",
    type: glue.Schema.INTEGER
  }],
  statement: "SELECT x from ${table1} UNION SELECT x from ${table2}",
  placeHolders: {
    table1: table1.tableName,
    table2: table2.tableName
  }
});
```

### View statements in external files

A view's SQL statement can get large and complex. Then it's hard to author and validate within the CDK script. You can pull the SQL statement from an external file.

Take the following example in a file named `myView.sql`:

```sql
SELECT x from ${table1}
UNION 
SELECT x from ${table2}
```

You can include the statement and replace the placeholders like this:

```ts
import * as fs from 'fs';
import * as path from 'path';

new glue.View(stack, "MyView", {
  database: myDatabase,
  tableName: "my_view",
  columns: [{
    name: "x",
    type: glue.Schema.INTEGER
  }],
  statement: fs
    .readFileSync(path.join(__dirname, 'myView.sql'))
    .toString(),
  placeHolders: {
    table1: table1.tableName,
    table2: table2.tableName,
  },
});
```
