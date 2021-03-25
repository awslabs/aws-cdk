import { IRole, PolicyStatement, ServicePrincipal, Role } from '@aws-cdk/aws-iam';
import { Fn, IConstruct, Stack, Arn } from '@aws-cdk/core';
export { undefinedIfAllValuesAreEmpty } from '@aws-cdk/core/lib/util';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

export function parseRuleName(topicRuleArn: string): string {
  return Fn.select(1, Fn.split('rule/', topicRuleArn));
}
/**
 * Obtain the Role for the Topic Rule
 *
 * If a role already exists, it will be returned. This ensures that if multiple
 * events have the same target, they will share a role.
 */
export function singletonTopicRuleRole(scope: IConstruct, policyStatements: PolicyStatement[]): IRole {
  const stack = Stack.of(scope);
  const id = 'AllowIot';
  const existing = stack.node.tryFindChild(id) as IRole;
  if (existing) { return existing; }

  const role = new Role(scope as Construct, id, {
    assumedBy: new ServicePrincipal('iot.amazonaws.com'),
  });

  policyStatements.forEach(role.addToPolicy.bind(role));

  return role;
}

export function topicArn(scope: IConstruct, topic: string, region?: string, account?: string): string {
  const stack = Stack.of(scope);
  return Arn.format({
    region: region || stack.region,
    account: account || stack.account,
    service: 'iot',
    resource: 'topic',
    resourceName: topic,
  }, stack);
}
