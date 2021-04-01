# Amazon Cognito Construct Library
<!--BEGIN STABILITY BANNER-->

---

Features                                   | Stability
-------------------------------------------|--------------------------------------------------------
CFN Resources                              | ![Stable](https://img.shields.io/badge/stable-success.svg?style=for-the-badge)
Higher level constructs for User Pools     | ![Stable](https://img.shields.io/badge/stable-success.svg?style=for-the-badge)
Higher level constructs for Identity Pools | ![Not Implemented](https://img.shields.io/badge/not--implemented-black.svg?style=for-the-badge)

> **CFN Resources:** All classes with the `Cfn` prefix in this module ([CFN Resources]) are always
> stable and safe to use.
>
> [CFN Resources]: https://docs.aws.amazon.com/cdk/latest/guide/constructs.html#constructs_lib

<!-- -->

> **Stable:** Higher level constructs in this module that are marked stable will not undergo any
> breaking changes. They will strictly follow the [Semantic Versioning](https://semver.org/) model.

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
    - [Account Recovery Settings](#account-recovery-settings)
  - [Emails](#emails)
  - [Lambda Triggers](#lambda-triggers)
    - [Trigger Permissions](#trigger-permissions)
  - [Import](#importing-user-pools)
  - [Identity Providers](#identity-providers)
  - [App Clients](#app-clients)
  - [Resource Servers](#resource-servers)
  - [Domains](#domains)

## User Pools

User pools allow creating and managing your own directory of users that can sign up and sign in. They enable easy
integration with social identity providers such as Facebook, Google, Amazon, Microsoft Active Directory, etc. through
SAML.

Using the CDK, a new user pool can be created as part of the stack using the construct's constructor. You may specify
the `userPoolName` to give your own identifier to the user pool. If not, CloudFormation will generate a name.

```ts
new cognito.UserPool(this, 'myuserpool', {
  userPoolName: 'myawesomeapp-userpool',
});
```

The default set up for the user pool is configured such that only administrators will be allowed
to create users. Features such as Multi-factor authentication (MFAs) and Lambda Triggers are not
configured by default.

### Sign Up

Users can either be signed up by the app's administrators or can sign themselves up. Once a user has signed up, their
account needs to be confirmed. Cognito provides several ways to sign users up and confirm their accounts. Learn more
about [user sign up here](https://docs.aws.amazon.com/cognito/latest/developerguide/signing-up-users-in-your-app.html).

When a user signs up, email and SMS messages are used to verify their account and contact methods. The following code
snippet configures a user pool with properties relevant to these verification messages -

```ts
new cognito.UserPool(this, 'myuserpool', {
  // ...
  selfSignUpEnabled: true,
  userVerification: {
    emailSubject: 'Verify your email for our awesome app!',
    emailBody: 'Thanks for signing up to our awesome app! Your verification code is {####}',
    emailStyle: cognito.VerificationEmailStyle.CODE,
    smsMessage: 'Thanks for signing up to our awesome app! Your verification code is {####}',
  }
});
```

By default, self sign up is disabled. Learn more about [email and SMS verification messages
here](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-settings-message-customizations.html).

Besides users signing themselves up, an administrator of any user pool can sign users up. The user then receives an
invitation to join the user pool. The following code snippet configures a user pool with properties relevant to the
invitation messages -

```ts
new cognito.UserPool(this, 'myuserpool', {
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

- `username`: Allow signing in using the one time immutable user name that the user chose at the time of sign up.
- `email`: Allow signing in using the email address that is associated with the account.
- `phone`: Allow signing in using the phone number that is associated with the account.
- `preferredUsername`: Allow signing in with an alternate user name that the user can change at any time. However, this
  is not available if the `username` option is not chosen.

The following code sets up a user pool so that the user can sign in with either their username or their email address -

```ts
new cognito.UserPool(this, 'myuserpool', {
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

⚠️ The Cognito service prevents changing the `signInAlias` property for an existing user pool.

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
new cognito.UserPool(this, 'myuserpool', {
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

The following code configures a user pool with two standard attributes (name and address) as required and mutable, and adds
four custom attributes.

```ts
new cognito.UserPool(this, 'myuserpool', {
  // ...
  standardAttributes: {
    fullname: {
      required: true,
      mutable: false,
    },
    address: {
      required: false,
      mutable: true,
    },
  },
  customAttributes: {
    'myappid': new cognito.StringAttribute({ minLen: 5, maxLen: 15, mutable: false }),
    'callingcode': new cognito.NumberAttribute({ min: 1, max: 3, mutable: true }),
    'isEmployee': new cognito.BooleanAttribute({ mutable: true }),
    'joinedOn': new cognito.DateTimeAttribute(),
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
to send SMS messages.

By default, the CDK looks at all of the specified properties (and their defaults when not explicitly specified) and
automatically creates an SMS role, when needed. For example, if MFA second factor by SMS is enabled, the CDK will
create a new role. The `smsRole` property can be used to specify the user supplied role that should be used instead.
Additionally, the property `enableSmsRole` can be used to override the CDK's default behaviour to either enable or
suppress automatic role creation.

```ts
const poolSmsRole = new iam.Role(this, 'userpoolsmsrole', {
  assumedBy: new iam.ServicePrincipal('foo'),
});

new cognito.UserPool(this, 'myuserpool', {
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
new cognito.UserPool(this, 'myuserpool', {
  // ...
  mfa: cognito.Mfa.REQUIRED,
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
new cognito.UserPool(this, 'myuserpool', {
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

#### Account Recovery Settings

User pools can be configured on which method a user should use when recovering the password for their account. This
can either be email and/or SMS. Read more at [Recovering User Accounts](https://docs.aws.amazon.com/cognito/latest/developerguide/how-to-recover-a-user-account.html)

```ts
new cognito.UserPool(this, 'UserPool', {
  // ...
  accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
})
```

The default for account recovery is by phone if available and by email otherwise.
A user will not be allowed to reset their password via phone if they are also using it for MFA.

### Emails

Cognito sends emails to users in the user pool, when particular actions take place, such as welcome emails, invitation
emails, password resets, etc. The address from which these emails are sent can be configured on the user pool.
Read more about [email settings here](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html).

```ts
new cognito.UserPool(this, 'myuserpool', {
  // ...
  emailSettings: {
    from: 'noreply@myawesomeapp.com',
    replyTo: 'support@myawesomeapp.com',
  },
});
```

By default, user pools are configured to use Cognito's built-in email capability, but it can also be configured to use
Amazon SES, however, support for Amazon SES is not available in the CDK yet. If you would like this to be implemented,
give [this issue](https://github.com/aws/aws-cdk/issues/6768) a +1. Until then, you can use the [cfn
layer](https://docs.aws.amazon.com/cdk/latest/guide/cfn_layer.html) to configure this.

If an email address contains non-ASCII characters, it will be encoded using the [punycode
encoding](https://en.wikipedia.org/wiki/Punycode) when generating the template for Cloudformation.

### Lambda Triggers

User pools can be configured such that AWS Lambda functions can be triggered when certain user operations or actions
occur, such as, sign up, user confirmation, sign in, etc. They can also be used to add custom authentication
challenges, user migrations and custom verification messages. Learn more about triggers at [User Pool Workflows with
Triggers](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools-working-with-aws-lambda-triggers.html).

Lambda triggers can either be specified as part of the `UserPool` initialization, or it can be added later, via methods
on the construct, as so -

```ts
const authChallengeFn = new lambda.Function(this, 'authChallengeFn', {
  runtime: lambda.Runtime.NODEJS_12_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset(/* path to lambda asset */),
});

const userpool = new cognito.UserPool(this, 'myuserpool', {
  // ...
  lambdaTriggers: {
    createAuthChallenge: authChallengeFn,
    // ...
  }
});

userpool.addTrigger(cognito.UserPoolOperation.USER_MIGRATION, new lambda.Function(this, 'userMigrationFn', {
    runtime: lambda.Runtime.NODEJS_12_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset(/* path to lambda asset */),
}));
```

The following table lists the set of triggers available, and their corresponding method to add it to the user pool.
For more information on the function of these triggers and how to configure them, read [User Pool Workflows with
Triggers](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools-working-with-aws-lambda-triggers.html).

#### Trigger Permissions

The `function.attachToRolePolicy()` API can be used to add additional IAM permissions to the lambda trigger
as necessary.

⚠️ Using the `attachToRolePolicy` API to provide permissions to your user pool will result in a circular dependency. See [aws/aws-cdk#7016](https://github.com/aws/aws-cdk/issues/7016).
Error message when running `cdk synth` or `cdk deploy`:
> Circular dependency between resources: [pool056F3F7E, fnPostAuthFnCognitoA630A2B1, ...]

To work around the circular dependency issue, use the `attachInlinePolicy()` API instead, as shown below.

```ts fixture=with-lambda-trigger
// provide permissions to describe the user pool scoped to the ARN the user pool
postAuthFn.role?.attachInlinePolicy(new iam.Policy(this, 'userpool-policy', {
  statements: [new iam.PolicyStatement({
    actions: ['cognito-idp:DescribeUserPool'],
    resources: [userpool.userPoolArn],
  })],
}));
```

### Importing User Pools

Any user pool that has been created outside of this stack, can be imported into the CDK app. Importing a user pool
allows for it to be used in other parts of the CDK app that reference an `IUserPool`. However, imported user pools have
limited configurability. As a rule of thumb, none of the properties that are part of the
[`AWS::Cognito::UserPool`](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-cognito-userpool.html)
CloudFormation resource can be configured.

User pools can be imported either using their id via the `UserPool.fromUserPoolId()`, or by using their ARN, via the
`UserPool.fromUserPoolArn()` API.

```ts
const awesomePool = cognito.UserPool.fromUserPoolId(this, 'awesome-user-pool', 'us-east-1_oiuR12Abd');

const otherAwesomePool = cognito.UserPool.fromUserPoolArn(this, 'other-awesome-user-pool',
  'arn:aws:cognito-idp:eu-west-1:123456789012:userpool/us-east-1_mtRyYQ14D');
```

### Identity Providers

Users that are part of a user pool can sign in either directly through a user pool, or federate through a third-party
identity provider. Once configured, the Cognito backend will take care of integrating with the third-party provider.
Read more about [Adding User Pool Sign-in Through a Third
Party](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-federation.html).

The following third-party identity providers are currently supported in the CDK -

- [Login With Amazon](https://developer.amazon.com/apps-and-games/login-with-amazon)
- [Facebook Login](https://developers.facebook.com/docs/facebook-login/)
- [Google Login](https://developers.google.com/identity/sign-in/web/sign-in)
- [Sign In With Apple](https://developer.apple.com/sign-in-with-apple/get-started/)

The following code configures a user pool to federate with the third party provider, 'Login with Amazon'. The identity
provider needs to be configured with a set of credentials that the Cognito backend can use to federate with the
third-party identity provider.

```ts
const userpool = new cognito.UserPool(this, 'Pool');

const provider = new cognito.UserPoolIdentityProviderAmazon(this, 'Amazon', {
  clientId: 'amzn-client-id',
  clientSecret: 'amzn-client-secret',
  userPool: userpool,
});
```

Attribute mapping allows mapping attributes provided by the third-party identity providers to [standard and custom
attributes](#Attributes) of the user pool. Learn more about [Specifying Identity Provider Attribute Mappings for Your
User Pool](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-specifying-attribute-mapping.html).

The following code shows how different attributes provided by 'Login With Amazon' can be mapped to standard and custom
user pool attributes.

```ts
const userpool = new cognito.UserPool(this, 'Pool');

new cognito.UserPoolIdentityProviderAmazon(this, 'Amazon', {
  clientId: 'amzn-client-id',
  clientSecret: 'amzn-client-secret',
  userPool: userpool,
  attributeMapping: {
    email: cognito.ProviderAttribute.AMAZON_EMAIL,
    website: cognito.ProviderAttribute.other('url'), // use other() when an attribute is not pre-defined in the CDK
    custom: {
      // custom user pool attributes go here
      uniqueId: cognito.ProviderAttribute.AMAZON_USER_ID,
    }
  }
});
```

### App Clients

An app is an entity within a user pool that has permission to call unauthenticated APIs (APIs that do not have an
authenticated user), such as APIs to register, sign in, and handle forgotten passwords. To call these APIs, you need an
app client ID and an optional client secret. Read [Configuring a User Pool App
Client](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-client-apps.html) to learn more.

The following code creates an app client and retrieves the client id -

```ts
const pool = new cognito.UserPool(this, 'pool');
const client = pool.addClient('customer-app-client');
const clientId = client.userPoolClientId;
```

Existing app clients can be imported into the CDK app using the `UserPoolClient.fromUserPoolClientId()` API. For new
and imported user pools, clients can also be created via the `UserPoolClient` constructor, as so -

```ts
const importedPool = cognito.UserPool.fromUserPoolId(this, 'imported-pool', 'us-east-1_oiuR12Abd');
new cognito.UserPoolClient(this, 'customer-app-client', {
  userPool: importedPool
});
```

Clients can be configured with authentication flows. Authentication flows allow users on a client to be authenticated
with a user pool. Cognito user pools provide several several different types of authentication, such as, SRP (Secure
Remote Password) authentication, username-and-password authentication, etc. Learn more about this at [UserPool Authentication
Flow](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-authentication-flow.html).

The following code configures a client to use both SRP and username-and-password authentication -

```ts
const pool = new cognito.UserPool(this, 'pool');
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
const pool = new cognito.UserPool(this, 'Pool');
pool.addClient('app-client', {
  oAuth: {
    flows: {
      authorizationCodeGrant: true,
    },
    scopes: [ cognito.OAuthScope.OPENID ],
    callbackUrls: [ 'https://my-app-domain.com/welcome' ],
    logoutUrls: [ 'https://my-app-domain.com/signin' ],
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
const pool = new cognito.UserPool(this, 'Pool');
pool.addClient('app-client', {
  preventUserExistenceErrors: true,
});
```

All identity providers created in the CDK app are automatically registered into the corresponding user pool. All app
clients created in the CDK have all of the identity providers enabled by default. The 'Cognito' identity provider,
that allows users to register and sign in directly with the Cognito user pool, is also enabled by default.
Alternatively, the list of supported identity providers for a client can be explicitly specified -

```ts
const pool = new cognito.UserPool(this, 'Pool');
pool.addClient('app-client', {
  // ...
  supportedIdentityProviders: [
    cognito.UserPoolClientIdentityProvider.AMAZON,
    cognito.UserPoolClientIdentityProvider.COGNITO,
  ]
});
```

In accordance with the OIDC open standard, Cognito user pool clients provide access tokens, ID tokens and refresh tokens.
More information is available at [Using Tokens with User Pools](https://docs.aws.amazon.com/en_us/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html).
The expiration time for these tokens can be configured as shown below.

```ts
const pool = new cognito.UserPool(this, 'Pool');
pool.addClient('app-client', {
  // ...
  accessTokenValidity: Duration.minutes(60),
  idTokenValidity: Duration.minutes(60),
  refreshTokenValidity: Duration.days(30),
});
```

Clients can (and should) be allowed to read and write relevant user attributes only. Usually every client can be allowed to read the `given_name`
attribute but not every client should be allowed to set the `email_verified` attribute.
The same criteria applies for both standard and custom attributes, more info is available at
[Attribute Permissions and Scopes](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html#user-pool-settings-attribute-permissions-and-scopes).
The default behaviour is to allow read and write permissions on all attributes. The following code shows how this can be configured for a client.

```ts
const pool = new cognito.UserPool(this, 'Pool');

const clientWriteAttributes = (new ClientAttributes())
  .withStandardAttributes({fullname: true, email: true})
  .withCustomAttributes('favouritePizza', 'favouriteBeverage');

const clientReadAttributes = clientWriteAttributes
  .withStandardAttributes({emailVerified: true})
  .withCustomAttributes('pointsEarned');

pool.addClient('app-client', {
  // ...
  readAttributes: clientReadAttributes,
  writeAttributes: clientWriteAttributes,
});
```

### Resource Servers

A resource server is a server for access-protected resources. It handles authenticated requests from an app that has an
access token. See [Defining Resource
Servers](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-define-resource-servers.html)
for more information.

An application may choose to model custom permissions via OAuth. Resource Servers provide this capability via custom scopes
that are attached to an app client. The following example sets up a resource server for the 'users' resource for two different
app clients and configures the clients to use these scopes.

```ts
const pool = new cognito.UserPool(this, 'Pool');

const readOnlyScope = new ResourceServerScope({ scopeName: 'read', scopeDescription: 'Read-only access' });
const fullAccessScope = new ResourceServerScope({ scopeName: '*', scopeDescription: 'Full access' });

const userServer = pool.addResourceServer('ResourceServer', {
  identifier: 'users',
  scopes: [ readOnlyScope, fullAccessScope ],
});

const readOnlyClient = pool.addClient('read-only-client', {
  // ...
  oAuth: {
    // ...
    scopes: [ OAuthScope.resourceServer(userServer, readOnlyScope) ],
  },
});

const fullAccessClient = pool.addClient('full-access-client', {
  // ...
  oAuth: {
    // ...
    scopes: [ OAuthScope.resourceServer(userServer, fullAccessScope) ],
  },
});
```


### Domains

After setting up an [app client](#app-clients), the address for the user pool's sign-up and sign-in webpages can be
configured using domains. There are two ways to set up a domain - either the Amazon Cognito hosted domain can be chosen
with an available domain prefix, or a custom domain name can be chosen. The custom domain must be one that is already
owned, and whose certificate is registered in AWS Certificate Manager.

The following code sets up a user pool domain in Amazon Cognito hosted domain with the prefix 'my-awesome-app', and another domain with the custom domain 'user.myapp.com' -

```ts
const pool = new cognito.UserPool(this, 'Pool');

pool.addDomain('CognitoDomain', {
  cognitoDomain: {
    domainPrefix: 'my-awesome-app',
  },
});

const certificateArn = 'arn:aws:acm:us-east-1:123456789012:certificate/11-3336f1-44483d-adc7-9cd375c5169d';

const domainCert = certificatemanager.Certificate.fromCertificateArn(this, 'domainCert', certificateArn);
pool.addDomain('CustomDomain', {
  customDomain: {
    domainName: 'user.myapp.com',
    certificate: domainCert,
  },
});
```

Read more about [Using the Amazon Cognito
Domain](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-assign-domain-prefix.html) and [Using Your Own
Domain](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-add-custom-domain.html).

The `signInUrl()` methods returns the fully qualified URL to the login page for the user pool. This page comes from the
hosted UI configured with Cognito. Learn more at [Hosted UI with the Amazon Cognito
Console](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-app-integration.html#cognito-user-pools-create-an-app-integration).

```ts
const userpool = new cognito.UserPool(this, 'UserPool', {
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
  redirectUri: 'https://myapp.com/home', // must be a URL configured under 'callbackUrls' with the client
})
```

Existing domains can be imported into CDK apps using `UserPoolDomain.fromDomainName()` API

```ts
const myUserPoolDomain = cognito.UserPoolDomain.fromDomainName(this, 'my-user-pool-domain', 'domain-name');
```
