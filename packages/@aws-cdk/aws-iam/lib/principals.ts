import * as cdk from '@aws-cdk/core';
import { Default, RegionInfo } from '@aws-cdk/region-info';
import { IOpenIdConnectProvider } from './oidc-provider';
import { Condition, Conditions, PolicyStatement } from './policy-statement';
import { ISamlProvider } from './saml-provider';
import { mergePrincipal } from './util';

/**
 * Any object that has an associated principal that a permission can be granted to
 */
export interface IGrantable {
  /**
   * The principal to grant permissions to
   */
  readonly grantPrincipal: IPrincipal;
}

/**
 * Represents a logical IAM principal.
 *
 * An IPrincipal describes a logical entity that can perform AWS API calls
 * against sets of resources, optionally under certain conditions.
 *
 * Examples of simple principals are IAM objects that you create, such
 * as Users or Roles.
 *
 * An example of a more complex principals is a `ServicePrincipal` (such as
 * `new ServicePrincipal("sns.amazonaws.com")`, which represents the Simple
 * Notifications Service).
 *
 * A single logical Principal may also map to a set of physical principals.
 * For example, `new OrganizationPrincipal('o-1234')` represents all
 * identities that are part of the given AWS Organization.
 */
export interface IPrincipal extends IGrantable {
  /**
   * When this Principal is used in an AssumeRole policy, the action to use.
   */
  readonly assumeRoleAction: string;

  /**
   * Return the policy fragment that identifies this principal in a Policy.
   */
  readonly policyFragment: PrincipalPolicyFragment;

  /**
   * The AWS account ID of this principal.
   * Can be undefined when the account is not known
   * (for example, for service principals).
   * Can be a Token - in that case,
   * it's assumed to be AWS::AccountId.
   */
  readonly principalAccount?: string;

  /**
   * Add to the policy of this principal.
   *
   * @returns true if the statement was added, false if the principal in
   * question does not have a policy document to add the statement to.
   *
   * @deprecated Use `addToPrincipalPolicy` instead.
   */
  addToPolicy(statement: PolicyStatement): boolean;

  /**
   * Add to the policy of this principal.
   */
  addToPrincipalPolicy(statement: PolicyStatement): AddToPrincipalPolicyResult;
}

/**
 * Result of calling `addToPrincipalPolicy`
 */
export interface AddToPrincipalPolicyResult {
  /**
   * Whether the statement was added to the identity's policies.
   *
   */
  readonly statementAdded: boolean;

  /**
   * Dependable which allows depending on the policy change being applied
   *
   * @default - Required if `statementAdded` is true.
   */
  readonly policyDependable?: cdk.IDependable;
}

/**
 * Base class for policy principals
 */
export abstract class PrincipalBase implements IPrincipal {
  public readonly grantPrincipal: IPrincipal = this;
  public readonly principalAccount: string | undefined = undefined;

  /**
   * Return the policy fragment that identifies this principal in a Policy.
   */
  public abstract readonly policyFragment: PrincipalPolicyFragment;

  /**
   * When this Principal is used in an AssumeRole policy, the action to use.
   */
  public readonly assumeRoleAction: string = 'sts:AssumeRole';

  public addToPolicy(statement: PolicyStatement): boolean {
    return this.addToPrincipalPolicy(statement).statementAdded;
  }

  public addToPrincipalPolicy(_statement: PolicyStatement): AddToPrincipalPolicyResult {
    // This base class is used for non-identity principals. None of them
    // have a PolicyDocument to add to.
    return { statementAdded: false };
  }

  public toString() {
    // This is a first pass to make the object readable. Descendant principals
    // should return something nicer.
    return JSON.stringify(this.policyFragment.principalJson);
  }

  /**
   * JSON-ify the principal
   *
   * Used when JSON.stringify() is called
   */
  public toJSON() {
    // Have to implement toJSON() because the default will lead to infinite recursion.
    return this.policyFragment.principalJson;
  }

