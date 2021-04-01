import { IResource, Resource, Duration } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnUserPoolClient } from './cognito.generated';
import { IUserPool } from './user-pool';
import { ClientAttributes } from './user-pool-attr';
import { IUserPoolResourceServer, ResourceServerScope } from './user-pool-resource-server';

/**
 * Types of authentication flow
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-authentication-flow.html
 */
export interface AuthFlow {
  /**
   * Enable admin based user password authentication flow
   * @default false
   */
  readonly adminUserPassword?: boolean;

  /**
   * Enable custom authentication flow
   * @default false
   */
  readonly custom?: boolean;

  /**
   * Enable auth using username & password
   * @default false
   */
  readonly userPassword?: boolean;

  /**
   * Enable SRP based authentication
   * @default false
   */
  readonly userSrp?: boolean;
}

/**
 * OAuth settings to configure the interaction between the app and this client.
 */
export interface OAuthSettings {

  /**
   * OAuth flows that are allowed with this client.
   * @see - the 'Allowed OAuth Flows' section at https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-app-idp-settings.html
   * @default {authorizationCodeGrant:true,implicitCodeGrant:true}
   */
  readonly flows?: OAuthFlows;

  /**
   * List of allowed redirect URLs for the identity providers.
   * @default - ['https://example.com'] if either authorizationCodeGrant or implicitCodeGrant flows are enabled, no callback URLs otherwise.
   */
  readonly callbackUrls?: string[];

  /**
   * List of allowed logout URLs for the identity providers.
   * @default - no logout URLs
   */
  readonly logoutUrls?: string[];

  /**
   * OAuth scopes that are allowed with this client.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-app-idp-settings.html
   * @default [OAuthScope.PHONE,OAuthScope.EMAIL,OAuthScope.OPENID,OAuthScope.PROFILE,OAuthScope.COGNITO_ADMIN]
   */
  readonly scopes?: OAuthScope[];
}

/**
 * Types of OAuth grant flows
 * @see - the 'Allowed OAuth Flows' section at https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-app-idp-settings.html
 */
export interface OAuthFlows {
  /**
   * Initiate an authorization code grant flow, which provides an authorization code as the response.
   * @default false
   */
  readonly authorizationCodeGrant?: boolean;

  /**
   * The client should get the access token and ID token directly.
   * @default false
   */
  readonly implicitCodeGrant?: boolean;

  /**
   * Client should get the access token and ID token from the token endpoint
   * using a combination of client and client_secret.
   * @default false
   */
  readonly clientCredentials?: boolean;
}

/**
 * OAuth scopes that are allowed with this client.
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-app-idp-settings.html
 */
export class OAuthScope {
  /**
   * Grants access to the 'phone_number' and 'phone_number_verified' claims.
   * Automatically includes access to `OAuthScope.OPENID`.
   */
  public static readonly PHONE = new OAuthScope('phone');

  /**
   * Grants access to the 'email' and 'email_verified' claims.
   * Automatically includes access to `OAuthScope.OPENID`.
   */
  public static readonly EMAIL = new OAuthScope('email');

  /**
   * Returns all user attributes in the ID token that are readable by the client
   */
  public static readonly OPENID = new OAuthScope('openid');

  /**
   * Grants access to all user attributes that are readable by the client
   * Automatically includes access to `OAuthScope.OPENID`.
   */
  public static readonly PROFILE = new OAuthScope('profile');

  /**
   * Grants access to Amazon Cognito User Pool API operations that require access tokens,
   * such as UpdateUserAttributes and VerifyUserAttribute.
   */
  public static readonly COGNITO_ADMIN = new OAuthScope('aws.cognito.signin.user.admin');

  /**
   * Custom scope is one that you define for your own resource server in the Resource Servers.
   * The format is 'resource-server-identifier/scope'.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-define-resource-servers.html
   */
  public static custom(name: string) {
    return new OAuthScope(name);
  }

  /**
   * Adds a custom scope that's tied to a resource server in your stack
   */
  public static resourceServer(server: IUserPoolResourceServer, scope: ResourceServerScope) {
    return new OAuthScope(`${server.userPoolResourceServerId}/${scope.scopeName}`);
  }

  /**
   * The name of this scope as recognized by CloudFormation.
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-cognito-userpoolclient.html#cfn-cognito-userpoolclient-allowedoauthscopes
   */
  public readonly scopeName: string;

  private constructor(scopeName: string) {
    this.scopeName = scopeName;
  }
}

/**
 * Identity providers supported by the UserPoolClient
 */
