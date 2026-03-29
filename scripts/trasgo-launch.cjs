#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const nodeCli = path.join(repoRoot, 'src', 'trasgo', 'cli.mjs');
const binName = process.platform === 'win32' ? 'trasgo.exe' : 'trasgo';
const cargoName = process.platform === 'win32' ? 'cargo.exe' : 'cargo';
const nativeCommands = new Set([
  'hello', 'ask', 'load', 'explain', 'route', 'prove', 'passthrough',
  '--version', '-V',
]);

function resolveCargoBinary() {
  if (process.env.TRASGO_CARGO) {
    return process.env.TRASGO_CARGO;
  }

  if (process.platform === 'win32') {
    const candidate = path.join(process.env.USERPROFILE || '', '.cargo', 'bin', cargoName);
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return cargoName;
}

function isExecutable(candidate) {
  try {
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return fs.existsSync(candidate);
  }
}

function normalizeCandidate(candidate) {
  if (!candidate) return null;
  return path.isAbsolute(candidate) ? candidate : path.resolve(repoRoot, candidate);
}

function candidateBinaryDirs() {
  return [
    process.env.TRASGO_NATIVE_DIR,
    path.join(repoRoot, 'target', 'release'),
    path.join(repoRoot, 'target', 'debug'),
    path.join(repoRoot, 'native', 'target', 'release'),
    path.join(repoRoot, 'native', 'target', 'debug'),
    path.join(repoRoot, 'rust', 'target', 'release'),
    path.join(repoRoot, 'rust', 'target', 'debug'),
    path.join(repoRoot, 'rust', 'trasgo', 'target', 'release'),
    path.join(repoRoot, 'rust', 'trasgo', 'target', 'debug'),
    path.join(repoRoot, 'crates', 'trasgo', 'target', 'release'),
    path.join(repoRoot, 'crates', 'trasgo', 'target', 'debug'),
  ].filter(Boolean);
}

function candidateManifests() {
  return [
    process.env.TRASGO_CARGO_MANIFEST,
    path.join(repoRoot, 'Cargo.toml'),
    path.join(repoRoot, 'native', 'Cargo.toml'),
    path.join(repoRoot, 'rust', 'Cargo.toml'),
    path.join(repoRoot, 'rust', 'trasgo', 'Cargo.toml'),
    path.join(repoRoot, 'crates', 'trasgo', 'Cargo.toml'),
  ].filter(Boolean);
}

function resolveNativeBinary() {
  const envBinary = normalizeCandidate(process.env.TRASGO_NATIVE_BIN);
  if (envBinary && isExecutable(envBinary)) {
    return envBinary;
  }

  for (const dir of candidateBinaryDirs()) {
    const candidate = path.join(dir, binName);
    if (isExecutable(candidate)) {
      return candidate;
    }
  }

  return null;
}

function cargoTargetBinary(manifestPath) {
  const manifestDir = path.dirname(manifestPath);
  const targetDir = process.env.CARGO_TARGET_DIR
    ? normalizeCandidate(process.env.CARGO_TARGET_DIR)
    : path.join(manifestDir, 'target');
  const release = path.join(targetDir, 'release', binName);
  const debug = path.join(targetDir, 'debug', binName);

  if (isExecutable(release)) return release;
  if (isExecutable(debug)) return debug;
  return release;
}

function buildNative(manifestPath) {
  const cargo = resolveCargoBinary();
  const args = ['build', '--release'];
  const extraEnv = { ...process.env };

  if (process.env.TRASGO_CARGO_LOCKED === '1') {
    args.push('--locked');
  }

  if (process.env.TRASGO_CARGO_JOBS) {
    args.push('-j', process.env.TRASGO_CARGO_JOBS);
  } else if (!process.env.CARGO_BUILD_JOBS && process.platform === 'win32') {
    // Keep proc-macro compilation under Windows paging limits by default.
    extraEnv.CARGO_BUILD_JOBS = '1';
  }

  if (manifestPath) {
    args.push('--manifest-path', manifestPath);
  }

  const cwd = manifestPath ? path.dirname(manifestPath) : repoRoot;
  const result = spawnSync(cargo, args, {
    cwd,
    env: extraEnv,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function launch(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    return { ok: false, error: result.error };
  }

  return { ok: true, status: result.status ?? 0 };
}

function printNativeStatus() {
  const manifest = candidateManifests().find(file => fs.existsSync(file)) || null;
  const binary = resolveNativeBinary();

  console.log(JSON.stringify({
    repo_root: repoRoot,
    native_binary: binary,
    cargo_manifest: manifest,
    node_fallback: nodeCli,
  }, null, 2));
}

function commandAfterGlobals(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--session' || arg === '--logo' || arg === '--backend' || arg === '--repo-root') {
      i += 1;
      continue;
    }
    if (arg === '--json') {
      continue;
    }
    return arg;
  }
  return null;
}

function shouldUseNative(argv) {
  const command = commandAfterGlobals(argv);
  if (!command) {
    return false;
  }
  return nativeCommands.has(command);
}

function main() {
  const argv = process.argv.slice(2);
  const buildRequested = argv.includes('--build-native');
  const statusRequested = argv.includes('--native-status');
  const forwarded = argv.filter(arg => arg !== '--build-native' && arg !== '--native-status');

  if (statusRequested) {
    printNativeStatus();
    return 0;
  }

  if (buildRequested) {
    const manifest = candidateManifests().find(file => fs.existsSync(file));
    if (!manifest) {
      console.error('no Cargo.toml found for native build');
      return 1;
    }

    buildNative(manifest);
    if (forwarded.length === 0) {
      return 0;
    }
  }

  const nativeBinary = resolveNativeBinary();
  if (nativeBinary && shouldUseNative(forwarded)) {
    const nativeRun = launch(nativeBinary, forwarded);
    if (nativeRun.ok) {
      return nativeRun.status;
    }
  }

  const nodeRun = launch(process.execPath, [nodeCli, ...forwarded]);
  if (!nodeRun.ok) {
    console.error(nodeRun.error.message);
    return 1;
  }
  return nodeRun.status;
}

process.exitCode = main();
