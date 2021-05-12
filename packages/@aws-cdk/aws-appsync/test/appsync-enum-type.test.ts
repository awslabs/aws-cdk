import '@aws-cdk/assert-internal/jest';
import * as cdk from '@aws-cdk/core';
import * as appsync from '../lib';
import { GraphqlApiTest } from '../lib/private';
import * as t from './scalar-type-defintions';

const out = 'enum Test {\n  test1\n  test2\n  test3\n}\n';
let stack: cdk.Stack;
let api: GraphqlApiTest;
beforeEach(() => {
  // GIVEN
  stack = new cdk.Stack();
  api = new GraphqlApiTest(stack, 'api', {
    name: 'api',
  });
});

describe('testing Enum Type properties', () => {
  test('EnumType configures properly', () => {
    // WHEN
    const test = new appsync.EnumType('Test', {
      definition: ['test1', 'test2', 'test3'],
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

  test('EnumType can addField', () => {
    // WHEN
    const test = new appsync.EnumType('Test', {
      definition: ['test1', 'test2'],
    });
    api.addType(test);
    test.addField({ fieldName: 'test3' });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('EnumType can be a GraphqlType', () => {
    // WHEN
    const test = new appsync.EnumType('Test', {
      definition: ['test1', 'test2', 'test3'],
    });
    api.addType(test);

    api.addType(new appsync.ObjectType('Test2', {
      definition: { enum: test.attribute() },
    }));

    const obj = 'type Test2 {\n  enum: Test\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(`${out}${obj}`),
    });
  });

  test('errors when enum type is configured with white space', () => {
    // THEN
    expect(() => {
      new appsync.EnumType('Test', {
        definition: ['test 1', 'test2', 'test3'],
      });
    }).toThrowError('Enum Type values cannot have whitespace. Received: test 1');
  });

  test('errors when the fieldName in addField has white space', () => {
    // WHEN
    const test = new appsync.EnumType('Test', {
      definition: [],
    });
    // THEN
    expect(() => {
      test.addField({ fieldName: ' ' });
    }).toThrowError('Enum Type values cannot have whitespace. Received:  ');
  });

  test('errors when enum type is configured with field options', () => {
    // WHEN
    const test = new appsync.EnumType('Test', {
      definition: [],
    });
    // THEN
    expect(() => {
      test.addField({ fieldName: 'test', field: t.string });
    }).toThrowError('Enum Type fields consist of strings. Use the fieldName option instead of the field option.');
  });

  test('errors when enum type is missing fieldName option', () => {
    // WHEN
    const test = new appsync.EnumType('Test', {
      definition: [],
    });
    // THEN
    expect(() => {
      test.addField({});
    }).toThrowError('When adding a field to an Enum Type, you must configure the fieldName option.');
  });
});