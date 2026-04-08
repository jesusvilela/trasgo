#!/usr/bin/env node
// V1 unit tests for the harness layer. These run offline (no network) and
// exercise the modules that ship under src/harness/. Failures here mean a
// regression in the correction-loop substrate, not just a CLI surface bug.

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parsePacketStream, extractJsonBlocks } from '../src/harness/err-watcher.mjs';
import { createCorrectionInstruction } from '../src/harness/correction-injector.mjs';
import { analyzeErrorHistory } from '../src/harness/pattern-detector.mjs';
import { proposeEvolution } from '../src/harness/evolution-proposer.mjs';
import { runCorrectionLoop } from '../src/harness/loop-executor.mjs';
import {
  buildFormalTestPrompt,
  evaluateFormalResponse,
  listFormalTestIds,
  loadFormalTestData,
} from './formal-reasoning/run-v1-v5.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const failures = [];

function check(name, fn) {
  try {
    fn();
    process.stdout.write(`ok: ${name}\n`);
  } catch (error) {
    failures.push({ name, error });
    process.stdout.write(`FAIL: ${name}\n${error.stack || error.message}\n`);
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    process.stdout.write(`ok: ${name}\n`);
  } catch (error) {
    failures.push({ name, error });
    process.stdout.write(`FAIL: ${name}\n${error.stack || error.message}\n`);
  }
}

// --- err-watcher ----------------------------------------------------------

check('extractJsonBlocks: balanced top-level braces', () => {
  const text = 'noise {"a":1,"b":{"c":2}} tail {"d":3}';
  const blocks = extractJsonBlocks(text);
  assert.deepEqual(blocks, ['{"a":1,"b":{"c":2}}', '{"d":3}']);
});

check('extractJsonBlocks: braces inside strings are ignored', () => {
  const text = '{"k":"value with } brace"} after';
  const blocks = extractJsonBlocks(text);
  assert.deepEqual(blocks, ['{"k":"value with } brace"}']);
});

check('parsePacketStream: §1 packet with μ.cert is captured', () => {
  const out = '{"§":1,"μ":{"cert":0.9},"Δ":["a->b"]}';
  const r = parsePacketStream(out);
  assert.equal(r.hasError, false);
  assert.equal(r.cert, 0.9);
  assert.ok(r.lastPacket);
  assert.deepEqual(r.lastPacket.Δ, ['a->b']);
});

check('parsePacketStream: ERR block surfaces certDrop, flag, stepRef', () => {
  const out = 'noise {"§":1,"μ":{"cert":0.2},"ERR":{"err":"FM1: capture","cert":0.18,"flag":"VALIDATE-STEP","delta_confidence":["d",2]}}';
  const r = parsePacketStream(out);
  assert.equal(r.hasError, true);
  assert.equal(r.certDrop, 0.18);
  assert.equal(r.flag, 'VALIDATE-STEP');
  assert.equal(r.stepRef, 2);
  assert.equal(r.errBlock.err, 'FM1: capture');
});

check('parsePacketStream: §P checkpoint is detected', () => {
  const out = 'pre {"§P":"checkpoint"} mid {"§":1,"μ":{"cert":0.7}}';
  const r = parsePacketStream(out);
  assert.equal(r.hasCheckpoint, true);
  assert.equal(r.cert, 0.7);
});

check('parsePacketStream: empty input yields null state', () => {
  const r = parsePacketStream('');
  assert.equal(r.hasError, false);
  assert.equal(r.lastPacket, null);
  assert.equal(r.cert, null);
});

// --- correction-injector --------------------------------------------------

check('createCorrectionInstruction: produces §P|VALIDATE turn', () => {
  const packetState = { E: { x: ['e'] }, S: { x: 'on' }, Δ: ['x:on'] };
  const errBlock = { err: 'FM1', cert: 0.2, flag: 'VALIDATE-STEP' };
  const instruction = createCorrectionInstruction(packetState, errBlock, 2);
  assert.match(instruction, /§P\|VALIDATE/);
  assert.match(instruction, /Does the delta at 2/);
  // Embedded packet must be valid JSON
  const jsonStart = instruction.indexOf('{');
  const jsonEnd = instruction.lastIndexOf('}');
  const payload = JSON.parse(instruction.slice(jsonStart, jsonEnd + 1));
  assert.equal(payload['§'], 1);
  assert.equal(payload.μ.flag, 'VALIDATE-STEP');
});

// --- pattern-detector -----------------------------------------------------

check('analyzeErrorHistory: dominant FM1 with 2 hits is systematic', () => {
  const history = [
    { err: { err: 'FM1: capture' } },
    { err: { err: 'FM1: capture' } },
    { err: { err: 'FM3: drift' } },
  ];
  const result = analyzeErrorHistory(history);
  assert.equal(result.dominantFM, 'FM1: capture');
  assert.equal(result.frequency, 2);
  assert.equal(result.systematic, true);
});

