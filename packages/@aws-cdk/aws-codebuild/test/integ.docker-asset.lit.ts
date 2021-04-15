import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as codebuild from '../lib';

class TestStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string) {
    super(scope, id);

    new codebuild.Project(this, 'MyProject', {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          build: {
            commands: ['ls'],
          },
        },
      }),
      grantReportGroupPermissions: false,
      /// !show
      environment: {
        buildImage: codebuild.LinuxBuildImage.fromImageAsset(this, 'MyImage', {
          directory: path.join(__dirname, 'demo-image'),
        }),
      },
      /// !hide
    });
  }
}

const app = new cdk.App();

new TestStack(app, 'test-codebuild-docker-asset');

app.synth();
