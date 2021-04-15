import * as path from 'path';
import * as cxapi from '@aws-cdk/cx-api';
import { Construct } from 'constructs';
import { App, CfnOutput, CfnResource, ImageAsset, NestedStack, NestedStackProps, Stack, StackProps } from '../../../lib';

class TheNestedStack extends NestedStack {
  constructor(scope: Construct, id: string, props?: NestedStackProps) {
    super(scope, id, props);

    const asset = new ImageAsset(this, 'my-image', {
      directory: path.join(__dirname, 'demo-image'),
    });

    new CfnResource(this, 'User', { type: 'AWS::IAM::User' });
    new CfnOutput(this, 'output', { value: asset.imageUri });
  }
}

class TheParentStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    new TheNestedStack(this, 'nested-stack-with-image');
  }
}

const app = new App({
  context: {
    [cxapi.DOCKER_IGNORE_SUPPORT]: true,
  },
});
new TheParentStack(app, 'nested-stacks-docker');
app.synth();
