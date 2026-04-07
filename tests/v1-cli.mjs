#!/usr/bin/env node
// V1 acceptance suite for the Trasgo CLI derivables.
//
// Goal: walk every CLI surface that V1 needs to ship — status, inventory,
// session lifecycle (init/pack/boot/session/balance), token science fallbacks,
// cot pipeline, demo + machine runs, trace replay, advise/explain, harness
// layer, verify (offline) and evolve. Each command runs against an isolated
// TRASGO_HOME so the suite is reproducible and never touches the developer
// session store.
//
// The suite intentionally drives the Node CLI directly (src/trasgo/cli.mjs)
// rather than the Rust-aware launcher. The launcher is exercised by
// scripts/ci-smoke.mjs; this file pins the JavaScript surface that ships in
// the npm package and is what gets exercised when no native binary is built.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const cliEntry = path.join(repoRoot, 'src', 'trasgo', 'cli.mjs');

const verbose = process.argv.includes('--verbose');
const failures = [];
const sessionTempDirs = [];

function makeHome(label = 'cli') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `trasgo-v1-${label}-`));
  sessionTempDirs.push(dir);
  return dir;
}

function cleanupHomes() {
  for (const dir of sessionTempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best effort
    }
  }
}

function runCli(args, { home, env: extraEnv = {}, expectStatus = 0, allowNonZero = false } = {}) {
  const env = {
    ...process.env,
    TRASGO_LOGO: 'none',
    TRASGO_HOME: home,
    ...extraEnv,
  };
  const result = spawnSync(process.execPath, [cliEntry, ...args], {
    cwd: home || repoRoot,
    env,
    encoding: 'utf8',
    shell: false,
  });
  if (result.error) throw result.error;
  if (!allowNonZero && (result.status ?? 1) !== expectStatus) {
    throw new Error(`trasgo ${args.join(' ')} exited ${result.status}\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`);
  }
  return {
    status: result.status ?? 0,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function runCliJson(args, options = {}) {
  const result = runCli(args, options);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`expected JSON from trasgo ${args.join(' ')}\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}\n${error.message}`);
  }
}

async function check(name, fn) {
  try {
    await fn();
    process.stdout.write(`ok: ${name}\n`);
  } catch (error) {
    failures.push({ name, error });
    process.stdout.write(`FAIL: ${name}\n${error.stack || error.message}\n`);
  }
}

// --------------------------------------------------------------------------
// Test cases
// --------------------------------------------------------------------------

const sharedHome = makeHome('shared');

await check('status --json reports plane summary', async () => {
  const status = runCliJson(['status', '--json'], { home: sharedHome });
  assert.equal(status.kind, 'trasgo-status');
  assert.equal(typeof status.registry, 'string');
  assert.ok(status.plane);
  assert.ok(status.plane.runtimes >= 1);
  assert.ok(status.plane.machines >= 1);
});

await check('runtimes --json lists every registry runtime', async () => {
  const list = runCliJson(['runtimes', '--json'], { home: sharedHome });
  assert.equal(list.kind, 'trasgo-runtime-list');
  assert.ok(Array.isArray(list.runtimes));
  assert.ok(list.runtimes.length >= 2);
  for (const entry of list.runtimes) {
    assert.equal(typeof entry.id, 'string');
    assert.equal(typeof entry.kind, 'string');
  }
});

await check('tools --json lists every registry tool', async () => {
  const list = runCliJson(['tools', '--json'], { home: sharedHome });
  assert.equal(list.kind, 'trasgo-tool-list');
  assert.ok(list.tools.length >= 2);
});

await check('machines --json lists every registry machine', async () => {
  const list = runCliJson(['machines', '--json'], { home: sharedHome });
  assert.equal(list.kind, 'trasgo-machine-list');
  assert.ok(list.machines.length >= 2);
});

await check('mcp --json lists registered MCP surfaces', async () => {
  const list = runCliJson(['mcp', '--json'], { home: sharedHome });
  assert.equal(list.kind, 'trasgo-mcp-list');
  assert.ok(list.mcp.length >= 1);
});

await check('skills --json lists registered skills', async () => {
  const list = runCliJson(['skills', '--json'], { home: sharedHome });
  assert.equal(list.kind, 'trasgo-skill-list');
  assert.ok(list.skills.length >= 1);
});

