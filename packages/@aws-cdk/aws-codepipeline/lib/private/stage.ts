import * as events from '@aws-cdk/aws-events';
import * as cdk from '@aws-cdk/core';
import { Construct, Node } from 'constructs';
import { IAction, IPipeline, IStage } from '../action';
import { Artifact } from '../artifact';
import { CfnPipeline } from '../codepipeline.generated';
import { Pipeline, StageProps } from '../pipeline';
import { FullActionDescriptor } from './full-action-descriptor';
import * as validation from './validation';

/**
 * A Stage in a Pipeline.
 *
 * Stages are added to a Pipeline by calling {@link Pipeline#addStage},
 * which returns an instance of {@link codepipeline.IStage}.
 *
 * This class is private to the CodePipeline module.
 */
export class Stage implements IStage {
  /**
   * The Pipeline this Stage is a part of.
   */
  public readonly stageName: string;
  private readonly scope: Construct;
  private readonly _pipeline: Pipeline;
  private readonly _actions = new Array<FullActionDescriptor>();

  /**
   * Create a new Stage.
   */
  constructor(props: StageProps, pipeline: Pipeline) {
    validation.validateName('Stage', props.stageName);

    this.stageName = props.stageName;
    this._pipeline = pipeline;
    this.scope = new Construct(pipeline, this.stageName);

    for (const action of props.actions || []) {
      this.addAction(action);
    }
  }

  /**
   * Get a duplicate of this stage's list of actions.
   */
  public get actionDescriptors(): FullActionDescriptor[] {
    return this._actions.slice();
  }

  public get actions(): IAction[] {
    return this._actions.map(actionDescriptor => actionDescriptor.action);
  }

  public get pipeline(): IPipeline {
    return this._pipeline;
  }

  public render(): CfnPipeline.StageDeclarationProperty {
    // first, assign names to output Artifacts who don't have one
    for (const action of this._actions) {
      const outputArtifacts = action.outputs;

      const unnamedOutputs = outputArtifacts.filter(o => !o.artifactName);

      for (const outputArtifact of outputArtifacts) {
        if (!outputArtifact.artifactName) {
          const unsanitizedArtifactName = `Artifact_${this.stageName}_${action.actionName}` + (unnamedOutputs.length === 1
            ? ''
            : '_' + (unnamedOutputs.indexOf(outputArtifact) + 1));
          const artifactName = sanitizeArtifactName(unsanitizedArtifactName);
          (outputArtifact as any)._setName(artifactName);
        }
      }
    }

    return {
      name: this.stageName,
      actions: this._actions.map(action => this.renderAction(action)),
    };
  }

  public addAction(action: IAction): void {
    const actionName = action.actionProperties.actionName;
    // validate the name
    validation.validateName('Action', actionName);

    // check for duplicate Actions and names
    if (this._actions.find(a => a.actionName === actionName)) {
      throw new Error(`Stage ${this.stageName} already contains an action with name '${actionName}'`);
    }

    this._actions.push(this.attachActionToPipeline(action));
  }

  public onStateChange(name: string, target?: events.IRuleTarget, options?: events.RuleProps): events.Rule {
    const rule = new events.Rule(this.scope, name, options);
    rule.addTarget(target);
    rule.addEventPattern({
      detailType: ['CodePipeline Stage Execution State Change'],
      source: ['aws.codepipeline'],
      resources: [this.pipeline.pipelineArn],
      detail: {
        stage: [this.stageName],
      },
    });
    return rule;
  }

  public validate(): string[] {
    return [
      ...this.validateHasActions(),
      ...this.validateActions(),
    ];
  }

  private validateHasActions(): string[] {
    if (this._actions.length === 0) {
      return [`Stage '${this.stageName}' must have at least one action`];
    }
    return [];
  }

  private validateActions(): string[] {
    const ret = new Array<string>();
    for (const action of this.actionDescriptors) {
      ret.push(...this.validateAction(action));
    }
    return ret;
  }

  private validateAction(action: FullActionDescriptor): string[] {
    return validation.validateArtifactBounds('input', action.inputs, action.artifactBounds.minInputs,
      action.artifactBounds.maxInputs, action.category, action.provider)
      .concat(validation.validateArtifactBounds('output', action.outputs, action.artifactBounds.minOutputs,
        action.artifactBounds.maxOutputs, action.category, action.provider),
      );
  }

  private attachActionToPipeline(action: IAction): FullActionDescriptor {
    // notify the Pipeline of the new Action
    //
    // It may be that a construct already exists with the given action name (CDK Pipelines
    // may do this to maintain construct tree compatibility between versions).
    //
    // If so, we simply reuse it.
    let actionScope = Node.of(this.scope).tryFindChild(action.actionProperties.actionName) as Construct | undefined;
    if (!actionScope) {
      actionScope = new Construct(this.scope, action.actionProperties.actionName);
    }
    return this._pipeline._attachActionToPipeline(this, action, actionScope);
  }

  private renderAction(action: FullActionDescriptor): CfnPipeline.ActionDeclarationProperty {
    const outputArtifacts = cdk.Lazy.any({ produce: () => this.renderArtifacts(action.outputs) }, { omitEmptyArray: true });
    const inputArtifacts = cdk.Lazy.any({ produce: () => this.renderArtifacts(action.inputs) }, { omitEmptyArray: true });
    return {
      name: action.actionName,
      inputArtifacts,
      outputArtifacts,
      actionTypeId: {
        category: action.category.toString(),
        version: action.version,
        owner: action.owner,
        provider: action.provider,
      },
      configuration: action.configuration,
      runOrder: action.runOrder,
      roleArn: action.role ? action.role.roleArn : undefined,
      region: action.region,
      namespace: action.namespace,
    };
  }

  private renderArtifacts(artifacts: Artifact[]): CfnPipeline.InputArtifactProperty[] {
    return artifacts
      .filter(a => a.artifactName)
      .map(a => ({ name: a.artifactName! }));
  }
}

function sanitizeArtifactName(artifactName: string): string {
  // strip out some characters that are legal in Stage and Action names,
  // but not in Artifact names
  return artifactName.replace(/[@.]/g, '');
}
