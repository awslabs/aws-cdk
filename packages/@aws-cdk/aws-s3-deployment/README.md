# AWS S3 Deployment Construct Library
<!--BEGIN STABILITY BANNER-->

---

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->

> __Status: Experimental__

This library allows populating an S3 bucket with the contents of .zip files
from other S3 buckets or from local disk.

The following example defines a publicly accessible S3 bucket with web hosting
enabled and populates it from a local directory on disk.

```ts
const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
  websiteIndexDocument: 'index.html',
  publicReadAccess: true
});

new s3deploy.BucketDeployment(this, 'DeployWebsite', {
  sources: [s3deploy.Source.asset('./website-dist')],
  destinationBucket: websiteBucket,
  destinationKeyPrefix: 'web/static' // optional prefix in destination bucket
});
```

This is what happens under the hood:

1. When this stack is deployed (either via `cdk deploy` or via CI/CD), the
   contents of the local `website-dist` directory will be archived and uploaded
   to an intermediary assets bucket. If there is more than one source, they will
   be individually uploaded.
2. The `BucketDeployment` construct synthesizes a custom CloudFormation resource
   of type `Custom::CDKBucketDeployment` into the template. The source bucket/key
   is set to point to the assets bucket.
3. The custom resource downloads the .zip archive, extracts it and issues `aws
   s3 sync --delete` against the destination bucket (in this case
   `websiteBucket`). If there is more than one source, the sources will be
   downloaded and merged pre-deployment at this step.


## Supported sources

The following source types are supported for bucket deployments:

 - Local .zip file: `s3deploy.Source.asset('/path/to/local/file.zip')`
 - Local directory: `s3deploy.Source.asset('/path/to/local/directory')`
 - Another bucket: `s3deploy.Source.bucket(bucket, zipObjectKey)`

To create a source from a single file, you can pass `AssetOptions` to exclude
all but a single file:

 - Single file: `s3deploy.Source.asset('/path/to/local/directory', { exclude: ['**', '!onlyThisFile.txt'] })`

**IMPORTANT** The `aws-s3-deployment` module is only intended to be used with
zip files from trusted sources. Directories bundled by the CDK CLI (by using
`Source.asset()` on a directory) are safe. If you are using `Source.asset()` or
`Source.bucket()` to reference an existing zip file, make sure you trust the
file you are referencing. Zips from untrusted sources might be able to execute
arbitrary code in the Lambda Function used by this module, and use its permissions
to read or write unexpected files in the S3 bucket.

## Retain on Delete

By default, the contents of the destination bucket will **not** be deleted when the
`BucketDeployment` resource is removed from the stack or when the destination is
changed. You can use the option `retainOnDelete: false` to disable this behavior,
in which case the contents will be deleted.

Configuring this has a few implications you should be aware of:

- **Logical ID Changes**

  Changing the logical ID of the `BucketDeployment` construct, without changing the destination
  (for example due to refactoring, or intentional ID change) **will result in the deletion of the objects**.
  This is because CloudFormation will first create the new resource, which will have no affect,
  followed by a deletion of the old resource, which will cause a deletion of the objects,
  since the destination hasn't changed, and `retainOnDelete` is `false`.

- **Destination Changes**

  When the destination bucket or prefix is changed, all files in the previous destination will **first** be
  deleted and then uploaded to the new destination location. This could have availability implications
  on your users.

### General Recommendations

#### Shared Bucket

If the destination bucket **is not** dedicated to the specific `BucketDeployment` construct (i.e shared by other entities),
we recommend to always configure the `destinationKeyPrefix` property. This will prevent the deployment from
accidentally deleting data that wasn't uploaded by it.

#### Dedicated Bucket

