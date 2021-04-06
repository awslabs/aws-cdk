/// !cdk-integ *

import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import { App } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { Cluster } from '../lib';
import { TestStack } from './util';

class VpcStack extends TestStack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.vpc = new ec2.Vpc(this, 'vpc', { maxAzs: 2 });
  }
}

class ClusterStack extends TestStack {
  public readonly cluster: Cluster;

  constructor(scope: Construct, id: string, props: { vpc: ec2.Vpc }) {
    super(scope, id);

    /// !show
    // define the cluster. kubectl is enabled by default.
    this.cluster = new Cluster(this, 'cluster22', {
      vpc: props.vpc,
      defaultCapacity: 0,
    });

    // define an IAM role assumable by anyone in the account and map it to the k8s
    // `system:masters` group this is required if you want to be able to issue
    // manual `kubectl` commands against the cluster.
    const mastersRole = new iam.Role(this, 'AdminRole', { assumedBy: new iam.AccountRootPrincipal() });
    this.cluster.awsAuth.addMastersRole(mastersRole);

    // add some capacity to the cluster. The IAM instance role will
    // automatically be mapped via aws-auth to allow nodes to join the cluster.
    this.cluster.addCapacity('Nodes', {
      instanceType: new ec2.InstanceType('t2.medium'),
      desiredCapacity: 3,
    });

    // add two Helm charts to the cluster. This will be the Kubernetes dashboard and the Nginx Ingress Controller
    this.cluster.addChart('dashboard', { chart: 'kubernetes-dashboard', repository: 'https://kubernetes.github.io/dashboard' });
    this.cluster.addChart('nginx-ingress', { chart: 'nginx-ingress', repository: 'https://helm.nginx.com/stable', namespace: 'kube-system' });
    /// !hide
  }
}

const app = new App();
const vpcStack = new VpcStack(app, 'k8s-vpc');
new ClusterStack(app, 'k8s-cluster', { vpc: vpcStack.vpc });
app.synth();
