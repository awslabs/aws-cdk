# Amazon EC2 Auto Scaling Construct Library
<!--BEGIN STABILITY BANNER-->

---

![cfn-resources: Stable](https://img.shields.io/badge/cfn--resources-stable-success.svg?style=for-the-badge)

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->


This module is part of the [AWS Cloud Development Kit](https://github.com/aws/aws-cdk) project.

## Auto Scaling Group

An `AutoScalingGroup` represents a number of instances on which you run your code. You
pick the size of the fleet, the instance type and the OS image:

```ts
import * as autoscaling from '@aws-cdk/aws-autoscaling';
import * as ec2 from '@aws-cdk/aws-ec2';

new autoscaling.AutoScalingGroup(this, 'ASG', {
  vpc,
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
  machineImage: new ec2.AmazonLinuxImage() // get the latest Amazon Linux image
});
```

NOTE: AutoScalingGroup has an property called `allowAllOutbound` (allowing the instances to contact the
internet) which is set to `true` by default. Be sure to set this to `false`  if you don't want
your instances to be able to start arbitrary connections. Alternatively, you can specify an existing security
group to attach to the instances that are launched, rather than have the group create a new one.

```ts
const mySecurityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {...});
new autoscaling.AutoScalingGroup(this, 'ASG', {
  vpc,
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
  machineImage: new ec2.AmazonLinuxImage(),
  securityGroup: mySecurityGroup,
});
```

## Machine Images (AMIs)

AMIs control the OS that gets launched when you start your EC2 instance. The EC2
library contains constructs to select the AMI you want to use.

Depending on the type of AMI, you select it a different way.

The latest version of Amazon Linux and Microsoft Windows images are
selectable by instantiating one of these classes:

[example of creating images](test/example.images.lit.ts)

> NOTE: The Amazon Linux images selected will be cached in your `cdk.json`, so that your
> AutoScalingGroups don't automatically change out from under you when you're making unrelated
> changes. To update to the latest version of Amazon Linux, remove the cache entry from the `context`
> section of your `cdk.json`.
>
> We will add command-line options to make this step easier in the future.

## AutoScaling Instance Counts

AutoScalingGroups make it possible to raise and lower the number of instances in the group,
in response to (or in advance of) changes in workload.

When you create your AutoScalingGroup, you specify a `minCapacity` and a
`maxCapacity`. AutoScaling policies that respond to metrics will never go higher
or lower than the indicated capacity (but scheduled scaling actions might, see
below).

There are three ways to scale your capacity:

* **In response to a metric** (also known as step scaling); for example, you
  might want to scale out if the CPU usage across your cluster starts to rise,
  and scale in when it drops again.
* **By trying to keep a certain metric around a given value** (also known as
  target tracking scaling); you might want to automatically scale out and in to
  keep your CPU usage around 50%.
* **On a schedule**; you might want to organize your scaling around traffic
  flows you expect, by scaling out in the morning and scaling in in the
  evening.

The general pattern of autoscaling will look like this:

```ts
const autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'ASG', {
  minCapacity: 5,
  maxCapacity: 100
  // ...
});

// Step scaling
autoScalingGroup.scaleOnMetric(...);

// Target tracking scaling
autoScalingGroup.scaleOnCpuUtilization(...);
autoScalingGroup.scaleOnIncomingBytes(...);
autoScalingGroup.scaleOnOutgoingBytes(...);
autoScalingGroup.scaleOnRequestCount(...);
autoScalingGroup.scaleToTrackMetric(...);

// Scheduled scaling
autoScalingGroup.scaleOnSchedule(...);
```

### Step Scaling

This type of scaling scales in and out in deterministics steps that you
configure, in response to metric values. For example, your scaling strategy to
scale in response to a metric that represents your average worker pool usage
might look like this:

```plaintext
 Scaling        -1          (no change)          +1       +3
            │        │                       │        │        │
            ├────────┼───────────────────────┼────────┼────────┤
            │        │                       │        │        │
Worker use  0%      10%                     50%       70%     100%
```

(Note that this is not necessarily a recommended scaling strategy, but it's
a possible one. You will have to determine what thresholds are right for you).

Note that in order to set up this scaling strategy, you will have to emit a
metric representing your worker utilization from your instances. After that,
you would configure the scaling something like this:

```ts
const workerUtilizationMetric = new cloudwatch.Metric({
    namespace: 'MyService',
    metricName: 'WorkerUtilization'
});

capacity.scaleOnMetric('ScaleToCPU', {
  metric: workerUtilizationMetric,
  scalingSteps: [
    { upper: 10, change: -1 },
    { lower: 50, change: +1 },
    { lower: 70, change: +3 },
  ],

  // Change this to AdjustmentType.PERCENT_CHANGE_IN_CAPACITY to interpret the
  // 'change' numbers before as percentages instead of capacity counts.
  adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
});
```

The AutoScaling construct library will create the required CloudWatch alarms and
AutoScaling policies for you.

### Target Tracking Scaling

This type of scaling scales in and out in order to keep a metric around a value
you prefer. There are four types of predefined metrics you can track, or you can
choose to track a custom metric. If you do choose to track a custom metric,
be aware that the metric has to represent instance utilization in some way
(AutoScaling will scale out if the metric is higher than the target, and scale
in if the metric is lower than the target).

If you configure multiple target tracking policies, AutoScaling will use the
one that yields the highest capacity.

The following example scales to keep the CPU usage of your instances around
50% utilization:

```ts
autoScalingGroup.scaleOnCpuUtilization('KeepSpareCPU', {
  targetUtilizationPercent: 50
});
```

To scale on average network traffic in and out of your instances:

```ts
autoScalingGroup.scaleOnIncomingBytes('LimitIngressPerInstance', {
    targetBytesPerSecond: 10 * 1024 * 1024 // 10 MB/s
});
autoScalingGroup.scaleOnOutcomingBytes('LimitEgressPerInstance', {
    targetBytesPerSecond: 10 * 1024 * 1024 // 10 MB/s
});
```

To scale on the average request count per instance (only works for
AutoScalingGroups that have been attached to Application Load
Balancers):

```ts
autoScalingGroup.scaleOnRequestCount('LimitRPS', {
    targetRequestsPerSecond: 1000
});
```

### Scheduled Scaling

This type of scaling is used to change capacities based on time. It works by
changing `minCapacity`, `maxCapacity` and `desiredCapacity` of the
AutoScalingGroup, and so can be used for two purposes:

* Scale in and out on a schedule by setting the `minCapacity` high or
  the `maxCapacity` low.
* Still allow the regular scaling actions to do their job, but restrict
  the range they can scale over (by setting both `minCapacity` and
  `maxCapacity` but changing their range over time).

A schedule is expressed as a cron expression. The `Schedule` class has a `cron` method to help build cron expressions.

The following example scales the fleet out in the morning, going back to natural
scaling (all the way down to 1 instance if necessary) at night:

```ts
autoScalingGroup.scaleOnSchedule('PrescaleInTheMorning', {
  schedule: autoscaling.Schedule.cron({ hour: '8', minute: '0' }),
  minCapacity: 20,
});

autoScalingGroup.scaleOnSchedule('AllowDownscalingAtNight', {
  schedule: autoscaling.Schedule.cron({ hour: '20', minute: '0' }),
  minCapacity: 1
});
```

## Configuring Instances using CloudFormation Init

It is possible to use the CloudFormation Init mechanism to configure the
instances in the AutoScalingGroup. You can write files to it, run commands,
start services, etc. See the documentation of
[AWS::CloudFormation::Init](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-init.html)
and the documentation of CDK's `aws-ec2` library for more information.

When you specify a CloudFormation Init configuration for an AutoScalingGroup:

* you *must* also specify `signals` to configure how long CloudFormation
  should wait for the instances to successfully configure themselves.
* you *should* also specify an `updatePolicy` to configure how instances
  should be updated when the AutoScalingGroup is updated (for example,
  when the AMI is updated). If you don't specify an update policy, a *rolling
  update* is chosen by default.

Here's an example of using CloudFormation Init to write a file to the
instance hosts on startup:

```ts
new autoscaling.AutoScalingGroup(this, 'ASG', {
  // ...

  init: ec2.CloudFormationInit.fromElements(
    ec2.InitFile.fromString('/etc/my_instance', 'This got written during instance startup'),
  ),
  signals: autoscaling.Signals.waitForAll({
    timeout: Duration.minutes(10),
  }),
});
```

## Signals

In normal operation, CloudFormation will send a Create or Update command to
an AutoScalingGroup and proceed with the rest of the deployment without waiting
for the *instances in the AutoScalingGroup*.

Configure `signals` to tell CloudFormation to wait for a specific number of
instances in the AutoScalingGroup to have been started (or failed to start)
before moving on. An instance is supposed to execute the
[`cfn-signal`](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-signal.html)
program as part of its startup to indicate whether it was started
successfully or not.

If you use CloudFormation Init support (described in the previous section),
the appropriate call to `cfn-signal` is automatically added to the
AutoScalingGroup's UserData. If you don't use the `signals` directly, you are
responsible for adding such a call yourself.

The following type of `Signals` are available:

* `Signals.waitForAll([options])`: wait for all of `desiredCapacity` amount of instances
  to have started (recommended).
* `Signals.waitForMinCapacity([options])`: wait for a `minCapacity` amount of instances
  to have started (use this if waiting for all instances takes too long and you are happy
  with a minimum count of healthy hosts).
* `Signals.waitForCount(count, [options])`: wait for a specific amount of instances to have
  started.

There are two `options` you can configure:

* `timeout`: maximum time a host startup is allowed to take. If a host does not report
  success within this time, it is considered a failure. Default is 5 minutes.
* `minSuccessPercentage`: percentage of hosts that needs to be healthy in order for the
  update to succeed. If you set this value lower than 100, some percentage of hosts may
  report failure, while still considering the deployment a success. Default is 100%.

## Update Policy

The *update policy* describes what should happen to running instances when the definition
of the AutoScalingGroup is changed. For example, if you add a command to the UserData
of an AutoScalingGroup, do the existing instances get replaced with new instances that
have executed the new UserData? Or do the "old" instances just keep on running?

It is recommended to always use an update policy, otherwise the current state of your
instances also depends the previous state of your instances, rather than just on your
source code. This degrades the reproducibility of your deployments.

The following update policies are available:

* `UpdatePolicy.none()`: leave existing instances alone (not recommended).
* `UpdatePolicy.rollingUpdate([options])`: progressively replace the existing
  instances with new instances, in small batches. At any point in time,
  roughly the same amount of total instances will be running. If the deployment
  needs to be rolled back, the fresh instances will be replaced with the "old"
  configuration again.
* `UpdatePolicy.replacingUpdate([options])`: build a completely fresh copy
  of the new AutoScalingGroup next to the old one. Once the AutoScalingGroup
  has been successfully created (and the instances started, if `signals` is
  configured on the AutoScalingGroup), the old AutoScalingGroup is deleted.
  If the deployment needs to be rolled back, the new AutoScalingGroup is
  deleted and the old one is left unchanged.

## Allowing Connections

See the documentation of the `@aws-cdk/aws-ec2` package for more information
about allowing connections between resources backed by instances.

## Max Instance Lifetime

To enable the max instance lifetime support, specify `maxInstanceLifetime` property
for the `AutoscalingGroup` resource. The value must be between 7 and 365 days(inclusive).
To clear a previously set value, leave this property undefined.

## Instance Monitoring

To disable detailed instance monitoring, specify `instanceMonitoring` property
for the `AutoscalingGroup` resource as `Monitoring.BASIC`. Otherwise detailed monitoring
will be enabled.

## Monitoring Group Metrics

Group metrics are used to monitor group level properties; they describe the group rather than any of its instances (e.g GroupMaxSize, the group maximum size). To enable group metrics monitoring, use the `groupMetrics` property.
All group metrics are reported in a granularity of 1 minute at no additional charge.

See [EC2 docs](https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-instance-monitoring.html#as-group-metrics) for a list of all available group metrics.

To enable group metrics monitoring using the `groupMetrics` property:

```ts
// Enable monitoring of all group metrics
new autoscaling.AutoScalingGroup(stack, 'ASG', {
  groupMetrics: [GroupMetrics.all()],
  // ...
});

// Enable monitoring for a subset of group metrics
new autoscaling.AutoScalingGroup(stack, 'ASG', {
  groupMetrics: [new autoscaling.GroupMetrics(GroupMetric.MIN_SIZE, GroupMetric.MAX_SIZE)],
  // ...
});
```

## Protecting new instances from being terminated on scale-in

By default, Auto Scaling can terminate an instance at any time after launch when
scaling in an Auto Scaling Group, subject to the group's [termination
policy](https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-instance-termination.html).

However, you may wish to protect newly-launched instances from being scaled in
if they are going to run critical applications that should not be prematurely
terminated. EC2 Capacity Providers for Amazon ECS requires this attribute be
set to `true`.

```ts
new autoscaling.AutoScalingGroup(stack, 'ASG', {
  newInstancesProtectedFromScaleIn: true,
  // ...
});
```

## Enable EC2 IMDS V2

To enable EC2 IMDS V2 support, specify `metadataOptions` property for the `AutoscalingGroup` resource.
See [MetadataOptions](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-autoscaling-launchconfig-metadataoptions.html) for the list of the available options.

```ts
new autoscaling.AutoScalingGroup(stack, 'ASG', {
  metadataOptions: {
    httpTokens: 'required',
    httpEndpoint: 'enabled'
  },
  // ...
});
```

## Future work

* [ ] CloudWatch Events (impossible to add currently as the AutoScalingGroup ARN is
  necessary to make this rule and this cannot be accessed from CloudFormation).
