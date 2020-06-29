import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import * as tasks from '../lib';

/*
 * Stack verification steps:
 * * aws stepfunctions start-execution --input '{"a": 3, "b": 4}' --state-machine-arn <StateMachineARN>
 * * aws stepfunctions describe-execution --execution-arn <execution-arn>
 * * The output here should contain `status: "SUCCEEDED"` and `output: "{ a: 3, b: 4, c: 7, d: 14, now: <current date> }"
 */

const app = new cdk.App();
const stack = new cdk.Stack(app, 'aws-stepfunctions-integ');

const sum = new tasks.EvaluateExpression(stack, 'Sum', {
  expression: '$.a + $.b',
  resultPath: '$.c',
});

const multiply = new tasks.EvaluateExpression(stack, 'Multiply', {
  expression: '$.c * 2',
  resultPath: '$.d',
});

const now = new tasks.EvaluateExpression(stack, 'Now', {
  expression: '(new Date()).toUTCString()',
  resultPath: '$.now',
});

const statemachine = new sfn.StateMachine(stack, 'StateMachine', {
  definition: sum
    .next(multiply)
    .next(
      new sfn.Wait(stack, 'Wait', {
        time: sfn.WaitTime.secondsPath('$.d'),
      }),
    )
    .next(now),
});

new cdk.CfnOutput(stack, 'StateMachineARN', {
  value: statemachine.stateMachineArn,
});

app.synth();
