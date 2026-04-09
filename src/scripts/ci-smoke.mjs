#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '..', '..');
const isWindows = process.platform === 'win32';
const packageVersion = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version;

function quoteWindowsArg(arg) {
  if (arg.length === 0) return '""';
  if (!/[\s"]/u.test(arg)) return arg;
  return `"${arg
    .replace(/(\\*)"/gu, '$1$1\\"')
    .replace(/(\\+)$/u, '$1$1')}"`;
}

function runLauncher(args, options = {}) {
  const env = {
    ...process.env,
    TRASGO_LOGO: 'none',
  };
  const launcherScript = path.join(repoRoot, 'src', 'scripts', 'trasgo-launch.cjs');
  const launch = spawnSync(process.execPath, [launcherScript, ...args], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
    shell: false,
  });

  if (launch.error) {
    throw launch.error;
  }

  if ((launch.status ?? 1) !== 0) {
    const output = [launch.stdout, launch.stderr].filter(Boolean).join('\n');
    throw new Error(`launcher failed for ${args.join(' ')}\n${output}`);
  }

  if (!options.quiet) {
    process.stdout.write(`ok: trasgo ${args.join(' ')}\n`);
  }

  return {
    stdout: launch.stdout.trim(),
    stderr: launch.stderr.trim(),
  };
}

function hasChafa() {
  const probe = spawnSync(process.platform === 'win32' ? 'Chafa.exe' : 'chafa', ['--version'], {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
    shell: false,
  });
  return !probe.error && (probe.status ?? 1) === 0;
}

function parseJsonCommand(args) {
  const result = runLauncher(args, { quiet: true });
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`expected JSON from trasgo ${args.join(' ')}\n${result.stdout}\n${error.message}`);
  }
}

async function withHttpBridge(test) {
  const port = await reservePort();
  const env = {
    ...process.env,
    TRASGO_LOGO: 'none',
    TRASGO_HTTP_PORT: String(port),
  };
  const launcherScript = path.join(repoRoot, 'src', 'scripts', 'trasgo-launch.cjs');
  const child = spawn(process.execPath, [launcherScript, 'serve', '--http', '--port', String(port)], {
    cwd: repoRoot,
    env,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', chunk => {
    stderr += chunk.toString();
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`http bridge did not become ready\n${stdout}\n${stderr}`));
    }, 10000);

    child.stdout.on('data', chunk => {
      const text = chunk.toString();
      if (text.includes('"type":"http-ready"')) {
        clearTimeout(timeout);
        resolve();
      }
    });

    child.once('error', error => {
      clearTimeout(timeout);
      reject(error);
    });

    child.once('exit', code => {
      clearTimeout(timeout);
      reject(new Error(`http bridge exited early with code ${code}\n${stdout}\n${stderr}`));
    });
  });

  try {
    await test(port);
  } finally {
    await stopChildProcess(child);
  }
}

async function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close(error => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function stopChildProcess(child) {
  if (child.exitCode !== null) {
    return;
  }

  child.kill('SIGTERM');

  const exited = await new Promise(resolve => {
    const timeout = setTimeout(() => resolve(false), 3000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve(true);
    });
  });

  if (!exited && isWindows && child.pid) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      shell: false,
    });
  }
}

