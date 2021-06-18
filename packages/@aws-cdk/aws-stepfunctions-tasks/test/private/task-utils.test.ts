import { IntegrationPattern } from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { integrationResourceArn, validatePatternSupported } from '../../lib/private/task-utils';

describe('Task utils', () => {
  describe('integration pattern validation', () => {
    test('supported integration pattern', () => {
      // GIVEN
      const supportedPatterns: IntegrationPattern[] = [IntegrationPattern.REQUEST_RESPONSE];

      expect( () => {
        validatePatternSupported(IntegrationPattern.REQUEST_RESPONSE, supportedPatterns);
      }).not.toThrow();
    });

    test('fails on unsupported integration pattern', () => {
      // GIVEN
      const supportedPatterns: IntegrationPattern[] = [IntegrationPattern.RUN_JOB];

      expect( () => {
        validatePatternSupported(IntegrationPattern.WAIT_FOR_TASK_TOKEN, supportedPatterns);
      }).toThrowError(/Unsupported service integration pattern. Supported Patterns: RUN_JOB. Received: WAIT_FOR_TASK_TOKEN/);
    });
  });

  describe('integration resource Arn', () => {
    let service: string;
    let api: string;
    let stack: cdk.Stack;

    beforeEach(() => {
      // GIVEN
      service = 'lambda';
      api = 'invoke';
      stack = new cdk.Stack();
    });

    test('get resourceArn for a request/response integration pattern', () => {
      // WHEN
      const resourceArn = integrationResourceArn(service, api, IntegrationPattern.REQUEST_RESPONSE);

      // THEN
      expect(stack.resolve(resourceArn)).toEqual({
        'Fn::Join': [
          '',
          [
            'arn:',
            { Ref: 'AWS::Partition' },
            ':states:::lambda:invoke',
          ],
        ],
      });
    });

    test('get resourceArn for a run job integration pattern', () => {
      // WHEN
      const resourceArn = integrationResourceArn(service, api, IntegrationPattern.RUN_JOB);

      // THEN
      expect(stack.resolve(resourceArn)).toEqual({
        'Fn::Join': [
          '',
          [
            'arn:',
            { Ref: 'AWS::Partition' },
            ':states:::lambda:invoke.sync',
          ],
        ],
      });
    });

    test('get resourceArn for a wait for task token integration pattern', () => {
      // WHEN
      const resourceArn = integrationResourceArn(service, api, IntegrationPattern.WAIT_FOR_TASK_TOKEN);

      // THEN
      expect(stack.resolve(resourceArn)).toEqual({
        'Fn::Join': [
          '',
          [
            'arn:',
            { Ref: 'AWS::Partition' },
            ':states:::lambda:invoke.waitForTaskToken',
          ],
        ],
      });
    });

    test('fails when service or api is not specified', () => {
      expect(() => {
        integrationResourceArn(service, '', IntegrationPattern.RUN_JOB);
      }).toThrow(/Both 'service' and 'api' must be provided to build the resource ARN./);

      expect(() => {
        integrationResourceArn('', api, IntegrationPattern.RUN_JOB);
      }).toThrow(/Both 'service' and 'api' must be provided to build the resource ARN./);
    });
  });
});