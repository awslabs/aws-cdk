## Amazon Cognito Construct Library
<!--BEGIN STABILITY BANNER-->
---

![cfn-resources: Stable](https://img.shields.io/badge/cfn--resources-stable-success.svg?style=for-the-badge)

> All classes with the `Cfn` prefix in this module ([CFN Resources](https://docs.aws.amazon.com/cdk/latest/guide/constructs.html#constructs_lib)) are always stable and safe to use.

![cdk-constructs: Experimental](https://img.shields.io/badge/cdk--constructs-experimental-important.svg?style=for-the-badge)

> The APIs of higher level constructs in this module are experimental and under active development. They are subject to non-backward compatible changes or removal in any future version. These are not subject to the [Semantic Versioning](https://semver.org/) model and breaking changes will be announced in the release notes. This means that while you may use them, you may need to update your source code when upgrading to a newer version of this package.

---
<!--END STABILITY BANNER-->

[Amazon Cognito](https://docs.aws.amazon.com/cognito/latest/developerguide/what-is-amazon-cognito.html) provides
authentication, authorization, and user management for your web and mobile apps. Your users can sign in directly with a
user name and password, or through a third party such as Facebook, Amazon, Google or Apple.

The two main components of Amazon Cognito are [user
pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html) and [identity
pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-identity.html). User pools are user directories
that provide sign-up and sign-in options for your app users. Identity pools enable you to grant your users access to
other AWS services.

This module is part of the [AWS Cloud Development Kit](https://github.com/aws/aws-cdk) project.

## Table of Contents

- [User Pools](#user-pools)
  - [Sign Up](#sign-up)
  - [Sign In](#sign-in)
  - [Attributes](#attributes)
  - [Security](#security)
    - [Multi-factor Authentication](#multi-factor-authentication-mfa)
  - [Emails](#emails)
  - [Lambda Triggers](#lambda-triggers)
  - [Import](#importing-user-pools)
  - [App Clients](#app-clients)
  - [Domains](#domains)

## User Pools

User pools allow creating and managing your own directory of users that can sign up and sign in. They enable easy
integration with social identity providers such as Facebook, Google, Amazon, Microsoft Active Directory, etc. through
SAML.

Using the CDK, a new user pool can be created as part of the stack using the construct's constructor. You may specify
the `userPoolName` to give your own identifier to the user pool. If not, CloudFormation will generate a name.

```ts
new UserPool(this, 'myuserpool', {
  userPoolName: 'myawesomeapp-userpool',
});
```

### Sign Up

Users can either be signed up by the app's administrators or can sign themselves up. Once a user has signed up, their
account needs to be confirmed. Cognito provides several ways to sign users up and confirm their accounts. Learn more
about [user sign up here](https://docs.aws.amazon.com/cognito/latest/developerguide/signing-up-users-in-your-app.html).

When a user signs up, email and SMS messages are used to verify their account and contact methods. The following code
snippet configures a user pool with properties relevant to these verification messages -

```ts
new UserPool(this, 'myuserpool', {
  // ...
  selfSignUpEnabled: true,
  userVerification: {
    emailSubject: 'Verify your email for our awesome app!',
    emailBody: 'Hello {username}, Thanks for signing up to our awesome app! Your verification code is {####}',
    emailStyle: VerificationEmailStyle.CODE,
    smsMessage: 'Hello {username}, Thanks for signing up to our awesome app! Your verification code is {####}',
  }
});
```

By default, self sign up is disabled. Learn more about [email and SMS verification messages
here](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-settings-message-customizations.html).

Besides users signing themselves up, an administrator of any user pool can sign users up. The user then receives an
invitation to join the user pool. The following code snippet configures a user pool with properties relevant to the
invitation messages -

```ts
new UserPool(this, 'myuserpool', {
  // ...
  userInvitation: {
    emailSubject: 'Invite to join our awesome app!',
    emailBody: 'Hello {username}, you have been invited to join our awesome app! Your temporary password is {####}',
    smsMessage: 'Your temporary password for our awesome app is {####}'
  }
});
```

All email subjects, bodies and SMS messages for both invitation and verification support Cognito's message templating.
Learn more about [message templates
here](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-settings-message-templates.html).

### Sign In

Users registering or signing in into your application can do so with multiple identifiers. There are 4 options
available:

* `username`: Allow signing in using the one time immutable user name that the user chose at the time of sign up.
* `email`: Allow signing in using the email address that is associated with the account.
* `phone`: Allow signing in using the phone number that is associated with the account.
* `preferredUsername`: Allow signing in with an alternate user name that the user can change at any time. However, this
  is not available if the `username` option is not chosen.

The following code sets up a user pool so that the user can sign in with either their username or their email address -

```ts
new UserPool(this, 'myuserpool', {
  // ...
  // ...
  signInAliases: {
    username: true,
    email: true
  },
});
```

User pools can either be configured so that user name is primary sign in form, but also allows for the other three to be
used additionally; or it can be configured so that email and/or phone numbers are the only ways a user can register and
sign in. Read more about this
[here](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html#user-pool-settings-aliases-settings).

To match with 'Option 1' in the above link, with a verified email, `signInAliases` should be set to
`{ username: true, email: true }`. To match with 'Option 2' in the above link with both a verified
email and phone number, this property should be set to `{ email: true, phone: true }`.

Cognito recommends that email and phone number be automatically verified, if they are one of the sign in methods for
the user pool. Read more about that
[here](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html#user-pool-settings-aliases).
The CDK does this by default, when email and/or phone number are specified as part of `signInAliases`. This can be
overridden by specifying the `autoVerify` property.

The following code snippet sets up only email as a sign in alias, but both email and phone number to be auto-verified.

```ts
new UserPool(this, 'myuserpool', {
  // ...
  // ...
  signInAliases: { username: true, email: true },
  autoVerify: { email: true, phone: true }
});
```

A user pool can optionally ignore case when evaluating sign-ins. When `signInCaseSensitive` is false, Cognito will not
check the capitalization of the alias when signing in. Default is true.

### Attributes

Attributes represent the various properties of each user that's collected and stored in the user pool. Cognito
provides a set of standard attributes that are available for all user pools. Users are allowed to select any of these
standard attributes to be required. Users will not be able to sign up to the user pool without providing the required
attributes. Besides these, additional attributes can be further defined, and are known as custom attributes.

Learn more on [attributes in Cognito's
documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html).

The following code sample configures a user pool with two standard attributes (name and address) as required, and adds
four optional attributes.

```ts
new UserPool(this, 'myuserpool', {
  // ...
  requiredAttributes: {
    fullname: true,
    address: true,
  },
  customAttributes: {
    'myappid': new StringAttribute({ minLen: 5, maxLen: 15, mutable: false }),
    'callingcode': new NumberAttribute({ min: 1, max: 3, mutable: true }),
    'isEmployee': new BooleanAttribute({ mutable: true }),
    'joinedOn': new DateTimeAttribute(),
  },
});
```

As shown in the code snippet, there are data types that are available for custom attributes. The 'String' and 'Number'
data types allow for further constraints on their length and values, respectively.

Custom attributes cannot be marked as required.

All custom attributes share the property `mutable` that specifies whether the value of the attribute can be changed.
The default value is `false`.

### Security

Cognito sends various messages to its users via SMS, for different actions, ranging from account verification to
marketing. In order to send SMS messages, Cognito needs an IAM role that it can assume, with permissions that allow it
to send SMS messages. By default, CDK will create this IAM role but can also be explicily specified to an existing IAM
role using the `smsRole` property.

```ts
import { Role } from '@aws-cdk/aws-iam';

const poolSmsRole = new Role(this, 'userpoolsmsrole', { /* ... */ });

new UserPool(this, 'myuserpool', {
  // ...
  smsRole: poolSmsRole,
  smsRoleExternalId: 'c87467be-4f34-11ea-b77f-2e728ce88125'
});
```

When the `smsRole` property is specified, the `smsRoleExternalId` may also be specified. The value of
`smsRoleExternalId` will be used as the `sts:ExternalId` when the Cognito service assumes the role. In turn, the role's
assume role policy should be configured to accept this value as the ExternalId. Learn more about [ExternalId
here](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-user_externalid.html).

#### Multi-factor Authentication (MFA)

User pools can be configured to enable multi-factor authentication (MFA). It can either be turned off, set to optional
or made required. Setting MFA to optional means that individual users can choose to enable it.
Additionally, the MFA code can be sent either via SMS text message or via a time-based software token.
See the [documentation on MFA](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-mfa.html) to
learn more.

The following code snippet marks MFA for the user pool as required. This means that all users are required to
configure an MFA token and use it for sign in. It also allows for the users to use both SMS based MFA, as well,
[time-based one time password
(TOTP)](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-mfa-totp.html).

```ts
new UserPool(this, 'myuserpool', {
  // ...
  mfa: Mfa.REQUIRED,
  mfaSecondFactor: {
    sms: true,
    otp: true,
  },
});
```

User pools can be configured with policies around a user's password. This includes the password length and the
character sets that they must contain.

Further to this, it can also be configured with the validity of the auto-generated temporary password. A temporary
password is generated by the user pool either when an admin signs up a user or when a password reset is requested.
The validity of this password dictates how long to give the user to use this password before expiring it.

The following code snippet configures these properties -

```ts
new UserPool(this, 'myuserpool', {
  // ...
  passwordPolicy: {
    minLength: 12,
    requireLowercase: true,
    requireUppercase: true,
    requireDigits: true,
    requireSymbols: true,
    tempPasswordValidity: Duration.days(3),
  },
});
```

Note that, `tempPasswordValidity` can be specified only in whole days. Specifying fractional days would throw an error.

#### Advanced Security

User ppols can be configured Advanced security. It can be turned on or used audit mode to gather metrics on detected risks without taking action.
In audit mode, the advanced security features publishes metrics to Amazon CloudWatch.
See the [documentation on Advanced security](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-settings-advanced-security.html) to
learn more.

```ts
const userPool = new UserPool(this, 'myuserpool', {
  // ...
  UserPoolAddOns: {
    AdvancedSecurity: AdvancedSecurityMode.ENFORCED,
  },
});
new UserPoolRiskConfigurationAttachment(stack, 'Pool1Security', {
  userPool,
  accountTakeoverRisk: {
    actions: {
      highAction: {
        eventAction: AccountTakeoverEventAction.BLOCK,
        notify: true,
      },
      lowAction: {
        eventAction: AccountTakeoverEventAction.NO_ACTION,
        notify: false,
      },
      mediumAction: {
        eventAction: AccountTakeoverEventAction.MFA_IF_CONFIGURED,
        notify: true,
      },
    },
  },
});
```

### Emails

Cognito sends emails to users in the user pool, when particular actions take place, such as welcome emails, invitation
emails, password resets, etc. The address from which these emails are sent can be configured on the user pool.
Read more about [email settings here](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html).

```ts
new UserPool(this, 'myuserpool', {
  // ...
  emailTransmission: {
    from: 'noreply@myawesomeapp.com',
    replyTo: 'support@myawesomeapp.com',
  },
});
```

By default, user pools are configured to use Cognito's built-in email capability, but it can also be configured to use
Amazon SES, however, support for Amazon SES is not available in the CDK yet. If you would like this to be implemented,
give [this issue](https://github.com/aws/aws-cdk/issues/6768) a +1. Until then, you can use the [cfn
layer](https://docs.aws.amazon.com/cdk/latest/guide/cfn_layer.html) to configure this.

### Lambda Triggers

User pools can be configured such that AWS Lambda functions can be triggered when certain user operations or actions
occur, such as, sign up, user confirmation, sign in, etc. They can also be used to add custom authentication
challenges, user migrations and custom verification messages. Learn more about triggers at [User Pool Workflows with
Triggers](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools-working-with-aws-lambda-triggers.html).

Lambda triggers can either be specified as part of the `UserPool` initialization, or it can be added later, via methods
on the construct, as so -

```ts
const authChallengeFn = new lambda.Function(this, 'authChallengeFn', {
  // ...
});

const userpool = new UserPool(this, 'myuserpool', {
  // ...
  triggers: {
    createAuthChallenge: authChallengeFn,
    // ...
  }
});

userpool.addTrigger(UserPoolOperation.USER_MIGRATION, new lambda.Function(this, 'userMigrationFn', {
  // ...
}));
```

The following table lists the set of triggers available, and their corresponding method to add it to the user pool.
For more information on the function of these triggers and how to configure them, read [User Pool Workflows with
Triggers](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools-working-with-aws-lambda-triggers.html).

### Importing User Pools

Any user pool that has been created outside of this stack, can be imported into the CDK app. Importing a user pool
allows for it to be used in other parts of the CDK app that reference an `IUserPool`. However, imported user pools have
limited configurability. As a rule of thumb, none of the properties that is are part of the
[`AWS::Cognito::UserPool`](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-cognito-userpool.html)
CloudFormation resource can be configured.

User pools can be imported either using their id via the `UserPool.fromUserPoolId()`, or by using their ARN, via the
`UserPool.fromUserPoolArn()` API.

```ts
const stack = new Stack(app, 'my-stack');

const awesomePool = UserPool.fromUserPoolId(stack, 'awesome-user-pool', 'us-east-1_oiuR12Abd');

const otherAwesomePool = UserPool.fromUserPoolArn(stack, 'other-awesome-user-pool',
  'arn:aws:cognito-idp:eu-west-1:123456789012:userpool/us-east-1_mtRyYQ14D');
```

### App Clients

An app is an entity within a user pool that has permission to call unauthenticated APIs (APIs that do not have an
authenticated user), such as APIs to register, sign in, and handle forgotten passwords. To call these APIs, you need an
app client ID and an optional client secret. Read [Configuring a User Pool App
Client](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-client-apps.html) to learn more.

The following code creates an app client and retrieves the client id -

```ts
const pool = new UserPool(this, 'pool');
const client = pool.addClient('customer-app-client');
const clientId = client.userPoolClientId;
```

Existing app clients can be imported into the CDK app using the `UserPoolClient.fromUserPoolClientId()` API. For new
and imported user pools, clients can also be created via the `UserPoolClient` constructor, as so -

```ts
const importedPool = UserPool.fromUserPoolId(this, 'imported-pool', 'us-east-1_oiuR12Abd');
new UserPoolClient(this, 'customer-app-client', {
  userPool: importedPool
});
```

Clients can be configured with authentication flows. Authentication flows allow users on a client to be authenticated
with a user pool. Cognito user pools provide several several different types of authentication, such as, SRP (Secure
Remote Password) authentication, username-and-password authentication, etc. Learn more about this at [UserPool Authentication
Flow](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-authentication-flow.html).

The following code configures a client to use both SRP and username-and-password authentication -

```ts
const pool = new UserPool(this, 'pool');
pool.addClient('app-client', {
  authFlows: {
    userPassword: true,
    userSrp: true,
  }
});
```

Custom authentication protocols can be configured by setting the `custom` property under `authFlow` and defining lambda
functions for the corresponding user pool [triggers](#lambda-triggers). Learn more at [Custom Authentication
Flow](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-authentication-flow.html#amazon-cognito-user-pools-custom-authentication-flow).

In addition to these authentication mechanisms, Cognito user pools also support using OAuth 2.0 framework for
authenticating users. User pool clients can be configured with OAuth 2.0 authorization flows and scopes. Learn more
about the [OAuth 2.0 authorization framework](https://tools.ietf.org/html/rfc6749) and [Cognito user pool's
implementation of
OAuth2.0](https://aws.amazon.com/blogs/mobile/understanding-amazon-cognito-user-pool-oauth-2-0-grants/).

The following code configures an app client with the authorization code grant flow and registers the the app's welcome
page as a callback (or redirect) URL. It also configures the access token scope to 'openid'. All of these concepts can
be found in the [OAuth 2.0 RFC](https://tools.ietf.org/html/rfc6749).

```ts
const pool = new UserPool(this, 'Pool');
pool.addClient('app-client', {
  oAuth: {
    flows: {
      authorizationCodeGrant: true,
    },
    scopes: [ OAuthScope.OPENID ],
    callbackUrls: [ 'https://my-app-domain.com/welcome' ],
  }
});
```

An app client can be configured to prevent user existence errors. This
instructs the Cognito authentication API to return generic authentication
failure responses instead of an UserNotFoundException. By default, the flag
is not set, which means different things for existing and new stacks. See the
[documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-managing-errors.html)
for the full details on the behavior of this flag.

```ts
const pool = new UserPool(this, 'Pool');
pool.addClient('app-client', {
  preventUserExistenceErrors: true,
});
```

### Domains

After setting up an [app client](#app-clients), the address for the user pool's sign-up and sign-in webpages can be
configured using domains. There are two ways to set up a domain - either the Amazon Cognito hosted domain can be chosen
with an available domain prefix, or a custom domain name can be chosen. The custom domain must be one that is already
owned, and whose certificate is registered in AWS Certificate Manager.

The following code sets up a user pool domain in Amazon Cognito hosted domain with the prefix 'my-awesome-app', and another domain with the custom domain 'user.myapp.com' -

```ts
const pool = new UserPool(this, 'Pool');

pool.addDomain('CognitoDomain', {
  cognitoDomain: {
    domainPrefix: 'my-awesome-app',
  },
});

const domainCert = new acm.Certificate.fromCertificateArn(this, 'domainCert', certificateArn);
pool.addDomain('CustomDomain', {
  customDomain: {
    domainName: 'user.myapp.com',
    certificate: domainCert,
  },
});
```

Read more about [Using the Amazon Cognito
Domain](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-assign-domain-prefix.html) and [Using Your Own
Domain](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-add-custom-domain.html)

The `signInUrl()` methods returns the fully qualified URL to the login page for the user pool. This page comes from the
hosted UI configured with Cognito. Learn more at [Hosted UI with the Amazon Cognito
Console](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-app-integration.html#cognito-user-pools-create-an-app-integration).

```ts
const userpool = new UserPool(this, 'UserPool', {
  // ...
});
const client = userpool.addClient('Client', {
  // ...
  oAuth: {
    flows: {
      implicitCodeGrant: true,
    },
    callbackUrls: [
      'https://myapp.com/home',
      'https://myapp.com/users',
    ]
  }
})
const domain = userpool.addDomain('Domain', {
  // ...
});
const signInUrl = domain.signInUrl(client, {
  redirectUrl: 'https://myapp.com/home', // must be a URL configured under 'callbackUrls' with the client
})
```