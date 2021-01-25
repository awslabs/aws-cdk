import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { EksDeleteFargateProfile } from '../../lib/eks/delete-fargate-profile';

describe('EKS Delete a Fargate Profile', () => {

  test('default settings', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const task = new EksDeleteFargateProfile(stack, 'Fargate Profile', {
      clusterName: 'clusterName',
      fargateProfileName: 'fargateProfileName',
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
            ':states:::eks:deleteFargateProfile',
          ],
        ],
      },
      End: true,
      Parameters: {
        ClusterName: 'clusterName',
        FargateProfileName: 'fargateProfileName',
      },
    });
  });

  test('sync integrationPattern', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const task = new EksDeleteFargateProfile(stack, 'Delete', {
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      clusterName: 'clusterName',
      fargateProfileName: 'fargateProfileName',
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
            ':states:::eks:deleteFargateProfile.sync',
          ],
        ],
      },
      End: true,
      Parameters: {
        ClusterName: 'clusterName',
        FargateProfileName: 'fargateProfileName',
      },
    });
  });
});
