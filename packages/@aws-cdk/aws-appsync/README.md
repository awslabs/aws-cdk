# AWS AppSync Construct Library
<!--BEGIN STABILITY BANNER-->

---

![cfn-resources: Stable](https://img.shields.io/badge/cfn--resources-stable-success.svg?style=for-the-badge)

> All classes with the `Cfn` prefix in this module ([CFN Resources]) are always stable and safe to use.
>
> [CFN Resources]: https://docs.aws.amazon.com/cdk/latest/guide/constructs.html#constructs_lib

![cdk-constructs: Experimental](https://img.shields.io/badge/cdk--constructs-experimental-important.svg?style=for-the-badge)

> The APIs of higher level constructs in this module are experimental and under active development.
> They are subject to non-backward compatible changes or removal in any future version. These are
> not subject to the [Semantic Versioning](https://semver.org/) model and breaking changes will be
> announced in the release notes. This means that while you may use them, you may need to update
> your source code when upgrading to a newer version of this package.

---

<!--END STABILITY BANNER-->

The `@aws-cdk/aws-appsync` package contains constructs for building flexible
APIs that use GraphQL.

## Example

### DynamoDB

Example of a GraphQL API with `AWS_IAM` authorization resolving into a DynamoDb
backend data source.

GraphQL schema file `schema.graphql`:

```gql
type demo {
  id: String!
  version: String!
}
type Query {
  getDemos: [ demo! ]
}
input DemoInput {
  version: String!
}
type Mutation {
  addDemo(input: DemoInput!): demo
}
```

CDK stack file `app-stack.ts`:

```ts
import * as appsync from '@aws-cdk/aws-appsync';
import * as db from '@aws-cdk/aws-dynamodb';

const api = new appsync.GraphqlApi(stack, 'Api', {
  name: 'demo',
  schema: appsync.Schema.fromAsset(join(__dirname, 'schema.graphql')),
  authorizationConfig: {
    defaultAuthorization: {
      authorizationType: appsync.AuthorizationType.IAM
    },
  },
  xrayEnabled: true,
});

const demoTable = new db.Table(stack, 'DemoTable', {
  partitionKey: {
    name: 'id',
    type: db.AttributeType.STRING,
  },
});

const demoDS = api.addDynamoDbDataSource('demoDataSource', demoTable);

// Resolver for the Query "getDemos" that scans the DynamoDb table and returns the entire list.
demoDS.createResolver({
  typeName: 'Query',
  fieldName: 'getDemos',
  requestMappingTemplate: appsync.MappingTemplate.dynamoDbScanTable(),
  responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultList(),
});

// Resolver for the Mutation "addDemo" that puts the item into the DynamoDb table.
demoDS.createResolver({
  typeName: 'Mutation',
  fieldName: 'addDemo',
  requestMappingTemplate: appsync.MappingTemplate.dynamoDbPutItem(
    appsync.PrimaryKey.partition('id').auto(),
    appsync.Values.projecting('input')
  ),
  responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
});
```

### Aurora Serverless

AppSync provides a data source for executing SQL commands against Amazon Aurora
Serverless clusters. You can use AppSync resolvers to execute SQL statements
against the Data API with GraphQL queries, mutations, and subscriptions.

```ts
// Create username and password secret for DB Cluster
const secret = new rds.DatabaseSecret(stack, 'AuroraSecret', {
  username: 'clusteradmin',
});

// The VPC to place the cluster in
const vpc = new ec2.Vpc(stack, 'AuroraVpc');

// Create the serverless cluster, provide all values needed to customise the database.
const cluster = new rds.ServerlessCluster(stack, 'AuroraCluster', {
  engine: rds.DatabaseClusterEngine.AURORA_MYSQL,
  vpc,
  credentials: { username: 'clusteradmin' },
  clusterIdentifier: 'db-endpoint-test',
  defaultDatabaseName: 'demos',
});

// Build a data source for AppSync to access the database.
const rdsDS = api.addRdsDataSource('rds', cluster, secret, 'demos');

// Set up a resolver for an RDS query.
rdsDS.createResolver({
  typeName: 'Query',
  fieldName: 'getDemosRds',
  requestMappingTemplate: MappingTemplate.fromString(`
  {
    "version": "2018-05-29",
    "statements": [
      "SELECT * FROM demos"
    ]
  }
  `),
  responseMappingTemplate: MappingTemplate.fromString(`
    $util.rds.toJsonObject($ctx.result)
  `),
});

// Set up a resolver for an RDS mutation.
rdsDS.createResolver({
  typeName: 'Mutation',
  fieldName: 'addDemoRds',
  requestMappingTemplate: MappingTemplate.fromString(`
  {
    "version": "2018-05-29",
    "statements": [
      "INSERT INTO demos VALUES (:id, :version)",
      "SELECT * WHERE id = :id"
    ],
    "variableMap": {
      ":id": $util.toJson($util.autoId()),
      ":version": $util.toJson($ctx.args.version)
    }
  }
  `),
  responseMappingTemplate: MappingTemplate.fromString(`
    $util.rds.toJsonObject($ctx.result)
  `),
});
```

### HTTP Endpoints

GraphQL schema file `schema.graphql`:

```gql
type job {
  id: String!
  version: String!
}

input DemoInput {
  version: String!
}

type Mutation {
  callStepFunction(input: DemoInput!): job
}
```

GraphQL request mapping template `request.vtl`:

```json
{
  "version": "2018-05-29",
  "method": "POST",
  "resourcePath": "/",
  "params": {
    "headers": {
      "content-type": "application/x-amz-json-1.0",
      "x-amz-target":"AWSStepFunctions.StartExecution"
    },
    "body": {
      "stateMachineArn": "<your step functions arn>",
      "input": "{ \"id\": \"$context.arguments.id\" }"
    }
  }
}
```

GraphQL response mapping template `response.vtl`:

```json
{
  "id": "${context.result.id}"
}
```

CDK stack file `app-stack.ts`:

```ts
import * as appsync from '@aws-cdk/aws-appsync';

const api = new appsync.GraphqlApi(scope, 'api', {
  name: 'api',
  schema: appsync.Schema.fromFile(join(__dirname, 'schema.graphql')),
});

const httpDs = api.addHttpDataSource(
  'ds',
  'https://states.amazonaws.com',
  {
    name: 'httpDsWithStepF',
    description: 'from appsync to StepFunctions Workflow',
    authorizationConfig: {
      signingRegion: 'us-east-1',
      signingServiceName: 'states'
    }
  }
);

httpDs.createResolver({
  typeName: 'Mutation',
  fieldName: 'callStepFunction',
  requestMappingTemplate: MappingTemplate.fromFile('request.vtl'),
  responseMappingTemplate: MappingTemplate.fromFile('response.vtl')
});
```

### Elasticsearch

AppSync has builtin support for Elasticsearch from domains that are provisioned
through your AWS account. You can use AppSync resolvers to perform GraphQL operations
such as queries, mutations, and subscriptions.

```ts
const user = new User(stack, 'User');
const domain = new es.Domain(stack, 'Domain', {
  version: es.ElasticsearchVersion.V7_1,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  fineGrainedAccessControl: { masterUserArn: user.userArn },
  encryptionAtRest: { enabled: true },
  nodeToNodeEncryption: true,
  enforceHttps: true,
});

const ds = api.addElasticsearchDataSource('ds', domain);

ds.createResolver({
  typeName: 'Query',
  fieldName: 'getTests',
  requestMappingTemplate: appsync.MappingTemplate.fromString(JSON.stringify({
    version: '2017-02-28',
    operation: 'GET',
    path: '/id/post/_search',
    params: {
      headers: {},
      queryString: {},
      body: { from: 0, size: 50 },
    },
  })),
  responseMappingTemplate: appsync.MappingTemplate.fromString(`[
    #foreach($entry in $context.result.hits.hits)
    #if( $velocityCount > 1 ) , #end
    $utils.toJson($entry.get("_source"))
    #end
  ]`),
});
```

## Schema

Every GraphQL Api needs a schema to define the Api. CDK offers `appsync.Schema`
for static convenience methods for various types of schema declaration: code-first
or schema-first.

### Code-First

When declaring your GraphQL Api, CDK defaults to a code-first approach if the
`schema` property is not configured.

```ts
const api = new appsync.GraphqlApi(stack, 'api', { name: 'myApi' });
```

CDK will declare a `Schema` class that will give your Api access functions to
define your schema code-first: `addType`, `addObjectType`, `addToSchema`, etc.

You can also declare your `Schema` class outside of your CDK stack, to define
your schema externally.

```ts
const schema = new appsync.Schema();
schema.addObjectType('demo', {
  definition: { id: appsync.GraphqlType.id() },
});
const api = new appsync.GraphqlApi(stack, 'api', {
  name: 'myApi',
  schema
});
```

See the [code-first schema](#Code-First-Schema) section for more details.

### Schema-First

#### File

You can define your GraphQL Schema from a file on disk. For convenience, use
the `appsync.Schema.fromAsset` to specify the file representing your schema.

```ts
const api = appsync.GraphqlApi(stack, 'api', {
  name: 'myApi',
  schema: appsync.Schema.fromAsset(join(__dirname, 'schema.graphl')),
});
```

#### S3 Location

You can define your GraphQL Schema from an s3 location. For convenience, use
the `appsync.Schema.fromBucket` to specify the s3 location representing your schema.

```ts
const bucket = s3.Bucket.fromBucketName(stack, 'ImportedBucket', 'MyAppSyncBucket');

const api = new appsync.GraphqlApi(stack, 'Api', {
  name: 'myApi',
  schema: appsync.Schema.frombucket({
    bucket,
    key: 'appsync.test.graphql',
  }),
});
```

## Imports

Any GraphQL Api that has been created outside the stack can be imported from
another stack into your CDK app. Utilizing the `fromXxx` function, you have
the ability to add data sources and resolvers through a `IGraphqlApi` interface.

```ts
const importedApi = appsync.GraphqlApi.fromGraphqlApiAttributes(stack, 'IApi', {
  graphqlApiId: api.apiId,
  graphqlArn: api.arn,
});
importedApi.addDynamoDbDataSource('TableDataSource', table);
```

If you don't specify `graphqlArn` in `fromXxxAttributes`, CDK will autogenerate
the expected `arn` for the imported api, given the `apiId`. For creating data
sources and resolvers, an `apiId` is sufficient.

## Permissions

When using `AWS_IAM` as the authorization type for GraphQL API, an IAM Role
with correct permissions must be used for access to API.

When configuring permissions, you can specify specific resources to only be
accessible by `IAM` authorization. For example, if you want to only allow mutability
for `IAM` authorized access you would configure the following.

In `schema.graphql`:

```ts
type Mutation {
  updateExample(...): ...
    @aws_iam
}
```

In `IAM`:

```json
{
   "Version": "2012-10-17",
   "Statement": [
      {
         "Effect": "Allow",
         "Action": [
            "appsync:GraphQL"
         ],
         "Resource": [
            "arn:aws:appsync:REGION:ACCOUNT_ID:apis/GRAPHQL_ID/types/Mutation/fields/updateExample"
         ]
      }
   ]
}
```

See [documentation](https://docs.aws.amazon.com/appsync/latest/devguide/security.html#aws-iam-authorization) for more details.

To make this easier, CDK provides `grant` API.

Use the `grant` function for more granular authorization.

```ts
const role = new iam.Role(stack, 'Role', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
});
const api = new appsync.GraphqlApi(stack, 'API', {
  definition
});

api.grant(role, appsync.IamResource.custom('types/Mutation/fields/updateExample'), 'appsync:GraphQL')
```

### IamResource

In order to use the `grant` functions, you need to use the class `IamResource`.

- `IamResource.custom(...arns)` permits custom ARNs and requires an argument.

- `IamResouce.ofType(type, ...fields)` permits ARNs for types and their fields.

- `IamResource.all()` permits ALL resources.

### Generic Permissions

Alternatively, you can use more generic `grant` functions to accomplish the same usage.

These include:

- grantMutation (use to grant access to Mutation fields)
- grantQuery (use to grant access to Query fields)
- grantSubscription (use to grant access to Subscription fields)

```ts
// For generic types
api.grantMutation(role, 'updateExample');

// For custom types and granular design
api.grant(role, appsync.IamResource.ofType('Mutation', 'updateExample'), 'appsync:GraphQL');
```

## Pipeline Resolvers and AppSync Functions

AppSync Functions are local functions that perform certain operations onto a
backend data source. Developers can compose operations (Functions) and execute
them in sequence with Pipeline Resolvers.

```ts
const appsyncFunction = new appsync.AppsyncFunction(stack, 'function', {
  name: 'appsync_function',
  api: api,
  dataSource: apiDataSource,
  requestMappingTemplate: appsync.MappingTemplate.fromFile('request.vtl'),
  responseMappingTemplate: appsync.MappingTemplate.fromFile('response.vtl'),
});
```

AppSync Functions are used in tandem with pipeline resolvers to compose multiple
operations.

```ts
const pipelineResolver = new appsync.Resolver(stack, 'pipeline', {
  name: 'pipeline_resolver',
  api: api,
  dataSource: apiDataSource,
  requestMappingTemplate: appsync.MappingTemplate.fromFile('beforeRequest.vtl'),
  pipelineConfig: [appsyncFunction],
  responseMappingTemplate: appsync.MappingTemplate.fromFile('afterResponse.vtl'),
});
```

Learn more about Pipeline Resolvers and AppSync Functions [here](https://docs.aws.amazon.com/appsync/latest/devguide/pipeline-resolvers.html).

## Code-First Schema

CDK offers the ability to generate your schema in a code-first approach.
A code-first approach offers a developer workflow with:

- **modularity**: organizing schema type definitions into different files
- **reusability**: simplifying down boilerplate/repetitive code
- **consistency**: resolvers and schema definition will always be synced

The code-first approach allows for **dynamic** schema generation. You can generate your schema based on variables and templates to reduce code duplication.

### Code-First Example

To showcase the code-first approach. Let's try to model the following schema segment.

```gql
interface Node {
  id: String
}

type Query {
  allFilms(after: String, first: Int, before: String, last: Int): FilmConnection
}

type FilmNode implements Node {
  filmName: String
}

type FilmConnection {
  edges: [FilmEdge]
  films: [Film]
  totalCount: Int
}

type FilmEdge {
  node: Film
  cursor: String
}
```

Above we see a schema that allows for generating paginated responses. For example,
we can query `allFilms(first: 100)` since `FilmConnection` acts as an intermediary
for holding `FilmEdges` we can write a resolver to return the first 100 films.

In a separate file, we can declare our scalar types: `scalar-types.ts`.

```ts
import { GraphqlType } from '@aws-cdk/aws-appsync';

export const string = appsync.GraphqlType.string();
export const int = appsync.GraphqlType.int();
```

In another separate file, we can declare our object types and related functions.
We will call this file `object-types.ts` and we will have created it in a way that
allows us to generate other `XxxConnection` and `XxxEdges` in the future.

```ts
const pluralize = require('pluralize');
import * as scalar from './scalar-types.ts';
import * as appsync from '@aws-cdk/aws-appsync';

export const args = {
  after: scalar.string,
  first: scalar.int,
  before: scalar.string,
  last: scalar.int,
};

export const Node = new appsync.InterfaceType('Node', {
  definition: { id: scalar.string }
});
export const FilmNode = new appsync.ObjectType.implementInterface('FilmNode', {
  interfaceTypes: [Node],
  definition: { filmName: scalar.string }
});

export function generateEdgeAndConnection(base: appsync.ObjectType) {
  const edge = new appsync.ObjectType(`${base.name}Edge`, {
    definition: { node: base.attribute(), cursor: scalar.string }
  });
  const connection = new appsync.ObjectType(`${base.name}Connection`, {
    definition: {
      edges: edges.attribute({ isList: true }),
      [pluralize(base.name)]: base.attribute({ isList: true }),
      totalCount: scalar.int,
    }
  });
  return { edge: edge, connection: connection };
}
```

Finally, we will go to our `cdk-stack` and combine everything together
to generate our schema.

```ts
import * as appsync from '@aws-cdk/aws-appsync';
import * as schema from './object-types';

const api = new appsync.GraphqlApi(stack, 'Api', {
  name: 'demo',
});

this.objectTypes = [ schema.Node, schema.Film ];

const filmConnections = schema.generateEdgeAndConnection(schema.Film);

api.addQuery('allFilms', new appsync.ResolvableField({
    returnType: filmConnections.connection.attribute(),
    args: schema.args,
    dataSource: dummyDataSource,
    requestMappingTemplate: dummyRequest,
    responseMappingTemplate: dummyResponse,
  }),
});

this.objectTypes.map((t) => api.addType(t));
Object.keys(filmConnections).forEach((key) => api.addType(filmConnections[key]));
```

Notice how we can utilize the `generateEdgeAndConnection` function to generate
Object Types. In the future, if we wanted to create more Object Types, we can simply
create the base Object Type (i.e. Film) and from there we can generate its respective
`Connections` and `Edges`.

Check out a more in-depth example [here](https://github.com/BryanPan342/starwars-code-first).

## GraphQL Types

One of the benefits of GraphQL is its strongly typed nature. We define the
types within an object, query, mutation, interface, etc. as **GraphQL Types**.

GraphQL Types are the building blocks of types, whether they are scalar, objects,
interfaces, etc. GraphQL Types can be:

- [**Scalar Types**](https://docs.aws.amazon.com/appsync/latest/devguide/scalars.html): Id, Int, String, AWSDate, etc.
- [**Object Types**](#Object-Types): types that you generate (i.e. `demo` from the example above)
- [**Interface Types**](#Interface-Types): abstract types that define the base implementation of other
Intermediate Types

More concretely, GraphQL Types are simply the types appended to variables.
Referencing the object type `Demo` in the previous example, the GraphQL Types
is `String!` and is applied to both the names `id` and `version`.

### Directives

`Directives` are attached to a field or type and affect the execution of queries,
mutations, and types. With AppSync, we use `Directives` to configure authorization.
CDK provides static functions to add directives to your Schema.

- `Directive.iam()` sets a type or field's authorization to be validated through `Iam`
- `Directive.apiKey()` sets a type or field's authorization to be validated through a `Api Key`
- `Directive.oidc()` sets a type or field's authorization to be validated through `OpenID Connect`
- `Directive.cognito(...groups: string[])` sets a type or field's authorization to be validated
through `Cognito User Pools`
  - `groups` the name of the cognito groups to give access

To learn more about authorization and directives, read these docs [here](https://docs.aws.amazon.com/appsync/latest/devguide/security.html).

### Field and Resolvable Fields

While `GraphqlType` is a base implementation for GraphQL fields, we have abstractions
on top of `GraphqlType` that provide finer grain support.

### Field

`Field` extends `GraphqlType` and will allow you to define arguments. [**Interface Types**](#Interface-Types) are not resolvable and this class will allow you to define arguments,
but not its resolvers.

For example, if we want to create the following type:

```gql
type Node {
  test(argument: string): String
}
```

The CDK code required would be:

```ts
const field = new appsync.Field({
  returnType: appsync.GraphqlType.string(),
  args: {
    argument: appsync.GraphqlType.string(),
  },
});
const type = new appsync.InterfaceType('Node', {
  definition: { test: field },
});
```

### Resolvable Fields

`ResolvableField` extends `Field` and will allow you to define arguments and its resolvers.
[**Object Types**](#Object-Types) can have fields that resolve and perform operations on
your backend.

You can also create resolvable fields for object types.

```gql
type Info {
  node(id: String): String
}
```

The CDK code required would be:

```ts
const info = new appsync.ObjectType('Info', {
  definition: {
    node: new appsync.ResolvableField({
      returnType: appsync.GraphqlType.string(),
      args: {
        id: appsync.GraphqlType.string(),
      },
      dataSource: api.addNoneDataSource('none'),
      requestMappingTemplate: dummyRequest,
      responseMappingTemplate: dummyResponse,
    }),
  },
});
```

To nest resolvers, we can also create top level query types that call upon
other types. Building off the previous example, if we want the following graphql
type definition:

```gql
type Query {
  get(argument: string): Info
}
```

The CDK code required would be:

```ts
const query = new appsync.ObjectType('Query', {
  definition: {
    get: new appsync.ResolvableField({
      returnType: appsync.GraphqlType.string(),
      args: {
        argument: appsync.GraphqlType.string(),
      },
      dataSource: api.addNoneDataSource('none'),
      requestMappingTemplate: dummyRequest,
      responseMappingTemplate: dummyResponse,
    }),
  },
});
```

Learn more about fields and resolvers [here](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-overview.html).

### Intermediate Types

Intermediate Types are defined by Graphql Types and Fields. They have a set of defined
fields, where each field corresponds to another type in the system. Intermediate
Types will be the meat of your GraphQL Schema as they are the types defined by you.

Intermediate Types include:

- [**Interface Types**](#Interface-Types)
- [**Object Types**](#Object-Types)
- [**Enum Types**](#Enum-Types)
- [**Input Types**](#Input-Types)
- [**Union Types**](#Union-Types)

#### Interface Types

**Interface Types** are abstract types that define the implementation of other
intermediate types. They are useful for eliminating duplication and can be used
to generate Object Types with less work.

You can create Interface Types ***externally***.

```ts
const node = new appsync.InterfaceType('Node', {
  definition: {
    id: appsync.GraphqlType.string({ isRequired: true }),
  },
});
```

To learn more about **Interface Types**, read the docs [here](https://graphql.org/learn/schema/#interfaces).

#### Object Types

**Object Types** are types that you declare. For example, in the [code-first example](#code-first-example)
the `demo` variable is an **Object Type**. **Object Types** are defined by
GraphQL Types and are only usable when linked to a GraphQL Api.

You can create Object Types in three ways:

1. Object Types can be created ***externally***.

    ```ts
    const api = new appsync.GraphqlApi(stack, 'Api', {
      name: 'demo',
    });
    const demo = new appsync.ObjectType('Demo', {
      definition: {
        id: appsync.GraphqlType.string({ isRequired: true }),
        version: appsync.GraphqlType.string({ isRequired: true }),
      },
    });

    api.addType(object);
    ```

    > This method allows for reusability and modularity, ideal for larger projects.
    For example, imagine moving all Object Type definition outside the stack.

    `scalar-types.ts` - a file for scalar type definitions

    ```ts
    export const required_string = appsync.GraphqlType.string({ isRequired: true });
    ```

    `object-types.ts` - a file for object type definitions

    ```ts
    import { required_string } from './scalar-types';
    export const demo = new appsync.ObjectType('Demo', {
      definition: {
        id: required_string,
        version: required_string,
      },
    });
    ```

    `cdk-stack.ts` - a file containing our cdk stack

    ```ts
    import { demo } from './object-types';
    api.addType(demo);
    ```

2. Object Types can be created ***externally*** from an Interface Type.

    ```ts
    const node = new appsync.InterfaceType('Node', {
      definition: {
        id: appsync.GraphqlType.string({ isRequired: true }),
      },
    });
    const demo = new appsync.ObjectType('Demo', {
      interfaceTypes: [ node ],
      definition: {
        version: appsync.GraphqlType.string({ isRequired: true }),
      },
    });
    ```

    > This method allows for reusability and modularity, ideal for reducing code duplication.

To learn more about **Object Types**, read the docs [here](https://graphql.org/learn/schema/#object-types-and-fields).

#### Enum Types

**Enum Types** are a special type of Intermediate Type. They restrict a particular
set of allowed values for other Intermediate Types.

```gql
enum Episode {
  NEWHOPE
  EMPIRE
  JEDI
}
```

> This means that wherever we use the type Episode in our schema, we expect it to
> be exactly one of NEWHOPE, EMPIRE, or JEDI.

The above GraphQL Enumeration Type can be expressed in CDK as the following:

```ts
const episode = new appsync.EnumType('Episode', {
  definition: [
    'NEWHOPE',
    'EMPIRE',
    'JEDI',
  ],
});
api.addType(episode);
```

To learn more about **Enum Types**, read the docs [here](https://graphql.org/learn/schema/#enumeration-types).

#### Input Types

**Input Types** are special types of Intermediate Types. They give users an
easy way to pass complex objects for top level Mutation and Queries.

```gql
input Review {
  stars: Int!
  commentary: String
}
```

The above GraphQL Input Type can be expressed in CDK as the following:

```ts
const review = new appsync.InputType('Review', {
  definition: {
    stars: GraphqlType.int({ isRequired: true }),
    commentary: GraphqlType.string(),
  },
});
api.addType(review);
```

To learn more about **Input Types**, read the docs [here](https://graphql.org/learn/schema/#input-types).

#### Union Types

**Union Types** are a special type of Intermediate Type. They are similar to
Interface Types, but they cannot specify any common fields between types.

**Note:** the fields of a union type need to be `Object Types`. In other words, you
can't create a union type out of interfaces, other unions, or inputs.

```gql
union Search = Human | Droid | Starship
```

The above GraphQL Union Type encompasses the Object Types of Human, Droid and Starship. It
can be expressed in CDK as the following:

```ts
const string = appsync.GraphqlType.string();
const human = new appsync.ObjectType('Human', { definition: { name: string } });
const droid = new appsync.ObjectType('Droid', { definition: { name: string } });
const starship = new appsync.ObjectType('Starship', { definition: { name: string } }););
const search = new appsync.UnionType('Search', {
  definition: [ human, droid, starship ],
});
api.addType(search);
```

To learn more about **Union Types**, read the docs [here](https://graphql.org/learn/schema/#union-types).

### Query

Every schema requires a top level Query type. By default, the schema will look
for the `Object Type` named `Query`. The top level `Query` is the **only** exposed
type that users can access to perform `GET` operations on your Api.

To add fields for these queries, we can simply run the `addQuery` function to add
to the schema's `Query` type.

```ts
const string = appsync.GraphqlType.string();
const int = appsync.GraphqlType.int();
api.addQuery('allFilms', new appsync.ResolvableField({
  returnType: filmConnection.attribute(),
  args: { after: string, first: int, before: string, last: int},
  dataSource: api.addNoneDataSource('none'),
  requestMappingTemplate: dummyRequest,
  responseMappingTemplate: dummyResponse,
}));
```

To learn more about top level operations, check out the docs [here](https://docs.aws.amazon.com/appsync/latest/devguide/graphql-overview.html).

### Mutation

Every schema **can** have a top level Mutation type. By default, the schema will look
for the `ObjectType` named `Mutation`. The top level `Mutation` Type is the only exposed
type that users can access to perform `mutable` operations on your Api.

To add fields for these mutations, we can simply run the `addMutation` function to add
to the schema's `Mutation` type.

```ts
const string = appsync.GraphqlType.string();
const int = appsync.GraphqlType.int();
api.addMutation('addFilm', new appsync.ResolvableField({
  returnType: film.attribute(),
  args: { name: string, film_number: int },
  dataSource: api.addNoneDataSource('none'),
  requestMappingTemplate: dummyRequest,
  responseMappingTemplate: dummyResponse,
}));
```

To learn more about top level operations, check out the docs [here](https://docs.aws.amazon.com/appsync/latest/devguide/graphql-overview.html).

### Subscription

Every schema **can** have a top level Subscription type. The top level `Subscription` Type
is the only exposed type that users can access to invoke a response to a mutation. `Subscriptions`
notify users when a mutation specific mutation is called. This means you can make any data source
real time by specify a GraphQL Schema directive on a mutation.

**Note**: The AWS AppSync client SDK automatically handles subscription connection management.

To add fields for these subscriptions, we can simply run the `addSubscription` function to add
to the schema's `Subscription` type.

```ts
api.addSubscription('addedFilm', new appsync.ResolvableField({
  returnType: film.attribute(),
  args: { id: appsync.GraphqlType.id({ isRequired: true }) },
  directive: [appsync.Directive.subscribe('addFilm')],
}));
```

To learn more about top level operations, check out the docs [here](https://docs.aws.amazon.com/appsync/latest/devguide/real-time-data.html).
