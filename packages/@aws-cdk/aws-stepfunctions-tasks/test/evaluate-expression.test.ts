import '@aws-cdk/assert/jest';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Stack } from '@aws-cdk/core';
import * as tasks from '../lib';

let stack: Stack;
beforeEach(() => {
  stack = new Stack();
});

test('Eval with Node.js', () => {
  // WHEN
  const task = new tasks.EvaluateExpression(stack, 'Task', {
    expression: '$.a + $.b',
  });
  new sfn.StateMachine(stack, 'SM', {
    definition: task,
  });

  // THEN
  expect(stack).toHaveResource('AWS::StepFunctions::StateMachine', {
    DefinitionString: {
      'Fn::Join': [
        '',
        [
          '{"StartAt":"Task","States":{"Task":{"End":true,"Type":"Task","Resource":"',
          {
            'Fn::GetAtt': ['Evala0d2ce44871b4e7487a1f5e63d7c3bdc4DAC06E1', 'Arn'],
          },
          '","Parameters":{"expression":"$.a + $.b","expressionAttributeValues":{"$.a.$":"$.a","$.b.$":"$.b"}}}}}',
        ],
      ],
    },
  });

  expect(stack).toHaveResource('AWS::Lambda::Function', {
    Runtime: 'nodejs10.x',
  });
});

test('expression does not contain paths', () => {
  // WHEN
  const task = new tasks.EvaluateExpression(stack, 'Task', {
    expression: '2 + 2',
  });
  new sfn.StateMachine(stack, 'SM', {
    definition: task,
  });

  expect(stack).toHaveResource('AWS::StepFunctions::StateMachine', {
    DefinitionString: {
      'Fn::Join': [
        '',
        [
          '{"StartAt":"Task","States":{"Task":{"End":true,"Type":"Task","Resource":"',
          {
            'Fn::GetAtt': ['Evala0d2ce44871b4e7487a1f5e63d7c3bdc4DAC06E1', 'Arn'],
          },
          '","Parameters":{"expression":"2 + 2","expressionAttributeValues":{}}}}}',
        ],
      ],
    },
  });
});
