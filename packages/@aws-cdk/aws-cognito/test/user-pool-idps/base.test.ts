import { Stack } from '@aws-cdk/core';
import { ProviderAttribute, UserPool } from '../../lib';
import { UserPoolIdentityProviderBase } from '../../lib/user-pool-idps/private/user-pool-idp-base';

class MyIdp extends UserPoolIdentityProviderBase {
  public readonly providerName = 'MyProvider';
  public readonly mapping = this.configureAttributeMapping();
}

describe('UserPoolIdentityProvider', () => {
  describe('attribute mapping', () => {
    test('absent or empty', () => {
      // GIVEN
      const stack = new Stack();
      const pool = new UserPool(stack, 'UserPool');

      // WHEN
      const idp1 = new MyIdp(stack, 'MyIdp1', {
        userPool: pool,
      });
      const idp2 = new MyIdp(stack, 'MyIdp2', {
        userPool: pool,
        attributeMapping: {},
      });

      // THEN
      expect(idp1.mapping).toBeUndefined();
      expect(idp2.mapping).toBeUndefined();
    });

    test('standard attributes', () => {
      // GIVEN
      const stack = new Stack();
      const pool = new UserPool(stack, 'UserPool');

      // WHEN
      const idp = new MyIdp(stack, 'MyIdp', {
        userPool: pool,
        attributeMapping: {
          givenName: ProviderAttribute.FACEBOOK_NAME,
          birthdate: ProviderAttribute.FACEBOOK_BIRTHDAY,
        },
      });

      // THEN
      expect(idp.mapping).toStrictEqual({
        given_name: 'name',
        birthdate: 'birthday',
      });
    });

    test('custom', () => {
      // GIVEN
      const stack = new Stack();
      const pool = new UserPool(stack, 'UserPool');

      // WHEN
      const idp = new MyIdp(stack, 'MyIdp', {
        userPool: pool,
        attributeMapping: {
          custom: {
            'custom-attr-1': ProviderAttribute.AMAZON_EMAIL,
            'custom-attr-2': ProviderAttribute.AMAZON_NAME,
          },
        },
      });

      // THEN
      expect(idp.mapping).toStrictEqual({
        'custom-attr-1': 'email',
        'custom-attr-2': 'name',
      });
    });

    test('custom provider attribute', () => {
      // GIVEN
      const stack = new Stack();
      const pool = new UserPool(stack, 'UserPool');

      // WHEN
      const idp = new MyIdp(stack, 'MyIdp', {
        userPool: pool,
        attributeMapping: {
          address: ProviderAttribute.other('custom-provider-attr'),
        },
      });

      // THEN
      expect(idp.mapping).toStrictEqual({
        address: 'custom-provider-attr',
      });
    });
  });
});