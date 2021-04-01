# AWS CodeBuild Construct Library
<!--BEGIN STABILITY BANNER-->

---

![cfn-resources: Stable](https://img.shields.io/badge/cfn--resources-stable-success.svg?style=for-the-badge)

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->

AWS CodeBuild is a fully managed continuous integration service that compiles
source code, runs tests, and produces software packages that are ready to
deploy. With CodeBuild, you don’t need to provision, manage, and scale your own
build servers. CodeBuild scales continuously and processes multiple builds
concurrently, so your builds are not left waiting in a queue. You can get
started quickly by using prepackaged build environments, or you can create
custom build environments that use your own build tools. With CodeBuild, you are
charged by the minute for the compute resources you use.

## Installation

Install the module:

```console
$ npm i @aws-cdk/aws-codebuild
```

Import it into your code:

```ts
import * as codebuild from '@aws-cdk/aws-codebuild';
```

The `codebuild.Project` construct represents a build project resource. See the
reference documentation for a comprehensive list of initialization properties,
methods and attributes.

## Source

Build projects are usually associated with a _source_, which is specified via
the `source` property which accepts a class that extends the `Source`
abstract base class.
The default is to have no source associated with the build project;
the `buildSpec` option is required in that case.

Here's a CodeBuild project with no source which simply prints `Hello,
CodeBuild!`:

[Minimal Example](./test/integ.defaults.lit.ts)

### `CodeCommitSource`

Use an AWS CodeCommit repository as the source of this build:

```ts
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codecommit from '@aws-cdk/aws-codecommit';

const repository = new codecommit.Repository(this, 'MyRepo', { repositoryName: 'foo' });
new codebuild.Project(this, 'MyFirstCodeCommitProject', {
  source: codebuild.Source.codeCommit({ repository }),
});
```

### `S3Source`

Create a CodeBuild project with an S3 bucket as the source:

```ts
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as s3 from '@aws-cdk/aws-s3';

const bucket = new s3.Bucket(this, 'MyBucket');
new codebuild.Project(this, 'MyProject', {
  source: codebuild.Source.s3({
    bucket,
    path: 'path/to/file.zip',
  }),
});
```

### `GitHubSource` and `GitHubEnterpriseSource`

These source types can be used to build code from a GitHub repository.
Example:

```ts
const gitHubSource = codebuild.Source.gitHub({
  owner: 'awslabs',
  repo: 'aws-cdk',
  webhook: true, // optional, default: true if `webhookFilters` were provided, false otherwise
  webhookTriggersBatchBuild: true, // optional, default is false
  webhookFilters: [
    codebuild.FilterGroup
      .inEventOf(codebuild.EventAction.PUSH)
      .andBranchIs('master')
      .andCommitMessageIs('the commit message'),
  ], // optional, by default all pushes and Pull Requests will trigger a build
});
```

To provide GitHub credentials, please either go to AWS CodeBuild Console to connect
or call `ImportSourceCredentials` to persist your personal access token.
Example:

```console
aws codebuild import-source-credentials --server-type GITHUB --auth-type PERSONAL_ACCESS_TOKEN --token <token_value>
```

### `BitBucketSource`

This source type can be used to build code from a BitBucket repository.

```ts
const bbSource = codebuild.Source.bitBucket({
  owner: 'owner',
  repo: 'repo',
});
```

### For all Git sources

For all Git sources, you can fetch submodules while cloing git repo.

```ts
const gitHubSource = codebuild.Source.gitHub({
  owner: 'awslabs',
  repo: 'aws-cdk',
  fetchSubmodules: true,
});
```

## Artifacts

CodeBuild Projects can produce Artifacts and upload them to S3. For example:

```ts
const project = codebuild.Project(stack, 'MyProject', {
  buildSpec: codebuild.BuildSpec.fromObject({
    version: '0.2',
  }),
  artifacts: codebuild.Artifacts.s3({
      bucket,
      includeBuildId: false,
      packageZip: true,
      path: 'another/path',
      identifier: 'AddArtifact1',
    }),
});
```

If you'd prefer your buildspec to be rendered as YAML in the template,
use the `fromObjectToYaml()` method instead of `fromObject()`.

Because we've not set the `name` property, this example will set the
`overrideArtifactName` parameter, and produce an artifact named as defined in
the Buildspec file, uploaded to an S3 bucket (`bucket`). The path will be
`another/path` and the artifact will be a zipfile.

## CodePipeline

To add a CodeBuild Project as an Action to CodePipeline,
use the `PipelineProject` class instead of `Project`.
It's a simple class that doesn't allow you to specify `sources`,
`secondarySources`, `artifacts` or `secondaryArtifacts`,
as these are handled by setting input and output CodePipeline `Artifact` instances on the Action,
instead of setting them on the Project.

```ts
const project = new codebuild.PipelineProject(this, 'Project', {
  // properties as above...
})
```

For more details, see the readme of the `@aws-cdk/@aws-codepipeline-actions` package.

## Caching

You can save time when your project builds by using a cache. A cache can store reusable pieces of your build environment and use them across multiple builds. Your build project can use one of two types of caching: Amazon S3 or local. In general, S3 caching is a good option for small and intermediate build artifacts that are more expensive to build than to download. Local caching is a good option for large intermediate build artifacts because the cache is immediately available on the build host.

### S3 Caching

With S3 caching, the cache is stored in an S3 bucket which is available from multiple hosts.

```ts
new codebuild.Project(this, 'Project', {
  source: codebuild.Source.bitBucket({
    owner: 'awslabs',
    repo: 'aws-cdk',
  }),
  cache: codebuild.Cache.bucket(new Bucket(this, 'Bucket'))
});
```

### Local Caching

With local caching, the cache is stored on the codebuild instance itself. This is simple,
cheap and fast, but CodeBuild cannot guarantee a reuse of instance and hence cannot
guarantee cache hits. For example, when a build starts and caches files locally, if two subsequent builds start at the same time afterwards only one of those builds would get the cache. Three different cache modes are supported, which can be turned on individually.

* `LocalCacheMode.SOURCE` caches Git metadata for primary and secondary sources.
* `LocalCacheMode.DOCKER_LAYER` caches existing Docker layers.
* `LocalCacheMode.CUSTOM` caches directories you specify in the buildspec file.

```ts
new codebuild.Project(this, 'Project', {
  source: codebuild.Source.gitHubEnterprise({
    httpsCloneUrl: 'https://my-github-enterprise.com/owner/repo',
  }),

  // Enable Docker AND custom caching
  cache: codebuild.Cache.local(LocalCacheMode.DOCKER_LAYER, LocalCacheMode.CUSTOM)
});
```

## Environment

By default, projects use a small instance with an Ubuntu 18.04 image. You
can use the `environment` property to customize the build environment:

* `buildImage` defines the Docker image used. See [Images](#images) below for
  details on how to define build images.
* `computeType` defines the instance type used for the build.
* `privileged` can be set to `true` to allow privileged access.
* `environmentVariables` can be set at this level (and also at the project
  level).

## Images

The CodeBuild library supports both Linux and Windows images via the
`LinuxBuildImage` and `WindowsBuildImage` classes, respectively.

You can specify one of the predefined Windows/Linux images by using one
of the constants such as `WindowsBuildImage.WIN_SERVER_CORE_2019_BASE`,
`WindowsBuildImage.WINDOWS_BASE_2_0` or `LinuxBuildImage.STANDARD_2_0`.

Alternatively, you can specify a custom image using one of the static methods on
`LinuxBuildImage`:

* `LinuxBuildImage.fromDockerRegistry(image[, { secretsManagerCredentials }])` to reference an image in any public or private Docker registry.
* `LinuxBuildImage.fromEcrRepository(repo[, tag])` to reference an image available in an
  ECR repository.
* `LinuxBuildImage.fromAsset(parent, id, props)` to use an image created from a
  local asset.
* `LinuxBuildImage.fromCodeBuildImageId(id)` to reference a pre-defined, CodeBuild-provided Docker image.

or one of the corresponding methods on `WindowsBuildImage`:

* `WindowsBuildImage.fromDockerRegistry(image[, { secretsManagerCredentials }, imageType])`
* `WindowsBuildImage.fromEcrRepository(repo[, tag, imageType])`
* `WindowsBuildImage.fromAsset(parent, id, props, [, imageType])`

Note that the `WindowsBuildImage` version of the static methods accepts an optional parameter of type `WindowsImageType`,
which can be either `WindowsImageType.STANDARD`, the default, or `WindowsImageType.SERVER_2019`:

```ts
new codebuild.Project(this, 'Project', {
  environment: {
    buildImage: codebuild.WindowsBuildImage.fromEcrRepository(ecrRepository, 'v1.0', codebuild.WindowsImageType.SERVER_2019),
  },
  ...
})
```

The following example shows how to define an image from a Docker asset:

[Docker asset example](./test/integ.docker-asset.lit.ts)

The following example shows how to define an image from an ECR repository:

[ECR example](./test/integ.ecr.lit.ts)

The following example shows how to define an image from a private docker registry:

[Docker Registry example](./test/integ.docker-registry.lit.ts)

### GPU images

The class `LinuxGpuBuildImage` contains constants for working with
[AWS Deep Learning Container images](https://aws.amazon.com/releasenotes/available-deep-learning-containers-images):


```ts
new codebuild.Project(this, 'Project', {
  environment: {
    buildImage: codebuild.LinuxGpuBuildImage.DLC_TENSORFLOW_2_1_0_INFERENCE,
  },
  ...
})
```

One complication is that the repositories for the DLC images are in
different accounts in different AWS regions.
In most cases, the CDK will handle providing the correct account for you;
in rare cases (for example, deploying to new regions)
where our information might be out of date,
you can always specify the account
(along with the repository name and tag)
explicitly using the `awsDeepLearningContainersImage` method:

```ts
new codebuild.Project(this, 'Project', {
  environment: {
    buildImage: codebuild.LinuxGpuBuildImage.awsDeepLearningContainersImage(
      'tensorflow-inference', '2.1.0-gpu-py36-cu101-ubuntu18.04', '123456789012'),
  },
  ...
})
```

## Logs

CodeBuild lets you specify an S3 Bucket, CloudWatch Log Group or both to receive logs from your projects.

By default, logs will go to cloudwatch.

### CloudWatch Logs Example

```ts
new codebuild.Project(this, 'Project', {
  logging: {
    cloudWatch: {
      logGroup: new cloudwatch.LogGroup(this, `MyLogGroup`),
    }
  },
  ...
})
```

### S3 Logs Example

```ts
new codebuild.Project(this, 'Project', {
  logging: {
    s3: {
      bucket: new s3.Bucket(this, `LogBucket`)
    }
  },
  ...
})
```

## Credentials

CodeBuild allows you to store credentials used when communicating with various sources,
like GitHub:

```ts
new codebuild.GitHubSourceCredentials(this, 'CodeBuildGitHubCreds', {
  accessToken: cdk.SecretValue.secretsManager('my-token'),
});
// GitHub Enterprise is almost the same,
// except the class is called GitHubEnterpriseSourceCredentials
```

and BitBucket:

```ts
new codebuild.BitBucketSourceCredentials(this, 'CodeBuildBitBucketCreds', {
  username: cdk.SecretValue.secretsManager('my-bitbucket-creds', { jsonField: 'username' }),
  password: cdk.SecretValue.secretsManager('my-bitbucket-creds', { jsonField: 'password' }),
});
```

**Note**: the credentials are global to a given account in a given region -
they are not defined per CodeBuild project.
CodeBuild only allows storing a single credential of a given type
(GitHub, GitHub Enterprise or BitBucket)
in a given account in a given region -
any attempt to save more than one will result in an error.
You can use the [`list-source-credentials` AWS CLI operation](https://docs.aws.amazon.com/cli/latest/reference/codebuild/list-source-credentials.html)
to inspect what credentials are stored in your account.

## Test reports

You can specify a test report in your buildspec:

```ts
const project = new codebuild.Project(this, 'Project', {
  buildSpec: codebuild.BuildSpec.fromObject({
    // ...
    reports: {
      myReport: {
        files: '**/*',
        'base-directory': 'build/test-results',
      },
    },
  }),
});
```

This will create a new test report group,
with the name `<ProjectName>-myReport`.

The project's role in the CDK will always be granted permissions to create and use report groups
with names starting with the project's name;
if you'd rather not have those permissions added,
you can opt out of it when creating the project:

```ts
const project = new codebuild.Project(this, 'Project', {
  // ...
  grantReportGroupPermissions: false,
});
```

Alternatively, you can specify an ARN of an existing resource group,
instead of a simple name, in your buildspec:

```ts
// create a new ReportGroup
const reportGroup = new codebuild.ReportGroup(this, 'ReportGroup');

const project = new codebuild.Project(this, 'Project', {
  buildSpec: codebuild.BuildSpec.fromObject({
    // ...
    reports: {
      [reportGroup.reportGroupArn]: {
        files: '**/*',
        'base-directory': 'build/test-results',
      },
    },
  }),
});
```

If you do that, you need to grant the project's role permissions to write reports to that report group:

```ts
reportGroup.grantWrite(project);
```

For more information on the test reports feature,
see the [AWS CodeBuild documentation](https://docs.aws.amazon.com/codebuild/latest/userguide/test-reporting.html).

## Events

CodeBuild projects can be used either as a source for events or be triggered
by events via an event rule.

### Using Project as an event target

The `@aws-cdk/aws-events-targets.CodeBuildProject` allows using an AWS CodeBuild
project as a AWS CloudWatch event rule target:

```ts
// start build when a commit is pushed
import * as targets from '@aws-cdk/aws-events-targets';

codeCommitRepository.onCommit('OnCommit', {
  target: new targets.CodeBuildProject(project),
});
```

### Using Project as an event source

To define Amazon CloudWatch event rules for build projects, use one of the `onXxx`
methods:

```ts
const rule = project.onStateChange('BuildStateChange', {
  target: new targets.LambdaFunction(fn)
});
```

## Secondary sources and artifacts

CodeBuild Projects can get their sources from multiple places, and produce
multiple outputs. For example:

```ts
const project = new codebuild.Project(this, 'MyProject', {
  secondarySources: [
    codebuild.Source.codeCommit({
      identifier: 'source2',
      repository: repo,
    }),
  ],
  secondaryArtifacts: [
    codebuild.Artifacts.s3({
      identifier: 'artifact2',
      bucket: bucket,
      path: 'some/path',
      name: 'file.zip',
    }),
  ],
  // ...
});
```

Note that the `identifier` property is required for both secondary sources and
artifacts.

The contents of the secondary source is available to the build under the
directory specified by the `CODEBUILD_SRC_DIR_<identifier>` environment variable
(so, `CODEBUILD_SRC_DIR_source2` in the above case).

The secondary artifacts have their own section in the buildspec, under the
regular `artifacts` one. Each secondary artifact has its own section, beginning
with their identifier.

So, a buildspec for the above Project could look something like this:

```ts
const project = new codebuild.Project(this, 'MyProject', {
  // secondary sources and artifacts as above...
  buildSpec: codebuild.BuildSpec.fromObject({
    version: '0.2',
    phases: {
      build: {
        commands: [
          'cd $CODEBUILD_SRC_DIR_source2',
          'touch output2.txt',
        ],
      },
    },
    artifacts: {
      'secondary-artifacts': {
        'artifact2': {
          'base-directory': '$CODEBUILD_SRC_DIR_source2',
          'files': [
            'output2.txt',
          ],
        },
      },
    },
  }),
});
```

### Definition of VPC configuration in CodeBuild Project

Typically, resources in an VPC are not accessible by AWS CodeBuild. To enable
access, you must provide additional VPC-specific configuration information as
part of your CodeBuild project configuration. This includes the VPC ID, the
VPC subnet IDs, and the VPC security group IDs. VPC-enabled builds are then
able to access resources inside your VPC.

For further Information see https://docs.aws.amazon.com/codebuild/latest/userguide/vpc-support.html

**Use Cases**
VPC connectivity from AWS CodeBuild builds makes it possible to:

* Run integration tests from your build against data in an Amazon RDS database that's isolated on a private subnet.
* Query data in an Amazon ElastiCache cluster directly from tests.
* Interact with internal web services hosted on Amazon EC2, Amazon ECS, or services that use internal Elastic Load Balancing.
* Retrieve dependencies from self-hosted, internal artifact repositories, such as PyPI for Python, Maven for Java, and npm for Node.js.
* Access objects in an Amazon S3 bucket configured to allow access through an Amazon VPC endpoint only.
* Query external web services that require fixed IP addresses through the Elastic IP address of the NAT gateway or NAT instance associated with your subnet(s).

Your builds can access any resource that's hosted in your VPC.

**Enable Amazon VPC Access in your CodeBuild Projects**

Pass the VPC when defining your Project, then make sure to
give the CodeBuild's security group the right permissions
to access the resources that it needs by using the
`connections` object.

For example:

```ts
const vpc = new ec2.Vpc(this, 'MyVPC');
const project = new codebuild.Project(this, 'MyProject', {
  vpc: vpc,
  buildSpec: codebuild.BuildSpec.fromObject({
    // ...
  }),
});

project.connections.allowTo(loadBalancer, ec2.Port.tcp(443));
```

## Project File System Location EFS

Add support for CodeBuild to build on AWS EFS file system mounts using
the new ProjectFileSystemLocation.
The `fileSystemLocations` property which accepts a list `ProjectFileSystemLocation`
as represented by the interface `IFileSystemLocations`.
The only supported file system type is `EFS`.

For example:

```ts
new codebuild.Project(stack, 'MyProject', {
  buildSpec: codebuild.BuildSpec.fromObject({
    version: '0.2',
  }),
  fileSystemLocations: [
    codebuild.FileSystemLocation.efs({
      identifier: "myidentifier2",
      location: "myclodation.mydnsroot.com:/loc",
      mountPoint: "/media",
      mountOptions: "opts"
    })
  ]
});
```

Here's a CodeBuild project with a simple example that creates a project mounted on AWS EFS:

[Minimal Example](./test/integ.project-file-system-location.ts)

## Batch builds

To enable batch builds you should call `enableBatchBuilds()` on the project instance.

It returns an object containing the batch service role that was created,
or `undefined` if batch builds could not be enabled, for example if the project was imported.

```ts
import * as codebuild from '@aws-cdk/aws-codebuild';

const project = new codebuild.Project(this, 'MyProject', { ... });

if (project.enableBatchBuilds()) {
  console.log('Batch builds were enabled');
}
```

## Timeouts

There are two types of timeouts that can be set when creating your Project.
The `timeout` property can be used to set an upper limit on how long your Project is able to run without being marked as completed.
The default is 60 minutes.
An example of overriding the default follows.

```ts
import * as codebuild from '@aws-cdk/aws-codebuild';

new codebuild.Project(stack, 'MyProject', {
  timeout: Duration.minutes(90)
});
```

The `queuedTimeout` property can be used to set an upper limit on how your Project remains queued to run.
There is no default value for this property.
As an example, to allow your Project to queue for up to thirty (30) minutes before the build fails,
use the following code.

```ts
import * as codebuild from '@aws-cdk/aws-codebuild';

new codebuild.Project(stack, 'MyProject', {
  queuedTimeout: Duration.minutes(30)
});
```
