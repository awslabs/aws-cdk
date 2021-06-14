import * as crypto from 'crypto';
import * as path from 'path';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import { Stack } from '@aws-cdk/core';
import { toPosixPath } from '../private/fs';
import { copyEnvironmentVariables, filterEmpty } from './_util';

const DEFAULT_OUTPUT_DIR = 'cdk.out';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/**
 * Configuration options for a SimpleSynth
 */
export interface SimpleSynthOptions {
  /**
   * The source artifact of the CodePipeline
   */
  readonly sourceArtifact: codepipeline.Artifact;

  /**
   * The artifact where the CloudAssembly should be emitted
   */
  readonly cloudAssemblyArtifact: codepipeline.Artifact;

  /**
   * Environment variables to send into build
   *
   * @default - No additional environment variables
   */
  readonly environmentVariables?: Record<string, codebuild.BuildEnvironmentVariable>;

  /**
   * Environment variables to copy over from parent env
   *
   * These are environment variables that are being used by the build.
   *
   * @default - No environment variables copied
   */
  readonly copyEnvironmentVariables?: string[];

  /**
   * Name of the build action
   *
   * @default 'Synth'
   */
  readonly actionName?: string;

  /**
   * Name of the CodeBuild project
   *
   * @default - Automatically generated
   */
  readonly projectName?: string;

  /**
   * Build environment to use for CodeBuild job
   *
   * @default BuildEnvironment.LinuxBuildImage.STANDARD_5_0
   */
  readonly environment?: codebuild.BuildEnvironment;

  /**
   * Directory inside the source where package.json and cdk.json are located
   *
   * @default - Repository root
   */
  readonly subdirectory?: string;

  /**
   * Produce additional output artifacts after the build based on the given directories
   *
   * Can be used to produce additional artifacts during the build step,
   * separate from the cloud assembly, which can be used further on in the
   * pipeline.
   *
   * Directories are evaluated with respect to `subdirectory`.
   *
   * @default - No additional artifacts generated
   */
  readonly additionalArtifacts?: AdditionalArtifact[];

  /**
   * Policy statements to add to role used during the synth
   *
   * Can be used to add acces to a CodeArtifact repository etc.
   *
   * @default - No policy statements added to CodeBuild Project Role
   */
  readonly rolePolicyStatements?: iam.PolicyStatement[];

  /**
   * The VPC where to execute the SimpleSynth.
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
}

/**
 * Construction props for SimpleSynthAction
 */
export interface SimpleSynthActionProps extends SimpleSynthOptions {
  /**
   * The synth command
   */
  readonly synthCommand: string;

  /**
   * The install command
   *
   * If not provided by the build image or another dependency
   * management tool, at least install the CDK CLI here using
   * `npm install -g aws-cdk`.
   *
   * @default - No install required
   * @deprecated Use `installCommands` instead
   */
  readonly installCommand?: string;

  /**
   * The build command
   *
   * If your programming language requires a compilation step, put the
   * compilation command here.
   *
   * @default - No build required
   * @deprecated Use `buildCommands` instead
   */
  readonly buildCommand?: string;

  /**
   * Install commands
   *
   * If not provided by the build image or another dependency
   * management tool, at least install the CDK CLI here using
   * `npm install -g aws-cdk`.
   *
   * @default - No install required
   */
  readonly installCommands?: string[];

  /**
   * The build commands
   *
   * If your programming language requires a compilation step, put the
   * compilation command here.
   *
   * @default - No build required
   */
  readonly buildCommands?: string[];

  /**
   * Test commands
   *
   * These commands are run after the build commands but before the
   * synth command.
   *
   * @default - No test commands
   */
  readonly testCommands?: string[];
}

/**
 * Specification of an additional artifact to generate
 */
export interface AdditionalArtifact {
  /**
   * Directory to be packaged
   */
  readonly directory: string;

  /**
   * Artifact to represent the build directory in the pipeline
   */
  readonly artifact: codepipeline.Artifact;
}

/**
 * A standard synth with a generated buildspec
 */
export class SimpleSynthAction implements codepipeline.IAction, iam.IGrantable {

  /**
   * Create a standard NPM synth action
   *
   * Uses `npm ci` to install dependencies and `npx cdk synth` to synthesize.
   *
   * If you need a build step, add `buildCommand: 'npm run build'`.
   */
  public static standardNpmSynth(options: StandardNpmSynthOptions) {
    return new SimpleSynthAction({
      ...options,
      installCommand: options.installCommand ?? 'npm ci',
      synthCommand: options.synthCommand ?? 'npx cdk synth',
      vpc: options.vpc,
      subnetSelection: options.subnetSelection,
      environment: {
        ...options.environment,
        environmentVariables: {
          // Need this in case the CDK CLI is not in the 'package.json' of the project,
          // and 'npx' is going to download it; without this setting, 'npx' will not properly
          // install the package into the root user's home directory
          NPM_CONFIG_UNSAFE_PERM: { value: 'true' },
          ...options.environment?.environmentVariables,
        },
      },
    });
  }

