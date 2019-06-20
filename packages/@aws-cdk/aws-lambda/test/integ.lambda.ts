import iam = require('@aws-cdk/aws-iam');
import cdk = require('@aws-cdk/cdk');
import lambda = require('../lib');

const app = new cdk.App();

const stack = new cdk.Stack(app, 'aws-cdk-lambda-1');

const fn = new lambda.Function(stack, 'MyLambda', {
  code: new lambda.InlineCode('foo'),
  handler: 'index.handler',
  runtime: lambda.Runtime.Nodejs810,
});

fn.addToRolePolicy(new iam.PolicyStatement({
  resources: ['*'],
  actions: ['*']
}));

const version = fn.addVersion('1');

const alias = new lambda.Alias(stack, 'Alias', {
  aliasName: cdk.PhysicalName.of('prod'),
  version,
});
alias.addPermission('AliasPermission', {
  principal: new iam.ServicePrincipal('cloudformation.amazonaws.com')
});

app.synth();
