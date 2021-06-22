# AWS CDK Toolkit
<!--BEGIN STABILITY BANNER-->

---

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->

The AWS CDK Toolkit provides the `cdk` command-line interface that can be used to work with AWS CDK applications.

Command                           | Description
----------------------------------|-------------------------------------------------------------------------------------
[`cdk docs`](#cdk-docs)           | Access the online documentation
[`cdk init`](#cdk-init)           | Start a new CDK project (app or library)
[`cdk list`](#cdk-list)           | List stacks in an application
[`cdk synth`](#cdk-synthesize)    | Synthesize a CDK app to CloudFormation template(s)
[`cdk diff`](#cdk-diff)           | Diff stacks against current state
[`cdk deploy`](#cdk-deploy)       | Deploy a stack into an AWS account
[`cdk destroy`](#cdk-destroy)     | Deletes a stack from an AWS account
[`cdk bootstrap`](#cdk-bootstrap) | Deploy a toolkit stack to support deploying large stacks & artifacts
[`cdk doctor`](#cdk-doctor)       | Inspect the environment and produce information useful for troubleshooting

This module is part of the [AWS Cloud Development Kit](https://github.com/aws/aws-cdk) project.

## Commands

### `cdk docs`

Outputs the URL to the documentation for the current toolkit version, and attempts to open a browser to that URL.

```console
$ # Open the documentation in the default browser (using 'open')
$ cdk docs
https://docs.aws.amazon.com/cdk/api/latest/

$ # Open the documentation in Chrome.
$ cdk docs --browser='chrome %u'
https://docs.aws.amazon.com/cdk/api/latest/
```

### `cdk init`

Creates a new CDK project.

```console
$ # List the available template types & languages
$ cdk init --list
Available templates:
* app: Template for a CDK Application
   └─ cdk init app --language=[csharp|fsharp|java|javascript|python|typescript]
* lib: Template for a CDK Construct Library
   └─ cdk init lib --language=typescript
* sample-app: Example CDK Application with some constructs
   └─ cdk init sample-app --language=[csharp|fsharp|java|javascript|python|typescript]

$ # Create a new library application in typescript
$ cdk init lib --language=typescript
```

### `cdk list`

Lists the stacks modeled in the CDK app.

```console
$ # List all stacks in the CDK app 'node bin/main.js'
$ cdk list --app='node bin/main.js'
Foo
Bar
Baz

$ # List all stack including all details (add --json to output JSON instead of YAML)
$ cdk list --app='node bin/main.js' --long
-
    name: Foo
    environment:
        name: 000000000000/bermuda-triangle-1
        account: '000000000000'
        region: bermuda-triangle-1
-
    name: Bar
    environment:
        name: 111111111111/bermuda-triangle-2
        account: '111111111111'
        region: bermuda-triangle-2
-
    name: Baz
    environment:
        name: 333333333333/bermuda-triangle-3
        account: '333333333333'
        region: bermuda-triangle-3
```

### `cdk synthesize`

Synthesizes the CDK app and produces a cloud assembly to a designated output (defaults to `cdk.out`)

Typically you don't interact directly with cloud assemblies. They are files that include everything
needed to deploy your app to a cloud environment. For example, it includes an AWS CloudFormation
template for each stack in your app, and a copy of any file assets or Docker images that you reference
in your app.

If your app contains a single stack or a stack is supplied as an argument to `cdk synth`, the CloudFormation template will also be displayed in the standard output (STDOUT) as `YAML`.

If there are multiple stacks in your application, `cdk synth` will synthesize the cloud assembly to `cdk.out`.

```console
$ # Synthesize cloud assembly for StackName and output the CloudFormation template to STDOUT
$ cdk synth MyStackName

$ # Synthesize cloud assembly for all the stacks and save them into cdk.out/
$ cdk synth

$ # Synthesize cloud assembly for StackName, but don't include dependencies
$ cdk synth MyStackName --exclusively

$ # Synthesize cloud assembly for StackName, but don't cloudFormation template output to STDOUT
$ cdk synth MyStackName --quiet
```

See the [AWS Documentation](https://docs.aws.amazon.com/cdk/latest/guide/apps.html#apps_cloud_assembly) to learn more about cloud assemblies.
See the [CDK reference documentation](https://docs.aws.amazon.com/cdk/api/latest/docs/cloud-assembly-schema-readme.html) for details on the cloud assembly specification


### `cdk diff`

Computes differences between the infrastructure specified in the current state of the CDK app and the currently
deployed application (or a user-specified CloudFormation template). This command returns non-zero if any differences are
found.

```console
$ # Diff against the currently deployed stack
$ cdk diff --app='node bin/main.js' MyStackName

$ # Diff against a specific template document
$ cdk diff --app='node bin/main.js' MyStackName --template=path/to/template.yml
```

### `cdk deploy`

Deploys a stack of your CDK app to it's environment. During the deployment, the toolkit will output progress
indications, similar to what can be observed in the AWS CloudFormation Console. If the environment was never
bootstrapped (using `cdk bootstrap`), only stacks that are not using assets and synthesize to a template that is under
51,200 bytes will successfully deploy.

```console
$ cdk deploy --app='node bin/main.js' MyStackName
```

Before creating a change set, `cdk deploy` will compare the template and tags of the
currently deployed stack to the template and tags that are about to be deployed and
will skip deployment if they are identical. Use `--force` to override this behavior
and always deploy the stack.

#### Deploying multiple stacks

You can have multiple stacks in a cdk app. An example can be found in [how to create multiple stacks](https://docs.aws.amazon.com/cdk/latest/guide/stack_how_to_create_multiple_stacks.html).

In order to deploy them, you can list the stacks you want to deploy. If your application contains pipeline stacks, the `cdk list` command will show stack names as paths, showing where they are in the pipeline hierarchy (e.g., `PipelineStack`, `PipelineStack/Prod`, `PipelineStack/Prod/MyService` etc).

If you want to deploy all of them, you can use the flag `--all` or the wildcard `*` to deploy all stacks in an app. Please note that, if you have a hierarchy of stacks as described above, `--all` and `*` will only match the stacks on the top level. If you want to match all the stacks in the hierarchy, use `**`. You can also combine these patterns. For example, if you want to deploy all stacks in the `Prod` stage, you can use `cdk deploy PipelineStack/Prod/**`.

#### Parameters

Pass parameters to your template during deployment by using `--parameters
(STACK:KEY=VALUE)`. This will apply the value `VALUE` to the key `KEY` for stack `STACK`.

Example of providing an attribute value for an SNS Topic through a parameter in TypeScript:

Usage of parameter in CDK Stack:

```ts
new sns.Topic(this, 'TopicParameter', {
    topicName: new cdk.CfnParameter(this, 'TopicNameParam').value.toString()
});
```

Parameter values as a part of `cdk deploy`

```console
$ cdk deploy --parameters "MyStackName:TopicNameParam=parameterized"
```

Parameter values can be overwritten by supplying the `--force` flag.
Example of overwriting the topic name from a previous deployment.

```console
$ cdk deploy --parameters "ParametersStack:TopicNameParam=blahagain" --force
```

⚠️ Parameters will be applied to all stacks if a stack name is not specified or `*` is provided.
Parameters provided to Stacks that do not make use of the parameter will not successfully deploy.

⚠️ Parameters do not propagate to NestedStacks. These must be sent with the constructor.
See Nested Stack [documentation](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-cloudformation.NestedStack.html)

#### Outputs

Write stack outputs from deployments into a file. When your stack finishes deploying, all stack outputs
will be written to the output file as JSON.

Usage of output in a CDK stack

```ts
const fn = new lambda.Function(this, "fn", {
  handler: "index.handler",
  code: lambda.Code.fromInline(`exports.handler = \${handler.toString()}`),
  runtime: lambda.Runtime.NODEJS_12_X
});

new cdk.CfnOutput(this, 'FunctionArn', {
  value: fn.functionArn,
});
```

Specify an outputs file to write to by supplying the `--outputs-file` parameter

```console
$ cdk deploy --outputs-file outputs.json
```

Alternatively, the `outputsFile` key can be specified in the project config (`cdk.json`).

The following shows a sample `cdk.json` where the `outputsFile` key is set to *outputs.json*.

```json
{
  "app": "npx ts-node bin/myproject.ts",
  "context": {
    "@aws-cdk/core:enableStackNameDuplicates": "true",
    "aws-cdk:enableDiffNoFail": "true",
    "@aws-cdk/core:stackRelativeExports": "true"
  },
  "outputsFile": "outputs.json"
}
```

The `outputsFile` key can also be specified as a user setting (`~/.cdk.json`)

When the stack finishes deployment, `outputs.json` would look like this:

```json
{
  "MyStack": {
    "FunctionArn": "arn:aws:lambda:us-east-1:123456789012:function:MyStack-fn5FF616E3-G632ITHSP5HK"
  }
}
```

⚠️ The `key` of the outputs corresponds to the logical ID of the `CfnOutput`.
Read more about identifiers in the CDK [here](https://docs.aws.amazon.com/cdk/latest/guide/identifiers.html)

If multiple stacks are being deployed or the wild card `*` is used to deploy all stacks, all outputs
are written to the same output file where each stack artifact ID is a key in the JSON file


```console
$ cdk deploy '*' --outputs-file "/Users/code/myproject/outputs.json"
```

Example `outputs.json` after deployment of multiple stacks

```json
{
  "MyStack": {
    "FunctionArn": "arn:aws:lambda:us-east-1:123456789012:function:MyStack-fn5FF616E3-G632ITHSP5HK"
  },
  "AnotherStack": {
    "VPCId": "vpc-z0mg270fee16693f"
  }
}
```

#### Deployment Progress

By default, stack deployment events are displayed as a progress bar with the events for the resource
currently being deployed.

Set the `--progress` flag to request the complete history which includes all CloudFormation events

```console
$ cdk deploy --progress events
```

Alternatively, the `progress` key can be specified in the project config (`cdk.json`).

The following shows a sample `cdk.json` where the `progress` key is set to *events*.
When `cdk deploy` is executed, deployment events will include the complete history.

```json
{
  "app": "npx ts-node bin/myproject.ts",
  "context": {
    "@aws-cdk/core:enableStackNameDuplicates": "true",
    "aws-cdk:enableDiffNoFail": "true",
    "@aws-cdk/core:stackRelativeExports": "true"
  },
  "progress": "events"
}
```

The `progress` key can also be specified as a user setting (`~/.cdk.json`)

#### Externally Executable CloudFormation Change Sets

For more control over when stack changes are deployed, the CDK can generate a
CloudFormation change set but not execute it. The default name of the generated
change set is *cdk-deploy-change-set*, and a previous change set with that
name will be overwritten. The change set will always be created, even if it
is empty. A name can also be given to the change set to make it easier to later
execute.

```console
$ cdk deploy --no-execute --change-set-name MyChangeSetName
```

### `cdk destroy`

Deletes a stack from it's environment. This will cause the resources in the stack to be destroyed (unless they were
configured with a `DeletionPolicy` of `Retain`). During the stack destruction, the command will output progress
information similar to what `cdk deploy` provides.

```console
$ cdk destroy --app='node bin/main.js' MyStackName
```

### `cdk bootstrap`

Deploys a `CDKToolkit` CloudFormation stack into the specified environment(s), that provides an S3 bucket that
`cdk deploy` will use to store synthesized templates and the related assets, before triggering a CloudFormation stack
update. The name of the deployed stack can be configured using the `--toolkit-stack-name` argument. The S3 Bucket
Public Access Block Configuration can be configured using the `--public-access-block-configuration` argument.

```console
$ # Deploys to all environments
$ cdk bootstrap --app='node bin/main.js'

$ # Deploys only to environments foo and bar
$ cdk bootstrap --app='node bin/main.js' foo bar
```

By default, bootstrap stack will be protected from stack termination. This can be disabled using
`--termination-protection` argument.

If you have specific needs, policies, or requirements not met by the default template, you can customize it
to fit your own situation, by exporting the default one to a file and either deploying it yourself
using CloudFormation directly, or by telling the CLI to use a custom template. That looks as follows:

```console
# Dump the built-in template to a file
$ cdk bootstrap --show-template > bootstrap-template.yaml

# Edit 'bootstrap-template.yaml' to your liking

# Tell CDK to use the customized template
$ cdk bootstrap --template bootstrap-template.yaml
```

### `cdk doctor`

Inspect the current command-line environment and configurations, and collect information that can be useful for
troubleshooting problems. It is usually a good idea to include the information provided by this command when submitting
a bug report.

```console
$ cdk doctor
ℹ️ CDK Version: 1.0.0 (build e64993a)
ℹ️ AWS environment variables:
  - AWS_EC2_METADATA_DISABLED = 1
  - AWS_SDK_LOAD_CONFIG = 1
```

### Bundling

By default asset bundling is skipped for `cdk list` and `cdk destroy`. For `cdk deploy`, `cdk diff`
and `cdk synthesize` the default is to bundle assets for all stacks unless `exclusively` is specified.
In this case, only the listed stacks will have their assets bundled.

## MFA support

If `mfa_serial` is found in the active profile of the shared ini file AWS CDK
will ask for token defined in the `mfa_serial`. This token will be provided to STS assume role call.

Example profile in `~/.aws/config` where `mfa_serial` is used to assume role:

```ini
[profile my_assume_role_profile]
source_profile=my_source_role
role_arn=arn:aws:iam::123456789123:role/role_to_be_assumed
mfa_serial=arn:aws:iam::123456789123:mfa/my_user
```

## Configuration

On top of passing configuration through command-line arguments, it is possible to use JSON configuration files. The
configuration's order of precedence is:

1. Command-line arguments
2. Project configuration (`./cdk.json`)
3. User configuration (`~/.cdk.json`)

### JSON Configuration files

Some of the interesting keys that can be used in the JSON configuration files:

```json5
{
    "app": "node bin/main.js",        // Command to start the CDK app      (--app='node bin/main.js')
    "context": {                      // Context entries                   (--context=key=value)
        "key": "value"
    },
    "toolkitStackName": "foo",        // Customize 'bootstrap' stack name  (--toolkit-stack-name=foo)
    "toolkitBucketName": "fooBucket", // Customize 'bootstrap' bucket name (--toolkit-bucket-name=fooBucket)
    "versionReporting": false,         // Opt-out of version reporting      (--no-version-reporting)
}
```

### Environment

The following environment variables affect aws-cdk:

- `CDK_DISABLE_VERSION_CHECK`: If set, disable automatic check for newer versions.
- `CDK_NEW_BOOTSTRAP`: use the modern bootstrapping stack.
