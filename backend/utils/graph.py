"""
Graph utilities for branching simulation designs.

A simulation is a directed acyclic graph of steps with a single root. Each step
carries four graph keys alongside its content:

    id                 stable identifier (string)
    previous           list of parent ids ([] for the root)
    next               list of child ids ([] for a terminal step)
    sample_proportion  percent of the FULL sample that reaches this step

Personas are split across branches: each persona traverses exactly one
root-to-leaf path, so a step only produces output for the personas routed
through it.
"""

import math


PROPORTION_EPSILON = 0.01


def _as_id_list(value):
    """Coerce a previous/next field into a list of non-empty string ids."""
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        candidates = value
    else:
        candidates = [value]

    ids = []
    for item in candidates:
        if item is None:
            continue
        text = str(item).strip()
        if text and text not in ids:
            ids.append(text)
    return ids


def _coerce_proportion(value, default=100.0):
    """Coerce sample_proportion to a float, falling back to the default."""
    if value is None:
        return default
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if math.isnan(number) or math.isinf(number):
        return default
    return number


def normalize_graph(steps):
    """
    Normalize a list of step dicts into a well-formed graph.

    Backfills the four graph keys, cross-fills `previous` from `next` (and vice
    versa), drops references to ids that don't exist, and returns the steps in
    topological order. Steps with no graph keys at all — the legacy linear
    shape — become a straight chain at 100%.

    Args:
        steps (list): List of step dictionaries (not mutated).

    Returns:
        tuple: (ordered_steps, parents, children) where:
            - ordered_steps (list): copies of the steps in topological order
            - parents (dict): step id -> list of parent ids
            - children (dict): step id -> list of child ids
    """
    if not steps:
        return [], {}, {}

    # Copy so callers keep their input intact, and assign ids where missing.
    normalized = []
    used_ids = set()
    for step in steps:
        if not isinstance(step, dict):
            continue
        copy = dict(step)
        raw_id = copy.get('id')
        step_id = str(raw_id).strip() if raw_id is not None else ''
        if not step_id or step_id in used_ids:
            step_id = f"step_{len(normalized) + 1}"
            while step_id in used_ids:
                step_id = f"{step_id}_x"
        copy['id'] = step_id
        used_ids.add(step_id)
        normalized.append(copy)

    if not normalized:
        return [], {}, {}

    by_id = {step['id']: step for step in normalized}
    order = [step['id'] for step in normalized]

    # Legacy shape: no step declares any edge, so treat the array as a chain.
    has_edges = any(
        _as_id_list(step.get('previous')) or _as_id_list(step.get('next'))
        for step in normalized
    )
    if not has_edges:
        for idx, step in enumerate(normalized):
            step['previous'] = [order[idx - 1]] if idx > 0 else []
            step['next'] = [order[idx + 1]] if idx < len(order) - 1 else []
            step['sample_proportion'] = _coerce_proportion(
                step.get('sample_proportion'), 100.0
            )
        return normalized, _build_parents(normalized), _build_children(normalized)

    # Collect edges from both directions, keeping only references that resolve.
    edges = []
    seen_edges = set()

    def add_edge(source, target):
        if source not in by_id or target not in by_id or source == target:
            return
        key = (source, target)
        if key in seen_edges:
            return
        seen_edges.add(key)
        edges.append(key)

    for step in normalized:
        step_id = step['id']
        for parent_id in _as_id_list(step.get('previous')):
            add_edge(parent_id, step_id)
        for child_id in _as_id_list(step.get('next')):
            add_edge(step_id, child_id)

    children = {step_id: [] for step_id in by_id}
    parents = {step_id: [] for step_id in by_id}
    for source, target in edges:
        children[source].append(target)
        parents[target].append(source)

    # Write the reconciled edges back onto the steps.
    for step in normalized:
        step_id = step['id']
        step['previous'] = list(parents[step_id])
        step['next'] = list(children[step_id])
        step['sample_proportion'] = _coerce_proportion(
            step.get('sample_proportion'), 100.0
        )

    ordered_ids = topological_order(by_id.keys(), parents, children)
    # Any residue means a cycle; keep those steps at the end so validation can
    # report them rather than silently dropping work.
    residue = [sid for sid in order if sid not in set(ordered_ids)]
    ordered_steps = [by_id[sid] for sid in ordered_ids + residue]

    return ordered_steps, parents, children


