import { CfnResource, Stack } from '@aws-cdk/core';
import { Match, TemplateAssertions } from '../lib';

describe('Matchers', () => {
  test('absent', () => {
    const stack = new Stack();
    new CfnResource(stack, 'Resource', {
      type: 'Foo::Bar',
      properties: {
        baz: 'qux',
      },
    });

    const inspect = TemplateAssertions.fromStack(stack);
    inspect.hasResourceProperties('Foo::Bar', {
      fred: Match.absentProperty(),
    });

    expect(() => inspect.hasResourceProperties('Foo::Bar', {
      baz: Match.absentProperty(),
    })).toThrow(/None .* matches resource 'Foo::Bar'/);
  });
});