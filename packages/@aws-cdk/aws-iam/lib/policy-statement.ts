import * as cdk from '@aws-cdk/core';
import { Group } from './group';
import {
  AccountPrincipal, AccountRootPrincipal, Anyone, ArnPrincipal, CanonicalUserPrincipal,
  FederatedPrincipal, IPrincipal, PrincipalBase, PrincipalPolicyFragment, ServicePrincipal, ServicePrincipalOpts,
} from './principals';
import { mergePrincipal } from './util';

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
 * Represents a statement in an IAM policy document.
 */
export class PolicyStatement {
  /**
   * Creates a new PolicyStatement based on the object provided.
   * This will accept an object created from the `.toJSON()` call
   * @param obj the PolicyStatement in object form.
   */
  public static fromJson(obj: any) {
    const ret = new PolicyStatement({
      sid: obj.Sid,
      actions: ensureArrayOrUndefined(obj.Action),
      resources: ensureArrayOrUndefined(obj.Resource),
      conditions: obj.Condition,
      effect: obj.Effect,
      notActions: ensureArrayOrUndefined(obj.NotAction),
      notResources: ensureArrayOrUndefined(obj.NotResource),
      principals: obj.Principal ? [new JsonPrincipal(obj.Principal)] : undefined,
      notPrincipals: obj.NotPrincipal ? [new JsonPrincipal(obj.NotPrincipal)] : undefined,
    });

    // validate that the PolicyStatement has the correct shape
    const errors = ret.validateForAnyPolicy();
    if (errors.length > 0) {
      throw new Error('Incorrect Policy Statement: ' + errors.join('\n'));
    }

    return ret;
  }

  /**
   * Statement ID for this statement
   */
  public sid?: string;
  /**
   * Whether to allow or deny the actions in this statement
   */
  public effect: Effect;

  private readonly action = new Array<any>();
  private readonly notAction = new Array<any>();
  private readonly principal: { [key: string]: any[] } = {};
  private readonly notPrincipal: { [key: string]: any[] } = {};
  private readonly resource = new Array<any>();
  private readonly notResource = new Array<any>();
  private readonly condition: { [key: string]: any } = { };
  private principalConditionsJson?: string;

  constructor(props: PolicyStatementProps = {}) {
    // Validate actions
    for (const action of [...props.actions || [], ...props.notActions || []]) {
      if (!/^(\*|[a-zA-Z0-9-]+:[a-zA-Z0-9*]+)$/.test(action) && !cdk.Token.isUnresolved(action)) {
        throw new Error(`Action '${action}' is invalid. An action string consists of a service namespace, a colon, and the name of an action. Action names can include wildcards.`);
      }
    }

    this.sid = props.sid;
    this.effect = props.effect || Effect.ALLOW;

    this.addActions(...props.actions || []);
    this.addNotActions(...props.notActions || []);
    this.addPrincipals(...props.principals || []);
    this.addNotPrincipals(...props.notPrincipals || []);
    this.addResources(...props.resources || []);
    this.addNotResources(...props.notResources || []);
    if (props.conditions !== undefined) {
      this.addConditions(props.conditions);
    }
  }

  //
  // Actions
  //

  /**
   * Specify allowed actions into the "Action" section of the policy statement.
   *
   * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_action.html
   *
   * @param actions actions that will be allowed.
   */
  public addActions(...actions: string[]) {
    if (actions.length > 0 && this.notAction.length > 0) {
      throw new Error('Cannot add \'Actions\' to policy statement if \'NotActions\' have been added');
    }
    this.action.push(...actions);
  }

  /**
   * Explicitly allow all actions except the specified list of actions into the "NotAction" section
   * of the policy document.
   *
   * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_notaction.html
   *
   * @param notActions actions that will be denied. All other actions will be permitted.
   */
  public addNotActions(...notActions: string[]) {
    if (notActions.length > 0 && this.action.length > 0) {
      throw new Error('Cannot add \'NotActions\' to policy statement if \'Actions\' have been added');
    }
    this.notAction.push(...notActions);
  }

  //
  // Principal
  //

  /**
   * Indicates if this permission has a "Principal" section.
   */
  public get hasPrincipal() {
    return Object.keys(this.principal).length > 0 || Object.keys(this.notPrincipal).length > 0;
  }