  /**
   * Returns a new PrincipalWithConditions using this principal as the base, with the
   * passed conditions added.
   *
   * When there is a value for the same operator and key in both the principal and the
   * conditions parameter, the value from the conditions parameter will be used.
   *
   * @returns a new PrincipalWithConditions object.
   */
  public withConditions(conditions: Conditions): IPrincipal {
    return new PrincipalWithConditions(this, conditions);
  }
}

/**
 * An IAM principal with additional conditions specifying when the policy is in effect.
 *
 * For more information about conditions, see:
 * https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition.html
 */
export class PrincipalWithConditions implements IPrincipal {
  public readonly grantPrincipal: IPrincipal = this;
  public readonly assumeRoleAction: string = this.principal.assumeRoleAction;
  private additionalConditions: Conditions;

  constructor(
    private readonly principal: IPrincipal,
    conditions: Conditions,
  ) {
    this.additionalConditions = conditions;
  }

  /**
   * Add a condition to the principal
   */
  public addCondition(key: string, value: Condition) {
    const existingValue = this.additionalConditions[key];
    this.additionalConditions[key] = existingValue ? { ...existingValue, ...value } : value;
  }

  /**
   * Adds multiple conditions to the principal
   *
   * Values from the conditions parameter will overwrite existing values with the same operator
   * and key.
   */
  public addConditions(conditions: Conditions) {
    Object.entries(conditions).forEach(([key, value]) => {
      this.addCondition(key, value);
    });
  }

  /**
   * The conditions under which the policy is in effect.
   * See [the IAM documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition.html).
   */
  public get conditions() {
    return this.mergeConditions(this.principal.policyFragment.conditions, this.additionalConditions);
  }

  public get policyFragment(): PrincipalPolicyFragment {
    return new PrincipalPolicyFragment(this.principal.policyFragment.principalJson, this.conditions);
  }

  public get principalAccount(): string | undefined {
    return this.principal.principalAccount;
  }

  public addToPolicy(statement: PolicyStatement): boolean {
    return this.addToPrincipalPolicy(statement).statementAdded;
  }

  public addToPrincipalPolicy(statement: PolicyStatement): AddToPrincipalPolicyResult {
    return this.principal.addToPrincipalPolicy(statement);
  }

  public toString() {
    return this.principal.toString();
  }

  /**
   * JSON-ify the principal
   *
   * Used when JSON.stringify() is called
   */
  public toJSON() {
    // Have to implement toJSON() because the default will lead to infinite recursion.
    return this.policyFragment.principalJson;
  }

  private mergeConditions(principalConditions: Conditions, additionalConditions: Conditions): Conditions {
    const mergedConditions: Conditions = {};
    Object.entries(principalConditions).forEach(([operator, condition]) => {
      mergedConditions[operator] = condition;
    });

    Object.entries(additionalConditions).forEach(([operator, condition]) => {
      // merge the conditions if one of the additional conditions uses an
      // operator that's already used by the principal's conditions merge the
      // inner structure.
      const existing = mergedConditions[operator];
      if (!existing) {
        mergedConditions[operator] = condition;
        return; // continue
      }

      // if either the existing condition or the new one contain unresolved
      // tokens, fail the merge. this is as far as we go at this point.
      if (cdk.Token.isUnresolved(condition) || cdk.Token.isUnresolved(existing)) {
        throw new Error(`multiple "${operator}" conditions cannot be merged if one of them contains an unresolved token`);
      }

      mergedConditions[operator] = { ...existing, ...condition };
    });
    return mergedConditions;
  }
}

/**
 * A collection of the fields in a PolicyStatement that can be used to identify a principal.
 *
 * This consists of the JSON used in the "Principal" field, and optionally a
 * set of "Condition"s that need to be applied to the policy.
 */
export class PrincipalPolicyFragment {
  /**
   *
   * @param principalJson JSON of the "Principal" section in a policy statement
   * @param conditions conditions that need to be applied to this policy
   */
  constructor(
    public readonly principalJson: { [key: string]: string[] },
    /**
     * The conditions under which the policy is in effect.
     * See [the IAM documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition.html).
     */
    public readonly conditions: Conditions = {}) {
  }
}

