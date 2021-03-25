import * as iam from '@aws-cdk/aws-iam';
import { IConstruct, Stack } from '@aws-cdk/core';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/**
 * Obtain the Role for the Topic Rule
 *
 * If a role already exists, it will be returned. This ensures that if multiple
 * events have the same target, they will share a role.
 */
export function singletonTopicRuleRole(scope: IConstruct, policyStatements: iam.PolicyStatement[]): iam.IRole {
  const stack = Stack.of(scope);
  const id = 'AllowIot';
  const existing = stack.node.tryFindChild(id) as iam.IRole;
  if (existing) { return existing; }

  const role = new iam.Role(scope as Construct, id, {
    assumedBy: new iam.ServicePrincipal('iot.amazonaws.com'),
  });

  policyStatements.forEach(role.addToPolicy.bind(role));

  return role;
}
