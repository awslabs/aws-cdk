import '@aws-cdk/assert-internal/jest';
import * as path from 'path';
import { App, CfnOutput, CfnResource, Stack } from '@aws-cdk/core';
import { LAMBDA_RECOGNIZE_VERSION_PROPS } from '@aws-cdk/cx-api';
import * as lambda from '../lib';
import { calculateFunctionHash, trimFromStart } from '../lib/function-hash';

describe('function hash', () => {
  describe('trimFromStart', () => {
    test('trim not needed', () => {
      expect(trimFromStart('foo', 100)).toEqual('foo');
      expect(trimFromStart('foo', 3)).toEqual('foo');
      expect(trimFromStart('', 3)).toEqual('');
    });

    test('trim required', () => {
      expect(trimFromStart('hello', 3)).toEqual('llo');
      expect(trimFromStart('hello', 4)).toEqual('ello');
      expect(trimFromStart('hello', 1)).toEqual('o');
    });
  });

  describe('calcHash', () => {
    test('same configuration and code yields the same hash', () => {
      const stack1 = new Stack();
      const fn1 = new lambda.Function(stack1, 'MyFunction1', {
        runtime: lambda.Runtime.NODEJS_12_X,
        code: lambda.Code.fromAsset(path.join(__dirname, 'handler.zip')),
        handler: 'index.handler',
      });

      const stack2 = new Stack();
      const fn2 = new lambda.Function(stack2, 'MyFunction1', {
        runtime: lambda.Runtime.NODEJS_12_X,
        code: lambda.Code.fromAsset(path.join(__dirname, 'handler.zip')),
        handler: 'index.handler',
      });

      expect(calculateFunctionHash(fn1)).toEqual(calculateFunctionHash(fn2));
      expect(calculateFunctionHash(fn1)).toEqual('aea5463dba236007afe91d2832b3c836');
    });
  });

  test('code impacts hash', () => {
    const stack1 = new Stack();
    const fn1 = new lambda.Function(stack1, 'MyFunction1', {
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.fromAsset(path.join(__dirname, 'my-lambda-handler')),
      handler: 'index.handler',
    });

    expect(calculateFunctionHash(fn1)).not.toEqual('aea5463dba236007afe91d2832b3c836');
    expect(calculateFunctionHash(fn1)).toEqual('979b4a14c6f174c745cdbcd1036cf844');
  });

  test('environment variables impact hash', () => {
    const stack1 = new Stack();
    const fn1 = new lambda.Function(stack1, 'MyFunction', {
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.fromAsset(path.join(__dirname, 'my-lambda-handler')),
      handler: 'index.handler',
      environment: {
        Foo: 'bar',
      },
    });

    const stack2 = new Stack();
    const fn2 = new lambda.Function(stack2, 'MyFunction', {
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.fromAsset(path.join(__dirname, 'my-lambda-handler')),
      handler: 'index.handler',
      environment: {
        Foo: 'beer',
      },
    });

    expect(calculateFunctionHash(fn1)).toEqual('d1bc824ac5022b7d62d8b12dbae6580c');
    expect(calculateFunctionHash(fn2)).toEqual('3b683d05465012b0aa9c4ff53b32f014');
  });

  test('runtime impacts hash', () => {
    const stack1 = new Stack();
    const fn1 = new lambda.Function(stack1, 'MyFunction', {
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.fromAsset(path.join(__dirname, 'my-lambda-handler')),
      handler: 'index.handler',
      environment: {
        Foo: 'bar',
      },
    });

    const stack2 = new Stack();
    const fn2 = new lambda.Function(stack2, 'MyFunction', {
      runtime: lambda.Runtime.NODEJS_10_X,
      code: lambda.Code.fromAsset(path.join(__dirname, 'my-lambda-handler')),
      handler: 'index.handler',
      environment: {
        Foo: 'beer',
      },
    });

    expect(calculateFunctionHash(fn1)).toEqual('d1bc824ac5022b7d62d8b12dbae6580c');
    expect(calculateFunctionHash(fn2)).toEqual('0f168f0772463e8e547bb3800937e54d');
  });

  test('inline code change impacts the hash', () => {
    const stack1 = new Stack();
    const fn1 = new lambda.Function(stack1, 'MyFunction', {
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.fromInline('foo'),
      handler: 'index.handler',
    });

    const stack2 = new Stack();
    const fn2 = new lambda.Function(stack2, 'MyFunction', {
      runtime: lambda.Runtime.NODEJS_10_X,
      code: lambda.Code.fromInline('foo bar'),
      handler: 'index.handler',
    });

    expect(calculateFunctionHash(fn1)).toEqual('ebf2e871fc6a3062e8bdcc5ebe16db3f');
    expect(calculateFunctionHash(fn2)).toEqual('ffedf6424a18a594a513129dc97bf53c');
  });

  describe('impact of env variables order on hash', () => {
    test('without "currentVersion", we preserve old behavior to avoid unnecessary invalidation of templates', () => {
      const stack1 = new Stack();
      const fn1 = new lambda.Function(stack1, 'MyFunction', {
        runtime: lambda.Runtime.NODEJS_12_X,
        code: lambda.Code.fromAsset(path.join(__dirname, 'my-lambda-handler')),
        handler: 'index.handler',
        environment: {
          Foo: 'bar',
          Bar: 'foo',
        },
      });

      const stack2 = new Stack();
      const fn2 = new lambda.Function(stack2, 'MyFunction', {
        runtime: lambda.Runtime.NODEJS_12_X,
        code: lambda.Code.fromAsset(path.join(__dirname, 'my-lambda-handler')),
        handler: 'index.handler',
        environment: {
          Bar: 'foo',
          Foo: 'bar',
        },
      });

      expect(calculateFunctionHash(fn1)).not.toEqual(calculateFunctionHash(fn2));
    });

    test('with "currentVersion", we sort env keys so order is consistent', () => {
      const stack1 = new Stack();
      const fn1 = new lambda.Function(stack1, 'MyFunction', {
        runtime: lambda.Runtime.NODEJS_12_X,
        code: lambda.Code.fromAsset(path.join(__dirname, 'my-lambda-handler')),
        handler: 'index.handler',
        environment: {
          Foo: 'bar',
          Bar: 'foo',
        },
      });

      new CfnOutput(stack1, 'VersionArn', { value: fn1.currentVersion.functionArn });

      const stack2 = new Stack();
      const fn2 = new lambda.Function(stack2, 'MyFunction', {
        runtime: lambda.Runtime.NODEJS_12_X,
        code: lambda.Code.fromAsset(path.join(__dirname, 'my-lambda-handler')),
        handler: 'index.handler',
        environment: {
          Bar: 'foo',
          Foo: 'bar',
        },
      });

      new CfnOutput(stack2, 'VersionArn', { value: fn2.currentVersion.functionArn });

      expect(calculateFunctionHash(fn1)).toEqual(calculateFunctionHash(fn2));
    });
  });

  describe('corrected function hash', () => {
    let app: App;
    beforeEach(() => {
      app = new App({ context: { [LAMBDA_RECOGNIZE_VERSION_PROPS]: true } });
    });

    test('DependsOn does not impact function hash', () => {
      const stack1 = new Stack(app, 'Stack1');
      const fn1 = new lambda.Function(stack1, 'MyFunction1', {
        runtime: lambda.Runtime.NODEJS_12_X,
        code: lambda.Code.fromAsset(path.join(__dirname, 'handler.zip')),
        handler: 'index.handler',
      });

      const stack2 = new Stack(app, 'Stack2');
      const fn2 = new lambda.Function(stack2, 'MyFunction1', {
        runtime: lambda.Runtime.NODEJS_12_X,
        code: lambda.Code.fromAsset(path.join(__dirname, 'handler.zip')),
        handler: 'index.handler',
      });
      const res = new CfnResource(stack2, 'MyResource', {
        type: 'AWS::Foo::Bar',
        properties: {
          Name: 'Value',
        },
      });
      fn2.node.addDependency(res);

      expect(calculateFunctionHash(fn1)).toEqual('e5235e3cb7a9b70c42c1a665a3ebd77c');
      expect(calculateFunctionHash(fn1)).toEqual(calculateFunctionHash(fn2));
    });

    test('properties not locked to the version do not impact function hash', () => {
      const stack1 = new Stack(app, 'Stack1');
      const fn1 = new lambda.Function(stack1, 'MyFunction', {
        runtime: lambda.Runtime.NODEJS_12_X,
        code: lambda.Code.fromAsset(path.join(__dirname, 'handler.zip')),
        handler: 'index.handler',
      });

      const stack2 = new Stack(app, 'Stack2');
      const fn2 = new lambda.Function(stack2, 'MyFunction', {
        runtime: lambda.Runtime.NODEJS_12_X,
        code: lambda.Code.fromAsset(path.join(__dirname, 'handler.zip')),
        handler: 'index.handler',

        reservedConcurrentExecutions: 5, // property not locked to the version
      });

      // expect(calculateFunctionHash(fn1)).toEqual('b0d8729d597bdde2d79312fbf619c974');
      expect(calculateFunctionHash(fn1)).toEqual(calculateFunctionHash(fn2));
    });

    test('unclassified property throws an error', () => {
      const stack = new Stack(app);
      const fn1 = new lambda.Function(stack, 'MyFunction1', {
        runtime: lambda.Runtime.NODEJS_12_X,
        code: lambda.Code.fromAsset(path.join(__dirname, 'handler.zip')),
        handler: 'index.handler',
      });
      (fn1.node.defaultChild as CfnResource).addPropertyOverride('UnclassifiedProp', 'Value');

      expect(() => calculateFunctionHash(fn1)).toThrow(/properties are not recognized/);
    });

    test('manual classification as version locked', () => {
      const stack = new Stack(app);
      const fn1 = new lambda.Function(stack, 'MyFunction1', {
        runtime: lambda.Runtime.NODEJS_12_X,
        code: lambda.Code.fromAsset(path.join(__dirname, 'handler.zip')),
        handler: 'index.handler',
      });

      const original = calculateFunctionHash(fn1);
      lambda.Function.classifyVersionProperty('UnclassifiedProp', true);
      (fn1.node.defaultChild as CfnResource).addPropertyOverride('UnclassifiedProp', 'Value');
      expect(calculateFunctionHash(fn1)).not.toEqual(original);
    });

    test('manual classification as not version locked', () => {
      const stack = new Stack(app);
      const fn1 = new lambda.Function(stack, 'MyFunction1', {
        runtime: lambda.Runtime.NODEJS_12_X,
        code: lambda.Code.fromAsset(path.join(__dirname, 'handler.zip')),
        handler: 'index.handler',
      });

      const original = calculateFunctionHash(fn1);
      lambda.Function.classifyVersionProperty('UnclassifiedProp', false);
      (fn1.node.defaultChild as CfnResource).addPropertyOverride('UnclassifiedProp', 'Value');
      expect(calculateFunctionHash(fn1)).toEqual(original);
    });
  });
});
