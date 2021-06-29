import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Stack, Aws } from '@aws-cdk/core';
import { generatePolicyResource, generateSinglePolicyResource } from '../../../lib/codebuild/private/utils';

let stack: Stack;
let buildIds: string[];
let buildId: string;

beforeEach(() => {
  //GIVEN
  stack = new Stack();
  buildIds = ['arn:aws:codebuild:us-east-1:123456789012:build/myProject1:buildId',
    'arn:aws:codebuild:us-east-1:123456789012:build/myProject2:buildId'];
  buildId = 'arn:aws:codebuild:us-east-1:123456789012:build/myProject:buildId';
});

test('Generate policy resource for list of build Ids, expect list of project ARNs', () => {
  let out = generatePolicyResource(stack, buildIds, 'codebuild', 'project');

  expect(out).toEqual([`arn:${Aws.PARTITION}:codebuild:${Aws.REGION}:${Aws.ACCOUNT_ID}:project/myProject1`,
    `arn:${Aws.PARTITION}:codebuild:${Aws.REGION}:${Aws.ACCOUNT_ID}:project/myProject2`]);
});

test('Generate policy resource for build Ids pass in as encoded json path string list, expect a list with one dynamic project ARN', () => {
  let out = generatePolicyResource(stack, sfn.JsonPath.listAt('$.Build..Arn'), 'codebuild', 'project');

  expect(out).toEqual([`arn:${Aws.PARTITION}:codebuild:${Aws.REGION}:${Aws.ACCOUNT_ID}:project/*`]);
});

test('Generate policy resource for single build Id, expect a list with one project ARNs', () => {
  let out = generateSinglePolicyResource(stack, buildId, 'codebuild', 'project');

  expect(out).toEqual([`arn:${Aws.PARTITION}:codebuild:${Aws.REGION}:${Aws.ACCOUNT_ID}:project/myProject`]);
});

test('Generate policy resource for build Id pass in as encoded json path string, expect a list with one dynamic project ARN', () => {
  let out = generateSinglePolicyResource(stack, sfn.JsonPath.stringAt('$.Build..Arn'), 'codebuild', 'project');

  expect(out).toEqual([`arn:${Aws.PARTITION}:codebuild:${Aws.REGION}:${Aws.ACCOUNT_ID}:project/*`]);
});