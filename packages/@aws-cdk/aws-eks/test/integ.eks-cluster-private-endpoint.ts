/// !cdk-integ pragma:ignore-assets
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import { App } from '@aws-cdk/core';
import * as eks from '../lib';
import { TestStack } from './util';

const CLUSTER_VERSION = eks.KubernetesVersion.V1_20;


class EksClusterStack extends TestStack {
  constructor(scope: App, id: string) {
    super(scope, id);

    // allow all account users to assume this role in order to admin the cluster
    const mastersRole = new iam.Role(this, 'AdminRole', {
      assumedBy: new iam.AccountRootPrincipal(),
    });

    // just need one nat gateway to simplify the test
    const vpc = new ec2.Vpc(this, 'Vpc', { maxAzs: 3, natGateways: 1 });

    const cluster = new eks.Cluster(this, 'Cluster', {
      vpc,
      mastersRole,
      defaultCapacity: 2,
      version: CLUSTER_VERSION,
      endpointAccess: eks.EndpointAccess.PRIVATE,
      prune: false,
    });

    // this is the valdiation. it won't work if the private access is not setup properly.
    cluster.addManifest('config-map', {
      kind: 'ConfigMap',
      apiVersion: 'v1',
      data: {
        hello: 'world',
      },
      metadata: {
        name: 'config-map',
      },
    });
  }
}


const app = new App();

new EksClusterStack(app, 'aws-cdk-eks-cluster-private-endpoint-test');

app.synth();
