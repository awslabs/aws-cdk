# CDK Construct Library for AWS CloudWatch Logs Subscription Destinations
<!--BEGIN STABILITY BANNER-->

---

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->

This library supplies constructs for working with CloudWatch Logs Subscription Destinations.

## Logs Destinations

Log events matching a particular filter can be sent to Lambda, Kinesis or Kinesis Data Firehose.

Logs that are sent to a receiving service through a subscription filter are Base64 encoded and compressed with the gzip format. For further information, see the [Using CloudWatch Logs Subscription Filters](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/SubscriptionFilters.html).

Create a `SubscriptionFilter`, initialize it with an appropriate `Pattern` and supply the intended destination.

### Lambda Destination

```ts
const fn = new lambda.Function(this, 'Lambda', { ... });
const logGroup = new LogGroup(this, 'LogGroup', { ... });

new SubscriptionFilter(this, 'Subscription', {
  logGroup,
  destination: new LogsDestinations.LambdaDestination(fn),
  filterPattern: FilterPattern.allTerms("ERROR", "MainThread")
});
```

### Kinesis Destination

```ts
const stream = new kinesis.Stream(stack, 'KinesisStream', { ... });
const logGroup = new LogGroup(this, 'LogGroup', { ... });

new SubscriptionFilter(this, 'Subscription', {
  logGroup,
  destination: new LogsDestinations.KinesisDestination(stream),
  filterPattern: FilterPattern.allTerms("ERROR", "MainThread")
});
```

### Kinesis Firehose Destination

```ts
const deliveryStream = new firehose.CfnDeliveryStream(stack, 'Firehose', { ... });
const logGroup = new LogGroup(this, 'LogGroup', { ... });

new SubscriptionFilter(this, 'Subscription', {
  logGroup,
  destination: new LogsDestinations.KinesisFirehoseDestination(deliveryStream),
  filterPattern: FilterPattern.allTerms("ERROR", "MainThread")
});
```
