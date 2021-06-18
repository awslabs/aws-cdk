import { join } from 'path';
import '@aws-cdk/assert-internal/jest';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import * as appsync from '../lib';

let stack: cdk.Stack;
let role: iam.Role;
let api: appsync.GraphqlApi;
beforeEach(() => {
  // GIVEN
  stack = new cdk.Stack();
  role = new iam.Role(stack, 'Role', {
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  });
  api = new appsync.GraphqlApi(stack, 'API', {
    name: 'demo',
    schema: appsync.Schema.fromAsset(join(__dirname, 'appsync.test.graphql')),
    authorizationConfig: {
      defaultAuthorization: {
        authorizationType: appsync.AuthorizationType.IAM,
      },
    },
  });
});

describe('grant Permissions', () => {
  test('IamResource throws error when custom is called with no arguments', () => {
    //THEN
    expect(() => {
      api.grant(role, appsync.IamResource.custom(), 'appsync:GraphQL');
    }).toThrowError('At least 1 custom ARN must be provided.');
  });

  test('grant provides custom permissions when called with `custom` argument', () => {
    // WHEN
    api.grant(role, appsync.IamResource.custom('types/Mutation/fields/addTest'), 'appsync:GraphQL');

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'appsync:GraphQL',
            Resource: {
              'Fn::Join': ['', [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':appsync:',
                { Ref: 'AWS::Region' },
                ':',
                { Ref: 'AWS::AccountId' },
                ':apis/',
                { 'Fn::GetAtt': ['API62EA1CFF', 'ApiId'] },
                '/types/Mutation/fields/addTest',
              ]],
            },
          },
        ],
      },
    });
  });

  test('grant provides [type parameter]/* permissions when called with `type` argument', () => {
    // WHEN
    api.grant(role, appsync.IamResource.ofType('Mutation'), 'appsync:GraphQL');

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'appsync:GraphQL',
            Resource: {
              'Fn::Join': ['', [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':appsync:',
                { Ref: 'AWS::Region' },
                ':',
                { Ref: 'AWS::AccountId' },
                ':apis/',
                { 'Fn::GetAtt': ['API62EA1CFF', 'ApiId'] },
                '/types/Mutation/*',
              ]],
            },
          },
        ],
      },
    });
  });

  test('grant provides fields/[field param] permissions when called with `type` and `field` argument', () => {
    // WHEN
    api.grant(role, appsync.IamResource.ofType('Mutation', 'addTest'), 'appsync:GraphQL');

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'appsync:GraphQL',
            Resource: {
              'Fn::Join': ['', [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':appsync:',
                { Ref: 'AWS::Region' },
                ':',
                { Ref: 'AWS::AccountId' },
                ':apis/',
                { 'Fn::GetAtt': ['API62EA1CFF', 'ApiId'] },
                '/types/Mutation/fields/addTest',
              ]],
            },
          },
        ],
      },
    });
  });

  test('grant provides all permissions when called with IamResource.all()', () => {
    // WHEN
    api.grant(role, appsync.IamResource.all(), 'appsync:GraphQL');

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'appsync:GraphQL',
            Resource: {
              'Fn::Join': ['', [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':appsync:',
                { Ref: 'AWS::Region' },
                ':',
                { Ref: 'AWS::AccountId' },
                ':apis/',
                { 'Fn::GetAtt': ['API62EA1CFF', 'ApiId'] },
                '/*',
              ]],
            },
          },
        ],
      },
    });
  });

  test('grant provides multiple permissions using one IamResource custom call', () => {
    // WHEN
    api.grant(role, appsync.IamResource.custom('I', 'am', 'custom'), 'appsync:GraphQL');

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'appsync:GraphQL',
            Resource: [
              {
                'Fn::Join': ['', [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':appsync:',
                  { Ref: 'AWS::Region' },
                  ':',
                  { Ref: 'AWS::AccountId' },
                  ':apis/',
                  { 'Fn::GetAtt': ['API62EA1CFF', 'ApiId'] },
                  '/I',
                ]],
              },
              {
                'Fn::Join': ['', [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':appsync:',
                  { Ref: 'AWS::Region' },
                  ':',
                  { Ref: 'AWS::AccountId' },
                  ':apis/',
                  { 'Fn::GetAtt': ['API62EA1CFF', 'ApiId'] },
                  '/am',
                ]],
              },
              {
                'Fn::Join': ['', [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':appsync:',
                  { Ref: 'AWS::Region' },
                  ':',
                  { Ref: 'AWS::AccountId' },
                  ':apis/',
                  { 'Fn::GetAtt': ['API62EA1CFF', 'ApiId'] },
                  '/custom',
                ]],
              },
            ],
          },
        ],
      },
    });
  });

  test('grant provides multiple permissions using one IamResource ofType call', () => {
    // WHEN
    api.grant(role, appsync.IamResource.ofType('I', 'am', 'custom'), 'appsync:GraphQL');

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'appsync:GraphQL',
            Resource: [
              {
                'Fn::Join': ['', [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':appsync:',
                  { Ref: 'AWS::Region' },
                  ':',
                  { Ref: 'AWS::AccountId' },
                  ':apis/',
                  { 'Fn::GetAtt': ['API62EA1CFF', 'ApiId'] },
                  '/types/I/fields/am',
                ]],
              },
              {
                'Fn::Join': ['', [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':appsync:',
                  { Ref: 'AWS::Region' },
                  ':',
                  { Ref: 'AWS::AccountId' },
                  ':apis/',
                  { 'Fn::GetAtt': ['API62EA1CFF', 'ApiId'] },
                  '/types/I/fields/custom',
                ]],
              },
            ],
          },
        ],
      },
    });
  });
});

