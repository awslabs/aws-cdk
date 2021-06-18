import * as cxapi from '@aws-cdk/cx-api';
import * as colors from 'colors/safe';
import * as minimatch from 'minimatch';
import * as semver from 'semver';
import { error, print, warning } from '../../logging';
import { flatten } from '../../util';
import { versionNumber } from '../../version';

export enum DefaultSelection {
  /**
   * Returns an empty selection in case there are no selectors.
   */
  None = 'none',

  /**
   * If the app includes a single stack, returns it. Otherwise throws an exception.
   * This behavior is used by "deploy".
   */
  OnlySingle = 'single',

  /**
   * Returns all stacks in the main (top level) assembly only.
   */
  MainAssembly = 'main',

  /**
   * If no selectors are provided, returns all stacks in the app,
   * including stacks inside nested assemblies.
   */
  AllStacks = 'all',
}

export interface SelectStacksOptions {
  /**
   * Extend the selection to upstread/downstream stacks
   * @default ExtendedStackSelection.None only select the specified stacks.
   */
  extend?: ExtendedStackSelection;

  /**
   * The behavior if if no selectors are privided.
   */
  defaultBehavior: DefaultSelection;
}

/**
 * When selecting stacks, what other stacks to include because of dependencies
 */
export enum ExtendedStackSelection {
  /**
   * Don't select any extra stacks
   */
  None,

  /**
   * Include stacks that this stack depends on
   */
  Upstream,

  /**
   * Include stacks that depend on this stack
   */
  Downstream
}

/**
 * A specification of which stacks should be selected
 */
export interface StackSelector {
  /**
   * Whether all stacks at the top level assembly should
   * be selected and nothing else
   */
  allTopLevel?: boolean,

  /**
   * A list of patterns to match the stack hierarchical ids
   */
  patterns: string[],
}

/**
 * A single Cloud Assembly and the operations we do on it to deploy the artifacts inside
 */
export class CloudAssembly {
  /**
   * The directory this CloudAssembly was read from
   */
  public readonly directory: string;

  constructor(public readonly assembly: cxapi.CloudAssembly) {
    this.directory = assembly.directory;
  }

  public async selectStacks(selector: StackSelector, options: SelectStacksOptions): Promise<StackCollection> {
    const asm = this.assembly;
    const topLevelStacks = asm.stacks;
    const stacks = semver.major(asm.version) < 10 ? asm.stacks : asm.stacksRecursively;
    const allTopLevel = selector.allTopLevel ?? false;
    const patterns = sanitizePatterns(selector.patterns);

    if (stacks.length === 0) {
      throw new Error('This app contains no stacks');
    }

    if (allTopLevel) {
      return this.selectTopLevelStacks(stacks, topLevelStacks, options.extend);
    } else if (patterns.length > 0) {
      return this.selectMatchingStacks(stacks, patterns, options.extend);
    } else {
      return this.selectDefaultStacks(stacks, topLevelStacks, options.defaultBehavior);
    }
  }

  private selectTopLevelStacks(stacks: cxapi.CloudFormationStackArtifact[],
    topLevelStacks: cxapi.CloudFormationStackArtifact[],
    extend: ExtendedStackSelection = ExtendedStackSelection.None): StackCollection {
    if (topLevelStacks.length > 0) {
      return this.extendStacks(topLevelStacks, stacks, extend);
    } else {
      throw new Error('No stack found in the main cloud assembly. Use "list" to print manifest');
    }
  }

