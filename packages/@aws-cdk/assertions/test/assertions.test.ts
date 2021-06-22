import { CfnResource, Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { TemplateAssertions } from '../lib';

describe('StackAssertions', () => {
  describe('fromString', () => {
    test('default', () => {
      const assertions = TemplateAssertions.fromString(`{
        "Resources": { 
          "Foo": { 
            "Type": "Baz::Qux",
            "Properties": { "Fred": "Waldo" }
          } 
        }
      }`);
      assertions.resourceCountIs('Baz::Qux', 1);
    });
  });

  describe('fromStack', () => {
    test('fails when root is not a stage', () => {
      const c = new Construct(undefined as any, '');
      const stack = new Stack(c, 'MyStack');
      expect(() => TemplateAssertions.fromStack(stack)).toThrow(/must be part of a Stage or an App/);
    });
  });

  describe('resourceCountIs', () => {
    test('resource exists', () => {
      const stack = new Stack();
      new CfnResource(stack, 'Resource', {
        type: 'Foo::Bar',
      });

      const inspect = TemplateAssertions.fromStack(stack);
      inspect.resourceCountIs('Foo::Bar', 1);

      expect(() => inspect.resourceCountIs('Foo::Bar', 0)).toThrow(/has 1 resource of type Foo::Bar/);
      expect(() => inspect.resourceCountIs('Foo::Bar', 2)).toThrow(/has 1 resource of type Foo::Bar/);

      expect(() => inspect.resourceCountIs('Foo::Baz', 1)).toThrow(/has 0 resource of type Foo::Baz/);
    });

    test('no resource', () => {
      const stack = new Stack();

      const inspect = TemplateAssertions.fromStack(stack);
      inspect.resourceCountIs('Foo::Bar', 0);

      expect(() => inspect.resourceCountIs('Foo::Bar', 1)).toThrow(/has 0 resource of type Foo::Bar/);
    });
  });

  describe('hasResourceXXX', () => {
    test('property matching', () => {
      const stack = new Stack();
      new CfnResource(stack, 'Resource', {
        type: 'Foo::Bar',
        properties: {
          baz: 'qux',
        },
      });

      const inspect = TemplateAssertions.fromStack(stack);
      inspect.hasResourceProperties('Foo::Bar', { baz: 'qux' });

      expect(
        () => inspect.hasResourceProperties('Foo::Bar', { fred: 'waldo' }),
      ).toThrow(/None .* matches resource 'Foo::Bar'/);
      expect(
        () => inspect.hasResourceProperties('Foo::Baz', {}),
      ).toThrow(/None .* matches resource 'Foo::Baz'/);
    });

    test('no resource', () => {
      const stack = new Stack();
      new CfnResource(stack, 'Resource', {
        type: 'Foo::Bar',
      });

      const inspect = TemplateAssertions.fromStack(stack);
      expect(
        () => inspect.hasResourceProperties('Foo::Baz', {}),
      ).toThrow(/None .* matches resource 'Foo::Baz'/);
    });

    test('complete definition', () => {
      const stack = new Stack();
      const bar = new CfnResource(stack, 'Bar', { type: 'Foo::Bar', properties: { baz: 'qux' } });
      const baz = new CfnResource(stack, 'Baz', { type: 'Foo::Baz' });
      bar.node.addDependency(baz);

      const inspect = TemplateAssertions.fromStack(stack);
      inspect.hasResourceDefinition('Foo::Bar', {
        Properties: { baz: 'qux' },
        DependsOn: ['Baz'],
      });
    });
  });

  describe('templateMatches', () => {
    test('matches', () => {
      const stack = new Stack();
      new CfnResource(stack, 'Foo', {
        type: 'Foo::Bar',
        properties: { baz: 'qux' },
      });

      const inspect = TemplateAssertions.fromStack(stack);
      inspect.templateMatches({
        Resources: {
          Foo: {
            Type: 'Foo::Bar',
            Properties: { baz: 'qux' },
          },
        },
      });
    });

    test('fails', () => {
      const stack = new Stack();
      new CfnResource(stack, 'Foo', {
        type: 'Foo::Bar',
        properties: { baz: 'qux' },
      });

      const inspect = TemplateAssertions.fromStack(stack);
      expect(() => inspect.templateMatches({
        Resources: {
          Foo: {
            Type: 'Foo::Bar',
            Properties: { baz: 'waldo' },
          },
        },
      })).resolves;
    });
  });
});