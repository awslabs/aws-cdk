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

All other properties of `lambda.Function` are supported, see also the [AWS Lambda construct library](https://github.com/aws/aws-cdk/tree/master/packages/%40aws-cdk/aws-lambda).

## Module Dependencies

If `requirements.txt` or `Pipfile` exists at the entry path, the construct will handle installing
all required modules in a [Lambda compatible Docker container](https://gallery.ecr.aws/sam/build-python3.7)
according to the `runtime`.

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
