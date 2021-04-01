import { expect, haveResource, haveResourceLike, ResourcePart } from '@aws-cdk/assert';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import { Stack, Tags } from '@aws-cdk/core';
import { Test } from 'nodeunit';
import * as eks from '../lib';


const CLUSTER_VERSION = eks.KubernetesVersion.V1_19;

export = {
  'can be added to a cluster'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const cluster = new eks.Cluster(stack, 'MyCluster', { version: CLUSTER_VERSION });

    // WHEN
    cluster.addFargateProfile('MyProfile', {
      selectors: [{ namespace: 'default' }],
    });

    // THEN
    expect(stack).to(haveResource('Custom::AWSCDK-EKS-FargateProfile', {
      Config: {
        clusterName: { Ref: 'MyCluster8AD82BF8' },
        podExecutionRoleArn: { 'Fn::GetAtt': ['MyClusterfargateprofileMyProfilePodExecutionRole4795C054', 'Arn'] },
        selectors: [{ namespace: 'default' }],
      },
    }));
    test.done();
  },

  'supports specifying a profile name'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const cluster = new eks.Cluster(stack, 'MyCluster', { version: CLUSTER_VERSION });

    // WHEN
    cluster.addFargateProfile('MyProfile', {
      fargateProfileName: 'MyProfileName',
      selectors: [{ namespace: 'default' }],
    });

    // THEN
    expect(stack).to(haveResource('Custom::AWSCDK-EKS-FargateProfile', {
      Config: {
        clusterName: { Ref: 'MyCluster8AD82BF8' },
        podExecutionRoleArn: { 'Fn::GetAtt': ['MyClusterfargateprofileMyProfilePodExecutionRole4795C054', 'Arn'] },
        selectors: [{ namespace: 'default' }],
        fargateProfileName: 'MyProfileName',
      },
    }));
    test.done();
  },

  'supports custom execution role'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const cluster = new eks.Cluster(stack, 'MyCluster', { version: CLUSTER_VERSION });
    const myRole = new iam.Role(stack, 'MyRole', { assumedBy: new iam.AnyPrincipal() });

    // WHEN
    cluster.addFargateProfile('MyProfile', {
      podExecutionRole: myRole,
      selectors: [{ namespace: 'default' }],
    });

    // THEN
    expect(stack).to(haveResource('Custom::AWSCDK-EKS-FargateProfile', {
      Config: {
        clusterName: { Ref: 'MyCluster8AD82BF8' },
        podExecutionRoleArn: { 'Fn::GetAtt': ['MyRoleF48FFE04', 'Arn'] },
        selectors: [{ namespace: 'default' }],
      },
    }));
    test.done();
  },

  'supports tags through aspects'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const cluster = new eks.Cluster(stack, 'MyCluster', { version: CLUSTER_VERSION });

    // WHEN
    cluster.addFargateProfile('MyProfile', {
      selectors: [{ namespace: 'default' }],
    });

    Tags.of(stack).add('aspectTag', 'hello');
    Tags.of(cluster).add('propTag', '123');

    // THEN
    expect(stack).to(haveResource('Custom::AWSCDK-EKS-FargateProfile', {
      Config: {
        selectors: [{ namespace: 'default' }],
        clusterName: { Ref: 'MyCluster8AD82BF8' },
        podExecutionRoleArn: { 'Fn::GetAtt': ['MyClusterfargateprofileMyProfilePodExecutionRole4795C054', 'Arn'] },
        tags: {
          propTag: '123',
          aspectTag: 'hello',
        },
      },
    }));
    test.done();
  },

  'supports specifying vpc'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const cluster = new eks.Cluster(stack, 'MyCluster', { version: CLUSTER_VERSION });
    const vpc = ec2.Vpc.fromVpcAttributes(stack, 'MyVpc', {
      vpcId: 'vpc123',
      availabilityZones: ['az1'],
      privateSubnetIds: ['priv1'],
    });

    // WHEN
    cluster.addFargateProfile('MyProfile', {
      selectors: [{ namespace: 'default' }],
      vpc,
    });

    // THEN
    expect(stack).to(haveResource('Custom::AWSCDK-EKS-FargateProfile', {
      Config: {
        clusterName: { Ref: 'MyCluster8AD82BF8' },
        podExecutionRoleArn: { 'Fn::GetAtt': ['MyClusterfargateprofileMyProfilePodExecutionRole4795C054', 'Arn'] },
        selectors: [{ namespace: 'default' }],
        subnets: ['priv1'],
      },
    }));
    test.done();
  },

  'fails if there are no selectors or if there are more than 5'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const cluster = new eks.Cluster(stack, 'MyCluster', { version: CLUSTER_VERSION });

    // THEN
    test.throws(() => cluster.addFargateProfile('MyProfile', { selectors: [] }));
    test.throws(() => cluster.addFargateProfile('MyProfile', {
      selectors: [
        { namespace: '1' },
        { namespace: '2' },
        { namespace: '3' },
        { namespace: '4' },
        { namespace: '5' },
        { namespace: '6' },
      ],
    }));
    test.done();
  },

  'FargateCluster creates an EKS cluster fully managed by Fargate'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new eks.FargateCluster(stack, 'FargateCluster', { version: CLUSTER_VERSION });

    // THEN
    expect(stack).to(haveResource('Custom::AWSCDK-EKS-KubernetesPatch', {
      ResourceName: 'deployment/coredns',
      ResourceNamespace: 'kube-system',
      ApplyPatchJson: '{"spec":{"template":{"metadata":{"annotations":{"eks.amazonaws.com/compute-type":"fargate"}}}}}',
      RestorePatchJson: '{"spec":{"template":{"metadata":{"annotations":{"eks.amazonaws.com/compute-type":"ec2"}}}}}',
      ClusterName: {
        Ref: 'FargateCluster019F03E8',
      },
    }));

    expect(stack).to(haveResource('Custom::AWSCDK-EKS-FargateProfile', {
      Config: {
        clusterName: {
          Ref: 'FargateCluster019F03E8',
        },
        podExecutionRoleArn: {
          'Fn::GetAtt': [
            'FargateClusterfargateprofiledefaultPodExecutionRole66F2610E',
            'Arn',
          ],
        },
        selectors: [
          { namespace: 'default' },
          { namespace: 'kube-system' },
        ],
      },
    }));
    test.done();
  },

  'can create FargateCluster with a custom profile'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new eks.FargateCluster(stack, 'FargateCluster', {
      defaultProfile: {
        fargateProfileName: 'my-app', selectors: [{ namespace: 'foo' }, { namespace: 'bar' }],
      },
      version: CLUSTER_VERSION,
    });

    // THEN
    expect(stack).to(haveResource('Custom::AWSCDK-EKS-FargateProfile', {
      Config: {
        clusterName: {
          Ref: 'FargateCluster019F03E8',
        },
        fargateProfileName: 'my-app',
        podExecutionRoleArn: {
          'Fn::GetAtt': [
            'FargateClusterfargateprofilemyappPodExecutionRole875B4635',
            'Arn',
          ],
        },
        selectors: [
          { namespace: 'foo' },
          { namespace: 'bar' },
        ],
      },
    }));
    test.done();
  },

  'custom profile name is "custom" if no custom profile name is provided'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new eks.FargateCluster(stack, 'FargateCluster', {
      defaultProfile: {
        selectors: [{ namespace: 'foo' }, { namespace: 'bar' }],
      },
      version: CLUSTER_VERSION,
    });

    // THEN
    expect(stack).to(haveResource('Custom::AWSCDK-EKS-FargateProfile', {
      Config: {
        clusterName: {
          Ref: 'FargateCluster019F03E8',
        },
        podExecutionRoleArn: {
          'Fn::GetAtt': [
            'FargateClusterfargateprofilecustomPodExecutionRoleDB415F19',
            'Arn',
          ],
        },
        selectors: [
          { namespace: 'foo' },
          { namespace: 'bar' },
        ],
      },
    }));
    test.done();
  },

  'multiple Fargate profiles added to a cluster are processed sequentially'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const cluster = new eks.Cluster(stack, 'MyCluster', { version: CLUSTER_VERSION });

    // WHEN
    cluster.addFargateProfile('MyProfile1', {
      selectors: [{ namespace: 'namespace1' }],
    });
    cluster.addFargateProfile('MyProfile2', {
      selectors: [{ namespace: 'namespace2' }],
    });

    // THEN
    expect(stack).to(haveResource('Custom::AWSCDK-EKS-FargateProfile', {
      Config: {
        clusterName: { Ref: 'MyCluster8AD82BF8' },
        podExecutionRoleArn: { 'Fn::GetAtt': ['MyClusterfargateprofileMyProfile1PodExecutionRole794E9E37', 'Arn'] },
        selectors: [{ namespace: 'namespace1' }],
      },
    }));
    expect(stack).to(haveResource('Custom::AWSCDK-EKS-FargateProfile', {
      Properties: {
        ServiceToken: {
          'Fn::GetAtt': [
            'awscdkawseksClusterResourceProviderNestedStackawscdkawseksClusterResourceProviderNestedStackResource9827C454',
            'Outputs.awscdkawseksClusterResourceProviderframeworkonEventEA97AA31Arn',
          ],
        },
        AssumeRoleArn: { 'Fn::GetAtt': ['MyClusterCreationRoleB5FA4FF3', 'Arn'] },
        Config: {
          clusterName: { Ref: 'MyCluster8AD82BF8' },
          podExecutionRoleArn: { 'Fn::GetAtt': ['MyClusterfargateprofileMyProfile2PodExecutionRoleD1151CCF', 'Arn'] },
          selectors: [{ namespace: 'namespace2' }],
        },
      },
      DependsOn: [
        'MyClusterfargateprofileMyProfile1PodExecutionRole794E9E37',
        'MyClusterfargateprofileMyProfile1879D501A',
      ],
    }, ResourcePart.CompleteDefinition));

    test.done();
  },

  'fargate role is added to RBAC'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new eks.FargateCluster(stack, 'FargateCluster', { version: CLUSTER_VERSION });

    // THEN
    expect(stack).to(haveResource('Custom::AWSCDK-EKS-KubernetesResource', {
      Manifest: {
        'Fn::Join': [
          '',
          [
            '[{"apiVersion":"v1","kind":"ConfigMap","metadata":{"name":"aws-auth","namespace":"kube-system","labels":{"aws.cdk.eks/prune-c858eb9c291620a59a3334f61f9b8a259e9786af60":""}},"data":{"mapRoles":"[{\\"rolearn\\":\\"',
            {
              'Fn::GetAtt': [
                'FargateClusterMastersRole50BAF9FD',
                'Arn',
              ],
            },
            '\\",\\"username\\":\\"',
            {
              'Fn::GetAtt': [
                'FargateClusterMastersRole50BAF9FD',
                'Arn',
              ],
            },
            '\\",\\"groups\\":[\\"system:masters\\"]},{\\"rolearn\\":\\"',
            {
              'Fn::GetAtt': [
                'FargateClusterfargateprofiledefaultPodExecutionRole66F2610E',
                'Arn',
              ],
            },
            '\\",\\"username\\":\\"system:node:{{SessionName}}\\",\\"groups\\":[\\"system:bootstrappers\\",\\"system:nodes\\",\\"system:node-proxier\\"]}]","mapUsers":"[]","mapAccounts":"[]"}}]',
          ],
        ],
      },
    }));
    test.done();
  },

  'allow cluster creation role to iam:PassRole on fargate pod execution role'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new eks.FargateCluster(stack, 'FargateCluster', { version: CLUSTER_VERSION });

    // THEN
    expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'iam:PassRole',
            Effect: 'Allow',
            Resource: {
              'Fn::GetAtt': [
                'FargateClusterRole8E36B33A',
                'Arn',
              ],
            },
          },
          {
            Action: [
              'eks:CreateCluster',
              'eks:DescribeCluster',
              'eks:DescribeUpdate',
              'eks:DeleteCluster',
              'eks:UpdateClusterVersion',
              'eks:UpdateClusterConfig',
              'eks:CreateFargateProfile',
              'eks:TagResource',
              'eks:UntagResource',
            ],
            Effect: 'Allow',
            Resource: [
              '*',
            ],
          },
          {
            Action: [
              'eks:DescribeFargateProfile',
              'eks:DeleteFargateProfile',
            ],
            Effect: 'Allow',
            Resource: '*',
          },
          {
            Action: ['iam:GetRole', 'iam:listAttachedRolePolicies'],
            Effect: 'Allow',
            Resource: '*',
          },
          {
            Action: 'iam:CreateServiceLinkedRole',
            Effect: 'Allow',
            Resource: '*',
          },
          {
            Action: [
              'ec2:DescribeInstances',
              'ec2:DescribeNetworkInterfaces',
              'ec2:DescribeSecurityGroups',
              'ec2:DescribeSubnets',
              'ec2:DescribeRouteTables',
              'ec2:DescribeDhcpOptions',
              'ec2:DescribeVpcs',
            ],
            Effect: 'Allow',
            Resource: '*',
          },
          {
            Action: 'iam:PassRole',
            Effect: 'Allow',
            Resource: {
              'Fn::GetAtt': [
                'FargateClusterfargateprofiledefaultPodExecutionRole66F2610E',
                'Arn',
              ],
            },
          },
        ],
      },
    }));
    test.done();
  },

  'supports passing secretsEncryptionKey with FargateCluster'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN

    new eks.FargateCluster(stack, 'FargateCluster', {
      version: CLUSTER_VERSION,
      secretsEncryptionKey: new kms.Key(stack, 'Key'),
    });

    // THEN
    expect(stack).to(haveResourceLike('Custom::AWSCDK-EKS-Cluster', {
      Config: {
        encryptionConfig: [{
          provider: {
            keyArn: {
              'Fn::GetAtt': [
                'Key961B73FD',
                'Arn',
              ],
            },
          },
          resources: ['secrets'],
        }],
      },
    }));
    test.done();
  },
};
