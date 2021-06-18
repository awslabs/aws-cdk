import { App, Aws, CfnOutput, CfnResource, Fn, IPostProcessor, IResolvable, IResolveContext, Lazy, Stack, Token } from '../lib';
import { Intrinsic } from '../lib/private/intrinsic';
import { evaluateCFN } from './evaluate-cfn';

let app: App;
let stack: Stack;
beforeEach(() => {
  app = new App();
  stack = new Stack(app, 'Stack');
});

test('JSONification of literals looks like JSON.stringify', () => {
  const structure = {
    undefinedProp: undefined,
    nestedObject: {
      prop1: undefined,
      prop2: 'abc',
      prop3: 42,
      prop4: [1, 2, 3],
    },
  };

  expect(stack.resolve(stack.toJsonString(structure))).toEqual(JSON.stringify(structure));
  expect(stack.resolve(stack.toJsonString(structure, 2))).toEqual(JSON.stringify(structure, undefined, 2));
});

test('JSONification of undefined leads to undefined', () => {
  expect(stack.resolve(stack.toJsonString(undefined))).toEqual(undefined);
});

describe('tokens that return literals', () => {
  test('string tokens can be JSONified and JSONification can be reversed', () => {
    for (const token of tokensThatResolveTo('woof woof')) {
      // GIVEN
      const fido = { name: 'Fido', speaks: token };

      // WHEN
      const resolved = stack.resolve(stack.toJsonString(fido));

      // THEN
      expect(evaluateCFN(resolved)).toEqual('{"name":"Fido","speaks":"woof woof"}');
    }
  });

  test('string tokens can be embedded while being JSONified', () => {
    for (const token of tokensThatResolveTo('woof woof')) {
      // GIVEN
      const fido = { name: 'Fido', speaks: `deep ${token}` };

      // WHEN
      const resolved = stack.resolve(stack.toJsonString(fido));

      // THEN
      expect(evaluateCFN(resolved)).toEqual('{"name":"Fido","speaks":"deep woof woof"}');
    }
  });

  test('constant string has correct amount of quotes applied', () => {
    const inputString = 'Hello, "world"';

    // WHEN
    const resolved = stack.resolve(stack.toJsonString(inputString));

    // THEN
    expect(evaluateCFN(resolved)).toEqual(JSON.stringify(inputString));
  });

  test('integer Tokens behave correctly in stringification and JSONification', () => {
    // GIVEN
    const num = new Intrinsic(1);
    const embedded = `the number is ${num}`;

    // WHEN
    expect(evaluateCFN(stack.resolve(embedded))).toEqual('the number is 1');
    expect(evaluateCFN(stack.resolve(stack.toJsonString({ embedded })))).toEqual('{"embedded":"the number is 1"}');
    expect(evaluateCFN(stack.resolve(stack.toJsonString({ num })))).toEqual('{"num":1}');
  });

  test('String-encoded lazies do not have quotes applied if they return objects', () => {
    // This is unfortunately crazy behavior, but we have some clients already taking a
    // dependency on the fact that `Lazy.stringValue({ produce: () => [...some list...] })`
    // does not apply quotes but just renders the list.

    // GIVEN
    const someList = Lazy.stringValue({ produce: () => [1, 2, 3] as any });

    // WHEN
    expect(evaluateCFN(stack.resolve(stack.toJsonString({ someList })))).toEqual('{"someList":[1,2,3]}');
  });

  test('Literal-resolving List Tokens do not have quotes applied', () => {
    // GIVEN
    const someList = Token.asList([1, 2, 3]);

    // WHEN
    expect(evaluateCFN(stack.resolve(stack.toJsonString({ someList })))).toEqual('{"someList":[1,2,3]}');
  });

  test('Intrinsic-resolving List Tokens do not have quotes applied', () => {
    // GIVEN
    const someList = Token.asList(new Intrinsic({ Ref: 'Thing' }));

    // WHEN
    new CfnResource(stack, 'Resource', {
      type: 'AWS::Banana',
      properties: {
        someJson: stack.toJsonString({ someList }),
      },
    });

    const asm = app.synth();
    const template = asm.getStackByName(stack.stackName).template;
    const stringifyLogicalId = Object.keys(template.Resources).filter(id => id.startsWith('CdkJsonStringify'))[0];
    expect(stringifyLogicalId).toBeDefined();

    expect(template.Resources.Resource.Properties.someJson).toEqual({
      'Fn::Join': ['', [
        '{"someList":',
        { 'Fn::GetAtt': [stringifyLogicalId, 'Value'] },
        '}',
      ]],
    });
  });


  test('tokens in strings survive additional TokenJSON.stringification()', () => {
    // GIVEN
    for (const token of tokensThatResolveTo('pong!')) {
      // WHEN
      const stringified = stack.toJsonString(`ping? ${token}`);

      // THEN
      expect(evaluateCFN(stack.resolve(stringified))).toEqual('"ping? pong!"');
    }
  });

  test('Doubly nested strings evaluate correctly in JSON context', () => {
    // WHEN
    const fidoSays = Lazy.stringValue({ produce: () => 'woof' });

    // WHEN
    const resolved = stack.resolve(stack.toJsonString({
      information: `Did you know that Fido says: ${fidoSays}`,
    }));

    // THEN
    expect(evaluateCFN(resolved)).toEqual('{"information":"Did you know that Fido says: woof"}');
  });

  test('Quoted strings in embedded JSON context are escaped', () => {
    // GIVEN
    const fidoSays = Lazy.stringValue({ produce: () => '"woof"' });

    // WHEN
    const resolved = stack.resolve(stack.toJsonString({
      information: `Did you know that Fido says: ${fidoSays}`,
    }));

    // THEN
    expect(evaluateCFN(resolved)).toEqual('{"information":"Did you know that Fido says: \\"woof\\""}');
  });
});

