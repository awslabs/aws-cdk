import '@aws-cdk/assert-internal/jest';
import * as cdk from '@aws-cdk/core';
import * as appsync from '../lib';
import * as t from './scalar-type-defintions';

let stack: cdk.Stack;
beforeEach(() => {
  // GIVEN
  stack = new cdk.Stack();
});

describe('code-first implementation through GraphQL Api functions`', () => {
  let api: appsync.GraphqlApi;
  beforeEach(() => {
    // GIVEN
    api = new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
    });
  });

  test('testing addType w/ Interface Type for schema definition mode `code`', () => {
    // WHEN
    const test = new appsync.InterfaceType('Test', {
      definition: {
        id: t.id,
        lid: t.list_id,
        rid: t.required_id,
        rlid: t.required_list_id,
        rlrid: t.required_list_required_id,
      },
    });
    api.addType(test);
    test.addField({ fieldName: 'dupid', field: t.dup_id });
    const out = 'interface Test {\n  id: ID\n  lid: [ID]\n  rid: ID!\n  rlid: [ID]!\n  rlrid: [ID!]!\n  dupid: [ID!]!\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: `${out}`,
    });
  });

  test('testing addType w/ Object Type for schema definition mode `code`', () => {
    // WHEN
    const test = new appsync.ObjectType('Test', {
      definition: {
        id: t.id,
        lid: t.list_id,
        rid: t.required_id,
        rlid: t.required_list_id,
        rlrid: t.required_list_required_id,
      },
    });
    api.addType(test);
    test.addField({ fieldName: 'dupid', field: t.dup_id });
    const out = 'type Test {\n  id: ID\n  lid: [ID]\n  rid: ID!\n  rlid: [ID]!\n  rlrid: [ID!]!\n  dupid: [ID!]!\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: `${out}`,
    });
  });

  test('testing addObjectType for schema definition mode `code`', () => {
    // WHEN
    api.addType(new appsync.ObjectType('Test', {
      definition: {
        id: t.id,
        lid: t.list_id,
        rid: t.required_id,
        rlid: t.required_list_id,
        rlrid: t.required_list_required_id,
        dupid: t.dup_id,
      },
    }));
    const out = 'type Test {\n  id: ID\n  lid: [ID]\n  rid: ID!\n  rlid: [ID]!\n  rlrid: [ID!]!\n  dupid: [ID!]!\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: `${out}`,
    });
  });

  test('addField dynamically adds field to schema for ObjectType', () => {
    // WHEN
    const test = api.addType(new appsync.ObjectType('Test', {
      definition: {
        id: t.id,
        lid: t.list_id,
        rid: t.required_id,
        rlid: t.required_list_id,
        rlrid: t.required_list_required_id,
      },
    }));

    test.addField({ fieldName: 'dupid', field: t.dup_id });
    const out = 'type Test {\n  id: ID\n  lid: [ID]\n  rid: ID!\n  rlid: [ID]!\n  rlrid: [ID!]!\n  dupid: [ID!]!\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: `${out}`,
    });
  });

  test('testing addInterfaceType for schema definition mode `code`', () => {
    // WHEN
    api.addType(new appsync.InterfaceType('Test', {
      definition: {
        id: t.id,
        lid: t.list_id,
        rid: t.required_id,
        rlid: t.required_list_id,
        rlrid: t.required_list_required_id,
        dupid: t.dup_id,
      },
    }));
    const out = 'interface Test {\n  id: ID\n  lid: [ID]\n  rid: ID!\n  rlid: [ID]!\n  rlrid: [ID!]!\n  dupid: [ID!]!\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: `${out}`,
    });
  });

  test('addField dynamically adds field to schema for InterfaceType', () => {
    // WHEN
    const test = api.addType(new appsync.InterfaceType('Test', {
      definition: {
        id: t.id,
        lid: t.list_id,
        rid: t.required_id,
        rlid: t.required_list_id,
        rlrid: t.required_list_required_id,
      },
    }));

    test.addField({ fieldName: 'dupid', field: t.dup_id });
    const out = 'interface Test {\n  id: ID\n  lid: [ID]\n  rid: ID!\n  rlid: [ID]!\n  rlrid: [ID!]!\n  dupid: [ID!]!\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: `${out}`,
    });
  });
});

