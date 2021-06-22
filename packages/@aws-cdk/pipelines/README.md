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

![Developer Preview](https://img.shields.io/badge/developer--preview-informational.svg?style=for-the-badge)

> This module is in **developer preview**. We may make breaking changes to address unforeseen API issues. Therefore, these APIs are not subject to [Semantic Versioning](https://semver.org/), and breaking changes will be announced in release notes. This means that while you may use them, you may need to update your source code when upgrading to a newer version of this package.

## At a glance

Defining a pipeline for your application is as simple as defining a subclass
of `Stage`, and calling `pipeline.addApplicationStage()` with instances of
that class. Deploying to a different account or region looks exactly the
same, the *CDK Pipelines* library takes care of the details.

(Note that have to *bootstrap* all environments before the following code
will work, see the section **CDK Environment Bootstrapping** below).

```ts
/** The stacks for our app are defined in my-stacks.ts.  The internals of these
  * stacks aren't important, except that DatabaseStack exposes an attribute
  * "table" for a database table it defines, and ComputeStack accepts a reference
  * to this table in its properties.
  */
import { DatabaseStack, ComputeStack } from '../lib/my-stacks';

import { Construct, Stage, Stack, StackProps, StageProps } from '@aws-cdk/core';
import { CdkPipeline } from '@aws-cdk/pipelines';
import * as codepipeline from '@aws-cdk/aws-codepipeline';

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

/**
 * Stack to hold the pipeline
 */
class MyPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const sourceArtifact = new codepipeline.Artifact();
    const cloudAssemblyArtifact = new codepipeline.Artifact();

    const pipeline = new CdkPipeline(this, 'Pipeline', {
      // ...source and build information here (see below)
    });

    // Do this as many times as necessary with any account and region
    // Account and region may different from the pipeline's.
    pipeline.addApplicationStage(new MyApplication(this, 'Prod', {
      env: {
        account: '123456789012',
        region: 'eu-west-1',
      }
    }));
  }
}
```

The pipeline is **self-mutating**, which means that if you add new
application stages in the source code, or new stacks to `MyApplication`, the
pipeline will automatically reconfigure itself to deploy those new stages and
stacks.

## CDK Versioning

This library uses prerelease features of the CDK framework, which can be enabled by adding the
following to `cdk.json`:

```js
{
  // ...
  "context": {
    "@aws-cdk/core:newStyleStackSynthesis": true
  }
}
```

## A note on cost

By default, the `CdkPipeline` construct creates an AWS Key Management Service
(AWS KMS) Customer Master Key (CMK) for you to encrypt the artifacts in the
artifact bucket, which incurs a cost of
**$1/month**. This default configuration is necessary to allow cross-account
deployments.

If you do not intend to perform cross-account deployments, you can disable
the creation of the Customer Master Keys by passing `crossAccountKeys: false`
when defining the Pipeline:

```ts
const pipeline = new pipelines.CdkPipeline(this, 'Pipeline', {
  crossAccountKeys: false,

  // ...
});
```

## Defining the Pipeline (Source and Synth)

The pipeline is defined by instantiating `CdkPipeline` in a Stack. This defines the
source location for the pipeline as well as the build commands. For example, the following
defines a pipeline whose source is stored in a GitHub repository, and uses NPM
to build. The Pipeline will be provisioned in account `111111111111` and region
`eu-west-1`:

```ts
class MyPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const sourceArtifact = new codepipeline.Artifact();
    const cloudAssemblyArtifact = new codepipeline.Artifact();

    const pipeline = new CdkPipeline(this, 'Pipeline', {
      pipelineName: 'MyAppPipeline',
      cloudAssemblyArtifact,

      sourceAction: new codepipeline_actions.GitHubSourceAction({
        actionName: 'GitHub',
        output: sourceArtifact,
        oauthToken: SecretValue.secretsManager('GITHUB_TOKEN_NAME'),
        // Replace these with your actual GitHub project name
        owner: 'OWNER',
        repo: 'REPO',
        branch: 'main', // default: 'master'
      }),

      synthAction: SimpleSynthAction.standardNpmSynth({
        sourceArtifact,
        cloudAssemblyArtifact,

        // Optionally specify a VPC in which the action runs
        vpc: new ec2.Vpc(this, 'NpmSynthVpc'),

        // Use this if you need a build step (if you're not using ts-node
        // or if you have TypeScript Lambdas that need to be compiled).
        buildCommand: 'npm run build',
      }),
    });
  }
}

const app = new App();
new MyPipelineStack(app, 'PipelineStack', {
  env: {
    account: '111111111111',
    region: 'eu-west-1',
  }
});
```

If you prefer more control over the underlying CodePipeline object, you can
create one yourself, including custom Source and Build stages:

```ts
const codePipeline = new cp.Pipeline(pipelineStack, 'CodePipeline', {
  stages: [
    {
      stageName: 'CustomSource',
      actions: [...],
    },
    {
      stageName: 'CustomBuild',
      actions: [...],
    },
  ],
});

const app = new App();
const cdkPipeline = new CdkPipeline(app, 'CdkPipeline', {
  codePipeline,
  cloudAssemblyArtifact,
});
```

If you use assets for files or Docker images, every asset will get its own upload action during the asset stage. 
By setting the value `singlePublisherPerType` to `true`, only one action for files and one action for 
Docker images is created that handles all assets of the respective type.

If you need to run commands to setup proxies, mirrors, etc you can supply them using the `assetPreInstallCommands`.

## Initial pipeline deployment

You provision this pipeline by making sure the target environment has been
bootstrapped (see below), and then executing deploying the `PipelineStack`
*once*. Afterwards, the pipeline will keep itself up-to-date.

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

### Sources

Any of the regular sources from the [`@aws-cdk/aws-codepipeline-actions`](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-codepipeline-actions-readme.html#github) module can be used.

### Synths

You define how to build and synth the project by specifying a `synthAction`.
This can be any CodePipeline action that produces an artifact with a CDK
Cloud Assembly in it (the contents of the `cdk.out` directory created when
`cdk synth` is called). Pass the output artifact of the synth in the
Pipeline's `cloudAssemblyArtifact` property.

`SimpleSynthAction` is available for synths that can be performed by running a couple
of simple shell commands (install, build, and synth) using AWS CodeBuild. When
using these, the source repository does not need to have a `buildspec.yml`. An example
of using `SimpleSynthAction` to run a Maven build followed by a CDK synth:

```ts
const pipeline = new CdkPipeline(this, 'Pipeline', {
  // ...
  synthAction: new SimpleSynthAction({
    sourceArtifact,
    cloudAssemblyArtifact,
    installCommands: ['npm install -g aws-cdk'],
    buildCommands: ['mvn package'],
    synthCommand: 'cdk synth',
  })
});
```

Available as factory functions on `SimpleSynthAction` are some common
convention-based synth:

* `SimpleSynthAction.standardNpmSynth()`: build using NPM conventions. Expects a `package-lock.json`,
  a `cdk.json`, and expects the CLI to be a versioned dependency in `package.json`. Does
  not perform a build step by default.
* `CdkSynth.standardYarnSynth()`: build using Yarn conventions. Expects a `yarn.lock`
  a `cdk.json`, and expects the CLI to be a versioned dependency in `package.json`. Does
  not perform a build step by default.

If you need a custom build/synth step that is not covered by `SimpleSynthAction`, you can
always add a custom CodeBuild project and pass a corresponding `CodeBuildAction` to the
pipeline.

## Adding Application Stages

To define an application that can be added to the pipeline integrally, define a subclass
of `Stage`. The `Stage` can contain one or more stack which make up your application. If
there are dependencies between the stacks, the stacks will automatically be added to the
pipeline in the right order. Stacks that don't depend on each other will be deployed in
parallel. You can add a dependency relationship between stacks by calling
`stack1.addDependency(stack2)`.

Stages take a default `env` argument which the Stacks inside the Stage will fall back to
if no `env` is defined for them.

An application is added to the pipeline by calling `addApplicationStage()` with instances
of the Stage. The same class can be instantiated and added to the pipeline multiple times
to define different stages of your DTAP or multi-region application pipeline:

```ts
// Testing stage
pipeline.addApplicationStage(new MyApplication(this, 'Testing', {
  env: { account: '111111111111', region: 'eu-west-1' }
}));

// Acceptance stage
pipeline.addApplicationStage(new MyApplication(this, 'Acceptance', {
  env: { account: '222222222222', region: 'eu-west-1' }
}));

// Production stage
pipeline.addApplicationStage(new MyApplication(this, 'Production', {
  env: { account: '333333333333', region: 'eu-west-1' }
}));
```

> Be aware that adding new stages via `addApplicationStage()` will
> automatically add them to the pipeline and deploy the new stacks, but
> *removing* them from the pipeline or deleting the pipeline stack will not
> automatically delete deployed application stacks. You must delete those
> stacks by hand using the AWS CloudFormation console or the AWS CLI.

### More Control

Every *Application Stage* added by `addApplicationStage()` will lead to the addition of
an individual *Pipeline Stage*, which is subsequently returned. You can add more
actions to the stage by calling `addAction()` on it. For example:

```ts
const testingStage = pipeline.addApplicationStage(new MyApplication(this, 'Testing', {
  env: { account: '111111111111', region: 'eu-west-1' }
}));

// Add a action -- in this case, a Manual Approval action
// (for illustration purposes: testingStage.addManualApprovalAction() is a
// convenience shorthand that does the same)
testingStage.addAction(new ManualApprovalAction({
  actionName: 'ManualApproval',
  runOrder: testingStage.nextSequentialRunOrder(),
}));
```

You can also add more than one *Application Stage* to one *Pipeline Stage*. For example:

```ts
// Create an empty pipeline stage
const testingStage = pipeline.addStage('Testing');

// Add two application stages to the same pipeline stage
testingStage.addApplication(new MyApplication1(this, 'MyApp1', {
  env: { account: '111111111111', region: 'eu-west-1' }
}));
testingStage.addApplication(new MyApplication2(this, 'MyApp2', {
  env: { account: '111111111111', region: 'eu-west-1' }
}));
```

Even more, adding a manual approval action or reserving space for some extra sequential actions
between 'Prepare' and 'Execute' ChangeSet actions is possible.

```ts
  pipeline.addApplicationStage(new MyApplication(this, 'Production'), {
    manualApprovals: true,
    extraRunOrderSpace: 1,
  });
```

## Adding validations to the pipeline

You can add any type of CodePipeline Action to the pipeline in order to validate
the deployments you are performing.

The CDK Pipelines construct library comes with a `ShellScriptAction` which uses AWS CodeBuild
to run a set of shell commands (potentially running a test set that comes with your application,
using stack outputs of the deployed stacks).

In its simplest form, adding validation actions looks like this:

```ts
const stage = pipeline.addApplicationStage(new MyApplication(/* ... */));

stage.addActions(new ShellScriptAction({
  actionName: 'MyValidation',
  commands: ['curl -Ssf https://my.webservice.com/'],
  // Optionally specify a VPC if, for example, the service is deployed with a private load balancer
  vpc,
  // Optionally specify SecurityGroups
  securityGroups,
  // Optionally specify a BuildEnvironment
  environment,
}));
```

### Using CloudFormation Stack Outputs in ShellScriptAction

Because many CloudFormation deployments result in the generation of resources with unpredictable
names, validations have support for reading back CloudFormation Outputs after a deployment. This
makes it possible to pass (for example) the generated URL of a load balancer to the test set.

To use Stack Outputs, expose the `CfnOutput` object you're interested in, and
call `pipeline.stackOutput()` on it:

```ts
class MyLbApplication extends Stage {
  public readonly loadBalancerAddress: CfnOutput;

  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    const lbStack = new LoadBalancerStack(this, 'Stack');

    // Or create this in `LoadBalancerStack` directly
    this.loadBalancerAddress = new CfnOutput(lbStack, 'LbAddress', {
      value: `https://${lbStack.loadBalancer.loadBalancerDnsName}/`
    });
  }
}

