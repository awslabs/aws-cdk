/**
 * A library for nested graphs
 */
import { addAll, extract, flatMap, isDefined } from '../private/javascript';
import { topoSort } from './toposort';

export interface GraphNodeProps<A> {
  readonly data?: A;
}

export class GraphNode<A> {
  public static of<A>(id: string, data: A) {
    return new GraphNode(id, { data });
  }

  public readonly dependencies: GraphNode<A>[] = [];
  public readonly data?: A;
  private _parentGraph?: Graph<A>;

  constructor(public readonly id: string, props: GraphNodeProps<A> = {}) {
    this.data = props.data;
  }

  /**
   * A graph-wide unique identifier for this node. Rendered by joining the IDs
   * of all ancestors with hyphens.
   */
  public get uniqueId(): string {
    return this.ancestorPath(this.root).map(x => x.id).join('-');
  }

  /**
   * The union of all dependencies of this node and the dependencies of all
   * parent graphs.
   */
  public get allDeps(): GraphNode<A>[] {
    const fromParent = this.parentGraph?.allDeps ?? [];
    return [...this.dependencies, ...fromParent];
  }

  public dependOn(...dependencies: Array<GraphNode<A> | undefined>) {
    if (dependencies.includes(this)) {
      throw new Error(`Cannot add dependency on self: ${this}`);
    }
    this.dependencies.push(...dependencies.filter(isDefined));
  }

  public ancestorPath(upTo: GraphNode<A>): GraphNode<A>[] {
    let x: GraphNode<A> = this;
    const ret = [x];
    while (x.parentGraph && x.parentGraph !== upTo) {
      x = x.parentGraph;
      ret.unshift(x);
    }
    return ret;
  }

  public rootPath(): GraphNode<A>[] {
    let x: GraphNode<A> = this;
    const ret = [x];
    while (x.parentGraph) {
      x = x.parentGraph;
      ret.unshift(x);
    }
    return ret;
  }

  public get root() {
    let x: GraphNode<A> = this;
    while (x.parentGraph) {
      x = x.parentGraph;
    }
    return x;
  }

  public get parentGraph() {
    return this._parentGraph;
  }

  /**
   * @internal
   */
  public _setParentGraph(parentGraph: Graph<A>) {
    if (this._parentGraph) {
      throw new Error('Node already has a parent');
    }
    this._parentGraph = parentGraph;
  }

  public toString() {
    return `${this.constructor.name}(${this.id})`;
  }
}

/**
 * A dependency set that can be constructed partially and later finished
 *
 * It doesn't matter in what order sources and targets for the dependency
 * relationship(s) get added. This class can serve as a synchronization
 * point if the order in which graph nodes get added to the graph is not
 * well-defined.
 *
 * Useful utility during graph building.
 */
export class DependencyBuilder<A> {
  private readonly targets: GraphNode<A>[] = [];
  private readonly sources: GraphNode<A>[] = [];

  public dependOn(...targets: GraphNode<A>[]) {
    for (const target of targets) {
      for (const source of this.sources) {
        source.dependOn(target);
      }
      this.targets.push(target);
    }
    return this;
  }

  public dependBy(...sources: GraphNode<A>[]) {
    for (const source of sources) {
      for (const target of this.targets) {
        source.dependOn(target);
      }
      this.sources.push(source);
    }
    return this;
  }
}

export class DependencyBuilders<K, A> {
  private readonly builders = new Map<K, DependencyBuilder<A>>();

  public get(key: K) {
    const b = this.builders.get(key);
    if (b) { return b; }
    const ret = new DependencyBuilder<A>();
    this.builders.set(key, ret);
    return ret;
  }
}

export interface GraphProps<A> extends GraphNodeProps<A> {
  /**
   * Initial nodes in the workflow
   */
  readonly nodes?: GraphNode<A>[];
}

export class Graph<A> extends GraphNode<A> {
  public static of<A, B>(id: string, data: A, nodes?: GraphNode<B>[]) {
    return new Graph<A | B>(id, { data, nodes });
  }

  private readonly children = new Map<string, GraphNode<A>>();

  constructor(name: string, props: GraphProps<A>={}) {
    super(name, props);

    if (props.nodes) {
      this.add(...props.nodes);
    }
  }

  public get nodes() {
    return new Set(this.children.values());
  }

  public tryGetChild(name: string) {
    return this.children.get(name);
  }

  public contains(node: GraphNode<A>) {
    return this.nodes.has(node);
  }

  public add(...nodes: Array<GraphNode<A>>) {
    for (const node of nodes) {
      node._setParentGraph(this);
      if (this.children.has(node.id)) {
        throw new Error(`Node with duplicate id: ${node.id}`);
      }
      this.children.set(node.id, node);
    }
  }

  public absorb(other: Graph<A>) {
    this.add(...other.nodes);
  }

  /**
   * Return topologically sorted tranches of nodes at this graph level
   */
  public sortedChildren(): GraphNode<A>[][] {
    // Project dependencies to current children
    const nodes = this.nodes;
    const projectedDependencies = projectDependencies(this.deepDependencies(), (node) => {
      while (!nodes.has(node) && node.parentGraph) {
        node = node.parentGraph;
      }
      return nodes.has(node) ? [node] : [];
    });

    return topoSort(nodes, projectedDependencies);
  }

