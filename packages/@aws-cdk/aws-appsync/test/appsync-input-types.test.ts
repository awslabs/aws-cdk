import '@aws-cdk/assert-internal/jest';
import * as cdk from '@aws-cdk/core';
import * as appsync from '../lib';
import { GraphqlApiTest } from '../lib/private';
import * as t from './scalar-type-defintions';

const out = 'input Test {\n  test: String\n}\n';
let stack: cdk.Stack;
let api: GraphqlApiTest;
beforeEach(() => {
  // GIVEN
  stack = new cdk.Stack();
  api = new GraphqlApiTest(stack, 'api', {
    name: 'api',
  });
});

describe('testing Input Type properties', () => {
  test('InputType configures properly', () => {
    // WHEN
    const test = new appsync.InputType('Test', {
      definition: { test: t.string },
    });
    api.addType(test);

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
    expect(stack).not.toHaveResourceLike('AWS::AppSync::Resolver', {
      TypeName: 'Test',
    });
  });

  test('InputType can addField', () => {
    // WHEN
    const test = new appsync.InputType('Test', { definition: {} });
    api.addType(test);
    test.addField({ fieldName: 'test', field: t.string });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('appsync fails addField with InputType missing fieldName', () => {
    // WHEN
    const test = new appsync.InputType('Test', { definition: {} });
    api.addType(test);

    // THEN
    expect(() => {
      test.addField({ fieldName: 'test' });
    }).toThrowError('Input Types must have both fieldName and field options.');
  });

  test('appsync fails addField with InputType missing field', () => {
    // WHEN
    const test = new appsync.InputType('Test', { definition: {} });
    api.addType(test);

    // THEN
    expect(() => {
      test.addField({ field: t.string });
    }).toThrowError('Input Types must have both fieldName and field options.');
  });

  test('appsync fails addField with InputType missing both fieldName and field options', () => {
    // WHEN
    const test = new appsync.InputType('Test', { definition: {} });
    api.addType(test);

    // THEN
    expect(() => {
      test.addField({});
    }).toThrowError('Input Types must have both fieldName and field options.');
  });

  test('InputType can be a GraphqlType', () => {
    // WHEN
    const test = new appsync.InputType('Test', {
      definition: { test: t.string },
    });
    api.addType(test);

    api.addType(new appsync.ObjectType('Test2', {
      definition: { input: test.attribute() },
    }));

    const obj = 'input Test {\n  test: String\n}\ntype Test2 {\n  input: Test\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(`${out}${obj}`),
    });
  });
});