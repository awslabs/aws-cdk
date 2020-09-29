## AWS Auto Scaling Construct Library
<!--BEGIN STABILITY BANNER-->
---

![cfn-resources: Stable](https://img.shields.io/badge/cfn--resources-stable-success.svg?style=for-the-badge)

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---
<!--END STABILITY BANNER-->

**Application AutoScaling** is used to configure autoscaling for all
services other than scaling EC2 instances. For example, you will use this to
scale ECS tasks, DynamoDB capacity, Spot Fleet sizes, Comprehend document classification endpoints, Lambda function provisioned concurrency and more.

As a CDK user, you will probably not have to interact with this library
directly; instead, it will be used by other construct libraries to
offer AutoScaling features for their own constructs.

This document will describe the general autoscaling features and concepts;
your particular service may offer only a subset of these.

### AutoScaling basics

Resources can offer one or more **attributes** to autoscale, typically
representing some capacity dimension of the underlying service. For example,
a DynamoDB Table offers autoscaling of the read and write capacity of the
table proper and its Global Secondary Indexes, an ECS Service offers
autoscaling of its task count, an RDS Aurora cluster offers scaling of its
replica count, and so on.

When you enable autoscaling for an attribute, you specify a minimum and a
maximum value for the capacity. AutoScaling policies that respond to metrics
will never go higher or lower than the indicated capacity (but scheduled
scaling actions might, see below).

There are three ways to scale your capacity:

* **In response to a metric** (also known as step scaling); for example, you
  might want to scale out if the CPU usage across your cluster starts to rise,
  and scale in when it drops again.
* **By trying to keep a certain metric around a given value** (also known as
  target tracking scaling); you might want to automatically scale out an in to
  keep your CPU usage around 50%.
* **On a schedule**; you might want to organize your scaling around traffic
  flows you expect, by scaling out in the morning and scaling in in the
  evening.

The general pattern of autoscaling will look like this:

```ts
const capacity = resource.autoScaleCapacity({
  minCapacity: 5,
  maxCapacity: 100
});

// Enable a type of metric scaling and/or schedule scaling
capacity.scaleOnMetric(...);
capacity.scaleToTrackMetric(...);
capacity.scaleOnSchedule(...);
```

### Step Scaling

This type of scaling scales in and out in deterministic steps that you
configure, in response to metric values. For example, your scaling strategy
to scale in response to CPU usage might look like this:

```
 Scaling        -1          (no change)          +1       +3
            │        │                       │        │        │
            ├────────┼───────────────────────┼────────┼────────┤
            │        │                       │        │        │
CPU usage   0%      10%                     50%       70%     100%
```

(Note that this is not necessarily a recommended scaling strategy, but it's
a possible one. You will have to determine what thresholds are right for you).

You would configure it like this:

```ts
capacity.scaleOnMetric('ScaleToCPU', {
  metric: service.metricCpuUtilization(),
  scalingSteps: [
    { upper: 10, change: -1 },
    { lower: 50, change: +1 },
    { lower: 70, change: +3 },
  ],

  // Change this to AdjustmentType.PercentChangeInCapacity to interpret the
  // 'change' numbers before as percentages instead of capacity counts.
  adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
});
```

The AutoScaling construct library will create the required CloudWatch alarms and
AutoScaling policies for you.

### Target Tracking Scaling

This type of scaling scales in and out in order to keep a metric (typically
representing utilization) around a value you prefer. This type of scaling is
typically heavily service-dependent in what metric you can use, and so
different services will have different methods here to set up target tracking
scaling.

The following example configures the read capacity of a DynamoDB table
to be around 60% utilization:

```ts
const readCapacity = table.autoScaleReadCapacity({
  minCapacity: 10,
  maxCapacity: 1000
});
readCapacity.scaleOnUtilization({
  targetUtilizationPercent: 60
});
```

### Scheduled Scaling

This type of scaling is used to change capacities based on time. It works
by changing the `minCapacity` and `maxCapacity` of the attribute, and so
can be used for two purposes:

* Scale in and out on a schedule by setting the `minCapacity` high or
  the `maxCapacity` low.
* Still allow the regular scaling actions to do their job, but restrict
  the range they can scale over (by setting both `minCapacity` and
  `maxCapacity` but changing their range over time).

The following schedule expressions can be used:

* `at(yyyy-mm-ddThh:mm:ss)` -- scale at a particular moment in time
* `rate(value unit)` -- scale every minute/hour/day
* `cron(mm hh dd mm dow)` -- scale on arbitrary schedules

Of these, the cron expression is the most useful but also the most
complicated. A schedule is expressed as a cron expression. The `Schedule` class has a `cron` method to help build cron expressions.

The following example scales the fleet out in the morning, and lets natural
scaling take over at night:

```ts
const capacity = resource.autoScaleCapacity({
  minCapacity: 1,
  maxCapacity: 50,
});

capacity.scaleOnSchedule('PrescaleInTheMorning', {
  schedule: autoscaling.Schedule.cron({ hour: '8', minute: '0' }),
  minCapacity: 20,
});

capacity.scaleOnSchedule('AllowDownscalingAtNight', {
  schedule: autoscaling.Schedule.cron({ hour: '20', minute: '0' }),
  minCapacity: 1
});
```

### Suspending and Resuming Scalable Target

Suspending autoscaling on the resource temporarily pauses scaling activities triggered by scaling policies and scheduled actions.
This can be useful when you are making a change or investigating a configuration issue. The following example demonstrates the APIs
that will temporarily suspend autoscaling:

```ts
const capacity = resource.autoScaleCapacity({
  minCapacity: 1,
  maxCapacity: 50,
});

capacity.scaleOnSchedule('PrescaleInTheMorning', {
  schedule: autoscaling.Schedule.cron({ hour: '8', minute: '0' }),
  minCapacity: 20,
});

capacity.scaleOnMetric('ScaleToCPU', {
  metric: service.metricCpuUtilization(),
  scalingSteps: [
    { upper: 10, change: -1 },
    { lower: 50, change: +1 },
    { lower: 70, change: +3 },
  ],
});

// If you want to temporarily turn off your scheduled actions, you can add in this line.
capacity.suspendSchedules();

// If you want to temporarily turn off scaling out only, you can add in this line.
capacity.suspendDynamic(appscaling.Scale.OUT);

```

To resume your original autoscaling plans, you can remove the method call and redeploy.

## Examples

### Lambda Provisioned Concurrency Auto Scaling

```ts
   const handler = new lambda.Function(this, 'MyFunction', {
      runtime: lambda.Runtime.PYTHON_3_7,
      handler: 'index.handler',
      code: new lambda.InlineCode(`
import json, time
def handler(event, context):
    time.sleep(1)
    return {
        'statusCode': 200,
        'body': json.dumps('Hello CDK from Lambda!')
    }`),
      reservedConcurrentExecutions: 2,
    });
    
    const fnVer = handler.addVersion('CDKLambdaVersion', undefined, 'demo alias', 10);

    new apigateway.LambdaRestApi(this, 'API', { handler: fnVer })

    const target = new applicationautoscaling.ScalableTarget(this, 'ScalableTarget', {
      serviceNamespace: applicationautoscaling.ServiceNamespace.LAMBDA,
      maxCapacity: 100,
      minCapacity: 10,
      resourceId: `function:${handler.functionName}:${fnVer.version}`,
      scalableDimension: 'lambda:function:ProvisionedConcurrency',
    })
s
    target.scaleToTrackMetric('PceTracking', {
      targetValue: 0.9,
      predefinedMetric: applicationautoscaling.PredefinedMetric.LAMBDA_PROVISIONED_CONCURRENCY_UTILIZATION,
    })
  }
  ```
