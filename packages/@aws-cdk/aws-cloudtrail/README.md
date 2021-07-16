# AWS CloudTrail Construct Library
<!--BEGIN STABILITY BANNER-->

---

![cfn-resources: Stable](https://img.shields.io/badge/cfn--resources-stable-success.svg?style=for-the-badge)

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->

## Trail

AWS CloudTrail enables governance, compliance, and operational and risk auditing of your AWS account. Actions taken by
a user, role, or an AWS service are recorded as events in CloudTrail. Learn more at the [CloudTrail
documentation](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-user-guide.html).

The `Trail` construct enables ongoing delivery of events as log files to an Amazon S3 bucket. Learn more about [Creating
a Trail for Your AWS Account](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-create-and-update-a-trail.html).
The following code creates a simple CloudTrail for your account -

```ts
const trail = new cloudtrail.Trail(this, 'CloudTrail');
```

By default, this will create a new S3 Bucket that CloudTrail will write to, and choose a few other reasonable defaults
such as turning on multi-region and global service events. 
The defaults for each property and how to override them are all documented on the `TrailProps` interface.

## Log File Validation

In order to validate that the CloudTrail log file was not modified after CloudTrail delivered it, CloudTrail provides a
digital signature for each file. Learn more at [Validating CloudTrail Log File
Integrity](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-log-file-validation-intro.html).

This is enabled on the `Trail` construct by default, but can be turned off by setting `enableFileValidation` to `false`.

```ts
const trail = new cloudtrail.Trail(this, 'CloudTrail', {
  enableFileValidation: false,
});
```

## Notifications

Amazon SNS notifications can be configured upon new log files containing Trail events are delivered to S3.
Learn more at [Configuring Amazon SNS Notifications for
CloudTrail](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/configure-sns-notifications-for-cloudtrail.html).
The following code configures an SNS topic to be notified -

```ts
const topic = new sns.Topic(this, 'TrailTopic');
const trail = new cloudtrail.Trail(this, 'CloudTrail', {
  snsTopic: topic,
});
```

## Service Integrations

Besides sending trail events to S3, they can also be configured to notify other AWS services -

### Amazon CloudWatch Logs

CloudTrail events can be delivered to a CloudWatch Logs LogGroup.
By default, a new LogGroup is created with a default retention setting,
a new Log Role is created with a default permission setting.
The following code enables sending CloudWatch logs and specifies a particular retention period for the created Log Group.

```ts
const trail = new cloudtrail.Trail(this, 'CloudTrail', {
  sendToCloudWatchLogs: true,
});
```

The following code enables sending CloudWatch logs and specifies a particular retention period for the created Log Group.

```ts
const trail = new cloudtrail.Trail(this, 'CloudTrail', {
  cloudWatchLogsRetention: logs.RetentionDays.FOUR_MONTHS, 
});
```

If you would like to use a specific log group instead, this can be configured via `cloudWatchLogGroup`.
If you would like to use a custom log role instead, this can be configured via `cloudWatchLogsRole`.

### Amazon EventBridge

Amazon EventBridge rules can be configured to be triggered when CloudTrail events occur using the `Trail.onEvent()` API.
Using APIs available in `aws-events`, these events can be filtered to match to those that are of interest, either from
a specific service, account or time range. See [Events delivered via
CloudTrail](https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/EventTypes.html#events-for-services-not-listed)
to learn more about the event structure for events from CloudTrail.

The following code filters events for S3 from a specific AWS account and triggers a lambda function.

```ts
const myFunctionHandler = new lambda.Function(this, 'MyFunction', {
  code: lambda.Code.fromAsset('resource/myfunction');
  runtime: lambda.Runtime.NODEJS_12_X,
  handler: 'index.handler',
});

const eventRule = Trail.onEvent(this, 'MyCloudWatchEvent', {
  target: new eventTargets.LambdaFunction(myFunctionHandler),
});

eventRule.addEventPattern({
  account: '123456789012',
  source: 'aws.s3',
});
```

## Multi-Region & Global Service Events

By default, a `Trail` is configured to deliver log files from multiple regions to a single S3 bucket for a given
account. This creates shadow trails (replication of the trails) in all of the other regions. Learn more about [How
CloudTrail Behaves Regionally](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-concepts.html#cloudtrail-concepts-regional-and-global-services)
and about the [`IsMultiRegion`
property](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-cloudtrail-trail.html#cfn-cloudtrail-trail-ismultiregiontrail).

For most services, events are recorded in the region where the action occurred. For global services such as AWS IAM,
AWS STS, Amazon CloudFront, Route 53, etc., events are delivered to any trail that includes global services. Learn more
[About Global Service Events](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-concepts.html#cloudtrail-concepts-global-service-events).

Events for global services are turned on by default for `Trail` constructs in the CDK.

The following code disables multi-region trail delivery and trail delivery for global services for a specific `Trail` -

```ts
const trail = new cloudtrail.Trail(this, 'CloudTrail', {
  // ...
  isMultiRegionTrail: false,
  includeGlobalServiceEvents: false,
});
```

## Events Types

**Management events** provide information about management operations that are performed on resources in your AWS
account. These are also known as control plane operations. Learn more about [Management
Events](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-concepts.html#cloudtrail-concepts-events).

By default, a `Trail` logs all management events. However, they can be configured to either be turned off, or to only
log 'Read' or 'Write' events. 

The following code configures the `Trail` to only track management events that are of type 'Read'.

```ts
const trail = new cloudtrail.Trail(this, 'CloudTrail', {
  // ...
  managementEvents: ReadWriteType.READ_ONLY,
});
```

**Data events** provide information about the resource operations performed on or in a resource. These are also known
as data plane operations. Learn more about [Data
Events](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-concepts.html#cloudtrail-concepts-events).
By default, no data events are logged for a `Trail`.

AWS CloudTrail supports data event logging for Amazon S3 objects and AWS Lambda functions.

The `logAllS3DataEvents()` API configures the trail to log all S3 data events while the `addS3EventSelector()` API can
be used to configure logging of S3 data events for specific buckets and specific object prefix. The following code
configures logging of S3 data events for `fooBucket` and with object prefix `bar/`.

```ts
import * as cloudtrail from '@aws-cdk/aws-cloudtrail';

const trail = new cloudtrail.Trail(this, 'MyAmazingCloudTrail');

// Adds an event selector to the bucket foo
trail.addS3EventSelector([{
  bucket: fooBucket, // 'fooBucket' is of type s3.IBucket
  objectPrefix: 'bar/',
}]);
```

Similarly, the `logAllLambdaDataEvents()` configures the trail to log all Lambda data events while the
`addLambdaEventSelector()` API can be used to configure logging for specific Lambda functions. The following code
configures logging of Lambda data events for a specific Function.

```ts
const trail = new cloudtrail.Trail(this, 'MyAmazingCloudTrail');
const amazingFunction = new lambda.Function(stack, 'AnAmazingFunction', {
  runtime: lambda.Runtime.NODEJS_12_X,
  handler: "hello.handler",
  code: lambda.Code.fromAsset("lambda"),
});

// Add an event selector to log data events for the provided Lambda functions.
trail.addLambdaEventSelector([ lambdaFunction ]);
```