If the destination bucket **is** dedicated, it might be reasonable to skip the prefix configuration,
in which case, we recommend to remove `retainOnDelete: false`, and instead, configure the
[`autoDeleteObjects`](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-s3-readme.html#bucket-deletion)
property on the destination bucket. This will avoid the logical ID problem mentioned above.

## Prune

By default, files in the destination bucket that don't exist in the source will be deleted
when the `BucketDeployment` resource is created or updated. You can use the option `prune: false` to disable
this behavior, in which case the files will not be deleted.

```ts
new s3deploy.BucketDeployment(this, 'DeployMeWithoutDeletingFilesOnDestination', {
  sources: [s3deploy.Source.asset(path.join(__dirname, 'my-website'))],
  destinationBucket,
  prune: false,
});
```

This option also enables you to specify multiple bucket deployments for the same destination bucket & prefix,
each with its own characteristics. For example, you can set different cache-control headers
based on file extensions:

```ts
new BucketDeployment(this, 'BucketDeployment', {
  sources: [Source.asset('./website', { exclude: ['index.html'] })],
  destinationBucket: bucket,
  cacheControl: [CacheControl.fromString('max-age=31536000,public,immutable')],
  prune: false,
});

new BucketDeployment(this, 'HTMLBucketDeployment', {
  sources: [Source.asset('./website', { exclude: ['*', '!index.html'] })],
  destinationBucket: bucket,
  cacheControl: [CacheControl.fromString('max-age=0,no-cache,no-store,must-revalidate')],
  prune: false,
});
```

## Objects metadata

You can specify metadata to be set on all the objects in your deployment.
There are 2 types of metadata in S3: system-defined metadata and user-defined metadata.
System-defined metadata have a special purpose, for example cache-control defines how long to keep an object cached.
User-defined metadata are not used by S3 and keys always begin with `x-amz-meta-` (this prefix is added automatically).

System defined metadata keys include the following:

- cache-control
- content-disposition
- content-encoding
- content-language
- content-type
- expires
- server-side-encryption
- storage-class
- website-redirect-location
- ssekms-key-id
- sse-customer-algorithm

```ts
const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
  websiteIndexDocument: 'index.html',
  publicReadAccess: true
});

new s3deploy.BucketDeployment(this, 'DeployWebsite', {
  sources: [s3deploy.Source.asset('./website-dist')],
  destinationBucket: websiteBucket,
  destinationKeyPrefix: 'web/static', // optional prefix in destination bucket
  metadata: { A: "1", b: "2" }, // user-defined metadata

  // system-defined metadata
  contentType: "text/html",
  contentLanguage: "en",
  storageClass: StorageClass.INTELLIGENT_TIERING,
  serverSideEncryption: ServerSideEncryption.AES_256,
  cacheControl: [CacheControl.setPublic(), CacheControl.maxAge(cdk.Duration.hours(1))],
});
```

## CloudFront Invalidation

You can provide a CloudFront distribution and optional paths to invalidate after the bucket deployment finishes.

```ts
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as origins from '@aws-cdk/aws-cloudfront-origins';

const bucket = new s3.Bucket(this, 'Destination');

// Handles buckets whether or not they are configured for website hosting.
const distribution = new cloudfront.Distribution(this, 'Distribution', {
  defaultBehavior: { origin: new origins.S3Origin(bucket) },
});

new s3deploy.BucketDeployment(this, 'DeployWithInvalidation', {
  sources: [s3deploy.Source.asset('./website-dist')],
  destinationBucket: bucket,
  distribution,
  distributionPaths: ['/images/*.png'],
});
```

## Memory Limit

The default memory limit for the deployment resource is 128MiB. If you need to
copy larger files, you can use the `memoryLimit` configuration to specify the
size of the AWS Lambda resource handler.

> NOTE: a new AWS Lambda handler will be created in your stack for each memory
> limit configuration.

## Notes

- This library uses an AWS CloudFormation custom resource which is about 10MiB in
  size. The code of this resource is bundled with this library.
- AWS Lambda execution time is limited to 15min. This limits the amount of data
  which can be deployed into the bucket by this timeout.
- When the `BucketDeployment` is removed from the stack, the contents are retained
  in the destination bucket ([#952](https://github.com/aws/aws-cdk/issues/952)).
- Bucket deployment _only happens_ during stack create/update. This means that
  if you wish to update the contents of the destination, you will need to
  change the source s3 key (or bucket), so that the resource will be updated.
  This is inline with best practices. If you use local disk assets, this will
  happen automatically whenever you modify the asset, since the S3 key is based
  on a hash of the asset contents.
- The `deployedBucket` property exposes the destination bucket of the deployment.
  The bucket is instatiated using a `getAtt` call, such that any constructs that
  utilize this bucket will add the bucket as a dependency. 

## Development

The custom resource is implemented in Python 3.6 in order to be able to leverage
the AWS CLI for "aws sync". The code is under [`lib/lambda`](https://github.com/aws/aws-cdk/tree/master/packages/%40aws-cdk/aws-s3-deployment/lib/lambda) and
unit tests are under [`test/lambda`](https://github.com/aws/aws-cdk/tree/master/packages/%40aws-cdk/aws-s3-deployment/test/lambda).

This package requires Python 3.6 during build time in order to create the custom
resource Lambda bundle and test it. It also relies on a few bash scripts, so
might be tricky to build on Windows.

## Roadmap

 - [ ] Support "blue/green" deployments ([#954](https://github.com/aws/aws-cdk/issues/954))
