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

/**
 * The flow solver works in hundredths of a percent, so anything smaller than
 * that is rounding noise rather than a real gap. Matches `PROPORTION_EPSILON`
 * in `backend/utils/graph.py`.
 */
export const PROPORTION_EPSILON = 0.01;

/**
 * Split `total` percent across `weights` in whole percents.
 *
 * Largest-remainder rounding in whole percents, so the parts are always whole
 * numbers that add back up to `total` - a three-way split comes out 34/33/33
 * rather than three 33.33s. A fractional `total` (legacy data) is rounded to
 * the nearest whole percent before splitting. Weights that are all zero (or
 * missing) fall back to an even split.
 */
export function splitProportion(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];

  const totalWhole = Math.max(0, Math.round(total));
  const weightTotal = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  const normalized =
    weightTotal > 0
      ? weights.map((weight) => Math.max(0, weight) / weightTotal)
      : weights.map(() => 1 / weights.length);

  const exact = normalized.map((share) => share * totalWhole);
  const parts = exact.map((value) => Math.floor(value));
  let remainder = totalWhole - parts.reduce((sum, part) => sum + part, 0);

  // Hand the leftover whole percents to the largest fractional parts first.
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; remainder > 0; i = (i + 1) % order.length) {
    parts[order[i].index] += 1;
    remainder -= 1;
  }

  return parts;
}

/** Split `total` percent evenly, exactly, across `count` steps. */
export const splitEvenly = (total: number, count: number) =>
  splitProportion(total, new Array(count).fill(1));

/**
 * The default share of the sample for every step: the first step runs all of
 * it, and each step hands its share to its branches in equal parts.
 *
 * Merges are handled by construction - a step that several branches rejoin
 * gets the sum of what they send it - so the result always adds up to 100% of
 * the sample. Steps caught in a cycle are left at 100% for validation to
 * report.
 */
export function defaultProportions(
  nodeIds: string[],
  edges: GraphEdgeLike[]
): Map<string, number> {
  const known = new Set(nodeIds);
  const childrenOf = new Map<string, string[]>(nodeIds.map((id) => [id, []]));
  const indegree = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  const seen = new Set<string>();

  for (const edge of edges) {
    if (!known.has(edge.source) || !known.has(edge.target)) continue;
    if (edge.source === edge.target) continue;
    if (seen.has(edgeKey(edge.source, edge.target))) continue;
    seen.add(edgeKey(edge.source, edge.target));
    childrenOf.get(edge.source)!.push(edge.target);
    indegree.set(edge.target, indegree.get(edge.target)! + 1);
  }

  const proportions = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  const queue = nodeIds.filter((id) => indegree.get(id) === 0);
  for (const id of queue) proportions.set(id, 100);

  const settled = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    settled.add(current);
    const childIds = childrenOf.get(current)!;
    const shares = splitEvenly(proportions.get(current)!, childIds.length);
    childIds.forEach((childId, index) => {
      proportions.set(
        childId,
        Math.round((proportions.get(childId)! + shares[index]) * 100) / 100
      );
      indegree.set(childId, indegree.get(childId)! - 1);
      if (indegree.get(childId) === 0) queue.push(childId);
    });
  }

  // Anything in a cycle never settles; leave it whole rather than at zero.
  for (const id of nodeIds) {
    if (!settled.has(id)) proportions.set(id, 100);
  }

  return proportions;
}

export interface NodeBalance {
  proportion: number;
  /** Percent of the full sample arriving from earlier steps; null for a first step. */
  inflow: number | null;
  /** Percent of the full sample passed on to later steps; null for a last step. */
  outflow: number | null;
  /** Percent this step declares but never receives. */
  shortfall: number;
  /** Percent this step passes on that no later step takes. */
  leftover: number;
  /** `over` - the step claims more sample than reaches it. `under` - it holds sample that goes nowhere. */
  status: 'ok' | 'over' | 'under';
}

export interface SampleBalance {
  byNode: Map<string, NodeBalance>;
  /** "source->target" -> percent of the full sample travelling that arrow. */
  flows: Map<string, number>;
  isBalanced: boolean;
}

