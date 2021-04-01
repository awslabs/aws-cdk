import * as path from 'path';
import * as iam from '@aws-cdk/aws-iam';
import { App, DockerImage, Stack, StackProps } from '@aws-cdk/core';
import { Construct } from 'constructs';
import * as assets from '../lib';

class TestStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    /// !show
    const asset = new assets.Asset(this, 'BundledAsset', {
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

    const user = new iam.User(this, 'MyUser');
    asset.grantRead(user);
  }
}

const app = new App();
new TestStack(app, 'cdk-integ-assets-bundling');
app.synth();