await check('demo list --json includes built-in workflows', async () => {
  const list = runCliJson(['demo', 'list', '--json'], { home: sharedHome });
  assert.equal(list.kind, 'trasgo-demo-list');
  assert.ok(list.demos.some(entry => entry.id === 'factory-copilot'));
  assert.ok(list.demos.some(entry => entry.id === 'revenue-guard'));
});

await check('show runtimes <id> returns full registry entry', async () => {
  const list = runCliJson(['runtimes', '--json'], { home: sharedHome });
  const id = list.runtimes[0].id;
  const entry = runCliJson(['show', 'runtimes', id, '--json'], { home: sharedHome });
  assert.equal(entry.id, id);
});

await check('show with bad collection exits non-zero', async () => {
  const result = runCli(['show', 'bogus', 'whatever', '--json'], { home: sharedHome, allowNonZero: true });
  assert.notEqual(result.status, 0);
});

// --- session lifecycle ----------------------------------------------------

const lifecycleHome = makeHome('lifecycle');

await check('session new --json creates a session and persists state', async () => {
  const session = runCliJson(['session', 'new', 'v1-session', '--json'], { home: lifecycleHome });
  assert.equal(typeof session.id, 'string');
  assert.equal(session.title, 'v1-session');
  assert.equal(session.boot.status, 'cold');
  const activeFile = path.join(lifecycleHome, '.trasgo-runtime', 'active-session.json');
  assert.ok(fs.existsSync(activeFile));
  const persisted = JSON.parse(fs.readFileSync(activeFile, 'utf8'));
  assert.equal(persisted.session_id, session.id);
});

await check('session list --json includes the new session', async () => {
  const list = runCliJson(['session', 'list', '--json'], { home: lifecycleHome });
  assert.equal(list.kind, 'trasgo-session-list');
  assert.ok(list.sessions.some(entry => entry.title === 'v1-session'));
});

await check('init --json moves session into initialized boot state', async () => {
  const init = runCliJson(['init', 'v1-init', '--json'], { home: lifecycleHome });
  assert.equal(init.title, 'v1-init');
  assert.equal(init.boot.status, 'initialized');
  assert.ok(init.workflow.initialized_at);
});

let packPath;
await check('pack --json writes a pack bundle to disk', async () => {
  const pack = runCliJson(['pack', '--out', '.trasgo-runtime/packs/v1.json', '--json'], { home: lifecycleHome });
  assert.ok(pack.pack_path);
  assert.ok(fs.existsSync(pack.pack_path), `pack file missing at ${pack.pack_path}`);
  packPath = pack.pack_path;
  const bundle = JSON.parse(fs.readFileSync(pack.pack_path, 'utf8'));
  assert.equal(bundle.kind, 'trasgo-pack');
  assert.ok(Array.isArray(bundle.skills));
});

await check('boot --from <pack> --json activates the runtime', async () => {
  const boot = runCliJson(['boot', '--from', packPath, '--json'], { home: lifecycleHome });
  assert.equal(boot.session.boot.status, 'booted');
  assert.ok(boot.decision.selected.length >= 1);
});

await check('balance show --json reports current contract', async () => {
  const balance = runCliJson(['balance', 'show', '--json'], { home: lifecycleHome });
  assert.equal(balance.kind, 'trasgo-balance');
  assert.ok(balance.decision.ranked.length >= 1);
});

await check('balance set targets mutates contract', async () => {
  const list = runCliJson(['runtimes', '--json'], { home: lifecycleHome });
  const target = list.runtimes[0].id;
  const updated = runCliJson(['balance', 'set', 'targets', target, '--json'], { home: lifecycleHome });
  assert.deepEqual(updated.session.contract.targets, [target]);
});

await check('balance set priority mutates priority weights', async () => {
  const updated = runCliJson(['balance', 'set', 'priority.cost', '0.42', '--json'], { home: lifecycleHome });
  assert.equal(updated.session.contract.priorities.cost, 0.42);
});

await check('explain balance --json carries the active contract', async () => {
  const explain = runCliJson(['explain', 'balance', '--json'], { home: lifecycleHome });
  assert.equal(explain.kind, 'trasgo-explain-balance');
  assert.ok(explain.contract);
});

await check('explain route --json carries the broker decision', async () => {
  const explain = runCliJson(['explain', 'route', '--json'], { home: lifecycleHome });
  assert.equal(explain.kind, 'trasgo-explain-route');
  assert.ok(explain.decision);
});

