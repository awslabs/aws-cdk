import '@aws-cdk/assert-internal/jest';
import * as lambda from '@aws-cdk/aws-lambda';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Stack } from '@aws-cdk/core';
import { LambdaInvocationType, LambdaInvoke } from '../../lib';

/* eslint-disable quote-props */

describe('LambdaInvoke', () => {

  let stack: Stack;
  let lambdaFunction: lambda.Function;

  beforeEach(() => {
    // GIVEN
    stack = new Stack();
    lambdaFunction = new lambda.Function(stack, 'Fn', {
      code: lambda.Code.fromInline('foo'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_12_X,
    });
  });

  test('default settings', () => {
    // WHEN
    const task = new LambdaInvoke(stack, 'Task', {
      lambdaFunction,
    });

    // THEN
    expect(stack.resolve(task.toStateJson())).toEqual({
      End: true,
      Type: 'Task',
      Resource: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':states:::lambda:invoke',
          ],
        ],
      },
      Parameters: {
        FunctionName: {
          'Fn::GetAtt': [
            'Fn9270CBC0',
            'Arn',
          ],
        },
        'Payload.$': '$',
      },
      Retry: [
        {
          ErrorEquals: [
            'Lambda.ServiceException',
            'Lambda.AWSLambdaException',
            'Lambda.SdkClientException',
          ],
          IntervalSeconds: 2,
          MaxAttempts: 6,
          BackoffRate: 2,
        },
      ],
    });
  });

  test('optional settings', () => {
    // WHEN
    const task = new LambdaInvoke(stack, 'Task', {
      lambdaFunction,
      payload: sfn.TaskInput.fromObject({
        foo: 'bar',
      }),
      invocationType: LambdaInvocationType.REQUEST_RESPONSE,
      clientContext: 'eyJoZWxsbyI6IndvcmxkIn0=',
      qualifier: '1',
    });

    // THEN
    expect(stack.resolve(task.toStateJson())).toEqual(expect.objectContaining({
      Type: 'Task',
      Resource: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':states:::lambda:invoke',
          ],
        ],
      },
      End: true,
      Parameters: {
        FunctionName: {
          'Fn::GetAtt': [
            'Fn9270CBC0',
            'Arn',
          ],
        },
        Payload: {
          foo: 'bar',
        },
        InvocationType: 'RequestResponse',
        ClientContext: 'eyJoZWxsbyI6IndvcmxkIn0=',
        Qualifier: '1',
      },
    }));
  });

  test('resultSelector', () => {
    // WHEN
    const task = new LambdaInvoke(stack, 'Task', {
      lambdaFunction,
      resultSelector: {
        Result: sfn.JsonPath.stringAt('$.output.Payload'),
      },
    });

    // THEN
    expect(stack.resolve(task.toStateJson())).toEqual(expect.objectContaining({
      Type: 'Task',
      Resource: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':states:::lambda:invoke',
          ],
        ],
      },
      End: true,
      Parameters: {
        FunctionName: {
          'Fn::GetAtt': [
            'Fn9270CBC0',
            'Arn',
          ],
        },
        'Payload.$': '$',
      },
      ResultSelector: {
        'Result.$': '$.output.Payload',
      },
      Retry: [
        {
          ErrorEquals: [
            'Lambda.ServiceException',
            'Lambda.AWSLambdaException',
            'Lambda.SdkClientException',
          ],
          IntervalSeconds: 2,
          MaxAttempts: 6,
          BackoffRate: 2,
        },
      ],
    }));
  });

  test('invoke Lambda function and wait for task token', () => {
    // GIVEN
    const task = new LambdaInvoke(stack, 'Task', {
      lambdaFunction,
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      payload: sfn.TaskInput.fromObject({
        token: sfn.JsonPath.taskToken,
      }),
      qualifier: 'my-alias',
    });

    // THEN
    expect(stack.resolve(task.toStateJson())).toEqual(expect.objectContaining({
      Type: 'Task',
      Resource: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':states:::lambda:invoke.waitForTaskToken',
          ],
        ],
      },
      End: true,
      Parameters: {
        FunctionName: {
          'Fn::GetAtt': [
            'Fn9270CBC0',
            'Arn',
          ],
        },
        Payload: {
          'token.$': '$$.Task.Token',
        },
        Qualifier: 'my-alias',
      },
    }));
  });

  test('pass part of state input as input to Lambda function ', () => {
    // WHEN
    const task = new LambdaInvoke(stack, 'Task', {
      lambdaFunction,
      payload: sfn.TaskInput.fromDataAt('$.foo'),
    });

    // THEN
    expect(stack.resolve(task.toStateJson())).toEqual(expect.objectContaining({
      Type: 'Task',
      Resource: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':states:::lambda:invoke',
          ],
        ],
      },
      End: true,
      Parameters: {
        'FunctionName': {
          'Fn::GetAtt': [
            'Fn9270CBC0',
            'Arn',
          ],
        },
        'Payload.$': '$.foo',
      },
    }));
  });

  test('Invoke lambda with payloadResponseOnly', () => {
    // WHEN
    const task = new LambdaInvoke(stack, 'Task', {
      lambdaFunction,
      payloadResponseOnly: true,
    });

    // THEN
    expect(stack.resolve(task.toStateJson())).toEqual(expect.objectContaining({
      End: true,
      Type: 'Task',
      Resource: {
        'Fn::GetAtt': [
          'Fn9270CBC0',
          'Arn',
        ],
      },
    }));
  });

  test('Invoke lambda with payloadResponseOnly with object payload', () => {
    // WHEN
    const task = new LambdaInvoke(stack, 'Task', {
      lambdaFunction,
      payloadResponseOnly: true,
      payload: sfn.TaskInput.fromObject({
        foo: 'bar',
      }),
    });

    // THEN
    expect(stack.resolve(task.toStateJson())).toEqual(expect.objectContaining({
      End: true,
      Type: 'Task',
      Resource: {
        'Fn::GetAtt': [
          'Fn9270CBC0',
          'Arn',
        ],
      },
      Parameters: {
        foo: 'bar',
      },
    }));
  });

  test('Invoke lambda with payloadResponseOnly with undefined payload', () => {
    // WHEN
    const task = new LambdaInvoke(stack, 'Task', {
      lambdaFunction,
      payloadResponseOnly: true,
    });

    // THEN
    expect(stack.resolve(task.toStateJson())).toEqual(expect.objectContaining({
      End: true,
      Type: 'Task',
      Resource: {
        'Fn::GetAtt': [
          'Fn9270CBC0',
          'Arn',
        ],
      },
    }));
  });

  test('Invoke lambda with payloadResponseOnly with string payload', () => {
    // WHEN
    const payload = sfn.TaskInput.fromText('invalid-payload');

    // THEN
    expect(() => new LambdaInvoke(stack, 'Task', {
      lambdaFunction,
      payloadResponseOnly: true,
      payload,
    })).toThrow('Invalid LambdaInvoke payload value for \'payloadResponseOnly\' invocation. Expected \'object\' or \'undefined\', got \'string\'.');
  });

  test('with retryOnServiceExceptions set to false', () => {
    // WHEN
    const task = new LambdaInvoke(stack, 'Task', {
      lambdaFunction,
      retryOnServiceExceptions: false,
    });

    // THEN
    expect(stack.resolve(task.toStateJson())).toEqual({
      End: true,
      Type: 'Task',
      Resource: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':states:::lambda:invoke',
          ],
        ],
      },
      Parameters: {
        FunctionName: {
          'Fn::GetAtt': [
            'Fn9270CBC0',
            'Arn',
          ],
        },
        'Payload.$': '$',
      },
    });
  });

  test('fails when integrationPattern used with payloadResponseOnly', () => {
    expect(() => {
      new LambdaInvoke(stack, 'Task', {
        lambdaFunction,
        payloadResponseOnly: true,
        integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
        payload: sfn.TaskInput.fromObject({
          token: sfn.JsonPath.taskToken,
        }),
      });
    }).toThrow(/The 'payloadResponseOnly' property cannot be used if 'integrationPattern', 'invocationType', 'clientContext', or 'qualifier' are specified./);
  });

  test('fails when invocationType used with payloadResponseOnly', () => {
    expect(() => {
      new LambdaInvoke(stack, 'Task', {
        lambdaFunction,
        payloadResponseOnly: true,
        payload: sfn.TaskInput.fromObject({
          foo: 'bar',
        }),
        invocationType: LambdaInvocationType.REQUEST_RESPONSE,
      });
    }).toThrow(/The 'payloadResponseOnly' property cannot be used if 'integrationPattern', 'invocationType', 'clientContext', or 'qualifier' are specified./);
  });

  test('fails when clientContext used with payloadResponseOnly', () => {
    expect(() => {
      new LambdaInvoke(stack, 'Task', {
        lambdaFunction,
        payloadResponseOnly: true,
        payload: sfn.TaskInput.fromObject({
          foo: 'bar',
        }),
        clientContext: 'eyJoZWxsbyI6IndvcmxkIn0=',
      });
    }).toThrow(/The 'payloadResponseOnly' property cannot be used if 'integrationPattern', 'invocationType', 'clientContext', or 'qualifier' are specified./);
  });

  test('fails when qualifier used with payloadResponseOnly', () => {
    expect(() => {
      new LambdaInvoke(stack, 'Task', {
        lambdaFunction,
        payloadResponseOnly: true,
        payload: sfn.TaskInput.fromObject({
          foo: 'bar',
        }),
        qualifier: '1',
      });
    }).toThrow(/The 'payloadResponseOnly' property cannot be used if 'integrationPattern', 'invocationType', 'clientContext', or 'qualifier' are specified./);
  });

  test('fails when WAIT_FOR_TASK_TOKEN integration pattern is used without supplying a task token in payload', () => {
    expect(() => {
      new LambdaInvoke(stack, 'Task', {
        lambdaFunction,
        integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      });
    }).toThrow(/Task Token is required in `payload` for callback. Use JsonPath.taskToken to set the token./);
  });

  test('fails when RUN_JOB integration pattern is used', () => {
    expect(() => {
      new LambdaInvoke(stack, 'Task', {
        lambdaFunction,
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      });
    }).toThrow(/Unsupported service integration pattern. Supported Patterns: REQUEST_RESPONSE,WAIT_FOR_TASK_TOKEN. Received: RUN_JOB/);
  });
});
