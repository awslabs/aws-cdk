# Amazon Kinesis Data Firehose Construct Library
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

[Amazon Kinesis Data Firehose](https://docs.aws.amazon.com/firehose/latest/dev/what-is-this-service.html)
is a service for fully-managed delivery of real-time streaming data to storage services
such as Amazon S3, Amazon Redshift, Amazon Elasticsearch, Splunk, or any custom HTTP
endpoint or third-party services such as Datadog, Dynatrace, LogicMonitor, MongoDB, New
Relic, and Sumo Logic.

Kinesis Data Firehose delivery streams are distinguished from Kinesis data streams in
their models of consumtpion. Whereas consumers read from a data stream by actively pulling
data from the stream, a delivery stream pushes data to its destination on a regular
cadence. This means that data streams are intended to have consumers that do on-demand
processing, like AWS Lambda or Amazon EC2. On the other hand, delivery streams are
intended to have destinations that are sources for offline processing and analytics, such
as Amazon S3 and Amazon Redshift.

This module is part of the [AWS Cloud Development Kit](https://github.com/aws/aws-cdk)
project. It allows you to define Kinesis Data Firehose delivery streams.

## Defining a Delivery Stream

In order to define a Delivery Stream, you must specify a destination. An S3 bucket can be
used as a destination. More supported destinations are covered [below](#destinations).

```ts
import * as destinations from '@aws-cdk/aws-kinesisfirehose-destinations';
import * as s3 from '@aws-cdk/aws-s3';

const bucket = new s3.Bucket(this, 'Bucket');
new DeliveryStream(this, 'Delivery Stream', {
  destinations: [new destinations.S3(bucket)],
});
```

The above example defines the following resources:

- An S3 bucket
- A Kinesis Data Firehose delivery stream with Direct PUT as the source and CloudWatch
  error logging turned on.
- An IAM role which gives the delivery stream permission to write to the S3 bucket.

## Sources

There are two main methods of sourcing input data: Kinesis Data Streams and via a "direct
put". This construct library currently only supports "direct put". See [#15500](https://github.com/aws/aws-cdk/issues/15500) to track the status of adding support for Kinesis Data Streams.

See: [Sending Data to a Delivery Stream](https://docs.aws.amazon.com/firehose/latest/dev/basic-write.html)
in the *Kinesis Data Firehose Developer Guide*.

### Direct Put

Data must be provided via "direct put", ie., by using a `PutRecord` or `PutRecordBatch` API call. There are a number of ways of doing
so, such as:

- Kinesis Agent: a standalone Java application that monitors and delivers files while
  handling file rotation, checkpointing, and retries. See: [Writing to Kinesis Data Firehose Using Kinesis Agent](https://docs.aws.amazon.com/firehose/latest/dev/writing-with-agents.html)
  in the *Kinesis Data Firehose Developer Guide*.
- AWS SDK: a general purpose solution that allows you to deliver data to a delivery stream
  from anywhere using Java, .NET, Node.js, Python, or Ruby. See: [Writing to Kinesis Data Firehose Using the AWS SDK](https://docs.aws.amazon.com/firehose/latest/dev/writing-with-sdk.html)
  in the *Kinesis Data Firehose Developer Guide*.
- CloudWatch Logs: subscribe to a log group and receive filtered log events directly into
  a delivery stream. See: [logs-destinations](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-logs-destinations-readme.html).
- Eventbridge: add an event rule target to send events to a delivery stream based on the
  rule filtering. See: [events-targets](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-events-targets-readme.html).
- SNS: add a subscription to send all notifications from the topic to a delivery
  stream. See: [sns-subscriptions](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-sns-subscriptions-readme.html).
- IoT: add an action to an IoT rule to send various IoT information to a delivery stream

## Destinations

The following destinations are supported. See [kinesisfirehose-destinations](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-kinesisfirehose-destinations-readme.html)
for the implementations of these destinations.

### S3

Defining a delivery stream with an S3 bucket destination:

```ts
import * as s3 from '@aws-cdk/aws-s3';
import * as destinations from '@aws-cdk/aws-kinesisfirehose-destinations';

const bucket = new s3.Bucket(this, 'Bucket');

const s3Destination = new destinations.S3(bucket);

new DeliveryStream(this, 'Delivery Stream', {
  destinations: [s3Destination],
});
```

The S3 destination also supports custom dynamic prefixes. `prefix` will be used for files
successfully delivered to S3. `errorOutputPrefix` will be added to failed records before
writing them to S3.

```ts fixture=with-bucket
const s3Destination = new destinations.S3(bucket, {
  prefix: 'myFirehose/DeliveredYear=!{timestamp:yyyy}/anyMonth/rand=!{firehose:random-string}',
  errorOutputPrefix: 'myFirehoseFailures/!{firehose:error-output-type}/!{timestamp:yyyy}/anyMonth/!{timestamp:dd}',
});
```

See: [Custom S3 Prefixes](https://docs.aws.amazon.com/firehose/latest/dev/s3-prefixes.html) in the *Kinesis Data Firehose Developer Guide*.

## Server-side Encryption

Enabling server-side encryption (SSE) requires Kinesis Data Firehose to encrypt all data
sent to delivery stream when it is stored at rest. This means that data is encrypted
before being written to the service's internal storage layer and decrypted after it is
received from the internal storage layer. The service manages keys and cryptographic
operations so that sources and destinations do not need to, as the data is encrypted and
decrypted at the boundaries of the service (ie., before the data is delivered to a
destination). By default, delivery streams do not have SSE enabled.

The Key Management Service (KMS) Customer Managed Key (CMK) used for SSE can either be
AWS-owned or customer-managed. AWS-owned CMKs are keys that an AWS service (in this case
Kinesis Data Firehose) owns and manages for use in multiple AWS accounts. As a customer,
you cannot view, use, track, or manage these keys, and you are not charged for their
use. On the other hand, customer-managed CMKs are keys that are created and owned within
your account and managed entirely by you. As a customer, you are responsible for managing
access, rotation, aliases, and deletion for these keys, and you are changed for their
use. See: [Customer master keys](https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html#master_keys)
in the *KMS Developer Guide*.

```ts fixture=with-destination
import * as kms from '@aws-cdk/aws-kms';
// SSE with an AWS-owned CMK
new DeliveryStream(this, 'Delivery Stream AWS Owned', {
  encryption: StreamEncryption.AWS_OWNED,
  destinations: [destination],
});
// SSE with an customer-managed CMK that is created automatically by the CDK
new DeliveryStream(this, 'Delivery Stream Implicit Customer Managed', {
  encryption: StreamEncryption.CUSTOMER_MANAGED,
  destinations: [destination],
});
// SSE with an customer-managed CMK that is explicitly specified
const key = new kms.Key(this, 'Key');
new DeliveryStream(this, 'Delivery Stream Explicit Customer Managed'', {
  encryptionKey: key,
  destinations: [destination],
});
```

See: [Data Protection](https://docs.aws.amazon.com/firehose/latest/dev/encryption.html) in
the *Kinesis Data Firehose Developer Guide*.

## Monitoring

Kinesis Data Firehose is integrated with CloudWatch, so you can monitor the performance of
your delivery streams via logs and metrics.

### Logs

Kinesis Data Firehose will send logs to CloudWatch when data transformation or data
delivery fails. The CDK will enable logging by default and create a CloudWatch LogGroup
and LogStream for your Delivery Stream.

You can provide a specific log group to specify where the CDK will create the log streams
where log events will be sent:

```ts fixture=with-destination
import * as logs from '@aws-cdk/aws-logs';

const logGroup = new logs.LogGroup(this, 'Log Group');
new DeliveryStream(this, 'Delivery Stream', {
  logGroup: logGroup,
  destinations: [destination],
});
```

Logging can also be disabled:

```ts fixture=with-destination
new DeliveryStream(this, 'Delivery Stream', {
  loggingEnabled: false,
  destinations: [destination],
});
```

See: [Monitoring using CloudWatch Logs](https://docs.aws.amazon.com/firehose/latest/dev/monitoring-with-cloudwatch-logs.html)
in the *Kinesis Data Firehose Developer Guide*.

### Metrics

Kinesis Data Firehose sends metrics to CloudWatch so that you can collect and analyze the
performance of the delivery stream, including data delivery, data ingestion, data
transformation, format conversion, API usage, encryption, and resource usage. You can then
use CloudWatch alarms to alert you, for example, when data freshness (the age of the
oldest record in the delivery stream) exceeds the buffering limit (indicating that data is
not being delivered to your destination), or when the rate of incoming records exceeds the
limit of records per second (indicating data is flowing into your delivery stream faster
than it is configured to process).

CDK provides methods for accessing delivery stream metrics with default configuration,
such as `metricIncomingBytes`, and `metricIncomingRecords` (see [`IDeliveryStream`](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-kinesisfirehose.IDeliveryStream.html)
for a full list). CDK also provides a generic `metric` method that can be used to produce
metric configurations for any metric provided by Kinesis Data Firehose; the configurations
are pre-populated with the correct dimensions for the delivery stream.

```ts fixture=with-delivery-stream
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
// Alarm that triggers when the per-second average of incoming bytes exceeds 90% of the current service limit
const incomingBytesPercentOfLimit = new cloudwatch.MathExpression({
  expression: 'incomingBytes / 300 / bytePerSecLimit',
  usingMetrics: {
    incomingBytes: deliveryStream.metricIncomingBytes({ statistic: cloudwatch.Statistic.SUM }),
    bytePerSecLimit: deliveryStream.metric('BytesPerSecondLimit'),
  },
});
new Alarm(this, 'Alarm', {
  metric: incomingBytesPercentOfLimit,
  threshold: 0.9,
  evaluationPeriods: 3,
});
```

See: [Monitoring Using CloudWatch Metrics](https://docs.aws.amazon.com/firehose/latest/dev/monitoring-with-cloudwatch-metrics.html)
in the *Kinesis Data Firehose Developer Guide*.

## Compression

Your data can automatically be compressed when it is delivered to S3 as either a final or
an intermediary/backup destination. Supported compression formats are: gzip, Snappy,
Hadoop-compatible Snappy, and ZIP, except for Redshift destinations, where Snappy
(regardless of Hadoop-compatibility) and ZIP are not supported. By default, data is
delivered to S3 without compression.

```ts fixture=with-bucket
// Compress data delivered to S3 using Snappy
const s3Destination = new destinations.S3(bucket, {
  compression: Compression.SNAPPY,
});
new DeliveryStream(this, 'Delivery Stream', {
  destinations: [destination],
});
```

## Buffering

Incoming data is buffered before it is delivered to the specified destination. The
delivery stream will wait until the amount of incoming data has exceeded some threshold
(the "buffer size") or until the time since the last data delivery occurred exceeds some
threshold (the "buffer interval"), whichever happens first. You can configure these
thresholds based on the capabilities of the destination and your use-case. By default, the
buffer size is 3 MiB and the buffer interval is 1 minute.

```ts fixture=with-bucket
// Increase the buffer interval and size to 5 minutes and 3 MiB, respectively
import * as cdk from '@aws-cdk/core';
const s3Destination = new destinations.S3(bucket, {
  bufferingInterval: cdk.Duration.minutes(5),
  bufferingSize: cdk.Size.mebibytes(8),
});
new DeliveryStream(this, 'Delivery Stream', {
  destinations: [destination],
});
```

See: [Data Delivery Frequency](https://docs.aws.amazon.com/firehose/latest/dev/basic-deliver.html#frequency)
in the *Kinesis Data Firehose Developer Guide*.

## Destination Encryption

Your data can be automatically encrypted when it is delivered to S3 as a final or
an intermediary/backup destination. Kinesis Data Firehose supports Amazon S3 server-side
encryption with AWS Key Management Service (AWS KMS) for encrypting delivered data
in Amazon S3. You can choose to not encrypt the data or to encrypt with a key from
the list of AWS KMS keys that you own. For more information, see [Protecting Data
Using Server-Side Encryption with AWS KMS–Managed Keys (SSE-KMS)](https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingKMSEncryption.html). Data is not encrypted by default.

```ts fixture=with-bucket
// Increase the buffer interval and size to 5 minutes and 3 MiB, respectively
import * as cdk from '@aws-cdk/core';
import * as kms from '@aws-cdk/aws-kms';

const s3Destination = new destinations.S3(bucket, {
  encryptionKey: new kms.Key(this, 'MyKey'),
});
new DeliveryStream(this, 'Delivery Stream', {
  destinations: [destination],
});
```

## Specifying an IAM role

The DeliveryStream class automatically creates an IAM role with all the minimum necessary
permissions for Kinesis Data Firehose to access the resources referenced by your delivery
stream. For example: an Elasticsearch domain, a Redshift cluster, a backup or destination
S3 bucket, a Lambda data transformer, an AWS Glue table schema, etc. If you wish, you may
specify your own IAM role. It must have the correct permissions, or delivery stream
creation or data delivery may fail.

```ts fixture=with-bucket
import * as iam from '@aws-cdk/aws-iam';

const role = new iam.Role(this, 'Role', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
}
bucket.grantWrite(role);
new DeliveryStream(stack, 'Delivery Stream', {
  destinations: [new destinations.S3(bucket)],
  role: role,
});
```

See [Controlling Access](https://docs.aws.amazon.com/firehose/latest/dev/controlling-access.html)
in the *Kinesis Data Firehose Developer Guide*.

## Granting application access to a delivery stream

IAM roles, users or groups which need to be able to work with delivery streams should be
granted IAM permissions.

Any object that implements the `IGrantable` interface (ie., has an associated principal)
can be granted permissions to a delivery stream by calling:

- `grantPutRecords(principal)` - grants the principal the ability to put records onto the
  delivery stream
- `grant(principal, ...actions)` - grants the principal permission to a custom set of
  actions

```ts fixture=with-delivery-stream
import * as iam from '@aws-cdk/aws-iam';
const lambdaRole = new iam.Role(this, 'Role', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
}

// Give the role permissions to write data to the delivery stream
deliveryStream.grantPutRecords(lambdaRole);
```

The following write permissions are provided to a service principal by the `grantPutRecords()` method:

- `firehose:PutRecord`
- `firehose:PutRecordBatch`

## Granting a delivery stream access to a resource

Conversely to the above, Kinesis Data Firehose requires permissions in order for delivery
streams to interact with resources that you own. For example, if an S3 bucket is specified
as a destination of a delivery stream, the delivery stream must be granted permissions to
put and get objects from the bucket. When using the built-in AWS service destinations
found in the `@aws-cdk/aws-kinesisfirehose-destinations` module, the CDK grants the
permissions automatically. However, custom or third-party destinations may require custom
permissions. In this case, use the delivery stream as an `IGrantable`, as follows:

```ts fixture=with-delivery-stream
/// !hide
const myDestinationResource = {
  grantWrite(grantee: IGrantable) {}
}
/// !show
myDestinationResource.grantWrite(deliveryStream);
```

## Multiple destinations

Though the delivery stream allows specifying an array of destinations, only one
destination per delivery stream is currently allowed. This limitation is enforced at
compile time and will throw an error.
