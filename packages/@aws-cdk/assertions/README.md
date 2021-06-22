# Assertions
<!--BEGIN STABILITY BANNER-->

---

![cdk-constructs: Experimental](https://img.shields.io/badge/cdk--constructs-experimental-important.svg?style=for-the-badge)

> The APIs of higher level constructs in this module are experimental and under active development.
> They are subject to non-backward compatible changes or removal in any future version. These are
> not subject to the [Semantic Versioning](https://semver.org/) model and breaking changes will be
> announced in the release notes. This means that while you may use them, you may need to update
> your source code when upgrading to a newer version of this package.

---

<!--END STABILITY BANNER-->

Functions for writing test asserting against CDK applications, with focus on CloudFormation templates.

The `TemplateAssertions` class includes a set of methods for writing assertions against CloudFormation templates. Use one of the `TemplateAssertions.fromXxx()` static methods to create an instance of this class.

To create `TemplateAssertions` from CDK stack, start off with:

```ts
import { Stack } from '@aws-cdk/core';
import { TemplateAssertions } from '@aws-cdk/assertions';

const stack = new Stack(...)
...
const assert = TemplateAssertions.fromStack(stack);
```

Alternatively, assertions can be run on an existing CloudFormation template -

```ts
const template = fs.readFileSync('/path/to/template/file');
const assert = TemplateAssertions.fromString(template);
```

## Full Template Match

The simplest assertion would be to assert that the template matches a given
template.

```ts
assert.templateMatches({
  Resources: {
    Type: 'Foo::Bar',
    Properties: {
      Baz: 'Qux',
    },
  },
});
```

## Counting Resources

This module allows asserting the number of resources of a specific type found
in a template.

```ts
assert.resourceCountIs('Foo::Bar', 2);
```

## Resource Matching

Beyond resource counting, the module also allows asserting that a resource with
specific properties are present.

The following code asserts that the `Properties` section of a resource of type
`Foo::Bar` contains the specified properties -

```ts
assert.hasResourceProperties('Foo::Bar', {
  Foo: 'Bar',
  Baz: 5,
  Qux: [ 'Waldo', 'Fred' ],
});
```

The same method allows asserting the complete definition of the 'Resource'
which can be used to verify things other sections like `DependsOn`, `Metadata`,
`DeletionProperty`, etc.

```ts
assert.hasResourceDefinition('Foo::Bar', {
  Properties: { Foo: 'Bar' },
  DependsOn: [ 'Waldo', 'Fred' ],
});
```

## Special Matchers

The expectation provided to the `hasResourceXXX()` methods, besides carrying
literal values, as seen in the above examples, can also have special matchers
encoded. 
They are available as part of the `Matchers` class and can be used as follows -

```ts
assert.hasResourceProperties('Foo::Bar', {
  Foo: 'Bar',
  Baz: Match.absentProperty(),
})
```

The list of available matchers are -

* `absentProperty()`: Specifies that this key must not be present.

## Strongly typed languages

Some of the APIs documented above, such as `templateMatches()` and
`hasResourceProperties()` accept fluently an arbitrary JSON (like) structure 
its parameter.
This fluency is available only in dynamically typed languages like javascript
and Python.

For strongly typed languages, like Java, you can achieve similar fluency using
any popular JSON deserializer. The following Java example uses `Gson` -

```java
// In Java, using text blocks and Gson
import com.google.gson.Gson;

String json = """
  {
    "Foo": "Bar",
    "Baz": 5,
    "Qux": [ "Waldo", "Fred" ],
  } """;

Map expected = new Gson().fromJson(json, Map.class);
assert.hasResourceProperties("Foo::Bar", expected);
```
