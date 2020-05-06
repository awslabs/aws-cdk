import * as cdk from '@aws-cdk/core';
import * as path from 'path';
import * as apigateway from '../lib';

const app = new cdk.App();

const stack = new cdk.Stack(app, 'test-apigateway-restapi-fromdefinition');

new apigateway.SpecRestApi(stack, 'my-api', {
  apiDefinition: apigateway.ApiDefinition.fromAsset(path.join(__dirname, 'sample-definition.yaml')),
});

app.synth();
