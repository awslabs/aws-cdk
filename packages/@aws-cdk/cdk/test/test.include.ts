import { Test } from 'nodeunit';
import { CfnOutput, CfnParameter, CfnResource, Include, Stack } from '../lib';

export = {
  'the Include construct can be used to embed an existing template as-is into a stack'(test: Test) {
    const stack = new Stack();

    new Include(stack, 'T1', { template: clone(template) });

    test.deepEqual(stack._toCloudFormation(), {
      Parameters: { MyParam: { Type: 'String', Default: 'Hello' } },
      Resources: {
        MyResource1: { Type: 'ResourceType1', Properties: { P1: 1, P2: 2 } },
        MyResource2: { Type: 'ResourceType2' } } });

    test.done();
  },

  'included templates can co-exist with elements created programmatically'(test: Test) {
    const stack = new Stack();

    new Include(stack, 'T1', { template: clone(template) });
    new CfnResource(stack, 'MyResource3', { type: 'ResourceType3', properties: { P3: 'Hello' } });
    new CfnOutput(stack, 'MyOutput', { description: 'Out!', disableExport: true, value: 'hey' });
    new CfnParameter(stack, 'MyParam2', { type: 'Integer' });

    test.deepEqual(stack._toCloudFormation(), {
      Parameters: {
        MyParam: { Type: 'String', Default: 'Hello' },
        MyParam2: { Type: 'Integer' } },
      Resources: {
        MyResource1: { Type: 'ResourceType1', Properties: { P1: 1, P2: 2 } },
        MyResource2: { Type: 'ResourceType2' },
        MyResource3: { Type: 'ResourceType3', Properties: { P3: 'Hello' } } },
       Outputs: {
         MyOutput: { Description: 'Out!', Value: 'hey' } } });

    test.done();
  },

  'exception is thrown in construction if an entity from an included template has the same id as a programmatic entity'(test: Test) {
    const stack = new Stack();

    new Include(stack, 'T1', { template });
    new CfnResource(stack, 'MyResource3', { type: 'ResourceType3', properties: { P3: 'Hello' } });
    new CfnOutput(stack, 'MyOutput', { description: 'Out!', value: 'in' });
    new CfnParameter(stack, 'MyParam', { type: 'Integer' }); // duplicate!

    test.throws(() => stack._toCloudFormation());
    test.done();
  },
};

const template = {
  Parameters: {
    MyParam: {
      Type: 'String',
      Default: 'Hello'
    }
  },
  Resources: {
    MyResource1: {
      Type: 'ResourceType1',
      Properties: {
        P1: 1,
        P2: 2,
      }
    },
    MyResource2: {
      Type: 'ResourceType2'
    }
  }
};

/**
 * @param obj an object to clone
 * @returns a deep clone of ``obj`.
 */
function clone(obj: any): any {
  switch (typeof obj) {
  case 'object':
    if (Array.isArray(obj)) {
      return obj.map(elt => clone(elt));
    } else {
      const cloned: any = {};
      for (const key of Object.keys(obj)) {
        cloned[key] = clone(obj[key]);
      }
      return cloned;
    }
  default:
    return obj;
  }
}
