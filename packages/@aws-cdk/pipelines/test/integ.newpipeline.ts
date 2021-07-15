// eslint-disable-next-line import/no-extraneous-dependencies
/// !cdk-integ PipelineStack
import * as sqs from '@aws-cdk/aws-sqs';
import { App, Stack, StackProps, Stage, StageProps } from '@aws-cdk/core';
import { Construct } from 'constructs';
import * as pipelines from '../lib';

class PipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
      synth: new pipelines.ShellStep('Synth', {
        input: pipelines.CodePipelineSource.gitHub('rix0rrr/cdk-pipelines-demo', 'main'),
        commands: [
          'npm ci',
          'npm run build',
          'npx cdk synth',
        ],
      }),
    });

    pipeline.addStage(new AppStage(this, 'Beta'));

    const group = pipeline.addWave('Wave1');
    group.addStage(new AppStage(this, 'Prod1'));
    group.addStage(new AppStage(this, 'Prod2'));

    const group2 = pipeline.addWave('Wave2');
    group2.addStage(new AppStage(this, 'Prod3'));
    group2.addStage(new AppStage(this, 'Prod4'));
    group2.addStage(new AppStage(this, 'Prod5'));
    group2.addStage(new AppStage(this, 'Prod6'));
  }
}

class AppStage extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    const stack1 = new Stack(this, 'Stack1');
    const queue1 = new sqs.Queue(stack1, 'Queue');

    const stack2 = new Stack(this, 'Stack2');
    new sqs.Queue(stack2, 'OtherQueue', {
      deadLetterQueue: {
        queue: queue1,
        maxReceiveCount: 5,
      },
    });
  }
}

const app = new App({
  context: {
    '@aws-cdk/core:newStyleStackSynthesis': '1',
  },
});
new PipelineStack(app, 'PipelineStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
app.synth();