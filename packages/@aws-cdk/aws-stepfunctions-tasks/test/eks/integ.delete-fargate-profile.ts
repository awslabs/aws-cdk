import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { EksDeleteFargateProfile, EksCreateFargateProfile } from '../../lib';

/*
 * Stack verification steps:
 * * aws stepfunctions start-execution --state-machine-arn <deployed state machine arn> : should return execution arn
 * * aws stepfunctions describe-execution --execution-arn <exection-arn generated before> : should return status as SUCCEEDED and a query-execution-id
 * * aws eks describe-fargate-profile --cluster-name <value> --fargate-profile-name <value> : should return status of Fargate Profile
 * * aws eks list-fargate-profile --cluster-name <value> --fargate-profile-name <value> : should not return Fargate Profile
 */
const app = new cdk.App();
const stack = new cdk.Stack(app, 'aws-stepfunctions-tasks-eks-delete-fargate-profile-integ');

const fargateProfileSelector = {
  Namespace: 'namespace',
  Labels: { 'my-label': 'my-value' },
};

const createFargateProfileJob = new EksCreateFargateProfile(stack, 'Create a Fargate Profile', {
  fargateProfileName: 'fargateprofilename',
  clusterName: 'clustername',
  podExecutionRole: '*',
  selectors: [fargateProfileSelector],
});

const deleteFargateProfileJob = new EksDeleteFargateProfile(stack, 'Delete a Fargate Profile', {
  clusterName: 'clustername',
  fargateProfileName: 'fargateprofilename',
});


const chain = sfn.Chain.start(createFargateProfileJob).next(deleteFargateProfileJob);

const sm = new sfn.StateMachine(stack, 'StateMachine', {
  definition: chain,
  timeout: cdk.Duration.seconds(30),
});

new cdk.CfnOutput(stack, 'stateMachineArn', {
  value: sm.stateMachineArn,
});


app.synth();
