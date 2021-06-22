import {
  arrayWith,
} from '@aws-cdk/assert-internal';
import '@aws-cdk/assert-internal/jest';
import * as cp from '@aws-cdk/aws-codepipeline';
import { Stack } from '@aws-cdk/core';
import * as cdkp from '../../lib';
import { TestApp } from '../testutil';

let app: TestApp;
let pipelineStack: Stack;

test('self-update project role has proper permissions', () => {
  app = new TestApp();
  pipelineStack = new Stack(app, 'PipelineStack');

  new cdkp.UpdatePipelineAction(pipelineStack, 'Update', {
    cloudAssemblyInput: new cp.Artifact(),
    pipelineStackHierarchicalId: pipelineStack.node.path,
    projectName: 'pipeline-selfupdate',
  });

  expect(pipelineStack).toHaveResourceLike('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: arrayWith(
        {
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Resource: { 'Fn::Join': ['', ['arn:*:iam::', { Ref: 'AWS::AccountId' }, ':role/*']] },
          Condition: {
            'ForAnyValue:StringEquals': {
              'iam:ResourceTag/aws-cdk:bootstrap-role': ['image-publishing', 'file-publishing', 'deploy'],
            },
          },
        },
        {
          Action: 'cloudformation:DescribeStacks',
          Effect: 'Allow',
          Resource: '*',
        },
        {
          Action: 's3:ListBucket',
          Effect: 'Allow',
          Resource: '*',
        },
      ),
    },
  });

});
