import * as kms from '@aws-cdk/aws-kms';
import * as lambda from '@aws-cdk/aws-lambda';
import * as cdk from '@aws-cdk/core';
import * as secretsmanager from '../lib';

class TestStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string) {
    super(scope, id);

    const key = new kms.Key(this, 'Key', { removalPolicy: cdk.RemovalPolicy.DESTROY });

    const secret = new secretsmanager.Secret(this, 'Secret', {
      encryptionKey: key,
    });

    secret.addRotationSchedule('Schedule', {
      rotationLambda: new lambda.Function(this, 'Lambda', {
        runtime: lambda.Runtime.NODEJS_12_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('NOOP'),
      }),
    });
  }
}

const app = new cdk.App();
new TestStack(app, 'cdk-integ-secret-lambda-rotation');
app.synth();
