# Include CloudFormation templates in the CDK
<!--BEGIN STABILITY BANNER-->

---

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->

This module contains a set of classes whose goal is to facilitate working
with existing CloudFormation templates in the CDK.
It can be thought of as an extension of the capabilities of the
[`CfnInclude` class](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_core.CfnInclude.html).

## Basic usage

Assume we have a file with an existing template.
It could be in JSON format, in a file `my-template.json`:

```json
{
  "Resources": {
    "Bucket": {
      "Type": "AWS::S3::Bucket",
      "Properties": {
        "BucketName": "some-bucket-name"
      }
    }
  }
}
```

Or it could by in YAML format, in a file `my-template.yaml`:

```yaml
Resources:
  Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: some-bucket-name
```

It can be included in a CDK application with the following code:

```ts
import * as cfn_inc from '@aws-cdk/cloudformation-include';

const cfnTemplate = new cfn_inc.CfnInclude(this, 'Template', {
  templateFile: 'my-template.json',
});
```

Or, if your template uses YAML:

```ts
const cfnTemplate = new cfn_inc.CfnInclude(this, 'Template', {
  templateFile: 'my-template.yaml',
});
```

**Note**: different YAML parsers sometimes don't agree on what exactly constitutes valid YAML.
If you get a YAML exception when including your template,
try converting it to JSON, and including that file instead.
If you're downloading your template from the CloudFormation AWS Console,
you can easily get it in JSON format by clicking the 'View in Designer'
button on the 'Template' tab -
once in Designer, select JSON in the "Choose template language"
radio buttons on the bottom pane.

This will add all resources from `my-template.json` / `my-template.yaml` into the CDK application,
preserving their original logical IDs from the template file.

Note that this including process will _not_ execute any
[CloudFormation transforms](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-macros.html) -
including the [Serverless transform](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/transform-aws-serverless.html).

Any resource from the included template can be retrieved by referring to it by its logical ID from the template.
If you know the class of the CDK object that corresponds to that resource,
you can cast the returned object to the correct type:

```ts
import * as s3 from '@aws-cdk/aws-s3';

const cfnBucket = cfnTemplate.getResource('Bucket') as s3.CfnBucket;
// cfnBucket is of type s3.CfnBucket
```

Note that any resources not present in the latest version of the CloudFormation schema
at the time of publishing the version of this module that you depend on,
including [Custom Resources](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-cfn-customresource.html),
will be returned as instances of the class `CfnResource`,
and so cannot be cast to a different resource type.

Any modifications made to that resource will be reflected in the resulting CDK template;
for example, the name of the bucket can be changed:

```ts
cfnBucket.bucketName = 'my-bucket-name';
```

You can also refer to the resource when defining other constructs,
including the higher-level ones
(those whose name does not start with `Cfn`),
for example:

```ts
import * as iam from '@aws-cdk/aws-iam';

const role = new iam.Role(this, 'Role', {
  assumedBy: new iam.AnyPrincipal(),
});
role.addToPolicy(new iam.PolicyStatement({
  actions: ['s3:*'],
  resources: [cfnBucket.attrArn],
}));
```

If you need, you can also convert the CloudFormation resource to a higher-level
resource by importing it:

```ts
const bucket = s3.Bucket.fromBucketName(this, 'L2Bucket', cfnBucket.ref);
// bucket is of type s3.IBucket
```

## Non-resource template elements

In addition to resources,
you can also retrieve and mutate all other template elements:

* [Parameters](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/parameters-section-structure.html):

    ```ts
    import * as core from '@aws-cdk/core';

    const param: core.CfnParameter = cfnTemplate.getParameter('MyParameter');

    // mutating the parameter
    param.default = 'MyDefault';
    ```

* [Conditions](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/conditions-section-structure.html):

    ```ts
    import * as core from '@aws-cdk/core';

    const condition: core.CfnCondition = cfnTemplate.getCondition('MyCondition');

    // mutating the condition
    condition.expression = core.Fn.conditionEquals(1, 2);
    ```

* [Mappings](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/mappings-section-structure.html):

    ```ts
    import * as core from '@aws-cdk/core';

    const mapping: core.CfnMapping = cfnTemplate.getMapping('MyMapping');

    // mutating the mapping
    mapping.setValue('my-region', 'AMI', 'ami-04681a1dbd79675a5');
    ```

