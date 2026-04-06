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
const TOKEN_FAMILIES = [
  { id: 'openai-o200k', family: 'OpenAI O200k', tokenizer: 'gpt-4o', backend: 'heuristic-fallback', charsPerToken: 3.55 },
  { id: 'openai-cl100k', family: 'OpenAI CL100k', tokenizer: 'gpt-4', backend: 'heuristic-fallback', charsPerToken: 3.7 },
  { id: 'llama3', family: 'Llama 3', tokenizer: 'Meta-Llama-3', backend: 'heuristic-fallback', charsPerToken: 3.85 },
  { id: 'gemma', family: 'Gemma', tokenizer: 'Gemma 2', backend: 'heuristic-fallback', charsPerToken: 3.5 },
  { id: 'deepseek', family: 'DeepSeek', tokenizer: 'DeepSeek-V3', backend: 'heuristic-fallback', charsPerToken: 3.3 },
  { id: 'glm', family: 'GLM', tokenizer: 'GLM HF tokenizer', backend: 'heuristic-fallback', charsPerToken: 3.8 },
];

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
  const allowCargoRun = env.TRASGO_ALLOW_CARGO_RUN === '1' || fs.existsSync(path.join(repoRoot, '.git'));
  if (!nativeBinary && !allowCargoRun) {
    throw new Error('native token science binary not prebuilt; falling back');
  }

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

function median(values) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const mid = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[mid - 1] + ordered[mid]) / 2
    : ordered[mid];
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function describeInput(label, value) {
  if (value === null || value === undefined) {
    return null;
  }
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const source_kind = typeof value === 'string' && fs.existsSync(value) ? 'file' : 'inline';
  const content_kind = (() => {
    try {
      JSON.parse(text);
      return 'json';
    } catch {
      return 'text';
    }
  })();
  return {
    bytes: Buffer.byteLength(text, 'utf8'),
    chars: text.length,
    content_kind,
    label,
    source_kind,
  };
}

function selectedFamilies(models) {
  if (!models || models === 'all') {
    return TOKEN_FAMILIES;
  }
  const requested = new Set(String(models).split(',').map(item => item.trim()).filter(Boolean));
  const filtered = TOKEN_FAMILIES.filter(entry => requested.has(entry.id));
  return filtered.length ? filtered : TOKEN_FAMILIES;
}

