import * as path from 'path';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import { Annotations, App, Aws, CfnOutput, Fn, Lazy, PhysicalName, Stack, Stage } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { AssetType, DeployCdkStackAction, PublishAssetsAction, UpdatePipelineAction } from './actions';
import { dockerCredentialsInstallCommands, DockerCredential, DockerCredentialUsage } from './docker-credentials';
import { appOf, assemblyBuilderOf } from './private/construct-internals';
import { AddStageOptions, AssetPublishingCommand, CdkStage, StackOutput } from './stage';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';
import { SimpleSynthAction } from './synths';

const CODE_BUILD_LENGTH_LIMIT = 100;
/**
 * Properties for a CdkPipeline
 */
export interface CdkPipelineProps {
  /**
   * The CodePipeline action used to retrieve the CDK app's source
   *
   * @default - Required unless `codePipeline` is given
   */
  readonly sourceAction?: codepipeline.IAction;

  /**
   * The CodePipeline action build and synthesis step of the CDK app
   *
   * @default - Required unless `codePipeline` or `sourceAction` is given
   */
  readonly synthAction?: codepipeline.IAction;

  /**
   * The artifact you have defined to be the artifact to hold the cloudAssemblyArtifact for the synth action
   */
  readonly cloudAssemblyArtifact: codepipeline.Artifact;

  /**
   * Existing CodePipeline to add deployment stages to
   *
   * Use this if you want more control over the CodePipeline that gets created.
   * You can choose to not pass this value, in which case a new CodePipeline is
   * created with default settings.
   *
   * If you pass an existing CodePipeline, it should should have been created
   * with `restartExecutionOnUpdate: true`.
   *
   * [disable-awslint:ref-via-interface]
   *
   * @default - A new CodePipeline is automatically generated
   */
  readonly codePipeline?: codepipeline.Pipeline;

  /**
   * Name of the pipeline
   *
   * Can only be set if `codePipeline` is not set.
   *
   * @default - A name is automatically generated
   */
  readonly pipelineName?: string;

  /**
   * Create KMS keys for cross-account deployments
   *
   * This controls whether the pipeline is enabled for cross-account deployments.
   *
   * Can only be set if `codePipeline` is not set.
   *
   * By default cross-account deployments are enabled, but this feature requires
   * that KMS Customer Master Keys are created which have a cost of $1/month.
   *
   * If you do not need cross-account deployments, you can set this to `false` to
   * not create those keys and save on that cost (the artifact bucket will be
   * encrypted with an AWS-managed key). However, cross-account deployments will
   * no longer be possible.
   *
   * @default true
   */
  readonly crossAccountKeys?: boolean;
  // @deprecated(v2): switch to default false

  /**
   * CDK CLI version to use in pipeline
   *
   * Some Actions in the pipeline will download and run a version of the CDK
   * CLI. Specify the version here.
   *
   * @default - Latest version
   */
  readonly cdkCliVersion?: string;

  /**
   * The VPC where to execute the CdkPipeline actions.
   *
   * @default - No VPC
   */
  readonly vpc?: ec2.IVpc;

  /**
   * Which subnets to use.
   *
   * Only used if 'vpc' is supplied.
   *
   * @default - All private subnets.
   */
  readonly subnetSelection?: ec2.SubnetSelection;

  /**
   * Whether the pipeline will update itself
   *
   * This needs to be set to `true` to allow the pipeline to reconfigure
   * itself when assets or stages are being added to it, and `true` is the
   * recommended setting.
   *
   * You can temporarily set this to `false` while you are iterating
   * on the pipeline itself and prefer to deploy changes using `cdk deploy`.
   *
   * @default true
   */
  readonly selfMutating?: boolean;

  /**
   * Custom BuildSpec that is merged with generated one (for self-mutation stage)
   *
   * @default - none
   */
  readonly selfMutationBuildSpec?: codebuild.BuildSpec;

  /**
   * Whether this pipeline creates one asset upload action per asset type or one asset upload per asset
   *
   * @default false
   */
  readonly singlePublisherPerType?: boolean;

  /**
   * Additional commands to run before installing cdk-assets during the asset publishing step
   * Use this to setup proxies or npm mirrors
   *
   * @default -
   */
  readonly assetPreInstallCommands?: string[];

