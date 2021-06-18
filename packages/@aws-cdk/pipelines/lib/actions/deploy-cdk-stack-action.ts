import * as fs from 'fs';
import * as path from 'path';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as cpactions from '@aws-cdk/aws-codepipeline-actions';
import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import { Aws, CfnCapabilities, Stack } from '@aws-cdk/core';
import * as cxapi from '@aws-cdk/cx-api';
import { Construct, Node } from 'constructs';
import { appOf, assemblyBuilderOf } from '../private/construct-internals';
import { toPosixPath } from '../private/fs';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';

/**
 * Customization options for a DeployCdkStackAction
 */
export interface DeployCdkStackActionOptions {
  /**
   * Base name of the action
   *
   * @default stackName
   */
  readonly baseActionName?: string;

  /**
   * The CodePipeline artifact that holds the Cloud Assembly.
   */
  readonly cloudAssemblyInput: codepipeline.Artifact;

  /**
   * Run order for the Prepare action
   *
   * @default 1
   */
  readonly prepareRunOrder?: number;

  /**
   * Run order for the Execute action
   *
   * @default - prepareRunOrder + 1
   */
  readonly executeRunOrder?: number;

  /**
   * Artifact to write Stack Outputs to
   *
   * @default - No outputs
   */
  readonly output?: codepipeline.Artifact;

  /**
   * Filename in output to write Stack outputs to
   *
   * @default - Required when 'output' is set
   */
  readonly outputFileName?: string;

  /**
   * Name of the change set to create and deploy
   *
   * @default 'PipelineChange'
   */
  readonly changeSetName?: string;
}

/**
 * Properties for a DeployCdkStackAction
 */
export interface DeployCdkStackActionProps extends DeployCdkStackActionOptions {
  /**
   * Relative path of template in the input artifact
   */
  readonly templatePath: string;

  /**
   * Role for the action to assume
   *
   * This controls the account to deploy into
   */
  readonly actionRole: iam.IRole;

  /**
   * The name of the stack that should be created/updated
   */
  readonly stackName: string;

  /**
   * Role to execute CloudFormation under
   *
   * @default - Execute CloudFormation using the action role
   */
  readonly cloudFormationExecutionRole?: iam.IRole;

  /**
   * Region to deploy into
   *
   * @default - Same region as pipeline
   */
  readonly region?: string;

  /**
   * Artifact ID for the stack deployed here
   *
   * Used for pipeline order checking.
   *
   * @default - Order will not be checked
   */
  readonly stackArtifactId?: string;

  /**
   * Artifact ID for the stacks this stack depends on
   *
   * Used for pipeline order checking.
   *
   * @default - No dependencies
   */
  readonly dependencyStackArtifactIds?: string[];

  /**
   * Template configuration path relative to the input artifact
   *
   * @default - No template configuration
   */
  readonly templateConfigurationPath?: string;
}

/**
 * Options for the 'fromStackArtifact' operation
 */
export interface CdkStackActionFromArtifactOptions extends DeployCdkStackActionOptions {
  /**
   * The name of the stack that should be created/updated
   *
   * @default - Same as stack artifact
   */
  readonly stackName?: string;
}

/**
 * Action to deploy a CDK Stack
 *
 * Adds two CodePipeline Actions to the pipeline: one to create a ChangeSet
 * and one to execute it.
 *
 * You do not need to instantiate this action yourself -- it will automatically
 * be added by the pipeline when you add stack artifacts or entire stages.
 */
