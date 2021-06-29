import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Stack } from '@aws-cdk/core';
import { CodeBuildStopBuild } from '../../lib/codebuild/stop-build';

let stack: Stack;
let buildId: string;

beforeEach(() => {
  //GIVEN
  stack = new Stack();
  buildId = 'arn:aws:codebuild:us-east-1:123456789012:build/myProject1:buildId';
});

test('stopBuild with request response pattern', () => {
  // WHEN
  const task = new CodeBuildStopBuild(stack, 'Stop Build', {
    buildId: buildId,
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
          ':states:::codebuild:stopBuild',
        ],
      ],
    },
    End: true,
    Parameters: {
      Id: buildId,
    },
  });
});

test('stopBuild with request response pattern with path as buildId input', () => {
  // WHEN
  const task = new CodeBuildStopBuild(stack, 'Stop Build', {
    buildId: sfn.JsonPath.stringAt('$.Build.Arn'),
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
          ':states:::codebuild:stopBuild',
        ],
      ],
    },
    End: true,
    Parameters: {
      'Id.$': '$.Build.Arn',
    },
  });
});

test('Task throws if RUN_JOB/WAIT_FOR_TASK_TOKEN is supplied as service integration pattern', () => {
  expect(() => {
    new CodeBuildStopBuild(stack, 'Stop Build RUN_JOB', {
      buildId: buildId,
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
    });
  }).toThrow(
    /Unsupported service integration pattern. Supported Patterns: REQUEST_RESPONSE. Received: RUN_JOB/,
  );

  expect(() => {
    new CodeBuildStopBuild(stack, 'Stop Build WAIT_FOR_TASK_TOKEN', {
      buildId: buildId,
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
    });
  }).toThrow(
    /Unsupported service integration pattern. Supported Patterns: REQUEST_RESPONSE. Received: WAIT_FOR_TASK_TOKEN/,
  );
});