  /**
   * Create a standard Yarn synth action
   *
   * Uses `yarn install --frozen-lockfile` to install dependencies and `npx cdk synth` to synthesize.
   *
   * If you need a build step, add `buildCommand: 'yarn build'`.
   */
  public static standardYarnSynth(options: StandardYarnSynthOptions) {
    return new SimpleSynthAction({
      ...options,
      installCommand: options.installCommand ?? 'yarn install --frozen-lockfile',
      synthCommand: options.synthCommand ?? 'npx cdk synth',
      vpc: options.vpc,
      subnetSelection: options.subnetSelection,
      environment: {
        ...options.environment,
        environmentVariables: {
          // Need this in case the CDK CLI is not in the 'package.json' of the project,
          // and 'npx' is going to download it; without this setting, 'npx' will not properly
          // install the package into the root user's home directory
          NPM_CONFIG_UNSAFE_PERM: { value: 'true' },
          ...options.environment?.environmentVariables,
        },
      },
    });
  }

  private _action?: codepipeline_actions.CodeBuildAction;
  private _actionProperties: codepipeline.ActionProperties;
  private _project?: codebuild.IProject;

  constructor(private readonly props: SimpleSynthActionProps) {
    // A number of actionProperties get read before bind() is even called (so before we
    // have made the Project and can construct the actual CodeBuildAction)
    //
    // - actionName
    // - resource
    // - region
    // - category
    // - role
    // - owner
    this._actionProperties = {
      actionName: props.actionName ?? 'Synth',
      category: codepipeline.ActionCategory.BUILD,
      provider: 'CodeBuild',
      artifactBounds: { minInputs: 0, maxInputs: 5, minOutputs: 0, maxOutputs: 5 },
      inputs: [props.sourceArtifact],
      outputs: [props.cloudAssemblyArtifact, ...(props.additionalArtifacts ?? []).map(a => a.artifact)],
    };

    if (this.props.installCommand && this.props.installCommands) {
      throw new Error('Pass either \'installCommand\' or \'installCommands\', but not both');
    }

    if (this.props.buildCommand && this.props.buildCommands) {
      throw new Error('Pass either \'buildCommand\' or \'buildCommands\', but not both');
    }

    const addls = props.additionalArtifacts ?? [];
    if (Object.keys(addls).length > 0) {
      if (!props.cloudAssemblyArtifact.artifactName) {
        throw new Error('You must give all output artifacts, including the \'cloudAssemblyArtifact\', names when using \'additionalArtifacts\'');
      }
      for (const addl of addls) {
        if (!addl.artifact.artifactName) {
          throw new Error('You must give all output artifacts passed to SimpleSynthAction names when using \'additionalArtifacts\'');
        }
      }
    }
  }

  /**
   * Exists to implement IAction
   */
  public get actionProperties(): codepipeline.ActionProperties {
    return this._actionProperties;
  }

  /**
   * Project generated to run the synth command
   */
  public get project(): codebuild.IProject {
    if (!this._project) {
      throw new Error('Project becomes available after SimpleSynthAction has been bound to a stage');
    }
    return this._project;
  }

