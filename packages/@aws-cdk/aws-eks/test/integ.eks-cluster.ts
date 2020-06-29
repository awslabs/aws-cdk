import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import { App, CfnOutput, Duration } from '@aws-cdk/core';
import * as eks from '../lib';
import * as hello from './hello-k8s';
import { TestStack } from './util';

class EksClusterStack extends TestStack {
  constructor(scope: App, id: string) {
    super(scope, id);

    // allow all account users to assume this role in order to admin the cluster
    const mastersRole = new iam.Role(this, 'AdminRole', {
      assumedBy: new iam.AccountRootPrincipal(),
    });

    // just need one nat gateway to simplify the test
    const vpc = new ec2.Vpc(this, 'Vpc', { maxAzs: 3, natGateways: 1 });

    // create the cluster with a default nodegroup capacity
    const cluster = new eks.Cluster(this, 'Cluster', {
      vpc,
      mastersRole,
      defaultCapacity: 2,
      version: '1.16',
    });

    // fargate profile for resources in the "default" namespace
    cluster.addFargateProfile('default', {
      selectors: [{ namespace: 'default' }],
    });

    // add some capacity to the cluster. The IAM instance role will
    // automatically be mapped via aws-auth to allow nodes to join the cluster.
    cluster.addCapacity('Nodes', {
      instanceType: new ec2.InstanceType('t2.medium'),
      minCapacity: 3,
    });

    // add bottlerocket nodes
    cluster.addCapacity('BottlerocketNodes', {
      instanceType: new ec2.InstanceType('t3.small'),
      minCapacity: 2,
      machineImageType: eks.MachineImageType.BOTTLEROCKET,
    });

    // spot instances (up to 10)
    cluster.addCapacity('spot', {
      spotPrice: '0.1094',
      instanceType: new ec2.InstanceType('t3.large'),
      maxCapacity: 10,
      bootstrapOptions: {
        kubeletExtraArgs: '--node-labels foo=bar,goo=far',
        awsApiRetryAttempts: 5,
      },
    });

    // inference instances
    cluster.addCapacity('InferenceInstances', {
      instanceType: new ec2.InstanceType('inf1.2xlarge'),
      minCapacity: 1,
    });

    // add a extra nodegroup
    cluster.addNodegroup('extra-ng', {
      instanceType: new ec2.InstanceType('t3.small'),
      minSize: 1,
      // reusing the default capacity nodegroup instance role when available
      nodeRole: cluster.defaultCapacity ? cluster.defaultCapacity.role : undefined,
    });

    // apply a kubernetes manifest
    cluster.addResource('HelloApp', ...hello.resources);

    // add two Helm charts to the cluster. This will be the Kubernetes dashboard and the Nginx Ingress Controller
    cluster.addChart('dashboard', {
      chart: 'kubernetes-dashboard',
      repository: 'https://kubernetes.github.io/dashboard/',
    });

    cluster.addChart('nginx-ingress', {
      chart: 'nginx-ingress',
      repository: 'https://helm.nginx.com/stable',
      namespace: 'kube-system',
      wait: true,
      timeout: Duration.minutes(15),
    });

    // add a service account connected to a IAM role
    cluster.addServiceAccount('MyServiceAccount');

    new CfnOutput(this, 'ClusterEndpoint', { value: cluster.clusterEndpoint });
    new CfnOutput(this, 'ClusterArn', { value: cluster.clusterArn });
    new CfnOutput(this, 'ClusterCertificateAuthorityData', { value: cluster.clusterCertificateAuthorityData });
    new CfnOutput(this, 'ClusterSecurityGroupId', { value: cluster.clusterSecurityGroupId });
    new CfnOutput(this, 'ClusterEncryptionConfigKeyArn', { value: cluster.clusterEncryptionConfigKeyArn });
    new CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
  }
}

const app = new App();

// since the EKS optimized AMI is hard-coded here based on the region,
// we need to actually pass in a specific region.
new EksClusterStack(app, 'aws-cdk-eks-cluster-test');

app.synth();
