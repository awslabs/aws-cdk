import '@aws-cdk/assert/jest';
import { Stack } from '@aws-cdk/core';
import { AdvancedSecurityMode, UserPool } from '../lib';
import { AccountTakeoverEventAction, CompromisedCredentialsEvent, CompromisedCredentialsEventAction, UserPoolRiskConfigurationAttachment } from '../lib/user-pool-security';

describe('User Pool Security', () => {
  test('UserPool Risk Configuration is correctly set', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const userPool = new UserPool(stack, 'Pool1', {
      userPoolName: 'Pool1',
      advancedSecurity: AdvancedSecurityMode.ENFORCED,
    });
    new UserPoolRiskConfigurationAttachment(stack, 'Pool1Security', {
      userPool,
    });

    // THEN
    expect(stack).toHaveResource('AWS::Cognito::UserPoolRiskConfigurationAttachment', {
      ClientId: 'ALL',
      UserPoolId: stack.resolve(userPool.userPoolId),
    });
  });

  test('AccountTakeOverConfiguration of UserPool Risk Configuration is correctly set', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const userPool = new UserPool(stack, 'Pool1', {
      userPoolName: 'Pool1',
      advancedSecurity: AdvancedSecurityMode.ENFORCED,
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
        notifyConfiguration: {
          blockEmail: {
            htmlBody: 'html body',
            subject: 'Your account got blocked',
            textBody: 'Your account got blocked',
          },
          mfaEmail: {
            htmlBody: 'html body',
            subject: 'Your account needs MFA verification',
            textBody: 'Your account needs MFA verification',
          },
          noActionEmail: {
            htmlBody: 'HtmlBody',
            subject: 'Subject',
            textBody: 'TextBody',
          },
          from: 'your-from-email@amazon.com',
          replyTo: 'your-reply-to@amazon.com',
          sourceArn: 'SourceArn',
        },
      },
    });

    // THEN
    expect(stack).toHaveResource('AWS::Cognito::UserPoolRiskConfigurationAttachment', {
      ClientId: 'ALL',
      UserPoolId: stack.resolve(userPool.userPoolId),
      AccountTakeoverRiskConfiguration: {
        Actions: {
          HighAction: {
            EventAction: 'BLOCK',
            Notify: true,
          },
          LowAction: {
            EventAction: 'NO_ACTION',
            Notify: false,
          },
          MediumAction: {
            EventAction: 'MFA_IF_CONFIGURED',
            Notify: true,
          },
        },
        NotifyConfiguration: {
          BlockEmail: {
            HtmlBody: 'html body',
            Subject: 'Your account got blocked',
            TextBody: 'Your account got blocked',
          },
          MfaEmail: {
            HtmlBody: 'html body',
            Subject: 'Your account needs MFA verification',
            TextBody: 'Your account needs MFA verification',
          },
          NoActionEmail: {
            HtmlBody: 'HtmlBody',
            Subject: 'Subject',
            TextBody: 'TextBody',
          },
          From: 'your-from-email@amazon.com',
          SourceArn: 'SourceArn',
          ReplyTo: 'your-reply-to@amazon.com',
        },
      },
    });
  });

  test('CompromisedCredentialsRiskConfiguration of UserPool Risk Configuration is correctly set', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const userPool = new UserPool(stack, 'Pool1', {
      userPoolName: 'Pool1',
      advancedSecurity: AdvancedSecurityMode.ENFORCED,
    });
    new UserPoolRiskConfigurationAttachment(stack, 'Pool1Security', {
      userPool,
      compromisedCredentialsRisk: {
        actions: {
          eventAction: CompromisedCredentialsEventAction.BLOCK,
        },
        eventFilter: [
          CompromisedCredentialsEvent.PASSWORD_CHANGE,
          CompromisedCredentialsEvent.SIGN_IN,
          CompromisedCredentialsEvent.SIGN_UP,
        ],
      },
    });

    // THEN
    expect(stack).toHaveResource('AWS::Cognito::UserPoolRiskConfigurationAttachment', {
      ClientId: 'ALL',
      UserPoolId: stack.resolve(userPool.userPoolId),
      CompromisedCredentialsRiskConfiguration: {
        Actions: {
          EventAction: 'BLOCK',
        },
        EventFilter: [
          'PASSWORD_CHANGE',
          'SIGN_IN',
          'SIGN_UP',
        ],
      },
    });
  });

  test('RiskExceptionConfiguration of UserPool Risk Configuration is correctly set', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const userPool = new UserPool(stack, 'Pool1', {
      userPoolName: 'Pool1',
      advancedSecurity: AdvancedSecurityMode.ENFORCED,
    });
    new UserPoolRiskConfigurationAttachment(stack, 'Pool1Security', {
      userPool,
      riskException: {
        blockedIpRangeList: [
          '198.0.0.1',
        ],
        skippedIpRangeList: [
          '198.0.0.2',
        ],
      },
    });

    // THEN
    expect(stack).toHaveResource('AWS::Cognito::UserPoolRiskConfigurationAttachment', {
      ClientId: 'ALL',
      UserPoolId: stack.resolve(userPool.userPoolId),
      RiskExceptionConfiguration: {
        BlockedIPRangeList: [
          '198.0.0.1',
        ],
        SkippedIPRangeList: [
          '198.0.0.2',
        ],
      },
    });
  });
});