import * as ec2 from '@aws-cdk/aws-ec2';
import * as kms from '@aws-cdk/aws-kms';
import * as cdk from '@aws-cdk/core';
import * as constructs from 'constructs';
import { DatabaseCluster } from '../lib';
import { ClusterParameterGroup } from '../lib/parameter-group';

/*
 * Stack verification steps:
 * * aws docdb describe-db-clusters --db-cluster-identifier <deployed db cluster identifier>
 */

class TestStack extends cdk.Stack {
  constructor(scope: constructs.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'VPC', { maxAzs: 2 });

    const params = new ClusterParameterGroup(this, 'Params', {
      family: 'docdb3.6',
      description: 'A nice parameter group',
      parameters: {
        audit_logs: 'disabled',
        tls: 'enabled',
        ttl_monitor: 'enabled',
      },
    });

    const kmsKey = new kms.Key(this, 'DbSecurity', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const cluster = new DatabaseCluster(this, 'Database', {
      masterUser: {
        username: 'docdb',
        password: cdk.SecretValue.plainText('7959866cacc02c2d243ecfe177464fe6'),
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.R5, ec2.InstanceSize.LARGE),
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      vpc,
      parameterGroup: params,
      kmsKey,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    cluster.connections.allowDefaultPortFromAnyIpv4('Open to the world');
  }
}

const app = new cdk.App();

new TestStack(app, 'aws-cdk-docdb-integ');

app.synth();
