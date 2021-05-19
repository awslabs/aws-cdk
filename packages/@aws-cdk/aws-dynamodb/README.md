# Amazon DynamoDB Construct Library
<!--BEGIN STABILITY BANNER-->

---

![cfn-resources: Stable](https://img.shields.io/badge/cfn--resources-stable-success.svg?style=for-the-badge)

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->

Here is a minimal deployable DynamoDB table definition:

```ts
import * as dynamodb from '@aws-cdk/aws-dynamodb';

const table = new dynamodb.Table(this, 'Table', {
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING }
});
```

## Importing existing tables

To import an existing table into your CDK application, use the `Table.fromTableName`, `Table.fromTableArn` or `Table.fromTableAttributes`
factory method. This method accepts table name or table ARN which describes the properties of an already
existing table:

```ts
const table = Table.fromTableArn(this, 'ImportedTable', 'arn:aws:dynamodb:us-east-1:111111111:table/my-table');
// now you can just call methods on the table
table.grantReadWriteData(user);
```

If you intend to use the `tableStreamArn` (including indirectly, for example by creating an
`@aws-cdk/aws-lambda-event-source.DynamoEventSource` on the imported table), you *must* use the
`Table.fromTableAttributes` method and the `tableStreamArn` property *must* be populated.

## Keys

When a table is defined, you must define it's schema using the `partitionKey`
(required) and `sortKey` (optional) properties.

## Billing Mode

DynamoDB supports two billing modes:

* PROVISIONED - the default mode where the table and global secondary indexes have configured read and write capacity.
* PAY_PER_REQUEST - on-demand pricing and scaling. You only pay for what you use and there is no read and write capacity for the table or its global secondary indexes.

```ts
import * as dynamodb from '@aws-cdk/aws-dynamodb';

const table = new dynamodb.Table(this, 'Table', {
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST
});
```

Further reading:
https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadWriteCapacityMode.

## Configure AutoScaling for your table

You can have DynamoDB automatically raise and lower the read and write capacities
of your table by setting up autoscaling. You can use this to either keep your
tables at a desired utilization level, or by scaling up and down at pre-configured
times of the day:

Auto-scaling is only relevant for tables with the billing mode, PROVISIONED.

[Example of configuring autoscaling](test/integ.autoscaling.lit.ts)

Further reading:
https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/AutoScaling.html
https://aws.amazon.com/blogs/database/how-to-use-aws-cloudformation-to-configure-auto-scaling-for-amazon-dynamodb-tables-and-indexes/

## Amazon DynamoDB Global Tables

You can create DynamoDB Global Tables by setting the `replicationRegions` property on a `Table`:

```ts
import * as dynamodb from '@aws-cdk/aws-dynamodb';

const globalTable = new dynamodb.Table(this, 'Table', {
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  replicationRegions: ['us-east-1', 'us-east-2', 'us-west-2'],
});
```

When doing so, a CloudFormation Custom Resource will be added to the stack in order to create the replica tables in the
selected regions.

The default billing mode for Global Tables is `PAY_PER_REQUEST`.
If you want to use `PROVISIONED`,
you have to make sure write auto-scaling is enabled for that Table:

```ts
const globalTable = new dynamodb.Table(this, 'Table', {
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  replicationRegions: ['us-east-1', 'us-east-2', 'us-west-2'],
  billingMode: BillingMode.PROVISIONED,
});

globalTable.autoScaleWriteCapacity({
  minCapacity: 1,
  maxCapacity: 10,
}).scaleOnUtilization({ targetUtilizationPercent: 75 });
```

When adding a replica region for a large table, you might want to increase the
timeout for the replication operation:

```ts
const globalTable = new dynamodb.Table(this, 'Table', {
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  replicationRegions: ['us-east-1', 'us-east-2', 'us-west-2'],
  replicationTimeout: Duration.hours(2), // defaults to Duration.minutes(30)
});
```

## Encryption

All user data stored in Amazon DynamoDB is fully encrypted at rest. When creating a new table, you can choose to encrypt using the following customer master keys (CMK) to encrypt your table:

* AWS owned CMK - By default, all tables are encrypted under an AWS owned customer master key (CMK) in the DynamoDB service account (no additional charges apply).
* AWS managed CMK - AWS KMS keys (one per region) are created in your account, managed, and used on your behalf by AWS DynamoDB (AWS KMS charges apply).
* Customer managed CMK - You have full control over the KMS key used to encrypt the DynamoDB Table (AWS KMS charges apply).

Creating a Table encrypted with a customer managed CMK:

```ts
import dynamodb = require('@aws-cdk/aws-dynamodb');

const table = new dynamodb.Table(stack, 'MyTable', {
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  encryption: TableEncryption.CUSTOMER_MANAGED,
});

// You can access the CMK that was added to the stack on your behalf by the Table construct via:
const tableEncryptionKey = table.encryptionKey;
```

You can also supply your own key:

```ts
import dynamodb = require('@aws-cdk/aws-dynamodb');
import kms = require('@aws-cdk/aws-kms');

const encryptionKey = new kms.Key(stack, 'Key', {
  enableKeyRotation: true
});
const table = new dynamodb.Table(stack, 'MyTable', {
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  encryption: TableEncryption.CUSTOMER_MANAGED,
  encryptionKey, // This will be exposed as table.encryptionKey
});
```

In order to use the AWS managed CMK instead, change the code to:

```ts
import dynamodb = require('@aws-cdk/aws-dynamodb');

const table = new dynamodb.Table(stack, 'MyTable', {
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  encryption: TableEncryption.AWS_MANAGED,
});

// In this case, the CMK _cannot_ be accessed through table.encryptionKey.
```

## Time to Live

To help manage the time to live attribute of a table, a custom resource will be created if `timeToLiveAttribute` inside the tables options is set to any other value then undefined (_default_).
This is necessary, as the CFN construct comes with some limitations. For example the TTL can not be changed to a
new attribute directly and the disabling process takes quite some time.
For more convenience a custom resource is introduced.
The resource allows to directly change the time to live attribute,
without manually disabling and afterwards enabling it.
To read more about the underling limitations have a look at the CFN documentation
[here](https://docs.aws.amazon.com/de_de/AWSCloudFormation/latest/UserGuide/aws-properties-dynamodb-table-timetolivespecification.html)
and the DynamoDB documentation
[here](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/time-to-live-ttl-how-to.html).
