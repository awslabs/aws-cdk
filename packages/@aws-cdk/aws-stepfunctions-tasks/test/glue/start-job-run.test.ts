import '@aws-cdk/assert-internal/jest';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Duration, Stack } from '@aws-cdk/core';
import * as tasks from '../../lib';
import { GlueStartJobRun } from '../../lib/glue/start-job-run';

const glueJobName = 'GlueJob';
let stack: Stack;
beforeEach(() => {
  stack = new Stack();
});

test('Invoke glue job with just job ARN', () => {
  const task = new GlueStartJobRun(stack, 'Task', {
    glueJobName,
  });
  new sfn.StateMachine(stack, 'SM', {
    definition: task,
  });

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
          ':states:::glue:startJobRun',
        ],
      ],
    },
    End: true,
    Parameters: {
      JobName: glueJobName,
    },
  });
});

test('Invoke glue job with full properties', () => {
  const jobArguments = {
    key: 'value',
  };
  const timeoutMinutes = 1440;
  const glueJobTimeout = Duration.minutes(timeoutMinutes);
  const securityConfiguration = 'securityConfiguration';
  const notifyDelayAfterMinutes = 10;
  const notifyDelayAfter = Duration.minutes(notifyDelayAfterMinutes);
  const task = new GlueStartJobRun(stack, 'Task', {
    glueJobName,
    integrationPattern: sfn.IntegrationPattern.RUN_JOB,
    arguments: sfn.TaskInput.fromObject(jobArguments),
    timeout: glueJobTimeout,
    securityConfiguration,
    notifyDelayAfter,
  });
  new sfn.StateMachine(stack, 'SM', {
    definition: task,
  });

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
          ':states:::glue:startJobRun.sync',
        ],
      ],
    },
    End: true,
    Parameters: {
      JobName: glueJobName,
      Arguments: jobArguments,
      Timeout: timeoutMinutes,
      SecurityConfiguration: securityConfiguration,
      NotificationProperty: {
        NotifyDelayAfter: notifyDelayAfterMinutes,
      },
    },
  });
});

test('job arguments can reference state input', () => {
  const task = new GlueStartJobRun(stack, 'Task', {
    glueJobName,
    integrationPattern: sfn.IntegrationPattern.RUN_JOB,
    arguments: sfn.TaskInput.fromJsonPathAt('$.input'),
  });
  new sfn.StateMachine(stack, 'SM', {
    definition: task,
  });

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
          ':states:::glue:startJobRun.sync',
        ],
      ],
    },
    End: true,
    Parameters: {
      'JobName': glueJobName,
      'Arguments.$': '$.input',
    },
  });
});

test('permitted role actions limited to start job run if service integration pattern is REQUEST_RESPONSE', () => {
  const task = new GlueStartJobRun(stack, 'Task', {
    glueJobName,
    integrationPattern: sfn.IntegrationPattern.REQUEST_RESPONSE,
  });

  new sfn.StateMachine(stack, 'SM', {
    definition: task,
  });

  expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: [{
        Action: 'glue:StartJobRun',
      }],
    },
  });
});

test('permitted role actions include start, get, and stop job run if service integration pattern is RUN_JOB', () => {
  const task = new GlueStartJobRun(stack, 'Task', {
    glueJobName,
    integrationPattern: sfn.IntegrationPattern.RUN_JOB,
  });

  new sfn.StateMachine(stack, 'SM', {
    definition: task,
  });

  expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: [{
        Action: [
          'glue:StartJobRun',
          'glue:GetJobRun',
          'glue:GetJobRuns',
          'glue:BatchStopJobRun',
        ],
      }],
    },
  });
});

test('Task throws if WAIT_FOR_TASK_TOKEN is supplied as service integration pattern', () => {
  expect(() => {
    new tasks.GlueStartJobRun(stack, 'GlueJob', {
      glueJobName,
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
    });
  }).toThrow(/unsupported service integration pattern/i);
});
