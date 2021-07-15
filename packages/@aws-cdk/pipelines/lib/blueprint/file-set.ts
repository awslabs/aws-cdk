import { Step } from './step';

/**
 * A set of files traveling through the deployment pipeline
 *
 * Individual steps in the pipeline produce or consume
 * `FileSet`s.
 */
export class FileSet implements IFileSetProducer {
  /**
   * The primary output of a file set producer
   *
   * The primary output of a FileSet is itself.
   */
  public readonly primaryOutput?: FileSet = this;
  private _producer?: Step;

  constructor(
    /** Human-readable descriptor for this file set (does not need to be unique) */
    public readonly id: string, producer?: Step) {
    this._producer = producer;
  }

  /**
   * The Step that produces this FileSet
   */
  public get producer() {
    if (!this._producer) {
      throw new Error(`FileSet '${this.id}' doesn\'t have a producer; call 'fileSet.producedBy()'`);
    }
    return this._producer;
  }

  /**
   * Mark the given Step as the producer for this FileSet
   *
   * This method can only be called once.
   */
  public producedBy(producer?: Step) {
    if (this._producer) {
      throw new Error(`FileSet '${this.id}' already has a producer (${this._producer}) while setting producer: ${producer}`);
    }
    this._producer = producer;
  }

  /**
   * Return a string representation of this FileSet
   */
  public toString() {
    return `FileSet(${this.id})`;
  }
}

/**
 * Any class that produces, or is itself, a `FileSet`
 *
 * Steps implicitly produce a primary FileSet as an output.
 */
export interface IFileSetProducer {
  /**
   * The `FileSet` produced by this file set producer
   *
   * @default - This producer doesn't produce any file set
   */
  readonly primaryOutput?: FileSet;
}