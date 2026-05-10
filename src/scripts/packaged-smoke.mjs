#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '..', '..');
const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';

function quoteWindowsArg(arg) {
  if (arg.length === 0) return '""';
  if (!/[\s"]/u.test(arg)) return arg;
  return `"${arg
    .replace(/(\\*)"/gu, '$1$1\\"')
    .replace(/(\\+)$/u, '$1$1')}"`;
}

function run(command, args, options = {}) {
  const effectiveCommand = isWindows && command === 'npm' ? 'npm.cmd' : command;
  const cwd = options.cwd || repoRoot;
  const result = isWindows && String(effectiveCommand).toLowerCase().endsWith('.cmd')
    ? spawnSync(effectiveCommand, args, {
      cwd,
      env: options.env || process.env,
      encoding: 'utf8',
      shell: true,
    })
    : spawnSync(effectiveCommand, args, {
      cwd,
      env: options.env || process.env,
      encoding: 'utf8',
      shell: options.shell ?? false,
    });

  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) {
    throw new Error(`${effectiveCommand} ${args.join(' ')} failed\n${result.stdout || ''}\n${result.stderr || ''}`);
  }
  return result.stdout.trim();
}

function runInstalled(launcherPath, args, cwd, env) {
  return run(process.execPath, [launcherPath, ...args], { cwd, env, shell: false });
}

function main() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'trasgo-packaged-smoke-'));
  const prefixDir = path.join(sandbox, 'prefix');
  const workspaceDir = path.join(sandbox, 'workspace');
  fs.mkdirSync(prefixDir, { recursive: true });
  fs.mkdirSync(workspaceDir, { recursive: true });

  let tarballPath;
  let packedTarballPath;
  try {
    const packJson = run(npmCommand, ['pack', '--json'], { cwd: repoRoot });
    const [packInfo] = JSON.parse(packJson);
    packedTarballPath = path.join(repoRoot, packInfo.filename);
    tarballPath = path.join(sandbox, packInfo.filename);
    fs.copyFileSync(packedTarballPath, tarballPath);

    run(npmCommand, ['install', '-g', '--prefix', prefixDir, tarballPath], { cwd: repoRoot });

    const binPath = isWindows
      ? path.join(prefixDir, 'trasgo.cmd')
      : path.join(prefixDir, 'bin', 'trasgo');
    assert.ok(fs.existsSync(binPath), `installed launcher missing: ${binPath}`);
    const launcherPath = path.join(prefixDir, 'node_modules', 'trasgo', 'src', 'scripts', 'trasgo-launch.cjs');
    assert.ok(fs.existsSync(launcherPath), `installed Node launcher missing: ${launcherPath}`);

    if (isWindows) {
      const psShim = path.join(prefixDir, 'trasgo.ps1');
      assert.ok(fs.existsSync(psShim), 'PowerShell shim should exist on Windows');
      const shimText = fs.readFileSync(psShim, 'utf8');
      assert.ok(!/sh\.exe/i.test(shimText), 'PowerShell shim must not reference sh.exe');
    }

    const env = {
      ...process.env,
      TRASGO_LOGO: 'none',
    };

    const help = run(binPath, ['--help'], { cwd: workspaceDir, env, shell: false });
    assert.match(help, /trasgo quickstart/i);

    const status = JSON.parse(runInstalled(launcherPath, ['status', '--json'], workspaceDir, env));
    assert.equal(status.kind, 'trasgo-status');
    assert.equal(path.resolve(status.state_dir), path.resolve(workspaceDir));

    const init = JSON.parse(runInstalled(launcherPath, ['init', 'packaged smoke', '--json'], workspaceDir, env));
    assert.equal(init.title, 'packaged smoke');

    const pack = JSON.parse(runInstalled(launcherPath, ['pack', '--out', '.trasgo-runtime/packs/packaged-smoke.json', '--json'], workspaceDir, env));
    assert.ok(pack.pack_path.includes(path.join('.trasgo-runtime', 'packs', 'packaged-smoke.json')));
    assert.ok(path.resolve(pack.pack_path).startsWith(path.resolve(workspaceDir)));

    const boot = JSON.parse(runInstalled(launcherPath, ['boot', '--from', '.trasgo-runtime/packs/packaged-smoke.json', '--json'], workspaceDir, env));
    assert.equal(boot.session.boot.status, 'booted');
    assert.ok(path.resolve(boot.pack_path).startsWith(path.resolve(workspaceDir)));

    const skills = JSON.parse(runInstalled(launcherPath, ['skills', '--json'], workspaceDir, env));
    assert.equal(skills.kind, 'trasgo-skill-list');
    assert.ok(skills.skills.length >= 1);

    const cot = JSON.parse(runInstalled(launcherPath, ['cot', 'advise', '--natural', 'First add 7 and 5 to get 12. Therefore the answer is 12.', '--json'], workspaceDir, env));
    assert.equal(cot.kind, 'trasgo-cot-advise');
    assert.equal(cot.answer, '12');

    // Verify dashboard (doesn't support --json but should run without error)
    const dashboard = runInstalled(launcherPath, ['dashboard'], workspaceDir, env);
    assert.match(dashboard, /§1 Codec Observatory/i);

    process.stdout.write('packaged smoke ok\n');
  } finally {
    if (packedTarballPath && fs.existsSync(packedTarballPath)) {
      fs.rmSync(packedTarballPath, { force: true });
    }
    if (tarballPath && fs.existsSync(tarballPath)) {
      fs.rmSync(tarballPath, { force: true });
    }
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

main();
