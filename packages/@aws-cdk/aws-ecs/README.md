# Amazon ECS Construct Library
<!--BEGIN STABILITY BANNER-->

---

![cfn-resources: Stable](https://img.shields.io/badge/cfn--resources-stable-success.svg?style=for-the-badge)

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->

This package contains constructs for working with **Amazon Elastic Container
Service** (Amazon ECS).

Amazon Elastic Container Service (Amazon ECS) is a fully managed container orchestration service.

For further information on Amazon ECS,
see the [Amazon ECS documentation](https://docs.aws.amazon.com/ecs)

The following example creates an Amazon ECS cluster, adds capacity to it, and
runs a service on it:

```ts
import * as ecs from '@aws-cdk/aws-ecs';

// Create an ECS cluster
const cluster = new ecs.Cluster(this, 'Cluster', {
  vpc,
});

// Add capacity to it
cluster.addCapacity('DefaultAutoScalingGroupCapacity', {
  instanceType: new ec2.InstanceType("t2.xlarge"),
  desiredCapacity: 3,
});

const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDef');

taskDefinition.addContainer('DefaultContainer', {
  image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
  memoryLimitMiB: 512,
});

// Instantiate an Amazon ECS Service
const ecsService = new ecs.Ec2Service(this, 'Service', {
  cluster,
  taskDefinition,
});
```

For a set of constructs defining common ECS architectural patterns, see the `@aws-cdk/aws-ecs-patterns` package.

## Launch Types: AWS Fargate vs Amazon EC2

There are two sets of constructs in this library; one to run tasks on Amazon EC2 and
one to run tasks on AWS Fargate.

- Use the `Ec2TaskDefinition` and `Ec2Service` constructs to run tasks on Amazon EC2 instances running in your account.
- Use the `FargateTaskDefinition` and `FargateService` constructs to run tasks on
  instances that are managed for you by AWS.

Here are the main differences:

- **Amazon EC2**: instances are under your control. Complete control of task to host
  allocation. Required to specify at least a memory reservation or limit for
  every container. Can use Host, Bridge and AwsVpc networking modes. Can attach
  Classic Load Balancer. Can share volumes between container and host.
- **AWS Fargate**: tasks run on AWS-managed instances, AWS manages task to host
  allocation for you. Requires specification of memory and cpu sizes at the
  taskdefinition level. Only supports AwsVpc networking modes and
  Application/Network Load Balancers. Only the AWS log driver is supported.
  Many host features are not supported such as adding kernel capabilities
  and mounting host devices/volumes inside the container.

For more information on Amazon EC2 vs AWS Fargate and networking see the AWS Documentation:
[AWS Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html) and
[Task Networking](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-networking.html).

## Clusters

A `Cluster` defines the infrastructure to run your
tasks on. You can run many tasks on a single cluster.

The following code creates a cluster that can run AWS Fargate tasks:

```ts
const cluster = new ecs.Cluster(this, 'Cluster', {
  vpc: vpc
});
```

To use tasks with Amazon EC2 launch-type, you have to add capacity to
the cluster in order for tasks to be scheduled on your instances.  Typically,
you add an AutoScalingGroup with instances running the latest
Amazon ECS-optimized AMI to the cluster. There is a method to build and add such an
AutoScalingGroup automatically, or you can supply a customized AutoScalingGroup
that you construct yourself. It's possible to add multiple AutoScalingGroups
with various instance types.

The following example creates an Amazon ECS cluster and adds capacity to it:

```ts
const cluster = new ecs.Cluster(this, 'Cluster', {
  vpc: vpc
});

// Either add default capacity
cluster.addCapacity('DefaultAutoScalingGroupCapacity', {
  instanceType: new ec2.InstanceType("t2.xlarge"),
  desiredCapacity: 3,
});

// Or add customized capacity. Be sure to start the Amazon ECS-optimized AMI.
const autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'ASG', {
  vpc,
  instanceType: new ec2.InstanceType('t2.xlarge'),
  machineImage: EcsOptimizedImage.amazonLinux(),
  // Or use Amazon ECS-Optimized Amazon Linux 2 AMI
  // machineImage: EcsOptimizedImage.amazonLinux2(),
  desiredCapacity: 3,
  // ... other options here ...
});

cluster.addAutoScalingGroup(autoScalingGroup);
```

If you omit the property `vpc`, the construct will create a new VPC with two AZs.


### Bottlerocket

[Bottlerocket](https://aws.amazon.com/bottlerocket/) is a Linux-based open source operating system that is
purpose-built by AWS for running containers. You can launch Amazon ECS container instances with the Bottlerocket AMI.

> **NOTICE**: The Bottlerocket AMI is in developer preview release for Amazon ECS and is subject to change.

The following example will create a capacity with self-managed Amazon EC2 capacity of 2 `c5.large` Linux instances running with `Bottlerocket` AMI.

Note that you must specify either a `machineImage` or `machineImageType`, at least one, not both.

The following example adds Bottlerocket capacity to the cluster:

```ts
cluster.addCapacity('bottlerocket-asg', {
  minCapacity: 2,
  instanceType: new ec2.InstanceType('c5.large'),
  machineImageType: ecs.MachineImageType.BOTTLEROCKET,
});
```

### ARM64 (Graviton) Instances

To launch instances with ARM64 hardware, you can use the Amazon ECS-optimized
Amazon Linux 2 (arm64) AMI. Based on Amazon Linux 2, this AMI is recommended
for use when launching your EC2 instances that are powered by Arm-based AWS
Graviton Processors.

```ts
cluster.addCapacity('graviton-cluster', {
  minCapacity: 2,
  instanceType: new ec2.InstanceType('c6g.large'),
  machineImage: ecs.EcsOptimizedImage.amazonLinux2(ecs.AmiHardwareType.ARM),
});

```

### Spot Instances

To add spot instances into the cluster, you must specify the `spotPrice` in the `ecs.AddCapacityOptions` and optionally enable the `spotInstanceDraining` property.

```ts
// Add an AutoScalingGroup with spot instances to the existing cluster
cluster.addCapacity('AsgSpot', {
  maxCapacity: 2,
  minCapacity: 2,
  desiredCapacity: 2,
  instanceType: new ec2.InstanceType('c5.xlarge'),
  spotPrice: '0.0735',
  // Enable the Automated Spot Draining support for Amazon ECS
  spotInstanceDraining: true,
});
```

### SNS Topic Encryption

When the `ecs.AddCapacityOptions` that you provide has a non-zero `taskDrainTime` (the default) then an SNS topic and Lambda are created to ensure that the
cluster's instances have been properly drained of tasks before terminating. The SNS Topic is sent the instance-terminating lifecycle event from the AutoScalingGroup,
and the Lambda acts on that event. If you wish to engage [server-side encryption](https://docs.aws.amazon.com/sns/latest/dg/sns-data-encryption.html) for this SNS Topic
then you may do so by providing a KMS key for the `topicEncryptionKey` property of `ecs.AddCapacityOptions`.

```ts
// Given
const key = kms.Key(...);
// Then, use that key to encrypt the lifecycle-event SNS Topic.
cluster.addCapacity('ASGEncryptedSNS', {
  instanceType: new ec2.InstanceType("t2.xlarge"),
  desiredCapacity: 3,
  topicEncryptionKey: key,
});
```

## Task definitions

A task definition describes what a single copy of a **task** should look like.
A task definition has one or more containers; typically, it has one
main container (the *default container* is the first one that's added
to the task definition, and it is marked *essential*) and optionally
some supporting containers which are used to support the main container,
doings things like upload logs or metrics to monitoring services.

To run a task or service with Amazon EC2 launch type, use the `Ec2TaskDefinition`. For AWS Fargate tasks/services, use the
`FargateTaskDefinition`. These classes provide a simplified API that only contain
properties relevant for that specific launch type.

For a `FargateTaskDefinition`, specify the task size (`memoryLimitMiB` and `cpu`):

```ts
const fargateTaskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
  memoryLimitMiB: 512,
  cpu: 256
});
```

To add containers to a task definition, call `addContainer()`:

```ts
const container = fargateTaskDefinition.addContainer("WebContainer", {
  // Use an image from DockerHub
  image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
  // ... other options here ...
});
```

For a `Ec2TaskDefinition`:

```ts
const ec2TaskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDef', {
  networkMode: NetworkMode.BRIDGE
});

const container = ec2TaskDefinition.addContainer("WebContainer", {
  // Use an image from DockerHub
  image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
  memoryLimitMiB: 1024
  // ... other options here ...
});
```

You can specify container properties when you add them to the task definition, or with various methods, e.g.:

To add a port mapping when adding a container to the task definition, specify the `portMappings` option:

```ts
taskDefinition.addContainer("WebContainer", {
  image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
  memoryLimitMiB: 1024,
  portMappings: [{ containerPort: 3000 }]
});
```

To add port mappings directly to a container definition, call `addPortMappings()`:

```ts
container.addPortMappings({
  containerPort: 3000
});
```

To add data volumes to a task definition, call `addVolume()`:

```ts
const volume = {
  // Use an Elastic FileSystem
  name: "mydatavolume",
  efsVolumeConfiguration: ecs.EfsVolumeConfiguration({
    fileSystemId: "EFS"
    // ... other options here ...
  })
};

const container = fargateTaskDefinition.addVolume("mydatavolume");
```

To use a TaskDefinition that can be used with either Amazon EC2 or
AWS Fargate launch types, use the `TaskDefinition` construct.

When creating a task definition you have to specify what kind of
tasks you intend to run: Amazon EC2, AWS Fargate, or both.
The following example uses both:

```ts
const taskDefinition = new ecs.TaskDefinition(this, 'TaskDef', {
  memoryMiB: '512',
  cpu: '256',
  networkMode: NetworkMode.AWS_VPC,
  compatibility: ecs.Compatibility.EC2_AND_FARGATE,
});
```

### Images

Images supply the software that runs inside the container. Images can be
obtained from either DockerHub or from ECR repositories, or built directly from a local Dockerfile.

- `ecs.ContainerImage.fromRegistry(imageName)`: use a public image.
- `ecs.ContainerImage.fromRegistry(imageName, { credentials: mySecret })`: use a private image that requires credentials.
- `ecs.ContainerImage.fromEcrRepository(repo, tag)`: use the given ECR repository as the image
  to start. If no tag is provided, "latest" is assumed.
- `ecs.ContainerImage.fromAsset('./image')`: build and upload an
  image directly from a `Dockerfile` in your source directory.
- `ecs.ContainerImage.fromDockerImageAsset(asset)`: uses an existing
  `@aws-cdk/aws-ecr-assets.DockerImageAsset` as a container image.
- `new ecs.TagParameterContainerImage(repository)`: use the given ECR repository as the image 
  but a CloudFormation parameter as the tag.

### Environment variables

To pass environment variables to the container, you can use the `environment`, `environmentFiles`, and `secrets` props.

```ts
taskDefinition.addContainer('container', {
  image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
  memoryLimitMiB: 1024,
  environment: { // clear text, not for sensitive data
    STAGE: 'prod',
  },
  environmentFiles: [ // list of environment files hosted either on local disk or S3
    ecs.EnvironmentFile.fromAsset('./demo-env-file.env'),
    ecs.EnvironmentFile.fromBucket(s3Bucket, 'assets/demo-env-file.env'),
  ],
  secrets: { // Retrieved from AWS Secrets Manager or AWS Systems Manager Parameter Store at container start-up.
    SECRET: ecs.Secret.fromSecretsManager(secret),
    DB_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'), // Reference a specific JSON field, (requires platform version 1.4.0 or later for Fargate tasks)
    PARAMETER: ecs.Secret.fromSsmParameter(parameter),
  }
});
```

The task execution role is automatically granted read permissions on the secrets/parameters. Support for environment
files is restricted to the EC2 launch type for files hosted on S3. Further details provided in the AWS documentation
about [specifying environment variables](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/taskdef-envfiles.html).

## Service

A `Service` instantiates a `TaskDefinition` on a `Cluster` a given number of
times, optionally associating them with a load balancer.
If a task fails,
Amazon ECS automatically restarts the task.

```ts
const taskDefinition;

const service = new ecs.FargateService(this, 'Service', {
  cluster,
  taskDefinition,
  desiredCount: 5
});
```

`Services` by default will create a security group if not provided.
If you'd like to specify which security groups to use you can override the `securityGroups` property.

### Deployment circuit breaker and rollback

Amazon ECS [deployment circuit breaker](https://aws.amazon.com/tw/blogs/containers/announcing-amazon-ecs-deployment-circuit-breaker/)
automatically rolls back unhealthy service deployments without the need for manual intervention. Use `circuitBreaker` to enable
deployment circuit breaker and optionally enable `rollback` for automatic rollback. See [Using the deployment circuit breaker](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-ecs.html)
for more details.

```ts
const service = new ecs.FargateService(stack, 'Service', {
  cluster,
  taskDefinition,
  circuitBreaker: { rollback: true },
});
```

### Include an application/network load balancer

`Services` are load balancing targets and can be added to a target group, which will be attached to an application/network load balancers:

```ts
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';

const service = new ecs.FargateService(this, 'Service', { /* ... */ });

const lb = new elbv2.ApplicationLoadBalancer(this, 'LB', { vpc, internetFacing: true });
const listener = lb.addListener('Listener', { port: 80 });
const targetGroup1 = listener.addTargets('ECS1', {
  port: 80,
  targets: [service]
});
const targetGroup2 = listener.addTargets('ECS2', {
  port: 80,
  targets: [service.loadBalancerTarget({
    containerName: 'MyContainer',
    containerPort: 8080
  })]
});
```

Note that in the example above, the default `service` only allows you to register the first essential container or the first mapped port on the container as a target and add it to a new target group. To have more control over which container and port to register as targets, you can use `service.loadBalancerTarget()` to return a load balancing target for a specific container and port.

Alternatively, you can also create all load balancer targets to be registered in this service, add them to target groups, and attach target groups to listeners accordingly.

```ts
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';

const service = new ecs.FargateService(this, 'Service', { /* ... */ });

const lb = new elbv2.ApplicationLoadBalancer(this, 'LB', { vpc, internetFacing: true });
const listener = lb.addListener('Listener', { port: 80 });
service.registerLoadBalancerTargets(
  {
    containerName: 'web',
    containerPort: 80,
    newTargetGroupId: 'ECS',
    listener: ecs.ListenerConfig.applicationListener(listener, {
      protocol: elbv2.ApplicationProtocol.HTTPS
    }),
  },
);
```

### Using a Load Balancer from a different Stack

If you want to put your Load Balancer and the Service it is load balancing to in
different stacks, you may not be able to use the convenience methods
`loadBalancer.addListener()` and `listener.addTargets()`.

The reason is that these methods will create resources in the same Stack as the
object they're called on, which may lead to cyclic references between stacks.
Instead, you will have to create an `ApplicationListener` in the service stack,
or an empty `TargetGroup` in the load balancer stack that you attach your
service to.

See the [ecs/cross-stack-load-balancer example](https://github.com/aws-samples/aws-cdk-examples/tree/master/typescript/ecs/cross-stack-load-balancer/)
for the alternatives.

### Include a classic load balancer

`Services` can also be directly attached to a classic load balancer as targets:

```ts
import * as elb from '@aws-cdk/aws-elasticloadbalancing';

const service = new ecs.Ec2Service(this, 'Service', { /* ... */ });

const lb = new elb.LoadBalancer(stack, 'LB', { vpc });
lb.addListener({ externalPort: 80 });
lb.addTarget(service);
```

Similarly, if you want to have more control over load balancer targeting:

```ts
import * as elb from '@aws-cdk/aws-elasticloadbalancing';

const service = new ecs.Ec2Service(this, 'Service', { /* ... */ });

const lb = new elb.LoadBalancer(stack, 'LB', { vpc });
lb.addListener({ externalPort: 80 });
lb.addTarget(service.loadBalancerTarget({
  containerName: 'MyContainer',
  containerPort: 80
}));
```

There are two higher-level constructs available which include a load balancer for you that can be found in the aws-ecs-patterns module:

- `LoadBalancedFargateService`
- `LoadBalancedEc2Service`

## Task Auto-Scaling

You can configure the task count of a service to match demand. Task auto-scaling is
configured by calling `autoScaleTaskCount()`:

```ts
const scaling = service.autoScaleTaskCount({ maxCapacity: 10 });
scaling.scaleOnCpuUtilization('CpuScaling', {
  targetUtilizationPercent: 50
});

scaling.scaleOnRequestCount('RequestScaling', {
  requestsPerTarget: 10000,
  targetGroup: target
})
```

Task auto-scaling is powered by *Application Auto-Scaling*.
See that section for details.

## Integration with CloudWatch Events

To start an Amazon ECS task on an Amazon EC2-backed Cluster, instantiate an
`@aws-cdk/aws-events-targets.EcsTask` instead of an `Ec2Service`:

```ts
import * as targets from '@aws-cdk/aws-events-targets';

// Create a Task Definition for the container to start
const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDef');
taskDefinition.addContainer('TheContainer', {
  image: ecs.ContainerImage.fromAsset(path.resolve(__dirname, '..', 'eventhandler-image')),
  memoryLimitMiB: 256,
  logging: new ecs.AwsLogDriver({ streamPrefix: 'EventDemo', mode: AwsLogDriverMode.NON_BLOCKING })
});

// An Rule that describes the event trigger (in this case a scheduled run)
const rule = new events.Rule(this, 'Rule', {
  schedule: events.Schedule.expression('rate(1 min)')
});

// Pass an environment variable to the container 'TheContainer' in the task
rule.addTarget(new targets.EcsTask({
  cluster,
  taskDefinition,
  taskCount: 1,
  containerOverrides: [{
    containerName: 'TheContainer',
    environment: [{
      name: 'I_WAS_TRIGGERED',
      value: 'From CloudWatch Events'
    }]
  }]
}));
```

## Log Drivers

Currently Supported Log Drivers:

- awslogs
- fluentd
- gelf
- journald
- json-file
- splunk
- syslog
- awsfirelens

### awslogs Log Driver

```ts
// Create a Task Definition for the container to start
const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDef');
taskDefinition.addContainer('TheContainer', {
  image: ecs.ContainerImage.fromRegistry('example-image'),
  memoryLimitMiB: 256,
  logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'EventDemo' })
});
```

### fluentd Log Driver

```ts
// Create a Task Definition for the container to start
const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDef');
taskDefinition.addContainer('TheContainer', {
  image: ecs.ContainerImage.fromRegistry('example-image'),
  memoryLimitMiB: 256,
  logging: ecs.LogDrivers.fluentd()
});
```

### gelf Log Driver

```ts
// Create a Task Definition for the container to start
const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDef');
taskDefinition.addContainer('TheContainer', {
  image: ecs.ContainerImage.fromRegistry('example-image'),
  memoryLimitMiB: 256,
  logging: ecs.LogDrivers.gelf({ address: 'my-gelf-address' })
});
```

### journald Log Driver

```ts
// Create a Task Definition for the container to start
const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDef');
taskDefinition.addContainer('TheContainer', {
  image: ecs.ContainerImage.fromRegistry('example-image'),
  memoryLimitMiB: 256,
  logging: ecs.LogDrivers.journald()
});
```

### json-file Log Driver

```ts
// Create a Task Definition for the container to start
const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDef');
taskDefinition.addContainer('TheContainer', {
  image: ecs.ContainerImage.fromRegistry('example-image'),
  memoryLimitMiB: 256,
  logging: ecs.LogDrivers.jsonFile()
});
```

### splunk Log Driver

```ts
// Create a Task Definition for the container to start
const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDef');
taskDefinition.addContainer('TheContainer', {
  image: ecs.ContainerImage.fromRegistry('example-image'),
  memoryLimitMiB: 256,
  logging: ecs.LogDrivers.splunk({
    secretToken: cdk.SecretValue.secretsManager('my-splunk-token'),
    url: 'my-splunk-url'
  })
});
```

### syslog Log Driver

```ts
// Create a Task Definition for the container to start
const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDef');
taskDefinition.addContainer('TheContainer', {
  image: ecs.ContainerImage.fromRegistry('example-image'),
  memoryLimitMiB: 256,
  logging: ecs.LogDrivers.syslog()
});
```

### firelens Log Driver

```ts
// Create a Task Definition for the container to start
const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDef');
taskDefinition.addContainer('TheContainer', {
  image: ecs.ContainerImage.fromRegistry('example-image'),
  memoryLimitMiB: 256,
  logging: ecs.LogDrivers.firelens({
    options: {
        Name: 'firehose',
        region: 'us-west-2',
        delivery_stream: 'my-stream',
    }
  })
});
```

To pass secrets to the log configuration, use the `secretOptions` property of the log configuration. The task execution role is automatically granted read permissions on the secrets/parameters.

```ts
const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDef');
taskDefinition.addContainer('TheContainer', {
  image: ecs.ContainerImage.fromRegistry('example-image'),
  memoryLimitMiB: 256,
  logging: ecs.LogDrivers.firelens({
    options: {
      // ... log driver options here ...
    },
    secretOptions: { // Retrieved from AWS Secrets Manager or AWS Systems Manager Parameter Store
      apikey: ecs.Secret.fromSecretsManager(secret),
      host: ecs.Secret.fromSsmParameter(parameter),
    },
  })
});
```

### Generic Log Driver

A generic log driver object exists to provide a lower level abstraction of the log driver configuration.

```ts
// Create a Task Definition for the container to start
const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDef');
taskDefinition.addContainer('TheContainer', {
  image: ecs.ContainerImage.fromRegistry('example-image'),
  memoryLimitMiB: 256,
  logging: new ecs.GenericLogDriver({
    logDriver: 'fluentd',
    options: {
      tag: 'example-tag'
    }
  })
});
```

## CloudMap Service Discovery

To register your ECS service with a CloudMap Service Registry, you may add the
`cloudMapOptions` property to your service:

```ts
const service = new ecs.Ec2Service(stack, 'Service', {
  cluster,
  taskDefinition,
  cloudMapOptions: {
    // Create A records - useful for AWSVPC network mode.
    dnsRecordType: cloudmap.DnsRecordType.A,
  },
});
```

With `bridge` or `host` network modes, only `SRV` DNS record types are supported. 
By default, `SRV` DNS record types will target the default container and default
port. However, you may target a different container and port on the same ECS task:

```ts
// Add a container to the task definition
const specificContainer = taskDefinition.addContainer(...);

// Add a port mapping
specificContainer.addPortMappings({
  containerPort: 7600,
  protocol: ecs.Protocol.TCP,
});

new ecs.Ec2Service(stack, 'Service', {
  cluster,
  taskDefinition,
  cloudMapOptions: {
    // Create SRV records - useful for bridge networking
    dnsRecordType: cloudmap.DnsRecordType.SRV,
    // Targets port TCP port 7600 `specificContainer`
    container: specificContainer,
    containerPort: 7600,
  },
});
```

### Associate With a Specific CloudMap Service

You may associate an ECS service with a specific CloudMap service. To do
this, use the service's `associateCloudMapService` method:

```ts
const cloudMapService = new cloudmap.Service(...);
const ecsService = new ecs.FargateService(...);

ecsService.associateCloudMapService({
  service: cloudMapService,
});
```

## Capacity Providers

There are two major families of Capacity Providers: [AWS
Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-capacity-providers.html)
(including Fargate Spot) and EC2 [Auto Scaling
Group](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/asg-capacity-providers.html)
Capacity Providers. Both are supported.

### Fargate Capacity Providers

To enable Fargate capacity providers, you can either set
`enableFargateCapacityProviders` to `true` when creating your cluster, or by
invoking the `enableFargateCapacityProviders()` method after creating your
cluster. This will add both `FARGATE` and `FARGATE_SPOT` as available capacity
providers on your cluster.

```ts
const cluster = new ecs.Cluster(stack, 'FargateCPCluster', {
  vpc,
  enableFargateCapacityProviders: true,
});

const taskDefinition = new ecs.FargateTaskDefinition(stack, 'TaskDef');

taskDefinition.addContainer('web', {
  image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
});

new ecs.FargateService(stack, 'FargateService', {
  cluster,
  taskDefinition,
  capacityProviderStrategies: [
    {
      capacityProvider: 'FARGATE_SPOT',
      weight: 2,
    },
    {
      capacityProvider: 'FARGATE',
      weight: 1,
    }
  ],
});
```

### Auto Scaling Group Capacity Providers

To add an Auto Scaling Group Capacity Provider, first create an EC2 Auto Scaling
Group. Then, create an `AsgCapacityProvider` and pass the Auto Scaling Group to
it in the constructor. Then add the Capacity Provider to the cluster. Finally,
you can refer to the Provider by its name in your service's or task's Capacity
Provider strategy.

By default, an Auto Scaling Group Capacity Provider will manage the Auto Scaling
Group's size for you. It will also enable managed termination protection, in
order to prevent EC2 Auto Scaling from terminating EC2 instances that have tasks
running on them. If you want to disable this behavior, set both
`enableManagedScaling` to and `enableManagedTerminationProtection` to `false`.

```ts
const cluster = new ecs.Cluster(stack, 'Cluster', {
  vpc,
});

const autoScalingGroup = new autoscaling.AutoScalingGroup(stack, 'ASG', {
  vpc,
  instanceType: new ec2.InstanceType('t2.micro'),
  machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
  minCapacity: 0,
  maxCapacity: 100,
});

const capacityProvider = new ecs.AsgCapacityProvider(stack, 'AsgCapacityProvider', {
  autoScalingGroup,
});
cluster.addAsgCapacityProvider(capacityProvider);

const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'TaskDef');

taskDefinition.addContainer('web', {
  image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample',
  memoryReservationMiB: 256,
});

new ecs.Ec2Service(stack, 'EC2Service', {
  cluster,
  taskDefinition,
  capacityProviderStrategies: [
    {
      capacityProvider: capacityProvider.capacityProviderName,
      weight: 1,
    }
  ],
});
```

## Elastic Inference Accelerators

Currently, this feature is only supported for services with EC2 launch types.

To add elastic inference accelerators to your EC2 instance, first add
`inferenceAccelerators` field to the Ec2TaskDefinition and set the `deviceName`
and `deviceType` properties.

```ts
const inferenceAccelerators = [{
  deviceName: 'device1',
  deviceType: 'eia2.medium',
}];

const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef', {
  inferenceAccelerators,
});
```

To enable using the inference accelerators in the containers, add `inferenceAcceleratorResources`
field and set it to a list of device names used for the inference accelerators. Each value in the
list should match a `DeviceName` for an `InferenceAccelerator` specified in the task definition. 

```ts
const inferenceAcceleratorResources = ['device1'];

taskDefinition.addContainer('cont', {
  image: ecs.ContainerImage.fromRegistry('test'),
  memoryLimitMiB: 1024,
  inferenceAcceleratorResources,
});
```

## ECS Exec command

Please note, ECS Exec leverages AWS Systems Manager (SSM). So as a prerequisite for the exec command
to work, you need to have the SSM plugin for the AWS CLI installed locally. For more information, see
[Install Session Manager plugin for AWS CLI] (https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html).

To enable the ECS Exec feature for your containers, set the boolean flag `enableExecuteCommand` to `true` in
your `Ec2Service` or `FargateService`.

```ts
const service = new ecs.Ec2Service(stack, 'Service', {
  cluster,
  taskDefinition,
  enableExecuteCommand: true,
});
```

### Enabling logging

You can enable sending logs of your execute session commands to a CloudWatch log group or S3 bucket by configuring
the `executeCommandConfiguration` property for your cluster. The default configuration will send the
logs to the CloudWatch Logs using the `awslogs` log driver that is configured in your task definition. Please note,
when using your own `logConfiguration` the log group or S3 Bucket specified must already be created. 

To encrypt data using your own KMS Customer Key (CMK), you must create a CMK and provide the key in the `kmsKey` field
of the `executeCommandConfiguration`. To use this key for encrypting CloudWatch log data or S3 bucket, make sure to associate the key
to these resources on creation. 

```ts
const kmsKey = new kms.Key(stack, 'KmsKey');

// Pass the KMS key in the `encryptionKey` field to associate the key to the log group
const logGroup = new logs.LogGroup(stack, 'LogGroup', {
  encryptionKey: kmsKey,
});

// Pass the KMS key in the `encryptionKey` field to associate the key to the S3 bucket
const execBucket = new s3.Bucket(stack, 'EcsExecBucket', {
  encryptionKey: kmsKey,
});

const cluster = new ecs.Cluster(stack, 'Cluster', {
  vpc,
  executeCommandConfiguration: {
    kmsKey,
    logConfiguration: {
      cloudWatchLogGroup: logGroup,
      cloudWatchEncryptionEnabled: true,
      s3Bucket: execBucket,
      s3EncryptionEnabled: true,
      s3KeyPrefix: 'exec-command-output',
    },
    logging: ecs.ExecuteCommandLogging.OVERRIDE,
  },
});
```
