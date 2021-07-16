# AWS APIGatewayv2 Integrations
<!--BEGIN STABILITY BANNER-->

---

![cdk-constructs: Experimental](https://img.shields.io/badge/cdk--constructs-experimental-important.svg?style=for-the-badge)

> The APIs of higher level constructs in this module are experimental and under active development.
> They are subject to non-backward compatible changes or removal in any future version. These are
> not subject to the [Semantic Versioning](https://semver.org/) model and breaking changes will be
> announced in the release notes. This means that while you may use them, you may need to update
> your source code when upgrading to a newer version of this package.

---

<!--END STABILITY BANNER-->

## Table of Contents

- [HTTP APIs](#http-apis)
  - [Lambda Integration](#lambda)
  - [HTTP Proxy Integration](#http-proxy)
  - [AWS Service Integration](#aws-service)
  - [Private Integration](#private-integration)
- [WebSocket APIs](#websocket-apis)
  - [Lambda WebSocket Integration](#lambda-websocket-integration)

## HTTP APIs

Integrations connect a route to backend resources. HTTP APIs support Lambda proxy, AWS service, and HTTP proxy integrations. HTTP proxy integrations are also known as private integrations.

### Lambda

Lambda integrations enable integrating an HTTP API route with a Lambda function. When a client invokes the route, the
API Gateway service forwards the request to the Lambda function and returns the function's response to the client.

The API Gateway service will invoke the lambda function with an event payload of a specific format. The service expects
the function to respond in a specific format. The details on this format is available at [Working with AWS Lambda
proxy integrations](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html).

The following code configures a route `GET /books` with a Lambda proxy integration.

```ts
const booksFn = new lambda.Function(stack, 'BooksDefaultFn', { ... });
const booksIntegration = new LambdaProxyIntegration({
  handler: booksDefaultFn,
});

const httpApi = new HttpApi(stack, 'HttpApi');

httpApi.addRoutes({
  path: '/books',
  methods: [ HttpMethod.GET ],
  integration: booksIntegration,
});
```

### HTTP Proxy

HTTP Proxy integrations enables connecting an HTTP API route to a publicly routable HTTP endpoint. When a client
invokes the route, the API Gateway service forwards the entire request and response between the API Gateway endpoint
and the integrating HTTP endpoint. More information can be found at [Working with HTTP proxy
integrations](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-http.html).

The following code configures a route `GET /books` with an HTTP proxy integration to an HTTP endpoint
`get-books-proxy.myproxy.internal`.

```ts
const booksIntegration = new HttpProxyIntegration({
  url: 'https://get-books-proxy.myproxy.internal',
});

const httpApi = new HttpApi(stack, 'HttpApi');

httpApi.addRoutes({
  path: '/books',
  methods: [ HttpMethod.GET ],
  integration: booksIntegration,
});
```

### AWS Service

You can integrate your HTTP API with AWS services by using first-class integrations. A first-class integration connects 
an HTTP API route to an AWS service API. When a client invokes a route that's backed by a first-class integration, 
API Gateway invokes an AWS service API for you. More information can be found at [Working with AWS service integrations for HTTP APIs]
(https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-aws-services.html).

The following code configures a route `POST /start` to start execution of Step Functions state machine.

```ts
const httpApi = new HttpApi(stack, 'HttpApi');

const state = new StateMachine(stack, 'MyStateMachine', {
  definition: Chain.start(new Pass(stack, 'Pass')),
  stateMachineType: StateMachineType.STANDARD,
});

httpApi.addRoutes({
  path: '/start',
  methods: [ HttpMethod.POST ],
  integration: new StepFunctionsStartExecutionIntegration({
    stateMachine: state,
    input: '$request.body.input',
    timeout: Duration.seconds(10),
  }),
});
```

### Private Integration

Private integrations enable integrating an HTTP API route with private resources in a VPC, such as Application Load Balancers or
Amazon ECS container-based applications.  Using private integrations, resources in a VPC can be exposed for access by
clients outside of the VPC.

The following integrations are supported for private resources in a VPC.

#### Application Load Balancer

The following code is a basic application load balancer private integration of HTTP API:

```ts
const vpc = new ec2.Vpc(stack, 'VPC');
const lb = new elbv2.ALB(stack, 'lb', { vpc });
const listener = lb.addListener('listener', { port: 80 });
listener.addTargets('target', {
  port: 80,
});

const httpEndpoint = new HttpApi(stack, 'HttpProxyPrivateApi', {
  defaultIntegration: new HttpAlbIntegration({
    listener,
  }),
});
```

When an imported load balancer is used, the `vpc` option must be specified for `HttpAlbIntegration`.

#### Network Load Balancer

The following code is a basic network load balancer private integration of HTTP API:

```ts
const vpc = new ec2.Vpc(stack, 'VPC');
const lb = new elbv2.NLB(stack, 'lb', { vpc });
const listener = lb.addListener('listener', { port: 80 });
listener.addTargets('target', {
  port: 80,
});

const httpEndpoint = new HttpApi(stack, 'HttpProxyPrivateApi', {
  defaultIntegration: new HttpNlbIntegration({
    listener,
  }),
});
```

When an imported load balancer is used, the `vpc` option must be specified for `HttpNlbIntegration`.

#### Cloud Map Service Discovery

The following code is a basic discovery service private integration of HTTP API:

```ts
const vpc = new ec2.Vpc(stack, 'VPC');
const vpcLink = new VpcLink(stack, 'VpcLink', { vpc });
const namespace = new servicediscovery.PrivateDnsNamespace(stack, 'Namespace', {
  name: 'boobar.com',
  vpc,
});
const service = namespace.createService('Service');

const httpEndpoint = new HttpApi(stack, 'HttpProxyPrivateApi', {
  defaultIntegration: new HttpServiceDiscoveryIntegration({
    vpcLink,
    service,
  }),
});
```

## WebSocket APIs

WebSocket integrations connect a route to backend resources. The following integrations are supported in the CDK.

### Lambda WebSocket Integration

Lambda integrations enable integrating a WebSocket API route with a Lambda function. When a client connects/disconnects 
or sends message specific to a route, the API Gateway service forwards the request to the Lambda function

The API Gateway service will invoke the lambda function with an event payload of a specific format.

The following code configures a `sendmessage` route with a Lambda integration

```ts
const webSocketApi = new WebSocketApi(stack, 'mywsapi');
new WebSocketStage(stack, 'mystage', {
  webSocketApi,
  stageName: 'dev',
  autoDeploy: true,
});

const messageHandler = new lambda.Function(stack, 'MessageHandler', {...});
webSocketApi.addRoute('sendmessage', {
  integration: new LambdaWebSocketIntegration({
    handler: connectHandler,
  }),
});
```
