import { expect, haveResourceLike } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import { nodeunitShim, Test } from 'nodeunit-shim';
import * as ecs from '../lib';

let stack: cdk.Stack;
let td: ecs.TaskDefinition;
const image = ecs.ContainerImage.fromRegistry('test-image');

nodeunitShim({
  'setUp'(cb: () => void) {
    stack = new cdk.Stack();
    td = new ecs.Ec2TaskDefinition(stack, 'TaskDefinition');

    cb();
  },

  'create a splunk log driver with minimum options'(test: Test) {
    // WHEN
    td.addContainer('Container', {
      image,
      logging: new ecs.SplunkLogDriver({
        token: cdk.SecretValue.secretsManager('my-splunk-token'),
        url: 'my-splunk-url',
      }),
      memoryLimitMiB: 128,
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
          LogConfiguration: {
            LogDriver: 'splunk',
            Options: {
              'splunk-token': '{{resolve:secretsmanager:my-splunk-token:SecretString:::}}',
              'splunk-url': 'my-splunk-url',
            },
          },
        },
      ],
    }));

    test.done();
  },

  'create a splunk log driver using splunk with minimum options'(test: Test) {
    // WHEN
    td.addContainer('Container', {
      image,
      logging: ecs.LogDrivers.splunk({
        token: cdk.SecretValue.secretsManager('my-splunk-token'),
        url: 'my-splunk-url',
      }),
      memoryLimitMiB: 128,
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
          LogConfiguration: {
            LogDriver: 'splunk',
            Options: {
              'splunk-token': '{{resolve:secretsmanager:my-splunk-token:SecretString:::}}',
              'splunk-url': 'my-splunk-url',
            },
          },
        },
      ],
    }));

    test.done();
  },

  'create a splunk log driver using splunk with sourcetype defined'(test: Test) {
    // WHEN
    td.addContainer('Container', {
      image,
      logging: ecs.LogDrivers.splunk({
        token: cdk.SecretValue.secretsManager('my-splunk-token'),
        url: 'my-splunk-url',
        sourceType: 'my-source-type',
      }),
      memoryLimitMiB: 128,
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
          LogConfiguration: {
            LogDriver: 'splunk',
            Options: {
              'splunk-token': '{{resolve:secretsmanager:my-splunk-token:SecretString:::}}',
              'splunk-url': 'my-splunk-url',
              'splunk-sourcetype': 'my-source-type',
            },
          },
        },
      ],
    }));

    test.done();
  },

  'create a splunk log driver using splunk-tag property when tag is defined'(test: Test) {
    // WHEN
    td.addContainer('Container', {
      image,
      logging: ecs.LogDrivers.splunk({
        token: cdk.SecretValue.secretsManager('my-splunk-token'),
        url: 'my-splunk-url',
        tag: 'abc',
      }),
      memoryLimitMiB: 128,
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
          LogConfiguration: {
            LogDriver: 'splunk',
            Options: {
              'splunk-token': '{{resolve:secretsmanager:my-splunk-token:SecretString:::}}',
              'splunk-url': 'my-splunk-url',
              'splunk-tag': 'abc',
            },
          },
        },
      ],
    }));

    test.done();
  },
});
