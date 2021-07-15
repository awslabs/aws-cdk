import * as cb from '@aws-cdk/aws-codebuild';
import * as cp from '@aws-cdk/aws-codepipeline';
import { Construct } from 'constructs';
import { PipelineBase } from '../main';
import { ArtifactMap } from './artifact-map';
import { CodeBuildOptions } from './codepipeline';

/**
 * Options for the `CodePipelineActionFactory.produce()` method.
 */
export interface ProduceActionOptions {
  /**
   * Scope in which to create constructs
   */
  readonly scope: Construct;

  /**
   * Name the action should get
   */
  readonly actionName: string;

  /**
   * RunOrder the action should get
   */
  readonly runOrder: number;

  /**
   * Helper object to translate FileSets to CodePipeline Artifacts
   */
  readonly artifacts: ArtifactMap;

  /**
   * An input artifact that CodeBuild projects that don't actually need an input artifact can use
   *
   * CodeBuild Projects MUST have an input artifact in order to be added to the Pipeline. If
   * the Project doesn't actually care about its input (it can be anything), it can use the
   * Artifact passed here.
   *
   * @default - A fallback artifact does not exist
   */
  readonly fallbackArtifact?: cp.Artifact;

  /**
   * The pipeline the action is being generated for
   */
  readonly pipeline: PipelineBase;

  /**
   * If this action factory creates a CodeBuild step, default options to inherit
   *
   * @default - No CodeBuild project defaults
   */
  readonly codeBuildDefaults?: CodeBuildOptions;

  /**
   * Whether or not this action is inserted before self mutation.
   *
   * If it is, the action should take care to reflect some part of
   * its own definition in the pipeline action definition, to
   * trigger a restart after self-mutation (if necessary).
   *
   * @default false
   */
  readonly beforeSelfMutation?: boolean;
}

/**
 * Factory for explicit CodePipeline Actions
 *
 * If you have specific types of Actions you want to add to a
 * CodePipeline, write a subclass of `Step` that implements this
 * interface, and add the action or actions you want in the `produce` method.
 *
 * There needs to be a level of indirection here, because some aspects of the
 * Action creation need to be controlled by the workflow engine (name and
 * runOrder). All the rest of the properties are controlled by the factory.
 */
export interface ICodePipelineActionFactory {
  /**
   * Create the desired Action and add it to the pipeline
   */
  produceAction(stage: cp.IStage, options: ProduceActionOptions): CodePipelineActionFactoryResult;
}

/**
 * The result of adding actions to the pipeline
 */
export interface CodePipelineActionFactoryResult {
  /**
   * How many RunOrders were consumed
   */
  readonly runOrdersConsumed: number;

  /**
   * If a CodeBuild project got created, the project
   *
   * @default - This factory did not create a CodeBuild project
   */
  readonly project?: cb.IProject;
}