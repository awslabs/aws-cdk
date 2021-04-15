import * as path from 'path';
import { App, FileAsset, CfnOutput, CfnResource, Stack, StackProps } from '../../../lib';

class TestStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    /// !show
    const asset = new FileAsset(this, 'SampleAsset', {
      path: path.join(__dirname, 'sample-asset-directory'),
    });

    new CfnOutput(this, 'S3BucketName', { value: asset.s3BucketName });
    new CfnOutput(this, 'S3ObjectKey', { value: asset.s3ObjectKey });
    new CfnOutput(this, 'S3HttpURL', { value: asset.httpUrl });
    new CfnOutput(this, 'S3ObjectURL', { value: asset.s3ObjectUrl });
    /// !hide

    // we need at least one resource
    new CfnResource(this, 'MyUser', { type: 'AWS::IAM::User' });
  }
}

const app = new App();
new TestStack(app, 'aws-cdk-asset-refs');
app.synth();
