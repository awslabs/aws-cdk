import * as codecommit from '@aws-cdk/aws-codecommit';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as events from '@aws-cdk/aws-events';
import * as sqs from '@aws-cdk/aws-sqs';
import * as cdk from '@aws-cdk/core';
import * as constructs from 'constructs';
import * as targets from '../../lib';

interface MockActionProps extends codepipeline.ActionProperties {
  configuration?: any;
}

class MockAction implements codepipeline.IAction {
  public readonly actionProperties: codepipeline.ActionProperties;
  private readonly configuration: any;

  constructor(props: MockActionProps) {
    this.actionProperties = props;
    this.configuration = props.configuration;
  }

  public bind(_scope: constructs.Construct, _stage: codepipeline.IStage, _options: codepipeline.ActionBindOptions):
  codepipeline.ActionConfig {
    return {
      configuration: this.configuration,
    };
  }

  public onStateChange(_name: string, _target?: events.IRuleTarget, _options?: events.RuleProps): events.Rule {
    throw new Error('onStateChange() is not available on MockAction');
  }
}

const app = new cdk.App();
const stack = new cdk.Stack(app, 'pipeline-events');

const repo = new codecommit.Repository(stack, 'Repo', {
  repositoryName: 'TestRepository',
});

const pipeline = new codepipeline.Pipeline(stack, 'pipelinePipeline22F2A91D');

const srcArtifact = new codepipeline.Artifact('Src');
pipeline.addStage({
  stageName: 'Source',
  actions: [new MockAction({
    actionName: 'CodeCommit',
    category: codepipeline.ActionCategory.SOURCE,
    provider: 'CodeCommit',
    artifactBounds: { minInputs: 0, maxInputs: 0, minOutputs: 1, maxOutputs: 1 },
    configuration: {
      RepositoryName: repo.repositoryName,
      BranchName: 'master',
    },
    outputs: [srcArtifact],
  })],
});
pipeline.addStage({
  stageName: 'Build',
  actions: [new MockAction({
    actionName: 'Hello',
    category: codepipeline.ActionCategory.APPROVAL,
    provider: 'Manual',
    artifactBounds: { minInputs: 0, maxInputs: 0, minOutputs: 0, maxOutputs: 0 },
  })],
});

let queue = new sqs.Queue(stack, 'dlq');

new events.Rule(stack, 'rule', {
  schedule: events.Schedule.expression('rate(1 minute)'),
  targets: [new targets.CodePipeline(pipeline, {
    deadLetterQueue: queue,
    maxEventAge: cdk.Duration.hours(2),
    retryAttempts: 2,
  })],
});

app.synth();
