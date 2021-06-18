import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import * as secretsmanager from '../lib';

class ExampleStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string) {
    super(scope, id);

    /// !show
    const loginSecret = secretsmanager.Secret.fromSecretAttributes(this, 'Secret', {
      secretArn: 'SomeLogin',
    });

    new iam.User(this, 'User', {
      // Get the 'password' field from the secret that looks like
      // { "username": "XXXX", "password": "YYYY" }
      password: loginSecret.secretValueFromJson('password'),
    });
    /// !hide
  }
}

const app = new cdk.App();
new ExampleStack(app, 'aws-cdk-secret-integ');
app.synth();
