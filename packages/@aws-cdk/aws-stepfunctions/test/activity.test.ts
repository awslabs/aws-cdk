import { arrayWith, objectLike } from '@aws-cdk/assert-internal';
import '@aws-cdk/assert-internal/jest';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import * as stepfunctions from '../lib';

describe('Activity', () => {
  test('instantiate Activity', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    new stepfunctions.Activity(stack, 'Activity');

    // THEN
    expect(stack).toHaveResource('AWS::StepFunctions::Activity', {
      Name: 'Activity',
    });
  });

  test('Activity exposes metrics', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const activity = new stepfunctions.Activity(stack, 'Activity');

    // THEN
    const sharedMetric = {
      period: cdk.Duration.minutes(5),
      namespace: 'AWS/States',
      dimensions: { ActivityArn: { Ref: 'Activity04690B0A' } },
    };
    expect((stack.resolve(activity.metricRunTime()))).toEqual({
      ...sharedMetric,
      metricName: 'ActivityRunTime',
      statistic: 'Average',
    });

    expect(stack.resolve(activity.metricFailed())).toEqual({
      ...sharedMetric,
      metricName: 'ActivitiesFailed',
      statistic: 'Sum',
    });
  });

  test('Activity can grant permissions to a role', () => {
    // GIVEN
    const stack = new cdk.Stack();

    const role = new iam.Role(stack, 'Role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    const activity = new stepfunctions.Activity(stack, 'Activity');

    // WHEN
    activity.grant(role, 'states:SendTaskSuccess');

    // THEN
    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: arrayWith(objectLike({
          Action: 'states:SendTaskSuccess',
          Effect: 'Allow',
          Resource: {
            Ref: 'Activity04690B0A',
          },
        })),
      },
    });
  });
});
