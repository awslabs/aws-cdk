import '@aws-cdk/assert-internal/jest';
import { Stack } from '@aws-cdk/core';
import { AnyPrincipal, Group, PolicyDocument, PolicyStatement } from '../lib';

describe('IAM policy statement', () => {
  describe('from JSON', () => {
    test('parses with no principal', () => {
      // given
      const stack = new Stack();

      const s = new PolicyStatement();
      s.addActions('service:action1', 'service:action2');
      s.addAllResources();
      s.addCondition('key', { equals: 'value' });

      const doc1 = new PolicyDocument();
      doc1.addStatements(s);

      // when
      const doc2 = PolicyDocument.fromJson(doc1.toJSON());

      // then
      expect(stack.resolve(doc2)).toEqual(stack.resolve(doc1));
    });

    test('parses a given Principal', () => {
      const stack = new Stack();

      const s = new PolicyStatement();
      s.addActions('service:action1', 'service:action2');
      s.addAllResources();
      s.addArnPrincipal('somearn');
      s.addCondition('key', { equals: 'value' });

      const doc1 = new PolicyDocument();
      doc1.addStatements(s);

      const doc2 = PolicyDocument.fromJson(doc1.toJSON());

      expect(stack.resolve(doc2)).toEqual(stack.resolve(doc1));
    });

    test('parses a given notPrincipal', () => {
      const stack = new Stack();

      const s = new PolicyStatement();
      s.addActions('service:action1', 'service:action2');
      s.addAllResources();
      s.addNotPrincipals(new AnyPrincipal());
      s.addCondition('key', { equals: 'value' });

      const doc1 = new PolicyDocument();
      doc1.addStatements(s);

      const doc2 = PolicyDocument.fromJson(doc1.toJSON());

      expect(stack.resolve(doc2)).toEqual(stack.resolve(doc1));
    });

    test('parses with notAction', () => {
      const stack = new Stack();

      const s = new PolicyStatement();
      s.addNotActions('service:action3');
      s.addAllResources();

      const doc1 = new PolicyDocument();
      doc1.addStatements(s);

      const doc2 = PolicyDocument.fromJson(doc1.toJSON());

      expect(stack.resolve(doc2)).toEqual(stack.resolve(doc1));
    });

    test('parses with notActions', () => {
      const stack = new Stack();

      const s = new PolicyStatement();
      s.addNotActions('service:action3', 'service:action4');
      s.addAllResources();

      const doc1 = new PolicyDocument();
      doc1.addStatements(s);

      const doc2 = PolicyDocument.fromJson(doc1.toJSON());

      expect(stack.resolve(doc2)).toEqual(stack.resolve(doc1));
    });

    test('parses with notResource', () => {
      const stack = new Stack();

      const s = new PolicyStatement();
      s.addActions('service:action3', 'service:action4');
      s.addNotResources('resource1');

      const doc1 = new PolicyDocument();
      doc1.addStatements(s);

      const doc2 = PolicyDocument.fromJson(doc1.toJSON());

      expect(stack.resolve(doc2)).toEqual(stack.resolve(doc1));
    });

    test('parses with notResources', () => {
      const stack = new Stack();

      const s = new PolicyStatement();
      s.addActions('service:action3', 'service:action4');
      s.addNotResources('resource1', 'resource2');

      const doc1 = new PolicyDocument();
      doc1.addStatements(s);

      const doc2 = PolicyDocument.fromJson(doc1.toJSON());

      expect(stack.resolve(doc2)).toEqual(stack.resolve(doc1));
    });

    test('the kitchen sink', () => {
      const stack = new Stack();

      const policyDocument = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'FirstStatement',
            Effect: 'Allow',
            Action: 'iam:ChangePassword',
            Resource: '*',
          },
          {
            Sid: 'SecondStatement',
            Effect: 'Allow',
            Action: 's3:ListAllMyBuckets',
            Resource: '*',
          },
          {
            Sid: 'ThirdStatement',
            Effect: 'Allow',
            Action: [
              's3:List*',
              's3:Get*',
            ],
            Resource: [
              'arn:aws:s3:::confidential-data',
              'arn:aws:s3:::confidential-data/*',
            ],
            Condition: { Bool: { 'aws:MultiFactorAuthPresent': 'true' } },
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

  test('throws error when group is specified for \'Principal\' or \'NotPrincipal\'', () => {
    const stack = new Stack();
    const group = new Group(stack, 'groupId');
    const policyStatement = new PolicyStatement();

    expect(() => policyStatement.addPrincipals(group))
      .toThrow(/Cannot use an IAM Group as the 'Principal' or 'NotPrincipal' in an IAM Policy/);
    expect(() => policyStatement.addNotPrincipals(group))
      .toThrow(/Cannot use an IAM Group as the 'Principal' or 'NotPrincipal' in an IAM Policy/);
  });
});
