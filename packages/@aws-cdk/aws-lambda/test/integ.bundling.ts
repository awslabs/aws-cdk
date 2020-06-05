import { App, CfnOutput, Construct, HashCalculation, Stack, StackProps } from '@aws-cdk/core';
import * as path from 'path';
import * as lambda from '../lib';

/**
 * Stack verification steps:
 * * aws cloudformation describe-stacks --stack-name cdk-integ-lambda-bundling --query Stacks[0].Outputs[0].OutputValue
 * * aws lambda invoke --function-name <output from above> response.json
 * * cat response.json
 * The last command should show '200'
 */
class TestStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const assetPath = path.join(__dirname, 'python-lambda-handler');
    const fn = new lambda.Function(this, 'Function', {
      code: lambda.Code.fromAsset(assetPath, {
        bundling: {
          image: lambda.Runtime.PYTHON_3_6.bundlingDockerImage,
          command: [
            'bash', '-c', [
              'rsync -r . /asset-output',
              'cd /asset-output',
              'pip install -r requirements.txt -t .',
            ].join(' && '),
          ],
          hashCalculation: HashCalculation.SOURCE,
        },
      }),
      runtime: lambda.Runtime.PYTHON_3_6,
      handler: 'index.handler',
    });

    new CfnOutput(this, 'FunctionArn', {
      value: fn.functionArn,
    });
  }
}

const app = new App();
new TestStack(app, 'cdk-integ-lambda-bundling');
app.synth();