  /**
   * Return a topologically sorted list of non-Graph nodes in the entire subgraph
   */
  public sortedLeaves(): GraphNode<A>[][] {
    // Project dependencies to leaf nodes
    const descendantsMap = new Map<GraphNode<A>, GraphNode<A>[]>();
    findDescendants(this);

    function findDescendants(node: GraphNode<A>): GraphNode<A>[] {
      const ret: GraphNode<A>[] = [];

      if (node instanceof Graph) {
        for (const child of node.nodes) {
          ret.push(...findDescendants(child));
        }
      } else {
        ret.push(node);
      }

      descendantsMap.set(node, ret);
      return ret;
    }

    const projectedDependencies = projectDependencies(this.deepDependencies(), (node) => descendantsMap.get(node) ?? []);
    return topoSort(new Set(projectedDependencies.keys()), projectedDependencies);
  }

  public consoleLog(indent: number = 0) {
    process.stdout.write(' '.repeat(indent) + this + depString(this) + '\n');
    for (const node of this.nodes) {
      if (node instanceof Graph) {
        node.consoleLog(indent + 2);
      } else {
        process.stdout.write(' '.repeat(indent + 2) + node + depString(node) + '\n');
      }
    }

    function depString(node: GraphNode<A>) {
      if (node.dependencies.length > 0) {
        return ` -> ${Array.from(node.dependencies).join(', ')}`;
      }
      return '';
    }
  }

  /**
   * Return the union of all dependencies of the descendants of this graph
   */
  private deepDependencies() {
    const ret = new Map<GraphNode<A>, Set<GraphNode<A>>>();
    for (const node of this.nodes) {
      recurse(node);
    }
    return ret;

    function recurse(node: GraphNode<A>) {
      let deps = ret.get(node);
      if (!deps) {
        ret.set(node, deps = new Set());
      }
      for (let dep of node.dependencies) {
        deps.add(dep);
      }
      if (node instanceof Graph) {
        for (const child of node.nodes) {
          recurse(child);
        }
      }
    }
  }

  /**
   * Return all non-Graph nodes
   */
  public allLeaves(): GraphNodeCollection<A> {
    const ret: GraphNode<A>[] = [];
    recurse(this);
    return new GraphNodeCollection(ret);

    function recurse(node: GraphNode<A>) {
      if (node instanceof Graph) {
        for (const child of node.nodes) {
          recurse(child);
        }
      } else {
        ret.push(node);
      }
    }
  }
}

/**
 * A collection of graph nodes
 */
export class GraphNodeCollection<A> {
  public readonly nodes: GraphNode<A>[];

  constructor(nodes: Iterable<GraphNode<A>>) {
    this.nodes = Array.from(nodes);
  }

  public dependOn(...dependencies: Array<GraphNode<A> | undefined>) {
    for (const node of this.nodes) {
      node.dependOn(...dependencies.filter(isDefined));
    }
  }

  /**
  * Returns the graph node that's shared between these nodes
  */
  public commonAncestor() {
    const paths = new Array<GraphNode<A>[]>();
    for (const x of this.nodes) {
      paths.push(x.rootPath());
    }

    if (paths.length === 0) {
      throw new Error('Cannot find common ancestor between an empty set of nodes');
    }
    if (paths.length === 1) {
      const path = paths[0];

      if (path.length < 2) {
        throw new Error(`Cannot find ancestor of node without ancestor: ${path[0]}`);
      }
      return path[path.length - 2];
    }

    const originalPaths = [...paths];

    // Remove the first element of every path as long as the 2nd elements are all
    // the same -- this leaves the shared element in first place.
    //
    //   A, B, C, 1, 2    }---> C
    //   A, B, C, 3       }
    while (paths.every(path => paths[0].length >= 2 && path.length >= 2 && path[1] === paths[0][1])) {
      for (const path of paths) {
        path.shift();
      }
    }

    // If any of the paths are left with 1 element, there's no shared parent.
    if (paths.some(path => path.length < 2)) {
      throw new Error(`Could not determine a shared parent between nodes: ${originalPaths.map(nodes => nodes.map(n => n.id).join('/'))}`);
    }

    return paths[0][0];
  }
}

/**
 * Dependency map of nodes in this graph, taking into account dependencies between nodes in subgraphs
 *
 * Guaranteed to return an entry in the map for every node in the current graph.
 */
function projectDependencies<A>(dependencies: Map<GraphNode<A>, Set<GraphNode<A>>>, project: (x: GraphNode<A>) => GraphNode<A>[]) {
  // Project keys
  for (const node of dependencies.keys()) {
    const projectedNodes = project(node);
    if (projectedNodes.length === 1 && projectedNodes[0] === node) { continue; } // Nothing to do, just for efficiency

    const deps = extract(dependencies, node)!;
    for (const projectedNode of projectedNodes) {
      addAll(dependencies.get(projectedNode)!, deps);
    }
  }

  // Project values. Ignore self-dependencies, they were just between nodes that were collapsed into the same node.
  for (const [node, deps] of dependencies.entries()) {
    const depset = new Set(flatMap(deps, project));
    depset.delete(node);
    dependencies.set(node, depset);
  }

  return dependencies;
}

export function isGraph<A>(x: GraphNode<A>): x is Graph<A> {
  return x instanceof Graph;
}