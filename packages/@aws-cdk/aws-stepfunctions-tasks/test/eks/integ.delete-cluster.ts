import * as ec2 from '@aws-cdk/aws-ec2';
import * as eks from '@aws-cdk/aws-eks';
import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { EksDeleteCluster, EksCreateCluster } from '../../lib';

/*
 * Stack verification steps:
 * * aws stepfunctions start-execution --state-machine-arn <deployed state machine arn> : should return execution arn
 * * aws stepfunctions describe-execution --execution-arn <exection-arn generated before> : should return status as SUCCEEDED and a cluster name
 * * aws eks describe-cluster --name <cluster name> : should return cluster status deleting or cluster does not exist
 */
const app = new cdk.App();
const stack = new cdk.Stack(app, 'aws-stepfunctions-tasks-eks-delete-cluster-integ', {
  env: {
    account: process.env.CDK_INTEG_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_INTEG_REGION || process.env.CDK_DEFAULT_REGION,
  },
});

const vpc = ec2.Vpc.fromLookup(stack, 'eks', {
  isDefault: true,
});

const role = new iam.Role(stack, 'Role', {
  assumedBy: new iam.ServicePrincipal('eks.amazonaws.com'),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSWorkerNodePolicy'),
    iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'),
    iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSClusterPolicy'),
    iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKS_CNI_Policy'),
  ],
});

const createClusterJob = new EksCreateCluster(stack, 'Create a Cluster', {
  name: 'deleteclusterinteg',
  role: role,
  resourcesVpcConfig: vpc,
  kubernetesVersion: eks.KubernetesVersion.V1_18,
});


const cluster = eks.Cluster.fromClusterAttributes(stack, 'Cluster', {
  clusterName: 'deleteclusterinteg',
});

const deleteClusterJob = new EksDeleteCluster(stack, 'Delete a Cluster', {
  cluster: cluster,
});

const chain = sfn.Chain.start(createClusterJob).next(deleteClusterJob);

const sm = new sfn.StateMachine(stack, 'StateMachine', {
  definition: chain,
  timeout: cdk.Duration.seconds(30),
});

new cdk.CfnOutput(stack, 'stateMachineArn', {
  value: sm.stateMachineArn,
});


app.synth();
