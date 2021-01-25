import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { EksCreateFargateProfile } from '../../lib';

/*
 * Stack verification steps:
 * * aws stepfunctions start-execution --state-machine-arn <deployed state machine arn> : should return execution arn
 * * aws stepfunctions describe-execution --execution-arn <exection-arn generated before> : should return status as SUCCEEDED and a query-execution-id
 * * aws eks describe-fargate-profile --cluster-name <value> --fargate-profile-name <value> : should return status of FargateProfile
 */
const app = new cdk.App();
const stack = new cdk.Stack(app, 'aws-stepfunctions-tasks-eks-create-fargate-profile-integ');
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


const chain = sfn.Chain.start(createFargateProfileJob);

const sm = new sfn.StateMachine(stack, 'StateMachine', {
  definition: chain,
  timeout: cdk.Duration.seconds(30),
});

new cdk.CfnOutput(stack, 'stateMachineArn', {
  value: sm.stateMachineArn,
});


app.synth();
