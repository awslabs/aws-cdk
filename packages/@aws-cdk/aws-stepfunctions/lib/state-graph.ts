import * as iam from '@aws-cdk/aws-iam';
import { Duration } from '@aws-cdk/core';
import { State } from './states/state';

/**
 * A collection of connected states
 *
 * A StateGraph is used to keep track of all states that are connected (have
 * transitions between them). It does not include the substatemachines in
 * a Parallel's branches: those are their own StateGraphs, but the graphs
 * themselves have a hierarchical relationship as well.
 *
 * By assigning states to a definitive StateGraph, we verify that no state
 * machines are constructed. In particular:
 *
 * - Every state object can only ever be in 1 StateGraph, and not inadvertently
 *   be used in two graphs.
 * - Every stateId must be unique across all states in the entire state
 *   machine.
 *
 * All policy statements in all states in all substatemachines are bubbled so
 * that the top-level StateMachine instantiation can read them all and add
 * them to the IAM Role.
 *
 * You do not need to instantiate this class; it is used internally.
 */
export class StateGraph {
  /**
   * Set a timeout to render into the graph JSON.
   *
   * Read/write. Only makes sense on the top-level graph, subgraphs
   * do not support this feature.
   *
   * @default No timeout
   */
  public timeout?: Duration;

  /**
   * The accumulated policy statements
   */
  public readonly policyStatements = new Array<iam.PolicyStatement>();

  /**
   * All states in this graph
   */
  private readonly allStates = new Set<State>();

  /**
   * A mapping of stateId -> Graph for all states in this graph and subgraphs
   */
  private readonly allContainedStates = new Map<string, StateGraph>();

  /**
   * Containing graph of this graph
   */
  private superGraph?: StateGraph;

  /**
   * @param startState state that gets executed when the state machine is launched
   * @param graphDescription description of the state machine
   */
  constructor(public readonly startState: State, private readonly graphDescription: string) {
    this.allStates.add(startState);
    startState.bindToGraph(this);
  }

  /**
   * Register a state as part of this graph
   *
   * Called by State.bindToGraph().
   */
  public registerState(state: State) {
    this.registerContainedState(state.stateId, this);
    this.allStates.add(state);
  }

  /**
   * Register a Policy Statement used by states in this graph
   */
  public registerPolicyStatement(statement: iam.PolicyStatement) {
    if (this.superGraph) {
      this.superGraph.registerPolicyStatement(statement);
    } else {
      this.policyStatements.push(statement);
    }
  }

  /**
   * Register this graph as a child of the given graph
   *
   * Resource changes will be bubbled up to the given graph.
   */
  public registerSuperGraph(graph: StateGraph) {
    if (this.superGraph === graph) { return; }
    if (this.superGraph) {
      throw new Error('Every StateGraph can only be registered into one other StateGraph');
    }
    this.superGraph = graph;
    this.pushContainedStatesUp(graph);
    this.pushPolicyStatementsUp(graph);
  }

  /**
   * Return the Amazon States Language JSON for this graph
   */
  public toGraphJson(): object {
    const states: any = {};
    for (const state of this.allStates) {
      states[state.stateId] = state.toStateJson();
    }

    return {
      StartAt: this.startState.stateId,
      States: states,
      TimeoutSeconds: this.timeout && this.timeout.toSeconds(),
    };
  }

  /**
   * Return a string description of this graph
   */
  public toString() {
    const someNodes = Array.from(this.allStates).slice(0, 3).map(x => x.stateId);
    if (this.allStates.size > 3) { someNodes.push('...'); }
    return `${this.graphDescription} (${someNodes.join(', ')})`;
  }

  /**
   * Register a stateId and graph where it was registered
   */
  private registerContainedState(stateId: string, graph: StateGraph) {
    if (this.superGraph) {
      this.superGraph.registerContainedState(stateId, graph);
    } else {
      const existingGraph = this.allContainedStates.get(stateId);
      if (existingGraph) {
        throw new Error(`State with name '${stateId}' occurs in both ${graph} and ${existingGraph}. All states must have unique names.`);
      }

      this.allContainedStates.set(stateId, graph);
    }
  }

  /**
   * Push all contained state info up to the given super graph
   */
  private pushContainedStatesUp(superGraph: StateGraph) {
    for (const [stateId, graph] of this.allContainedStates) {
      superGraph.registerContainedState(stateId, graph);
    }
  }

  /**
   * Push all policy statements to into the given super graph
   */
  private pushPolicyStatementsUp(superGraph: StateGraph) {
    for (const policyStatement of this.policyStatements) {
      superGraph.registerPolicyStatement(policyStatement);
    }
  }
}
