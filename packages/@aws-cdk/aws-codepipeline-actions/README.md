# AWS CodePipeline Actions
<!--BEGIN STABILITY BANNER-->

---

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->

This package contains Actions that can be used in a CodePipeline.

```ts
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
```

## Sources

### AWS CodeCommit

To use a CodeCommit Repository in a CodePipeline:

```ts
import * as codecommit from '@aws-cdk/aws-codecommit';

const repo = new codecommit.Repository(this, 'Repo', {
  // ...
});

const pipeline = new codepipeline.Pipeline(this, 'MyPipeline', {
  pipelineName: 'MyPipeline',
});
const sourceOutput = new codepipeline.Artifact();
const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
  actionName: 'CodeCommit',
  repository: repo,
  output: sourceOutput,
});
pipeline.addStage({
  stageName: 'Source',
  actions: [sourceAction],
});
```

If you want to use existing role which can be used by on commit event rule.
You can specify the role object in eventRole property.

```ts
const eventRole = iam.Role.fromRoleArn(this, 'Event-role', 'roleArn');
const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
  actionName: 'CodeCommit',
  repository: repo,
  output: new codepipeline.Artifact(),
  eventRole,
});
```

If you want to clone the entire CodeCommit repository (only available for CodeBuild actions),
you can set the `codeBuildCloneOutput` property to `true`:

```ts
const sourceOutput = new codepipeline.Artifact();
const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
  actionName: 'CodeCommit',
  repository: repo,
  output: sourceOutput,
  codeBuildCloneOutput: true,
});

const buildAction = new codepipeline_actions.CodeBuildAction({
  actionName: 'CodeBuild',
  project,
  input: sourceOutput, // The build action must use the CodeCommitSourceAction output as input.
  outputs: [new codepipeline.Artifact()], // optional
});
```

The CodeCommit source action emits variables:

```ts
const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
  // ...
  variablesNamespace: 'MyNamespace', // optional - by default, a name will be generated for you
});

// later:

new codepipeline_actions.CodeBuildAction({
  // ...
  environmentVariables: {
    COMMIT_ID: {
      value: sourceAction.variables.commitId,
    },
  },
});
```

### GitHub

If you want to use a GitHub repository as the source, you must create:

* A [GitHub Access Token](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line),
  with scopes **repo** and **admin:repo_hook**.
