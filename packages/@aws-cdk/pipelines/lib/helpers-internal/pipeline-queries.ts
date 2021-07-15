import { Step, ShellStep, StackOutputReference, StackDeployment, StackAsset, StageDeployment } from '../blueprint';
import { PipelineBase } from '../main/pipeline-base';

/**
 * Answer some questions about a pipeline blueprint
 */
export class PipelineQueries {
  constructor(private readonly pipeline: PipelineBase) {
  }

  /**
   * Return the names of all outputs for the given stack that are referenced in this blueprint
   */
  public stackOutputsReferenced(stack: StackDeployment): string[] {
    const steps = new Array<Step>();
    for (const wave of this.pipeline.waves) {
      steps.push(...wave.pre, ...wave.post);
      for (const stage of wave.stages) {
        steps.push(...stage.pre, ...stage.post);
      }
    }

    const ret = new Array<string>();
    for (const step of steps) {
      if (!(step instanceof ShellStep)) { continue; }

      for (const outputRef of Object.values(step.envFromCfnOutputs)) {
        if (outputRef.isProducedBy(stack)) {
          ret.push(outputRef.outputName);
        }
      }
    }
    return ret;
  }

  /**
   * Find the stack deployment that is producing the given reference
   */
  public producingStack(outputReference: StackOutputReference): StackDeployment {
    for (const wave of this.pipeline.waves) {
      for (const stage of wave.stages) {
        for (const stack of stage.stacks) {
          if (outputReference.isProducedBy(stack)) {
            return stack;
          }
        }
      }
    }

    throw new Error(`Stack '${outputReference.stackDescription}' (producing output '${outputReference.outputName}') is not in the pipeline; call 'addStage()' to add the stack's Stage to the pipeline`);
  }

  /**
   * All assets referenced in all the Stacks of a StageDeployment
   */
  public assetsInStage(stage: StageDeployment): StackAsset[] {
    const assets = new Map<string, StackAsset>();

    for (const stack of stage.stacks) {
      for (const asset of stack.assets) {
        assets.set(asset.assetSelector, asset);
      }
    }

    return Array.from(assets.values());
  }
}