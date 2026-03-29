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
  loadRegistry,
  printTable,
  resolveBaseUrl,
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
import { serveStdio } from './service.mjs';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(moduleDir, '..', '..');
const runtime = {
  baseDir: repoDir,
  nodeBin: process.execPath,
  pythonBin: process.env.TRASGO_PYTHON || 'python',
};

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

  const imagePath = path.join(runtime.baseDir, 'trasgo.png');
  if (!fs.existsSync(imagePath)) {
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
  return loadSession(runtime.baseDir, context.activeSessionId, registry);
}

function setActiveSession(context, session) {
  context.activeSessionId = session.id;
}

function printStatus() {
  const summary = summarizeRegistry(registry);
  printBanner();
  console.log(accent('Status'));
  console.log(`  ${mint('registry')} ${dim(registry.path)}`);
  console.log(`  ${mint('node')}     ${dim(runtime.nodeBin)}`);
  console.log(`  ${mint('python')}   ${dim(runtime.pythonBin)}`);
  console.log(`  ${mint('sessions')} ${gold(String(listSessions(runtime.baseDir).length))}`);
  console.log();
  console.log(accent('Plane'));
  console.log(`  ${gold('runtimes')} ${summary.runtimes}  ${gold('tools')} ${summary.tools}  ${gold('machines')} ${summary.machines}  ${gold('mcp')} ${summary.mcp}  ${gold('skills')} ${summary.skills}`);
  console.log();
}

function listRuntimes() {
  const rows = getCollection(registry, 'runtimes').map(entry => ({
    id: entry.id,
    kind: entry.kind,
    model: entry.model || 'auto',
    base: entry.resolved_base_url || '-',
    caps: (entry.capabilities || []).join(','),
  }));

  printTable('Runtimes', [
    { key: 'id', label: 'ID', width: 12 },
    { key: 'kind', label: 'Kind', width: 7 },
    { key: 'model', label: 'Model', width: 22 },
    { key: 'base', label: 'Base URL', width: 34 },
    { key: 'caps', label: 'Caps', width: 24 },
  ], rows, line => console.log(line));
}

function listTools() {
  const rows = getCollection(registry, 'tools').map(entry => ({
    id: entry.id,
    layer: entry.layer,
    runner: entry.runner,
    entry: entry.entry,
    desc: entry.description,
  }));

  printTable('Tools', [
    { key: 'id', label: 'ID', width: 16 },
    { key: 'layer', label: 'Layer', width: 14 },
    { key: 'runner', label: 'Runner', width: 8 },
    { key: 'entry', label: 'Entry', width: 28 },
    { key: 'desc', label: 'Description', width: 42 },
  ], rows, line => console.log(line));
}

function listMachines() {
  const rows = getCollection(registry, 'machines').map(entry => ({
    id: entry.id,
    type: entry.type,
    steps: (entry.steps || []).map(step => step.tool).join(' -> '),
    desc: entry.description,
  }));

  printTable('Machines', [
    { key: 'id', label: 'ID', width: 18 },
    { key: 'type', label: 'Type', width: 10 },
    { key: 'steps', label: 'Steps', width: 32 },
    { key: 'desc', label: 'Description', width: 42 },
  ], rows, line => console.log(line));
}

function listMcp() {
  const rows = getCollection(registry, 'mcp').map(entry => ({
    id: entry.id,
    transport: entry.transport,
    root: entry.root,
    resources: (entry.resources || []).join(','),
  }));

  printTable('MCP', [
    { key: 'id', label: 'ID', width: 18 },
    { key: 'transport', label: 'Transport', width: 12 },
    { key: 'root', label: 'Root', width: 24 },
    { key: 'resources', label: 'Resources', width: 56 },
  ], rows, line => console.log(line));
}

