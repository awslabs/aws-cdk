import { GraphNode } from '../../../lib/helpers-internal';
import { flatten } from '../../../lib/private/javascript';
import { mkGraph } from './util';


test('"uniqueId" renders a graph-wide unique id for each node', () => {
  const g = mkGraph('MyGraph', G => {
    G.graph('g1', [], G1 => {
      G1.node('n1');
      G1.node('n2');
      G1.graph('g2', [], G2 => {
        G2.node('n3');
      });
    });
    G.node('n4');
  });

  expect(Array.from(flatten(g.sortedLeaves())).map(n => n.uniqueId)).toStrictEqual([
    'g1-n1',
    'g1-n2',
    'g1-g2-n3',
    'n4',
  ]);
});

test('"allDeps" combines node deps and parent deps', () => {
  let n4: any;
  mkGraph('MyGraph', G => {
    G.graph('g1', [], G1 => {
      G1.node('n1');
      const n2 = G1.node('n2');
      G1.graph('g2', [n2], G2 => {
        const n3 = G2.node('n3');
        n4 = G2.node('n4', [n3]);
      });
    });
  });

  expect((n4 as GraphNode<any>).allDeps.map(x => x.uniqueId)).toStrictEqual(['g1-g2-n3', 'g1-n2']);
});