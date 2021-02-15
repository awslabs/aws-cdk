import { strictEqual } from 'assert';
import { expect, haveResource } from '@aws-cdk/assert';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/core';
import '@aws-cdk/assert/jest';
import * as glue from '../lib';

test('a connection with connection properties', () => {
  const stack = new cdk.Stack();
  new glue.Connection(stack, 'Connection', {
    type: glue.ConnectionType.JDBC,
    properties: {
      JDBC_CONNECTION_URL: 'jdbc:server://server:443/connection',
      USERNAME: 'username',
      PASSWORD: 'password',
    },
  });

  expect(stack).to(haveResource('AWS::Glue::Connection', {
    CatalogId: {
      Ref: 'AWS::AccountId',
    },
    ConnectionInput: {
      ConnectionProperties: {
        JDBC_CONNECTION_URL: 'jdbc:server://server:443/connection',
        USERNAME: 'username',
        PASSWORD: 'password',
      },
      ConnectionType: 'JDBC',
    },
  }));
});

test('a connection with a subnet and security group', () => {
  const stack = new cdk.Stack();
  const subnet = ec2.Subnet.fromSubnetAttributes(stack, 'subnet', {
    subnetId: 'subnetId',
    availabilityZone: 'azId',
  });
  const securityGroup = ec2.SecurityGroup.fromSecurityGroupId(stack, 'securityGroup', 'sgId');
  new glue.Connection(stack, 'Connection', {
    type: glue.ConnectionType.NETWORK,
    securityGroups: [securityGroup],
    subnet,
  });

  expect(stack).to(haveResource('AWS::Glue::Connection', {
    CatalogId: {
      Ref: 'AWS::AccountId',
    },
    ConnectionInput: {
      ConnectionType: 'NETWORK',
      PhysicalConnectionRequirements: {
        AvailabilityZone: 'azId',
        SubnetId: 'subnetId',
        SecurityGroupIdList: ['sgId'],
      },
    },
  }));
});

test('a connection with a name and description', () => {
  const stack = new cdk.Stack();
  new glue.Connection(stack, 'Connection', {
    connectionName: 'name',
    description: 'description',
    type: glue.ConnectionType.NETWORK,
  });

  expect(stack).to(haveResource('AWS::Glue::Connection', {
    CatalogId: {
      Ref: 'AWS::AccountId',
    },
    ConnectionInput: {
      ConnectionType: 'NETWORK',
      Name: 'name',
      Description: 'description',
    },
  }));
});

test('a connection with a custom type', () => {
  const stack = new cdk.Stack();
  new glue.Connection(stack, 'Connection', {
    connectionName: 'name',
    description: 'description',
    type: new glue.ConnectionType('CUSTOM_TYPE'),
  });

  expect(stack).to(haveResource('AWS::Glue::Connection', {
    CatalogId: {
      Ref: 'AWS::AccountId',
    },
    ConnectionInput: {
      ConnectionType: 'CUSTOM_TYPE',
      Name: 'name',
      Description: 'description',
    },
  }));
});

test('a connection with match criteria', () => {
  const stack = new cdk.Stack();
  new glue.Connection(stack, 'Connection', {
    type: glue.ConnectionType.NETWORK,
    matchCriteria: ['c1', 'c2'],
  });

  expect(stack).to(haveResource('AWS::Glue::Connection', {
    CatalogId: {
      Ref: 'AWS::AccountId',
    },
    ConnectionInput: {
      ConnectionType: 'NETWORK',
      MatchCriteria: ['c1', 'c2'],
    },
  }));
});

test('fromConnectionName', () => {
  const connectionName = 'name';
  const stack = new cdk.Stack();
  const connection = glue.Connection.fromConnectionName(stack, 'ImportedConnection', connectionName);

  strictEqual(connection.connectionName, connectionName);
  strictEqual(connection.connectionArn, stack.formatArn({
    service: 'glue',
    resource: 'connection',
    resourceName: connectionName,
  }));
});

test('fromConnectionArn', () => {
  const connectionArn = 'arn:aws:glue:region:account-id:connection/name';
  const stack = new cdk.Stack();
  const connection = glue.Connection.fromConnectionArn(stack, 'ImportedConnection', connectionArn);

  strictEqual(connection.connectionName, 'name');
  strictEqual(connection.connectionArn, connectionArn);
});