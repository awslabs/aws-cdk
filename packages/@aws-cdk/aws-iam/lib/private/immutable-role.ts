import { Resource } from '@aws-cdk/core';
import { Construct, Dependable, DependencyGroup } from 'constructs';
import { Grant } from '../grant';
import { IManagedPolicy } from '../managed-policy';
import { Policy } from '../policy';
import { PolicyStatement } from '../policy-statement';
import { AddToPrincipalPolicyResult, IPrincipal } from '../principals';
import { IRole } from '../role';

/**
 * An immutable wrapper around an IRole
 *
 * This wrapper ignores all mutating operations, like attaching policies or
 * adding policy statements.
 *
 * Useful in cases where you want to turn off CDK's automatic permissions
 * management, and instead have full control over all permissions.
 *
 * Note: if you want to ignore all mutations for an externally defined role
 * which was imported into the CDK with {@link Role.fromRoleArn}, you don't have to use this class -
 * simply pass the property mutable = false when calling {@link Role.fromRoleArn}.
 */
export class ImmutableRole extends Resource implements IRole {
  public readonly assumeRoleAction = this.role.assumeRoleAction;
  public readonly policyFragment = this.role.policyFragment;
  public readonly grantPrincipal = this;
  public readonly principalAccount = this.role.principalAccount;
  public readonly roleArn = this.role.roleArn;
  public readonly roleName = this.role.roleName;
  public readonly stack = this.role.stack;

  constructor(scope: Construct, id: string, private readonly role: IRole, private readonly addGrantsToResources: boolean) {
    super(scope, id, {
      account: role.env.account,
      region: role.env.region,
    });

    // implement IDependable privately
    Dependable.implement(this, {
      dependencyRoots: [role],
    });
  }

  public attachInlinePolicy(_policy: Policy): void {
    // do nothing
  }

  public addManagedPolicy(_policy: IManagedPolicy): void {
    // do nothing
  }

  public addToPolicy(statement: PolicyStatement): boolean {
    return this.addToPrincipalPolicy(statement).statementAdded;
  }

  public addToPrincipalPolicy(_statement: PolicyStatement): AddToPrincipalPolicyResult {
    // If we return `false`, the grants will try to add the statement to the resource
    // (if possible).
    const pretendSuccess = !this.addGrantsToResources;
    return { statementAdded: pretendSuccess, policyDependable: new DependencyGroup() };
  }

  public grant(grantee: IPrincipal, ...actions: string[]): Grant {
    return this.role.grant(grantee, ...actions);
  }

  public grantPassRole(grantee: IPrincipal): Grant {
    return this.role.grantPassRole(grantee);
  }
}
