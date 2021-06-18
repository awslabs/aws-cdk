import { Assertion, JestFriendlyAssertion } from '../assertion';
import { StackInspector } from '../inspector';
import { anything, deepObjectLike, match, objectLike } from './have-resource-matchers';

/**
 * Magic value to signify that a certain key should be absent from the property bag.
 *
 * The property is either not present or set to `undefined.
 *
 * NOTE: `ABSENT` only works with the `haveResource()` and `haveResourceLike()`
 * assertions.
 */
export const ABSENT = '{{ABSENT}}';

/**
 * An assertion to check whether a resource of a given type and with the given properties exists, disregarding properties
 *
 * @param resourceType the type of the resource that is expected to be present.
 * @param properties   the properties that the resource is expected to have. A function may be provided, in which case
 *                     it will be called with the properties of candidate resources and an ``InspectionFailure``
 *                     instance on which errors should be appended, and should return a truthy value to denote a match.
 * @param comparison   the entity that is being asserted against.
 * @param allowValueExtension if properties is an object, tells whether values must match exactly, or if they are
 *                     allowed to be supersets of the reference values. Meaningless if properties is a function.
 */
export function haveResource(
    resourceType: string,
    properties?: any,
    comparison?: ResourcePart,
    allowValueExtension: boolean = false): Assertion<StackInspector> {
  return new HaveResourceAssertion(resourceType, properties, comparison, allowValueExtension);
}

/**
 * Sugar for calling ``haveResource`` with ``allowValueExtension`` set to ``true``.
 */
export function haveResourceLike(
    resourceType: string,
    properties?: any,
    comparison?: ResourcePart) {
  return haveResource(resourceType, properties, comparison, true);
}

export type PropertyMatcher = (props: any, inspection: InspectionFailure) => boolean;

export class HaveResourceAssertion extends JestFriendlyAssertion<StackInspector> {
  private readonly inspected: InspectionFailure[] = [];
  private readonly part: ResourcePart;
  private readonly matcher: any;

  constructor(
    private readonly resourceType: string,
    properties?: any,
    part?: ResourcePart,
    allowValueExtension: boolean = false) {
    super();

    this.matcher = isCallable(properties) ? properties :
      properties === undefined ? anything() :
        allowValueExtension ? deepObjectLike(properties) :
          objectLike(properties);
    this.part = part ?? ResourcePart.Properties;
  }

  public assertUsing(inspector: StackInspector): boolean {
    for (const logicalId of Object.keys(inspector.value.Resources || {})) {
      const resource = inspector.value.Resources[logicalId];
      if (resource.Type === this.resourceType) {
        const propsToCheck = this.part === ResourcePart.Properties ? (resource.Properties ?? {}) : resource;

        // Pass inspection object as 2nd argument, initialize failure with default string,
        // to maintain backwards compatibility with old predicate API.
        const inspection = { resource, failureReason: 'Object did not match predicate' };

        if (match(propsToCheck, this.matcher, inspection)) {
          return true;
        }

        this.inspected.push(inspection);
      }
    }

    return false;
  }

  public generateErrorMessage() {
    const lines: string[] = [];
    lines.push(`None of ${this.inspected.length} resources matches ${this.description}.`);

    for (const inspected of this.inspected) {
      lines.push(`- ${inspected.failureReason} in:`);
      lines.push(indent(4, JSON.stringify(inspected.resource, null, 2)));
    }

    return lines.join('\n');
  }

  public assertOrThrow(inspector: StackInspector) {
    if (!this.assertUsing(inspector)) {
      throw new Error(this.generateErrorMessage());
    }
  }

  public get description(): string {
    // eslint-disable-next-line max-len
    return `resource '${this.resourceType}' with ${JSON.stringify(this.matcher, undefined, 2)}`;
  }
}

function indent(n: number, s: string) {
  const prefix = ' '.repeat(n);
  return prefix + s.replace(/\n/g, '\n' + prefix);
}

export interface InspectionFailure {
  resource: any;
  failureReason: string;
}

/**
 * What part of the resource to compare
 */
export enum ResourcePart {
  /**
   * Only compare the resource's properties
   */
  Properties,

  /**
   * Check the entire CloudFormation config
   *
   * (including UpdateConfig, DependsOn, etc.)
   */
  CompleteDefinition
}

/**
 * Whether a value is a callable
 */
function isCallable(x: any): x is ((...args: any[]) => any) {
  return x && {}.toString.call(x) === '[object Function]';
}

/**
 * Return whether `superObj` is a super-object of `obj`.
 *
 * A super-object has the same or more property values, recursing into sub properties if ``allowValueExtension`` is true.
 *
 * At any point in the object, a value may be replaced with a function which will be used to check that particular field.
 * The type of a matcher function is expected to be of type PropertyMatcher.
 *
 * @deprecated - Use `objectLike` or a literal object instead.
 */
export function isSuperObject(superObj: any, pattern: any, errors: string[] = [], allowValueExtension: boolean = false): boolean {
  const matcher = allowValueExtension ? deepObjectLike(pattern) : objectLike(pattern);

  const inspection: InspectionFailure = { resource: superObj, failureReason: '' };
  const ret = match(superObj, matcher, inspection);
  if (!ret) {
    errors.push(inspection.failureReason);
  }
  return ret;
}
