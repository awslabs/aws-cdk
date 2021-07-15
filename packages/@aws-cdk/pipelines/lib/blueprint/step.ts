import { FileSet, IFileSetProducer } from './file-set';

/**
 * A generic Step which can be added to a Pipeline
 *
 * Steps can be used to add Sources, Build Actions and Validations
 * to your pipeline.
 *
 * This class is abstract. See specific subclasses of Step for
 * useful steps to add to your Pipeline
 */
export abstract class Step implements IFileSetProducer {
  /**
   * The list of FileSets consumed by this Step
   */
  public readonly dependencyFileSets: FileSet[] = [];

  /**
   * Whether or not this is a Source step
   *
   * What it means to be a Source step depends on the engine.
   */
  public readonly isSource: boolean = false;

  private _primaryOutput?: FileSet;

  constructor(
    /** Identifier for this step */
    public readonly id: string) {
  }

  /**
   * Return the steps this step depends on, based on the FileSets it requires
   */
  public get dependencies(): Step[] {
    return this.dependencyFileSets.map(f => f.producer);
  }

  /**
   * Return a string representation of this Step
   */
  public toString() {
    return `${this.constructor.name}(${this.id})`;
  }

  /**
   * The primary FileSet produced by this Step
   *
   * Not all steps produce an output FileSet--if they do
   * you can substitute the `Step` object for the `FileSet` object.
   */
  public get primaryOutput(): FileSet | undefined {
    // Accessor so it can be mutable in children
    return this._primaryOutput;
  }

  /**
   * Add an additional FileSet to the set of file sets required by this step
   *
   * This will lead to a dependency on the producer of that file set.
   */
  protected addDependencyFileSet(fs: FileSet) {
    this.dependencyFileSets.push(fs);
  }

  /**
   * Configure the given FileSet as the primary output of this step
   */
  protected configurePrimaryOutput(fs: FileSet) {
    this._primaryOutput = fs;
  }
}