import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import { SecretValue } from '@aws-cdk/core';
import { Construct } from 'constructs';
import * as cdkp from '../../lib';

export interface LegacyTestGitHubNpmPipelineExtraProps {
  readonly sourceArtifact?: codepipeline.Artifact;
  readonly npmSynthOptions?: Partial<cdkp.StandardNpmSynthOptions>;
}

export class LegacyTestGitHubNpmPipeline extends cdkp.CdkPipeline {
  public readonly sourceArtifact: codepipeline.Artifact;
  public readonly cloudAssemblyArtifact: codepipeline.Artifact;

  constructor(scope: Construct, id: string, props?: Partial<cdkp.CdkPipelineProps> & LegacyTestGitHubNpmPipelineExtraProps) {
    const sourceArtifact = props?.sourceArtifact ?? new codepipeline.Artifact();
    const cloudAssemblyArtifact = props?.cloudAssemblyArtifact ?? new codepipeline.Artifact();

    super(scope, id, {
      sourceAction: new TestGitHubAction(sourceArtifact),
      synthAction: cdkp.SimpleSynthAction.standardNpmSynth({
        sourceArtifact,
        cloudAssemblyArtifact,
        ...props?.npmSynthOptions,
      }),
      cloudAssemblyArtifact,
      ...props,
    });

    this.sourceArtifact = sourceArtifact;
    this.cloudAssemblyArtifact = cloudAssemblyArtifact;
  }
}


export class TestGitHubAction extends codepipeline_actions.GitHubSourceAction {
  constructor(sourceArtifact: codepipeline.Artifact) {
    super({
      actionName: 'GitHub',
      output: sourceArtifact,
      oauthToken: SecretValue.plainText('$3kr1t'),
      owner: 'test',
      repo: 'test',
      trigger: codepipeline_actions.GitHubTrigger.POLL,
    });
  }
}