import { join } from 'path';
import '@aws-cdk/assert-internal/jest';
import * as s3 from '@aws-cdk/aws-s3';
import * as s3deploy from '@aws-cdk/aws-s3-deployment';
import * as cdk from '@aws-cdk/core';
import * as appsync from '../lib';
import * as t from './scalar-type-defintions';

// Schema Definitions
const type = new appsync.ObjectType('test', {
  definition: {
    version: t.required_string,
  },
});
const query = new appsync.ObjectType('Query', {
  definition: {
    getTests: new appsync.ResolvableField({
      returnType: type.attribute({ isRequiredList: true, isList: true }),
    }),
  },
});
const mutation = new appsync.ObjectType('Mutation', {
  definition: {
    addTest: new appsync.ResolvableField({
      returnType: type.attribute(),
      args: { version: t.required_string },
    }),
  },
});

let stack: cdk.Stack;
beforeEach(() => {
  // GIVEN
  stack = new cdk.Stack();
});

describe('basic testing schema definition mode `code`', () => {

  test('produces empty schema definition', () => {
    // WHEN
    new appsync.GraphqlApi(stack, 'API', {
      name: 'demo',
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: '',
    });
  });

  test('generates correct schema with addToSchema', () => {
    // WHEN
    const api = new appsync.GraphqlApi(stack, 'API', {
      name: 'demo',
    });
    api.addType(type);
    api.addType(query);
    api.addType(mutation);

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: `${type.toString()}\n${query.toString()}\n${mutation.toString()}\n`,
    });
  });

  test('allows for api to addQuery', () => {
    // WHEN
    const api = new appsync.GraphqlApi(stack, 'API', {
      name: 'demo',
    });
    api.addQuery('test', new appsync.ResolvableField({
      returnType: t.string,
    }));

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: 'schema {\n  query: Query\n}\ntype Query {\n  test: String\n}\n',
    });
  });

  test('allows for schema to addQuery', () => {
    // WHEN
    const schema = appsync.Schema.fromCode();
    new appsync.GraphqlApi(stack, 'API', {
      name: 'demo',
      schema,
    });
    schema.addQuery('test', new appsync.ResolvableField({
      returnType: t.string,
    }));

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: 'schema {\n  query: Query\n}\ntype Query {\n  test: String\n}\n',
    });
  });

  test('allows for api to addMutation', () => {
    // WHEN
    const api = new appsync.GraphqlApi(stack, 'API', {
      name: 'demo',
    });
    api.addMutation('test', new appsync.ResolvableField({
      returnType: t.string,
    }));

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: 'schema {\n  mutation: Mutation\n}\ntype Mutation {\n  test: String\n}\n',
    });
  });

  test('allows for schema to addMutation', () => {
    // WHEN
    const schema = appsync.Schema.fromCode();
    new appsync.GraphqlApi(stack, 'API', {
      name: 'demo',
      schema,
    });
    schema.addMutation('test', new appsync.ResolvableField({
      returnType: t.string,
    }));

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: 'schema {\n  mutation: Mutation\n}\ntype Mutation {\n  test: String\n}\n',
    });
  });

  test('allows for api to addSubscription', () => {
    // WHEN
    const api = new appsync.GraphqlApi(stack, 'API', {
      name: 'demo',
    });
    api.addSubscription('test', new appsync.ResolvableField({
      returnType: t.string,
    }));

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: 'schema {\n  subscription: Subscription\n}\ntype Subscription {\n  test: String\n}\n',
    });
  });

  test('allows for schema to addSubscription', () => {
    // WHEN
    const schema = appsync.Schema.fromCode();
    new appsync.GraphqlApi(stack, 'API', {
      name: 'demo',
      schema,
    });
    schema.addSubscription('test', new appsync.ResolvableField({
      returnType: t.string,
    }));

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: 'schema {\n  subscription: Subscription\n}\ntype Subscription {\n  test: String\n}\n',
    });
  });

  test('addSubscription w/ @aws_subscribe succeeds', () => {
    // WHEN
    const api = new appsync.GraphqlApi(stack, 'API', {
      name: 'demo',
    });
    api.addSubscription('test', new appsync.ResolvableField({
      returnType: t.string,
      directives: [appsync.Directive.subscribe('test1')],
    }));

    const out = 'schema {\n  subscription: Subscription\n}\ntype Subscription {\n  test: String\n  @aws_subscribe(mutations: ["test1"])\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: out,
    });
  });
});