/**
 * Specify a principal by the Amazon Resource Name (ARN).
 * You can specify AWS accounts, IAM users, Federated SAML users, IAM roles, and specific assumed-role sessions.
 * You cannot specify IAM groups or instance profiles as principals
 *
 * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html
 */
export class ArnPrincipal extends PrincipalBase {
  /**
   *
   * @param arn Amazon Resource Name (ARN) of the principal entity (i.e. arn:aws:iam::123456789012:user/user-name)
   */
  constructor(public readonly arn: string) {
    super();
  }

  public get policyFragment(): PrincipalPolicyFragment {
    return new PrincipalPolicyFragment({ AWS: [this.arn] });
  }

  public toString() {
    return `ArnPrincipal(${this.arn})`;
  }
}

/**
 * Specify AWS account ID as the principal entity in a policy to delegate authority to the account.
 */
export class AccountPrincipal extends ArnPrincipal {
  public readonly principalAccount: string | undefined;

  /**
   *
   * @param accountId AWS account ID (i.e. 123456789012)
   */
  constructor(public readonly accountId: any) {
    super(new StackDependentToken(stack => `arn:${stack.partition}:iam::${accountId}:root`).toString());
    this.principalAccount = accountId;
  }

  public toString() {
    return `AccountPrincipal(${this.accountId})`;
  }
}

/**
 * Options for a service principal.
 */
export interface ServicePrincipalOpts {
  /**
   * The region in which the service is operating.
   *
   * @default the current Stack's region.
   */
  readonly region?: string;

  /**
   * Additional conditions to add to the Service Principal
   *
   * @default - No conditions
   */
  readonly conditions?: { [key: string]: any };
}

/**
 * An IAM principal that represents an AWS service (i.e. sqs.amazonaws.com).
 */
export class ServicePrincipal extends PrincipalBase {
  /**
   *
   * @param service AWS service (i.e. sqs.amazonaws.com)
   */
  constructor(public readonly service: string, private readonly opts: ServicePrincipalOpts = {}) {
    super();
  }

  public get policyFragment(): PrincipalPolicyFragment {
    return new PrincipalPolicyFragment({
      Service: [
        new ServicePrincipalToken(this.service, this.opts).toString(),
      ],
    }, this.opts.conditions);
  }

  public toString() {
    return `ServicePrincipal(${this.service})`;
  }
}

/**
 * A principal that represents an AWS Organization
 */
export class OrganizationPrincipal extends PrincipalBase {
  /**
   *
   * @param organizationId The unique identifier (ID) of an organization (i.e. o-12345abcde)
   */
  constructor(public readonly organizationId: string) {
    super();
  }

  public get policyFragment(): PrincipalPolicyFragment {
    return new PrincipalPolicyFragment(
      { AWS: ['*'] },
      { StringEquals: { 'aws:PrincipalOrgID': this.organizationId } },
    );
  }

  public toString() {
    return `OrganizationPrincipal(${this.organizationId})`;
  }
}

/**
 * A policy principal for canonicalUserIds - useful for S3 bucket policies that use
 * Origin Access identities.
 *
 * See https://docs.aws.amazon.com/general/latest/gr/acct-identifiers.html
 *
 * and
 *
 * https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html
 *
 * for more details.
 *
 */
export class CanonicalUserPrincipal extends PrincipalBase {
  /**
   *
   * @param canonicalUserId unique identifier assigned by AWS for every account.
   *   root user and IAM users for an account all see the same ID.
   *   (i.e. 79a59df900b949e55d96a1e698fbacedfd6e09d98eacf8f8d5218e7cd47ef2be)
   */
  constructor(public readonly canonicalUserId: string) {
    super();
  }

  public get policyFragment(): PrincipalPolicyFragment {
    return new PrincipalPolicyFragment({ CanonicalUser: [this.canonicalUserId] });
  }

