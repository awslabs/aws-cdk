import { countResources, expect, haveResource } from '@aws-cdk/assert-internal';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import { Test } from 'nodeunit';
import { Cluster, KubernetesManifest, KubernetesVersion } from '../lib';
import { AwsAuth } from '../lib/aws-auth';
import { testFixtureNoVpc } from './util';

/* eslint-disable max-len */

const CLUSTER_VERSION = KubernetesVersion.V1_16;

export = {

  'throws when adding a role from a different stack'(test: Test) {
    const app = new cdk.App();
    const clusterStack = new cdk.Stack(app, 'ClusterStack');
    const roleStack = new cdk.Stack(app, 'RoleStack');
    const awsAuth = new AwsAuth(clusterStack, 'Auth', {
      cluster: new Cluster(clusterStack, 'Cluster', { version: KubernetesVersion.V1_17 }),
    });
    const role = new iam.Role(roleStack, 'Role', { assumedBy: new iam.AnyPrincipal() });

    try {
      awsAuth.addRoleMapping(role, { groups: ['group'] });
      test.ok(false, 'expected error');
    } catch (err) {
      test.equal(err.message, 'RoleStack/Role should be defined in the scope of the ClusterStack stack to prevent circular dependencies');
    }

    test.done();
  },

  'throws when adding a user from a different stack'(test: Test) {
    const app = new cdk.App();
    const clusterStack = new cdk.Stack(app, 'ClusterStack');
    const userStack = new cdk.Stack(app, 'UserStack');
    const awsAuth = new AwsAuth(clusterStack, 'Auth', {
      cluster: new Cluster(clusterStack, 'Cluster', { version: KubernetesVersion.V1_17 }),
    });
    const user = new iam.User(userStack, 'User');

    try {
      awsAuth.addUserMapping(user, { groups: ['group'] });
      test.ok(false, 'expected error');
    } catch (err) {
      test.equal(err.message, 'UserStack/User should be defined in the scope of the ClusterStack stack to prevent circular dependencies');
    }

    test.done();
  },

  'empty aws-auth'(test: Test) {
    // GIVEN
    const { stack } = testFixtureNoVpc();
    const cluster = new Cluster(stack, 'cluster', { version: CLUSTER_VERSION, prune: false });

    // WHEN
    new AwsAuth(stack, 'AwsAuth', { cluster });

    // THEN
    expect(stack).to(haveResource(KubernetesManifest.RESOURCE_TYPE, {
      Manifest: JSON.stringify([{
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: { name: 'aws-auth', namespace: 'kube-system' },
        data: { mapRoles: '[]', mapUsers: '[]', mapAccounts: '[]' },
      }]),
    }));
    test.done();
  },

  'addRoleMapping and addUserMapping can be used to define the aws-auth ConfigMap'(test: Test) {
    // GIVEN
    const { stack } = testFixtureNoVpc();
    const cluster = new Cluster(stack, 'Cluster', { version: CLUSTER_VERSION, prune: false });
    const role = new iam.Role(stack, 'role', { assumedBy: new iam.AnyPrincipal() });
    const user = new iam.User(stack, 'user');

    // WHEN
    cluster.awsAuth.addRoleMapping(role, { groups: ['role-group1'], username: 'roleuser' });
    cluster.awsAuth.addRoleMapping(role, { groups: ['role-group2', 'role-group3'] });
    cluster.awsAuth.addUserMapping(user, { groups: ['user-group1', 'user-group2'] });
    cluster.awsAuth.addUserMapping(user, { groups: ['user-group1', 'user-group2'], username: 'foo' });
    cluster.awsAuth.addAccount('112233');
    cluster.awsAuth.addAccount('5566776655');

    // THEN
    expect(stack).to(countResources(KubernetesManifest.RESOURCE_TYPE, 1));
    expect(stack).to(haveResource(KubernetesManifest.RESOURCE_TYPE, {
      Manifest: {
        'Fn::Join': [
          '',
          [
            '[{"apiVersion":"v1","kind":"ConfigMap","metadata":{"name":"aws-auth","namespace":"kube-system"},"data":{"mapRoles":"[{\\"rolearn\\":\\"',
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
                'ClusterNodegroupDefaultCapacityNodeGroupRole55953B04',
                'Arn',
              ],
            },
            '\\",\\"username\\":\\"system:node:{{EC2PrivateDNSName}}\\",\\"groups\\":[\\"system:bootstrappers\\",\\"system:nodes\\"]},{\\"rolearn\\":\\"',
            {
              'Fn::GetAtt': [
                'roleC7B7E775',
                'Arn',
              ],
            },
            '\\",\\"username\\":\\"roleuser\\",\\"groups\\":[\\"role-group1\\"]},{\\"rolearn\\":\\"',
            {
              'Fn::GetAtt': [
                'roleC7B7E775',
                'Arn',
              ],
            },
            '\\",\\"username\\":\\"',
            {
              'Fn::GetAtt': [
                'roleC7B7E775',
                'Arn',
              ],
            },
            '\\",\\"groups\\":[\\"role-group2\\",\\"role-group3\\"]}]","mapUsers":"[{\\"userarn\\":\\"',
            {
              'Fn::GetAtt': [
                'user2C2B57AE',
                'Arn',
              ],
            },
            '\\",\\"username\\":\\"',
            {
              'Fn::GetAtt': [
                'user2C2B57AE',
                'Arn',
              ],
            },
            '\\",\\"groups\\":[\\"user-group1\\",\\"user-group2\\"]},{\\"userarn\\":\\"',
            {
              'Fn::GetAtt': [
                'user2C2B57AE',
                'Arn',
              ],
            },
            '\\",\\"username\\":\\"foo\\",\\"groups\\":[\\"user-group1\\",\\"user-group2\\"]}]","mapAccounts":"[\\"112233\\",\\"5566776655\\"]"}}]',
          ],
        ],
      },
    }));

    test.done();
  },

  'imported users and roles can be also be used'(test: Test) {
    // GIVEN
    const { stack } = testFixtureNoVpc();
    const cluster = new Cluster(stack, 'Cluster', { version: CLUSTER_VERSION });
    const role = iam.Role.fromRoleArn(stack, 'imported-role', 'arn:aws:iam::123456789012:role/S3Access');
    const user = iam.User.fromUserName(stack, 'import-user', 'MyUserName');

    // WHEN
    cluster.awsAuth.addRoleMapping(role, { groups: ['group1'] });
    cluster.awsAuth.addUserMapping(user, { groups: ['group2'] });

    // THEN
    expect(stack).to(haveResource(KubernetesManifest.RESOURCE_TYPE, {
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
                'ClusterNodegroupDefaultCapacityNodeGroupRole55953B04',
                'Arn',
              ],
            },
            '\\",\\"username\\":\\"system:node:{{EC2PrivateDNSName}}\\",\\"groups\\":[\\"system:bootstrappers\\",\\"system:nodes\\"]},{\\"rolearn\\":\\"arn:aws:iam::123456789012:role/S3Access\\",\\"username\\":\\"arn:aws:iam::123456789012:role/S3Access\\",\\"groups\\":[\\"group1\\"]}]","mapUsers":"[{\\"userarn\\":\\"arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':iam::',
            {
              Ref: 'AWS::AccountId',
            },
            ':user/MyUserName\\",\\"username\\":\\"arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':iam::',
            {
              Ref: 'AWS::AccountId',
            },
            ':user/MyUserName\\",\\"groups\\":[\\"group2\\"]}]","mapAccounts":"[]"}}]',
          ],
        ],
      },
    }));

    test.done();
  },
  'addMastersRole after addNodegroup correctly'(test: Test) {
    // GIVEN
    const { stack } = testFixtureNoVpc();
    const cluster = new Cluster(stack, 'Cluster', { version: CLUSTER_VERSION, prune: false });
    cluster.addNodegroupCapacity('NG');
    const role = iam.Role.fromRoleArn(stack, 'imported-role', 'arn:aws:iam::123456789012:role/S3Access');

    // WHEN
    cluster.awsAuth.addMastersRole(role);

    // THEN
    expect(stack).to(haveResource(KubernetesManifest.RESOURCE_TYPE, {
      Manifest: {
        'Fn::Join': [
          '',
          [
            '[{"apiVersion":"v1","kind":"ConfigMap","metadata":{"name":"aws-auth","namespace":"kube-system"},"data":{"mapRoles":"[{\\"rolearn\\":\\"',
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
                'ClusterNodegroupDefaultCapacityNodeGroupRole55953B04',
                'Arn',
              ],
            },
            '\\",\\"username\\":\\"system:node:{{EC2PrivateDNSName}}\\",\\"groups\\":[\\"system:bootstrappers\\",\\"system:nodes\\"]},{\\"rolearn\\":\\"',
            {
              'Fn::GetAtt': [
                'ClusterNodegroupNGNodeGroupRole7C078920',
                'Arn',
              ],
            },
            '\\",\\"username\\":\\"system:node:{{EC2PrivateDNSName}}\\",\\"groups\\":[\\"system:bootstrappers\\",\\"system:nodes\\"]},{\\"rolearn\\":\\"arn:aws:iam::123456789012:role/S3Access\\",\\"username\\":\\"arn:aws:iam::123456789012:role/S3Access\\",\\"groups\\":[\\"system:masters\\"]}]","mapUsers":"[]","mapAccounts":"[]"}}]',
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
    }));

    test.done();
  },
};
