# Amazon Lambda Python Library

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

This library provides constructs for Python Lambda functions.

To use this module, you will need to have Docker installed.

## Python Function

Define a `PythonFunction`:

```ts
import * as lambda from "@aws-cdk/aws-lambda";
import { PythonFunction } from "@aws-cdk/aws-lambda-python";

new PythonFunction(this, 'MyFunction', {
  entry: '/path/to/my/function', // required
  index: 'my_index.py', // optional, defaults to 'index.py'
  handler: 'my_exported_func', // optional, defaults to 'handler'
  runtime: lambda.Runtime.PYTHON_3_6, // optional, defaults to lambda.Runtime.PYTHON_3_7
});
```

Custom Docker images for bundling dependencies can be specified by specifying additional `buildImageOptions`. If using a custom Docker image, please ensure that the dependencies are stored at `/var/dependencies` within the Docker image for them to be bundled into the Lambda asset.

A different bundling Docker image `Dockerfile.build` can be specified as:

```ts
new PythonFunction(this, 'MyFunction', {
   ...
   dockerBuildImageOptions: {
     file: "Dockerfile.build",
   },
});
```

All bundling images are passed in the `IMAGE` Docker build arg that specifies the correct AWS SAM build image based on the runtime of the function. Additional build args can be specified as:

```ts
new PythonFunction(this, 'MyFunction', {
  ...
  dockerBuildImageOptions: {
    buildArgs: {
      HTTPS_PROXY: 'https://127.0.0.1:3001',
    },
  },
});
```

All other properties of `lambda.Function` are supported, see also the [AWS Lambda construct library](https://github.com/aws/aws-cdk/tree/master/packages/%40aws-cdk/aws-lambda).

## Module Dependencies

If `requirements.txt` or `Pipfile` exists at the entry path, the construct will handle installing
all required modules in a [Lambda compatible Docker container](https://gallery.ecr.aws/sam/build-python3.7)
according to the `runtime`.

Python bundles are only recreated and published when a file in a source directory has changed.
Therefore (and as a general best-practice), it is highly recommended to commit a lockfile with a
list of all transitive dependencies and their exact versions.
This will ensure that when any dependency version is updated, the bundle asset is recreated and uploaded.

To that end, we recommend using [`pipenv`] or [`poetry`] which has lockfile support.

[`pipenv`]: https://pipenv-fork.readthedocs.io/en/latest/basics.html#example-pipfile-lock
[`poetry`]: https://python-poetry.org/docs/basic-usage/#commit-your-poetrylock-file-to-version-control

**Lambda with a requirements.txt**

```plaintext
.
├── lambda_function.py # exports a function named 'handler'
├── requirements.txt # has to be present at the entry path
```

**Lambda with a Pipfile**

```plaintext
.
├── lambda_function.py # exports a function named 'handler'
├── Pipfile # has to be present at the entry path
├── Pipfile.lock # your lock file
```

**Lambda with a poetry.lock**

```plaintext
.
├── lambda_function.py # exports a function named 'handler'
├── pyproject.toml # has to be present at the entry path
├── poetry.lock # your poetry lock file
```

**Lambda Layer Support**

You may create a python-based lambda layer with `PythonLayerVersion`. If `PythonLayerVersion` detects a `requirements.txt`
or `Pipfile` or `poetry.lock` with the associated `pyproject.toml` at the entry path, then `PythonLayerVersion` will include the dependencies inline with your code in the
layer.

```ts
new lambda.PythonFunction(this, 'MyFunction', {
  entry: '/path/to/my/function',
  layers: [
    new lambda.PythonLayerVersion(this, 'MyLayer', {
      entry: '/path/to/my/layer', // point this to your library's directory
    }),
  ],
});
```