const lbApp = new MyLbApplication(this, 'MyApp', {
  env: { /* ... */ }
});
const stage = pipeline.addApplicationStage(lbApp);
stage.addActions(new ShellScriptAction({
  // ...
  useOutputs: {
    // When the test is executed, this will make $URL contain the
    // load balancer address.
    URL: pipeline.stackOutput(lbApp.loadBalancerAddress),
  }
});
```

### Using additional files in Shell Script Actions

As part of a validation, you probably want to run a test suite that's more
elaborate than what can be expressed in a couple of lines of shell script.
You can bring additional files into the shell script validation by supplying
the `additionalArtifacts` property.

Here are some typical examples for how you might want to bring in additional
files from several sources:

* Directory from the source repository
* Additional compiled artifacts from the synth step

### Controlling IAM permissions

IAM permissions can be added to the execution role of a `ShellScriptAction` in
two ways.

Either pass additional policy statements in the `rolePolicyStatements` property:

```ts
new ShellScriptAction({
  // ...
  rolePolicyStatements: [
    new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: ['*'],
    }),
  ],
}));
```

The Action can also be used as a Grantable after having been added to a Pipeline:

```ts
const action = new ShellScriptAction({ /* ... */ });
pipeline.addStage('Test').addActions(action);

bucket.grantRead(action);
```

#### Additional files from the source repository

Bringing in additional files from the source repository is appropriate if the
files in the source repository are directly usable in the test (for example,
if they are executable shell scripts themselves). Pass the `sourceArtifact`:

```ts
const sourceArtifact = new codepipeline.Artifact();

