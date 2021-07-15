import { CfnOutput, Stack } from '@aws-cdk/core';
import { mapValues } from '../private/javascript';
import { FileSet, IFileSetProducer } from './file-set';
import { StackDeployment } from './stack-deployment';
import { Step } from './step';

/**
 * Construction properties for a `ShellStep`.
 */
export interface ShellStepProps {
  /**
   * Commands to run
   */
  readonly commands: string[];

  /**
   * Installation commands to run before the regular commands
   *
   * For deployment engines that support it, install commands will be classified
   * differently in the job history from the regular `commands`.
   *
   * @default - No installation commands
   */
  readonly installCommands?: string[];

  /**
   * Environment variables to set
   *
   * @default - No environment variables
   */
  readonly env?: Record<string, string>;

  /**
   * Set environment variables based on Stack Outputs
   *
   * `ShellStep`s following stack or stage deployments may
   * access the `CfnOutput`s of those stacks to get access to
   * --for example--automatically generated resource names or
   * endpoint URLs.
   *
   * @default - No environment variables created from stack outputs
   */
  readonly envFromCfnOutputs?: Record<string, CfnOutput>;

  /**
   * FileSet to run these scripts on
   *
   * The files in the FileSet will be placed in the working directory when
   * the script is executed. Use `additionalInputs` to download file sets
   * to other directories as well.
   *
   * @default - No input specified
   */
  readonly input?: IFileSetProducer;

  /**
   * Additional FileSets to put in other directories
   *
   * Specifies a mapping from directory name to FileSets. During the
   * script execution, the FileSets will be available in the directories
   * indicated.
   *
   * The directory names may be relative. For example, you can put
   * the main input and an additional input side-by-side with the
   * following configuration:
   *
   * ```ts
   * const script = new ShellStep('MainScript', {
   *   // ...
   *   input: MyEngineSource.gitHub('org/source1'),
   *   additionalInputs: {
   *     '../siblingdir': MyEngineSource.gitHub('org/source2'),
   *   }
   * });
   * ```
   *
   * @default - No additional inputs
   */
  readonly additionalInputs?: Record<string, IFileSetProducer>;

  /**
   * The directory that will contain the primary output fileset
   *
   * After running the script, the contents of the given directory
   * will be treated as the primary output of this Step.
   *
   * @default - No primary output
   */
  readonly primaryOutputDirectory?: string;

}

/**
 * Run shell script commands in the pipeline
 */
export class ShellStep extends Step {
  /**
   * Commands to run
   */
  public readonly commands: string[];

  /**
   * Installation commands to run before the regular commands
   *
   * For deployment engines that support it, install commands will be classified
   * differently in the job history from the regular `commands`.
   *
   * @default - No installation commands
   */
  public readonly installCommands: string[];

  /**
   * Environment variables to set
   *
   * @default - No environment variables
   */
  public readonly env: Record<string, string>;

  /**
   * Set environment variables based on Stack Outputs
   *
   * @default - No environment variables created from stack outputs
   */
  public readonly envFromCfnOutputs: Record<string, StackOutputReference>;

  /**
   * Input FileSets
   *
   * A list of `(FileSet, directory)` pairs, which are a copy of the
   * input properties. This list should not be modified directly.
   */
  public readonly inputs: FileSetLocation[] = [];

  /**
   * Output FileSets
   *
   * A list of `(FileSet, directory)` pairs, which are a copy of the
   * input properties. This list should not be modified directly.
   */
  public readonly outputs: FileSetLocation[] = [];

  private readonly _additionalOutputs: Record<string, FileSet> = {};

  private _primaryOutputDirectory?: string;

  constructor(id: string, props: ShellStepProps) {
    super(id);

    this.commands = props.commands;
    this.installCommands = props.installCommands ?? [];
    this.env = props.env ?? {};
    this.envFromCfnOutputs = mapValues(props.envFromCfnOutputs ?? {}, StackOutputReference.fromCfnOutput);

    // Inputs
    if (props.input) {
      const fileSet = props.input.primaryOutput;
      if (!fileSet) {
        throw new Error(`'${id}': primary input should be a step that produces a file set, got ${props.input}`);
      }
      this.addDependencyFileSet(fileSet);
      this.inputs.push({ directory: '.', fileSet });
    }

    for (const [directory, step] of Object.entries(props.additionalInputs ?? {})) {
      if (directory === '.') {
        throw new Error(`'${id}': input for directory '.' should be passed via 'input' property`);
      }

      const fileSet = step.primaryOutput;
      if (!fileSet) {
        throw new Error(`'${id}': additionalInput for directory '${directory}' should be a step that produces a file set, got ${step}`);
      }
      this.addDependencyFileSet(fileSet);
      this.inputs.push({ directory, fileSet });
    }

    // Outputs

    if (props.primaryOutputDirectory) {
      this._primaryOutputDirectory = props.primaryOutputDirectory;
      const fileSet = new FileSet('Output', this);
      this.configurePrimaryOutput(fileSet);
      this.outputs.push({ directory: props.primaryOutputDirectory, fileSet });
    }
  }

  /**
   * Configure the given output directory as primary output
   *
   * If no primary output has been configured yet, this directory
   * will become the primary output of this ShellStep, otherwise this
   * method will throw if the given directory is different than the
   * currently configured primary output directory.
   */
  public primaryOutputDirectory(directory: string): FileSet {
    if (this._primaryOutputDirectory !== undefined) {
      if (this._primaryOutputDirectory !== directory) {
        throw new Error(`${this}: primaryOutputDirectory is '${this._primaryOutputDirectory}', cannot be changed to '${directory}'`);
      }

      return this.primaryOutput!;
    }

    this._primaryOutputDirectory = directory;
    const fileSet = new FileSet('Output', this);
    this.configurePrimaryOutput(fileSet);
    this.outputs.push({ directory: directory, fileSet });
    return fileSet;
  }

  /**
   * Add an additional output FileSet based on a directory.
   *
   *
   * After running the script, the contents of the given directory
   * will be exported as a `FileSet`. Use the `FileSet` as the
   * input to another step.
   *
   * Multiple calls with the exact same directory name string (not normalized)
   * will return the same FileSet.
   */
  public addOutputDirectory(directory: string): FileSet {
    let fileSet = this._additionalOutputs[directory];
    if (!fileSet) {
      fileSet = new FileSet(directory, this);
      this._additionalOutputs[directory] = fileSet;
      this.outputs.push({ directory, fileSet });
    }
    return fileSet;
  }
}

/**
 * Location of a FileSet consumed or produced by a ShellStep
 */
export interface FileSetLocation {
  /**
   * The (relative) directory where the FileSet is found
   */
  readonly directory: string;

  /**
   * The FileSet object
   */
  readonly fileSet: FileSet;
}

/**
 * A Reference to a Stack Output
 */
export class StackOutputReference {
  /**
   * Create a StackOutputReference that references the given CfnOutput
   */
  public static fromCfnOutput(output: CfnOutput) {
    const stack = Stack.of(output);
    return new StackOutputReference(stack.node.path, stack.artifactId, stack.resolve(output.logicalId));
  }

  private constructor(
    /** A human-readable description of the producing stack */
    public readonly stackDescription: string,
    /** Artifact id of the producing stack */
    private readonly stackArtifactId: string,
    /** Output name of the producing stack */
    public readonly outputName: string) {
  }

  /**
   * Whether or not this stack output is being produced by the given Stack deployment
   */
  public isProducedBy(stack: StackDeployment) {
    return stack.stackArtifactId === this.stackArtifactId;
  }
}