  /**
   * Custom BuildSpec that is merged with generated one (for asset publishing actions)
   *
   * @default - none
   */
  readonly assetBuildSpec?: codebuild.BuildSpec;

  /**
   * Whether the pipeline needs to build Docker images in the UpdatePipeline stage.
   *
   * If the UpdatePipeline stage tries to build a Docker image and this flag is not
   * set to `true`, the build step will run in non-privileged mode and consequently
   * will fail with a message like:
   *
   * > Cannot connect to the Docker daemon at unix:///var/run/docker.sock.
   * > Is the docker daemon running?
   *
   * This flag has an effect only if `selfMutating` is also `true`.
   *
   * @default - false
   */
  readonly supportDockerAssets?: boolean;

  /**
   * A list of credentials used to authenticate to Docker registries.
   *
   * Specify any credentials necessary within the pipeline to build, synth, update, or publish assets.
   *
   * @default []
   */
  readonly dockerCredentials?: DockerCredential[];
}

/**
 * A Pipeline to deploy CDK apps
 *
 * Defines an AWS CodePipeline-based Pipeline to deploy CDK applications.
 *
 * Automatically manages the following:
 *
 * - Stack dependency order.
 * - Asset publishing.
 * - Keeping the pipeline up-to-date as the CDK apps change.
 * - Using stack outputs later on in the pipeline.
 */
export class CdkPipeline extends CoreConstruct {
  private readonly _pipeline: codepipeline.Pipeline;
  private readonly _assets: AssetPublishing;
  private readonly _stages: CdkStage[] = [];
  private readonly _outputArtifacts: Record<string, codepipeline.Artifact> = {};
  private readonly _cloudAssemblyArtifact: codepipeline.Artifact;
  private readonly _dockerCredentials: DockerCredential[];

