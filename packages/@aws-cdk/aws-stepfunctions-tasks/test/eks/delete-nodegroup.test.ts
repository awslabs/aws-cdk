import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { EksDeleteNodegroup } from '../../lib/eks/delete-nodegroup';

describe('EKS Delete a Nodegroup', () => {

  test('default settings', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const task = new EksDeleteNodegroup(stack, 'NodeGroup', {
      clusterName: 'clusterName',
      nodegroupName: 'nodegroupName',
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
            ':states:::eks:deleteNodegroup',
          ],
        ],
      },
      End: true,
      Parameters: {
        ClusterName: 'clusterName',
        NodegroupName: 'nodegroupName',
      },
    });
  });

  test('sync integrationPattern', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const task = new EksDeleteNodegroup(stack, 'Delete', {
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      clusterName: 'clusterName',
      nodegroupName: 'nodegroupName',
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
            ':states:::eks:deleteNodegroup.sync',
          ],
        ],
      },
      End: true,
      Parameters: {
        ClusterName: 'clusterName',
        NodegroupName: 'nodegroupName',
      },
    });
  });
});
