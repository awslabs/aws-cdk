import { GraphNode } from '../../../lib/helpers-internal';
import { mkGraph, nodeNames } from './util';

describe('with nested graphs', () => {
  const graph = mkGraph('G', G => {
    let aa: GraphNode<any>;

    const A = G.graph('A', [], GA => {
      aa = GA.node('aa');
    });

    // B -> A, (same-level dependency)
    G.graph('B', [A], B => {
      // bbb -> bb
      const bb = B.node('bb');
      B.node('bbb', [bb]);
    });

    // cc -> aa (cross-subgraph dependency)
    G.graph('C', [], C => {
      C.node('cc', [aa]);
    });

    // D -> aa (down-dependency)
    G.graph('D', [aa!], C => {
      C.node('dd', [aa]);
    });

    // ee -> A (up-dependency)
    G.graph('E', [], C => {
      C.node('ee', [A]);
    });
  });

  test('can get up-projected dependency list from graph', () => {
    const sorted = graph.sortedChildren();

    expect(nodeNames(sorted)).toEqual([
      ['A'],
      ['B', 'C', 'D', 'E'],
    ]);
  });

  test('can get down-projected dependency list from graph', () => {
    const sorted = graph.sortedLeaves();
    expect(nodeNames(sorted)).toEqual([
      ['aa'],
      ['bb', 'cc', 'dd', 'ee'],
      ['bbb'],
    ]);
  });
});
