import { Metric } from '@aws-cdk/aws-cloudwatch';
import * as cdk from '@aws-cdk/core';
import * as sfn from '../lib';

describe('Task state', () => {
  let stack: cdk.Stack;
  let task: sfn.Task;

  beforeEach(() => {
    // GIVEN
    stack = new cdk.Stack();
    task = new sfn.Task(stack, 'my-task', {
      task: new FakeTask(),
    });
  });

  test('get named metric for the task', () => {
    // WHEN
    const metric = task.metric('my-metric');

    // THEN
    verifyMetric(metric, 'my-metric', 'Sum');
  });

  test('add metric for number of times the task failed', () => {
    // WHEN
    const metric = task.metricFailed();

    // THEN
    verifyMetric(metric, 'Failed', 'Sum');
  });

  test('add metric for number of times the metrics heartbeat timed out', () => {
    // WHEN
    const metric = task.metricHeartbeatTimedOut();

    // THEN
    verifyMetric(metric, 'HeartbeatTimedOut', 'Sum');
  });

  test('add metric for task state run time', () => {
    // WHEN
    const metric = task.metricRunTime();

    // THEN
    verifyMetric(metric, 'RunTime', 'Average');
  });

  test('add metric for task schedule time', () => {
    // WHEN
    const metric = task.metricScheduleTime();

    // THEN
    verifyMetric(metric, 'ScheduleTime', 'Average');
  });

  test('add metric for number of times the task is scheduled', () => {
    // WHEN
    const metric = task.metricScheduled();

    // THEN
    verifyMetric(metric, 'Scheduled', 'Sum');
  });

  test('add metric for number of times the task was started', () => {
    // WHEN
    const metric = task.metricStarted();

    // THEN
    verifyMetric(metric, 'Started', 'Sum');
  });

  test('add metric for number of times the task succeeded', () => {
    // WHEN
    const metric = task.metricSucceeded();

    // THEN
    verifyMetric(metric, 'Succeeded', 'Sum');
  });

  test('add metric for time between task being scheduled to closing', () => {
    // WHEN
    const metric = task.metricTime();

    // THEN
    verifyMetric(metric, 'Time', 'Average');
  });

  test('add metric for number of times the task times out', () => {
    // WHEN
    const metric = task.metricTimedOut();

    // THEN
    verifyMetric(metric, 'TimedOut', 'Sum');
  });
});

function verifyMetric(metric: Metric, metricName: string, statistic: string) {
  expect(metric).toEqual(expect.objectContaining({
    metricName,
    namespace: 'AWS/States',
    statistic,
    dimensions: {
      Arn: 'resource',
    },
  }));
}

class FakeTask implements sfn.IStepFunctionsTask {
  public bind(_task: sfn.Task): sfn.StepFunctionsTaskConfig {
    return {
      resourceArn: 'resource',
      metricPrefixSingular: '',
      metricPrefixPlural: '',
      metricDimensions: { Arn: 'resource' },
    };
  }
}