  /**
   * Exists to implement IAction
   */
  public bind(scope: Construct, stage: codepipeline.IStage, options: codepipeline.ActionBindOptions): codepipeline.ActionConfig {
    const buildCommands = this.props.buildCommands ?? [this.props.buildCommand];
    const installCommands = this.props.installCommands ?? [this.props.installCommand];
    const testCommands = this.props.testCommands ?? [];
    const synthCommand = this.props.synthCommand;

    const buildSpec = codebuild.BuildSpec.fromObject({
      version: '0.2',
      phases: {
        pre_build: {
          commands: filterEmpty([
            this.props.subdirectory ? `cd ${this.props.subdirectory}` : '',
            ...installCommands,
          ]),
        },
        build: {
          commands: filterEmpty([
            ...buildCommands,
            ...testCommands,
            synthCommand,
          ]),
        },
      },
      artifacts: renderArtifacts(this),
    });

    const environment = { buildImage: codebuild.LinuxBuildImage.STANDARD_5_0, ...this.props.environment };

    const environmentVariables = {
      ...copyEnvironmentVariables(...this.props.copyEnvironmentVariables || []),
    };

    // A hash over the values that make the CodeBuild Project unique (and necessary
    // to restart the pipeline if one of them changes). projectName is not necessary to include
    // here because the pipeline will definitely restart if projectName changes.
    // (Resolve tokens)
    const projectConfigHash = hash(Stack.of(scope).resolve({
      environment: serializeBuildEnvironment(environment),
      buildSpecString: buildSpec.toBuildSpec(),
      environmentVariables,
    }));

    const project = new codebuild.PipelineProject(scope, 'CdkBuildProject', {
      projectName: this.props.projectName,
      environment,
      vpc: this.props.vpc,
      subnetSelection: this.props.subnetSelection,
      buildSpec,
      environmentVariables,
    });

    if (this.props.rolePolicyStatements !== undefined) {
      this.props.rolePolicyStatements.forEach(policyStatement => {
        project.addToRolePolicy(policyStatement);
      });
    }

    this._project = project;

    this._action = new codepipeline_actions.CodeBuildAction({
      actionName: this.actionProperties.actionName,
      input: this.props.sourceArtifact,
      outputs: [this.props.cloudAssemblyArtifact, ...(this.props.additionalArtifacts ?? []).map(a => a.artifact)],

      // Inclusion of the hash here will lead to the pipeline structure for any changes
      // made the config of the underlying CodeBuild Project.
      // Hence, the pipeline will be restarted. This is necessary if the users
      // adds (for example) build or test commands to the buildspec.
      environmentVariables: {
        ...this.props.environmentVariables,
        _PROJECT_CONFIG_HASH: { value: projectConfigHash },
      },
      project,
    });
    this._actionProperties = this._action.actionProperties;

    return this._action.bind(scope, stage, options);

    function renderArtifacts(self: SimpleSynthAction) {
      // save the generated files in the output artifact
      // This part of the buildspec has to look completely different depending on whether we're
      // using secondary artifacts or not.

      const cloudAsmArtifactSpec = {
        'base-directory': toPosixPath(path.join(self.props.subdirectory ?? '.', DEFAULT_OUTPUT_DIR)),
        'files': '**/*',
      };

      if (self.props.additionalArtifacts) {
        const secondary: Record<string, any> = {};
        if (!self.props.cloudAssemblyArtifact.artifactName) {
          throw new Error('When using additional output artifacts, you must also name the CloudAssembly artifact');
        }
        secondary[self.props.cloudAssemblyArtifact.artifactName] = cloudAsmArtifactSpec;
        self.props.additionalArtifacts.forEach((art) => {
          if (!art.artifact.artifactName) {
            throw new Error('You must give the output artifact a name');
          }
          secondary[art.artifact.artifactName] = {
            'base-directory': toPosixPath(path.join(self.props.subdirectory ?? '.', art.directory)),
            'files': '**/*',
          };
        });

        return { 'secondary-artifacts': secondary };
      }

      return cloudAsmArtifactSpec;
    }
  }

  /**
   * The CodeBuild Project's principal
   */
  public get grantPrincipal(): iam.IPrincipal {
    return this.project.grantPrincipal;
  }

  /**
   * Exists to implement IAction
   */
  public onStateChange(name: string, target?: events.IRuleTarget, options?: events.RuleProps): events.Rule {
    if (!this._action) {
      throw new Error('Need bind() first');
    }

    return this._action.onStateChange(name, target, options);
  }
}

/**
 * Options for a convention-based synth using NPM
 */
export interface StandardNpmSynthOptions extends SimpleSynthOptions {
  /**
   * The install command
   *
   * @default 'npm ci'
   */
  readonly installCommand?: string;

  /**
   * The build command
   *
   * By default, we assume NPM projects are either written in JavaScript or are
   * using `ts-node`, so don't need a build command.
   *
   * Otherwise, put the build command here, for example `npm run build`.
   *
   * @default - No build required
   */
  readonly buildCommand?: string;

  /**
   * The synth command
   *
   * @default 'npx cdk synth'
   */
  readonly synthCommand?: string;

  /**
   * Test commands
   *
   * These commands are run after the build commands but before the
   * synth command.
   *
   * @default - No test commands
   */
  readonly testCommands?: string[];
}

/**
 * Options for a convention-based synth using Yarn
 */
export interface StandardYarnSynthOptions extends SimpleSynthOptions {
  /**
   * The install command
   *
   * @default 'yarn install --frozen-lockfile'
   */
  readonly installCommand?: string;

  /**
   * The build command
   *
   * By default, we assume NPM projects are either written in JavaScript or are
   * using `ts-node`, so don't need a build command.
   *
   * Otherwise, put the build command here, for example `npm run build`.
   *
   * @default - No build required
   */
  readonly buildCommand?: string;

  /**
   * The synth command
   *
   * @default 'npx cdk synth'
   */
  readonly synthCommand?: string;

  /**
   * Test commands
   *
   * These commands are run after the build commands but before the
   * synth command.
   *
   * @default - No test commands
   */
  readonly testCommands?: string[];
}

function hash<A>(obj: A) {
  const d = crypto.createHash('sha256');
  d.update(JSON.stringify(obj));
  return d.digest('hex');
}

/**
 * Serialize a build environment to data (get rid of constructs & objects), so we can JSON.stringify it
 */
function serializeBuildEnvironment(env: codebuild.BuildEnvironment) {
  return {
    privileged: env.privileged,
    environmentVariables: env.environmentVariables,
    type: env.buildImage?.type,
    imageId: env.buildImage?.imageId,
    computeType: env.computeType,
    imagePullPrincipalType: env.buildImage?.imagePullPrincipalType,
    secretsManagerArn: env.buildImage?.secretsManagerCredentials?.secretArn,
  };
}