const pipeline = new CdkPipeline(this, 'Pipeline', {
  // ...
});

const validationAction = new ShellScriptAction({
  actionName: 'TestUsingSourceArtifact',
  additionalArtifacts: [sourceArtifact],

  // 'test.sh' comes from the source repository
  commands: ['./test.sh'],
});
```

#### Additional files from the synth step

Getting the additional files from the synth step is appropriate if your
tests need the compilation step that is done as part of synthesis.

On the synthesis step, specify `additionalArtifacts` to package
additional subdirectories into artifacts, and use the same artifact
in the `ShellScriptAction`'s `additionalArtifacts`:

```ts
// If you are using additional output artifacts from the synth step,
// they must be named.
const cloudAssemblyArtifact = new codepipeline.Artifact('CloudAsm');
const integTestsArtifact = new codepipeline.Artifact('IntegTests');

const pipeline = new CdkPipeline(this, 'Pipeline', {
  synthAction: SimpleSynthAction.standardNpmSynth({
    sourceArtifact,
    cloudAssemblyArtifact,
    buildCommands: ['npm run build'],
    additionalArtifacts: [
      {
        directory: 'test',
        artifact: integTestsArtifact,
      }
    ],
  }),
  // ...
});

const validationAction = new ShellScriptAction({
  actionName: 'TestUsingBuildArtifact',
  additionalArtifacts: [integTestsArtifact],
  // 'test.js' was produced from 'test/test.ts' during the synth step
  commands: ['node ./test.js'],
});
```

#### Add Additional permissions to the CodeBuild Project Role for building and synthesizing

You can customize the role permissions used by the CodeBuild project so it has access to
the needed resources. eg: Adding CodeArtifact repo permissions so we pull npm packages
from the CA repo instead of NPM.

```ts
class MyPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    ...
    const pipeline = new CdkPipeline(this, 'Pipeline', {
      ...
      synthAction: SimpleSynthAction.standardNpmSynth({
        sourceArtifact,
        cloudAssemblyArtifact,

        // Use this to customize and a permissions required for the build
        // and synth
        rolePolicyStatements: [
          new PolicyStatement({
            actions: ['codeartifact:*', 'sts:GetServiceBearerToken'],
            resources: ['arn:codeartifact:repo:arn'],
          }),
        ],

        // Then you can login to codeartifact repository
        // and npm will now pull packages from your repository
        // Note the codeartifact login command requires more params to work.
        buildCommands: [
          'aws codeartifact login --tool npm',
          'npm run build',
        ],
      }),
    });
  }
}
```

### Developing the pipeline

The self-mutation feature of the `CdkPipeline` might at times get in the way
of the pipeline development workflow. Each change to the pipeline must be pushed
to git, otherwise, after the pipeline was updated using `cdk deploy`, it will
automatically revert to the state found in git.

To make the development more convenient, the self-mutation feature can be turned
off temporarily, by passing `selfMutating: false` property, example:

```ts
const pipeline = new CdkPipeline(this, 'Pipeline', {
  selfMutating: false,
  ...
});
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

## Current Limitations

Limitations that we are aware of and will address:

* **No context queries**: context queries are not supported. That means that
  Vpc.fromLookup() and other functions like it will not work [#8905](https://github.com/aws/aws-cdk/issues/8905).

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