def _build_parents(steps):
    return {step['id']: list(step.get('previous', [])) for step in steps}


def _build_children(steps):
    return {step['id']: list(step.get('next', [])) for step in steps}


def topological_order(step_ids, parents, children):
    """
    Kahn's algorithm. Returns the ids that could be ordered; ids caught in a
    cycle are omitted, so a short result signals a cycle.
    """
    step_ids = list(step_ids)
    indegree = {sid: len(parents.get(sid, [])) for sid in step_ids}
    # Preserve the caller's ordering among ready nodes for stable output.
    queue = [sid for sid in step_ids if indegree[sid] == 0]
    ordered = []

    while queue:
        current = queue.pop(0)
        ordered.append(current)
        for child in children.get(current, []):
            if child not in indegree:
                continue
            indegree[child] -= 1
            if indegree[child] == 0:
                queue.append(child)

    return ordered


def find_roots(steps, parents):
    return [step['id'] for step in steps if not parents.get(step['id'])]


def _label_for(step):
    return step.get('label') or step.get('id')


def validate_graph(steps, parents, children):
    """
    Validate a normalized graph. Returns a list of human-readable error
    strings; an empty list means the graph is runnable.
    """
    errors = []

    if not steps:
        return ["The simulation has no steps."]

    by_id = {step['id']: step for step in steps}
    roots = find_roots(steps, parents)

    if not roots:
        return [
            "The flow has no first step - every step has an arrow pointing "
            "into it, which means the steps form a loop."
        ]

    if len(roots) > 1:
        names = ", ".join(_label_for(by_id[sid]) for sid in roots[:5])
        more = f" and {len(roots) - 5} more" if len(roots) > 5 else ""
        errors.append(
            f"There are {len(roots)} steps with no arrow pointing into them "
            f"({names}{more}). A simulation must have exactly one first step."
        )

    ordered = topological_order(by_id.keys(), parents, children)
    if len(ordered) < len(by_id):
        stuck = [sid for sid in by_id if sid not in set(ordered)]
        names = ", ".join(_label_for(by_id[sid]) for sid in stuck[:5])
        errors.append(
            f"The steps form a loop ({names}). Arrows must always move "
            "forward."
        )
        # Reachability and proportions are meaningless with a cycle present.
        return errors

    # Every step must be reachable from the single root.
    if len(roots) == 1:
        reachable = set()
        queue = [roots[0]]
        while queue:
            current = queue.pop(0)
            if current in reachable:
                continue
            reachable.add(current)
            queue.extend(children.get(current, []))

        unreachable = [sid for sid in by_id if sid not in reachable]
        if unreachable:
            names = ", ".join(_label_for(by_id[sid]) for sid in unreachable[:5])
            more = f" and {len(unreachable) - 5} more" if len(unreachable) > 5 else ""
            errors.append(
                f"{len(unreachable)} step(s) cannot be reached from the first "
                f"step: {names}{more}."
            )

        root_proportion = by_id[roots[0]].get('sample_proportion', 100.0)
        if abs(root_proportion - 100.0) > PROPORTION_EPSILON:
            errors.append(
                f"The first step ({_label_for(by_id[roots[0]])}) must use 100% "
                f"of the sample, but is set to {root_proportion:g}%."
            )

    for step in steps:
        proportion = step.get('sample_proportion', 100.0)
        if proportion <= 0 or proportion > 100:
            errors.append(
                f"\"{_label_for(step)}\" has a sample proportion of "
                f"{proportion:g}%. It must be greater than 0% and at most 100%."
            )

    errors.extend(_validate_proportions(steps, parents, children))

    return errors


