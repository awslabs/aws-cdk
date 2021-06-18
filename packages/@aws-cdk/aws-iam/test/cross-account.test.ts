import '@aws-cdk/assert-internal/jest';
import * as cdk from '@aws-cdk/core';
import * as constructs from 'constructs';
import * as iam from '../lib';

// Test cross-account grant scenario's for principals
//
// When doing a grant on a resource with a resource policy:
//
// - Permissions are added to the identity if possible.
// - Trust is added to the resource if necessary (identity is in
//   a different account than the resource).

let app: cdk.App;
const stack1Account = '1234';
let stack1: cdk.Stack;
const stack2Account = '5678';
let stack2: cdk.Stack;
const thirdAccount = '123456789012';

beforeEach(() => {
  app = new cdk.App();
  stack1 = new cdk.Stack(app, 'Stack1', { env: { account: stack1Account, region: 'us-bla-5' } });
  stack2 = new cdk.Stack(app, 'Stack2', { env: { account: stack2Account, region: 'us-bla-5' } });
});

test('cross-account Role grant creates permissions AND trust', () => {
  // GIVEN
  const role = new iam.Role(stack1, 'Role', {
    roleName: cdk.PhysicalName.GENERATE_IF_NEEDED,
    assumedBy: new iam.ServicePrincipal('some.service'),
  });
  const resource = new FakeResource(stack2, 'Resource');

  // WHEN
  doGrant(resource, role);

  // THEN
  assertPolicyCreated(stack1);
  assertTrustCreated(stack2, {
    AWS: {
      'Fn::Join': ['', [
        'arn:',
        { Ref: 'AWS::Partition' },
        `:iam::${stack1Account}:role/stack1stack1rolef3c14260253562f428b7`,
      ]],
    },
  });
});

test('Service Principal grant creates trust', () => {
  const resource = new FakeResource(stack2, 'Resource');

  // WHEN
  doGrant(resource, new iam.ServicePrincipal('service.amazonaws.com'));

  // THEN
  assertTrustCreated(stack2, { Service: 'service.amazonaws.com' });
});

test('Imported Role with definitely different account grant creates trust', () => {
  const resource = new FakeResource(stack2, 'Resource');
  const role = iam.Role.fromRoleArn(stack2, 'Role', `arn:aws:iam::${thirdAccount}:role/S3Access`, { mutable: true });

  // WHEN
  doGrant(resource, role);

  // THEN
  noPolicyCreated(stack2);
  assertTrustCreated(stack2, {
    AWS: `arn:aws:iam::${thirdAccount}:role/S3Access`,
  });
});

test('Imported Role with partition token in ARN (definitely different account) grant creates trust', () => {
  const resource = new FakeResource(stack2, 'Resource');
  const role = iam.Role.fromRoleArn(stack2, 'Role', `arn:${stack2.partition}:iam::${thirdAccount}:role/S3Access`, { mutable: true });

  // WHEN
  doGrant(resource, role);

  // THEN
  noPolicyCreated(stack2);
  assertTrustCreated(stack2, {
    AWS: {
      'Fn::Join': ['', [
        'arn:',
        { Ref: 'AWS::Partition' },
        `:iam::${thirdAccount}:role/S3Access`,
      ]],
    },
  });
});

test('Imported Role with definitely same account grant does not create trust', () => {
  const resource = new FakeResource(stack2, 'Resource');
  const role = iam.Role.fromRoleArn(stack2, 'Role', `arn:aws:iam::${stack2Account}:role/S3Access`, { mutable: true });

  // WHEN
  doGrant(resource, role);

  // THEN
  assertPolicyCreated(stack2);
  noTrustCreated(stack2);
});

test('Imported Role with partition token and definitely same account grant does not create trust', () => {
  const resource = new FakeResource(stack2, 'Resource');
  const role = iam.Role.fromRoleArn(stack2, 'Role', `arn:${stack2.partition}:iam::5678:role/S3Access`, { mutable: true });

  // WHEN
  doGrant(resource, role);

  // THEN
  assertPolicyCreated(stack2);
  noTrustCreated(stack2);
});

test('Agnostic stack with concrete imported role adds trust', () => {
  // GIVEN
  const stack = new cdk.Stack(app, 'AgStack');
  const resource = new FakeResource(stack, 'Resource');
  const role = iam.Role.fromRoleArn(stack2, 'Role', 'arn:aws:iam::5678:role/S3Access', { mutable: true });

  // WHEN
  doGrant(resource, role);

  // THEN
  assertTrustCreated(stack, { AWS: 'arn:aws:iam::5678:role/S3Access' });
  noPolicyCreated(stack);
});

test('Agnostic stack with agnostic imported role does not add trust', () => {
  // GIVEN
  const stack = new cdk.Stack(app, 'AgStack');
  const resource = new FakeResource(stack, 'Resource');
  const role = iam.Role.fromRoleArn(stack2, 'Role', `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/S3Access`, { mutable: true });

  // WHEN
  doGrant(resource, role);

  // THEN
  assertPolicyCreated(stack2);
  noTrustCreated(stack);
});

test('Immutable role in same account adds no policy and no trust', () => {
  // GIVEN
  const resource = new FakeResource(stack2, 'Resource');
  const role = iam.Role.fromRoleArn(stack2, 'Role', `arn:aws:iam::${stack2Account}:role/S3Access`, { mutable: false });

  // require('util').inspect.defaultOptions.customInspect = false; // ?

  // WHEN
  doGrant(resource, role);

  // THEN
  noTrustCreated(stack2);
  noPolicyCreated(stack2);
});

class FakeResource extends cdk.Resource implements iam.IResourceWithPolicy {
  public readonly arn = 'arn:aws:resource';
  private readonly policy = new iam.PolicyDocument();

  constructor(scope: constructs.Construct, id: string) {
    super(scope, id);

    new cdk.CfnResource(this, 'Default', {
      type: 'Test::Fake::Resource',
      properties: {
        ResourcePolicy: cdk.Lazy.any({ produce: () => this.policy }),
      },
    });
  }

  public addToResourcePolicy(statement: iam.PolicyStatement): iam.AddToResourcePolicyResult {
    this.policy.addStatements(statement);
    return { statementAdded: true, policyDependable: this.policy };
  }
}

function doGrant(resource: FakeResource, principal: iam.IPrincipal) {
  iam.Grant.addToPrincipalOrResource({
    actions: ['some:action'],
    grantee: principal,
    resourceArns: [resource.arn],
    resource,
  });
}

function assertTrustCreated(stack: cdk.Stack, principal: any) {
  expect(stack).toHaveResource('Test::Fake::Resource', {
    ResourcePolicy: {
      Statement: [
        {
          Action: 'some:action',
          Effect: 'Allow',
          Resource: 'arn:aws:resource',
          Principal: principal,
        },
      ],
      Version: '2012-10-17',
    },
  });
}

function noTrustCreated(stack: cdk.Stack) {
  expect(stack).not.toHaveResourceLike('Test::Fake::Resource', {
    ResourcePolicy: {
      Statement: [
        {},
      ],
    },
  });
}

function assertPolicyCreated(stack: cdk.Stack) {
  expect(stack).toHaveResource('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: [
        {
          Action: 'some:action',
          Effect: 'Allow',
          Resource: 'arn:aws:resource',
        },
      ],
      Version: '2012-10-17',
    },
  });
}

function noPolicyCreated(stack: cdk.Stack) {
  expect(stack).not.toHaveResource('AWS::IAM::Policy');
}