function listSkills() {
  const rows = getCollection(registry, 'skills').map(entry => ({
    id: entry.id,
    kind: entry.kind,
    entry: entry.entry,
    desc: entry.description,
  }));

  printTable('Skills', [
    { key: 'id', label: 'ID', width: 16 },
    { key: 'kind', label: 'Kind', width: 12 },
    { key: 'entry', label: 'Entry', width: 28 },
    { key: 'desc', label: 'Description', width: 44 },
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

function showEntry(collectionName, id) {
  const entry = getEntry(registry, collectionName, id);
  if (!entry) {
    console.error(coral(`unknown ${collectionName} entry: ${id}`));
    return 1;
  }
  printJson(entry);
  return 0;
}

function emitSkill(id) {
  const skill = getEntry(registry, 'skills', id);
  if (!skill) {
    console.error(coral(`unknown skill: ${id}`));
    return 1;
  }
  console.log(fs.readFileSync(path.join(runtime.baseDir, skill.entry), 'utf-8'));
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
  const sessions = listSessions(runtime.baseDir);
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
    session = createSession(runtime.baseDir, registry, {});
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

async function handleSession(rest, context) {
  const [action, ...args] = rest;

  if (!action || action === 'new') {
    const title = args.join(' ').trim() || 'trasgo-session';
    const session = createSession(runtime.baseDir, registry, { title });
    setActiveSession(context, session);
    printSessionState(session);
    return 0;
  }

  if (action === 'list') {
    printSessionList();
    return 0;
  }

  if (action === 'resume' || action === 'use') {
    const sessionId = args[0];
    const session = loadSession(runtime.baseDir, sessionId, registry);
    setActiveSession(context, session);
    printSessionState(session);
    return 0;
  }

  if (action === 'state') {
    const session = ensureSession(context);
    printSessionState(session);
    return 0;
  }

  console.error(coral(`unknown session action: ${action}`));
  return 1;
}

async function handleInit(rest, context) {
  const options = parseWorkflowOptions(rest);
  const session = initSessionContract(runtime.baseDir, registry, {
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
  const session = initSessionContract(runtime.baseDir, registry, {
    ...options,
    sessionId: context.activeSessionId,
  });
  const result = packSession(runtime.baseDir, registry, session, options);
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
  const result = bootSession(runtime.baseDir, registry, {
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
    printBalanceState(session);
    return 0;
  }

  if (action === 'set') {
    const [field, ...valueParts] = args;
    const value = valueParts.join(' ');
    setBalanceValue(session, field, value);
    saveSession(runtime.baseDir, session);
    printBalanceState(session);
    return 0;
  }

  if (action === 'packet') {
    const packet = JSON.parse(args.join(' '));
    applyBalancePacket(session, packet);
    saveSession(runtime.baseDir, session);
    printBalanceState(session);
    return 0;
  }

  console.error(coral(`unknown balance action: ${action}`));
  return 1;
}

async function handleSkills(rest, context) {
  const [action, ...args] = rest;

  if (!action || action === 'list') {
    listSkills();
    return 0;
  }

  if (action === 'show' && args[0]) {
    return showEntry('skills', args[0]);
  }

  if (action === 'emit' && args[0]) {
    return emitSkill(args[0]);
  }

  const session = ensureSession(context);

  if (action === 'attach' && args[0]) {
    attachSkill(session, args[0]);
    saveSession(runtime.baseDir, session);
    printSessionState(session);
    return 0;
  }

  if (action === 'detach' && args[0]) {
    detachSkill(session, args[0]);
    saveSession(runtime.baseDir, session);
    printSessionState(session);
    return 0;
  }

  console.error(coral(`unknown skills action: ${action}`));
  return 1;
}

async function handleMcp(rest, context) {
  const [action, ...args] = rest;

  if (!action || action === 'list') {
    listMcp();
    return 0;
  }

  if (action === 'show' && args[0]) {
    return showEntry('mcp', args[0]);
  }

  const session = ensureSession(context);

  if (action === 'mount' && args[0]) {
    mountMcp(session, args[0]);
    saveSession(runtime.baseDir, session);
    printSessionState(session);
    return 0;
  }

  if (action === 'unmount' && args[0]) {
    unmountMcp(session, args[0]);
    saveSession(runtime.baseDir, session);
    printSessionState(session);
    return 0;
  }

  console.error(coral(`unknown mcp action: ${action}`));
  return 1;
}

async function handleSend(rest, context) {
  const input = rest.join(' ').trim();
  if (!input) {
    console.error(coral('send requires input text or a §P|BALANCE packet'));
    return 1;
  }

  const session = ensureSession(context);
  const result = await executeInput(runtime.baseDir, registry, session, input);
  setActiveSession(context, result.session);
  printResponse(result);
  return 0;
}

function printHelp() {
  printBanner();
  console.log(accent('Workflow'));
  console.log(`  ${mint('trasgo')}                            ${dim('interactive runtime shell')}`);
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
  console.log(`  ${mint('trasgo runtimes | tools | machines')} ${dim('list registry surfaces')}`);
  console.log(`  ${mint('trasgo dashboard | live')}           ${dim('observatory views')}`);
  console.log(`  ${mint('trasgo bench | calibrate | research | validate')} ${dim('legacy orchestration adapters')}`);
  console.log();
  console.log(accent('Global'));
  console.log(`  ${mint('--logo <auto|image|ascii|none>')}    ${dim('launch banner mode; image uses chafa when the terminal supports it')}`);
  console.log(`  ${mint('--json')}                            ${dim('machine-readable workflow output')}`);
  console.log();
}

async function executeCommand(argv, context) {
  const [command, ...rest] = argv;

  if (!command || command === 'shell') {
    return startShell();
  }

  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return 0;
  }

  if (command === 'status') {
    printStatus();
    return 0;
  }

  if (command === 'init') return handleInit(rest, context);
  if (command === 'pack') return handlePack(rest, context);
  if (command === 'boot') return handleBoot(rest, context);

  if (command === 'doctor') {
    return printDoctor({ probe: rest.includes('--probe') });
  }

  if (command === 'serve') {
    if (!rest.includes('--stdio')) {
      console.error(coral('only --stdio is supported in v1'));
      return 1;
    }
    await serveStdio(runtime.baseDir, registry);
    return 0;
  }

  if (command === 'session') return handleSession(rest, context);
  if (command === 'balance') return handleBalance(rest, context);
  if (command === 'skills' || command === 'skill') return handleSkills(rest, context);
  if (command === 'mcp') return handleMcp(rest, context);
  if (command === 'send' || command === 'packet') return handleSend(rest, context);

  if (command === 'providers' || command === 'runtimes') {
    listRuntimes();
    return 0;
  }

  if (command === 'tools') {
    listTools();
    return 0;
  }

  if (command === 'machines' || command === 'orchestrations' || command === 'orchestrate') {
    if (rest[0] === 'run' && rest[1]) {
      return runMachine(registry, rest[1], rest.slice(2), runtime);
    }
    listMachines();
    return 0;
  }

  if (command === 'show') {
    const [collectionName, id] = rest;
    const collections = new Set(['runtimes', 'tools', 'machines', 'mcp', 'skills']);
    if (!collections.has(collectionName) || !id) {
      console.error(coral('usage: trasgo show <runtimes|tools|machines|mcp|skills> <id>'));
      return 1;
    }
    return showEntry(collectionName, id);
  }

  if (command === 'dashboard') return runNamed('dashboard', rest);
  if (command === 'live' || command === 'watch' || command === 'monitor') return runNamed('live-dashboard', rest);
  if (command === 'bench') return runNamed('bench', rest);
  if (command === 'calibrate') return runNamed('calibrate', rest);
  if (command === 'research') return runNamed('research', rest);
  if (command === 'validate') return runNamed('validate', rest);
  if (command === 'run' && rest[0]) return runNamed(rest[0], rest.slice(1));

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

  const context = { activeSessionId: null };

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
const exitCode = await executeCommand(parsed.argv, {
  activeSessionId: parsed.options.sessionId,
  outputJson: parsed.options.outputJson,
});
process.exitCode = exitCode;