  /**
   * Adds principals to the "Principal" section of a policy statement.
   *
   * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html
   *
   * @param principals IAM principals that will be added
   */
  public addPrincipals(...principals: IPrincipal[]) {
    if (Object.keys(principals).length > 0 && Object.keys(this.notPrincipal).length > 0) {
      throw new Error('Cannot add \'Principals\' to policy statement if \'NotPrincipals\' have been added');
    }
    for (const principal of principals) {
      this.validatePolicyPrincipal(principal);
      const fragment = principal.policyFragment;
      mergePrincipal(this.principal, fragment.principalJson);
      this.addPrincipalConditions(fragment.conditions);
    }
  }

  /**
   * Specify principals that is not allowed or denied access to the "NotPrincipal" section of
   * a policy statement.
   *
   * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_notprincipal.html
   *
   * @param notPrincipals IAM principals that will be denied access
   */
  public addNotPrincipals(...notPrincipals: IPrincipal[]) {
    if (Object.keys(notPrincipals).length > 0 && Object.keys(this.principal).length > 0) {
      throw new Error('Cannot add \'NotPrincipals\' to policy statement if \'Principals\' have been added');
    }
    for (const notPrincipal of notPrincipals) {
      this.validatePolicyPrincipal(notPrincipal);
      const fragment = notPrincipal.policyFragment;
      mergePrincipal(this.notPrincipal, fragment.principalJson);
      this.addPrincipalConditions(fragment.conditions);
    }
  }

  private validatePolicyPrincipal(principal: IPrincipal) {
    if (principal instanceof Group) {
      throw new Error('Cannot use an IAM Group as the \'Principal\' or \'NotPrincipal\' in an IAM Policy');
    }
  }

  /**
   * Specify AWS account ID as the principal entity to the "Principal" section of a policy statement.
   */
  public addAwsAccountPrincipal(accountId: string) {
    this.addPrincipals(new AccountPrincipal(accountId));
  }

  /**
   * Specify a principal using the ARN  identifier of the principal.
   * You cannot specify IAM groups and instance profiles as principals.
   *
   * @param arn ARN identifier of AWS account, IAM user, or IAM role (i.e. arn:aws:iam::123456789012:user/user-name)
   */
  public addArnPrincipal(arn: string) {
    this.addPrincipals(new ArnPrincipal(arn));
  }

  /**
   * Adds a service principal to this policy statement.
   *
   * @param service the service name for which a service principal is requested (e.g: `s3.amazonaws.com`).
   * @param opts    options for adding the service principal (such as specifying a principal in a different region)
   */
  public addServicePrincipal(service: string, opts?: ServicePrincipalOpts) {
    this.addPrincipals(new ServicePrincipal(service, opts));
  }

  /**
   * Adds a federated identity provider such as Amazon Cognito to this policy statement.
   *
   * @param federated federated identity provider (i.e. 'cognito-identity.amazonaws.com')
   * @param conditions The conditions under which the policy is in effect.
   *   See [the IAM documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition.html).
   */
  public addFederatedPrincipal(federated: any, conditions: Conditions) {
    this.addPrincipals(new FederatedPrincipal(federated, conditions));
  }

  /**
   * Adds an AWS account root user principal to this policy statement
   */
  public addAccountRootPrincipal() {
    this.addPrincipals(new AccountRootPrincipal());
  }

  /**
   * Adds a canonical user ID principal to this policy document
   *
   * @param canonicalUserId unique identifier assigned by AWS for every account
   */
  public addCanonicalUserPrincipal(canonicalUserId: string) {
    this.addPrincipals(new CanonicalUserPrincipal(canonicalUserId));
  }

  /**
   * Adds all identities in all accounts ("*") to this policy statement
   */
  public addAnyPrincipal() {
    this.addPrincipals(new Anyone());
  }

  //
  // Resources
  //

  /**
   * Specify resources that this policy statement applies into the "Resource" section of
   * this policy statement.
   *
   * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_resource.html
   *
   * @param arns Amazon Resource Names (ARNs) of the resources that this policy statement applies to
   */
  public addResources(...arns: string[]) {
    if (arns.length > 0 && this.notResource.length > 0) {
      throw new Error('Cannot add \'Resources\' to policy statement if \'NotResources\' have been added');
    }
    this.resource.push(...arns);
  }

