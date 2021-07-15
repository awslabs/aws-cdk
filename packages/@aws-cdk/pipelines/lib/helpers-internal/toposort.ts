import { GraphNode } from './graph';

export function printDependencyMap<A>(dependencies: Map<GraphNode<A>, Set<GraphNode<A>>>) {
  const lines = ['---'];
  for (const [k, vs] of dependencies.entries()) {
    lines.push(`${k} -> ${Array.from(vs)}`);
  }
  // eslint-disable-next-line no-console
  console.log(lines.join('\n'));
}

export function topoSort<A>(nodes: Set<GraphNode<A>>, dependencies: Map<GraphNode<A>, Set<GraphNode<A>>>): GraphNode<A>[][] {
  const remaining = new Set<GraphNode<A>>(nodes);

  const ret: GraphNode<A>[][] = [];
  while (remaining.size > 0) {
    // All elements with no more deps in the set can be ordered
    const selectable = Array.from(remaining.values()).filter(e => {
      if (!dependencies.has(e)) {
        throw new Error(`No key for ${e}`);
      }
      return dependencies.get(e)!.size === 0;
    });
    selectable.sort((a, b) => a.id < b.id ? -1 : b.id < a.id ? 1 : 0);

    // If we didn't make any progress, we got stuck
    if (selectable.length === 0) {
      const cycle = findCycle(dependencies);
      throw new Error(`Dependency cycle in graph: ${cycle.map(n => n.id).join(' => ')}`);
    }

    ret.push(selectable);

    for (const selected of selectable) {
      remaining.delete(selected);
      for (const depSet of dependencies.values()) {
        depSet.delete(selected);
      }
    }
  }

  return ret;
}

/**
 * Find cycles in a graph
 *
 * Not the fastest, but effective and should be rare
 */
function findCycle<A>(deps: Map<GraphNode<A>, Set<GraphNode<A>>>): GraphNode<A>[] {
  for (const node of deps.keys()) {
    const cycle = recurse(node, [node]);
    if (cycle) { return cycle; }
  }
  throw new Error('No cycle found. Assertion failure!');

  function recurse(node: GraphNode<A>, path: GraphNode<A>[]): GraphNode<A>[] | undefined {
    for (const dep of deps.get(node) ?? []) {
      if (dep === path[0]) { return [...path, dep]; }

      const cycle = recurse(dep, [...path, dep]);
      if (cycle) { return cycle; }
    }

    return undefined;
  }
}