import { join } from 'path';
import '@aws-cdk/assert/jest';
import * as cdk from '@aws-cdk/core';
import * as appsync from '../lib';
import * as t from './schema-type-defintions';

// Schema Definitions
const type = 'type test {\n  version: String!\n}\n\n';
const query = 'type Query {\n  getTests: [ test! ]!\n}\n\n';
const mutation = 'type Mutation {\n  addTest(version: String!): test\n}\n';

let stack: cdk.Stack;
beforeEach(() => {
  // GIVEN
  stack = new cdk.Stack();
});

describe('basic testing schema definition mode `code`', () => {

  test('definition mode `code` produces empty schema definition', () => {
    // WHEN
    new appsync.GraphQLApi(stack, 'API', {
      name: 'demo',
      schemaDefinition: appsync.SchemaDefinition.CODE,
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: '',
    });
  });

  test('definition mode `code` generates correct schema with appendToSchema', () => {
    // WHEN
    const api = new appsync.GraphQLApi(stack, 'API', {
      name: 'demo',
      schemaDefinition: appsync.SchemaDefinition.CODE,
    });
    api.appendToSchema(type);
    api.appendToSchema(query);
    api.appendToSchema(mutation);

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: `${type}\n${query}\n${mutation}\n`,
    });
  });

  test('definition mode `code` errors when schemaDefinitionFile is configured', () => {
    // WHEN
    const when = () => {
      new appsync.GraphQLApi(stack, 'API', {
        name: 'demo',
        schemaDefinition: appsync.SchemaDefinition.CODE,
        schemaDefinitionFile: join(__dirname, 'appsync.test.graphql'),
      });
    };

    // THEN
    expect(when).toThrowError('definition mode CODE is incompatible with file definition. Change mode to FILE/S3 or unconfigure schemaDefinitionFile');
  });

});

describe('testing addType for schema definition mode `code`', () => {
  let api: appsync.GraphQLApi;
  beforeEach(() => {
    // GIVEN
    api = new appsync.GraphQLApi(stack, 'api', {
      name: 'api',
      schemaDefinition: appsync.SchemaDefinition.CODE,
    });
  });

  test('addType', () => {
    // WHEN
    api.addType('Test', {
      definition: {
        id: t.id,
        lid: t.list_id,
        rid: t.required_id,
        rlid: t.required_list_id,
        rlrid: t.required_list_required_id,
        dupid: t.dup_id,
      },
    });

    const out = 'type Test {\n  id: ID\n  lid: [ID]\n  rid: ID!\n  rlid: [ID]!\n  rlrid: [ID!]!\n  dupid: [ID!]!\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: `${out}`,
    });
  });

});

describe('testing schema definition mode `file`', () => {

  test('definition mode `file` produces correct output', () => {
    // WHEN
    new appsync.GraphQLApi(stack, 'API', {
      name: 'demo',
      schemaDefinition: appsync.SchemaDefinition.FILE,
      schemaDefinitionFile: join(__dirname, 'appsync.test.graphql'),
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: `${type}${query}${mutation}`,
    });
  });

  test('definition mode `file` errors when schemaDefinitionFile is not configured', () => {
    // WHEN
    const when = () => {
      new appsync.GraphQLApi(stack, 'API', {
        name: 'demo',
        schemaDefinition: appsync.SchemaDefinition.FILE,
      });
    };

    // THEN
    expect(when).toThrowError('schemaDefinitionFile must be configured if using FILE definition mode.');
  });

  test('definition mode `file` errors when addType is called', () => {
    // WHEN
    const api = new appsync.GraphQLApi(stack, 'API', {
      name: 'demo',
      schemaDefinition: appsync.SchemaDefinition.FILE,
      schemaDefinitionFile: join(__dirname, 'appsync.test.graphql'),
    });

    const when = () => {
      api.addType('blah', {
        definition: { fail: t.id },
      });
    };

    // THEN
    expect(when).toThrowError('API cannot add type because schema definition mode is not configured as CODE.');
  });

  test('definition mode `file` errors when appendToSchema is called', () => {
    // WHEN
    const api = new appsync.GraphQLApi(stack, 'API', {
      name: 'demo',
      schemaDefinition: appsync.SchemaDefinition.FILE,
      schemaDefinitionFile: join(__dirname, 'appsync.test.graphql'),
    });

    const when = () => {
      api.appendToSchema('blah');
    };

    // THEN
    expect(when).toThrowError('API cannot append to schema because schema definition mode is not configured as CODE.');
  });

});