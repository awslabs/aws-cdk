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

describe('testing Object Type properties', () => {
  test('ObjectType can implement from interface types', () => {
    // WHEN
    const baseTest = new appsync.InterfaceType('baseTest', {
      definition: {
        id: t.id,
      },
    });
    const objectTest = new appsync.ObjectType('objectTest', {
      interfaceTypes: [baseTest],
      definition: {
        id2: t.id,
      },
      directives: [appsync.Directive.custom('@test')],
    });

    api.addType(baseTest);
    api.addType(objectTest);
    const gql_interface = 'interface baseTest {\n  id: ID\n}\n';
    const gql_object = 'type objectTest implements baseTest @test {\n  id2: ID\n  id: ID\n}\n';
    const out = `${gql_interface}${gql_object}`;

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('ObjectType can implement from multiple interface types', () => {
    // WHEN
    const baseTest = new appsync.InterfaceType('baseTest', {
      definition: { id: t.id },
    });
    const anotherTest = new appsync.InterfaceType('anotherTest', {
      definition: { id2: t.id },
    });
    const objectTest = new appsync.ObjectType('objectTest', {
      interfaceTypes: [anotherTest, baseTest],
      definition: {
        id3: t.id,
      },
    });

    api.addType(baseTest);
    api.addType(anotherTest);
    api.addType(objectTest);

    const gql_interface = 'interface baseTest {\n  id: ID\n}\ninterface anotherTest {\n  id2: ID\n}\n';
    const gql_object = 'type objectTest implements anotherTest & baseTest {\n  id3: ID\n  id2: ID\n  id: ID\n}\n';
    const out = `${gql_interface}${gql_object}`;

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('Object Type can be a Graphql Type', () => {
    // WHEN
    const baseTest = new appsync.ObjectType('baseTest', {
      definition: {
        id: t.id,
      },
    });
    const graphqlType = baseTest.attribute();
    const test = new appsync.ObjectType('Test', {
      definition: {
        test: graphqlType,
      },
    });
    api.addType(baseTest);
    api.addType(test);
    const out = 'type baseTest {\n  id: ID\n}\ntype Test {\n  test: baseTest\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('Object Type can implement Resolvable Field in definition', () => {
    // WHEN
    const field = new appsync.ResolvableField({
      returnType: t.string,
      dataSource: api.addNoneDataSource('none'),
      args: {
        arg: t.int,
      },

    });
    const test = new appsync.ObjectType('Test', {
      definition: {
        test: t.string,
        resolve: field,
      },
    });
    api.addType(test);
    const out = 'type Test {\n  test: String\n  resolve(arg: Int): String\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('Object Type can implement Resolvable Field from GraphqlType', () => {
    // WHEN
    const field = new appsync.ResolvableField({
      returnType: t.string,
      dataSource: api.addNoneDataSource('none'),
      args: {
        arg: t.int,
      },

    });
    const test = new appsync.ObjectType('Test', {
      definition: {
        test: t.string,
        resolve: field,
      },
    });
    api.addType(test);
    const out = 'type Test {\n  test: String\n  resolve(arg: Int): String\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('Object Type can implement Resolvable Field for pipelineResolvers', () => {
    // WHEN
    const ds = api.addNoneDataSource('none');
    const test1 = ds.createFunction({
      name: 'test1',
    });
    const test2 = ds.createFunction({
      name: 'test2',
    });
    const test = new appsync.ObjectType('Test', {
      definition: {
        resolve: new appsync.ResolvableField({
          returnType: t.string,
          args: {
            arg: t.int,
          },
          pipelineConfig: [test1, test2],
          requestMappingTemplate: appsync.MappingTemplate.fromString(JSON.stringify({
            version: '2017-02-28',
          })),
          responseMappingTemplate: appsync.MappingTemplate.fromString(JSON.stringify({
            version: 'v1',
          })),
        }),
      },
    });
    api.addType(test);

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::Resolver', {
      Kind: 'PIPELINE',
      PipelineConfig: {
        Functions: [
          { 'Fn::GetAtt': ['apinonetest1FunctionEF63046F', 'FunctionId'] },
          { 'Fn::GetAtt': ['apinonetest2Function615111D0', 'FunctionId'] },
        ],
      },
    });
  });

  test('Object Type can dynamically add Fields', () => {
    // WHEN
    const field = new appsync.ResolvableField({
      returnType: t.string,
      dataSource: api.addNoneDataSource('none'),
      args: { arg: t.int },

    });
    const test = new appsync.ObjectType('Test', {
      definition: {
        test: t.string,
      },
    });
    test.addField({ fieldName: 'resolve', field });
    test.addField({ fieldName: 'dynamic', field: t.string });

    api.addType(test);
    const out = 'type Test {\n  test: String\n  resolve(arg: Int): String\n  dynamic: String\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
    expect(stack).toHaveResource('AWS::AppSync::Resolver');
  });

  test('Object Type can generate Fields with Directives', () => {
    // WHEN
    const test = new appsync.ObjectType('Test', {
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
    const out = 'type Test {\n  test: String\n  resolve: String\n  @aws_api_key\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('Object Type can generate ResolvableFields with Directives', () => {
    // WHEN
    const test = new appsync.ObjectType('Test', {
      definition: {
        test: t.string,
      },
    });
    const field = new appsync.ResolvableField({
      returnType: t.string,
      directives: [appsync.Directive.apiKey()],
      dataSource: api.addNoneDataSource('none'),
      args: {
        arg: t.string,
      },

    });
    test.addField({ fieldName: 'resolve', field });

    api.addType(test);
    const out = 'type Test {\n  test: String\n  resolve(arg: String): String\n  @aws_api_key\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
    expect(stack).toHaveResourceLike('AWS::AppSync::Resolver', {
      TypeName: 'Test',
      FieldName: 'resolve',
    });
  });

  test('appsync fails addField with ObjectType missing fieldName', () => {
    // WHEN
    const test = new appsync.ObjectType('Test', { definition: {} });
    api.addType(test);

    // THEN
    expect(() => {
      test.addField({ fieldName: 'test' });
    }).toThrowError('Object Types must have both fieldName and field options.');
  });

  test('appsync fails addField with ObjectType missing field', () => {
    // WHEN
    const test = new appsync.ObjectType('Test', { definition: {} });
    api.addType(test);

    // THEN
    expect(() => {
      test.addField({ field: t.string });
    }).toThrowError('Object Types must have both fieldName and field options.');
  });

  test('appsync fails addField with ObjectType missing both fieldName and field options', () => {
    // WHEN
    const test = new appsync.ObjectType('Test', { definition: {} });
    api.addType(test);

    // THEN
    expect(() => {
      test.addField({});
    }).toThrowError('Object Types must have both fieldName and field options.');
  });
});
