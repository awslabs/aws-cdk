import '@aws-cdk/assert/jest';
import { Stack } from '@aws-cdk/core';
import { PolicyDocument, PolicyStatement } from '../lib';

describe('IoT policy statement', () => {
  describe('from JSON', () => {
    test('parses', () => {
      // given
      const stack = new Stack();

      const s = new PolicyStatement();
      s.addActions('service:action1', 'service:action2');
      s.addAllResources();

      const doc1 = new PolicyDocument();
      doc1.addStatements(s);

      // when
      const doc2 = PolicyDocument.fromJson(doc1.toJSON());

      // then
      expect(stack.resolve(doc2)).toEqual(stack.resolve(doc1));
    });

    test('the kitchen sink', () => {
      const stack = new Stack();

      const policyDocument = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: 'iot:Connect',
            Resource: '*',
          },
          {
            Effect: 'Allow',
            Action: 'iot:Publish',
            Resource: '*',
          },
          {
            Effect: 'Allow',
            Action: [
              'iot:Publish',
              'iot:Subscribe',
            ],
            Resource: [
              'arn:aws:iot:::topic/myTopic',
              'arn:aws:iot:::topicfilter/*',
            ],
          },
        ],
      };

      const doc = PolicyDocument.fromJson(policyDocument);

      expect(stack.resolve(doc)).toEqual(policyDocument);
    });

    test('throws error with field data being object', () => {
      expect(() => {
        PolicyStatement.fromJson({
          Action: {},
        });
      }).toThrow(/Fields must be either a string or an array of strings/);
    });

    test('throws error with field data being array of non-strings', () => {
      expect(() => {
        PolicyStatement.fromJson({
          Action: [{}],
        });
      }).toThrow(/Fields must be either a string or an array of strings/);
    });
  });
});