* A [Secrets Manager Secret](https://docs.aws.amazon.com/secretsmanager/latest/userguide/manage_create-basic-secret.html)
  with the value of the **GitHub Access Token**. Pick whatever name you want (for example `my-github-token`).
  This token can be stored either as Plaintext or as a Secret key/value.
  If you stored the token as Plaintext,
  set `cdk.SecretValue.secretsManager('my-github-token')` as the value of `oauthToken`.
  If you stored it as a Secret key/value,
  you must set `cdk.SecretValue.secretsManager('my-github-token', { jsonField : 'my-github-token' })` as the value of `oauthToken`.

To use GitHub as the source of a CodePipeline:

```ts
// Read the secret from Secrets Manager
const sourceOutput = new codepipeline.Artifact();
const sourceAction = new codepipeline_actions.GitHubSourceAction({
  actionName: 'GitHub_Source',
  owner: 'awslabs',
  repo: 'aws-cdk',
  oauthToken: cdk.SecretValue.secretsManager('my-github-token'),
  output: sourceOutput,
  branch: 'develop', // default: 'master'
});
pipeline.addStage({
  stageName: 'Source',
  actions: [sourceAction],
});
```

The GitHub source action emits variables:

```ts
const sourceAction = new codepipeline_actions.GitHubSourceAction({
  // ...
  variablesNamespace: 'MyNamespace', // optional - by default, a name will be generated for you
});

// later:

new codepipeline_actions.CodeBuildAction({
  // ...
  environmentVariables: {
    COMMIT_URL: {
      value: sourceAction.variables.commitUrl,
    },
  },
});
```

### BitBucket

CodePipeline can use a BitBucket Git repository as a source:

**Note**: you have to manually connect CodePipeline through the AWS Console with your BitBucket account.
This is a one-time operation for a given AWS account in a given region.
The simplest way to do that is to either start creating a new CodePipeline,
or edit an existing one, while being logged in to BitBucket.
Choose BitBucket as the source,
and grant CodePipeline permissions to your BitBucket account.
Copy & paste the Connection ARN that you get in the console,
or use the [`codestar-connections list-connections` AWS CLI operation](https://docs.aws.amazon.com/cli/latest/reference/codestar-connections/list-connections.html)
to find it.
After that, you can safely abort creating or editing the pipeline -
the connection has already been created.

```ts
const sourceOutput = new codepipeline.Artifact();
const sourceAction = new codepipeline_actions.BitBucketSourceAction({
  actionName: 'BitBucket_Source',
  owner: 'aws',
  repo: 'aws-cdk',
  output: sourceOutput,
  connectionArn: 'arn:aws:codestar-connections:us-east-1:123456789012:connection/12345678-abcd-12ab-34cdef5678gh',
});
```

**Note**: as this feature is still in Beta in CodePipeline,
the above class `BitBucketSourceAction` is experimental -
we reserve the right to make breaking changes to it.

### AWS S3 Source

To use an S3 Bucket as a source in CodePipeline:

```ts
import * as s3 from '@aws-cdk/aws-s3';

const sourceBucket = new s3.Bucket(this, 'MyBucket', {
  versioned: true, // a Bucket used as a source in CodePipeline must be versioned
});

const pipeline = new codepipeline.Pipeline(this, 'MyPipeline');
const sourceOutput = new codepipeline.Artifact();
const sourceAction = new codepipeline_actions.S3SourceAction({
  actionName: 'S3Source',
  bucket: sourceBucket,
  bucketKey: 'path/to/file.zip',
  output: sourceOutput,
});
pipeline.addStage({
  stageName: 'Source',
  actions: [sourceAction],
});
```

The region of the action will be determined by the region the bucket itself is in.
When using a newly created bucket,
that region will be taken from the stack the bucket belongs to;
for an imported bucket,
you can specify the region explicitly:

```ts
const sourceBucket = s3.Bucket.fromBucketAttributes(this, 'SourceBucket', {
  bucketName: 'my-bucket',
  region: 'ap-southeast-1',
});
```

By default, the Pipeline will poll the Bucket to detect changes.
You can change that behavior to use CloudWatch Events by setting the `trigger`
property to `S3Trigger.EVENTS` (it's `S3Trigger.POLL` by default).
If you do that, make sure the source Bucket is part of an AWS CloudTrail Trail -
otherwise, the CloudWatch Events will not be emitted,
and your Pipeline will not react to changes in the Bucket.
You can do it through the CDK:

```ts
import * as cloudtrail from '@aws-cdk/aws-cloudtrail';

const key = 'some/key.zip';
const trail = new cloudtrail.Trail(this, 'CloudTrail');
trail.addS3EventSelector([{
  bucket: sourceBucket,
  objectPrefix: key,
}], {
  readWriteType: cloudtrail.ReadWriteType.WRITE_ONLY,
});
const sourceAction = new codepipeline_actions.S3SourceAction({
  actionName: 'S3Source',
  bucketKey: key,
  bucket: sourceBucket,
  output: sourceOutput,
  trigger: codepipeline_actions.S3Trigger.EVENTS, // default: S3Trigger.POLL
});
```

The S3 source action emits variables:

```ts
const sourceAction = new codepipeline_actions.S3SourceAction({
  // ...
  variablesNamespace: 'MyNamespace', // optional - by default, a name will be generated for you
});

// later:

new codepipeline_actions.CodeBuildAction({
  // ...
  environmentVariables: {
    VERSION_ID: {
      value: sourceAction.variables.versionId,
    },
  },
});
```

### AWS ECR

To use an ECR Repository as a source in a Pipeline:

```ts
import * as ecr from '@aws-cdk/aws-ecr';

const pipeline = new codepipeline.Pipeline(this, 'MyPipeline');
const sourceOutput = new codepipeline.Artifact();
const sourceAction = new codepipeline_actions.EcrSourceAction({
  actionName: 'ECR',
  repository: ecrRepository,
  imageTag: 'some-tag', // optional, default: 'latest'
  output: sourceOutput,
});
pipeline.addStage({
  stageName: 'Source',
  actions: [sourceAction],
});
```

The ECR source action emits variables:

```ts
const sourceAction = new codepipeline_actions.EcrSourceAction({
  // ...
  variablesNamespace: 'MyNamespace', // optional - by default, a name will be generated for you
});

// later:

new codepipeline_actions.CodeBuildAction({
  // ...
  environmentVariables: {
    IMAGE_URI: {
      value: sourceAction.variables.imageUri,
    },
  },
});
```

## Build & test

### AWS CodeBuild

Example of a CodeBuild Project used in a Pipeline, alongside CodeCommit:

```ts
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codecommit from '@aws-cdk/aws-codecommit';

const repository = new codecommit.Repository(this, 'MyRepository', {
  repositoryName: 'MyRepository',
});
const project = new codebuild.PipelineProject(this, 'MyProject');

const sourceOutput = new codepipeline.Artifact();
const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
  actionName: 'CodeCommit',
  repository,
  output: sourceOutput,
});
const buildAction = new codepipeline_actions.CodeBuildAction({
  actionName: 'CodeBuild',
  project,
  input: sourceOutput,
  outputs: [new codepipeline.Artifact()], // optional
  executeBatchBuild: true // optional, defaults to false
});

new codepipeline.Pipeline(this, 'MyPipeline', {
  stages: [
    {
      stageName: 'Source',
      actions: [sourceAction],
    },
    {
      stageName: 'Build',
      actions: [buildAction],
    },
  ],
});
```

The default category of the CodeBuild Action is `Build`;
if you want a `Test` Action instead,
override the `type` property:

```ts
const testAction = new codepipeline_actions.CodeBuildAction({
  actionName: 'IntegrationTest',
  project,
  input: sourceOutput,
  type: codepipeline_actions.CodeBuildActionType.TEST, // default is BUILD
});
```

#### Multiple inputs and outputs

When you want to have multiple inputs and/or outputs for a Project used in a
Pipeline, instead of using the `secondarySources` and `secondaryArtifacts`
properties of the `Project` class, you need to use the `extraInputs` and
`outputs` properties of the CodeBuild CodePipeline
Actions. Example:

```ts
const sourceOutput1 = new codepipeline.Artifact();
const sourceAction1 = new codepipeline_actions.CodeCommitSourceAction({
  actionName: 'Source1',
  repository: repository1,
  output: sourceOutput1,
});
const sourceOutput2 = new codepipeline.Artifact('source2');
const sourceAction2 = new codepipeline_actions.CodeCommitSourceAction({
  actionName: 'Source2',
  repository: repository2,
  output: sourceOutput2,
});

const buildAction = new codepipeline_actions.CodeBuildAction({
  actionName: 'Build',
  project,
  input: sourceOutput1,
  extraInputs: [
    sourceOutput2, // this is where 'source2' comes from
  ],
  outputs: [
    new codepipeline.Artifact('artifact1'), // for better buildspec readability - see below
    new codepipeline.Artifact('artifact2'),
  ],
});
```

**Note**: when a CodeBuild Action in a Pipeline has more than one output, it
only uses the `secondary-artifacts` field of the buildspec, never the
primary output specification directly under `artifacts`. Because of that, it
pays to explicitly name all output artifacts of that Action, like we did
above, so that you know what name to use in the buildspec.

Example buildspec for the above project:

```ts
const project = new codebuild.PipelineProject(this, 'MyProject', {
  buildSpec: codebuild.BuildSpec.fromObject({
    version: '0.2',
    phases: {
      build: {
        commands: [
          // By default, you're in a directory with the contents of the repository from sourceAction1.
          // Use the CODEBUILD_SRC_DIR_source2 environment variable
          // to get a path to the directory with the contents of the second input repository.
        ],
      },
    },
    artifacts: {
      'secondary-artifacts': {
        'artifact1': {
          // primary Action output artifact,
          // available as buildAction.outputArtifact
        },
        'artifact2': {
          // additional output artifact,
          // available as buildAction.additionalOutputArtifact('artifact2')
        },
      },
    },
  }),
  // ...
});
```

#### Variables

The CodeBuild action emits variables.
Unlike many other actions, the variables are not static,
but dynamic, defined in the buildspec,
in the 'exported-variables' subsection of the 'env' section.
Example:

```ts
const buildAction = new codepipeline_actions.CodeBuildAction({
  actionName: 'Build1',
  input: sourceOutput,
  project: new codebuild.PipelineProject(this, 'Project', {
    buildSpec: codebuild.BuildSpec.fromObject({
      version: '0.2',
      env: {
        'exported-variables': [
          'MY_VAR',
        ],
      },
      phases: {
        build: {
          commands: 'export MY_VAR="some value"',
        },
      },
    }),
  }),
  variablesNamespace: 'MyNamespace', // optional - by default, a name will be generated for you
});

// later:

new codepipeline_actions.CodeBuildAction({
  // ...
  environmentVariables: {
    MyVar: {
      value: buildAction.variable('MY_VAR'),
    },
  },
});
```

### Jenkins

In order to use Jenkins Actions in the Pipeline,
you first need to create a `JenkinsProvider`:

```ts
const jenkinsProvider = new codepipeline_actions.JenkinsProvider(this, 'JenkinsProvider', {
  providerName: 'MyJenkinsProvider',
  serverUrl: 'http://my-jenkins.com:8080',
  version: '2', // optional, default: '1'
});
```

If you've registered a Jenkins provider in a different CDK app,
or outside the CDK (in the CodePipeline AWS Console, for example),
you can import it:

```ts
const jenkinsProvider = codepipeline_actions.JenkinsProvider.import(this, 'JenkinsProvider', {
  providerName: 'MyJenkinsProvider',
  serverUrl: 'http://my-jenkins.com:8080',
  version: '2', // optional, default: '1'
});
```

Note that a Jenkins provider
(identified by the provider name-category(build/test)-version tuple)
must always be registered in the given account, in the given AWS region,
before it can be used in CodePipeline.

With a `JenkinsProvider`,
we can create a Jenkins Action:

```ts
const buildAction = new codepipeline_actions.JenkinsAction({
  actionName: 'JenkinsBuild',
  jenkinsProvider: jenkinsProvider,
  projectName: 'MyProject',
  type: codepipeline_actions.JenkinsActionType.BUILD,
});
```

## Deploy

### AWS CloudFormation

This module contains Actions that allows you to deploy to CloudFormation from AWS CodePipeline.

For example, the following code fragment defines a pipeline that automatically deploys a CloudFormation template
directly from a CodeCommit repository, with a manual approval step in between to confirm the changes:

[example Pipeline to deploy CloudFormation](test/integ.cfn-template-from-repo.lit.ts)

See [the AWS documentation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/continuous-delivery-codepipeline.html)
for more details about using CloudFormation in CodePipeline.

#### Actions defined by this package

This package contains the following CloudFormation actions:

* **CloudFormationCreateUpdateStackAction** - Deploy a CloudFormation template directly from the pipeline. The indicated stack is created,
  or updated if it already exists. If the stack is in a failure state, deployment will fail (unless `replaceOnFailure`
  is set to `true`, in which case it will be destroyed and recreated).
* **CloudFormationDeleteStackAction** - Delete the stack with the given name.
* **CloudFormationCreateReplaceChangeSetAction** - Prepare a change set to be applied later. You will typically use change sets if you want
  to manually verify the changes that are being staged, or if you want to separate the people (or system) preparing the
  changes from the people (or system) applying the changes.
* **CloudFormationExecuteChangeSetAction** - Execute a change set prepared previously.

#### Lambda deployed through CodePipeline

If you want to deploy your Lambda through CodePipeline,
and you don't use assets (for example, because your CDK code and Lambda code are separate),
you can use a special Lambda `Code` class, `CfnParametersCode`.
Note that your Lambda must be in a different Stack than your Pipeline.
The Lambda itself will be deployed, alongside the entire Stack it belongs to,
using a CloudFormation CodePipeline Action. Example:

[Example of deploying a Lambda through CodePipeline](test/integ.lambda-deployed-through-codepipeline.lit.ts)

#### Cross-account actions

If you want to update stacks in a different account,
pass the `account` property when creating the action:

```ts
new codepipeline_actions.CloudFormationCreateUpdateStackAction({
  // ...
  account: '123456789012',
});
```

This will create a new stack, called `<PipelineStackName>-support-123456789012`, in your `App`,
that will contain the role that the pipeline will assume in account 123456789012 before executing this action.
This support stack will automatically be deployed before the stack containing the pipeline.

You can also pass a role explicitly when creating the action -
in that case, the `account` property is ignored,
and the action will operate in the same account the role belongs to:

```ts
import { PhysicalName } from '@aws-cdk/core';

// in stack for account 123456789012...
const actionRole = new iam.Role(otherAccountStack, 'ActionRole', {
  assumedBy: new iam.AccountPrincipal(pipelineAccount),
  // the role has to have a physical name set
  roleName: PhysicalName.GENERATE_IF_NEEDED,
});

// in the pipeline stack...
new codepipeline_actions.CloudFormationCreateUpdateStackAction({
  // ...
  role: actionRole, // this action will be cross-account as well
});
```

### AWS CodeDeploy

#### Server deployments

To use CodeDeploy for EC2/on-premise deployments in a Pipeline:

```ts
import * as codedeploy from '@aws-cdk/aws-codedeploy';

const pipeline = new codepipeline.Pipeline(this, 'MyPipeline', {
  pipelineName: 'MyPipeline',
});

// add the source and build Stages to the Pipeline...

const deployAction = new codepipeline_actions.CodeDeployServerDeployAction({
  actionName: 'CodeDeploy',
  input: buildOutput,
  deploymentGroup,
});
pipeline.addStage({
  stageName: 'Deploy',
  actions: [deployAction],
});
```

##### Lambda deployments

To use CodeDeploy for blue-green Lambda deployments in a Pipeline:

```ts
const lambdaCode = lambda.Code.fromCfnParameters();
const func = new lambda.Function(lambdaStack, 'Lambda', {
  code: lambdaCode,
  handler: 'index.handler',
  runtime: lambda.Runtime.NODEJS_12_X,
});
// used to make sure each CDK synthesis produces a different Version
const version = func.addVersion('NewVersion');
const alias = new lambda.Alias(lambdaStack, 'LambdaAlias', {
  aliasName: 'Prod',
  version,
});

new codedeploy.LambdaDeploymentGroup(lambdaStack, 'DeploymentGroup', {
  alias,
  deploymentConfig: codedeploy.LambdaDeploymentConfig.LINEAR_10PERCENT_EVERY_1MINUTE,
});
```

Then, you need to create your Pipeline Stack,
where you will define your Pipeline,
and deploy the `lambdaStack` using a CloudFormation CodePipeline Action
(see above for a complete example).

### ECS

CodePipeline can deploy an ECS service.
The deploy Action receives one input Artifact which contains the [image definition file]:

```ts
const deployStage = pipeline.addStage({
  stageName: 'Deploy',
  actions: [
    new codepipeline_actions.EcsDeployAction({
      actionName: 'DeployAction',
      service,
      // if your file is called imagedefinitions.json,
      // use the `input` property,
      // and leave out the `imageFile` property
      input: buildOutput,
      // if your file name is _not_ imagedefinitions.json,
      // use the `imageFile` property,
      // and leave out the `input` property
      imageFile: buildOutput.atPath('imageDef.json'),
      deploymentTimeout: cdk.Duration.minutes(60), // optional, default is 60 minutes
    }),
  ],
});
```

[image definition file]: https://docs.aws.amazon.com/codepipeline/latest/userguide/pipelines-create.html#pipelines-create-image-definitions

#### Deploying ECS applications stored in a separate source code repository

The idiomatic CDK way of deploying an ECS application is to have your Dockerfiles and your CDK code in the same source code repository,
leveraging [Docker Assets](https://docs.aws.amazon.com/cdk/latest/guide/assets.html#assets_types_docker),
and use the [CDK Pipelines module](https://docs.aws.amazon.com/cdk/api/latest/docs/pipelines-readme.html).

However, if you want to deploy a Docker application whose source code is kept in a separate version control repository than the CDK code,
you can use the `TagParameterContainerImage` class from the ECS module.
Here's an example:

[example ECS pipeline for an application in a separate source code repository](test/integ.pipeline-ecs-separate-source.lit.ts)

### AWS S3 Deployment

To use an S3 Bucket as a deployment target in CodePipeline:

```ts
const targetBucket = new s3.Bucket(this, 'MyBucket', {});

const pipeline = new codepipeline.Pipeline(this, 'MyPipeline');
const deployAction = new codepipeline_actions.S3DeployAction({
  actionName: 'S3Deploy',
  stage: deployStage,
  bucket: targetBucket,
  input: sourceOutput,
});
const deployStage = pipeline.addStage({
  stageName: 'Deploy',
  actions: [deployAction],
});
```

#### Invalidating the CloudFront cache when deploying to S3

There is currently no native support in CodePipeline for invalidating a CloudFront cache after deployment.
One workaround is to add another build step after the deploy step,
and use the AWS CLI to invalidate the cache:

```ts
// Create a Cloudfront Web Distribution
const distribution = new cloudfront.Distribution(this, `Distribution`, {
  // ...
});

// Create the build project that will invalidate the cache
const invalidateBuildProject = new codebuild.PipelineProject(this, `InvalidateProject`, {
  buildSpec: codebuild.BuildSpec.fromObject({
    version: '0.2',
    phases: {
      build: {
        commands:[
          'aws cloudfront create-invalidation --distribution-id ${CLOUDFRONT_ID} --paths "/*"',
          // Choose whatever files or paths you'd like, or all files as specified here
        ],
      },
    },
  }),
  environmentVariables: {
    CLOUDFRONT_ID: { value: distribution.distributionId },
  },
});

// Add Cloudfront invalidation permissions to the project
const distributionArn = `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`;
invalidateBuildProject.addToRolePolicy(new iam.PolicyStatement({
  resources: [distributionArn],
  actions: [
    'cloudfront:CreateInvalidation',
  ],
}));

// Create the pipeline (here only the S3 deploy and Invalidate cache build)
new codepipeline.Pipeline(this, 'Pipeline', {
  stages: [
    // ...
    {
      stageName: 'Deploy',
      actions: [
        new codepipelineActions.S3DeployAction({
          actionName: 'S3Deploy',
          bucket: deployBucket,
          input: deployInput,
          runOrder: 1,
        }),
        new codepipelineActions.CodeBuildAction({
          actionName: 'InvalidateCache',
          project: invalidateBuildProject,
          input: deployInput,
          runOrder: 2,
        }),
      ],
    },
  ],
});
```

### Alexa Skill

You can deploy to Alexa using CodePipeline with the following Action:

```ts
// Read the secrets from ParameterStore
const clientId = cdk.SecretValue.secretsManager('AlexaClientId');
const clientSecret = cdk.SecretValue.secretsManager('AlexaClientSecret');
const refreshToken = cdk.SecretValue.secretsManager('AlexaRefreshToken');

// Add deploy action
new codepipeline_actions.AlexaSkillDeployAction({
  actionName: 'DeploySkill',
  runOrder: 1,
  input: sourceOutput,
  clientId: clientId.toString(),
  clientSecret: clientSecret,
  refreshToken: refreshToken,
  skillId: 'amzn1.ask.skill.12345678-1234-1234-1234-123456789012',
});
```

If you need manifest overrides you can specify them as `parameterOverridesArtifact` in the action:

```ts
import * as cloudformation from '@aws-cdk/aws-cloudformation';

// Deploy some CFN change set and store output
const executeOutput = new codepipeline.Artifact('CloudFormation');
const executeChangeSetAction = new codepipeline_actions.CloudFormationExecuteChangeSetAction({
  actionName: 'ExecuteChangesTest',
  runOrder: 2,
  stackName,
  changeSetName,
  outputFileName: 'overrides.json',
  output: executeOutput,
});

// Provide CFN output as manifest overrides
new codepipeline_actions.AlexaSkillDeployAction({
  actionName: 'DeploySkill',
  runOrder: 1,
  input: sourceOutput,
  parameterOverridesArtifact: executeOutput,
  clientId: clientId.toString(),
  clientSecret: clientSecret,
  refreshToken: refreshToken,
  skillId: 'amzn1.ask.skill.12345678-1234-1234-1234-123456789012',
});
```

### AWS Service Catalog

You can deploy a CloudFormation template to an existing Service Catalog product with the following action:

```ts
new codepipeline.Pipeline(this, 'Pipeline', {
      stages: [
          {
            stageName: 'ServiceCatalogDeploy',
            actions: [
            new codepipeline_actions.ServiceCatalogDeployAction({
                actionName: 'ServiceCatalogDeploy',
                templatePath: cdkBuildOutput.atPath("Sample.template.json"),
                productVersionName: "Version - " + Date.now.toString,
                productType: "CLOUD_FORMATION_TEMPLATE",
                productVersionDescription: "This is a version from the pipeline with a new description.",
                productId: "prod-XXXXXXXX",
            }),
          },
        ],
});
```

## Approve & invoke

### Manual approval Action

This package contains an Action that stops the Pipeline until someone manually clicks the approve button:

```ts
const manualApprovalAction = new codepipeline_actions.ManualApprovalAction({
  actionName: 'Approve',
  notificationTopic: new sns.Topic(this, 'Topic'), // optional
  notifyEmails: [
    'some_email@example.com',
  ], // optional
  additionalInformation: 'additional info', // optional
});
approveStage.addAction(manualApprovalAction);
// `manualApprovalAction.notificationTopic` can be used to access the Topic
// after the Action has been added to a Pipeline
```

If the `notificationTopic` has not been provided,
but `notifyEmails` were,
a new SNS Topic will be created
(and accessible through the `notificationTopic` property of the Action).

### AWS Lambda

This module contains an Action that allows you to invoke a Lambda function in a Pipeline:

```ts
import * as lambda from '@aws-cdk/aws-lambda';

const pipeline = new codepipeline.Pipeline(this, 'MyPipeline');
const lambdaAction = new codepipeline_actions.LambdaInvokeAction({
  actionName: 'Lambda',
  lambda: fn,
});
pipeline.addStage({
  stageName: 'Lambda',
  actions: [lambdaAction],
});
```

The Lambda Action can have up to 5 inputs,
and up to 5 outputs:

```ts

const lambdaAction = new codepipeline_actions.LambdaInvokeAction({
  actionName: 'Lambda',
  inputs: [
    sourceOutput,
    buildOutput,
  ],
  outputs: [
    new codepipeline.Artifact('Out1'),
    new codepipeline.Artifact('Out2'),
  ],
  lambda: fn
});
```

The Lambda invoke action emits variables.
Unlike many other actions, the variables are not static,
but dynamic, defined by the function calling the `PutJobSuccessResult`
API with the `outputVariables` property filled with the map of variables
Example:

```ts
import * as lambda from '@aws-cdk/aws-lambda';

const lambdaInvokeAction = new codepipeline_actions.LambdaInvokeAction({
  actionName: 'Lambda',
  lambda: new lambda.Function(this, 'Func', {
    runtime: lambda.Runtime.NODEJS_12_X,
    handler: 'index.handler',
    code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');

        exports.handler = async function(event, context) {
            const codepipeline = new AWS.CodePipeline();
            await codepipeline.putJobSuccessResult({
                jobId: event['CodePipeline.job'].id,
                outputVariables: {
                    MY_VAR: "some value",
                },
            }).promise();
        }
    `),
  }),
  variablesNamespace: 'MyNamespace', // optional - by default, a name will be generated for you
});

