import { expect, haveResource, haveResourceLike } from '@aws-cdk/assert-internal';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/core';
import { Test } from 'nodeunit';
import * as eks from '../lib';
import { testFixture } from './util';

/* eslint-disable max-len */

const CLUSTER_VERSION = eks.KubernetesVersion.V1_20;

export = {

  'default ami type is not applied when launch template is configured'(test: Test) {

    // GIVEN
    const { stack, vpc } = testFixture();

    const launchTemplate = new ec2.CfnLaunchTemplate(stack, 'LaunchTemplate', {
      launchTemplateData: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.C5, ec2.InstanceSize.MEDIUM).toString(),
      },
    });

    // WHEN
    const cluster = new eks.Cluster(stack, 'Cluster', {
      vpc,
      defaultCapacity: 0,
      version: CLUSTER_VERSION,
    });
    new eks.Nodegroup(stack, 'Nodegroup', {
      cluster,
      instanceTypes: [ec2.InstanceType.of(ec2.InstanceClass.C5, ec2.InstanceSize.LARGE)],
      launchTemplateSpec: {
        id: launchTemplate.ref,
        version: launchTemplate.attrLatestVersionNumber,
      },
    });

    // THEN
    test.equal(expect(stack).value.Resources.Nodegroup62B4B2C1.Properties.AmiType, undefined);
    test.done();
  },

  'explicit ami type is applied even when launch template is configured'(test: Test) {

    // GIVEN
    const { stack, vpc } = testFixture();

    const launchTemplate = new ec2.CfnLaunchTemplate(stack, 'LaunchTemplate', {
      launchTemplateData: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.C5, ec2.InstanceSize.MEDIUM).toString(),
      },
    });

    // WHEN
    const cluster = new eks.Cluster(stack, 'Cluster', {
      vpc,
      defaultCapacity: 0,
      version: CLUSTER_VERSION,
    });
    new eks.Nodegroup(stack, 'Nodegroup', {
      cluster,
      amiType: eks.NodegroupAmiType.AL2_X86_64,
      launchTemplateSpec: {
        id: launchTemplate.ref,
        version: launchTemplate.attrLatestVersionNumber,
      },
    });

    // THEN
    test.equal(expect(stack).value.Resources.Nodegroup62B4B2C1.Properties.AmiType, 'AL2_x86_64');
    test.done();
  },

  'ami type is taken as is when no instance types are configured'(test: Test) {

    // GIVEN
    const { stack, vpc } = testFixture();

    // WHEN
    const cluster = new eks.Cluster(stack, 'Cluster', {
      vpc,
      defaultCapacity: 0,
      version: CLUSTER_VERSION,
    });
    new eks.Nodegroup(stack, 'Nodegroup', {
      cluster,
      amiType: eks.NodegroupAmiType.AL2_X86_64_GPU,
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::EKS::Nodegroup', {
      AmiType: 'AL2_x86_64_GPU',
    }));
    test.done();
  },

  'create nodegroup correctly'(test: Test) {
    // GIVEN
    const { stack, vpc } = testFixture();

    // WHEN
    const cluster = new eks.Cluster(stack, 'Cluster', {
      vpc,
      defaultCapacity: 0,
      version: CLUSTER_VERSION,
    });
    new eks.Nodegroup(stack, 'Nodegroup', { cluster });

    // THEN
    expect(stack).to(haveResourceLike('AWS::EKS::Nodegroup', {
      ClusterName: {
        Ref: 'Cluster9EE0221C',
      },
      NodeRole: {
        'Fn::GetAtt': [
          'NodegroupNodeGroupRole038A128B',
          'Arn',
        ],
      },
      Subnets: [
        {
          Ref: 'VPCPrivateSubnet1Subnet8BCA10E0',
        },
        {
          Ref: 'VPCPrivateSubnet2SubnetCFCDAA7A',
        },
      ],
      ForceUpdateEnabled: true,
      ScalingConfig: {
        DesiredSize: 2,
        MaxSize: 2,
        MinSize: 1,
      },
    },
    ));
    test.done();
  },
  'aws-auth will be updated'(test: Test) {
    // GIVEN
    const { stack, vpc } = testFixture();

    // WHEN
    const cluster = new eks.Cluster(stack, 'Cluster', {
      vpc,
      defaultCapacity: 0,
      version: CLUSTER_VERSION,
    });
    new eks.Nodegroup(stack, 'Nodegroup', { cluster });

    // THEN
    // THEN
    expect(stack).to(haveResource(eks.KubernetesManifest.RESOURCE_TYPE, {
      Manifest: {
        'Fn::Join': [
          '',
          [
            '[{"apiVersion":"v1","kind":"ConfigMap","metadata":{"name":"aws-auth","namespace":"kube-system","labels":{"aws.cdk.eks/prune-c82ececabf77e03e3590f2ebe02adba8641d1b3e76":""}},"data":{"mapRoles":"[{\\"rolearn\\":\\"',
            {
              'Fn::GetAtt': [
                'ClusterMastersRole9AA35625',
                'Arn',
              ],
            },
            '\\",\\"username\\":\\"',
            {
              'Fn::GetAtt': [
                'ClusterMastersRole9AA35625',
                'Arn',
              ],
            },
            '\\",\\"groups\\":[\\"system:masters\\"]},{\\"rolearn\\":\\"',
            {
              'Fn::GetAtt': [
                'NodegroupNodeGroupRole038A128B',
                'Arn',
              ],
            },
            '\\",\\"username\\":\\"system:node:{{EC2PrivateDNSName}}\\",\\"groups\\":[\\"system:bootstrappers\\",\\"system:nodes\\"]}]","mapUsers":"[]","mapAccounts":"[]"}}]',
          ],
        ],
      },
      ClusterName: {
        Ref: 'Cluster9EE0221C',
      },
      RoleArn: {
        'Fn::GetAtt': [
          'ClusterCreationRole360249B6',
          'Arn',
        ],
      },
      PruneLabel: 'aws.cdk.eks/prune-c82ececabf77e03e3590f2ebe02adba8641d1b3e76',
    }));
    test.done();
  },
  'create nodegroup correctly with security groups provided'(test: Test) {
    // GIVEN
    const { stack, vpc } = testFixture();

    // WHEN
    const cluster = new eks.Cluster(stack, 'Cluster', {
      vpc,
      defaultCapacity: 0,
      version: CLUSTER_VERSION,
    });
    new eks.Nodegroup(stack, 'Nodegroup', {
      cluster,
      remoteAccess: {
        sshKeyName: 'foo',
        sourceSecurityGroups: [new ec2.SecurityGroup(stack, 'SG', { vpc })],
      },
    });
    // THEN
    expect(stack).to(haveResource('AWS::EKS::Nodegroup', {
      RemoteAccess: {
        Ec2SshKey: 'foo',
        SourceSecurityGroups: [
          {
            'Fn::GetAtt': [
              'SGADB53937',
              'GroupId',
            ],
          },
        ],
      },
    },
    ));
    test.done();
  },
  'create nodegroup with forceUpdate disabled'(test: Test) {
    // GIVEN
    const { stack, vpc } = testFixture();

    // WHEN
    const cluster = new eks.Cluster(stack, 'Cluster', {
      vpc,
      defaultCapacity: 0,
      version: CLUSTER_VERSION,
    });
    new eks.Nodegroup(stack, 'Nodegroup', { cluster, forceUpdate: false });

    // THEN
    expect(stack).to(haveResourceLike('AWS::EKS::Nodegroup', {
      ForceUpdateEnabled: false,
    },
    ));
    test.done();
  },
  'create nodegroup with instanceType provided'(test: Test) {
    // GIVEN
    const { stack, vpc } = testFixture();

    // WHEN
    const cluster = new eks.Cluster(stack, 'Cluster', {
      vpc,
      defaultCapacity: 0,
      version: CLUSTER_VERSION,
    });
    new eks.Nodegroup(stack, 'Nodegroup', {
      cluster,
      instanceType: new ec2.InstanceType('m5.large'),
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::EKS::Nodegroup', {
      InstanceTypes: [
        'm5.large',
      ],
    },
    ));
    test.done();
  },
  'create nodegroup with on-demand capacity type'(test: Test) {
    // GIVEN
    const { stack, vpc } = testFixture();

    // WHEN
    const cluster = new eks.Cluster(stack, 'Cluster', {
      vpc,
      defaultCapacity: 0,
      version: CLUSTER_VERSION,
    });
    new eks.Nodegroup(stack, 'Nodegroup', {
      cluster,
      instanceType: new ec2.InstanceType('m5.large'),
      capacityType: eks.CapacityType.ON_DEMAND,
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::EKS::Nodegroup', {
      InstanceTypes: [
        'm5.large',
      ],
      CapacityType: 'ON_DEMAND',
    },
    ));
    test.done();
  },
  'create nodegroup with spot capacity type'(test: Test) {
    // GIVEN
    const { stack, vpc } = testFixture();

    // WHEN
    const cluster = new eks.Cluster(stack, 'Cluster', {
      vpc,
      defaultCapacity: 0,
      version: CLUSTER_VERSION,
    });
    new eks.Nodegroup(stack, 'Nodegroup', {
      cluster,
      instanceTypes: [
        new ec2.InstanceType('m5.large'),
        new ec2.InstanceType('t3.large'),
        new ec2.InstanceType('c5.large'),
      ],
      capacityType: eks.CapacityType.SPOT,
    });
    // THEN
    expect(stack).to(haveResourceLike('AWS::EKS::Nodegroup', {
      InstanceTypes: [
        'm5.large',
        't3.large',
        'c5.large',
      ],
      CapacityType: 'SPOT',
    },
    ));
    test.done();
  },
  'create nodegroup with on-demand capacity type and multiple instance types'(test: Test) {
    // GIVEN
    const { stack, vpc } = testFixture();

    // WHEN
    const cluster = new eks.Cluster(stack, 'Cluster', {
      vpc,
      defaultCapacity: 0,
      version: CLUSTER_VERSION,
    });
    new eks.Nodegroup(stack, 'Nodegroup', {
      cluster,
      instanceTypes: [
        new ec2.InstanceType('m5.large'),
        new ec2.InstanceType('t3.large'),
        new ec2.InstanceType('c5.large'),
      ],
      capacityType: eks.CapacityType.ON_DEMAND,
    });
    // THEN
    expect(stack).to(haveResourceLike('AWS::EKS::Nodegroup', {
      InstanceTypes: [
        'm5.large',
        't3.large',
        'c5.large',
      ],
      CapacityType: 'ON_DEMAND',
    },
    ));
    test.done();
  },
  'throws when both instanceTypes and instanceType defined'(test: Test) {
    // GIVEN
    const { stack, vpc } = testFixture();

    // WHEN
    const cluster = new eks.Cluster(stack, 'Cluster', {
      vpc,
      defaultCapacity: 0,
      version: CLUSTER_VERSION,
    });
    // THEN
    test.throws(() => cluster.addNodegroupCapacity('ng', {
      instanceType: new ec2.InstanceType('m5.large'),
      instanceTypes: [
        new ec2.InstanceType('m5.large'),
        new ec2.InstanceType('t3.large'),
        new ec2.InstanceType('c5.large'),
      ],
      capacityType: eks.CapacityType.SPOT,
    }), /"instanceType is deprecated, please use "instanceTypes" only/);
    test.done();
  },
  'create nodegroup with neither instanceTypes nor instanceType defined'(test: Test) {
    // GIVEN
    const { stack, vpc } = testFixture();

    // WHEN
    const cluster = new eks.Cluster(stack, 'Cluster', {
      vpc,
      version: CLUSTER_VERSION,
    });
    new eks.Nodegroup(stack, 'Nodegroup', {
      cluster,
      capacityType: eks.CapacityType.SPOT,
    });
    // THEN
    expect(stack).to(haveResourceLike('AWS::EKS::Nodegroup', {
      CapacityType: 'SPOT',
    },
    ));
    test.done();
  },
  'throws when instanceTypes provided with different CPU architrcture'(test: Test) {
    // GIVEN
    const { stack, vpc } = testFixture();
    const cluster = new eks.Cluster(stack, 'Cluster', {
      vpc,
      defaultCapacity: 0,
      version: CLUSTER_VERSION,
    });
    // THEN
    test.throws(() => cluster.addNodegroupCapacity('ng', {
      instanceTypes: [
        // X86
        new ec2.InstanceType('c5.large'),
        new ec2.InstanceType('c5a.large'),
        // ARM64
        new ec2.InstanceType('m6g.large'),
      ],
    }), /instanceTypes of different CPU architectures is not allowed/);
    test.done();
  },
  'throws when amiType provided is incorrect'(test: Test) {
    // GIVEN
    const { stack, vpc } = testFixture();
    const cluster = new eks.Cluster(stack, 'Cluster', {
      vpc,
      defaultCapacity: 0,
      version: CLUSTER_VERSION,
    });
    // THEN
    test.throws(() => cluster.addNodegroupCapacity('ng', {
      instanceTypes: [
        new ec2.InstanceType('c5.large'),
        new ec2.InstanceType('c5a.large'),
        new ec2.InstanceType('c5d.large'),
      ],
      // incorrect amiType
      amiType: eks.NodegroupAmiType.AL2_ARM_64,
    }), /The specified AMI does not match the instance types architecture/);
    test.done();
  },

  'remoteAccess without security group provided'(test: Test) {
    // GIVEN
    const { stack, vpc } = testFixture();

    // WHEN
    const cluster = new eks.Cluster(stack, 'Cluster', {
      vpc,
      defaultCapacity: 0,
      version: CLUSTER_VERSION,
    });
    new eks.Nodegroup(stack, 'Nodegroup', {
      cluster,
      remoteAccess: {
        sshKeyName: 'foo',
      },
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::EKS::Nodegroup', {
      RemoteAccess: {
        Ec2SshKey: 'foo',
      },
    },
    ));
    test.done();
  },

  'import nodegroup correctly'(test: Test) {
    // GIVEN
    const { stack: stack1, vpc, app } = testFixture();
    const stack2 = new cdk.Stack(app, 'stack2', { env: { region: 'us-east-1' } });
    const cluster = new eks.Cluster(stack1, 'Cluster', {
      vpc,
      defaultCapacity: 0,
      version: CLUSTER_VERSION,
    });

    // WHEN
    // const cluster = new eks.Cluster(stack, 'Cluster', { vpc, kubectlEnabled: true, defaultCapacity: 0 });
    const ng = new eks.Nodegroup(stack1, 'Nodegroup', { cluster });
    const imported = eks.Nodegroup.fromNodegroupName(stack2, 'ImportedNg', ng.nodegroupName);
    new cdk.CfnOutput(stack2, 'NodegroupName', { value: imported.nodegroupName });

    // THEN
    expect(stack2).toMatch({
      Outputs: {
        NodegroupName: {
          Value: {
            'Fn::ImportValue': 'Stack:ExportsOutputRefNodegroup62B4B2C1EF8AB7C1',
          },
        },
      },
    });
    test.done();
  },
  'addNodegroup correctly'(test: Test) {
    // GIVEN
    const { stack, vpc } = testFixture();
    const cluster = new eks.Cluster(stack, 'Cluster', {
      vpc,
      defaultCapacity: 0,
      version: CLUSTER_VERSION,
    });

    // WHEN
    cluster.addNodegroupCapacity('ng');

    // THEN
    expect(stack).to(haveResourceLike('AWS::EKS::Nodegroup', {
      ClusterName: {
        Ref: 'Cluster9EE0221C',
      },
      NodeRole: {
        'Fn::GetAtt': [
          'ClusterNodegroupngNodeGroupRoleDA0D35DA',
          'Arn',
        ],
      },
      Subnets: [
        {
          Ref: 'VPCPrivateSubnet1Subnet8BCA10E0',
        },
        {
          Ref: 'VPCPrivateSubnet2SubnetCFCDAA7A',
        },
      ],
      ForceUpdateEnabled: true,
      ScalingConfig: {
        DesiredSize: 2,
        MaxSize: 2,
        MinSize: 1,
      },
    },
    ));
    test.done();
  },
  'add node group with taints'(test: Test) {
    // GIVEN
    const { stack, vpc } = testFixture();
    const cluster = new eks.Cluster(stack, 'Cluster', {
      vpc,
      defaultCapacity: 0,
      version: CLUSTER_VERSION,
    });

    // WHEN
    cluster.addNodegroupCapacity('ng', {
      taints: [
        {
          effect: eks.TaintEffect.NO_SCHEDULE,
          key: 'foo',
          value: 'bar',
        },
      ],
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::EKS::Nodegroup', {
      ClusterName: {
        Ref: 'Cluster9EE0221C',
      },
      Taints: [
        {
          Effect: 'NO_SCHEDULE',
          Key: 'foo',
          Value: 'bar',
        },
      ],
    },
    ));
    test.done();
  },
  'throws when desiredSize > maxSize'(test: Test) {
    // GIVEN
    const { stack, vpc } = testFixture();
    const cluster = new eks.Cluster(stack, 'Cluster', {
      vpc,
      defaultCapacity: 0,
      version: CLUSTER_VERSION,
    });
    // THEN
    test.throws(() => cluster.addNodegroupCapacity('ng', { desiredSize: 3, maxSize: 2 }), /Desired capacity 3 can't be greater than max size 2/);
    test.done();
  },
  'throws when desiredSize < minSize'(test: Test) {
    // GIVEN
    const { stack, vpc } = testFixture();
    const cluster = new eks.Cluster(stack, 'Cluster', {
      vpc,
      defaultCapacity: 0,
      version: CLUSTER_VERSION,
    });
    // THEN
    test.throws(() => cluster.addNodegroupCapacity('ng', { desiredSize: 2, minSize: 3 }), /Minimum capacity 3 can't be greater than desired size 2/);
    test.done();
  },
  'can set minSize , maxSize and DesiredSize'(test: Test) {
    // GIVEN
    const { stack, vpc } = testFixture();
    const cluster = new eks.Cluster(stack, 'Cluster', {
      vpc,
      defaultCapacity: 0,
      version: CLUSTER_VERSION,
    });
    // WHEN
    new eks.Nodegroup(stack, 'NodeGroup', {
      cluster: cluster,
      minSize: 2,
      maxSize: 6,
      desiredSize: 4,
    });
    // THEN
    expect(stack).to(haveResourceLike('AWS::EKS::Nodegroup', {
      ScalingConfig: {
        MinSize: 2,
        MaxSize: 6,
        DesiredSize: 4,
      },
    },
    ));
    test.done();
  },
  'validation is not performed when using Tokens'(test: Test) {
    // GIVEN
    const { stack, vpc } = testFixture();
    const cluster = new eks.Cluster(stack, 'Cluster', {
      vpc,
      defaultCapacity: 0,
      version: CLUSTER_VERSION,
    });
    // WHEN
    new eks.Nodegroup(stack, 'NodeGroup', {
      cluster: cluster,
      minSize: cdk.Lazy.number({ produce: () => 2 }),
      maxSize: cdk.Lazy.number({ produce: () => 6 }),
      desiredSize: cdk.Lazy.number({ produce: () => 4 }),
    });
    // THEN
    expect(stack).to(haveResourceLike('AWS::EKS::Nodegroup', {
      ScalingConfig: {
        MinSize: 2,
        MaxSize: 6,
        DesiredSize: 4,
      },
    },
    ));
    test.done();
  },
  'create nodegroup correctly with launch template'(test: Test) {
    // GIVEN
    const { stack, vpc } = testFixture();

    // WHEN
    const cluster = new eks.Cluster(stack, 'Cluster', {
      vpc,
      defaultCapacity: 0,
      version: CLUSTER_VERSION,
    });
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'set -o xtrace',
      `/etc/eks/bootstrap.sh ${cluster.clusterName}`,
    );
    const lt = new ec2.CfnLaunchTemplate(stack, 'LaunchTemplate', {
      launchTemplateData: {
        imageId: new eks.EksOptimizedImage().getImage(stack).imageId,
        instanceType: new ec2.InstanceType('t3.small').toString(),
        userData: cdk.Fn.base64(userData.render()),
      },
    });
    cluster.addNodegroupCapacity('ng-lt', {
      launchTemplateSpec: {
        id: lt.ref,
        version: lt.attrDefaultVersionNumber,
      },
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::EKS::Nodegroup', {
      LaunchTemplate: {
        Id: {
          Ref: 'LaunchTemplate',
        },
        Version: {
          'Fn::GetAtt': [
            'LaunchTemplate',
            'DefaultVersionNumber',
          ],
        },
      },
    },
    ));
    test.done();
  },
  'throws when both diskSize and launch template specified'(test: Test) {
    // GIVEN
    const { stack, vpc } = testFixture();

    // WHEN
    const cluster = new eks.Cluster(stack, 'Cluster', {
      vpc,
      defaultCapacity: 0,
      version: CLUSTER_VERSION,
    });
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'set -o xtrace',
      `/etc/eks/bootstrap.sh ${cluster.clusterName}`,
    );
    const lt = new ec2.CfnLaunchTemplate(stack, 'LaunchTemplate', {
      launchTemplateData: {
        imageId: new eks.EksOptimizedImage().getImage(stack).imageId,
        instanceType: new ec2.InstanceType('t3.small').toString(),
        userData: cdk.Fn.base64(userData.render()),
      },
    });
    // THEN
    test.throws(() =>
      cluster.addNodegroupCapacity('ng-lt', {
        diskSize: 100,
        launchTemplateSpec: {
          id: lt.ref,
          version: lt.attrDefaultVersionNumber,
        },
      }), /diskSize must be specified within the launch template/);
    test.done();
  },
};
