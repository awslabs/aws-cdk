import * as codecommit from '@aws-cdk/aws-codecommit';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as cdk from '@aws-cdk/core';
import * as cpactions from '../../lib';

/**
 * A test stack with a half-prepared pipeline ready to add CloudFormation actions to
 */
export class TestFixture extends cdk.Stack {
  public readonly pipeline: codepipeline.Pipeline;
  public readonly sourceStage: codepipeline.IStage;
  public readonly deployStage: codepipeline.IStage;
  public readonly repo: codecommit.Repository;
  public readonly sourceOutput: codepipeline.Artifact;

  constructor() {
    super();

    this.pipeline = new codepipeline.Pipeline(this, 'Pipeline');
    this.sourceStage = this.pipeline.addStage({ stageName: 'Source' });
    this.deployStage = this.pipeline.addStage({ stageName: 'Deploy' });
    this.repo = new codecommit.Repository(this, 'MyVeryImportantRepo', {
      repositoryName: 'my-very-important-repo',
    });
    this.sourceOutput = new codepipeline.Artifact('SourceArtifact');
    const source = new cpactions.CodeCommitSourceAction({
      actionName: 'Source',
      output: this.sourceOutput,
      repository: this.repo,
    });
    this.sourceStage.addAction(source);
  }
}