describe('tokens returning CloudFormation intrinsics', () => {
  test('intrinsic Tokens embed correctly in JSONification', () => {
    // GIVEN
    const bucketName = new Intrinsic({ Ref: 'MyBucket' });

    // WHEN
    const resolved = stack.resolve(stack.toJsonString({ theBucket: bucketName }));

    // THEN
    const context = { MyBucket: 'TheName' };
    expect(evaluateCFN(resolved, context)).toEqual('{"theBucket":"TheName"}');
  });

  test('fake intrinsics are serialized to objects', () => {
    const fakeIntrinsics = new Intrinsic({
      a: {
        'Fn::GetArtifactAtt': {
          key: 'val',
        },
      },
      b: {
        'Fn::GetParam': [
          'val1',
          'val2',
        ],
      },
    });

    const stringified = stack.toJsonString(fakeIntrinsics);
    expect(evaluateCFN(stack.resolve(stringified))).toEqual(
      '{"a":{"Fn::GetArtifactAtt":{"key":"val"}},"b":{"Fn::GetParam":["val1","val2"]}}');
  });

  test('embedded string literals in intrinsics are escaped when calling TokenJSON.stringify()', () => {
    // GIVEN
    const token = Fn.join('', ['Hello ', Token.asString({ Ref: 'Planet' }), ', this\nIs', 'Very "cool"']);

    // WHEN
    const resolved = stack.resolve(stack.toJsonString({
      literal: 'I can also "contain" quotes',
      token,
    }));

    // THEN
    const context = { Planet: 'World' };
    const expected = '{"literal":"I can also \\"contain\\" quotes","token":"Hello World, this\\nIsVery \\"cool\\""}';
    expect(evaluateCFN(resolved, context)).toEqual(expected);
  });

  test('embedded string literals are escaped in Fn.sub (implicit references)', () => {
    // GIVEN
    const token = Fn.sub('I am in account "${AWS::AccountId}"');

    // WHEN
    const resolved = stack.resolve(stack.toJsonString({ token }));

    // THEN
    const context = { 'AWS::AccountId': '1234' };
    const expected = '{"token":"I am in account \\"1234\\""}';
    expect(evaluateCFN(resolved, context)).toEqual(expected);
  });

  test('embedded string literals are escaped in Fn.sub (explicit references)', () => {
    // GIVEN
    const token = Fn.sub('I am in account "${Acct}", also wanted to say: ${Also}', {
      Acct: Aws.ACCOUNT_ID,
      Also: '"hello world"',
    });

    // WHEN
    const resolved = stack.resolve(stack.toJsonString({ token }));

    // THEN
    const context = { 'AWS::AccountId': '1234' };
    const expected = '{"token":"I am in account \\"1234\\", also wanted to say: \\"hello world\\""}';
    expect(evaluateCFN(resolved, context)).toEqual(expected);
  });

  test('Tokens in Tokens are handled correctly', () => {
    // GIVEN
    const bucketName = new Intrinsic({ Ref: 'MyBucket' });
    const combinedName = Fn.join('', ['The bucket name is ', bucketName.toString()]);

    // WHEN
    const resolved = stack.resolve(stack.toJsonString({ theBucket: combinedName }));

    // THEN
    const context = { MyBucket: 'TheName' };
    expect(evaluateCFN(resolved, context)).toEqual('{"theBucket":"The bucket name is TheName"}');
  });

  test('Intrinsics in postprocessors are handled correctly', () => {
    // GIVEN
    const bucketName = new Intrinsic({ Ref: 'MyBucket' });
    const combinedName = new DummyPostProcessor(['this', 'is', bucketName]);

    // WHEN
    const resolved = stack.resolve(stack.toJsonString({ theBucket: combinedName }));

    // THEN
    expect(resolved).toEqual({
      'Fn::Join': ['', ['{"theBucket":["this","is","', { Ref: 'MyBucket' }, '"]}']],
    });
  });

  test('Doubly nested strings evaluate correctly in JSON context', () => {
    // WHEN
    const fidoSays = Lazy.string({ produce: () => 'woof' });

    // WHEN
    const resolved = stack.resolve(stack.toJsonString({
      information: `Did you know that Fido says: ${fidoSays}`,
    }));

    // THEN
    expect(evaluateCFN(resolved)).toEqual('{"information":"Did you know that Fido says: woof"}');
  });

  test('Doubly nested intrinsics evaluate correctly in JSON context', () => {
    // GIVEN
    const fidoSays = Lazy.any({ produce: () => ({ Ref: 'Something' }) });

    // WHEN
    const resolved = stack.resolve(stack.toJsonString({
      information: `Did you know that Fido says: ${fidoSays}`,
    }));

    // THEN
    const context = { Something: 'woof woof' };
    expect(evaluateCFN(resolved, context)).toEqual('{"information":"Did you know that Fido says: woof woof"}');
  });

  test('Nested strings are quoted correctly', () => {
    const fidoSays = Lazy.string({ produce: () => '"woof"' });

    // WHEN
    const resolved = stack.resolve(stack.toJsonString({
      information: `Did you know that Fido says: ${fidoSays}`,
    }));

    // THEN
    expect(evaluateCFN(resolved)).toEqual('{"information":"Did you know that Fido says: \\"woof\\""}');
  });

  test('cross-stack references are also properly converted by toJsonString()', () => {
    // GIVEN
    const stack1 = new Stack(app, 'Stack1');
    const stack2 = new Stack(app, 'Stack2');

    // WHEN
    new CfnOutput(stack2, 'Stack1Id', {
      value: stack2.toJsonString({
        Stack1Id: stack1.stackId,
        Stack2Id: stack2.stackId,
      }),
    });

    // THEN
    const asm = app.synth();
    expect(asm.getStackByName('Stack2').template).toEqual({
      Outputs: {
        Stack1Id: {
          Value: {
            'Fn::Join': ['', [
              '{"Stack1Id":"',
              { 'Fn::ImportValue': 'Stack1:ExportsOutputRefAWSStackIdB2DD5BAA' },
              '","Stack2Id":"',
              { Ref: 'AWS::StackId' },
              '"}',
            ]],
          },
        },
      },
    });
  });

  test('Intrinsics can occur in key position', () => {
    // GIVEN
    const bucketName = Token.asString({ Ref: 'MyBucket' });

    // WHEN
    const resolved = stack.resolve(stack.toJsonString({
      [bucketName]: 'Is Cool',
      [`${bucketName} Is`]: 'Cool',
    }));

    // THEN
    const context = { MyBucket: 'Harry' };
    expect(evaluateCFN(resolved, context)).toEqual('{"Harry":"Is Cool","Harry Is":"Cool"}');
  });

  test('toJsonString() can be used recursively', () => {
    // GIVEN
    const bucketName = Token.asString({ Ref: 'MyBucket' });

    // WHEN
    const embeddedJson = stack.toJsonString({ message: `the bucket name is ${bucketName}` });
    const outerJson = stack.toJsonString({ embeddedJson });

    // THEN
    const evaluatedJson = evaluateCFN(stack.resolve(outerJson), {
      MyBucket: 'Bucky',
    });
    expect(evaluatedJson).toEqual('{"embeddedJson":"{\\"message\\":\\"the bucket name is Bucky\\"}"}');
    expect(JSON.parse(JSON.parse(evaluatedJson).embeddedJson).message).toEqual('the bucket name is Bucky');
  });

  test('Every Token used inside a JSONified string is given an opportunity to be uncached', () => {
    // Check that tokens aren't accidentally fully resolved by the first invocation/resolution
    // of toJsonString(). On every evaluation, Tokens referenced inside the structure should be
    // given a chance to be either cached or uncached.
    //
    // (NOTE: This does not check whether the implementation of toJsonString() itself is cached or
    // not; that depends on aws/aws-cdk#11224 and should be done in a different PR).

    // WHEN
    let counter = 0;
    const counterString = Token.asString({ resolve: () => `${++counter}` });
    const jsonString = stack.toJsonString({ counterString });

    // THEN
    expect(stack.resolve(jsonString)).toEqual('{"counterString":"1"}');
    expect(stack.resolve(jsonString)).toEqual('{"counterString":"2"}');
  });
});

