#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '..', '..');
const pkgPath = path.join(repoRoot, 'package.json');
const packageLockPath = path.join(repoRoot, 'package-lock.json');
const cargoTomlPath = path.join(repoRoot, 'rust', 'trasgo', 'Cargo.toml');
const readmePath = path.join(repoRoot, 'README.md');
const docsIndexPath = path.join(repoRoot, 'docs', 'index.html');


function readCargoVersion() {
  const cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
  const match = cargoToml.match(/^version\s*=\s*"([^"]+)"/mu);
  assert.ok(match, 'Cargo.toml must declare a version');
  return match[1];
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
  const readme = fs.readFileSync(readmePath, 'utf8');
  const docsIndex = fs.readFileSync(docsIndexPath, 'utf8');
  const cargoVersion = readCargoVersion();

  assert.equal(pkg.name, 'trasgo', 'package name must be trasgo');
  assert.equal(pkg.license, 'MIT', 'license must be MIT');
  assert.equal(pkg.version, cargoVersion, 'package.json version must match rust/trasgo/Cargo.toml');
  assert.equal(packageLock.version, pkg.version, 'package-lock version must match package.json');
  assert.equal(packageLock.packages?.['']?.version, pkg.version, 'root package-lock entry must match package.json');
  assert.equal(pkg.bin?.trasgo, 'src/scripts/trasgo-launch.cjs', 'bin.trasgo must point to src/scripts/trasgo-launch.cjs');
  assert.equal(packageLock.packages?.['']?.bin?.trasgo, 'src/scripts/trasgo-launch.cjs', 'package-lock bin.trasgo must match src/scripts/trasgo-launch.cjs');
  assert.equal(pkg.publishConfig?.access, 'public', 'publishConfig.access must be public');
  assert.match(pkg.homepage || '', /jesusvilela\.github\.io\/trasgo/i, 'homepage must target the GitHub pages site');
  assert.ok(Array.isArray(pkg.files) && pkg.files.length > 0, 'files whitelist must be present');

  const requiredMedia = [
    'assets/trasgo-s1-codec-demo.gif',
    'assets/trasgo-live-demo.gif',
    'docs/index.html',
    'src/scripts/trasgo-launch.cjs',
  ];

  for (const relativePath of requiredMedia) {
    const absolutePath = path.join(repoRoot, relativePath);
    assert.ok(fs.existsSync(absolutePath), `missing required release asset: ${relativePath}`);
  }

  assert.match(readme, /<img src="https:\/\/raw\.githubusercontent\.com\/jesusvilela\/trasgo\/main\/assets\/trasgo-s1-codec-demo\.gif"/u, 'README must embed codec demo GIF');
  assert.match(readme, /<img src="https:\/\/raw\.githubusercontent\.com\/jesusvilela\/trasgo\/main\/assets\/trasgo-live-demo\.gif"/u, 'README must embed runtime demo GIF');
  assert.match(docsIndex, /(assets|raw\.githubusercontent\.com\/jesusvilela\/trasgo\/main\/assets)\/trasgo-s1-codec-demo\.gif/u, 'docs/index.html must embed codec demo GIF');
  assert.match(docsIndex, /(assets|raw\.githubusercontent\.com\/jesusvilela\/trasgo\/main\/assets)\/trasgo-live-demo\.gif/u, 'docs/index.html must embed runtime demo GIF');

  const refName = process.env.GITHUB_REF_NAME || '';
  const refType = process.env.GITHUB_REF_TYPE || '';
  if (refName.startsWith('v') && (refType === 'tag' || refType === '')) {
    assert.equal(refName.slice(1), pkg.version, 'release tag must match package version');
  }

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
