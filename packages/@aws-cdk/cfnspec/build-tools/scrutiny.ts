import { schema } from '../lib';
import { PropertyScrutinyType, ResourceScrutinyType } from '../lib/schema';

/**
 * Auto-detect common properties to apply scrutiny to by using heuristics
 *
 * Manually enhancing scrutiny attributes for each property does not scale
 * well. Fortunately, the most important ones follow a common naming scheme and
 * we tag all of them at once in this way.
 *
 * If the heuristic scheme gets it wrong in some individual cases, those can be
 * fixed using schema patches.
 */
export function detectScrutinyTypes(spec: schema.Specification) {
  for (const [typeName, typeSpec] of Object.entries(spec.ResourceTypes)) {
    if (typeSpec.ScrutinyType !== undefined) { continue; } // Already assigned

    detectResourceScrutiny(typeName, typeSpec);

    // If a resource scrutiny is set by now, we don't need to look at the properties anymore
    if (typeSpec.ScrutinyType !== undefined) { continue; }

    for (const [propertyName, propertySpec] of Object.entries(typeSpec.Properties || {})) {
      if (propertySpec.ScrutinyType !== undefined) { continue; } // Already assigned

      detectPropertyScrutiny(typeName, propertyName, propertySpec);
    }
  }
}

/**
 * Detect and assign a scrutiny type for the resource
 */
function detectResourceScrutiny(typeName: string, typeSpec: schema.ResourceType) {
  const properties = Object.entries(typeSpec.Properties || {});

  // If this resource is named like *Policy and has a PolicyDocument property
  if (typeName.endsWith('Policy') && properties.some(apply2(isPolicyDocumentProperty))) {
    typeSpec.ScrutinyType = isIamType(typeName) ? ResourceScrutinyType.IdentityPolicyResource : ResourceScrutinyType.ResourcePolicyResource;
    return;
  }
}

/**
 * Detect and assign a scrutiny type for the property
 */
function detectPropertyScrutiny(_typeName: string, propertyName: string, propertySpec: schema.Property) {
  // Detect fields named like ManagedPolicyArns
  if (propertyName === 'ManagedPolicyArns') {
    propertySpec.ScrutinyType = PropertyScrutinyType.ManagedPolicies;
    return;
  }

  if (propertyName === 'Policies' && schema.isComplexListProperty(propertySpec) && propertySpec.ItemType === 'Policy') {
    propertySpec.ScrutinyType = PropertyScrutinyType.InlineIdentityPolicies;
    return;
  }

  if (isPolicyDocumentProperty(propertyName, propertySpec)) {
    propertySpec.ScrutinyType = PropertyScrutinyType.InlineResourcePolicy;
    return;
  }
}

function isIamType(typeName: string) {
  return typeName.indexOf('::IAM::') > 1;
}

function isPolicyDocumentProperty(propertyName: string, propertySpec: schema.Property) {
  const nameContainsPolicy = propertyName.indexOf('Policy') > -1;
  const primitiveType = schema.isPrimitiveProperty(propertySpec) && propertySpec.PrimitiveType;

  if (nameContainsPolicy && primitiveType === 'Json') {
    return true;
  }
  return false;
}

/**
 * Make a function that takes 2 arguments take an array of 2 elements instead
 *
 * Makes it possible to map it over an array of arrays. TypeScript won't allow
 * me to overload this type declaration so we need a different function for
 * every # of arguments.
 */
function apply2<T1, T2, R>(fn: (a1: T1, a2: T2) => R): (as: [T1, T2]) => R {
  return (as) => fn.apply(fn, as);
}