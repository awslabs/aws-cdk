# AWS Cloud Development Kit Library

[![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)

The AWS CDK construct library provides APIs to define your CDK application and add
CDK constructs to the application.

## Usage

### Upgrade from CDK 1.x

When upgrading from CDK 1.x, remove all dependencies to individual CDK packages
from your dependencies file and follow the rest of the sections.

### Installation

To use this package, you need to declare this package and the `constructs` package as
dependencies.

According to the kind of project you are developing:

- For projects that are CDK libraries, declare them both under the `devDependencies`
  **and** `peerDependencies` sections.
- For CDK apps, declare them under the `dependencies` section only.

### Use in your code

#### Classic import

You can use a classic import to get access to each service namespaces:

```ts
import { Stack, App, aws_s3 as s3 } from 'aws-cdk-lib';

const app = new App();
const stack = new Stack(app, 'TestStack');

new s3.Bucket(stack, 'TestBucket');
```

#### Barrel import

Alternatively, you can use "barrel" imports:

```ts
import { App, Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';

const app = new App();
const stack = new Stack(app, 'TestStack');

new Bucket(stack, 'TestBucket');
```

<!--BEGIN CORE DOCUMENTATION-->

## Stacks and Stages

A `Stack` is the smallest physical unit of deployment, and maps directly onto
a CloudFormation Stack. You define a Stack by defining a subclass of `Stack`
-- let's call it `MyStack` -- and instantiating the constructs that make up
your application in `MyStack`'s constructor. You then instantiate this stack
one or more times to define different instances of your application. For example,
you can instantiate it once using few and cheap EC2 instances for testing,
and once again using more and bigger EC2 instances for production.

When your application grows, you may decide that it makes more sense to split it
out across multiple `Stack` classes. This can happen for a number of reasons:

- You could be starting to reach the maximum number of resources allowed in a single
  stack (this is currently 500).
- You could decide you want to separate out stateful resources and stateless resources
  into separate stacks, so that it becomes easy to tear down and recreate the stacks
  that don't have stateful resources.
- There could be a single stack with resources (like a VPC) that are shared
  between multiple instances of other stacks containing your applications.

As soon as your conceptual application starts to encompass multiple stacks,
it is convenient to wrap them in another construct that represents your
logical application. You can then treat that new unit the same way you used
to be able to treat a single stack: by instantiating it multiple times
for different instances of your application.

You can define a custom subclass of `Construct`, holding one or more
`Stack`s, to represent a single logical instance of your application.

As a final note: `Stack`s are not a unit of reuse. They describe physical
deployment layouts, and as such are best left to application builders to
organize their deployments with. If you want to vend a reusable construct,
define it as a subclasses of `Construct`: the consumers of your construct
will decide where to place it in their own stacks.

## Nested Stacks

[Nested stacks](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-nested-stacks.html) are stacks created as part of other stacks. You create a nested stack within another stack by using the `NestedStack` construct.

As your infrastructure grows, common patterns can emerge in which you declare the same components in multiple templates. You can separate out these common components and create dedicated templates for them. Then use the resource in your template to reference other templates, creating nested stacks.

For example, assume that you have a load balancer configuration that you use for most of your stacks. Instead of copying and pasting the same configurations into your templates, you can create a dedicated template for the load balancer. Then, you just use the resource to reference that template from within other templates.

The following example will define a single top-level stack that contains two nested stacks: each one with a single Amazon S3 bucket:

```ts
class MyNestedStack extends cfn.NestedStack {
  constructor(scope: Construct, id: string, props?: cfn.NestedStackProps) {
    super(scope, id, props);

    new s3.Bucket(this, 'NestedBucket');
  }
}

class MyParentStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    new MyNestedStack(this, 'Nested1');
    new MyNestedStack(this, 'Nested2');
  }
}
```

Resources references across nested/parent boundaries (even with multiple levels of nesting) will be wired by the AWS CDK
through CloudFormation parameters and outputs. When a resource from a parent stack is referenced by a nested stack,
a CloudFormation parameter will automatically be added to the nested stack and assigned from the parent; when a resource
from a nested stack is referenced by a parent stack, a CloudFormation output will be automatically be added to the
nested stack and referenced using `Fn::GetAtt "Outputs.Xxx"` from the parent.

Nested stacks also support the use of Docker image and file assets.

## Accessing resources in a different stack

You can access resources in a different stack, as long as they are in the
same account and AWS Region. The following example defines the stack `stack1`,
which defines an Amazon S3 bucket. Then it defines a second stack, `stack2`,
which takes the bucket from stack1 as a constructor property.

```ts
const prod = { account: '123456789012', region: 'us-east-1' };

const stack1 = new StackThatProvidesABucket(app, 'Stack1' , { env: prod });

// stack2 will take a property { bucket: IBucket }
const stack2 = new StackThatExpectsABucket(app, 'Stack2', {
  bucket: stack1.bucket,
  env: prod
});
```

If the AWS CDK determines that the resource is in the same account and
Region, but in a different stack, it automatically synthesizes AWS
CloudFormation
[Exports](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-stack-exports.html)
in the producing stack and an
[Fn::ImportValue](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-importvalue.html)
in the consuming stack to transfer that information from one stack to the
other.

### Removing automatic cross-stack references

The automatic references created by CDK when you use resources across stacks
are convenient, but may block your deployments if you want to remove the
resources that are referenced in this way. You will see an error like:

```text
Export Stack1:ExportsOutputFnGetAtt-****** cannot be deleted as it is in use by Stack1
```

Let's say there is a Bucket in the `stack1`, and the `stack2` references its
`bucket.bucketName`. You now want to remove the bucket and run into the error above.

It's not safe to remove `stack1.bucket` while `stack2` is still using it, so
unblocking yourself from this is a two-step process. This is how it works:

DEPLOYMENT 1: break the relationship

- Make sure `stack2` no longer references `bucket.bucketName` (maybe the consumer
  stack now uses its own bucket, or it writes to an AWS DynamoDB table, or maybe you just
  remove the Lambda Function altogether).
- In the `stack1` class, call `this.exportValue(this.bucket.bucketName)`. This
  will make sure the CloudFormation Export continues to exist while the relationship
  between the two stacks is being broken.
- Deploy (this will effectively only change the `stack2`, but it's safe to deploy both).

DEPLOYMENT 2: remove the resource

- You are now free to remove the `bucket` resource from `stack1`.
- Don't forget to remove the `exportValue()` call as well.
- Deploy again (this time only the `stack1` will be changed -- the bucket will be deleted).

## Durations

To make specifications of time intervals unambiguous, a single class called
`Duration` is used throughout the AWS Construct Library by all constructs
that that take a time interval as a parameter (be it for a timeout, a
rate, or something else).

An instance of Duration is constructed by using one of the static factory
methods on it:

```ts
Duration.seconds(300)   // 5 minutes
Duration.minutes(5)     // 5 minutes
Duration.hours(1)       // 1 hour
Duration.days(7)        // 7 days
Duration.parse('PT5M')  // 5 minutes
```

## Size (Digital Information Quantity)

To make specification of digital storage quantities unambiguous, a class called
`Size` is available.

An instance of `Size` is initialized through one of its static factory methods:

```ts
Size.kibibytes(200) // 200 KiB
Size.mebibytes(5)   // 5 MiB
Size.gibibytes(40)  // 40 GiB
Size.tebibytes(200) // 200 TiB
Size.pebibytes(3)   // 3 PiB
```

Instances of `Size` created with one of the units can be converted into others.
By default, conversion to a higher unit will fail if the conversion does not produce
a whole number. This can be overridden by unsetting `integral` property.

```ts
Size.mebibytes(2).toKibibytes()                                             // yields 2048
Size.kibibytes(2050).toMebibytes({ rounding: SizeRoundingBehavior.FLOOR })  // yields 2
```

## Secrets

To help avoid accidental storage of secrets as plain text, we use the `SecretValue` type to
represent secrets. Any construct that takes a value that should be a secret (such as
a password or an access key) will take a parameter of type `SecretValue`.

The best practice is to store secrets in AWS Secrets Manager and reference them using `SecretValue.secretsManager`:

```ts
const secret = SecretValue.secretsManager('secretId', {
  jsonField: 'password', // optional: key of a JSON field to retrieve (defaults to all content),
  versionId: 'id',       // optional: id of the version (default AWSCURRENT)
  versionStage: 'stage', // optional: version stage name (default AWSCURRENT)
});
```

Using AWS Secrets Manager is the recommended way to reference secrets in a CDK app.
`SecretValue` also supports the following secret sources:

 - `SecretValue.plainText(secret)`: stores the secret as plain text in your app and the resulting template (not recommended).
 - `SecretValue.ssmSecure(param, version)`: refers to a secret stored as a SecureString in the SSM Parameter Store.
 - `SecretValue.cfnParameter(param)`: refers to a secret passed through a CloudFormation parameter (must have `NoEcho: true`).
 - `SecretValue.cfnDynamicReference(dynref)`: refers to a secret described by a CloudFormation dynamic reference (used by `ssmSecure` and `secretsManager`).

## ARN manipulation

Sometimes you will need to put together or pick apart Amazon Resource Names
(ARNs). The functions `stack.formatArn()` and `stack.parseArn()` exist for
this purpose.

`formatArn()` can be used to build an ARN from components. It will automatically
use the region and account of the stack you're calling it on:

```ts
// Builds "arn:<PARTITION>:lambda:<REGION>:<ACCOUNT>:function:MyFunction"
stack.formatArn({
  service: 'lambda',
  resource: 'function',
  sep: ':',
  resourceName: 'MyFunction'
});
```

`parseArn()` can be used to get a single component from an ARN. `parseArn()`
will correctly deal with both literal ARNs and deploy-time values (tokens),
but in case of a deploy-time value be aware that the result will be another
deploy-time value which cannot be inspected in the CDK application.

```ts
// Extracts the function name out of an AWS Lambda Function ARN
const arnComponents = stack.parseArn(arn, ':');
const functionName = arnComponents.resourceName;
```

Note that depending on the service, the resource separator can be either
`:` or `/`, and the resource name can be either the 6th or 7th
component in the ARN. When using these functions, you will need to know
the format of the ARN you are dealing with.

For an exhaustive list of ARN formats used in AWS, see [AWS ARNs and
Namespaces](https://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html)
in the AWS General Reference.

## Dependencies

### Construct Dependencies

Sometimes AWS resources depend on other resources, and the creation of one
resource must be completed before the next one can be started.

In general, CloudFormation will correctly infer the dependency relationship
between resources based on the property values that are used. In the cases where
it doesn't, the AWS Construct Library will add the dependency relationship for
you.

If you need to add an ordering dependency that is not automatically inferred,
you do so by adding a dependency relationship using
`constructA.node.addDependency(constructB)`. This will add a dependency
relationship between all resources in the scope of `constructA` and all
resources in the scope of `constructB`.

If you want a single object to represent a set of constructs that are not
necessarily in the same scope, you can use a `ConcreteDependable`. The
following creates a single object that represents a dependency on two
constructs, `constructB` and `constructC`:

```ts
// Declare the dependable object
const bAndC = new ConcreteDependable();
bAndC.add(constructB);
bAndC.add(constructC);

// Take the dependency
constructA.node.addDependency(bAndC);
```

### Stack Dependencies

Two different stack instances can have a dependency on one another. This
happens when an resource from one stack is referenced in another stack. In
that case, CDK records the cross-stack referencing of resources,
automatically produces the right CloudFormation primitives, and adds a
dependency between the two stacks. You can also manually add a dependency
between two stacks by using the `stackA.addDependency(stackB)` method.

A stack dependency has the following implications:

- Cyclic dependencies are not allowed, so if `stackA` is using resources from
  `stackB`, the reverse is not possible anymore.
- Stacks with dependencies between them are treated specially by the CDK
  toolkit:
  - If `stackA` depends on `stackB`, running `cdk deploy stackA` will also
    automatically deploy `stackB`.
  - `stackB`'s deployment will be performed *before* `stackA`'s deployment.

## Custom Resources

Custom Resources are CloudFormation resources that are implemented by arbitrary
user code. They can do arbitrary lookups or modifications during a
CloudFormation deployment.

To define a custom resource, use the `CustomResource` construct:

```ts
new CustomResource(this, 'MyMagicalResource', {
  resourceType: 'Custom::MyCustomResource', // must start with 'Custom::'

  // the resource properties
  properties: {
    Property1: 'foo',
    Property2: 'bar'
  },

  // the ARN of the provider (SNS/Lambda) which handles
  // CREATE, UPDATE or DELETE events for this resource type
  // see next section for details
  serviceToken: 'ARN'
});
```

### Custom Resource Providers

Custom resources are backed by a **custom resource provider** which can be
implemented in one of the following ways. The following table compares the
various provider types (ordered from low-level to high-level):

| Provider                                                             | Compute Type | Error Handling | Submit to CloudFormation | Max Timeout     | Language | Footprint |
|----------------------------------------------------------------------|:------------:|:--------------:|:------------------------:|:---------------:|:--------:|:---------:|
| [sns.Topic](#amazon-sns-topic)                                       | Self-managed | Manual         | Manual                   | Unlimited       | Any      | Depends   |
| [lambda.Function](#aws-lambda-function)                              | AWS Lambda   | Manual         | Manual                   | 15min           | Any      | Small     |
| [core.CustomResourceProvider](#the-corecustomresourceprovider-class) | Lambda       | Auto           | Auto                     | 15min           | Node.js  | Small     |
| [custom-resources.Provider](#the-custom-resource-provider-framework) | Lambda       | Auto           | Auto                     | Unlimited Async | Any      | Large     |

Legend:

- **Compute type**: which type of compute can is used to execute the handler.
- **Error Handling**: whether errors thrown by handler code are automatically
  trapped and a FAILED response is submitted to CloudFormation. If this is
  "Manual", developers must take care of trapping errors. Otherwise, events
  could cause stacks to hang.
- **Submit to CloudFormation**: whether the framework takes care of submitting
  SUCCESS/FAILED responses to CloudFormation through the event's response URL.
- **Max Timeout**: maximum allows/possible timeout.
- **Language**: which programming languages can be used to implement handlers.
- **Footprint**: how many resources are used by the provider framework itself.

**A NOTE ABOUT SINGLETONS**

When defining resources for a custom resource provider, you will likely want to
define them as a *stack singleton* so that only a single instance of the
provider is created in your stack and which is used by all custom resources of
that type.

Here is a basic pattern for defining stack singletons in the CDK. The following
examples ensures that only a single SNS topic is defined:

```ts
function getOrCreate(scope: Construct): sns.Topic {
  const stack = Stack.of(scope);
  const uniqueid = 'GloballyUniqueIdForSingleton'; // For example, a UUID from `uuidgen`
  return stack.node.tryFindChild(uniqueid) as sns.Topic  ?? new sns.Topic(stack, uniqueid);
}
```

#### Amazon SNS Topic

Every time a resource event occurs (CREATE/UPDATE/DELETE), an SNS notification
is sent to the SNS topic. Users must process these notifications (e.g. through a
fleet of worker hosts) and submit success/failure responses to the
CloudFormation service.

Set `serviceToken` to `topic.topicArn`  in order to use this provider:

```ts
const topic = new sns.Topic(this, 'MyProvider');

new CustomResource(this, 'MyResource', {
  serviceToken: topic.topicArn
});
```

#### AWS Lambda Function

An AWS lambda function is called *directly* by CloudFormation for all resource
events. The handler must take care of explicitly submitting a success/failure
response to the CloudFormation service and handle various error cases.

Set `serviceToken` to `lambda.functionArn` to use this provider:

```ts
const fn = new lambda.Function(this, 'MyProvider', functionProps);

new CustomResource(this, 'MyResource', {
  serviceToken: fn.functionArn,
});
```

#### The `core.CustomResourceProvider` class

The class [`@aws-cdk/core.CustomResourceProvider`] offers a basic low-level
framework designed to implement simple and slim custom resource providers. It
currently only supports Node.js-based user handlers, and it does not have
support for asynchronous waiting (handler cannot exceed the 15min lambda
timeout).

[`@aws-cdk/core.CustomResourceProvider`]: https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_core.CustomResourceProvider.html

The provider has a built-in singleton method which uses the resource type as a
stack-unique identifier and returns the service token:

```ts
const serviceToken = CustomResourceProvider.getOrCreate(this, 'Custom::MyCustomResourceType', {
  codeDirectory: `${__dirname}/my-handler`,
  runtime: CustomResourceProviderRuntime.NODEJS_12_X,
  description: "Lambda function created by the custom resource provider",
});

new CustomResource(this, 'MyResource', {
  resourceType: 'Custom::MyCustomResourceType',
  serviceToken: serviceToken
});
```

The directory (`my-handler` in the above example) must include an `index.js` file. It cannot import
external dependencies or files outside this directory. It must export an async
function named `handler`. This function accepts the CloudFormation resource
event object and returns an object with the following structure:

```js
exports.handler = async function(event) {
  const id = event.PhysicalResourceId; // only for "Update" and "Delete"
  const props = event.ResourceProperties;
  const oldProps = event.OldResourceProperties; // only for "Update"s

  switch (event.RequestType) {
    case "Create":
      // ...

    case "Update":
      // ...

      // if an error is thrown, a FAILED response will be submitted to CFN
      throw new Error('Failed!');

    case "Delete":
      // ...
  }

  return {
    // (optional) the value resolved from `resource.ref`
    // defaults to "event.PhysicalResourceId" or "event.RequestId"
    PhysicalResourceId: "REF",

    // (optional) calling `resource.getAtt("Att1")` on the custom resource in the CDK app
    // will return the value "BAR".
    Data: {
      Att1: "BAR",
      Att2: "BAZ"
    },

    // (optional) user-visible message
    Reason: "User-visible message",

    // (optional) hides values from the console
    NoEcho: true
  };
}
```

Here is an complete example of a custom resource that summarizes two numbers:

`sum-handler/index.js`:

```js
exports.handler = async (e) => {
  return {
    Data: {
      Result: e.ResourceProperties.lhs + e.ResourceProperties.rhs,
    },
  };
};
```

`sum.ts`:

```ts nofixture
import {
  Construct,
  CustomResource,
  CustomResourceProvider,
  CustomResourceProviderRuntime,
  Token,
} from '@aws-cdk/core';

export interface SumProps {
  readonly lhs: number;
  readonly rhs: number;
}

export class Sum extends Construct {
  public readonly result: number;

  constructor(scope: Construct, id: string, props: SumProps) {
    super(scope, id);

    const resourceType = 'Custom::Sum';
    const serviceToken = CustomResourceProvider.getOrCreate(this, resourceType, {
      codeDirectory: `${__dirname}/sum-handler`,
      runtime: CustomResourceProviderRuntime.NODEJS_12_X,
    });

    const resource = new CustomResource(this, 'Resource', {
      resourceType: resourceType,
      serviceToken: serviceToken,
      properties: {
        lhs: props.lhs,
        rhs: props.rhs
      }
    });

    this.result = Token.asNumber(resource.getAtt('Result'));
  }
}
```

Usage will look like this:

```ts fixture=README-custom-resource-provider
const sum = new Sum(this, 'MySum', { lhs: 40, rhs: 2 });
new CfnOutput(this, 'Result', { value: Token.asString(sum.result) });
```

To access the ARN of the provider's AWS Lambda function role, use the `getOrCreateProvider()`
built-in singleton method:

```ts
const provider = CustomResourceProvider.getOrCreateProvider(this, 'Custom::MyCustomResourceType', {
  codeDirectory: `${__dirname}/my-handler`,
  runtime: CustomResourceProviderRuntime.NODEJS_12_X,
});

const roleArn = provider.roleArn;
```

This role ARN can then be used in resource-based IAM policies.

#### The Custom Resource Provider Framework

The [`@aws-cdk/custom-resources`] module includes an advanced framework for
implementing custom resource providers.

[`@aws-cdk/custom-resources`]: https://docs.aws.amazon.com/cdk/api/latest/docs/custom-resources-readme.html

Handlers are implemented as AWS Lambda functions, which means that they can be
implemented in any Lambda-supported runtime. Furthermore, this provider has an
asynchronous mode, which means that users can provide an `isComplete` lambda
function which is called periodically until the operation is complete. This
allows implementing providers that can take up to two hours to stabilize.

Set `serviceToken` to `provider.serviceToken` to use this type of provider:

```ts
const provider = new customresources.Provider(this, 'MyProvider', {
  onEventHandler,
  isCompleteHandler, // optional async waiter
});

new CustomResource(this, 'MyResource', {
  serviceToken: provider.serviceToken
});
```

See the [documentation](https://docs.aws.amazon.com/cdk/api/latest/docs/custom-resources-readme.html) for more details.

## AWS CloudFormation features

A CDK stack synthesizes to an AWS CloudFormation Template. This section
explains how this module allows users to access low-level CloudFormation
features when needed.

### Stack Outputs

CloudFormation [stack outputs][cfn-stack-output] and exports are created using
the `CfnOutput` class:

```ts
new CfnOutput(this, 'OutputName', {
  value: myBucket.bucketName,
  description: 'The name of an S3 bucket', // Optional
  exportName: 'TheAwesomeBucket', // Registers a CloudFormation export named "TheAwesomeBucket"
});
```

[cfn-stack-output]: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/outputs-section-structure.html

### Parameters

CloudFormation templates support the use of [Parameters][cfn-parameters] to
customize a template. They enable CloudFormation users to input custom values to
a template each time a stack is created or updated. While the CDK design
philosophy favors using build-time parameterization, users may need to use
CloudFormation in a number of cases (for example, when migrating an existing
stack to the AWS CDK).

Template parameters can be added to a stack by using the `CfnParameter` class:

```ts
new CfnParameter(this, 'MyParameter', {
  type: 'Number',
  default: 1337,
  // See the API reference for more configuration props
});
```

The value of parameters can then be obtained using one of the `value` methods.
As parameters are only resolved at deployment time, the values obtained are
placeholder tokens for the real value (`Token.isUnresolved()` would return `true`
for those):

```ts
const param = new CfnParameter(this, 'ParameterName', { /* config */ });

// If the parameter is a String
param.valueAsString;

// If the parameter is a Number
param.valueAsNumber;

// If the parameter is a List
param.valueAsList;
```

[cfn-parameters]: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/parameters-section-structure.html

### Pseudo Parameters

CloudFormation supports a number of [pseudo parameters][cfn-pseudo-params],
which resolve to useful values at deployment time. CloudFormation pseudo
parameters can be obtained from static members of the `Aws` class.

It is generally recommended to access pseudo parameters from the scope's `stack`
instead, which guarantees the values produced are qualifying the designated
stack, which is essential in cases where resources are shared cross-stack:

```ts
// "this" is the current construct
const stack = Stack.of(this);

stack.account; // Returns the AWS::AccountId for this stack (or the literal value if known)
stack.region;  // Returns the AWS::Region for this stack (or the literal value if known)
stack.partition;
```

[cfn-pseudo-params]: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/pseudo-parameter-reference.html

### Resource Options

CloudFormation resources can also specify [resource
attributes][cfn-resource-attributes]. The `CfnResource` class allows
accessing those through the `cfnOptions` property:

```ts
const rawBucket = new s3.CfnBucket(this, 'Bucket', { /* ... */ });
// -or-
const rawBucketAlt = myBucket.node.defaultChild as s3.CfnBucket;

// then
rawBucket.cfnOptions.condition = new CfnCondition(this, 'EnableBucket', { /* ... */ });
rawBucket.cfnOptions.metadata = {
  metadataKey: 'MetadataValue',
};
```

Resource dependencies (the `DependsOn` attribute) is modified using the
`cfnResource.addDependsOn` method:

```ts
const resourceA = new CfnResource(this, 'ResourceA', resourceProps);
const resourceB = new CfnResource(this, 'ResourceB', resourceProps);

resourceB.addDependsOn(resourceA);
```

[cfn-resource-attributes]: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-product-attribute-reference.html

### Intrinsic Functions and Condition Expressions

CloudFormation supports [intrinsic functions][cfn-intrinsics]. These functions
can be accessed from the `Fn` class, which provides type-safe methods for each
intrinsic function as well as condition expressions:

```ts
// To use Fn::Base64
Fn.base64('SGVsbG8gQ0RLIQo=');

// To compose condition expressions:
const environmentParameter = new CfnParameter(this, 'Environment');
Fn.conditionAnd(
  // The "Environment" CloudFormation template parameter evaluates to "Production"
  Fn.conditionEquals('Production', environmentParameter),
  // The AWS::Region pseudo-parameter value is NOT equal to "us-east-1"
  Fn.conditionNot(Fn.conditionEquals('us-east-1', Aws.REGION)),
);
```

When working with deploy-time values (those for which `Token.isUnresolved`
returns `true`), idiomatic conditionals from the programming language cannot be
used (the value will not be known until deployment time). When conditional logic
needs to be expressed with un-resolved values, it is necessary to use
CloudFormation conditions by means of the `CfnCondition` class:

```ts
const environmentParameter = new CfnParameter(this, 'Environment');
const isProd = new CfnCondition(this, 'IsProduction', {
  expression: Fn.conditionEquals('Production', environmentParameter),
});

// Configuration value that is a different string based on IsProduction
const stage = Fn.conditionIf(isProd.logicalId, 'Beta', 'Prod').toString();

// Make Bucket creation condition to IsProduction by accessing
// and overriding the CloudFormation resource
const bucket = new s3.Bucket(this, 'Bucket');
const cfnBucket = myBucket.node.defaultChild as s3.CfnBucket;
cfnBucket.cfnOptions.condition = isProd;
```

[cfn-intrinsics]: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference.html

### Mappings

CloudFormation [mappings][cfn-mappings] are created and queried using the
`CfnMappings` class:

```ts
const regionTable = new CfnMapping(this, 'RegionTable', {
  mapping: {
    regionName: {
      'us-east-1': 'US East (N. Virginia)',
      'us-east-2': 'US East (Ohio)',
      // ...
    },
    // ...
  }
});

regionTable.findInMap('regionName', Aws.REGION);
```

This will yield the following template:

```yaml
Mappings:
  RegionTable:
    regionName:
      us-east-1: US East (N. Virginia)
      us-east-2: US East (Ohio)
```

[cfn-mappings]: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/mappings-section-structure.html

### Dynamic References

CloudFormation supports [dynamically resolving][cfn-dynamic-references] values
for SSM parameters (including secure strings) and Secrets Manager. Encoding such
references is done using the `CfnDynamicReference` class:

```ts
new CfnDynamicReference(
  CfnDynamicReferenceService.SECRETS_MANAGER,
  'secret-id:secret-string:json-key:version-stage:version-id',
);
```

[cfn-dynamic-references]: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/dynamic-references.html

### Template Options & Transform

CloudFormation templates support a number of options, including which Macros or
[Transforms][cfn-transform] to use when deploying the stack. Those can be
configured using the `stack.templateOptions` property:

```ts
const stack = new Stack(app, 'StackName');

stack.templateOptions.description = 'This will appear in the AWS console';
stack.templateOptions.transforms = ['AWS::Serverless-2016-10-31'];
stack.templateOptions.metadata = {
  metadataKey: 'MetadataValue',
};
```

[cfn-transform]: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/transform-section-structure.html

### Emitting Raw Resources

The `CfnResource` class allows emitting arbitrary entries in the
[Resources][cfn-resources] section of the CloudFormation template.

```ts
new CfnResource(this, 'ResourceId', {
  type: 'AWS::S3::Bucket',
  properties: {
    BucketName: 'bucket-name'
  },
});
```

As for any other resource, the logical ID in the CloudFormation template will be
generated by the AWS CDK, but the type and properties will be copied verbatim in
the synthesized template.

[cfn-resources]: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/resources-section-structure.html

### Including raw CloudFormation template fragments

When migrating a CloudFormation stack to the AWS CDK, it can be useful to
include fragments of an existing template verbatim in the synthesized template.
This can be achieved using the `CfnInclude` class.

```ts
new CfnInclude(this, 'ID', {
  template: {
    Resources: {
      Bucket: {
        Type: 'AWS::S3::Bucket',
        Properties: {
          BucketName: 'my-shiny-bucket'
        }
      }
    }
  },
});
```

### Termination Protection

You can prevent a stack from being accidentally deleted by enabling termination
protection on the stack. If a user attempts to delete a stack with termination
protection enabled, the deletion fails and the stack--including its status--remains
unchanged. Enabling or disabling termination protection on a stack sets it for any
nested stacks belonging to that stack as well. You can enable termination protection
on a stack by setting the `terminationProtection` prop to `true`.

```ts
const stack = new Stack(app, 'StackName', {
  terminationProtection: true,
});

// or
stack.terminationProtection = true;
```

By default, termination protection is disabled.

### CfnJson

`CfnJson` allows you to postpone the resolution of a JSON blob from
deployment-time. This is useful in cases where the CloudFormation JSON template
cannot express a certain value.

A common example is to use `CfnJson` in order to render a JSON map which needs
to use intrinsic functions in keys. Since JSON map keys must be strings, it is
impossible to use intrinsics in keys and `CfnJson` can help.

The following example defines an IAM role which can only be assumed by
principals that are tagged with a specific tag.

```ts
const tagParam = new CfnParameter(this, 'TagName');

const stringEquals = new CfnJson(this, 'ConditionJson', {
  value: {
    [`aws:PrincipalTag/${tagParam.valueAsString}`]: true,
  },
});

const principal = new iam.AccountRootPrincipal().withConditions({
  StringEquals: stringEquals,
});

new iam.Role(this, 'MyRole', { assumedBy: principal });
```

**Explanation**: since in this example we pass the tag name through a parameter, it
can only be resolved during deployment. The resolved value can be represented in
the template through a `{ "Ref": "TagName" }`. However, since we want to use
this value inside a [`aws:PrincipalTag/TAG-NAME`](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html#condition-keys-principaltag)
IAM operator, we need it in the *key* of a `StringEquals` condition. JSON keys
*must be* strings, so to circumvent this limitation, we use `CfnJson`
to "delay" the rendition of this template section to deploy-time. This means
that the value of `StringEquals` in the template will be `{ "Fn::GetAtt": [ "ConditionJson", "Value" ] }`, and will only "expand" to the operator we synthesized during deployment.

### Stack Resource Limit

When deploying to AWS CloudFormation, it needs to keep in check the amount of resources being added inside a Stack. Currently it's possible to check the limits in the [AWS CloudFormation quotas](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cloudformation-limits.html) page.

It's possible to synthesize the project with more Resources than the allowed (or even reduce the number of Resources).

Set the context key `@aws-cdk/core:stackResourceLimit` with the proper value, being 0 for disable the limit of resources.

<!--END CORE DOCUMENTATION-->
