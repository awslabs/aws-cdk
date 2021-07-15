import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import { IDependable, Stack } from '@aws-cdk/core';
import { Construct, Node } from 'constructs';
import { FileSetLocation, ShellStep, StackDeployment, StackOutputReference } from '../blueprint';
import { PipelineQueries } from '../helpers-internal/pipeline-queries';
import { cloudAssemblyBuildSpecDir, obtainScope } from '../private/construct-internals';
import { mapValues, mkdict, noEmptyObject, noUndefined, partition } from '../private/javascript';
import { ArtifactMap } from './artifact-map';
import { CodeBuildStep } from './codebuild-step';
import { CodeBuildOptions } from './codepipeline';
import { ICodePipelineActionFactory, ProduceActionOptions, CodePipelineActionFactoryResult } from './codepipeline-action-factory';

export interface CodeBuildFactoryProps {
  /**
   * Name for the generated CodeBuild project
   *
   * @default - Automatically generated
   */
  readonly projectName?: string;

  /**
   * Customization options for the project
   *
   * Will at CodeBuild production time be combined with the option
   * defaults configured on the pipeline.
   *
   * @default - No special values
   */
  readonly projectOptions?: CodeBuildOptions;

  /**
   * Custom execution role to be used for the CodeBuild project
   *
   * @default - A role is automatically created
   */
  readonly role?: iam.IRole;

  /**
   * If true, the build spec will be passed via the Cloud Assembly instead of rendered onto the Project
   *
   * Doing this has two advantages:
   *
   * - Bypass size restrictions: the buildspec on the project is restricted
   *   in size, while buildspecs coming from an input artifact are not restricted
   *   in such a way.
   * - Bypass pipeline update: if the SelfUpdate step has to change the buildspec,
   *   that just takes time. On the other hand, if the buildspec comes from the
   *   pipeline artifact, no such update has to take place.
   *
   * @default false
   */
  readonly passBuildSpecViaCloudAssembly?: boolean;

  /**
   * Override the construct tree where the CodeBuild project is created.
   *
   * Normally, the construct tree will look like this:
   *
   *  ── Pipeline
   *      └── 'MyStage'         <- options.scope
   *           └── 'MyAction'   <- this is the CodeBuild project
   *
   * If this flag is set, the construct tree will look like this:
   *
   *  ── Pipeline
   *      └── 'MyStage'                         <- options.scope
   *           └── 'MyAction'                   <- just a scope
   *                  └── 'BackwardsCompatName' <- CodeBuild project
   *
   * This is to maintain logicalID compatibility with the previous iteration
   * of pipelines (where the Action was a construct that would create the Project).
   *
   * @default true
   */
  readonly additionalConstructLevel?: boolean;

  /**
   * Additional dependency that the CodeBuild project should take
   *
   * @default -
   */
  readonly additionalDependable?: IDependable;

  readonly inputs?: FileSetLocation[];
  readonly outputs?: FileSetLocation[];

  readonly stepId?: string;

  readonly commands: string[];
  readonly installCommands?: string[];

  readonly env?: Record<string, string>;
  readonly envFromCfnOutputs?: Record<string, StackOutputReference>;

  /**
   * If given, override the scope from the produce call with this scope.
   */
  readonly scope?: Construct;

  /**
   * Whether or not the given CodeBuild project is going to be the synth step
   *
   * @default false
   */
  readonly isSynth?: boolean;
}

/**
 * Produce a CodeBuild project from a RunScript step and some CodeBuild-specific customizations
 *
 * The functionality here is shared between the `CodePipeline` translating a `ShellStep` into
 * a CodeBuild project, as well as the `CodeBuildStep` straight up.
 */
export class CodeBuildFactory implements ICodePipelineActionFactory {
  // eslint-disable-next-line max-len
  public static fromShellStep(constructId: string, scriptStep: ShellStep, additional?: Partial<CodeBuildFactoryProps>): ICodePipelineActionFactory {
    return new CodeBuildFactory(constructId, {
      commands: scriptStep.commands,
      env: scriptStep.env,
      envFromCfnOutputs: scriptStep.envFromCfnOutputs,
      inputs: scriptStep.inputs,
      outputs: scriptStep.outputs,
      stepId: scriptStep.id,
      installCommands: scriptStep.installCommands,
      ...additional,
    });
  }