def _scaled(proportion):
    """Percent as a hundredth-of-a-percent integer, so flows stay exact."""
    return int(round(proportion * 100))


def solve_edge_flows(steps, parents, children):
    """
    Work out how much of each step's sample travels along each arrow.

    The proportions define a transportation problem: every step with children
    must pass on exactly its own proportion, and every non-root step must
    receive exactly its own proportion. Solving it as a max-flow gives the
    exact per-edge split for any DAG - including a step that both feeds a
    merge and splits elsewhere, which no fixed formula can express.

    Returns:
        tuple: (flows, unused_supply, unmet_demand) where:
            - flows (dict): (parent_id, child_id) -> percent of the full sample
            - unused_supply (dict): parent id -> percent it failed to pass on
            - unmet_demand (dict): child id -> percent it failed to receive
        An empty unused_supply and unmet_demand means the proportions balance.
    """
    by_id = {step['id']: step for step in steps}
    suppliers = [s['id'] for s in steps if children.get(s['id'])]
    receivers = [s['id'] for s in steps if parents.get(s['id'])]

    if not suppliers or not receivers:
        return {}, {}, {}

    # Node indices: 0 = source, 1..S = suppliers, S+1..S+R = receivers, last = sink.
    supply_idx = {sid: i + 1 for i, sid in enumerate(suppliers)}
    receive_idx = {sid: len(suppliers) + i + 1 for i, sid in enumerate(receivers)}
    source, sink = 0, len(suppliers) + len(receivers) + 1
    size = sink + 1

    capacity = [[0] * size for _ in range(size)]
    for sid in suppliers:
        capacity[source][supply_idx[sid]] = _scaled(by_id[sid].get('sample_proportion', 100.0))
    for sid in receivers:
        capacity[receive_idx[sid]][sink] = _scaled(by_id[sid].get('sample_proportion', 100.0))

    edge_pairs = []
    for parent_id in suppliers:
        for child_id in children.get(parent_id, []):
            if child_id not in receive_idx:
                continue
            capacity[supply_idx[parent_id]][receive_idx[child_id]] = 10 ** 9
            edge_pairs.append((parent_id, child_id))

    residual = [row[:] for row in capacity]

    # Edmonds-Karp; the graphs here are tiny (tens of nodes).
    while True:
        previous = [-1] * size
        previous[source] = source
        queue = [source]
        while queue and previous[sink] == -1:
            current = queue.pop(0)
            for nxt in range(size):
                if previous[nxt] == -1 and residual[current][nxt] > 0:
                    previous[nxt] = current
                    queue.append(nxt)
        if previous[sink] == -1:
            break

        # Push the bottleneck along the augmenting path.
        bottleneck = float('inf')
        node = sink
        while node != source:
            bottleneck = min(bottleneck, residual[previous[node]][node])
            node = previous[node]
        node = sink
        while node != source:
            residual[previous[node]][node] -= bottleneck
            residual[node][previous[node]] += bottleneck
            node = previous[node]

    flows = {}
    for parent_id, child_id in edge_pairs:
        sent = capacity[supply_idx[parent_id]][receive_idx[child_id]] - \
            residual[supply_idx[parent_id]][receive_idx[child_id]]
        flows[(parent_id, child_id)] = sent / 100.0

    unused_supply = {}
    for sid in suppliers:
        leftover = residual[source][supply_idx[sid]]
        if leftover > 0:
            unused_supply[sid] = leftover / 100.0

    unmet_demand = {}
    for sid in receivers:
        shortfall = residual[receive_idx[sid]][sink]
        if shortfall > 0:
            unmet_demand[sid] = shortfall / 100.0

    return flows, unused_supply, unmet_demand


