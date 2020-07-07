import { expect, haveResourceLike, not } from '@aws-cdk/assert';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as s3 from '@aws-cdk/aws-s3';
import * as stepfunction from '@aws-cdk/aws-stepfunctions';
import { Stack } from '@aws-cdk/core';
import { Test } from 'nodeunit';
import * as cpactions from '../../lib';

export = {
  'StepFunctions Invoke Action': {
    'Verify stepfunction configuration properties are set to specific values'(test: Test) {
      const stack = new Stack();

      // when
      minimalPipeline(stack, undefined);

      // then
      expect(stack).to(haveResourceLike('AWS::CodePipeline::Pipeline', {
        Stages: [
          //  Must have a source stage
          {
            Actions: [
              {
                ActionTypeId: {
                  Category: 'Source',
                  Owner: 'AWS',
                  Provider: 'S3',
                  Version: '1',
                },
                Configuration: {
                  S3Bucket: {
                    Ref: 'MyBucketF68F3FF0',
                  },
                  S3ObjectKey: 'some/path/to',
                },
              },
            ],
          },
          // Must have stepfunction invoke action configuration
          {
            Actions: [
              {
                ActionTypeId: {
                  Category: 'Invoke',
                  Owner: 'AWS',
                  Provider: 'StepFunctions',
                  Version: '1',
                },
                Configuration: {
                  StateMachineArn: {
                    Ref: 'SimpleStateMachineE8E2CF40',
                  },
                  InputType: 'Literal',
                },
              },
            ],
          },
        ],
      }));

      expect(stack).to(not(haveResourceLike('AWS::Events::Rule')));

      test.done();
    },

    'Allows the pipeline to invoke this stepfunction'(test: Test) {
      const stack = new Stack();

      minimalPipeline(stack, undefined);

      expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: ['states:StartExecution', 'states:DescribeStateMachine'],
              Resource: {
                Ref: 'SimpleStateMachineE8E2CF40',
              },
              Effect: 'Allow',
            },
          ],
        },
      }));

      expect(stack).to(haveResourceLike('AWS::IAM::Role'));

      test.done();
    },

    'does not allow passing empty StateMachineInput when the StateMachineInputType is FilePath'(test: Test) {
      const stack = new Stack();

      const startState = new stepfunction.Pass(stack, 'StartState');

      const simpleStateMachine  = new stepfunction.StateMachine(stack, 'SimpleStateMachine', {
        definition: startState,
      });

      test.throws(() => {
        new cpactions.StepFunctionsInvokeAction({
          actionName: 'Invoke',
          stateMachine: simpleStateMachine,
          stateMachineInputType: cpactions.StateMachineInputType.FILEPATH,
          stateMachineInput: '',
        });
      });

      test.done();
    },

    'should throw an exception when the StateMachineInputType is FilePath and no input artifact is provided'(test: Test) {
      const stack = new Stack();

      const startState = new stepfunction.Pass(stack, 'StartState');

      const simpleStateMachine  = new stepfunction.StateMachine(stack, 'SimpleStateMachine', {
        definition: startState,
      });

      test.throws(() => {
        new cpactions.StepFunctionsInvokeAction({
          actionName: 'Invoke',
          stateMachine: simpleStateMachine,
          stateMachineInputType: cpactions.StateMachineInputType.FILEPATH,
          stateMachineInput: 'assets/input.json',
        });
      });

      test.done();
    },
  },
};

interface MinimalPipelineOptions {
  readonly trigger?: cpactions.S3Trigger;

  readonly bucket?: s3.IBucket;

  readonly bucketKey?: string;
}

function minimalPipeline(stack: Stack, options: MinimalPipelineOptions = {}): codepipeline.IStage {
  const sourceOutput = new codepipeline.Artifact();
  const startState = new stepfunction.Pass(stack, 'StartState');
  const simpleStateMachine  = new stepfunction.StateMachine(stack, 'SimpleStateMachine', {
    definition: startState,
  });
  const pipeline = new codepipeline.Pipeline(stack, 'MyPipeline');
  const sourceStage = pipeline.addStage({
    stageName: 'Source',
    actions: [
      new cpactions.S3SourceAction({
        actionName: 'Source',
        bucket: options.bucket || new s3.Bucket(stack, 'MyBucket'),
        bucketKey: options.bucketKey || 'some/path/to',
        output: sourceOutput,
        trigger: options.trigger,
      }),
    ],
  });
  pipeline.addStage({
    stageName: 'Invoke',
    actions: [
      new cpactions.StepFunctionsInvokeAction({
        actionName: 'Invoke',
        stateMachine: simpleStateMachine,
        stateMachineInputType: cpactions.StateMachineInputType.LITERAL,
        stateMachineInput: '{}',
      }),
    ],
  });
  return sourceStage;
}
