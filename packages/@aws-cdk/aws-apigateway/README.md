# Amazon API Gateway Construct Library
<!--BEGIN STABILITY BANNER-->

---

![cfn-resources: Stable](https://img.shields.io/badge/cfn--resources-stable-success.svg?style=for-the-badge)

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->


Amazon API Gateway is a fully managed service that makes it easy for developers
to publish, maintain, monitor, and secure APIs at any scale. Create an API to
access data, business logic, or functionality from your back-end services, such
as applications running on Amazon Elastic Compute Cloud (Amazon EC2), code
running on AWS Lambda, or any web application.

## Table of Contents

- [Defining APIs](#defining-apis)
  - [Breaking up Methods and Resources across Stacks](#breaking-up-methods-and-resources-across-stacks)
- [AWS Lambda-backed APIs](#aws-lambda-backed-apis)
- [Integration Targets](#integration-targets)
- [Usage Plan & API Keys](#usage-plan--api-keys)
- [Working with models](#working-with-models)
- [Default Integration and Method Options](#default-integration-and-method-options)
- [Proxy Routes](#proxy-routes)
- [Authorizers](#authorizers)
  - [IAM-based authorizer](#iam-based-authorizer)
  - [Lambda-based token authorizer](#lambda-based-token-authorizer)
  - [Lambda-based request authorizer](#lambda-based-request-authorizer)
  - [Cognito User Pools authorizer](#cognito-user-pools-authorizer)
- [Mutual TLS](#mutal-tls-mtls)
- [Deployments](#deployments)
  - [Deep dive: Invalidation of deployments](#deep-dive-invalidation-of-deployments)
- [Custom Domains](#custom-domains)
- [Access Logging](#access-logging)
- [Cross Origin Resource Sharing (CORS)](#cross-origin-resource-sharing-cors)
- [Endpoint Configuration](#endpoint-configuration)
- [Private Integrations](#private-integrations)
- [Gateway Response](#gateway-response)
- [OpenAPI Definition](#openapi-definition)
  - [Endpoint configuration](#endpoint-configuration)
- [Metrics](#metrics)
- [APIGateway v2](#apigateway-v2)

## Defining APIs

APIs are defined as a hierarchy of resources and methods. `addResource` and
`addMethod` can be used to build this hierarchy. The root resource is
`api.root`.

For example, the following code defines an API that includes the following HTTP
endpoints: `ANY /`, `GET /books`, `POST /books`, `GET /books/{book_id}`, `DELETE /books/{book_id}`.

```ts
const api = new apigateway.RestApi(this, 'books-api');

api.root.addMethod('ANY');

const books = api.root.addResource('books');
books.addMethod('GET');
books.addMethod('POST');

const book = books.addResource('{book_id}');
book.addMethod('GET');
book.addMethod('DELETE');
```

## AWS Lambda-backed APIs

A very common practice is to use Amazon API Gateway with AWS Lambda as the
backend integration. The `LambdaRestApi` construct makes it easy:

The following code defines a REST API that routes all requests to the
specified AWS Lambda function:

```ts
const backend = new lambda.Function(...);
new apigateway.LambdaRestApi(this, 'myapi', {
  handler: backend,
});
```

You can also supply `proxy: false`, in which case you will have to explicitly
define the API model:

```ts
const backend = new lambda.Function(...);
const api = new apigateway.LambdaRestApi(this, 'myapi', {
  handler: backend,
  proxy: false
});

const items = api.root.addResource('items');
items.addMethod('GET');  // GET /items
items.addMethod('POST'); // POST /items

const item = items.addResource('{item}');
item.addMethod('GET');   // GET /items/{item}

// the default integration for methods is "handler", but one can
// customize this behavior per method or even a sub path.
item.addMethod('DELETE', new apigateway.HttpIntegration('http://amazon.com'));
```

You can also supply `integrationOptions` to explicitly define options of Lambda integrations:

```ts
const backend = new lambda.Function(...);
const api = new apigateway.LambdaRestApi(this, 'myapi', {
  handler: backend,
  integrationOptions: { allowTestInvoke: false }
});
```

### Breaking up Methods and Resources across Stacks

It is fairly common for REST APIs with a large number of Resources and Methods to hit the [CloudFormation
limit](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cloudformation-limits.html) of 500 resources per
stack.

To help with this, Resources and Methods for the same REST API can be re-organized across multiple stacks. A common
way to do this is to have a stack per Resource or groups of Resources, but this is not the only possible way.
The following example uses sets up two Resources '/pets' and '/books' in separate stacks using nested stacks:

[Resources grouped into nested stacks](test/integ.restapi-import.lit.ts)

## Integration Targets

Methods are associated with backend integrations, which are invoked when this
method is called. API Gateway supports the following integrations:

- `MockIntegration` - can be used to test APIs. This is the default
   integration if one is not specified.
- `LambdaIntegration` - can be used to invoke an AWS Lambda function.
- `AwsIntegration` - can be used to invoke arbitrary AWS service APIs.
- `HttpIntegration` - can be used to invoke HTTP endpoints.

The following example shows how to integrate the `GET /book/{book_id}` method to
an AWS Lambda function:

```ts
const getBookHandler = new lambda.Function(...);
const getBookIntegration = new apigateway.LambdaIntegration(getBookHandler);
book.addMethod('GET', getBookIntegration);
```

Integration options can be optionally be specified:

```ts
const getBookIntegration = new apigateway.LambdaIntegration(getBookHandler, {
  contentHandling: apigateway.ContentHandling.CONVERT_TO_TEXT, // convert to base64
  credentialsPassthrough: true, // use caller identity to invoke the function
});
```

Method options can optionally be specified when adding methods:

```ts
book.addMethod('GET', getBookIntegration, {
  authorizationType: apigateway.AuthorizationType.IAM,
  apiKeyRequired: true
});
```

It is possible to also integrate with AWS services in a different region. The following code integrates with Amazon SQS in the
`eu-west-1` region.

```ts
const getMessageIntegration = new apigateway.AwsIntegration({
  service: 'sqs', 
  path: 'queueName', 
  region: 'eu-west-1' 
});
```

## Usage Plan & API Keys

A usage plan specifies who can access one or more deployed API stages and methods, and the rate at which they can be
accessed. The plan uses API keys to identify API clients and meters access to the associated API stages for each key.
Usage plans also allow configuring throttling limits and quota limits that are enforced on individual client API keys. 

The following example shows how to create and asscociate a usage plan and an API key:

```ts
const api = new apigateway.RestApi(this, 'hello-api');

const v1 = api.root.addResource('v1');
const echo = v1.addResource('echo');
const echoMethod = echo.addMethod('GET', integration, { apiKeyRequired: true });

const plan = api.addUsagePlan('UsagePlan', {
  name: 'Easy',
  throttle: {
    rateLimit: 10,
    burstLimit: 2
  }
});

const key = api.addApiKey('ApiKey');
plan.addApiKey(key);
```

To associate a plan to a given RestAPI stage:

```ts
plan.addApiStage({
  stage: api.deploymentStage,
  throttle: [
    {
      method: echoMethod,
      throttle: {
        rateLimit: 10,
        burstLimit: 2
      }
    }
  ]
});
```

The name and value of the API Key can be specified at creation; if not
provided, a name and value will be automatically generated by API Gateway.

```ts
const key = api.addApiKey('ApiKey', {
  apiKeyName: 'myApiKey1',
  value: 'MyApiKeyThatIsAtLeast20Characters',
});
```

Existing API keys can also be imported into a CDK app using its id.

```ts
const importedKey = ApiKey.fromApiKeyId(this, 'imported-key', '<api-key-id>');
```

The "grant" methods can be used to give prepackaged sets of permissions to other resources. The
following code provides read permission to an API key.

```ts
importedKey.grantRead(lambda);
```

### ⚠️ Multiple API Keys

It is possible to specify multiple API keys for a given Usage Plan, by calling `usagePlan.addApiKey()`.

When using multiple API keys, a past bug of the CDK prevents API key associations to a Usage Plan to be deleted.
If the CDK app had the [feature flag] - `@aws-cdk/aws-apigateway:usagePlanKeyOrderInsensitiveId` - enabled when the API
keys were created, then the app will not be affected by this bug.

If this is not the case, you will need to ensure that the CloudFormation [logical ids] of the API keys that are not
being deleted remain unchanged.
Make note of the logical ids of these API keys before removing any, and set it as part of the `addApiKey()` method:

```ts
usageplan.addApiKey(apiKey, {
  overrideLogicalId: '...',
});
```

[feature flag]: https://docs.aws.amazon.com/cdk/latest/guide/featureflags.html
[logical ids]: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/resources-section-structure.html

### Rate Limited API Key

In scenarios where you need to create a single api key and configure rate limiting for it, you can use `RateLimitedApiKey`.
This construct lets you specify rate limiting properties which should be applied only to the api key being created.
The API key created has the specified rate limits, such as quota and throttles, applied.

The following example shows how to use a rate limited api key :

```ts
const key = new apigateway.RateLimitedApiKey(this, 'rate-limited-api-key', {
  customerId: 'hello-customer',
  resources: [api],
  quota: {
    limit: 10000,
    period: apigateway.Period.MONTH
  }
});
```

## Working with models

When you work with Lambda integrations that are not Proxy integrations, you
have to define your models and mappings for the request, response, and integration.

```ts
const hello = new lambda.Function(this, 'hello', {
  runtime: lambda.Runtime.NODEJS_12_X,
  handler: 'hello.handler',
  code: lambda.Code.fromAsset('lambda')
});

const api = new apigateway.RestApi(this, 'hello-api', { });
const resource = api.root.addResource('v1');
```

You can define more parameters on the integration to tune the behavior of API Gateway

```ts
const integration = new LambdaIntegration(hello, {
  proxy: false,
  requestParameters: {
    // You can define mapping parameters from your method to your integration
    // - Destination parameters (the key) are the integration parameters (used in mappings)
    // - Source parameters (the value) are the source request parameters or expressions
    // @see: https://docs.aws.amazon.com/apigateway/latest/developerguide/request-response-data-mappings.html
    'integration.request.querystring.who': 'method.request.querystring.who'
  },
  allowTestInvoke: true,
  requestTemplates: {
    // You can define a mapping that will build a payload for your integration, based
    //  on the integration parameters that you have specified
    // Check: https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html
    'application/json': JSON.stringify({ action: 'sayHello', pollId: "$util.escapeJavaScript($input.params('who'))" })
  },
  // This parameter defines the behavior of the engine is no suitable response template is found
  passthroughBehavior: PassthroughBehavior.NEVER,
  integrationResponses: [
    {
      // Successful response from the Lambda function, no filter defined
      //  - the selectionPattern filter only tests the error message
      // We will set the response status code to 200
      statusCode: "200",
      responseTemplates: {
        // This template takes the "message" result from the Lambda function, and embeds it in a JSON response
        // Check https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html
        'application/json': JSON.stringify({ state: 'ok', greeting: '$util.escapeJavaScript($input.body)' })
      },
      responseParameters: {
        // We can map response parameters
        // - Destination parameters (the key) are the response parameters (used in mappings)
        // - Source parameters (the value) are the integration response parameters or expressions
        'method.response.header.Content-Type': "'application/json'",
        'method.response.header.Access-Control-Allow-Origin': "'*'",
        'method.response.header.Access-Control-Allow-Credentials': "'true'"
      }
    },
    {
      // For errors, we check if the error message is not empty, get the error data
      selectionPattern: '(\n|.)+',
      // We will set the response status code to 200
      statusCode: "400",
      responseTemplates: {
          'application/json': JSON.stringify({ state: 'error', message: "$util.escapeJavaScript($input.path('$.errorMessage'))" })
      },
      responseParameters: {
          'method.response.header.Content-Type': "'application/json'",
          'method.response.header.Access-Control-Allow-Origin': "'*'",
          'method.response.header.Access-Control-Allow-Credentials': "'true'"
      }
    }
  ]
});

```

You can define models for your responses (and requests)

```ts
// We define the JSON Schema for the transformed valid response
const responseModel = api.addModel('ResponseModel', {
  contentType: 'application/json',
  modelName: 'ResponseModel',
  schema: {
    schema: JsonSchemaVersion.DRAFT4,
    title: 'pollResponse',
    type: JsonSchemaType.OBJECT,
    properties: {
      state: { type: JsonSchemaType.STRING },
      greeting: { type: JsonSchemaType.STRING }
    }
  }
});

// We define the JSON Schema for the transformed error response
const errorResponseModel = api.addModel('ErrorResponseModel', {
  contentType: 'application/json',
  modelName: 'ErrorResponseModel',
  schema: {
    schema: JsonSchemaVersion.DRAFT4,
    title: 'errorResponse',
    type: JsonSchemaType.OBJECT,
    properties: {
      state: { type: JsonSchemaType.STRING },
      message: { type: JsonSchemaType.STRING }
    }
  }
});

```

And reference all on your method definition.

```ts
resource.addMethod('GET', integration, {
  // We can mark the parameters as required
  requestParameters: {
    'method.request.querystring.who': true
  },
  // we can set request validator options like below
  requestValidatorOptions: {
    requestValidatorName: 'test-validator',
    validateRequestBody: true,
    validateRequestParameters: false
  }
  methodResponses: [
    {
      // Successful response from the integration
      statusCode: '200',
      // Define what parameters are allowed or not
      responseParameters: {
        'method.response.header.Content-Type': true,
        'method.response.header.Access-Control-Allow-Origin': true,
        'method.response.header.Access-Control-Allow-Credentials': true
      },
      // Validate the schema on the response
      responseModels: {
        'application/json': responseModel
      }
    },
    {
      // Same thing for the error responses
      statusCode: '400',
      responseParameters: {
        'method.response.header.Content-Type': true,
        'method.response.header.Access-Control-Allow-Origin': true,
        'method.response.header.Access-Control-Allow-Credentials': true
      },
      responseModels: {
        'application/json': errorResponseModel
      }
    }
  ]
});
```

Specifying `requestValidatorOptions` automatically creates the RequestValidator construct with the given options.
However, if you have your RequestValidator already initialized or imported, use the `requestValidator` option instead.

## Default Integration and Method Options

The `defaultIntegration` and `defaultMethodOptions` properties can be used to
configure a default integration at any resource level. These options will be
used when defining method under this resource (recursively) with undefined
integration or options.

> If not defined, the default integration is `MockIntegration`. See reference
documentation for default method options.

The following example defines the `booksBackend` integration as a default
integration. This means that all API methods that do not explicitly define an
integration will be routed to this AWS Lambda function.

```ts
const booksBackend = new apigateway.LambdaIntegration(...);
const api = new apigateway.RestApi(this, 'books', {
  defaultIntegration: booksBackend
});

const books = new api.root.addResource('books');
books.addMethod('GET');  // integrated with `booksBackend`
books.addMethod('POST'); // integrated with `booksBackend`

const book = books.addResource('{book_id}');
book.addMethod('GET');   // integrated with `booksBackend`
```

A Method can be configured with authorization scopes. Authorization scopes are
used in conjunction with an [authorizer that uses Amazon Cognito user
pools](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-integrate-with-cognito.html#apigateway-enable-cognito-user-pool).
Read more about authorization scopes
[here](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-apigateway-method.html#cfn-apigateway-method-authorizationscopes).

Authorization scopes for a Method can be configured using the `authorizationScopes` property as shown below -

```ts
books.addMethod('GET', new apigateway.HttpIntegration('http://amazon.com'), {
  authorizationType: AuthorizationType.COGNITO,
  authorizationScopes: ['Scope1','Scope2']
});
```

## Proxy Routes

The `addProxy` method can be used to install a greedy `{proxy+}` resource
on a path. By default, this also installs an `"ANY"` method:

```ts
const proxy = resource.addProxy({
  defaultIntegration: new LambdaIntegration(handler),

  // "false" will require explicitly adding methods on the `proxy` resource
  anyMethod: true // "true" is the default
});
```

## Authorizers

API Gateway [supports several different authorization types](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-control-access-to-api.html)
that can be used for controlling access to your REST APIs.

### IAM-based authorizer

The following CDK code provides 'execute-api' permission to an IAM user, via IAM policies, for the 'GET' method on the `books` resource:

```ts
const getBooks = books.addMethod('GET', new apigateway.HttpIntegration('http://amazon.com'), {
  authorizationType: apigateway.AuthorizationType.IAM
});

iamUser.attachInlinePolicy(new iam.Policy(this, 'AllowBooks', {
  statements: [
    new iam.PolicyStatement({
      actions: [ 'execute-api:Invoke' ],
      effect: iam.Effect.ALLOW,
      resources: [ getBooks.methodArn ]
    })
  ]
}))
```

### Lambda-based token authorizer

API Gateway also allows [lambda functions to be used as authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-use-lambda-authorizer.html).

This module provides support for token-based Lambda authorizers. When a client makes a request to an API's methods configured with such
an authorizer, API Gateway calls the Lambda authorizer, which takes the caller's identity as input and returns an IAM policy as output.
A token-based Lambda authorizer (also called a token authorizer) receives the caller's identity in a bearer token, such as
a JSON Web Token (JWT) or an OAuth token.

API Gateway interacts with the authorizer Lambda function handler by passing input and expecting the output in a specific format.
The event object that the handler is called with contains the `authorizationToken` and the `methodArn` from the request to the
API Gateway endpoint. The handler is expected to return the `principalId` (i.e. the client identifier) and a `policyDocument` stating
what the client is authorizer to perform.
See [here](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-use-lambda-authorizer.html) for a detailed specification on
inputs and outputs of the Lambda handler.

The following code attaches a token-based Lambda authorizer to the 'GET' Method of the Book resource:

```ts
const authFn = new lambda.Function(this, 'booksAuthorizerLambda', {
  // ...
  // ...
});

const auth = new apigateway.TokenAuthorizer(this, 'booksAuthorizer', {
  handler: authFn
});

books.addMethod('GET', new apigateway.HttpIntegration('http://amazon.com'), {
  authorizer: auth
});
```

A full working example is shown below.

[Full token authorizer example](test/authorizers/integ.token-authorizer.lit.ts).

By default, the `TokenAuthorizer` looks for the authorization token in the request header with the key 'Authorization'. This can,
however, be modified by changing the `identitySource` property.

Authorizers can also be passed via the `defaultMethodOptions` property within the `RestApi` construct or the `Method` construct. Unless
explicitly overridden, the specified defaults will be applied across all `Method`s across the `RestApi` or across all `Resource`s,
depending on where the defaults were specified.

### Lambda-based request authorizer

This module provides support for request-based Lambda authorizers. When a client makes a request to an API's methods configured with such
an authorizer, API Gateway calls the Lambda authorizer, which takes specified parts of the request, known as identity sources,
as input and returns an IAM policy as output. A request-based Lambda authorizer (also called a request authorizer) receives
the identity sources in a series of values pulled from the request, from the headers, stage variables, query strings, and the context.

API Gateway interacts with the authorizer Lambda function handler by passing input and expecting the output in a specific format.
The event object that the handler is called with contains the body of the request and the `methodArn` from the request to the
API Gateway endpoint. The handler is expected to return the `principalId` (i.e. the client identifier) and a `policyDocument` stating
what the client is authorizer to perform.
See [here](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-use-lambda-authorizer.html) for a detailed specification on
inputs and outputs of the Lambda handler.

The following code attaches a request-based Lambda authorizer to the 'GET' Method of the Book resource:

```ts
const authFn = new lambda.Function(this, 'booksAuthorizerLambda', {
  // ...
  // ...
});

const auth = new apigateway.RequestAuthorizer(this, 'booksAuthorizer', {
  handler: authFn,
  identitySources: [IdentitySource.header('Authorization')]
});

books.addMethod('GET', new apigateway.HttpIntegration('http://amazon.com'), {
  authorizer: auth
});
```

A full working example is shown below.

[Full request authorizer example](test/authorizers/integ.request-authorizer.lit.ts).

By default, the `RequestAuthorizer` does not pass any kind of information from the request. This can,
however, be modified by changing the `identitySource` property, and is required when specifying a value for caching.

Authorizers can also be passed via the `defaultMethodOptions` property within the `RestApi` construct or the `Method` construct. Unless
explicitly overridden, the specified defaults will be applied across all `Method`s across the `RestApi` or across all `Resource`s,
depending on where the defaults were specified.

### Cognito User Pools authorizer

API Gateway also allows [Amazon Cognito user pools as authorizer](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-integrate-with-cognito.html)

The following snippet configures a Cognito user pool as an authorizer:

```ts
const userPool = new cognito.UserPool(stack, 'UserPool');

const auth = new apigateway.CognitoUserPoolsAuthorizer(this, 'booksAuthorizer', {
  cognitoUserPools: [userPool]
});

books.addMethod('GET', new apigateway.HttpIntegration('http://amazon.com'), {
  authorizer: auth,
  authorizationType: apigateway.AuthorizationType.COGNITO,
});
```

## Mutual TLS (mTLS)

Mutual TLS can be configured to limit access to your API based by using client certificates instead of (or as an extension of) using authorization headers.

```ts
new apigw.DomainName(this, 'domain-name', {
  domainName: 'example.com',
  certificate: acm.Certificate.fromCertificateArn(this, 'cert', 'arn:aws:acm:us-east-1:1111111:certificate/11-3336f1-44483d-adc7-9cd375c5169d'),
  mtls: {
    bucket: new Bucket(this, 'bucket'),
    key: 'truststore.pem',
    version: 'version',
  },
});
```

Instructions for configuring your trust store can be found [here](https://aws.amazon.com/blogs/compute/introducing-mutual-tls-authentication-for-amazon-api-gateway/).

## Deployments

By default, the `RestApi` construct will automatically create an API Gateway
[Deployment] and a "prod" [Stage] which represent the API configuration you
defined in your CDK app. This means that when you deploy your app, your API will
be have open access from the internet via the stage URL.

The URL of your API can be obtained from the attribute `restApi.url`, and is
also exported as an `Output` from your stack, so it's printed when you `cdk
deploy` your app:

```console
$ cdk deploy
...
books.booksapiEndpointE230E8D5 = https://6lyktd4lpk.execute-api.us-east-1.amazonaws.com/prod/
```

To disable this behavior, you can set `{ deploy: false }` when creating your
API. This means that the API will not be deployed and a stage will not be
created for it. You will need to manually define a `apigateway.Deployment` and
`apigateway.Stage` resources.

Use the `deployOptions` property to customize the deployment options of your
API.

The following example will configure API Gateway to emit logs and data traces to
AWS CloudWatch for all API calls:

> By default, an IAM role will be created and associated with API Gateway to
allow it to write logs and metrics to AWS CloudWatch unless `cloudWatchRole` is
set to `false`.

```ts
const api = new apigateway.RestApi(this, 'books', {
  deployOptions: {
    loggingLevel: apigateway.MethodLoggingLevel.INFO,
    dataTraceEnabled: true
  }
})
```

### Deep dive: Invalidation of deployments

API Gateway deployments are an immutable snapshot of the API. This means that we
want to automatically create a new deployment resource every time the API model
defined in our CDK app changes.

In order to achieve that, the AWS CloudFormation logical ID of the
`AWS::ApiGateway::Deployment` resource is dynamically calculated by hashing the
API configuration (resources, methods). This means that when the configuration
changes (i.e. a resource or method are added, configuration is changed), a new
logical ID will be assigned to the deployment resource. This will cause
CloudFormation to create a new deployment resource.

By default, old deployments are _deleted_. You can set `retainDeployments: true`
to allow users revert the stage to an old deployment manually.

[Deployment]: https://docs.aws.amazon.com/apigateway/api-reference/resource/deployment/
[Stage]: https://docs.aws.amazon.com/apigateway/api-reference/resource/stage/

## Custom Domains

To associate an API with a custom domain, use the `domainName` configuration when
you define your API:

```ts
const api = new apigw.RestApi(this, 'MyDomain', {
  domainName: {
    domainName: 'example.com',
    certificate: acmCertificateForExampleCom,
  },
});
```

This will define a `DomainName` resource for you, along with a `BasePathMapping`
from the root of the domain to the deployment stage of the API. This is a common
set up.

To route domain traffic to an API Gateway API, use Amazon Route 53 to create an
alias record. An alias record is a Route 53 extension to DNS. It's similar to a
CNAME record, but you can create an alias record both for the root domain, such
as `example.com`, and for subdomains, such as `www.example.com`. (You can create
CNAME records only for subdomains.)

```ts
import * as route53 from '@aws-cdk/aws-route53';
import * as targets from '@aws-cdk/aws-route53-targets';

new route53.ARecord(this, 'CustomDomainAliasRecord', {
  zone: hostedZoneForExampleCom,
  target: route53.RecordTarget.fromAlias(new targets.ApiGateway(api))
});
```

You can also define a `DomainName` resource directly in order to customize the default behavior:

```ts
new apigw.DomainName(this, 'custom-domain', {
  domainName: 'example.com',
  certificate: acmCertificateForExampleCom,
  endpointType: apigw.EndpointType.EDGE, // default is REGIONAL
  securityPolicy: apigw.SecurityPolicy.TLS_1_2
});
```

Once you have a domain, you can map base paths of the domain to APIs.
The following example will map the URL <https://example.com/go-to-api1>
to the `api1` API and <https://example.com/boom> to the `api2` API.

```ts
domain.addBasePathMapping(api1, { basePath: 'go-to-api1' });
domain.addBasePathMapping(api2, { basePath: 'boom' });
```

You can specify the API `Stage` to which this base path URL will map to. By default, this will be the
`deploymentStage` of the `RestApi`.

```ts
const betaDeploy = new Deployment(this, 'beta-deployment', {
  api: restapi,
});
const betaStage = new Stage(this, 'beta-stage', {
  deployment: betaDeploy,
});
domain.addBasePathMapping(restapi, { basePath: 'api/beta', stage: betaStage });
```

If you don't specify `basePath`, all URLs under this domain will be mapped
to the API, and you won't be able to map another API to the same domain:

```ts
domain.addBasePathMapping(api);
```

This can also be achieved through the `mapping` configuration when defining the
domain as demonstrated above.

If you wish to setup this domain with an Amazon Route53 alias, use the `targets.ApiGatewayDomain`:

```ts
import * as route53 from '@aws-cdk/aws-route53';
import * as targets from '@aws-cdk/aws-route53-targets';

new route53.ARecord(this, 'CustomDomainAliasRecord', {
  zone: hostedZoneForExampleCom,
  target: route53.RecordTarget.fromAlias(new targets.ApiGatewayDomain(domainName))
});
```

## Access Logging

Access logging creates logs every time an API method is accessed. Access logs can have information on
who has accessed the API, how the caller accessed the API and what responses were generated.
Access logs are configured on a Stage of the RestApi.
Access logs can be expressed in a format of your choosing, and can contain any access details, with a
minimum that it must include the 'requestId'. The list of  variables that can be expressed in the access
log can be found
[here](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html#context-variable-reference).
Read more at [Setting Up CloudWatch API Logging in API
Gateway](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-logging.html)

```ts
// production stage
const prdLogGroup = new cwlogs.LogGroup(this, "PrdLogs");
const api = new apigateway.RestApi(this, 'books', {
  deployOptions: {
    accessLogDestination: new apigateway.LogGroupLogDestination(prdLogGroup),
    accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields()
  }
})
const deployment = new apigateway.Deployment(stack, 'Deployment', {api});

// development stage
const devLogGroup = new cwlogs.LogGroup(this, "DevLogs");
new apigateway.Stage(this, 'dev', {
  deployment,
  accessLogDestination: new apigateway.LogGroupLogDestination(devLogGroup),
  accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
    caller: false,
    httpMethod: true,
    ip: true,
    protocol: true,
    requestTime: true,
    resourcePath: true,
    responseLength: true,
    status: true,
    user: true
  })
});
```

The following code will generate the access log in the [CLF format](https://en.wikipedia.org/wiki/Common_Log_Format).

```ts
const logGroup = new cwlogs.LogGroup(this, "ApiGatewayAccessLogs");
const api = new apigateway.RestApi(this, 'books', {
  deployOptions: {
    accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
    accessLogFormat: apigateway.AccessLogFormat.clf(),
  }});
```

You can also configure your own access log format by using the `AccessLogFormat.custom()` API.
`AccessLogField` provides commonly used fields. The following code configures access log to contain.

```ts
const logGroup = new cwlogs.LogGroup(this, "ApiGatewayAccessLogs");
new apigateway.RestApi(this, 'books', {
  deployOptions: {
    accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
    accessLogFormat: apigateway.AccessLogFormat.custom(
      `${AccessLogField.contextRequestId()} ${AccessLogField.contextErrorMessage()} ${AccessLogField.contextErrorMessageString()}`
    )
  }
});
```

You can use the `methodOptions` property to configure
[default method throttling](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html#apigateway-api-level-throttling-in-usage-plan)
for a stage. The following snippet configures the a stage that accepts
100 requests per minute, allowing burst up to 200 requests per minute.

```ts
const api = new apigateway.RestApi(this, 'books');
const deployment = new apigateway.Deployment(this, 'my-deployment', { api });
const stage = new apigateway.Stage(this, 'my-stage', {
  deployment,
  methodOptions: {
    '/*/*': {  // This special path applies to all resource paths and all HTTP methods
      throttlingRateLimit: 100,
      throttlingBurstLimit: 200
    }
  }
});
```

Configuring `methodOptions` on the `deployOptions` of `RestApi` will set the
throttling behaviors on the default stage that is automatically created.

```ts
const api = new apigateway.RestApi(this, 'books', {
  deployOptions: {
    methodOptions: {
      '/*/*': {  // This special path applies to all resource paths and all HTTP methods
        throttlingRateLimit: 100,
        throttlingBurstLimit: 1000
      }
    }
  }
});
```

## Cross Origin Resource Sharing (CORS)

[Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) is a mechanism
that uses additional HTTP headers to tell browsers to give a web application
running at one origin, access to selected resources from a different origin. A
web application executes a cross-origin HTTP request when it requests a resource
that has a different origin (domain, protocol, or port) from its own.

You can add the CORS [preflight](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#Preflighted_requests) OPTIONS
HTTP method to any API resource via the `defaultCorsPreflightOptions` option or by calling the `addCorsPreflight` on a specific resource.

The following example will enable CORS for all methods and all origins on all resources of the API:

```ts
new apigateway.RestApi(this, 'api', {
  defaultCorsPreflightOptions: {
    allowOrigins: apigateway.Cors.ALL_ORIGINS,
    allowMethods: apigateway.Cors.ALL_METHODS // this is also the default
  }
})
```

The following example will add an OPTIONS method to the `myResource` API resource, which
only allows GET and PUT HTTP requests from the origin <https://amazon.com.>

```ts
myResource.addCorsPreflight({
  allowOrigins: [ 'https://amazon.com' ],
  allowMethods: [ 'GET', 'PUT' ]
});
```

See the
[`CorsOptions`](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-apigateway.CorsOptions.html)
API reference for a detailed list of supported configuration options.

You can specify defaults this at the resource level, in which case they will be applied to the entire resource sub-tree:

```ts
const subtree = resource.addResource('subtree', {
  defaultCorsPreflightOptions: {
    allowOrigins: [ 'https://amazon.com' ]
  }
});
```

This means that all resources under `subtree` (inclusive) will have a preflight
OPTIONS added to them.

See [#906](https://github.com/aws/aws-cdk/issues/906) for a list of CORS
features which are not yet supported.

## Endpoint Configuration

API gateway allows you to specify an
[API Endpoint Type](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-endpoint-types.html).
To define an endpoint type for the API gateway, use `endpointConfiguration` property:

```ts
const api = new apigw.RestApi(stack, 'api', {
  endpointConfiguration: {
    types: [ apigw.EndpointType.EDGE ]
  }
});
```

You can also create an association between your Rest API and a VPC endpoint. By doing so,
API Gateway will generate a new
Route53 Alias DNS record which you can use to invoke your private APIs. More info can be found
[here](https://docs.aws.amazon.com/apigateway/latest/developerguide/associate-private-api-with-vpc-endpoint.html).

Here is an example:

```ts
const someEndpoint: IVpcEndpoint = /* Get or Create endpoint here */
const api = new apigw.RestApi(stack, 'api', {
  endpointConfiguration: {
    types: [ apigw.EndpointType.PRIVATE ],
    vpcEndpoints: [ someEndpoint ]
  }
});
```

By performing this association, we can invoke the API gateway using the following format:

```plaintext
https://{rest-api-id}-{vpce-id}.execute-api.{region}.amazonaws.com/{stage}
```

## Private Integrations

A private integration makes it simple to expose HTTP/HTTPS resources behind an
Amazon VPC for access by clients outside of the VPC. The private integration uses
an API Gateway resource of `VpcLink` to encapsulate connections between API
Gateway and targeted VPC resources.
The `VpcLink` is then attached to the `Integration` of a specific API Gateway
Method. The following code sets up a private integration with a network load
balancer -

```ts
const vpc = new ec2.Vpc(stack, 'VPC');
const nlb = new elbv2.NetworkLoadBalancer(stack, 'NLB', {
  vpc,
});
const link = new apigw.VpcLink(stack, 'link', {
  targets: [nlb],
});

const integration = new apigw.Integration({
  type: apigw.IntegrationType.HTTP_PROXY,
  options: {
    connectionType: apigw.ConnectionType.VPC_LINK,
    vpcLink: link,
  },
});
```

The uri for the private integration, in the case of a VpcLink, will be set to the DNS name of
the VPC Link's NLB. If the VPC Link has multiple NLBs or the VPC Link is imported or the DNS
name cannot be determined for any other reason, the user is expected to specify the `uri`
property.

Any existing `VpcLink` resource can be imported into the CDK app via the `VpcLink.fromVpcLinkId()`.

```ts
const stack = new Stack(app, 'my-stack');

const awesomeLink = VpcLink.fromVpcLinkId(stack, 'awesome-vpc-link', 'us-east-1_oiuR12Abd');
```

## Gateway response

If the Rest API fails to process an incoming request, it returns to the client an error response without forwarding the
request to the integration backend. API Gateway has a set of standard response messages that are sent to the client for
each type of error. These error responses can be configured on the Rest API. The list of Gateway responses that can be
configured can be found [here](https://docs.aws.amazon.com/apigateway/latest/developerguide/supported-gateway-response-types.html).
Learn more about [Gateway
Responses](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-gatewayResponse-definition.html).

The following code configures a Gateway Response when the response is 'access denied':

```ts
const api = new apigateway.RestApi(this, 'books-api');
api.addGatewayResponse('test-response', {
  type: ResponseType.ACCESS_DENIED,
  statusCode: '500',
  responseHeaders: {
    'Access-Control-Allow-Origin': "test.com",
    'test-key': 'test-value'
  },
  templates: {
    'application/json': '{ "message": $context.error.messageString, "statusCode": "488", "type": "$context.error.responseType" }'
  }
});
```

## OpenAPI Definition

CDK supports creating a REST API by importing an OpenAPI definition file. It currently supports OpenAPI v2.0 and OpenAPI
v3.0 definition files. Read more about [Configuring a REST API using
OpenAPI](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-import-api.html).

The following code creates a REST API using an external OpenAPI definition JSON file -

```ts
const api = new apigateway.SpecRestApi(this, 'books-api', {
  apiDefinition: apigateway.ApiDefinition.fromAsset('path-to-file.json')
});

const booksResource = api.root.addResource('books')
booksResource.addMethod('GET', ...);
```

It is possible to use the `addResource()` API to define additional API Gateway Resources.

**Note:** Deployment will fail if a Resource of the same name is already defined in the Open API specification.

**Note:** Any default properties configured, such as `defaultIntegration`, `defaultMethodOptions`, etc. will only be
applied to Resources and Methods defined in the CDK, and not the ones defined in the spec. Use the [API Gateway
extensions to OpenAPI](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-swagger-extensions.html)
to configure these.

There are a number of limitations in using OpenAPI definitions in API Gateway. Read the [Amazon API Gateway important
notes for REST APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-known-issues.html#api-gateway-known-issues-rest-apis)
for more details.

**Note:** When starting off with an OpenAPI definition using `SpecRestApi`, it is not possible to configure some
properties that can be configured directly in the OpenAPI specification file. This is to prevent people duplication
of these properties and potential confusion.

### Endpoint configuration

By default, `SpecRestApi` will create an edge optimized endpoint.

This can be modified as shown below:

```ts
const api = new apigateway.SpecRestApi(this, 'ExampleRestApi', {
  // ...
  endpointTypes: [apigateway.EndpointType.PRIVATE]
});
```

**Note:** For private endpoints you will still need to provide the
[`x-amazon-apigateway-policy`](https://docs.aws.amazon.com/apigateway/latest/developerguide/openapi-extensions-policy.html) and
[`x-amazon-apigateway-endpoint-configuration`](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-swagger-extensions-endpoint-configuration.html)
in your openApi file.

## Metrics

The API Gateway service sends metrics around the performance of Rest APIs to Amazon CloudWatch.
These metrics can be referred to using the metric APIs available on the `RestApi` construct.
The APIs with the `metric` prefix can be used to get reference to specific metrics for this API. For example,
the method below refers to the client side errors metric for this API.

```ts
const api = new apigw.RestApi(stack, 'my-api');
const clientErrorMetric = api.metricClientError();
```

## APIGateway v2

APIGateway v2 APIs are now moved to its own package named `aws-apigatewayv2`. For backwards compatibility, existing
APIGateway v2 "CFN resources" (such as `CfnApi`) that were previously exported as part of this package, are still
exported from here and have been marked deprecated. However, updates to these CloudFormation resources, such as new
properties and new resource types will not be available.

Move to using `aws-apigatewayv2` to get the latest APIs and updates.

----

This module is part of the [AWS Cloud Development Kit](https://github.com/aws/aws-cdk) project.