  private selectMatchingStacks(stacks: cxapi.CloudFormationStackArtifact[],
    patterns: string[],
    extend: ExtendedStackSelection = ExtendedStackSelection.None): StackCollection {
    const matchingPattern = (pattern: string) => (stack: cxapi.CloudFormationStackArtifact) => {
      if (minimatch(stack.hierarchicalId, pattern)) {
        return true;
      } else if (stack.id === pattern && semver.major(versionNumber()) < 2) {
        warning('Selecting stack by identifier "%s". This identifier is deprecated and will be removed in v2. Please use "%s" instead.', colors.bold(stack.id), colors.bold(stack.hierarchicalId));
        warning('Run "cdk ls" to see a list of all stack identifiers');
        return true;
      }
      return false;
    };

    const matchedStacks = flatten(patterns.map(pattern => stacks.filter(matchingPattern(pattern))));

    return this.extendStacks(matchedStacks, stacks, extend);
  }

  private selectDefaultStacks(stacks: cxapi.CloudFormationStackArtifact[],
    topLevelStacks: cxapi.CloudFormationStackArtifact[],
    defaultSelection: DefaultSelection) {
    switch (defaultSelection) {
      case DefaultSelection.MainAssembly:
        return new StackCollection(this, topLevelStacks);
      case DefaultSelection.AllStacks:
        return new StackCollection(this, stacks);
      case DefaultSelection.None:
        return new StackCollection(this, []);
      case DefaultSelection.OnlySingle:
        if (topLevelStacks.length === 1) {
          return new StackCollection(this, topLevelStacks);
        } else {
          throw new Error('Since this app includes more than a single stack, specify which stacks to use (wildcards are supported) or specify `--all`\n' +
          `Stacks: ${stacks.map(x => x.id).join(' ')}`);
        }
      default:
        throw new Error(`invalid default behavior: ${defaultSelection}`);
    }
  }

  private extendStacks(matched: cxapi.CloudFormationStackArtifact[],
    all: cxapi.CloudFormationStackArtifact[],
    extend: ExtendedStackSelection = ExtendedStackSelection.None) {
    const allStacks = new Map<string, cxapi.CloudFormationStackArtifact>();
    for (const stack of all) {
      allStacks.set(stack.hierarchicalId, stack);
    }

    const index = indexByHierarchicalId(matched);

    switch (extend) {
      case ExtendedStackSelection.Downstream:
        includeDownstreamStacks(index, allStacks);
        break;
      case ExtendedStackSelection.Upstream:
        includeUpstreamStacks(index, allStacks);
        break;
    }

    // Filter original array because it is in the right order
    const selectedList = all.filter(s => index.has(s.hierarchicalId));

    return new StackCollection(this, selectedList);
  }

  /**
   * Select a single stack by its ID
   */
  public stackById(stackId: string) {
    return new StackCollection(this, [this.assembly.getStackArtifact(stackId)]);
  }
}

/**
 * A collection of stacks and related artifacts
 *
 * In practice, not all artifacts in the CloudAssembly are created equal;
 * stacks can be selected independently, but other artifacts such as asset
 * bundles cannot.
 */
export class StackCollection {
  constructor(public readonly assembly: CloudAssembly, public readonly stackArtifacts: cxapi.CloudFormationStackArtifact[]) {
  }

  public get stackCount() {
    return this.stackArtifacts.length;
  }

  public get firstStack() {
    if (this.stackCount < 1) {
      throw new Error('StackCollection contains no stack artifacts (trying to access the first one)');
    }
    return this.stackArtifacts[0];
  }

  public get stackIds(): string[] {
    return this.stackArtifacts.map(s => s.id);
  }

  public reversed() {
    const arts = [...this.stackArtifacts];
    arts.reverse();
    return new StackCollection(this.assembly, arts);
  }

  public filter(predicate: (art: cxapi.CloudFormationStackArtifact) => boolean): StackCollection {
    return new StackCollection(this.assembly, this.stackArtifacts.filter(predicate));
  }

  public concat(other: StackCollection): StackCollection {
    return new StackCollection(this.assembly, this.stackArtifacts.concat(other.stackArtifacts));
  }

