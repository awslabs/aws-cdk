import * as cp from '@aws-cdk/aws-codepipeline';
import { FileSet } from '../blueprint';
import { PipelineGraph } from '../helpers-internal';

/**
 * Translate FileSets to CodePipeline Artifacts
 */
export class ArtifactMap {
  private artifacts = new Map<FileSet, cp.Artifact>();
  private usedNames = new Set<string>();

  /**
   * Return the matching CodePipeline artifact for a FileSet
   */
  public toCodePipeline(x: FileSet): cp.Artifact {
    if (x instanceof CodePipelineFileSet) {
      return x._artifact;
    }

    let ret = this.artifacts.get(x);
    if (!ret) {
      // They all need a name
      const artifactName = this.makeUniqueName(`${x.producer.id}.${x.id}`);
      this.usedNames.add(artifactName);
      this.artifacts.set(x, ret = new cp.Artifact(artifactName));
    }
    return ret;
  }

  private makeUniqueName(baseName: string) {
    let i = 1;
    baseName = sanitizeArtifactName(baseName);
    let name = baseName;
    while (this.usedNames.has(name)) {
      name = `${baseName}${++i}`;
    }
    return name;
  }
}

function sanitizeArtifactName(x: string): string {
  // FIXME: Does this REALLY not allow '.'? The docs don't mention it, but action names etc. do!
  return x.replace(/[^A-Za-z0-9@\-_]/g, '_');
}

/**
 * A FileSet created from a CodePipeline artifact
 *
 * You only need to use this if you want to add CDK Pipeline stages
 * add the end of an existing CodePipeline, which should be very rare.
 */
export class CodePipelineFileSet extends FileSet {
  /**
   * Turn a CodePipeline Artifact into a FileSet
   */
  public static fromArtifact(artifact: cp.Artifact) {
    return new CodePipelineFileSet(artifact);
  }

  /**
   * The artifact this class is wrapping
   *
   * @internal
   */
  public readonly _artifact: cp.Artifact;

  private constructor(artifact: cp.Artifact) {
    super(artifact.artifactName ?? 'Imported', PipelineGraph.NO_STEP);
    this._artifact = artifact;
  }
}