* [Service Catalog template Rules](https://docs.aws.amazon.com/servicecatalog/latest/adminguide/reference-template_constraint_rules.html):

    ```ts
    import * as core from '@aws-cdk/core';

    const rule: core.CfnRule = cfnTemplate.getRule('MyRule');

    // mutating the rule
    rule.addAssertion(core.Fn.conditionContains(['m1.small'], myParameter.value),
      'MyParameter has to be m1.small');
    ```

* [Outputs](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/outputs-section-structure.html):

    ```ts
    import * as core from '@aws-cdk/core';

    const output: core.CfnOutput = cfnTemplate.getOutput('MyOutput');

    // mutating the output
    output.value = cfnBucket.attrArn;
    ```

* [Hooks for blue-green deployments](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/blue-green.html):

    ```ts
    import * as core from '@aws-cdk/core';

    const hook: core.CfnHook = cfnTemplate.getHook('MyOutput');

    // mutating the hook
    const codeDeployHook = hook as core.CfnCodeDeployBlueGreenHook;
    codeDeployHook.serviceRole = myRole.roleArn;
    ```

## Parameter replacement

If your existing template uses CloudFormation Parameters,
you may want to remove them in favor of build-time values.
You can do that using the `parameters` property:

```ts
new inc.CfnInclude(this, 'includeTemplate', {
  templateFile: 'path/to/my/template',
  parameters: {
    'MyParam': 'my-value',
  },
});
```

This will replace all references to `MyParam` with the string `'my-value'`,
and `MyParam` will be removed from the 'Parameters' section of the template.

## Nested Stacks

This module also supports templates that use [nested stacks](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-nested-stacks.html).

For example, if you have the following parent template:

```json
{
  "Resources": {
    "ChildStack": {
      "Type": "AWS::CloudFormation::Stack",
      "Properties": {
        "TemplateURL": "https://my-s3-template-source.s3.amazonaws.com/child-stack.json"
      }
    }
  }
}
```

where the child template pointed to by `https://my-s3-template-source.s3.amazonaws.com/child-stack.json` is:

```json
{
  "Resources": {
    "MyBucket": {
      "Type": "AWS::S3::Bucket"
    }
  }
}
```

You can include both the parent stack,
and the nested stack in your CDK application as follows:

```ts
const parentTemplate = new inc.CfnInclude(this, 'ParentStack', {
  templateFile: 'path/to/my-parent-template.json',
  loadNestedStacks: {
    'ChildStack': {
      templateFile: 'path/to/my-nested-template.json',
    },
  },
});
```

Here, `path/to/my-nested-template.json`
represents the path on disk to the downloaded template file from the original template URL of the nested stack
(`https://my-s3-template-source.s3.amazonaws.com/child-stack.json`).
In the CDK application,
this file will be turned into an [Asset](https://docs.aws.amazon.com/cdk/latest/guide/assets.html),
and the `TemplateURL` property of the nested stack resource
will be modified to point to that asset.

The included nested stack can be accessed with the `getNestedStack` method:

```ts
const includedChildStack = parentTemplate.getNestedStack('ChildStack');
const childStack: core.NestedStack = includedChildStack.stack;
const childTemplate: cfn_inc.CfnInclude = includedChildStack.includedTemplate;
```

Now you can reference resources from `ChildStack`,
and modify them like any other included template:

```ts
const cfnBucket = childTemplate.getResource('MyBucket') as s3.CfnBucket;
cfnBucket.bucketName = 'my-new-bucket-name';

const role = new iam.Role(childStack, 'MyRole', {
  assumedBy: new iam.AccountRootPrincipal(),
});

role.addToPolicy(new iam.PolicyStatement({
  actions: [
    's3:GetObject*',
    's3:GetBucket*',
    's3:List*',
  ],
  resources: [cfnBucket.attrArn],
}));
```

You can also include the nested stack after the `CfnInclude` object was created,
instead of doing it on construction:

```ts
const includedChildStack = parentTemplate.loadNestedStack('ChildTemplate', {
  templateFile: 'path/to/my-nested-template.json',
});
```

## Vending CloudFormation templates as Constructs

In many cases, there are existing CloudFormation templates that are not entire applications,
but more like specialized fragments, implementing a particular pattern or best practice.
If you have templates like that,
you can use the `CfnInclude` class to vend them as CDK Constructs:

```ts
import * as path from 'path';

export class MyConstruct extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // include a template inside the Construct
    new cfn_inc.CfnInclude(this, 'MyConstruct', {
      templateFile: path.join(__dirname, 'my-template.json'),
      preserveLogicalIds: false, // <--- !!!
    });
  }
}
```

Notice the `preserveLogicalIds` parameter -
it makes sure the logical IDs of all the included template elements are re-named using CDK's algorithm,
guaranteeing they are unique within your application.
Without that parameter passed,
instantiating `MyConstruct` twice in the same Stack would result in duplicated logical IDs.
