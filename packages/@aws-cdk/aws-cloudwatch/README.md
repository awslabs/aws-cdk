# Amazon CloudWatch Construct Library
<!--BEGIN STABILITY BANNER-->

---

![cfn-resources: Stable](https://img.shields.io/badge/cfn--resources-stable-success.svg?style=for-the-badge)

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->

## Metric objects

Metric objects represent a metric that is emitted by AWS services or your own
application, such as `CPUUsage`, `FailureCount` or `Bandwidth`.

Metric objects can be constructed directly or are exposed by resources as
attributes. Resources that expose metrics will have functions that look
like `metricXxx()` which will return a Metric object, initialized with defaults
that make sense.

For example, `lambda.Function` objects have the `fn.metricErrors()` method, which
represents the amount of errors reported by that Lambda function:

```ts
const errors = fn.metricErrors();
```

You can also instantiate `Metric` objects to reference any
[published metric](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/aws-services-cloudwatch-metrics.html)
that's not exposed using a convenience method on the CDK construct.
For example:

```ts
const hostedZone = new route53.HostedZone(this, 'MyHostedZone', { zoneName: "example.org" });
const metric = new Metric({
  namespace: 'AWS/Route53',
  metricName: 'DNSQueries',
  dimensionsMap: {
    HostedZoneId: hostedZone.hostedZoneId
  }
})
```

### Instantiating a new Metric object

If you want to reference a metric that is not yet exposed by an existing construct,
you can instantiate a `Metric` object to represent it. For example:

```ts
const metric = new Metric({
  namespace: 'MyNamespace',
  metricName: 'MyMetric',
  dimensionsMap: {
    ProcessingStep: 'Download'
  }
});
```

### Metric Math

Math expressions are supported by instantiating the `MathExpression` class.
For example, a math expression that sums two other metrics looks like this:

```ts
const allProblems = new MathExpression({
  expression: "errors + faults",
  usingMetrics: {
    errors: myConstruct.metricErrors(),
    faults: myConstruct.metricFaults(),
  }
})
```

You can use `MathExpression` objects like any other metric, including using
them in other math expressions:

```ts
const problemPercentage = new MathExpression({
  expression: "(problems / invocations) * 100",
  usingMetrics: {
    problems: allProblems,
    invocations: myConstruct.metricInvocations()
  }
})
```

### Aggregation

To graph or alarm on metrics you must aggregate them first, using a function
like `Average` or a percentile function like `P99`. By default, most Metric objects
returned by CDK libraries will be configured as `Average` over `300 seconds` (5 minutes).
The exception is if the metric represents a count of discrete events, such as
failures. In that case, the Metric object will be configured as `Sum` over `300
seconds`, i.e. it represents the number of times that event occurred over the
time period.

If you want to change the default aggregation of the Metric object (for example,
the function or the period), you can do so by passing additional parameters
to the metric function call:

```ts
const minuteErrorRate = fn.metricErrors({
  statistic: 'avg',
  period: Duration.minutes(1),
  label: 'Lambda failure rate'
});
```

This function also allows changing the metric label or color (which will be
useful when embedding them in graphs, see below).

> Rates versus Sums
>
> The reason for using `Sum` to count discrete events is that *some* events are
> emitted as either `0` or `1` (for example `Errors` for a Lambda) and some are
> only emitted as `1` (for example `NumberOfMessagesPublished` for an SNS
> topic).
>
> In case `0`-metrics are emitted, it makes sense to take the `Average` of this
> metric: the result will be the fraction of errors over all executions.
>
> If `0`-metrics are not emitted, the `Average` will always be equal to `1`,
> and not be very useful.
>
> In order to simplify the mental model of `Metric` objects, we default to
> aggregating using `Sum`, which will be the same for both metrics types. If you
> happen to know the Metric you want to alarm on makes sense as a rate
> (`Average`) you can always choose to change the statistic.

## Alarms

Alarms can be created on metrics in one of two ways. Either create an `Alarm`
object, passing the `Metric` object to set the alarm on:


```ts
new Alarm(this, 'Alarm', {
  metric: fn.metricErrors(),
  threshold: 100,
  evaluationPeriods: 2,
});
```

Alternatively, you can call `metric.createAlarm()`:

```ts
fn.metricErrors().createAlarm(this, 'Alarm', {
  threshold: 100,
  evaluationPeriods: 2,
});
```

The most important properties to set while creating an Alarms are:

- `threshold`: the value to compare the metric against.
- `comparisonOperator`: the comparison operation to use, defaults to `metric >= threshold`.
- `evaluationPeriods`: how many consecutive periods the metric has to be
  breaching the the threshold for the alarm to trigger.

### Alarm Actions

To add actions to an alarm, use the integration classes from the
`@aws-cdk/aws-cloudwatch-actions` package. For example, to post a message to
an SNS topic when an alarm breaches, do the following:

```ts
import * as cw_actions from '@aws-cdk/aws-cloudwatch-actions';

// ...
const topic = new sns.Topic(stack, 'Topic');
const alarm = new cloudwatch.Alarm(stack, 'Alarm', { /* ... */ });

alarm.addAlarmAction(new cw_actions.SnsAction(topic));
```

### Composite Alarms

[Composite Alarms](https://aws.amazon.com/about-aws/whats-new/2020/03/amazon-cloudwatch-now-allows-you-to-combine-multiple-alarms/) 
can be created from existing Alarm resources.

```ts
const alarmRule = AlarmRule.anyOf(
  AlarmRule.allOf(
    AlarmRule.anyOf(
      alarm1,
      AlarmRule.fromAlarm(alarm2, AlarmState.OK),
      alarm3,
    ),
    AlarmRule.not(AlarmRule.fromAlarm(alarm4, AlarmState.INSUFFICIENT_DATA)),
  ),
  AlarmRule.fromBoolean(false),
);

new CompositeAlarm(this, 'MyAwesomeCompositeAlarm', {
  alarmRule,
});
```

### A note on units

In CloudWatch, Metrics datums are emitted with units, such as `seconds` or
`bytes`. When `Metric` objects are given a `unit` attribute, it will be used to
*filter* the stream of metric datums for datums emitted using the same `unit`
attribute.

In particular, the `unit` field is *not* used to rescale datums or alarm threshold
values (for example, it cannot be used to specify an alarm threshold in
*Megabytes* if the metric stream is being emitted as *bytes*).

You almost certainly don't want to specify the `unit` property when creating
`Metric` objects (which will retrieve all datums regardless of their unit),
unless you have very specific requirements. Note that in any case, CloudWatch
only supports filtering by `unit` for Alarms, not in Dashboard graphs.

Please see the following GitHub issue for a discussion on real unit
calculations in CDK: https://github.com/aws/aws-cdk/issues/5595

## Dashboards

Dashboards are set of Widgets stored server-side which can be accessed quickly
from the AWS console. Available widgets are graphs of a metric over time, the
current value of a metric, or a static piece of Markdown which explains what the
graphs mean.

The following widgets are available:

- `GraphWidget` -- shows any number of metrics on both the left and right
  vertical axes.
- `AlarmWidget` -- shows the graph and alarm line for a single alarm.
- `SingleValueWidget` -- shows the current value of a set of metrics.
- `TextWidget` -- shows some static Markdown.
- `AlarmStatusWidget` -- shows the status of your alarms in a grid view.

### Graph widget

A graph widget can display any number of metrics on either the `left` or
`right` vertical axis:

```ts
dashboard.addWidgets(new GraphWidget({
  title: "Executions vs error rate",

  left: [executionCountMetric],

  right: [errorCountMetric.with({
    statistic: "average",
    label: "Error rate",
    color: Color.GREEN
  })]
}));
```

Using the methods `addLeftMetric()` and `addRightMetric()` you can add metrics to a graph widget later on.

Graph widgets can also display annotations attached to the left or the right y-axis.

```ts
dashboard.addWidgets(new GraphWidget({
  // ...
  // ...

  leftAnnotations: [
    { value: 1800, label: Duration.minutes(30).toHumanString(), color: Color.RED, },
    { value: 3600, label: '1 hour', color: '#2ca02c', }
  ],
}));
```

The graph legend can be adjusted from the default position at bottom of the widget.

```ts
dashboard.addWidgets(new GraphWidget({
  // ...
  // ...

  legendPosition: LegendPosition.RIGHT,
}));
```

The graph can publish live data within the last minute that has not been fully aggregated.

```ts
dashboard.addWidgets(new GraphWidget({
  // ...
  // ...

  liveData: true,
}));
```

The graph view can be changed from default 'timeSeries' to 'bar' or 'pie'.

```ts
dashboard.addWidgets(new GraphWidget({
  // ...
  // ...

  view: GraphWidgetView.BAR,
}));
```

### Alarm widget

An alarm widget shows the graph and the alarm line of a single alarm:

```ts
dashboard.addWidgets(new AlarmWidget({
  title: "Errors",
  alarm: errorAlarm,
}));
```

### Single value widget

A single-value widget shows the latest value of a set of metrics (as opposed
to a graph of the value over time):

```ts
dashboard.addWidgets(new SingleValueWidget({
  metrics: [visitorCount, purchaseCount],
}));
```

Show as many digits as can fit, before rounding.

```ts
dashboard.addWidgets(new SingleValueWidget({
  // ..
  // ..

  fullPrecision: true,
}));
```

### Text widget

A text widget shows an arbitrary piece of MarkDown. Use this to add explanations
to your dashboard:

```ts
dashboard.addWidgets(new TextWidget({
  markdown: '# Key Performance Indicators'
}));
```

### Alarm Status widget

An alarm status widget displays instantly the status of any type of alarms and gives the
ability to aggregate one or more alarms together in a small surface.

```ts
dashboard.addWidgets(
  new AlarmStatusWidget({
    alarms: [errorAlarm],
  })
);
```

### Query results widget

A `LogQueryWidget` shows the results of a query from Logs Insights:

```ts
dashboard.addWidgets(new LogQueryWidget({
  logGroupNames: ['my-log-group'],
  view: LogQueryVisualizationType.TABLE,
  // The lines will be automatically combined using '\n|'.
  queryLines: [
    'fields @message',
    'filter @message like /Error/',
  ]
}));
```

### Dashboard Layout

The widgets on a dashboard are visually laid out in a grid that is 24 columns
wide. Normally you specify X and Y coordinates for the widgets on a Dashboard,
but because this is inconvenient to do manually, the library contains a simple
layout system to help you lay out your dashboards the way you want them to.

Widgets have a `width` and `height` property, and they will be automatically
laid out either horizontally or vertically stacked to fill out the available
space.

Widgets are added to a Dashboard by calling `add(widget1, widget2, ...)`.
Widgets given in the same call will be laid out horizontally. Widgets given
in different calls will be laid out vertically. To make more complex layouts,
you can use the following widgets to pack widgets together in different ways:

- `Column`: stack two or more widgets vertically.
- `Row`: lay out two or more widgets horizontally.
- `Spacer`: take up empty space
