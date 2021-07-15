/* eslint-disable import/no-extraneous-dependencies */
import '@aws-cdk/assert-internal/jest';
import * as cdkp from '../../../lib';
import { Graph, GraphNode, PipelineGraph } from '../../../lib/helpers-internal';
import { flatten } from '../../../lib/private/javascript';
import { AppWithOutput, OneStackApp, TestApp } from '../../testhelpers/test-app';

let app: TestApp;

beforeEach(() => {
  app = new TestApp();
});

afterEach(() => {
  app.cleanup();
});

describe('blueprint with one stage', () => {
  let blueprint: Blueprint;
  beforeEach(() => {
    blueprint = new Blueprint(app, 'Bp', {
      synth: new cdkp.ShellStep('Synth', {
        input: cdkp.CodePipelineSource.gitHub('test/test', 'main'),
        commands: ['build'],
      }),
    });
    blueprint.addStage(new OneStackApp(app, 'CrossAccount', { env: { account: 'you' } }));
  });

  test('simple app gets graphed correctly', () => {
    // WHEN
    const graph = new PipelineGraph(blueprint).graph;

    // THEN
    expect(childrenAt(graph)).toEqual([
      'Source',
      'Build',
      'CrossAccount',
    ]);

    expect(childrenAt(graph, 'CrossAccount')).toEqual([
      'Stack',
    ]);

    expect(childrenAt(graph, 'CrossAccount', 'Stack')).toEqual([
      'Prepare',
      'Deploy',
    ]);
  });

  test('self mutation gets inserted at the right place', () => {
    // WHEN
    const graph = new PipelineGraph(blueprint, { selfMutation: true }).graph;

    // THEN
    expect(childrenAt(graph)).toEqual([
      'Source',
      'Build',
      'UpdatePipeline',
      'CrossAccount',
    ]);

    expect(childrenAt(graph, 'UpdatePipeline')).toEqual([
      'SelfMutate',
    ]);
  });
});

describe('blueprint with wave and stage', () => {
  let blueprint: Blueprint;
  beforeEach(() => {
    blueprint = new Blueprint(app, 'Bp', {
      synth: new cdkp.ShellStep('Synth', {
        input: cdkp.CodePipelineSource.gitHub('test/test', 'main'),
        commands: ['build'],
      }),
    });

    const wave = blueprint.addWave('Wave');
    wave.addStage(new OneStackApp(app, 'Alpha'));
    wave.addStage(new OneStackApp(app, 'Beta'));
  });

  test('post-action gets added inside stage graph', () => {
    // GIVEN
    blueprint.waves[0].stages[0].addPost(new cdkp.ManualApprovalStep('Approve'));

    // WHEN
    const graph = new PipelineGraph(blueprint).graph;

    // THEN
    expect(childrenAt(graph, 'Wave')).toEqual([
      'Alpha',
      'Beta',
    ]);

    expect(childrenAt(graph, 'Wave', 'Alpha')).toEqual([
      'Stack',
      'Approve',
    ]);
  });

  test('pre-action gets added inside stage graph', () => {
    // GIVEN
    blueprint.waves[0].stages[0].addPre(new cdkp.ManualApprovalStep('Gogogo'));

    // WHEN
    const graph = new PipelineGraph(blueprint).graph;

    // THEN
    expect(childrenAt(graph, 'Wave', 'Alpha')).toEqual([
      'Gogogo',
      'Stack',
    ]);
  });
});

