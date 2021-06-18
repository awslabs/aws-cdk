import * as cxapi from '@aws-cdk/cx-api';
import { nodeunitShim, Test } from 'nodeunit-shim';
import {
  App, App as Root, CfnCondition,
  CfnDeletionPolicy, CfnResource, Construct,
  Fn, RemovalPolicy, Resource, Stack,
} from '../lib';
import { synthesize } from '../lib/private/synthesis';
import { toCloudFormation } from './util';

nodeunitShim({
  'all resources derive from Resource, which derives from Entity'(test: Test) {
    const stack = new Stack();

    new CfnResource(stack, 'MyResource', {
      type: 'MyResourceType',
      properties: {
        Prop1: 'p1', Prop2: 123,
      },
    });

    test.deepEqual(toCloudFormation(stack), {
      Resources: {
        MyResource: {
          Type: 'MyResourceType',
          Properties: {
            Prop1: 'p1',
            Prop2: 123,
          },
        },
      },
    });

    test.done();
  },

  'resources must reside within a Stack and fail upon creation if not'(test: Test) {
    const root = new Root();
    test.throws(() => new CfnResource(root, 'R1', { type: 'ResourceType' }));
    test.done();
  },

  'all entities have a logical ID calculated based on their full path in the tree'(test: Test) {
    const stack = new Stack(undefined, 'TestStack');
    const level1 = new Construct(stack, 'level1');
    const level2 = new Construct(level1, 'level2');
    const level3 = new Construct(level2, 'level3');
    const res1 = new CfnResource(level1, 'childoflevel1', { type: 'MyResourceType1' });
    const res2 = new CfnResource(level3, 'childoflevel3', { type: 'MyResourceType2' });

    test.equal(withoutHash(stack.resolve(res1.logicalId)), 'level1childoflevel1');
    test.equal(withoutHash(stack.resolve(res2.logicalId)), 'level1level2level3childoflevel3');

    test.done();
  },

  'resource.props can only be accessed by derived classes'(test: Test) {
    const stack = new Stack();
    const res = new Counter(stack, 'MyResource', { Count: 10 });
    res.increment();
    res.increment(2);

    test.deepEqual(toCloudFormation(stack), {
      Resources: {
        MyResource: { Type: 'My::Counter', Properties: { Count: 13 } },
      },
    });

    test.done();
  },

  'resource attributes can be retrieved using getAtt(s) or attribute properties'(test: Test) {
    const stack = new Stack();
    const res = new Counter(stack, 'MyResource', { Count: 10 });

    new CfnResource(stack, 'YourResource', {
      type: 'Type',
      properties: {
        CounterName: res.getAtt('Name'),
        CounterArn: res.arn,
        CounterURL: res.url,
      },
    });

    test.deepEqual(toCloudFormation(stack), {
      Resources: {
        MyResource: { Type: 'My::Counter', Properties: { Count: 10 } },
        YourResource: {
          Type: 'Type',
          Properties: {
            CounterName: { 'Fn::GetAtt': ['MyResource', 'Name'] },
            CounterArn: { 'Fn::GetAtt': ['MyResource', 'Arn'] },
            CounterURL: { 'Fn::GetAtt': ['MyResource', 'URL'] },
          },
        },
      },
    });

    test.done();
  },

  'ARN-type resource attributes have some common functionality'(test: Test) {
    const stack = new Stack();
    const res = new Counter(stack, 'MyResource', { Count: 1 });
    new CfnResource(stack, 'MyResource2', {
      type: 'Type',
      properties: {
        Perm: res.arn,
      },
    });

    test.deepEqual(toCloudFormation(stack), {
      Resources: {
        MyResource: { Type: 'My::Counter', Properties: { Count: 1 } },
        MyResource2: {
          Type: 'Type',
          Properties: {
            Perm: {
              'Fn::GetAtt': ['MyResource', 'Arn'],
            },
          },
        },
      },
    });

    test.done();
  },

  'resource.addDependency(e) can be used to add a DependsOn on another resource'(test: Test) {
    const stack = new Stack();
    const r1 = new Counter(stack, 'Counter1', { Count: 1 });
    const r2 = new Counter(stack, 'Counter2', { Count: 1 });
    const r3 = new CfnResource(stack, 'Resource3', { type: 'MyResourceType' });
    r2.node.addDependency(r1);
    r2.node.addDependency(r3);

    synthesize(stack);

    test.deepEqual(toCloudFormation(stack), {
      Resources: {
        Counter1: {
          Type: 'My::Counter',
          Properties: { Count: 1 },
        },
        Counter2: {
          Type: 'My::Counter',
          Properties: { Count: 1 },
          DependsOn: [
            'Counter1',
            'Resource3',
          ],
        },
        Resource3: { Type: 'MyResourceType' },
      },
    });

    test.done();
  },

  'if addDependency is called multiple times with the same resource, it will only appear once'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const r1 = new Counter(stack, 'Counter1', { Count: 1 });
    const dependent = new CfnResource(stack, 'Dependent', { type: 'R' });

    // WHEN
    dependent.addDependsOn(r1);
    dependent.addDependsOn(r1);
    dependent.addDependsOn(r1);
    dependent.addDependsOn(r1);
    dependent.addDependsOn(r1);

    // THEN
    test.deepEqual(toCloudFormation(stack), {
      Resources: {
        Counter1: {
          Type: 'My::Counter',
          Properties: {
            Count: 1,
          },
        },
        Dependent: {
          Type: 'R',
          DependsOn: [
            'Counter1',
          ],
        },
      },
    });
    test.done();
  },

  'conditions can be attached to a resource'(test: Test) {
    const stack = new Stack();
    const r1 = new CfnResource(stack, 'Resource', { type: 'Type' });
    const cond = new CfnCondition(stack, 'MyCondition', { expression: Fn.conditionNot(Fn.conditionEquals('a', 'b')) });
    r1.cfnOptions.condition = cond;

    test.deepEqual(toCloudFormation(stack), {
      Resources: { Resource: { Type: 'Type', Condition: 'MyCondition' } },
      Conditions: { MyCondition: { 'Fn::Not': [{ 'Fn::Equals': ['a', 'b'] }] } },
    });

    test.done();
  },

  'creation/update/updateReplace/deletion policies can be set on a resource'(test: Test) {
    const stack = new Stack();
    const r1 = new CfnResource(stack, 'Resource', { type: 'Type' });

    r1.cfnOptions.creationPolicy = { autoScalingCreationPolicy: { minSuccessfulInstancesPercent: 10 } };
    // eslint-disable-next-line max-len
    r1.cfnOptions.updatePolicy = {
      autoScalingScheduledAction: { ignoreUnmodifiedGroupSizeProperties: false },
      autoScalingReplacingUpdate: { willReplace: true },
      codeDeployLambdaAliasUpdate: {
        applicationName: 'CodeDeployApplication',
        deploymentGroupName: 'CodeDeployDeploymentGroup',
        beforeAllowTrafficHook: 'lambda1',
      },
    };
    r1.cfnOptions.deletionPolicy = CfnDeletionPolicy.RETAIN;
    r1.cfnOptions.updateReplacePolicy = CfnDeletionPolicy.SNAPSHOT;

    test.deepEqual(toCloudFormation(stack), {
      Resources: {
        Resource: {
          Type: 'Type',
          CreationPolicy: { AutoScalingCreationPolicy: { MinSuccessfulInstancesPercent: 10 } },
          UpdatePolicy: {
            AutoScalingScheduledAction: { IgnoreUnmodifiedGroupSizeProperties: false },
            AutoScalingReplacingUpdate: { WillReplace: true },
            CodeDeployLambdaAliasUpdate: {
              ApplicationName: 'CodeDeployApplication',
              DeploymentGroupName: 'CodeDeployDeploymentGroup',
              BeforeAllowTrafficHook: 'lambda1',
            },
          },
          DeletionPolicy: 'Retain',
          UpdateReplacePolicy: 'Snapshot',
        },
      },
    });

    test.done();
  },

  'update policies UseOnlineResharding flag'(test: Test) {
    const stack = new Stack();
    const r1 = new CfnResource(stack, 'Resource', { type: 'Type' });

    r1.cfnOptions.updatePolicy = { useOnlineResharding: true };

    test.deepEqual(toCloudFormation(stack), {
      Resources: {
        Resource: {
          Type: 'Type',
          UpdatePolicy: {
            UseOnlineResharding: true,
          },
        },
      },
    });

    test.done();
  },

  'metadata can be set on a resource'(test: Test) {
    const stack = new Stack();
    const r1 = new CfnResource(stack, 'Resource', { type: 'Type' });

    r1.cfnOptions.metadata = {
      MyKey: 10,
      MyValue: 99,
    };

    test.deepEqual(toCloudFormation(stack), {
      Resources: {
        Resource: {
          Type: 'Type',
          Metadata: {
            MyKey: 10,
            MyValue: 99,
          },
        },
      },
    });

    test.done();
  },

  'the "type" property is required when creating a resource'(test: Test) {
    const stack = new Stack();
    test.throws(() => new CfnResource(stack, 'Resource', { notypehere: true } as any));
    test.done();
  },

  'removal policy is a high level abstraction of deletion policy used by l2'(test: Test) {
    const stack = new Stack();

    const retain = new CfnResource(stack, 'Retain', { type: 'T1' });
    const destroy = new CfnResource(stack, 'Destroy', { type: 'T3' });
    const def = new CfnResource(stack, 'Default1', { type: 'T4' });
    const def2 = new CfnResource(stack, 'Default2', { type: 'T4' });

    retain.applyRemovalPolicy(RemovalPolicy.RETAIN);
    destroy.applyRemovalPolicy(RemovalPolicy.DESTROY);
    def.applyRemovalPolicy(undefined, { default: RemovalPolicy.DESTROY });
    def2.applyRemovalPolicy(undefined);

    test.deepEqual(toCloudFormation(stack), {
      Resources: {
        Retain: { Type: 'T1', DeletionPolicy: 'Retain', UpdateReplacePolicy: 'Retain' },
        Destroy: { Type: 'T3', DeletionPolicy: 'Delete', UpdateReplacePolicy: 'Delete' },
        Default1: { Type: 'T4', DeletionPolicy: 'Delete', UpdateReplacePolicy: 'Delete' }, // explicit default
        Default2: { Type: 'T4', DeletionPolicy: 'Retain', UpdateReplacePolicy: 'Retain' }, // implicit default
      },
    });
    test.done();
  },

  'addDependency adds all dependencyElements of dependent constructs'(test: Test) {
    class C1 extends Construct {
      public readonly r1: CfnResource;
      public readonly r2: CfnResource;

      constructor(scope: Construct, id: string) {
        super(scope, id);

        this.r1 = new CfnResource(this, 'R1', { type: 'T1' });
        this.r2 = new CfnResource(this, 'R2', { type: 'T2' });
      }
    }

    class C2 extends Construct {
      public readonly r3: CfnResource;

      constructor(scope: Construct, id: string) {
        super(scope, id);

        this.r3 = new CfnResource(this, 'R3', { type: 'T3' });
      }
    }

    // C3 returns [ c2 ] for it's dependency elements
    // this should result in 'flattening' the list of elements.
    class C3 extends Construct {
      constructor(scope: Construct, id: string) {
        super(scope, id);

        new C2(this, 'C2');
      }
    }

    const stack = new Stack();
    const c1 = new C1(stack, 'MyC1');
    const c2 = new C2(stack, 'MyC2');
    const c3 = new C3(stack, 'MyC3');

    const dependingResource = new CfnResource(stack, 'MyResource', { type: 'R' });
    dependingResource.node.addDependency(c1, c2);
    dependingResource.node.addDependency(c3);

    synthesize(stack);

    test.deepEqual(toCloudFormation(stack), {
      Resources:
      {
        MyC1R1FB2A562F: { Type: 'T1' },
        MyC1R2AE2B5066: { Type: 'T2' },
        MyC2R3809EEAD6: { Type: 'T3' },
        MyC3C2R38CE6F9F7: { Type: 'T3' },
        MyResource:
        {
          Type: 'R',
          DependsOn:
          ['MyC1R1FB2A562F',
            'MyC1R2AE2B5066',
            'MyC2R3809EEAD6',
            'MyC3C2R38CE6F9F7'],
        },
      },
    });
    test.done();
  },

  'resource.ref returns the {Ref} token'(test: Test) {
    const stack = new Stack();
    const r = new CfnResource(stack, 'MyResource', { type: 'R' });

    test.deepEqual(stack.resolve(r.ref), { Ref: 'MyResource' });
    test.done();
  },

  overrides: {
    'addOverride(p, v) allows assigning arbitrary values to synthesized resource definitions'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const r = new CfnResource(stack, 'MyResource', { type: 'AWS::Resource::Type' });

      // WHEN
      r.addOverride('Type', 'YouCanEvenOverrideTheType');
      r.addOverride('Metadata', { Key: 12 });
      r.addOverride('Use.Dot.Notation', 'To create subtrees');

      // THEN
      test.deepEqual(toCloudFormation(stack), {
        Resources:
        {
          MyResource:
          {
            Type: 'YouCanEvenOverrideTheType',
            Use: { Dot: { Notation: 'To create subtrees' } },
            Metadata: { Key: 12 },
          },
        },
      });

      test.done();
    },

    'addPropertyOverride() allows assigning an attribute of a different resource'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const r1 = new CfnResource(stack, 'MyResource1', { type: 'AWS::Resource::Type' });
      const r2 = new CfnResource(stack, 'MyResource2', { type: 'AWS::Resource::Type' });

      // WHEN
      r2.addPropertyOverride('A', {
        B: r1.getAtt('Arn'),
      });

      // THEN
      test.deepEqual(toCloudFormation(stack), {
        Resources: {
          MyResource1: {
            Type: 'AWS::Resource::Type',
          },
          MyResource2: {
            Type: 'AWS::Resource::Type',
            Properties: {
              A: {
                B: { 'Fn::GetAtt': ['MyResource1', 'Arn'] },
              },
            },
          },
        },
      });

      test.done();
    },

    'addOverride(p, null) will assign an "null" value'(test: Test) {
      // GIVEN
      const stack = new Stack();

      const r = new CfnResource(stack, 'MyResource', {
        type: 'AWS::Resource::Type',
        properties: {
          Hello: {
            World: {
              Value1: 'Hello',
              Value2: 129,
            },
          },
        },
      });

      // WHEN
      r.addOverride('Properties.Hello.World.Value2', null);

      // THEN
      test.deepEqual(toCloudFormation(stack), {
        Resources:
        {
          MyResource:
          {
            Type: 'AWS::Resource::Type',
            Properties: { Hello: { World: { Value1: 'Hello', Value2: null } } },
          },
        },
      });

      test.done();
    },

    'addOverride(p, undefined) can be used to delete a value'(test: Test) {
      // GIVEN
      const stack = new Stack();

      const r = new CfnResource(stack, 'MyResource', {
        type: 'AWS::Resource::Type',
        properties: {
          Hello: {
            World: {
              Value1: 'Hello',
              Value2: 129,
            },
          },
        },
      });

      // WHEN
      r.addOverride('Properties.Hello.World.Value2', undefined);

      // THEN
      test.deepEqual(toCloudFormation(stack), {
        Resources:
        {
          MyResource:
          {
            Type: 'AWS::Resource::Type',
            Properties: { Hello: { World: { Value1: 'Hello' } } },
          },
        },
      });

      test.done();
    },

    'addOverride(p, undefined) will not create empty trees'(test: Test) {
      // GIVEN
      const stack = new Stack();

      const r = new CfnResource(stack, 'MyResource', { type: 'AWS::Resource::Type' });

      // WHEN
      r.addPropertyOverride('Tree.Exists', 42);
      r.addPropertyOverride('Tree.Does.Not.Exist', undefined);

      // THEN
      test.deepEqual(toCloudFormation(stack), {
        Resources:
        {
          MyResource:
          {
            Type: 'AWS::Resource::Type',
            Properties: { Tree: { Exists: 42 } },
          },
        },
      });

      test.done();
    },

    'addDeletionOverride(p) and addPropertyDeletionOverride(pp) are sugar for `undefined`'(test: Test) {
      // GIVEN
      const stack = new Stack();

      const r = new CfnResource(stack, 'MyResource', {
        type: 'AWS::Resource::Type',
        properties: {
          Hello: {
            World: {
              Value1: 'Hello',
              Value2: 129,
              Value3: ['foo', 'bar'],
            },
          },
        },
      });

      // WHEN
      r.addDeletionOverride('Properties.Hello.World.Value2');
      r.addPropertyDeletionOverride('Hello.World.Value3');

      // THEN
      test.deepEqual(toCloudFormation(stack), {
        Resources:
        {
          MyResource:
          {
            Type: 'AWS::Resource::Type',
            Properties: { Hello: { World: { Value1: 'Hello' } } },
          },
        },
      });

      test.done();
    },

    'addOverride(p, v) will overwrite any non-objects along the path'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const r = new CfnResource(stack, 'MyResource', {
        type: 'AWS::Resource::Type',
        properties: {
          Hello: {
            World: 42,
          },
        },
      });

      // WHEN
      r.addOverride('Properties.Override1', ['Hello', 123]);
      r.addOverride('Properties.Override1.Override2', { Heyy: [1] });
      r.addOverride('Properties.Hello.World.Foo.Bar', 42);

      // THEN
      test.deepEqual(toCloudFormation(stack), {
        Resources:
        {
          MyResource:
          {
            Type: 'AWS::Resource::Type',
            Properties:
            {
              Hello: { World: { Foo: { Bar: 42 } } },
              Override1: {
                Override2: { Heyy: [1] },
              },
            },
          },
        },
      });
      test.done();
    },

    'addOverride(p, v) will not split on escaped dots'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const r = new CfnResource(stack, 'MyResource', { type: 'AWS::Resource::Type' });

      // WHEN
      r.addOverride(String.raw`Properties.Hello\.World.Foo\.Bar\.Baz`, 42);
      r.addOverride(String.raw`Properties.Single\Back\Slashes`, 42);
      r.addOverride(String.raw`Properties.Escaped\\.Back\\.Slashes`, 42);
      r.addOverride(String.raw`Properties.DoublyEscaped\\\\Back\\\\Slashes`, 42);
      r.addOverride('Properties.EndWith\\', 42); // Raw string cannot end with a backslash

      // THEN
      test.deepEqual(toCloudFormation(stack), {
        Resources:
        {
          MyResource:
          {
            Type: 'AWS::Resource::Type',
            Properties:
            {
              'Hello.World': { 'Foo.Bar.Baz': 42 },
              'SingleBackSlashes': 42,
              'Escaped\\': { 'Back\\': { Slashes: 42 } },
              'DoublyEscaped\\\\Back\\\\Slashes': 42,
              'EndWith\\': 42,
            },
          },
        },
      });
      test.done();
    },

    'addPropertyOverride(pp, v) is a sugar for overriding properties'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const r = new CfnResource(stack, 'MyResource', {
        type: 'AWS::Resource::Type',
        properties: { Hello: { World: 42 } },
      });

      // WHEN
      r.addPropertyOverride('Hello.World', { Hey: 'Jude' });

      // THEN
      test.deepEqual(toCloudFormation(stack), {
        Resources:
        {
          MyResource:
          {
            Type: 'AWS::Resource::Type',
            Properties: { Hello: { World: { Hey: 'Jude' } } },
          },
        },
      });
      test.done();
    },

    'overrides are applied after render'(test: Test) {
      // GIVEN
      class MyResource extends CfnResource {
        public renderProperties() {
          return { Fixed: 123 };
        }
      }
      const stack = new Stack();
      const cfn = new MyResource(stack, 'rr', { type: 'AWS::Resource::Type' });

      // WHEN
      cfn.addPropertyOverride('Boom', 'Hi');
      cfn.addOverride('Properties.Foo.Bar', 'Bar');

      // THEN
      test.deepEqual(toCloudFormation(stack), {
        Resources: {
          rr: {
            Type: 'AWS::Resource::Type',
            Properties: {
              Fixed: 123,
              Boom: 'Hi',
              Foo: {
                Bar: 'Bar',
              },
            },
          },
        },
      });
      test.done();
    },

    'using mutable properties': {

      'can be used by derived classes to specify overrides before render()'(test: Test) {
        const stack = new Stack();

        const r = new CustomizableResource(stack, 'MyResource', {
          prop1: 'foo',
        });

        r.prop2 = 'bar';

        test.deepEqual(toCloudFormation(stack), {
          Resources:
          {
            MyResource:
            {
              Type: 'MyResourceType',
              Properties: { PROP1: 'foo', PROP2: 'bar' },
            },
          },
        });
        test.done();
      },

      '"properties" is undefined'(test: Test) {
        const stack = new Stack();

        const r = new CustomizableResource(stack, 'MyResource');

        r.prop3 = 'zoo';

        test.deepEqual(toCloudFormation(stack), {
          Resources:
          {
            MyResource:
            {
              Type: 'MyResourceType',
              Properties: { PROP3: 'zoo' },
            },
          },
        });
        test.done();
      },

      '"properties" is empty'(test: Test) {
        const stack = new Stack();

        const r = new CustomizableResource(stack, 'MyResource', { });

        r.prop3 = 'zoo';
        r.prop2 = 'hey';

        test.deepEqual(toCloudFormation(stack), {
          Resources:
          {
            MyResource:
            {
              Type: 'MyResourceType',
              Properties: { PROP2: 'hey', PROP3: 'zoo' },
            },
          },
        });
        test.done();
      },
    },
  },

  '"aws:cdk:path" metadata is added if "aws:cdk:path-metadata" context is set to true'(test: Test) {
    const stack = new Stack();
    stack.node.setContext(cxapi.PATH_METADATA_ENABLE_CONTEXT, true);

    const parent = new Construct(stack, 'Parent');

    new CfnResource(parent, 'MyResource', {
      type: 'MyResourceType',
    });

    test.deepEqual(toCloudFormation(stack), {
      Resources:
      {
        ParentMyResource4B1FDBCC:
         {
           Type: 'MyResourceType',
           Metadata: { [cxapi.PATH_METADATA_KEY]: 'Default/Parent/MyResource' },
         },
      },
    });

    test.done();
  },

  'cross-stack construct dependencies are not rendered but turned into stack dependencies'(test: Test) {
    // GIVEN
    const app = new App();
    const stackA = new Stack(app, 'StackA');
    const resA = new CfnResource(stackA, 'Resource', { type: 'R' });
    const stackB = new Stack(app, 'StackB');
    const resB = new CfnResource(stackB, 'Resource', { type: 'R' });

    // WHEN
    resB.node.addDependency(resA);

    // THEN
    const assembly = app.synth();
    const templateB = assembly.getStackByName(stackB.stackName).template;

    test.deepEqual(templateB, {
      Resources: {
        Resource: {
          Type: 'R',
          // Notice absence of 'DependsOn'
        },
      },
    });
    test.deepEqual(stackB.dependencies.map(s => s.node.id), ['StackA']);

    test.done();
  },

  'enableVersionUpgrade can be set on a resource'(test: Test) {
    const stack = new Stack();
    const r1 = new CfnResource(stack, 'Resource', { type: 'Type' });

    r1.cfnOptions.updatePolicy = {
      enableVersionUpgrade: true,
    };

    test.deepEqual(toCloudFormation(stack), {
      Resources: {
        Resource: {
          Type: 'Type',
          UpdatePolicy: {
            EnableVersionUpgrade: true,
          },
        },
      },
    });

    test.done();
  },
});

