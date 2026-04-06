#!/usr/bin/env node

import fs from 'node:fs';
import chalk from 'chalk';
import figlet from 'figlet';
import gradient from 'gradient-string';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildDoctorReport,
  getCollection,
  getEntry,
  listRunTraces,
  loadRunTrace,
  loadRegistry,
  printTable,
  resolveBaseUrl,
  runMachineDetailed,
  runMachine,
  runTool,
  summarizeRegistry,
} from './control-plane.mjs';
import {
  applyBalancePacket,
  attachSkill,
  bootSession,
  brokerDecision,
  createSession,
  detachSkill,
  executeInput,
  initSessionContract,
  listSessions,
  loadSession,
  mountMcp,
  packSession,
  saveSession,
  sessionState,
  setBalanceValue,
  unmountMcp,
} from './runtime.mjs';
import { serveHttp, serveStdio } from './service.mjs';
import {
  getDemoWorkflow,
  listDemoWorkflows,
  runDemoWorkflow,
} from './demo-workflows.mjs';
import { compileCot, expandCot, loadCotBoot } from './cot.mjs';
import { runOptimizeReport, runTokenReport } from './token-science.mjs';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(moduleDir, '..', '..');
const stateDir = path.resolve(process.env.TRASGO_HOME || process.cwd());
const runtimeHome = {
  assetDir: repoDir,
  stateDir,
};
const runtime = {
  baseDir: repoDir,
  assetDir: repoDir,
  stateDir,
  nodeBin: process.execPath,
  pythonBin: process.env.TRASGO_PYTHON || 'python',
};
const activeSessionFile = path.join(runtime.stateDir, '.trasgo-runtime', 'active-session.json');

const rawRegistry = loadRegistry(repoDir);
const registry = {
  ...rawRegistry,
  runtimes: rawRegistry.runtimes.map(entry => ({
    ...entry,
    resolved_base_url: resolveBaseUrl(entry),
  })),
};

const brand = gradient(['#7B2FBE', '#E84393', '#FDCB6E', '#00CEC9']);
const dim = chalk.hex('#636E72');
const accent = chalk.hex('#E84393');
const mint = chalk.hex('#00CEC9');
const gold = chalk.hex('#FDCB6E');
const coral = chalk.hex('#E17055');
const lavender = chalk.hex('#A29BFE');
let bannerOptions = { logo: 'auto' };

const TRASGO_SPRITES = [
  'ᕙ(⇀‸↼)ᕗ',
  '(⌐■_■)',
  '꒰ ˶• ༝ •˶꒱',
  'ᕦ(ò_óˇ)ᕤ',
  '☆ﾟ.*・｡',
];

const TRASGO_QUOTES = [
  'session-native, delta-first',
  'less token drag, more signal',
  'broker the local, invoke the cloud',
  'boot fast, pack sharp, route clean',
];

const HELP_TOPICS = {
  quickstart: [
    '1. trasgo quickstart',
    '2. trasgo demo list',
    '3. trasgo demo run factory-copilot --json',
    '4. trasgo advise --codec <json> --natural <text>',
    '5. trasgo serve --http --port 8787',
  ],
  install: [
    'Published npm: npm install -g trasgo',
    'CLI launcher: npm ci && node scripts/trasgo-launch.cjs --help',
    'Native Rust: cargo build --manifest-path rust/trasgo/Cargo.toml --release',
    'Windows launcher: .\\trasgo.cmd',
    'Unix launcher: ./bin/trasgo',
  ],
  native: [
    'Native commands: hello ask load route prove tokens optimize passthrough',
    'Launcher auto-builds native when needed if the Rust manifest is present.',
    'Use trasgo --native-status to inspect detected native binary and manifest.',
  ],
  mobile: [
    'Mobile wrappers consume the local HTTP bridge rather than emulating the terminal.',
    'Start the bridge with trasgo serve --http --port 8787.',
    'Wrapper app scaffold lives under mobile/trasgo-mobile.',
  ],
  cot: [
    'trasgo cot boot',
    'trasgo cot compile --natural "First add 7 and 5 to get 12. Therefore the answer is 12."',
    'trasgo cot advise --natural "First add 7 and 5 to get 12. Therefore the answer is 12."',
    'trasgo cot expand --codec "§CoT[1:OBSERVE|operands:7,5 2:APPLY|add(7,5)->12 3:EMIT|answer:12]"',
  ],
};

function randomFrom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function terminalWidth() {
  const envWidth = Number.parseInt(process.env.COLUMNS || '', 10);
  return process.stdout?.columns || process.stderr?.columns || envWidth || 120;
}

function centerLine(line, width) {
  const pad = Math.max(0, Math.floor((width - line.length) / 2));
  return `${' '.repeat(pad)}${line}`;
}

function centerBlock(text, width, colorize = value => value) {
  return text
    .split('\n')
    .map(line => colorize(centerLine(line, width)))
    .join('\n');
}

function logoFont(width) {
  if (width >= 120) return 'ANSI Shadow';
  if (width >= 90) return 'Big';
  return 'Standard';
}

function findChafaBinary() {
  const candidates = [
    process.platform === 'win32'
      ? path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'Chafa.exe')
      : null,
    process.platform === 'win32' ? 'Chafa.exe' : 'chafa',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.includes(path.sep)) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      continue;
    }

    const probe = spawnSync(candidate, ['--version'], {
      stdio: 'ignore',
      shell: false,
      timeout: 1500,
    });
    if (probe.status === 0) {
      return candidate;
    }
  }

  return null;
}

function detectImageBackend() {
  if (!process.stdout?.isTTY) return null;
  if (process.env.WT_SESSION) return 'sixels';
  if (process.env.TERM_PROGRAM === 'iTerm.app') return 'iterm';
  if (process.env.TERM?.includes('kitty') || process.env.KITTY_WINDOW_ID) return 'kitty';
  return null;
}

function renderInlineLogo(width) {
  const backend = detectImageBackend();
  const chafa = findChafaBinary();
  if (!backend || !chafa) {
    return false;
  }

  const imagePathCandidates = [
    path.join(runtime.baseDir, 'trasgo.png'),
    path.join(runtime.baseDir, 'assets', 'trasgo.png'),
  ];
  const imagePath = imagePathCandidates.find(candidate => fs.existsSync(candidate));
  if (!imagePath) {
    return false;
  }

  const imageWidth = Math.max(28, Math.min(54, Math.floor(width * 0.42)));
  const imageHeight = Math.max(10, Math.min(20, Math.floor(imageWidth * 0.5)));
  const result = spawnSync(chafa, [
    '--format', backend,
    '--probe', 'off',
    '--animate', 'off',
    '--align', 'center,top',
    '--polite', 'off',
    '--margin-bottom', '0',
    '--margin-right', '0',
    '--view-size', `${width}x${Math.max(imageHeight + 2, 12)}`,
    '--size', `${imageWidth}x${imageHeight}`,
    imagePath,
  ], {
    stdio: ['ignore', 'inherit', 'ignore'],
    shell: false,
    timeout: 4000,
  });

  if (result.status !== 0) {
    return false;
  }
  process.stdout.write('\n');
  return true;
}

function printAsciiBanner(width) {
  const logo = figlet.textSync('TRASGO', {
    font: logoFont(width),
    horizontalLayout: 'fitted',
  });
  const orbit = `${randomFrom(TRASGO_SPRITES)}  ${randomFrom(TRASGO_QUOTES)}`;
  const rule = dim(centerLine('─'.repeat(Math.max(30, Math.min(width - 8, 72))), width));
  const title = centerLine('runtime shell / codec broker / postGenZ control plane', width);
  const subtitle = centerLine('init -> pack -> boot -> send', width);

  console.log(centerBlock(logo, width, brand));
}

