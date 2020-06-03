import { Construct, Resource } from '@aws-cdk/core';
import { CfnUserPoolRiskConfigurationAttachment } from './cognito.generated';
import { IUserPool } from './user-pool';

/**
 * The different ways in which a adaptive authentication for advanced security can be configured.
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-settings-adaptive-authentication.html
 */
export enum AccountTakeoverEventAction {
  /** All sign-in attempts are blocked */
  BLOCK = 'BLOCK',
  /** Users who don't have MFA configured are allowed to sign in without an additional factor. */
  MFA_IF_CONFIGURED = 'MFA_IF_CONFIGURED',
  /** Users who don't have MFA configured are blocked from signing in. */
  MFA_REQUIRED = 'MFA_REQUIRED',
  /** The sign-in attempt is allowed without an additional factor. */
  NO_ACTION = 'NO_ACTION'
}

/**
 * The action for account takeover.
 */
export interface AccountTakeoverAction {
  /**
   * The event action for account takeover.
   */
  readonly eventAction: AccountTakeoverEventAction;
  /**
   * The flagment specifying whether to send a notification
   */
  readonly notify: boolean;
}

/**
 * The actions for account takeover.
 */
export interface AccountTakeoverActions {
  /**
   * The action for high risk of account takeover.
   * @default - no action configured
   */
  readonly highAction?: AccountTakeoverAction;
  /**
   * The action for low risk of account takeover.
   * @default - no configured
   */
  readonly lowAction?: AccountTakeoverAction;
  /**
   * The action for medium risk of account takeover.
   * @default - no configured
   */
  readonly mediumAction?: AccountTakeoverAction;
}

/**
 * The notify email.
 */
export interface NotifyEmail {
  /**
   * The HTML body of email.
   * @default - Not set
   */
  readonly htmlBody?: string;
  /**
   * The subject of email.
   */
  readonly subject: string;
  /**
   * The text body of email.
   * @default - Not set
   */
  readonly textBody?: string;
}

/**
 * The notify configuration used to construct email notifications
 */
export interface NotifyConfiguration {
  /**
   * Email template used when a detected risk event is blocked.
   * @default - Not set
   */
  readonly blockEmail?: NotifyEmail;
  /**
   * The email address that is sending the email.
   * @default - Not set
   */
  readonly from?: string;
  /**
   * The MFA email template used when MFA is challenged as part of a detected risk.
   * @default - Not set
   */
  readonly mfaEmail?: NotifyEmail;
  /**
   * The email template used when a detected risk event is allowed.
   * @default - Not set
   */
  readonly noActionEmail?: NotifyEmail;
  /**
   * The destination to which the receiver of an email should reply to.
   * @default - Not set
   */
  readonly replyTo?: string;
  /**
   * Email template used when a detected risk event is blocked.
   */
  readonly sourceArn: string;
}

/**
 * The configuration for actions and notification for different levels of risk detected for a potential account takeover.
 */
export interface AccountTakeoverRiskConfiguration {
  /**
   * The actions of account takeover risk configuration.
   */
  readonly actions: AccountTakeoverActions;

  /**
   * The notify configuration used to construct email notifications.
   * @default - no configured
   */
  readonly notifyConfiguration?: NotifyConfiguration;
}

/**
 * The action for compromised credentials.
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-settings-compromised-credentials.html
 */
export enum CompromisedCredentialsEventAction {
  /** Blocking requires users to choose another password */
  BLOCK = 'BLOCK',
  /** all attempted uses of compromised credentials to Amazon CloudWatch */
  NO_ACTION = 'NO_ACTION',
}

/**
 * The actions for compromised credentials.
 */
export interface CompromisedCredentialsActions {
  /**
   * The action compromised credentials event.
   */
  readonly eventAction: CompromisedCredentialsEventAction;
}

/**
 * The event type for compromised credentials check.
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-settings-compromised-credentials.html
 */
export enum CompromisedCredentialsEvent {
  /** Users sign in */
  SIGN_IN = 'SIGN_IN',
  /** Users change password */
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  /** Users sign up */
  SIGN_UP = 'SIGN_UP',
}

/**
 * The configuration for compromised credentials risk.
 */
export interface CompromisedCredentialsRiskConfiguration {
  /**
   * The actions for compromised credentials risk.
   */
  readonly actions: CompromisedCredentialsActions;
  /**
   * The trigger for compromised credentials check.
   * @default - Not set.
   */
  readonly eventFilter?: CompromisedCredentialsEvent[];
}

/**
 * The configuration to override the risk decision.
 */
export interface RiskExceptionConfiguration {
  /**
   * Overrides the risk decision to always block the pre-authentication requests
   */
  readonly blockedIpRangeList?: string[];
  /**
   * Risk detection is not performed on the IP addresses in the range list
   */
  readonly skippedIpRangeList?: string[];
}

/**
 * Risk settings for advanced security.
 */
export interface UserPoolRiskConfigurationAttachmentOptions {
  /**
   * The identifier of the app client to which you want to specify the risk setting.
   * You can specify a single client or all clients.
   * @default 'ALL'
   */
  readonly clientId?: string;
  /**
   * The account takeover risk configuration including the notify configuration and actions.
   * @default - no configured
   */
  readonly accountTakeoverRisk?: AccountTakeoverRiskConfiguration;
  /**
   * The compromised credentials risk configuration including the event filter and action.
   * @default - no configured
   */
  readonly compromisedCredentialsRisk?: CompromisedCredentialsRiskConfiguration;
  /**
   * The configuration to override the risk decision.
   * @default - no configured
   */
  readonly riskException?: RiskExceptionConfiguration;
}

/**
 * Props for UserPoolRiskConfigurationAttachment construct
 */
export interface UserPoolRiskConfigurationAttachmentProps extends UserPoolRiskConfigurationAttachmentOptions {
  /**
   * The user pool to which this domain should be associated.
   */
  readonly userPool: IUserPool;
}

export class UserPoolRiskConfigurationAttachment extends Resource {
  constructor(scope: Construct, id: string, props: UserPoolRiskConfigurationAttachmentProps) {
    super(scope, id);

    if (!!props.riskException) {
      if (!!props.riskException.blockedIpRangeList && props.riskException.blockedIpRangeList.length > 20) {
        throw new Error('The maximum number of Blocked Ip Range List items of RiskException is 20.');
      }
      if (!!props.riskException.skippedIpRangeList && props.riskException.skippedIpRangeList.length > 20) {
        throw new Error('The maximum number of Skipped Ip Range List items of RiskException is 20.');
      }
    }

    new CfnUserPoolRiskConfigurationAttachment(this, id, {
      userPoolId: props.userPool.userPoolId,
      clientId: props.clientId ? props.clientId : 'ALL',
      accountTakeoverRiskConfiguration: props.accountTakeoverRisk,
      compromisedCredentialsRiskConfiguration: props.compromisedCredentialsRisk,
      riskExceptionConfiguration: props.riskException,
    });
  }
}