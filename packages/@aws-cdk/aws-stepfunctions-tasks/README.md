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

- [Tasks for AWS Step Functions](#tasks-for-aws-step-functions)
  - [Table Of Contents](#table-of-contents)
  - [Task](#task)
  - [Paths](#paths)
    - [InputPath](#inputpath)
    - [OutputPath](#outputpath)
    - [ResultPath](#resultpath)
  - [Task parameters from the state JSON](#task-parameters-from-the-state-json)
  - [Evaluate Expression](#evaluate-expression)
  - [API Gateway](#api-gateway)
    - [Call REST API Endpoint](#call-rest-api-endpoint)
    - [Call HTTP API Endpoint](#call-http-api-endpoint)
  - [Athena](#athena)
    - [StartQueryExecution](#startqueryexecution)
    - [GetQueryExecution](#getqueryexecution)
    - [GetQueryResults](#getqueryresults)
    - [StopQueryExecution](#stopqueryexecution)
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
    - [Call](#call)
  - [Glue](#glue)
  - [Glue DataBrew](#glue-databrew)
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
    - [Invoke Activity](#invoke-activity)
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
const submitJob = new tasks.LambdaInvoke(this, 'Invoke Handler', {
  lambdaFunction: fn,
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
const submitJob = new tasks.LambdaInvoke(this, 'Invoke Handler', {
  lambdaFunction: fn,
  outputPath: '$.Payload.result'
});
```

### ResultSelector

You can use [`ResultSelector`](https://docs.aws.amazon.com/step-functions/latest/dg/input-output-inputpath-params.html#input-output-resultselector)
to manipulate the raw result of a Task, Map or Parallel state before it is
passed to [`ResultPath`](###ResultPath). For service integrations, the raw
result contains metadata in addition to the response payload. You can use
ResultSelector to construct a JSON payload that becomes the effective result
using static values or references to the raw result or context object.

The following example extracts the output payload of a Lambda function Task and combines
it with some static values and the state name from the context object.

```ts
new tasks.LambdaInvoke(this, 'Invoke Handler', {
  lambdaFunction: fn,
  resultSelector: {
    lambdaOutput: sfn.JsonPath.stringAt('$.Payload'),
    invokeRequestId: sfn.JsonPath.stringAt('$.SdkResponseMetadata.RequestId'),
    staticValue: {
      foo: 'bar',
    },
    stateName: sfn.JsonPath.stringAt('$$.State.Name'),
  },
})
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
new tasks.DynamoPutItem(this, 'PutItem', {
  item: {
    MessageId: tasks.DynamoAttributeValue.fromString('message-id')
  },
  table: myTable,
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
const submitJob = new tasks.LambdaInvoke(this, 'Invoke Handler', {
  lambdaFunction: fn,
  payload: sfn.TaskInput.fromJsonPathAt('$.input'),
  invocationType: tasks.LambdaInvocationType.EVENT,
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
  runtime: lambda.Runtime.NODEJS_14_X,
  resultPath: '$.message',
});

const publishMessage = new tasks.SnsPublish(this, 'Publish message', {
  topic: new sns.Topic(this, 'cool-topic'),
  message: sfn.TaskInput.fromJsonPathAt('$.message'),
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
runtime to use to evaluate the expression. Currently, only runtimes
of the Node.js family are supported.

## API Gateway

Step Functions supports [API Gateway](https://docs.aws.amazon.com/step-functions/latest/dg/connect-api-gateway.html) through the service integration pattern.

HTTP APIs are designed for low-latency, cost-effective integrations with AWS services, including AWS Lambda, and HTTP endpoints.
HTTP APIs support OIDC and OAuth 2.0 authorization, and come with built-in support for CORS and automatic deployments.
Previous-generation REST APIs currently offer more features. More details can be found [here](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-vs-rest.html).

### Call REST API Endpoint

The `CallApiGatewayRestApiEndpoint` calls the REST API endpoint.

```ts
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as tasks from `@aws-cdk/aws-stepfunctions-tasks`;

const restApi = new apigateway.RestApi(stack, 'MyRestApi');

const invokeTask = new tasks.CallApiGatewayRestApiEndpoint(stack, 'Call REST API', {
  api: restApi,
  stageName: 'prod',
  method: HttpMethod.GET,
});
```

### Call HTTP API Endpoint

The `CallApiGatewayHttpApiEndpoint` calls the HTTP API endpoint.

```ts
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as tasks from `@aws-cdk/aws-stepfunctions-tasks`;

const httpApi = new apigatewayv2.HttpApi(stack, 'MyHttpApi');

const invokeTask = new tasks.CallApiGatewayHttpApiEndpoint(stack, 'Call HTTP API', {
  apiId: httpApi.apiId,
  apiStack: cdk.Stack.of(httpApi),
  method: HttpMethod.GET,
});
```

## Athena

Step Functions supports [Athena](https://docs.aws.amazon.com/step-functions/latest/dg/connect-athena.html) through the service integration pattern.

### StartQueryExecution

The [StartQueryExecution](https://docs.aws.amazon.com/athena/latest/APIReference/API_StartQueryExecution.html) API runs the SQL query statement.

```ts
const startQueryExecutionJob = new tasks.AthenaStartQueryExecution(this, 'Start Athena Query', {
  queryString: sfn.JsonPath.stringAt('$.queryString'),
  queryExecutionContext: {
    databaseName: 'mydatabase',
  },
  resultConfiguration: {
    encryptionConfiguration: {
      encryptionOption: tasks.EncryptionOption.S3_MANAGED,
    },
    outputLocation: {
      bucketName: 'query-results-bucket',
      objectKey: 'folder',
    },
  },
});
```

### GetQueryExecution

The [GetQueryExecution](https://docs.aws.amazon.com/athena/latest/APIReference/API_GetQueryExecution.html) API gets information about a single execution of a query.

```ts
const getQueryExecutionJob = new tasks.AthenaGetQueryExecution(this, 'Get Query Execution', {
  queryExecutionId: sfn.JsonPath.stringAt('$.QueryExecutionId'),
});
```

### GetQueryResults

The [GetQueryResults](https://docs.aws.amazon.com/athena/latest/APIReference/API_GetQueryResults.html) API that streams the results of a single query execution specified by QueryExecutionId from S3.

```ts
const getQueryResultsJob = new tasks.AthenaGetQueryResults(this, 'Get Query Results', {
  queryExecutionId: sfn.JsonPath.stringAt('$.QueryExecutionId'),
});
```

### StopQueryExecution

The [StopQueryExecution](https://docs.aws.amazon.com/athena/latest/APIReference/API_StopQueryExecution.html) API that stops a query execution.

```ts
const stopQueryExecutionJob = new tasks.AthenaStopQueryExecution(this, 'Stop Query Execution', {
  queryExecutionId: sfn.JsonPath.stringAt('$.QueryExecutionId'),
});
```

## Batch

Step Functions supports [Batch](https://docs.aws.amazon.com/step-functions/latest/dg/connect-batch.html) through the service integration pattern.

### SubmitJob

The [SubmitJob](https://docs.aws.amazon.com/batch/latest/APIReference/API_SubmitJob.html) API submits an AWS Batch job from a job definition.

```ts fixture=with-batch-job
const task = new tasks.BatchSubmitJob(this, 'Submit Job', {
  jobDefinitionArn: batchJobDefinitionArn,
  jobName: 'MyJob',
  jobQueueArn: batchQueueArn,
});
```

## CodeBuild

Step Functions supports [CodeBuild](https://docs.aws.amazon.com/step-functions/latest/dg/connect-codebuild.html) through the service integration pattern.

### StartBuild

[StartBuild](https://docs.aws.amazon.com/codebuild/latest/APIReference/API_StartBuild.html) starts a CodeBuild Project by Project Name.

```ts
import * as codebuild from '@aws-cdk/aws-codebuild';

const codebuildProject = new codebuild.Project(this, 'Project', {
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

const task = new tasks.CodeBuildStartBuild(this, 'Task', {
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

### StopBuild

[StopBuild](https://docs.aws.amazon.com/codebuild/latest/APIReference/API_StopBuild.html) attempts to stop running a build.

```ts
import * as tasks from '@aws-cdk/aws-stepfunctions-tasks';

new tasks.CodeBuildStopBuild(this, 'Stop Build', {
  buildId: 'buildId',
});
```

### BatchDeleteBuilds

[BatchDeleteBuilds](https://docs.aws.amazon.com/codebuild/latest/APIReference/API_BatchDeleteBuilds.html) deletes one or more builds.

```ts
import * as tasks from '@aws-cdk/aws-stepfunctions-tasks';

new tasks.CodeBuildBatchDeleteBuilds(stack, 'Delete Build', {
  ids: ['buildId'],
});
```

### BatchGetReports

[BatchGetReports](https://docs.aws.amazon.com/codebuild/latest/APIReference/API_BatchDeleteBuilds.html) returns an array of reports.

```ts
import * as tasks from '@aws-cdk/aws-stepfunctions-tasks';

new tasks.CodeBuildBatchGetReports(stack, 'Get Reports', {
  reportArns: ['reportArn'],
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
  table: myTable,
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
  table: myTable,
});
```

### DeleteItem

The [DeleteItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DeleteItem.html) operation deletes a single item in a table by primary key.

```ts
new tasks.DynamoDeleteItem(this, 'DeleteItem', {
  key: { MessageId: tasks.DynamoAttributeValue.fromString('message-007') },
  table: myTable,
  resultPath: sfn.JsonPath.DISCARD,
});
```

### UpdateItem

The [UpdateItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) operation edits an existing item's attributes, or adds a new item
to the table if it does not already exist.

```ts
new tasks.DynamoUpdateItem(this, 'UpdateItem', {
  key: {
    MessageId: tasks.DynamoAttributeValue.fromString('message-007')
  },
  table: myTable,
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

const vpc = ec2.Vpc.fromLookup(this, 'Vpc', {
  isDefault: true,
});

const cluster = new ecs.Cluster(this, 'Ec2Cluster', { vpc });
cluster.addCapacity('DefaultAutoScalingGroup', {
  instanceType: new ec2.InstanceType('t2.micro'),
  vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
});

const taskDefinition = new ecs.TaskDefinition(this, 'TD', {
  compatibility: ecs.Compatibility.EC2,
});

taskDefinition.addContainer('TheContainer', {
  image: ecs.ContainerImage.fromRegistry('foo/bar'),
  memoryLimitMiB: 256,
});

const runTask = new tasks.EcsRunTask(this, 'Run', {
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

const vpc = ec2.Vpc.fromLookup(this, 'Vpc', {
  isDefault: true,
});

const cluster = new ecs.Cluster(this, 'FargateCluster', { vpc });

const taskDefinition = new ecs.TaskDefinition(this, 'TD', {
  memoryMiB: '512',
  cpu: '256',
  compatibility: ecs.Compatibility.FARGATE,
});

const containerDefinition = taskDefinition.addContainer('TheContainer', {
  image: ecs.ContainerImage.fromRegistry('foo/bar'),
  memoryLimitMiB: 256,
});

const runTask = new tasks.EcsRunTask(this, 'RunFargate', {
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

const clusterRole = new iam.Role(this, 'ClusterRole', {
  assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
});

const serviceRole = new iam.Role(this, 'ServiceRole', {
  assumedBy: new iam.ServicePrincipal('elasticmapreduce.amazonaws.com'),
});

const autoScalingRole = new iam.Role(this, 'AutoScalingRole', {
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
  }));
)

new tasks.EmrCreateCluster(this, 'Create Cluster', {
  instances: {},
  clusterRole,
  name: sfn.TaskInput.fromJsonPathAt('$.ClusterName').value,
  serviceRole,
  autoScalingRole,
});
```

### Termination Protection

Locks a cluster (job flow) so the EC2 instances in the cluster cannot be
terminated by user intervention, an API call, or a job-flow error.

Corresponds to the [`setTerminationProtection`](https://docs.aws.amazon.com/step-functions/latest/dg/connect-emr.html) API in EMR.

```ts
new tasks.EmrSetClusterTerminationProtection(this, 'Task', {
  clusterId: 'ClusterId',
  terminationProtected: false,
});
```

### Terminate Cluster

Shuts down a cluster (job flow).
Corresponds to the [`terminateJobFlows`](https://docs.aws.amazon.com/emr/latest/APIReference/API_TerminateJobFlows.html) API in EMR.

```ts
new tasks.EmrTerminateCluster(this, 'Task', {
  clusterId: 'ClusterId'
});
```

### Add Step

Adds a new step to a running cluster.
Corresponds to the [`addJobFlowSteps`](https://docs.aws.amazon.com/emr/latest/APIReference/API_AddJobFlowSteps.html) API in EMR.

```ts
new tasks.EmrAddStep(this, 'Task', {
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
new tasks.EmrCancelStep(this, 'Task', {
  clusterId: 'ClusterId',
  stepId: 'StepId',
});
```

### Modify Instance Fleet

Modifies the target On-Demand and target Spot capacities for the instance
fleet with the specified InstanceFleetName.

Corresponds to the [`modifyInstanceFleet`](https://docs.aws.amazon.com/emr/latest/APIReference/API_ModifyInstanceFleet.html) API in EMR.

```ts
new tasks.EmrModifyInstanceFleetByName(this, 'Task', {
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
new tasks.EmrModifyInstanceGroupByName(this, 'Task', {
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

### Call

Read and write Kubernetes resource objects via a Kubernetes API endpoint.
Corresponds to the [`call`](https://docs.aws.amazon.com/step-functions/latest/dg/connect-eks.html) API in Step Functions Connector.

The following code snippet includes a Task state that uses eks:call to list the pods.

```ts
import * as eks from '@aws-cdk/aws-eks';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as tasks from '@aws-cdk/aws-stepfunctions-tasks';

const myEksCluster = new eks.Cluster(this, 'my sample cluster', {
   version: eks.KubernetesVersion.V1_18,
   clusterName: 'myEksCluster',
 });

new tasks.EksCall(stack, 'Call a EKS Endpoint', {
  cluster: myEksCluster,
  httpMethod: MethodType.GET,
  httpPath: '/api/v1/namespaces/default/pods',
});
```

## Glue

Step Functions supports [AWS Glue](https://docs.aws.amazon.com/step-functions/latest/dg/connect-glue.html) through the service integration pattern.

You can call the [`StartJobRun`](https://docs.aws.amazon.com/glue/latest/dg/aws-glue-api-jobs-runs.html#aws-glue-api-jobs-runs-StartJobRun) API from a `Task` state.

```ts
new tasks.GlueStartJobRun(this, 'Task', {
  glueJobName: 'my-glue-job',
  arguments: sfn.TaskInput.fromObject({
    key: 'value',
  }),
  timeout: cdk.Duration.minutes(30),
  notifyDelayAfter: cdk.Duration.minutes(5),
});
```

## Glue DataBrew

Step Functions supports [AWS Glue DataBrew](https://docs.aws.amazon.com/step-functions/latest/dg/connect-databrew.html) through the service integration pattern.

You can call the [`StartJobRun`](https://docs.aws.amazon.com/databrew/latest/dg/API_StartJobRun.html) API from a `Task` state.

```ts
new tasks.GlueDataBrewStartJobRun(this, 'Task', {
  name: 'databrew-job',
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
new tasks.LambdaInvoke(this, 'Invoke with state input', {
  lambdaFunction: fn,
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
  lambdaFunction: fn,
  payload: sfn.TaskInput.fromObject({}),
});

// use the output of fn as input
new tasks.LambdaInvoke(this, 'Invoke with payload field in the state input', {
  lambdaFunction: fn,
  payload: sfn.TaskInput.fromJsonPathAt('$.Payload'),
});
```

The following snippet invokes a Lambda and sets the task output to only include
the Lambda function response.

```ts
new tasks.LambdaInvoke(this, 'Invoke and set function response as task output', {
  lambdaFunction: fn,
  outputPath: '$.Payload',
});
```

If you want to combine the input and the Lambda function response you can use
the `payloadResponseOnly` property and specify the `resultPath`. This will put the
Lambda function ARN directly in the "Resource" string, but it conflicts with the
integrationPattern, invocationType, clientContext, and qualifier properties.

```ts
new tasks.LambdaInvoke(this, 'Invoke and combine function response with task input', {
  lambdaFunction: fn,
  payloadResponseOnly: true,
  resultPath: '$.fn',
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
new tasks.LambdaInvoke(this, 'Invoke with callback', {
  lambdaFunction: fn,
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
As a best practice, the `LambdaInvoke` task will retry on those errors with an interval of 2 seconds,
a back-off rate of 2 and 6 maximum attempts. Set the `retryOnServiceExceptions` prop to `false` to
disable this behavior.

## SageMaker

Step Functions supports [AWS SageMaker](https://docs.aws.amazon.com/step-functions/latest/dg/connect-sagemaker.html) through the service integration pattern.

### Create Training Job

You can call the [`CreateTrainingJob`](https://docs.aws.amazon.com/sagemaker/latest/dg/API_CreateTrainingJob.html) API from a `Task` state.

```ts
new tasks.SageMakerCreateTrainingJob(this, 'TrainSagemaker', {
  trainingJobName: sfn.JsonPath.stringAt('$.JobName'),
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
    s3OutputLocation: tasks.S3Location.fromBucket(s3.Bucket.fromBucketName(this, 'Bucket', 'mybucket'), 'myoutputpath'),
  },
  resourceConfig: {
    instanceCount: 1,
    instanceType: new ec2.InstanceType(JsonPath.stringAt('$.InstanceType')),
    volumeSize: cdk.Size.gibibytes(50),
  }, // optional: default is 1 instance of EC2 `M4.XLarge` with `10GB` volume
  stoppingCondition: {
    maxRuntime: cdk.Duration.hours(2),
  }, // optional: default is 1 hour
});
```

### Create Transform Job

You can call the [`CreateTransformJob`](https://docs.aws.amazon.com/sagemaker/latest/dg/API_CreateTransformJob.html) API from a `Task` state.

```ts
new tasks.SageMakerCreateTransformJob(this, 'Batch Inference', {
  transformJobName: 'MyTransformJob',
  modelName: 'MyModelName',
  modelClientOptions: {
    invocationsMaxRetries: 3,  // default is 0
    invocationsTimeout: cdk.Duration.minutes(5),  // default is 60 seconds
  },
  transformInput: {
    transformDataSource: {
      s3DataSource: {
        s3Uri: 's3://inputbucket/train',
        s3DataType: tasks.S3DataType.S3_PREFIX,
      }
    }
  },
  transformOutput: {
    s3OutputPath: 's3://outputbucket/TransformJobOutputPath',
  },
  transformResources: {
    instanceCount: 1,
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.M4, ec2.InstanceSize.XLARGE),
  }
});

```

### Create Endpoint

You can call the [`CreateEndpoint`](https://docs.aws.amazon.com/sagemaker/latest/APIReference/API_CreateEndpoint.html) API from a `Task` state.

```ts
new tasks.SageMakerCreateEndpoint(this, 'SagemakerEndpoint', {
  endpointName: sfn.JsonPath.stringAt('$.EndpointName'),
  endpointConfigName: sfn.JsonPath.stringAt('$.EndpointConfigName'),
});
```

### Create Endpoint Config

You can call the [`CreateEndpointConfig`](https://docs.aws.amazon.com/sagemaker/latest/APIReference/API_CreateEndpointConfig.html) API from a `Task` state.

```ts
new tasks.SageMakerCreateEndpointConfig(this, 'SagemakerEndpointConfig', {
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
new tasks.SageMakerCreateModel(this, 'Sagemaker', {
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
new tasks.SageMakerUpdateEndpoint(this, 'SagemakerEndpoint', {
    endpointName: sfn.JsonPath.stringAt('$.Endpoint.Name'),
    endpointConfigName: sfn.JsonPath.stringAt('$.Endpoint.EndpointConfig'),
  });
```

## SNS

Step Functions supports [Amazon SNS](https://docs.aws.amazon.com/step-functions/latest/dg/connect-sns.html) through the service integration pattern.

You can call the [`Publish`](https://docs.aws.amazon.com/sns/latest/api/API_Publish.html) API from a `Task` state to publish to an SNS topic.

```ts
const topic = new sns.Topic(this, 'Topic');

// Use a field from the execution data as message.
const task1 = new tasks.SnsPublish(this, 'Publish1', {
  topic,
  integrationPattern: sfn.IntegrationPattern.REQUEST_RESPONSE,
  message: sfn.TaskInput.fromJsonPathAt('$.state.message'),
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
const child = new sfn.StateMachine(this, 'ChildStateMachine', {
    definition: sfn.Chain.start(new sfn.Pass(this, 'PassState')),
});

// Include the state machine in a Task state with callback pattern
const task = new tasks.StepFunctionsStartExecution(this, 'ChildTask', {
  stateMachine: child,
  integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
  input: sfn.TaskInput.fromObject({
    token: sfn.JsonPath.taskToken,
    foo: 'bar'
  }),
  name: 'MyExecutionName'
});

// Define a second state machine with the Task state above
new sfn.StateMachine(this, 'ParentStateMachine', {
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
const queue = new sqs.Queue(this, 'Queue');

// Use a field from the execution data as message.
const task1 = new tasks.SqsSendMessage(this, 'Send1', {
  queue,
  messageBody: sfn.TaskInput.fromJsonPathAt('$.message'),
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