def _validate_proportions(steps, parents, children):
    """
    Every step must pass its whole sample on to its children, and every step
    must receive exactly the proportion it declares. On a plain branch this is
    simply "the children's proportions add up to the parent's".
    """
    errors = []
    by_id = {step['id']: step for step in steps}
    _, unused_supply, unmet_demand = solve_edge_flows(steps, parents, children)

    for step_id, leftover in unused_supply.items():
        step = by_id[step_id]
        child_names = ", ".join(
            _label_for(by_id[cid]) for cid in children.get(step_id, []) if cid in by_id
        )
        passed_on = step.get('sample_proportion', 100.0) - leftover
        errors.append(
            f"The steps after \"{_label_for(step)}\" ({child_names}) take "
            f"{passed_on:g}% of the sample, but \"{_label_for(step)}\" passes "
            f"on {step.get('sample_proportion', 100.0):g}%. "
            f"{leftover:g}% has nowhere to go - raise the sample proportion of "
            f"a following step."
        )

    for step_id, shortfall in unmet_demand.items():
        if step_id in unused_supply:
            continue
        step = by_id[step_id]
        errors.append(
            f"\"{_label_for(step)}\" is set to {step.get('sample_proportion', 100.0):g}% "
            f"of the sample but only {step.get('sample_proportion', 100.0) - shortfall:g}% "
            f"reaches it from the steps before it. Lower its sample proportion "
            f"or raise the steps feeding into it."
        )

    return errors


def _largest_remainder_split(items, weights):
    """
    Split `items` into contiguous chunks sized by `weights` (which should sum
    to 1). Largest-remainder rounding guarantees the chunk sizes are integers
    that sum to exactly len(items).
    """
    if not weights:
        return []

    total = len(items)
    raw = [max(0.0, w) * total for w in weights]
    counts = [int(math.floor(value)) for value in raw]

    shortfall = total - sum(counts)
    if shortfall > 0:
        # Hand out the remaining slots to the largest fractional parts first.
        order = sorted(
            range(len(raw)),
            key=lambda i: (-(raw[i] - counts[i]), i),
        )
        for i in range(shortfall):
            counts[order[i % len(order)]] += 1
    elif shortfall < 0:
        order = sorted(range(len(raw)), key=lambda i: (raw[i] - counts[i], i))
        surplus = -shortfall
        for i in range(surplus):
            idx = order[i % len(order)]
            if counts[idx] > 0:
                counts[idx] -= 1

    chunks = []
    position = 0
    for count in counts:
        chunks.append(items[position:position + count])
        position += count
    return chunks


def assign_persona_paths(steps, parents, children, num_personas):
    """
    Route each persona down exactly one root-to-leaf path.

    Args:
        steps (list): Topologically ordered, normalized steps.
        parents (dict): step id -> parent ids.
        children (dict): step id -> child ids.
        num_personas (int): Number of personas in the run.

    Returns:
        dict: persona index -> list of step ids, in traversal order.
    """
    paths = {idx: [] for idx in range(num_personas)}
    if not steps or num_personas <= 0:
        return paths

    by_id = {step['id']: step for step in steps}
    roots = find_roots(steps, parents)
    if not roots:
        return paths

    flows, _, _ = solve_edge_flows(steps, parents, children)

    # Personas currently sitting at each step, in stable persona order.
    at_step = {step['id']: [] for step in steps}
    at_step[roots[0]] = list(range(num_personas))

    for step in steps:
        step_id = step['id']
        # Topological order guarantees every parent has already contributed;
        # sort so persona order is stable at merge points.
        arrivals = sorted(at_step.get(step_id, []))
        if not arrivals:
            continue

        for persona_idx in arrivals:
            paths[persona_idx].append(step_id)

        child_ids = [cid for cid in children.get(step_id, []) if cid in by_id]
        if not child_ids:
            continue

        weights = [max(0.0, flows.get((step_id, cid), 0.0)) for cid in child_ids]
        weight_total = sum(weights)
        if weight_total <= 0:
            # Degenerate; send everyone down the first branch rather than
            # dropping personas on the floor.
            weights = [1.0] + [0.0] * (len(child_ids) - 1)
        else:
            weights = [w / weight_total for w in weights]

        for child_id, chunk in zip(child_ids, _largest_remainder_split(arrivals, weights)):
            at_step[child_id].extend(chunk)

    return paths


def steps_by_id(steps):
    return {step['id']: step for step in steps}
