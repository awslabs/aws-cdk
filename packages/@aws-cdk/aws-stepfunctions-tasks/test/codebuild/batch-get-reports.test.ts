import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Stack } from '@aws-cdk/core';
import { CodeBuildBatchGetReports } from '../../lib/codebuild/batch-get-reports';

let stack: Stack;
let reportArns: string[];

beforeEach(() => {
  //GIVEN
  stack = new Stack();
  reportArns = ['arn:aws:codebuild:us-east-1:123456789012:report/reportGroup1:reportId',
    'arn:aws:codebuild:us-east-1:123456789012:report/reportGroup2:reportId'];;
});

test('batchGetReports with request response pattern', () => {
  // WHEN
  const task = new CodeBuildBatchGetReports(stack, 'Get Report', {
    reportArns: reportArns,
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
          ':states:::codebuild:batchGetReports',
        ],
      ],
    },
    End: true,
    Parameters: {
      ReportArns: ['arn:aws:codebuild:us-east-1:123456789012:report/reportGroup1:reportId',
        'arn:aws:codebuild:us-east-1:123456789012:report/reportGroup2:reportId'],
    },
  });
});

test('batchGetReports with request response pattern with path as reportArns input', () => {
  // WHEN
  const task = new CodeBuildBatchGetReports(stack, 'Get Report', {
    reportArns: sfn.JsonPath.listAt('$.Build.ReportArns'),
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
          ':states:::codebuild:batchGetReports',
        ],
      ],
    },
    End: true,
    Parameters: {
      'ReportArns.$': '$.Build.ReportArns',
    },
  });
});

test('Task throws if RUN_JOB/WAIT_FOR_TASK_TOKEN is supplied as service integration pattern', () => {
  expect(() => {
    new CodeBuildBatchGetReports(stack, 'Get Report RUN_JOB', {
      reportArns: reportArns,
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
    });
  }).toThrow(
    /Unsupported service integration pattern. Supported Patterns: REQUEST_RESPONSE. Received: RUN_JOB/,
  );

  expect(() => {
    new CodeBuildBatchGetReports(stack, 'Get Report WAIT_FOR_TASK_TOKEN', {
      reportArns: reportArns,
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
    });
  }).toThrow(
    /Unsupported service integration pattern. Supported Patterns: REQUEST_RESPONSE. Received: WAIT_FOR_TASK_TOKEN/,
  );
});
