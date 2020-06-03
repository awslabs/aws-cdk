import { IRole, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import { Construct, Duration, IResource, Lazy, Resource, Stack } from '@aws-cdk/core';
import { CfnUserPool } from './cognito.generated';
import { ICustomAttribute, RequiredAttributes } from './user-pool-attr';
import { UserPoolClient, UserPoolClientOptions } from './user-pool-client';
import { UserPoolDomain, UserPoolDomainOptions } from './user-pool-domain';

/**
 * The different ways in which users of this pool can sign up or sign in.
 */
export interface SignInAliases {
  /**
   * Whether user is allowed to sign up or sign in with a username
   * @default true
   */
  readonly username?: boolean;

  /**
   * Whether a user is allowed to sign up or sign in with an email address
   * @default false
   */
  readonly email?: boolean;

  /**
   * Whether a user is allowed to sign up or sign in with a phone number
   * @default false
   */
  readonly phone?: boolean;

  /**
   * Whether a user is allowed to ign in with a secondary username, that can be set and modified after sign up.
   * Can only be used in conjunction with `USERNAME`.
   * @default false
   */
  readonly preferredUsername?: boolean;
}

/**
 * Attributes that can be automatically verified for users in a user pool.
 */
export interface AutoVerifiedAttrs {
  /**
   * Whether the email address of the user should be auto verified at sign up.
   *
   * Note: If both `email` and `phone` is set, Cognito only verifies the phone number. To also verify email, see here -
   * https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-email-phone-verification.html
   *
   * @default - true, if email is turned on for `signIn`. false, otherwise.
   */
  readonly email?: boolean;

  /**
   * Whether the phone number of the user should be auto verified at sign up.
   * @default - true, if phone is turned on for `signIn`. false, otherwise.
   */
  readonly phone?: boolean;
}

/**
 * Triggers for a user pool
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools-working-with-aws-lambda-triggers.html
 */
export interface UserPoolTriggers {
  /**
   * Creates an authentication challenge.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-create-auth-challenge.html
   * @default - no trigger configured
   */
  readonly createAuthChallenge?: lambda.IFunction;

  /**
   * A custom Message AWS Lambda trigger.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-custom-message.html
   * @default - no trigger configured
   */
  readonly customMessage?: lambda.IFunction;

  /**
   * Defines the authentication challenge.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-define-auth-challenge.html
   * @default - no trigger configured
   */
  readonly defineAuthChallenge?: lambda.IFunction;

  /**
   * A post-authentication AWS Lambda trigger.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-post-authentication.html
   * @default - no trigger configured
   */
  readonly postAuthentication?: lambda.IFunction;

  /**
   * A post-confirmation AWS Lambda trigger.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-post-confirmation.html
   * @default - no trigger configured
   */
  readonly postConfirmation?: lambda.IFunction;

  /**
   * A pre-authentication AWS Lambda trigger.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-authentication.html
   * @default - no trigger configured
   */
  readonly preAuthentication?: lambda.IFunction;

  /**
   * A pre-registration AWS Lambda trigger.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-sign-up.html
   * @default - no trigger configured
   */
  readonly preSignUp?: lambda.IFunction;

  /**
   * A pre-token-generation AWS Lambda trigger.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-token-generation.html
   * @default - no trigger configured
   */
  readonly preTokenGeneration?: lambda.IFunction;

  /**
   * A user-migration AWS Lambda trigger.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-migrate-user.html
   * @default - no trigger configured
   */
  readonly userMigration?: lambda.IFunction;

  /**
   * Verifies the authentication challenge response.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-verify-auth-challenge-response.html
   * @default - no trigger configured
   */
  readonly verifyAuthChallengeResponse?: lambda.IFunction;

  /**
   * Index signature
   */
  [trigger: string]: lambda.IFunction | undefined;
}

/**
 * User pool operations to which lambda triggers can be attached.
 */
export class UserPoolOperation {
  /**
   * Creates a challenge in a custom auth flow
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-create-auth-challenge.html
   */
  public static readonly CREATE_AUTH_CHALLENGE = new UserPoolOperation('createAuthChallenge');

  /**
   * Advanced customization and localization of messages
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-custom-message.html
   */
  public static readonly CUSTOM_MESSAGE = new UserPoolOperation('customMessage');

  /**
   * Determines the next challenge in a custom auth flow
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-define-auth-challenge.html
   */
  public static readonly DEFINE_AUTH_CHALLENGE = new UserPoolOperation('defineAuthChallenge');

  /**
   * Event logging for custom analytics
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-post-authentication.html
   */
  public static readonly POST_AUTHENTICATION = new UserPoolOperation('postAuthentication');

  /**
   * Custom welcome messages or event logging for custom analytics
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-post-confirmation.html
   */
  public static readonly POST_CONFIRMATION = new UserPoolOperation('postConfirmation');

  /**
   * Custom validation to accept or deny the sign-in request
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-authentication.html
   */
  public static readonly PRE_AUTHENTICATION = new UserPoolOperation('preAuthentication');

  /**
   * Custom validation to accept or deny the sign-up request
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-sign-up.html
   */
  public static readonly PRE_SIGN_UP = new UserPoolOperation('preSignUp');

  /**
   * Add or remove attributes in Id tokens
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-token-generation.html
   */
  public static readonly PRE_TOKEN_GENERATION = new UserPoolOperation('preTokenGeneration');

  /**
   * Migrate a user from an existing user directory to user pools
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-migrate-user.html
   */
  public static readonly USER_MIGRATION = new UserPoolOperation('userMigration');

  /**
   * Determines if a response is correct in a custom auth flow
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-verify-auth-challenge-response.html
   */
  public static readonly VERIFY_AUTH_CHALLENGE_RESPONSE = new UserPoolOperation('verifyAuthChallengeResponse');

  /** A custom user pool operation */
  public static of(name: string): UserPoolOperation {
    const lowerCamelCase = name.charAt(0).toLowerCase() + name.slice(1);
    return new UserPoolOperation(lowerCamelCase);
  }

  /** The key to use in `CfnUserPool.LambdaConfigProperty` */
  public readonly operationName: string;

  private constructor(operationName: string) {
    this.operationName = operationName;
  }
}

/**
 * The email verification style
 */
export enum VerificationEmailStyle {
  /** Verify email via code */
  CODE = 'CONFIRM_WITH_CODE',
  /** Verify email via link */
  LINK = 'CONFIRM_WITH_LINK',
}

/**
 * User pool configuration for user self sign up.
 */
export interface UserVerificationConfig {
  /**
   * The email subject template for the verification email sent to the user upon sign up.
   * See https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-settings-message-templates.html to
   * learn more about message templates.
   * @default 'Verify your new account'
   */
  readonly emailSubject?: string;

  /**
   * The email body template for the verification email sent to the user upon sign up.
   * See https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-settings-message-templates.html to
   * learn more about message templates.
   *
   * @default - 'The verification code to your new account is {####}' if VerificationEmailStyle.CODE is chosen,
   * 'Verify your account by clicking on {##Verify Email##}' if VerificationEmailStyle.LINK is chosen.
   */
  readonly emailBody?: string;

  /**
   * Emails can be verified either using a code or a link.
   * Learn more at https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-settings-email-verification-message-customization.html
   * @default VerificationEmailStyle.CODE
   */
  readonly emailStyle?: VerificationEmailStyle;

  /**
   * The message template for the verification SMS sent to the user upon sign up.
   * See https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-settings-message-templates.html to
   * learn more about message templates.
   *
   * @default - 'The verification code to your new account is {####}' if VerificationEmailStyle.CODE is chosen,
   * not configured if VerificationEmailStyle.LINK is chosen
   */
  readonly smsMessage?: string;
}

/**
 * User pool configuration when administrators sign users up.
 */
export interface UserInvitationConfig {
  /**
   * The template to the email subject that is sent to the user when an administrator signs them up to the user pool.
   * @default 'Your temporary password'
   */
  readonly emailSubject?: string;

  /**
   * The template to the email body that is sent to the user when an administrator signs them up to the user pool.
   * @default 'Your username is {username} and temporary password is {####}.'
   */
  readonly emailBody?: string;

  /**
   * The template to the SMS message that is sent to the user when an administrator signs them up to the user pool.
   * @default 'Your username is {username} and temporary password is {####}'
   */
  readonly smsMessage?: string;
}

/**
 * The different ways in which a user pool's MFA enforcement can be configured.
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-mfa.html
 */
export enum Mfa {
  /** Users are not required to use MFA for sign in, and cannot configure one. */
  OFF = 'OFF',
  /** Users are not required to use MFA for sign in, but can configure one if they so choose to. */
  OPTIONAL = 'OPTIONAL',
  /** Users are required to configure an MFA, and have to use it to sign in. */
  REQUIRED = 'ON',
}

/**
 * The different ways in which a user pool can obtain their MFA token for sign in.
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-mfa.html
 */
export interface MfaSecondFactor {
  /**
   * The MFA token is sent to the user via SMS to their verified phone numbers
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-mfa-sms-text-message.html
   * @default true
   */
  readonly sms: boolean;

  /**
   * The MFA token is a time-based one time password that is generated by a hardware or software token
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-mfa-totp.html
   * @default false
   */
  readonly otp: boolean;
}

/**
 * The different ways in which a user pool's Advanced Security Mode can be configured.
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-settings-advanced-security.html
 */
export enum AdvancedSecurityMode {
  /** Enable advanced security */
  ENFORCED = 'ENFORCED',
  /** Gather information, and send user pool data to Amazon CloudWatch */
  AUDIT = 'AUDIT',
  /** Disable advanced security */
  OFF = 'OFF'
}

/**
 * Password policy for User Pools.
 */
export interface PasswordPolicy {
  /**
   * The length of time the temporary password generated by an admin is valid.
   * This must be provided as whole days, like Duration.days(3) or Duration.hours(48).
   * Fractional days, such as Duration.hours(20), will generate an error.
   * @default Duration.days(7)
   */
  readonly tempPasswordValidity?: Duration;

  /**
   * Minimum length required for a user's password.
   * @default 8
   */
  readonly minLength?: number;

  /**
   * Whether the user is required to have lowercase characters in their password.
   * @default true
   */
  readonly requireLowercase?: boolean;

  /**
   * Whether the user is required to have uppercase characters in their password.
   * @default true
   */
  readonly requireUppercase?: boolean;

  /**
   * Whether the user is required to have digits in their password.
   * @default true
   */
  readonly requireDigits?: boolean;

  /**
   * Whether the user is required to have symbols in their password.
   * @default true
   */
  readonly requireSymbols?: boolean;
}

/**
 * Email settings for the user pool.
 */
export interface EmailSettings {
  /**
   * The 'from' address on the emails received by the user.
   * @default noreply@verificationemail.com
   */
  readonly from?: string;

  /**
   * The 'replyTo' address on the emails received by the user as defined by IETF RFC-5322.
   * When set, most email clients recognize to change 'to' line to this address when a reply is drafted.
   * @default - Not set.
   */
  readonly replyTo?: string;
}

/**
 * Props for the UserPool construct
 */
export interface UserPoolProps {
  /**
   * Name of the user pool
   *
   * @default - automatically generated name by CloudFormation at deploy time
   */
  readonly userPoolName?: string;

  /**
   * Whether self sign up should be enabled. This can be further configured via the `selfSignUp` property.
   * @default false
   */
  readonly selfSignUpEnabled?: boolean;

  /**
   * Configuration around users signing themselves up to the user pool.
   * Enable or disable self sign-up via the `selfSignUpEnabled` property.
   * @default - see defaults in UserVerificationConfig
   */
  readonly userVerification?: UserVerificationConfig;

  /**
   * Configuration around admins signing up users into a user pool.
   * @default - see defaults in UserInvitationConfig
   */
  readonly userInvitation?: UserInvitationConfig;

  /**
   * The IAM role that Cognito will assume while sending SMS messages.
   * @default - a new IAM role is created
   */
  readonly smsRole?: IRole;

  /**
   * The 'ExternalId' that Cognito service must using when assuming the `smsRole`, if the role is restricted with an 'sts:ExternalId' conditional.
   * Learn more about ExternalId here - https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-user_externalid.html
   *
   * This property will be ignored if `smsRole` is not specified.
   * @default - No external id will be configured
   */
  readonly smsRoleExternalId?: string;

  /**
   * Methods in which a user registers or signs in to a user pool.
   * Allows either username with aliases OR sign in with email, phone, or both.
   *
   * Read the sections on usernames and aliases to learn more -
   * https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html
   *
   * To match with 'Option 1' in the above link, with a verified email, this property should be set to
   * `{ username: true, email: true }`. To match with 'Option 2' in the above link with both a verified email and phone
   * number, this property should be set to `{ email: true, phone: true }`.
   *
   * @default { username: true }
   */
  readonly signInAliases?: SignInAliases;

  /**
   * Attributes which Cognito will look to verify automatically upon user sign up.
   * EMAIL and PHONE are the only available options.
   *
   * @default - If `signInAlias` includes email and/or phone, they will be included in `autoVerifiedAttributes` by default.
   * If absent, no attributes will be auto-verified.
   */
  readonly autoVerify?: AutoVerifiedAttrs;

  /**
   * The set of attributes that are required for every user in the user pool.
   * Read more on attributes here - https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html
   *
   * @default - No attributes are required.
   */
  readonly requiredAttributes?: RequiredAttributes;

  /**
   * Define a set of custom attributes that can be configured for each user in the user pool.
   *
   * @default - No custom attributes.
   */
  readonly customAttributes?: { [key: string]: ICustomAttribute };

  /**
   * Configure whether users of this user pool can or are required use MFA to sign in.
   *
   * @default Mfa.OFF
   */
  readonly mfa?: Mfa;

  /**
   * Configure for advanced security mode .
   *
   * @default AdvancedSecurityMode.OFF.
   */
  readonly advancedSecurity?: AdvancedSecurityMode;

  /**
   * Configure the MFA types that users can use in this user pool. Ignored if `mfa` is set to `OFF`.
   *
   * @default - { sms: true, oneTimePassword: false }, if `mfa` is set to `OPTIONAL` or `REQUIRED`.
   * { sms: false, oneTimePassword: false }, otherwise
   */
  readonly mfaSecondFactor?: MfaSecondFactor;

  /**
   * Password policy for this user pool.
   * @default - see defaults on each property of PasswordPolicy.
   */
  readonly passwordPolicy?: PasswordPolicy;

  /**
   * Email settings for a user pool.
   * @default - see defaults on each property of EmailSettings.
   */
  readonly emailSettings?: EmailSettings;

  /**
   * Lambda functions to use for supported Cognito triggers.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools-working-with-aws-lambda-triggers.html
   * @default - No Lambda triggers.
   */
  readonly lambdaTriggers?: UserPoolTriggers;

  /**
   * Whether sign-in aliases should be evaluated with case sensitivity.
   * For example, when this option is set to false, users will be able to sign in using either `MyUsername` or `myusername`.
   * @default true
   */
  readonly signInCaseSensitive?: boolean;
}

/**
 * Represents a Cognito UserPool
 */
export interface IUserPool extends IResource {
  /**
   * The physical ID of this user pool resource
   * @attribute
   */
  readonly userPoolId: string;

  /**
   * The ARN of this user pool resource
   * @attribute
   */
  readonly userPoolArn: string;

  /**
   * Add a new app client to this user pool.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-client-apps.html
   */
  addClient(id: string, options?: UserPoolClientOptions): UserPoolClient;

  /**
   * Associate a domain to this user pool.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-assign-domain.html
   */
  addDomain(id: string, options: UserPoolDomainOptions): UserPoolDomain;
}

abstract class UserPoolBase extends Resource implements IUserPool {
  public abstract readonly userPoolId: string;
  public abstract readonly userPoolArn: string;

  public addClient(id: string, options?: UserPoolClientOptions): UserPoolClient {
    return new UserPoolClient(this, id, {
      userPool: this,
      ...options,
    });
  }

  public addDomain(id: string, options: UserPoolDomainOptions): UserPoolDomain {
    return new UserPoolDomain(this, id, {
      userPool: this,
      ...options,
    });
  }
}

/**
 * Define a Cognito User Pool
 */
export class UserPool extends UserPoolBase {
  /**
   * Import an existing user pool based on its id.
   */
  public static fromUserPoolId(scope: Construct, id: string, userPoolId: string): IUserPool {
    class Import extends UserPoolBase {
      public readonly userPoolId = userPoolId;
      public readonly userPoolArn = Stack.of(this).formatArn({
        service: 'cognito-idp',
        resource: 'userpool',
        resourceName: userPoolId,
      });
    }
    return new Import(scope, id);
  }

  /**
   * Import an existing user pool based on its ARN.
   */
  public static fromUserPoolArn(scope: Construct, id: string, userPoolArn: string): IUserPool {
    return UserPool.fromUserPoolId(scope, id, Stack.of(scope).parseArn(userPoolArn).resourceName!);
  }

  /**
   * The physical ID of this user pool resource
   */
  public readonly userPoolId: string;

  /**
   * The ARN of the user pool
   */
  public readonly userPoolArn: string;

  /**
   * User pool provider name
   * @attribute
   */
  public readonly userPoolProviderName: string;

  /**
   * User pool provider URL
   * @attribute
   */
  public readonly userPoolProviderUrl: string;

  private triggers: CfnUserPool.LambdaConfigProperty = { };

  constructor(scope: Construct, id: string, props: UserPoolProps = {}) {
    super(scope, id);

    const signIn = this.signInConfiguration(props);

    if (props.lambdaTriggers) {
      for (const t of Object.keys(props.lambdaTriggers)) {
        const trigger = props.lambdaTriggers[t];
        if (trigger !== undefined) {
          this.addLambdaPermission(trigger as lambda.IFunction, t);
          (this.triggers as any)[t] = (trigger as lambda.IFunction).functionArn;
        }
      }
    }

    const verificationMessageTemplate = this.verificationMessageConfiguration(props);
    let emailVerificationMessage;
    let emailVerificationSubject;
    if (verificationMessageTemplate.defaultEmailOption === VerificationEmailStyle.CODE) {
      emailVerificationMessage = verificationMessageTemplate.emailMessage;
      emailVerificationSubject = verificationMessageTemplate.emailSubject;
    }
    const smsVerificationMessage = verificationMessageTemplate.smsMessage;
    const inviteMessageTemplate: CfnUserPool.InviteMessageTemplateProperty = {
      emailMessage: props.userInvitation?.emailBody,
      emailSubject: props.userInvitation?.emailSubject,
      smsMessage: props.userInvitation?.smsMessage,
    };
    const selfSignUpEnabled = props.selfSignUpEnabled !== undefined ? props.selfSignUpEnabled : false;
    const adminCreateUserConfig: CfnUserPool.AdminCreateUserConfigProperty = {
      allowAdminCreateUserOnly: !selfSignUpEnabled,
      inviteMessageTemplate: props.userInvitation !== undefined ? inviteMessageTemplate : undefined,
    };

    const passwordPolicy = this.configurePasswordPolicy(props);

    const userPool = new CfnUserPool(this, 'Resource', {
      userPoolName: props.userPoolName,
      usernameAttributes: signIn.usernameAttrs,
      aliasAttributes: signIn.aliasAttrs,
      autoVerifiedAttributes: signIn.autoVerifyAttrs,
      lambdaConfig: Lazy.anyValue({ produce: () => undefinedIfNoKeys(this.triggers) }),
      smsConfiguration: this.smsConfiguration(props),
      adminCreateUserConfig,
      emailVerificationMessage,
      emailVerificationSubject,
      smsVerificationMessage,
      verificationMessageTemplate,
      schema: this.schemaConfiguration(props),
      mfaConfiguration: props.mfa,
      enabledMfas: this.mfaConfiguration(props),
      userPoolAddOns: undefinedIfNoKeys({
        advancedSecurityMode: props.advancedSecurity,
      }),
      policies: passwordPolicy !== undefined ? { passwordPolicy } : undefined,
      emailConfiguration: undefinedIfNoKeys({
        from: props.emailSettings?.from,
        replyToEmailAddress: props.emailSettings?.replyTo,
      }),
      usernameConfiguration: undefinedIfNoKeys({
        caseSensitive: props.signInCaseSensitive,
      }),
    });

    this.userPoolId = userPool.ref;
    this.userPoolArn = userPool.attrArn;

    this.userPoolProviderName = userPool.attrProviderName;
    this.userPoolProviderUrl = userPool.attrProviderUrl;
  }

  /**
   * Add a lambda trigger to a user pool operation
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools-working-with-aws-lambda-triggers.html
   */
  public addTrigger(operation: UserPoolOperation, fn: lambda.IFunction): void {
    if (operation.operationName in this.triggers) {
      throw new Error(`A trigger for the operation ${operation} already exists.`);
    }

    this.addLambdaPermission(fn, operation.operationName);
    (this.triggers as any)[operation.operationName] = fn.functionArn;
  }

  private addLambdaPermission(fn: lambda.IFunction, name: string): void {
    const capitalize = name.charAt(0).toUpperCase() + name.slice(1);
    fn.addPermission(`${capitalize}Cognito`, {
      principal: new ServicePrincipal('cognito-idp.amazonaws.com'),
      sourceArn: this.userPoolArn,
    });
  }

  private verificationMessageConfiguration(props: UserPoolProps): CfnUserPool.VerificationMessageTemplateProperty {
    const CODE_TEMPLATE = '{####}';
    const VERIFY_EMAIL_TEMPLATE = '{##Verify Email##}';

    const emailStyle = props.userVerification?.emailStyle ?? VerificationEmailStyle.CODE;
    const emailSubject = props.userVerification?.emailSubject ?? 'Verify your new account';
    const smsMessage = props.userVerification?.smsMessage ?? `The verification code to your new account is ${CODE_TEMPLATE}`;

    if (emailStyle === VerificationEmailStyle.CODE) {
      const emailMessage = props.userVerification?.emailBody ?? `The verification code to your new account is ${CODE_TEMPLATE}`;
      if (emailMessage.indexOf(CODE_TEMPLATE) < 0) {
        throw new Error(`Verification email body must contain the template string '${CODE_TEMPLATE}'`);
      }
      if (smsMessage.indexOf(CODE_TEMPLATE) < 0) {
        throw new Error(`SMS message must contain the template string '${CODE_TEMPLATE}'`);
      }
      return {
        defaultEmailOption: VerificationEmailStyle.CODE,
        emailMessage,
        emailSubject,
        smsMessage,
      };
    } else {
      const emailMessage = props.userVerification?.emailBody ??
        `Verify your account by clicking on ${VERIFY_EMAIL_TEMPLATE}`;
      if (emailMessage.indexOf(VERIFY_EMAIL_TEMPLATE) < 0) {
        throw new Error(`Verification email body must contain the template string '${VERIFY_EMAIL_TEMPLATE}'`);
      }
      return {
        defaultEmailOption: VerificationEmailStyle.LINK,
        emailMessageByLink: emailMessage,
        emailSubjectByLink: emailSubject,
        smsMessage,
      };
    }
  }

  private signInConfiguration(props: UserPoolProps) {
    let aliasAttrs: string[] | undefined;
    let usernameAttrs: string[] | undefined;
    let autoVerifyAttrs: string[] | undefined;

    const signIn: SignInAliases = props.signInAliases ?? { username: true };

    if (signIn.preferredUsername && !signIn.username) {
      throw new Error('username signIn must be enabled if preferredUsername is enabled');
    }

    if (signIn.username) {
      aliasAttrs = [];
      if (signIn.email) { aliasAttrs.push(StandardAttribute.EMAIL); }
      if (signIn.phone) { aliasAttrs.push(StandardAttribute.PHONE_NUMBER); }
      if (signIn.preferredUsername) { aliasAttrs.push(StandardAttribute.PREFERRED_USERNAME); }
      if (aliasAttrs.length === 0) { aliasAttrs = undefined; }
    } else {
      usernameAttrs = [];
      if (signIn.email) { usernameAttrs.push(StandardAttribute.EMAIL); }
      if (signIn.phone) { usernameAttrs.push(StandardAttribute.PHONE_NUMBER); }
    }

    if (props.autoVerify) {
      autoVerifyAttrs = [];
      if (props.autoVerify.email) { autoVerifyAttrs.push(StandardAttribute.EMAIL); }
      if (props.autoVerify.phone) { autoVerifyAttrs.push(StandardAttribute.PHONE_NUMBER); }
    } else if (signIn.email || signIn.phone) {
      autoVerifyAttrs = [];
      if (signIn.email) { autoVerifyAttrs.push(StandardAttribute.EMAIL); }
      if (signIn.phone) { autoVerifyAttrs.push(StandardAttribute.PHONE_NUMBER); }
    }

    return { usernameAttrs, aliasAttrs, autoVerifyAttrs };
  }

  private smsConfiguration(props: UserPoolProps): CfnUserPool.SmsConfigurationProperty {
    if (props.smsRole) {
      return {
        snsCallerArn: props.smsRole.roleArn,
        externalId: props.smsRoleExternalId,
      };
    } else {
      const smsRoleExternalId = this.node.uniqueId.substr(0, 1223); // sts:ExternalId max length of 1224
      const smsRole = props.smsRole ?? new Role(this, 'smsRole', {
        assumedBy: new ServicePrincipal('cognito-idp.amazonaws.com', {
          conditions: {
            StringEquals: { 'sts:ExternalId': smsRoleExternalId },
          },
        }),
        inlinePolicies: {
          /*
           * The UserPool is very particular that it must contain an 'sns:Publish' action as an inline policy.
           * Ideally, a conditional that restricts this action to 'sms' protocol needs to be attached, but the UserPool deployment fails validation.
           * Seems like a case of being excessively strict.
           */
          'sns-publish': new PolicyDocument({
            statements: [
              new PolicyStatement({
                actions: [ 'sns:Publish' ],
                resources: [ '*' ],
              }),
            ],
          }),
        },
      });
      return {
        externalId: smsRoleExternalId,
        snsCallerArn: smsRole.roleArn,
      };
    }
  }

  private mfaConfiguration(props: UserPoolProps): string[] | undefined {
    if (props.mfa === undefined || props.mfa === Mfa.OFF) {
      // since default is OFF, treat undefined and OFF the same way
      return undefined;
    } else if (props.mfaSecondFactor === undefined &&
      (props.mfa === Mfa.OPTIONAL || props.mfa === Mfa.REQUIRED)) {
      return [ 'SMS_MFA' ];
    } else {
      const enabledMfas = [];
      if (props.mfaSecondFactor!.sms) {
        enabledMfas.push('SMS_MFA');
      }
      if (props.mfaSecondFactor!.otp) {
        enabledMfas.push('SOFTWARE_TOKEN_MFA');
      }
      return enabledMfas;
    }
  }

  private configurePasswordPolicy(props: UserPoolProps): CfnUserPool.PasswordPolicyProperty | undefined {
    const tempPasswordValidity = props.passwordPolicy?.tempPasswordValidity;
    if (tempPasswordValidity !== undefined && tempPasswordValidity.toDays() > Duration.days(365).toDays()) {
      throw new Error(`tempPasswordValidity cannot be greater than 365 days (received: ${tempPasswordValidity.toDays()})`);
    }
    const minLength = props.passwordPolicy ? props.passwordPolicy.minLength ?? 8 : undefined;
    if (minLength !== undefined && (minLength < 6 || minLength > 99)) {
      throw new Error(`minLength for password must be between 6 and 99 (received: ${minLength})`);
    }
    return undefinedIfNoKeys({
      temporaryPasswordValidityDays: tempPasswordValidity?.toDays({ integral: true }),
      minimumLength: minLength,
      requireLowercase: props.passwordPolicy?.requireLowercase,
      requireUppercase: props.passwordPolicy?.requireUppercase,
      requireNumbers: props.passwordPolicy?.requireDigits,
      requireSymbols: props.passwordPolicy?.requireSymbols,
    });
  }

  private schemaConfiguration(props: UserPoolProps): CfnUserPool.SchemaAttributeProperty[] | undefined {
    const schema: CfnUserPool.SchemaAttributeProperty[] = [];

    if (props.requiredAttributes) {
      const stdAttributes: StandardAttribute[] = [];

      if (props.requiredAttributes.address) { stdAttributes.push(StandardAttribute.ADDRESS); }
      if (props.requiredAttributes.birthdate) { stdAttributes.push(StandardAttribute.BIRTHDATE); }
      if (props.requiredAttributes.email) { stdAttributes.push(StandardAttribute.EMAIL); }
      if (props.requiredAttributes.familyName) { stdAttributes.push(StandardAttribute.FAMILY_NAME); }
      if (props.requiredAttributes.fullname) { stdAttributes.push(StandardAttribute.NAME); }
      if (props.requiredAttributes.gender) { stdAttributes.push(StandardAttribute.GENDER); }
      if (props.requiredAttributes.givenName) { stdAttributes.push(StandardAttribute.GIVEN_NAME); }
      if (props.requiredAttributes.lastUpdateTime) { stdAttributes.push(StandardAttribute.LAST_UPDATE_TIME); }
      if (props.requiredAttributes.locale) { stdAttributes.push(StandardAttribute.LOCALE); }
      if (props.requiredAttributes.middleName) { stdAttributes.push(StandardAttribute.MIDDLE_NAME); }
      if (props.requiredAttributes.nickname) { stdAttributes.push(StandardAttribute.NICKNAME); }
      if (props.requiredAttributes.phoneNumber) { stdAttributes.push(StandardAttribute.PHONE_NUMBER); }
      if (props.requiredAttributes.preferredUsername) { stdAttributes.push(StandardAttribute.PREFERRED_USERNAME); }
      if (props.requiredAttributes.profilePage) { stdAttributes.push(StandardAttribute.PROFILE_URL); }
      if (props.requiredAttributes.profilePicture) { stdAttributes.push(StandardAttribute.PICTURE_URL); }
      if (props.requiredAttributes.timezone) { stdAttributes.push(StandardAttribute.TIMEZONE); }
      if (props.requiredAttributes.website) { stdAttributes.push(StandardAttribute.WEBSITE); }

      schema.push(...stdAttributes.map((attr) => {
        return { name: attr, required: true };
      }));
    }

    if (props.customAttributes) {
      const customAttrs = Object.keys(props.customAttributes).map((attrName) => {
        const attrConfig = props.customAttributes![attrName].bind();
        const numberConstraints: CfnUserPool.NumberAttributeConstraintsProperty = {
          minValue: attrConfig.numberConstraints?.min?.toString(),
          maxValue: attrConfig.numberConstraints?.max?.toString(),
        };
        const stringConstraints: CfnUserPool.StringAttributeConstraintsProperty = {
          minLength: attrConfig.stringConstraints?.minLen?.toString(),
          maxLength: attrConfig.stringConstraints?.maxLen?.toString(),
        };

        return {
          name: attrName,
          attributeDataType: attrConfig.dataType,
          numberAttributeConstraints: (attrConfig.numberConstraints) ? numberConstraints : undefined,
          stringAttributeConstraints: (attrConfig.stringConstraints) ? stringConstraints : undefined,
          mutable: attrConfig.mutable,
        };
      });
      schema.push(...customAttrs);
    }

    if (schema.length === 0) {
      return undefined;
    }
    return schema;
  }
}

const enum StandardAttribute {
  ADDRESS = 'address',
  BIRTHDATE = 'birthdate',
  EMAIL = 'email',
  FAMILY_NAME = 'family_name',
  GENDER = 'gender',
  GIVEN_NAME = 'given_name',
  LOCALE = 'locale',
  MIDDLE_NAME = 'middle_name',
  NAME = 'name',
  NICKNAME = 'nickname',
  PHONE_NUMBER = 'phone_number',
  PICTURE_URL = 'picture',
  PREFERRED_USERNAME = 'preferred_username',
  PROFILE_URL = 'profile',
  TIMEZONE = 'zoneinfo',
  LAST_UPDATE_TIME = 'updated_at',
  WEBSITE = 'website',
}

function undefinedIfNoKeys(struct: object): object | undefined {
  const allUndefined = Object.values(struct).reduce((acc, v) => acc && (v === undefined), true);
  return allUndefined ? undefined : struct;
}