  public static fromCodeBuildStep(constructId: string, step: CodeBuildStep, additional?: Partial<CodeBuildFactoryProps>): ICodePipelineActionFactory {
    const factory = CodeBuildFactory.fromShellStep(constructId, step, {
      projectName: step.projectName,
      role: step.role,
      projectOptions: {
        buildEnvironment: step.buildEnvironment,
        rolePolicy: step.rolePolicyStatements,
        securityGroups: step.securityGroups,
        partialBuildSpec: step.partialBuildSpec,
        vpc: step.vpc,
        subnetSelection: step.subnetSelection,
        ...additional?.projectOptions,
      },
      ...additional,
    });

    return {
      produceAction: (stage, options) => {
        const result = factory.produceAction(stage, options);
        if (result.project) {
          step._setProject(result.project);
        }
        return result;
      },
    };
  }

  private _project?: codebuild.IProject;
  private stepId: string;

  private constructor(
    private readonly constructId: string,
    private readonly props: CodeBuildFactoryProps) {

    this.stepId = props.stepId ?? constructId;
  }

  public get project(): codebuild.IProject {
    if (!this._project) {
      throw new Error('Project becomes available after produce() has been called');
    }
    return this._project;
  }

  public produceAction(stage: codepipeline.IStage, options: ProduceActionOptions): CodePipelineActionFactoryResult {
    const projectOptions = mergeCodeBuildOptions(options.codeBuildDefaults, this.props.projectOptions);

    const inputs = this.props.inputs ?? [];
    const outputs = this.props.outputs ?? [];

    const mainInput = inputs.find(x => x.directory === '.');
    const extraInputs = inputs.filter(x => x.directory !== '.');

    const inputArtifact = mainInput
      ? options.artifacts.toCodePipeline(mainInput.fileSet)
      : options.fallbackArtifact;
    const extraInputArtifacts = extraInputs.map(x => options.artifacts.toCodePipeline(x.fileSet));
    const outputArtifacts = outputs.map(x => options.artifacts.toCodePipeline(x.fileSet));

    if (!inputArtifact) {
      // This should actually never happen because CodeBuild projects shouldn't be added before the
      // Source, which always produces at least an artifact.
      throw new Error(`CodeBuild action '${this.stepId}' requires an input (and the pipeline doesn't have a Source to fall back to). Add an input or a pipeline source.`);
    }

    const installCommands = [
      ...generateInputArtifactLinkCommands(options.artifacts, extraInputs),
      ...this.props.installCommands ?? [],
    ];

    const buildSpecHere = codebuild.BuildSpec.fromObject({
      version: '0.2',
      phases: {
        install: (installCommands.length ?? 0) > 0 ? { commands: installCommands } : undefined,
        build: this.props.commands.length > 0 ? { commands: this.props.commands } : undefined,
      },
      artifacts: noEmptyObject<any>(renderArtifactsBuildSpec(options.artifacts, this.props.outputs ?? [])),
    });

    // Partition environment variables into environment variables that can go on the project
    // and environment variables that MUST go in the pipeline (those that reference CodePipeline variables)
    const env = noUndefined(this.props.env ?? {});

    const [actionEnvs, projectEnvs] = partition(Object.entries(env ?? {}), ([, v]) => containsPipelineVariable(v));

    const environment = mergeBuildEnvironments(
      projectOptions?.buildEnvironment ?? {},
      {
        environmentVariables: noEmptyObject(mapValues(mkdict(projectEnvs), value => ({ value }))),
      });

    const fullBuildSpec = options.codeBuildDefaults?.partialBuildSpec
      ? codebuild.mergeBuildSpecs(options.codeBuildDefaults?.partialBuildSpec, buildSpecHere)
      : buildSpecHere;

    const osFromEnvironment = environment.buildImage && environment.buildImage instanceof codebuild.WindowsBuildImage
      ? ec2.OperatingSystemType.WINDOWS
      : ec2.OperatingSystemType.LINUX;

    const actualBuildSpec = filterBuildSpecCommands(fullBuildSpec, osFromEnvironment);

    const scope = this.props.scope ?? options.scope;

    let projectBuildSpec;
    if (this.props.passBuildSpecViaCloudAssembly) {
      // Write to disk and replace with a reference
      const relativeSpecFile = `buildspec-${Node.of(scope).addr}-${this.constructId}.yaml`;
      const absSpecFile = path.join(cloudAssemblyBuildSpecDir(scope), relativeSpecFile);
      fs.writeFileSync(absSpecFile, Stack.of(scope).resolve(actualBuildSpec.toBuildSpec()), { encoding: 'utf-8' });
      projectBuildSpec = codebuild.BuildSpec.fromSourceFilename(relativeSpecFile);
    } else {
      projectBuildSpec = actualBuildSpec;
    }

    // A hash over the values that make the CodeBuild Project unique (and necessary
    // to restart the pipeline if one of them changes). projectName is not necessary to include
    // here because the pipeline will definitely restart if projectName changes.
    // (Resolve tokens)
    const projectConfigHash = hash(Stack.of(scope).resolve({
      environment: serializeBuildEnvironment(environment),
      buildSpecString: actualBuildSpec.toBuildSpec(),
    }));

    const actionName = options.actionName ?? this.stepId;

    let projectScope = scope;
    if (this.props.additionalConstructLevel ?? true) {
      projectScope = obtainScope(scope, actionName);
    }

    const project = new codebuild.PipelineProject(projectScope, this.constructId, {
      projectName: this.props.projectName,
      environment,
      vpc: projectOptions.vpc,
      subnetSelection: projectOptions.subnetSelection,
      securityGroups: projectOptions.securityGroups,
      buildSpec: projectBuildSpec,
      role: this.props.role,
    });

    if (this.props.additionalDependable) {
      project.node.addDependency(this.props.additionalDependable);
    }

    if (projectOptions.rolePolicy !== undefined) {
      projectOptions.rolePolicy.forEach(policyStatement => {
        project.addToRolePolicy(policyStatement);
      });
    }

    const queries = new PipelineQueries(options.pipeline);

    const stackOutputEnv = mapValues(this.props.envFromCfnOutputs ?? {}, outputRef =>
      `#{${stackVariableNamespace(queries.producingStack(outputRef))}.${outputRef.outputName}}`,
    );

    const configHashEnv = options.beforeSelfMutation
      ? { _PROJECT_CONFIG_HASH: projectConfigHash }
      : {};

    stage.addAction(new codepipeline_actions.CodeBuildAction({
      actionName: actionName,
      input: inputArtifact,
      extraInputs: extraInputArtifacts,
      outputs: outputArtifacts,
      project,
      runOrder: options.runOrder,

      // Inclusion of the hash here will lead to the pipeline structure for any changes
      // made the config of the underlying CodeBuild Project.
      // Hence, the pipeline will be restarted. This is necessary if the users
      // adds (for example) build or test commands to the buildspec.
      environmentVariables: noEmptyObject(cbEnv({
        ...mkdict(actionEnvs),
        ...configHashEnv,
        ...stackOutputEnv,
      })),
    }));

    this._project = project;

    return { runOrdersConsumed: 1, project };
  }
}

