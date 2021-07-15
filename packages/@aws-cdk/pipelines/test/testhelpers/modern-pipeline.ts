/* eslint-disable import/no-extraneous-dependencies */
import { Construct } from 'constructs';
import * as cdkp from '../../lib';

export type ModernTestGitHubNpmPipelineProps = Partial<cdkp.CodePipelineProps> & Partial<cdkp.ShellStepProps>;

export class ModernTestGitHubNpmPipeline extends cdkp.CodePipeline {
  public readonly gitHubSource: cdkp.CodePipelineSource;

  constructor(scope: Construct, id: string, props?: ModernTestGitHubNpmPipelineProps) {
    const source = cdkp.CodePipelineSource.gitHub('test/test', 'main');
    const synth = props?.synth ?? new cdkp.ShellStep('Synth', {
      input: source,
      installCommands: ['npm ci'],
      commands: ['npx cdk synth'],
      ...props,
    });

    super(scope, id, {
      synth: synth,
      ...props,
    });

    this.gitHubSource = source;
  }
}