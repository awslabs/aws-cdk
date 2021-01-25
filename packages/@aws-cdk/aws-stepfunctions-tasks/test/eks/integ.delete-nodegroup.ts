import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { EksCreateNodegroup, EksDeleteNodegroup } from '../../lib';

/*
 * Stack verification steps:
 * * aws stepfunctions start-execution --state-machine-arn <deployed state machine arn> : should return execution arn
 * * aws stepfunctions describe-execution --execution-arn <exection-arn generated before> : should return status as SUCCEEDED and a query-execution-id
 */
const app = new cdk.App();
const stack = new cdk.Stack(app, 'aws-stepfunctions-tasks-eks-delete-nodegroup-integ');

const createNodeGroupJob = new EksCreateNodegroup(stack, 'Create a Nodegroup', {
  clusterName: 'clusterName',
  nodegroupName: 'NodeGroupName',
  subnets: ['<PUBSUBNET_AZ_1>', '<PUBSUBNET_AZ_2>'],
  nodeRole: 'arn:aws:iam::ACCOUNTID:role/NodeInstanceRole',
  launchTemplate: {
    id: 'lt-ID',
  },
  scalingConfig: {
    desiredSize: 2,
  },
});

const deleteNodeGroupJob = new EksDeleteNodegroup(stack, 'Delete a Nodegroup', {
  clusterName: 'clusterName',
  nodegroupName: 'NodeGroupName',
});


const chain = sfn.Chain.start(createNodeGroupJob).next(deleteNodeGroupJob);

const sm = new sfn.StateMachine(stack, 'StateMachine', {
  definition: chain,
  timeout: cdk.Duration.seconds(30),
});

new cdk.CfnOutput(stack, 'stateMachineArn', {
  value: sm.stateMachineArn,
});


app.synth();
