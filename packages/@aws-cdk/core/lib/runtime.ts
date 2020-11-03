import { Construct } from './construct-compat';

// ----------------------------------------------------------------------
// PROPERTY MAPPERS
//
// These are used while converting generated classes/property bags to CloudFormation property objects
//
// We use identity mappers for the primitive types. These don't do anything but are there to make the code
// generation work out nicely (so the code generator doesn't need to emit different code for primitive
// vs. complex types).
export type Mapper = (x: any) => any;

function identity(x: any) {
  return x;
}

export const stringToCloudFormation: Mapper = identity;
export const booleanToCloudFormation: Mapper = identity;
export const objectToCloudFormation: Mapper = identity;
export const numberToCloudFormation: Mapper = identity;

/**
 * The date needs to be formatted as an ISO date in UTC
 *
 * Some usage sites require a date, some require a timestamp. We'll
 * always output a timestamp and hope the parser on the other end
 * is smart enough to ignore the time part... (?)
 */
export function dateToCloudFormation(x?: Date): any {
  if (!x) {
    return undefined;
  }

  // eslint-disable-next-line max-len
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}T${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}:${pad(x.getUTCSeconds())}`;
}

/**
 * Pad a number to 2 decimal places
 */
function pad(x: number) {
  if (x < 10) {
    return '0' + x.toString();
  }
  return x.toString();
}

/**
 * Turn a tag object into the proper CloudFormation representation
 */
export function cfnTagToCloudFormation(x: any): any {
  return {
    Key: x.key,
    Value: x.value,
  };
}

export function listMapper(elementMapper: Mapper): Mapper {
  return (x: any) => {
    if (!canInspect(x)) { return x; }
    return x.map(elementMapper);
  };
}

export function hashMapper(elementMapper: Mapper): Mapper {
  return (x: any) => {
    if (!canInspect(x)) { return x; }

    const ret: any = {};

    Object.keys(x).forEach((key) => {
      ret[key] = elementMapper(x[key]);
    });

    return ret;
  };
}

/**
 * Return a union mapper
 *
 * Takes a list of validators and a list of mappers, which should correspond pairwise.
 *
 * The mapper of the first successful validator will be called.
 */
export function unionMapper(validators: Validator[], mappers: Mapper[]): Mapper {
  if (validators.length !== mappers.length) {
    throw Error('Not the same amount of validators and mappers passed to unionMapper()');
  }

  return (x: any) => {
    if (!canInspect(x)) { return x; }

    for (let i = 0; i < validators.length; i++) {
      if (validators[i](x).isSuccess) {
        return mappers[i](x);
      }
    }

    // Should not be possible because the union must have passed validation before this function
    // will be called, but catch it anyway.
    throw new TypeError('No validators matched in the union()');
  };
}

// ----------------------------------------------------------------------
// VALIDATORS
//
// These are used while checking that supplied property bags match the expected schema
//
// We have a couple of datatypes that model validation errors and collections of validation
// errors (together forming a tree of errors so that we can trace validation errors through
// an object graph), and validators.
//
// Validators are simply functions that take a value and return a validation results. Then
// we have some combinators to turn primitive validators into more complex validators.
//

/**
 * Representation of validation results
 *
 * Models a tree of validation errors so that we have as much information as possible
 * about the failure that occurred.
 */
export class ValidationResult {
  constructor(readonly errorMessage: string = '', readonly results: ValidationResults = new ValidationResults()) {
  }

  public get isSuccess(): boolean {
    return !this.errorMessage && this.results.isSuccess;
  }

  /**
   * Turn a failed validation into an exception
   */
  public assertSuccess() {
    if (!this.isSuccess) {
      let message = this.errorTree();
      // The first letter will be lowercase, so uppercase it for a nicer error message
      message = message.substr(0, 1).toUpperCase() + message.substr(1);
      throw new CfnSynthesisError(message);
    }
  }

  /**
   * Return a string rendering of the tree of validation failures
   */
  public errorTree(): string {
    const childMessages = this.results.errorTreeList();
    return this.errorMessage + (childMessages.length ? `\n  ${childMessages.replace(/\n/g, '\n  ')}` : '');
  }

  /**
   * Wrap this result with an error message, if it concerns an error
   */
  public prefix(message: string): ValidationResult {
    if (this.isSuccess) { return this; }
    return new ValidationResult(`${message}: ${this.errorMessage}`, this.results);
  }
}

/**
 * A collection of validation results
 */
export class ValidationResults {
  constructor(public results: ValidationResult[] = []) {
  }

  public collect(result: ValidationResult) {
    // Only collect failures
    if (!result.isSuccess) {
      this.results.push(result);
    }
  }

  public get isSuccess(): boolean {
    return this.results.every(x => x.isSuccess);
  }

  public errorTreeList(): string {
    return this.results.map(child => child.errorTree()).join('\n');
  }

  /**
   * Wrap up all validation results into a single tree node
   *
   * If there are failures in the collection, add a message, otherwise
   * return a success.
   */
  public wrap(message: string): ValidationResult {
    if (this.isSuccess) { return VALIDATION_SUCCESS; }
    return new ValidationResult(message, this);
  }
}

// Singleton object to save on allocations
export const VALIDATION_SUCCESS = new ValidationResult();

export type Validator = (x: any) => ValidationResult;

/**
 * Return whether this object can be validated at all
 *
 * True unless it's undefined or a CloudFormation intrinsic
 */
export function canInspect(x: any) {
  // Note: using weak equality on purpose, we also want to catch undefined
  return (x != null && !isCloudFormationIntrinsic(x));
}

// CloudFormation validators for primitive types
export function validateString(x: any): ValidationResult {
  if (canInspect(x) && typeof x !== 'string') {
    return new ValidationResult(`${JSON.stringify(x)} should be a string`);
  }
  return VALIDATION_SUCCESS;
}

export function validateNumber(x: any): ValidationResult {
  if (canInspect(x) && typeof x !== 'number') {
    return new ValidationResult(`${JSON.stringify(x)} should be a number`);
  }
  return VALIDATION_SUCCESS;
}

export function validateBoolean(x: any): ValidationResult {
  if (canInspect(x) && typeof x !== 'boolean') {
    return new ValidationResult(`${JSON.stringify(x)} should be a boolean`);
  }
  return VALIDATION_SUCCESS;
}

export function validateDate(x: any): ValidationResult {
  if (canInspect(x) && !(x instanceof Date)) {
    return new ValidationResult(`${JSON.stringify(x)} should be a Date`);
  }

  if (x !== undefined && isNaN(x.getTime())) {
    return new ValidationResult('got an unparseable Date');
  }

  return VALIDATION_SUCCESS;
}

export function validateObject(x: any): ValidationResult {
  if (canInspect(x) && typeof x !== 'object') {
    return new ValidationResult(`${JSON.stringify(x)} should be an 'object'`);
  }
  return VALIDATION_SUCCESS;
}

export function validateCfnTag(x: any): ValidationResult {
  if (!canInspect(x)) { return VALIDATION_SUCCESS; }

  if (x.key == null || x.value == null) {
    return new ValidationResult(`${JSON.stringify(x)} should have a 'key' and a 'value' property`);
  }

  return VALIDATION_SUCCESS;
}

/**
 * Return a list validator based on the given element validator
 */
export function listValidator(elementValidator: Validator): Validator {
  return (x: any) => {
    if (!canInspect(x)) { return VALIDATION_SUCCESS; }

    if (!x.forEach) {
      return new ValidationResult(`${JSON.stringify(x)} should be a list`);
    }

    for (let i = 0; i < x.length; i++) {
      const element = x[i];
      const result = elementValidator(element);
      if (!result.isSuccess) { return result.prefix(`element ${i}`); }
    }

    return VALIDATION_SUCCESS;
  };
}

/**
 * Return a hash validator based on the given element validator
 */
export function hashValidator(elementValidator: Validator): Validator {
  return (x: any) => {
    if (!canInspect(x)) { return VALIDATION_SUCCESS; }

    for (const key of Object.keys(x)) {
      const result = elementValidator(x[key]);
      if (!result.isSuccess) { return result.prefix(`element '${key}'`); }
    }

    return VALIDATION_SUCCESS;
  };
}

/**
 * Decorate a validator with a message clarifying the property the failure is for.
 */
export function propertyValidator(propName: string, validator: Validator): Validator {
  return (x: any) => {
    return validator(x).prefix(propName);
  };
}

/**
 * Return a validator that will fail if the passed property is not present
 *
 * Does not distinguish between the property actually not being present, vs being present but 'null'
 * or 'undefined' (courtesy of JavaScript), which is generally the behavior that we want.
 *
 * Empty strings are considered "present"--don't know if this agrees with how CloudFormation looks
 * at the world.
 */
export function requiredValidator(x: any) {
  if (x == null) {
    return new ValidationResult('required but missing');
  }
  return VALIDATION_SUCCESS;
}

/**
 * Require a property from a property bag.
 *
 * @param props  the property bag from which a property is required.
 * @param name   the name of the required property.
 * @param typeName the name of the construct type that requires the property
 *
 * @returns the value of ``props[name]``
 *
 * @throws if the property ``name`` is not present in ``props``.
 */
export function requireProperty(props: { [name: string]: any }, name: string, context: Construct): any {
  const value = props[name];
  if (value == null) {
    throw new Error(`${context.toString()} is missing required property: ${name}`);
  }
  // Possibly add type-checking here...
  return value;
}

/**
 * Validates if any of the given validators matches
 *
 * We add either/or words to the front of the error mesages so that they read
 * more nicely. Example:
 *
 *   Properties not correct for 'FunctionProps'
 *     codeUri: not one of the possible types
 *       either: properties not correct for 'S3LocationProperty'
 *         bucket: required but missing
 *         key: required but missing
 *         version: required but missing
 *       or: '3' should be a 'string'
 *
 */
export function unionValidator(...validators: Validator[]): Validator {
  return (x: any) => {
    const results = new ValidationResults();
    let eitherOr = 'either';

    for (const validator of validators) {
      const result = validator(x);
      if (result.isSuccess) { return result; }
      results.collect(result.prefix(eitherOr));
      eitherOr = 'or';
    }
    return results.wrap('not one of the possible types');
  };
}

/**
 * Return whether the indicated value represents a CloudFormation intrinsic.
 *
 * CloudFormation intrinsics are modeled as objects with a single key, which
 * look like: { "Fn::GetAtt": [...] } or similar.
 */
function isCloudFormationIntrinsic(x: any) {
  if (!(typeof x === 'object')) { return false; }
  const keys = Object.keys(x);
  if (keys.length !== 1) { return false; }

  return keys[0] === 'Ref' || keys[0].substr(0, 4) === 'Fn::' || keys[0].startsWith('$Cdk::');
}

// Cannot be public because JSII gets confused about es5.d.ts
class CfnSynthesisError extends Error {
  public readonly type = 'CfnSynthesisError';
}