function estimateTokens(text, family) {
  const punctuation = (text.match(/[{}\[\]":,]/gu) || []).length;
  const operators = (text.match(/[→§Δμ]/gu) || []).length;
  const words = (text.match(/[\p{L}\p{N}_-]+/gu) || []).length;
  const newlines = (text.match(/\n/gu) || []).length;
  const estimated = Math.ceil(
    text.length / family.charsPerToken
      + punctuation * 0.18
      + operators * 0.45
      + words * 0.03
      + newlines * 0.12,
  );
  return Math.max(1, estimated);
}

function occupancy(tokens) {
  return {
    '4k': round(tokens / 4096, 4),
    '32k': round(tokens / 32768, 4),
    '128k': round(tokens / 128000, 4),
  };
}

function fallbackNote(error) {
  const reason = error?.message
    ? ` Native token science unavailable (${error.message.split('\n')[0]}).`
    : '';
  return `Heuristic fallback estimate.${reason} Install Cargo and run the native build for exact tokenizer counts.`;
}

function buildHeuristicTokenReport({ codec, natural = null, models = 'all' }, error = null) {
  const codecText = typeof codec === 'string' ? codec : JSON.stringify(codec);
  const naturalText = natural === null || natural === undefined
    ? null
    : (typeof natural === 'string' ? natural : JSON.stringify(natural));
  const effectiveNote = fallbackNote(error);
  const families = selectedFamilies(models);

  const reports = families.map(family => {
    const codecTokens = estimateTokens(codecText, family);
    const naturalTokens = naturalText === null ? null : estimateTokens(naturalText, family);
    return {
      backend: family.backend,
      codec_tokens: codecTokens,
      compression_ratio: naturalTokens ? round(naturalTokens / codecTokens, 2) : null,
      effective_context_note: effectiveNote,
      family: family.family,
      id: family.id,
      natural_tokens: naturalTokens,
      tokenizer: family.tokenizer,
      window_occupancy: {
        codec: occupancy(codecTokens),
        natural: naturalTokens === null ? null : occupancy(naturalTokens),
      },
    };
  });

  const codecValues = reports.map(entry => entry.codec_tokens);
  const naturalValues = reports.map(entry => entry.natural_tokens).filter(value => typeof value === 'number');
  const compressionValues = reports.map(entry => entry.compression_ratio).filter(value => typeof value === 'number');
  const best = [...reports].sort((a, b) => a.codec_tokens - b.codec_tokens)[0];
  const worst = [...reports].sort((a, b) => b.codec_tokens - a.codec_tokens)[0];

  return {
    codec_input: describeInput('codec', codec),
    kind: 'trasgo-token-report',
    exact: false,
    measurement_mode: 'heuristic-fallback',
    fallback_reason: error?.message || null,
    models: reports,
    natural_input: describeInput('natural', natural),
    summary: {
      best_codec_family: best.id,
      codec_tokens: {
        min: Math.min(...codecValues),
        median: median(codecValues),
        max: Math.max(...codecValues),
      },
      compression_ratio: compressionValues.length
        ? {
            min: Math.min(...compressionValues),
            median: median(compressionValues),
            max: Math.max(...compressionValues),
          }
        : null,
      natural_tokens: naturalValues.length
        ? {
            min: Math.min(...naturalValues),
            median: median(naturalValues),
            max: Math.max(...naturalValues),
          }
        : null,
      worst_codec_family: worst.id,
    },
  };
}

function optimizeMedian(report) {
  return report.summary.codec_tokens.median ?? Number.POSITIVE_INFINITY;
}

function optimizeCandidate(id, description, replacements, transformed_codec, report, baseline) {
  return {
    id,
    description,
    replacements,
    transformed_codec,
    report,
    delta_vs_baseline: report.models.map(entry => {
      const baselineEntry = baseline.models.find(item => item.id === entry.id);
      return {
        id: entry.id,
        codec_token_delta: entry.codec_tokens - (baselineEntry?.codec_tokens ?? entry.codec_tokens),
      };
    }),
  };
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

  const report = (() => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trasgo-token-'));
    try {
      const codecArg = materializeInput(tempDir, 'codec', codec);
      const args = ['tokens', '--codec', codecArg, '--models', models, '--json'];
      if (natural !== null && natural !== undefined) {
        const naturalArg = materializeInput(tempDir, 'natural', natural);
        args.push('--natural', naturalArg);
      }
      try {
        return parseJsonReport(spawnNative(args), 'tokens');
      } catch (error) {
        if (process.env.TRASGO_DISABLE_TOKEN_FALLBACK === '1') {
          throw error;
        }
        return buildHeuristicTokenReport({ codec, natural, models }, error);
      }
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

  const report = (() => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trasgo-opt-'));
    try {
      const codecArg = materializeInput(tempDir, 'codec', codec);
      try {
        return parseJsonReport(
          spawnNative(['optimize', '--codec', codecArg, '--models', models, '--json']),
          'optimize',
        );
      } catch (error) {
        if (process.env.TRASGO_DISABLE_TOKEN_FALLBACK === '1') {
          throw error;
        }
        const baseline = buildHeuristicTokenReport({ codec, models }, error);
        const text = typeof codec === 'string' ? codec : JSON.stringify(codec);
        const candidates = [
          ['section-ascii', 'Replace § with S1', ['§ -> S1'], text.replaceAll('§', 'S1')],
          ['delta-ascii', 'Replace Δ with D', ['Δ -> D'], text.replaceAll('Δ', 'D')],
          ['mu-ascii', 'Replace μ with mu', ['μ -> mu'], text.replaceAll('μ', 'mu')],
          ['arrow-ascii', 'Replace Unicode arrow with ->', ['→ -> ->'], text.replaceAll('→', '->')],
        ].map(([id, description, replacements, transformed]) => optimizeCandidate(
          id,
          description,
          replacements,
          transformed,
          buildHeuristicTokenReport({ codec: transformed, models }, error),
          baseline,
        ));
        const asciiCore = text
          .replaceAll('§', 'S1')
          .replaceAll('Δ', 'D')
          .replaceAll('μ', 'mu')
          .replaceAll('→', '->');
        candidates.push(optimizeCandidate(
          'ascii-core',
          'Apply the full ASCII alias core',
          ['§ -> S1', 'Δ -> D', 'μ -> mu', '→ -> ->'],
          asciiCore,
          buildHeuristicTokenReport({ codec: asciiCore, models }, error),
          baseline,
        ));
        const recommended = [...candidates].sort((a, b) => optimizeMedian(a.report) - optimizeMedian(b.report))[0];
        return {
          kind: 'trasgo-token-optimization',
          exact: false,
          measurement_mode: 'heuristic-fallback',
          fallback_reason: error.message,
          baseline,
          candidates,
          recommended,
        };
      }
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