  /**
   * Specify resources that this policy statement will not apply to in the "NotResource" section
   * of this policy statement. All resources except the specified list will be matched.
   *
   * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_notresource.html
   *
   * @param arns Amazon Resource Names (ARNs) of the resources that this policy statement does not apply to
   */
  public addNotResources(...arns: string[]) {
    if (arns.length > 0 && this.resource.length > 0) {
      throw new Error('Cannot add \'NotResources\' to policy statement if \'Resources\' have been added');
    }
    this.notResource.push(...arns);
  }

  /**
   * Adds a ``"*"`` resource to this statement.
   */
  public addAllResources() {
    this.addResources('*');
  }

  /**
   * Indicates if this permission has at least one resource associated with it.
   */
  public get hasResource() {
    return this.resource && this.resource.length > 0;
  }

  //
  // Condition
  //

  /**
   * Add a condition to the Policy
   */
  public addCondition(key: string, value: Condition) {
    const existingValue = this.condition[key];
    this.condition[key] = existingValue ? { ...existingValue, ...value } : value;
  }

  /**
   * Add multiple conditions to the Policy
   */
  public addConditions(conditions: Conditions) {
    Object.keys(conditions).map(key => {
      this.addCondition(key, conditions[key]);
    });
  }

  /**
   * Add a condition that limits to a given account
   */
  public addAccountCondition(accountId: string) {
    this.addCondition('StringEquals', { 'sts:ExternalId': accountId });
  }

  /**
   * JSON-ify the policy statement
   *
   * Used when JSON.stringify() is called
   */
  public toStatementJson(): any {
    return noUndef({
      Action: _norm(this.action, { unique: true }),
      NotAction: _norm(this.notAction, { unique: true }),
      Condition: _norm(this.condition),
      Effect: _norm(this.effect),
      Principal: _normPrincipal(this.principal),
      NotPrincipal: _normPrincipal(this.notPrincipal),
      Resource: _norm(this.resource, { unique: true }),
      NotResource: _norm(this.notResource, { unique: true }),
      Sid: _norm(this.sid),
    });

    function _norm(values: any, { unique }: { unique: boolean } = { unique: false }) {
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

        return unique ? [...new Set(values)] : values;
      }

      if (typeof(values) === 'object') {
        if (Object.keys(values).length === 0) {
          return undefined;
        }
      }

      return values;
    }

