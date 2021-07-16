import * as cdk from '@aws-cdk/core';
import * as ecs from '../../lib';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'aws-ecs-ephemeral-storage');

const taskDefinition = new ecs.FargateTaskDefinition(stack, 'TaskDef', {
  ephemeralStorageGiB: 100,
});

taskDefinition.addContainer('web', {
  image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
});

app.synth();
