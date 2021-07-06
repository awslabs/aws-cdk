import * as cxapi from '@aws-cdk/cx-api';
import * as constructs from 'constructs';
import { Annotations } from '../annotations';
import { Aspects, IAspect } from '../aspect';
import { Construct, IConstruct, ISynthesisSession, SynthesisOptions, ValidationError } from '../construct-compat';
import { Stack } from '../stack';
import { Stage, StageSynthesisOptions } from '../stage';
import { MetadataResource } from './metadata-resource';
import { prepareApp } from './prepare-app';
import { TreeMetadata } from './tree-metadata';

export function synthesize(root: IConstruct, options: SynthesisOptions = { }): cxapi.CloudAssembly {
  // we start by calling "synth" on all nested assemblies (which will take care of all their children)
  synthNestedAssemblies(root, options);

  invokeAspects(root);

  injectMetadataResources(root);

  // This is mostly here for legacy purposes as the framework itself does not use prepare anymore.
  prepareTree(root);

  // resolve references
  prepareApp(root);

  // give all children an opportunity to validate now that we've finished prepare
  if (!options.skipValidation) {
    validateTree(root);
  }

  // in unit tests, we support creating free-standing stacks, so we create the
  // assembly builder here.
  const builder = Stage.isStage(root)
    ? root._assemblyBuilder
    : new cxapi.CloudAssemblyBuilder(options.outdir);

  // next, we invoke "onSynthesize" on all of our children. this will allow
  // stacks to add themselves to the synthesized cloud assembly.
  synthesizeTree(root, builder, options.validateOnSynthesis);

  return builder.buildAssembly();
}

const CUSTOM_SYNTHESIS_SYM = Symbol.for('@aws-cdk/core:customSynthesis');

/**
 * Interface for constructs that want to do something custom during synthesis
 *
 * This feature is intended for use by official AWS CDK libraries only; 3rd party
 * library authors and CDK users should not use this function.
 */
export interface ICustomSynthesis {
  /**
   * Called when the construct is synthesized
   */
  onSynthesize(session: ISynthesisSession): void;
}

export function addCustomSynthesis(construct: constructs.IConstruct, synthesis: ICustomSynthesis): void {
  Object.defineProperty(construct, CUSTOM_SYNTHESIS_SYM, {
    value: synthesis,
    enumerable: false,
  });
}

function getCustomSynthesis(construct: constructs.IConstruct): ICustomSynthesis | undefined {
  return (construct as any)[CUSTOM_SYNTHESIS_SYM];
}

/**
 * Find Assemblies inside the construct and call 'synth' on them
 *
 * (They will in turn recurse again)
 */
function synthNestedAssemblies(root: IConstruct, options: StageSynthesisOptions) {
  for (const child of root.node.children) {
    if (Stage.isStage(child)) {
      child.synth(options);
    } else {
      synthNestedAssemblies(child, options);
    }
  }
}

/**
 * Invoke aspects on the given construct tree.
 *
 * Aspects are not propagated across Assembly boundaries. The same Aspect will not be invoked
 * twice for the same construct.
 */
function invokeAspects(root: IConstruct) {
  const invokedByPath: { [nodePath: string]: IAspect[] } = { };

  let nestedAspectWarning = false;
  recurse(root, []);

  function recurse(construct: IConstruct, inheritedAspects: constructs.IAspect[]) {
    const node = construct.node;
    const aspects = Aspects.of(construct);
    const allAspectsHere = [...inheritedAspects ?? [], ...aspects.aspects];
    const nodeAspectsCount = aspects.aspects.length;
    for (const aspect of allAspectsHere) {
      let invoked = invokedByPath[node.path];
      if (!invoked) {
        invoked = invokedByPath[node.path] = [];
      }

      if (invoked.includes(aspect)) { continue; }

      aspect.visit(construct);

      // if an aspect was added to the node while invoking another aspect it will not be invoked, emit a warning
      // the `nestedAspectWarning` flag is used to prevent the warning from being emitted for every child
      if (!nestedAspectWarning && nodeAspectsCount !== aspects.aspects.length) {
        Annotations.of(construct).addWarning('We detected an Aspect was added via another Aspect, and will not be applied');
        nestedAspectWarning = true;
      }

      // mark as invoked for this node
      invoked.push(aspect);
    }

    for (const child of construct.node.children) {
      if (!Stage.isStage(child)) {
        recurse(child, allAspectsHere);
      }
    }
  }
}

