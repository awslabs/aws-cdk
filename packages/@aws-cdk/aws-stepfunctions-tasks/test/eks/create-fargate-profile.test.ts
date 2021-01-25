import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { EksCreateFargateProfile } from '../../lib/eks/create-fargate-profile';

describe('EKS Create a Fargate Profile', () => {

  test('default settings', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const fargateProfileSelector = {
      namespace: 'namespaceFargateProfileSelector',
    };

    // WHEN
    const task = new EksCreateFargateProfile(stack, 'Fargate Profile', {
      fargateProfileName: 'fargateProfileName',
      clusterName: 'clusterName',
      podExecutionRole: 'podExecutionRole',
      selectors: [fargateProfileSelector],
      clientRequestToken: 'clientRequestToken',
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
            ':states:::eks:createFargateProfile',
          ],
        ],
      },
      End: true,
      Parameters: {
        FargateProfileName: 'fargateProfileName',
        ClusterName: 'clusterName',
        PodExecutionRoleArn: 'podExecutionRole',
        Selectors: [fargateProfileSelector],
        ClientRequestToken: 'clientRequestToken',
      },
    });
  });

  test('sync integrationPattern', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const fargateProfileSelector = {
      namespace: 'namespaceFargateProfileSelector',
    };

    // WHEN
    const task = new EksCreateFargateProfile(stack, 'Create', {
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      fargateProfileName: 'fargateProfileName',
      clusterName: 'clusterName',
      podExecutionRole: 'podExecutionRole',
      selectors: [fargateProfileSelector],
      clientRequestToken: 'clientRequestToken',
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
            ':states:::eks:createFargateProfile.sync',
          ],
        ],
      },
      End: true,
      Parameters: {
        FargateProfileName: 'fargateProfileName',
        ClusterName: 'clusterName',
        PodExecutionRoleArn: 'podExecutionRole',
        Selectors: [fargateProfileSelector],
        ClientRequestToken: 'clientRequestToken',
      },
    });
  });
});