describe('schema definition mode `file`', () => {

  let api: appsync.GraphqlApi;
  beforeEach(() => {
    // WHEN
    api = new appsync.GraphqlApi(stack, 'API', {
      name: 'demo',
      schema: appsync.Schema.fromAsset(join(__dirname, 'schemas/appsync.test.graphql')),
    });
  });

  test('produces correct output', () => {
    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: `${type.toString()}\n${query.toString()}\n${mutation.toString()}\n`,
    });
  });

  test('errors when addType for object is called', () => {
    // THEN
    expect(() => {
      api.addType(new appsync.ObjectType('blah', {
        definition: { fail: t.id },
      }));
    }).toThrowError('API cannot add type because schema definition mode is not configured as CODE.');
  });

  test('errors when addType for interface is called', () => {
    // THEN
    expect(() => {
      api.addType(new appsync.InterfaceType('blah', {
        definition: { fail: t.id },
      }));
    }).toThrowError('API cannot add type because schema definition mode is not configured as CODE.');
  });

  test('errors when addToSchema is called', () => {
    // THEN
    expect(() => {
      api.addToSchema('blah');
    }).toThrowError('API cannot append to schema because schema definition mode is not configured as CODE.');
  });

  test('errors when addQuery is called', () => {
    // THEN
    expect(() => {
      api.addQuery('blah', new appsync.ResolvableField({ returnType: t.string }));
    }).toThrowError('Unable to add query. Schema definition mode must be CODE. Received: FILE');
  });

  test('errors when addMutation is called', () => {
    // THEN
    expect(() => {
      api.addMutation('blah', new appsync.ResolvableField({ returnType: t.string }));
    }).toThrowError('Unable to add mutation. Schema definition mode must be CODE. Received: FILE');
  });

  test('errors when addSubscription is called', () => {
    // THEN
    expect(() => {
      api.addSubscription('blah', new appsync.ResolvableField({ returnType: t.string }));
    }).toThrowError('Unable to add subscription. Schema definition mode must be CODE. Received: FILE');
  });
});

describe('schema definition mode `s3`', () => {

  test('produces correct output', () => {
    // GIVEN
    const bucket = new s3.Bucket(stack, 'Bucket');

    new s3deploy.BucketDeployment(stack, 'DeployFiles', {
      sources: [s3deploy.Source.asset(join(__dirname, 'schemas'))],
      destinationBucket: bucket,
    });

    // WHEN
    new appsync.GraphqlApi(stack, 'API', {
      name: 'demo',
      schema: appsync.Schema.fromBucket(bucket, 'appsync.test.graphql'),
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      DefinitionS3Location: {
        'Fn::Join': ['',
          [
            's3://',
            { Ref: 'Bucket83908E77' },
            '/appsync.test.graphql',
          ]],
      },
    });
  });

  describe('definition mode s3 fails', () => {

    let api: appsync.GraphqlApi;
    beforeEach(() => {
      // GIVEN
      const bucket = new s3.Bucket(stack, 'Bucket');
      api = new appsync.GraphqlApi(stack, 'API', {
        name: 'demo',
        schema: appsync.Schema.fromBucket(bucket, 'garbage'),
      });
    });

    test('when addType for an intermediate type is called', () => {
      // THEN
      expect(() => {
        api.addType(new appsync.ObjectType('blah', {
          definition: { fail: t.id },
        }));
      }).toThrowError('API cannot add type because schema definition mode is not configured as CODE.');
    });

    test('when addToSchema is called', () => {
      // THEN
      expect(() => {
        api.addToSchema('blah');
      }).toThrowError('API cannot append to schema because schema definition mode is not configured as CODE.');
    });

    test('when addQuery is called', () => {
      // THEN
      expect(() => {
        api.addQuery('blah', new appsync.ResolvableField({ returnType: t.string }));
      }).toThrowError('Unable to add query. Schema definition mode must be CODE. Received: S3');
    });

    test('when addMutation is called', () => {
      // THEN
      expect(() => {
        api.addMutation('blah', new appsync.ResolvableField({ returnType: t.string }));
      }).toThrowError('Unable to add mutation. Schema definition mode must be CODE. Received: S3');
    });
  });
});