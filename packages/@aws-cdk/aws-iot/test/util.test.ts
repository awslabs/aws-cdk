import * as cdk from '@aws-cdk/core';
import { nodeunitShim, Test } from 'nodeunit-shim';
import { parseCertificateArn, parseCertificateId, parsePolicyArn } from '../lib/util';

nodeunitShim({
  certificateArnFromId: {
    'produce arn from certificate id'(test: Test) {
      const stack = new cdk.Stack();
      const certificateId = 'hello';

      test.deepEqual(stack.resolve(parseCertificateArn(stack, { certificateId })), {
        'Fn::Join':
          ['',
            ['arn:',
              { Ref: 'AWS::Partition' },
              ':iot:',
              { Ref: 'AWS::Region' },
              ':',
              { Ref: 'AWS::AccountId' },
              ':cert/hello']],
      });

      test.done();
    },
  },
  certificateIdFromArn: {
    'produce certificate id when given arn'(test: Test) {
      const stack = new cdk.Stack();
      const certificateArn = 'arn:aws:iot:us-east-1:123456789012:cert/hello';
      test.deepEqual(parseCertificateId(stack, { certificateArn }), 'hello');
      test.done();
    },
  },
  policyArnFromId: {
    'produce arn from policy name'(test: Test) {
      const stack = new cdk.Stack();
      const policyName = 'hello';
      test.deepEqual(stack.resolve(parsePolicyArn(stack, policyName)), {
        'Fn::Join':
          ['',
            ['arn:',
              { Ref: 'AWS::Partition' },
              ':iot:',
              { Ref: 'AWS::Region' },
              ':',
              { Ref: 'AWS::AccountId' },
              ':policy/hello']],
      });
      test.done();
    },
  },
});
