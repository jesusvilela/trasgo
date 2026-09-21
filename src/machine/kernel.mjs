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

export function compareInvariants(before, after, paths) {
  return paths.map(specification => {
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
  const edges = relations.filter(edge => !relation || edge?.[0] === relation);
  const incidence = new Map();
  const arities = [];
  for (const edge of edges) {
    const vertices = Array.isArray(edge) ? edge.slice(1) : [];
    arities.push(vertices.length);
    for (const vertex of vertices) {
      const key = canonicalJson(vertex);
      incidence.set(key, (incidence.get(key) ?? 0) + 1);
    }
  }
  return {
    edges: edges.length,
    arities: arities.sort((a, b) => a - b),
    incidenceDegrees: [...incidence.values()].sort((a, b) => a - b),
  };
}
