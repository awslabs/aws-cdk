import * as cdk from '@aws-cdk/core';
import { StageDeployment } from './stage-deployment';
import { Step } from './step';

/**
 * Construction properties for a `Wave`
 */
export interface WaveProps {
  /**
   * Additional steps to run before any of the stages in the wave
   *
   * @default - No additional steps
   */
  readonly pre?: Step[];

  /**
   * Additional steps to run after all of the stages in the wave
   *
   * @default - No additional steps
   */
  readonly post?: Step[];
}

/**
 * Multiple stages that are deployed in parallel
 */
export class Wave {
  /**
   * Additional steps that are run before any of the stages in the wave
   */
  public readonly pre: Step[];

  /**
   * Additional steps that are run after all of the stages in the wave
   */
  public readonly post: Step[];

  /**
   * The stages that are deployed in this wave
   */
  public readonly stages: StageDeployment[] = [];

  constructor(
    /** Identifier for this Wave */
    public readonly id: string, props: WaveProps = {}) {
    this.pre = props.pre ?? [];
    this.post = props.post ?? [];
  }

  /**
   * Add a Stage to this wave
   *
   * It will be deployed in parallel with all other stages in this
   * wave.
   */
  public addStage(stage: cdk.Stage, options: AddStageOpts = {}) {
    const ret = StageDeployment.fromStage(stage, options);
    this.stages.push(ret);
    return ret;
  }

  /**
   * Add an additional step to run before any of the stages in this wave
   */
  public addPre(...steps: Step[]) {
    this.pre.push(...steps);
  }

  /**
   * Add an additional step to run after all of the stages in this wave
   */
  public addPost(...steps: Step[]) {
    this.post.push(...steps);
  }
}

/**
 * Options to pass to `addStage`
 */
export interface AddStageOpts {
  /**
   * Additional steps to run before any of the stacks in the stage
   *
   * @default - No additional steps
   */
  readonly pre?: Step[];

  /**
   * Additional steps to run after all of the stacks in the stage
   *
   * @default - No additional steps
   */
  readonly post?: Step[];
}

/**
 * Options to pass to `addWave`
 */
export interface WaveOptions {
  /**
   * Additional steps to run before any of the stages in the wave
   *
   * @default - No additional steps
   */
  readonly pre?: Step[];

  /**
   * Additional steps to run after all of the stages in the wave
   *
   * @default - No additional steps
   */
  readonly post?: Step[];
}