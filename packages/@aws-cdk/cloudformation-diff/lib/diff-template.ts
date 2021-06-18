import * as impl from './diff';
import * as types from './diff/types';
import { deepEqual, diffKeyedEntities, unionOf } from './diff/util';

export * from './diff/types';

type DiffHandler = (diff: types.ITemplateDiff, oldValue: any, newValue: any) => void;
type HandlerRegistry = { [section: string]: DiffHandler };

const DIFF_HANDLERS: HandlerRegistry = {
  AWSTemplateFormatVersion: (diff, oldValue, newValue) =>
    diff.awsTemplateFormatVersion = impl.diffAttribute(oldValue, newValue),
  Description: (diff, oldValue, newValue) =>
    diff.description = impl.diffAttribute(oldValue, newValue),
  Metadata: (diff, oldValue, newValue) =>
    diff.metadata = new types.DifferenceCollection(diffKeyedEntities(oldValue, newValue, impl.diffMetadata)),
  Parameters: (diff, oldValue, newValue) =>
    diff.parameters = new types.DifferenceCollection(diffKeyedEntities(oldValue, newValue, impl.diffParameter)),
  Mappings: (diff, oldValue, newValue) =>
    diff.mappings = new types.DifferenceCollection(diffKeyedEntities(oldValue, newValue, impl.diffMapping)),
  Conditions: (diff, oldValue, newValue) =>
    diff.conditions = new types.DifferenceCollection(diffKeyedEntities(oldValue, newValue, impl.diffCondition)),
  Transform: (diff, oldValue, newValue) =>
    diff.transform = impl.diffAttribute(oldValue, newValue),
  Resources: (diff, oldValue, newValue) =>
    diff.resources = new types.DifferenceCollection(diffKeyedEntities(oldValue, newValue, impl.diffResource)),
  Outputs: (diff, oldValue, newValue) =>
    diff.outputs = new types.DifferenceCollection(diffKeyedEntities(oldValue, newValue, impl.diffOutput)),
};

/**
 * Compare two CloudFormation templates and return semantic differences between them.
 *
 * @param currentTemplate the current state of the stack.
 * @param newTemplate     the target state of the stack.
 *
 * @returns a +types.TemplateDiff+ object that represents the changes that will happen if
 *      a stack which current state is described by +currentTemplate+ is updated with
 *      the template +newTemplate+.
 */
export function diffTemplate(currentTemplate: { [key: string]: any }, newTemplate: { [key: string]: any }): types.TemplateDiff {
  // Base diff
  const theDiff = calculateTemplateDiff(currentTemplate, newTemplate);

  // We're going to modify this in-place
  const newTemplateCopy = deepCopy(newTemplate);

  let didPropagateReferenceChanges;
  let diffWithReplacements;
  do {
    diffWithReplacements = calculateTemplateDiff(currentTemplate, newTemplateCopy);

    // Propagate replacements for replaced resources
    didPropagateReferenceChanges = false;
    if (diffWithReplacements.resources) {
      diffWithReplacements.resources.forEachDifference((logicalId, change) => {
        if (change.changeImpact === types.ResourceImpact.WILL_REPLACE) {
          if (propagateReplacedReferences(newTemplateCopy, logicalId)) {
            didPropagateReferenceChanges = true;
          }
        }
      });
    }
  } while (didPropagateReferenceChanges);

  // Copy "replaced" states from `diffWithReplacements` to `theDiff`.
  diffWithReplacements.resources
    .filter(r => isReplacement(r!.changeImpact))
    .forEachDifference((logicalId, downstreamReplacement) => {
      const resource = theDiff.resources.get(logicalId);

      if (resource.changeImpact !== downstreamReplacement.changeImpact) {
        propagatePropertyReplacement(downstreamReplacement, resource);
      }
    });

  return theDiff;
}

function isReplacement(impact: types.ResourceImpact) {
  return impact === types.ResourceImpact.MAY_REPLACE || impact === types.ResourceImpact.WILL_REPLACE;
}

/**
 * For all properties in 'source' that have a "replacement" impact, propagate that impact to "dest"
 */
function propagatePropertyReplacement(source: types.ResourceDifference, dest: types.ResourceDifference) {
  for (const [propertyName, diff] of Object.entries(source.propertyUpdates)) {
    if (diff.changeImpact && isReplacement(diff.changeImpact)) {
      // Use the propertydiff of source in target. The result of this happens to be clear enough.
      dest.setPropertyChange(propertyName, diff);
    }
  }
}

function calculateTemplateDiff(currentTemplate: { [key: string]: any }, newTemplate: { [key: string]: any }): types.TemplateDiff {
  const differences: types.ITemplateDiff = {};
  const unknown: { [key: string]: types.Difference<any> } = {};
  for (const key of unionOf(Object.keys(currentTemplate), Object.keys(newTemplate)).sort()) {
    const oldValue = currentTemplate[key];
    const newValue = newTemplate[key];
    if (deepEqual(oldValue, newValue)) { continue; }
    const handler: DiffHandler = DIFF_HANDLERS[key]
                  || ((_diff, oldV, newV) => unknown[key] = impl.diffUnknown(oldV, newV));
    handler(differences, oldValue, newValue);
  }
  if (Object.keys(unknown).length > 0) { differences.unknown = new types.DifferenceCollection(unknown); }

  return new types.TemplateDiff(differences);
}

/**
 * Compare two CloudFormation resources and return semantic differences between them
 */
export function diffResource(oldValue: types.Resource, newValue: types.Resource): types.ResourceDifference {
  return impl.diffResource(oldValue, newValue);
}

/**
 * Replace all references to the given logicalID on the given template, in-place
 *
 * Returns true iff any references were replaced.
 */
function propagateReplacedReferences(template: object, logicalId: string): boolean {
  let ret = false;

  function recurse(obj: any) {
    if (Array.isArray(obj)) {
      obj.forEach(recurse);
    }

    if (typeof obj === 'object' && obj !== null) {
      if (!replaceReference(obj)) {
        Object.values(obj).forEach(recurse);
      }
    }
  }

  function replaceReference(obj: any) {
    const keys = Object.keys(obj);
    if (keys.length !== 1) { return false; }
    const key = keys[0];

    if (key === 'Ref') {
      if (obj.Ref === logicalId) {
        obj.Ref = logicalId + ' (replaced)';
        ret = true;
      }
      return true;
    }

    if (key.startsWith('Fn::')) {
      if (Array.isArray(obj[key]) && obj[key].length > 0 && obj[key][0] === logicalId) {
        obj[key][0] = logicalId + '(replaced)';
        ret = true;
      }
      return true;
    }

    return false;
  }

  recurse(template);
  return ret;
}

function deepCopy(x: any): any {
  if (Array.isArray(x)) {
    return x.map(deepCopy);
  }

  if (typeof x === 'object' && x !== null) {
    const ret: any = {};
    for (const key of Object.keys(x)) {
      ret[key] = deepCopy(x[key]);
    }
    return ret;
  }

  return x;
}
