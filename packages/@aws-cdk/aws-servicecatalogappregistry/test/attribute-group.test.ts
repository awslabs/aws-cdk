import '@aws-cdk/assert-internal/jest';
import * as cdk from '@aws-cdk/core';
import * as appreg from '../lib';

describe('Attribute Group', () => {
  let stack: cdk.Stack;

  beforeEach(() => {
    stack = new cdk.Stack();
  });

  test('default attribute group creation', () => {
    new appreg.AttributeGroup(stack, 'MyAttributeGroup', {
      attributeGroupName: 'testAttributeGroup',
      attributes: {
        key: 'value',
      },
    });

    expect(stack).toMatchTemplate({
      Resources: {
        MyAttributeGroup99099500: {
          Type: 'AWS::ServiceCatalogAppRegistry::AttributeGroup',
          Properties: {
            Name: 'testAttributeGroup',
            Attributes: {
              key: 'value',
            },
          },
        },
      },
    });
  }),

  test('attribute group with explicit description', () => {
    const description = 'my test attribute group description';
    new appreg.AttributeGroup(stack, 'MyAttributeGroup', {
      attributeGroupName: 'testAttributeGroup',
      attributes: {
        key: 'value',
      },
      description: description,
    });

    expect(stack).toHaveResourceLike('AWS::ServiceCatalogAppRegistry::AttributeGroup', {
      Description: description,
    });
  }),

  test('Attribute group with tags', () => {
    const attributeGroup = new appreg.AttributeGroup(stack, 'MyAttributeGroup', {
      attributeGroupName: 'testAttributeGroup',
      attributes: {
        key: 'value',
      },
    });

    cdk.Tags.of(attributeGroup).add('key1', 'value1');
    cdk.Tags.of(attributeGroup).add('key2', 'value2');

    expect(stack).toHaveResourceLike('AWS::ServiceCatalogAppRegistry::AttributeGroup', {
      Tags: {
        key1: 'value1',
        key2: 'value2',
      },
    });
  }),

  test('for an attribute group imported by ARN', () => {
    const attributeGroup = appreg.AttributeGroup.fromAttributeGroupArn(stack, 'MyAttributeGroup',
      'arn:aws:servicecatalog:us-east-1:123456789012:/attribute-groups/0aqmvxvgmry0ecc4mjhwypun6i');
    expect(attributeGroup.attributeGroupId).toEqual('0aqmvxvgmry0ecc4mjhwypun6i');
  }),

  test('fails for attribute group imported by ARN missing attributeGroupId', () => {
    expect(() => {
      appreg.AttributeGroup.fromAttributeGroupArn(stack, 'MyAttributeGroup',
        'arn:aws:servicecatalog:us-east-1:123456789012:/attribute-groups/');
    }).toThrow(/Missing required Attribute Group ID from Attribute Group ARN:/);
  }),

  test('attribute group created with a token description does not throw validation error and creates', () => {
    const tokenDescription = new cdk.CfnParameter(stack, 'Description');

    new appreg.AttributeGroup(stack, 'MyAttributeGroup', {
      attributeGroupName: 'testAttributeGroup',
      attributes: {
        key: 'value',
      },
      description: tokenDescription.valueAsString,
    });

    expect(stack).toHaveResourceLike('AWS::ServiceCatalogAppRegistry::AttributeGroup', {
      Description: {
        Ref: 'Description',
      },
    });
  }),

  test('attribute group created with a token attribute group name does not throw validation error', () => {
    const tokenAttributeGroupName = new cdk.CfnParameter(stack, 'AttributeGroupName');

    new appreg.AttributeGroup(stack, 'MyAttributeGroup', {
      attributeGroupName: tokenAttributeGroupName.valueAsString,
      attributes: {
        key: 'value',
      },
    });

    expect(stack).toHaveResourceLike('AWS::ServiceCatalogAppRegistry::AttributeGroup', {
      Name: {
        Ref: 'AttributeGroupName',
      },
    });
  }),

  test('fails for attribute group with description length longer than allowed', () => {
    expect(() => {
      new appreg.AttributeGroup(stack, 'MyAttributeGroup', {
        attributeGroupName: 'testAttributeGroup',
        attributes: {
          key: 'value',
        },
        description: 'too long attribute description'.repeat(1000),
      });
    }).toThrow(/Invalid attribute group description for resource/);
  }),

  test('fails for attribute group creation with name too short', () => {
    expect(() => {
      new appreg.AttributeGroup(stack, 'MyAttributeGroup', {
        attributeGroupName: '',
        attributes: {
          key: 'value',
        },
      });
    }).toThrow(/Invalid attribute group name for resource/);
  }),

  test('fails for attribute group with name too long', () => {
    expect(() => {
      new appreg.AttributeGroup(stack, 'MyAttributeGroup', {
        attributeGroupName: 'testAttributeNameTooLong'.repeat(50),
        attributes: {
          key: 'value',
        },
      });
    }).toThrow(/Invalid attribute group name for resource/);
  }),

  test('fails for attribute group name with name of invalid characters', () => {
    expect(() => {
      new appreg.AttributeGroup(stack, 'MyAttributeGroup', {
        attributeGroupName: '@ttR!8Ut3 Gr0uP',
        attributes: {
          key: 'value',
        },
      });
    }).toThrow(/Invalid attribute group name for resource/);
  });

  test('attribute group created with empty attributes', () => {
    new appreg.AttributeGroup(stack, 'MyAttributeGroup', {
      attributeGroupName: 'testAttributeGroup',
      attributes: {},
    });

    expect(stack).toHaveResourceLike('AWS::ServiceCatalogAppRegistry::AttributeGroup', {
      Attributes: {},
    });
  });
});
