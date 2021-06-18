import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import { nodeunitShim, Test } from 'nodeunit-shim';
import { App as Root, Aws, Construct, ConstructNode, ConstructOrder, IConstruct, Lazy, ValidationError } from '../lib';
import { Annotations } from '../lib/annotations';
import { reEnableStackTraceCollection, restoreStackTraceColection } from './util';

/* eslint-disable @typescript-eslint/naming-convention */

nodeunitShim({
  'the "Root" construct is a special construct which can be used as the root of the tree'(test: Test) {
    const root = new Root();
    test.equal(root.node.id, '', 'if not specified, name of a root construct is an empty string');
    test.ok(!root.node.scope, 'no parent');
    test.equal(root.node.children.length, 1);
    test.done();
  },

  'constructs cannot be created with an empty name unless they are root'(test: Test) {
    const root = new Root();
    test.throws(() => new Construct(root, ''));
    test.done();
  },

  'construct.name returns the name of the construct'(test: Test) {
    const t = createTree();

    test.equal(t.child1.node.id, 'Child1');
    test.equal(t.child2.node.id, 'Child2');
    test.equal(t.child1_1.node.id, 'Child11');
    test.equal(t.child1_2.node.id, 'Child12');
    test.equal(t.child1_1_1.node.id, 'Child111');
    test.equal(t.child2_1.node.id, 'Child21');

    test.done();
  },

  'construct id can use any character except the path separator'(test: Test) {
    const root = new Root();
    new Construct(root, 'valid');
    new Construct(root, 'ValiD');
    new Construct(root, 'Va123lid');
    new Construct(root, 'v');
    new Construct(root, '  invalid' );
    new Construct(root, 'invalid   ' );
    new Construct(root, '123invalid' );
    new Construct(root, 'in valid' );
    new Construct(root, 'in_Valid' );
    new Construct(root, 'in-Valid' );
    new Construct(root, 'in\\Valid' );
    new Construct(root, 'in.Valid' );
    test.done();
  },

  'if construct id contains path seperators, they will be replaced by double-dash'(test: Test) {
    const root = new Root();
    const c = new Construct(root, 'Boom/Boom/Bam');
    test.deepEqual(c.node.id, 'Boom--Boom--Bam');
    test.done();
  },

  'if "undefined" is forcefully used as an "id", it will be treated as an empty string'(test: Test) {
    const c = new Construct(undefined as any, undefined as any);
    test.deepEqual(c.node.id, '');
    test.done();
  },

  'dont allow unresolved tokens to be used in construct IDs'(test: Test) {
    // GIVEN
    const root = new Root();
    const token = Lazy.string({ produce: () => 'lazy' });

    // WHEN + THEN
    test.throws(() => new Construct(root, `MyID: ${token}`), /Cannot use tokens in construct ID: MyID: \${Token/);
    test.done();
  },

  'construct.uniqueId returns a tree-unique alphanumeric id of this construct'(test: Test) {
    const root = new Root();

    const child1 = new Construct(root, 'This is the first child');
    const child2 = new Construct(child1, 'Second level');
    const c1 = new Construct(child2, 'My construct');
    const c2 = new Construct(child1, 'My construct');

    test.deepEqual(c1.node.path, 'This is the first child/Second level/My construct');
    test.deepEqual(c2.node.path, 'This is the first child/My construct');
    test.deepEqual(c1.node.uniqueId, 'ThisisthefirstchildSecondlevelMyconstruct202131E0');
    test.deepEqual(c2.node.uniqueId, 'ThisisthefirstchildMyconstruct8C288DF9');
    test.done();
  },

  'cannot calculate uniqueId if the construct path is ["Default"]'(test: Test) {
    const root = new Root();
    const c = new Construct(root, 'Default');
    test.throws(() => c.node.uniqueId, /Unable to calculate a unique id for an empty set of components/);
    test.done();
  },

  'construct.getChildren() returns an array of all children'(test: Test) {
    const root = new Root();
    const child = new Construct(root, 'Child1');
    new Construct(root, 'Child2');
    test.equal(child.node.children.length, 0, 'no children');
    test.equal(root.node.children.length, 3, 'three children are expected');
    test.done();
  },

  'construct.findChild(name) can be used to retrieve a child from a parent'(test: Test) {
    const root = new Root();
    const child = new Construct(root, 'Contruct');
    test.strictEqual(root.node.tryFindChild(child.node.id), child, 'findChild(name) can be used to retrieve the child from a parent');
    test.ok(!root.node.tryFindChild('NotFound'), 'findChild(name) returns undefined if the child is not found');
    test.done();
  },

  'construct.getChild(name) can be used to retrieve a child from a parent'(test: Test) {
    const root = new Root();
    const child = new Construct(root, 'Contruct');
    test.strictEqual(root.node.findChild(child.node.id), child, 'getChild(name) can be used to retrieve the child from a parent');
    test.throws(() => {
      root.node.findChild('NotFound');
    }, '', 'getChild(name) returns undefined if the child is not found');
    test.done();
  },

  'can remove children from the tree using tryRemoveChild()'(test: Test) {
    const root = new Root();
    const childrenBeforeAdding = root.node.children.length; // Invariant to adding 'Metadata' resource or not

    // Add & remove
    const child = new Construct(root, 'Construct');
    test.equals(true, root.node.tryRemoveChild(child.node.id));
    test.equals(false, root.node.tryRemoveChild(child.node.id)); // Second time does nothing

    test.equals(undefined, root.node.tryFindChild(child.node.id));
    test.equals(childrenBeforeAdding, root.node.children.length);
    test.done();
  },

  'construct.toString() and construct.toTreeString() can be used for diagnostics'(test: Test) {
    const t = createTree();

    test.equal(t.root.toString(), '<root>');
    test.equal(t.child1_1_1.toString(), 'HighChild/Child1/Child11/Child111');
    test.equal(t.child2.toString(), 'HighChild/Child2');
    test.equal(toTreeString(t.root), 'App\n  TreeMetadata [Tree]\n  Construct [HighChild]\n    Construct [Child1]\n      Construct [Child11]\n        Construct [Child111]\n      Construct [Child12]\n    Construct [Child2]\n      Construct [Child21]\n');
    test.done();
  },

  'construct.getContext(key) can be used to read a value from context defined at the root level'(test: Test) {
    const context = {
      ctx1: 12,
      ctx2: 'hello',
    };

    const t = createTree(context);
    test.equal(t.child1_2.node.tryGetContext('ctx1'), 12);
    test.equal(t.child1_1_1.node.tryGetContext('ctx2'), 'hello');
    test.done();
  },

  // eslint-disable-next-line max-len
  'construct.setContext(k,v) sets context at some level and construct.getContext(key) will return the lowermost value defined in the stack'(test: Test) {
    const root = new Root();
    const highChild = new Construct(root, 'highChild');
    highChild.node.setContext('c1', 'root');
    highChild.node.setContext('c2', 'root');

    const child1 = new Construct(highChild, 'child1');
    child1.node.setContext('c2', 'child1');
    child1.node.setContext('c3', 'child1');

    const child2 = new Construct(highChild, 'child2');
    const child3 = new Construct(child1, 'child1child1');
    child3.node.setContext('c1', 'child3');
    child3.node.setContext('c4', 'child3');

    test.equal(highChild.node.tryGetContext('c1'), 'root');
    test.equal(highChild.node.tryGetContext('c2'), 'root');
    test.equal(highChild.node.tryGetContext('c3'), undefined);

    test.equal(child1.node.tryGetContext('c1'), 'root');
    test.equal(child1.node.tryGetContext('c2'), 'child1');
    test.equal(child1.node.tryGetContext('c3'), 'child1');

    test.equal(child2.node.tryGetContext('c1'), 'root');
    test.equal(child2.node.tryGetContext('c2'), 'root');
    test.equal(child2.node.tryGetContext('c3'), undefined);

    test.equal(child3.node.tryGetContext('c1'), 'child3');
    test.equal(child3.node.tryGetContext('c2'), 'child1');
    test.equal(child3.node.tryGetContext('c3'), 'child1');
    test.equal(child3.node.tryGetContext('c4'), 'child3');

    test.done();
  },

  'construct.setContext(key, value) can only be called before adding any children'(test: Test) {
    const root = new Root();
    new Construct(root, 'child1');
    test.throws(() => root.node.setContext('k', 'v'));
    test.done();
  },

  'fails if context key contains unresolved tokens'(test: Test) {
    const root = new Root();
    test.throws(() => root.node.setContext(`my-${Aws.REGION}`, 'foo'), /Invalid context key/);
    test.throws(() => root.node.tryGetContext(Aws.REGION), /Invalid context key/);
    test.done();
  },

  'construct.pathParts returns an array of strings of all names from root to node'(test: Test) {
    const tree = createTree();
    test.deepEqual(tree.root.node.path, '');
    test.deepEqual(tree.child1_1_1.node.path, 'HighChild/Child1/Child11/Child111');
    test.deepEqual(tree.child2.node.path, 'HighChild/Child2');
    test.done();
  },

  'if a root construct has a name, it should be included in the path'(test: Test) {
    const tree = createTree({});
    test.deepEqual(tree.root.node.path, '');
    test.deepEqual(tree.child1_1_1.node.path, 'HighChild/Child1/Child11/Child111');
    test.done();
  },

  'construct can not be created with the name of a sibling'(test: Test) {
    const root = new Root();

    // WHEN
    new Construct(root, 'SameName');

    // THEN: They have different paths
    test.throws(() => {
      new Construct(root, 'SameName');
    }, /There is already a Construct with name 'SameName' in App/);

    // WHEN
    const c0 = new Construct(root, 'c0');
    new Construct(c0, 'SameName');

    // THEN: They have different paths
    test.throws(() => {
      new Construct(c0, 'SameName');
    }, /There is already a Construct with name 'SameName' in Construct \[c0\]/);

    test.done();
  },

  'addMetadata(type, data) can be used to attach metadata to constructs FIND_ME'(test: Test) {
    const previousValue = reEnableStackTraceCollection();
    const root = new Root();
    const con = new Construct(root, 'MyConstruct');
    test.deepEqual(con.node.metadata, [], 'starts empty');

    con.node.addMetadata('key', 'value');
    con.node.addMetadata('number', 103);
    con.node.addMetadata('array', [123, 456]);
    restoreStackTraceColection(previousValue);

    test.deepEqual(con.node.metadata[0].type, 'key');
    test.deepEqual(con.node.metadata[0].data, 'value');
    test.deepEqual(con.node.metadata[1].data, 103);
    test.deepEqual(con.node.metadata[2].data, [123, 456]);
    test.ok(con.node.metadata[0].trace && con.node.metadata[0].trace[1].indexOf('FIND_ME') !== -1, 'First stack line should include this function\s name');
    test.done();
  },

  'addMetadata(type, undefined/null) is ignored'(test: Test) {
    const root = new Root();
    const con = new Construct(root, 'Foo');
    con.node.addMetadata('Null', null);
    con.node.addMetadata('Undefined', undefined);
    con.node.addMetadata('True', true);
    con.node.addMetadata('False', false);
    con.node.addMetadata('Empty', '');

    const exists = (key: string) => con.node.metadata.find(x => x.type === key);

    test.ok(!exists('Null'));
    test.ok(!exists('Undefined'));
    test.ok(exists('True'));
    test.ok(exists('False'));
    test.ok(exists('Empty'));
    test.done();
  },

  'addWarning(message) can be used to add a "WARNING" message entry to the construct'(test: Test) {
    const previousValue = reEnableStackTraceCollection();
    const root = new Root();
    const con = new Construct(root, 'MyConstruct');
    Annotations.of(con).addWarning('This construct is deprecated, use the other one instead');
    restoreStackTraceColection(previousValue);

    test.deepEqual(con.node.metadata[0].type, cxschema.ArtifactMetadataEntryType.WARN);
    test.deepEqual(con.node.metadata[0].data, 'This construct is deprecated, use the other one instead');
    test.ok(con.node.metadata[0].trace && con.node.metadata[0].trace.length > 0);
    test.done();
  },

  'addError(message) can be used to add a "ERROR" message entry to the construct'(test: Test) {
    const previousValue = reEnableStackTraceCollection();
    const root = new Root();
    const con = new Construct(root, 'MyConstruct');
    Annotations.of(con).addError('Stop!');
    restoreStackTraceColection(previousValue);

    test.deepEqual(con.node.metadata[0].type, cxschema.ArtifactMetadataEntryType.ERROR);
    test.deepEqual(con.node.metadata[0].data, 'Stop!');
    test.ok(con.node.metadata[0].trace && con.node.metadata[0].trace.length > 0);
    test.done();
  },

  'addInfo(message) can be used to add an "INFO" message entry to the construct'(test: Test) {
    const previousValue = reEnableStackTraceCollection();
    const root = new Root();
    const con = new Construct(root, 'MyConstruct');
    Annotations.of(con).addInfo('Hey there, how do you do?');
    restoreStackTraceColection(previousValue);

    test.deepEqual(con.node.metadata[0].type, cxschema.ArtifactMetadataEntryType.INFO);
    test.deepEqual(con.node.metadata[0].data, 'Hey there, how do you do?');
    test.ok(con.node.metadata[0].trace && con.node.metadata[0].trace.length > 0);
    test.done();
  },

  'multiple children of the same type, with explicit names are welcome'(test: Test) {
    const root = new Root();
    new MyBeautifulConstruct(root, 'mbc1');
    new MyBeautifulConstruct(root, 'mbc2');
    new MyBeautifulConstruct(root, 'mbc3');
    new MyBeautifulConstruct(root, 'mbc4');
    test.ok(root.node.children.length >= 4);
    test.done();
  },

  // eslint-disable-next-line max-len
  'construct.validate() can be implemented to perform validation, ConstructNode.validate(construct.node) will return all errors from the subtree (DFS)'(test: Test) {
    class MyConstruct extends Construct {
      protected validate() {
        return ['my-error1', 'my-error2'];
      }
    }

    class YourConstruct extends Construct {
      protected validate() {
        return ['your-error1'];
      }
    }

    class TheirConstruct extends Construct {
      constructor(scope: Construct, id: string) {
        super(scope, id);

        new YourConstruct(this, 'YourConstruct');
      }

      protected validate() {
        return ['their-error'];
      }
    }

    class TestStack extends Root {
      constructor() {
        super();

        new MyConstruct(this, 'MyConstruct');
        new TheirConstruct(this, 'TheirConstruct');
      }

      protected validate() {
        return ['stack-error'];
      }
    }

    const stack = new TestStack();

    const errors = ConstructNode.validate(stack.node).map((v: ValidationError) => ({ path: v.source.node.path, message: v.message }));

    // validate DFS
    test.deepEqual(errors, [
      { path: 'MyConstruct', message: 'my-error1' },
      { path: 'MyConstruct', message: 'my-error2' },
      { path: 'TheirConstruct/YourConstruct', message: 'your-error1' },
      { path: 'TheirConstruct', message: 'their-error' },
      { path: '', message: 'stack-error' },
    ]);

    test.done();
  },

  'construct.lock() protects against adding children anywhere under this construct (direct or indirect)'(test: Test) {
    class LockableConstruct extends Construct {
      public lockMe() {
        (this.node._actualNode as any)._lock();
      }

      public unlockMe() {
        (this.node._actualNode as any)._unlock();
      }
    }

    const stack = new Root();

    const c0a = new LockableConstruct(stack, 'c0a');
    const c0b = new Construct(stack, 'c0b');

    const c1a = new Construct(c0a, 'c1a');
    const c1b = new Construct(c0a, 'c1b');

    c0a.lockMe();

    // now we should still be able to add children to c0b, but not to c0a or any its children
    new Construct(c0b, 'c1a');
    test.throws(() => new Construct(c0a, 'fail1'), /Cannot add children to "c0a" during synthesis/);
    test.throws(() => new Construct(c1a, 'fail2'), /Cannot add children to "c0a\/c1a" during synthesis/);
    test.throws(() => new Construct(c1b, 'fail3'), /Cannot add children to "c0a\/c1b" during synthesis/);

    c0a.unlockMe();

    new Construct(c0a, 'c0aZ');
    new Construct(c1a, 'c1aZ');
    new Construct(c1b, 'c1bZ');

    test.done();
  },

  'findAll returns a list of all children in either DFS or BFS'(test: Test) {
    // GIVEN
    const c1 = new Construct(undefined as any, '1');
    const c2 = new Construct(c1, '2');
    new Construct(c1, '3');
    new Construct(c2, '4');
    new Construct(c2, '5');

    // THEN
    test.deepEqual(c1.node.findAll().map(x => x.node.id), c1.node.findAll(ConstructOrder.PREORDER).map(x => x.node.id)); // default is PreOrder
    test.deepEqual(c1.node.findAll(ConstructOrder.PREORDER).map(x => x.node.id), ['1', '2', '4', '5', '3']);
    test.deepEqual(c1.node.findAll(ConstructOrder.POSTORDER).map(x => x.node.id), ['4', '5', '2', '3', '1']);
    test.done();
  },

  'ancestors returns a list of parents up to root'(test: Test) {
    const { child1_1_1 } = createTree();
    test.deepEqual(child1_1_1.node.scopes.map(x => x.node.id), ['', 'HighChild', 'Child1', 'Child11', 'Child111']);
    test.done();
  },

  '"root" returns the root construct'(test: Test) {
    const { child1, child2, child1_1_1, root } = createTree();
    test.ok(child1.node.root === root);
    test.ok(child2.node.root === root);
    test.ok(child1_1_1.node.root === root);
    test.done();
  },

  defaultChild: {
    'returns the child with id "Resource"'(test: Test) {
      const root = new Root();
      new Construct(root, 'child1');
      const defaultChild = new Construct(root, 'Resource');
      new Construct(root, 'child2');

      test.same(root.node.defaultChild, defaultChild);
      test.done();
    },
    'returns the child with id "Default"'(test: Test) {
      const root = new Root();
      new Construct(root, 'child1');
      const defaultChild = new Construct(root, 'Default');
      new Construct(root, 'child2');

      test.same(root.node.defaultChild, defaultChild);
      test.done();
    },
    'can override defaultChild'(test: Test) {
      const root = new Root();
      new Construct(root, 'Resource');
      const defaultChild = new Construct(root, 'OtherResource');
      root.node.defaultChild = defaultChild;

      test.same(root.node.defaultChild, defaultChild);
      test.done();
    },
    'returns "undefined" if there is no default'(test: Test) {
      const root = new Root();
      new Construct(root, 'child1');
      new Construct(root, 'child2');

      test.equal(root.node.defaultChild, undefined);
      test.done();
    },
    'fails if there are both "Resource" and "Default"'(test: Test) {
      const root = new Root();
      new Construct(root, 'child1');
      new Construct(root, 'Default');
      new Construct(root, 'child2');
      new Construct(root, 'Resource');

      test.throws(() => root.node.defaultChild,
        /Cannot determine default child for . There is both a child with id "Resource" and id "Default"/);
      test.done();
    },
  },
});

function createTree(context?: any) {
  const root = new Root();
  const highChild = new Construct(root, 'HighChild');
  if (context) {
    Object.keys(context).forEach(key => highChild.node.setContext(key, context[key]));
  }

  const child1 = new Construct(highChild, 'Child1');
  const child2 = new Construct(highChild, 'Child2');
  const child1_1 = new Construct(child1, 'Child11');
  const child1_2 = new Construct(child1, 'Child12');
  const child1_1_1 = new Construct(child1_1, 'Child111');
  const child2_1 = new Construct(child2, 'Child21');

  return {
    root, child1, child2, child1_1, child1_2, child1_1_1, child2_1,
  };
}

class MyBeautifulConstruct extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);
  }
}

/**
 * Returns a string with a tree representation of this construct and it's children.
 */
function toTreeString(node: IConstruct, depth = 0) {
  let out = '';
  for (let i = 0; i < depth; ++i) {
    out += '  ';
  }
  const name = node.node.id || '';
  out += `${node.constructor.name}${name.length > 0 ? ' [' + name + ']' : ''}\n`;
  for (const child of node.node.children) {
    out += toTreeString(child, depth + 1);
  }
  return out;
}