export class DeployCdkStackAction implements codepipeline.IAction {
  /**
   * Construct a DeployCdkStackAction from a Stack artifact
   */
  public static fromStackArtifact(scope: Construct, artifact: cxapi.CloudFormationStackArtifact, options: CdkStackActionFromArtifactOptions) {
    if (!artifact.assumeRoleArn) {
      throw new Error(`Stack '${artifact.stackName}' does not have deployment role information; use the 'DefaultStackSynthesizer' synthesizer, or set the '@aws-cdk/core:newStyleStackSynthesis' context key.`);
    }

    const artRegion = artifact.environment.region;
    const region = artRegion === Stack.of(scope).region || artRegion === cxapi.UNKNOWN_REGION ? undefined : artRegion;
    const artAccount = artifact.environment.account;
    const account = artAccount === Stack.of(scope).account || artAccount === cxapi.UNKNOWN_ACCOUNT ? undefined : artAccount;

    const actionRole = roleFromPlaceholderArn(scope, region, account, artifact.assumeRoleArn);
    const cloudFormationExecutionRole = roleFromPlaceholderArn(scope, region, account, artifact.cloudFormationExecutionRoleArn);

    // We need the path of the template relative to the root Cloud Assembly
    // It should be easier to get this, but for now it is what it is.
    const appAsmRoot = assemblyBuilderOf(appOf(scope as CoreConstruct)).outdir;
    const fullTemplatePath = path.join(artifact.assembly.directory, artifact.templateFile);

    let fullConfigPath;
    if (Object.keys(artifact.tags).length > 0) {
      fullConfigPath = `${fullTemplatePath}.config.json`;

      // Write the template configuration file (for parameters into CreateChangeSet call that
      // cannot be configured any other way). They must come from a file, and there's unfortunately
      // no better hook to write this file (`construct.onSynthesize()` would have been the prime candidate
      // but that is being deprecated--and DeployCdkStackAction isn't even a construct).
      writeTemplateConfiguration(fullConfigPath, {
        Tags: artifact.tags,
      });
    }

    return new DeployCdkStackAction({
      actionRole,
      cloudFormationExecutionRole,
      templatePath: toPosixPath(path.relative(appAsmRoot, fullTemplatePath)),
      templateConfigurationPath: fullConfigPath ? toPosixPath(path.relative(appAsmRoot, fullConfigPath)) : undefined,
      region,
      stackArtifactId: artifact.id,
      dependencyStackArtifactIds: artifact.dependencies.filter(isStackArtifact).map(s => s.id),
      stackName: options.stackName ?? artifact.stackName,
      ...options,
    });
  }

  /**
   * The runorder for the prepare action
   */
  public readonly prepareRunOrder: number;

  /**
   * The runorder for the execute action
   */
  public readonly executeRunOrder: number;

  /**
   * Name of the deployed stack
   */
  public readonly stackName: string;

  /**
   * Artifact id of the artifact this action was based on
   */
  public readonly stackArtifactId?: string;

  /**
   * Artifact ids of the artifact this stack artifact depends on
   */
  public readonly dependencyStackArtifactIds: string[];

  private readonly prepareChangeSetAction: cpactions.CloudFormationCreateReplaceChangeSetAction;
  private readonly executeChangeSetAction: cpactions.CloudFormationExecuteChangeSetAction;

  constructor(props: DeployCdkStackActionProps) {
    if (props.output && !props.outputFileName) {
      throw new Error('If \'output\' is set, \'outputFileName\' is also required');
    }

    this.stackArtifactId = props.stackArtifactId;
    this.dependencyStackArtifactIds = props.dependencyStackArtifactIds ?? [];

    this.prepareRunOrder = props.prepareRunOrder ?? 1;
    this.executeRunOrder = props.executeRunOrder ?? this.prepareRunOrder + 1;
    this.stackName = props.stackName;
    const baseActionName = props.baseActionName ?? this.stackName;
    const changeSetName = props.changeSetName ?? 'PipelineChange';

    this.prepareChangeSetAction = new cpactions.CloudFormationCreateReplaceChangeSetAction({
      actionName: `${baseActionName}.Prepare`,
      changeSetName,
      runOrder: this.prepareRunOrder,
      stackName: this.stackName,
      templatePath: props.cloudAssemblyInput.atPath(props.templatePath),
      adminPermissions: false,
      role: props.actionRole,
      deploymentRole: props.cloudFormationExecutionRole,
      region: props.region,
      cfnCapabilities: [CfnCapabilities.NAMED_IAM, CfnCapabilities.AUTO_EXPAND],
      templateConfiguration: props.templateConfigurationPath ? props.cloudAssemblyInput.atPath(props.templateConfigurationPath) : undefined,
    });
    this.executeChangeSetAction = new cpactions.CloudFormationExecuteChangeSetAction({
      actionName: `${baseActionName}.Deploy`,
      changeSetName,
      runOrder: this.executeRunOrder,
      stackName: this.stackName,
      role: props.actionRole,
      region: props.region,
      outputFileName: props.outputFileName,
      output: props.output,
    });
  }