export class UserPoolClientIdentityProvider {
  /**
   * Allow users to sign in using 'Sign In With Apple'.
   * A `UserPoolIdentityProviderApple` must be attached to the user pool.
   */
  public static readonly APPLE = new UserPoolClientIdentityProvider('SignInWithApple');

  /**
   * Allow users to sign in using 'Facebook Login'.
   * A `UserPoolIdentityProviderFacebook` must be attached to the user pool.
   */
  public static readonly FACEBOOK = new UserPoolClientIdentityProvider('Facebook');

  /**
   * Allow users to sign in using 'Google Login'.
   * A `UserPoolIdentityProviderGoogle` must be attached to the user pool.
   */
  public static readonly GOOGLE = new UserPoolClientIdentityProvider('Google');

  /**
   * Allow users to sign in using 'Login With Amazon'.
   * A `UserPoolIdentityProviderAmazon` must be attached to the user pool.
   */
  public static readonly AMAZON = new UserPoolClientIdentityProvider('LoginWithAmazon');

  /**
   * Allow users to sign in directly as a user of the User Pool
   */
  public static readonly COGNITO = new UserPoolClientIdentityProvider('COGNITO');

  /**
   * Specify a provider not yet supported by the CDK.
   * @param name name of the identity provider as recognized by CloudFormation property `SupportedIdentityProviders`
   */
  public static custom(name: string) {
    return new UserPoolClientIdentityProvider(name);
  }

  /** The name of the identity provider as recognized by CloudFormation property `SupportedIdentityProviders` */
  public readonly name: string;

  private constructor(name: string) {
    this.name = name;
  }
}

/**
 * Options to create a UserPoolClient
 */
export interface UserPoolClientOptions {
  /**
   * Name of the application client
   * @default - cloudformation generated name
   */
  readonly userPoolClientName?: string;

  /**
   * Whether to generate a client secret
   * @default false
   */
  readonly generateSecret?: boolean;

  /**
   * The set of OAuth authentication flows to enable on the client
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-authentication-flow.html
   * @default - all auth flows disabled
   */
  readonly authFlows?: AuthFlow;

  /**
   * Turns off all OAuth interactions for this client.
   * @default false
   */
  readonly disableOAuth?: boolean;

  /**
   * OAuth settings for this client to interact with the app.
   * An error is thrown when this is specified and `disableOAuth` is set.
   * @default - see defaults in `OAuthSettings`. meaningless if `disableOAuth` is set.
   */
  readonly oAuth?: OAuthSettings;

  /**
   * Whether Cognito returns a UserNotFoundException exception when the
   * user does not exist in the user pool (false), or whether it returns
   * another type of error that doesn't reveal the user's absence.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-managing-errors.html
   * @default true for new stacks
   */
  readonly preventUserExistenceErrors?: boolean;

  /**
   * The list of identity providers that users should be able to use to sign in using this client.
   *
   * @default - supports all identity providers that are registered with the user pool. If the user pool and/or
   * identity providers are imported, either specify this option explicitly or ensure that the identity providers are
   * registered with the user pool using the `UserPool.registerIdentityProvider()` API.
   */
  readonly supportedIdentityProviders?: UserPoolClientIdentityProvider[];

  /**
   * Validity of the ID token.
   * Values between 5 minutes and 1 day are valid. The duration can not be longer than the refresh token validity.
   * @see https://docs.aws.amazon.com/en_us/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html#amazon-cognito-user-pools-using-the-id-token
   * @default Duration.minutes(60)
   */
  readonly idTokenValidity?: Duration;

  /**
   * Validity of the refresh token.
   * Values between 60 minutes and 10 years are valid.
   * @see https://docs.aws.amazon.com/en_us/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html#amazon-cognito-user-pools-using-the-refresh-token
   * @default Duration.days(30)
   */
  readonly refreshTokenValidity?: Duration;

  /**
   * Validity of the access token.
   * Values between 5 minutes and 1 day are valid. The duration can not be longer than the refresh token validity.
   * @see https://docs.aws.amazon.com/en_us/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html#amazon-cognito-user-pools-using-the-access-token
   * @default Duration.minutes(60)
   */
  readonly accessTokenValidity?: Duration;

  /**
   * The set of attributes this client will be able to read.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html#user-pool-settings-attribute-permissions-and-scopes
   * @default - all standard and custom attributes
   */
  readonly readAttributes?: ClientAttributes;