check('analyzeErrorHistory: empty history is not systematic', () => {
  const result = analyzeErrorHistory([]);
  assert.equal(result.dominantFM, null);
  assert.equal(result.systematic, false);
});

// --- evolution-proposer ---------------------------------------------------

check('proposeEvolution: returns FM1 substitution proposal', () => {
  const proposal = proposeEvolution('FM1: capture', {});
  assert.ok(proposal);
  const parsed = JSON.parse(proposal);
  assert.equal(parsed['§1|EVOLVE'], true);
  assert.ok(parsed.σ || parsed.EX_EVO?.σ);
});

check('proposeEvolution: returns null for unknown FM', () => {
  const proposal = proposeEvolution('FM99: unknown', {});
  assert.equal(proposal, null);
});

// --- loop-executor --------------------------------------------------------

await checkAsync('runCorrectionLoop: triggers when cert below threshold', async () => {
  const errPayload = '{"§":1,"μ":{"cert":0.2},"ERR":{"err":"FM1: capture","cert":0.2,"flag":"VALIDATE-STEP","delta_confidence":["d",2]}}';
  const okPayload = '{"§":1,"μ":{"cert":0.92},"Δ":["d2:safe"]}';
  let calls = 0;
  const fakeExecuteInput = async () => {
    calls += 1;
    return { content: okPayload };
  };
  const session = { checkpoints: [], error_history: [], cert_trajectory: [] };
  const loop = await runCorrectionLoop(
    session,
    { content: errPayload },
    fakeExecuteInput,
    { runtimeHome: {}, registry: {} },
    { maxIterations: 2, certThreshold: 0.5 },
  );
  assert.equal(loop.iterations, 1);
  assert.equal(calls, 1);
  assert.equal(loop.parsed.hasError, false);
  assert.equal(loop.parsed.cert, 0.92);
  assert.equal(session.cert_trajectory.length, 1);
});

await checkAsync('runCorrectionLoop: skips when initial cert is healthy', async () => {
  const okPayload = '{"§":1,"μ":{"cert":0.9},"Δ":["d:ok"]}';
  let calls = 0;
  const fakeExecuteInput = async () => {
    calls += 1;
    return { content: okPayload };
  };
  const session = { checkpoints: [], error_history: [], cert_trajectory: [] };
  const loop = await runCorrectionLoop(
    session,
    { content: okPayload },
    fakeExecuteInput,
    { runtimeHome: {}, registry: {} },
    { maxIterations: 2, certThreshold: 0.5 },
  );
  assert.equal(loop.iterations, 0);
  assert.equal(calls, 0);
});

// --- formal reasoning helpers ---------------------------------------------

check('listFormalTestIds: includes v1..v5 stems', () => {
  const ids = listFormalTestIds();
  assert.ok(ids.length >= 5, `expected >=5 test ids, got ${ids.length}`);
  for (const family of ['v1', 'v2', 'v3', 'v4', 'v5']) {
    assert.ok(ids.some(id => id.startsWith(family)), `missing test family ${family}: ${ids.join(',')}`);
  }
});

check('buildFormalTestPrompt: v1 builds reduction prompt', () => {
  const data = loadFormalTestData(listFormalTestIds().find(id => id.startsWith('v1')));
  const prompt = buildFormalTestPrompt('v1-lambda-calibration', data);
  assert.match(prompt, /Reduce the following terms/);
  assert.match(prompt, /Emit §1 deltas/);
});

check('evaluateFormalResponse: passes on healthy §1 packet', () => {
  const out = '{"§":1,"μ":{"cert":0.85},"Δ":["a->b"]}';
  const { passed, parsed } = evaluateFormalResponse(out);
  assert.equal(passed, true);
  assert.equal(parsed.cert, 0.85);
});

check('evaluateFormalResponse: fails when ERR block present', () => {
  const out = '{"§":1,"μ":{"cert":0.2},"ERR":{"err":"FM1","cert":0.2,"flag":"VALIDATE"}}';
  const { passed } = evaluateFormalResponse(out);
  assert.equal(passed, false);
});

check('evaluateFormalResponse: passes on V6 (TC) Church-6 result', () => {
  const out = '{"§":1,"S":{"TARGET.form":"λf.λx.f(f(f(f(f(fx)))))"},"μ":{"cert":0.9}}';
  const { passed } = evaluateFormalResponse(out);
  assert.equal(passed, true);
});

// --- summary --------------------------------------------------------------

if (failures.length > 0) {
  process.stdout.write(`\nharness unit tests: ${failures.length} failure(s)\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('\nharness unit tests: all green\n');
}
