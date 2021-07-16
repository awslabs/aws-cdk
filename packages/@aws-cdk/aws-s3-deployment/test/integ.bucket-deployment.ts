import * as path from 'path';
import * as ec2 from '@aws-cdk/aws-ec2';
import { IVpc } from '@aws-cdk/aws-ec2';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import * as s3deploy from '../lib';

export interface TestBucketDeploymentProps {
  readonly vpc: IVpc
}

class TestBucketDeployment extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: TestBucketDeploymentProps) {
    super(scope, id);

    const destinationBucket = new s3.Bucket(this, 'Destination', {
      websiteIndexDocument: 'index.html',
      publicReadAccess: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new s3deploy.BucketDeployment(this, 'DeployMe', {
      sources: [s3deploy.Source.asset(path.join(__dirname, 'my-website'))],
      destinationBucket,
      retainOnDelete: false, // default is true, which will block the integration test cleanup
    });

    new s3deploy.BucketDeployment(this, 'DeployMeWithEfsStorage', {
      sources: [s3deploy.Source.asset(path.join(__dirname, 'my-website'))],
      destinationBucket,
      destinationKeyPrefix: 'efs/',
      useEfs: true,
      vpc: props.vpc,
      retainOnDelete: false, // default is true, which will block the integration test cleanup
    });

    const bucket2 = new s3.Bucket(this, 'Destination2');

    new s3deploy.BucketDeployment(this, 'DeployWithPrefix', {
      sources: [s3deploy.Source.asset(path.join(__dirname, 'my-website'))],
      destinationBucket: bucket2,
      destinationKeyPrefix: 'deploy/here/',
      retainOnDelete: false, // default is true, which will block the integration test cleanup
    });

    const bucket3 = new s3.Bucket(this, 'Destination3');

    new s3deploy.BucketDeployment(this, 'DeployWithMetadata', {
      sources: [s3deploy.Source.asset(path.join(__dirname, 'my-website'))],
      destinationBucket: bucket3,
      retainOnDelete: false, // default is true, which will block the integration test cleanup
      cacheControl: [s3deploy.CacheControl.setPublic(), s3deploy.CacheControl.maxAge(cdk.Duration.minutes(1))],
      contentType: 'text/html',
      metadata: { A: 'aaa', B: 'bbb', C: 'ccc' },
    });

    new s3deploy.BucketDeployment(this, 'DeployMeWithoutDeletingFilesOnDestination', {
      sources: [s3deploy.Source.asset(path.join(__dirname, 'my-website'))],
      destinationBucket,
      prune: false,
      retainOnDelete: false,
    });

  }
}

class TestDependenciesStack extends cdk.Stack {
  readonly vpc: IVpc
  constructor(scope: cdk.App, id: string) {
    super(scope, id);
    this.vpc = new ec2.Vpc(this, 'Vpc');
  }
}

const app = new cdk.App();

// TestDependencies stack is left after execution since cdk-integ tests can only work on one stack.
// It is created since it is a dependency but not removed after execution.
const testDependencies = new TestDependenciesStack(app, 'test-dependencies-2');
new TestBucketDeployment(app, 'test-bucket-deployments-2', { vpc: testDependencies.vpc } );

/// !cdk-integ test-bucket-deployments-2

app.synth();
