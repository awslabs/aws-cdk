import * as path from 'path';
import { ABSENT, ResourcePart } from '@aws-cdk/assert-internal';
import '@aws-cdk/assert-internal/jest';
import * as s3 from '@aws-cdk/aws-s3';
import * as core from '@aws-cdk/core';
import * as inc from '../lib';
import * as futils from '../lib/file-utils';

/* eslint-disable quote-props */
/* eslint-disable quotes */

describe('CDK Include for nested stacks', () => {
  let stack: core.Stack;

  beforeEach(() => {
    stack = new core.Stack();
  });

  test('can ingest a template with one child', () => {
    const parentTemplate = new inc.CfnInclude(stack, 'ParentStack', {
      templateFile: testTemplateFilePath('parent-one-child.json'),
      loadNestedStacks: {
        'ChildStack': {
          templateFile: testTemplateFilePath('grandchild-import-stack.json'),
        },
      },
    });

    const childStack = parentTemplate.getNestedStack('ChildStack');
    expect(childStack.stack).toMatchTemplate(
      loadTestFileToJsObject('grandchild-import-stack.json'),
    );
  });

  test('can ingest a template with two children', () => {
    const parentTemplate = new inc.CfnInclude(stack, 'ParentStack', {
      templateFile: testTemplateFilePath('parent-two-children.json'),
      loadNestedStacks: {
        'ChildStack': {
          templateFile: testTemplateFilePath('grandchild-import-stack.json'),
        },
        'AnotherChildStack': {
          templateFile: testTemplateFilePath('grandchild-import-stack.json'),
        },
      },
    });

    const childStack = parentTemplate.getNestedStack('ChildStack');
    const anotherChildStack = parentTemplate.getNestedStack('AnotherChildStack');
    expect(childStack.stack).toMatchTemplate(
      loadTestFileToJsObject('grandchild-import-stack.json'),
    );

    expect(anotherChildStack.stack).toMatchTemplate(
      loadTestFileToJsObject('grandchild-import-stack.json'),
    );
  });

  test('can ingest a template with one child and one grandchild', () => {
    const parentTemplate = new inc.CfnInclude(stack, 'ParentStack', {
      templateFile: testTemplateFilePath('parent-two-children.json'),
      loadNestedStacks: {
        'ChildStack': {
          templateFile: testTemplateFilePath('child-import-stack.json'),
          loadNestedStacks: {
            'GrandChildStack': {
              templateFile: testTemplateFilePath('grandchild-import-stack.json'),
            },
          },
        },
      },
    });

    const childStack = parentTemplate.getNestedStack('ChildStack');
    const grandChildStack = childStack.includedTemplate.getNestedStack('GrandChildStack');
    expect(childStack.stack).toMatchTemplate(
      loadTestFileToJsObject('child-import-stack.expected.json'),
    );

    expect(grandChildStack.stack).toMatchTemplate(
      loadTestFileToJsObject('grandchild-import-stack.json'),
    );
  });

  test('throws an error when provided a nested stack that is not present in the template', () => {
    expect(() => {
      new inc.CfnInclude(stack, 'ParentStack', {
        templateFile: testTemplateFilePath('parent-two-children.json'),
        loadNestedStacks: {
          'FakeStack': {
            templateFile: testTemplateFilePath('child-import-stack.json'),
          },
        },
      });
    }).toThrow(/Nested Stack with logical ID 'FakeStack' was not found in the template/);
  });

  test('throws an exception when NestedStacks contains an ID that is not a CloudFormation::Stack in the template', () => {
    expect(() => {
      new inc.CfnInclude(stack, 'ParentStack', {
        templateFile: testTemplateFilePath('child-import-stack.json'),
        loadNestedStacks: {
          'BucketImport': {
            templateFile: testTemplateFilePath('grandchild-import-stack.json'),
          },
        },
      });
    }).toThrow(/Nested Stack with logical ID 'BucketImport' is not an AWS::CloudFormation::Stack resource/);
  });

  test('throws an exception when the nestedStack resource uses the CreationPolicy attribute', () => {
    expect(() => {
      new inc.CfnInclude(stack, 'ParentStack', {
        templateFile: testTemplateFilePath('parent-creation-policy.json'),
        loadNestedStacks: {
          'ChildStack': {
            templateFile: testTemplateFilePath('grandchild-import-stack.json'),
          },
        },
      });
    }).toThrow(/CreationPolicy is not supported by the AWS::CloudFormation::Stack resource/);
  });

  test('throws an exception when the nested stack resource uses the UpdatePolicy attribute', () => {
    expect(() => {
      new inc.CfnInclude(stack, 'ParentStack', {
        templateFile: testTemplateFilePath('parent-update-policy.json'),
        loadNestedStacks: {
          'ChildStack': {
            templateFile: testTemplateFilePath('grandchild-import-stack.json'),
          },
        },
      });
    }).toThrow(/UpdatePolicy is not supported by the AWS::CloudFormation::Stack resource/);
  });

  test('throws an exception when a nested stack refers to a Condition that does not exist in the template', () => {
    expect(() => {
      new inc.CfnInclude(stack, 'ParentStack', {
        templateFile: testTemplateFilePath('parent-invalid-condition.json'),
        loadNestedStacks: {
          'ChildStack': {
            templateFile: testTemplateFilePath('grandchild-import-stack.json'),
          },
        },
      });
    }).toThrow(/Resource 'ChildStack' uses Condition 'FakeCondition' that doesn't exist/);
  });

  test('throws an exception when a nested stacks depends on a resource that does not exist in the template', () => {
    expect(() => {
      new inc.CfnInclude(stack, 'ParentStack', {
        templateFile: testTemplateFilePath('parent-bad-depends-on.json'),
        loadNestedStacks: {
          'ChildStack': {
            templateFile: testTemplateFilePath('child-import-stack.json'),
          },
        },
      });
    }).toThrow(/Resource 'ChildStack' depends on 'AFakeResource' that doesn't exist/);
  });

  test('throws an exception when an ID was passed in loadNestedStacks that is a resource type not in the CloudFormation schema', () => {
    expect(() => {
      new inc.CfnInclude(stack, 'Template', {
        templateFile: testTemplateFilePath('custom-resource.json'),
        loadNestedStacks: {
          'CustomResource': {
            templateFile: testTemplateFilePath('whatever.json'),
          },
        },
      });
    }).toThrow(/Nested Stack with logical ID 'CustomResource' is not an AWS::CloudFormation::Stack resource/);
  });

  test('can modify resources in nested stacks', () => {
    const parent = new inc.CfnInclude(stack, 'ParentStack', {
      templateFile: testTemplateFilePath('child-import-stack.json'),
      loadNestedStacks: {
        'GrandChildStack': {
          templateFile: testTemplateFilePath('grandchild-import-stack.json'),
        },
      },
    });

    const childTemplate = parent.getNestedStack('GrandChildStack').includedTemplate;
    const bucket = childTemplate.getResource('BucketImport') as s3.CfnBucket;

    bucket.bucketName = 'modified-bucket-name';

    expect(childTemplate.stack).toHaveResource('AWS::S3::Bucket', { BucketName: 'modified-bucket-name' });
  });

  test('can use a condition', () => {
    const parent = new inc.CfnInclude(stack, 'ParentStack', {
      templateFile: testTemplateFilePath('parent-valid-condition.json'),
      loadNestedStacks: {
        'ChildStack': {
          templateFile: testTemplateFilePath('grandchild-import-stack.json'),
        },
      },
    });

    const alwaysFalseCondition = parent.getCondition('AlwaysFalseCond');

    expect(parent.getResource('ChildStack').cfnOptions.condition).toBe(alwaysFalseCondition);
  });

  test('asset parameters generated in parent and child are identical', () => {
    new inc.CfnInclude(stack, 'ParentStack', {
      templateFile: testTemplateFilePath('parent-one-child.json'),
      loadNestedStacks: {
        'ChildStack': {
          templateFile: testTemplateFilePath('grandchild-import-stack.json'),
        },
      },
    });

    const assetParam = 'AssetParameters5dc7d4a99cfe2979687dc74f2db9fd75f253b5505a1912b5ceecf70c9aefba50S3BucketEAA24F0C';
    const assetParamKey = 'AssetParameters5dc7d4a99cfe2979687dc74f2db9fd75f253b5505a1912b5ceecf70c9aefba50S3VersionKey1194CAB2';
    expect(stack).toMatchTemplate({
      "Parameters": {
        [assetParam]: {
          "Type": "String",
          "Description": "S3 bucket for asset \"5dc7d4a99cfe2979687dc74f2db9fd75f253b5505a1912b5ceecf70c9aefba50\"",
        },
        [assetParamKey]: {
          "Type": "String",
          "Description": "S3 key for asset version \"5dc7d4a99cfe2979687dc74f2db9fd75f253b5505a1912b5ceecf70c9aefba50\"",
        },
        "AssetParameters5dc7d4a99cfe2979687dc74f2db9fd75f253b5505a1912b5ceecf70c9aefba50ArtifactHash9C417847": {
          "Type": "String",
          "Description": "Artifact hash for asset \"5dc7d4a99cfe2979687dc74f2db9fd75f253b5505a1912b5ceecf70c9aefba50\"",
        },
      },
      "Resources": {
        "ChildStack": {
          "Type": "AWS::CloudFormation::Stack",
          "Properties": {
            "TemplateURL": {
              "Fn::Join": ["", [
                "https://s3.",
                { "Ref": "AWS::Region" },
                ".",
                { "Ref": "AWS::URLSuffix" },
                "/",
                { "Ref": assetParam },
                "/",
                {
                  "Fn::Select": [
                    0,
                    {
                      "Fn::Split": [
                        "||",
                        { "Ref": assetParamKey },
                      ],
                    },
                  ],
                },
                {
                  "Fn::Select": [
                    1,
                    {
                      "Fn::Split": [
                        "||",
                        { "Ref": assetParamKey },
                      ],
                    },
                  ],
                },
              ]],
            },
            "Parameters": {
              "MyBucketParameter": "some-magic-bucket-name",
            },
          },
        },
      },
    });
  });

  test('templates with nested stacks that were not provided in the loadNestedStacks property are left unmodified', () => {
    new inc.CfnInclude(stack, 'ParentStack', {
      templateFile: testTemplateFilePath('parent-two-children.json'),
    });

    expect(stack).toMatchTemplate(loadTestFileToJsObject('parent-two-children.json'));
  });

  test('getNestedStack() throws an exception when getting a resource that does not exist in the template', () => {
    const parentTemplate = new inc.CfnInclude(stack, 'ParentStack', {
      templateFile: testTemplateFilePath('parent-two-children.json'),
      loadNestedStacks: {
        'ChildStack': {
          templateFile: testTemplateFilePath('child-import-stack.json'),
        },
      },
    });

    expect(() => {
      parentTemplate.getNestedStack('FakeStack');
    }).toThrow(/Nested Stack with logical ID 'FakeStack' was not found/);
  });

  test('getNestedStack() throws an exception when getting a resource that exists in the template, but is not a Stack', () => {
    const parentTemplate = new inc.CfnInclude(stack, 'ParentStack', {
      templateFile: testTemplateFilePath('parent-two-children.json'),
      loadNestedStacks: {
        'ChildStack': {
          templateFile: testTemplateFilePath('child-import-stack.json'),
        },
      },
    });

    const childTemplate = parentTemplate.getNestedStack('ChildStack').includedTemplate;

    expect(() => {
      childTemplate.getNestedStack('BucketImport');
    }).toThrow(/Resource with logical ID 'BucketImport' is not a CloudFormation Stack/);
  });

  test('getNestedStack() throws an exception when getting a nested stack that exists in the template, but was not specified in the props', () => {
    const parentTemplate = new inc.CfnInclude(stack, 'ParentStack', {
      templateFile: testTemplateFilePath('parent-two-children.json'),
      loadNestedStacks: {
        'ChildStack': {
          templateFile: testTemplateFilePath('child-import-stack.json'),
        },
      },
    });

    expect(() => {
      parentTemplate.getNestedStack('AnotherChildStack');
    }).toThrow(/Nested Stack 'AnotherChildStack' was not included in the parent template/);
  });

  test('correctly handles references in nested stacks Parameters', () => {
    new inc.CfnInclude(stack, 'ParentStack', {
      templateFile: testTemplateFilePath('cross-stack-refs.json'),
      loadNestedStacks: {
        'ChildStack': {
          templateFile: testTemplateFilePath('child-import-stack.json'),
        },
      },
    });

    expect(stack).toHaveResourceLike('AWS::CloudFormation::Stack', {
      "Parameters": {
        "Param1": {
          "Ref": "Param",
        },
        "Param2": {
          "Fn::GetAtt": ["Bucket", "Arn"],
        },
      },
    });
  });

  test('correctly handles renaming of references across nested stacks', () => {
    const parentTemplate = new inc.CfnInclude(stack, 'ParentStack', {
      templateFile: testTemplateFilePath('cross-stack-refs.json'),
      loadNestedStacks: {
        'ChildStack': {
          templateFile: testTemplateFilePath('child-import-stack.json'),
        },
      },
    });
    const cfnBucket = parentTemplate.getResource('Bucket');
    cfnBucket.overrideLogicalId('DifferentBucket');
    const parameter = parentTemplate.getParameter('Param');
    parameter.overrideLogicalId('DifferentParameter');

    expect(stack).toHaveResourceLike('AWS::CloudFormation::Stack', {
      "Parameters": {
        "Param1": {
          "Ref": "DifferentParameter",
        },
        "Param2": {
          "Fn::GetAtt": ["DifferentBucket", "Arn"],
        },
      },
    });
  });

  test('returns the CfnStack object from getResource() for a nested stack that was not in the loadNestedStacks property', () => {
    const cfnTemplate = new inc.CfnInclude(stack, 'ParentStack', {
      templateFile: testTemplateFilePath('parent-two-children.json'),
    });

    const childStack1 = cfnTemplate.getResource('ChildStack');

    expect(childStack1).toBeInstanceOf(core.CfnStack);
  });

  test('returns the CfnStack object from getResource() for a nested stack that was in the loadNestedStacks property', () => {
    const cfnTemplate = new inc.CfnInclude(stack, 'ParentStack', {
      templateFile: testTemplateFilePath('parent-one-child.json'),
      loadNestedStacks: {
        'ChildStack': {
          templateFile: testTemplateFilePath('child-import-stack.json'),
        },
      },
    });

    const childStack1 = cfnTemplate.getResource('ChildStack');

    expect(childStack1).toBeInstanceOf(core.CfnStack);
  });

  test("handles Metadata, DeletionPolicy, and UpdateReplacePolicy attributes of the nested stack's resource", () => {
    new inc.CfnInclude(stack, 'ParentStack', {
      templateFile: testTemplateFilePath('parent-with-attributes.json'),
      loadNestedStacks: {
        'ChildStack': {
          templateFile: testTemplateFilePath('child-import-stack.json'),
        },
      },
    });

    expect(stack).toHaveResourceLike('AWS::CloudFormation::Stack', {
      "Metadata": {
        "Property1": "Value1",
      },
      "DeletionPolicy": "Retain",
      "DependsOn": [
        "AnotherChildStack",
      ],
      "UpdateReplacePolicy": "Retain",
    }, ResourcePart.CompleteDefinition);
  });

  test('correctly parses NotificationsARNs, Timeout', () => {
    new inc.CfnInclude(stack, 'ParentStack', {
      templateFile: testTemplateFilePath('parent-with-attributes.json'),
      loadNestedStacks: {
        'ChildStack': {
          templateFile: testTemplateFilePath('custom-resource.json'),
        },
        'AnotherChildStack': {
          templateFile: testTemplateFilePath('custom-resource.json'),
        },
      },
    });

    expect(stack).toHaveResourceLike('AWS::CloudFormation::Stack', {
      "NotificationARNs": ["arn1"],
      "TimeoutInMinutes": 5,
    });
    expect(stack).toHaveResourceLike('AWS::CloudFormation::Stack', {
      "NotificationARNs": { "Ref": "ArrayParam" },
      "TimeoutInMinutes": {
        "Fn::Select": [0, {
          "Ref": "ArrayParam",
        }],
      },
    });
  });

  test('can ingest a NestedStack with a Number CFN Parameter passed as a number', () => {
    new inc.CfnInclude(stack, 'MyScope', {
      templateFile: testTemplateFilePath('parent-number-in-child-params.yaml'),
      loadNestedStacks: {
        'NestedStack': {
          templateFile: testTemplateFilePath('child-with-number-parameter.yaml'),
        },
      },
    });

    expect(stack).toHaveResourceLike('AWS::CloudFormation::Stack', {
      "Parameters": {
        "Number": "60",
      },
    });
  });

  test('can lazily include a single child nested stack', () => {
    const parentTemplate = new inc.CfnInclude(stack, 'ParentStack', {
      templateFile: testTemplateFilePath('parent-one-child.json'),
    });
    const includedChild = parentTemplate.loadNestedStack('ChildStack', {
      templateFile: testTemplateFilePath('child-no-bucket.json'),
    });

    expect(includedChild.stack).toMatchTemplate(
      loadTestFileToJsObject('child-no-bucket.json'),
    );
    expect(includedChild.includedTemplate.getResource('GrandChildStack')).toBeDefined();
  });

  describe('for a parent stack with children and grandchildren', () => {
    let assetStack: core.Stack;
    let parentTemplate: inc.CfnInclude;
    let child: inc.IncludedNestedStack;
    let grandChild: inc.IncludedNestedStack;

    let hash1: string;
    let hash2: string;

    let parentBucketParam: string;
    let parentKeyParam: string;
    let grandChildBucketParam: string;
    let grandChildKeyParam: string;

    let childBucketParam: string;
    let childKeyParam: string;

    beforeAll(() => {
      assetStack = new core.Stack();
      parentTemplate = new inc.CfnInclude(assetStack, 'ParentStack', {
        templateFile: testTemplateFilePath('parent-one-child.json'),
        loadNestedStacks: {
          'ChildStack': {
            templateFile: testTemplateFilePath('child-no-bucket.json'),
            loadNestedStacks: {
              'GrandChildStack': {
                templateFile: testTemplateFilePath('grandchild-import-stack.json'),
              },
            },
          },
        },
      });

      child = parentTemplate.getNestedStack('ChildStack');
      grandChild = child.includedTemplate.getNestedStack('GrandChildStack');

      hash1 = '5dc7d4a99cfe2979687dc74f2db9fd75f253b5505a1912b5ceecf70c9aefba50';
      hash2 = '7775730164edb5faae717ac1d2e90d9c0d0fdbeafe48763e5c1b7fb5e39e00a5';

      parentBucketParam = `AssetParameters${hash1}S3BucketEAA24F0C`;
      parentKeyParam = `AssetParameters${hash1}S3VersionKey1194CAB2`;
      grandChildBucketParam = `referencetoAssetParameters${hash1}S3BucketEAA24F0CRef`;
      grandChildKeyParam = `referencetoAssetParameters${hash1}S3VersionKey1194CAB2Ref`;

      childBucketParam = `AssetParameters${hash2}S3BucketDEB194C6`;
      childKeyParam = `AssetParameters${hash2}S3VersionKey8B342ED1`;
    });

    test('correctly creates parameters in the parent stack, and passes them to the child stack', () => {
      expect(assetStack).toMatchTemplate({
        "Parameters": {
          [parentBucketParam]: {
            "Type": "String",
            "Description": `S3 bucket for asset \"${hash1}\"`,
          },
          [parentKeyParam]: {
            "Type": "String",
            "Description": `S3 key for asset version \"${hash1}\"`,
          },
          [`AssetParameters${hash1}ArtifactHash9C417847`]: {
            "Type": "String",
            "Description": `Artifact hash for asset \"${hash1}\"`,
          },
          [childBucketParam]: {
            "Type": "String",
            "Description": `S3 bucket for asset \"${hash2}\"`,
          },
          [childKeyParam]: {
            "Type": "String",
            "Description": `S3 key for asset version \"${hash2}\"`,
          },
          [`AssetParameters${hash2}ArtifactHashAA82D4CC`]: {
            "Type": "String",
            "Description": `Artifact hash for asset \"${hash2}\"`,
          },
        },
        "Resources": {
          "ChildStack": {
            "Type": "AWS::CloudFormation::Stack",
            "Properties": {
              "TemplateURL": {
                "Fn::Join": ["", [
                  "https://s3.",
                  { "Ref": "AWS::Region" },
                  ".",
                  { "Ref": "AWS::URLSuffix" },
                  "/",
                  { "Ref": childBucketParam },
                  "/",
                  {
                    "Fn::Select": [
                      0,
                      {
                        "Fn::Split": [
                          "||",
                          { "Ref": childKeyParam },
                        ],
                      },
                    ],
                  },
                  {
                    "Fn::Select": [
                      1,
                      {
                        "Fn::Split": [
                          "||",
                          { "Ref": childKeyParam },
                        ],
                      },
                    ],
                  },
                ]],
              },
              "Parameters": {
                "MyBucketParameter": "some-magic-bucket-name",
                [grandChildBucketParam]: {
                  "Ref": parentBucketParam,
                },
                [grandChildKeyParam]: {
                  "Ref": parentKeyParam,
                },
              },
            },
          },
        },
      });
    });

    test('correctly creates parameters in the child stack, and passes them to the grandchild stack', () => {
      expect(child.stack).toMatchTemplate({
        "Parameters": {
          "MyBucketParameter": {
            "Type": "String",
            "Default": "default-bucket-param-name",
          },
          [grandChildBucketParam]: {
            "Type": "String",
          },
          [grandChildKeyParam]: {
            "Type": "String",
          },
        },
        "Resources": {
          "GrandChildStack": {
            "Type": "AWS::CloudFormation::Stack",
            "Properties": {
              "TemplateURL": {
                "Fn::Join": ["", [
                  "https://s3.",
                  { "Ref": "AWS::Region" },
                  ".",
                  { "Ref": "AWS::URLSuffix" },
                  "/",
                  { "Ref": grandChildBucketParam },
                  "/",
                  {
                    "Fn::Select": [
                      0,
                      {
                        "Fn::Split": [
                          "||",
                          { "Ref": grandChildKeyParam },
                        ],
                      },
                    ],
                  },
                  {
                    "Fn::Select": [
                      1,
                      {
                        "Fn::Split": [
                          "||",
                          { "Ref": grandChildKeyParam },
                        ],
                      },
                    ],
                  },
                ]],
              },
              "Parameters": {
                "MyBucketParameter": "some-other-bucket-name",
              },
            },
          },
        },
      });
    });

    test('leaves grandchild stack unmodified', () => {
      expect(grandChild.stack).toMatchTemplate(
        loadTestFileToJsObject('grandchild-import-stack.json'),
      );
    });
  });

  describe('for a parameter passed to the included child stack', () => {
    let parentStack: core.Stack;
    let childStack: core.Stack;

    beforeAll(() => {
      parentStack = new core.Stack();
      const parentTemplate = new inc.CfnInclude(parentStack, 'ParentStack', {
        templateFile: testTemplateFilePath('parent-two-parameters.json'),
        loadNestedStacks: {
          'ChildStack': {
            templateFile: testTemplateFilePath('child-two-parameters.json'),
            parameters: {
              'FirstParameter': 'test-value',
            },
          },
        },
      });
      childStack = parentTemplate.getNestedStack('ChildStack').stack;
    });

    test('correctly removes the parameter from the child stack', () => {
      expect(childStack).toMatchTemplate({
        "Parameters": {
          "SecondParameter": {
            "Type": "String",
          },
        },
        "Resources": {
          "BucketImport": {
            "Type": "AWS::S3::Bucket",
            "Properties": {
              "BucketName": "test-value",
              "AccessControl": {
                "Ref": "SecondParameter",
              },
            },
          },
          "GrandChildStack": {
            "Type": "AWS::CloudFormation::Stack",
            "Properties": {
              "TemplateURL": "https://cfn-templates-set.s3.amazonaws.com/grandchild-import-stack.json",
              "Parameters": {
                "FirstParameter": "test-value",
              },
            },
          },
        },
      });
    });

    test('correctly removes the parameter from the parent stack', () => {
      expect(parentStack).toHaveResourceLike('AWS::CloudFormation::Stack', {
        "Parameters": {
          "FirstParameter": ABSENT,
          "SecondParameter": "second-value",
        },
      });
    });
  });
});

function loadTestFileToJsObject(testTemplate: string): any {
  return futils.readJsonSync(testTemplateFilePath(testTemplate));
}

function testTemplateFilePath(testTemplate: string) {
  return path.join(__dirname, 'test-templates/nested', testTemplate);
}
