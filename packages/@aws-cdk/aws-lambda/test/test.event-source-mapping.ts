/* tslint:disable */
import { Test } from 'nodeunit';
import { Code, EventSourceMapping, Function, Runtime } from '../lib';
import * as cdk from '@aws-cdk/core';


export = {
    'throws if maxBatchingWindow > 300 seconds'(test: Test) {
        const stack = new cdk.Stack();
        const fn = new Function(stack, 'fn', {
            handler: 'index.handler',
            code: Code.fromInline(`exports.handler = \${handler.toString()}`),
            runtime: Runtime.NODEJS_10_X
        });

        test.throws(() =>
            new EventSourceMapping(
                stack,
                'test',
                {
                    target: fn,
                    eventSourceArn: '',
                    maxBatchingWindow: cdk.Duration.seconds(301)
                }), /maxBatchingWindow cannot be over 300 seconds/);

        test.done();
    },
    'throws if maxRecordAge is below 60 seconds'(test: Test) {
        const stack = new cdk.Stack();
        const fn = new Function(stack, 'fn', {
            handler: 'index.handler',
            code: Code.fromInline(`exports.handler = \${handler.toString()}`),
            runtime: Runtime.NODEJS_10_X
        });

        test.throws(() =>
            new EventSourceMapping(
                stack,
                'test',
                {
                    target: fn,
                    eventSourceArn: '',
                    maxRecordAge: cdk.Duration.seconds(59)
                }), /maxRecordAge must be between 60 and 604800 seconds inclusive, got 59/);

        test.done();
    },
    'throws if maxRecordAge is over 7 days'(test: Test) {
        const stack = new cdk.Stack();
        const fn = new Function(stack, 'fn', {
            handler: 'index.handler',
            code: Code.fromInline(`exports.handler = \${handler.toString()}`),
            runtime: Runtime.NODEJS_10_X
        });

        test.throws(() =>
            new EventSourceMapping(
                stack,
                'test',
                {
                    target: fn,
                    eventSourceArn: '',
                    maxRecordAge: cdk.Duration.seconds(604801)
                }), /maxRecordAge must be between 60 and 604800 seconds inclusive, got 604801/);

        test.done();
    },
    'throws if retryAttempts is negative'(test: Test) {
        const stack = new cdk.Stack();
        const fn = new Function(stack, 'fn', {
            handler: 'index.handler',
            code: Code.fromInline(`exports.handler = \${handler.toString()}`),
            runtime: Runtime.NODEJS_10_X
        });

        test.throws(() =>
            new EventSourceMapping(
                stack,
                'test',
                {
                    target: fn,
                    eventSourceArn: '',
                    retryAttempts: -1
                }), /retryAttempts must be between 0 and 10000 inclusive, got -1/);

        test.done();
    },
    'throws if retryAttempts is over 10000'(test: Test) {
        const stack = new cdk.Stack();
        const fn = new Function(stack, 'fn', {
            handler: 'index.handler',
            code: Code.fromInline(`exports.handler = \${handler.toString()}`),
            runtime: Runtime.NODEJS_10_X
        });

        test.throws(() =>
            new EventSourceMapping(
                stack,
                'test',
                {
                    target: fn,
                    eventSourceArn: '',
                    retryAttempts: 10001
                }), /retryAttempts must be between 0 and 10000 inclusive, got 10001/);

        test.done();
    },
    'throws if parallelizationFactor is below 1'(test: Test) {
        const stack = new cdk.Stack();
        const fn = new Function(stack, 'fn', {
            handler: 'index.handler',
            code: Code.fromInline(`exports.handler = \${handler.toString()}`),
            runtime: Runtime.NODEJS_10_X
        });

        test.throws(() =>
            new EventSourceMapping(
                stack,
                'test',
                {
                    target: fn,
                    eventSourceArn: '',
                    parallelizationFactor: 0
                }), /parallelizationFactor must be between 1 and 10 inclusive, got 0/);

        test.done();
    },
    'throws if parallelizationFactor is over 10'(test: Test) {
        const stack = new cdk.Stack();
        const fn = new Function(stack, 'fn', {
            handler: 'index.handler',
            code: Code.fromInline(`exports.handler = \${handler.toString()}`),
            runtime: Runtime.NODEJS_10_X
        });

        test.throws(() =>
            new EventSourceMapping(
                stack,
                'test',
                {
                    target: fn,
                    eventSourceArn: '',
                    parallelizationFactor: 11
                }), /parallelizationFactor must be between 1 and 10 inclusive, got 11/);

        test.done();
    },
};