  /**
   * The set of attributes this client will be able to write.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html#user-pool-settings-attribute-permissions-and-scopes
   * @default - all standard and custom attributes
   */
  readonly writeAttributes?: ClientAttributes;
}

/**
 * Properties for the UserPoolClient construct
 */
export interface UserPoolClientProps extends UserPoolClientOptions {
  /**
   * The UserPool resource this client will have access to
   */
  readonly userPool: IUserPool;
}

/**
 * Represents a Cognito user pool client.
 */
export interface IUserPoolClient extends IResource {
  /**
   * Name of the application client
   * @attribute
   */
  readonly userPoolClientId: string;
}

/**
 * Define a UserPool App Client
 */
export class UserPoolClient extends Resource implements IUserPoolClient {
  /**
   * Import a user pool client given its id.
   */
  public static fromUserPoolClientId(scope: Construct, id: string, userPoolClientId: string): IUserPoolClient {
    class Import extends Resource implements IUserPoolClient {
      public readonly userPoolClientId = userPoolClientId;
    }

    return new Import(scope, id);
  }

  public readonly userPoolClientId: string;
  /**
   * The OAuth flows enabled for this client.
   */
  public readonly oAuthFlows: OAuthFlows;
  private readonly _userPoolClientName?: string;

  /*
   * Note to implementers: Two CloudFormation return values Name and ClientSecret are part of the spec.
   * However, they have been explicity not implemented here. They are not documented in CloudFormation, and
   * CloudFormation returns the following the string when these two attributes are 'GetAtt' - "attribute not supported
   * at this time, please use the CLI or Console to retrieve this value".
   * Awaiting updates from CloudFormation.
   */

  constructor(scope: Construct, id: string, props: UserPoolClientProps) {
    super(scope, id);

    if (props.disableOAuth && props.oAuth) {
      throw new Error('OAuth settings cannot be specified when disableOAuth is set.');
    }

    this.oAuthFlows = props.oAuth?.flows ?? {
      implicitCodeGrant: true,
      authorizationCodeGrant: true,
    };

    let callbackUrls: string[] | undefined = props.oAuth?.callbackUrls;
    if (this.oAuthFlows.authorizationCodeGrant || this.oAuthFlows.implicitCodeGrant) {
      if (callbackUrls === undefined) {
        callbackUrls = ['https://example.com'];
      } else if (callbackUrls.length === 0) {
        throw new Error('callbackUrl must not be empty when codeGrant or implicitGrant OAuth flows are enabled.');
      }
    }

    const resource = new CfnUserPoolClient(this, 'Resource', {
      clientName: props.userPoolClientName,
      generateSecret: props.generateSecret,
      userPoolId: props.userPool.userPoolId,
      explicitAuthFlows: this.configureAuthFlows(props),
      allowedOAuthFlows: props.disableOAuth ? undefined : this.configureOAuthFlows(),
      allowedOAuthScopes: props.disableOAuth ? undefined : this.configureOAuthScopes(props.oAuth),
      callbackUrLs: callbackUrls && callbackUrls.length > 0 && !props.disableOAuth ? callbackUrls : undefined,
      logoutUrLs: props.oAuth?.logoutUrls,
      allowedOAuthFlowsUserPoolClient: !props.disableOAuth,
      preventUserExistenceErrors: this.configurePreventUserExistenceErrors(props.preventUserExistenceErrors),
      supportedIdentityProviders: this.configureIdentityProviders(props),
      readAttributes: props.readAttributes?.attributes(),
      writeAttributes: props.writeAttributes?.attributes(),
    });
    this.configureTokenValidity(resource, props);

    this.userPoolClientId = resource.ref;
    this._userPoolClientName = props.userPoolClientName;
  }

  /**
   * The client name that was specified via the `userPoolClientName` property during initialization,
   * throws an error otherwise.
   */
  public get userPoolClientName(): string {
    if (this._userPoolClientName === undefined) {
      throw new Error('userPoolClientName is available only if specified on the UserPoolClient during initialization');
    }
    return this._userPoolClientName;
  }

  private configureAuthFlows(props: UserPoolClientProps): string[] | undefined {
    if (!props.authFlows) return undefined;

    const authFlows: string[] = [];
    if (props.authFlows.userPassword) { authFlows.push('ALLOW_USER_PASSWORD_AUTH'); }
    if (props.authFlows.adminUserPassword) { authFlows.push('ALLOW_ADMIN_USER_PASSWORD_AUTH'); }
    if (props.authFlows.custom) { authFlows.push('ALLOW_CUSTOM_AUTH'); }
    if (props.authFlows.userSrp) { authFlows.push('ALLOW_USER_SRP_AUTH'); }

    // refreshToken should always be allowed if authFlows are present
    if (authFlows.length > 0) {
      authFlows.push('ALLOW_REFRESH_TOKEN_AUTH');
    }

    if (authFlows.length === 0) {
      return undefined;
    }
    return authFlows;
  }