function printBanner() {
  const width = terminalWidth();
  const logoMode = bannerOptions.logo || 'auto';
  const wantImage = logoMode === 'image' || logoMode === 'auto';
  const imageShown = wantImage ? renderInlineLogo(width) : false;
  const orbit = `${randomFrom(TRASGO_SPRITES)}  ${randomFrom(TRASGO_QUOTES)}`;
  const rule = dim(centerLine('─'.repeat(Math.max(30, Math.min(width - 8, 72))), width));
  const title = centerLine('runtime shell / codec broker / postGenZ control plane', width);
  const subtitle = centerLine('init -> pack -> boot -> send', width);

  if (!imageShown && logoMode !== 'none') {
    printAsciiBanner(width);
  }

  console.log(rule);
  console.log(accent(title));
  console.log(dim(subtitle));
  console.log(lavender(centerLine(orbit, width)));
  console.log();
}

function currentSession(context) {
  if (!context.activeSessionId) return null;
  try {
    return loadSession(runtimeHome, context.activeSessionId, registry);
  } catch {
    clearActiveSession(context);
    return null;
  }
}

function loadPersistedActiveSessionId() {
  try {
    const payload = JSON.parse(fs.readFileSync(activeSessionFile, 'utf8'));
    return typeof payload?.session_id === 'string' ? payload.session_id : null;
  } catch {
    return null;
  }
}

function persistActiveSessionId(sessionId) {
  fs.mkdirSync(path.dirname(activeSessionFile), { recursive: true });
  fs.writeFileSync(activeSessionFile, JSON.stringify({
    session_id: sessionId,
    updated_at: new Date().toISOString(),
  }, null, 2));
}

function clearActiveSession(context) {
  context.activeSessionId = null;
  if (fs.existsSync(activeSessionFile)) {
    fs.rmSync(activeSessionFile, { force: true });
  }
}

function setActiveSession(context, session) {
  context.activeSessionId = session.id;
  persistActiveSessionId(session.id);
}

function printStatus() {
  const summary = summarizeRegistry(registry);
  printBanner();
  console.log(accent('Status'));
  console.log(`  ${mint('registry')} ${dim(registry.path)}`);
  console.log(`  ${mint('node')}     ${dim(runtime.nodeBin)}`);
  console.log(`  ${mint('python')}   ${dim(runtime.pythonBin)}`);
  console.log(`  ${mint('state')}    ${dim(runtime.stateDir)}`);
  console.log(`  ${mint('sessions')} ${gold(String(listSessions(runtimeHome).length))}`);
  console.log();
  console.log(accent('Plane'));
  console.log(`  ${gold('runtimes')} ${summary.runtimes}  ${gold('tools')} ${summary.tools}  ${gold('machines')} ${summary.machines}  ${gold('mcp')} ${summary.mcp}  ${gold('skills')} ${summary.skills}`);
  console.log();
}

function statusSnapshot() {
  const summary = summarizeRegistry(registry);
  return {
    kind: 'trasgo-status',
    registry: registry.path,
    state_dir: runtime.stateDir,
    node: runtime.nodeBin,
    python: runtime.pythonBin,
    sessions: listSessions(runtimeHome).length,
    plane: summary,
  };
}

function sessionRows() {
  return listSessions(runtimeHome);
}

function balanceSnapshot(session) {
  return {
    kind: 'trasgo-balance',
    session: sessionState(session),
    decision: brokerDecision(session, registry),
  };
}


function runtimeRows() {
  return getCollection(registry, 'runtimes').map(entry => ({
    id: entry.id,
    kind: entry.kind,
    model: entry.model || 'auto',
    base: entry.resolved_base_url || '-',
    caps: (entry.capabilities || []).join(','),
  }));

}

function listRuntimes() {
  const rows = runtimeRows();

  printTable('Runtimes', [
    { key: 'id', label: 'ID', width: 12 },
    { key: 'kind', label: 'Kind', width: 7 },
    { key: 'model', label: 'Model', width: 22 },
    { key: 'base', label: 'Base URL', width: 34 },
    { key: 'caps', label: 'Caps', width: 24 },
  ], rows, line => console.log(line));
}

function toolRows() {
  return getCollection(registry, 'tools').map(entry => ({
    id: entry.id,
    layer: entry.layer,
    runner: entry.runner,
    entry: entry.entry,
    desc: entry.description,
  }));

}

function listTools() {
  const rows = toolRows();

  printTable('Tools', [
    { key: 'id', label: 'ID', width: 16 },
    { key: 'layer', label: 'Layer', width: 14 },
    { key: 'runner', label: 'Runner', width: 8 },
    { key: 'entry', label: 'Entry', width: 28 },
    { key: 'desc', label: 'Description', width: 42 },
  ], rows, line => console.log(line));
}

function machineRows() {
  return getCollection(registry, 'machines').map(entry => ({
    id: entry.id,
    type: entry.type,
    steps: (entry.steps || []).map(step => step.tool).join(' -> '),
    desc: entry.description,
  }));

}

function listMachines() {
  const rows = machineRows();

  printTable('Machines', [
    { key: 'id', label: 'ID', width: 18 },
    { key: 'type', label: 'Type', width: 10 },
    { key: 'steps', label: 'Steps', width: 32 },
    { key: 'desc', label: 'Description', width: 42 },
  ], rows, line => console.log(line));
}

function mcpRows() {
  return getCollection(registry, 'mcp').map(entry => ({
    id: entry.id,
    transport: entry.transport,
    root: entry.root,
    resources: (entry.resources || []).join(','),
  }));

}

function listMcp() {
  const rows = mcpRows();

  printTable('MCP', [
    { key: 'id', label: 'ID', width: 18 },
    { key: 'transport', label: 'Transport', width: 12 },
    { key: 'root', label: 'Root', width: 24 },
    { key: 'resources', label: 'Resources', width: 56 },
  ], rows, line => console.log(line));
}

function skillRows() {
  return getCollection(registry, 'skills').map(entry => ({
    id: entry.id,
    kind: entry.kind,
    entry: entry.entry,
    desc: entry.description,
  }));

}

function listSkills() {
  const rows = skillRows();

  printTable('Skills', [
    { key: 'id', label: 'ID', width: 16 },
    { key: 'kind', label: 'Kind', width: 12 },
    { key: 'entry', label: 'Entry', width: 28 },
    { key: 'desc', label: 'Description', width: 44 },
  ], rows, line => console.log(line));
}

function demoRows() {
  return listDemoWorkflows().map(entry => ({
    id: entry.id,
    lane: entry.lane,
    title: entry.title,
    desc: entry.summary,
  }));

}

function listDemos() {
  const rows = demoRows();

  printTable('Demo Workflows', [
    { key: 'id', label: 'ID', width: 20 },
    { key: 'lane', label: 'Lane', width: 20 },
    { key: 'title', label: 'Title', width: 20 },
    { key: 'desc', label: 'Description', width: 52 },
  ], rows, line => console.log(line));
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
  console.log();
}

function outputValue(context, value, printer) {
  if (context.outputJson) {
    printJson(value);
    return;
  }
  printer();
}

function launcherScript() {
  return path.join(runtime.assetDir, 'scripts', 'trasgo-launch.cjs');
}

function nativeStatusSnapshot() {
  const result = spawnSync(runtime.nodeBin, [launcherScript(), '--native-status'], {
    cwd: runtime.assetDir,
    encoding: 'utf8',
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  return JSON.parse(result.stdout);
}

function printHelpTopic(topic) {
  const lines = HELP_TOPICS[topic];
  if (!lines) {
    console.error(coral(`unknown help topic: ${topic}`));
    console.log();
    console.log(`topics: ${Object.keys(HELP_TOPICS).join(', ')}`);
    console.log();
    return 1;
  }

  console.log(accent(`Help · ${topic}`));
  console.log();
  for (const line of lines) {
    console.log(`  ${line}`);
  }
  console.log();
  return 0;
}

function parseServeOptions(rest) {
  const options = {
    stdio: false,
    http: false,
    port: Number.parseInt(process.env.TRASGO_HTTP_PORT || '8787', 10),
  };

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--stdio') {
      options.stdio = true;
      continue;
    }
    if (arg === '--http') {
      options.http = true;
      continue;
    }
    if (arg === '--port' && rest[i + 1]) {
      options.port = Number.parseInt(rest[i + 1], 10);
      i += 1;
    }
  }

  return options;
}