/**
 * Generate commands to move additional input artifacts into the right place
 */
function generateInputArtifactLinkCommands(artifacts: ArtifactMap, inputs: FileSetLocation[]): string[] {
  return inputs.map(input => {
    const fragments = [];

    if (!['.', '..'].includes(path.dirname(input.directory))) {
      fragments.push(`mkdir -p "${input.directory}"`);
    }

    const artifact = artifacts.toCodePipeline(input.fileSet);

    fragments.push(`ln -s "$CODEBUILD_SRC_DIR_${artifact.artifactName}" "${input.directory}"`);

    return fragments.join(' && ');
  });
}

function renderArtifactsBuildSpec(artifactMap: ArtifactMap, outputs: FileSetLocation[]) {
  // save the generated files in the output artifact
  // This part of the buildspec has to look completely different depending on whether we're
  // using secondary artifacts or not.
  if (outputs.length === 0) { return {}; }

  if (outputs.length === 1) {
    return {
      'base-directory': outputs[0].directory,
      'files': '**/*',
    };
  }

  const secondary: Record<string, any> = {};
  for (const output of outputs) {
    const art = artifactMap.toCodePipeline(output.fileSet);

    if (!art.artifactName) {
      throw new Error('You must give the output artifact a name');
    }
    secondary[art.artifactName] = {
      'base-directory': output.directory,
      'files': '**/*',
    };
  }

  return { 'secondary-artifacts': secondary };
}

