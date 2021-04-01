# Amazon Lambda Node.js Library
<!--BEGIN STABILITY BANNER-->

---

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->

This library provides constructs for Node.js Lambda functions.

To use this module, you will need to have Docker installed.

## Node.js Function

Define a `NodejsFunction`:

```ts
new lambda.NodejsFunction(this, 'my-handler');
```

By default, the construct will use the name of the defining file and the construct's id to look
up the entry file:

```plaintext
.
├── stack.ts # defines a 'NodejsFunction' with 'my-handler' as id
├── stack.my-handler.ts # exports a function named 'handler'
```

This file is used as "entry" for [esbuild](https://esbuild.github.io/). This means that your code is automatically transpiled and bundled whether it's written in JavaScript or TypeScript.

Alternatively, an entry file and handler can be specified:

```ts
new lambda.NodejsFunction(this, 'MyFunction', {
  entry: '/path/to/my/file.ts', // accepts .js, .jsx, .ts and .tsx files
  handler: 'myExportedFunc'
});
```

All other properties of `lambda.Function` are supported, see also the [AWS Lambda construct library](https://github.com/aws/aws-cdk/tree/master/packages/%40aws-cdk/aws-lambda).

The `NodejsFunction` construct automatically [reuses existing connections](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/node-reusing-connections.html)
when working with the AWS SDK for JavaScript. Set the `awsSdkConnectionReuse` prop to `false` to disable it.

## Lock file

The `NodejsFunction` requires a dependencies lock file (`yarn.lock` or
`package-lock.json`). When bundling in a Docker container, the path containing this
lock file is used as the source (`/asset-input`) for the volume mounted in the
container.

By default, the construct will try to automatically determine your project lock file.
Alternatively, you can specify the `depsLockFilePath` prop manually. In this
case you need to ensure that this path includes `entry` and any module/dependencies
used by your function. Otherwise bundling will fail.

## Local bundling

If `esbuild` is available it will be used to bundle your code in your environment. Otherwise,
bundling will happen in a [Lambda compatible Docker container](https://gallery.ecr.aws/sam/build-nodejs12.x).

For macOS the recommendend approach is to install `esbuild` as Docker volume performance is really poor.

`esbuild` can be installed with:

```console
$ npm install --save-dev esbuild@0
```

OR

```console
$ yarn add --dev esbuild@0
```

To force bundling in a Docker container even if `esbuild` is available in your environment,
set `bundling.forceDockerBundling` to `true`. This is useful if your function relies on node
modules that should be installed (`nodeModules` prop, see [below](#install-modules)) in a Lambda
compatible environment. This is usually the case with modules using native dependencies.

## Working with modules

### Externals

By default, all node modules are bundled except for `aws-sdk`. This can be configured by specifying
`bundling.externalModules`:

```ts
new lambda.NodejsFunction(this, 'my-handler', {
  bundling: {
    externalModules: [
      'aws-sdk', // Use the 'aws-sdk' available in the Lambda runtime
      'cool-module', // 'cool-module' is already available in a Layer
    ],
  },
});
```

### Install modules

By default, all node modules referenced in your Lambda code will be bundled by `esbuild`.
Use the `nodeModules` prop under `bundling` to specify a list of modules that should not be
bundled but instead included in the `node_modules` folder of the Lambda package. This is useful
when working with native dependencies or when `esbuild` fails to bundle a module.

```ts
new lambda.NodejsFunction(this, 'my-handler', {
  bundling: {
    nodeModules: ['native-module', 'other-module'],
  },
});
```

The modules listed in `nodeModules` must be present in the `package.json`'s dependencies or
installed. The same version will be used for installation. The lock file (`yarn.lock` or
`package-lock.json`) will be used along with the right installer (`yarn` or `npm`).

When working with `nodeModules` using native dependencies, you might want to force bundling in a
Docker container even if `esbuild` is available in your environment. This can be done by setting
`bundling.forceDockerBundling` to `true`.

## Configuring `esbuild`

The `NodejsFunction` construct exposes some [esbuild options](https://esbuild.github.io/api/#build-api)
via properties under `bundling`:

```ts
new lambda.NodejsFunction(this, 'my-handler', {
  bundling: {
    minify: true, // minify code, defaults to false
    sourceMap: true, // include source map, defaults to false
    target: 'es2020', // target environment for the generated JavaScript code
    loader: { // Use the 'dataurl' loader for '.png' files
      '.png': 'dataurl',
    },
    define: { // Replace strings during build time
      'process.env.API_KEY': JSON.stringify('xxx-xxxx-xxx'),
    },
    logLevel: LogLevel.SILENT, // defaults to LogLevel.WARNING
    keepNames: true, // defaults to false
    tsconfig: 'custom-tsconfig.json' // use custom-tsconfig.json instead of default,
    metafile: true, // include meta file, defaults to false
    banner : '/* comments */', // by default no comments are passed
    footer : '/* comments */', // by default no comments are passed
  },
});
```

## Command hooks

It is possible to run additional commands by specifying the `commandHooks` prop:

```ts
new lambda.NodejsFunction(this, 'my-handler-with-commands', {
  bundling: {
    commandHooks: {
      // Copy a file so that it will be included in the bundled asset
      afterBundling(inputDir: string, outputDir: string): string[] {
        return [`cp ${inputDir}/my-binary.node ${outputDir}`];
      }
      // ...
    }
    // ...
  }
  
});
```

The following hooks are available:

- `beforeBundling`: runs before all bundling commands
- `beforeInstall`: runs before node modules installation
- `afterBundling`: runs after all bundling commands

They all receive the directory containing the lock file (`inputDir`) and the
directory where the bundled asset will be output (`outputDir`). They must return
an array of commands to run. Commands are chained with `&&`.

The commands will run in the environment in which bundling occurs: inside the
container for Docker bundling or on the host OS for local bundling.

## Customizing Docker bundling

Use `bundling.environment` to define environments variables when `esbuild` runs:

```ts
new lambda.NodejsFunction(this, 'my-handler', {
  bundling: {
    environment: {
      NODE_ENV: 'production',
    },
  },
});
```

Use `bundling.buildArgs` to pass build arguments when building the Docker bundling image:

```ts
new lambda.NodejsFunction(this, 'my-handler', {
  bundling: {
      buildArgs: {
        HTTPS_PROXY: 'https://127.0.0.1:3001',
      },
  }
});
```

Use `bundling.dockerImage` to use a custom Docker bundling image:

```ts
new lambda.NodejsFunction(this, 'my-handler', {
  bundling: {
    dockerImage: cdk.DockerImage.fromBuild('/path/to/Dockerfile'),
  },
});
```

This image should have `esbuild` installed **globally**. If you plan to use `nodeModules` it
should also have `npm` or `yarn` depending on the lock file you're using.

Use the [default image provided by `@aws-cdk/aws-lambda-nodejs`](https://github.com/aws/aws-cdk/blob/master/packages/%40aws-cdk/aws-lambda-nodejs/lib/Dockerfile)
as a source of inspiration.
