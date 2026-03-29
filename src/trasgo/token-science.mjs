import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '..', '..');
const cargoManifest = path.join(repoRoot, 'rust', 'trasgo', 'Cargo.toml');
const binName = process.platform === 'win32' ? 'trasgo.exe' : 'trasgo';
const cargoName = process.platform === 'win32' ? 'cargo.exe' : 'cargo';
const tokenCache = new Map();

function isExecutable(candidate) {
  try {
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return fs.existsSync(candidate);
  }
}

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

function resolveNativeBinary() {
  const candidates = [
    process.env.TRASGO_NATIVE_BIN,
    path.join(repoRoot, 'rust', 'trasgo', 'target', 'release', binName),
    path.join(repoRoot, 'rust', 'trasgo', 'target', 'debug', binName),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (isExecutable(candidate)) {
      return candidate;
    }
  }

  return null;
}

function spawnNative(args) {
  const nativeBinary = resolveNativeBinary();
  const env = { ...process.env };
  if (!env.CARGO_BUILD_JOBS && process.platform === 'win32') {
    env.CARGO_BUILD_JOBS = '1';
  }

  const nativeArgs = ['--repo-root', repoRoot, ...args];
  const command = nativeBinary || resolveCargoBinary();
  const commandArgs = nativeBinary
    ? nativeArgs
    : ['run', '--quiet', '--manifest-path', cargoManifest, '--', ...nativeArgs];

  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 1) !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
    throw new Error(`native token science failed for ${args.join(' ')}\n${output}`);
  }

  return result.stdout.trim();
}

function parseJsonReport(raw, commandName) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`expected JSON from native ${commandName}\n${raw}\n${error.message}`);
  }
}

function reportCacheKey(kind, payload) {
  return `${kind}:${JSON.stringify(payload)}`;
}

function materializeInput(tempDir, stem, value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const extension = (() => {
    try {
      JSON.parse(text);
      return '.json';
    } catch {
      return '.txt';
    }
  })();
  const target = path.join(tempDir, `${stem}${extension}`);
  fs.writeFileSync(target, text, 'utf8');
  return target;
}

export function runTokenReport({ codec, natural = null, models = 'all' }) {
  const cacheKey = reportCacheKey('tokens', { codec, natural, models });
  if (tokenCache.has(cacheKey)) {
    return tokenCache.get(cacheKey);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trasgo-token-'));
  const report = (() => {
    try {
      const codecArg = materializeInput(tempDir, 'codec', codec);
      const args = ['tokens', '--codec', codecArg, '--models', models, '--json'];
      if (natural !== null && natural !== undefined) {
        const naturalArg = materializeInput(tempDir, 'natural', natural);
        args.push('--natural', naturalArg);
      }
      return parseJsonReport(spawnNative(args), 'tokens');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  })();
  tokenCache.set(cacheKey, report);
  return report;
}

export function runOptimizeReport({ codec, models = 'all' }) {
  const cacheKey = reportCacheKey('optimize', { codec, models });
  if (tokenCache.has(cacheKey)) {
    return tokenCache.get(cacheKey);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trasgo-opt-'));
  const report = (() => {
    try {
      const codecArg = materializeInput(tempDir, 'codec', codec);
      return parseJsonReport(
        spawnNative(['optimize', '--codec', codecArg, '--models', models, '--json']),
        'optimize',
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  })();
  tokenCache.set(cacheKey, report);
  return report;
}

export function buildScientificContext(report) {
  const codecTokens = report.models.map(entry => entry.codec_tokens);
  const naturalTokens = report.models
    .map(entry => entry.natural_tokens)
    .filter(value => typeof value === 'number');
  const compression = report.models
    .map(entry => entry.compression_ratio)
    .filter(value => typeof value === 'number');

  const best = report.models.find(entry => entry.id === report.summary.best_codec_family) || report.models[0];
  const worst = report.models.find(entry => entry.id === report.summary.worst_codec_family) || report.models[report.models.length - 1];

  return {
    natural_context_tokens: report.summary.natural_tokens ? Math.round(report.summary.natural_tokens.median) : null,
    codec_context_tokens: Math.round(report.summary.codec_tokens.median),
    compression_ratio: report.summary.compression_ratio ? report.summary.compression_ratio.median : null,
    window_4k_share: average(report.models.map(entry => entry.window_occupancy.codec['4k'] || 0)),
    window_32k_share: average(report.models.map(entry => entry.window_occupancy.codec['32k'] || 0)),
    window_128k_share: average(report.models.map(entry => entry.window_occupancy.codec['128k'] || 0)),
    exact_method: 'Exact tokenizer battery across openai-o200k, openai-cl100k, llama3, gemma, deepseek, glm.',
    family_spread: {
      codec_tokens: { min: Math.min(...codecTokens), max: Math.max(...codecTokens) },
      natural_tokens: naturalTokens.length ? { min: Math.min(...naturalTokens), max: Math.max(...naturalTokens) } : null,
      compression_ratio: compression.length ? { min: round(Math.min(...compression), 2), max: round(Math.max(...compression), 2) } : null,
    },
    best_family: best?.id || null,
    worst_family: worst?.id || null,
    effective_context_note: best?.effective_context_note || null,
    battery: report.models.map(entry => ({
      id: entry.id,
      family: entry.family,
      codec_tokens: entry.codec_tokens,
      natural_tokens: entry.natural_tokens,
      compression_ratio: entry.compression_ratio,
      window_4k_share: entry.window_occupancy.codec['4k'],
      window_32k_share: entry.window_occupancy.codec['32k'],
      window_128k_share: entry.window_occupancy.codec['128k'],
    })),
  };
}

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