test('JSON strings nested inside JSON strings have correct quoting', () => {
  // GIVEN
  const payload = stack.toJsonString({
    message: Fn.sub('I am in account "${AWS::AccountId}"'),
  });

  // WHEN
  const resolved = stack.resolve(stack.toJsonString({ payload }));

  // THEN
  const context = { 'AWS::AccountId': '1234' };
  const expected = '{"payload":"{\\"message\\":\\"I am in account \\\\\\"1234\\\\\\"\\"}"}';
  const evaluated = evaluateCFN(resolved, context);
  expect(evaluated).toEqual(expected);

  // Is this even correct? Let's ask JavaScript because I have trouble reading this many backslashes.
  expect(JSON.parse(JSON.parse(evaluated).payload).message).toEqual('I am in account "1234"');
});


/**
 * Return two Tokens, one of which evaluates to a Token directly, one which evaluates to it lazily
 */
function tokensThatResolveTo(value: any): Token[] {
  return [
    new Intrinsic(value),
    Lazy.any({ produce: () => value }),
  ];
}

class DummyPostProcessor implements IResolvable, IPostProcessor {
  public readonly creationStack: string[];

  constructor(private readonly value: any) {
    this.creationStack = ['test'];
  }

  public resolve(context: IResolveContext) {
    context.registerPostProcessor(this);
    return context.resolve(this.value);
  }

  public postProcess(o: any, _context: IResolveContext): any {
    return o;
  }
}