  constructor(scope: Construct, id: string, props: CdkPipelineProps) {
    super(scope, id);

    if (!App.isApp(this.node.root)) {
      throw new Error('CdkPipeline must be created under an App');
    }

    this._cloudAssemblyArtifact = props.cloudAssemblyArtifact;
    this._dockerCredentials = props.dockerCredentials ?? [];
    const pipelineStack = Stack.of(this);

    if (props.codePipeline) {
      if (props.pipelineName) {
        throw new Error('Cannot set \'pipelineName\' if an existing CodePipeline is given using \'codePipeline\'');
      }
      if (props.crossAccountKeys !== undefined) {
        throw new Error('Cannot set \'crossAccountKeys\' if an existing CodePipeline is given using \'codePipeline\'');
      }

      this._pipeline = props.codePipeline;
    } else {
      this._pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
        pipelineName: props.pipelineName,
        crossAccountKeys: props.crossAccountKeys,
        restartExecutionOnUpdate: true,
      });
    }

    if (props.sourceAction && !props.synthAction) {
      // Because of ordering limitations, you can: bring your own Source, bring your own
      // Both, or bring your own Nothing. You cannot bring your own Build (which because of the
      // current CodePipeline API must go BEFORE what we're adding) and then having us add a
      // Source after it. That doesn't make any sense.
      throw new Error('When passing a \'sourceAction\' you must also pass a \'synthAction\' (or a \'codePipeline\' that already has both)');
    }
    if (!props.sourceAction && (!props.codePipeline || props.codePipeline.stages.length < 1)) {
      throw new Error('You must pass a \'sourceAction\' (or a \'codePipeline\' that already has a Source stage)');
    }

    if (props.sourceAction) {
      this._pipeline.addStage({
        stageName: 'Source',
        actions: [props.sourceAction],
      });
    }

    if (props.synthAction) {
      if (props.synthAction instanceof SimpleSynthAction && this._dockerCredentials.length > 0) {
        props.synthAction._addDockerCredentials(this._dockerCredentials);
      }

      this._pipeline.addStage({
        stageName: 'Build',
        actions: [props.synthAction],
      });
    }

    if (props.selfMutating ?? true) {
      this._pipeline.addStage({
        stageName: 'UpdatePipeline',
        actions: [new UpdatePipelineAction(this, 'UpdatePipeline', {
          cloudAssemblyInput: this._cloudAssemblyArtifact,
          pipelineStackHierarchicalId: pipelineStack.node.path,
          cdkCliVersion: props.cdkCliVersion,
          projectName: maybeSuffix(props.pipelineName, '-selfupdate'),
          privileged: props.supportDockerAssets,
          dockerCredentials: this._dockerCredentials,
          buildSpec: props.selfMutationBuildSpec,
        })],
      });
    }

    this._assets = new AssetPublishing(this, 'Assets', {
      cloudAssemblyInput: this._cloudAssemblyArtifact,
      cdkCliVersion: props.cdkCliVersion,
      pipeline: this._pipeline,
      projectName: maybeSuffix(props.pipelineName, '-publish'),
      vpc: props.vpc,
      subnetSelection: props.subnetSelection,
      singlePublisherPerType: props.singlePublisherPerType,
      preInstallCommands: props.assetPreInstallCommands,
      buildSpec: props.assetBuildSpec,
      dockerCredentials: this._dockerCredentials,
    });
  }

  /**
   * The underlying CodePipeline object
   *
   * You can use this to add more Stages to the pipeline, or Actions
   * to Stages.
   */
  public get codePipeline(): codepipeline.Pipeline {
    return this._pipeline;
  }

  /**
   * Access one of the pipeline's stages by stage name
   *
   * You can use this to add more Actions to a stage.
   */
  public stage(stageName: string): codepipeline.IStage {
    return this._pipeline.stage(stageName);
  }

  /**
   * Add pipeline stage that will deploy the given application stage
   *
   * The application construct should subclass `Stage` and can contain any
   * number of `Stacks` inside it that may have dependency relationships
   * on one another.
   *
   * All stacks in the application will be deployed in the appropriate order,
   * and all assets found in the application will be added to the asset
   * publishing stage.
   */
  public addApplicationStage(appStage: Stage, options: AddStageOptions = {}): CdkStage {
    const stage = this.addStage(appStage.stageName);
    stage.addApplication(appStage, options);
    return stage;
  }

  /**
   * Add a new, empty stage to the pipeline
   *
   * Prefer to use `addApplicationStage` if you are intended to deploy a CDK
   * application, but you can use this method if you want to add other kinds of
   * Actions to a pipeline.
   */
  public addStage(stageName: string) {
    const pipelineStage = this._pipeline.addStage({
      stageName,
    });

    const stage = new CdkStage(this, stageName, {
      cloudAssemblyArtifact: this._cloudAssemblyArtifact,
      pipelineStage,
      stageName,
      host: {
        publishAsset: this._assets.addPublishAssetAction.bind(this._assets),
        stackOutputArtifact: (artifactId) => this._outputArtifacts[artifactId],
      },
    });
    this._stages.push(stage);
    return stage;
  }

  /**
   * Get the StackOutput object that holds this CfnOutput's value in this pipeline
   *
   * `StackOutput` can be used in validation actions later in the pipeline.
   */
  public stackOutput(cfnOutput: CfnOutput): StackOutput {
    const stack = Stack.of(cfnOutput);

    if (!this._outputArtifacts[stack.artifactId]) {
      // We should have stored the ArtifactPath in the map, but its Artifact
      // property isn't publicly readable...
      const artifactName = `${stack.artifactId}_Outputs`;
      const compactName = artifactName.slice(artifactName.length - Math.min(artifactName.length, CODE_BUILD_LENGTH_LIMIT));
      this._outputArtifacts[stack.artifactId] = new codepipeline.Artifact(compactName);
    }

    return new StackOutput(this._outputArtifacts[stack.artifactId].atPath('outputs.json'), cfnOutput.logicalId);
  }

  /**
   * Validate that we don't have any stacks violating dependency order in the pipeline
   *
   * Our own convenience methods will never generate a pipeline that does that (although
   * this is a nice verification), but a user can also add the stacks by hand.
   */
  protected validate(): string[] {
    const ret = new Array<string>();

    ret.push(...this.validateDeployOrder());
    ret.push(...this.validateRequestedOutputs());

    return ret;
  }

  /**
   * Return all StackDeployActions in an ordered list
   */
  private get stackActions(): DeployCdkStackAction[] {
    return flatMap(this._pipeline.stages, s => s.actions.filter(isDeployAction));
  }

  private * validateDeployOrder(): IterableIterator<string> {
    const stackActions = this.stackActions;
    for (const stackAction of stackActions) {
      // For every dependency, it must be executed in an action before this one is prepared.
      for (const depId of stackAction.dependencyStackArtifactIds) {
        const depAction = stackActions.find(s => s.stackArtifactId === depId);

        if (depAction === undefined) {
          Annotations.of(this).addWarning(`Stack '${stackAction.stackName}' depends on stack ` +
            `'${depId}', but that dependency is not deployed through the pipeline!`);
        } else if (!(depAction.executeRunOrder < stackAction.prepareRunOrder)) {
          yield `Stack '${stackAction.stackName}' depends on stack ` +
            `'${depAction.stackName}', but is deployed before it in the pipeline!`;
        }
      }
    }
  }

  private * validateRequestedOutputs(): IterableIterator<string> {
    const artifactIds = this.stackActions.map(s => s.stackArtifactId);

    for (const artifactId of Object.keys(this._outputArtifacts)) {
      if (!artifactIds.includes(artifactId)) {
        yield `Trying to use outputs for Stack '${artifactId}', but Stack is not deployed in this pipeline. Add it to the pipeline.`;
      }
    }
  }
}

