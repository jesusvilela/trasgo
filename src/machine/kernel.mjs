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
  return createHash('sha256').update(JSON.stringify(state)).digest('hex');
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
  return paths.map(path => ({
    path,
    before: clone(readPath(before, path)),
    after: clone(readPath(after, path)),
    preserved: JSON.stringify(readPath(before, path)) === JSON.stringify(readPath(after, path)),
  }));
}