async function main() {
  runLauncher(['--build-native'], { quiet: true });

  const status = parseJsonCommand(['--native-status']);
  assert.equal(status.repo_root, repoRoot);
  assert.ok(status.native_binary, 'native binary path should be present');
  assert.ok(
    status.cargo_manifest.endsWith(path.join('rust', 'trasgo', 'Cargo.toml')),
    `unexpected cargo manifest: ${status.cargo_manifest}`,
  );

  const plainHello = runLauncher(['hello']);
  assert.match(plainHello.stdout, /Hello, Operator! Welcome to Trasgo\./u);

  if (hasChafa()) {
    const imageHelp = runLauncher(['help', '--logo', 'image'], { quiet: true });
    assert.match(imageHelp.stdout, /Natural Language/u);
  }

  const naturalRuntimes = runLauncher(['show', 'me', 'the', 'runtimes']);
  assert.match(naturalRuntimes.stdout, /Runtimes/u);

  const hello = parseJsonCommand(['hello', '--json']);
  const sessionId = hello.session?.id;
  assert.ok(sessionId, 'hello should create a session id');
  assert.equal(hello.output, 'Hello, Operator! Welcome to Trasgo.');

  const routeBefore = parseJsonCommand(['--session', sessionId, 'route', 'show', '--json']);
  assert.ok(routeBefore.decision?.selected?.length, 'route show should select a runtime');

  const routeSet = parseJsonCommand([
    '--session',
    sessionId,
    'route',
    'set',
    '--targets',
    'medgemma',
    '--mode',
    'single',
    '--require-local',
    '--deny-cloud',
    '--json',
  ]);
  assert.equal(routeSet.contract.constraints.require_local, true);
  assert.equal(routeSet.contract.constraints.allow_cloud, false);
  assert.deepEqual(routeSet.contract.targets, ['medgemma']);

  const routeAfter = parseJsonCommand(['--session', sessionId, 'route', 'show', '--json']);
  assert.equal(routeAfter.decision.selected[0].runtime, 'medgemma');

  const ask = parseJsonCommand(['--session', sessionId, 'ask', 'what', 'is', 'trasgo', '--json']);
  assert.equal(ask.prompt, 'what is trasgo');
  assert.equal(ask.route.selected[0].runtime, 'medgemma');

  const load = parseJsonCommand(['--session', sessionId, 'load', 'runtime-registry', '--json']);
  assert.equal(load.session.id, sessionId);

  const prove = parseJsonCommand(['--session', sessionId, 'prove', '--json']);
  const packPath = prove.session?.workflow?.last_pack_path;
  assert.ok(packPath, 'prove should record a pack path');
  assert.equal(prove.route.selected[0].runtime, 'medgemma');

  const explain = parseJsonCommand(['explain', packPath, '--json']);
  assert.equal(explain.summary, 'Trasgo pack bundle');
  assert.equal(explain.skills, 3);
  assert.equal(explain.mcp, 2);

  const tokenReport = parseJsonCommand([
    'tokens',
    '--codec',
    '{"§":1,"Δ":["A->B"],"μ":{"scope":"ops"}}',
    '--natural',
    'Operator_state_transition_metadata_envelope',
  ]);
  assert.equal(tokenReport.kind, 'trasgo-token-report');
  assert.equal(tokenReport.models.length, 6);
  assert.equal(tokenReport.summary.best_codec_family.length > 0, true);

  const optimize = parseJsonCommand([
    'optimize',
    '--codec',
    '{"§":1,"R":["A→B:flows"],"Δ":["A→B@t"],"μ":{"scope":"ops"}}',
  ]);
  assert.equal(optimize.kind, 'trasgo-token-optimization');
  assert.ok(optimize.recommended?.id, 'optimize should recommend a candidate');

  const quickstart = parseJsonCommand(['quickstart', '--json']);
  assert.equal(quickstart.kind, 'trasgo-quickstart');
  assert.ok(Array.isArray(quickstart.demos) && quickstart.demos.length >= 2);

  const explainBalance = parseJsonCommand(['--session', sessionId, 'explain', 'balance', '--json']);
  assert.equal(explainBalance.kind, 'trasgo-explain-balance');

  const explainRoute = parseJsonCommand(['--session', sessionId, 'explain', 'route', '--json']);
  assert.equal(explainRoute.kind, 'trasgo-explain-route');

  const init = parseJsonCommand(['init', 'smoke-test-session', '--json']);
  assert.equal(init.title, 'smoke-test-session');
  assert.ok(init.id, 'init should create a session id');

  const pack = parseJsonCommand(['--session', init.id, 'pack', '--json']);
  assert.equal(pack.session.id, init.id);
  assert.ok(pack.pack_path, 'pack should record a pack path');

  const boot = parseJsonCommand(['--session', init.id, 'boot', '--from', pack.pack_path, '--json']);
  assert.equal(boot.session.id, init.id);
  assert.equal(boot.session.boot.status, 'booted');
  assert.equal(boot.session.boot.active_pack, pack.pack_path);

  const verifyReport = parseJsonCommand(['verify', '--report', '--json']);
  assert.equal(verifyReport.kind, 'trasgo-verify-report');
  assert.ok(Array.isArray(verifyReport.results) && verifyReport.results.length >= 5);

  const verifyTc = parseJsonCommand(['verify', '--tc', '--dry-run', '--json']);
  assert.equal(verifyTc.kind, 'trasgo-verify-run');
  assert.equal(verifyTc.results[0].testId, 'v6-tc-factorial');
  
  // Restore all verify results for subsequent test runs
  parseJsonCommand(['verify', '--all', '--dry-run', '--json']);

  const evolveReview = parseJsonCommand(['evolve', '--review', '--json']);
  assert.equal(evolveReview.kind, 'trasgo-evolve-list');

  const advice = parseJsonCommand([
    'advise',
    '--codec',
    '{"§":1,"Δ":["A->B"],"μ":{"scope":"ops"}}',
    '--natural',
    'Operator state transition metadata envelope',
    '--json',
  ]);
  assert.equal(advice.kind, 'trasgo-advise');
  assert.ok(typeof advice.verdict === 'string' && advice.verdict.length > 0);

  const cotCompile = parseJsonCommand([
    'cot',
    'compile',
    '--natural',
    'First add 7 and 5 to get 12. Therefore the answer is 12.',
    '--json',
  ]);
  assert.equal(cotCompile.kind, 'trasgo-cot-compile');
  assert.match(cotCompile.codec, /§CoT\[/u);
  assert.equal(cotCompile.answer, '12');

  const cotDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trasgo-cot-'));
  const cotPath = path.join(cotDir, 'trace.txt');
  fs.writeFileSync(cotPath, '§CoT[1:OBSERVE|operands:7,5 2:APPLY|add(7,5)->12 3:EMIT|answer:12]', 'utf8');
  const cotExpand = parseJsonCommand([
    'cot',
    'expand',
    '--codec',
    cotPath,
    '--json',
  ]);
  assert.equal(cotExpand.kind, 'trasgo-cot-expand');
  assert.match(cotExpand.natural, /final answer 12/u);

  const demos = runLauncher(['demo', 'list']);
  assert.match(demos.stdout, /factory-copilot/u);
  assert.match(demos.stdout, /revenue-guard/u);

  const machineRun = parseJsonCommand(['run', 'factory-copilot', '--json']);
  assert.equal(machineRun.kind, 'trasgo-machine-run');
  assert.ok(machineRun.run_id, 'machine runs should persist a run id');

  const traceList = parseJsonCommand(['trace', 'list', '--json']);
  assert.equal(traceList.kind, 'trasgo-run-list');
  assert.ok(traceList.runs.some(entry => entry.run_id === machineRun.run_id));

  const traceShow = parseJsonCommand(['trace', 'show', machineRun.run_id, '--json']);
  assert.equal(traceShow.run_id, machineRun.run_id);

  const scientificDemo = runLauncher(['run', 'the', 'factory', 'copilot', 'demo']);
  assert.match(scientificDemo.stdout, /CTX_CONTEXT/u);
  assert.match(scientificDemo.stdout, /Tokenizer Battery/u);
  assert.match(scientificDemo.stdout, /Functional Gain/u);

  const factory = parseJsonCommand(['demo', 'run', 'factory-copilot', '--json']);
  assert.equal(factory.id, 'factory-copilot');
  assert.ok(factory.metrics.avoided_loss_usd > factory.metrics.intervention_cost_usd);
  assert.match(factory.ctx_context.exact_method, /Exact tokenizer battery/u);
  assert.ok(factory.ctx_context.battery.length >= 6);

  const revenue = parseJsonCommand(['demo', 'run', 'revenue-guard', '--json']);
  assert.equal(revenue.id, 'revenue-guard');
  assert.ok(revenue.metrics.recovered_gross_profit_usd > 0);
  assert.match(revenue.ctx_context.exact_method, /Exact tokenizer battery/u);

  await withHttpBridge(async port => {
    const baseUrl = `http://127.0.0.1:${port}`;

    const statusResponse = await fetch(`${baseUrl}/status`);
    const statusPayload = await statusResponse.json();
    assert.equal(statusPayload.kind, 'trasgo-status');

    const versionResponse = await fetch(`${baseUrl}/version`);
    const versionPayload = await versionResponse.json();
    assert.equal(versionPayload.kind, 'trasgo-version');
    assert.equal(versionPayload.version, packageVersion);

    const demosResponse = await fetch(`${baseUrl}/demos`);
    const demosPayload = await demosResponse.json();
    assert.ok(Array.isArray(demosPayload.demos) && demosPayload.demos.length >= 2);

    const machineResponse = await fetch(`${baseUrl}/machine/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'factory-copilot' }),
    });
    const machinePayload = await machineResponse.json();
    assert.equal(machinePayload.ok, true);
    assert.equal(machinePayload.trace.machine.id, 'factory-copilot');

    const adviseResponse = await fetch(`${baseUrl}/advise`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        codec: '{"§":1,"Δ":["A->B"],"μ":{"scope":"ops"}}',
        natural: 'Operator state transition metadata envelope',
      }),
    });
    const advisePayload = await adviseResponse.json();
    assert.equal(advisePayload.kind, 'trasgo-advise');
  });

  process.stdout.write(`smoke ok on ${os.platform()}\n`);
}

await main();
