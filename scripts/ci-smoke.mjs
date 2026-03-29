#!/usr/bin/env node

import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '..');
const isWindows = process.platform === 'win32';

function runLauncher(args, options = {}) {
  const env = {
    ...process.env,
    TRASGO_LOGO: 'none',
  };
  const command = isWindows ? path.join(repoRoot, 'trasgo.cmd') : path.join(repoRoot, 'bin', 'trasgo');
  const launch = spawnSync(command, args, {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
    shell: isWindows,
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

function parseJsonCommand(args) {
  const result = runLauncher(args, { quiet: true });
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`expected JSON from trasgo ${args.join(' ')}\n${result.stdout}\n${error.message}`);
  }
}

function main() {
  const status = parseJsonCommand(['--native-status']);
  assert.equal(status.repo_root, repoRoot);
  assert.ok(status.native_binary, 'native binary path should be present');
  assert.ok(
    status.cargo_manifest.endsWith(path.join('rust', 'trasgo', 'Cargo.toml')),
    `unexpected cargo manifest: ${status.cargo_manifest}`,
  );

  const plainHello = runLauncher(['hello']);
  assert.match(plainHello.stdout, /Hello, Operator! Welcome to Trasgo\./u);

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

  const demos = runLauncher(['demo', 'list']);
  assert.match(demos.stdout, /factory-copilot/u);
  assert.match(demos.stdout, /revenue-guard/u);

  const scientificDemo = runLauncher(['run', 'the', 'factory', 'copilot', 'demo']);
  assert.match(scientificDemo.stdout, /CTX_CONTEXT/u);
  assert.match(scientificDemo.stdout, /Functional Gain/u);

  const factory = parseJsonCommand(['demo', 'run', 'factory-copilot', '--json']);
  assert.equal(factory.id, 'factory-copilot');
  assert.ok(factory.metrics.avoided_loss_usd > factory.metrics.intervention_cost_usd);

  const revenue = parseJsonCommand(['demo', 'run', 'revenue-guard', '--json']);
  assert.equal(revenue.id, 'revenue-guard');
  assert.ok(revenue.metrics.recovered_gross_profit_usd > 0);

  process.stdout.write(`smoke ok on ${os.platform()}\n`);
}

main();
