# CDK Pipelines
<!--BEGIN STABILITY BANNER-->

---

![cdk-constructs: Developer Preview](https://img.shields.io/badge/cdk--constructs-developer--preview-informational.svg?style=for-the-badge)

> The APIs of higher level constructs in this module are in **developer preview** before they
> become stable. We will only make breaking changes to address unforeseen API issues. Therefore,
> these APIs are not subject to [Semantic Versioning](https://semver.org/), and breaking changes
> will be announced in release notes. This means that while you may use them, you may need to
> update your source code when upgrading to a newer version of this package.

---

<!--END STABILITY BANNER-->

A construct library for painless Continuous Delivery of CDK applications.

> This module contains two sets of APIs: an **original** and a **modern** version of
CDK Pipelines. The *modern* API has been updated to be easier to work with and
customize, and will be the preferred API going forward. The *original* version
of the API is still available for backwards compatibility, but we recommend migrating
to the new version if possible.
>
> Compared to the original API, the modern API: has more sensible defaults; is
> more flexible; supports parallel deployments; supports multiple synth inputs;
> allows more control of CodeBuild project generation; supports deployment
> engines other than CodePipeline.
>
> The README for the original API can be found in [our GitHub repository](https://github.com/aws/aws-cdk/blob/master/packages/@aws-cdk/pipelines/ORIGINAL_API.md).

## At a glance

Deploying your application continuously starts by defining a
`MyApplicationStage`, a subclass of `Stage` that contains the stacks that make
up a single copy of your application.

You then define a `Pipeline`, instantiate as many instances of
`MyApplicationStage` as you want for your test and production environments, with
different parameters for each, and calling `pipeline.addStage()` for each of
them. You can deploy to the same account and Region, or to a different one,
with the same amount of code. The *CDK Pipelines* library takes care of the
details.

CDK Pipelines supports multiple *deployment engines* (see below), and comes with
a deployment engine that deployes CDK apps using AWS CodePipeline. To use the
CodePipeline engine, define a `CodePipeline` construct.  The following
example creates a CodePipeline that deploys an application from GitHub:

```ts
/** The stacks for our app are defined in my-stacks.ts.  The internals of these
  * stacks aren't important, except that DatabaseStack exposes an attribute
  * "table" for a database table it defines, and ComputeStack accepts a reference
  * to this table in its properties.
  */
import { DatabaseStack, ComputeStack } from '../lib/my-stacks';
import { Construct, Stage, Stack, StackProps, StageProps } from '@aws-cdk/core';
import { CodePipeline, CodePipelineSource, ShellStep } from '@aws-cdk/pipelines';

/**
 * Stack to hold the pipeline
 */
class MyPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const pipeline = new CodePipeline(this, 'Pipeline', {
      synth: new ShellStep('Synth', {
        // Use a connection created using the AWS console to authenticate to GitHub
        // Other sources are available.
        input: CodePipelineSource.connection('my-org/my-app', 'main', {
          connectionArn: 'arn:aws:codestar-connections:us-east-1:222222222222:connection/7d2469ff-514a-4e4f-9003-5ca4a43cdc41', // Created using the AWS console * });',
        }),
        commands: [
          'npm ci',
          'npm run build',
          'npx cdk synth',
        ],
      }),
    });

    // 'MyApplication' is defined below. Call `addStage` as many times as
    // necessary with any account and region (may be different from the
    // pipeline's).
    pipeline.addStage(new MyApplication(this, 'Prod', {
      env: {
        account: '123456789012',
        region: 'eu-west-1',
      }
    }));
  }
}

/**
 * Your application
 *
 * May consist of one or more Stacks (here, two)
 *
 * By declaring our DatabaseStack and our ComputeStack inside a Stage,
 * we make sure they are deployed together, or not at all.
 */
class MyApplication extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    const dbStack = new DatabaseStack(this, 'Database');
    new ComputeStack(this, 'Compute', {
      table: dbStack.table,
    });
  }
}

// In your main file
new MyPipelineStack(app, 'PipelineStack', {
  env: {
    account: '123456789012',
    region: 'eu-west-1',
  }
});
```

The pipeline is **self-mutating**, which means that if you add new
application stages in the source code, or new stacks to `MyApplication`, the
pipeline will automatically reconfigure itself to deploy those new stages and
stacks.

(Note that have to *bootstrap* all environments before the above code
will work, see the section **CDK Environment Bootstrapping** below).

## CDK Versioning

This library uses prerelease features of the CDK framework, which can be enabled
by adding the following to `cdk.json`:

```js
{
  // ...
  "context": {
    "@aws-cdk/core:newStyleStackSynthesis": true
  }
}
```

## Provisioning the pipeline

To provision the pipeline you have defined, making sure the target environment
has been bootstrapped (see below), and then executing deploying the
`PipelineStack` *once*. Afterwards, the pipeline will keep itself up-to-date.

> **Important**: be sure to `git commit` and `git push` before deploying the
> Pipeline stack using `cdk deploy`!
>
> The reason is that the pipeline will start deploying and self-mutating
> right away based on the sources in the repository, so the sources it finds
> in there should be the ones you want it to find.

Run the following commands to get the pipeline going:

```console
$ git commit -a
$ git push
$ cdk deploy PipelineStack
```

Administrative permissions to the account are only necessary up until
this point. We recommend you shed access to these credentials after doing this.

### Working on the pipeline

The self-mutation feature of the Pipeline might at times get in the way
of the pipeline development workflow. Each change to the pipeline must be pushed
to git, otherwise, after the pipeline was updated using `cdk deploy`, it will
automatically revert to the state found in git.

To make the development more convenient, the self-mutation feature can be turned
off temporarily, by passing `selfMutation: false` property, example:

```ts
// Modern API
const pipeline = new CodePipeline(this, 'Pipeline', {
  selfMutation: false,
  ...
});

// Original API
const pipeline = new CdkPipeline(this, 'Pipeline', {
  selfMutating: false,
  ...
});
```

## Definining the pipeline

This section of the documentation describes the AWS CodePipeline engine, which
comes with this library. If you want to use a different deployment engine, read
the section *Using a different deployment engine* below.

### Synth and sources

To define a pipeline, instantiate a `CodePipeline` construct from the
`@aws-cdk/pipelines` module. It takes one argument, a `synth` step, which is
expected to produce the CDK Cloud Assembly as its single output (the contents of
the `cdk.out` directory after running `cdk synth`). "Steps" are arbitrary
actions in the pipeline, typically used to run scripts or commands.

For the synth, use a `ShellStep` and specify the commands necessary to build
your project and run `cdk synth`; the specific commands required will depend on
the programming language you are using. For a typical NPM-based project, the synth
will look like this:

```ts
const source = /* the repository source */;

const pipeline = new CodePipeline(this, 'Pipeline', {
  synth: new ShellStep('Synth', {
    input: source,
    commands: [
      'npm ci',
      'npm run build',
      'npx cdk synth',
    ],
  }),
});
```

The pipeline assumes that your `ShellStep` will produce a `cdk.out`
directory in the root, containing the CDK cloud assembly. If your
CDK project lives in a subdirectory, be sure to adjust the
`primaryOutputDirectory` to match:

```ts
const pipeline = new CodePipeline(this, 'Pipeline', {
  synth: new ShellStep('Synth', {
    input: source,
    commands: [
      'cd mysubdir',
      'npm ci',
      'npm run build',
      'npx cdk synth',
    ],
    primaryOutputDirectory: 'mysubdir/cdk.out',
  }),
});
```

The underlying `@aws-cdk/aws-codepipeline.Pipeline` construct will be produced
when `app.synth()` is called. You can also force it to be produced
earlier by calling `pipeline.buildPipeline()`. After you've called
that method, you can inspect the constructs that were produced by
accessing the properties of the `pipeline` object.

#### CodePipeline Sources

In CodePipeline, *Sources* define where the source of your application lives.
When a change to the source is detected, the pipeline will start executing.
Source objects can be created by factory methods on the `CodePipelineSource` class:

##### GitHub, GitHub Enterprise, BitBucket using a connection

The recommended way of connecting to GitHub or BitBucket is by using a *connection*.
You will first use the AWS Console to authenticate to the source control
provider, and then use the connection ARN in your pipeline definition:

```ts
CodePipelineSource.connection('org/repo', 'branch', {
  connectionArn: 'arn:aws:codestar-connections:us-east-1:222222222222:connection/7d2469ff-514a-4e4f-9003-5ca4a43cdc41',
});
```

##### GitHub using OAuth

You can also authenticate to GitHub using a personal access token. This expects
that you've created a personal access token and stored it in Secrets Manager.
By default, the source object will look for a secret named **github-token**, but
you can change the name. The token should have the **repo** and **admin:repo_hook**
scopes.

```ts
CodePipelineSource.gitHub('org/repo', 'branch', {
  // This is optional
  authentication: SecretValue.secretsManager('my-token'),
});
```

##### CodeCommit

You can use a CodeCommit repository as the source. Either create or import
that the CodeCommit repository and then use `CodePipelineSource.codeCommit`
to reference it:

```ts
const repository = codecommit.fromRepositoryName(this, 'Repository', 'my-repository');
CodePipelineSource.codeCommit(repository);
```

##### S3

You can use a zip file in S3 as the source of the pipeline. The pipeline will be
triggered every time the file in S3 is changed:

```ts
const bucket = s3.Bucket.fromBucketName(this, 'Bucket', 'my-bucket');
CodePipelineSource.s3(bucket, 'my/source.zip');
```

#### Additional inputs

`ShellStep` allows passing in more than one input: additional
inputs will be placed in the directories you specify. Any step that produces an
output file set can be used as an input, such as a `CodePipelineSource`, but
also other `ShellStep`:

```ts
const prebuild = new ShellStep('Prebuild', {
  input: CodePipelineSource.gitHub('myorg/repo1'),
  primaryOutputDirectory: './build',
  commands: ['./build.sh'],
});

const pipeline = new CodePipeline(this, 'Pipeline', {
  synth: new ShellStep('Synth', {
    input: CodePipelineSource.gitHub('myorg/repo2'),
    additionalInputs: {
      'subdir': CodePipelineSource.gitHub('myorg/repo3'),
      '../siblingdir': prebuild,
    },

    commands: ['./build.sh'],
  })
});
```

### CDK application deployments

After you have defined the pipeline and the `synth` step, you can add one or
more CDK `Stages` which will be deployed to their target environments. To do
so, call `pipeline.addStage()` on the Stage object:

```ts
// Do this as many times as necessary with any account and region
// Account and region may different from the pipeline's.
pipeline.addStage(new MyApplicationStage(this, 'Prod', {
  env: {
    account: '123456789012',
    region: 'eu-west-1',
  }
}));
```

CDK Pipelines will automatically discover all `Stacks` in the given `Stage`
object, determine their dependency order, and add appropriate actions to the
pipeline to publish the assets referenced in those stacks and deploy the stacks
in the right order.

If the `Stacks` are targeted at an environment in a different AWS account or
Region and that environment has been
[bootstrapped](https://docs.aws.amazon.com/cdk/latest/guide/bootstrapping.html)
, CDK Pipelines will transparently make sure the IAM roles are set up
correctly and any requisite replication Buckets are created.

#### Deploying in parallel

By default, all applications added to CDK Pipelines by calling `addStage()` will
be deployed in sequence, one after the other. If you have a lot of stages, you can
speed up the pipeline by choosing to deploy some stages in parallel. You do this
by calling `addWave()` instead of `addStage()`: a *wave* is a set of stages that
are all deployed in parallel instead of sequentially. Waves themselves are still
deployed in sequence. For example, the following will deploy two copies of your
application to `eu-west-1` and `eu-central-1` in parallel:

```ts
const europeWave = pipeline.addWave('Europe');
europeWave.addStage(new MyApplicationStage(this, 'Ireland', {
  env: { region: 'eu-west-1' }
}));
europeWave.addStage(new MyApplicationStage(this, 'Germany', {
  env: { region: 'eu-central-1' }
}));
```

#### Deploying to other accounts / encrypting the Artifact Bucket

CDK Pipelines can transparently deploy to other Regions and other accounts
(provided those target environments have been
[*bootstrapped*](https://docs.aws.amazon.com/cdk/latest/guide/bootstrapping.html)).
However, deploying to another account requires one additional piece of
configuration: you need to enable `crossAccountKeys: true` when creating the
pipeline.

This will encrypt the artifact bucket(s), but incurs a cost for maintaining the
KMS key.

Example:

```ts
const pipeline = new CodePipeline(this, 'Pipeline', {
  // Encrypt artifacts, required for cross-account deployments
  crossAccountKeys: true,
});
```

### Validation

Every `addStage()` and `addWave()` command takes additional options. As part of these options,
you can specify `pre` and `post` steps, which are arbitrary steps that run before or after
the contents of the stage or wave, respectively. You can use these to add validations like
manual or automated gates to your pipeline.

The following example shows both an automated approval in the form of a `ShellStep`, and
a manual approvel in the form of a `ManualApprovalStep` added to the pipeline. Both must
pass in order to promote from the `PreProd` to the `Prod` environment:

```ts
const preprod = new MyApplicationStage(this, 'PreProd', { ... });
const prod = new MyApplicationStage(this, 'Prod', { ... });

pipeline.addStage(preprod, {
  post: [
    new ShellStep('Validate Endpoint', {
      commands: ['curl -Ssf https://my.webservice.com/'],
    }),
  ],
});
pipeline.addStage(prod, {
  pre: [
    new ManualApprovalStep('PromoteToProd'),
  ],
});
```

#### Using CloudFormation Stack Outputs in approvals

Because many CloudFormation deployments result in the generation of resources with unpredictable
names, validations have support for reading back CloudFormation Outputs after a deployment. This
makes it possible to pass (for example) the generated URL of a load balancer to the test set.

To use Stack Outputs, expose the `CfnOutput` object you're interested in, and
pass it to `envFromCfnOutputs` of the `ShellStep`:

```ts
class MyApplicationStage extends Stage {
  public readonly loadBalancerAddress: CfnOutput;
  // ...
}

const lbApp = new MyApplicationStage(this, 'MyApp', { /* ... */ });
pipeline.addStage(lbApp, {
  post: [
    new ShellStep('HitEndpoint', {
      envFromCfnOutputs: {
        // Make the load balancer address available as $URL inside the commands
        URL: lbApp.loadBalancerAddress,
      },
      commands: ['curl -Ssf $URL'],
    });
  ],
});
```

#### Running scripts compiled during the synth step

As part of a validation, you probably want to run a test suite that's more
elaborate than what can be expressed in a couple of lines of shell script.
You can bring additional files into the shell script validation by supplying
the `input` or `additionalInputs` property of `ShellStep`. The input can
be produced by the `Synth` step, or come from a source or any other build
step.

Here's an example that captures an additional output directory in the synth
step and runs tests from there:

```ts
const synth = new ShellStep('Synth', { /* ... */ });
const pipeline = new CodePipeline(this, 'Pipeline', { synth });

new ShellStep('Approve', {
  // Use the contents of the 'integ' directory from the synth step as the input
  input: synth.addOutputDirectory('integ'),
  commands: ['cd integ && ./run.sh'],
});
```

### Customizing CodeBuild Projects

CDK pipelines will generate CodeBuild projects for each `ShellStep` you use, and it
will also generate CodeBuild projects to publish assets and perform the self-mutation
of the pipeline. To control the various aspects of the CodeBuild projects that get
generated, use a `CodeBuildStep` instead of a `ShellStep`. This class has a number
of properties that allow you to customize various aspects of the projects:

```ts
new CodeBuildStep('Synth', {
  // ...standard RunScript props...
  commands: [/* ... */],
  env: { /* ... */ },

  // If you are using a CodeBuildStep explicitly, set the 'cdk.out' directory
  // to be the synth step's output.
  primaryOutputDirectory: 'cdk.out',

  // Control the name of the project
  projectName: 'MyProject',

  // Control parts of the BuildSpec other than the regular 'build' and 'install' commands
  partialBuildSpec: codebuild.BuildSpec.fromObject({
    version: '0.2',
    // ...
  }),

  // Control the build environment
  buildEnvironment: {
    computeType: codebuild.ComputeType.LARGE,
  },

  // Control Elastic Network Interface creation
  vpc: vpc,
  subnetSelection: { subnetType: ec2.SubnetType.PRIVATE },
  securityGroups: [mySecurityGroup],

  // Additional policy statements for the execution role
  rolePolicy: [
    new iam.PolicyStatement({ /* ... */ }),
  ],
});
```

You can also configure defaults for *all* CodeBuild projects by passing `codeBuildDefaults`,
or just for the asset publishing and self-mutation projects by passing `assetPublishingCodeBuildDefaults`
or `selfMutationCodeBuildDefaults`:

```ts
new CodePipeline(this, 'Pipeline', {
  // ...

  // Defaults for all CodeBuild projects
  codeBuildDefaults: {
    // Prepend commands and configuration to all projects
    partialBuildSpec: codebuild.BuildSpec.fromObject({
      version: '0.2',
      // ...
    }),

    // Control the build environment
    buildEnvironment: {
      computeType: codebuild.ComputeType.LARGE,
    },

    // Control Elastic Network Interface creation
    vpc: vpc,
    subnetSelection: { subnetType: ec2.SubnetType.PRIVATE },
    securityGroups: [mySecurityGroup],

    // Additional policy statements for the execution role
    rolePolicy: [
      new iam.PolicyStatement({ /* ... */ }),
    ],
  },

  assetPublishingCodeBuildDefaults: { /* ... */ },
  selfMutationCodeBuildDefaults: { /* ... */ },
});
```

### Arbitrary CodePipeline actions

If you want to add a type of CodePipeline action to the CDK Pipeline that
doesn't have a matching class yet, you can define your own step class that extends
`Step` and implements `ICodePipelineActionFactory`.

Here's a simple example that adds a Jenkins step:

```ts
class MyJenkinsStep extends Step implements ICodePipelineActionFactory {
  constructor(private readonly provider: codepipeline_actions.JenkinsProvider, private readonly input: FileSet) {
  }

  public produceAction(stage: codepipeline.IStage, options: ProduceActionOptions): CodePipelineActionFactoryResult {

    // This is where you control what type of Action gets added to the
    // CodePipeline
    stage.addAction(new codepipeline_actions.JenkinsAction({
      // Copy 'actionName' and 'runOrder' from the options
      actionName: options.actionName,
      runOrder: options.runOrder,

      // Jenkins-specific configuration
      type: cpactions.JenkinsActionType.TEST,
      jenkinsProvider: this.provider,
      projectName: 'MyJenkinsProject',

      // Translate the FileSet into a codepipeline.Artifact
      inputs: [options.artifacts.toCodePipeline(this.input)],
    }));

    return { runOrdersConsumed: 1 };
  }
}
```

## Using Docker in the pipeline

Docker can be used in 3 different places in the pipeline:

* If you are using Docker image assets in your application stages: Docker will
  run in the asset publishing projects.
* If you are using Docker image assets in your stack (for example as
  images for your CodeBuild projects): Docker will run in the self-mutate project.
* If you are using Docker to bundle file assets anywhere in your project (for
  example, if you are using such construct libraries as
  `@aws-cdk/aws-lambda-nodejs`): Docker will run in the
  *synth* project.

For the first case, you don't need to do anything special. For the other two cases,
you need to make sure that **privileged mode** is enabled on the correct CodeBuild
projects, so that Docker can run correctly. The follow sections describe how to do
that.

You may also need to authenticate to Docker registries to avoid being throttled.
See the section **Authenticating to Docker registries** below for information on how to do
that.

### Using Docker image assets in the pipeline

If your `PipelineStack` is using Docker image assets (as opposed to the application
stacks the pipeline is deploying), for example by the use of `LinuxBuildImage.fromAsset()`,
you need to pass `dockerEnabledForSelfMutation: true` to the pipeline. For example:

```ts
const pipeline = new CodePipeline(this, 'Pipeline', {
  // ...

  // Turn this on because the pipeline uses Docker image assets
  dockerEnabledForSelfMutation: true,
});

pipeline.addWave('MyWave', {
  post: [
    new CodeBuildStep('RunApproval', {
      commands: ['command-from-image'],
      buildEnvironment: {
        // The user of a Docker image asset in the pipeline requires turning on
        // 'dockerEnabledForSelfMutation'.
        buildImage: LinuxBuildImage.fromAsset(this, 'Image', {
          directory: './docker-image',
        })
      },
    })
  ],
});
```

> **Important**: You must turn on the `dockerEnabledForSelfMutation` flag,
> commit and allow the pipeline to self-update *before* adding the actual
> Docker asset.

### Using bundled file assets

If you are using asset bundling anywhere (such as automatically done for you
if you add a construct like `@aws-cdk/aws-lambda-nodejs`), you need to pass
`dockerEnabledForSynth: true` to the pipeline. For example:

```ts
const pipeline = new CodePipeline(this, 'Pipeline', {
  // ...

  // Turn this on because the application uses bundled file assets
  dockerEnabledForSynth: true,
});
```

> **Important**: You must turn on the `dockerEnabledForSynth` flag,
> commit and allow the pipeline to self-update *before* adding the actual
> Docker asset.

### Authenticating to Docker registries

You can specify credentials to use for authenticating to Docker registries as part of the
pipeline definition. This can be useful if any Docker image assets — in the pipeline or
any of the application stages — require authentication, either due to being in a
different environment (e.g., ECR repo) or to avoid throttling (e.g., DockerHub).

```ts
const dockerHubSecret = secretsmanager.Secret.fromSecretCompleteArn(this, 'DHSecret', 'arn:aws:...');
const customRegSecret = secretsmanager.Secret.fromSecretCompleteArn(this, 'CRSecret', 'arn:aws:...');
const repo1 = ecr.Repository.fromRepositoryArn(stack, 'Repo', 'arn:aws:ecr:eu-west-1:0123456789012:repository/Repo1');
const repo2 = ecr.Repository.fromRepositoryArn(stack, 'Repo', 'arn:aws:ecr:eu-west-1:0123456789012:repository/Repo2');

const pipeline = new CodePipeline(this, 'Pipeline', {
  dockerCredentials: [
    DockerCredential.dockerHub(dockerHubSecret),
    DockerCredential.customRegistry('dockerregistry.example.com', customRegSecret),
    DockerCredential.ecr([repo1, repo2]);
  ],
  // ...
});
```

For authenticating to Docker registries that require a username and password combination
(like DockerHub), create a Secrets Manager Secret with fields named `username`
and `secret`, and import it (the field names change be customized).

Authentication to ECR repostories is done using the execution role of the
relevant CodeBuild job. Both types of credentials can be provided with an
optional role to assume before requesting the credentials.

By default, the Docker credentials provided to the pipeline will be available to
the **Synth**, **Self-Update**, and **Asset Publishing** actions within the
*pipeline. The scope of the credentials can be limited via the `DockerCredentialUsage` option.

```ts
const dockerHubSecret = secretsmanager.Secret.fromSecretCompleteArn(this, 'DHSecret', 'arn:aws:...');
// Only the image asset publishing actions will be granted read access to the secret.
const creds = DockerCredential.dockerHub(dockerHubSecret, { usages: [DockerCredentialUsage.ASSET_PUBLISHING] });
```

## CDK Environment Bootstrapping

An *environment* is an *(account, region)* pair where you want to deploy a
CDK stack (see
[Environments](https://docs.aws.amazon.com/cdk/latest/guide/environments.html)
in the CDK Developer Guide). In a Continuous Deployment pipeline, there are
at least two environments involved: the environment where the pipeline is
provisioned, and the environment where you want to deploy the application (or
different stages of the application). These can be the same, though best
practices recommend you isolate your different application stages from each
other in different AWS accounts or regions.

Before you can provision the pipeline, you have to *bootstrap* the environment you want
to create it in. If you are deploying your application to different environments, you
also have to bootstrap those and be sure to add a *trust* relationship.

After you have bootstrapped an environment and created a pipeline that deploys
to it, it's important that you don't delete the stack or change its *Qualifier*,
or future deployments to this environment will fail. If you want to upgrade
the bootstrap stack to a newer version, do that by updating it in-place.

> This library requires a newer version of the bootstrapping stack which has
> been updated specifically to support cross-account continuous delivery. In the future,
> this new bootstrapping stack will become the default, but for now it is still
> opt-in.
>
> The commands below assume you are running `cdk bootstrap` in a directory
> where `cdk.json` contains the `"@aws-cdk/core:newStyleStackSynthesis": true`
> setting in its context, which will switch to the new bootstrapping stack
> automatically.
>
> If run from another directory, be sure to run the bootstrap command with
> the environment variable `CDK_NEW_BOOTSTRAP=1` set.

To bootstrap an environment for provisioning the pipeline:

```console
$ env CDK_NEW_BOOTSTRAP=1 npx cdk bootstrap \
    [--profile admin-profile-1] \
    --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess \
    aws://111111111111/us-east-1
```

To bootstrap a different environment for deploying CDK applications into using
a pipeline in account `111111111111`:

```console
$ env CDK_NEW_BOOTSTRAP=1 npx cdk bootstrap \
    [--profile admin-profile-2] \
    --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess \
    --trust 11111111111 \
    aws://222222222222/us-east-2
```

If you only want to trust an account to do lookups (e.g, when your CDK application has a
`Vpc.fromLookup()` call), use the option `--trust-for-lookup`:

```console
$ env CDK_NEW_BOOTSTRAP=1 npx cdk bootstrap \
    [--profile admin-profile-2] \
    --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess \
    --trust-for-lookup 11111111111 \
    aws://222222222222/us-east-2
```

These command lines explained:

* `npx`: means to use the CDK CLI from the current NPM install. If you are using
  a global install of the CDK CLI, leave this out.
* `--profile`: should indicate a profile with administrator privileges that has
  permissions to provision a pipeline in the indicated account. You can leave this
  flag out if either the AWS default credentials or the `AWS_*` environment
  variables confer these permissions.
* `--cloudformation-execution-policies`: ARN of the managed policy that future CDK
  deployments should execute with. You can tailor this to the needs of your organization
  and give more constrained permissions than `AdministratorAccess`.
* `--trust`: indicates which other account(s) should have permissions to deploy
  CDK applications into this account. In this case we indicate the Pipeline's account,
  but you could also use this for developer accounts (don't do that for production
  application accounts though!).
* `--trust-for-lookup`: similar to `--trust`, but gives a more limited set of permissions to the
  trusted account, allowing it to only look up values, such as availability zones, EC2 images and
  VPCs. Note that if you provide an account using `--trust`, that account can also do lookups.
  So you only need to pass `--trust-for-lookup` if you need to use a different account.
* `aws://222222222222/us-east-2`: the account and region we're bootstrapping.

> **Security tip**: we recommend that you use administrative credentials to an
> account only to bootstrap it and provision the initial pipeline. Otherwise,
> access to administrative credentials should be dropped as soon as possible.

<br>

> **On the use of AdministratorAccess**: The use of the `AdministratorAccess` policy
> ensures that your pipeline can deploy every type of AWS resource to your account.
> Make sure you trust all the code and dependencies that make up your CDK app.
> Check with the appropriate department within your organization to decide on the
> proper policy to use.
>
> If your policy includes permissions to create on attach permission to a role,
> developers can escalate their privilege with more permissive permission.
> Thus, we recommend implementing [permissions boundary](https://aws.amazon.com/premiumsupport/knowledge-center/iam-permission-boundaries/)
> in the CDK Execution role. To do this, you can bootstrap with the `--template` option with
> [a customized template](https://github.com/aws-samples/aws-bootstrap-kit-examples/blob/ba28a97d289128281bc9483bcba12c1793f2c27a/source/1-SDLC-organization/lib/cdk-bootstrap-template.yml#L395) that contains a permission boundary.

### Migrating from old bootstrap stack

The bootstrap stack is a CloudFormation stack in your account named
**CDKToolkit** that provisions a set of resources required for the CDK
to deploy into that environment.

The "new" bootstrap stack (obtained by running `cdk bootstrap` with
`CDK_NEW_BOOTSTRAP=1`) is slightly more elaborate than the "old" stack. It
contains:

* An S3 bucket and ECR repository with predictable names, so that we can reference
  assets in these storage locations *without* the use of CloudFormation template
  parameters.
* A set of roles with permissions to access these asset locations and to execute
  CloudFormation, assumable from whatever accounts you specify under `--trust`.

It is possible and safe to migrate from the old bootstrap stack to the new
bootstrap stack. This will create a new S3 file asset bucket in your account
and orphan the old bucket. You should manually delete the orphaned bucket
after you are sure you have redeployed all CDK applications and there are no
more references to the old asset bucket.

## Security Tips

It's important to stay safe while employing Continuous Delivery. The CDK Pipelines
library comes with secure defaults to the best of our ability, but by its
very nature the library cannot take care of everything.

We therefore expect you to mind the following:

* Maintain dependency hygiene and vet 3rd-party software you use. Any software you
  run on your build machine has the ability to change the infrastructure that gets
  deployed. Be careful with the software you depend on.

* Use dependency locking to prevent accidental upgrades! The default `CdkSynths` that
  come with CDK Pipelines will expect `package-lock.json` and `yarn.lock` to
  ensure your dependencies are the ones you expect.

* Credentials to production environments should be short-lived. After
  bootstrapping and the initial pipeline provisioning, there is no more need for
  developers to have access to any of the account credentials; all further
  changes can be deployed through git. Avoid the chances of credentials leaking
  by not having them in the first place!

## Troubleshooting

Here are some common errors you may encounter while using this library.

### Pipeline: Internal Failure

If you see the following error during deployment of your pipeline:

```plaintext
CREATE_FAILED  | AWS::CodePipeline::Pipeline | Pipeline/Pipeline
Internal Failure
```

There's something wrong with your GitHub access token. It might be missing, or not have the
right permissions to access the repository you're trying to access.

### Key: Policy contains a statement with one or more invalid principals

If you see the following error during deployment of your pipeline:

```plaintext
CREATE_FAILED | AWS::KMS::Key | Pipeline/Pipeline/ArtifactsBucketEncryptionKey
Policy contains a statement with one or more invalid principals.
```

One of the target (account, region) environments has not been bootstrapped
with the new bootstrap stack. Check your target environments and make sure
they are all bootstrapped.

### <Stack> is in ROLLBACK_COMPLETE state and can not be updated

If  you see the following error during execution of your pipeline:

```plaintext
Stack ... is in ROLLBACK_COMPLETE state and can not be updated. (Service:
AmazonCloudFormation; Status Code: 400; Error Code: ValidationError; Request
ID: ...)
```

The stack failed its previous deployment, and is in a non-retryable state.
Go into the CloudFormation console, delete the stack, and retry the deployment.

### Cannot find module 'xxxx' or its corresponding type declarations

You may see this if you are using TypeScript or other NPM-based languages,
when using NPM 7 on your workstation (where you generate `package-lock.json`)
and NPM 6 on the CodeBuild image used for synthesizing.

It looks like NPM 7 has started writing less information to `package-lock.json`,
leading NPM 6 reading that same file to not install all required packages anymore.

Make sure you are using the same NPM version everywhere, either downgrade your
workstation's version or upgrade the CodeBuild version.

### Cannot find module '.../check-node-version.js' (MODULE_NOT_FOUND)

The above error may be produced by `npx` when executing the CDK CLI, or any
project that uses the AWS SDK for JavaScript, without the target application
having been installed yet. For example, it can be triggered by `npx cdk synth`
if `aws-cdk` is not in your `package.json`.

Work around this by either installing the target application using NPM *before*
running `npx`, or set the environment variable `NPM_CONFIG_UNSAFE_PERM=true`.

### Cannot connect to the Docker daemon at unix:///var/run/docker.sock

If, in the 'Synth' action (inside the 'Build' stage) of your pipeline, you get an error like this:

```console
stderr: docker: Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?.
See 'docker run --help'.
```

It means that the AWS CodeBuild project for 'Synth' is not configured to run in privileged mode,
which prevents Docker builds from happening. This typically happens if you use a CDK construct
that bundles asset using tools run via Docker, like `aws-lambda-nodejs`, `aws-lambda-python`,
`aws-lambda-go` and others.

Make sure you set the `privileged` environment variable to `true` in the synth definition:

```typescript
    const pipeline = new CdkPipeline(this, 'MyPipeline', {
      ...

      synthAction: SimpleSynthAction.standardNpmSynth({
        sourceArtifact: ...,
        cloudAssemblyArtifact: ...,

        environment: {
          privileged: true,
        },
      }),
    });
```

After turning on `privilegedMode: true`, you will need to do a one-time manual cdk deploy of your
pipeline to get it going again (as with a broken 'synth' the pipeline will not be able to self
update to the right state).

### S3 error: Access Denied

An "S3 Access Denied" error can have two causes:

* Asset hashes have changed, but self-mutation has been disabled in the pipeline.
* You have deleted and recreated the bootstrap stack, or changed its qualifier.

#### Self-mutation step has been removed

Some constructs, such as EKS clusters, generate nested stacks. When CloudFormation tries
to deploy those stacks, it may fail with this error:

```console
S3 error: Access Denied For more information check http://docs.aws.amazon.com/AmazonS3/latest/API/ErrorResponses.html
```

This happens because the pipeline is not self-mutating and, as a consequence, the `FileAssetX`
build projects get out-of-sync with the generated templates. To fix this, make sure the
`selfMutating` property is set to `true`:

```typescript
const pipeline = new CdkPipeline(this, 'MyPipeline', {
  selfMutating: true,
  ...
});
```

#### Bootstrap roles have been renamed or recreated

While attempting to deploy an application stage, the "Prepare" or "Deploy" stage may fail with a cryptic error like:

`Action execution failed
Access Denied (Service: Amazon S3; Status Code: 403; Error Code: AccessDenied; Request ID: 0123456ABCDEFGH;
S3 Extended Request ID: 3hWcrVkhFGxfiMb/rTJO0Bk7Qn95x5ll4gyHiFsX6Pmk/NT+uX9+Z1moEcfkL7H3cjH7sWZfeD0=; Proxy: null)`

This generally indicates that the roles necessary to deploy have been deleted (or deleted and re-created);
for example, if the bootstrap stack has been deleted and re-created, this scenario will happen. Under the hood,
the resources that rely on these roles (e.g., `cdk-$qualifier-deploy-role-$account-$region`) point to different
canonical IDs than the recreated versions of these roles, which causes the errors. There are no simple solutions
to this issue, and for that reason we **strongly recommend** that bootstrap stacks not be deleted and re-created
once created.

The most automated way to solve the issue is to introduce a secondary bootstrap stack. By changing the qualifier
that the pipeline stack looks for, a change will be detected and the impacted policies and resources will be updated.
A hypothetical recovery workflow would look something like this:

* First, for all impacted environments, create a secondary bootstrap stack:

```sh
$ env CDK_NEW_BOOTSTRAP=1 npx cdk bootstrap \
    --qualifier randchars1234
    --toolkit-stack-name CDKToolkitTemp
    aws://111111111111/us-east-1
```

* Update all impacted stacks in the pipeline to use this new qualifier.
See https://docs.aws.amazon.com/cdk/latest/guide/bootstrapping.html for more info.

```ts
new MyStack(this, 'MyStack', {
  // Update this qualifier to match the one used above.
  synthesizer: new DefaultStackSynthesizer({
    qualifier: 'randchars1234',
  }),
});
```

* Deploy the updated stacks. This will update the stacks to use the roles created in the new bootstrap stack.
* (Optional) Restore back to the original state:
  * Revert the change made in step #2 above
  * Re-deploy the pipeline to use the original qualifier.
  * Delete the temporary bootstrap stack(s)

##### Manual Alternative

Alternatively, the errors can be resolved by finding each impacted resource and policy, and correcting the policies
by replacing the canonical IDs (e.g., `AROAYBRETNYCYV6ZF2R93`) with the appropriate ARNs. As an example, the KMS
encryption key policy for the artifacts bucket may have a statement that looks like the following:

```json
{
  "Effect" : "Allow",
  "Principal" : {
    // "AWS" : "AROAYBRETNYCYV6ZF2R93"  // Indicates this issue; replace this value
    "AWS": "arn:aws:iam::0123456789012:role/cdk-hnb659fds-deploy-role-0123456789012-eu-west-1", // Correct value
  },
  "Action" : [ "kms:Decrypt", "kms:DescribeKey" ],
  "Resource" : "*"
}
```

Any resource or policy that references the qualifier (`hnb659fds` by default) will need to be updated.

## Known Issues

There are some usability issues that are caused by underlying technology, and
cannot be remedied by CDK at this point. They are reproduced here for completeness.

* **Console links to other accounts will not work**: the AWS CodePipeline
  console will assume all links are relative to the current account. You will
  not be able to use the pipeline console to click through to a CloudFormation
  stack in a different account.
* **If a change set failed to apply the pipeline must restarted**: if a change
  set failed to apply, it cannot be retried. The pipeline must be restarted from
  the top by clicking **Release Change**.
* **A stack that failed to create must be deleted manually**: if a stack
  failed to create on the first attempt, you must delete it using the
  CloudFormation console before starting the pipeline again by clicking
  **Release Change**.
