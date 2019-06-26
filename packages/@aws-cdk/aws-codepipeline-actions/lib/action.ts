import codepipeline = require('@aws-cdk/aws-codepipeline');
import events = require('@aws-cdk/aws-events');
import { Construct } from '@aws-cdk/core';

/**
 * Low-level class for generic CodePipeline Actions.
 *
 * @experimental
 */
export abstract class Action implements codepipeline.IAction {
  private _pipeline?: codepipeline.IPipeline;
  private _stage?: codepipeline.IStage;
  private _scope?: Construct;

  constructor(public readonly actionProperties: codepipeline.ActionProperties) {
    // nothing to do
  }

  public bind(scope: Construct, stage: codepipeline.IStage, options: codepipeline.ActionBindOptions):
    codepipeline.ActionConfig {
    this._pipeline = stage.pipeline;
    this._stage = stage;
    this._scope = scope;

    return this.bound(scope, stage, options);
  }

  public onStateChange(name: string, target?: events.IRuleTarget, options?: events.RuleProps) {
    const rule = new events.Rule(this.scope, name, options);
    rule.addTarget(target);
    rule.addEventPattern({
      detailType: [ 'CodePipeline Stage Execution State Change' ],
      source: [ 'aws.codepipeline' ],
      resources: [ this.pipeline.pipelineArn ],
      detail: {
        stage: [ this.stage.stageName ],
        action: [ this.actionProperties.actionName ],
      },
    });
    return rule;
  }

  /**
   * The method called when an Action is attached to a Pipeline.
   * This method is guaranteed to be called only once for each Action instance.
   *
   * @param options an instance of the {@link ActionBindOptions} class,
   *   that contains the necessary information for the Action
   *   to configure itself, like a reference to the Role, etc.
   */
  protected abstract bound(scope: Construct, stage: codepipeline.IStage, options: codepipeline.ActionBindOptions):
    codepipeline.ActionConfig;

  private get pipeline(): codepipeline.IPipeline {
    if (this._pipeline) {
      return this._pipeline;
    } else {
      throw new Error('Action must be added to a stage that is part of a pipeline before using onStateChange');
    }
  }

  private get stage(): codepipeline.IStage {
    if (this._stage) {
      return this._stage;
    } else {
      throw new Error('Action must be added to a stage that is part of a pipeline before using onStateChange');
    }
  }

  /**
   * Retrieves the Construct scope of this Action.
   * Only available after the Action has been added to a Stage,
   * and that Stage to a Pipeline.
   */
  private get scope(): Construct {
    if (this._scope) {
      return this._scope;
    } else {
      throw new Error('Action must be added to a stage that is part of a pipeline first');
    }
  }
}
