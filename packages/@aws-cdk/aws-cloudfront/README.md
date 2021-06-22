# Amazon CloudFront Construct Library
<!--BEGIN STABILITY BANNER-->

---

![cfn-resources: Stable](https://img.shields.io/badge/cfn--resources-stable-success.svg?style=for-the-badge)

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->

Amazon CloudFront is a web service that speeds up distribution of your static and dynamic web content, such as .html, .css, .js, and image files, to
your users. CloudFront delivers your content through a worldwide network of data centers called edge locations. When a user requests content that
you're serving with CloudFront, the user is routed to the edge location that provides the lowest latency, so that content is delivered with the best
possible performance.

## Distribution API

The `Distribution` API is currently being built to replace the existing `CloudFrontWebDistribution` API. The `Distribution` API is optimized for the
most common use cases of CloudFront distributions (e.g., single origin and behavior, few customizations) while still providing the ability for more
advanced use cases. The API focuses on simplicity for the common use cases, and convenience methods for creating the behaviors and origins necessary
for more complex use cases.

### Creating a distribution

CloudFront distributions deliver your content from one or more origins; an origin is the location where you store the original version of your
content. Origins can be created from S3 buckets or a custom origin (HTTP server). Constructs to define origins are in the `@aws-cdk/aws-cloudfront-origins` module.

Each distribution has a default behavior which applies to all requests to that distribution, and routes requests to a primary origin.
Additional behaviors may be specified for an origin with a given URL path pattern. Behaviors allow routing with multiple origins,
controlling which HTTP methods to support, whether to require users to use HTTPS, and what query strings or cookies to forward to your origin,
among other settings.

#### From an S3 Bucket

An S3 bucket can be added as an origin. If the bucket is configured as a website endpoint, the distribution can use S3 redirects and S3 custom error
documents.

```ts
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as origins from '@aws-cdk/aws-cloudfront-origins';

// Creates a distribution for a S3 bucket.
const myBucket = new s3.Bucket(this, 'myBucket');
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: { origin: new origins.S3Origin(myBucket) },
});
```

The above will treat the bucket differently based on if `IBucket.isWebsite` is set or not. If the bucket is configured as a website, the bucket is
treated as an HTTP origin, and the built-in S3 redirects and error pages can be used. Otherwise, the bucket is handled as a bucket origin and
CloudFront's redirect and error handling will be used. In the latter case, the Origin will create an origin access identity and grant it access to the
underlying bucket. This can be used in conjunction with a bucket that is not public to require that your users access your content using CloudFront
URLs and not S3 URLs directly.

#### ELBv2 Load Balancer

An Elastic Load Balancing (ELB) v2 load balancer may be used as an origin. In order for a load balancer to serve as an origin, it must be publicly
accessible (`internetFacing` is true). Both Application and Network load balancers are supported.

```ts
import * as ec2 from '@aws-cdk/aws-ec2';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';

const vpc = new ec2.Vpc(...);
// Create an application load balancer in a VPC. 'internetFacing' must be 'true'
// for CloudFront to access the load balancer and use it as an origin.
const lb = new elbv2.ApplicationLoadBalancer(this, 'LB', {
  vpc,
  internetFacing: true
});
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: { origin: new origins.LoadBalancerV2Origin(lb) },
});
```

#### From an HTTP endpoint

Origins can also be created from any other HTTP endpoint, given the domain name, and optionally, other origin properties.

```ts
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: { origin: new origins.HttpOrigin('www.example.com') },
});
```

### Domain Names and Certificates

When you create a distribution, CloudFront assigns a domain name for the distribution, for example: `d111111abcdef8.cloudfront.net`; this value can
be retrieved from `distribution.distributionDomainName`. CloudFront distributions use a default certificate (`*.cloudfront.net`) to support HTTPS by
default. If you want to use your own domain name, such as `www.example.com`, you must associate a certificate with your distribution that contains
your domain name, and provide one (or more) domain names from the certificate for the distribution.

The certificate must be present in the AWS Certificate Manager (ACM) service in the US East (N. Virginia) region; the certificate
may either be created by ACM, or created elsewhere and imported into ACM. When a certificate is used, the distribution will support HTTPS connections
from SNI only and a minimum protocol version of TLSv1.2_2019.

```ts
const myCertificate = new acm.DnsValidatedCertificate(this, 'mySiteCert', {
  domainName: 'www.example.com',
  hostedZone,
});
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: { origin: new origins.S3Origin(myBucket) },
  domainNames: ['www.example.com'],
  certificate: myCertificate,
});
```

However, you can customize the minimum protocol version for the certificate while creating the distribution using `minimumProtocolVersion` property.

```ts
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: { origin: new origins.S3Origin(myBucket) },
  domainNames: ['www.example.com'],
  minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2016
});
```

### Multiple Behaviors & Origins

Each distribution has a default behavior which applies to all requests to that distribution; additional behaviors may be specified for a
given URL path pattern. Behaviors allow routing with multiple origins, controlling which HTTP methods to support, whether to require users to
use HTTPS, and what query strings or cookies to forward to your origin, among others.

The properties of the default behavior can be adjusted as part of the distribution creation. The following example shows configuring the HTTP
methods and viewer protocol policy of the cache.

```ts
const myWebDistribution = new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: {
    origin: new origins.S3Origin(myBucket),
    allowedMethods: AllowedMethods.ALLOW_ALL,
    viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  }
});
```

Additional behaviors can be specified at creation, or added after the initial creation. Each additional behavior is associated with an origin,
and enable customization for a specific set of resources based on a URL path pattern. For example, we can add a behavior to `myWebDistribution` to
override the default viewer protocol policy for all of the images.

```ts
myWebDistribution.addBehavior('/images/*.jpg', new origins.S3Origin(myBucket), {
  viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
});
```

These behaviors can also be specified at distribution creation time.

```ts
const bucketOrigin = new origins.S3Origin(myBucket);
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: {
    origin: bucketOrigin,
    allowedMethods: AllowedMethods.ALLOW_ALL,
    viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  },
  additionalBehaviors: {
    '/images/*.jpg': {
      origin: bucketOrigin,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    },
  },
});
```

### Customizing Cache Keys and TTLs with Cache Policies

You can use a cache policy to improve your cache hit ratio by controlling the values (URL query strings, HTTP headers, and cookies)
that are included in the cache key, and/or adjusting how long items remain in the cache via the time-to-live (TTL) settings.
CloudFront provides some predefined cache policies, known as managed policies, for common use cases. You can use these managed policies,
or you can create your own cache policy that’s specific to your needs.
See https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/controlling-the-cache-key.html for more details.

```ts
// Using an existing cache policy
new cloudfront.Distribution(this, 'myDistManagedPolicy', {
  defaultBehavior: {
    origin: bucketOrigin,
    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
  },
});

// Creating a custom cache policy  -- all parameters optional
const myCachePolicy = new cloudfront.CachePolicy(this, 'myCachePolicy', {
  cachePolicyName: 'MyPolicy',
  comment: 'A default policy',
  defaultTtl: Duration.days(2),
  minTtl: Duration.minutes(1),
  maxTtl: Duration.days(10),
  cookieBehavior: cloudfront.CacheCookieBehavior.all(),
  headerBehavior: cloudfront.CacheHeaderBehavior.allowList('X-CustomHeader'),
  queryStringBehavior: cloudfront.CacheQueryStringBehavior.denyList('username'),
  enableAcceptEncodingGzip: true,
  enableAcceptEncodingBrotli: true,
});
new cloudfront.Distribution(this, 'myDistCustomPolicy', {
  defaultBehavior: {
    origin: bucketOrigin,
    cachePolicy: myCachePolicy,
  },
});
```

### Customizing Origin Requests with Origin Request Policies

When CloudFront makes a request to an origin, the URL path, request body (if present), and a few standard headers are included.
Other information from the viewer request, such as URL query strings, HTTP headers, and cookies, is not included in the origin request by default.
You can use an origin request policy to control the information that’s included in an origin request.
CloudFront provides some predefined origin request policies, known as managed policies, for common use cases. You can use these managed policies,
or you can create your own origin request policy that’s specific to your needs.
See https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/controlling-origin-requests.html for more details.

```ts
// Using an existing origin request policy
new cloudfront.Distribution(this, 'myDistManagedPolicy', {
  defaultBehavior: {
    origin: bucketOrigin,
    originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
  },
});
// Creating a custom origin request policy -- all parameters optional
const myOriginRequestPolicy = new cloudfront.OriginRequestPolicy(stack, 'OriginRequestPolicy', {
  originRequestPolicyName: 'MyPolicy',
  comment: 'A default policy',
  cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
  headerBehavior: cloudfront.OriginRequestHeaderBehavior.all('CloudFront-Is-Android-Viewer'),
  queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.allowList('username'),
});
new cloudfront.Distribution(this, 'myDistCustomPolicy', {
  defaultBehavior: {
    origin: bucketOrigin,
    cachePolicy: myCachePolicy,
    originRequestPolicy: myOriginRequestPolicy,
  },
});
```

### Validating signed URLs or signed cookies with Trusted Key Groups

CloudFront Distribution now supports validating signed URLs or signed cookies using key groups. When a cache behavior contains trusted key groups, CloudFront requires signed URLs or signed cookies for all requests that match the cache behavior.

Example:

```ts
// public key in PEM format
const pubKey = new PublicKey(stack, 'MyPubKey', {
  encodedKey: publicKey,
});

const keyGroup = new KeyGroup(stack, 'MyKeyGroup', {
  items: [
    pubKey,
  ],
});

new cloudfront.Distribution(stack, 'Dist', {
  defaultBehavior: {
    origin: new origins.HttpOrigin('www.example.com'),
    trustedKeyGroups: [
      keyGroup,
    ],
  },
});
```

### Lambda@Edge

Lambda@Edge is an extension of AWS Lambda, a compute service that lets you execute functions that customize the content that CloudFront delivers.
You can author Node.js or Python functions in the US East (N. Virginia) region,
and then execute them in AWS locations globally that are closer to the viewer,
without provisioning or managing servers.
Lambda@Edge functions are associated with a specific behavior and event type.
Lambda@Edge can be used to rewrite URLs,
alter responses based on headers or cookies,
or authorize requests based on headers or authorization tokens.

The following shows a Lambda@Edge function added to the default behavior and triggered on every request:

```ts
const myFunc = new cloudfront.experimental.EdgeFunction(this, 'MyFunction', {
  runtime: lambda.Runtime.NODEJS_12_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset(path.join(__dirname, 'lambda-handler')),
});
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: {
    origin: new origins.S3Origin(myBucket),
    edgeLambdas: [
      {
        functionVersion: myFunc.currentVersion,
        eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
      }
    ],
  },
});
```

> **Note:** Lambda@Edge functions must be created in the `us-east-1` region, regardless of the region of the CloudFront distribution and stack.
> To make it easier to request functions for Lambda@Edge, the `EdgeFunction` construct can be used.
> The `EdgeFunction` construct will automatically request a function in `us-east-1`, regardless of the region of the current stack.
> `EdgeFunction` has the same interface as `Function` and can be created and used interchangeably.
> Please note that using `EdgeFunction` requires that the `us-east-1` region has been bootstrapped.
> See https://docs.aws.amazon.com/cdk/latest/guide/bootstrapping.html for more about bootstrapping regions.

If the stack is in `us-east-1`, a "normal" `lambda.Function` can be used instead of an `EdgeFunction`.

```ts
const myFunc = new lambda.Function(this, 'MyFunction', {
  runtime: lambda.Runtime.NODEJS_12_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset(path.join(__dirname, 'lambda-handler')),
});
```

If the stack is not in `us-east-1`, and you need references from different applications on the same account,
you can also set a specific stack ID for each Lambda@Edge.

```ts
const myFunc1 = new cloudfront.experimental.EdgeFunction(this, 'MyFunction1', {
  runtime: lambda.Runtime.NODEJS_12_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset(path.join(__dirname, 'lambda-handler1')),
  stackId: 'edge-lambda-stack-id-1'
});

const myFunc2 = new cloudfront.experimental.EdgeFunction(this, 'MyFunction2', {
  runtime: lambda.Runtime.NODEJS_12_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset(path.join(__dirname, 'lambda-handler2')),
  stackId: 'edge-lambda-stack-id-2'
});
```

Lambda@Edge functions can also be associated with additional behaviors,
either at or after Distribution creation time.

```ts
// assigning at Distribution creation
const myOrigin = new origins.S3Origin(myBucket);
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: { origin: myOrigin },
  additionalBehaviors: {
    'images/*': {
      origin: myOrigin,
      edgeLambdas: [
        {
          functionVersion: myFunc.currentVersion,
          eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
          includeBody: true, // Optional - defaults to false
        },
      ],
    },
  },
});

// assigning after creation
myDistribution.addBehavior('images/*', myOrigin, {
  edgeLambdas: [
    {
      functionVersion: myFunc.currentVersion,
      eventType: cloudfront.LambdaEdgeEventType.VIEWER_RESPONSE,
    },
  ],
});
```

Adding an existing Lambda@Edge function created in a different stack to a CloudFront distribution.

```ts
const functionVersion = lambda.Version.fromVersionArn(this, 'Version', 'arn:aws:lambda:us-east-1:123456789012:function:functionName:1');

new cloudfront.Distribution(this, 'distro', {
  defaultBehavior: {
    origin: new origins.S3Origin(s3Bucket),
    edgeLambdas: [
       {
         functionVersion,
         eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST
       },
    ],
  },
});
```

### CloudFront Function

You can also deploy CloudFront functions and add them to a CloudFront distribution.

```ts
const cfFunction = new cloudfront.Function(stack, 'Function', {
  code: cloudfront.FunctionCode.fromInline('function handler(event) { return event.request }'),
});

new cloudfront.Distribution(stack, 'distro', {
  defaultBehavior: {
    origin: new origins.S3Origin(s3Bucket),
    functionAssociations: [{
      function: cfFunction,
      eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
    }],
  },
});
```

It will auto-generate the name of the function and deploy it to the `live` stage.

Additionally, you can load the function's code from a file using the `FunctionCode.fromFile()` method.

### Logging

You can configure CloudFront to create log files that contain detailed information about every user request that CloudFront receives.
The logs can go to either an existing bucket, or a bucket will be created for you.

```ts
// Simplest form - creates a new bucket and logs to it.
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: { origin: new origins.HttpOrigin('www.example.com') },
  enableLogging: true,
});

// You can optionally log to a specific bucket, configure whether cookies are logged, and give the log files a prefix.
new cloudfront.Distribution(this, 'myDist', {
  defaultBehavior: { origin: new origins.HttpOrigin('www.example.com') },
  enableLogging: true, // Optional, this is implied if logBucket is specified
  logBucket: new s3.Bucket(this, 'LogBucket'),
  logFilePrefix: 'distribution-access-logs/',
  logIncludesCookies: true,
});
```

### Importing Distributions

Existing distributions can be imported as well; note that like most imported constructs, an imported distribution cannot be modified.
However, it can be used as a reference for other higher-level constructs.

```ts
const distribution = cloudfront.Distribution.fromDistributionAttributes(scope, 'ImportedDist', {
  domainName: 'd111111abcdef8.cloudfront.net',
  distributionId: '012345ABCDEF',
});
```

## CloudFrontWebDistribution API

> The `CloudFrontWebDistribution` construct is the original construct written for working with CloudFront distributions.
> Users are encouraged to use the newer `Distribution` instead, as it has a simpler interface and receives new features faster.

Example usage:

```ts
const sourceBucket = new Bucket(this, 'Bucket');

const distribution = new CloudFrontWebDistribution(this, 'MyDistribution', {
    originConfigs: [
        {
            s3OriginSource: {
                s3BucketSource: sourceBucket
            },
            behaviors : [ {isDefaultBehavior: true}]
        }
    ]
 });
```

### Viewer certificate

By default, CloudFront Web Distributions will answer HTTPS requests with CloudFront's default certificate, only containing the distribution `domainName` (e.g. d111111abcdef8.cloudfront.net).
You can customize the viewer certificate property to provide a custom certificate and/or list of domain name aliases to fit your needs.

See [Using Alternate Domain Names and HTTPS](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-https-alternate-domain-names.html) in the CloudFront User Guide.

#### Default certificate

You can customize the default certificate aliases. This is intended to be used in combination with CNAME records in your DNS zone.

Example:

[create a distribution with an default certificate example](test/example.default-cert-alias.lit.ts)

#### ACM certificate

You can change the default certificate by one stored AWS Certificate Manager, or ACM.
Those certificate can either be generated by AWS, or purchased by another CA imported into ACM.

For more information, see [the aws-certificatemanager module documentation](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-certificatemanager-readme.html) or [Importing Certificates into AWS Certificate Manager](https://docs.aws.amazon.com/acm/latest/userguide/import-certificate.html) in the AWS Certificate Manager User Guide.

Example:

[create a distribution with an acm certificate example](test/example.acm-cert-alias.lit.ts)

#### IAM certificate

You can also import a certificate into the IAM certificate store.

See [Importing an SSL/TLS Certificate](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-procedures.html#cnames-and-https-uploading-certificates) in the CloudFront User Guide.

Example:

[create a distribution with an iam certificate example](test/example.iam-cert-alias.lit.ts)

### Trusted Key Groups

CloudFront Web Distributions supports validating signed URLs or signed cookies using key groups. When a cache behavior contains trusted key groups, CloudFront requires signed URLs or signed cookies for all requests that match the cache behavior.

Example:

```ts
const pubKey = new PublicKey(stack, 'MyPubKey', {
  encodedKey: publicKey,
});

const keyGroup = new KeyGroup(stack, 'MyKeyGroup', {
  items: [
    pubKey,
  ],
});

new CloudFrontWebDistribution(stack, 'AnAmazingWebsiteProbably', {
  originConfigs: [
    {
      s3OriginSource: {
        s3BucketSource: sourceBucket,
      },
      behaviors: [
        {
          isDefaultBehavior: true,
          trustedKeyGroups: [
            keyGroup,
          ],
        },
      ],
    },
  ],
});
```

### Restrictions

CloudFront supports adding restrictions to your distribution.

See [Restricting the Geographic Distribution of Your Content](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/georestrictions.html) in the CloudFront User Guide.

Example:

```ts
new cloudfront.CloudFrontWebDistribution(stack, 'MyDistribution', {
   //...
    geoRestriction: GeoRestriction.whitelist('US', 'UK')
});
```

### Connection behaviors between CloudFront and your origin

CloudFront provides you even more control over the connection behaviors between CloudFront and your origin. You can now configure the number of connection attempts CloudFront will make to your origin and the origin connection timeout for each attempt.

See [Origin Connection Attempts](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html#origin-connection-attempts)

See [Origin Connection Timeout](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html#origin-connection-timeout)

Example usage:

```ts
const distribution = new CloudFrontWebDistribution(this, 'MyDistribution', {
    originConfigs: [
        {
            ...,
            connectionAttempts: 3,
            connectionTimeout: cdk.Duration.seconds(10),
        }
    ]
});
```

#### Origin Fallback

In case the origin source is not available and answers with one of the
specified status code the failover origin source will be used.

```ts
new CloudFrontWebDistribution(stack, 'ADistribution', {
  originConfigs: [
    {
      s3OriginSource: {
        s3BucketSource: s3.Bucket.fromBucketName(stack, 'aBucket', 'myoriginbucket'),
        originPath: '/',
        originHeaders: {
          'myHeader': '42',
        },
      },
      failoverS3OriginSource: {
        s3BucketSource: s3.Bucket.fromBucketName(stack, 'aBucketFallback', 'myoriginbucketfallback'),
        originPath: '/somewhere',
        originHeaders: {
          'myHeader2': '21',
        },
      },
      failoverCriteriaStatusCodes: [FailoverStatusCode.INTERNAL_SERVER_ERROR],
      behaviors: [
        {
          isDefaultBehavior: true,
        },
      ],
    },
  ],
});
```

## KeyGroup & PublicKey API

Now you can create a key group to use with CloudFront signed URLs and signed cookies. You can add public keys to use with CloudFront features such as signed URLs, signed cookies, and field-level encryption.

The following example command uses OpenSSL to generate an RSA key pair with a length of 2048 bits and save to the file named `private_key.pem`.

```bash
openssl genrsa -out private_key.pem 2048
```

The resulting file contains both the public and the private key. The following example command extracts the public key from the file named `private_key.pem` and stores it in `public_key.pem`. 

```bash
openssl rsa -pubout -in private_key.pem -out public_key.pem
```

Note: Don't forget to copy/paste the contents of `public_key.pem` file including `-----BEGIN PUBLIC KEY-----` and `-----END PUBLIC KEY-----` lines into `encodedKey` parameter when creating a `PublicKey`.

Example:

```ts
  new cloudfront.KeyGroup(stack, 'MyKeyGroup', {
    items: [
      new cloudfront.PublicKey(stack, 'MyPublicKey', {
        encodedKey: '...', // contents of public_key.pem file
        // comment: 'Key is expiring on ...',
      }),
    ],
    // comment: 'Key group containing public keys ...',
  });
```

See:

* https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/PrivateContent.html
* https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-trusted-signers.html 
