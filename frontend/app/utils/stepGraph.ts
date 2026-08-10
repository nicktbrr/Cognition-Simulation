/**
 * Sample-proportion maths for branching process graphs.
 *
 * Each step declares the percent of the full persona sample that travels
 * through it. Those percentages define a transportation problem: every step
 * with branches must pass on exactly its own proportion, and every step must
 * receive exactly its own proportion from the steps before it. Solving it as a
 * max-flow gives the exact split along each arrow for any DAG, including a
 * step that both feeds a merge and branches elsewhere.
 *
 * This mirrors `solve_edge_flows` in `backend/utils/graph.py` - the two must
 * agree, or the canvas will accept designs the backend rejects (or vice versa).
 */

export interface GraphNodeLike {
  id: string;
  sampleProportion: number;
}

export interface GraphEdgeLike {
  source: string;
  target: string;
}

export interface EdgeFlowSolution {
  /** "source->target" -> percent of the full sample travelling that arrow. */
  flows: Map<string, number>;
  /** Step id -> percent it could not pass on to its branches. */
  unusedSupply: Map<string, number>;
  /** Step id -> percent it could not receive from the steps before it. */
  unmetDemand: Map<string, number>;
}

export const edgeKey = (source: string, target: string) => `${source}->${target}`;

/** Percent as a hundredth-of-a-percent integer, so the flow maths stays exact. */
const scaled = (proportion: number) => Math.round(proportion * 100);

export function solveEdgeFlows(
  nodes: GraphNodeLike[],
  edges: GraphEdgeLike[]
): EdgeFlowSolution {
  const empty: EdgeFlowSolution = {
    flows: new Map(),
    unusedSupply: new Map(),
    unmetDemand: new Map(),
  };

  const known = new Set(nodes.map((node) => node.id));
  const validEdges = edges.filter(
    (edge) => known.has(edge.source) && known.has(edge.target) && edge.source !== edge.target
  );

  const suppliers = nodes
    .filter((node) => validEdges.some((edge) => edge.source === node.id))
    .map((node) => node.id);
  const receivers = nodes
    .filter((node) => validEdges.some((edge) => edge.target === node.id))
    .map((node) => node.id);

  if (suppliers.length === 0 || receivers.length === 0) return empty;

  const proportionById = new Map(nodes.map((node) => [node.id, node.sampleProportion]));

  // Node indices: 0 = source, suppliers, receivers, last = sink.
  const supplyIdx = new Map(suppliers.map((id, i) => [id, i + 1]));
  const receiveIdx = new Map(receivers.map((id, i) => [id, suppliers.length + i + 1]));
  const source = 0;
  const sink = suppliers.length + receivers.length + 1;
  const size = sink + 1;

  const capacity: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
  for (const id of suppliers) {
    capacity[source][supplyIdx.get(id)!] = scaled(proportionById.get(id) ?? 100);
  }
  for (const id of receivers) {
    capacity[receiveIdx.get(id)!][sink] = scaled(proportionById.get(id) ?? 100);
  }
  for (const edge of validEdges) {
    const from = supplyIdx.get(edge.source);
    const to = receiveIdx.get(edge.target);
    if (from === undefined || to === undefined) continue;
    capacity[from][to] = 1e9;
  }

  const residual = capacity.map((row) => row.slice());

  // Edmonds-Karp; these graphs are tiny.
  for (;;) {
    const previous = new Array(size).fill(-1);
    previous[source] = source;
    const queue = [source];
    while (queue.length > 0 && previous[sink] === -1) {
      const current = queue.shift()!;
      for (let next = 0; next < size; next += 1) {
        if (previous[next] === -1 && residual[current][next] > 0) {
          previous[next] = current;
          queue.push(next);
        }
      }
    }
    if (previous[sink] === -1) break;

    let bottleneck = Infinity;
    for (let node = sink; node !== source; node = previous[node]) {
      bottleneck = Math.min(bottleneck, residual[previous[node]][node]);
    }
    for (let node = sink; node !== source; node = previous[node]) {
      residual[previous[node]][node] -= bottleneck;
      residual[node][previous[node]] += bottleneck;
    }
  }

  const flows = new Map<string, number>();
  for (const edge of validEdges) {
    const from = supplyIdx.get(edge.source);
    const to = receiveIdx.get(edge.target);
    if (from === undefined || to === undefined) continue;
    flows.set(edgeKey(edge.source, edge.target), (capacity[from][to] - residual[from][to]) / 100);
  }

  const unusedSupply = new Map<string, number>();
  for (const id of suppliers) {
    const leftover = residual[source][supplyIdx.get(id)!];
    if (leftover > 0) unusedSupply.set(id, leftover / 100);
  }

  const unmetDemand = new Map<string, number>();
  for (const id of receivers) {
    const shortfall = residual[receiveIdx.get(id)!][sink];
    if (shortfall > 0) unmetDemand.set(id, shortfall / 100);
  }

  return { flows, unusedSupply, unmetDemand };
}

/**
 * Serialize React Flow nodes and edges into the `steps` array stored on
 * `experiment_data`.
 *
 * Steps come out in topological order, so array position still drives column
 * order in the result workbook. Any node caught in a cycle falls to the end,
 * where validation reports it rather than it being silently dropped.
 */
export function flowGraphToSteps(
  nodes: any[],
  edges: any[],
  resolveMeasures: (measureIds: string[]) => any[] = () => []
): any[] {
  if (!nodes || nodes.length === 0) return [];

  const nodeIds = new Set(nodes.map((node) => node.id));
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  for (const node of nodes) {
    parentsOf.set(node.id, []);
    childrenOf.set(node.id, []);
  }
  for (const edge of edges || []) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    if (childrenOf.get(edge.source)!.includes(edge.target)) continue;
    childrenOf.get(edge.source)!.push(edge.target);
    parentsOf.get(edge.target)!.push(edge.source);
  }

  const indegree = new Map<string, number>(
    nodes.map((node) => [node.id, parentsOf.get(node.id)!.length])
  );
  const queue = nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
  const ordered: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    ordered.push(current);
    for (const childId of childrenOf.get(current)!) {
      indegree.set(childId, indegree.get(childId)! - 1);
      if (indegree.get(childId) === 0) queue.push(childId);
    }
  }
  const orderedSet = new Set(ordered);
  const orderedIds = [...ordered, ...nodes.map((n) => n.id).filter((id) => !orderedSet.has(id))];

  return orderedIds.map((nodeId) => {
    const node = nodes.find((candidate) => candidate.id === nodeId)!;
    return {
      id: node.id,
      previous: parentsOf.get(node.id) || [],
      next: childrenOf.get(node.id) || [],
      sample_proportion:
        typeof node.data?.sampleProportion === 'number' ? node.data.sampleProportion : 100,
      label: node.data?.title || `Step ${node.id}`,
      instructions: node.data?.description || '',
      temperature: node.data?.sliderValue ? node.data.sliderValue / 100 : 0.5,
      measures: resolveMeasures(node.data?.selectedMeasures || []),
    };
  });
}

/** Percent of each step's sample that actually reaches its branches. */
export function outflowByNode(
  nodes: GraphNodeLike[],
  edges: GraphEdgeLike[]
): Map<string, number> {
  const { flows } = solveEdgeFlows(nodes, edges);
  const totals = new Map<string, number>();
  for (const edge of edges) {
    const flow = flows.get(edgeKey(edge.source, edge.target));
    if (flow === undefined) continue;
    totals.set(edge.source, (totals.get(edge.source) ?? 0) + flow);
  }
  return totals;
}
