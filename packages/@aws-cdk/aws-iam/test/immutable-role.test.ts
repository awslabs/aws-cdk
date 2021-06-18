import '@aws-cdk/assert-internal/jest';
import { Stack } from '@aws-cdk/core';
import * as iam from '../lib';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/* eslint-disable quote-props */

describe('ImmutableRole', () => {
  let stack: Stack;
  let mutableRole: iam.Role;
  let immutableRole: iam.IRole;

  beforeEach(() => {
    stack = new Stack();
    mutableRole = new iam.Role(stack, 'MutableRole', {
      assumedBy: new iam.AnyPrincipal(),
    });
    immutableRole = mutableRole.withoutPolicyUpdates();
  });

  test('ignores calls to attachInlinePolicy', () => {
    const user = new iam.User(stack, 'User');
    const policy = new iam.Policy(stack, 'Policy', {
      statements: [new iam.PolicyStatement({
        resources: ['*'],
        actions: ['s3:*'],
      })],
      users: [user],
    });

    immutableRole.attachInlinePolicy(policy);

    expect(stack).toHaveResource('AWS::IAM::Policy', {
      'PolicyDocument': {
        'Statement': [
          {
            'Action': 's3:*',
            'Resource': '*',
            'Effect': 'Allow',
          },
        ],
        'Version': '2012-10-17',
      },
      'PolicyName': 'Policy23B91518',
      'Users': [
        {
          'Ref': 'User00B015A1',
        },
      ],
    });
  });

  test('ignores calls to addManagedPolicy', () => {
    mutableRole.addManagedPolicy({ managedPolicyArn: 'Arn1' });

    immutableRole.addManagedPolicy({ managedPolicyArn: 'Arn2' });

    expect(stack).toHaveResourceLike('AWS::IAM::Role', {
      'ManagedPolicyArns': [
        'Arn1',
      ],
    });
  });

  test('ignores calls to addToPolicy', () => {
    immutableRole.addToPolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: ['iam:*'],
    }));

    mutableRole.addToPolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: ['s3:*'],
    }));

    expect(stack).toHaveResource('AWS::IAM::Policy', {
      'PolicyDocument': {
        'Version': '2012-10-17',
        'Statement': [
          {
            'Resource': '*',
            'Action': 's3:*',
            'Effect': 'Allow',
          },
        ],
      },
    });
  });

  test('ignores grants', () => {
    iam.Grant.addToPrincipal({
      grantee: immutableRole,
      actions: ['s3:*'],
      resourceArns: ['*'],
    });

    expect(stack).not.toHaveResourceLike('AWS::IAM::Policy', {
      'PolicyDocument': {
        'Statement': [
          {
            'Resource': '*',
            'Action': 's3:*',
            'Effect': 'Allow',
          },
        ],
      },
    });
  });

  // this pattern is used here:
  // aws-codepipeline-actions/lib/cloudformation/pipeline-actions.ts#L517
  test('immutable role is a construct', () => {
    new Construct(immutableRole as unknown as Construct, 'Child');
    new Construct(mutableRole.withoutPolicyUpdates() as unknown as Construct, 'Child2');
  });
});