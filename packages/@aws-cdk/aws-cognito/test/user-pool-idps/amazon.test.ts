import { TemplateAssertions } from '@aws-cdk/assertions';
import { Stack } from '@aws-cdk/core';
import { ProviderAttribute, UserPool, UserPoolIdentityProviderAmazon } from '../../lib';

describe('UserPoolIdentityProvider', () => {
  describe('amazon', () => {
    test('defaults', () => {
      // GIVEN
      const stack = new Stack();
      const pool = new UserPool(stack, 'userpool');

      // WHEN
      new UserPoolIdentityProviderAmazon(stack, 'userpoolidp', {
        userPool: pool,
        clientId: 'amzn-client-id',
        clientSecret: 'amzn-client-secret',
      });

      TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
        ProviderName: 'LoginWithAmazon',
        ProviderType: 'LoginWithAmazon',
        ProviderDetails: {
          client_id: 'amzn-client-id',
          client_secret: 'amzn-client-secret',
          authorize_scopes: 'profile',
        },
      });
    });

    test('scopes', () => {
      // GIVEN
      const stack = new Stack();
      const pool = new UserPool(stack, 'userpool');

      // WHEN
      new UserPoolIdentityProviderAmazon(stack, 'userpoolidp', {
        userPool: pool,
        clientId: 'amzn-client-id',
        clientSecret: 'amzn-client-secret',
        scopes: ['scope1', 'scope2'],
      });

      TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
        ProviderName: 'LoginWithAmazon',
        ProviderType: 'LoginWithAmazon',
        ProviderDetails: {
          client_id: 'amzn-client-id',
          client_secret: 'amzn-client-secret',
          authorize_scopes: 'scope1 scope2',
        },
      });
    });

    test('registered with user pool', () => {
      // GIVEN
      const stack = new Stack();
      const pool = new UserPool(stack, 'userpool');

      // WHEN
      const provider = new UserPoolIdentityProviderAmazon(stack, 'userpoolidp', {
        userPool: pool,
        clientId: 'amzn-client-id',
        clientSecret: 'amzn-client-secret',
      });

      // THEN
      expect(pool.identityProviders).toContain(provider);
    });

    test('attribute mapping', () => {
      // GIVEN
      const stack = new Stack();
      const pool = new UserPool(stack, 'userpool');

      // WHEN
      new UserPoolIdentityProviderAmazon(stack, 'userpoolidp', {
        userPool: pool,
        clientId: 'amazn-client-id',
        clientSecret: 'amzn-client-secret',
        attributeMapping: {
          givenName: ProviderAttribute.AMAZON_NAME,
          address: ProviderAttribute.other('amzn-address'),
          custom: {
            customAttr1: ProviderAttribute.AMAZON_EMAIL,
            customAttr2: ProviderAttribute.other('amzn-custom-attr'),
          },
        },
      });

      // THEN
      TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
        AttributeMapping: {
          given_name: 'name',
          address: 'amzn-address',
          customAttr1: 'email',
          customAttr2: 'amzn-custom-attr',
        },
      });
    });
  });
});