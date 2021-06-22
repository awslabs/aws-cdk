import * as cdk from '@aws-cdk/core';
import * as appreg from '../lib';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'integ-servicecatalogappregistry-application');

new appreg.Application(stack, 'TestApplication', {
  applicationName: 'myApplicationtest',
  description: 'my application description',
});

app.synth();

