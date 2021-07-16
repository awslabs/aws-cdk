import { expect as cdkExpect, haveResource } from '@aws-cdk/assert-internal';
import * as ec2 from '@aws-cdk/aws-ec2';
import { Stack } from '@aws-cdk/core';
import { SubnetGroup } from '../lib';

let stack: Stack;
let vpc: ec2.IVpc;

beforeEach(() => {
  stack = new Stack();
  vpc = new ec2.Vpc(stack, 'VPC');
});

test('creates a subnet group from minimal properties', () => {
  new SubnetGroup(stack, 'Group', {
    description: 'MyGroup',
    vpc,
  });

  cdkExpect(stack).to(
    haveResource('AWS::ElastiCache::SubnetGroup', {
      Description: 'MyGroup',
      SubnetIds: [{ Ref: 'VPCPrivateSubnet1Subnet8BCA10E0' }, { Ref: 'VPCPrivateSubnet2SubnetCFCDAA7A' }],
    }),
  );
});

describe('subnet selection', () => {
  test('defaults to private subnets', () => {
    new SubnetGroup(stack, 'Group', {
      description: 'MyGroup',
      vpc,
    });

    cdkExpect(stack).to(
      haveResource('AWS::ElastiCache::SubnetGroup', {
        Description: 'MyGroup',
        SubnetIds: [{ Ref: 'VPCPrivateSubnet1Subnet8BCA10E0' }, { Ref: 'VPCPrivateSubnet2SubnetCFCDAA7A' }],
      }),
    );
  });

  test('can specify subnet type', () => {
    new SubnetGroup(stack, 'Group', {
      description: 'MyGroup',
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    cdkExpect(stack).to(
      haveResource('AWS::ElastiCache::SubnetGroup', {
        Description: 'MyGroup',
        SubnetIds: [{ Ref: 'VPCPublicSubnet1SubnetB4246D30' }, { Ref: 'VPCPublicSubnet2Subnet74179F39' }],
      }),
    );
  });
});

test('import group by name', () => {
  const subnetGroup = SubnetGroup.fromSubnetGroupName(stack, 'Group', 'my-subnet-group');

  expect(subnetGroup.subnetGroupName).toBe('my-subnet-group');
});
