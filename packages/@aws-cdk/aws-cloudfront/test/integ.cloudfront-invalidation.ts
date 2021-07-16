import * as cdk from '@aws-cdk/core';
import * as cloudfront from '../lib';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'Stack', {
  env: { account: '123456789012', region: 'testregion' },
});
new cloudfront.Invalidation(stack, 'MyInvalidation', {
  distributionId: '12345',
  invalidationName: 'MyInvalidationName',
  invalidationPaths: ['/example1', '/example2/*', '/example3/index.html'],
});

app.synth();