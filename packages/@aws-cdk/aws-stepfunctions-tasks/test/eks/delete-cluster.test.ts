import * as eks from '@aws-cdk/aws-eks';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { EksDeleteCluster } from '../../lib/eks/delete-cluster';

describe('Delete a Cluster', () => {

  test('default settings', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const cluster = eks.Cluster.fromClusterAttributes(stack, 'Cluster', {
      clusterName: 'deleteCluster',
    });

    // WHEN
    const task = new EksDeleteCluster(stack, 'Delete Cluster', {
      cluster: cluster,
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
            ':states:::eks:deleteCluster',
          ],
        ],
      },
      End: true,
      Parameters: {
        Name: 'deleteCluster',
      },
    });
  });


  test('deleteCluster.sync', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const cluster = eks.Cluster.fromClusterAttributes(stack, 'Cluster', {
      clusterName: 'deleteCluster',
    });

    // WHEN
    const task = new EksDeleteCluster(stack, 'Delete Cluster', {
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      cluster: cluster,
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
            ':states:::eks:deleteCluster.sync',
          ],
        ],
      },
      End: true,
      Parameters: {
        Name: 'deleteCluster',
      },
    });
  });
});
