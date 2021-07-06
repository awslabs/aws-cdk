import { TemplateAssertions } from '@aws-cdk/assertions';
import { Stack } from '@aws-cdk/core';
import { ProviderAttribute, UserPool, UserPoolIdentityProviderApple } from '../../lib';

describe('UserPoolIdentityProvider', () => {
  describe('apple', () => {
    test('defaults', () => {
      // GIVEN
      const stack = new Stack();
      const pool = new UserPool(stack, 'userpool');

      // WHEN
      new UserPoolIdentityProviderApple(stack, 'userpoolidp', {
        userPool: pool,
        clientId: 'com.amzn.cdk',
        teamId: 'CDKTEAMCDK',
        keyId: 'CDKKEYCDK1',
        privateKey: 'PRIV_KEY_CDK',
      });

      TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
        ProviderName: 'SignInWithApple',
        ProviderType: 'SignInWithApple',
        ProviderDetails: {
          client_id: 'com.amzn.cdk',
          team_id: 'CDKTEAMCDK',
          key_id: 'CDKKEYCDK1',
          private_key: 'PRIV_KEY_CDK',
          authorize_scopes: 'name',
        },
      });
    });

    test('scopes', () => {
      // GIVEN
      const stack = new Stack();
      const pool = new UserPool(stack, 'userpool');

      // WHEN
      new UserPoolIdentityProviderApple(stack, 'userpoolidp', {
        userPool: pool,
        clientId: 'com.amzn.cdk',
        teamId: 'CDKTEAMCDK',
        keyId: 'CDKKEYCDK1',
        privateKey: 'PRIV_KEY_CDK',
        scopes: ['scope1', 'scope2'],
      });

      TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
        ProviderName: 'SignInWithApple',
        ProviderType: 'SignInWithApple',
        ProviderDetails: {
          client_id: 'com.amzn.cdk',
          team_id: 'CDKTEAMCDK',
          key_id: 'CDKKEYCDK1',
          private_key: 'PRIV_KEY_CDK',
          authorize_scopes: 'scope1 scope2',
        },
      });
    });

    test('registered with user pool', () => {
      // GIVEN
      const stack = new Stack();
      const pool = new UserPool(stack, 'userpool');

      // WHEN
      const provider = new UserPoolIdentityProviderApple(stack, 'userpoolidp', {
        userPool: pool,
        clientId: 'com.amzn.cdk',
        teamId: 'CDKTEAMCDK',
        keyId: 'CDKKEYCDK1',
        privateKey: 'PRIV_KEY_CDK',
      });

      // THEN
      expect(pool.identityProviders).toContain(provider);
    });

    test('attribute mapping', () => {
      // GIVEN
      const stack = new Stack();
      const pool = new UserPool(stack, 'userpool');

      // WHEN
      new UserPoolIdentityProviderApple(stack, 'userpoolidp', {
        userPool: pool,
        clientId: 'com.amzn.cdk',
        teamId: 'CDKTEAMCDK',
        keyId: 'CDKKEYCDK1',
        privateKey: 'PRIV_KEY_CDK',
        attributeMapping: {
          familyName: ProviderAttribute.APPLE_LAST_NAME,
          givenName: ProviderAttribute.APPLE_FIRST_NAME,
          custom: {
            customAttr1: ProviderAttribute.APPLE_EMAIL,
            customAttr2: ProviderAttribute.other('sub'),
          },
        },
      });

      // THEN
      TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
        AttributeMapping: {
          family_name: 'firstName',
          given_name: 'lastName',
          customAttr1: 'email',
          customAttr2: 'sub',
        },
      });
    });
  });
});