/**
 * Prepare all constructs in the given construct tree in post-order.
 *
 * Stop at Assembly boundaries.
 */
function prepareTree(root: IConstruct) {
  visit(root, 'post', construct => construct.onPrepare());
}

/**
 * Find all stacks and add Metadata Resources to all of them
 *
 * There is no good generic place to do this. Can't do it in the constructor
 * (because adding a child construct makes it impossible to set context on the
 * node), and the generic prepare phase is deprecated.
 *
 * Only do this on [parent] stacks (not nested stacks), don't do this when
 * disabled by the user.
 *
 * Also, only when running via the CLI. If we do it unconditionally,
 * all unit tests everywhere are going to break massively. I've spent a day
 * fixing our own, but downstream users would be affected just as badly.
 *
 * Stop at Assembly boundaries.
 */
function injectMetadataResources(root: IConstruct) {
  visit(root, 'post', construct => {
    if (!Stack.isStack(construct) || !construct._versionReportingEnabled) { return; }

    // Because of https://github.com/aws/aws-cdk/blob/master/packages/assert-internal/lib/synth-utils.ts#L74
    // synthesize() may be called more than once on a stack in unit tests, and the below would break
    // if we execute it a second time. Guard against the constructs already existing.
    const CDKMetadata = 'CDKMetadata';
    if (construct.node.tryFindChild(CDKMetadata)) { return; }

    new MetadataResource(construct, CDKMetadata);
  });
}

/**
 * Synthesize children in post-order into the given builder
 *
 * Stop at Assembly boundaries.
 */
function synthesizeTree(root: IConstruct, builder: cxapi.CloudAssemblyBuilder, validateOnSynth: boolean = false) {
  visit(root, 'post', construct => {
    const session = {
      outdir: builder.outdir,
      assembly: builder,
      validateOnSynth,
    };

    if (Stack.isStack(construct)) {
      construct.synthesizer.synthesize(session);
    } else if (construct instanceof TreeMetadata) {
      construct._synthesizeTree(session);
    } else {
      const custom = getCustomSynthesis(construct);
      custom?.onSynthesize(session);
    }

    // this will soon be deprecated and removed in 2.x
    // see https://github.com/aws/aws-cdk-rfcs/issues/192
    construct.onSynthesize(session);
  });
}

/**
 * Validate all constructs in the given construct tree
 */
function validateTree(root: IConstruct) {
  const errors = new Array<ValidationError>();

  // Validations added through `node.addValidation()`
  // This automatically also includes Ye Olde Method of validating, using
  // the `protected validate()` methods.
  errors.push(...constructs.Node.of(root).validate().map(e => ({
    message: e.message, source: e.source as unknown as Construct,
  })));

  if (errors.length > 0) {
    const errorList = errors.map(e => `[${e.source.node.path}] ${e.message}`).join('\n  ');
    throw new Error(`Validation failed with the following errors:\n  ${errorList}`);
  }
}

/**
 * Visit the given construct tree in either pre or post order, stopping at Assemblies
 */
function visit(root: IConstruct, order: 'pre' | 'post', cb: (x: IProtectedConstructMethods) => void) {
  if (order === 'pre') {
    cb(root as IProtectedConstructMethods);
  }

  for (const child of root.node.children) {
    if (Stage.isStage(child)) { continue; }
    visit(child, order, cb);
  }

  if (order === 'post') {
    cb(root as IProtectedConstructMethods);
  }
}

/**
 * Interface which provides access to special methods of Construct
 *
 */
interface IProtectedConstructMethods extends IConstruct {
  /**
   * Method that gets called when a construct should synthesize itself to an assembly
   */
  onSynthesize(session: constructs.ISynthesisSession): void;

  /**
   * Method that gets called to validate a construct
   */
  onValidate(): string[];

  /**
   * Method that gets called to prepare a construct
   */
  onPrepare(): void;
}
