import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { GlueDataBrewStartJobRun } from '../../lib/databrew/start-job-run';

describe('Start Job Run', () => {
  test('default settings', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const task = new GlueDataBrewStartJobRun(stack, 'JobRun', {
      name: 'jobName',
    });

    // THEN
    expect(stack.resolve(task.toStateJson())).toEqual({
      Type: 'Task',
      Resource: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':states:::databrew:startJobRun',
          ],
        ],
      },
      End: true,
      Parameters: {
        Name: 'jobName',
      },
    });
  });

  test('create job with input from task', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const task = new GlueDataBrewStartJobRun(stack, 'JobRun', {
      name: sfn.JsonPath.stringAt('$.Name'),
    });

    // THEN
    expect(stack.resolve(task.toStateJson())).toEqual({
      Type: 'Task',
      Resource: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':states:::databrew:startJobRun',
          ],
        ],
      },
      End: true,
      Parameters: {
        'Name.$': '$.Name',
      },
    });
  });

  test('sync integrationPattern', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const task = new GlueDataBrewStartJobRun(stack, 'JobRun', {
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      name: 'jobName',
    });

    // THEN
    expect(stack.resolve(task.toStateJson())).toEqual({
      Type: 'Task',
      Resource: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':states:::databrew:startJobRun.sync',
          ],
        ],
      },
      End: true,
      Parameters: {
        Name: 'jobName',
      },
    });
  });


  test('wait_for_task_token integrationPattern throws an error', () => {
    // GIVEN
    const stack = new cdk.Stack();

    expect(() => {
      new GlueDataBrewStartJobRun(stack, 'JobRun', {
        integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
        name: 'jobName',
      });
    }).toThrow(/Unsupported service integration pattern. Supported Patterns: REQUEST_RESPONSE,RUN_JOB. Received: WAIT_FOR_TASK_TOKEN/i);
  });
});