// --- skills + mcp toggles -------------------------------------------------

await check('skills attach + detach round-trips state', async () => {
  const list = runCliJson(['skills', '--json'], { home: lifecycleHome });
  const id = list.skills.find(entry => entry.id !== 'boot-loader')?.id || list.skills[0].id;
  const attached = runCliJson(['skills', 'attach', id, '--json'], { home: lifecycleHome });
  assert.ok(attached.skills.includes(id));
  const detached = runCliJson(['skills', 'detach', id, '--json'], { home: lifecycleHome });
  if (id !== 'boot-loader') {
    assert.ok(!detached.skills.includes(id));
  }
});

await check('mcp mount + unmount round-trips state', async () => {
  const list = runCliJson(['mcp', '--json'], { home: lifecycleHome });
  const id = list.mcp.find(entry => entry.id !== 'runtime-registry')?.id || list.mcp[0].id;
  const mounted = runCliJson(['mcp', 'mount', id, '--json'], { home: lifecycleHome });
  assert.ok(mounted.mcp_mounts.includes(id));
  const unmounted = runCliJson(['mcp', 'unmount', id, '--json'], { home: lifecycleHome });
  if (id !== 'runtime-registry') {
    assert.ok(!unmounted.mcp_mounts.includes(id));
  }
});

// --- token science fallbacks ----------------------------------------------

const tokensHome = makeHome('tokens');

await check('tokens --json returns the token report shape', async () => {
  const report = runCliJson([
    'tokens',
    '--codec', '{"§":1,"Δ":["A->B"],"μ":{"scope":"ops"}}',
    '--natural', 'Operator state transition metadata envelope',
    '--json',
  ], { home: tokensHome });
  assert.equal(report.kind, 'trasgo-token-report');
  assert.ok(Array.isArray(report.models) && report.models.length >= 4);
  assert.ok(report.summary.codec_tokens.median >= 1);
});

await check('tokens with missing --codec exits non-zero', async () => {
  const result = runCli(['tokens', '--json'], { home: tokensHome, allowNonZero: true });
  assert.notEqual(result.status, 0);
});

await check('optimize --json recommends an alias candidate', async () => {
  const report = runCliJson([
    'optimize',
    '--codec', '{"§":1,"R":["A→B:flows"],"Δ":["A→B@t"],"μ":{"scope":"ops"}}',
    '--json',
  ], { home: tokensHome });
  assert.equal(report.kind, 'trasgo-token-optimization');
  assert.ok(report.recommended);
  assert.ok(report.recommended.id);
});

await check('advise --json returns a verdict and recommendation', async () => {
  const advice = runCliJson([
    'advise',
    '--codec', '{"§":1,"Δ":["A->B"],"μ":{"scope":"ops"}}',
    '--natural', 'Operator state transition metadata envelope',
    '--json',
  ], { home: tokensHome });
  assert.equal(advice.kind, 'trasgo-advise');
  assert.ok(advice.verdict);
  assert.ok(typeof advice.break_even_delta_tokens === 'number' || advice.break_even_delta_tokens === null);
});

// --- cot pipeline ---------------------------------------------------------

const cotHome = makeHome('cot');

await check('cot boot --json returns the boot text', async () => {
  const boot = runCliJson(['cot', 'boot', '--json'], { home: cotHome });
  assert.equal(boot.kind, 'trasgo-cot-boot');
  assert.match(boot.boot, /§CoT/);
});

