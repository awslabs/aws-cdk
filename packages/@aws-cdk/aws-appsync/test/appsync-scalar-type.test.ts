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

describe('testing all GraphQL Types', () => {
  test('scalar type id', () => {
    // WHEN
    api.addType(new appsync.ObjectType('Test', {
      definition: {
        id: t.id,
      },
    }));
    const out = 'type Test {\n  id: ID\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('scalar type string', () => {
    // WHEN
    api.addType(new appsync.ObjectType('Test', {
      definition: {
        id: t.string,
      },
    }));
    const out = 'type Test {\n  id: String\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('scalar type int', () => {
    // WHEN
    api.addType(new appsync.ObjectType('Test', {
      definition: {
        id: t.int,
      },
    }));
    const out = 'type Test {\n  id: Int\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('scalar type float', () => {
    // WHEN
    api.addType(new appsync.ObjectType('Test', {
      definition: {
        id: t.float,
      },
    }));
    const out = 'type Test {\n  id: Float\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('scalar type boolean', () => {
    // WHEN
    api.addType(new appsync.ObjectType('Test', {
      definition: {
        id: t.boolean,
      },
    }));
    const out = 'type Test {\n  id: Boolean\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('scalar type AWSDate', () => {
    // WHEN
    api.addType(new appsync.ObjectType('Test', {
      definition: {
        id: t.awsDate,
      },
    }));
    const out = 'type Test {\n  id: AWSDate\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('scalar type AWSTime', () => {
    // WHEN
    api.addType(new appsync.ObjectType('Test', {
      definition: {
        id: t.awsTime,
      },
    }));
    const out = 'type Test {\n  id: AWSTime\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('scalar type AWSDateTime', () => {
    // WHEN
    api.addType(new appsync.ObjectType('Test', {
      definition: {
        id: t.awsDateTime,
      },
    }));
    const out = 'type Test {\n  id: AWSDateTime\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('scalar type AWSTimestamp', () => {
    // WHEN
    api.addType(new appsync.ObjectType('Test', {
      definition: {
        id: t.awsTimestamp,
      },
    }));
    const out = 'type Test {\n  id: AWSTimestamp\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('scalar type AWSEmail', () => {
    // WHEN
    api.addType(new appsync.ObjectType('Test', {
      definition: {
        id: t.awsEmail,
      },
    }));
    const out = 'type Test {\n  id: AWSEmail\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('scalar type AWSJSON', () => {
    // WHEN
    api.addType(new appsync.ObjectType('Test', {
      definition: {
        id: t.awsJson,
      },
    }));
    const out = 'type Test {\n  id: AWSJSON\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });


  test('scalar type AWSUrl', () => {
    // WHEN
    api.addType(new appsync.ObjectType('Test', {
      definition: {
        id: t.awsUrl,
      },
    }));
    const out = 'type Test {\n  id: AWSURL\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('scalar type AWSPhone', () => {
    // WHEN
    api.addType(new appsync.ObjectType('Test', {
      definition: {
        id: t.awsPhone,
      },
    }));
    const out = 'type Test {\n  id: AWSPhone\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });

  test('scalar type AWSIPAddress', () => {
    // WHEN
    api.addType( new appsync.ObjectType('Test', {
      definition: {
        id: t.awsIpAddress,
      },
    }));
    const out = 'type Test {\n  id: AWSIPAddress\n}\n';

    // THEN
    expect(stack).toHaveResourceLike('AWS::AppSync::GraphQLSchema', {
      Definition: api.expectedSchema(out),
    });
  });
});