describe('grantMutation Permissions', () => {
  test('grantMutation provides Mutation/* permissions when called with no `fields` argument', () => {
    // WHEN
    api.grantMutation(role);

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'appsync:GraphQL',
            Resource: {
              'Fn::Join': ['', [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':appsync:',
                { Ref: 'AWS::Region' },
                ':',
                { Ref: 'AWS::AccountId' },
                ':apis/',
                { 'Fn::GetAtt': ['API62EA1CFF', 'ApiId'] },
                '/types/Mutation/*',
              ]],
            },
          },
        ],
      },
    });
  });

  test('grantMutation provides fields/[field param] permissions when called with `fields` argument', () => {
    // WHEN
    api.grantMutation(role, 'addTest');

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'appsync:GraphQL',
            Resource: {
              'Fn::Join': ['', [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':appsync:',
                { Ref: 'AWS::Region' },
                ':',
                { Ref: 'AWS::AccountId' },
                ':apis/',
                { 'Fn::GetAtt': ['API62EA1CFF', 'ApiId'] },
                '/types/Mutation/fields/addTest',
              ]],
            },
          },
        ],
      },
    });
  });

  test('grantMutation provides multiple permissions when called with `fields` argument', () => {
    // WHEN
    api.grantMutation(role, 'addTest', 'removeTest');

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'appsync:GraphQL',
            Resource: [
              {
                'Fn::Join': ['', [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':appsync:',
                  { Ref: 'AWS::Region' },
                  ':',
                  { Ref: 'AWS::AccountId' },
                  ':apis/',
                  { 'Fn::GetAtt': ['API62EA1CFF', 'ApiId'] },
                  '/types/Mutation/fields/addTest',
                ]],
              },
              {
                'Fn::Join': ['', [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':appsync:',
                  { Ref: 'AWS::Region' },
                  ':',
                  { Ref: 'AWS::AccountId' },
                  ':apis/',
                  { 'Fn::GetAtt': ['API62EA1CFF', 'ApiId'] },
                  '/types/Mutation/fields/removeTest',
                ]],
              },
            ],
          },
        ],
      },
    });
  });
});

