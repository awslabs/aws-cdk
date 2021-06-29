import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Stack } from '@aws-cdk/core';
import { CodeBuildBatchDeleteBuilds } from '../../lib/codebuild/batch-delete-builds';

let stack: Stack;
let buildIds: string[];

beforeEach(() => {
  //GIVEN
  stack = new Stack();
  buildIds = ['arn:aws:codebuild:us-east-1:123456789012:build/myProject1:buildId',
    'arn:aws:codebuild:us-east-1:123456789012:build/myProject2:buildId'];
});

test('BatchDeleteBuilds with request response pattern', () => {
  // WHEN
  const task = new CodeBuildBatchDeleteBuilds(stack, 'Batch Delete Builds', {
    ids: buildIds,
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
          ':states:::codebuild:batchDeleteBuilds',
        ],
      ],
    },
    End: true,
    Parameters: {
      Ids: ['arn:aws:codebuild:us-east-1:123456789012:build/myProject1:buildId',
        'arn:aws:codebuild:us-east-1:123456789012:build/myProject2:buildId'],
    },
  });
});

test('BatchDeleteBuilds with request response pattern with path as input for buildIds', () => {
  // WHEN
  const task = new CodeBuildBatchDeleteBuilds(stack, 'Batch Delete Builds', {
    ids: sfn.JsonPath.listAt('$.Build..Arn'),
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
          ':states:::codebuild:batchDeleteBuilds',
        ],
      ],
    },
    End: true,
    Parameters: {
      'Ids.$': '$.Build..Arn',
    },
  });
});

test('Task throws if RUN_JOB/WAIT_FOR_TASK_TOKEN is supplied as service integration pattern', () => {
  expect(() => {
    new CodeBuildBatchDeleteBuilds(stack, 'Batch Delete Builds RUN_JOB', {
      ids: buildIds,
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
    });
  }).toThrow(
    /Unsupported service integration pattern. Supported Patterns: REQUEST_RESPONSE. Received: RUN_JOB/,
  );

  expect(() => {
    new CodeBuildBatchDeleteBuilds(stack, 'Batch Delete Builds WAIT_FOR_TASK_TOKEN', {
      ids: buildIds,
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
    });
  }).toThrow(
    /Unsupported service integration pattern. Supported Patterns: REQUEST_RESPONSE. Received: WAIT_FOR_TASK_TOKEN/,
  );
});
