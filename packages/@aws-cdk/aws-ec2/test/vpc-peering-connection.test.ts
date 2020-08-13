import { ABSENT } from '@aws-cdk/assert';
import '@aws-cdk/assert/jest';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import * as ec2 from '../lib';

describe('Normal', () => {
  describe('Account x Region', () => {
    test('Peer vpc in my account & the same region', () => {
      const stack = new cdk.Stack();
      const vpc = ec2.Vpc.fromVpcAttributes(stack, 'vpc', { vpcId: 'vpc-01234567890123456', availabilityZones: ['ap-northeast-1a'] });
      const peerVpc = new ec2.PeerVpc('vpc-09876543210987654');
      new ec2.VpcPeeringConnection(stack, 'peering', { vpc, peerVpc });

      expect(stack).toHaveResource('AWS::EC2::VPCPeeringConnection', {
        VpcId: vpc.vpcId,
        PeerOwnerId: {
          Ref: 'AWS::AccountId',
        },
        PeerRegion: {
          Ref: 'AWS::Region',
        },
        PeerRoleArn: ABSENT,
      });
    });

    test('Peer vpc in my account & the different region', () => {
      const stack = new cdk.Stack();
      const vpc = ec2.Vpc.fromVpcAttributes(stack, 'vpc', { vpcId: 'vpc-01234567890123456', availabilityZones: ['ap-northeast-1a'] });
      const peerVpc = new ec2.PeerVpc('vpc-09876543210987654', 'ap-southeast-1');
      new ec2.VpcPeeringConnection(stack, 'peering', { vpc, peerVpc });

      expect(stack).toHaveResource('AWS::EC2::VPCPeeringConnection', {
        VpcId: vpc.vpcId,
        PeerOwnerId: {
          Ref: 'AWS::AccountId',
        },
        PeerRegion: peerVpc.region,
        PeerRoleArn: ABSENT,
      });
    });

    test('Peer vpc in another account & the different region', () => {
      const stack = new cdk.Stack();
      const vpc = ec2.Vpc.fromVpcAttributes(stack, 'vpc', { vpcId: 'vpc-01234567890123456', availabilityZones: ['ap-northeast-1a'] });
      const peerVpc = new ec2.PeerVpc('vpc-09876543210987654', 'ap-southeast-1', '123456789012');
      const role = iam.Role.fromRoleArn(stack, 'role', `arn:aws:iam:${peerVpc.account}:${peerVpc.region}:role/role-for-vpc-peering-connection`);
      new ec2.VpcPeeringConnection(stack, 'peering', { vpc, peerVpc, role });

      expect(stack).toHaveResource('AWS::EC2::VPCPeeringConnection', {
        VpcId: vpc.vpcId,
        PeerOwnerId: peerVpc.account,
        PeerRegion: peerVpc.region,
        PeerRoleArn: role.roleArn,
      });
    });

    test('Peer vpc in another account & the same region', () => {
      const stack = new cdk.Stack();
      const vpc = ec2.Vpc.fromVpcAttributes(stack, 'vpc', { vpcId: 'vpc-01234567890123456', availabilityZones: ['ap-northeast-1a'] });
      const peerVpc = new ec2.PeerVpc('vpc-09876543210987654', undefined, '123456789012');
      const role = iam.Role.fromRoleArn(stack, 'role', `arn:aws:iam:${peerVpc.account}:${peerVpc.region}:role/role-for-vpc-peering-connection`);
      new ec2.VpcPeeringConnection(stack, 'peering', { vpc, peerVpc, role });

      expect(stack).toHaveResource('AWS::EC2::VPCPeeringConnection', {
        VpcId: vpc.vpcId,
        PeerOwnerId: peerVpc.account,
        PeerRegion: {
          Ref: 'AWS::Region',
        },
        PeerRoleArn: role.roleArn,
      });
    });
  });

  describe('Name', () => {
    test('With name', () => {
      const stack = new cdk.Stack();
      const vpc = ec2.Vpc.fromVpcAttributes(stack, 'vpc', { vpcId: 'vpc-01234567890123456', availabilityZones: ['ap-northeast-1a'] });
      const peerVpc = new ec2.PeerVpc('vpc-09876543210987654');
      const vpcPeeringConnectionName = 'VpcPeeringConnection';
      new ec2.VpcPeeringConnection(stack, 'peering', { vpc, peerVpc, vpcPeeringConnectionName });

      expect(stack).toHaveResource('AWS::EC2::VPCPeeringConnection', {
        Tags: [{ Key: 'Name', Value: vpcPeeringConnectionName }],
      });
    });

    test('Without name', () => {
      const stack = new cdk.Stack();
      const vpc = ec2.Vpc.fromVpcAttributes(stack, 'vpc', { vpcId: 'vpc-01234567890123456', availabilityZones: ['ap-northeast-1a'] });
      const peerVpc = new ec2.PeerVpc('vpc-09876543210987654');
      new ec2.VpcPeeringConnection(stack, 'peering', { vpc, peerVpc });

      expect(stack).toHaveResource('AWS::EC2::VPCPeeringConnection', {
        Tags: ABSENT,
      });
    });
  });
});

describe('Error', () => {
  test('The role is required when you are peering a VPC in a different AWS account.', () => {
    const stack = new cdk.Stack();
    const vpc = ec2.Vpc.fromVpcAttributes(stack, 'vpc', { vpcId: 'vpc-01234567890123456', availabilityZones: ['ap-northeast-1a'] });
    expect(() => {
      new ec2.VpcPeeringConnection(stack, 'peering', {
        vpc,
        peerVpc: new ec2.PeerVpc('vpc-09876543210987654', 'ap-northeast-2', '012345678901'),
      });
    }).toThrowError('The role is required when you are peering a VPC in a different AWS account.');
  });
});