test('Resource can get account and Region from ARN', () => {
  const stack = new Stack();

  // WHEN
  const resource = new TestResource(stack, 'Resource', {
    environmentFromArn: 'arn:partition:service:region:account:relative-id',
  });

  // THEN
  expect(resource.env.account).toEqual('account');
  expect(resource.env.region).toEqual('region');
});

interface CounterProps {
  Count: number;
}

class Counter extends CfnResource {
  public readonly arn: string;
  public readonly url: string;

  public count: number;

  constructor(scope: Construct, id: string, props: CounterProps) {
    super(scope, id, { type: 'My::Counter', properties: { Count: props.Count } });
    this.arn = this.getAtt('Arn').toString();
    this.url = this.getAtt('URL').toString();
    this.count = props.Count;
  }

  public increment(by = 1) {
    this.count += by;
  }

  protected get cfnProperties(): { [key: string]: any } {
    return { Count: this.count };
  }
}

function withoutHash(logId: string) {
  return logId.substr(0, logId.length - 8);
}

class CustomizableResource extends CfnResource {
  public prop1: any;
  public prop2: any;
  public prop3: any;

  constructor(scope: Construct, id: string, props?: any) {
    super(scope, id, { type: 'MyResourceType', properties: props });
    if (props !== undefined) {
      this.prop1 = props.prop1;
      this.prop2 = props.prop2;
      this.prop3 = props.prop3;
    }
  }

  public renderProperties(): { [key: string]: any } {
    const props = this.updatedProperites;
    const render: { [key: string]: any } = {};
    for (const key of Object.keys(props)) {
      render[key.toUpperCase()] = props[key];
    }
    return render;
  }

  protected get updatedProperites(): { [key: string]: any } {
    const props: { [key: string]: any } = {
      prop1: this.prop1,
      prop2: this.prop2,
      prop3: this.prop3,
    };
    const cleanProps: { [key: string]: any } = { };
    for (const key of Object.keys(props)) {
      if (props[key] === undefined) {
        continue;
      }
      cleanProps[key] = props[key];
    }
    return cleanProps;
  }
}

/**
 * Because Resource is abstract
 */
class TestResource extends Resource {}