describe('grantQuery Permissions', () => {
  test('grantQuery provides Query/* permissions when called without the `fields` argument', () => {
    // WHEN
    api.grantQuery(role);

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'appsync:GraphQL',
            Resource: {
              'Fn::Join': ['', [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':appsync:',
                { Ref: 'AWS::Region' },
                ':',
                { Ref: 'AWS::AccountId' },
                ':apis/',
                { 'Fn::GetAtt': ['API62EA1CFF', 'ApiId'] },
                '/types/Query/*',
              ]],
            },
          },
        ],
      },
    });
  });

  test('grantQuery provides fields/[field param] permissions when called with `fields` arugment', () => {
    // WHEN
    api.grantQuery(role, 'getTest');

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'appsync:GraphQL',
            Resource: {
              'Fn::Join': ['', [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':appsync:',
                { Ref: 'AWS::Region' },
                ':',
                { Ref: 'AWS::AccountId' },
                ':apis/',
                { 'Fn::GetAtt': ['API62EA1CFF', 'ApiId'] },
                '/types/Query/fields/getTest',
              ]],
            },
          },
        ],
      },
    });
  });

  test('grantQuery provides multiple permissions when called with `fields` argument', () => {
    // WHEN
    api.grantQuery(role, 'getTests', 'getTest');

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'appsync:GraphQL',
            Resource: [
              {
                'Fn::Join': ['', [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':appsync:',
                  { Ref: 'AWS::Region' },
                  ':',
                  { Ref: 'AWS::AccountId' },
                  ':apis/',
                  { 'Fn::GetAtt': ['API62EA1CFF', 'ApiId'] },
                  '/types/Query/fields/getTests',
                ]],
              },
              {
                'Fn::Join': ['', [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':appsync:',
                  { Ref: 'AWS::Region' },
                  ':',
                  { Ref: 'AWS::AccountId' },
                  ':apis/',
                  { 'Fn::GetAtt': ['API62EA1CFF', 'ApiId'] },
                  '/types/Query/fields/getTest',
                ]],
              },
            ],
          },
        ],
      },
    });
  });
});

describe('grantSubscription Permissions', () => {
  test('grantSubscription provides Subscription/* permissions when called without `fields` argument', () => {
    // WHEN
    api.grantSubscription(role);

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'appsync:GraphQL',
            Resource: {
              'Fn::Join': ['', [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':appsync:',
                { Ref: 'AWS::Region' },
                ':',
                { Ref: 'AWS::AccountId' },
                ':apis/',
                { 'Fn::GetAtt': ['API62EA1CFF', 'ApiId'] },
                '/types/Subscription/*',
              ]],
            },
          },
        ],
      },
    });
  });

  test('grantSubscription provides fields/[field param] when called with `field` argument', () => {
    api.grantSubscription(role, 'subscribe');

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'appsync:GraphQL',
            Resource: {
              'Fn::Join': ['', [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':appsync:',
                { Ref: 'AWS::Region' },
                ':',
                { Ref: 'AWS::AccountId' },
                ':apis/',
                { 'Fn::GetAtt': ['API62EA1CFF', 'ApiId'] },
                '/types/Subscription/fields/subscribe',
              ]],
            },
          },
        ],
      },
    });
  });

  test('grantSubscription provides multiple permissions when called with `fields` argument', () => {
    // WHEN
    api.grantSubscription(role, 'subscribe', 'custom');

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'appsync:GraphQL',
            Resource: [
              {
                'Fn::Join': ['', [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':appsync:',
                  { Ref: 'AWS::Region' },
                  ':',
                  { Ref: 'AWS::AccountId' },
                  ':apis/',
                  { 'Fn::GetAtt': ['API62EA1CFF', 'ApiId'] },
                  '/types/Subscription/fields/subscribe',
                ]],
              },
              {
                'Fn::Join': ['', [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':appsync:',
                  { Ref: 'AWS::Region' },
                  ':',
                  { Ref: 'AWS::AccountId' },
                  ':apis/',
                  { 'Fn::GetAtt': ['API62EA1CFF', 'ApiId'] },
                  '/types/Subscription/fields/custom',
                ]],
              },
            ],
          },
        ],
      },
    });
  });
});