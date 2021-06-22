# Contributing to the AWS Cloud Development Kit

Thanks for your interest in contributing to the AWS CDK! ❤️

We highly value contributions, with roughly half of all commits to the CDK
coming from the community. We want to recognize all your hard work
by getting your code merged as quickly as we can, so please read the guidance
here carefully to make sure the review process goes smoothly.

This document describes how to set up a development environment and submit your changes. Please 
let us know if it's not up-to-date (even better, submit a PR with your  corrections ;-)).

- [Getting Started](#getting-started)
- [Pull Requests](#pull-requests)
  - [Step 1: Find something to work on](#step-1-find-something-to-work-on)
  - [Step 2: Design (optional)](#step-2-design-optional)
  - [Step 3: Work your Magic](#step-3-work-your-magic)
  - [Step 4: Pull Request](#step-5-pull-request)
  - [Step 5: Merge](#step-5-merge)
- [Breaking Changes](#breaking-changes)
- [Documentation](#documentation)
  - [rosetta](#rosetta)
- [Tools](#tools)
  - [Linters](#linters)
  - [cfn2ts](#cfn2ts)
  - [scripts/foreach.sh](#scriptsforeachsh)
  - [Jetbrains support (WebStorm/IntelliJ)](#jetbrains-support-webstormintellij)
  - [Linking against this repository](#linking-against-this-repository)
  - [Running integration tests in parallel](#running-integration-tests-in-parallel)
  - [Visualizing dependencies in a CloudFormation Template](#visualizing-dependencies-in-a-cloudformation-template)
  - [Find dependency cycles between packages](#find-dependency-cycles-between-packages)
- [Running CLI integration tests](#running-cli-integration-tests)
- [Changing the Cloud Assembly Schema](#changing-cloud-assembly-schema)
- [Feature Flags](#feature-flags)
- [Versioning and Release](#versioning-and-release)
- [Troubleshooting](#troubleshooting)
- [Debugging](#debugging)
  - [Connecting the VS Code Debugger](#connecting-the-vs-code-debugger)
  - [Run a CDK unit test in the debugger](#run-a-cdk-unit-test-in-the-debugger)
- [Related Repositories](#related-repositories)

## Getting Started

The following steps describe how to set up the AWS CDK repository on your local machine.
The alternative is to use [Gitpod](https://www.gitpod.io/), a Cloud IDE for your development.
See [Gitpod section](#gitpod) on how to set up the CDK repo on Gitpod.

### Setup

The following tools need to be installed on your system prior to installing the CDK:

- [Node.js >= 10.13.0](https://nodejs.org/download/release/latest-v10.x/)
  - We recommend using a version in [Active LTS](https://nodejs.org/en/about/releases/)
  - ⚠️ versions `13.0.0` to `13.6.0` are not supported due to compatibility issues with our dependencies.
- [Yarn >= 1.19.1, < 2](https://yarnpkg.com/lang/en/docs/install)
- [.NET Core SDK 3.1.x](https://www.microsoft.com/net/download)
- [Python >= 3.6.5, < 4.0](https://www.python.org/downloads/release/python-365/)
- [Docker >= 19.03](https://docs.docker.com/get-docker/)
  - the Docker daemon must also be running

First fork the repository, and then run the following commands to clone the repository locally.

```console
$ git clone https://github.com/{your-account}/aws-cdk.git
$ cd aws-cdk
$ yarn install
```

We recommend that you use [Visual Studio Code](https://code.visualstudio.com/) to work on the CDK.
We use `eslint` to keep our code consistent in terms of style and reducing defects. We recommend installing the
the [eslint extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) as well.

### Repo Layout

The AWS CDK is a [NPM](https://www.npmjs.com/about) project written in [typescript](https://www.typescriptlang.org/).
More specifically, it is a [monorepo managed using lerna](https://github.com/lerna/lerna#about).
If you're unfamiliar with any of these technologies, it is useful to learn about them and will make understanding the
AWS CDK codebase easier but strictly not necessary for simple contributions.

The CDK uses [jsii](https://github.com/aws/jsii/) as its primary build system. jsii enables us to write
typescript-compliant source code and produce polyglot libraries, such as, in Java, .NET, Python and Go.

The repo contains `packages/` directory that contains the CDK public modules. The source code for the IAM module in the
CDK can be found at the location `packages/@aws-cdk/aws-iam`.
The repo also contains the `tools/` directory that holds custom build tooling (modeled as private npm packages)
specific to the CDK.

### Build

The full build of the CDK takes a long time complete; 1-2 hours depending on the performance of the build machine.
However, most first time contributions will require changing only one CDK module, sometimes two. A full build of the
CDK is not required in these cases.

If you want to work on the `@aws-cdk/aws-ec2` module, the following command will build just the EC2 module and any
necessary dependencies.

```console
$ cd packages/@aws-cdk/aws-ec2
$ ../../../scripts/buildup
```

Note: The `buildup` command is resumable. If your build fails, you can fix the issue and run `buildup --resume` to
resume.

At this point, you can run build and test the `aws-ec2` module by running

```console
$ cd packages/@aws-cdk/aws-ec2
$ yarn build
$ yarn test
```

However, if you wish to build the the entire repository, the following command will achieve this.

```console
cd <root of the CDK repo>
scripts/foreach.sh yarn build
```
Note: The `foreach` command is resumable by default; you must supply `-r` or `--reset` to start a new session.

You are now ready to start contributing to the CDK. See the [Pull Requests](#pull-requests) section on how to make your
changes and submit it as a pull request.

### Pack

As called out in the above sections, the AWS CDK uses jsii to produce polyglot targets. This means that each CDK module
produces artifact in all of its target languages.

Packing involves generating CDK code in the various target languages and packaging them up to be published to their
respective package managers. Once in a while, these will need to be generated either to test the experience of a new
feature, or reproduce a packaging failure.

To package a specific module, say the `@aws-cdk/aws-ec2` module:

```console
$ cd <root-of-cdk-repo>
$ docker run --rm --net=host -it -v $PWD:$PWD -w $PWD jsii/superchain
docker$ cd packages/@aws-cdk/aws-ec2
docker$ ../../../scripts/foreach.sh --up yarn run package
docker$ exit
```

The `dist/` folder within each module contains the packaged up language artifacts.

## Docker Build (Alternative)

Build the docker image:

```console
$ docker build -t aws-cdk .
```

This allows you to run the CDK in a CDK-compatible directory with a command like:

```console
$ docker run -v $(pwd):/app -w /app aws-cdk <CDK ARGS>
```

## Gitpod (Alternative)

You may also set up your local development environment using [Gitpod](http://gitpod.io) -
a service that allows you to spin up an in-browser Visual Studio Code-compatible editor,
with everything set up and ready to go for CDK development.
Just click the button below to create your private workspace:

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/aws/aws-cdk)

This will start a new Gitpod workspace, with the CDK repository [pre-built](https://www.gitpod.io/docs/prebuilds/).
You can now work on your CDK repository, as described in the [Getting Started](#getting-started) section.

Gitpod is free for 50 hours per month - make sure to stop your workspace when you're done
(you can always resume it later, and it won't need to run the build again).

For Gitpod users only! The best way to supply CDK with your AWS credentials is to add them as
[persisting environment variables](https://www.gitpod.io/docs/environment-variables).
Adding them works as follows via terminal:

```shell
eval $(gp env -e AWS_ACCESS_KEY_ID=XXXXXXXXX)
eval $(gp env -e AWS_SECRET_ACCESS_KEY=YYYYYYY)
eval $(gp env -e AWS_DEFAULT_REGION=ZZZZZZZZ)
eval $(gp env -e)
```

## Pull Requests

### Step 1: Find something to work on

If you want to contribute a specific feature or fix you have in mind, look at active [pull
requests](https://github.com/aws/aws-cdk/pulls) to see if someone else is already working on it. If not, you can start
contributing your changes.

On the other hand, if you are here looking for an issue to work on, explore our [backlog of
issues](https://github.com/aws/aws-cdk/issues) and find something that piques your interest. We have labeled all of our
issues for easy searching.
If you are looking for your first contribution, the ['good first issue'
label](https://github.com/aws/aws-cdk/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) will be of help.

It's a good idea to keep the priority of issues in mind when deciding what to
work on. If we have labelled an issue as `P2`, it means it's something we won't
get to soon, and we're waiting on more feedback from the community (in the form
of +1s and comments) to give it a higher priority. A PR for a `P2` issue may
take us some time to review, especially if it involves a complex
implementation. `P1` issues impact a significant number of customers, so we are
much more likely to give a PR for those issues prompt attention.

### Step 2: Design

In some cases, it is useful to seek feedback by iterating on a design document. This is useful
when you plan a big change or feature, or you want advice on what would be the best path forward.

In many cases, the GitHub issue is sufficient for such discussions, and can be
sufficient to get clarity on what you plan to do. If the changes are
significant or intrusive to the existing CDK experience, and especially for a
brand new L2 construct implementation, please write an RFC in our [RFC
repository](https://github.com/aws/aws-cdk-rfcs) before jumping into the code
base.

### Step 3: Work your Magic

Work your magic. Here are some guidelines:

* Coding style.
  * If your change introduces a new construct, take a look at our [design guidelines](./docs/DESIGN_GUIDELINES.md) for
    construct libraries.
    We also have an [example construct library](packages/@aws-cdk/example-construct-library) that showcases a simple
    construct library with a single construct.
  * We have a number of linters that run during standard build that will enforce coding consistency and correctness.
    Watch out for their error messages and adjust your code accordingly.
* Every change requires a unit test
* If you change APIs, make sure to update the module's README file
* Try to maintain a single feature/bugfix per pull request. It's okay to introduce a little bit of housekeeping
  changes along the way, but try to avoid conflating multiple features. Eventually, all these are going to go into a
  single commit, so you can use that to frame your scope.

#### Integration Tests

Integration tests perform a few functions in the CDK code base -
1. Acts as a regression detector. It does this by running `cdk synth` on the integration test and comparing it against
   the `*.expected.json` file. This highlights how a change affects the synthesized stacks.
2. Allows for a way to verify if the stacks are still valid CloudFormation templates, as part of an intrusive change.
   This is done by running `yarn integ` which will run `cdk deploy` across all of the integration tests in that package. If you are developing a new integration test or for some other reason want to work on a single integration test over and over again without running through all the integration tests you can do so using `yarn integ integ.test-name.js`
   Remember to set up AWS credentials before doing this.
3. (Optionally) Acts as a way to validate that constructs set up the CloudFormation resources as expected. A successful
   CloudFormation deployment does not mean that the resources are set up correctly.

If you are working on a new feature that is using previously unused CloudFormation resource types, or involves
configuring resource types across services, you need to write integration tests that use these resource types or
features.

To the extent possible, include a section (like below) in the integration test file that specifies how the successfully
deployed stack can be verified for correctness. Correctness here implies that the resources have been set up correctly.
The steps here are usually AWS CLI commands but they need not be.

```ts
/*
 * Stack verification steps:
 * * <step-1>
 * * <step-2>
 */
```

Examples:
* [integ.destinations.ts](https://github.com/aws/aws-cdk/blob/master/packages/%40aws-cdk/aws-lambda-destinations/test/integ.destinations.ts#L7)
* [integ.token-authorizer.ts](https://github.com/aws/aws-cdk/blob/master/packages/%40aws-cdk/aws-apigateway/test/authorizers/integ.token-authorizer.ts#L6)

#### yarn watch (Optional)

We've added a watch feature to the CDK that builds your code as you type it. Start this by running `yarn watch` for
each module that you are modifying.

For example, watch the EC2 and IAM modules in a second terminal session:

```console
$ cd packages/@aws-cdk/aws-ec2
$ yarn watch & # runs in the background
$ cd packages/@aws-cdk/aws-iam
$ yarn watch & # runs in the background
```

### Step 4: Pull Request

* Create a commit with your changes and push them to a
  [fork](https://docs.github.com/en/get-started/quickstart/fork-a-repo).
  > Note: CDK core members can push to a branch on the AWS CDK repo (naming convention: `<user>/<feature-bug-name>`).

* Create a [pull request on
  Github](https://docs.github.com/en/github/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request-from-a-fork).

* Pull request title and message (and PR title and description) must adhere to
  [conventionalcommits](https://www.conventionalcommits.org).
  * The title must begin with `feat(module): title`, `fix(module): title`, `refactor(module): title` or
    `chore(module): title`.
  * Title should be lowercase.
  * No period at the end of the title.

* Pull request message should describe _motivation_. Think about your code reviewers and what information they need in
  order to understand what you did. If it's a big commit (hopefully not), try to provide some good entry points so
  it will be easier to follow.

* Pull request message should indicate which issues are fixed: `fixes #<issue>` or `closes #<issue>`.

* Shout out to collaborators.

* If not obvious (i.e. from unit tests), describe how you verified that your change works.

* If this PR includes breaking changes, they must be listed at the end in the following format
  (notice how multiple breaking changes should be formatted):

  ```
  BREAKING CHANGE: Description of what broke and how to achieve this behavior now
  * **module-name:** Another breaking change
  * **module-name:** Yet another breaking change
  ```

* Once the pull request is submitted, a reviewer will be assigned by the maintainers.

* Discuss review comments and iterate until you get at least one "Approve". When iterating, push new commits to the
  same branch. Usually all these are going to be squashed when you merge to master. The commit messages should be hints
  for you when you finalize your merge commit message.

* Make sure to update the PR title/description if things change. The PR title/description are going to be used as the
  commit title/message and will appear in the CHANGELOG, so maintain them all the way throughout the process.

### Step 5: Merge

* Make sure your PR builds successfully (we have CodeBuild setup to automatically build all PRs).
* Once approved and tested, one of our bots will squash-merge to master and will use your PR title/description as the
  commit message.

## Breaking Changes

_NOTE: Breaking changes will not be allowed in the upcoming v2 release. These instructions apply to v1._

Whenever you are making changes, there is a chance for those changes to be
*breaking* existing users of the library. A change is breaking if there are
programs that customers could have been writing against the current version
of the CDK, that will no longer "work correctly" with the proposed new
version of the CDK.

Breaking changes are not allowed in *stable* libraries. They are permitted
in experimental libraries, unless the maintainer of the module decides that it should be avoided.
Breaking changes require explicit callouts in the bodies of Pull Requests that introduce them.

Breaking changes come in two flavors:

* API surface changes
* Behavior changes

### API surface changes

This encompasses any changes that affect the shape of the API. Changes that
will make existing programs fail to compile are not allowed. Typical examples
of that are:

* Renaming classes or methods
* Adding required properties to a struct that is used as an input to a constructor
  or method. This also includes changing a type from nullable to non-nullable.
* Removing properties from a struct that is returned from a method, or removing
  properties from a class. This also includes changing a type from non-nullable
  to nullable.

To see why the latter is a problem, consider the following class:

```ts
class SomeClass {
  public readonly count: number;
  //               ❓ let's say I want to change this to 'count?: number',
  //                  i.e. make it optional.
}

// Someone could have written the following code:
const obj = new SomeClass();
console.log(obj.count + 1);

// After the proposed change, this code that used to compile fine will now throw:
console.log(obj.count + 1);
//          ~~~~~~~~~ Error: Object is possibly 'undefined'.
```

CDK comes with build tooling to check whether changes you made introduce breaking
changes to the API surface. In a package directory, run:

```shell
$ yarn build
$ yarn compat
```

The only case where it is legitimate to break a public API is if the existing
API is a bug that blocked the usage of a feature. This means that by breaking
this API we will not break anyone, because they weren't able to use it. The file
`allowed-breaking-changes.txt` in the root of the repo is an exclusion file that
can be used in these cases.

#### Dealing with breaking API surface changes

If you need to change the type of some API element, introduce a new API
element and mark the old API element as `@deprecated`.

If you need to pretend to have a value for the purposes of implementing an API
and you don't actually have a useful value to return, it is acceptable to make
the property a `getter` and throw an exception (keeping in mind to write error
messages that will be useful to a user of your construct):

```ts
class SomeClass implements ICountable {
  constructor(private readonly _count?: number) {
  }

  public get count(): number {
    if (this._count === undefined) {
      // ✅ DO: throw a descriptive error that tells the user what to do
      throw new Error('This operation requires that a \'count\' is specified when SomeClass is created.');
      // ❌ DO NOT: just throw an error like 'count is missing'
    }
    return this._count;
  }
}
```

### Behavior changes

These are changes that do not directly affect the compilation of programs
written against the previous API, but may change their meaning. In practice,
even though the user didn't change their code, the CloudFormation template
that gets synthesized is now different.

**Not all template changes are breaking changes!** Consider a user that has
created a Stack using the previous version of the library, has updated their
version of the CDK library and is now deploying an update. A behavior change
is breaking if:

* The update cannot be applied at all
* The update can be applied but causes service interruption or data loss.

Data loss happens when the [Logical
ID](https://docs.aws.amazon.com/cdk/latest/guide/identifiers.html#identifiers_logical_ids)
of a stateful resource changes, or one of the [resource properties that requires
replacement](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-updating-stacks-update-behaviors.html)
is modified. In both of these cases, CloudFormation will delete the
resource, and if it was a stateful resource like a database the data in it is now gone.

If a change applies cleanly and does not cause any service interruption, it
is not breaking. Nevertheless, it might still be wise to avoid those kinds of
changes as users are understandably wary of unexpected template changes, will
scrutinize them heavily, and we don't want to cause unnecessary panic and churn
in our use base.

Determining whether or not behavioral changes are breaking requires expertise
and judgement on the part of the library owner, and testing.

#### Dealing with breaking behavior changes

Most of the time, behavioral changes will arise because we want to change the
default value or default behavior of some property (i.e., we want to change the
interpretation of what it means if the value is missing).

If the new behavior is going to be breaking, the user must opt in to it, either by:

* Adding a new API element (class, property, method, ...) to have users
  explicitly opt in to the new behavior at the source code level (potentially
  `@deprecate`ing the old API element); or
* Use the [feature flag](#feature-flags) mechanism to have the user opt in to the new
  behavior without changing the source code.

Of these two, the first one is preferred if possible (as feature flags have
non-local effects which can cause unintended effects).

## Documentation

Every module's README is rendered as the landing page of the official documentation. For example, this is
the README for the `aws-ec2` module - https://docs.aws.amazon.com/cdk/api/latest/docs/aws-ec2-readme.html.

### Rosetta

The README file contains code snippets written as typescript code.  Code snippets typed in fenced code blocks
(such as `` ```ts ``) will be automatically extracted, compiled and translated to other languages when the
during the [pack](#pack) step. We call this feature 'rosetta'.

You can run rosetta on the EC2 module (or any other module) by running:

```console
$ cd packages/@aws-cdk/aws-ec2
$ yarn rosetta:extract --strict
```

To successfully do that, they must be compilable. The easiest way to do that is using
a *fixture*, which looks like this:

````
```ts fixture=with-bucket
bucket.addLifecycleTransition({ ...props });
```
````

While processing the examples, the tool will look for a file called
`rosetta/with-bucket.ts-fixture` in the package directory. This file will be
treated as a regular TypeScript source file, but it must also contain the text
`/// here`, at which point the example will be inserted. The complete file must
compile properly.

Before the `/// here` marker, the fixture should import the necessary packages
and initialize the required variables.

When no fixture is specified, the fixture with the name
`rosetta/default.ts-fixture` will be used if present. `nofixture` can be used to
opt out of that behavior.

In an `@example` block, which is unfenced, the first line of the example can
contain three slashes to achieve the same effect:

```
/**
 * @example
 *   /// fixture=with-bucket
 *   bucket.addLifecycleTransition({ ...props });
 */
```

For a practical example of how making sample code compilable works, see the
`aws-ec2` package.

#### Recommendations

In order to offer a consistent documentation style throughout the AWS CDK
codebase, example code should follow the following recommendations (there may be
cases where some of those do not apply - good judgement is to be applied):

- Types from the documented module should be **un-qualified**:

  ```ts
  // An example in the @aws-cdk/core library, which defines Duration
  Duration.minutes(15);
  ```

- Types from other modules should be **qualified**:

  ```ts
  // An example in the @aws-cdk/core library, using something from @aws-cdk/aws-s3
  const bucket = new s3.Bucket(this, 'Bucket');
  // ...rest of the example...
  ```

- Within `.ts-fixture` files, make use of `declare` statements instead of
  writing a compatible value (this will make your fixtures more durable):

  ```ts
  // An hypothetical 'rosetta/default.ts-fixture' file in `@aws-cdk/core`
  import * as kms from '@aws-cdk/aws-kms';
  import * as s3 from '@aws-cdk/aws-s3';
  import { StackProps } from '@aws-cdk/core';

  declare const kmsKey: kms.IKey;
  declare const bucket: s3.Bucket;

  declare const props: StackProps;
  ```

## Tools (Advanced)

### scripts/foreach.sh

This wonderful tool allows you to execute a command for all modules in this repo
in topological order, but has the incredible property of being stateful. This
means that if a command fails, you can fix the issue and resume from where you
left off.

To start a session, run:

```console
$ scripts/foreach.sh COMMAND
```

This will execute "COMMAND" for each module in the repo (cwd will be the directory of the module).
If a task fails, it will stop. To resume, simply run `foreach.sh` again (with or without the same command).

To reset the session (either when all tasks finished or if you wish to run a different session), run:

```console
$ scripts/foreach.sh --reset
```

If you wish to run a command only against a module's dependency closure, use:

```console
$ cd packages/my-module
$ ../scripts/foreach.sh --up COMMAND
```

This will execute `COMMAND` against `my-module` and all its deps (in a topological order, of course).

Consequently, there are two useful scripts that are built on top of `foreach.sh`, and lets you build modules.

- __`scripts/buildup`__: builds the current module and all of its dependencies (in topological order).
- __`scripts/builddown`__: builds the current module and all of its consumers (in topological order).

### Linters

All linters are executed automatically as part of the build script, `yarn build`.

They can also be executed independently of the build script. From the root of a specific package (e.g.
`packages/@aws-cdk/aws-ec2`), run the following command to execute all the linters on that package -

```bash
yarn lint
```

The following linters are used:

- [eslint](#eslint)
- [pkglint](#pkglint)
- [awslint](#awslint)

#### eslint

All packages in the repo use a standard base configuration found at [eslintrc.js](tools/cdk-build-tools/config/eslintrc.js).
This can be customized for any package by modifying the `.eslintrc` file found at its root.

If you're using the VS Code and would like to see eslint violations on it, install the [eslint
extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint).

#### pkglint

The `pkglint` tool "lints" package.json files across the repo according to [rules.ts](tools/pkglint/lib/rules.ts).

To evaluate (and attempt to fix) all package linting issues in the repo, run the following command from the root of the
repository (after bootstrapping):

```console
$ lerna run pkglint
```

You can also do that per package:

```console
$ lr pkglint
```

#### awslint

**awslint** is a linter for the AWS Construct Library APIs. It is executed as a
part of the build of all AWS modules in the project and enforces the [AWS
Construct Library Design Guidelines](./docs/DESIGN_GUIDELINES.md).

For more information about this tool, see the [awslint
README](./packages/awslint/README.md).

Generally speaking, if you make any changes which violate an awslint rule, build
will fail with appropriate messages. All rules are documented and explained in
the [guidelines](./docs/DESIGN_GUIDELINES.md).

Here are a few useful commands:

 * `yarn awslint` in every module will run __awslint__ for that module.
 * `yarn awslint list` prints all rules (details and rationale in the guidelines doc).
 * `scripts/foreach.sh yarn awslint` will start linting the entire repo, progressively. Rerun `scripts/foreach.sh` after fixing to continue.
 * `lerna run awslint --no-bail --stream 2> awslint.txt` will run __awslint__ in all modules and collect all results into awslint.txt
 * `lerna run awslint -- -i <RULE>` will run awslint throughout the repo and
   evaluate only the rule specified [awslint README](./packages/awslint/README.md)
   for details on include/exclude rule patterns.

### cfn2ts

This tool is used to generate our low-level CloudFormation resources
(L1/`CfnFoo`). It is executed as part of the build step of all modules in the
AWS Construct Library.

The tool consults the `cdk-build.cloudformation` key in `package.json` to
determine which CloudFormation namespace this library represents (e.g.
`AWS::EC2` is the namespace for `aws-ec2`). We maintain strict 1:1 relationship
between those.

Each module also has an npm script called `cfn2ts`:

* `yarn cfn2ts`: generates L1 for a specific module
* `lerna run cfn2ts`: generates L1 for the entire repo

### Jetbrains support (WebStorm/IntelliJ)

This project uses lerna and utilizes symlinks inside nested `node_modules` directories. You may encounter an issue during
indexing where the IDE attempts to index these directories and keeps following links until the process runs out of
available memory and crashes. To fix this, you can run ```node ./scripts/jetbrains-remove-node-modules.js``` to exclude
these directories.

### Linking against this repository

If you are developing your own CDK application or library and want to use the locally checked out version of the
AWS CDK, instead of the the version of npm, the `./link-all.sh` script will help here.

This script symlinks the built modules from the local AWS CDK repo under the `node_modules/` folder of the CDK app or
library.

```console
$ cd <your own CDK app>
$ <path to the AWS CDK repo>/link-all.sh
```

### Running integration tests in parallel

Integration tests may take a long time to complete. We can speed this up by running them in parallel
in different regions.

```shell
# Install GNU parallel (may require uninstall 'moreutils' if you have it)
$ apt-get install parallel
$ brew install parallel

$ scripts/run-integ-parallel @aws-cdk/aws-ec2 @aws-cdk/aws-autoscaling ...
```

### Visualizing dependencies in a CloudFormation Template

Use GraphViz with `template-deps-to-dot`:

```shell
$ cdk -a some.app.js synth | $awscdk/scripts/template-deps-to-dot | dot -Tpng > deps.png
```

### Find dependency cycles between packages

You can use `find-cycles` to print a list of internal dependency cycles:

```shell
$ scripts/find-cycles.sh
Cycle: @aws-cdk/aws-iam => @aws-cdk/assert => aws-cdk => @aws-cdk/aws-s3 => @aws-cdk/aws-kms => @aws-cdk/aws-iam
Cycle: @aws-cdk/assert => aws-cdk => @aws-cdk/aws-s3 => @aws-cdk/aws-kms => @aws-cdk/assert
Cycle: @aws-cdk/aws-iam => @aws-cdk/assert => aws-cdk => @aws-cdk/aws-s3 => @aws-cdk/aws-iam
Cycle: @aws-cdk/assert => aws-cdk => @aws-cdk/aws-s3 => @aws-cdk/assert
Cycle: @aws-cdk/assert => aws-cdk => @aws-cdk/aws-cloudformation => @aws-cdk/assert
Cycle: @aws-cdk/aws-iam => @aws-cdk/assert => aws-cdk => @aws-cdk/util => @aws-cdk/aws-iam
Cycle: @aws-cdk/aws-sns => @aws-cdk/aws-lambda => @aws-cdk/aws-codecommit => @aws-cdk/aws-sns
Cycle: @aws-cdk/aws-sns => @aws-cdk/aws-lambda => @aws-cdk/aws-codecommit => @aws-cdk/aws-codepipeline => @aws-cdk/aws-sns
```

## Running CLI integration tests

The CLI package (`packages/aws-cdk`) has some integration tests that aren't
run as part of the regular build, since they have some particular requirements.
See the [CLI CONTRIBUTING.md file](packages/aws-cdk/CONTRIBUTING.md) for
more information on running those tests.

## Changing Cloud Assembly Schema

If you plan on making changes to the `cloud-assembly-schema` package, make sure you familiarize yourself with
its own [contribution guide](./packages/@aws-cdk/cloud-assembly-schema/CONTRIBUTING.md)

## Feature Flags

Sometimes we want to introduce new breaking behavior because we believe this is
the correct default behavior for the CDK. The problem of course is that breaking
changes are only allowed in major versions and those are rare.

To address this need, we have a feature flags pattern/mechanism. It allows us to
introduce new breaking behavior which is disabled by default (so existing
projects will not be affected) but enabled automatically for new projects
created through `cdk init`.

The pattern is simple:

1. Define a new const under
   [cx-api/lib/features.ts](https://github.com/aws/aws-cdk/blob/master/packages/%40aws-cdk/cx-api/lib/features.ts)
   with the name of the context key that **enables** this new feature (for
   example, `ENABLE_STACK_NAME_DUPLICATES`). The context key should be in the
   form `module.Type:feature` (e.g. `@aws-cdk/core:enableStackNameDuplicates`).
2. Use `node.tryGetContext(cxapi.ENABLE_XXX)` to check if this feature is enabled
   in your code. If it is not defined, revert to the legacy behavior.
3. Add your feature flag to the `FUTURE_FLAGS` map in
   [cx-api/lib/features.ts](https://github.com/aws/aws-cdk/blob/master/packages/%40aws-cdk/cx-api/lib/features.ts).
   This map is inserted to generated `cdk.json` files for new projects created
   through `cdk init`.
4. In your PR title (which goes into CHANGELOG), add a `(under feature flag)` suffix. e.g:

    ```
    fix(core): impossible to use the same physical stack name for two stacks (under feature flag)
    ```
5. Under `BREAKING CHANGES` in your commit message describe this new behavior:

    ```
    BREAKING CHANGE: template file names for new projects created through "cdk init"
    will use the template artifact ID instead of the physical stack name to enable
    multiple stacks to use the same name. This is enabled through the flag
    `@aws-cdk/core:enableStackNameDuplicates` in newly generated `cdk.json` files.
    ```

In the [next major version of the
CDK](https://github.com/aws/aws-cdk/issues/3398) we will either remove the
legacy behavior or flip the logic for all these features and then
reset the `FEATURE_FLAGS` map for the next cycle.

### Feature Flags - CDKv2

We have started working on the next version of the CDK, specifically CDKv2. This is currently being maintained
on a separate branch `v2-main` whereas `master` continues to track versions `1.x`.

Feature flags introduced in the CDK 1.x and removed in 2.x, must be added to the `FUTURE_FLAGS_EXPIRED` list in
[cx-api/lib/features.ts](https://github.com/aws/aws-cdk/blob/master/packages/%40aws-cdk/cx-api/lib/features.ts)
on the `v2-main` branch.
This will make the default behaviour in CDKv2 as if the flag is enabled and also prevents users from disabling
the feature flag.

A couple of [jest helper methods] are available for use with unit tests. These help run unit tests that test
behaviour when flags are enabled or disabled in the two major versions.

[jest helper methods]: https://github.com/aws/aws-cdk/blob/master/tools/cdk-build-tools/lib/feature-flag.ts

## Versioning and Release

See [release.md](./docs/release.md) for details on how CDK versions are maintained and how
to trigger a new release

## Troubleshooting

Most build issues can be solved by doing a full clean rebuild:

```shell
$ git clean -fqdx .
$ yarn build
```

However, this will be time consuming. In this section we'll describe some common issues you may encounter and some more
targeted commands you can run to resolve your issue.

#### The compiler is throwing errors on files that I renamed/it's running old tests that I meant to remove/code coverage is low and I didn't change anything.

If you switch to a branch in which `.ts` files got renamed or deleted, the generated `.js` and `.d.ts` files from the
previous compilation run are still around and may in some cases still be picked up by the compiler or test runners.

Run the following to clear out stale build artifacts:

```shell
$ scripts/clean-stale-files.sh
```

#### I added a dependency but it's not being picked up by the build

You need to tell Lerna to update all dependencies:

```shell
$ node_modules/.bin/lerna bootstrap
```

#### I added a dependency but it's not being picked up by a `watch` background compilation run.

No it's not. After re-bootstrapping you need to restart the watch command.

#### I added a dependency but it's not being picked up by Visual Studio Code (I still get red underlines).

The TypeScript compiler that's running has cached your dependency tree. After re-bootstrapping,
restart the TypeScript compiler.

Hit F1, type `> TypeScript: Restart TS Server`.

#### I'm doing refactorings between packages and compile times are killing me/I need to switch between differently-verionsed branches a lot and rebuilds because of version errors are taking too long.

Our build steps for each package do a couple of things, such as generating code and generating JSII assemblies. If
you've done a full build at least once to generate all source files, you can do a quicker TypeScript-only rebuild of the
entire source tree by doing the following:

```shell
# Only works after at least one full build to generate source files
$ scripts/build-typescript.sh

# Also works to start a project-wide watch compile
$ scripts/build-typescript.sh -w
```

This does not do code generation and it does not do JSII checks and JSII assembly generation. Instead of doing a
package-by-package ordered build, it compiles all `.ts` files in the repository all at once. This takes about the same
time as it does to compile the biggest package all by itself, and on my machine is the difference between a 15
CPU-minute build and a 20 CPU-second build. If you use this methods of recompiling and you want to run the test, you
have to disable the built-in rebuild functionality of `lerna run test`:

```shell
$ CDK_TEST_BUILD=false lr test
```

## Debugging

### Connecting the VS Code Debugger

*Note:* This applies to typescript CDK application only.

To debug your CDK application along with the CDK repository,

1. Clone the CDK repository locally and build the repository. See [Workflows](#workflows) section for the different build options.
2. Build the CDK application using the appropriate npm script (typically, `yarn build`) and then run the `link-all.sh` script as follows:

   ```
   cd /path/to/cdk/app
   /path/to/aws-cdk/link-all.sh
   ```

3. Open the CDK application (assume it's `hello-cdk` in these steps) and the CDK repository as a [VS code multi-root workspace](https://code.visualstudio.com/docs/editor/multi-root-workspaces).
4. Open the [workspace settings file](https://code.visualstudio.com/docs/editor/multi-root-workspaces#_settings) and verify that the following two folders must already exist

  ```json
  {
    "folders": [
      { "path": "<path-to-cdk-repo>/aws-cdk" },
      { "path": "<path-to-cdk-app>/hello-cdk" }
    ],
  }
  ```

5. Add the following launch configuration to the settings file -

  ```json
  "launch": {
    "configurations": [{
      "type": "node",
      "request": "launch",
      "name": "Debug hello-cdk",
      "program": "${workspaceFolder:hello-cdk}/bin/hello-cdk.js",
      "cwd": "${workspaceFolder:hello-cdk}",
      "console": "internalConsole",
      "sourceMaps": true,
      "skipFiles": [ "<node_internals>/**/*" ],
      "outFiles": [
        "${workspaceFolder:aws-cdk}/**/*.js",
        "${workspaceFolder:hello-cdk}/**/*.js",
      ],
    }]
  }
  ```

  *NOTE: Go [here](https://code.visualstudio.com/docs/editor/debugging#_launch-configurations) for more about launch configurations.*

6. The debug view, should now have a launch configuration called 'Debug hello-cdk' and launching that will start the debugger.
7. Any time you modify the CDK app or any of the CDK modules, they need to be re-built and depending on the change the `link-all.sh` script from step#2, may need to be re-run. Only then, would VS code recognize the change and potentially the breakpoint.

### Run a CDK unit test in the debugger

If you want to run the VSCode debugger on unit tests of the CDK project
itself, do the following:

1. Set a breakpoint inside your unit test.
2. In your terminal, depending on the type of test, run either:

```
# (For tests names test.xxx.ts)
$ node --inspect-brk /path/to/aws-cdk/node_modules/.bin/nodeunit -t 'TESTNAME'

# (For tests names xxxx.test.ts)
$ node --inspect-brk /path/to/aws-cdk/node_modules/.bin/jest -i -t 'TESTNAME'
```

3. On the `Run` pane of VSCode, select the run configuration **Attach to NodeJS** and click the button.

## Related Repositories

* [Samples](https://github.com/aws-samples/aws-cdk-examples): includes sample code in multiple languages
* [Workshop](https://github.com/aws-samples/aws-cdk-intro-workshop): source for https://cdkworkshop.com
* [Developer Guide](https://github.com/awsdocs/aws-cdk-guide): markdown source for developer guide
* [jsii](https://github.com/aws/jsii): the technology we use for multi-language support. If you are looking to help us support new languages, start there.
