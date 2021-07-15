import { Graph, GraphNode } from '../../../lib/helpers-internal';

class PlainNode extends GraphNode<any> { }

export function mkGraph(name: string, block: (b: GraphBuilder) => void) {
  const graph = new Graph(name);
  block({
    graph(name2, deps, block2) {
      const innerG = mkGraph(name2, block2);
      innerG.dependOn(...deps);
      graph.add(innerG);
      return innerG;
    },
    node(name2, deps) {
      const innerN = new PlainNode(name2);
      innerN.dependOn(...deps ?? []);
      graph.add(innerN);
      return innerN;
    },
  });
  return graph;
}


interface GraphBuilder {
  graph(name: string, deps: GraphNode<any>[], block: (b: GraphBuilder) => void): Graph<any>;
  node(name: string, deps?: GraphNode<any>[]): GraphNode<any>;
}


export function nodeNames(n: GraphNode<any>): string;
export function nodeNames(ns: GraphNode<any>[]): string[];
export function nodeNames(ns: GraphNode<any>[][]): string[][];
export function nodeNames(n: any): any {
  if (n instanceof GraphNode) { return n.id; }
  if (Array.isArray(n)) { return n.map(nodeNames); }
  throw new Error('oh no');
}