  public toString() {
    return `CanonicalUserPrincipal(${this.canonicalUserId})`;
  }
}

/**
 * Principal entity that represents a federated identity provider such as Amazon Cognito,
 * that can be used to provide temporary security credentials to users who have been authenticated.
 * Additional condition keys are available when the temporary security credentials are used to make a request.
 * You can use these keys to write policies that limit the access of federated users.
 *
 * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_iam-condition-keys.html#condition-keys-wif
 */
export class FederatedPrincipal extends PrincipalBase {
  public readonly assumeRoleAction: string;

  /**
   *
   * @param federated federated identity provider (i.e. 'cognito-identity.amazonaws.com' for users authenticated through Cognito)
   * @param conditions The conditions under which the policy is in effect.
   *   See [the IAM documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition.html).
   */
  constructor(
    public readonly federated: string,
    public readonly conditions: Conditions,
    assumeRoleAction: string = 'sts:AssumeRole') {
    super();

    this.assumeRoleAction = assumeRoleAction;
  }

  public get policyFragment(): PrincipalPolicyFragment {
    return new PrincipalPolicyFragment({ Federated: [this.federated] }, this.conditions);
  }

  public toString() {
    return `FederatedPrincipal(${this.federated})`;
  }
}

/**
 * A principal that represents a federated identity provider as Web Identity such as Cognito, Amazon,
 * Facebook, Google, etc.
 */
export class WebIdentityPrincipal extends FederatedPrincipal {

  /**
   *
   * @param identityProvider identity provider (i.e. 'cognito-identity.amazonaws.com' for users authenticated through Cognito)
   * @param conditions The conditions under which the policy is in effect.
   *   See [the IAM documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition.html).
   */
  constructor(identityProvider: string, conditions: Conditions = {}) {
    super(identityProvider, conditions ?? {}, 'sts:AssumeRoleWithWebIdentity');
  }

  public get policyFragment(): PrincipalPolicyFragment {
    return new PrincipalPolicyFragment({ Federated: [this.federated] }, this.conditions);
  }

  public toString() {
    return `WebIdentityPrincipal(${this.federated})`;
  }
}

/**
 * A principal that represents a federated identity provider as from a OpenID Connect provider.
 */
export class OpenIdConnectPrincipal extends WebIdentityPrincipal {

  /**
   *
   * @param openIdConnectProvider OpenID Connect provider
   * @param conditions The conditions under which the policy is in effect.
   *   See [the IAM documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition.html).
   */
  constructor(openIdConnectProvider: IOpenIdConnectProvider, conditions: Conditions = {}) {
    super(openIdConnectProvider.openIdConnectProviderArn, conditions ?? {});
  }

  public get policyFragment(): PrincipalPolicyFragment {
    return new PrincipalPolicyFragment({ Federated: [this.federated] }, this.conditions);
  }

  public toString() {
    return `OpenIdConnectPrincipal(${this.federated})`;
  }
}

/**
 * Principal entity that represents a SAML federated identity provider
 */
export class SamlPrincipal extends FederatedPrincipal {
  constructor(samlProvider: ISamlProvider, conditions: Conditions) {
    super(samlProvider.samlProviderArn, conditions, 'sts:AssumeRoleWithSAML');
  }

  public toString() {
    return `SamlPrincipal(${this.federated})`;
  }
}

/**
 * Principal entity that represents a SAML federated identity provider for
 * programmatic and AWS Management Console access.
 */
export class SamlConsolePrincipal extends SamlPrincipal {
  constructor(samlProvider: ISamlProvider, conditions: Conditions = {}) {
    super(samlProvider, {
      ...conditions,
      StringEquals: {
        'SAML:aud': 'https://signin.aws.amazon.com/saml',
      },
    });
  }

  public toString() {
    return `SamlConsolePrincipal(${this.federated})`;
  }
}