describe('code-first implementation through Schema functions`', () => {
  let schema: appsync.Schema;
  beforeEach(() => {
    // GIVEN
    schema = appsync.Schema.fromCode();
  });

  test('testing addType w/ Interface Type for schema definition mode `code`', () => {
    // WHEN
    const test = new appsync.InterfaceType('Test', {
      definition: {
        id: t.id,
        lid: t.list_id,
        rid: t.required_id,
        rlid: t.required_list_id,
        rlrid: t.required_list_required_id,
      },
    });
    schema.addType(test);
    test.addField({ fieldName: 'dupid', field: t.dup_id });

    new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
      schema,
    });
    const out = 'interface Test {\n  id: ID\n  lid: [ID]\n  rid: ID!\n  rlid: [ID]!\n  rlrid: [ID!]!\n  dupid: [ID!]!\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: `${out}`,
    });
  });

  test('testing addType w/ Object Type for schema definition mode `code`', () => {
    // WHEN
    const test = new appsync.ObjectType('Test', {
      definition: {
        id: t.id,
        lid: t.list_id,
        rid: t.required_id,
        rlid: t.required_list_id,
        rlrid: t.required_list_required_id,
      },
    });
    schema.addType(test);
    test.addField({ fieldName: 'dupid', field: t.dup_id });

    new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
      schema,
    });
    const out = 'type Test {\n  id: ID\n  lid: [ID]\n  rid: ID!\n  rlid: [ID]!\n  rlrid: [ID!]!\n  dupid: [ID!]!\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: `${out}`,
    });
  });

  test('testing addObjectType for schema definition mode `code`', () => {
    // WHEN
    schema.addType(new appsync.ObjectType('Test', {
      definition: {
        id: t.id,
        lid: t.list_id,
        rid: t.required_id,
        rlid: t.required_list_id,
        rlrid: t.required_list_required_id,
        dupid: t.dup_id,
      },
    }));

    new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
      schema,
    });

    const out = 'type Test {\n  id: ID\n  lid: [ID]\n  rid: ID!\n  rlid: [ID]!\n  rlrid: [ID!]!\n  dupid: [ID!]!\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: `${out}`,
    });
  });

  test('schema.addField dynamically adds field to schema for ObjectType', () => {
    // WHEN
    const test = schema.addType(new appsync.ObjectType('Test', {
      definition: {
        id: t.id,
        lid: t.list_id,
        rid: t.required_id,
        rlid: t.required_list_id,
        rlrid: t.required_list_required_id,
      },
    }));

    test.addField({ fieldName: 'dupid', field: t.dup_id });
    new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
      schema,
    });
    const out = 'type Test {\n  id: ID\n  lid: [ID]\n  rid: ID!\n  rlid: [ID]!\n  rlrid: [ID!]!\n  dupid: [ID!]!\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: `${out}`,
    });
  });

  test('testing addInterfaceType for schema definition mode `code`', () => {
    // WHEN
    schema.addType(new appsync.InterfaceType('Test', {
      definition: {
        id: t.id,
        lid: t.list_id,
        rid: t.required_id,
        rlid: t.required_list_id,
        rlrid: t.required_list_required_id,
        dupid: t.dup_id,
      },
    }));
    new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
      schema,
    });
    const out = 'interface Test {\n  id: ID\n  lid: [ID]\n  rid: ID!\n  rlid: [ID]!\n  rlrid: [ID!]!\n  dupid: [ID!]!\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: `${out}`,
    });
  });

  test('schema addField dynamically adds field to schema for InterfaceType', () => {
    // WHEN
    const test = schema.addType(new appsync.InterfaceType('Test', {
      definition: {
        id: t.id,
        lid: t.list_id,
        rid: t.required_id,
        rlid: t.required_list_id,
        rlrid: t.required_list_required_id,
      },
    }));

    test.addField({ fieldName: 'dupid', field: t.dup_id });
    new appsync.GraphqlApi(stack, 'api', {
      name: 'api',
      schema,
    });
    const out = 'interface Test {\n  id: ID\n  lid: [ID]\n  rid: ID!\n  rlid: [ID]!\n  rlrid: [ID!]!\n  dupid: [ID!]!\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: `${out}`,
    });
  });
});
