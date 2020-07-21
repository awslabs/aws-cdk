/// !cdk-integ cdk-integ-lambda-python
import * as path from 'path';
import { Runtime } from '@aws-cdk/aws-lambda';
import { App, CfnOutput, Construct, Stack, StackProps } from '@aws-cdk/core';
import * as lambda from '../lib';

/*
 * Stack verification steps:
 * * aws lambda invoke --function-name <deployed fn name> --invocation-type Event --payload '"OK"' response.json
 */

class TestStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const assetPath = path.join(__dirname, 'lambda-handler/index.py');
    const fn = new lambda.PythonFunction(this, 'my_handler', {
      entry: assetPath,
      runtime: Runtime.PYTHON_3_6,
    });

    new CfnOutput(this, 'FunctionArn', {
      value: fn.functionArn,
    });
  }
}

const app = new App();
new TestStack(app, 'cdk-integ-lambda-python');
app.synth();
