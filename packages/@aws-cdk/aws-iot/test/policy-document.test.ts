import '@aws-cdk/assert/jest';
import { Lazy, Stack } from '@aws-cdk/core';
import { Effect, PolicyDocument, PolicyStatement } from '../lib';

describe('IoT policy document', () => {
  test('the Permission class is a programming model for iot', () => {
    const stack = new Stack();

    const p = new PolicyStatement();
    p.addActions('iot:GetPendingJobExecutions');
    p.addActions('iot:StartNextPendingJobExecution', 'iot:UpdateJobExecution');
    p.addResources('arn:aws:iot:us-east-1:123456789012:thing/thingOne');
    p.addResources('arn:aws:iot:us-east-1:123456789012:thing/thingTwo');

    p.addAllResources();

    expect(stack.resolve(p.toStatementJson())).toEqual({
      Action:
      ['iot:GetPendingJobExecutions',
        'iot:StartNextPendingJobExecution',
        'iot:UpdateJobExecution'],
      Resource:
      ['arn:aws:iot:us-east-1:123456789012:thing/thingOne',
        'arn:aws:iot:us-east-1:123456789012:thing/thingTwo',
        '*'],
      Effect: 'Allow',
    });
  });

  test('the PolicyDocument class is a dom for iot policy documents', () => {
    const stack = new Stack();
    const doc = new PolicyDocument();
    const p1 = new PolicyStatement();
    p1.addActions('iot:UpdateThingShadow');

    const p2 = new PolicyStatement();
    p2.effect = Effect.DENY;
    p2.addActions('iot:DeleteThingShadow');

    doc.addStatements(p1);
    doc.addStatements(p2);

    expect(stack.resolve(doc)).toEqual({
      Version: '2012-10-17',
      Statement:
        [{ Effect: 'Allow', Action: 'iot:UpdateThingShadow' },
          { Effect: 'Deny', Action: 'iot:DeleteThingShadow' }],
    });
  });

  test('Throws with invalid actions', () => {
    expect(() => {
      new PolicyStatement({
        actions: ['service:action', '*', 'service:acti*', 'in:val:id'],
      });
    }).toThrow(/Action 'in:val:id' is invalid/);
  });

  // https://github.com/aws/aws-cdk/issues/13479
  test('Does not validate unresolved tokens', () => {
    const stack = new Stack();
    const perm = new PolicyStatement({
      actions: [`${Lazy.string({ produce: () => 'sqs:sendMessage' })}`],
    });

    expect(stack.resolve(perm.toStatementJson())).toEqual({
      Effect: 'Allow',
      Action: 'sqs:sendMessage',
    });
  });

  test('Permission allows specifying multiple actions upon construction', () => {
    const stack = new Stack();
    const perm = new PolicyStatement();
    perm.addResources('MyResource');
    perm.addActions('Action1', 'Action2', 'Action3');

    expect(stack.resolve(perm.toStatementJson())).toEqual({
      Effect: 'Allow',
      Action: ['Action1', 'Action2', 'Action3'],
      Resource: 'MyResource',
    });
  });

  test('PolicyDoc resolves to undefined if there are no permissions', () => {
    const stack = new Stack();
    const p = new PolicyDocument();
    expect(stack.resolve(p)).toBeUndefined();
  });


  describe('hasResource', () => {
    test('false if there are no resources', () => {
      expect(new PolicyStatement().hasResource).toEqual(false);
    });

    test('true if there is one resource', () => {
      expect(new PolicyStatement({ resources: ['one-resource'] }).hasResource).toEqual(true);
    });

    test('true for multiple resources', () => {
      const p = new PolicyStatement();
      p.addResources('r1');
      p.addResources('r2');
      expect(p.hasResource).toEqual(true);
    });
  });

  test('statementCount returns the number of statement in the policy document', () => {
    const p = new PolicyDocument();
    expect(p.statementCount).toEqual(0);
    p.addStatements(new PolicyStatement({ actions: ['service:action1'] }));
    expect(p.statementCount).toEqual(1);
    p.addStatements(new PolicyStatement({ actions: ['service:action2'] }));
    expect(p.statementCount).toEqual(2);
  });

  test('addResources() will not break a list-encoded Token', () => {
    const stack = new Stack();

    const statement = new PolicyStatement();
    statement.addActions(...Lazy.list({ produce: () => ['a', 'b', 'c'] }));
    statement.addResources(...Lazy.list({ produce: () => ['x', 'y', 'z'] }));

    expect(stack.resolve(statement.toStatementJson())).toEqual({
      Effect: 'Allow',
      Action: ['a', 'b', 'c'],
      Resource: ['x', 'y', 'z'],
    });
  });

  describe('duplicate statements', () => {

    test('without tokens', () => {
      // GIVEN
      const stack = new Stack();
      const p = new PolicyDocument();

      const statement = new PolicyStatement();
      statement.addResources('resource1', 'resource2');
      statement.addActions('action1', 'action2');
      // WHEN
      p.addStatements(statement);
      p.addStatements(statement);
      p.addStatements(statement);

      // THEN
      expect(stack.resolve(p).Statement).toHaveLength(1);
    });

    test('with tokens', () => {
      // GIVEN
      const stack = new Stack();
      const p = new PolicyDocument();

      const statement1 = new PolicyStatement();
      statement1.addResources(Lazy.string({ produce: () => 'resource' }));
      statement1.addActions(Lazy.string({ produce: () => 'action' }));

      const statement2 = new PolicyStatement();
      statement2.addResources(Lazy.string({ produce: () => 'resource' }));
      statement2.addActions(Lazy.string({ produce: () => 'action' }));

      // WHEN
      p.addStatements(statement1);
      p.addStatements(statement2);

      // THEN
      expect(stack.resolve(p).Statement).toHaveLength(1);
    });
  });

  test('constructor args are equivalent to mutating in-place', () => {
    const stack = new Stack();

    const s = new PolicyStatement();
    s.addActions('service:action1', 'service:action2');
    s.addAllResources();

    const doc1 = new PolicyDocument();
    doc1.addStatements(s);

    const doc2 = new PolicyDocument();
    doc2.addStatements(new PolicyStatement({
      actions: ['service:action1', 'service:action2'],
      resources: ['*'],
    }));

    expect(stack.resolve(doc1)).toEqual(stack.resolve(doc2));
  });

  describe('fromJson', () => {
    test('throws error when Statement isn\'t an array', () => {
      expect(() => {
        PolicyDocument.fromJson({
          Statement: 'asdf',
        });
      }).toThrow(/Statement must be an array/);
    });
  });
});