function isDeployAction(a: codepipeline.IAction): a is DeployCdkStackAction {
  return a instanceof DeployCdkStackAction;
}

function flatMap<A, B>(xs: A[], f: (x: A) => B[]): B[] {
  return Array.prototype.concat([], ...xs.map(f));
}

interface AssetPublishingProps {
  readonly cloudAssemblyInput: codepipeline.Artifact;
  readonly pipeline: codepipeline.Pipeline;
  readonly cdkCliVersion?: string;
  readonly projectName?: string;
  readonly vpc?: ec2.IVpc;
  readonly subnetSelection?: ec2.SubnetSelection;
  readonly singlePublisherPerType?: boolean;
  readonly preInstallCommands?: string[];
  readonly buildSpec?: codebuild.BuildSpec;
  readonly dockerCredentials: DockerCredential[];
}

/**
 * Add appropriate publishing actions to the asset publishing stage
 */
class AssetPublishing extends CoreConstruct {
  // CodePipelines has a hard limit of 50 actions per stage. See https://github.com/aws/aws-cdk/issues/9353
  private readonly MAX_PUBLISHERS_PER_STAGE = 50;

  private readonly publishers: Record<string, PublishAssetsAction> = {};
  private readonly assetRoles: Record<string, iam.IRole> = {};
  private readonly assetAttachedPolicies: Record<string, iam.Policy> = {};
  private readonly assetPublishingRoles: Record<string, Set<string>> = {};
  private readonly myCxAsmRoot: string;

  private readonly lastStageBeforePublishing?: codepipeline.IStage;
  private readonly stages: codepipeline.IStage[] = [];
  private readonly pipeline: codepipeline.Pipeline;
  private readonly dockerCredentials: DockerCredential[];

  private _fileAssetCtr = 0;
  private _dockerAssetCtr = 0;

  constructor(scope: Construct, id: string, private readonly props: AssetPublishingProps) {
    super(scope, id);
    this.myCxAsmRoot = path.resolve(assemblyBuilderOf(appOf(this)).outdir);

    this.pipeline = this.props.pipeline;
    // Hacks to get access to the innards of Pipeline
    const stages: codepipeline.IStage[] = (this.props.pipeline as any)._stages;
    // Any asset publishing stages will be added directly after the last stage that currently exists.
    this.lastStageBeforePublishing = stages.slice(-1)[0];

    this.dockerCredentials = props.dockerCredentials;
  }

