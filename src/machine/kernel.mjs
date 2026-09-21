import { createHash } from 'node:crypto';

const CORE_AXES = new Set(['§', 'E', 'S', 'R', 'Δ', 'μ', 'ERR']);

function clone(value) {
  return structuredClone(value);
}

export function isMachineState(state) {
  return Boolean(
    state
    && state['§'] === 1
    && state.E && typeof state.E === 'object' && !Array.isArray(state.E)
    && state.S && typeof state.S === 'object' && !Array.isArray(state.S)
    && Array.isArray(state.R)
    && Array.isArray(state.Δ)
    && state.μ && typeof state.μ === 'object' && !Array.isArray(state.μ),
  );
}

export function stateDigest(state) {
  return createHash('sha256').update(canonicalJson(state)).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function createKernel({ boot = [], semantics = {} } = {}) {
  return {
    boot: clone(boot),
    semantics: clone(semantics),
    revision: 0,
    checkpoints: [],
    audit: [],
  };
}

export function installAxis(kernel, example) {
  if (!isMachineState(example)) throw new TypeError('EVOLVE example must be a well-formed §1 state');
  const axes = Object.keys(example).filter(axis => !CORE_AXES.has(axis));
  if (axes.length !== 1) throw new TypeError('EVOLVE example must introduce exactly one custom axis');
  const axis = axes[0];
  const next = clone(kernel);
  next.semantics[axis] = { example: clone(example[axis]), installedAt: next.revision + 1 };
  next.revision += 1;
  next.audit.push({ operation: 'evolve', axis, revision: next.revision });
  return next;
}

export function proposeTransition(kernel, current, candidate) {
  const errors = [];
  if (!isMachineState(candidate)) errors.push('candidate is not a well-formed §1 state');
  if (isMachineState(candidate)) {
    for (const axis of Object.keys(candidate).filter(axis => !CORE_AXES.has(axis))) {
      if (!kernel.semantics[axis]) errors.push(`unknown semantic axis: ${axis}`);
    }
  }
  return { current: clone(current), candidate: clone(candidate), valid: errors.length === 0, errors };
}

export function commitTransition(kernel, proposal) {
  if (!proposal.valid) throw new Error(`transition rejected: ${proposal.errors.join('; ')}`);
  const next = clone(kernel);
  next.audit.push({ operation: 'commit', digest: stateDigest(proposal.candidate), revision: next.revision });
  return { kernel: next, state: clone(proposal.candidate) };
}

export function checkpoint(kernel, state, invariants = []) {
  if (!isMachineState(state)) throw new TypeError('cannot checkpoint malformed state');
  const next = clone(kernel);
  const record = {
    id: stateDigest(state).slice(0, 16),
    state: clone(state),
    semantics: clone(next.semantics),
    revision: next.revision,
    invariants: clone(invariants),
  };
  next.checkpoints.push(record);
  next.audit.push({ operation: 'checkpoint', id: record.id, revision: next.revision });
  return { kernel: next, checkpoint: record };
}

export function restoreCheckpoint(record, backend) {
  if (!record || !isMachineState(record.state)) throw new TypeError('invalid checkpoint');
  if (!backend || typeof backend.id !== 'string') throw new TypeError('backend must declare an id');
  return {
    backend: backend.id,
    state: clone(record.state),
    semantics: clone(record.semantics),
    revision: record.revision,
    invariants: clone(record.invariants),
  };
}

export function readPath(value, dottedPath) {
  return dottedPath.split('.').reduce((cursor, part) => cursor?.[part], value);
}

export function compareInvariants(before, after, specifications) {
  return specifications.map(specification => {
    const spec = typeof specification === 'string'
      ? { kind: 'path-equality', path: specification }
      : specification;
    if (!spec || typeof spec !== 'object') throw new TypeError('invariant must be a path or specification');

    let left;
    let right;
    if (spec.kind === 'path-equality') {
      left = readPath(before, spec.path);
      right = readPath(after, spec.path);
    } else if (spec.kind === 'relation-topology') {
      left = relationTopology(before.R, spec.relation);
      right = relationTopology(after.R, spec.relation);
    } else {
      throw new TypeError(`unknown invariant kind: ${spec.kind}`);
    }
    return {
      ...clone(spec),
      before: clone(left),
      after: clone(right),
      preserved: canonicalJson(left) === canonicalJson(right),
    };
  });
}

function relationTopology(relations, relation) {
  const edges = relations.filter(edge => Array.isArray(edge) && (!relation || edge[0] === relation));
  const incidence = new Map();
  const arities = [];
  const adjacency = new Map();
  const edgeKeys = [];
  for (const [index, edge] of edges.entries()) {
    const vertices = edge.slice(1);
    const edgeKey = `edge:${index}`;
    edgeKeys.push(edgeKey);
    adjacency.set(edgeKey, []);
    arities.push(vertices.length);
    for (const vertex of vertices) {
      const key = `vertex:${canonicalJson(vertex)}`;
      incidence.set(key, (incidence.get(key) ?? 0) + 1);
      if (!adjacency.has(key)) adjacency.set(key, []);
      adjacency.get(edgeKey).push(key);
      adjacency.get(key).push(edgeKey);
    }
  }
  const colors = new Map();
  for (const [key, neighbors] of adjacency) {
    colors.set(key, key.startsWith('edge:') ? `e:${neighbors.length}` : `v:${neighbors.length}`);
  }
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const refined = new Map();
    for (const [key, neighbors] of adjacency) {
      const neighborhood = neighbors.map(neighbor => colors.get(neighbor)).sort();
      refined.set(key, digest(`${colors.get(key)}|${neighborhood.join(',')}`));
    }
    colors.clear();
    for (const [key, color] of refined) colors.set(key, color);
  }
  return {
    edges: edges.length,
    arities: arities.sort((a, b) => a - b),
    incidenceDegrees: [...incidence.values()].sort((a, b) => a - b),
    components: componentSizes(adjacency),
    vertexColors: [...adjacency.keys()]
      .filter(key => key.startsWith('vertex:'))
      .map(key => colors.get(key)).sort(),
    edgeColors: edgeKeys.map(key => colors.get(key)).sort(),
  };
}

function componentSizes(adjacency) {
  const unseen = new Set(adjacency.keys());
  const sizes = [];
  while (unseen.size) {
    const queue = [unseen.values().next().value];
    unseen.delete(queue[0]);
    let vertices = 0;
    let edges = 0;
    while (queue.length) {
      const key = queue.pop();
      if (key.startsWith('vertex:')) vertices += 1;
      else edges += 1;
      for (const neighbor of adjacency.get(key)) {
        if (unseen.delete(neighbor)) queue.push(neighbor);
      }
    }
    sizes.push(`${vertices}:${edges}`);
  }
  return sizes.sort();
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}