    function _normPrincipal(principal: { [key: string]: any[] }) {
      const keys = Object.keys(principal);
      if (keys.length === 0) { return undefined; }
      const result: any = {};
      for (const key of keys) {
        const normVal = _norm(principal[key]);
        if (normVal) {
          result[key] = normVal;
        }
      }
      if (Object.keys(result).length === 1 && result.AWS === '*') {
        return '*';
      }
      return result;
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
   * Add a principal's conditions
   *
   * For convenience, principals have been modeled as both a principal
   * and a set of conditions. This makes it possible to have a single
   * object represent e.g. an "SNS Topic" (SNS service principal + aws:SourcArn
   * condition) or an Organization member (* + aws:OrgId condition).
   *
   * However, when using multiple principals in the same policy statement,
   * they must all have the same conditions or the OR samentics
   * implied by a list of principals cannot be guaranteed (user needs to
   * add multiple statements in that case).
   */
  private addPrincipalConditions(conditions: Conditions) {
    // Stringifying the conditions is an easy way to do deep equality
    const theseConditions = JSON.stringify(conditions);
    if (this.principalConditionsJson === undefined) {
      // First principal, anything goes
      this.principalConditionsJson = theseConditions;
    } else {
      if (this.principalConditionsJson !== theseConditions) {
        throw new Error(`All principals in a PolicyStatement must have the same Conditions (got '${this.principalConditionsJson}' and '${theseConditions}'). Use multiple statements instead.`);
      }
    }
    this.addConditions(conditions);
  }

  /**
   * Validate that the policy statement satisfies base requirements for a policy.
   */
  public validateForAnyPolicy(): string[] {
    const errors = new Array<string>();
    if (this.action.length === 0 && this.notAction.length === 0) {
      errors.push('A PolicyStatement must specify at least one \'action\' or \'notAction\'.');
    }
    return errors;
  }

  /**
   * Validate that the policy statement satisfies all requirements for a resource-based policy.
   */
  public validateForResourcePolicy(): string[] {
    const errors = this.validateForAnyPolicy();
    if (Object.keys(this.principal).length === 0 && Object.keys(this.notPrincipal).length === 0) {
      errors.push('A PolicyStatement used in a resource-based policy must specify at least one IAM principal.');
    }
    return errors;
  }

  /**
   * Validate that the policy statement satisfies all requirements for an identity-based policy.
   */
  public validateForIdentityPolicy(): string[] {
    const errors = this.validateForAnyPolicy();
    if (Object.keys(this.principal).length > 0 || Object.keys(this.notPrincipal).length > 0) {
      errors.push('A PolicyStatement used in an identity-based policy cannot specify any IAM principals.');
    }
    if (Object.keys(this.resource).length === 0 && Object.keys(this.notResource).length === 0) {
      errors.push('A PolicyStatement used in an identity-based policy must specify at least one resource.');
    }
    return errors;
  }
}

/**
 * The Effect element of an IAM policy
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
 * Condition for when an IAM policy is in effect. Maps from the keys in a request's context to
 * a string value or array of string values. See the Conditions interface for more details.
 */
export type Condition = any;

// NOTE! We'd ideally like to type this as `Record<string, any>`, because the
// API expects a map which can take either strings or lists of strings.
//
// However, if we were to change this right now, the Java bindings for CDK would
// emit a type of `Map<String, Object>`, but the most common types people would
// instantiate would be an `ImmutableMap<String, String>` which would not be
// assignable to `Map<String, Object>`. The types don't have a built-in notion
// of co-contravariance, you have to indicate that on the type. So jsii would first
// need to emit the type as `Map<String, ? extends Object>`.
//
// Feature request in https://github.com/aws/jsii/issues/1517

/**
 * Conditions for when an IAM Policy is in effect, specified in the following structure:
 *
 * `{ "Operator": { "keyInRequestContext": "value" } }`
 *
 * The value can be either a single string value or an array of string values.
 *
 * For more information, including which operators are supported, see [the IAM
 * documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition.html).
 */
export type Conditions = Record<string, Condition>;

/**
 * Interface for creating a policy statement
 */
export interface PolicyStatementProps {
  /**
   * The Sid (statement ID) is an optional identifier that you provide for the
   * policy statement. You can assign a Sid value to each statement in a
   * statement array. In services that let you specify an ID element, such as
   * SQS and SNS, the Sid value is just a sub-ID of the policy document's ID. In
   * IAM, the Sid value must be unique within a JSON policy.
   *
   * @default - no sid
   */
  readonly sid?: string;

  /**
   * List of actions to add to the statement
   *
   * @default - no actions
   */
  readonly actions?: string[];

  /**
   * List of not actions to add to the statement
   *
   * @default - no not-actions
   */
  readonly notActions?: string[];

  /**
   * List of principals to add to the statement
   *
   * @default - no principals
   */
  readonly principals?: IPrincipal[];

  /**
   * List of not principals to add to the statement
   *
   * @default - no not principals
   */
  readonly notPrincipals?: IPrincipal[];

  /**
   * Resource ARNs to add to the statement
   *
   * @default - no resources
   */
  readonly resources?: string[];

  /**
   * NotResource ARNs to add to the statement
   *
   * @default - no not-resources
   */
  readonly notResources?: string[];

  /**
   * Conditions to add to the statement
   *
   * @default - no condition
   */
  readonly conditions?: {[key: string]: any};

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

class JsonPrincipal extends PrincipalBase {
  public readonly policyFragment: PrincipalPolicyFragment;

  constructor(json: any = { }) {
    super();

    // special case: if principal is a string, turn it into an "AWS" principal
    if (typeof(json) === 'string') {
      json = { AWS: json };
    }

    this.policyFragment = {
      principalJson: json,
      conditions: {},
    };
  }
}
