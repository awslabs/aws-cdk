# Amazon EventBridge Construct Library
<!--BEGIN STABILITY BANNER-->

---

![cfn-resources: Stable](https://img.shields.io/badge/cfn--resources-stable-success.svg?style=for-the-badge)

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->

Amazon EventBridge delivers a near real-time stream of system events that
describe changes in AWS resources. For example, an AWS CodePipeline emits the
[State
Change](https://docs.aws.amazon.com/eventbridge/latest/userguide/event-types.html#codepipeline-event-type)
event when the pipeline changes its state.

* __Events__: An event indicates a change in your AWS environment. AWS resources
  can generate events when their state changes. For example, Amazon EC2
  generates an event when the state of an EC2 instance changes from pending to
  running, and Amazon EC2 Auto Scaling generates events when it launches or
  terminates instances. AWS CloudTrail publishes events when you make API calls.
  You can generate custom application-level events and publish them to
  EventBridge. You can also set up scheduled events that are generated on
  a periodic basis. For a list of services that generate events, and sample
  events from each service, see [EventBridge Event Examples From Each
  Supported
  Service](https://docs.aws.amazon.com/eventbridge/latest/userguide/event-types.html).
* __Targets__: A target processes events. Targets can include Amazon EC2
  instances, AWS Lambda functions, Kinesis streams, Amazon ECS tasks, Step
  Functions state machines, Amazon SNS topics, Amazon SQS queues, Amazon CloudWatch LogGroups, and built-in
  targets. A target receives events in JSON format.
* __Rules__: A rule matches incoming events and routes them to targets for
  processing. A single rule can route to multiple targets, all of which are
  processed in parallel. Rules are not processed in a particular order. This
  enables different parts of an organization to look for and process the events
  that are of interest to them. A rule can customize the JSON sent to the
  target, by passing only certain parts or by overwriting it with a constant.
* __EventBuses__: An event bus can receive events from your own custom applications
  or it can receive events from applications and services created by AWS SaaS partners.
  See [Creating an Event Bus](https://docs.aws.amazon.com/eventbridge/latest/userguide/create-event-bus.html).

## Rule

The `Rule` construct defines an EventBridge rule which monitors an
event based on an [event
pattern](https://docs.aws.amazon.com/eventbridge/latest/userguide/filtering-examples-structure.html)
and invoke __event targets__ when the pattern is matched against a triggered
event. Event targets are objects that implement the `IRuleTarget` interface.

Normally, you will use one of the `source.onXxx(name[, target[, options]]) ->
Rule` methods on the event source to define an event rule associated with
the specific activity. You can targets either via props, or add targets using
`rule.addTarget`.

For example, to define an rule that triggers a CodeBuild project build when a
commit is pushed to the "master" branch of a CodeCommit repository:

```ts
const onCommitRule = repo.onCommit('OnCommit', {
  target: new targets.CodeBuildProject(project),
  branches: ['master']
});
```

You can add additional targets, with optional [input
transformer](https://docs.aws.amazon.com/eventbridge/latest/APIReference/API_InputTransformer.html)
using `eventRule.addTarget(target[, input])`. For example, we can add a SNS
topic target which formats a human-readable message for the commit.

For example, this adds an SNS topic as a target:

```ts
onCommitRule.addTarget(new targets.SnsTopic(topic, {
  message: events.RuleTargetInput.fromText(
    `A commit was pushed to the repository ${codecommit.ReferenceEvent.repositoryName} on branch ${codecommit.ReferenceEvent.referenceName}`
  )
}));
```

Or using an Object:

```ts
onCommitRule.addTarget(new targets.SnsTopic(topic, {
  message: events.RuleTargetInput.fromObject(
    {
      DataType: `custom_${events.EventField.fromPath('$.detail-type')}`
    }
  )
}));
```

## Scheduling

You can configure a Rule to run on a schedule (cron or rate).
Rate must be specified in minutes, hours or days.

The following example runs a task every day at 4am:

```ts
import { Rule, Schedule } from '@aws-cdk/aws-events';
import { EcsTask } from '@aws-cdk/aws-events-targets';
...

const ecsTaskTarget = new EcsTask({ cluster, taskDefinition, role });

new Rule(this, 'ScheduleRule', {
 schedule: Schedule.cron({ minute: '0', hour: '4' }),
 targets: [ecsTaskTarget],
});
```

If you want to specify Fargate platform version, set `platformVersion` in EcsTask's props like the following example:

```ts
const platformVersion = ecs.FargatePlatformVersion.VERSION1_4;
const ecsTaskTarget = new EcsTask({ cluster, taskDefinition, role, platformVersion });
```

## Event Targets

The `@aws-cdk/aws-events-targets` module includes classes that implement the `IRuleTarget`
interface for various AWS services.

The following targets are supported:

* `targets.CodeBuildProject`: Start an AWS CodeBuild build
* `targets.CodePipeline`: Start an AWS CodePipeline pipeline execution
* `targets.EcsTask`: Start a task on an Amazon ECS cluster
* `targets.LambdaFunction`: Invoke an AWS Lambda function
* `targets.SnsTopic`: Publish into an SNS topic
* `targets.SqsQueue`: Send a message to an Amazon SQS Queue
* `targets.SfnStateMachine`: Trigger an AWS Step Functions state machine
* `targets.BatchJob`: Queue an AWS Batch Job
* `targets.AwsApi`: Make an AWS API call

### Cross-account targets

It's possible to have the source of the event and a target in separate AWS accounts:

```ts
import { App, Stack } from '@aws-cdk/core';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codecommit from '@aws-cdk/aws-codecommit';
import * as targets from '@aws-cdk/aws-events-targets';

const app = new App();

const stack1 = new Stack(app, 'Stack1', { env: { account: account1, region: 'us-east-1' } });
const repo = new codecommit.Repository(stack1, 'Repository', {
  // ...
});

const stack2 = new Stack(app, 'Stack2', { env: { account: account2, region: 'us-east-1' } });
const project = new codebuild.Project(stack2, 'Project', {
  // ...
});

repo.onCommit('OnCommit', {
  target: new targets.CodeBuildProject(project),
});
```

In this situation, the CDK will wire the 2 accounts together:

* It will generate a rule in the source stack with the event bus of the target account as the target
* It will generate a rule in the target stack, with the provided target
* It will generate a separate stack that gives the source account permissions to publish events
  to the event bus of the target account in the given region,
  and make sure its deployed before the source stack

**Note**: while events can span multiple accounts, they _cannot_ span different regions
(that is an EventBridge, not CDK, limitation).

For more information, see the
[AWS documentation on cross-account events](https://docs.aws.amazon.com/eventbridge/latest/userguide/eventbridge-cross-account-event-delivery.html).

## Archiving

It is possible to archive all or some events sent to an event bus. It is then possible to [replay these events](https://aws.amazon.com/blogs/aws/new-archive-and-replay-events-with-amazon-eventbridge/).

```ts
import * as cdk from '@aws-cdk/core';

const stack = new stack();

const bus = new EventBus(stack, 'bus', {
  eventBusName: 'MyCustomEventBus'
});

bus.archive('MyArchive', {
  archiveName: 'MyCustomEventBusArchive',
  description: 'MyCustomerEventBus Archive',
  eventPattern: {
    account: [stack.account],
  },
  retention: cdk.Duration.days(365),
});
```

## Granting PutEvents to an existing EventBus

To import an existing EventBus into your CDK application, use `EventBus.fromEventBusArn`, `EventBus.fromEventBusAttributes`
or `EventBus.fromEventBusName` factory method.

Then, you can use the `grantPutEventsTo` method to grant `event:PutEvents` to the eventBus.

```ts
const eventBus = EventBus.fromEventBusArn(this, 'ImportedEventBus', 'arn:aws:events:us-east-1:111111111:event-bus/my-event-bus');

// now you can just call methods on the eventbus
eventBus.grantPutEventsTo(lambdaFunction);
```