  /**
   * Make sure there is an action in the stage to publish the given asset
   *
   * Assets are grouped by asset ID (which represent individual assets) so all assets
   * are published in parallel. For each assets, all destinations are published sequentially
   * so that we can reuse expensive operations between them (mostly: building a Docker image).
   */
  public addPublishAssetAction(command: AssetPublishingCommand) {
    // FIXME: this is silly, we need the relative path here but no easy way to get it
    const relativePath = path.relative(this.myCxAsmRoot, command.assetManifestPath);

    // The path cannot be outside the asm root. I don't really understand how this could ever
    // come to pass, but apparently it has (see https://github.com/aws/aws-cdk/issues/9766).
    // Add a sanity check here so we can catch it more quickly next time.
    if (relativePath.startsWith(`..${path.sep}`)) {
      throw new Error(`The asset manifest (${command.assetManifestPath}) cannot be outside the Cloud Assembly directory (${this.myCxAsmRoot}). Please report this error at https://github.com/aws/aws-cdk/issues to help us debug why this is happening.`);
    }

    // Late-binding here (rather than in the constructor) to prevent creating the role in cases where no asset actions are created.
    if (!this.assetRoles[command.assetType]) {
      this.generateAssetRole(command.assetType);
    }
    this.assetPublishingRoles[command.assetType] = (this.assetPublishingRoles[command.assetType] ?? new Set()).add(command.assetPublishingRoleArn);

    const publisherKey = this.props.singlePublisherPerType ? command.assetType.toString() : command.assetId;

    let action = this.publishers[publisherKey];
    if (!action) {
      // Dynamically create new stages as needed, with `MAX_PUBLISHERS_PER_STAGE` assets per stage.
      const stageIndex = this.props.singlePublisherPerType ? 0 :
        Math.floor((this._fileAssetCtr + this._dockerAssetCtr) / this.MAX_PUBLISHERS_PER_STAGE);

      if (!this.props.singlePublisherPerType && stageIndex >= this.stages.length) {
        const previousStage = this.stages.slice(-1)[0] ?? this.lastStageBeforePublishing;
        this.stages.push(this.pipeline.addStage({
          stageName: `Assets${stageIndex > 0 ? stageIndex + 1 : ''}`,
          placement: { justAfter: previousStage },
        }));
      } else if (this.props.singlePublisherPerType && this.stages.length == 0) {
        this.stages.push(this.pipeline.addStage({
          stageName: 'Assets',
          placement: { justAfter: this.lastStageBeforePublishing },
        }));
      }

      // The asset ID would be a logical candidate for the construct path and project names, but if the asset
      // changes it leads to recreation of a number of Role/Policy/Project resources which is slower than
      // necessary. Number sequentially instead.
      //
      // FIXME: The ultimate best solution is probably to generate a single Project per asset type
      // and reuse that for all assets.
      const id = this.props.singlePublisherPerType ?
        command.assetType === AssetType.FILE ? 'FileAsset' : 'DockerAsset' :
        command.assetType === AssetType.FILE ? `FileAsset${++this._fileAssetCtr}` : `DockerAsset${++this._dockerAssetCtr}`;

      const credsInstallCommands = dockerCredentialsInstallCommands(DockerCredentialUsage.ASSET_PUBLISHING, this.dockerCredentials);

      // NOTE: It's important that asset changes don't force a pipeline self-mutation.
      // This can cause an infinite loop of updates (see https://github.com/aws/aws-cdk/issues/9080).
      // For that reason, we use the id as the actionName below, rather than the asset hash.
      action = this.publishers[publisherKey] = new PublishAssetsAction(this, id, {
        actionName: id,
        cloudAssemblyInput: this.props.cloudAssemblyInput,
        cdkCliVersion: this.props.cdkCliVersion,
        assetType: command.assetType,
        role: this.assetRoles[command.assetType],
        dependable: this.assetAttachedPolicies[command.assetType],
        vpc: this.props.vpc,
        subnetSelection: this.props.subnetSelection,
        buildSpec: this.props.buildSpec,
        createBuildspecFile: this.props.singlePublisherPerType,
        preInstallCommands: [...(this.props.preInstallCommands ?? []), ...credsInstallCommands],
      });
      this.stages[stageIndex].addAction(action);
    }

    action.addPublishCommand(relativePath, command.assetSelector);
  }

