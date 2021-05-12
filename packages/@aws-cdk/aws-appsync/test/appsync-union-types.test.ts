import '@aws-cdk/assert-internal/jest';
import * as cdk from '@aws-cdk/core';
import * as appsync from '../lib';
import { GraphqlApiTest } from '../lib/private';
import * as t from './scalar-type-defintions';

const out = 'type Test1 {\n  test1: String\n}\ntype Test2 {\n  test2: String\n}\nunion UnionTest = Test1 | Test2\n';
const test1 = new appsync.ObjectType('Test1', {
  definition: { test1: t.string },
});
const test2 = new appsync.ObjectType('Test2', {
  definition: { test2: t.string },
});
let stack: cdk.Stack;
let api: GraphqlApiTest;
beforeEach(() => {
  // GIVEN
  stack = new cdk.Stack();
  api = new GraphqlApiTest(stack, 'api', {
    name: 'api',
  });
  api.addType(test1);
  api.addType(test2);
});

describe('testing Union Type properties', () => {
  test('UnionType configures properly', () => {
    // WHEN
    const union = new appsync.UnionType('UnionTest', {
      definition: [test1, test2],
    });
    api.addType(union);
    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
    expect(stack).not.toHaveResourceLike('AWS::AppSync::Resolver', {
      TypeName: 'UnionTest',
    });
  });

  test('UnionType can addField', () => {
    // WHEN
    const union = new appsync.UnionType('UnionTest', {
      definition: [test1],
    });
    api.addType(union);
    union.addField({ field: test2.attribute() });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('UnionType errors when addField is configured with fieldName option', () => {
    // WHEN
    const union = new appsync.UnionType('UnionTest', {
      definition: [test1],
    });
    api.addType(union);

    // THEN
    expect(() => {
      union.addField({ fieldName: 'fail', field: test2.attribute() });
    }).toThrowError('Union Types cannot be configured with the fieldName option. Use the field option instead.');
  });

  test('UnionType errors when addField is not configured with field option', () => {
    // WHEN
    const union = new appsync.UnionType('UnionTest', {
      definition: [test1],
    });
    api.addType(union);

    // THEN
    expect(() => {
      union.addField({});
    }).toThrowError('Union Types must be configured with the field option.');
  });

  test('UnionType can be a GraphqlType', () => {
    // WHEN
    const union = new appsync.UnionType('UnionTest', {
      definition: [test1, test2],
    });
    api.addType(union);

    api.addType(new appsync.ObjectType('Test3', {
      definition: { union: union.attribute() },
    }));

    const obj = 'type Test3 {\n  union: UnionTest\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(`${out}${obj}`),
    });
  });

  test('appsync errors when addField with Graphql Types', () => {
    // WHEN
    const test = new appsync.UnionType('Test', {
      definition: [],
    });
    // THEN
    expect(() => {
      test.addField({ field: t.string });
    }).toThrowError('Fields for Union Types must be Object Types.');
  });

  test('appsync errors when addField with Field', () => {
    // WHEN
    const test = new appsync.UnionType('Test', {
      definition: [],
    });
    // THEN
    expect(() => {
      test.addField({ field: new appsync.Field({ returnType: t.string }) });
    }).toThrowError('Fields for Union Types must be Object Types.');
  });

  test('appsync errors when addField with ResolvableField', () => {
    // WHEN
    const test = new appsync.UnionType('Test', {
      definition: [],
    });
    // THEN
    expect(() => {
      test.addField({ field: new appsync.ResolvableField({ returnType: t.string }) });
    }).toThrowError('Fields for Union Types must be Object Types.');
  });

  test('appsync errors when addField with Interface Types', () => {
    // WHEN
    const test = new appsync.UnionType('Test', {
      definition: [],
    });
    // THEN
    expect(() => {
      test.addField({ field: new appsync.InterfaceType('break', { definition: {} }).attribute() });
    }).toThrowError('Fields for Union Types must be Object Types.');
  });

  test('appsync errors when addField with Union Types', () => {
    // WHEN
    const test = new appsync.UnionType('Test', {
      definition: [],
    });
    // THEN
    expect(() => {
      test.addField({ field: test.attribute() });
    }).toThrowError('Fields for Union Types must be Object Types.');
  });
});