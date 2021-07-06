import { CfnParameter, Stack } from '@aws-cdk/core';
import { BooleanAttribute, CustomAttributeConfig, DateTimeAttribute, ICustomAttribute, NumberAttribute, StringAttribute, ClientAttributes } from '../lib';
import { StandardAttributeNames } from '../lib/private/attr-names';

describe('User Pool Attributes', () => {

  describe('mutable', () => {
    test('default', () => {
      // GIVEN
      const allAttributes: ICustomAttribute[] = [
        new StringAttribute(),
        new NumberAttribute(),
        new BooleanAttribute(),
        new DateTimeAttribute(),
      ];

      // WHEN
      const bounds: CustomAttributeConfig[] = allAttributes.map((attr) => attr.bind() );

      // THEN
      bounds.forEach((bound) => {
        expect(bound.mutable).toBeUndefined();
      });
    });

    describe('mutable is set to true when specified', () => {
      // GIVEN
      const allTrueProps = {
        mutable: true,
      };
      const allAttributeTypes: ICustomAttribute[] = [
        new StringAttribute(allTrueProps),
        new NumberAttribute(allTrueProps),
        new BooleanAttribute(allTrueProps),
        new DateTimeAttribute(allTrueProps),
      ];

      // WHEN
      const bounds: CustomAttributeConfig[] = allAttributeTypes.map((attr) => attr.bind() );

      // THEN
      bounds.forEach((bound) => {
        test(`in attribute of type ${bound.dataType}:`, () => {
          expect(bound.mutable).toEqual(true);
        });
      });
    });

    describe('mutable is set to false', () => {
      // GIVEN
      const allFalseProps = {
        mutable: false,
      };
      const allAttributeTypes: ICustomAttribute[] = [
        new StringAttribute(allFalseProps),
        new NumberAttribute(allFalseProps),
        new BooleanAttribute(allFalseProps),
        new DateTimeAttribute(allFalseProps),
      ];

      // WHEN
      const bounds: CustomAttributeConfig[] = allAttributeTypes.map((attr) => attr.bind() );

      // THEN
      bounds.forEach((bound) => {
        test(`in attribute of type ${bound.dataType}`, () => {
          expect(bound.mutable).toEqual(false);
        });
      });
    });
  });

  describe('StringAttribute', () => {
    test('default', () => {
      // GIVEN
      const attr = new StringAttribute();

      // WHEN
      const bound = attr.bind();

      // THEN
      expect(bound.dataType).toEqual('String');
      expect(bound.stringConstraints).toBeUndefined();
      expect(bound.numberConstraints).toBeUndefined();
    });

    test('specified constraints are recognized', () => {
      // GIVEN
      const attr = new StringAttribute({ minLen: 10, maxLen: 60 });

      // WHEN
      const bound = attr.bind();

      // THEN
      expect(bound.stringConstraints).toEqual({
        minLen: 10,
        maxLen: 60,
      });
      expect(bound.numberConstraints).toBeUndefined();
    });

    test('throws error when crossing limits', () => {
      expect(() => new StringAttribute({ minLen: -10 }))
        .toThrow(/minLen cannot be less than/);
      expect(() => new StringAttribute({ maxLen: 5000 }))
        .toThrow(/maxLen cannot be greater than/);
    });

    test('validation is skipped when minLen or maxLen are tokens', () => {
      const stack = new Stack();
      const parameter = new CfnParameter(stack, 'Parameter', {
        type: 'Number',
      });

      expect(() => new StringAttribute({ minLen: parameter.valueAsNumber }))
        .not.toThrow();
      expect(() => new StringAttribute({ maxLen: parameter.valueAsNumber }))
        .not.toThrow();
    });
  });

  describe('NumberAttribute', () => {
    test('default', () => {
      // GIVEN
      const attr = new NumberAttribute();

      // WHEN
      const bound = attr.bind();

      // THEN
      expect(bound.dataType).toEqual('Number');
      expect(bound.stringConstraints).toBeUndefined();
      expect(bound.numberConstraints).toBeUndefined();
    });

    test('specified constraints are recognized', () => {
      // GIVEN
      const attr = new NumberAttribute({ min: 5, max: 600 });

      // WHEN
      const bound = attr.bind();

      // THEN
      expect(bound.numberConstraints).toEqual({
        min: 5,
        max: 600,
      });
      expect(bound.stringConstraints).toBeUndefined();
    });
  });

  describe('BooleanAttribute', () => {
    test('default', () => {
      // GIVEN
      const attr = new BooleanAttribute();

      // WHEN
      const bound = attr.bind();

      // THEN
      expect(bound.dataType).toEqual('Boolean');
      expect(bound.stringConstraints).toBeUndefined();
      expect(bound.numberConstraints).toBeUndefined();
    });
  });

  describe('DateTimeAttribute', () => {
    test('default', () => {
      // GIVEN
      const attr = new DateTimeAttribute();

      // WHEN
      const bound = attr.bind();

      // THEN
      expect(bound.dataType).toEqual('DateTime');
      expect(bound.stringConstraints).toBeUndefined();
      expect(bound.numberConstraints).toBeUndefined();
    });
  });

  describe('ClientAttributes', () => {
    test('create empty ClientAttributes', () => {
      // WHEN
      const clientAttributes = (new ClientAttributes());

      // THEN
      expect(clientAttributes.attributes()).toStrictEqual([]);
    });

    test('create ClientAttributes with all standard attributes', () => {
      // GIVEN
      const customAttributes = ['custom:my_attribute'];

      // WHEN
      const clientAttributes = (new ClientAttributes()).withStandardAttributes({
        address: true,
        birthdate: true,
        email: true,
        emailVerified: true,
        familyName: true,
        fullname: true,
        gender: true,
        givenName: true,
        lastUpdateTime: true,
        locale: true,
        middleName: true,
        nickname: true,
        phoneNumber: true,
        phoneNumberVerified: true,
        preferredUsername: true,
        profilePage: true,
        profilePicture: true,
        timezone: true,
        website: true,
      }).withCustomAttributes(...customAttributes);
      const attributes = clientAttributes.attributes();

      // THEN
      expect(attributes.length).toEqual(20);
      expect(attributes).toContain('preferred_username');
      expect(attributes).toContain('email_verified');
      expect(attributes).toContain('phone_number_verified');
      expect(attributes).toContain('custom:my_attribute');
    });

    test('create ClientAttributes copying another one', () => {
      // GIVEN
      const original = (new ClientAttributes())
        .withStandardAttributes({ email: true })
        .withCustomAttributes('custom1');
      const copied = original
        .withStandardAttributes({ emailVerified: true })
        .withCustomAttributes('custom2');

      // WHEN
      const originalAttributes = original.attributes();
      const copiedAttributes = copied.attributes();

      // THEN
      expect(originalAttributes.length).toEqual(2);
      expect(copiedAttributes.length).toEqual(4);
      // originals MUST NOT contain the added ones
      expect(originalAttributes).toContain('email');
      expect(originalAttributes).toContain('custom:custom1');
      expect(originalAttributes).not.toContain('email_verified');
      expect(originalAttributes).not.toContain('custom:custom2');
      // copied MUST contain all attributes
      expect(copiedAttributes).toContain('email');
      expect(copiedAttributes).toContain('custom:custom1');
      expect(copiedAttributes).toContain('email_verified');
      expect(copiedAttributes).toContain('custom:custom2');
    });

    test('create ClientAttributes with custom attributes only', () => {
      // GIVEN
      const customAttributes = ['custom:my_first', 'my_second'];

      // WHEN
      const clientAttributes = (new ClientAttributes()).withCustomAttributes(...customAttributes);
      const attributes = clientAttributes.attributes();

      // EXPECT
      expect(attributes.length).toEqual(2);
      expect(attributes).toContain('custom:my_first');
      expect(attributes).toContain('custom:my_second');
    });

    test('create ClientAttributes with all StandardAttributeNames', () => {
      // this test is intended to check if changes in the `StandardAttributeNames` constant
      // does not reflect as changes in the `StandardAttributesMask`
      // GIVEN
      let allStandardAttributes = {} as any;
      let standardAttributeNamesCount = 0; // the count of StandardAttributeNames
      // iterate through the standard attribute names
      for (const attributeKey in StandardAttributeNames) {
        standardAttributeNamesCount += 1;
        expect(StandardAttributeNames).toHaveProperty(attributeKey);
        // add the standard attribute
        allStandardAttributes[attributeKey] = true;
      }

      // WHEN
      const attributes = (new ClientAttributes()).withStandardAttributes(allStandardAttributes).attributes();

      // EXPECT
      expect(attributes.length).toEqual(standardAttributeNamesCount);
    });
  });
});