/**
 * Use the AWS account into which a stack is deployed as the principal entity in a policy
 */
export class AccountRootPrincipal extends AccountPrincipal {
  constructor() {
    super(new StackDependentToken(stack => stack.account).toString());
  }

  public toString() {
    return 'AccountRootPrincipal()';
  }
}

/**
 * A principal representing all identities in all accounts
 */
export class AnyPrincipal extends ArnPrincipal {
  constructor() {
    super('*');
  }

  public toString() {
    return 'AnyPrincipal()';
  }
}

/**
 * A principal representing all identities in all accounts
 * @deprecated use `AnyPrincipal`
 */
export class Anyone extends AnyPrincipal { }

/**
 * Represents a principal that has multiple types of principals. A composite principal cannot
 * have conditions. i.e. multiple ServicePrincipals that form a composite principal
 */
export class CompositePrincipal extends PrincipalBase {
  public readonly assumeRoleAction: string;
  private readonly principals = new Array<PrincipalBase>();

  constructor(...principals: PrincipalBase[]) {
    super();
    if (principals.length === 0) {
      throw new Error('CompositePrincipals must be constructed with at least 1 Principal but none were passed.');
    }
    this.assumeRoleAction = principals[0].assumeRoleAction;
    this.addPrincipals(...principals);
  }

  /**
   * Adds IAM principals to the composite principal. Composite principals cannot have
   * conditions.
   *
   * @param principals IAM principals that will be added to the composite principal
   */
  public addPrincipals(...principals: PrincipalBase[]): this {
    for (const p of principals) {
      if (p.assumeRoleAction !== this.assumeRoleAction) {
        throw new Error(
          'Cannot add multiple principals with different "assumeRoleAction". ' +
          `Expecting "${this.assumeRoleAction}", got "${p.assumeRoleAction}"`);
      }

      const fragment = p.policyFragment;
      if (fragment.conditions && Object.keys(fragment.conditions).length > 0) {
        throw new Error(
          'Components of a CompositePrincipal must not have conditions. ' +
          `Tried to add the following fragment: ${JSON.stringify(fragment)}`);
      }

      this.principals.push(p);
    }

    return this;
  }

  public get policyFragment(): PrincipalPolicyFragment {
    const principalJson: { [key: string]: string[] } = {};

    for (const p of this.principals) {
      mergePrincipal(principalJson, p.policyFragment.principalJson);
    }

    return new PrincipalPolicyFragment(principalJson);
  }

  public toString() {
    return `CompositePrincipal(${this.principals})`;
  }
}

/**
 * A lazy token that requires an instance of Stack to evaluate
 */
class StackDependentToken implements cdk.IResolvable {
  public readonly creationStack: string[];
  constructor(private readonly fn: (stack: cdk.Stack) => any) {
    this.creationStack = cdk.captureStackTrace();
  }

  public resolve(context: cdk.IResolveContext) {
    return this.fn(cdk.Stack.of(context.scope));
  }

  public toString() {
    return cdk.Token.asString(this);
  }

  /**
   * JSON-ify the token
   *
   * Used when JSON.stringify() is called
   */
  public toJSON() {
    return '<unresolved-token>';
  }
}

class ServicePrincipalToken implements cdk.IResolvable {
  public readonly creationStack: string[];
  constructor(
    private readonly service: string,
    private readonly opts: ServicePrincipalOpts) {
    this.creationStack = cdk.captureStackTrace();
  }

  public resolve(ctx: cdk.IResolveContext) {
    const region = this.opts.region || cdk.Stack.of(ctx.scope).region;
    const fact = RegionInfo.get(region).servicePrincipal(this.service);
    return fact || Default.servicePrincipal(this.service, region, cdk.Aws.URL_SUFFIX);
  }

  public toString() {
    return cdk.Token.asString(this, {
      displayHint: this.service,
    });
  }

  /**
   * JSON-ify the token
   *
   * Used when JSON.stringify() is called
   */
  public toJSON() {
    return `<${this.service}>`;
  }
}