  /**
   * Exists to implement IAction
   */
  public bind(scope: CoreConstruct, stage: codepipeline.IStage, options: codepipeline.ActionBindOptions):
  codepipeline.ActionConfig {
    stage.addAction(this.prepareChangeSetAction);

    return this.executeChangeSetAction.bind(scope, stage, options);
  }

  /**
   * Exists to implement IAction
   */
  public onStateChange(name: string, target?: events.IRuleTarget, options?: events.RuleProps): events.Rule {
    return this.executeChangeSetAction.onStateChange(name, target, options);
  }

  /**
   * Exists to implement IAction
   */
  public get actionProperties(): codepipeline.ActionProperties {
    return this.executeChangeSetAction.actionProperties;
  }
}

function roleFromPlaceholderArn(scope: Construct, region: string | undefined,
  account: string | undefined, arn: string): iam.IRole;
function roleFromPlaceholderArn(scope: Construct, region: string | undefined,
  account: string | undefined, arn: string | undefined): iam.IRole | undefined;
function roleFromPlaceholderArn(scope: Construct, region: string | undefined,
    account: string | undefined, arn: string | undefined): iam.IRole | undefined {
  if (!arn) { return undefined; }

  // Use placeholdered arn as construct ID.
  const id = arn;

  // https://github.com/aws/aws-cdk/issues/7255
  let existingRole = Node.of(scope).tryFindChild(`ImmutableRole${id}`) as iam.IRole;
  if (existingRole) { return existingRole; }
  // For when #7255 is fixed.
  existingRole = Node.of(scope).tryFindChild(id) as iam.IRole;
  if (existingRole) { return existingRole; }

  const arnToImport = cxapi.EnvironmentPlaceholders.replace(arn, {
    region: region ?? Aws.REGION,
    accountId: account ?? Aws.ACCOUNT_ID,
    partition: Aws.PARTITION,
  });
  return iam.Role.fromRoleArn(scope, id, arnToImport, { mutable: false });
}

/**
 * Options for CdkDeployAction.fromStackArtifact
 */
export interface FromStackArtifactOptions {
  /**
   * The CodePipeline artifact that holds the Cloud Assembly.
   */
  readonly cloudAssemblyInput: codepipeline.Artifact;

  /**
   * Run order for the 2 actions that will be created
   *
   * @default 1
   */
  readonly prepareRunOrder?: number;

  /**
   * Run order for the Execute action
   *
   * @default - prepareRunOrder + 1
   */
  readonly executeRunOrder?: number;

  /**
   * Artifact to write Stack Outputs to
   *
   * @default - No outputs
   */
  readonly output?: codepipeline.Artifact;

  /**
   * Filename in output to write Stack outputs to
   *
   * @default - Required when 'output' is set
   */
  readonly outputFileName?: string;
}

function isStackArtifact(a: cxapi.CloudArtifact): a is cxapi.CloudFormationStackArtifact {
  // instanceof is too risky, and we're at a too late stage to properly fix.
  // return a instanceof cxapi.CloudFormationStackArtifact;
  return a.constructor.name === 'CloudFormationStackArtifact';
}

/**
 * Template configuration in a CodePipeline
 *
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/continuous-delivery-codepipeline-cfn-artifacts.html#w2ab1c13c17c15
 */
interface TemplateConfiguration {
  readonly Parameters?: Record<string, string>;
  readonly Tags?: Record<string, string>;
  readonly StackPolicy?: {
    readonly Statements: Array<Record<string, string>>;
  };
}

/**
 * Write template configuration to the given file
 */
function writeTemplateConfiguration(filename: string, config: TemplateConfiguration) {
  fs.writeFileSync(filename, JSON.stringify(config, undefined, 2), { encoding: 'utf-8' });
}
