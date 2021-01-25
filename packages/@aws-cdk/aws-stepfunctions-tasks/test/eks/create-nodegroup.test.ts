import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { EksCreateNodegroup } from '../../lib/eks/create-nodegroup';

describe('EKS Create a Nodegroup', () => {

  test('default settings', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const task = new EksCreateNodegroup(stack, 'NodeGroup', {
      clusterName: 'clusterName',
      nodegroupName: 'nodegroupName',
      scalingConfig: {
        minSize: 1,
        maxSize: 2,
        desiredSize: 2,
      },
      diskSize: 1,
      subnets: ['subnets'],
      instanceTypes: ['instanceTypes'],
      amiType: 'amiType',
      remoteAccess: {
        ec2SshKey: 'ec2SshKey',
        sourceSecurityGroups: ['sourceSecurityGroups'],
      },
      nodeRole: 'nodeRole',
      clientRequestToken: 'clientRequestToken',
      version: 'version',
      releaseVersion: 'releaseVersion',
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
            ':states:::eks:createNodegroup',
          ],
        ],
      },
      End: true,
      Parameters: {
        ClusterName: 'clusterName',
        NodegroupName: 'nodegroupName',
        ScalingConfig: {
          MinSize: 1,
          MaxSize: 2,
          DesiredSize: 2,
        },
        DiskSize: 1,
        Subnets: ['subnets'],
        InstanceTypes: ['instanceTypes'],
        AmiType: 'amiType',
        RemoteAccess: {
          Ec2SshKey: 'ec2SshKey',
          SourceSecurityGroups: ['sourceSecurityGroups'],
        },
        NodeRole: 'nodeRole',
        ClientRequestToken: 'clientRequestToken',
        Version: 'version',
        ReleaseVersion: 'releaseVersion',
      },
    });
  });

  test('sync integrationPattern', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const task = new EksCreateNodegroup(stack, 'Create', {
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      clusterName: 'clusterName',
      nodegroupName: 'nodegroupName',
      scalingConfig: {
        minSize: 1,
        maxSize: 2,
        desiredSize: 2,
      },
      diskSize: 1,
      subnets: ['subnets'],
      instanceTypes: ['instanceTypes'],
      amiType: 'amiType',
      nodeRole: 'nodeRole',
      clientRequestToken: 'clientRequestToken',
      launchTemplate: {
        name: 'name',
        version: 'version',
        id: 'id',
      },
      version: 'version',
      releaseVersion: 'releaseVersion',
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
            ':states:::eks:createNodegroup.sync',
          ],
        ],
      },
      End: true,
      Parameters: {
        ClusterName: 'clusterName',
        NodegroupName: 'nodegroupName',
        ScalingConfig: {
          MinSize: 1,
          MaxSize: 2,
          DesiredSize: 2,
        },
        DiskSize: 1,
        Subnets: ['subnets'],
        InstanceTypes: ['instanceTypes'],
        AmiType: 'amiType',
        NodeRole: 'nodeRole',
        ClientRequestToken: 'clientRequestToken',
        LaunchTemplate: {
          Name: 'name',
          Version: 'version',
          Id: 'id',
        },
        Version: 'version',
        ReleaseVersion: 'releaseVersion',
      },
    });
  });
});
