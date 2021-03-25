import * as cdk from '@aws-cdk/core';

const ensureArrayOrUndefined = (field: any) => {
  if (field === undefined) {
    return undefined;
  }
  if (typeof (field) !== 'string' && !Array.isArray(field)) {
    throw new Error('Fields must be either a string or an array of strings');
  }
  if (Array.isArray(field) && !!field.find((f: any) => typeof (f) !== 'string')) {
    throw new Error('Fields must be either a string or an array of strings');
  }
  return Array.isArray(field) ? field : [field];
};

/**
 * Represents a statement in an IoT policy document.
 */
export class PolicyStatement {

  /**
   * Creates a new PolicyStatement based on the object provided.
   * This will accept an object created from the `.toJSON()` call
   * @param obj the PolicyStatement in object form.
   */
  public static fromJson(obj: any) {
    return new PolicyStatement({
      actions: ensureArrayOrUndefined(obj.Action),
      resources: ensureArrayOrUndefined(obj.Resource),
      effect: obj.Effect,
    });
  }

  /**
   * Whether to allow or deny the actions in this statement
   */
  public effect: Effect;

  private readonly action = new Array<any>();
  private readonly resource = new Array<any>();

  constructor(props: PolicyStatementProps = {}) {
    // Validate actions
    for (const action of [...props.actions || []]) {

      if (!/^(\*|[a-zA-Z0-9-]+:[a-zA-Z0-9*]+)$/.test(action) && !cdk.Token.isUnresolved(action)) {
        throw new Error(`Action '${action}' is invalid. An action string consists of a service namespace, a colon, and the name of an action. Action names can include wildcards.`);
      }
    }

    this.effect = props.effect || Effect.ALLOW;

    this.addActions(...props.actions || []);
    this.addResources(...props.resources || []);
  }

  //
  // Actions
  //

  /**
   * Specify allowed actions into the "Action" section of the policy statement.
   *
   * @see https://docs.aws.amazon.com/iot/latest/developerguide/iot-policy-actions.html
   *
   * @param actions actions that will be allowed.
   */
  public addActions(...actions: string[]) {
    this.action.push(...actions);
  }

  //
  // Resources
  //

  /**
   * Specify resources that this policy statement applies into the "Resource" section of
   * this policy statement.
   *
   * @see https://docs.aws.amazon.com/iot/latest/developerguide/iot-action-resources.html
   *
   * @param arns Amazon Resource Names (ARNs) of the resources that this policy statement applies to
   */
  public addResources(...arns: string[]) {
    this.resource.push(...arns);
  }

  /**
   * Adds a ``"*"`` resource to this statement.
   */
  public addAllResources() {
    this.addResources('*');
  }

  /**
   * Indicates if this permission as at least one resource associated with it.
   */
  public get hasResource() {
    return this.resource && this.resource.length > 0;
  }

  /**
   * JSON-ify the policy statement
   *
   * Used when JSON.stringify() is called
   */
  public toStatementJson(): any {
    return noUndef({
      Action: _norm(this.action),
      Effect: _norm(this.effect),
      Resource: _norm(this.resource),
    });

    function _norm(values: any) {

      if (typeof(values) === 'undefined') {
        return undefined;
      }

      if (cdk.Token.isUnresolved(values)) {
        return values;
      }

      if (Array.isArray(values)) {
        if (!values || values.length === 0) {
          return undefined;
        }

        if (values.length === 1) {
          return values[0];
        }

        return values;
      }

      if (typeof(values) === 'object') {
        if (Object.keys(values).length === 0) {
          return undefined;
        }
      }

      return values;
    }
  }

  /**
   * String representation of this policy statement
   */
  public toString() {
    return cdk.Token.asString(this, {
      displayHint: 'PolicyStatement',
    });
  }

  /**
   * JSON-ify the statement
   *
   * Used when JSON.stringify() is called
   */
  public toJSON() {
    return this.toStatementJson();
  }

  /**
   * Validate that the policy statement satisfies base requirements for a policy.
   */
  public validateForAnyPolicy(): string[] {
    const errors = new Array<string>();
    if (this.action.length === 0) {
      errors.push('An IoT PolicyStatement must specify at least one \'action\'.');
    }
    if (this.resource.length === 0) {
      errors.push('An IoT PolicyStatement must specify at least one \'resource\'.');
    }
    return errors;
  }
}

/**
 * The Effect element of an IoT policy
 *
 * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_effect.html
 */
export enum Effect {
  /**
   * Allows access to a resource in an IAM policy statement. By default, access to resources are denied.
   */
  ALLOW = 'Allow',

  /**
   * Explicitly deny access to a resource. By default, all requests are denied implicitly.
   *
   * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html
   */
  DENY = 'Deny',
}


/**
 * Interface for creating a policy statement
 */
export interface PolicyStatementProps {
  /**
   * List of actions to add to the statement
   *
   * @default - no actions
   */
  readonly actions?: string[];

  /**
   * Resource ARNs to add to the statement
   *
   * @default - no resources
   */
  readonly resources?: string[];

  /**
   * Whether to allow or deny the actions in this statement
   *
   * @default Effect.ALLOW
   */
  readonly effect?: Effect;
}

function noUndef(x: any): any {
  const ret: any = {};
  for (const [key, value] of Object.entries(x)) {
    if (value !== undefined) {
      ret[key] = value;
    }
  }
  return ret;
}