export function mergeCodeBuildOptions(...opts: Array<CodeBuildOptions | undefined>) {
  const xs = [{}, ...opts.filter(isDefined)];
  while (xs.length > 1) {
    const [a, b] = xs.splice(xs.length - 2, 2);
    xs.push(merge2(a, b));
  }
  return xs[0];

  function merge2(a: CodeBuildOptions, b: CodeBuildOptions): CodeBuildOptions {
    return {
      buildEnvironment: mergeBuildEnvironments(a.buildEnvironment, b.buildEnvironment),
      rolePolicy: definedArray([...a.rolePolicy ?? [], ...b.rolePolicy ?? []]),
      securityGroups: definedArray([...a.securityGroups ?? [], ...b.securityGroups ?? []]),
      partialBuildSpec: mergeBuildSpecs(a.partialBuildSpec, b.partialBuildSpec),
      vpc: b.vpc ?? a.vpc,
      subnetSelection: b.subnetSelection ?? a.subnetSelection,
    };
  }
}

function mergeBuildEnvironments(a: codebuild.BuildEnvironment, b?: codebuild.BuildEnvironment): codebuild.BuildEnvironment;
function mergeBuildEnvironments(a: codebuild.BuildEnvironment | undefined, b: codebuild.BuildEnvironment): codebuild.BuildEnvironment;
function mergeBuildEnvironments(a?: codebuild.BuildEnvironment, b?: codebuild.BuildEnvironment): codebuild.BuildEnvironment | undefined;
function mergeBuildEnvironments(a?: codebuild.BuildEnvironment, b?: codebuild.BuildEnvironment) {
  if (!a || !b) { return a ?? b; }

  return {
    buildImage: b.buildImage ?? a.buildImage,
    computeType: b.computeType ?? a.computeType,
    environmentVariables: {
      ...a.environmentVariables,
      ...b.environmentVariables,
    },
    privileged: b.privileged ?? a.privileged,
  };
}

export function mergeBuildSpecs(a: codebuild.BuildSpec, b?: codebuild.BuildSpec): codebuild.BuildSpec;
export function mergeBuildSpecs(a: codebuild.BuildSpec | undefined, b: codebuild.BuildSpec): codebuild.BuildSpec;
export function mergeBuildSpecs(a?: codebuild.BuildSpec, b?: codebuild.BuildSpec): codebuild.BuildSpec | undefined;
export function mergeBuildSpecs(a?: codebuild.BuildSpec, b?: codebuild.BuildSpec) {
  if (!a || !b) { return a ?? b; }
  return codebuild.mergeBuildSpecs(a, b);
}

function isDefined<A>(x: A | undefined): x is NonNullable<A> {
  return x !== undefined;
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

export function stackVariableNamespace(stack: StackDeployment) {
  return stack.stackArtifactId;
}

/**
 * Whether the given string contains a reference to a CodePipeline variable
 */
function containsPipelineVariable(s: string) {
  return !!s.match(/#\{[^}]+\}/);
}

/**
 * Turn a collection into a collection of CodePipeline environment variables
 */
function cbEnv(xs: Record<string, string | undefined>): Record<string, codebuild.BuildEnvironmentVariable> {
  return mkdict(Object.entries(xs)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => [k, { value: v }] as const));
}

function definedArray<A>(xs: A[]): A[] | undefined {
  return xs.length > 0 ? xs : undefined;
}

/**
 * If lines in the buildspec start with '!WINDOWS!' or '!LINUX!', only render them on that platform.
 *
 * Very private protocol for now, but may come in handy in other libraries as well.
 */
function filterBuildSpecCommands(buildSpec: codebuild.BuildSpec, osType: ec2.OperatingSystemType) {
  if (!buildSpec.isImmediate) { return buildSpec; }
  const spec = (buildSpec as any).spec;

  const winTag = '!WINDOWS!';
  const linuxTag = '!LINUX!';
  const expectedTag = osType === ec2.OperatingSystemType.WINDOWS ? winTag : linuxTag;

  return codebuild.BuildSpec.fromObject(recurse(spec));

  function recurse(x: any): any {
    if (Array.isArray(x)) {
      const ret: any[] = [];
      for (const el of x) {
        const [tag, payload] = extractTag(el);
        if (tag === undefined || tag === expectedTag) {
          ret.push(payload);
        }
      }
      return ret;
    }
    if (x && typeof x === 'object') {
      return mapValues(x, recurse);
    }
    return x;
  }

  function extractTag(x: any): [string | undefined, any] {
    if (typeof x !== 'string') { return [undefined, x]; }
    for (const tag of [winTag, linuxTag]) {
      if (x.startsWith(tag)) { return [tag, x.substr(tag.length)]; }
    }
    return [undefined, x];
  }
}