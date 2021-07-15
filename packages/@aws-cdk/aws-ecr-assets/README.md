# AWS CDK Docker Image Assets
<!--BEGIN STABILITY BANNER-->

---

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->

This module allows bundling Docker images as assets.

## Images from Dockerfile

Images are built from a local Docker context directory (with a `Dockerfile`),
uploaded to ECR by the CDK toolkit and/or your app's CI-CD pipeline, and can be
naturally referenced in your CDK app.

```ts
import { DockerImageAsset } from '@aws-cdk/aws-ecr-assets';

const asset = new DockerImageAsset(this, 'MyBuildImage', {
  directory: path.join(__dirname, 'my-image')
});
```

The directory `my-image` must include a `Dockerfile`.

This will instruct the toolkit to build a Docker image from `my-image`, push it
to an AWS ECR repository and wire the name of the repository as CloudFormation
parameters to your stack.

By default, all files in the given directory will be copied into the docker
*build context*. If there is a large directory that you know you definitely
don't need in the build context you can improve the performance by adding the
names of files and directories to ignore to a file called `.dockerignore`, or
pass them via the `exclude` property. If both are available, the patterns
found in `exclude` are appended to the patterns found in `.dockerignore`.

The `ignoreMode` property controls how the set of ignore patterns is
interpreted. The recommended setting for Docker image assets is
`IgnoreMode.DOCKER`. If the context flag
`@aws-cdk/aws-ecr-assets:dockerIgnoreSupport` is set to `true` in your
`cdk.json` (this is by default for new projects, but must be set manually for
old projects) then `IgnoreMode.DOCKER` is the default and you don't need to
configure it on the asset itself.

Use `asset.imageUri` to reference the image (it includes both the ECR image URL
and tag.

You can optionally pass build args to the `docker build` command by specifying
the `buildArgs` property:

```ts
const asset = new DockerImageAsset(this, 'MyBuildImage', {
  directory: path.join(__dirname, 'my-image'),
  buildArgs: {
    HTTP_PROXY: 'http://10.20.30.2:1234'
  }
});
```

You can optionally pass a target to the `docker build` command by specifying
the `target` property:

```ts
const asset = new DockerImageAsset(this, 'MyBuildImage', {
  directory: path.join(__dirname, 'my-image'),
  target: 'a-target'
})
```

## Images from Tarball

Images are loaded from a local tarball, uploaded to ECR by the CDK toolkit and/or your app's CI-CD pipeline, and can be
naturally referenced in your CDK app.

```ts
import { TarballImageAsset } from '@aws-cdk/aws-ecr-assets';

const asset = new TarballImageAsset(this, 'MyBuildImage', {
  tarballFile: 'local-image.tar'
});
```

This will instruct the toolkit to add the tarball as a file asset. During deployment it will load the container image
from `local-image.tar`, push it to an AWS ECR repository and wire the name of the repository as CloudFormation parameters
to your stack.

## Publishing images to ECR repositories

`DockerImageAsset` is designed for seamless build & consumption of image assets by CDK code deployed to multiple environments
through the CDK CLI or through CI/CD workflows. To that end, the ECR repository behind this construct is controlled by the AWS CDK.
The mechanics of where these images are published and how are intentionally kept as an implementation detail, and the construct
does not support customizations such as specifying the ECR repository name or tags.

If you are looking for a way to _publish_ image assets to an ECR repository in your control, you should consider using
[cdklabs/cdk-ecr-deployment], which is able to replicate an image asset from the CDK-controlled ECR repository to a repository of
your choice.

Here an example from the [cdklabs/cdk-ecr-deployment] project:

```ts
import * as ecrdeploy from 'cdk-ecr-deployment';

const image = new DockerImageAsset(this, 'CDKDockerImage', {
  directory: path.join(__dirname, 'docker'),
});

new ecrdeploy.ECRDeployment(this, 'DeployDockerImage', {
  src: new ecrdeploy.DockerImageName(image.imageUri),
  dest: new ecrdeploy.DockerImageName(`${cdk.Aws.ACCOUNT_ID}.dkr.ecr.us-west-2.amazonaws.com/test:nginx`),
});
```

⚠️ Please note that this is a 3rd-party construct library and is not officially supported by AWS.
You are welcome to +1 [this GitHub issue](https://github.com/aws/aws-cdk/issues/12597) if you would like to see
native support for this use-case in the AWS CDK.

[cdklabs/cdk-ecr-deployment]: https://github.com/cdklabs/cdk-ecr-deployment

## Pull Permissions

Depending on the consumer of your image asset, you will need to make sure
the principal has permissions to pull the image.

In most cases, you should use the `asset.repository.grantPull(principal)`
method. This will modify the IAM policy of the principal to allow it to
pull images from this repository.

If the pulling principal is not in the same account or is an AWS service that
doesn't assume a role in your account (e.g. AWS CodeBuild), pull permissions
must be granted on the __resource policy__ (and not on the principal's policy).
To do that, you can use `asset.repository.addToResourcePolicy(statement)` to
grant the desired principal the following permissions: "ecr:GetDownloadUrlForLayer",
"ecr:BatchGetImage" and "ecr:BatchCheckLayerAvailability".
