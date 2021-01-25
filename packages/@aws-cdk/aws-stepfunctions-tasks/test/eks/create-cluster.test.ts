import * as ec2 from '@aws-cdk/aws-ec2';
import * as eks from '@aws-cdk/aws-eks';
import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { EksCreateCluster, EncryptionConfig } from '../../lib/eks/create-cluster';

describe('Create a Cluster', () => {

  test('default settings', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const encryptionConfiguration : EncryptionConfig = {
      resources: ['resources'],
      provider: {
        keyArn: 'keyArn',
      },
    };

    const vpc = new ec2.Vpc(stack, 'vpc');

    new ec2.SecurityGroup(stack, 'ControlPlaneSecurityGroup', {
      vpc: vpc,
      description: 'EKS Control Plane Security Group',
    });

    const role = new iam.Role(stack, 'Role', {
      assumedBy: new iam.ServicePrincipal('eks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSClusterPolicy'),
      ],
    });

    // WHEN
    const task = new EksCreateCluster(stack, 'Create Cluster', {
      name: 'clusterName',
      role: role,
      resourcesVpcConfig: vpc,
      publicCidrs: ['0.0.0.0/4'],
      clientRequestToken: 'clientRequestToken',
      kubernetesVersion: eks.KubernetesVersion.V1_18,
      encryptionConfig: [encryptionConfiguration],
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
            ':states:::eks:createCluster',
          ],
        ],
      },
      End: true,
      Parameters: {
        Name: 'clusterName',
        RoleArn: {
          'Fn::GetAtt': [
            'Role1ABCC5F0',
            'Arn',
          ],
        },
        ResourcesVpcConfig: {
          SubnetIds: [
            { Ref: 'vpcPublicSubnet1Subnet2E65531E' },
            { Ref: 'vpcPublicSubnet2Subnet009B674F' },
            { Ref: 'vpcPrivateSubnet1Subnet934893E8' },
            { Ref: 'vpcPrivateSubnet2Subnet7031C2BA' },
          ],
          SecurityGroupIds: [{
            'Fn::GetAtt': ['CreateClusterControlPlaneSecurityGroupF810968F', 'GroupId'],
          }],
          EndpointPrivateAccess: false,
          EndpointPublicAccess: true,
          PublicAccessCidrs: [{ 0: '0.0.0.0/4' }],
        },
        ClientRequestToken: 'clientRequestToken',
        EncryptionConfig: [encryptionConfiguration],
        Version: '1.18',
      },
    });
  });

  test('Create Cluster Run Job', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const encryptionConfiguration : EncryptionConfig = {
      resources: ['resources'],
      provider: {
        keyArn: 'keyArn',
      },
    };

    const vpc = new ec2.Vpc(stack, 'vpc');

    new ec2.SecurityGroup(stack, 'ControlPlaneSecurityGroup', {
      vpc: vpc,
      description: 'EKS Control Plane Security Group',
    });

    const role = new iam.Role(stack, 'Role', {
      assumedBy: new iam.ServicePrincipal('eks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSClusterPolicy'),
      ],
    });

    // WHEN
    const task = new EksCreateCluster(stack, 'Create Cluster', {
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      name: 'clusterName',
      role: role,
      resourcesVpcConfig: vpc,
      publicCidrs: ['0.0.0.0/4'],
      clientRequestToken: 'clientRequestToken',
      kubernetesVersion: eks.KubernetesVersion.V1_18,
      encryptionConfig: [encryptionConfiguration],
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
            ':states:::eks:createCluster.sync',
          ],
        ],
      },
      End: true,
      Parameters: {
        Name: 'clusterName',
        RoleArn: {
          'Fn::GetAtt': [
            'Role1ABCC5F0',
            'Arn',
          ],
        },
        ResourcesVpcConfig: {
          SubnetIds: [
            { Ref: 'vpcPublicSubnet1Subnet2E65531E' },
            { Ref: 'vpcPublicSubnet2Subnet009B674F' },
            { Ref: 'vpcPrivateSubnet1Subnet934893E8' },
            { Ref: 'vpcPrivateSubnet2Subnet7031C2BA' },
          ],
          SecurityGroupIds: [{
            'Fn::GetAtt': ['CreateClusterControlPlaneSecurityGroupF810968F', 'GroupId'],
          }],
          EndpointPrivateAccess: false,
          EndpointPublicAccess: true,
          PublicAccessCidrs: [{ 0: '0.0.0.0/4' }],
        },
        ClientRequestToken: 'clientRequestToken',
        EncryptionConfig: [encryptionConfiguration],
        Version: '1.18',
      },
    });
  });
});
