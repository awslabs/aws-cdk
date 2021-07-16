import { HttpApi } from '@aws-cdk/aws-apigatewayv2';
import { StateMachine, Chain, StateMachineType, Pass } from '@aws-cdk/aws-stepfunctions';
import { App, CfnOutput, Stack } from '@aws-cdk/core';
import { StepFunctionsStartExecutionIntegration } from '../../lib';

/*
 * Stack verification steps:
 * "curl <endpoint-in-the-stack-output>" should return 'success'
 */

const app = new App();

const stack = new Stack(app, 'integ-aws-service');

const state = new StateMachine(stack, 'MyStateMachine', {
  definition: Chain.start(new Pass(stack, 'Pass')),
  stateMachineType: StateMachineType.STANDARD,
});

const endpoint = new HttpApi(stack, 'AwsIntegrationApi', {
  defaultIntegration: new StepFunctionsStartExecutionIntegration({
    stateMachine: state,
    input: '$request.body.input',
  }),
});

new CfnOutput(stack, 'Endpoint', {
  value: endpoint.url!,
});