  /**
   * Extracts 'aws:cdk:warning|info|error' metadata entries from the stack synthesis
   */
  public processMetadataMessages(options: MetadataMessageOptions = {}) {
    let warnings = false;
    let errors = false;

    for (const stack of this.stackArtifacts) {
      for (const message of stack.messages) {
        switch (message.level) {
          case cxapi.SynthesisMessageLevel.WARNING:
            warnings = true;
            printMessage(warning, 'Warning', message.id, message.entry);
            break;
          case cxapi.SynthesisMessageLevel.ERROR:
            errors = true;
            printMessage(error, 'Error', message.id, message.entry);
            break;
          case cxapi.SynthesisMessageLevel.INFO:
            printMessage(print, 'Info', message.id, message.entry);
            break;
        }
      }
    }

    if (errors && !options.ignoreErrors) {
      throw new Error('Found errors');
    }

    if (options.strict && warnings) {
      throw new Error('Found warnings (--strict mode)');
    }

    function printMessage(logFn: (s: string) => void, prefix: string, id: string, entry: cxapi.MetadataEntry) {
      logFn(`[${prefix} at ${id}] ${entry.data}`);

      if (options.verbose && entry.trace) {
        logFn(`  ${entry.trace.join('\n  ')}`);
      }
    }
  }
}

export interface MetadataMessageOptions {
  /**
   * Whether to be verbose
   *
   * @default false
   */
  verbose?: boolean;

  /**
   * Don't stop on error metadata
   *
   * @default false
   */
  ignoreErrors?: boolean;

  /**
   * Treat warnings in metadata as errors
   *
   * @default false
   */
  strict?: boolean;
}

function indexByHierarchicalId(stacks: cxapi.CloudFormationStackArtifact[]): Map<string, cxapi.CloudFormationStackArtifact> {
  const result = new Map<string, cxapi.CloudFormationStackArtifact>();

  for (const stack of stacks) {
    result.set(stack.hierarchicalId, stack);
  }

  return result;
}

/**
 * Calculate the transitive closure of stack dependents.
 *
 * Modifies `selectedStacks` in-place.
 */
function includeDownstreamStacks(
    selectedStacks: Map<string, cxapi.CloudFormationStackArtifact>,
    allStacks: Map<string, cxapi.CloudFormationStackArtifact>) {
  const added = new Array<string>();

  let madeProgress;
  do {
    madeProgress = false;

    for (const [id, stack] of allStacks) {
      // Select this stack if it's not selected yet AND it depends on a stack that's in the selected set
      if (!selectedStacks.has(id) && (stack.dependencies || []).some(dep => selectedStacks.has(dep.id))) {
        selectedStacks.set(id, stack);
        added.push(id);
        madeProgress = true;
      }
    }
  } while (madeProgress);

  if (added.length > 0) {
    print('Including depending stacks: %s', colors.bold(added.join(', ')));
  }
}

/**
 * Calculate the transitive closure of stack dependencies.
 *
 * Modifies `selectedStacks` in-place.
 */
function includeUpstreamStacks(
    selectedStacks: Map<string, cxapi.CloudFormationStackArtifact>,
    allStacks: Map<string, cxapi.CloudFormationStackArtifact>) {
  const added = new Array<string>();
  let madeProgress = true;
  while (madeProgress) {
    madeProgress = false;

    for (const stack of selectedStacks.values()) {
      // Select an additional stack if it's not selected yet and a dependency of a selected stack (and exists, obviously)
      for (const dependencyId of stack.dependencies.map(x => x.manifest.displayName ?? x.id)) {
        if (!selectedStacks.has(dependencyId) && allStacks.has(dependencyId)) {
          added.push(dependencyId);
          selectedStacks.set(dependencyId, allStacks.get(dependencyId)!);
          madeProgress = true;
        }
      }
    }
  }

  if (added.length > 0) {
    print('Including dependency stacks: %s', colors.bold(added.join(', ')));
  }
}

function sanitizePatterns(patterns: string[]): string[] {
  let sanitized = patterns.filter(s => s != null); // filter null/undefined
  sanitized = [...new Set(sanitized)]; // make them unique
  return sanitized;
}