/**
 * Work out, for every step, whether its share of the sample adds up.
 *
 * A design is balanced when the first step runs the whole sample, every step
 * receives exactly the proportion it declares, and every step passes its whole
 * proportion on to the steps that follow it. This is the same check the
 * backend runs before a simulation starts - the canvas highlights and the run
 * button both read it, so they can never disagree with each other.
 */
export function analyzeSampleBalance(
  nodes: GraphNodeLike[],
  edges: GraphEdgeLike[]
): SampleBalance {
  const known = new Set(nodes.map((node) => node.id));
  const validEdges = edges.filter(
    (edge) => known.has(edge.source) && known.has(edge.target) && edge.source !== edge.target
  );

  const { flows, unusedSupply, unmetDemand } = solveEdgeFlows(nodes, validEdges);

  const proportionOf = new Map(nodes.map((node) => [node.id, node.sampleProportion]));
  const childrenOf = new Map<string, string[]>(nodes.map((node) => [node.id, []]));
  const parentsOf = new Map<string, string[]>(nodes.map((node) => [node.id, []]));
  for (const edge of validEdges) {
    if (childrenOf.get(edge.source)!.includes(edge.target)) continue;
    childrenOf.get(edge.source)!.push(edge.target);
    parentsOf.get(edge.target)!.push(edge.source);
  }

  /**
   * What a step's branches ask of it, where the answer isn't ambiguous: on a
   * plain branch it's simply the branches' own proportions added up. Once a
   * branch is shared with another step the split can't be pinned down that
   * way, so those steps fall back to what the flow solver worked out.
   */
  const demandOf = new Map<string, number | null>();
  for (const node of nodes) {
    const childIds = childrenOf.get(node.id)!;
    const pinnable =
      childIds.length > 0 && childIds.every((childId) => parentsOf.get(childId)!.length === 1);
    demandOf.set(
      node.id,
      pinnable
        ? Math.round(
            childIds.reduce((sum, childId) => sum + (proportionOf.get(childId) ?? 0), 0) * 100
          ) / 100
        : null
    );
  }

  const byNode = new Map<string, NodeBalance>();
  let isBalanced = true;
  const tolerance = PROPORTION_EPSILON / 2;

  for (const node of nodes) {
    const parentIds = parentsOf.get(node.id)!;
    const hasChildren = childrenOf.get(node.id)!.length > 0;
    const shortfall = unmetDemand.get(node.id) ?? 0;
    const leftover = unusedSupply.get(node.id) ?? 0;
    const demand = demandOf.get(node.id) ?? null;

    // A step short of sample only because its one parent is already
    // over-subscribed is a symptom - the branch that overshot is highlighted
    // instead, so the user has one place to fix rather than three.
    const parentOverSubscribed =
      parentIds.length === 1 &&
      (demandOf.get(parentIds[0]) ?? null) !== null &&
      demandOf.get(parentIds[0])! - (proportionOf.get(parentIds[0]) ?? 0) > tolerance;

    const outflow = hasChildren
      ? demand ?? Math.round((node.sampleProportion - leftover) * 100) / 100
      : null;

    let status: NodeBalance['status'] = 'ok';
    if (parentIds.length === 0 && Math.abs(node.sampleProportion - 100) > PROPORTION_EPSILON) {
      // A first step always runs the whole sample.
      status = node.sampleProportion > 100 ? 'over' : 'under';
    } else if (node.sampleProportion <= 0 || node.sampleProportion > 100) {
      status = node.sampleProportion > 100 ? 'over' : 'under';
    } else if (outflow !== null && Math.abs(outflow - node.sampleProportion) > tolerance) {
      status = outflow > node.sampleProportion ? 'over' : 'under';
    } else if (shortfall > tolerance && !parentOverSubscribed) {
      status = 'over';
    }

    if (status !== 'ok') isBalanced = false;

    byNode.set(node.id, {
      proportion: node.sampleProportion,
      inflow:
        parentIds.length > 0 ? Math.round((node.sampleProportion - shortfall) * 100) / 100 : null,
      outflow,
      shortfall: parentOverSubscribed ? 0 : shortfall,
      leftover,
      status,
    });
  }

  return { byNode, flows, isBalanced };
}

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