  private configureOAuthFlows(): string[] | undefined {
    if ((this.oAuthFlows.authorizationCodeGrant || this.oAuthFlows.implicitCodeGrant) && this.oAuthFlows.clientCredentials) {
      throw new Error('clientCredentials OAuth flow cannot be selected along with codeGrant or implicitGrant.');
    }
    const oAuthFlows: string[] = [];
    if (this.oAuthFlows.clientCredentials) { oAuthFlows.push('client_credentials'); }
    if (this.oAuthFlows.implicitCodeGrant) { oAuthFlows.push('implicit'); }
    if (this.oAuthFlows.authorizationCodeGrant) { oAuthFlows.push('code'); }

    if (oAuthFlows.length === 0) {
      return undefined;
    }
    return oAuthFlows;
  }

  private configureOAuthScopes(oAuth?: OAuthSettings): string[] {
    const scopes = oAuth?.scopes ?? [OAuthScope.PROFILE, OAuthScope.PHONE, OAuthScope.EMAIL, OAuthScope.OPENID,
      OAuthScope.COGNITO_ADMIN];
    const scopeNames = new Set(scopes.map((x) => x.scopeName));
    const autoOpenIdScopes = [OAuthScope.PHONE, OAuthScope.EMAIL, OAuthScope.PROFILE];
    if (autoOpenIdScopes.reduce((agg, s) => agg || scopeNames.has(s.scopeName), false)) {
      scopeNames.add(OAuthScope.OPENID.scopeName);
    }
    return Array.from(scopeNames);
  }

  private configurePreventUserExistenceErrors(prevent?: boolean): string | undefined {
    if (prevent === undefined) {
      return undefined;
    }
    return prevent ? 'ENABLED' : 'LEGACY';
  }

  private configureIdentityProviders(props: UserPoolClientProps): string[] | undefined {
    let providers: string[];
    if (!props.supportedIdentityProviders) {
      const providerSet = new Set(props.userPool.identityProviders.map((p) => p.providerName));
      providerSet.add('COGNITO');
      providers = Array.from(providerSet);
    } else {
      providers = props.supportedIdentityProviders.map((p) => p.name);
    }
    if (providers.length === 0) { return undefined; }
    return Array.from(providers);
  }

  private configureTokenValidity(resource: CfnUserPoolClient, props: UserPoolClientProps) {
    this.validateDuration('idTokenValidity', Duration.minutes(5), Duration.days(1), props.idTokenValidity);
    this.validateDuration('accessTokenValidity', Duration.minutes(5), Duration.days(1), props.accessTokenValidity);
    this.validateDuration('refreshTokenValidity', Duration.minutes(60), Duration.days(10 * 365), props.refreshTokenValidity);
    if (props.refreshTokenValidity) {
      this.validateDuration('idTokenValidity', Duration.minutes(5), props.refreshTokenValidity, props.idTokenValidity);
      this.validateDuration('accessTokenValidity', Duration.minutes(5), props.refreshTokenValidity, props.accessTokenValidity);
    }

    if (props.accessTokenValidity || props.idTokenValidity || props.refreshTokenValidity) {
      resource.tokenValidityUnits = {
        idToken: props.idTokenValidity ? 'minutes' : undefined,
        accessToken: props.accessTokenValidity ? 'minutes' : undefined,
        refreshToken: props.refreshTokenValidity ? 'minutes' : undefined,
      };
    };

    resource.idTokenValidity = props.idTokenValidity ? props.idTokenValidity.toMinutes() : undefined;
    resource.refreshTokenValidity = props.refreshTokenValidity ? props.refreshTokenValidity.toMinutes() : undefined;
    resource.accessTokenValidity = props.accessTokenValidity ? props.accessTokenValidity.toMinutes() : undefined;
  }

  private validateDuration(name: string, min: Duration, max: Duration, value?: Duration) {
    if (value === undefined) { return; }
    if (value.toMilliseconds() < min.toMilliseconds() || value.toMilliseconds() > max.toMilliseconds()) {
      throw new Error(`${name}: Must be a duration between ${min.toHumanString()} and ${max.toHumanString()} (inclusive); received ${value.toHumanString()}.`);
    }
  }
}
