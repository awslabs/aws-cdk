import '@aws-cdk/assert/jest';
import { ABSENT, ResourcePart } from '@aws-cdk/assert/lib/assertions/have-resource';
import { Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import { CfnParameter, Duration, Stack, Tags } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { AccountRecovery, Mfa, NumberAttribute, StringAttribute, UserPool, UserPoolIdentityProvider, UserPoolOperation, VerificationEmailStyle } from '../lib';

describe('User Pool', () => {
  test('default setup', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new UserPool(stack, 'Pool');

    // THEN
    expect(stack).toHaveResource('AWS::Cognito::UserPool', {
      AdminCreateUserConfig: {
        AllowAdminCreateUserOnly: true,
        InviteMessageTemplate: ABSENT,
      },
      EmailVerificationMessage: 'The verification code to your new account is {####}',
      EmailVerificationSubject: 'Verify your new account',
      SmsVerificationMessage: 'The verification code to your new account is {####}',
      VerificationMessageTemplate: {
        DefaultEmailOption: 'CONFIRM_WITH_CODE',
        EmailMessage: 'The verification code to your new account is {####}',
        EmailSubject: 'Verify your new account',
        SmsMessage: 'The verification code to your new account is {####}',
      },
      SmsConfiguration: ABSENT,
      lambdaTriggers: ABSENT,
    });

    expect(stack).toHaveResource('AWS::Cognito::UserPool', {
      DeletionPolicy: 'Retain',
    }, ResourcePart.CompleteDefinition);
  });

  test('self sign up option is correctly configured', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new UserPool(stack, 'Pool', {
      selfSignUpEnabled: true,
    });

    // THEN
    expect(stack).toHaveResource('AWS::Cognito::UserPool', {
      AdminCreateUserConfig: {
        AllowAdminCreateUserOnly: false,
      },
    });
  });

  test('email verification via link is configured correctly', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new UserPool(stack, 'Pool', {
      userVerification: {
        emailStyle: VerificationEmailStyle.LINK,
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      EmailVerificationMessage: ABSENT,
      EmailVerificationSubject: ABSENT,
      SmsVerificationMessage: 'The verification code to your new account is {####}',
      VerificationMessageTemplate: {
        DefaultEmailOption: 'CONFIRM_WITH_LINK',
        EmailMessageByLink: 'Verify your account by clicking on {##Verify Email##}',
        EmailSubjectByLink: 'Verify your new account',
        SmsMessage: 'The verification code to your new account is {####}',
      },
    });
  }),

  test('email and sms verification messages are validated', () => {
    const stack = new Stack();

    expect(() => new UserPool(stack, 'Pool1', {
      userVerification: {
        emailStyle: VerificationEmailStyle.CODE,
        emailBody: 'invalid email body',
      },
    })).toThrow(/Verification email body/);

    expect(() => new UserPool(stack, 'Pool2', {
      userVerification: {
        emailStyle: VerificationEmailStyle.CODE,
        emailBody: 'valid email body {####}',
      },
    })).not.toThrow();

    expect(() => new UserPool(stack, 'Pool3', {
      userVerification: {
        emailStyle: VerificationEmailStyle.CODE,
        smsMessage: 'invalid sms message',
      },
    })).toThrow(/SMS message/);

    expect(() => new UserPool(stack, 'Pool4', {
      userVerification: {
        emailStyle: VerificationEmailStyle.CODE,
        smsMessage: 'invalid sms message {####}',
      },
    })).not.toThrow();

    expect(() => new UserPool(stack, 'Pool5', {
      userVerification: {
        emailStyle: VerificationEmailStyle.LINK,
        emailBody: 'invalid email body {####}',
      },
    })).toThrow(/Verification email body/);

    expect(() => new UserPool(stack, 'Pool6', {
      userVerification: {
        emailStyle: VerificationEmailStyle.LINK,
        emailBody: 'invalid email body {##Verify Email##}',
      },
    })).not.toThrow();
  });

  test('validation is skipped for email and sms messages when tokens', () => {
    const stack = new Stack();
    const parameter = new CfnParameter(stack, 'Parameter');

    expect(() => new UserPool(stack, 'Pool1', {
      userVerification: {
        emailStyle: VerificationEmailStyle.CODE,
        emailBody: parameter.valueAsString,
      },
    })).not.toThrow();

    expect(() => new UserPool(stack, 'Pool2', {
      userVerification: {
        emailStyle: VerificationEmailStyle.CODE,
        smsMessage: parameter.valueAsString,
      },
    })).not.toThrow();
  });

  test('user invitation messages are configured correctly', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new UserPool(stack, 'Pool', {
      userInvitation: {
        emailBody: 'invitation email body',
        emailSubject: 'invitation email subject',
        smsMessage: 'invitation sms',
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      AdminCreateUserConfig: {
        InviteMessageTemplate: {
          EmailMessage: 'invitation email body',
          EmailSubject: 'invitation email subject',
          SMSMessage: 'invitation sms',
        },
      },
    });
  });

  test('smsRole property is recognized', () => {
    // GIVEN
    const stack = new Stack();
    const role = Role.fromRoleArn(stack, 'smsRole', 'arn:aws:iam::664773442901:role/sms-role');

    // WHEN
    new UserPool(stack, 'Pool', {
      smsRole: role,
      smsRoleExternalId: 'test-external-id',
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      SmsConfiguration: {
        ExternalId: 'test-external-id',
        SnsCallerArn: role.roleArn,
      },
    });
  });

  test('import using id', () => {
    // GIVEN
    const stack = new Stack(undefined, undefined, {
      env: { region: 'some-region-1', account: '0123456789012' },
    });
    const userPoolId = 'test-user-pool';

    // WHEN
    const pool = UserPool.fromUserPoolId(stack, 'userpool', userPoolId);
    expect(pool.userPoolId).toEqual(userPoolId);
    expect(pool.userPoolArn).toMatch(/cognito-idp:some-region-1:0123456789012:userpool\/test-user-pool/);
  });

  test('import using arn', () => {
    // GIVEN
    const stack = new Stack();
    const userPoolArn = 'arn:aws:cognito-idp:us-east-1:0123456789012:userpool/test-user-pool';

    // WHEN
    const pool = UserPool.fromUserPoolArn(stack, 'userpool', userPoolArn);
    expect(pool.userPoolId).toEqual('test-user-pool');
    expect(stack.resolve(pool.userPoolArn)).toEqual('arn:aws:cognito-idp:us-east-1:0123456789012:userpool/test-user-pool');
  });

  test('import using arn without resourceName fails', () => {
    // GIVEN
    const stack = new Stack();
    const userPoolArn = 'arn:aws:cognito-idp:us-east-1:0123456789012:*';

    // WHEN
    expect(() => {
      UserPool.fromUserPoolArn(stack, 'userpool', userPoolArn);
    }).toThrowError(/invalid user pool ARN/);
  });

  test('import from different account region using arn', () => {
    // GIVEN
    const userPoolArn = 'arn:aws:cognito-idp:us-east-1:0123456789012:userpool/test-user-pool';

    const stack = new Stack(undefined, undefined, {
      env: {
        account: '111111111111',
        region: 'us-east-2',
      },
    });

    // WHEN
    const pool = UserPool.fromUserPoolArn(stack, 'userpool', userPoolArn);
    expect(pool.env.account).toEqual('0123456789012');
    expect(pool.env.region).toEqual('us-east-1');
    expect(pool.userPoolArn).toEqual('arn:aws:cognito-idp:us-east-1:0123456789012:userpool/test-user-pool');
  });

  test('support tags', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const pool = new UserPool(stack, 'Pool', {
      userPoolName: 'myPool',
    });
    Tags.of(pool).add('PoolTag', 'PoolParty');

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      UserPoolName: 'myPool',
      UserPoolTags: {
        PoolTag: 'PoolParty',
      },
    });
  });

  test('lambda triggers via properties are correctly configured', () => {
    // GIVEN
    const stack = new Stack();
    const fn = fooFunction(stack, 'preSignUp');

    // WHEN
    new UserPool(stack, 'Pool', {
      lambdaTriggers: {
        preSignUp: fn,
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      LambdaConfig: {
        PreSignUp: stack.resolve(fn.functionArn),
      },
    });
    expect(stack).toHaveResourceLike('AWS::Lambda::Permission', {
      Action: 'lambda:InvokeFunction',
      FunctionName: stack.resolve(fn.functionArn),
      Principal: 'cognito-idp.amazonaws.com',
    });
  });

  test('add* API correctly appends triggers', () => {
    // GIVEN
    const stack = new Stack();

    const createAuthChallenge = fooFunction(stack, 'createAuthChallenge');
    const customMessage = fooFunction(stack, 'customMessage');
    const defineAuthChallenge = fooFunction(stack, 'defineAuthChallenge');
    const postAuthentication = fooFunction(stack, 'postAuthentication');
    const postConfirmation = fooFunction(stack, 'postConfirmation');
    const preAuthentication = fooFunction(stack, 'preAuthentication');
    const preSignUp = fooFunction(stack, 'preSignUp');
    const preTokenGeneration = fooFunction(stack, 'preTokenGeneration');
    const userMigration = fooFunction(stack, 'userMigration');
    const verifyAuthChallengeResponse = fooFunction(stack, 'verifyAuthChallengeResponse');

    // WHEN
    const pool = new UserPool(stack, 'Pool');
    pool.addTrigger(UserPoolOperation.CREATE_AUTH_CHALLENGE, createAuthChallenge);
    pool.addTrigger(UserPoolOperation.CUSTOM_MESSAGE, customMessage);
    pool.addTrigger(UserPoolOperation.DEFINE_AUTH_CHALLENGE, defineAuthChallenge);
    pool.addTrigger(UserPoolOperation.POST_AUTHENTICATION, postAuthentication);
    pool.addTrigger(UserPoolOperation.POST_CONFIRMATION, postConfirmation);
    pool.addTrigger(UserPoolOperation.PRE_AUTHENTICATION, preAuthentication);
    pool.addTrigger(UserPoolOperation.PRE_SIGN_UP, preSignUp);
    pool.addTrigger(UserPoolOperation.PRE_TOKEN_GENERATION, preTokenGeneration);
    pool.addTrigger(UserPoolOperation.USER_MIGRATION, userMigration);
    pool.addTrigger(UserPoolOperation.VERIFY_AUTH_CHALLENGE_RESPONSE, verifyAuthChallengeResponse);

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      LambdaConfig: {
        CreateAuthChallenge: stack.resolve(createAuthChallenge.functionArn),
        CustomMessage: stack.resolve(customMessage.functionArn),
        DefineAuthChallenge: stack.resolve(defineAuthChallenge.functionArn),
        PostAuthentication: stack.resolve(postAuthentication.functionArn),
        PostConfirmation: stack.resolve(postConfirmation.functionArn),
        PreAuthentication: stack.resolve(preAuthentication.functionArn),
        PreSignUp: stack.resolve(preSignUp.functionArn),
        PreTokenGeneration: stack.resolve(preTokenGeneration.functionArn),
        UserMigration: stack.resolve(userMigration.functionArn),
        VerifyAuthChallengeResponse: stack.resolve(verifyAuthChallengeResponse.functionArn),
      },
    });

    [createAuthChallenge, customMessage, defineAuthChallenge, postAuthentication,
      postConfirmation, preAuthentication, preSignUp, preTokenGeneration, userMigration,
      verifyAuthChallengeResponse].forEach((fn) => {
      expect(stack).toHaveResourceLike('AWS::Lambda::Permission', {
        Action: 'lambda:InvokeFunction',
        FunctionName: stack.resolve(fn.functionArn),
        Principal: 'cognito-idp.amazonaws.com',
      });
    });
  });

  test('fails when the same trigger is added twice', () => {
    // GIVEN
    const stack = new Stack();
    const userpool = new UserPool(stack, 'Pool');

    const fn1 = new lambda.Function(stack, 'fn1', {
      code: lambda.Code.fromInline('foo'),
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
    });
    const fn2 = new lambda.Function(stack, 'fn2', {
      code: lambda.Code.fromInline('foo'),
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
    });

    // WHEN
    userpool.addTrigger(UserPoolOperation.CREATE_AUTH_CHALLENGE, fn1);
    expect(() => userpool.addTrigger(UserPoolOperation.CREATE_AUTH_CHALLENGE, fn2)).toThrow(/already exists/);
  });

  test('no username aliases specified', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new UserPool(stack, 'Pool');

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      UsernameAttributes: ABSENT,
      AliasAttributes: ABSENT,
    });
  });

  test('fails when preferredUsername is used without username', () => {
    const stack = new Stack();
    expect(() => new UserPool(stack, 'Pool', {
      signInAliases: { preferredUsername: true },
    })).toThrow(/username/);
  });

  test('username and email are specified as the username aliases', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new UserPool(stack, 'Pool', {
      signInAliases: { username: true, email: true },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      UsernameAttributes: ABSENT,
      AliasAttributes: ['email'],
    });
  });

  test('email and phone number are specified as the username aliases', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new UserPool(stack, 'Pool', {
      signInAliases: { email: true, phone: true },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      UsernameAttributes: ['email', 'phone_number'],
      AliasAttributes: ABSENT,
    });
  });

  test('email and phone number are autoverified, by default, if they are specified as signIn', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new UserPool(stack, 'Pool1', {
      userPoolName: 'Pool1',
      signInAliases: { email: true },
    });
    new UserPool(stack, 'Pool2', {
      userPoolName: 'Pool2',
      signInAliases: { email: true, phone: true },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      UserPoolName: 'Pool1',
      AutoVerifiedAttributes: ['email'],
    });
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      UserPoolName: 'Pool2',
      AutoVerifiedAttributes: ['email', 'phone_number'],
    });
  });

  test('explicit autoverify are correctly picked up', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new UserPool(stack, 'Pool', {
      signInAliases: { username: true },
      autoVerify: { email: true, phone: true },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      AutoVerifiedAttributes: ['email', 'phone_number'],
    });
  });

  test('sign in case sensitive is correctly picked up', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new UserPool(stack, 'Pool', {
      signInCaseSensitive: false,
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      UsernameConfiguration: {
        CaseSensitive: false,
      },
    });
  });

  test('sign in case sensitive is absent by default', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new UserPool(stack, 'Pool', {});

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      UsernameConfiguration: ABSENT,
    });
  });

  test('standard attributes default to mutable', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new UserPool(stack, 'Pool', {
      standardAttributes: {
        fullname: {
          required: true,
        },
        timezone: {
          required: true,
        },
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      Schema: [
        {
          Name: 'name',
          Required: true,
          Mutable: true,
        },
        {
          Name: 'zoneinfo',
          Required: true,
          Mutable: true,
        },
      ],
    });
  });

  test('mutable standard attributes', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new UserPool(stack, 'Pool', {
      userPoolName: 'Pool',
      standardAttributes: {
        fullname: {
          required: true,
          mutable: true,
        },
        timezone: {
          required: true,
          mutable: true,
        },
      },
    });

    new UserPool(stack, 'Pool1', {
      userPoolName: 'Pool1',
      standardAttributes: {
        fullname: {
          mutable: false,
        },
        timezone: {
          mutable: false,
        },
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      UserPoolName: 'Pool',
      Schema: [
        {
          Mutable: true,
          Name: 'name',
          Required: true,
        },
        {
          Mutable: true,
          Name: 'zoneinfo',
          Required: true,
        },
      ],
    });

    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      UserPoolName: 'Pool1',
      Schema: [
        {
          Name: 'name',
          Required: false,
          Mutable: false,
        },
        {
          Name: 'zoneinfo',
          Required: false,
          Mutable: false,
        },
      ],
    });
  });

  test('schema is absent when attributes are not specified', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new UserPool(stack, 'Pool', { userPoolName: 'Pool' });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      UserPoolName: 'Pool',
      Schema: ABSENT,
    });
  });

  test('optional mutable standardAttributes', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new UserPool(stack, 'Pool', {
      userPoolName: 'Pool',
      standardAttributes: {
        timezone: {
          mutable: true,
        },
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      UserPoolName: 'Pool',
      Schema: [
        {
          Mutable: true,
          Required: false,
          Name: 'zoneinfo',
        },
      ],
    });
  });

  test('custom attributes with default constraints', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new UserPool(stack, 'Pool', {
      customAttributes: {
        'custom-string-attr': new StringAttribute(),
        'custom-number-attr': new NumberAttribute(),
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      Schema: [
        {
          Name: 'custom-string-attr',
          AttributeDataType: 'String',
          StringAttributeConstraints: ABSENT,
          NumberAttributeConstraints: ABSENT,
        },
        {
          Name: 'custom-number-attr',
          AttributeDataType: 'Number',
          StringAttributeConstraints: ABSENT,
          NumberAttributeConstraints: ABSENT,
        },
      ],
    });
  });

  test('custom attributes with constraints', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new UserPool(stack, 'Pool', {
      customAttributes: {
        'custom-string-attr': new StringAttribute({ minLen: 5, maxLen: 50 }),
        'custom-number-attr': new NumberAttribute({ min: 500, max: 2000 }),
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      Schema: [
        {
          AttributeDataType: 'String',
          Name: 'custom-string-attr',
          StringAttributeConstraints: {
            MaxLength: '50',
            MinLength: '5',
          },
        },
        {
          AttributeDataType: 'Number',
          Name: 'custom-number-attr',
          NumberAttributeConstraints: {
            MaxValue: '2000',
            MinValue: '500',
          },
        },
      ],
    });
  });

  test('mfaTypes is ignored when mfaEnforcement is undefined or set to OFF', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new UserPool(stack, 'Pool1', {
      userPoolName: 'Pool1',
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
    });
    new UserPool(stack, 'Pool2', {
      userPoolName: 'Pool2',
      mfa: Mfa.OFF,
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      UserPoolName: 'Pool1',
      MfaConfiguration: ABSENT,
      EnabledMfas: ABSENT,
    });
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      UserPoolName: 'Pool2',
      MfaConfiguration: 'OFF',
      EnabledMfas: ABSENT,
    });
  });

  test('sms mfa type is the default when mfaEnforcement is set to REQUIRED or OPTIONAL', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new UserPool(stack, 'Pool1', {
      userPoolName: 'Pool1',
      mfa: Mfa.OPTIONAL,
    });
    new UserPool(stack, 'Pool2', {
      userPoolName: 'Pool2',
      mfa: Mfa.REQUIRED,
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      UserPoolName: 'Pool1',
      MfaConfiguration: 'OPTIONAL',
      EnabledMfas: ['SMS_MFA'],
    });
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      UserPoolName: 'Pool2',
      MfaConfiguration: 'ON',
      EnabledMfas: ['SMS_MFA'],
    });
  });

  test('mfa type is correctly picked up when specified', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new UserPool(stack, 'Pool', {
      mfa: Mfa.REQUIRED,
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      EnabledMfas: ['SMS_MFA', 'SOFTWARE_TOKEN_MFA'],
    });
  });

  test('password policy is correctly set', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new UserPool(stack, 'Pool', {
      passwordPolicy: {
        tempPasswordValidity: Duration.days(2),
        minLength: 15,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
        requireSymbols: true,
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      Policies: {
        PasswordPolicy: {
          TemporaryPasswordValidityDays: 2,
          MinimumLength: 15,
          RequireLowercase: true,
          RequireUppercase: true,
          RequireNumbers: true,
          RequireSymbols: true,
        },
      },
    });
  });

  test('password minimum length is set to the default when other parts of the policy is configured', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new UserPool(stack, 'Pool', {
      passwordPolicy: {
        tempPasswordValidity: Duration.days(2),
        requireDigits: true,
      },
    });

    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      Policies: {
        PasswordPolicy: {
          MinimumLength: 8,
        },
      },
    });
  });

  test('throws when tempPassword validity is not in round days', () => {
    const stack = new Stack();

    expect(() => new UserPool(stack, 'Pool', {
      passwordPolicy: {
        tempPasswordValidity: Duration.hours(30),
      },
    })).toThrow();
  });

  test('temp password throws an error when above the max', () => {
    const stack = new Stack();

    expect(() => new UserPool(stack, 'Pool', {
      passwordPolicy: {
        tempPasswordValidity: Duration.days(400),
      },
    })).toThrow(/tempPasswordValidity cannot be greater than/);
  });

  test('throws when minLength is out of range', () => {
    const stack = new Stack();

    expect(() => new UserPool(stack, 'Pool1', {
      passwordPolicy: {
        minLength: 5,
      },
    })).toThrow(/minLength for password must be between/);

    expect(() => new UserPool(stack, 'Pool2', {
      passwordPolicy: {
        minLength: 100,
      },
    })).toThrow(/minLength for password must be between/);
  });

  test('email transmission settings are recognized correctly', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new UserPool(stack, 'Pool', {
      emailSettings: {
        from: 'from@myawesomeapp.com',
        replyTo: 'replyTo@myawesomeapp.com',
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      EmailConfiguration: {
        From: 'from@myawesomeapp.com',
        ReplyToEmailAddress: 'replyTo@myawesomeapp.com',
      },
    });
  });

  test('addClient', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const userpool = new UserPool(stack, 'Pool');
    userpool.addClient('UserPoolClient', {
      userPoolClientName: 'userpoolclient',
    });
    const imported = UserPool.fromUserPoolId(stack, 'imported', 'imported-userpool-id');
    imported.addClient('UserPoolImportedClient', {
      userPoolClientName: 'userpoolimportedclient',
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
      ClientName: 'userpoolclient',
      UserPoolId: stack.resolve(userpool.userPoolId),
    });
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolClient', {
      ClientName: 'userpoolimportedclient',
      UserPoolId: stack.resolve(imported.userPoolId),
    });
  });

  test('addResourceServer', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const userpool = new UserPool(stack, 'Pool');
    userpool.addResourceServer('ResourceServer', {
      identifier: 'users',
      scopes: [
        {
          scopeName: 'read',
          scopeDescription: 'Read-only access',
        },
      ],
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolResourceServer', {
      Identifier: 'users',
      Name: 'users',
      UserPoolId: stack.resolve(userpool.userPoolId),
      Scopes: [
        {
          ScopeDescription: 'Read-only access',
          ScopeName: 'read',
        },
      ],
    });
  });

  test('addDomain', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const userpool = new UserPool(stack, 'Pool');
    userpool.addDomain('UserPoolDomain', {
      cognitoDomain: {
        domainPrefix: 'userpooldomain',
      },
    });
    const imported = UserPool.fromUserPoolId(stack, 'imported', 'imported-userpool-id');
    imported.addDomain('UserPoolImportedDomain', {
      cognitoDomain: {
        domainPrefix: 'userpoolimporteddomain',
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolDomain', {
      Domain: 'userpooldomain',
      UserPoolId: stack.resolve(userpool.userPoolId),
    });
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPoolDomain', {
      Domain: 'userpoolimporteddomain',
      UserPoolId: stack.resolve(imported.userPoolId),
    });
  });

  test('registered identity providers', () => {
    // GIVEN
    const stack = new Stack();
    const userPool = new UserPool(stack, 'pool');
    const provider1 = UserPoolIdentityProvider.fromProviderName(stack, 'provider1', 'provider1');
    const provider2 = UserPoolIdentityProvider.fromProviderName(stack, 'provider2', 'provider2');

    // WHEN
    userPool.registerIdentityProvider(provider1);
    userPool.registerIdentityProvider(provider2);

    // THEN
    expect(userPool.identityProviders).toEqual([provider1, provider2]);
  });

  describe('AccountRecoverySetting should be configured correctly', () => {
    test('EMAIL_AND_PHONE_WITHOUT_MFA', () => {
      // GIVEN
      const stack = new Stack();

      // WHEN
      new UserPool(stack, 'pool', { accountRecovery: AccountRecovery.EMAIL_AND_PHONE_WITHOUT_MFA });

      // THEN
      expect(stack).toHaveResource('AWS::Cognito::UserPool', {
        AccountRecoverySetting: {
          RecoveryMechanisms: [
            { Name: 'verified_email', Priority: 1 },
            { Name: 'verified_phone_number', Priority: 2 },
          ],
        },
      });
    });

    test('PHONE_WITHOUT_MFA_AND_EMAIL', () => {
      // GIVEN
      const stack = new Stack();

      // WHEN
      new UserPool(stack, 'pool', { accountRecovery: AccountRecovery.PHONE_WITHOUT_MFA_AND_EMAIL });

      // THEN
      expect(stack).toHaveResource('AWS::Cognito::UserPool', {
        AccountRecoverySetting: {
          RecoveryMechanisms: [
            { Name: 'verified_phone_number', Priority: 1 },
            { Name: 'verified_email', Priority: 2 },
          ],
        },
      });
    });

    test('EMAIL_ONLY', () => {
      // GIVEN
      const stack = new Stack();

      // WHEN
      new UserPool(stack, 'pool', { accountRecovery: AccountRecovery.EMAIL_ONLY });

      // THEN
      expect(stack).toHaveResource('AWS::Cognito::UserPool', {
        AccountRecoverySetting: {
          RecoveryMechanisms: [
            { Name: 'verified_email', Priority: 1 },
          ],
        },
      });
    });

    test('PHONE_ONLY_WITHOUT_MFA', () => {
      // GIVEN
      const stack = new Stack();

      // WHEN
      new UserPool(stack, 'pool', { accountRecovery: AccountRecovery.PHONE_ONLY_WITHOUT_MFA });

      // THEN
      expect(stack).toHaveResource('AWS::Cognito::UserPool', {
        AccountRecoverySetting: {
          RecoveryMechanisms: [
            { Name: 'verified_phone_number', Priority: 1 },
          ],
        },
      });
    });

    test('NONE', () => {
      // GIVEN
      const stack = new Stack();

      // WHEN
      new UserPool(stack, 'pool', { accountRecovery: AccountRecovery.NONE });

      // THEN
      expect(stack).toHaveResource('AWS::Cognito::UserPool', {
        AccountRecoverySetting: {
          RecoveryMechanisms: [
            { Name: 'admin_only', Priority: 1 },
          ],
        },
      });
    });

    test('PHONE_AND_EMAIL', () => {
      // GIVEN
      const stack = new Stack();

      // WHEN
      new UserPool(stack, 'pool', { accountRecovery: AccountRecovery.PHONE_AND_EMAIL });

      // THEN
      expect(stack).toHaveResource('AWS::Cognito::UserPool', {
        AccountRecoverySetting: ABSENT,
      });
    });

    test('default', () => {
      // GIVEN
      const stack = new Stack();

      // WHEN
      new UserPool(stack, 'pool');

      // THEN
      expect(stack).toHaveResource('AWS::Cognito::UserPool', {
        AccountRecoverySetting: {
          RecoveryMechanisms: [
            { Name: 'verified_phone_number', Priority: 1 },
            { Name: 'verified_email', Priority: 2 },
          ],
        },
      });
    });
  });

  describe('sms roles', () => {
    test('default', () => {
      // GIVEN
      const stack = new Stack();

      // WHEN
      new UserPool(stack, 'pool');

      // THEN
      expect(stack).toHaveResource('AWS::Cognito::UserPool', {
        SmsConfiguration: ABSENT,
      });
    });

    test('smsRole and smsExternalId is set', () => {
      // GIVEN
      const stack = new Stack();
      const smsRole = new Role(stack, 'smsRole', {
        assumedBy: new ServicePrincipal('service.amazonaws.com'),
      });

      // WHEN
      new UserPool(stack, 'pool', {
        smsRole,
        smsRoleExternalId: 'role-external-id',
      });

      // THEN
      expect(stack).toHaveResource('AWS::Cognito::UserPool', {
        SmsConfiguration: {
          ExternalId: 'role-external-id',
          SnsCallerArn: { 'Fn::GetAtt': ['smsRoleA4587CE8', 'Arn'] },
        },
      });
    });

    test('setting enableSmsRole creates an sms role', () => {
      // GIVEN
      const stack = new Stack();

      // WHEN
      new UserPool(stack, 'pool', {
        enableSmsRole: true,
      });

      // THEN
      expect(stack).toHaveResource('AWS::Cognito::UserPool', {
        SmsConfiguration: {
          ExternalId: 'pool',
          SnsCallerArn: { 'Fn::GetAtt': ['poolsmsRole04048F13', 'Arn'] },
        },
      });
      expect(stack).toHaveResource('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Action: 'sts:AssumeRole',
              Condition: {
                StringEquals: {
                  'sts:ExternalId': 'pool',
                },
              },
              Effect: 'Allow',
              Principal: {
                Service: 'cognito-idp.amazonaws.com',
              },
            },
          ],
          Version: '2012-10-17',
        },
        Policies: [
          {
            PolicyDocument: {
              Statement: [
                {
                  Action: 'sns:Publish',
                  Effect: 'Allow',
                  Resource: '*',
                },
              ],
              Version: '2012-10-17',
            },
            PolicyName: 'sns-publish',
          },
        ],
      });
    });

    test('auto sms role is not created when MFA and phoneVerification is off', () => {
      // GIVEN
      const stack = new Stack();

      // WHEN
      new UserPool(stack, 'pool', {
        mfa: Mfa.OFF,
        signInAliases: {
          phone: false,
        },
      });

      // THEN
      expect(stack).toHaveResource('AWS::Cognito::UserPool', {
        SmsConfiguration: ABSENT,
      });
    });

    test('auto sms role is not created when OTP-based MFA is enabled and phoneVerification is off', () => {
      // GIVEN
      const stack = new Stack();

      // WHEN
      new UserPool(stack, 'pool', {
        mfa: Mfa.REQUIRED,
        mfaSecondFactor: {
          otp: true,
          sms: false,
        },
        signInAliases: {
          phone: false,
        },
      });

      // THEN
      expect(stack).toHaveResource('AWS::Cognito::UserPool', {
        SmsConfiguration: ABSENT,
      });
    });

    test('auto sms role is created when phone verification is turned on', () => {
      // GIVEN
      const stack = new Stack();

      // WHEN
      new UserPool(stack, 'pool', {
        mfa: Mfa.OFF,
        signInAliases: { phone: true },
      });

      // THEN
      expect(stack).toHaveResource('AWS::Cognito::UserPool', {
        SmsConfiguration: {
          ExternalId: 'pool',
          SnsCallerArn: { 'Fn::GetAtt': ['poolsmsRole04048F13', 'Arn'] },
        },
      });
    });

    test('auto sms role is created when phone auto-verification is set', () => {
      // GIVEN
      const stack = new Stack();

      // WHEN
      new UserPool(stack, 'pool', {
        mfa: Mfa.OFF,
        signInAliases: { phone: false },
        autoVerify: { phone: true },
      });

      // THEN
      expect(stack).toHaveResource('AWS::Cognito::UserPool', {
        SmsConfiguration: {
          ExternalId: 'pool',
          SnsCallerArn: { 'Fn::GetAtt': ['poolsmsRole04048F13', 'Arn'] },
        },
      });
    });

    test('auto sms role is created when MFA is turned on', () => {
      // GIVEN
      const stack = new Stack();

      // WHEN
      new UserPool(stack, 'pool', {
        mfa: Mfa.REQUIRED,
        mfaSecondFactor: {
          sms: true,
          otp: false,
        },
        signInAliases: {
          phone: false,
        },
      });

      // THEN
      expect(stack).toHaveResource('AWS::Cognito::UserPool', {
        SmsConfiguration: {
          ExternalId: 'pool',
          SnsCallerArn: { 'Fn::GetAtt': ['poolsmsRole04048F13', 'Arn'] },
        },
      });
    });

    test('auto sms role is not created when enableSmsRole is unset, even when MFA is configured', () => {
      // GIVEN
      const stack = new Stack();

      // WHEN
      new UserPool(stack, 'pool', {
        mfa: Mfa.REQUIRED,
        mfaSecondFactor: {
          sms: true,
          otp: false,
        },
        enableSmsRole: false,
      });

      // THEN
      expect(stack).toHaveResource('AWS::Cognito::UserPool', {
        SmsConfiguration: ABSENT,
      });
    });

    test('throws an error when smsRole is specified but enableSmsRole is unset', () => {
      const stack = new Stack();
      const smsRole = new Role(stack, 'smsRole', {
        assumedBy: new ServicePrincipal('service.amazonaws.com'),
      });

      expect(() => new UserPool(stack, 'pool', {
        smsRole,
        enableSmsRole: false,
      })).toThrow(/enableSmsRole cannot be disabled/);
    });
  });

  test('email transmission with cyrillic characters are encoded', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new UserPool(stack, 'Pool', {
      emailSettings: {
        from: 'от@домен.рф',
        replyTo: 'ответить@домен.рф',
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::Cognito::UserPool', {
      EmailConfiguration: {
        From: 'от@xn--d1acufc.xn--p1ai',
        ReplyToEmailAddress: 'ответить@xn--d1acufc.xn--p1ai',
      },
    });
  });
});


function fooFunction(scope: Construct, name: string): lambda.IFunction {
  return new lambda.Function(scope, name, {
    functionName: name,
    code: lambda.Code.fromInline('foo'),
    runtime: lambda.Runtime.NODEJS_12_X,
    handler: 'index.handler',
  });
}