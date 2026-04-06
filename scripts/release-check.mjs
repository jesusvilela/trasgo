#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '..');
const pkgPath = path.join(repoRoot, 'package.json');
const readmePath = path.join(repoRoot, 'README.md');
const docsIndexPath = path.join(repoRoot, 'docs', 'index.html');

function main() {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const readme = fs.readFileSync(readmePath, 'utf8');
  const docsIndex = fs.readFileSync(docsIndexPath, 'utf8');

  assert.equal(pkg.name, '@trasgo/trasgo', 'package name must be @trasgo/trasgo');
  assert.equal(pkg.license, 'MIT', 'license must be MIT');
  assert.equal(pkg.bin?.trasgo, 'bin/trasgo', 'bin.trasgo must point to bin/trasgo');
  assert.equal(pkg.publishConfig?.access, 'public', 'publishConfig.access must be public');
  assert.match(pkg.homepage || '', /jesusvilela\.github\.io\/trasgo/i, 'homepage must target GitHub Pages');
  assert.ok(Array.isArray(pkg.files) && pkg.files.length > 0, 'files whitelist must be present');

  const requiredMedia = [
    'assets/trasgo-s1-codec-demo.gif',
    'assets/trasgo-live-demo.gif',
    'assets/trasgo.png',
    'docs/index.html',
  ];

  for (const relativePath of requiredMedia) {
    const absolutePath = path.join(repoRoot, relativePath);
    assert.ok(fs.existsSync(absolutePath), `missing required release asset: ${relativePath}`);
  }

  assert.match(readme, /<img src="assets\/trasgo-s1-codec-demo\.gif"/u, 'README must embed codec demo GIF');
  assert.match(readme, /<img src="assets\/trasgo-live-demo\.gif"/u, 'README must embed runtime demo GIF');
  assert.match(docsIndex, /assets\/trasgo-s1-codec-demo\.gif/u, 'docs/index.html must embed codec demo GIF');
  assert.match(docsIndex, /assets\/trasgo-live-demo\.gif/u, 'docs/index.html must embed runtime demo GIF');

  const packed = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  }));
  const packInfo = packed[0];
  const filePaths = new Set(packInfo.files.map(entry => entry.path));

  const forbiddenPatterns = [
    /(^|\/)\.omx\//u,
    /(^|\/)node_modules\//u,
    /(^|\/)target\//u,
    /__pycache__/u,
    /^mobile\/trasgo-mobile\/android\//u,
    /^tests\/bench_.*\.json$/u,
    /^tests\/research_results.*\.json$/u,
    /^tests\/research_report\.html$/u,
    /^tests\/demo\.html$/u,
    /^tests\/live-demo\.html$/u,
  ];

  for (const filePath of filePaths) {
    for (const pattern of forbiddenPatterns) {
      assert.ok(!pattern.test(filePath), `forbidden packaged path detected: ${filePath}`);
    }
  }

  assert.ok(packInfo.size <= 25_000_000, `packed tarball too large: ${packInfo.size}`);
  assert.ok(packInfo.unpackedSize <= 80_000_000, `unpacked size too large: ${packInfo.unpackedSize}`);

  const summary = {
    kind: 'trasgo-release-check',
    package: `${packInfo.name}@${packInfo.version}`,
    tarball: packInfo.filename,
    packed_bytes: packInfo.size,
    unpacked_bytes: packInfo.unpackedSize,
    entries: packInfo.entryCount,
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main();
