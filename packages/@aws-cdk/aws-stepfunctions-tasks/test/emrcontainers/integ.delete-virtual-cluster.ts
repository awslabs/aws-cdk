import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { EMRContainersDeleteVirtualCluster } from '../../lib';

/**
 * Stack verification steps:
 * Everything in the link below besides the last step must be setup before running the state machine.
 * @see https://docs.aws.amazon.com/emr/latest/EMR-on-EKS-DevelopmentGuide/setting-up.html
 *
 * aws stepfunctions start-execution --state-machine-arn <deployed state machine arn> : should return execution arn
 * aws stepfunctions describe-execution --execution-arn <exection-arn generated before> : should return status as SUCCEEDED
 */

const app = new cdk.App();
const stack = new cdk.Stack(app, 'aws-stepfunctions-tasks-emr-containers-delete-virtual-cluster-integ');

const deleteVirtualCluster = new EMRContainersDeleteVirtualCluster(stack, 'EMR Containers Delete Virtual Cluster', {
  id: 'z0yghc9wfddurogzx9ws12qr0',
  integrationPattern: sfn.IntegrationPattern.RUN_JOB,
});

const chain = sfn.Chain.start(deleteVirtualCluster);

const sm = new sfn.StateMachine(stack, 'StateMachine', {
  definition: chain,
  timeout: cdk.Duration.seconds(30),
});

new cdk.CfnOutput(stack, 'stateMachineArn', {
  value: sm.stateMachineArn,
});


app.synth();