  /**
   * This role is used by both the CodePipeline build action and related CodeBuild project. Consolidating these two
   * roles into one, and re-using across all assets, saves significant size of the final synthesized output.
   * Modeled after the CodePipeline role and 'CodePipelineActionRole' roles.
   * Generates one role per asset type to separate file and Docker/image-based permissions.
   */
  private generateAssetRole(assetType: AssetType) {
    if (this.assetRoles[assetType]) { return this.assetRoles[assetType]; }

    const rolePrefix = assetType === AssetType.DOCKER_IMAGE ? 'Docker' : 'File';
    const assetRole = new iam.Role(this, `${rolePrefix}Role`, {
      roleName: PhysicalName.GENERATE_IF_NEEDED,
      assumedBy: new iam.CompositePrincipal(new iam.ServicePrincipal('codebuild.amazonaws.com'), new iam.AccountPrincipal(Stack.of(this).account)),
    });

    // Logging permissions
    const logGroupArn = Stack.of(this).formatArn({
      service: 'logs',
      resource: 'log-group',
      sep: ':',
      resourceName: '/aws/codebuild/*',
    });
    assetRole.addToPolicy(new iam.PolicyStatement({
      resources: [logGroupArn],
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
    }));

    // CodeBuild report groups
    const codeBuildArn = Stack.of(this).formatArn({
      service: 'codebuild',
      resource: 'report-group',
      resourceName: '*',
    });
    assetRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'codebuild:CreateReportGroup',
        'codebuild:CreateReport',
        'codebuild:UpdateReport',
        'codebuild:BatchPutTestCases',
        'codebuild:BatchPutCodeCoverages',
      ],
      resources: [codeBuildArn],
    }));

    // CodeBuild start/stop
    assetRole.addToPolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: [
        'codebuild:BatchGetBuilds',
        'codebuild:StartBuild',
        'codebuild:StopBuild',
      ],
    }));

    // Publishing role access
    // The ARNs include raw AWS pseudo parameters (e.g., ${AWS::Partition}), which need to be substituted.
    // Lazy-evaluated so all asset publishing roles are included.
    assetRole.addToPolicy(new iam.PolicyStatement({
      actions: ['sts:AssumeRole'],
      resources: Lazy.list({ produce: () => [...this.assetPublishingRoles[assetType]].map(arn => Fn.sub(arn)) }),
    }));

    // Grant pull access for any ECR registries and secrets that exist
    if (assetType === AssetType.DOCKER_IMAGE) {
      this.dockerCredentials.forEach(reg => reg.grantRead(assetRole, DockerCredentialUsage.ASSET_PUBLISHING));
    }

    // Artifact access
    this.pipeline.artifactBucket.grantRead(assetRole);

    // VPC permissions required for CodeBuild
    // Normally CodeBuild itself takes care of this but we're creating a singleton role so now
    // we need to do this.
    if (this.props.vpc) {
      const vpcPolicy = new iam.Policy(assetRole, 'VpcPolicy', {
        statements: [
          new iam.PolicyStatement({
            resources: [`arn:${Aws.PARTITION}:ec2:${Aws.REGION}:${Aws.ACCOUNT_ID}:network-interface/*`],
            actions: ['ec2:CreateNetworkInterfacePermission'],
            conditions: {
              StringEquals: {
                'ec2:Subnet': this.props.vpc
                  .selectSubnets(this.props.subnetSelection).subnetIds
                  .map(si => `arn:${Aws.PARTITION}:ec2:${Aws.REGION}:${Aws.ACCOUNT_ID}:subnet/${si}`),
                'ec2:AuthorizedService': 'codebuild.amazonaws.com',
              },
            },
          }),
          new iam.PolicyStatement({
            resources: ['*'],
            actions: [
              'ec2:CreateNetworkInterface',
              'ec2:DescribeNetworkInterfaces',
              'ec2:DeleteNetworkInterface',
              'ec2:DescribeSubnets',
              'ec2:DescribeSecurityGroups',
              'ec2:DescribeDhcpOptions',
              'ec2:DescribeVpcs',
            ],
          }),
        ],
      });
      assetRole.attachInlinePolicy(vpcPolicy);
      this.assetAttachedPolicies[assetType] = vpcPolicy;
    }

    this.assetRoles[assetType] = assetRole.withoutPolicyUpdates();
    return this.assetRoles[assetType];
  }
}

function maybeSuffix(x: string | undefined, suffix: string): string | undefined {
  if (x === undefined) { return undefined; }
  return `${x}${suffix}`;
}