function advisoryFromReport(report) {
  const codecMedian = Math.round(report.summary.codec_tokens.median);
  const naturalMedian = report.summary.natural_tokens
    ? Math.round(report.summary.natural_tokens.median)
    : null;
  const delta = naturalMedian === null ? null : codecMedian - naturalMedian;

  if (naturalMedian === null) {
    return {
      verdict: 'codec-only',
      recommendation: 'Natural baseline missing; only codec cost was measured.',
      delta,
    };
  }

  if (codecMedian < naturalMedian) {
    return {
      verdict: 'use-codec',
      recommendation: 'Codec is cheaper at the median tokenizer view and should buy context headroom here.',
      delta,
    };
  }

  if (codecMedian > naturalMedian) {
    return {
      verdict: 'prefer-natural',
      recommendation: 'Natural language is cheaper for this shape; codec overhead is not earning its keep yet.',
      delta,
    };
  }

  return {
    verdict: 'neutral',
    recommendation: 'Codec and natural language are tied at the median; use codec only if structured downstream processing matters.',
    delta,
  };
}

function printAdvisory(advice) {
  console.log(accent('Codec Advice'));
  console.log(`  ${mint('verdict')}        ${gold(advice.verdict)}`);
  console.log(`  ${mint('recommendation')} ${dim(advice.recommendation)}`);
  if (advice.break_even_delta_tokens !== null) {
    console.log(`  ${mint('delta')}          ${dim(`${advice.break_even_delta_tokens} tok (codec - natural)` )}`);
  }
  console.log(`  ${mint('best family')}    ${dim(advice.report.summary.best_codec_family)}`);
  console.log(`  ${mint('worst family')}   ${dim(advice.report.summary.worst_codec_family)}`);
  console.log();
}

function explainValue(value) {
  if (Array.isArray(value)) {
    return {
      kind: 'array',
      len: value.length,
    };
  }

  if (value && typeof value === 'object') {
    return {
      kind: 'object',
      keys: Object.keys(value),
    };
  }

  if (typeof value === 'string') {
    return {
      kind: 'string',
      len: value.length,
    };
  }

  return {
    kind: 'scalar',
    value,
  };
}

function explainGenericInput(rawInput) {
  const candidatePath = path.resolve(process.cwd(), rawInput);
  let value;

  if (fs.existsSync(candidatePath)) {
    const text = fs.readFileSync(candidatePath, 'utf8');
    try {
      value = JSON.parse(text);
    } catch {
      value = { text };
    }
  } else {
    try {
      value = JSON.parse(rawInput);
    } catch {
      value = { text: rawInput };
    }
  }

  if (value?.kind === 'trasgo-pack') {
    return {
      summary: 'Trasgo pack bundle',
      session: value.session ?? null,
      contract: value.contract ?? null,
      skills: Array.isArray(value.skills) ? value.skills.length : 0,
      mcp: Array.isArray(value.mcp) ? value.mcp.length : 0,
    };
  }

  return explainValue(value);
}

function consumeOptionValue(args, startIndex) {
  const collected = [];
  let index = startIndex;
  while (index < args.length && !args[index].startsWith('--')) {
    collected.push(args[index]);
    index += 1;
  }
  return {
    value: collected.join(' ').trim(),
    nextIndex: index - 1,
  };
}

function parseCodecArgs(rest) {
  const options = {
    codec: null,
    natural: null,
    models: 'all',
  };

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--codec' && rest[i + 1]) {
      const consumed = consumeOptionValue(rest, i + 1);
      options.codec = consumed.value;
      i = consumed.nextIndex;
      continue;
    }
    if (arg === '--natural' && rest[i + 1]) {
      const consumed = consumeOptionValue(rest, i + 1);
      options.natural = consumed.value;
      i = consumed.nextIndex;
      continue;
    }
    if (arg === '--models' && rest[i + 1]) {
      options.models = rest[i + 1];
      i += 1;
    }
  }

  return options;
}

function parseCotArgs(rest) {
  const options = {
    natural: null,
    codec: null,
    answer: null,
    models: 'all',
  };
  const positional = [];

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--natural' && rest[i + 1]) {
      const consumed = consumeOptionValue(rest, i + 1);
      options.natural = consumed.value;
      i = consumed.nextIndex;
      continue;
    }
    if (arg === '--codec' && rest[i + 1]) {
      const consumed = consumeOptionValue(rest, i + 1);
      options.codec = consumed.value;
      i = consumed.nextIndex;
      continue;
    }
    if (arg === '--answer' && rest[i + 1]) {
      const consumed = consumeOptionValue(rest, i + 1);
      options.answer = consumed.value;
      i = consumed.nextIndex;
      continue;
    }
    if (arg === '--models' && rest[i + 1]) {
      options.models = rest[i + 1];
      i += 1;
      continue;
    }
    positional.push(arg);
  }

  return { options, positional };
}

function printQuickstart(result) {
  console.log(accent('Quickstart'));
  console.log();
  console.log(`  ${mint('native')}    ${result.native.native_binary ? gold('ready') : coral('missing')}`);
  console.log(`  ${mint('manifest')}  ${dim(result.native.cargo_manifest || 'none')}`);
  console.log(`  ${mint('hello')}     ${gold(result.hello.output)}`);
  console.log(`  ${mint('demos')}     ${gold(result.demos.length.toString())}`);
  console.log(`  ${mint('advice')}    ${gold(result.advice.verdict)}`);
  console.log();
  console.log(dim('next steps'));
  console.log(`  1. trasgo demo run ${result.demos[0]?.id || 'factory-copilot'}`);
  console.log('  2. trasgo serve --http --port 8787');
  console.log('  3. trasgo run observatory');
  console.log();
}

function parseDemoOptions(rest) {
  const options = {
    outPath: null,
  };
  const positional = [];

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--out' && rest[i + 1]) {
      options.outPath = rest[i + 1];
      i += 1;
      continue;
    }
    positional.push(arg);
  }

  return { options, positional };
}

