# Tasks for AWS Step Functions
<!--BEGIN STABILITY BANNER-->

---

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->

[AWS Step Functions](https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html) is a web service that enables you to coordinate the
components of distributed applications and microservices using visual workflows.
You build applications from individual components that each perform a discrete
function, or task, allowing you to scale and change applications quickly.

A [Task](https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-task-state.html) state represents a single unit of work performed by a state machine.
All work in your state machine is performed by tasks.

This module is part of the [AWS Cloud Development Kit](https://github.com/aws/aws-cdk) project.

## Table Of Contents

- [Task](#task)
- [Paths](#paths)
  - [InputPath](#inputpath)
  - [OutputPath](#outputpath)
  - [ResultPath](#resultpath)
- [Parameters](#task-parameters-from-the-state-json)
- [Evaluate Expression](#evaluate-expression)
- [Athena](#athena)
  - [StartQueryExecution](#startQueryExecution)
  - [GetQueryExecution](#getQueryExecution)
  - [GetQueryResults](#getQueryResults)
  - [StopQueryExecution](#stopQueryExecution)
- [Batch](#batch)
  - [SubmitJob](#submitjob)
- [CodeBuild](#codebuild)
  - [StartBuild](#startbuild)
- [DynamoDB](#dynamodb)
  - [GetItem](#getitem)
  - [PutItem](#putitem)
  - [DeleteItem](#deleteitem)
  - [UpdateItem](#updateitem)
- [ECS](#ecs)
  - [RunTask](#runtask)
    - [EC2](#ec2)
    - [Fargate](#fargate)
- [EMR](#emr)
  - [Create Cluster](#create-cluster)
  - [Termination Protection](#termination-protection)
  - [Terminate Cluster](#terminate-cluster)
  - [Add Step](#add-step)
  - [Cancel Step](#cancel-step)
  - [Modify Instance Fleet](#modify-instance-fleet)
  - [Modify Instance Group](#modify-instance-group)
- [EKS](#eks)
  - [Create Fargate Profile](#create-fargate-profile)
  - [Delete Fargate Profile](#delete-fargate-profile)
- [Glue](#glue)
- [Lambda](#lambda)
- [SageMaker](#sagemaker)
  - [Create Training Job](#create-training-job)
  - [Create Transform Job](#create-transform-job)
  - [Create Endpoint](#create-endpoint)
  - [Create Endpoint Config](#create-endpoint-config)
  - [Create Model](#create-model)
  - [Update Endpoint](#update-endpoint)
- [SNS](#sns)
- [Step Functions](#step-functions)
  - [Start Execution](#start-execution)
  - [Invoke Activity Worker](#invoke-activity)
- [SQS](#sqs)

## Task

A Task state represents a single unit of work performed by a state machine. In the
CDK, the exact work to be done is determined by a class that implements `IStepFunctionsTask`.

AWS Step Functions [integrates](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-service-integrations.html) with some AWS services so that you can call API
actions, and coordinate executions directly from the Amazon States Language in
Step Functions. You can directly call and pass parameters to the APIs of those
services.

## Paths

In the Amazon States Language, a [path](https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-paths.html) is a string beginning with `$` that you
can use to identify components within JSON text.

Learn more about input and output processing in Step Functions [here](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-input-output-filtering.html)

### InputPath

Both `InputPath` and `Parameters` fields provide a way to manipulate JSON as it
moves through your workflow. AWS Step Functions applies the `InputPath` field first,
and then the `Parameters` field. You can first filter your raw input to a selection
you want using InputPath, and then apply Parameters to manipulate that input
further, or add new values. If you don't specify an `InputPath`, a default value
of `$` will be used.

The following example provides the field named `input` as the input to the `Task`
state that runs a Lambda function.

```ts
const submitJob = new tasks.LambdaInvoke(stack, 'Invoke Handler', {
  lambdaFunction: submitJobLambda,
  inputPath: '$.input'
});
```

### OutputPath

Tasks also allow you to select a portion of the state output to pass to the next
state. This enables you to filter out unwanted information, and pass only the
portion of the JSON that you care about. If you don't specify an `OutputPath`,
a default value of `$` will be used. This passes the entire JSON node to the next
state.

The [response](https://docs.aws.amazon.com/lambda/latest/dg/API_Invoke.html#API_Invoke_ResponseSyntax) from a Lambda function includes the response from the function
as well as other metadata.

The following example assigns the output from the Task to a field named `result`

```ts
const submitJob = new tasks.LambdaInvoke(stack, 'Invoke Handler', {
  lambdaFunction: submitJobLambda,
  outputPath: '$.Payload.result'
});
```

### ResultPath

The output of a state can be a copy of its input, the result it produces (for
example, output from a Task state’s Lambda function), or a combination of its
input and result. Use [`ResultPath`](https://docs.aws.amazon.com/step-functions/latest/dg/input-output-resultpath.html) to control which combination of these is
passed to the state output. If you don't specify an `ResultPath`, a default
value of `$` will be used.

The following example adds the item from calling DynamoDB's `getItem` API to the state
input and passes it to the next state.

```ts
new tasks.DynamoGetItem(this, 'PutItem', {
  item: { MessageId: { s: '12345'} },
  tableName: 'my-table',
  resultPath: `$.Item`,
});
```

⚠️ The `OutputPath` is computed after applying `ResultPath`. All service integrations
return metadata as part of their response. When using `ResultPath`, it's not possible to
merge a subset of the task output to the input.

## Task parameters from the state JSON

Most tasks take parameters. Parameter values can either be static, supplied directly
in the workflow definition (by specifying their values), or a value available at runtime
in the state machine's execution (either as its input or an output of a prior state).
Parameter values available at runtime can be specified via the `JsonPath` class,
using methods such as `JsonPath.stringAt()`.

The following example provides the field named `input` as the input to the Lambda function
and invokes it asynchronously.

```ts
const submitJob = new tasks.LambdaInvoke(stack, 'Invoke Handler', {
  lambdaFunction: submitJobLambda,
  payload: sfn.JsonPath.StringAt('$.input'),
  invocationType: tasks.InvocationType.EVENT,
});
```

Each service integration has its own set of parameters that can be supplied.

## Evaluate Expression

Use the `EvaluateExpression` to perform simple operations referencing state paths. The
`expression` referenced in the task will be evaluated in a Lambda function
(`eval()`). This allows you to not have to write Lambda code for simple operations.

Example: convert a wait time from milliseconds to seconds, concat this in a message and wait:

```ts
const convertToSeconds = new tasks.EvaluateExpression(this, 'Convert to seconds', {
  expression: '$.waitMilliseconds / 1000',
  resultPath: '$.waitSeconds',
});

const createMessage = new tasks.EvaluateExpression(this, 'Create message', {
  // Note: this is a string inside a string.
    expression: '`Now waiting ${$.waitSeconds} seconds...`',
    runtime: lambda.Runtime.NODEJS_10_X,
  resultPath: '$.message',
});

const publishMessage = new tasks.SnsPublish(this, 'Publish message', {
  topic,
  message: sfn.TaskInput.fromDataAt('$.message'),
  resultPath: '$.sns',
});

const wait = new sfn.Wait(this, 'Wait', {
  time: sfn.WaitTime.secondsPath('$.waitSeconds')
});

new sfn.StateMachine(this, 'StateMachine', {
  definition: convertToSeconds
    .next(createMessage)
    .next(publishMessage)
    .next(wait)
});
```

The `EvaluateExpression` supports a `runtime` prop to specify the Lambda
runtime to use to evaluate the expression. Currently, the only runtime
supported is `lambda.Runtime.NODEJS_10_X`.


## Athena

Step Functions supports [Athena](https://docs.aws.amazon.com/step-functions/latest/dg/connect-athena.html) through the service integration pattern.

### StartQueryExecution

The [StartQueryExecution](https://docs.aws.amazon.com/athena/latest/APIReference/API_StartQueryExecution.html) API runs the SQL query statement.

```ts
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as tasks from `@aws-cdk/aws-stepfunctions-tasks`;

const startQueryExecutionJob = new tasks.AthenaStartQueryExecution(stack, 'Start Athena Query', {
  queryString: sfn.JsonPath.stringAt('$.queryString'),
  queryExecutionContext: {
    database: 'mydatabase',
  },
  resultConfiguration: {
    encryptionConfiguration: {
      encryptionOption: tasks.EncryptionOption.S3_MANAGED,
    },
    outputLocation: sfn.JsonPath.stringAt('$.outputLocation'),
  },
});
```

### GetQueryExecution

The [GetQueryExecution](https://docs.aws.amazon.com/athena/latest/APIReference/API_GetQueryExecution.html) API gets information about a single execution of a query.

```ts
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as tasks from `@aws-cdk/aws-stepfunctions-tasks`;

const getQueryExecutionJob = new tasks.AthenaGetQueryExecution(stack, 'Get Query Execution', {
  queryExecutionId: sfn.JsonPath.stringAt('$.QueryExecutionId'),
});
```

### GetQueryResults

The [GetQueryResults](https://docs.aws.amazon.com/athena/latest/APIReference/API_GetQueryResults.html) API that streams the results of a single query execution specified by QueryExecutionId from S3.

```ts
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as tasks from `@aws-cdk/aws-stepfunctions-tasks`;

const getQueryResultsJob = new tasks.AthenaGetQueryResults(stack, 'Get Query Results', {
  queryExecutionId: sfn.JsonPath.stringAt('$.QueryExecutionId'),
});
```

### StopQueryExecution

The [StopQueryExecution](https://docs.aws.amazon.com/athena/latest/APIReference/API_StopQueryExecution.html) API that stops a query execution.

```ts
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as tasks from `@aws-cdk/aws-stepfunctions-tasks`;

const stopQueryExecutionJob = new tasks.AthenaStopQueryExecution(stack, 'Stop Query Execution', {
  queryExecutionId: sfn.JsonPath.stringAt('$.QueryExecutionId'),
});
```

## Batch

Step Functions supports [Batch](https://docs.aws.amazon.com/step-functions/latest/dg/connect-batch.html) through the service integration pattern.

### SubmitJob

The [SubmitJob](https://docs.aws.amazon.com/batch/latest/APIReference/API_SubmitJob.html) API submits an AWS Batch job from a job definition.

```ts
import * as batch from '@aws-cdk/aws-batch';
import * as tasks from '@aws-cdk/aws-stepfunctions-tasks';

const batchQueue = new batch.JobQueue(this, 'JobQueue', {
  computeEnvironments: [
    {
      order: 1,
      computeEnvironment: new batch.ComputeEnvironment(this, 'ComputeEnv', {
        computeResources: { vpc },
      }),
    },
  ],
});

const batchJobDefinition = new batch.JobDefinition(this, 'JobDefinition', {
  container: {
    image: ecs.ContainerImage.fromAsset(path.resolve(__dirname, 'batchjob-image')),
  },
});

const task = new tasks.BatchSubmitJob(this, 'Submit Job', {
  jobDefinition: batchJobDefinition,
  jobName: 'MyJob',
  jobQueue: batchQueue,
});
```

## CodeBuild

Step Functions supports [CodeBuild](https://docs.aws.amazon.com/step-functions/latest/dg/connect-codebuild.html) through the service integration pattern.

### StartBuild

[StartBuild](https://docs.aws.amazon.com/codebuild/latest/APIReference/API_StartBuild.html) starts a CodeBuild Project by Project Name.

```ts
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as tasks from '@aws-cdk/aws-stepfunctions-tasks';
import * as sfn from '@aws-cdk/aws-stepfunctions';

const codebuildProject = new codebuild.Project(stack, 'Project', {
  projectName: 'MyTestProject',
  buildSpec: codebuild.BuildSpec.fromObject({
    version: '0.2',
    phases: {
      build: {
        commands: [
          'echo "Hello, CodeBuild!"',
        ],
      },
    },
  }),
});

const task = new tasks.CodeBuildStartBuild(stack, 'Task', {
  project: codebuildProject,
  integrationPattern: sfn.IntegrationPattern.RUN_JOB,
  environmentVariablesOverride: {
    ZONE: {
      type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
      value: sfn.JsonPath.stringAt('$.envVariables.zone'),
    },
  },
});
```

## DynamoDB

You can call DynamoDB APIs from a `Task` state.
Read more about calling DynamoDB APIs [here](https://docs.aws.amazon.com/step-functions/latest/dg/connect-ddb.html)

### GetItem

The [GetItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_GetItem.html) operation returns a set of attributes for the item with the given primary key.

```ts
new tasks.DynamoGetItem(this, 'Get Item', {
  key: { messageId: tasks.DynamoAttributeValue.fromString('message-007') },
  table,
});
```

### PutItem

The [PutItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_PutItem.html) operation creates a new item, or replaces an old item with a new item.

```ts
new tasks.DynamoPutItem(this, 'PutItem', {
  item: {
    MessageId: tasks.DynamoAttributeValue.fromString('message-007'),
    Text: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.bar')),
    TotalCount: tasks.DynamoAttributeValue.fromNumber(10),
  },
  table,
});
```

### DeleteItem

The [DeleteItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DeleteItem.html) operation deletes a single item in a table by primary key.

```ts
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as tasks from '@aws-cdk/aws-stepfunctions-tasks';

new tasks.DynamoDeleteItem(this, 'DeleteItem', {
  key: { MessageId: tasks.DynamoAttributeValue.fromString('message-007') },
  table,
  resultPath: sfn.JsonPath.DISCARD,
});
```

### UpdateItem

The [UpdateItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) operation edits an existing item's attributes, or adds a new item
to the table if it does not already exist.

```ts
new tasks.DynamoUpdateItem(this, 'UpdateItem', {
  key: { MessageId: tasks.DynamoAttributeValue.fromString('message-007') },
  table,
  expressionAttributeValues: {
    ':val': tasks.DynamoAttributeValue.numberFromString(sfn.JsonPath.stringAt('$.Item.TotalCount.N')),
    ':rand': tasks.DynamoAttributeValue.fromNumber(20),
  },
  updateExpression: 'SET TotalCount = :val + :rand',
});
```

## ECS

Step Functions supports [ECS/Fargate](https://docs.aws.amazon.com/step-functions/latest/dg/connect-ecs.html) through the service integration pattern.

### RunTask

[RunTask](https://docs.aws.amazon.com/step-functions/latest/dg/connect-ecs.html) starts a new task using the specified task definition.

#### EC2

The EC2 launch type allows you to run your containerized applications on a cluster
of Amazon EC2 instances that you manage.

When a task that uses the EC2 launch type is launched, Amazon ECS must determine where
to place the task based on the requirements specified in the task definition, such as
CPU and memory. Similarly, when you scale down the task count, Amazon ECS must determine
which tasks to terminate. You can apply task placement strategies and constraints to
customize how Amazon ECS places and terminates tasks. Learn more about [task placement](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-placement.html)

The latest ACTIVE revision of the passed task definition is used for running the task.

The following example runs a job from a task definition on EC2

```ts
import * as ecs from '@aws-cdk/aws-ecs';
import * as tasks from '@aws-cdk/aws-stepfunctions-tasks';
import * as sfn from '@aws-cdk/aws-stepfunctions';

const vpc = ec2.Vpc.fromLookup(stack, 'Vpc', {
  isDefault: true,
});

const cluster = new ecs.Cluster(stack, 'Ec2Cluster', { vpc });
cluster.addCapacity('DefaultAutoScalingGroup', {
  instanceType: new ec2.InstanceType('t2.micro'),
  vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
});

const taskDefinition = new ecs.TaskDefinition(stack, 'TD', {
  compatibility: ecs.Compatibility.EC2,
});

taskDefinition.addContainer('TheContainer', {
  image: ecs.ContainerImage.fromRegistry('foo/bar'),
  memoryLimitMiB: 256,
});

const runTask = new tasks.EcsRunTask(stack, 'Run', {
    integrationPattern: sfn.IntegrationPattern.RUN_JOB,
    cluster,
    taskDefinition,
    launchTarget: new tasks.EcsEc2LaunchTarget({
      placementStrategies: [
        ecs.PlacementStrategy.spreadAcrossInstances(),
        ecs.PlacementStrategy.packedByCpu(),
        ecs.PlacementStrategy.randomly(),
      ],
      placementConstraints: [
        ecs.PlacementConstraint.memberOf('blieptuut')
      ],
    }),
  });
```

#### Fargate

AWS Fargate is a serverless compute engine for containers that works with Amazon
Elastic Container Service (ECS). Fargate makes it easy for you to focus on building
your applications. Fargate removes the need to provision and manage servers, lets you
specify and pay for resources per application, and improves security through application
isolation by design. Learn more about [Fargate](https://aws.amazon.com/fargate/)

The Fargate launch type allows you to run your containerized applications without the need
to provision and manage the backend infrastructure. Just register your task definition and
Fargate launches the container for you. The latest ACTIVE revision of the passed 
task definition is used for running the task. Learn more about 
[Fargate Versioning](https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_DescribeTaskDefinition.html)

The following example runs a job from a task definition on Fargate

```ts
import * as ecs from '@aws-cdk/aws-ecs';
import * as tasks from '@aws-cdk/aws-stepfunctions-tasks';
import * as sfn from '@aws-cdk/aws-stepfunctions';

const vpc = ec2.Vpc.fromLookup(stack, 'Vpc', {
  isDefault: true,
});

const cluster = new ecs.Cluster(stack, 'FargateCluster', { vpc });

const taskDefinition = new ecs.TaskDefinition(stack, 'TD', {
  memoryMiB: '512',
  cpu: '256',
  compatibility: ecs.Compatibility.FARGATE,
});

const containerDefinition = taskDefinition.addContainer('TheContainer', {
  image: ecs.ContainerImage.fromRegistry('foo/bar'),
  memoryLimitMiB: 256,
});

const runTask = new tasks.EcsRunTask(stack, 'RunFargate', {
  integrationPattern: sfn.IntegrationPattern.RUN_JOB,
  cluster,
  taskDefinition,
  assignPublicIp: true,
  containerOverrides: [{
    containerDefinition,
    environment: [{ name: 'SOME_KEY', value: sfn.JsonPath.stringAt('$.SomeKey') }],
  }],
  launchTarget: new tasks.EcsFargateLaunchTarget(),
});
```

## EMR

Step Functions supports Amazon EMR through the service integration pattern.
The service integration APIs correspond to Amazon EMR APIs but differ in the
parameters that are used.

[Read more](https://docs.aws.amazon.com/step-functions/latest/dg/connect-emr.html) about the differences when using these service integrations.

### Create Cluster

Creates and starts running a cluster (job flow).
Corresponds to the [`runJobFlow`](https://docs.aws.amazon.com/emr/latest/APIReference/API_RunJobFlow.html) API in EMR.

```ts

const clusterRole = new iam.Role(stack, 'ClusterRole', {
  assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
});

const serviceRole = new iam.Role(stack, 'ServiceRole', {
  assumedBy: new iam.ServicePrincipal('elasticmapreduce.amazonaws.com'),
});

const autoScalingRole = new iam.Role(stack, 'AutoScalingRole', {
  assumedBy: new iam.ServicePrincipal('elasticmapreduce.amazonaws.com'),
});

autoScalingRole.assumeRolePolicy?.addStatements(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    principals: [
      new iam.ServicePrincipal('application-autoscaling.amazonaws.com'),
    ],
    actions: [
      'sts:AssumeRole',
    ],
  });
)

new tasks.EmrCreateCluster(stack, 'Create Cluster', {
  instances: {},
  clusterRole,
  name: sfn.TaskInput.fromDataAt('$.ClusterName').value,
  serviceRole,
  autoScalingRole,
  integrationPattern: sfn.ServiceIntegrationPattern.FIRE_AND_FORGET,
});
```

### Termination Protection

Locks a cluster (job flow) so the EC2 instances in the cluster cannot be
terminated by user intervention, an API call, or a job-flow error.

Corresponds to the [`setTerminationProtection`](https://docs.aws.amazon.com/step-functions/latest/dg/connect-emr.html) API in EMR.

```ts
new tasks.EmrSetClusterTerminationProtection(stack, 'Task', {
  clusterId: 'ClusterId',
  terminationProtected: false,
});
```

### Terminate Cluster

Shuts down a cluster (job flow).
Corresponds to the [`terminateJobFlows`](https://docs.aws.amazon.com/emr/latest/APIReference/API_TerminateJobFlows.html) API in EMR.

```ts
new tasks.EmrTerminateCluster(stack, 'Task', {
  clusterId: 'ClusterId'
});
```

### Add Step

Adds a new step to a running cluster.
Corresponds to the [`addJobFlowSteps`](https://docs.aws.amazon.com/emr/latest/APIReference/API_AddJobFlowSteps.html) API in EMR.

```ts
new tasks.EmrAddStep(stack, 'Task', {
    clusterId: 'ClusterId',
    name: 'StepName',
    jar: 'Jar',
    actionOnFailure: tasks.ActionOnFailure.CONTINUE,
});
```

### Cancel Step

Cancels a pending step in a running cluster.
Corresponds to the [`cancelSteps`](https://docs.aws.amazon.com/emr/latest/APIReference/API_CancelSteps.html) API in EMR.

```ts
new tasks.EmrCancelStep(stack, 'Task', {
  clusterId: 'ClusterId',
  stepId: 'StepId',
});
```

### Modify Instance Fleet

Modifies the target On-Demand and target Spot capacities for the instance
fleet with the specified InstanceFleetName.

Corresponds to the [`modifyInstanceFleet`](https://docs.aws.amazon.com/emr/latest/APIReference/API_ModifyInstanceFleet.html) API in EMR.

```ts
new sfn.EmrModifyInstanceFleetByName(stack, 'Task', {
  clusterId: 'ClusterId',
  instanceFleetName: 'InstanceFleetName',
  targetOnDemandCapacity: 2,
  targetSpotCapacity: 0,
});
```

### Modify Instance Group

Modifies the number of nodes and configuration settings of an instance group.

Corresponds to the [`modifyInstanceGroups`](https://docs.aws.amazon.com/emr/latest/APIReference/API_ModifyInstanceGroups.html) API in EMR.

```ts
new tasks.EmrModifyInstanceGroupByName(stack, 'Task', {
  clusterId: 'ClusterId',
  instanceGroupName: sfn.JsonPath.stringAt('$.InstanceGroupName'),
  instanceGroup: {
    instanceCount: 1,
  },
});
```

## EKS

Step Functions supports Amazon EKS through the service integration pattern.
The service integration APIs correspond to Amazon EKS APIs.

[Read more](https://docs.aws.amazon.com/step-functions/latest/dg/connect-eks.html) about the differences when using these service integrations.

### Create Fargate Profile

Add a new Fargate Profile to a cluster.
Corresponds to the [`createFargateProfile`](https://docs.aws.amazon.com/eks/latest/APIReference/API_CreateFargateProfile.html) API in EKS.

```ts
new tasks.EksCreateFargateProfile(stack, 'Create a Fargate Profile', {
  fargateProfileName: 'fargateprofilename',
  clusterName: 'clustername',
  podExecutionRole: '*',
  selectors: [{
    Namespace: 'namespace',
    Labels: { 'my-label': 'my-value' },
  }],
});
```

### Delete Fargate Profile

Deletes a fargate profile.
Corresponds to the [`deleteFargateProfile`](https://docs.aws.amazon.com/eks/latest/APIReference/API_DeleteFargateProfile.html) API in EKS.

```ts
new tasks.EksDeleteFargateProfile(stack, 'Delete a Fargate Profile', {
  clusterName: 'clustername',
  fargateProfileName: 'fargateprofilename',
});
```

## Glue

Step Functions supports [AWS Glue](https://docs.aws.amazon.com/step-functions/latest/dg/connect-glue.html) through the service integration pattern.

You can call the [`StartJobRun`](https://docs.aws.amazon.com/glue/latest/dg/aws-glue-api-jobs-runs.html#aws-glue-api-jobs-runs-StartJobRun) API from a `Task` state.

```ts
new GlueStartJobRun(stack, 'Task', {
  glueJobName: 'my-glue-job',
  arguments: {
    key: 'value',
  },
  timeout: cdk.Duration.minutes(30),
  notifyDelayAfter: cdk.Duration.minutes(5),
});
```

## Lambda

[Invoke](https://docs.aws.amazon.com/lambda/latest/dg/API_Invoke.html) a Lambda function.

You can specify the input to your Lambda function through the `payload` attribute.
By default, Step Functions invokes Lambda function with the state input (JSON path '$')
as the input.

The following snippet invokes a Lambda Function with the state input as the payload
by referencing the `$` path.

```ts
import * as lambda from '@aws-cdk/aws-lambda';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as tasks from '@aws-cdk/aws-stepfunctions-tasks';

const myLambda = new lambda.Function(this, 'my sample lambda', {
  code: Code.fromInline(`exports.handler = async () => {
    return {
      statusCode: '200',
      body: 'hello, world!'
    };
  };`),
  runtime: Runtime.NODEJS_12_X,
  handler: 'index.handler',
});

new tasks.LambdaInvoke(this, 'Invoke with state input', {
  lambdaFunction: myLambda,
});
```

When a function is invoked, the Lambda service sends  [these response
elements](https://docs.aws.amazon.com/lambda/latest/dg/API_Invoke.html#API_Invoke_ResponseElements)
back.

⚠️ The response from the Lambda function is in an attribute called `Payload`

The following snippet invokes a Lambda Function by referencing the `$.Payload` path
to reference the output of a Lambda executed before it.

```ts
new tasks.LambdaInvoke(this, 'Invoke with empty object as payload', {
  lambdaFunction: myLambda,
  payload: sfn.TaskInput.fromObject({}),
});

// use the output of myLambda as input
new tasks.LambdaInvoke(this, 'Invoke with payload field in the state input', {
  lambdaFunction: myOtherLambda,
  payload: sfn.TaskInput.fromDataAt('$.Payload'),
});
```

The following snippet invokes a Lambda and sets the task output to only include
the Lambda function response.

```ts
new tasks.LambdaInvoke(this, 'Invoke and set function response as task output', {
  lambdaFunction: myLambda,
  payload: sfn.TaskInput.fromDataAt('$'),
  outputPath: '$.Payload',
});
```

If you want to combine the input and the Lambda function response you can use
the `payloadResponseOnly` property and specify the `resultPath`. This will put the
Lambda function ARN directly in the "Resource" string, but it conflicts with the
integrationPattern, invocationType, clientContext, and qualifier properties.

```ts
new tasks.LambdaInvoke(this, 'Invoke and combine function response with task input', {
  lambdaFunction: myLambda,
  payloadResponseOnly: true,
  resultPath: '$.myLambda',
});
```

You can have Step Functions pause a task, and wait for an external process to
return a task token. Read more about the [callback pattern](https://docs.aws.amazon.com/step-functions/latest/dg/callback-task-sample-sqs.html#call-back-lambda-example)

To use the callback pattern, set the `token` property on the task. Call the Step
Functions `SendTaskSuccess` or `SendTaskFailure` APIs with the token to
indicate that the task has completed and the state machine should resume execution.

The following snippet invokes a Lambda with the task token as part of the input
to the Lambda.

```ts
new tasks.LambdaInvoke(stack, 'Invoke with callback', {
  lambdaFunction: myLambda,
  integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
  payload: sfn.TaskInput.fromObject({
    token: sfn.JsonPath.taskToken,
    input: sfn.JsonPath.stringAt('$.someField'),
  }),
});
```

⚠️ The task will pause until it receives that task token back with a `SendTaskSuccess` or `SendTaskFailure`
call. Learn more about [Callback with the Task
Token](https://docs.aws.amazon.com/step-functions/latest/dg/connect-to-resource.html#connect-wait-token).

AWS Lambda can occasionally experience transient service errors. In this case, invoking Lambda
results in a 500 error, such as `ServiceException`, `AWSLambdaException`, or `SdkClientException`.
As a best practive, the `LambdaInvoke` task will retry on those errors with an interval of 2 seconds,
a back-off rate of 2 and 6 maximum attempts. Set the `retryOnServiceExceptions` prop to `false` to
disable this behavior.

## SageMaker

Step Functions supports [AWS SageMaker](https://docs.aws.amazon.com/step-functions/latest/dg/connect-sagemaker.html) through the service integration pattern.

### Create Training Job

You can call the [`CreateTrainingJob`](https://docs.aws.amazon.com/sagemaker/latest/dg/API_CreateTrainingJob.html) API from a `Task` state.

```ts
new sfn.SagemakerTrainTask(this, 'TrainSagemaker', {
  trainingJobName: sfn.JsonPath.stringAt('$.JobName'),
  role,
  algorithmSpecification: {
    algorithmName: 'BlazingText',
    trainingInputMode: tasks.InputMode.FILE,
  },
  inputDataConfig: [{
    channelName: 'train',
    dataSource: {
      s3DataSource: {
        s3DataType: tasks.S3DataType.S3_PREFIX,
        s3Location: tasks.S3Location.fromJsonExpression('$.S3Bucket'),
      },
    },
  }],
  outputDataConfig: {
    s3OutputLocation: tasks.S3Location.fromBucket(s3.Bucket.fromBucketName(stack, 'Bucket', 'mybucket'), 'myoutputpath'),
  },
  resourceConfig: {
    instanceCount: 1,
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.P3, ec2.InstanceSize.XLARGE2),
    volumeSize: cdk.Size.gibibytes(50),
  },
  stoppingCondition: {
    maxRuntime: cdk.Duration.hours(1),
  },
});
```

### Create Transform Job

You can call the [`CreateTransformJob`](https://docs.aws.amazon.com/sagemaker/latest/dg/API_CreateTransformJob.html) API from a `Task` state.

```ts
new sfn.SagemakerTransformTask(this, 'Batch Inference', {
  transformJobName: 'MyTransformJob',
  modelName: 'MyModelName',
  modelClientOptions: {
    invocationMaxRetries: 3,  // default is 0
    invocationTimeout: cdk.Duration.minutes(5),  // default is 60 seconds
  }
  role,
  transformInput: {
    transformDataSource: {
      s3DataSource: {
        s3Uri: 's3://inputbucket/train',
        s3DataType: S3DataType.S3Prefix,
      }
    }
  },
  transformOutput: {
    s3OutputPath: 's3://outputbucket/TransformJobOutputPath',
  },
  transformResources: {
    instanceCount: 1,
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.M4, ec2.InstanceSize.XLarge),
  }
});

```

### Create Endpoint

You can call the [`CreateEndpoint`](https://docs.aws.amazon.com/sagemaker/latest/APIReference/API_CreateEndpoint.html) API from a `Task` state.

```ts
new sfn.SageMakerCreateEndpoint(this, 'SagemakerEndpoint', {
  endpointName: sfn.JsonPath.stringAt('$.EndpointName'),
  endpointConfigName: sfn.JsonPath.stringAt('$.EndpointConfigName'),
});
```

### Create Endpoint Config

You can call the [`CreateEndpointConfig`](https://docs.aws.amazon.com/sagemaker/latest/APIReference/API_CreateEndpointConfig.html) API from a `Task` state.

```ts
new sfn.SageMakerCreateEndpointConfig(this, 'SagemakerEndpointConfig', {
  endpointConfigName: 'MyEndpointConfig',
  productionVariants: [{
  initialInstanceCount: 2,
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.XLARGE),
     modelName: 'MyModel',
     variantName: 'awesome-variant',
   }],
});
```

### Create Model

You can call the [`CreateModel`](https://docs.aws.amazon.com/sagemaker/latest/APIReference/API_CreateModel.html) API from a `Task` state.

```ts
new sfn.SageMakerCreateModel(this, 'Sagemaker', {
  modelName: 'MyModel',
  primaryContainer: new tasks.ContainerDefinition({
   image: tasks.DockerImage.fromJsonExpression(sfn.JsonPath.stringAt('$.Model.imageName')),
   mode: tasks.Mode.SINGLE_MODEL,
   modelS3Location: tasks.S3Location.fromJsonExpression('$.TrainingJob.ModelArtifacts.S3ModelArtifacts'),
  }),
});
```

### Update Endpoint

You can call the [`UpdateEndpoint`](https://docs.aws.amazon.com/sagemaker/latest/APIReference/API_UpdateEndpoint.html) API from a `Task` state.

```ts
new sfn.SageMakerUpdateEndpoint(this, 'SagemakerEndpoint', {
    endpointName: sfn.JsonPath.stringAt('$.Endpoint.Name'),
    endpointConfigName: sfn.JsonPath.stringAt('$.Endpoint.EndpointConfig'),
  });
```

## SNS

Step Functions supports [Amazon SNS](https://docs.aws.amazon.com/step-functions/latest/dg/connect-sns.html) through the service integration pattern.

You can call the [`Publish`](https://docs.aws.amazon.com/sns/latest/api/API_Publish.html) API from a `Task` state to publish to an SNS topic.

```ts
import * as sns from '@aws-cdk/aws-sns';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as tasks from '@aws-cdk/aws-stepfunctions-tasks';

// ...

const topic = new sns.Topic(this, 'Topic');

// Use a field from the execution data as message.
const task1 = new tasks.SnsPublish(this, 'Publish1', {
  topic,
  integrationPattern: sfn.IntegrationPattern.REQUEST_RESPONSE,
  message: sfn.TaskInput.fromDataAt('$.state.message'),
});

// Combine a field from the execution data with
// a literal object.
const task2 = new tasks.SnsPublish(this, 'Publish2', {
  topic,
  message: sfn.TaskInput.fromObject({
    field1: 'somedata',
    field2: sfn.JsonPath.stringAt('$.field2'),
  })
});
```

## Step Functions

### Start Execution

You can manage [AWS Step Functions](https://docs.aws.amazon.com/step-functions/latest/dg/connect-stepfunctions.html) executions.

AWS Step Functions supports it's own [`StartExecution`](https://docs.aws.amazon.com/step-functions/latest/apireference/API_StartExecution.html) API as a service integration.

```ts
// Define a state machine with one Pass state
const child = new sfn.StateMachine(stack, 'ChildStateMachine', {
    definition: sfn.Chain.start(new sfn.Pass(stack, 'PassState')),
});

// Include the state machine in a Task state with callback pattern
const task = new StepFunctionsStartExecution(stack, 'ChildTask', {
  stateMachine: child,
  integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
  input: sfn.TaskInput.fromObject({
    token: sfn.JsonPath.taskToken,
    foo: 'bar'
  }),
  name: 'MyExecutionName'
});

// Define a second state machine with the Task state above
new sfn.StateMachine(stack, 'ParentStateMachine', {
  definition: task
});
```

### Invoke Activity

You can invoke a [Step Functions Activity](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-activities.html) which enables you to have
a task in your state machine where the work is performed by a *worker* that can
be hosted on Amazon EC2, Amazon ECS, AWS Lambda, basically anywhere. Activities
are a way to associate code running somewhere (known as an activity worker) with
a specific task in a state machine.

When Step Functions reaches an activity task state, the workflow waits for an
activity worker to poll for a task. An activity worker polls Step Functions by
using GetActivityTask, and sending the ARN for the related activity.  

After the activity worker completes its work, it can provide a report of its
success or failure by using `SendTaskSuccess` or `SendTaskFailure`. These two
calls use the taskToken provided by GetActivityTask to associate the result
with that task.

The following example creates an activity and creates a task that invokes the activity.

```ts
const submitJobActivity = new sfn.Activity(this, 'SubmitJob');

new tasks.StepFunctionsInvokeActivity(this, 'Submit Job', {
  activity: submitJobActivity,
});
```

## SQS

Step Functions supports [Amazon SQS](https://docs.aws.amazon.com/step-functions/latest/dg/connect-sqs.html)

You can call the [`SendMessage`](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_SendMessage.html) API from a `Task` state
to send a message to an SQS queue.

```ts
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as tasks from '@aws-cdk/aws-stepfunctions-tasks';
import * as sqs from '@aws-cdk/aws-sqs';

// ...

const queue = new sqs.Queue(this, 'Queue');

// Use a field from the execution data as message.
const task1 = new tasks.SqsSendMessage(this, 'Send1', {
  queue,
  messageBody: sfn.TaskInput.fromDataAt('$.message'),
});

// Combine a field from the execution data with
// a literal object.
const task2 = new tasks.SqsSendMessage(this, 'Send2', {
  queue,
  messageBody: sfn.TaskInput.fromObject({
    field1: 'somedata',
    field2: sfn.JsonPath.stringAt('$.field2'),
  }),
});
```
