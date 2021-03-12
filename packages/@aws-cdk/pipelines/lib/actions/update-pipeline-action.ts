import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as cpactions from '@aws-cdk/aws-codepipeline-actions';
import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import { AssetManifestArtifact, CloudArtifact, CloudFormationStackArtifact } from '@aws-cdk/cx-api';
import { Construct } from 'constructs';
import { AssetManifestReader, DockerImageManifestEntry, FileManifestEntry } from '../private/asset-manifest';
import { cloudAssemblyForStage, embeddedAsmPath, stageOrAppOf } from '../private/construct-internals';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct, Fn } from '@aws-cdk/core';

/**
 * Props for the UpdatePipelineAction
 */
export interface UpdatePipelineActionProps {
  /**
   * The CodePipeline artifact that holds the Cloud Assembly.
   */
  readonly cloudAssemblyInput: codepipeline.Artifact;

  /**
   * Name of the pipeline stack
   */
  readonly pipelineStackName: string;

  /**
   * Version of CDK CLI to 'npm install'.
   *
   * @default - Latest version
   */
  readonly cdkCliVersion?: string;

  /**
   * Name of the CodeBuild project
   *
   * @default - Automatically generated
   */
  readonly projectName?: string;
}

/**
 * Action to self-mutate the pipeline
 *
 * Creates a CodeBuild project which will use the CDK CLI
 * to deploy the pipeline stack.
 *
 * You do not need to instantiate this action -- it will automatically
 * be added by the pipeline.
 */
export class UpdatePipelineAction extends CoreConstruct implements codepipeline.IAction {
  private readonly action: codepipeline.IAction;

  constructor(scope: Construct, id: string, props: UpdatePipelineActionProps) {
    super(scope, id);

    const roleArnsForCdkDeploy: string[] = [];

    const cloudAssembly = cloudAssemblyForStage(stageOrAppOf(scope));
    // TODO is props.pipelineStackName really the key?
    const artifactManifest = cloudAssembly.manifest.artifacts?.[props.pipelineStackName];
    if (!artifactManifest) {
      throw new Error('Missing pipeline artifact manifest');
    }
    const cloudArtifact = CloudArtifact.fromManifest(cloudAssembly, props.pipelineStackName /* TODO correct? */, artifactManifest);
    if (!(cloudArtifact instanceof CloudFormationStackArtifact)) {
      throw new Error('Pipeline cloud artifact was not a CloudFormationStackArtifact');
    }

    if (cloudArtifact.assumeRoleArn) {
      roleArnsForCdkDeploy.push(cloudArtifact.assumeRoleArn);
    }

    artifactManifest.dependencies?.forEach((dependencyId) => {
      const depCloudArtifact = CloudArtifact.fromManifest(cloudAssembly, dependencyId, artifactManifest);
      if ((depCloudArtifact instanceof AssetManifestArtifact)) {
        const assetManifest = AssetManifestReader.fromFile(depCloudArtifact.file);
        assetManifest.entries.forEach((entry) => {
          if (entry instanceof FileManifestEntry || entry instanceof DockerImageManifestEntry) {
            if (entry.destination.assumeRoleArn) {
              roleArnsForCdkDeploy.push(entry.destination.assumeRoleArn);
            }
          }
        });
      }
    });

    const installSuffix = props.cdkCliVersion ? `@${props.cdkCliVersion}` : '';

    const selfMutationProject = new codebuild.PipelineProject(this, 'SelfMutation', {
      projectName: props.projectName,
      environment: { buildImage: codebuild.LinuxBuildImage.STANDARD_4_0 },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: `npm install -g aws-cdk${installSuffix}`,
          },
          build: {
            commands: [
              // Cloud Assembly is in *current* directory.
              `cdk -a ${embeddedAsmPath(scope)} deploy ${props.pipelineStackName} --require-approval=never --verbose`,
            ],
          },
        },
      }),
    });

    // allow the self-mutating project permissions to assume the bootstrap Action role
    selfMutationProject.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sts:AssumeRole'],
      resources: roleArnsForCdkDeploy.map((arn) => Fn.sub(arn)),
    }));
    // allow assuming any role in a different account
    // because custom names may have been used
    selfMutationProject.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sts:AssumeRole'],
      notResources: [Fn.sub('arn:${AWS::Partition}:iam::${AWS::AccountId}:role/*')],
    }));
    selfMutationProject.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cloudformation:DescribeStacks'],
      resources: ['*'], // this is needed to check the status of the bootstrap stack when doing `cdk deploy`
    }));
    // S3 checks for the presence of the ListBucket permission
    selfMutationProject.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:ListBucket'],
      resources: ['*'],
    }));
    this.action = new cpactions.CodeBuildAction({
      actionName: 'SelfMutate',
      input: props.cloudAssemblyInput,
      project: selfMutationProject,
      // Add this purely so that the pipeline will selfupdate if the CLI version changes
      environmentVariables: props.cdkCliVersion ? {
        CDK_CLI_VERSION: { value: props.cdkCliVersion },
      } : undefined,
    });
  }

  /**
   * Exists to implement IAction
   */
  public bind(scope: CoreConstruct, stage: codepipeline.IStage, options: codepipeline.ActionBindOptions):
  codepipeline.ActionConfig {
    return this.action.bind(scope, stage, options);
  }

  /**
   * Exists to implement IAction
   */
  public onStateChange(name: string, target?: events.IRuleTarget, options?: events.RuleProps): events.Rule {
    return this.action.onStateChange(name, target, options);
  }

  /**
   * Exists to implement IAction
   */
  public get actionProperties(): codepipeline.ActionProperties {
    // FIXME: I have had to make this class a Construct, because:
    //
    // - It needs access to the Construct tree, because it is going to add a `PipelineProject`.
    // - I would have liked to have done that in bind(), however,
    // - `actionProperties` (this method) is called BEFORE bind() is called, and by that point I
    //   don't have the "inner" Action yet to forward the call to.
    //
    // I've therefore had to construct the inner CodeBuildAction in the constructor, which requires making this
    // Action a Construct.
    //
    // Combined with how non-intuitive it is to make the "StackDeployAction", I feel there is something
    // wrong with the Action abstraction here.
    return this.action.actionProperties;
  }
}
