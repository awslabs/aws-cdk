import * as path from 'path';
import * as cxapi from '@aws-cdk/cx-api';
import { App, CfnOutput, CfnResource, ImageAsset, Stack } from '../../../lib';

const app = new App({
  context: {
    [cxapi.DOCKER_IGNORE_SUPPORT]: true,
  },
});
const stack = new Stack(app, 'integ-assets-docker');

const asset = new ImageAsset(stack, 'DockerImage', {
  directory: path.join(__dirname, 'demo-image'),
});

new ImageAsset(stack, 'DockerImage2', {
  directory: path.join(__dirname, 'demo-image'),
});

new CfnResource(stack, 'MyUser', { type: 'AWS::IAM::User' });

new CfnOutput(stack, 'ImageUri', { value: asset.imageUri });

app.synth();
