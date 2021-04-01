import '@aws-cdk/assert/jest';
import * as cdk from '@aws-cdk/core';
import { Code, EventSourceMapping, Function, Runtime } from '../lib';

describe('event source mapping', () => {
  test('throws if maxBatchingWindow > 300 seconds', () => {
    const stack = new cdk.Stack();
    const fn = new Function(stack, 'fn', {
      handler: 'index.handler',
      code: Code.fromInline('exports.handler = ${handler.toString()}'),
      runtime: Runtime.NODEJS_10_X,
    });

    expect(() => new EventSourceMapping(stack, 'test', {
      target: fn,
      eventSourceArn: '',
      maxBatchingWindow: cdk.Duration.seconds(301),
    })).toThrow(/maxBatchingWindow cannot be over 300 seconds/);
  });

  test('throws if maxRecordAge is below 60 seconds', () => {
    const stack = new cdk.Stack();
    const fn = new Function(stack, 'fn', {
      handler: 'index.handler',
      code: Code.fromInline('exports.handler = ${handler.toString()}'),
      runtime: Runtime.NODEJS_10_X,
    });

    expect(() => new EventSourceMapping(stack, 'test', {
      target: fn,
      eventSourceArn: '',
      maxRecordAge: cdk.Duration.seconds(59),
    })).toThrow(/maxRecordAge must be between 60 seconds and 7 days inclusive/);
  });

  test('throws if maxRecordAge is over 7 days', () => {
    const stack = new cdk.Stack();
    const fn = new Function(stack, 'fn', {
      handler: 'index.handler',
      code: Code.fromInline('exports.handler = ${handler.toString()}'),
      runtime: Runtime.NODEJS_10_X,
    });

    expect(() => new EventSourceMapping(stack, 'test', {
      target: fn,
      eventSourceArn: '',
      maxRecordAge: cdk.Duration.seconds(604801),
    })).toThrow(/maxRecordAge must be between 60 seconds and 7 days inclusive/);
  });

  test('throws if retryAttempts is negative', () => {
    const stack = new cdk.Stack();
    const fn = new Function(stack, 'fn', {
      handler: 'index.handler',
      code: Code.fromInline('exports.handler = ${handler.toString()}'),
      runtime: Runtime.NODEJS_10_X,
    });

    expect(() => new EventSourceMapping(stack, 'test', {
      target: fn,
      eventSourceArn: '',
      retryAttempts: -1,
    })).toThrow(/retryAttempts must be between 0 and 10000 inclusive, got -1/);
  });

  test('throws if retryAttempts is over 10000', () => {
    const stack = new cdk.Stack();
    const fn = new Function(stack, 'fn', {
      handler: 'index.handler',
      code: Code.fromInline('exports.handler = ${handler.toString()}'),
      runtime: Runtime.NODEJS_10_X,
    });

    expect(() => new EventSourceMapping(stack, 'test', {
      target: fn,
      eventSourceArn: '',
      retryAttempts: 10001,
    })).toThrow(/retryAttempts must be between 0 and 10000 inclusive, got 10001/);
  });

  test('accepts if retryAttempts is a token', () => {
    const stack = new cdk.Stack();
    const fn = new Function(stack, 'fn', {
      handler: 'index.handler',
      code: Code.fromInline('exports.handler = ${handler.toString()}'),
      runtime: Runtime.NODEJS_10_X,
    });

    new EventSourceMapping(stack, 'test', {
      target: fn,
      eventSourceArn: '',
      retryAttempts: cdk.Lazy.number({ produce: () => 100 }),
    });
  });

  test('throws if parallelizationFactor is below 1', () => {
    const stack = new cdk.Stack();
    const fn = new Function(stack, 'fn', {
      handler: 'index.handler',
      code: Code.fromInline('exports.handler = ${handler.toString()}'),
      runtime: Runtime.NODEJS_10_X,
    });

    expect(() => new EventSourceMapping(stack, 'test', {
      target: fn,
      eventSourceArn: '',
      parallelizationFactor: 0,
    })).toThrow(/parallelizationFactor must be between 1 and 10 inclusive, got 0/);
  });

  test('throws if parallelizationFactor is over 10', () => {
    const stack = new cdk.Stack();
    const fn = new Function(stack, 'fn', {
      handler: 'index.handler',
      code: Code.fromInline('exports.handler = ${handler.toString()}'),
      runtime: Runtime.NODEJS_10_X,
    });

    expect(() => new EventSourceMapping(stack, 'test', {
      target: fn,
      eventSourceArn: '',
      parallelizationFactor: 11,
    })).toThrow(/parallelizationFactor must be between 1 and 10 inclusive, got 11/);
  });

  test('accepts if parallelizationFactor is a token', () => {
    const stack = new cdk.Stack();
    const fn = new Function(stack, 'fn', {
      handler: 'index.handler',
      code: Code.fromInline('exports.handler = ${handler.toString()}'),
      runtime: Runtime.NODEJS_10_X,
    });

    new EventSourceMapping(stack, 'test', {
      target: fn,
      eventSourceArn: '',
      parallelizationFactor: cdk.Lazy.number({ produce: () => 20 }),
    });
  });

  test('import event source mapping', () => {
    const stack = new cdk.Stack(undefined, undefined, { stackName: 'test-stack' });
    const imported = EventSourceMapping.fromEventSourceMappingId(stack, 'imported', '14e0db71-5d35-4eb5-b481-8945cf9d10c2');

    expect(imported.eventSourceMappingId).toEqual('14e0db71-5d35-4eb5-b481-8945cf9d10c2');
    expect(imported.stack.stackName).toEqual('test-stack');
  });

  test('accepts if kafkaTopic is a parameter', () => {
    const stack = new cdk.Stack();
    const topicNameParam = new cdk.CfnParameter(stack, 'TopicNameParam', {
      type: 'String',
    });

    const fn = new Function(stack, 'fn', {
      handler: 'index.handler',
      code: Code.fromInline('exports.handler = ${handler.toString()}'),
      runtime: Runtime.NODEJS_10_X,
    });

    new EventSourceMapping(stack, 'test', {
      target: fn,
      eventSourceArn: '',
      kafkaTopic: topicNameParam.valueAsString,
    });

    expect(stack).toHaveResourceLike('AWS::Lambda::EventSourceMapping', {
      Topics: [{
        Ref: 'TopicNameParam',
      }],
    });
  });

  test('throws if neither eventSourceArn nor kafkaBootstrapServers are set', () => {
    const stack = new cdk.Stack();
    const fn = new Function(stack, 'fn', {
      handler: 'index.handler',
      code: Code.fromInline('exports.handler = ${handler.toString()}'),
      runtime: Runtime.NODEJS_10_X,
    });

    expect(() => new EventSourceMapping(stack, 'test', {
      target: fn,
    })).toThrow(/Either eventSourceArn or kafkaBootstrapServers must be set/);
  });

  test('throws if both eventSourceArn and kafkaBootstrapServers are set', () => {
    const stack = new cdk.Stack();
    const fn = new Function(stack, 'fn', {
      handler: 'index.handler',
      code: Code.fromInline('exports.handler = ${handler.toString()}'),
      runtime: Runtime.NODEJS_10_X,
    });

    expect(() => new EventSourceMapping(stack, 'test', {
      eventSourceArn: '',
      kafkaBootstrapServers: [],
      target: fn,
    })).toThrow(/eventSourceArn and kafkaBootstrapServers are mutually exclusive/);
  });

  test('throws if both kafkaBootstrapServers is set but empty', () => {
    const stack = new cdk.Stack();
    const fn = new Function(stack, 'fn', {
      handler: 'index.handler',
      code: Code.fromInline('exports.handler = ${handler.toString()}'),
      runtime: Runtime.NODEJS_10_X,
    });

    expect(() => new EventSourceMapping(stack, 'test', {
      kafkaBootstrapServers: [],
      target: fn,
    })).toThrow(/kafkaBootStrapServers must not be empty if set/);
  });

  test('eventSourceArn appears in stack', () => {
    const stack = new cdk.Stack();
    const topicNameParam = new cdk.CfnParameter(stack, 'TopicNameParam', {
      type: 'String',
    });

    const fn = new Function(stack, 'fn', {
      handler: 'index.handler',
      code: Code.fromInline('exports.handler = ${handler.toString()}'),
      runtime: Runtime.NODEJS_10_X,
    });

    let eventSourceArn = 'some-arn';

    new EventSourceMapping(stack, 'test', {
      target: fn,
      eventSourceArn: eventSourceArn,
      kafkaTopic: topicNameParam.valueAsString,
    });

    expect(stack).toHaveResourceLike('AWS::Lambda::EventSourceMapping', {
      EventSourceArn: eventSourceArn,
    });
  });

  test('kafkaBootstrapServers appears in stack', () => {
    const stack = new cdk.Stack();
    const topicNameParam = new cdk.CfnParameter(stack, 'TopicNameParam', {
      type: 'String',
    });

    const fn = new Function(stack, 'fn', {
      handler: 'index.handler',
      code: Code.fromInline('exports.handler = ${handler.toString()}'),
      runtime: Runtime.NODEJS_10_X,
    });

    let kafkaBootstrapServers = ['kafka-broker.example.com:9092'];
    new EventSourceMapping(stack, 'test', {
      target: fn,
      kafkaBootstrapServers: kafkaBootstrapServers,
      kafkaTopic: topicNameParam.valueAsString,
    });

    expect(stack).toHaveResourceLike('AWS::Lambda::EventSourceMapping', {
      SelfManagedEventSource: { Endpoints: { KafkaBootstrapServers: kafkaBootstrapServers } },
    });
  });

  test('throws if tumblingWindow > 900 seconds', () => {
    const stack = new cdk.Stack();
    const fn = new Function(stack, 'fn', {
      handler: 'index.handler',
      code: Code.fromInline('exports.handler = ${handler.toString()}'),
      runtime: Runtime.NODEJS_10_X,
    });

    expect(() => new EventSourceMapping(stack, 'test', {
      target: fn,
      eventSourceArn: '',
      tumblingWindow: cdk.Duration.seconds(901),
    })).toThrow(/tumblingWindow cannot be over 900 seconds/);
  });

  test('accepts if tumblingWindow is a token', () => {
    const stack = new cdk.Stack();
    const fn = new Function(stack, 'fn', {
      handler: 'index.handler',
      code: Code.fromInline('exports.handler = ${handler.toString()}'),
      runtime: Runtime.NODEJS_10_X,
    });
    const lazyDuration = cdk.Duration.seconds(cdk.Lazy.number({ produce: () => 60 }));

    new EventSourceMapping(stack, 'test', {
      target: fn,
      eventSourceArn: '',
      tumblingWindow: lazyDuration,
    });
  });
});