await check('cot compile --json compresses natural to §CoT', async () => {
  const compiled = runCliJson([
    'cot', 'compile',
    '--natural', 'First add 7 and 5 to get 12. Therefore the answer is 12.',
    '--json',
  ], { home: cotHome });
  assert.equal(compiled.kind, 'trasgo-cot-compile');
  assert.equal(compiled.answer, '12');
  assert.match(compiled.codec, /§CoT\[/);
  assert.ok(compiled.step_count >= 1);
});

await check('cot advise --json yields verdict + token report', async () => {
  const advise = runCliJson([
    'cot', 'advise',
    '--natural', 'First add 7 and 5 to get 12. Therefore the answer is 12.',
    '--json',
  ], { home: cotHome });
  assert.equal(advise.kind, 'trasgo-cot-advise');
  assert.ok(advise.verdict);
  assert.equal(advise.answer, '12');
});

await check('cot expand --json reverses a §CoT trace', async () => {
  const expand = runCliJson([
    'cot', 'expand',
    '--codec', '§CoT[1:OBSERVE|operands:7,5 2:APPLY|add(7,5)->12 3:EMIT|answer:12]',
    '--json',
  ], { home: cotHome });
  assert.equal(expand.kind, 'trasgo-cot-expand');
  assert.match(expand.natural, /Emit final answer 12/);
});

// --- demos and machine traces --------------------------------------------

const demoHome = makeHome('demo');

await check('demo run factory-copilot --json carries economic case', async () => {
  const demo = runCliJson(['demo', 'run', 'factory-copilot', '--json'], { home: demoHome });
  assert.equal(demo.id, 'factory-copilot');
  assert.ok(demo.metrics.avoided_loss_usd >= demo.metrics.intervention_cost_usd);
  assert.ok(demo.ctx_context.battery.length >= 4);
});

await check('demo run revenue-guard --json carries recovered profit', async () => {
  const demo = runCliJson(['demo', 'run', 'revenue-guard', '--json'], { home: demoHome });
  assert.equal(demo.id, 'revenue-guard');
  assert.ok(demo.metrics.recovered_gross_profit_usd > 0);
});

let machineRunId;
await check('run factory-copilot persists a trace', async () => {
  const trace = runCliJson(['run', 'factory-copilot', '--json'], { home: demoHome });
  assert.equal(trace.kind, 'trasgo-machine-run');
  assert.equal(trace.exit_code, 0);
  assert.ok(trace.run_id);
  assert.ok(fs.existsSync(trace.trace_path));
  machineRunId = trace.run_id;
});

await check('trace list --json includes the latest run', async () => {
  const list = runCliJson(['trace', 'list', '--json'], { home: demoHome });
  assert.equal(list.kind, 'trasgo-run-list');
  assert.ok(list.runs.some(entry => entry.run_id === machineRunId));
});

await check('trace show <run-id> --json returns the full record', async () => {
  const trace = runCliJson(['trace', 'show', machineRunId, '--json'], { home: demoHome });
  assert.equal(trace.run_id, machineRunId);
  assert.ok(Array.isArray(trace.steps));
});

// --- harness layer (offline) ---------------------------------------------

const harnessHome = makeHome('harness');

await check('harness parse --text --json surfaces §1 cert and ERR', async () => {
  const payload = '{"§":1,"μ":{"cert":0.2},"ERR":{"err":"FM1: capture","cert":0.18,"flag":"VALIDATE-STEP","delta_confidence":["d",2]}}';
  const result = runCliJson(['harness', 'parse', '--text', payload, '--json'], { home: harnessHome });
  assert.equal(result.kind, 'trasgo-harness-parse');
  assert.equal(result.parsed.hasError, true);
  assert.equal(result.parsed.certDrop, 0.18);
  assert.equal(result.parsed.flag, 'VALIDATE-STEP');
});

await check('harness pattern --errors --json detects systematic FM1', async () => {
  const result = runCliJson([
    'harness', 'pattern',
    '--errors', 'FM1: capture,FM1: capture',
    '--json',
  ], { home: harnessHome });
  assert.equal(result.kind, 'trasgo-harness-pattern');
  assert.equal(result.dominantFM, 'FM1: capture');
  assert.equal(result.systematic, true);
  assert.equal(result.frequency, 2);
});

await check('harness propose FM1 --json emits an evolve packet', async () => {
  const result = runCliJson(['harness', 'propose', 'FM1', '--json'], { home: harnessHome });
  assert.equal(result.kind, 'trasgo-harness-propose');
  assert.ok(result.proposal);
  const proposal = JSON.parse(result.proposal);
  assert.equal(proposal['§1|EVOLVE'], true);
});

// --- verify (offline) -----------------------------------------------------

const verifyHome = makeHome('verify');

await check('verify --list --json enumerates formal tests', async () => {
  const list = runCliJson(['verify', '--list', '--json'], { home: verifyHome });
  assert.equal(list.kind, 'trasgo-verify-list');
  assert.ok(list.tests.length >= 5);
  for (const entry of list.tests) {
    assert.equal(entry.ok, true);
  }
});

await check('verify --dry-run --json validates input fixtures', async () => {
  const dry = runCliJson(['verify', '--dry-run', '--json'], { home: verifyHome });
  assert.equal(dry.kind, 'trasgo-verify-dry-run');
  assert.ok(dry.tests.every(entry => entry.ok));
  assert.ok(dry.tests.every(entry => Array.isArray(entry.fields) && entry.fields.length >= 2));
});

await check('verify --report --json handles missing results gracefully', async () => {
  // Use isolated repo? results.json lives under repo tests/. We just call it
  // and accept either an empty list or a populated one depending on prior runs.
  const report = runCliJson(['verify', '--report', '--json'], { home: verifyHome });
  assert.equal(report.kind, 'trasgo-verify-report');
  assert.ok(Array.isArray(report.results));
});

await check('verify with no flags returns the test list (default)', async () => {
  const list = runCliJson(['verify', '--json'], { home: verifyHome });
  assert.equal(list.kind, 'trasgo-verify-list');
});

// --- evolve (offline) -----------------------------------------------------

const evolveHome = makeHome('evolve');

await check('evolve --review --json on empty store returns empty list', async () => {
  const list = runCliJson(['evolve', '--review', '--json'], { home: evolveHome });
  assert.equal(list.kind, 'trasgo-evolve-list');
  assert.deepEqual(list.proposals, []);
});

await check('evolve --apply <missing> exits non-zero', async () => {
  const result = runCli(['evolve', '--apply', 'no-such-id', '--json'], { home: evolveHome, allowNonZero: true });
  assert.notEqual(result.status, 0);
});

await check('evolve full lifecycle: write proposal, review, apply', async () => {
  const proposalsDir = path.join(evolveHome, '.trasgo-runtime', 'proposals');
  fs.mkdirSync(proposalsDir, { recursive: true });
  const proposalId = 'proposal-v1-test.json';
  fs.writeFileSync(
    path.join(proposalsDir, proposalId),
    JSON.stringify({ '§1|EVOLVE': true, gloss: 'v1 acceptance test proposal' }, null, 2),
  );
  const list = runCliJson(['evolve', '--review', '--json'], { home: evolveHome });
  assert.ok(list.proposals.some(entry => entry.id === proposalId));
  // Need an active session for apply.
  runCliJson(['session', 'new', 'evolve-session', '--json'], { home: evolveHome });
  const applied = runCliJson(['evolve', '--apply', proposalId, '--json'], { home: evolveHome });
  assert.equal(applied.kind, 'trasgo-evolve-apply');
  assert.equal(applied.applied, proposalId);
  assert.ok(applied.evolved_axes >= 1);
});

// --- doctor + quickstart --------------------------------------------------

const doctorHome = makeHome('doctor');

await check('doctor --json reports node + python presence', async () => {
  const report = runCliJson(['doctor', '--json'], { home: doctorHome });
  assert.equal(report.kind, 'trasgo-doctor');
  assert.ok(Array.isArray(report.env));
  assert.ok(report.env.some(entry => entry.key === 'OPENAI_API_KEY'));
});

await check('quickstart --json bundles native + hello + advice', async () => {
  const quick = runCliJson(['quickstart', '--json'], { home: doctorHome });
  assert.equal(quick.kind, 'trasgo-quickstart');
  assert.ok(quick.hello);
  assert.ok(quick.advice);
  assert.ok(Array.isArray(quick.demos) && quick.demos.length >= 2);
});

// --- error handling -------------------------------------------------------

const errorHome = makeHome('errors');

await check('unknown command without active session exits non-zero', async () => {
  const result = runCli(['totally-unknown', '--json'], { home: errorHome, allowNonZero: true });
  assert.notEqual(result.status, 0);
});

await check('verify with unknown sub-flag prints usage and exits non-zero', async () => {
  const result = runCli(['verify', '--bogus', '--json'], { home: errorHome, allowNonZero: true });
  assert.notEqual(result.status, 0);
});

// --------------------------------------------------------------------------
// Summary
// --------------------------------------------------------------------------

cleanupHomes();

if (failures.length > 0) {
  process.stdout.write(`\nv1 cli suite: ${failures.length} failure(s)\n`);
  if (verbose) {
    for (const failure of failures) {
      process.stdout.write(`- ${failure.name}\n`);
    }
  }
  process.exitCode = 1;
} else {
  process.stdout.write(`\nv1 cli suite: all green (${process.argv.includes('--verbose') ? 'verbose' : 'quiet'})\n`);
}
