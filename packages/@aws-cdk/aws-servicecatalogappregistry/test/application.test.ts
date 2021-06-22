import '@aws-cdk/assert-internal/jest';
import * as cdk from '@aws-cdk/core';
import * as appreg from '../lib';

describe('Application', () => {
  let stack: cdk.Stack;

  beforeEach(() => {
    stack = new cdk.Stack();
  });

  test('default application creation', () => {
    new appreg.Application(stack, 'MyApplication', {
      applicationName: 'testApplication',
    });

    expect(stack).toMatchTemplate({
      Resources: {
        MyApplication5C63EC1D: {
          Type: 'AWS::ServiceCatalogAppRegistry::Application',
          Properties: {
            Name: 'testApplication',
          },
        },
      },
    });
  }),

  test('application with explicit description', () => {
    const description = 'my test application description';
    new appreg.Application(stack, 'MyApplication', {
      applicationName: 'testApplication',
      description: description,
    });

    expect(stack).toHaveResourceLike('AWS::ServiceCatalogAppRegistry::Application', {
      Description: description,
    });
  }),

  test('application with application tags', () => {
    const application = new appreg.Application(stack, 'MyApplication', {
      applicationName: 'testApplication',
    });

    cdk.Tags.of(application).add('key1', 'value1');
    cdk.Tags.of(application).add('key2', 'value2');

    expect(stack).toHaveResourceLike('AWS::ServiceCatalogAppRegistry::Application', {
      Tags: {
        key1: 'value1',
        key2: 'value2',
      },
    });
  }),

  test('for an application imported by ARN', () => {
    const application = appreg.Application.fromApplicationArn(stack, 'MyApplication',
      'arn:aws:servicecatalog:us-east-1:123456789012:/applications/0aqmvxvgmry0ecc4mjhwypun6i');
    expect(application.applicationId).toEqual('0aqmvxvgmry0ecc4mjhwypun6i');
  }),

  test('fails for application imported by ARN missing applicationId', () => {
    expect(() => {
      appreg.Application.fromApplicationArn(stack, 'MyApplication',
        'arn:aws:servicecatalog:us-east-1:123456789012:/applications/');
    }).toThrow(/Missing required Application ID from Application ARN:/);
  }),

  test('application created with a token description does not throw validation error and creates', () => {
    const tokenDescription = new cdk.CfnParameter(stack, 'Description');

    new appreg.Application(stack, 'MyApplication', {
      applicationName: 'myApplication',
      description: tokenDescription.valueAsString,
    });

    expect(stack).toHaveResourceLike('AWS::ServiceCatalogAppRegistry::Application', {
      Description: {
        Ref: 'Description',
      },
    });
  }),

  test('application created with a token application name does not throw validation error', () => {
    const tokenApplicationName= new cdk.CfnParameter(stack, 'ApplicationName');

    new appreg.Application(stack, 'MyApplication', {
      applicationName: tokenApplicationName.valueAsString,
    });

    expect(stack).toHaveResourceLike('AWS::ServiceCatalogAppRegistry::Application', {
      Name: {
        Ref: 'ApplicationName',
      },
    });
  }),

  test('fails for application with description length longer than allowed', () => {
    expect(() => {
      new appreg.Application(stack, 'MyApplication', {
        applicationName: 'testApplication',
        description: 'too long description'.repeat(1000),
      });
    }).toThrow(/Invalid application description for resource/);
  }),

  test('fails for application creation with name too short', () => {
    expect(() => {
      new appreg.Application(stack, 'MyApplication', {
        applicationName: '',
      });
    }).toThrow(/Invalid application name for resource/);
  }),

  test('fails for application with name too long', () => {
    expect(() => {
      new appreg.Application(stack, 'MyApplication', {
        applicationName: 'testApplication'.repeat(50),
      });
    }).toThrow(/Invalid application name for resource/);
  }),

  test('fails for application with name of invalid characters', () => {
    expect(() => {
      new appreg.Application(stack, 'MyApplication', {
        applicationName: 'My@ppl!iC@ #',
      });
    }).toThrow(/Invalid application name for resource/);
  });
});

