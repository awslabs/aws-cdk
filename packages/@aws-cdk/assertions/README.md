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

Alternatively, if you would like to assert the entire resource definition, you
can use the `hasResource()` API.

```ts
assert.hasResource('Foo::Bar', {
  Properties: { Foo: 'Bar' },
  DependsOn: [ 'Waldo', 'Fred' ],
});
```

By default, the `hasResource()` and `hasResourceProperties()` APIs perform deep
partial object matching. This behavior can be configured using matchers.
See subsequent section on [special matchers](#special-matchers).

## Special Matchers

The expectation provided to the `hasResourceXXX()` methods, besides carrying
literal values, as seen in the above examples, can also have special matchers
encoded. 
They are available as part of the `Match` class.

### Object Matchers

The `Match.objectLike()` API can be used to assert that the target is a superset
object of the provided pattern.
This API will perform a deep partial match on the target.
Deep partial matching is where objects are matched partially recursively. At each
level, the list of keys in the target is a subset of the provided pattern.

```ts
// Given a template -
// {
//   "Resources": {
//     "MyBar": {
//       "Type": "Foo::Bar",
//       "Properties": {
//         "Fred": {
//           "Wobble": "Flob",
//           "Bob": "Cat"
//         }
//       }
//     }
//   }
// }

// The following will NOT throw an assertion error
assert.hasResourceProperties('Foo::Bar', {
  Fred: Match.objectLike({
    Wobble: 'Flob',
  }),
});

// The following will throw an assertion error
assert.hasResourceProperties('Foo::Bar', {
  Fred: Match.objectLike({
    Brew: 'Coffee',
  })
});
```

The `Match.objectEquals()` API can be used to assert a target as a deep exact
match.

In addition, the `Match.absentProperty()` can be used to specify that a specific
property should not exist on the target. This can be used within `Match.objectLike()`
or outside of any matchers.

```ts
// Given a template -
// {
//   "Resources": {
//     "MyBar": {
//       "Type": "Foo::Bar",
//       "Properties": {
//         "Fred": {
//           "Wobble": "Flob",
//         }
//       }
//     }
//   }
// }

// The following will NOT throw an assertion error
assert.hasResourceProperties('Foo::Bar', {
  Fred: Match.objectLike({
    Bob: Match.absentProperty(),
  }),
});

// The following will throw an assertion error
assert.hasResourceProperties('Foo::Bar', {
  Fred: Match.objectLike({
    Wobble: Match.absentProperty(),
  })
});
```

### Array Matchers

The `Match.arrayWith()` API can be used to assert that the target is equal to or a subset
of the provided pattern array.
This API will perform subset match on the target.

```ts
// Given a template -
// {
//   "Resources": {
//     "MyBar": {
//       "Type": "Foo::Bar",
//       "Properties": {
//         "Fred": ["Flob", "Cat"]
//       }
//     }
//   }
// }

// The following will NOT throw an assertion error
assert.hasResourceProperties('Foo::Bar', {
  Fred: Match.arrayWith(['Flob']),
});

// The following will throw an assertion error
assert.hasResourceProperties('Foo::Bar', Match.objectLike({
  Fred: Match.arrayWith(['Wobble']);
}});
```

*Note:* The list of items in the pattern array should be in order as they appear in the
target array. Out of order will be recorded as a match failure.

Alternatively, the `Match.arrayEquals()` API can be used to assert that the target is
exactly equal to the pattern array.

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
