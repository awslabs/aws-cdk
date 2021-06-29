import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core/';
import { Construct } from 'constructs';

/**
 * Generate policy resource for a list of build ARNs or report ARNs.
 */
export function generatePolicyResource(scope: Construct, ids: string[], service: string, resource: string): string[] {
  let resources = new Set();
  let resourceArns = [];

  if (sfn.JsonPath.isEncodedJsonPathStringList(ids)) {
    resourceArns.push(generateArn(scope, service, resource, '*'));
    return resourceArns;
  }

  for (let id of ids) {
    let resourceName = cdk.Stack.of(scope).parseArn(id).resourceName;
    if (resourceName) {
      resources.add(resourceName.split(':')[0]);
    }
  }

  for (let res of resources) {
    resourceArns.push(generateArn(scope, service, resource, res as string));
  }

  return resourceArns;
}

/**
 * Generate policy resource for single build ARNs.
 */
export function generateSinglePolicyResource(scope: Construct, id: string, service: string, resource: string): string[] {
  let resources = [];
  if (sfn.JsonPath.isEncodedJsonPath(id)) {
    resources.push(generateArn(scope, service, resource, '*'));
    return resources;
  }

  let resourceArn = '';
  let resourceName = cdk.Stack.of(scope).parseArn(id).resourceName;
  if (resourceName) {
    resourceArn = resourceName.split(':')[0];
    resources.push(generateArn(scope, service, resource, resourceArn));
  }

  return resources;
}

/**
 * Generate Arn from given service name, resource, and resource name.
 */
function generateArn(scope: Construct, service: string, resource: string, resourceName: string): string {
  return cdk.Stack.of(scope).formatArn({
    service: service,
    resource: resource,
    resourceName: resourceName,
  });
}