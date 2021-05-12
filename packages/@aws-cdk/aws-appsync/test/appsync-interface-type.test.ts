import '@aws-cdk/assert-internal/jest';
import * as cdk from '@aws-cdk/core';
import * as appsync from '../lib';
import { GraphqlApiTest } from '../lib/private';
import * as t from './scalar-type-defintions';

let stack: cdk.Stack;
let api: GraphqlApiTest;
beforeEach(() => {
  // GIVEN
  stack = new cdk.Stack();
  api = new GraphqlApiTest(stack, 'api', {
    name: 'api',
  });
});

describe('testing InterfaceType properties', () => {
  let baseTest: appsync.InterfaceType;
  beforeEach(()=>{
    baseTest = new appsync.InterfaceType('baseTest', {
      definition: {
        id: t.id,
      },
    });
  });
  test('basic InterfaceType produces correct schema', () => {
    // WHEN
    api.addType(baseTest);
    const out = 'interface baseTest {\n  id: ID\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('InterfaceType fields can have arguments', () => {
    // WHEN
    baseTest.addField({
      fieldName: 'test',
      field: new appsync.Field({
        returnType: t.string,
        args: { success: t.int },
      }),
    });
    api.addType(baseTest);
    const out = 'interface baseTest {\n  id: ID\n  test(success: Int): String\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('InterfaceType fields will not produce resolvers', () => {
    // WHEN
    baseTest.addField({
      fieldName: 'test',
      field: new appsync.ResolvableField({
        returnType: t.string,
        args: { success: t.int },
        dataSource: api.addNoneDataSource('none'),
      }),
    });
    api.addType(baseTest);
    const out = 'interface baseTest {\n  id: ID\n  test(success: Int): String\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
    expect(stack).not.toHaveResourceLike('AWS::AppSync::Resolver', {
      FieldName: 'test',
    });
  });

  test('Interface Type can be a Graphql Type', () => {
    // WHEN
    const graphqlType = baseTest.attribute();

    const test = new appsync.ObjectType('Test', {
      definition: {
        test: graphqlType,
      },
    });
    api.addType(baseTest);
    api.addType(test);
    const out = 'interface baseTest {\n  id: ID\n}\ntype Test {\n  test: baseTest\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('Interface Type can generate Fields with Directives', () => {
    // WHEN
    const test = new appsync.InterfaceType('Test', {
      definition: {
        test: t.string,
      },
    });
    test.addField({
      fieldName: 'resolve',
      field: new appsync.Field({
        returnType: t.string,
        directives: [appsync.Directive.apiKey()],
      }),
    });

    api.addType(test);
    const out = 'interface Test {\n  test: String\n  resolve: String\n  @aws_api_key\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('Interface Type can generate ResolvableFields with Directives, but not the resolver', () => {
    // WHEN
    const test = new appsync.InterfaceType('Test', {
      definition: {
        test: t.string,
      },
    });
    test.addField({
      fieldName: 'resolve',
      field: new appsync.ResolvableField({
        returnType: t.string,
        directives: [appsync.Directive.apiKey()],
        dataSource: api.addNoneDataSource('none'),
      }),
    });

    api.addType(test);
    const out = 'interface Test {\n  test: String\n  resolve: String\n  @aws_api_key\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
    expect(stack).not.toHaveResourceLike('AWS::AppSync::Resolver', {
      FieldName: 'resolve',
    });
  });

  test('appsync fails addField with InterfaceType missing fieldName', () => {
    // WHEN
    const test = new appsync.InterfaceType('Test', { definition: {} });
    api.addType(test);

    // THEN
    expect(() => {
      test.addField({ fieldName: 'test' });
    }).toThrowError('Interface Types must have both fieldName and field options.');
  });

  test('appsync fails addField with InterfaceType missing field', () => {
    // WHEN
    const test = new appsync.InterfaceType('Test', { definition: {} });
    api.addType(test);

    // THEN
    expect(() => {
      test.addField({ field: t.string });
    }).toThrowError('Interface Types must have both fieldName and field options.');
  });

  test('appsync fails addField with InterfaceType missing both fieldName and field options', () => {
    // WHEN
    const test = new appsync.InterfaceType('Test', { definition: {} });
    api.addType(test);

    // THEN
    expect(() => {
      test.addField({});
    }).toThrowError('Interface Types must have both fieldName and field options.');
  });
});