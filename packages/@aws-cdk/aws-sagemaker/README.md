## Amazon SageMaker Construct Library
<!--BEGIN STABILITY BANNER-->

---

![Stability: Experimental](https://img.shields.io/badge/stability-Experimental-important.svg?style=for-the-badge)

> **This is a _developer preview_ (public beta) module.**
>
> All classes with the `Cfn` prefix in this module ([CFN Resources](https://docs.aws.amazon.com/cdk/latest/guide/constructs.html#constructs_lib))
> are auto-generated from CloudFormation. They are stable and safe to use.
>
> However, all other classes, i.e., higher level constructs, are under active development and subject to non-backward
> compatible changes or removal in any future version. These are not subject to the [Semantic Versioning](https://semver.org/) model.
> This means that while you may use them, you may need to update your source code when upgrading to a newer version of this package.

---
<!--END STABILITY BANNER-->

Amazon SageMaker provides every developer and data scientist with the ability to build, train, and
deploy machine learning models quickly. Amazon SageMaker is a fully-managed service that covers the
entire machine learning workflow to label and prepare your data, choose an algorithm, train the
model, tune and optimize it for deployment, make predictions, and take action. Your models get to
production faster with much less effort and lower cost.

## Installation

Install the module:

```console
$ npm i @aws-cdk/aws-sagemaker
```

Import it into your code:

```typescript
import * as sagemaker from '@aws-cdk/aws-sagemaker';
```

## Model

By creating a model, you tell Amazon SageMaker where it can find the model components. This includes
the S3 path where the model artifacts are stored and the Docker registry path for the image that
contains the inference code. The `ContainerDefinition` interface encapsulates both the specification
of model inference code as a `ContainerImage` and an optional set of artifacts as `ModelData`.

#### Container Images

Inference code can be stored in the Amazon EC2 Container Registry (Amazon ECR), which is specified
via `ContainerDefinition`'s `image` property which accepts a class that extends the `ContainerImage`
abstract base class.

##### `EcrImage`

Reference an image available within ECR:

```typescript
import * as ecr from '@aws-cdk/aws-ecr';
import * as sagemaker from '@aws-cdk/aws-sagemaker';

const repository = ecr.Repository.fromRepositoryName(this, 'Repository', 'repo');
const image = sagemaker.ContainerImage.fromEcrRepository(repository, 'tag');
```

##### `AssetImage`

Reference a local directory containing a Dockerfile:

```typescript
import * as sagemaker from '@aws-cdk/aws-sagemaker';
import * as path from 'path';

const image = sagemaker.ContainerImage.fromAsset(this, 'Image', {
  directory: path.join('path', 'to', 'Dockerfile', 'directory')
});
```

#### Model Artifacts

Models are often associated with model artifacts, which are specified via the `modelData` property
which accepts a class that extends the `ModelData` abstract base class. The default is to have no
model artifacts associated with a model.

##### `S3ModelData`

Reference an S3 bucket and object key as the artifacts for a model:

```typescript
import * as s3 from '@aws-cdk/aws-s3';
import * as sagemaker from '@aws-cdk/aws-sagemaker';

const bucket = new s3.Bucket(this, 'MyBucket');
const modelData = sagemaker.ModelData.fromBucket(bucket, 'path/to/artifact/file.tar.gz');
```

##### `AssetModelData`

Reference local model data:

```typescript
import * as sagemaker from '@aws-cdk/aws-sagemaker';
import * as path from 'path';

const modelData = sagemaker.ModelData.fromAsset(this, 'ModelData',
  path.join('path', 'to', 'artifact', 'file.tar.gz'));
```

### `Model`

The `Model` construct associates container images with their optional model data.

#### Single Container Model

In the event that a single container is sufficient for your inference use-case, you can define a
single-container model:

```typescript
import * as sagemaker from '@aws-cdk/aws-sagemaker';

const model = new sagemaker.Model(this, 'PrimaryContainerModel', {
  container: {
    image: image,
    modelData: modelData,
  }
});
```

#### Inference Pipeline Model

An inference pipeline is an Amazon SageMaker model that is composed of a linear sequence of two to
five containers that process requests for inferences on data. You use an inference pipeline to
define and deploy any combination of pretrained Amazon SageMaker built-in algorithms and your own
custom algorithms packaged in Docker containers. You can use an inference pipeline to combine
preprocessing, predictions, and post-processing data science tasks. Inference pipelines are fully
managed. To define an inference pipeline, you can provide additional containers for your model via
the `extraContainers` property:

```typescript
import * as sagemaker from '@aws-cdk/aws-sagemaker';

const model = new sagemaker.Model(this, 'InferencePipelineModel', {
  container: {
    image: image1, modelData: modelData1
  },
  extraContainers: [
    { image: image2, modelData: modelData2 },
    { image: image3, modelData: modelData3 }
  ],
});
```

## Model Hosting

Amazon SageMaker provides model hosting services for model deployment. Amazon SageMaker provides an
HTTPS endpoint where your machine learning model is available to provide inferences.

### Endpoint Configuration

In this configuration, you identify one or more models to deploy and the resources that you want
Amazon SageMaker to provision. You define one or more production variants, each of which identifies
a model. Each production variant also describes the resources that you want Amazon SageMaker to
provision. This includes the number and type of ML compute instances to deploy. If you are hosting
multiple models, you also assign a variant weight to specify how much traffic you want to allocate
to each model. For example, suppose that you want to host two models, A and B, and you assign
traffic weight 2 for model A and 1 for model B. Amazon SageMaker distributes two-thirds of the
traffic to Model A, and one-third to model B:

```typescript
import * as sagemaker from '@aws-cdk/aws-sagemaker';

const endpointConfig = new sagemaker.EndpointConfig(this, 'EndpointConfig', {
  productionVariant: {
    model: modelA,
    variantName: 'modelA',
    initialVariantWeight: 2.0,
  },
  extraProductionVariants: [{
    model: modelB,
    variantName: 'variantB',
    initialVariantWeight: 1.0,
  }]
});
```

### Endpoint

If you create an endpoint from an `EndpointConfig`, Amazon SageMaker launches the ML compute
instances and deploys the model or models as specified in the configuration. To get inferences from
the model, client applications send requests to the Amazon SageMaker Runtime HTTPS endpoint. For
more information about the API, see the
[InvokeEndpoint](https://docs.aws.amazon.com/sagemaker/latest/dg/API_runtime_InvokeEndpoint.html)
API. Defining an endpoint requires at minimum the associated endpoint configuration:

```typescript
import * as sagemaker from '@aws-cdk/aws-sagemaker';

const endpoint = new sagemaker.Endpoint(this, 'Endpoint', { endpointConfig });
```

### AutoScaling


The `autoScaleInstanceCount` method on the `IEndpointProductionVariant` interface can be used to
enable Application Auto Scaling for the production variant:

```typescript
import * as sagemaker from '@aws-cdk/aws-sagemaker';

const endpoint = new sagemaker.Endpoint(stack, 'Endpoint', { endpointConfig });
const productionVariant = endpoint.findProductionVariant('variantName');
const instanceCount = productionVariant.autoScaleInstanceCount({
  maxCapacity: 3
});
instanceCount.scaleOnInvocations('LimitRPS', {
  maxRequestsPerSecond: 30,
});
```

For load testing guidance on determining the maximum requests per second per instance, please see
this [documentation](https://docs.aws.amazon.com/sagemaker/latest/dg/endpoint-scaling-loadtest.html).

### Metrics

The `IEndpointProductionVariant` interface also provides a set of APIs for referencing CloudWatch
metrics associated with a production variant associated with an endpoint:

```typescript
import * as sagemaker from '@aws-cdk/aws-sagemaker';

const endpoint = new sagemaker.Endpoint(this, 'Endpoint', { endpointConfig });
const productionVariant = endpoint.findProductionVariant('variantName');
productionVariant.metricModelLatency().createAlarm(this, 'ModelLatencyAlarm', {
  threshold: 100000,
  evaluationPeriods: 3,
});
```