// later:

new codepipeline_actions.CodeBuildAction({
  // ...
  environmentVariables: {
    MyVar: {
      value: lambdaInvokeAction.variable('MY_VAR'),
    },
  },
});
```

See [the AWS documentation](https://docs.aws.amazon.com/codepipeline/latest/userguide/actions-invoke-lambda-function.html)
on how to write a Lambda function invoked from CodePipeline.

### AWS Step Functions

This module contains an Action that allows you to invoke a Step Function in a Pipeline:

```ts
import * as stepfunction from '@aws-cdk/aws-stepfunctions';

const pipeline = new codepipeline.Pipeline(this, 'MyPipeline');
const startState = new stepfunction.Pass(stack, 'StartState');
const simpleStateMachine  = new stepfunction.StateMachine(stack, 'SimpleStateMachine', {
  definition: startState,
});
const stepFunctionAction = new codepipeline_actions.StepFunctionsInvokeAction({
  actionName: 'Invoke',
  stateMachine: simpleStateMachine,
  stateMachineInput: codepipeline_actions.StateMachineInput.literal({ IsHelloWorldExample: true }),
});
pipeline.addStage({
  stageName: 'StepFunctions',
  actions: [stepFunctionAction],
});
```

The `StateMachineInput` can be created with one of 2 static factory methods:
`literal`, which takes an arbitrary map as its only argument, or `filePath`:

```ts
import * as stepfunction from '@aws-cdk/aws-stepfunctions';

const pipeline = new codepipeline.Pipeline(this, 'MyPipeline');
const inputArtifact = new codepipeline.Artifact();
const startState = new stepfunction.Pass(stack, 'StartState');
const simpleStateMachine  = new stepfunction.StateMachine(stack, 'SimpleStateMachine', {
  definition: startState,
});
const stepFunctionAction = new codepipeline_actions.StepFunctionsInvokeAction({
  actionName: 'Invoke',
  stateMachine: simpleStateMachine,
  stateMachineInput: codepipeline_actions.StateMachineInput.filePath(inputArtifact.atPath('assets/input.json')),
});
pipeline.addStage({
  stageName: 'StepFunctions',
  actions: [stepFunctionAction],
});
```

See [the AWS documentation](https://docs.aws.amazon.com/codepipeline/latest/userguide/action-reference-StepFunctions.html)
for information on Action structure reference.
