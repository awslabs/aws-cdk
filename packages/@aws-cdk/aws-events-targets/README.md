# Event Targets for Amazon EventBridge
<!--BEGIN STABILITY BANNER-->

---

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->

This library contains integration classes to send Amazon EventBridge to any
number of supported AWS Services. Instances of these classes should be passed
to the `rule.addTarget()` method.

Currently supported are:

* [Start a CodeBuild build](#start-a-codebuild-build)
* [Start a CodePipeline pipeline](#start-a-codepipeline-pipeline)
* Run an ECS task
* [Invoke a Lambda function](#invoke-a-lambda-function)
* [Invoke a API Gateway REST API](#invoke-a-api-gateway-rest-api)
* Publish a message to an SNS topic
* Send a message to an SQS queue
* [Start a StepFunctions state machine](#start-a-stepfunctions-state-machine)
* [Queue a Batch job](#queue-a-batch-job)
* Make an AWS API call
* Put a record to a Kinesis stream
* [Log an event into a LogGroup](#log-an-event-into-a-loggroup)
* Put a record to a Kinesis Data Firehose stream
* Put an event on an EventBridge bus
* [Send an event to EventBridge API Destination](#invoke-a-api-destination)

See the README of the `@aws-cdk/aws-events` library for more information on
EventBridge.

## Event retry policy and using dead-letter queues

The Codebuild, CodePipeline, Lambda, StepFunctions and LogGroup targets support attaching a [dead letter queue and setting retry policies](https://docs.aws.amazon.com/eventbridge/latest/userguide/rule-dlq.html). See the [lambda example](#invoke-a-lambda-function).
Use [escape hatches](https://docs.aws.amazon.com/cdk/latest/guide/cfn_layer.html) for the other target types.

## Invoke a Lambda function

Use the `LambdaFunction` target to invoke a lambda function.

The code snippet below creates an event rule with a Lambda function as a target
triggered for every events from `aws.ec2` source. You can optionally attach a
[dead letter queue](https://docs.aws.amazon.com/eventbridge/latest/userguide/rule-dlq.html).

```ts
import * as lambda from '@aws-cdk/aws-lambda';

const fn = new lambda.Function(this, 'MyFunc', {
  runtime: lambda.Runtime.NODEJS_12_X,
  handler: 'index.handler',
  code: lambda.Code.fromInline(`exports.handler = handler.toString()`),
});

const rule = new events.Rule(this, 'rule', {
  eventPattern: {
    source: ["aws.ec2"],
  },
});

const queue = new sqs.Queue(this, 'Queue');

rule.addTarget(new targets.LambdaFunction(fn, {
  deadLetterQueue: queue, // Optional: add a dead letter queue
  maxEventAge: cdk.Duration.hours(2), // Otional: set the maxEventAge retry policy
  retryAttempts: 2, // Optional: set the max number of retry attempts
}));
```

## Log an event into a LogGroup

Use the `LogGroup` target to log your events in a CloudWatch LogGroup.

For example, the following code snippet creates an event rule with a CloudWatch LogGroup as a target.
Every events sent from the `aws.ec2` source will be sent to the CloudWatch LogGroup.

```ts
import * as logs from '@aws-cdk/aws-logs';

const logGroup = new logs.LogGroup(this, 'MyLogGroup', {
  logGroupName: 'MyLogGroup',
});

const rule = new events.Rule(this, 'rule', {
  eventPattern: {
    source: ["aws.ec2"],
  },
});

rule.addTarget(new targets.CloudWatchLogGroup(logGroup));
```

## Start a CodeBuild build

Use the `CodeBuildProject` target to trigger a CodeBuild project.

The code snippet below creates a CodeCommit repository that triggers a CodeBuild project
on commit to the master branch. You can optionally attach a
[dead letter queue](https://docs.aws.amazon.com/eventbridge/latest/userguide/rule-dlq.html).

```ts
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codecommit from '@aws-cdk/aws-codecommit';

const repo = new codecommit.Repository(this, 'MyRepo', {
  repositoryName: 'aws-cdk-codebuild-events',
});

const project = new codebuild.Project(this, 'MyProject', {
  source: codebuild.Source.codeCommit({ repository: repo }),
});

const deadLetterQueue = new sqs.Queue(this, 'DeadLetterQueue');

// trigger a build when a commit is pushed to the repo
const onCommitRule = repo.onCommit('OnCommit', {
  target: new targets.CodeBuildProject(project, {
    deadLetterQueue: deadLetterQueue,
  }),
  branches: ['master'],
});
```

## Start a CodePipeline pipeline

Use the `CodePipeline` target to trigger a CodePipeline pipeline.

The code snippet below creates a CodePipeline pipeline that is triggered every hour

```ts
import * as codepipeline from '@aws-cdk/aws-codepipeline';

const pipeline = new codepipeline.Pipeline(this, 'Pipeline');

const rule = new events.Rule(this, 'Rule', {
  schedule: events.Schedule.expression('rate(1 hour)'),
});

rule.addTarget(new targets.CodePipeline(pipeline));
```

## Start a StepFunctions state machine

Use the `SfnStateMachine` target to trigger a State Machine.

The code snippet below creates a Simple StateMachine that is triggered every minute with a
dummy object as input.
You can optionally attach a
[dead letter queue](https://docs.aws.amazon.com/eventbridge/latest/userguide/rule-dlq.html)
to the target.

```ts
import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';

const rule = new events.Rule(this, 'Rule', {
  schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
});

const dlq = new sqs.Queue(this, 'DeadLetterQueue');

const role = new iam.Role(this, 'Role', {
  assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
});
const stateMachine = new sfn.StateMachine(this, 'SM', {
  definition: new sfn.Wait(this, 'Hello', { time: sfn.WaitTime.duration(cdk.Duration.seconds(10)) }),
  role,
});

rule.addTarget(new targets.SfnStateMachine(stateMachine, {
  input: events.RuleTargetInput.fromObject({ SomeParam: 'SomeValue' }),
  deadLetterQueue: dlq,
}));
```

## Queue a Batch job

Use the `BatchJob` target to queue a Batch job.

The code snippet below creates a Simple JobQueue that is triggered every hour with a
dummy object as input.
You can optionally attach a
[dead letter queue](https://docs.aws.amazon.com/eventbridge/latest/userguide/rule-dlq.html)
to the target.

```ts
import * as batch from '@aws-cdk/aws-batch';
import { ContainerImage } from '@aws-cdk/aws-ecs';

const jobQueue = new batch.JobQueue(this, 'MyQueue', {
  computeEnvironments: [
    {
      computeEnvironment: new batch.ComputeEnvironment(this, 'ComputeEnvironment', {
        managed: false,
      }),
      order: 1,
    },
  ],
});

const jobDefinition = new batch.JobDefinition(this, 'MyJob', {
  container: {
    image: ContainerImage.fromRegistry('test-repo'),
  },
});

const queue = new sqs.Queue(this, 'Queue');

const rule = new events.Rule(this, 'Rule', {
  schedule: events.Schedule.rate(cdk.Duration.hours(1)),
});

rule.addTarget(new targets.BatchJob(
  jobQueue.jobQueueArn,
  jobQueue,
  jobDefinition.jobDefinitionArn,
  jobDefinition, {
    deadLetterQueue: queue,
    event: events.RuleTargetInput.fromObject({ SomeParam: 'SomeValue' }),
    retryAttempts: 2,
    maxEventAge: cdk.Duration.hours(2),
  },
));
```

## Invoke a API Gateway REST API

Use the `ApiGateway` target to trigger a REST API.

The code snippet below creates a Api Gateway REST API that is invoked every hour.

```ts
import * as api from '@aws-cdk/aws-apigateway';
import * as lambda from '@aws-cdk/aws-lambda';

const rule = new events.Rule(this, 'Rule', {
  schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
});

const fn = new lambda.Function( this, 'MyFunc', {
  handler: 'index.handler',
  runtime: lambda.Runtime.NODEJS_12_X,
  code: lambda.Code.fromInline( 'exports.handler = e => {}' ),
} );

const restApi = new api.LambdaRestApi( this, 'MyRestAPI', { handler: fn } );

const dlq = new sqs.Queue(this, 'DeadLetterQueue');

rule.addTarget(
  new targets.ApiGateway( restApi, {
    path: '/*/test',
    method: 'GET',
    stage:  'prod',
    pathParameterValues: ['path-value'],
    headerParameters: {
      Header1: 'header1',
    },
    queryStringParameters: {
      QueryParam1: 'query-param-1',
    },
    deadLetterQueue: dlq
  } ),
)
```

## Invoke a API Destination

Use the `apidestination` target to trigger an external API.

The code snippet below creates an external destination that is invoked every hour.

```typescript
import * as events from "@aws-cdk/aws-events";
import * as targets from "@aws-cdk/aws-events-targets";

const rule = new events.Rule(stack, 'Rule', {
  schedule: events.Schedule.rate(cdk.Duration.hours(1)),
});

const connection = new events.Connection(this, 'Connection', {
  authorizationType: events.AuthorizationType.API_KEY,
  authParameters: {
    apiKeyAuthParameters: {
      apiKeyName: 'x-api-key',
      apiKeyValue: 'api-key-value',
    },
  },
  description: 'ConnectionDescription',
  connectionName: 'testConnection',
});
  
const destination = new events.ApiDestination(this, 'Destination', {
  apiDestinationName: 'apiDestinationName',
  connection: connection,
  invocationEndpoint: 'https://example.com',
  invocationRateLimit: cdk.Duration.seconds(10),
  httpMethod: events.HttpMethod.GET
});

const rule = new events.Rule(this, 'Rule', {
  schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
});

rule.addTarget(new targets.ApiDestination(destination));
```
