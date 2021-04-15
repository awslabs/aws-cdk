import * as path from 'path';
import { Construct } from 'constructs';
import { App, FileAsset, CfnResource, DockerImage, Stack, StackProps } from '../../../lib';

class TestStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    /// !show
    new FileAsset(this, 'BundledAsset', {
      path: path.join(__dirname, 'markdown-asset'), // /asset-input and working directory in the container
      bundling: {
        image: DockerImage.fromBuild(path.join(__dirname, 'alpine-markdown')), // Build an image
        command: [
          'sh', '-c', `
            markdown index.md > /asset-output/index.html
          `,
        ],
      },
    });
    /// !hide

    new CfnResource(this, 'MyUser', { type: 'AWS::IAM::User' });
  }
}

const app = new App();
new TestStack(app, 'cdk-integ-assets-bundling');
app.synth();
