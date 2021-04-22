import '@aws-cdk/assert-internal/jest';
import { App, SecretValue, Stack, CfnResource } from '@aws-cdk/core';
import { ManagedPolicy, Policy, PolicyStatement, User } from '../lib';

describe('IAM user', () => {
  test('default user', () => {
    const app = new App();
    const stack = new Stack(app, 'MyStack');
    new User(stack, 'MyUser');
    expect(stack).toMatchTemplate({
      Resources: { MyUserDC45028B: { Type: 'AWS::IAM::User' } },
    });
  });

  test('default user with password', () => {
    const app = new App();
    const stack = new Stack(app, 'MyStack');
    new User(stack, 'MyUser', {
      password: SecretValue.plainText('1234'),
    });

    expect(stack).toMatchTemplate({
      Resources:
      {
        MyUserDC45028B:
        {
          Type: 'AWS::IAM::User',
          Properties: { LoginProfile: { Password: '1234' } },
        },
      },
    });
  });

  test('fails if reset password is required but no password is set', () => {
    const app = new App();
    const stack = new Stack(app, 'MyStack');
    expect(() => new User(stack, 'MyUser', { passwordResetRequired: true })).toThrow();
  });

  test('create with managed policy', () => {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'MyStack');

    // WHEN
    new User(stack, 'MyUser', {
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('asdf')],
    });

    // THEN
    expect(stack).toHaveResource('AWS::IAM::User', {
      ManagedPolicyArns: [
        { 'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':iam::aws:policy/asdf']] },
      ],
    });
  });

  test('can supply permissions boundary managed policy', () => {
    // GIVEN
    const stack = new Stack();

    const permissionsBoundary = ManagedPolicy.fromAwsManagedPolicyName('managed-policy');

    new User(stack, 'MyUser', {
      permissionsBoundary,
    });

    expect(stack).toHaveResource('AWS::IAM::User', {
      PermissionsBoundary: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':iam::aws:policy/managed-policy',
          ],
        ],
      },
    });
  });

  test('user imported by user name has an ARN', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const user = User.fromUserName(stack, 'import', 'MyUserName');

    // THEN
    expect(stack.resolve(user.userArn)).toStrictEqual({
      'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':iam::', { Ref: 'AWS::AccountId' }, ':user/MyUserName']],
    });
  });

  test('user imported by user ARN has a name', () => {
    // GIVEN
    const stack = new Stack();
    const userName = 'MyUserName';

    // WHEN
    const user = User.fromUserArn(stack, 'import', `arn:aws:iam::account-id:user/${userName}`);

    // THEN
    expect(stack.resolve(user.userName)).toStrictEqual(userName);
  });

  test('user imported by user attributes has a name', () => {
    // GIVEN
    const stack = new Stack();
    const userName = 'MyUserName';

    // WHEN
    const user = User.fromUserAttributes(stack, 'import', {
      userArn: `arn:aws:iam::account-id:user/${userName}`,
    });

    // THEN
    expect(stack.resolve(user.userName)).toStrictEqual(userName);
  });

  test('add to policy of imported user', () => {
    // GIVEN
    const stack = new Stack();
    const user = User.fromUserName(stack, 'ImportedUser', 'john');

    // WHEN
    user.addToPrincipalPolicy(new PolicyStatement({
      actions: ['aws:Use'],
      resources: ['*'],
    }));

    // THEN
    expect(stack).toHaveResource('AWS::IAM::Policy', {
      Users: ['john'],
      PolicyDocument: {
        Statement: [
          {
            Action: 'aws:Use',
            Effect: 'Allow',
            Resource: '*',
          },
        ],
        Version: '2012-10-17',
      },
    });
  });

  test('attach policy to imported user', () => {
    // GIVEN
    const stack = new Stack();
    const user = User.fromUserName(stack, 'ImportedUser', 'john');

    // WHEN
    user.attachInlinePolicy(new Policy(stack, 'Policy', {
      statements: [
        new PolicyStatement({
          actions: ['aws:Use'],
          resources: ['*'],
        }),
      ],
    }));

    // THEN
    expect(stack).toHaveResource('AWS::IAM::Policy', {
      Users: ['john'],
      PolicyDocument: {
        Statement: [
          {
            Action: 'aws:Use',
            Effect: 'Allow',
            Resource: '*',
          },
        ],
        Version: '2012-10-17',
      },
    });
  });
});

test('cross-env user ARNs include path', () => {
  const app = new App();
  const userStack = new Stack(app, 'user-stack', { env: { account: '123456789012', region: 'us-east-1' } });
  const referencerStack = new Stack(app, 'referencer-stack', { env: { region: 'us-east-2' } });
  const user = new User(userStack, 'User', {
    path: '/sample/path/',
    userName: 'sample-name',
  });
  new CfnResource(referencerStack, 'Referencer', {
    type: 'Custom::UserReferencer',
    properties: { UserArn: user.userArn },
  });

  expect(referencerStack).toHaveResource('Custom::UserReferencer', {
    UserArn: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':iam::123456789012:user/sample/path/sample-name',
        ],
      ],
    },
  });
});