function printDemoResult(result) {
  console.log(accent(result.title) + dim(` · ${result.lane}`));
  console.log();
  console.log(result.summary);
  console.log();
  console.log(`  ${mint('decision')}   ${gold(result.output.decision)}`);
  console.log(`  ${mint('rationale')}  ${dim(result.output.rationale)}`);
  console.log(`  ${mint('impact')}     ${gold(result.economic_case.headline)}`);
  console.log(`  ${mint('packet')}     ${dim(`§1 packet with ${result.packet['Δ'].length} deltas`)}`);
  console.log();
  console.log(accent('CTX_CONTEXT'));
  console.log(`  ${mint('natural')}    ${gold(`${result.ctx_context.natural_context_tokens} tok median`)}`);
  console.log(`  ${mint('codec')}      ${gold(`${result.ctx_context.codec_context_tokens} tok median`)}`);
  console.log(`  ${mint('compress')}   ${gold(`${result.ctx_context.compression_ratio}x median`)}`);
  console.log(`  ${mint('4k-share')}   ${dim(`${Math.round(result.ctx_context.window_4k_share * 1000) / 10}%`)}`);
  console.log(`  ${mint('spread')}     ${dim(`${result.ctx_context.family_spread.codec_tokens.min}-${result.ctx_context.family_spread.codec_tokens.max} codec tok`)}`);
  console.log(`  ${mint('method')}     ${dim(result.ctx_context.exact_method)}`);
  console.log(`  ${mint('effective')}  ${dim(result.ctx_context.effective_context_note)}`);
  console.log();
  console.log(accent('Tokenizer Battery'));
  for (const entry of result.ctx_context.battery) {
    const natural = entry.natural_tokens ?? '-';
    const ratio = entry.compression_ratio ?? '-';
    console.log(`  ${mint(entry.id.padEnd(14))} ${String(natural).padStart(4)} -> ${String(entry.codec_tokens).padStart(4)} tok  ${dim(`${ratio}x`)}`);
  }
  console.log();
  console.log(accent('Functional Gain'));
  for (const [label, value] of Object.entries(result.functional_gain)) {
    console.log(`  ${mint(label.padEnd(28))} ${String(value)}`);
  }
  console.log();
  console.log(accent('Scientific View'));
  console.log(`  ${dim(result.scientific_view.confirmation)}`);
  console.log();
  console.log(accent('Action Plan'));
  result.recommendations.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item}`);
  });
  console.log();
  console.log(`  ${mint('artifact')}   ${dim(result.artifact_path)}`);
  console.log();
}

const EXACT_COMMANDS = new Set([
  'help', '--help', '-h', 'status', 'init', 'pack', 'boot', 'doctor', 'serve',
  'session', 'balance', 'skills', 'skill', 'mcp', 'send', 'packet',
  'providers', 'runtimes', 'tools', 'machines', 'orchestrations', 'orchestrate',
  'show', 'dashboard', 'live', 'watch', 'monitor', 'bench', 'calibrate',
  'research', 'validate', 'run', 'demo', 'quickstart', 'advise', 'explain', 'trace',
  'cot', 'tokens', 'optimize',
]);

const NATURAL_STOPWORDS = new Set([
  'a', 'an', 'for', 'me', 'my', 'please', 'the', 'this', 'to', 'with',
]);

function shouldInterpretNaturally(argv) {
  if (argv.length === 0) return false;
  const lowered = argv.map(arg => arg.toLowerCase());
  if (!EXACT_COMMANDS.has(lowered[0])) {
    return true;
  }
  if (lowered.length > 1 && NATURAL_STOPWORDS.has(lowered[1])) {
    return true;
  }
  return lowered.some(token => NATURAL_STOPWORDS.has(token)) && lowered.length > 2;
}

function inferSessionTitle(phrase, fallback) {
  const match = phrase.match(/\b(?:for|called|named)\s+(.+)$/i);
  if (match?.[1]) {
    return match[1].trim();
  }
  return fallback;
}

function interpretNaturalCommand(argv, context) {
  if (!shouldInterpretNaturally(argv)) {
    return null;
  }

  const phrase = argv.join(' ').trim();
  const lower = phrase.toLowerCase();

  if (/(what can you do|show help|help me|usage)/u.test(lower)) {
    return ['help'];
  }

  if (/(show|list|display).*(runtimes|providers|models)/u.test(lower)) {
    return ['runtimes'];
  }

  if (/(show|list|display).*(tools)/u.test(lower)) {
    return ['tools'];
  }

  if (/(show|list|display).*(machines|workflows|orchestrations)/u.test(lower)) {
    return ['machines'];
  }

  if (/(show|list|display).*(skills)/u.test(lower)) {
    return ['skills'];
  }

  if (/(show|list|display).*(mcp|mounts|resources)/u.test(lower)) {
    return ['mcp'];
  }

  if (/(show|list|display).*(demo|demos)/u.test(lower)) {
    return ['demo', 'list'];
  }

  if (/(show|list|display).*(sessions)/u.test(lower)) {
    return ['session', 'list'];
  }

  if (/(create|start|open).*(new )?session/u.test(lower)) {
    return ['session', 'new', inferSessionTitle(phrase, 'trasgo-session')];
  }

  if (/(run|launch|open|show).*(factory|downtime|maintenance|operations|ops)/u.test(lower)) {
    return ['demo', 'run', 'factory-copilot'];
  }

  if (/(run|launch|open|show).*(revenue|margin|deal|pricing|quote)/u.test(lower)) {
    return ['demo', 'run', 'revenue-guard'];
  }

  if (/(show|check).*(balance|routing|route)/u.test(lower)) {
    return ['balance', 'show'];
  }

  if (context.activeSessionId) {
    return ['send', phrase];
  }

  return null;
}

function showEntry(collectionName, id, context = { outputJson: true }) {
  const entry = getEntry(registry, collectionName, id);
  if (!entry) {
    console.error(coral(`unknown ${collectionName} entry: ${id}`));
    return 1;
  }
  outputValue(context, entry, () => {
    printJson(entry);
  });
  return 0;
}

function emitSkill(id) {
  const skill = getEntry(registry, 'skills', id);
  if (!skill) {
    console.error(coral(`unknown skill: ${id}`));
    return 1;
  }
  console.log(fs.readFileSync(path.join(runtime.assetDir, skill.entry), 'utf-8'));
  return 0;
}

async function printDoctor(options = {}) {
  const report = await buildDoctorReport(registry, runtime, options);
  console.log(accent('Doctor'));
  console.log(`  ${mint('node')}   ${report.nodeVersion || coral('not found')}`);
  console.log(`  ${mint('python')} ${report.pythonVersion || coral('not found')}`);
  console.log();
  console.log(accent('Env'));
  for (const entry of report.env) {
    console.log(`  ${mint(entry.key.padEnd(20))} ${entry.set ? gold('set') : dim('missing')}`);
  }
  console.log();
  if (options.probe) {
    console.log(accent('Runtime Probes'));
    for (const entry of report.probes) {
      console.log(`  ${mint(entry.id.padEnd(16))} ${entry.ok ? gold('ok') : coral('down')} ${dim(entry.detail)}`);
    }
    console.log();
  }
  return 0;
}

function printSessionList() {
  const sessions = sessionRows();
  if (sessions.length === 0) {
    console.log(dim('no saved sessions'));
    console.log();
    return;
  }

  printTable('Sessions', [
    { key: 'id', label: 'ID', width: 38 },
    { key: 'title', label: 'Title', width: 18 },
    { key: 'active_runtime', label: 'Runtime', width: 14 },
    { key: 'updated_at', label: 'Updated', width: 24 },
  ], sessions, line => console.log(line));
}

function printSessionState(session) {
  const state = sessionState(session);
  console.log(accent(`Session ${state.id}`));
  console.log(`  ${mint('title')}        ${state.title}`);
  console.log(`  ${mint('runtime')}      ${state.active_runtime || dim('none')}`);
  console.log(`  ${mint('phase')}        ${state.boot.status}`);
  console.log(`  ${mint('skills')}       ${state.skills.join(', ') || dim('none')}`);
  console.log(`  ${mint('mcp')}          ${state.mcp_mounts.join(', ') || dim('none')}`);
  console.log(`  ${mint('history')}      ${state.history_size} turns`);
  console.log(`  ${mint('mode')}         ${state.contract.mode}`);
  console.log(`  ${mint('targets')}      ${state.contract.targets.join(', ')}`);
  console.log(`  ${mint('fallback')}     ${state.contract.fallback}`);
  if (state.workflow.last_pack_path) {
    console.log(`  ${mint('pack')}         ${dim(state.workflow.last_pack_path)}`);
  }
  if (state.boot.booted_at) {
    console.log(`  ${mint('booted_at')}    ${dim(state.boot.booted_at)}`);
  }
  console.log();
}

function printBalanceState(session) {
  const decision = brokerDecision(session, registry);
  console.log(accent('Balance'));
  console.log(`  ${mint('policy')}    ${session.contract.policy}`);
  console.log(`  ${mint('mode')}      ${session.contract.mode}`);
  console.log(`  ${mint('targets')}   ${session.contract.targets.join(', ')}`);
  console.log(`  ${mint('fallback')}  ${session.contract.fallback}`);
  console.log();
  printTable('Broker Rank', [
    { key: 'runtime', label: 'Runtime', width: 14 },
    { key: 'kind', label: 'Kind', width: 8 },
    { key: 'score', label: 'Score', width: 8 },
  ], decision.ranked.map(entry => ({
    runtime: entry.runtime,
    kind: entry.kind,
    score: entry.score.toFixed(2),
  })), line => console.log(line));
}

function printWorkflowState(title, session, details = []) {
  console.log(accent(title));
  console.log(`  ${mint('session')} ${session.id}`);
  console.log(`  ${mint('title')}   ${session.title}`);
  for (const [label, value] of details) {
    console.log(`  ${mint(label.padEnd(7))} ${value}`);
  }
  console.log();
}

function printPackResult(result) {
  printWorkflowState('Pack', result.session, [
    ['path', dim(result.outputPath)],
    ['skills', gold(String(result.bundle.skills.length))],
    ['mcp', gold(String(result.bundle.mcp.length))],
  ]);
}

function printBootResult(result) {
  const primary = result.decision.selected[0];
  printWorkflowState('Boot', result.session, [
    ['pack', dim(result.packPath)],
    ['mode', result.decision.mode],
    ['runtime', primary ? gold(primary.runtime) : dim('none')],
  ]);
}

function parseWorkflowOptions(rest) {
  const options = {
    title: null,
    outPath: null,
    packPath: null,
    targets: null,
    mode: null,
    fallback: null,
    requireLocal: undefined,
    allowCloud: undefined,
  };
  const positional = [];

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--title' && rest[i + 1]) {
      options.title = rest[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--out' && rest[i + 1]) {
      options.outPath = rest[i + 1];
      i += 1;
      continue;
    }
    if ((arg === '--from' || arg === '--pack') && rest[i + 1]) {
      options.packPath = rest[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--targets' && rest[i + 1]) {
      options.targets = rest[i + 1].split(',').map(item => item.trim()).filter(Boolean);
      i += 1;
      continue;
    }
    if (arg === '--mode' && rest[i + 1]) {
      options.mode = rest[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--fallback' && rest[i + 1]) {
      options.fallback = rest[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--local-only') {
      options.requireLocal = true;
      options.allowCloud = false;
      continue;
    }
    if (arg === '--allow-cloud') {
      options.allowCloud = true;
      continue;
    }
    positional.push(arg);
  }

  if (!options.title && positional.length > 0) {
    options.title = positional.join(' ');
  }

  return options;
}

function printResponse(result) {
  if (result.kind === 'balance') {
    console.log(gold(result.message));
    console.log();
    printBalanceState(result.session);
    return;
  }

  console.log(accent(`Runtime ${result.response.runtime}`) + dim(` · ${result.response.model} · ${result.response.latencyMs}ms`));
  if (result.attempts.length > 1) {
    const attempts = result.attempts.map(entry => entry.error ? `${entry.runtime}:error` : `${entry.runtime}:${entry.latencyMs}ms`);
    console.log(dim(`  attempts: ${attempts.join(' | ')}`));
  }
  console.log();
  console.log(result.response.content);
  console.log();
}

function ensureSession(context) {
  let session = currentSession(context);
  if (!session) {
    session = createSession(runtimeHome, registry, {});
    setActiveSession(context, session);
  }
  return session;
}

async function runNamed(id, args = []) {
  if (getEntry(registry, 'tools', id)) {
    return runTool(registry, id, args, runtime);
  }
  if (getEntry(registry, 'machines', id)) {
    return runMachine(registry, id, args, runtime);
  }
  console.error(coral(`unknown tool or machine: ${id}`));
  return 1;
}

async function handleQuickstart(context) {
  const native = nativeStatusSnapshot();
  const helloSession = createSession(runtime.baseDir, registry, { title: 'quickstart-tour' });
  const demos = listDemoWorkflows();
  const advisoryCodec = JSON.stringify({
    '§': 1,
    E: { P1: ['pump-1', 'asset'], S1: ['supervisor-1', 'person'] },
    S: { 'P1.state': 'derated', 'P1.flow': '4200kg/s' },
    R: ['S1->P1:routes'],
    'Δ': ['P1.state:nominal->derated@2026-03-30T08:00Z'],
    'μ': { scope: 'operations', urg: 0.62, cert: 0.91 },
  });
  const advisoryNatural = 'Pump 1 was moved from nominal to derated operation and the supervisor needs the routing state preserved for the next decision.';
  const report = runTokenReport({ codec: advisoryCodec, natural: advisoryNatural });
  const advice = {
    ...advisoryFromReport(report),
    break_even_delta_tokens: advisoryFromReport(report).delta,
    report,
  };
  const result = {
    kind: 'trasgo-quickstart',
    native,
    hello: {
      session: sessionState(helloSession),
      output: 'Hello, Operator! Welcome to Trasgo.',
    },
    demos,
    advice,
  };

  outputValue(context, result, () => {
    printQuickstart(result);
  });
  return 0;
}

async function handleAdvise(rest, context) {
  const options = parseCodecArgs(rest);
  if (!options.codec) {
    console.error(coral('advise requires --codec <json|text>'));
    return 1;
  }

  const report = runTokenReport(options);
  const advisory = advisoryFromReport(report);
  const result = {
    kind: 'trasgo-advise',
    verdict: advisory.verdict,
    recommendation: advisory.recommendation,
    break_even_delta_tokens: advisory.delta,
    report,
  };

  outputValue(context, result, () => {
    printAdvisory(result);
  });
  return 0;
}

async function handleCot(rest, context) {
  const [action = 'boot', ...args] = rest;
  const { options, positional } = parseCotArgs(args);

  if (action === 'boot') {
    const result = {
      kind: 'trasgo-cot-boot',
      boot: loadCotBoot(runtime.assetDir),
    };
    outputValue(context, result, () => {
      console.log(result.boot);
      console.log();
    });
    return 0;
  }

  if (action === 'compile') {
    const natural = options.natural || positional.join(' ').trim();
    if (!natural) {
      console.error(coral('usage: trasgo cot compile --natural <text> [--answer <value>] [--models all]'));
      return 1;
    }
    const compiled = compileCot(natural, { answer: options.answer });
    const tokenReport = runTokenReport({ codec: compiled.codec, natural, models: options.models });
    const advisory = advisoryFromReport(tokenReport);
    const result = {
      ...compiled,
      verdict: advisory.verdict,
      recommendation: advisory.recommendation,
      break_even_delta_tokens: advisory.delta,
      token_report: tokenReport,
    };
    outputValue(context, result, () => {
      console.log(accent('§CoT Compile'));
      console.log();
      console.log(result.codec);
      console.log();
      console.log(`  ${mint('answer')}      ${dim(result.answer || 'n/a')}`);
      console.log(`  ${mint('steps')}       ${gold(String(result.step_count))}`);
      console.log(`  ${mint('verdict')}     ${gold(result.verdict)}`);
      console.log(`  ${mint('advice')}      ${dim(result.recommendation)}`);
      if (result.break_even_delta_tokens !== null) {
        console.log(`  ${mint('delta')}       ${dim(`${result.break_even_delta_tokens} tok (codec - natural)`)}`);
      }
      console.log();
    });
    return 0;
  }

  if (action === 'advise') {
    const natural = options.natural || positional.join(' ').trim();
    if (!natural) {
      console.error(coral('usage: trasgo cot advise --natural <text> [--answer <value>] [--models all]'));
      return 1;
    }
    const compiled = compileCot(natural, { answer: options.answer });
    const tokenReport = runTokenReport({ codec: compiled.codec, natural, models: options.models });
    const advisory = advisoryFromReport(tokenReport);
    const result = {
      kind: 'trasgo-cot-advise',
      natural,
      codec: compiled.codec,
      answer: compiled.answer,
      step_count: compiled.step_count,
      verdict: advisory.verdict,
      recommendation: advisory.recommendation,
      break_even_delta_tokens: advisory.delta,
      token_report: tokenReport,
    };
    outputValue(context, result, () => {
      console.log(accent('§CoT Advice'));
      console.log();
      console.log(`  ${mint('verdict')}     ${gold(result.verdict)}`);
      console.log(`  ${mint('advice')}      ${dim(result.recommendation)}`);
      console.log(`  ${mint('steps')}       ${gold(String(result.step_count))}`);
      if (result.break_even_delta_tokens !== null) {
        console.log(`  ${mint('delta')}       ${dim(`${result.break_even_delta_tokens} tok (codec - natural)`)}`);
      }
      console.log();
      console.log(result.codec);
      console.log();
    });
    return 0;
  }

  if (action === 'expand') {
    const codecInput = options.codec || positional.join(' ').trim();
    if (!codecInput) {
      console.error(coral('usage: trasgo cot expand --codec <text>'));
      return 1;
    }
    const codecPath = path.resolve(process.cwd(), codecInput);
    const codec = fs.existsSync(codecPath)
      ? fs.readFileSync(codecPath, 'utf8')
      : codecInput;
    const result = expandCot(codec);
    outputValue(context, result, () => {
      console.log(accent('§CoT Expand'));
      console.log();
      console.log(result.natural);
      console.log();
    });
    return 0;
  }

  console.error(coral(`unknown cot action: ${action}`));
  return 1;
}

async function handleExplain(rest, context) {
  const [subject = 'balance'] = rest;
  if (subject === 'balance') {
    const session = ensureSession(context);
    const result = {
      kind: 'trasgo-explain-balance',
      contract: session.contract,
      note: 'Balance sets targets, priorities, fallback mode, and locality/privacy constraints for runtime selection.',
    };
    outputValue(context, result, () => {
      console.log(accent('Explain · balance'));
      console.log();
      console.log(dim(result.note));
      console.log();
      printBalanceState(session);
    });
    return 0;
  }

  if (subject === 'route') {
    const session = ensureSession(context);
    const decision = brokerDecision(session, registry);
    const result = {
      kind: 'trasgo-explain-route',
      contract: session.contract,
      decision,
      note: 'Route ranking combines seeded runtime footprints with observed failures and latency.',
    };
    outputValue(context, result, () => {
      console.log(accent('Explain · route'));
      console.log();
      console.log(dim(result.note));
      console.log();
      printBalanceState(session);
    });
    return 0;
  }

  const genericInput = rest.join(' ').trim();
  if (!genericInput) {
    console.error(coral('usage: trasgo explain <balance|route|json|path>'));
    return 1;
  }

  const result = explainGenericInput(genericInput);
  outputValue(context, result, () => {
    console.log(accent('Explain · input'));
    console.log();
    console.log(dim('Generic packet/pack explanation for JSON or a file path.'));
    console.log();
    console.log(JSON.stringify(result, null, 2));
    console.log();
  });
  return 0;
}

async function handleTrace(rest, context) {
  const [action = 'list', runId] = rest;

  if (action === 'list') {
    const runs = listRunTraces(runtimeHome);
    outputValue(context, { kind: 'trasgo-run-list', runs }, () => {
      if (runs.length === 0) {
        console.log(dim('no persisted run traces'));
        console.log();
        return;
      }
      printTable('Run Traces', [
        { key: 'run_id', label: 'Run ID', width: 36 },
        { key: 'machine', label: 'Machine', width: 20 },
        { key: 'exit_code', label: 'Exit', width: 4 },
        { key: 'started_at', label: 'Started', width: 24 },
      ], runs, line => console.log(line));
    });
    return 0;
  }

  if (action === 'show' && runId) {
    const trace = loadRunTrace(runtimeHome, runId);
    outputValue(context, trace, () => {
      console.log(accent(`Trace · ${trace.machine.id}`));
      console.log();
      console.log(`  ${mint('run')}      ${trace.run_id}`);
      console.log(`  ${mint('started')}  ${trace.started_at}`);
      console.log(`  ${mint('finished')} ${trace.finished_at}`);
      console.log(`  ${mint('exit')}     ${trace.exit_code}`);
      console.log(`  ${mint('path')}     ${dim(trace.trace_path)}`);
      console.log();
      for (const step of trace.steps) {
        console.log(`${gold(step.tool)} ${dim(`(${step.exit_code})`)}`);
        if (step.stdout?.trim()) {
          console.log(dim(step.stdout.trim()));
        }
        if (step.stderr?.trim()) {
          console.log(coral(step.stderr.trim()));
        }
        console.log();
      }
    });
    return 0;
  }

  console.error(coral('usage: trasgo trace <list|show> [run-id]'));
  return 1;
}

async function handleSession(rest, context) {
  const [action, ...args] = rest;

  if (!action || action === 'new') {
    const title = args.join(' ').trim() || 'trasgo-session';
    const session = createSession(runtimeHome, registry, { title });
    setActiveSession(context, session);
    outputValue(context, sessionState(session), () => {
      printSessionState(session);
    });
    return 0;
  }

  if (action === 'list') {
    outputValue(context, { kind: 'trasgo-session-list', sessions: sessionRows() }, () => {
      printSessionList();
    });
    return 0;
  }

  if (action === 'resume' || action === 'use') {
    const sessionId = args[0];
    const session = loadSession(runtimeHome, sessionId, registry);
    setActiveSession(context, session);
    outputValue(context, sessionState(session), () => {
      printSessionState(session);
    });
    return 0;
  }

  if (action === 'state') {
    const session = ensureSession(context);
    outputValue(context, sessionState(session), () => {
      printSessionState(session);
    });
    return 0;
  }

  console.error(coral(`unknown session action: ${action}`));
  return 1;
}

async function handleInit(rest, context) {
  const options = parseWorkflowOptions(rest);
  const session = initSessionContract(runtimeHome, registry, {
    ...options,
    sessionId: context.activeSessionId,
  });
  setActiveSession(context, session);
  outputValue(context, sessionState(session), () => {
    printWorkflowState('Init', session, [
      ['mode', session.contract.mode],
      ['targets', session.contract.targets.join(', ')],
      ['skills', gold(String(session.skills.length))],
      ['mcp', gold(String(session.mcp_mounts.length))],
    ]);
  });
  return 0;
}

async function handlePack(rest, context) {
  const options = parseWorkflowOptions(rest);
  const session = initSessionContract(runtimeHome, registry, {
    ...options,
    sessionId: context.activeSessionId,
  });
  const result = packSession(runtimeHome, registry, session, options);
  setActiveSession(context, result.session);
  outputValue(context, {
    session: sessionState(result.session),
    pack_path: result.outputPath,
    bundle: result.bundle,
  }, () => {
    printPackResult(result);
  });
  return 0;
}

async function handleBoot(rest, context) {
  const options = parseWorkflowOptions(rest);
  const result = bootSession(runtimeHome, registry, {
    ...options,
    sessionId: context.activeSessionId,
  });
  setActiveSession(context, result.session);
  outputValue(context, {
    session: sessionState(result.session),
    decision: result.decision,
    pack_path: result.packPath,
  }, () => {
    printBootResult(result);
  });
  return 0;
}

async function handleBalance(rest, context) {
  const [action, ...args] = rest;
  const session = ensureSession(context);

  if (!action || action === 'show') {
    outputValue(context, balanceSnapshot(session), () => {
      printBalanceState(session);
    });
    return 0;
  }

  if (action === 'set') {
    const [field, ...valueParts] = args;
    const value = valueParts.join(' ');
    setBalanceValue(session, field, value);
    saveSession(runtimeHome, session);
    outputValue(context, balanceSnapshot(session), () => {
      printBalanceState(session);
    });
    return 0;
  }

  if (action === 'packet') {
    const packet = JSON.parse(args.join(' '));
    applyBalancePacket(session, packet);
    saveSession(runtimeHome, session);
    outputValue(context, balanceSnapshot(session), () => {
      printBalanceState(session);
    });
    return 0;
  }

  console.error(coral(`unknown balance action: ${action}`));
  return 1;
}

async function handleSkills(rest, context) {
  const [action, ...args] = rest;

  if (!action || action === 'list') {
    outputValue(context, { kind: 'trasgo-skill-list', skills: skillRows() }, () => {
      listSkills();
    });
    return 0;
  }

  if (action === 'show' && args[0]) {
    return showEntry('skills', args[0], context);
  }

  if (action === 'emit' && args[0]) {
    return emitSkill(args[0]);
  }

  const session = ensureSession(context);

  if (action === 'attach' && args[0]) {
    attachSkill(session, args[0]);
    saveSession(runtimeHome, session);
    outputValue(context, sessionState(session), () => {
      printSessionState(session);
    });
    return 0;
  }

  if (action === 'detach' && args[0]) {
    detachSkill(session, args[0]);
    saveSession(runtimeHome, session);
    outputValue(context, sessionState(session), () => {
      printSessionState(session);
    });
    return 0;
  }

  console.error(coral(`unknown skills action: ${action}`));
  return 1;
}

async function handleMcp(rest, context) {
  const [action, ...args] = rest;

  if (!action || action === 'list') {
    outputValue(context, { kind: 'trasgo-mcp-list', mcp: mcpRows() }, () => {
      listMcp();
    });
    return 0;
  }

  if (action === 'show' && args[0]) {
    return showEntry('mcp', args[0], context);
  }

  const session = ensureSession(context);

  if (action === 'mount' && args[0]) {
    mountMcp(session, args[0]);
    saveSession(runtimeHome, session);
    outputValue(context, sessionState(session), () => {
      printSessionState(session);
    });
    return 0;
  }

  if (action === 'unmount' && args[0]) {
    unmountMcp(session, args[0]);
    saveSession(runtimeHome, session);
    outputValue(context, sessionState(session), () => {
      printSessionState(session);
    });
    return 0;
  }

  console.error(coral(`unknown mcp action: ${action}`));
  return 1;
}

async function handleDemo(rest, context) {
  const [action = 'list', ...args] = rest;

  if (action === 'list') {
    outputValue(context, { kind: 'trasgo-demo-list', demos: demoRows() }, () => {
      listDemos();
    });
    return 0;
  }

  if (action === 'show' && args[0]) {
    const demo = getDemoWorkflow(args[0]);
    if (!demo) {
      console.error(coral(`unknown demo workflow: ${args[0]}`));
      return 1;
    }
    outputValue(context, demo, () => {
      console.log(accent(demo.title));
      console.log();
      console.log(demo.summary);
      console.log();
      console.log(`  ${mint('lane')}      ${demo.lane}`);
      console.log(`  ${mint('goal')}      ${demo.scenario.operator_goal}`);
      console.log(`  ${mint('trigger')}   ${demo.scenario.trigger}`);
      console.log();
    });
    return 0;
  }

  if (action === 'run' && args[0]) {
    const { options } = parseDemoOptions(args.slice(1));
    const result = runDemoWorkflow(args[0], options);
    outputValue(context, result, () => {
      printDemoResult(result);
    });
    return 0;
  }

  console.error(coral('usage: trasgo demo <list|show|run> [workflow-id]'));
  return 1;
}

async function handleSend(rest, context) {
  const input = rest.join(' ').trim();
  if (!input) {
    console.error(coral('send requires input text or a §P|BALANCE packet'));
    return 1;
  }

  const session = ensureSession(context);
  const result = await executeInput(runtimeHome, registry, session, input);
  setActiveSession(context, result.session);
  outputValue(context, result, () => {
    printResponse(result);
  });
  return 0;
}

function printHelp() {
  printBanner();
  console.log(accent('Natural Language'));
  console.log(`  ${mint('trasgo "show me the runtimes"')}        ${dim('intent-routes to the runtime inventory')}`);
  console.log(`  ${mint('trasgo "run the factory copilot demo"')} ${dim('downtime-prevention workflow with savings estimate')}`);
  console.log(`  ${mint('trasgo "run the revenue guard demo"')}  ${dim('deal-desk margin workflow with recovered profit estimate')}`);
  console.log();
  console.log(accent('Workflow'));
  console.log(`  ${mint('trasgo')}                            ${dim('interactive runtime shell')}`);
  console.log(`  ${mint('trasgo quickstart')}                 ${dim('60-second first-run tour with token science and demos')}`);
  console.log(`  ${mint('trasgo init [title]')}               ${dim('seed a session contract + default runtime context')}`);
  console.log(`  ${mint('trasgo pack [--out file]')}          ${dim('build a reusable trasgo pack from the active session')}`);
  console.log(`  ${mint('trasgo boot [--from file]')}         ${dim('activate the bootstrap stack and broker a runtime')}`);
  console.log(`  ${mint('trasgo send <prompt|packet>')}       ${dim('send work through the booted or active session')}`);
  console.log();
  console.log(accent('Runtime'));
  console.log(`  ${mint('trasgo session new [title]')}        ${dim('create a session')}`);
  console.log(`  ${mint('trasgo --session <id> send <text>')} ${dim('operate on an existing session')}`);
  console.log(`  ${mint('trasgo session list')}               ${dim('list saved sessions')}`);
  console.log(`  ${mint('trasgo session use <id>')}           ${dim('resume a session')}`);
  console.log(`  ${mint('trasgo balance show')}               ${dim('show negotiated runtime contract')}`);
  console.log(`  ${mint('trasgo balance set <field> <value>')} ${dim('mutate balance contract')}`);
  console.log(`  ${mint('trasgo serve --stdio')}              ${dim('experimental foreground runtime host')}`);
  console.log(`  ${mint('trasgo serve --http --port 8787')}   ${dim('local HTTP bridge for mobile and external shells')}`);
  console.log();
  console.log(accent('Demo Workflows'));
  console.log(`  ${mint('trasgo demo list')}                  ${dim('list built-in operator/economic demos')}`);
  console.log(`  ${mint('trasgo demo run factory-copilot')}   ${dim('predictive maintenance + downtime avoidance')}`);
  console.log(`  ${mint('trasgo demo run revenue-guard')}     ${dim('quote-margin guardrail + cash drag control')}`);
  console.log(`  ${mint('trasgo run <machine-id>')}           ${dim('execute a machine with persisted trace output')}`);
  console.log(`  ${mint('trasgo trace list | show <run-id>')} ${dim('inspect replayable run traces')}`);
  console.log();
  console.log(accent('Context Engines'));
  console.log(`  ${mint('trasgo skills attach <id>')}         ${dim('attach skill to active session')}`);
  console.log(`  ${mint('trasgo skills detach <id>')}         ${dim('detach skill from active session')}`);
  console.log(`  ${mint('trasgo mcp mount <id>')}             ${dim('mount MCP surface into session context')}`);
  console.log(`  ${mint('trasgo mcp unmount <id>')}           ${dim('unmount MCP surface')}`);
  console.log();
  console.log(accent('Operator'));
  console.log(`  ${mint('trasgo status')}                     ${dim('runtime/control-plane summary')}`);
  console.log(`  ${mint('trasgo doctor [--probe]')}          ${dim('env + optional runtime probes')}`);
  console.log(`  ${mint('trasgo doctor --json')}             ${dim('machine-readable health report')}`);
  console.log(`  ${mint('trasgo explain balance|route')}     ${dim('audit the current contract and route decision')}`);
  console.log(`  ${mint('trasgo advise --codec <json> [--natural <text>]')} ${dim('say whether codec is worth it for this packet')}`);
  console.log(`  ${mint('trasgo runtimes | tools | machines')} ${dim('list registry surfaces')}`);
  console.log(`  ${mint('trasgo dashboard | live')}           ${dim('observatory views')}`);
  console.log(`  ${mint('trasgo tokens --codec <json> [--natural <text>]')} ${dim('exact multi-family token counts and compression')}`);
  console.log(`  ${mint('trasgo optimize --codec <json>')}    ${dim('ASCII alias search scored across the token battery')}`);
  console.log(`  ${mint('trasgo cot <boot|compile|advise|expand>')} ${dim('§CoT compressed reasoning preview layer')}`);
  console.log(`  ${mint('trasgo bench | calibrate | research | validate')} ${dim('legacy orchestration adapters')}`);
  console.log();
  console.log(accent('Global'));
  console.log(`  ${mint('--logo <auto|image|ascii|none>')}    ${dim('launch banner mode; image uses chafa when the terminal supports it')}`);
  console.log(`  ${mint('--json')}                            ${dim('machine-readable workflow output')}`);
  console.log(`  ${mint('trasgo help <quickstart|install|native|mobile|cot>')} ${dim('topic help without scanning the whole shell')}`);
  console.log();
}

async function executeCommand(argv, context) {
  const [command, ...rest] = argv;

  const interpreted = interpretNaturalCommand(argv, context);
  if (interpreted && interpreted.join('\0') !== argv.join('\0')) {
    if (!context.outputJson) {
      console.log(dim(`interpreted: trasgo ${interpreted.join(' ')}`));
      console.log();
    }
    return executeCommand(interpreted, context);
  }

  if (!command || command === 'shell') {
    return startShell();
  }

  if (command === 'help' || command === '--help' || command === '-h') {
    if (rest[0]) {
      return printHelpTopic(rest[0]);
    }
    printHelp();
    return 0;
  }

  if (command === 'status') {
    outputValue(context, statusSnapshot(), () => {
      printStatus();
    });
    return 0;
  }

  if (command === 'init') return handleInit(rest, context);
  if (command === 'pack') return handlePack(rest, context);
  if (command === 'boot') return handleBoot(rest, context);

  if (command === 'quickstart') {
    return handleQuickstart(context);
  }

  if (command === 'doctor') {
    if (context.outputJson) {
      const report = await buildDoctorReport(registry, runtime, { probe: rest.includes('--probe') });
      printJson({ kind: 'trasgo-doctor', ...report });
      return 0;
    }
    return printDoctor({ probe: rest.includes('--probe') });
  }

  if (command === 'serve') {
    const options = parseServeOptions(rest);
    if (!options.stdio && !options.http) {
      console.error(coral('usage: trasgo serve <--stdio|--http> [--port 8787]'));
      return 1;
    }
    if (options.stdio) {
      await serveStdio(runtimeHome, registry);
      return 0;
    }
    await serveHttp(runtimeHome, registry, runtime, { port: options.port });
    return 0;
  }

  if (command === 'session') return handleSession(rest, context);
  if (command === 'balance') return handleBalance(rest, context);
  if (command === 'skills' || command === 'skill') return handleSkills(rest, context);
  if (command === 'mcp') return handleMcp(rest, context);
  if (command === 'demo') return handleDemo(rest, context);
  if (command === 'send' || command === 'packet') return handleSend(rest, context);

  if (command === 'providers' || command === 'runtimes') {
    outputValue(context, { kind: 'trasgo-runtime-list', runtimes: runtimeRows() }, () => {
      listRuntimes();
    });
    return 0;
  }

  if (command === 'tools') {
    outputValue(context, { kind: 'trasgo-tool-list', tools: toolRows() }, () => {
      listTools();
    });
    return 0;
  }

  if (command === 'machines' || command === 'orchestrations' || command === 'orchestrate') {
    if (rest[0] === 'run' && rest[1]) {
      const trace = await runMachineDetailed(registry, rest[1], rest.slice(2), runtime, { capture: context.outputJson });
      outputValue(context, trace, () => {
        console.log(accent(`Machine Run · ${trace.machine.id}`));
        console.log();
        console.log(`  ${mint('run')}    ${trace.run_id}`);
        console.log(`  ${mint('trace')}  ${dim(trace.trace_path)}`);
        console.log(`  ${mint('exit')}   ${trace.exit_code}`);
        console.log();
      });
      return trace.exit_code;
    }
    outputValue(context, { kind: 'trasgo-machine-list', machines: machineRows() }, () => {
      listMachines();
    });
    return 0;
  }

  if (command === 'show') {
    const [collectionName, id] = rest;
    const collections = new Set(['runtimes', 'tools', 'machines', 'mcp', 'skills']);
    if (!collections.has(collectionName) || !id) {
      console.error(coral('usage: trasgo show <runtimes|tools|machines|mcp|skills> <id>'));
      return 1;
    }
    return showEntry(collectionName, id, context);
  }

  if (command === 'advise') return handleAdvise(rest, context);
  if (command === 'cot') return handleCot(rest, context);
  if (command === 'explain') return handleExplain(rest, context);
  if (command === 'trace') return handleTrace(rest, context);

  if (command === 'dashboard') return runNamed('dashboard', rest);
  if (command === 'live' || command === 'watch' || command === 'monitor') return runNamed('live-dashboard', rest);
  if (command === 'bench') return runNamed('bench', rest);
  if (command === 'calibrate') return runNamed('calibrate', rest);
  if (command === 'research') return runNamed('research', rest);
  if (command === 'validate') return runNamed('validate', rest);
  if (command === 'run' && rest[0]) {
    if (getEntry(registry, 'machines', rest[0])) {
      const trace = await runMachineDetailed(registry, rest[0], rest.slice(1), runtime, { capture: context.outputJson });
      outputValue(context, trace, () => {
        console.log(accent(`Machine Run · ${trace.machine.id}`));
        console.log();
        console.log(`  ${mint('run')}    ${trace.run_id}`);
        console.log(`  ${mint('trace')}  ${dim(trace.trace_path)}`);
        console.log(`  ${mint('exit')}   ${trace.exit_code}`);
        console.log();
      });
      return trace.exit_code;
    }
    return runNamed(rest[0], rest.slice(1));
  }

  if (getEntry(registry, 'machines', command) || getEntry(registry, 'tools', command)) {
    return runNamed(command, rest);
  }

  const session = context.activeSessionId ? currentSession(context) : null;
  if (session) {
    return handleSend([command, ...rest], context);
  }

  console.error(coral(`unknown command: ${command}`));
  console.log();
  printHelp();
  return 1;
}

function tokenize(input) {
  return input.trim().split(/\s+/).filter(Boolean);
}

function extractGlobalOptions(argv) {
  const options = {
    sessionId: null,
    outputJson: false,
    logo: process.env.TRASGO_LOGO || 'auto',
  };
  const filtered = [];

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--session' && argv[i + 1]) {
      options.sessionId = argv[i + 1];
      i += 1;
      continue;
    }
    if (argv[i] === '--json') {
      options.outputJson = true;
      continue;
    }
    if (argv[i] === '--logo' && argv[i + 1]) {
      options.logo = argv[i + 1];
      i += 1;
      continue;
    }
    filtered.push(argv[i]);
  }

  return { options, argv: filtered };
}

function printShellHint(context) {
  console.log(dim('type `init`, `pack`, `boot`, `send <prompt>`, `balance show`, `dashboard`, `quit`'));
  if (context.activeSessionId) {
    console.log(dim(`active session: ${context.activeSessionId}`));
  }
  console.log();
}

async function startShell() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    printHelp();
    return 0;
  }

  const context = { activeSessionId: loadPersistedActiveSessionId() };

  printBanner();
  printShellHint(context);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${lavender('trasgo')} ${dim('> ')}`
  });

  return new Promise(resolve => {
    rl.prompt();

    rl.on('line', async line => {
      const input = line.trim();
      if (!input) {
        rl.prompt();
        return;
      }

      if (input === 'quit' || input === 'exit') {
        rl.close();
        return;
      }

      rl.pause();
      try {
        await executeCommand(tokenize(input), context);
      } catch (error) {
        console.error(coral(error.message));
      }
      rl.resume();
      rl.prompt();
    });

    rl.on('close', () => {
      console.log();
      resolve(0);
    });
  });
}

const parsed = extractGlobalOptions(process.argv.slice(2));
bannerOptions = {
  logo: new Set(['auto', 'image', 'ascii', 'none']).has(parsed.options.logo)
    ? parsed.options.logo
    : 'auto',
};
let exitCode = 1;
try {
  exitCode = await executeCommand(parsed.argv, {
    activeSessionId: parsed.options.sessionId || loadPersistedActiveSessionId(),
    outputJson: parsed.options.outputJson,
  });
} catch (error) {
  if (parsed.options.outputJson) {
    console.log(JSON.stringify({ ok: false, error: error.message }, null, 2));
  } else {
    console.error(coral(error.message));
  }
}
process.exitCode = exitCode;
