#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkpoint, commitTransition, compareInvariants, createKernel, installAxis,
  isMachineState, proposeTransition, restoreCheckpoint,
} from '../machine/kernel.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const prereg = JSON.parse(fs.readFileSync(path.join(here, 'reflective-machine-preregistration.json')));
const base = { '§': 1, E: { X: ['probe', 'entity'] }, S: { 'X.value': 1 }, R: [], Δ: [], μ: { cert: 0.9 } };

assert.equal(prereg.status, 'preregistered-design-not-run');
assert.deepEqual(Object.keys(prereg.properties), [
  'inducibility', 'operational_closure', 'reflectivity', 'transport_invariance', 'recoverability', 'substrate_portability',
]);
assert.ok(Object.values(prereg.properties).every(property => property.threshold > 0 && property.threshold <= 1));

let kernel = createKernel({ boot: [{ id: 'finite-exemplar' }] });
const evolvedExample = { ...structuredClone(base), ρ: { source: 'held-out-probe', reviewed: false } };
kernel = installAxis(kernel, evolvedExample);
assert.ok(kernel.semantics.ρ, 'inducibility: finite exemplar installs an axis');

const candidate = { ...structuredClone(base), S: { 'X.value': 2 }, Δ: ['X.value:1→2'], ρ: { source: 'trial' } };
const proposal = proposeTransition(kernel, base, candidate);
assert.equal(proposal.valid, true);
const committed = commitTransition(kernel, proposal);
assert.ok(isMachineState(committed.state), 'operational closure: commit remains in §1 state space');
assert.equal(proposeTransition(createKernel(), base, candidate).valid, false, 'reflectivity: behavior changes only after EVOLVE');

const invariantPaths = ['E.X', 'S.X.value'];
const roundTrip = JSON.parse(JSON.stringify(base));
assert.ok(compareInvariants(base, roundTrip, invariantPaths).every(result => result.preserved), 'transport invariance');

const saved = checkpoint(committed.kernel, base, invariantPaths);
const invalid = proposeTransition(saved.kernel, base, { E: {} });
assert.equal(invalid.valid, false);
const recovered = restoreCheckpoint(saved.checkpoint, { id: 'backend-b' });
assert.deepEqual(recovered.state, base, 'recoverability: rejected proposal leaves restorable checkpoint');
assert.equal(recovered.backend, 'backend-b');
assert.deepEqual(recovered.semantics.ρ.example, evolvedExample.ρ, 'substrate portability: semantics travels with checkpoint');

process.stdout.write('reflective-machine scaffold: 6/6 deterministic contract checks passed\n');
process.stdout.write('note: these checks validate the harness contract, not empirical LLM conformance\n');
