import * as path from 'path';
import { App, FileAsset, CfnResource, Stack, StackProps } from '../../../lib';

class TestStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    /// !show
    new FileAsset(this, 'SampleAsset', {
      path: path.join(__dirname, 'file-asset.txt'),
    });
    /// !hide

    new CfnResource(this, 'MyUser', { type: 'AWS::IAM::User' });
  }
}

const app = new App();
new TestStack(app, 'aws-cdk-asset-file-test');
app.synth();
