import * as path from 'path';
import { App, FileAsset, CfnResource, Stack, StackProps } from '../../../lib';

class TestStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    // The template must contain at least one resource, so there is this...
    new CfnResource(this, 'DummyResourceF3AB250A', {
      type: 'AWS::IAM::User',
    });

    // Check that the same asset added multiple times is
    // uploaded and copied.
    new FileAsset(this, 'SampleAsset1', {
      path: path.join(__dirname, 'file-asset.txt'),
    });

    new FileAsset(this, 'SampleAsset2', {
      path: path.join(__dirname, 'file-asset.txt'),
    });
  }
}

const app = new App();
new TestStack(app, 'aws-cdk-multi-assets');
app.synth();