describe('options for other engines', () => {
  test('"publishTemplate" will add steps to publish CFN templates as assets', () => {
    // GIVEN
    const blueprint = new Blueprint(app, 'Bp', {
      synth: new cdkp.ShellStep('Synth', {
        commands: ['build'],
      }),
    });
    blueprint.addStage(new OneStackApp(app, 'Alpha'));

    // WHEN
    const graph = new PipelineGraph(blueprint, {
      publishTemplate: true,
    });

    // THEN
    expect(childrenAt(graph.graph, 'Assets')).toStrictEqual(['FileAsset1']);
  });

  test('"prepareStep: false" can be used to disable the "prepare" step for stack deployments', () => {
    // GIVEN
    const blueprint = new Blueprint(app, 'Bp', {
      synth: new cdkp.ShellStep('Synth', {
        commands: ['build'],
      }),
    });
    blueprint.addStage(new OneStackApp(app, 'Alpha'));

    // WHEN
    const graph = new PipelineGraph(blueprint, {
      prepareStep: false,
    });

    // THEN
    // if "prepareStep" was true (default), the "Stack" node would have "Prepare" and "Deploy"
    // since "prepareStep" is false, it only has "Deploy".
    expect(childrenAt(graph.graph, 'Alpha', 'Stack')).toStrictEqual(['Deploy']);
  });
});


describe('with app with output', () => {
  let blueprint: Blueprint;
  let myApp: AppWithOutput;
  let scriptStep: cdkp.ShellStep;
  beforeEach(() => {
    blueprint = new Blueprint(app, 'Bp', {
      synth: new cdkp.ShellStep('Synth', {
        input: cdkp.CodePipelineSource.gitHub('test/test', 'main'),
        commands: ['build'],
      }),
    });

    myApp = new AppWithOutput(app, 'Alpha');
    scriptStep = new cdkp.ShellStep('PrintBucketName', {
      envFromCfnOutputs: {
        BUCKET_NAME: myApp.theOutput,
      },
      commands: ['echo $BUCKET_NAME'],
    });
  });

  test('post-action using stack output has dependency on execute node', () => {
    // GIVEN
    blueprint.addStage(myApp, {
      post: [scriptStep],
    });

    // WHEN
    const graph = new PipelineGraph(blueprint).graph;

    // THEN
    expect(childrenAt(graph, 'Alpha')).toEqual([
      'Stack',
      'PrintBucketName',
    ]);

    expect(nodeAt(graph, 'Alpha', 'PrintBucketName').dependencies).toContain(
      nodeAt(graph, 'Alpha', 'Stack', 'Deploy'));
  });

  test('pre-action cannot use stack output', () => {
    // GIVEN
    blueprint.addStage(myApp, {
      pre: [scriptStep],
    });

    // WHEN
    const graph = new PipelineGraph(blueprint).graph;
    expect(() => {
      assertGraph(nodeAt(graph, 'Alpha')).sortedLeaves();
    }).toThrow(/Dependency cycle/);
  });

  test('cannot use output from stack not in the pipeline', () => {
    // GIVEN
    blueprint.addStage(new AppWithOutput(app, 'OtherApp'), {
      pre: [scriptStep],
    });

    // WHEN
    expect(() => {
      new PipelineGraph(blueprint).graph;
    }).toThrow(/is not in the pipeline/);
  });
});

function childrenAt(g: Graph<any>, ...descend: string[]) {
  for (const d of descend) {
    const child = g.tryGetChild(d);
    if (!child) {
      throw new Error(`No node named '${d}' in ${g}`);
    }
    g = assertGraph(child);
  }
  return childNames(g);
}

function nodeAt(g: Graph<any>, ...descend: string[]) {
  for (const d of descend.slice(0, descend.length - 1)) {
    const child = g.tryGetChild(d);
    if (!child) {
      throw new Error(`No node named '${d}' in ${g}`);
    }
    g = assertGraph(child);
  }
  const child = g.tryGetChild(descend[descend.length - 1]);
  if (!child) {
    throw new Error(`No node named '${descend[descend.length - 1]}' in ${g}`);
  }
  return child;
}

function childNames(g: Graph<any>) {
  return Array.from(flatten(g.sortedChildren())).map(n => n.id);
}

function assertGraph<A>(g: GraphNode<A> | undefined): Graph<A> {
  if (!g) { throw new Error('Expected a graph node, got undefined'); }
  if (!(g instanceof Graph)) { throw new Error(`Expected a Graph, got: ${g}`); }
  return g;
}

class Blueprint extends cdkp.PipelineBase {
  protected doBuildPipeline(): void {
  }
}