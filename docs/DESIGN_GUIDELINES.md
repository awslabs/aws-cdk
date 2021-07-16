# AWS Construct Library Design Guidelines

The AWS Construct Library is a rich class library of CDK constructs which
represent all resources offered by the AWS Cloud and higher-level constructs for
achieving common tasks.

The purpose of this document is to provide guidelines for designing the APIs in
the AWS Construct Library in order to ensure a consistent and integrated
experience across the entire AWS surface area.

* [Preface](#preface)
* [What's Included](#what-s-included)
* [API Design](#api-design)
  * [Modules](#modules)
  * [Construct Class](#construct-class)
  * [Construct Interface](#construct-interface)
    * [Owned vs. Unowned Constructs](#owned-vs-unowned-constructs)
    * [Abstract Base](#abstract-base)
  * [Props](#props)
    * [Types](#types)
    * [Defaults](#defaults)
    * [Flat](#flat)
    * [Concise](#concise)
    * [Naming](#naming)
    * [Property Documentation](#property-documentation)
    * [Enums](#enums)
    * [Unions](#unions)
  * [Attributes](#attributes)
  * [Configuration](#configuration)
    * [Prefer Additions](#prefer-additions)
    * [Dropped Mutations](#dropped-mutations)
  * [Factories](#factories)
  * [Imports](#imports)
    * [“from” Methods](#-from--methods)
    * [From-attributes](#from-attributes)
  * [Roles](#roles)
  * [Resource Policies](#resource-policies)
  * [VPC](#vpc)
  * [Grants](#grants)
  * [Metrics](#metrics)
  * [Events](#events)
  * [Connections](#connections)
  * [Integrations](#integrations)
  * [State](#state)
  * [Physical Names - TODO](#physical-names---todo)
  * [Tags](#tags)
  * [Secrets](#secrets)
* [Project Structure](#project-structure)
  * [Code Organization](#code-organization)
* [Implementation](#implementation)
  * [General Principles](#general-principles)
  * [Construct IDs](#construct-ids)
  * [Errors](#errors)
    * [Avoid Errors If Possible](#avoid-errors-if-possible)
    * [Error reporting mechanism](#error-reporting-mechanism)
    * [Throwing exceptions](#throwing-exceptions)
    * [Never Catch Exceptions](#never-catch-exceptions)
    * [Attaching (lazy) Validators](#attaching--lazy--validators)
    * [Attaching Errors/Warnings](#attaching-errors-warnings)
    * [Error messages](#error-messages)
  * [Tokens](#tokens)
* [Documentation](#documentation)
  * [Inline Documentation](#inline-documentation)
  * [Readme](#readme)
* [Testing](#testing)
  * [Unit tests](#unit-tests)
  * [Integration tests](#integration-tests)
  * [Versioning](#versioning)
* [Naming & Style](#naming---style)
  * [Naming Conventions](#naming-conventions)
  * [Coding Style](#coding-style)

## Preface

As much as possible, the guidelines in this document are enforced using the
[**awslint** tool](https://www.npmjs.com/package/awslint) which reflects on the
APIs and verifies that the APIs adhere to the guidelines. When a guideline is
backed by a linter rule, the rule name will be referenced like this:
_[awslint:resource-class-is-construct]_.

For the purpose of this document, we will use "Foo" to denote the official name
of the resource as defined in the AWS CloudFormation resource specification
(i.e. "Bucket", "Queue", "Topic", etc). This notation allows deriving names from
the official name. For example, `FooProps` would be `BucketProps`, `TopicProps`,
etc, `IFoo` would be `IBucket`, `ITopic` and so forth.

The guidelines in this document use TypeScript (and npm package names) since
this is the source programming language used to author the library, which is
later packaged and published to all programming languages through
[jsii](https://github.com/awslabs/jsii).

When designing APIs for the AWS Construct Library (and these guidelines), we
follow the tenets of the AWS CDK:

* **Meet developers where they are**: our APIs are based on the mental model of
the user, and not the mental model of the service APIs, which are normally
designed against the constraints of the backend system and the fact that these
APIs are used through network requests. It's okay to enable multiple ways to
achieve the same thing, in order to make it more natural for users who come from
different mental models.
* **Full coverage**: the AWS Construct Library exposes the full surface area of
AWS. It is not opinionated about which parts of the service API should be
used. However, it offers sensible defaults to allow users to get started quickly
with best practices, but allows them to fully customize this behavior. We use a
layered architecture so that users can choose the level of abstraction that fits
their needs.
* **Designed for the CDK**: the AWS Construct Library is primarily optimized for
AWS customers who use the CDK idiomatically and natively.  As much as possible,
the APIs are non-leaky and do not require that users understand how AWS
CloudFormation works. If users wish to “escape” from the abstraction, the APIs
offer explicit ways to do that, so that users won't be blocked by missing
capabilities or issues.
* **Open**: the AWS Construct Library is an open and extensible framework. It is
also open source. It heavily relies on interfaces to allow developers to extend
its behavior and provide their own custom implementations. Anyone should be able
to publish constructs that look & feel exactly like any construct in the AWS
Construct Library.
* **Designed for jsii**: the AWS Construct Library is built with jsii. This
allows the library to be used from all supported programming languages. jsii
poses restrictions on language features that cannot be idiomatically represented
in target languages.

## What's Included

The AWS Construct Library, which is shipped as part of the AWS CDK constructs
representing AWS resources.

The AWS Construct Library has multiple layers of constructs, beginning
with low-level constructs, which we call _CFN Resources_ (or L1, short for
"level 1") or CFN Resources (short for CloudFormation). These constructs
directly represent all resources available in AWS CloudFormation. CFN Resources
are periodically generated from the AWS CloudFormation Resource
Specification. They are named **Cfn**_Xyz_, where _Xyz_ is name of the
resource. For example, CfnBucket represents the AWS::S3::Bucket AWS
CloudFormation resource. When you use Cfn resources, you must explicitly
configure all resource properties, which requires a complete understanding of
the details of the underlying AWS CloudFormation resource model.

The next level of constructs, L2, also represent AWS resources, but with a
higher-level, intent-based API. They provide similar functionality, but provide
the defaults, boilerplate, and glue logic you'd be writing yourself with a CFN
Resource construct. L2 constructs offer convenient defaults and reduce the need
to know all the details about the AWS resources they represent, while providing
convenience methods that make it simpler to work with the resource. For example,
the `s3.Bucket` class represents an Amazon S3 bucket with additional properties
and methods, such as `bucket.addLifeCycleRule()`, which adds a lifecycle rule to
the bucket.

Examples of behaviors that an L2 commonly include:

- Strongly-typed modeling of the underlying L1 properties
- Methods for integrating other AWS resources (e.g., adding an event notification to
  an S3 bucket).
- Modeling of permissions and resource policies
- Modeling of metrics

In addition to the above, some L2s may introduce more complex and
helpful functionality, either part of the original L2 itself, or as part of a
separate construct. The most common form of these L2s are integration constructs
that model interactions between different services (e.g., SNS publishing to SQS,
CodePipeline actions that trigger Lambda functions).

The next level of abstraction present within the CDK are what we designate as
"L2.5s": a step above the L2s in terms of abstraction, but not quite at the
level of complete patterns or applications.  These constructs still largely
focus on a single logical resource -- in constrast to "patterns" which combine
multiple resources -- but are customized for a specific common usage scenario of
an L2. Examples of L2.5s in the CDK are `aws-apigateway.LambdaRestApi`,
`aws-lambda-nodejs.NodeJsFunction`, `aws-rds.ServerlessCluster` and `eks.FargateCluster`.

L2.5 constructs will be considered for inclusion in the CDK if they...

- cover a common usage scenario that can be used by a significant portion of
  the community;
- provide significant ease of use over the base L2 (via usage-specific defaults
  convenience methods or improved strong-typing);
- simplify or enable another L2 within the CDK

The CDK also currently includes some even higher-level constructs, which we call
patterns. These constructs often involve multiple kinds of resources and are
designed to help you complete common tasks in AWS or represent entire
applications. For example, the
`aws-ecs-patterns.ApplicationLoadBalancedFargateService` construct represents an
architecture that includes an AWS Fargate container cluster employing an
Application Load Balancer (ALB). These patterns are typically difficult to
design to be one-size-fits-all and are best suited to be published as separate
libraries, rather than included directly in the CDK. The patterns that currently
exist in the CDK will be removed in the next CDK major version (CDKv2).

## API Design

### Modules

AWS resources are organized into modules based on their AWS service. For
example, the "Bucket" resource, which is offered by the Amazon S3 service will
be available under the **@aws-cdk/aws-s3** module. We will use the “aws-” prefix
for all AWS services, regardless of whether their marketing name uses an
“Amazon” prefix (e.g. “Amazon S3”). Non-AWS services supported by AWS
CloudFormation (like the Alexa::ASK namespace) will be **@aws-cdk/alexa-ask**.

The name of the module is based on the AWS namespace of this service, which is
consistent with the AWS SDKs and AWS CloudFormation _[awslint:module-name]_.

All major versions of an AWS namespace will be mastered in the AWS Construct
Library under the root namespace. For example resources of the **ApiGatewayV2**
namespace will be available under the **@aws-cdk/aws-apigateway** module (and
not under “v2) _[awslint:module-v2]_.

In some cases, it makes sense to introduce secondary modules for a certain
service (e.g. aws-s3-notifications, aws-lambda-event-sources, etc). The name of
the secondary module will be
**@aws-cdk/aws-xxx-\<secondary-module\>**_[awslint:module-secondary]_.

Documentation for how to use secondary modules should be in the main module. The
README file should refer users to the central module
_[awslint:module-secondary-readme-redirect]_.

### Construct Class

Constructs are the basic building block of CDK applications. They represent
abstract cloud components of any complexity. Constructs in the AWS Construct
Library normally represent physical AWS resources (such as an SQS queue) but
they can also represent abstract composition of other constructs (such as
**LoadBalancedFargateService**).

Most of the guidelines in this document apply to all constructs in the AWS
Construct Library, regardless of whether they represent concrete AWS resources
or abstractions. However, you will notice that some sections explicitly call out
guidelines that apply only to AWS resources (and in many cases
enforced/implemented by the **Resource** base class).

AWS services are modeled around the concept of *resources*. Services normally
expose one or more resources through their APIs, which can be provisioned
through the APIs control plane or through AWS CloudFormation.

Every resource available in the AWS platform will have a corresponding resource
construct class to represents it. For example, the **s3.Bucket** construct
represents Amazon S3 Buckets, the **dynamodb.Table** construct represents an
Amazon DynamoDB table. The name of resource constructs must be identical to the
name of the resource in the AWS API, which should be consistent with the
resource name in the AWS CloudFormation spec _[awslint:resource-class]_.

> The _awslint:resource-class_ rule is a **warning** (instead of an error). This
  allows us to gradually expand the coverage of the library.

Classes which represent AWS resources are constructs and they must extend the
**cdk.Resource** class directly or indirectly
_[awslint:resource-class-extends-resource]_.

> Resource constructs are normally implemented using low-level CloudFormation
  (“CFN”) constructs, which are automatically generated from the AWS
  CloudFormation resource specification.

The signature (both argument names and types) of all construct initializers
(constructors) must be as follows _[awslint:construct-ctor]_:

```ts
constructor(scope: cdk.Construct, id: string, props: FooProps)
```

The **props** argument must be of type FooProps
[_awslint:construct-ctor-props-type_].

If all props are optional, the `props` argument must also be optional
_[awslint:construct-ctor-props-optional]_.

```ts
constructor(scope: cdk.Construct, id: string, props: FooProps = {})
```

> Using `= {}` as a default value is preferable to using an optional qualifier
  (`?`) since it will ensure that props will never be `undefined` and therefore
  easier to parse in the method body.

As a rule of thumb, most constructs should directly extend the **Construct** or
**Resource** instead of another construct. Prefer representing polymorphic
behavior through interfaces and not through inheritance.

Construct classes should extend only one of the following classes
[_awslint:construct-inheritence_]:

* The **Resource** class (if it represents an AWS resource)
* The **Construct** class (if it represents an abstract component)
* The **XxxBase** class (which, in turn extends **Resource**)

All constructs must define a static type check method called **isFoo** with the
following implementation [_awslint:static-type-check_]:

```ts
const IS_FOO = Symbol.for('@aws-cdk/aws-foo.Foo');

export class Foo {
  public static isFoo(x: any): x is Foo {
    return IS_FOO in x;
  }

  constructor(scope: Construct, id: string, props: FooProps) {
    super(scope, id);

    Object.defineProperty(this, IS_FOO, { value: true });
  }
}
```

### Construct Interface

One of the important tenets of the AWS Construct Library is to use strong-types
when referencing resources across the library. This is in contrast to how AWS
backend APIs (and, consequently, AWS CloudFormation) model reference via one of
their *runtime attributes* (such as the resource's ARN). Since the AWS CDK is a
client-side abstraction, we can offer developers a much richer experience by
using *object references* instead of *attribute references*.

Using object references instead of attribute references allows consumers of
these objects to have a richer interaction with the consumed object. They can
reference runtime attributes such as the resource's ARN, but also utilize logic
encapsulated by the target object.

Here's an example: when a user defines an S3 bucket, they can pass in a KMS key
that will be used for bucket encryption:

```ts
new s3.Bucket(this, 'MyBucket', { encryptionKey: key });
```

The **Bucket** class can now use **key.keyArn** to obtain the ARN for the key,
but it can also call the **key.grantEncrypt** method as a result of a call to
**bucket.grantWrite**. Separation of concerns is a basic OO design principle:
the fact that the Bucket class needs the ARN or that it needs to request
encryption permissions are not the user's concern, and the API of the Bucket
class should not “leak” these implementation details. In the future, the Bucket
class can decide to interact differently with the **key** and this won't require
expanding its surface area. It also allows the **Key** class to change its
behavior (i.e. add an IAM action to enable encryption of certain types of keys)
without affecting the API of the consumer.

#### Owned vs. Unowned Constructs

Using object references instead of attribute references provides a richer API,
but also introduces an inherent challenge: how do we reference constructs that
are not defined inside the same app (“**owned**” by the app)? These could be
resources that were created by some other AWS CDK app, via the AWS console,
etc. We call these **“unowned” constructs.**

In order to model this concept of owned and unowned constructs, all constructs
in the AWS Construct Library should always have a corresponding **construct
interface**. This interface includes the API of the construct
_[awslint:construct-interface]_.

Therefore, when constructs are referenced ***anywhere*** in the API (e.g. in
properties or methods of other resources or higher-level constructs), the
resource interface (`IFoo`) should be used over concrete resource classes
(`Foo`). This will allow users to supply either internal or external resources
_[awslint:ref-via-interface]_.

Construct interfaces must extend the **IConstruct** interface in order to allow
consumers to take advantage of common resource capabilities such as unique IDs,
paths, scopes, etc _[awslint:construct-interface-extends-iconstruct]_.

Constructs that directly represent AWS resources (most of the constructs in the
AWS Construct Library) should extend **IResource** (which, transitively, extends
**IConstruct**) _[awslint:resource-interface-extends-resource]_.

#### Abstract Base

It is recommended to implement an abstract base class **FooBase** for each
resource **Foo**. The base class would normally implement the entire
construct interface and leave attributes as abstract properties.

```ts
abstract class FooBase extends Resource implements IFoo {
  public abstract fooName: string;
  public abstract fooArn: string;

  // .. concrete implementation of IFoo (grants, metrics, factories),
  // should only rely on "fooName" and "fooArn" theoretically
}
```

The construct base class can then be used to implement the various
deserialization and import methods by defining an ad-hoc local class which
simply provides an implementation for the attributes (see “Serialization” below
for an example).

The abstract base class should be internal and not exported in the module's API
_[awslint:construct-base-is-private]_. This is only a recommended (linter
warning).

### Props

Constructs are defined by creating a new instance and passing it a set of
**props** to the constructor. Throughout this document, we will refer to these
as “props” (to distinguish them from JavaScript object properties).

 The props argument for the **Foo** construct should be a struct (interface with
 only readonly properties) named **FooProps** _[awslint:props-struct-name]_.

> Even if a construct props simply extends from some other Props struct and does
  not add any new properties, you should still define it, so it will be
  extensible in the future without breaking users in languages like Java where
  the props struct name is explicitly named.

Props are the most important aspect of designing a construct. Props are the
entry point of the construct. They should reflect the entire surface area of the
service through semantics that are intuitive to how developers perceive the
service and its capabilities.

When designing the props of an AWS resource, consult the AWS Console experience
for creating this resource. Service teams spend a lot of energy thinking about
this experience. This is a great resource for learning about the mental model of
the user. Aligning with the console also makes it easier for users to jump back
and forth between the AWS Console (the web frontend of AWS) and the CDK (the
“programmatic frontend” of AWS).

AWS constructs should *not* have a “props” property
[_awslint:props-no-property_].

Construct props should expose the *full set* of capabilities of the AWS service
through a declarative interface [_awslint:props-coverage_].

This section describes guidelines for construct props.

#### Types

Use **strong types** (and specifically, construct interfaces) instead of
physical attributes when referencing other resources. For example, instead of
**keyArn**, use **kms.IKey** [_awslint:props-no-arn-refs_].

Do not “leak” the details or types of the CFN layer when defining your construct
API. In almost all cases, a richer object-oriented API can be exposed to
encapsulate the low-level surface [_awslint:props-no-cfn-types_].

Do not use the **Token** type. It provides zero type safety, and is a functional
interface that may not translate cleanly in other JSII runtimes. Therefore, it should
be avoided wherever possible [_awslint:props-no-tokens_].

**deCDK** allows users to synthesize CDK stacks through a CloudFormation-like
  template, similar to SAM. CDK constructs are represented in deCDK templates
  like CloudFormation resources. Technically, this means that when a construct
  is defined, users supply an ID, type and a set of properties. In order to
  allow users to instantiate all AWS Construct Library constructs through the
  deCDK syntax, we impose restrictions on prop types _[awslint:props-decdk]_:

* Primitives (string, number, boolean, date)
* Collections (list, map)
* Structs
* Enums
* Enum-like classes
* Union-like classes
* References to other constructs (through their construct interface)
* Integration interfaces (interfaces that have a “**bind**” method)

#### Defaults

A prop should be *required* only if there is no possible sensible default value
that can be provided *or calculated*.

Sensible defaults have a tremendous impact on the developer experience. They
offer a quick way to get started with minimal cognitive, but do not limit users
from harnessing the full power of the resource, and customizing its behavior.

> A good way to determine what's the right sensible default is to refer to the
  AWS Console resource creation experience. In many cases, there will be
  alignment.

The **@default** documentation tag must be included on all optional properties
of interfaces.

In cases where the default behavior can be described by a value (typically the
case for booleans and enums, sometimes for strings and numbers), the value immediately
follows the **@default** tag and should be a valid JavaScript value (as in:
`@default false`, or `@default "stringValue"`).

In the majority of cases, the default behavior is not a specific value but
rather depends on circumstances/context. The default documentation tag must
begin with a “**-**" and then include a description of the default behavior
_[awslint:props-default-doc]_. This is specially true if the property
is a complex value or a reference to an object: don't write `@default
undefined`, describe the behavior that happens if the property is not
supplied.

Describe the default value or default behavior, even if it's not CDK that
controls the default. For example, if an absent value does not get rendered
into the template and it's ultimately the AWS *service* that determines the
default behavior, we still describe it in our documentation.

Examples:

```ts
// ✅ DO - uses a '-' and describes the behavior

/**
 * External KMS key to use for bucket encryption.
 *
 * @default - if encryption is set to "Kms" and this property is undefined, a
 * new KMS key will be created and associated with this bucket.
 */
encryptionKey?: kms.IEncryptionKey;
```

```ts
/**
 * External KMS key to use for bucket encryption.
 *
 * @default undefined
 *            ❌ DO NOT - that the value is 'undefined' by default is implied. However,
 *                        what will the *behavior* be if the value is left out?
 */
encryptionKey?: kms.IEncryptionKey;
```

```ts
/**
 * Minimum capacity of the AutoScaling resource
 *
 * @default - no minimum capacity
 *             ❌ DO NOT - there most certainly is. It's probably 0 or 1.
 *
 * // OR
 * @default - the minimum capacity is the default minimum capacity
 *             ❌ DO NOT - this is circular and useless to the reader.
 *                         Describe what will actually happen.
 */
minCapacity?: number;
```

#### Flat

Do not introduce artificial nesting for props. It hinders discoverability and
makes it cumbersome to use in some languages (like Java) [_awslint:props-flat_].

You can use a shared prefix for related properties to make them appear next to
each other in documentation and code completion:

For example, instead of:

```ts
new Bucket(this, 'MyBucket', {
  bucketWebSiteConfiguration: {
    errorDocument: '404.html',
    indexDocument: 'index.html',
  }
});
```

Prefer:

```ts
new Bucket(this, 'MyBucket', {
  websiteErrorDocument: '404.html',
  websiteIndexDocument: 'index.html'
});
```

#### Concise

Property names should be short and concise as possible and take into
consideration the ample context in which the property is used. Being concise
doesn't mean inventing new semantics. It just means that you can remove
redundant context from the property names.

Being concise doesn't mean you should invent new service semantics (see next
item). It just means that you can remove redundant context from the property
names. For example, there is no need to repeat the resource type, the property
type or indicate that this is a "configuration".

For example, prefer “readCapacity” versus “readCapacityUnits”.

#### Naming

We prefer the terminology used by the official AWS service documentation over
new terminology, even if you think it's not ideal. It helps users diagnose
issues and map the mental model of the construct to the service APIs,
documentation and examples. For example, don't be tempted to change SQS's
**dataKeyReusePeriod** with **keyRotation** because it will be hard for people
to diagnose problems. They won't be able to just search for “sqs dataKeyReuse”
and find topics on it.

> We can relax this guideline when this is about generic terms (like
  `httpStatus` instead of `statusCode`). The important semantics to preserve are
  for *service features*: I wouldn't want to rename "lambda layers" to "lambda
  dependencies" just because it makes more sense because then users won't be
  able to bind these terms to the service documentation.

Indicate units of measurement in property names that don't use a strong
type. Use “milli”, “sec”, “min”, “hr”, “Bytes”, “KiB”, “MiB”, “GiB” (KiB=1024
bytes, while KB=1000 bytes).

#### Property Documentation

Every prop must have detailed documentation. It is recommended to **copy** from
the official AWS documentation in English if possible so that language and style
will match the service.

#### Enums

When relevant, use enums to represent multiple choices.

```ts
export enum MyEnum {
  OPTION1 = 'op21',
  OPTION2 = 'opt2',
}
```

A common pattern in AWS is to allow users to select from a predefined set of
common options, but also allow the user to provide their own customized values.

A pattern for an "Enum-like Class" should be used in such cases:

```ts
export interface MyProps {
  readonly option: MyOption;
}

export class MyOption {
  public static COMMON_OPTION_1 = new MyOption('common.option-1');
  public static COMMON_OPTION_2 = new MyOption('common.option-2');

  public constructor(public readonly customValue: string) { }
}
```

Then usage would be:

```ts
new BoomBoom(this, 'Boom', {
  option: MyOption.COMMON_OPTION_1
});
```

Suggestion for alternative syntax for custom options? Motivation: if we make
everything go through static factories, it will look more regular (I'm fine not
pursuing this, just popped into my head):

```ts
export class MyOption {
  public static COMMON_OPTION_1 = new MyOption('common.option-1');
  public static COMMON_OPTION_2 = new MyOption('common.option-2');

  public static custom(value: string) {
    return new MyOption(value);
  }

  // 'protected' iso. 'private' so that someone that really wants to can still
  // do subclassing. But maybe might as well be private.
  protected constructor(public readonly value: string) { }
}

// Usage
new BoomBoom(this, 'Boom', {
  option: MyOption.COMMON_OPTION_1
});

new BoomBoom(this, 'Boom', {
  option: MyOption.custom('my-value')
});
```

#### Unions

Do not use TypeScript union types in construct APIs (`string | number`) since
many of the target languages supported by the CDK cannot strongly-model such
types _[awslint:props-no-unions]_.

Instead, use a class with static methods:

```ts
new lambda.Function(this, 'MyFunction', {
  code: lambda.Code.asset('/asset/path'), // or
  code: lambda.Code.bucket(myBucket, 'bundle.zip'), // or
  code: lambda.Code.inline('code')
  // etc
}
```

### Attributes

Every AWS resource has a set of "physical" runtime attributes such as ARN,
physical names, URLs, etc. These attributes are commonly late-bound, which means
they can only be resolved during deployment, when AWS CloudFormation actually
provisions the resource.

AWS constructs must expose all resource attributes defined in the underlying
CloudFormation resource as readonly properties of the class
_[awslint:resource-attribute]_.

All properties that represent resource attributes must include the JSDoc tag
**@attribute** _[awslint:attribute-tag]_.

All attribute names must begin with the type name as a prefix
(e.g. ***bucket*Arn** instead of just **arn**) _[awslint:attribute-name]_. This
implies that if a property begins with the type name, it must have an
**@attribute** tag.

All resource attributes must be represented as readonly properties of the
resource interface _[awslint:attribute-readonly]_.

Resource attributes should use a type that corresponds to the resolved AWS
CloudFormation type (e.g. **string**, **string[]**) _[awslint:attribute-type]_.

> Resource attributes almost always represent string values (URL, ARN,
  name). Sometimes they might also represent a list of strings. Since attribute
  values can either be late-bound ("a promise to a string") or concrete ("a
  string"), the AWS CDK has a mechanism called "tokens" which allows codifying
  late-bound values into strings or string arrays. This approach was chosen in
  order to dramatically simplify the type-system and ergonomics of CDK code. As
  long as users treat these attributes as opaque values (e.g. not try to parse
  them or manipulate them), they can be used interchangeably.

If needed, you can query whether an object includes unresolved tokens by using
the **Token.unresolved(x)** method.

To ensure users are aware that the value returned by attribute properties should
be treated as an opaque token, the JSDoc “@returns” annotation should begin with
“**@returns a $token representing the xxxxx**”
[_awslint:attribute-doc-returns-token_].

### Configuration

When an app defines a construct or resource, it specifies its provisioning
configuration upon initialization. For example, when an SQS queue is defined,
its visibility timeout can be configured.

Naturally, when constructs are imported (unowned), the importing app does not
have control over its configuration (e.g. you cannot change the visibility
timeout of an SQS queue that you didn't create). Therefore, construct interfaces
cannot include methods that require access/mutation of configuration.

One of the problems with configuration mutation is that there could be a race
condition between two parts of the app, trying to set contradicting values.

There are a number use cases where you'd want to provide APIs which expose or
mutate the construct's configuration. For example,
**lambda.Function.addEnvironment** is a useful method that adds an environment
variable to the function's runtime environment, and used occasionally to inject
dependencies.

> Note that there are APIs that look like they mutate the construct, but in fact
  they are **factories** (i.e. they define resources on the user's stack). Those
  APIs _should_ be exposed on the construct interface and not on the construct
  class.

To help avoid the common mistake of exposing non-configuration APIs on the
construct class (versus the construct interface), we require that configuration
APIs (methods/properties) defined on the construct class will be annotated with
the **@config** jsdoc tag [_awslint:config-explicit_].

```ts
interface IFoo extends IConstruct {
  bar(): void;
}

class Foo extends Construct implements IFoo {
  public bar() { }

  /** @mutating */
  public goo() { }

  public mutateMe() { } // ERROR! missing "@mutating" or missing on IFoo
}
```

#### Prefer Additions

As a rule of thumb, “adding” items to configuration props of type unordered
array is normally considered safe as it will unlikely cause race conditions. If
the prop is a map (like in **addEnvironment**), write defensive code that will
throw if two values are assigned to the same key.

#### Dropped Mutations

Since all references across the library are done through a construct's
interface, methods that are only available on the concrete construct class will
not be accessible by code that uses the interface type. For example, code that
accepts a **lambda.IFunction** will not see the **addEnvironment** method.

In most cases, this is desirable, as it ensures that only the code the owns the
construct (instantiated it), will be able to mutate its configuration.

However, there are certain areas in the library, where, for the sake of
consistency and interoperability, we allow mutating methods to be exposed on the
interface. For example, **grant** methods are exposed on the construct interface
and not on the concrete class. In most cases, when you grant a permission on an
AWS resource, the *principal's* policy needs to be updated, which mutates the
consumer. However, there are certain cases where a *resource policy* must be
updated. However, if the resource is unowned, it doesn't make sense (or even
impossible) to update its policy (there is usually a 1:1 relationship between a
resource and a resource policy). In such cases, we decided that grant methods
will simply skip any changes to resource policies, but will attach a
**permission notice** to the app, which will be printed when the stack is
synthesized by the toolkit.

### Factories

In most AWS services, there are one or more resources which can be referred to as
“primary resources” (normally one), while other resources exposed by the service
can be considered “secondary resources”.

For example, the AWS Lambda service exposes the **Function** resource, which can
be considered the primary resource while **Layer**, **Permission**, **Alias**
are considered secondary. For API Gateway, the primary resource is **RestApi**,
and there are many secondary resources such as **Method**, **Resource**,
**Deployment**, **Authorizer**.

Secondary resources are normally associated with the primary resource (i.e. a
reference to the primary resource must be supplied upon initialization).

Users should be able to define secondary resources either by directly
instantiating their construct class (like any other construct), and passing in a
reference to the primary resource's construct interface *or* it is recommended
to implement convenience methods on the primary resource that will facilitate
defining secondary resources. This improves discoverability and ergonomics
_[awslint:factory-method]_.

For example, **lambda.Function.addLayer** can be used to add a layer to the
function, **apigw.RestApi.addResource** can be used to add to an API.

Methods for defining a secondary resource “Bar” associated with a primary
resource “Foo” should have the following signature:

```ts
export interface IFoo {
  addBar(...): Bar;
}
```

Notice that:

* The method has an “add” prefix.
  It implies that users are adding something to their stack.
* The method is implemented on the construct interface
  (to allow adding secondary resources to unowned constructs).
* The method returns a “Bar” instance (owned).

In order to reuse the set of props used to configure the secondary resource,
define a base interface for **FooProps** called **FooOptions** to allow
secondary resource factory methods to reuse props
_[awslint:factory-method-options]_:

```ts
export interface LogStreamOptions {
  logStreamName?: string;
}

export interface LogStreamProps extends LogStreamOptions {
  logGroup: ILogGroup;
}

export interface ILogGroup {
  addLogStream(id: string, options?: LogStreamOptions): LogStream;
}
```

### Imports

Construct classes should expose a set of static factory methods with a
“**from**” prefix that will allow users to import *unowned* constructs into
their app.

The signature of all “from” methods should adhere to the following rules
_[awslint:from-signature]_:

* First argument must be **scope** of type **Construct**.
* Second argument is a **string**. This string will be used to determine the
  ID of the new construct. If the import method uses some value that is
  promised to be unique within the stack scope (such as ARN, export name),
  this value can be reused as the construct ID.
* Returns an object that implements the construct interface (**IFoo**).

#### “from” Methods

Resource constructs should export static “from” methods for importing unowned
resources given one or more of its physical attributes such as ARN, name, etc. All
constructs should have at least one `fromXxx` method _[awslint:from-method]_:

```ts
static fromFooArn(scope: Construct, id: string, bucketArn: string): IFoo;
static fromFooName(scope: Construct, id: string, bucketName: string): IFoo;
```

> Since AWS constructs usually export all resource attributes, the logic behind
  the various “from\<Attribute\>” methods would normally need to convert one
  attribute to another. For example, given a name, it would need to render the
  ARN of the resource. Therefore, if **from\<Attribute\>** methods expect to be
  able to parse their input, they must verify that the input (e.g. ARN, name)
  doesn't have unresolved tokens (using **Token.unresolved**). Preferably, they
  can use **Stack.parseArn** to achieve this purpose.

If a resource has an ARN attribute, it should implement at least a **fromFooArn**
import method [_awslint:from-arn_].

To implement **fromAttribute** methods, use the abstract base class construct as
follows:

<!-- markdownlint-disable MD013 -->
```ts
class Foo {
  static fromArn(scope: Construct, fooArn: string): IFoo {
    class _Foo extends FooBase {
      public get fooArn() { return fooArn; }
      public get fooName() { return this.node.stack.parseArn(fooArn).resourceName; }
    }

    return new _Foo(scope, fooArn);
  }
}
```
<!-- markdownlint-enable MD013 -->

#### From-attributes

If a resource has more than a single attribute (“ARN” and “name” are usually
considered a single attribute since it's usually possible to convert one to the
other), then the resource should provide a static **fromAttributes** method to
allow users to explicitly supply values to all resource attributes when they
import an external (unowned) resource [_awslint:from-attributes_].

```ts
static fromFooAttributes(scope: Construct, id: string, attrs: FooAttributes): IFoo;
```

### Roles

If a CloudFormation resource has a **Role** property, it normally represents the
IAM role that will be used by the resource to perform operations on behalf of
the user.

Constructs that represent such resources should conform to the following
guidelines.

An optional prop called **role** of type **iam.IRole**should be exposed to allow
users to "bring their own role", and use either an owned or unowned role
_[awslint:role-config-prop]_.

```ts
interface FooProps {
  /**
   * The role to associate with foo.
   * @default - a role will be automatically created
   */
  role?: iam.IRole;
}
```

The construct interface should expose a **role** property, and extends
**iam.IGrantable** _[awslint:role-property]_:

```ts
interface IFoo extends iam.IGrantable {
  /**
   * The role associated with foo. If foo is imported, no role will be available.
   */
  readonly role?: iam.IRole;
}
```

This property will be `undefined` if this is an unowned construct (e.g. was not
defined within the current app).

An **addToRolePolicy** method must be exposed on the construct interface to
allow adding statements to the role's policy _[awslint:role-add-to-policy]_:

```ts
interface IFoo {
  addToRolePolicy(statement: iam.Statement): void;
}
```

If the construct is unowned, this method should no-op and issue a **permissions
notice** (TODO) to the user indicating that they should ensure that the role of
this resource should have the specified permission.

Implementing **IGrantable** brings an implementation burden of **grantPrincipal:
IPrincipal**. This property must be set to the **role** if available, or to a
new **iam.ImportedResourcePrincipal** if the resource is imported and the role
is not available.

### Resource Policies

Resource policies are IAM policies defined on the side of the resource (as
oppose to policies attached to the IAM principal). Different resources expose
different APIs for controlling their resource policy. For example, ECR
repositories have a **RepositoryPolicyText** prop, SQS queues offer a
**QueuePolicy** resource, etc.

Constructs that represents resources with a resource policy should encapsulate
the details of how resource policies are created behind a uniform API as
described in this section.

When a construct represents an AWS resource that supports a resource policy, it
should expose an optional prop that will allow initializing resource with a
specified policy _[awslint:resource-policy-prop]_:

```ts
resourcePolicy?: iam.PolicyStatement[]
```

Furthermore, the construct *interface* should include a method that allows users
to add statements to the resource policy
_[awslint:resource-policy-add-to-policy]_:

```ts
interface IFoo extends iam.IResourceWithPolicy {
  addToResourcePolicy(statement: iam.PolicyStatement): void;
}
```

For some resources, such as ECR repositories, it is impossible (in
CloudFormation) to add a resource policy if the resource is unowned (the policy
is coupled with the resource creation). In such cases, the implementation of
`addToResourcePolicy` should add a **permission** **notice** to the construct
(using `node.addInfo`) indicating to the user that they must ensure that the
resource policy of that specified resource should include the specified
statement.

### VPC

Compute resources such as AWS Lambda functions, Amazon ECS clusters, AWS
CodeBuild projects normally allow users to specify the VPC configuration in
which they will be placed. The underlying CFN resources would normally have a
property or a set of properties that accept the set of subnets in which to place
the resources.

In most cases, the preferred default behavior is to place the resource in all
private subnets available within the VPC.

Props of such constructs should include the following properties
_[awslint:vpc-props]_:

```ts
/**
 * The VPC in which to run your CodeBuild project.
 */
vpc: ec2.IVpc; // usually this is required

/**
 * Which VPC subnets to use for your CodeBuild project.
 *
 * @default - uses all private subnets in your VPC
 */
vpcSubnetSelection?: ec2.SubnetSelection;
```

### Grants

Grants are one of the most powerful concepts in the AWS Construct Library. They
offer a higher level, intent-based, API for managing IAM permissions for AWS
resources.

**Despite the fact that they may be mutating**, grants should be exposed on the
  construct interface, and not on the concrete class
  _[awslint:grants-on-interface]_. See discussion above about mutability for
  reasoning.

Grants are represented as a set of methods with the “**grant**” prefix.

All constructs that represent AWS resources must have at least one grant method
called “**grant**” which can be used to grant a grantee (such as an IAM
principal) permission to perform a set of actions on the resource with the
following signature. This method is defined as an abstract method on the
**Resource** base class (and the **IResource** interface)
_[awslint:grants-grant-method]_:

```ts
grant(grantee: iam.IGrantable, ...actions: string[]): iam.Grant;
```

The **iam.Grant** class has a rich API for implementing grants which implements
the desired behavior.

Furthermore, resources should also include a set of grant methods for common use
cases. For example, **dynamodb.Table.grantPutItem**,
**s3.Bucket.grantReadWrite**, etc. In such cases, the signature of the grant
method should adhere to the following rules _[awslint:grant-signature]_:

1. Name should have a “grant” prefix
2. Returns an **iam.Grant** object
3. First argument must be **grantee: iam.IGrantable**

```ts
grantXxx(grantee: iam.IGrantable): iam.Grant;
```

It makes sense for some AWS resources to also expose grant methods on all
resources in the account. To support such use cases, expose a set of static
grant methods on the construct class. For example,
**dynamodb.Table.grantAllListStreams**. The signature of static grants should be
similar _[awslint:grants-static-all]_.

```ts
export class Table {
  public static grantAll(grantee: iam.IGrantable, ...actions: string[]): iam.Grant;
  public static grantAllListStreams(grantee: iam.IGrantable): iam.Grant;
}
```

### Metrics

Almost all AWS resources emit CloudWatch metrics, which can be used with alarms
and dashboards.

AWS construct interfaces should include a set of “metric” methods which
represent the CloudWatch metrics emitted from this resource
_[awslint:metrics-on-interface]_.

At a minimum (and enforced by IResource), all resources should have a single
method called **metric**, which returns a **cloudwatch.Metric** object
associated with this instance (usually this method will simply set the right
metrics namespace and dimensions [_awslint:metrics-generic-method_]:

```ts
metric(metricName: string, options?: cloudwatch.MetricOptions): cloudwatch.Metric;
```

> **Exclusion**: If a resource does not emit CloudWatch metrics, this rule may
    be excluded

Additional metric methods should be exposed with the official metric name as a
suffix and adhere to the following rules _[awslint:metrics-method-signature]:_

* Name should be “metricXxx” where “Xxx” is the official metric name
* Accepts a single “options” argument of type **MetricOptions**
* Returns a **Metric** object

```ts
interface IFunction {
  metricDuration(options?: cloudwatch.MetricOptions): cloudwatch.Metric;
  metricInvocations(options?: cloudwatch.MetricOptions): cloudwatch.Metric;
  metricThrottles(options?: cloudwatch.MetricOptions): cloudwatch.Metric;
}
```

It is sometimes desirable to use a metric that applies to all resources of a
certain type within the account. To facilitate this, resources should expose a
static method called **metricAll** _[awslint:metrics-static-all]_. Additional
**metricAll** static methods can also be exposed
_[awslint:metrics-all-methods]_.

<!-- markdownlint-disable MD013 -->
```ts
class Function extends Resource implements IFunction {
  public static metricAll(metricName: string, options?: cloudwatch.MetricOptions): cloudwatch.Metric;
  public static metricAllErrors(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
}
```
<!-- markdownlint-enable MD013 -->

### Events

Many AWS resources emit events to the CloudWatch event bus. Such resources should
have a set of “onXxx” methods available on their construct interface
_[awslint:events-in-interface]_.

All “on” methods should have the following signature
[_awslint:events-method-signature_]:

```ts
onXxx(id: string, target: events.IEventRuleTarget, options?: XxxOptions): cloudwatch.EventRule;
```

When a resource emits CloudWatch events, it should at least have a single
generic **onEvent** method to allow users to specify the event name
[_awslint:events-generic_]:

```ts
onEvent(event: string, id: string, target: events.IEventRuleTarget): cloudwatch.EventRule
```

### Connections

AWS resources that use EC2 security groups to manage network security should
implement the **connections API** interface by having the construct interface
extend **ec2.IConnectable** _[awslint:connectable-interface]_.

### Integrations

Many AWS services offer “integrations” with other services. For example, AWS
CodePipeline has actions that can trigger AWS Lambda functions, ECS tasks,
CodeBuild projects and more. AWS Lambda can be triggered by a variety of event
sources, AWS CloudWatch event rules can trigger many types of targets, SNS can
publish to SQS and Lambda, etc, etc.

> See [aws-cdk#1743](https://github.com/awslabs/aws-cdk/issues/1743) for a
  discussion on the various design options.

AWS integrations normally have a single **central** service and a set of
**consumed** services. For example, AWS CodePipeline is the central service and
consumes multiple services that can be used as pipeline actions. AWS Lambda is
the central service and can be triggered by multiple event sources.

Integrations are an abstract concept, not necessarily a specific mechanism. For
example, each AWS Lambda event source is implemented in a different way (SNS,
Bucket notifications, CloudWatch events, etc), but conceptually, *some* users
like to think about AWS Lambda as the “center”. It is also completely legitimate
to have multiple ways to connect two services on AWS. To trigger an AWS Lambda
function from an SNS topic, you could either use the integration or the SNS APIs
directly.

Integrations should be modeled using an **interface** (i.e. **IEventSource**)
exported in the API of the central module (e.g. “aws-lambda”) and implemented by
classes in the integrations module (“aws-lambda-event-sources”)
[_awslint:integrations-interface_].

```ts
// aws-lambda
interface IEventSource {
  bind(fn: IFunction): void;
}
```

A method “addXxx” should be defined on the construct interface and adhere to the
following rules _[awslint:integrations-add-method]:_

* Should accept any object that implements the integrations interface
* Should not return anything (void)
* Implementation should call “bind” on the integration object

```ts
interface IFunction extends IResource {
  public addEventSource(eventSource: IEventSource) {
    eventSource.bind(this);
  }
}
```

An optional array prop should allow declaratively applying integrations (sugar
to calling “addXxx”):

```ts
interface FunctionProps {
  eventSources?: IEventSource[];
}
```

Lastly, to ease discoverability and maintain a sane dependency graphs, all
integrations for a certain service should be mastered in a single secondary
module named aws-*xxx*-*yyy* (where *xxx* is the service name and *yyy* is the
integration name). For example, **aws-s3-notifications**,
**aws-lambda-event-sources**, **aws-codepipeline-actions**. All implementations
of the integration interface should reside in a single module
_[awslint:integrations-in-single-module]_.

```ts
// aws-lambda-event-sources
class DynamoEventSource implements IEventSource {
  constructor(table: dynamodb.ITable, options?: DynamoEventSourceOptions) { ... }

  public bind(fn: IFunction) {
    // ...do your magic
  }
}
```

When integration classes define new constructs in **bind**, they should be aware
that they are adding into a scope they don't fully control. This means they
should find a way to ensure that construct IDs do not conflict. This is a
domain-specific problem.

### State

Persistent resources are AWS resource which hold persistent state, such as
databases, tables, buckets, etc.

To make sure stateful resources can be easily identified, all resource
constructs must include the **@stateful** or **@stateless** JSDoc annotations at
the class level _[awslint:state-annotation]_.

This annotation enables the following linting rules.

```ts
/**
 * @stateful
 */
export class Table { }
```

Persistent resources must have a **removalPolicy** prop, defaults to
**Orphan** _[awslint:state-removal-policy-prop]_:

```ts
import { RemovalPolicy } from '@aws-cdk/cdk';

export interface TableProps {
  /**
   * @default ORPHAN
   */
  readonly removalPolicy?: RemovalPolicy;
}
```

Removal policy is applied at the CFN resource level using the
**RemovalPolicy.apply(resource)**:

```ts
RemovalPolicy.apply(cfnTable, props.removalPolicy);
```

The **IResource** interface requires that all resource constructs implement a
property **stateful** which returns **true** or **false** to allow runtime
checks query whether a resource is persistent
_[awslint:state-stateful-property]_.

### Physical Names - TODO

See <https://github.com/awslabs/aws-cdk/issues/2283>

### Tags

The AWS platform has a powerful tagging system that can be used to tag resources
with key/values. The AWS CDK exposes this capability through the **Tag**
“aspect”, which can seamlessly tag all resources within a subtree:

```ts
// add a tag to all taggable resource under "myConstruct"
myConstruct.node.apply(new cdk.Tag("myKey", "myValue"));
```

Constructs for AWS resources that can be tagged must have an optional **tags**
hash in their props [_awslint:tags-prop_].

### Secrets

If you expect a secret in your API (such as passwords, tokens), use the
**cdk.SecretValue** class to signal to users that they should not include
secrets in their CDK code or templates.

If a property is named “password” it must use the **SecretValue** type
[_awslint:secret-password_].  If a property has the word “token” in it, it must
use the SecretValue type [_awslint:secret-token_].

## Project Structure

### Code Organization

* Code should be under `lib/`
* Entry point should be `lib/index.ts` and should only contain “imports”
  for other files.
* No need to put every class in a separate file. Try to think of a
  reader-friendly organization of your source files.

## Implementation

The following guidelines and recommendations apply are related to the
implementation of AWS constructs.

### General Principles

* Do not future proof.
* No fluent APIs.
* Good APIs “speak” in the language of the user. The terminology your API uses
  should be intuitive and represent the mental model your user brings over,
  not one that you made up and you force them to learn.
* Multiple ways of achieving the same thing is legitimate.
* Constantly maintain the invariants.
* The fewer “if statements” the better.

### Construct IDs

Construct IDs (the second argument passed to all constructs when they are
defined) are used to formulate resource logical IDs which must be **stable**
across updates. The logical ID of a resource is calculated based on the **full
path** of its construct in the construct scope hierarchy. This means that any
change to a logical ID in this path will invalidate all the logical IDs within
this scope. This will result in **replacements of all underlying resources**
within the next update, which is extremely undesirable.

As described above, use the ID “**Resource**” for the primary resource of an AWS
construct.

Therefore, when implementing constructs, you should treat the construct
hierarchy and all construct IDs as part of the **external contract** of the
construct. Any change to either should be considered and called out as a
breaking change.

There is no need to concatenate logical IDs. If you find yourself needing to
that to ensure uniqueness, it's an indication that you may be able to create
another abstraction, or even just a **Construct** instance to serve as a
namespace:

```ts
const privateSubnets = new Construct(this, 'PrivateSubnets');
const publicSubnets = new Construct(this, 'PublishSubnets');

for (const az of availabilityZones) {
  new Subnet(privateSubnets, az);
  new Subnet(publicSubnets, az, { public: true });
}
```

### Errors

#### Avoid Errors If Possible

Always prefer to do the right thing for the user instead of raising an
error. Only fail if the user has explicitly specified bad configuration. For
example, VPC has **enableDnsHostnames** and **enableDnsSupport**. DNS hostnames
*require* DNS support, so only fail if the user enabled DNS hostnames but
explicitly disabled DNS support. Otherwise, auto-enable DNS support for them.

#### Error reporting mechanism

There are three mechanism you can use to report errors:

* Eagerly throw an exception (fails synthesis)
* Attach a (lazy) validator to a construct (fails synthesis)
* Attach errors to a construct (succeeds synthesis, fails deployment)

Between these, the first two fail synthesis, while the latter doesn't. Failing synthesis
means that no Cloud Assembly will be produced.

The distinction becomes apparent when you consider multiple stacks in the same Cloud
Assembly:

* If synthesis fails due to an error in *one* stack (either by throwing an exception
  or by failing validation), the other stack can also not be deployed.
* In contrast, if you attach an error to a construct in one stack, that stack cannot
  be deployed but the other one still can.

Choose one of the first two methods if the failure is caused by a misuse of the API,
which the user should be alerted to and fix as quickly as possible. Choose attaching
an error to a construct if the failure is due to environmental factors outside the
direct use of the API surface (for example, lack of context provider lookup values).

#### Throwing exceptions

This should be the preferred error reporting method.

Validate input as early as it is passed into your code (ctor, methods,
etc) and bail out by throwing an `Error`. No need to create subclasses of
Error since all errors in the CDK are unrecoverable.

When validating inputs, don't forget to account for the fact that these
values may be `Token`s and not available for inspection at synthesis time.

Example:

```ts
if (!Token.isUnresolved(props.minCapacity) && props.minCapacity < 1) {
  throw new Error(`'minCapacity' should be at least 1, got '${props.minCapacity}'`);
}
```

#### Never Catch Exceptions

All CDK errors are unrecoverable. If a method wishes to signal a recoverable
error, this should be modeled in a return value and not through exceptions.

#### Attaching (lazy) Validators

In the rare case where the integrity of your construct can only be checked
after the app has completed its initialization, call the
**this.node.addValidation()** method to add a validation object. This will
generally only be necessary if you want to produce an error when a certain
interaction with your construct did *not* happen (for example, a property
that should have been configured over the lifetime of the construct, wasn't):

Always prefer early input validation over post-validation, as the necessity
of these should be rare.

Example:

```ts
this.node.addValidation({
  // 'validate' should return a string[] list of errors
  validate: () => this.rules.length === 0
    ? ['At least one Rule must be added. Call \'addRule()\' to add Rules.']
    : []
  }
});
```

#### Attaching Errors/Warnings

You can also “attach” an error or a warning to a construct via
the **Annotations** class. These methods (e.g., `Annotations.of(construct).addWarning`)
will attach CDK metadata to your construct, which will be displayed to the user
by the toolchain when the stack is deployed.

Errors will not allow deployment and warnings will only be displayed in
highlight (unless `--strict` mode is used).

```ts
if (!Token.isUnresolved(subnetIds) && subnetIds.length < 2) {
  Annotations.of(this).addError(`Need at least 2 subnet ids, got: ${JSON.stringify(subnetIds)}`);
}
```

#### Error messages

Think about error messages from the point of view of the end user of the CDK.
This is not necessarily someone who knows about the internals of your
construct library, so try to phrase the message in a way that would make
sense to them.

For example, if a value the user supplied gets handed off between a number of
functions before finally being validated, phrase the message in terms of the
API the user interacted with, not in terms of the internal APIs.

A good error message should include the following components:

* What went wrong, in a way that makes sense to a top-level user
* An example of the incorrect value provided (if applicable)
* An example of the expected/allowed values (if applicable)
* The message should explain the (most likely) cause and change the user can
  make to rectify the situation

The message should be all lowercase and not end in a period, or contain
information that can be obtained from the stack trace.

```ts
// ✅ DO - show the value you got and be specific about what the user should do
`supply at least one of minCapacity or maxCapacity, got ${JSON.stringify(action)}`

// ❌ DO NOT - this tells the user nothing about what's wrong or what they should do
`required values are missing`

// ❌ DO NOT - this error only makes sense if you know the implementation
`'undefined' is not a number`
```

### Tokens

* Do not use FnSub

## Documentation

Documentation style (copy from official AWS docs) No need to Capitalize Resource
Names Like Buckets after they've been defined Stability (@stable, @experimental)
Use the word “define” to describe resources/constructs in your stack (instead of
“~~create~~”, “configure”, “provision”).  Use a summary line and separate the
doc body from the summary line using an empty line.

### Inline Documentation

All public APIs must be documented when first introduced
[_awslint:docs-public-apis_].

Do not add documentation on overrides/implementations. The public reference
documentation will automatically copy the base documentation to the derived
APIs, so it's better to avoid the confusion [_awslint:docs-no-duplicates_].

Use the following JSDoc tags: **@param**, **@returns**, **@default**, **@see**,
**@example.**

### Readme

* Header should include maturity level.
* Example for the simple use case should be almost the first thing.
* If there are multiple common use cases, provide an example for each one and
  describe what happens under the hood at a high level
  (e.g. which resources are created).
* Reference docs are not needed.
* Use literate (`.lit.ts`) integration tests into README file.

## Testing

### Unit tests

* Unit test utility functions and object models separately from constructs. If
  you want them to be “package-private”, just put them in a separate file and
  import `../lib/my-util` from your unit test code.
* Failing tests should be prefixed with “fails”

### Integration tests

* Integration tests should be under `test/integ.xxx.ts` and should basically
  just be CDK apps that can be deployed using “cdk deploy” (in the meantime).

### Versioning

* Semantic versioning Construct ID changes or scope hierarchy

## Naming & Style

### Naming Conventions

* **Class names**: PascalCase
* **Properties**: camelCase
* **Methods (static and non-static)**: camelCase
* **Interfaces** (“behavioral interface”): IMyInterface
* **Structs** (“data interfaces”): MyDataStruct
* **Enums**: PascalCase, **Members**: SNAKE_UPPER

### Coding Style

* **Indentation**: 2 spaces
* **Line length**: 150
* **String literals**: use single-quotes (`'`) or backticks (```)
* **Semicolons**: at the end of each code statement and declaration
  (incl. properties and imports).
* **Comments**: start with lower-case, end with a period.
